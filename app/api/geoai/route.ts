import { NextRequest, NextResponse } from "next/server";
import {
  GEOAI_CONTACT_TEXT,
  GEOAI_SYSTEM_PROMPT,
  type GeoAIAttachment,
} from "@/lib/geoai";
import {
  calculateAccurateArea,
  calculateMetricPerimeter,
  fromDMS,
  parseCoordinates,
  toDMS,
} from "@/lib/legacy-geometry";
import { calculateCutFill, parseVolumeRows } from "@/lib/volume";
import { verifyGeoCalcUser } from "@/lib/firebase-server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequest = {
  message?: string;
  history?: ChatMessage[];
  attachments?: GeoAIAttachment[];
};

type RateState = {
  count: number;
  resetAt: number;
};

type ContentBlock = {
  type?: string;
  text?: string;
  [key: string]: unknown;
};

type InteractionStep = {
  type?: string;
  id?: string;
  name?: string;
  arguments?: unknown;
  content?: ContentBlock[];
  [key: string]: unknown;
};

type InteractionPayload = {
  id?: string;
  output_text?: string;
  status?: string;
  steps?: InteractionStep[];
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type GeminiAttempt = {
  ok: boolean;
  status: number;
  payload: InteractionPayload;
};

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 30;
const MAX_MESSAGE_LENGTH = 8_000;
const MAX_TEXT_ATTACHMENT_LENGTH = 350_000;
const MAX_IMAGE_DATA_LENGTH = 4_200_000;
const MAX_ATTACHMENTS = 4;
const MAX_HISTORY_ITEMS = 10;
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

// These models currently have a Gemini Developer API Free Tier. The app does not
// depend on GEMINI_MODEL/GEMINI_API_URL env vars so an old Vercel value cannot
// accidentally force GeoAI back onto a retired or paid-only configuration.
const GENERAL_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
] as const;

// Gemini 2.5 Flash/Flash-Lite currently include a free Google Search grounding
// allowance. Search is only enabled for queries that actually need live data.
const SEARCH_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"] as const;

const rateStore = new Map<string, RateState>();

const GEOAI_FUNCTION_TOOLS: Array<Record<string, unknown>> = [
  {
    type: "function",
    name: "calculate_land_area",
    description:
      "GeoCalc'ning saqlangan WGS84/UTM formulasida koordinatalardan maydon va perimetr hisoblaydi. coordinates har qatorda 'latitude longitude' bo'ladi.",
    parameters: {
      type: "object",
      properties: {
        coordinates: {
          type: "string",
          description: "Kamida 3 qator WGS84 koordinata. Masalan: 41.31 69.24",
        },
      },
      required: ["coordinates"],
    },
  },
  {
    type: "function",
    name: "convert_decimal_to_dms",
    description: "O'nli koordinatani gradus-minut-sekund (GMS/DMS) formatiga o'tkazadi.",
    parameters: {
      type: "object",
      properties: {
        value: { type: "number", description: "O'nli koordinata qiymati" },
        coordinate_type: {
          type: "string",
          enum: ["lat", "lon"],
          description: "lat — kenglik, lon — uzunlik",
        },
      },
      required: ["value", "coordinate_type"],
    },
  },
  {
    type: "function",
    name: "convert_dms_to_decimal",
    description: "Gradus-minut-sekund koordinatani o'nli formatga o'tkazadi.",
    parameters: {
      type: "object",
      properties: {
        degrees: { type: "number" },
        minutes: { type: "number" },
        seconds: { type: "number" },
        hemisphere: { type: "string", enum: ["N", "S", "E", "W"] },
      },
      required: ["degrees", "minutes", "seconds", "hemisphere"],
    },
  },
  {
    type: "function",
    name: "calculate_cut_fill",
    description:
      "GeoCalc TIN usulida qazish (cut), to'ldirish (fill), sof hajm va reja maydonini hisoblaydi.",
    parameters: {
      type: "object",
      properties: {
        rows: {
          type: "string",
          description:
            "Har qatorda X Y mavjudZ; per_point rejimida X Y mavjudZ loyihaZ.",
        },
        coordinate_mode: { type: "string", enum: ["local", "wgs84"] },
        design_mode: { type: "string", enum: ["level", "per_point"] },
        design_level: {
          type: "number",
          description: "design_mode=level bo'lsa umumiy loyiha balandligi",
        },
      },
      required: ["rows", "coordinate_mode", "design_mode"],
    },
  },
];

const GENERAL_TOOLS: Array<Record<string, unknown>> = [
  { type: "code_execution" },
  ...GEOAI_FUNCTION_TOOLS,
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function requiredString(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} matn ko'rinishida berilishi kerak.`);
  }
  return value.trim();
}

function requiredNumber(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${key} son ko'rinishida berilishi kerak.`);
  }
  return value;
}

function executeGeoCalcFunction(name: string, rawArguments: unknown) {
  const args = asRecord(rawArguments);

  try {
    if (name === "calculate_land_area") {
      const coordinates = requiredString(args, "coordinates");
      const points = parseCoordinates(coordinates);
      if (points.length < 3) throw new Error("Maydon uchun kamida 3 ta nuqta kerak.");
      const area = calculateAccurateArea(points);
      const perimeter = calculateMetricPerimeter(points);
      return {
        ok: true,
        points: points.length,
        area_m2: area,
        area_hectares: area / 10_000,
        area_km2: area / 1_000_000,
        perimeter_m: perimeter,
      };
    }

    if (name === "convert_decimal_to_dms") {
      const value = requiredNumber(args, "value");
      const coordinateType = requiredString(args, "coordinate_type");
      if (coordinateType !== "lat" && coordinateType !== "lon") {
        throw new Error("coordinate_type faqat lat yoki lon bo'lishi mumkin.");
      }
      if (coordinateType === "lat" && Math.abs(value) > 90) {
        throw new Error("Kenglik −90…90 oralig'ida bo'lishi kerak.");
      }
      if (coordinateType === "lon" && Math.abs(value) > 180) {
        throw new Error("Uzunlik −180…180 oralig'ida bo'lishi kerak.");
      }
      return { ok: true, decimal: value, dms: toDMS(value, coordinateType) };
    }

    if (name === "convert_dms_to_decimal") {
      const degrees = requiredNumber(args, "degrees");
      const minutes = requiredNumber(args, "minutes");
      const seconds = requiredNumber(args, "seconds");
      const hemisphere = requiredString(args, "hemisphere").toUpperCase();
      if (!( ["N", "S", "E", "W"] as string[]).includes(hemisphere)) {
        throw new Error("hemisphere N, S, E yoki W bo'lishi kerak.");
      }
      const decimal = fromDMS(
        degrees,
        minutes,
        seconds,
        hemisphere as "N" | "S" | "E" | "W",
      );
      return { ok: true, decimal, dms: `${degrees}° ${minutes}' ${seconds}\" ${hemisphere}` };
    }

    if (name === "calculate_cut_fill") {
      const rows = requiredString(args, "rows");
      const coordinateMode = requiredString(args, "coordinate_mode");
      const designMode = requiredString(args, "design_mode");
      if (coordinateMode !== "local" && coordinateMode !== "wgs84") {
        throw new Error("coordinate_mode local yoki wgs84 bo'lishi kerak.");
      }
      if (designMode !== "level" && designMode !== "per_point") {
        throw new Error("design_mode level yoki per_point bo'lishi kerak.");
      }
      const designLevel =
        designMode === "level" ? requiredNumber(args, "design_level") : 0;
      const normalizedDesignMode = designMode === "per_point" ? "per-point" : "level";
      const points = parseVolumeRows(rows, coordinateMode, normalizedDesignMode, designLevel);
      const result = calculateCutFill(points);
      return {
        ok: true,
        points: result.points.length,
        triangles: result.triangles.length,
        cut_m3: result.cut,
        fill_m3: result.fill,
        net_m3: result.net,
        plan_area_m2: result.planArea,
      };
    }

    return { ok: false, error: `Noma'lum funksiya: ${name}` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Hisoblash bajarilmadi.",
    };
  }
}

function clientKey(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous"
  );
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = rateStore.get(key);

  if (!current || current.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT;
}

function isSafeAttachment(value: unknown): value is GeoAIAttachment {
  if (!value || typeof value !== "object") return false;
  const attachment = value as Partial<GeoAIAttachment>;

  if (
    typeof attachment.name !== "string" ||
    attachment.name.length > 160 ||
    typeof attachment.mimeType !== "string" ||
    attachment.mimeType.length > 100
  ) {
    return false;
  }

  if (attachment.kind === "text") {
    return (
      typeof attachment.content === "string" &&
      attachment.content.length <= MAX_TEXT_ATTACHMENT_LENGTH
    );
  }

  if (attachment.kind === "image") {
    return (
      attachment.mimeType.startsWith("image/") &&
      typeof attachment.data === "string" &&
      attachment.data.length <= MAX_IMAGE_DATA_LENGTH
    );
  }

  return false;
}

function extractOutput(payload: InteractionPayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (!Array.isArray(payload.steps)) return "";

  return payload.steps
    .filter((step) => step?.type === "model_output" && Array.isArray(step.content))
    .flatMap((step) => step.content ?? [])
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => String(block.text).trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function withMandatoryContact(answer: string) {
  const marker = GEOAI_CONTACT_TEXT.split("\n")[0];
  const markerIndex = answer.indexOf(marker);
  const body = (markerIndex >= 0 ? answer.slice(0, markerIndex) : answer).trim();
  const safeBody =
    body || "Savolingiz bo‘yicha javob tayyor bo‘lmadi. Iltimos, so‘rovni qayta yuboring.";
  return `${safeBody}\n\n${GEOAI_CONTACT_TEXT}`;
}

function stripContact(content: string) {
  const marker = GEOAI_CONTACT_TEXT.split("\n")[0];
  const markerIndex = content.indexOf(marker);
  return (markerIndex >= 0 ? content.slice(0, markerIndex) : content).trim();
}

function shouldUseLiveSearch(message: string) {
  if (!message.trim()) return false;

  const normalized = message.toLocaleLowerCase("uz");
  const explicitSearch =
    /(internet|web|google|qidir|qidiring|izla|izlang|search|поиск|найди|найдите|интернет)/i;
  const currentInfo =
    /(bugun|hozir|hozirgi|ayni payt|eng so['’‘`]?nggi|so['’‘`]?nggi|yangilik|yangiliklar|ob[- ]?havo|valyuta|dollar kurs|kursi|narx|reyting|prezident|bosh vazir|ceo|rahbari|o['’‘`]?yin natijasi|today|now|current|latest|recent|news|weather|price|exchange rate|score|standings|president|prime minister|сегодня|сейчас|текущ|последн|свеж|новост|погод|цена|курс|президент|премьер)/i;
  const directUrl = /https?:\/\//i;

  return explicitSearch.test(normalized) || currentInfo.test(normalized) || directUrl.test(message);
}

function looksComplex(message: string, attachments: GeoAIAttachment[]) {
  if (attachments.length > 0 || message.length > 500) return true;
  return /(kod|code|dastur|program|debug|xato|error|tahlil|analysis|matemat|formula|hisobla|calculate|geodez|utm|wgs|kml|dxf|cut|fill|koordinat|coordinate|translate|tarjima|essay|maqola|hujjat|document)/i.test(
    message,
  );
}

function modelOrder(message: string, attachments: GeoAIAttachment[]) {
  if (looksComplex(message, attachments)) return [...GENERAL_MODELS];
  return [GENERAL_MODELS[1], GENERAL_MODELS[0], GENERAL_MODELS[2]];
}

function buildHistory(history: ChatMessage[]) {
  return history
    .filter(
      (item): item is ChatMessage =>
        Boolean(
          item &&
            (item.role === "user" || item.role === "assistant") &&
            typeof item.content === "string",
        ),
    )
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => {
      const content = stripContact(item.content).slice(0, 4_000);
      return `${item.role === "user" ? "Foydalanuvchi" : "GeoAI"}: ${content}`;
    })
    .join("\n\n");
}

function buildInputItems(
  message: string,
  history: ChatMessage[],
  attachments: GeoAIAttachment[],
) {
  const historyText = buildHistory(history);
  const inputItems: Array<{ type: string; [key: string]: unknown }> = [
    {
      type: "text",
      text: `Oldingi suhbat:\n${historyText || "Yangi suhbat."}\n\nFoydalanuvchining yangi so‘rovi:\n${message || "Biriktirilgan faylni tahlil qiling."}`,
    },
  ];

  for (const attachment of attachments) {
    if (attachment.kind === "image") {
      inputItems.push({
        type: "image",
        mime_type: attachment.mimeType,
        data: attachment.data,
      });
    } else {
      inputItems.push({
        type: "text",
        text: `\n--- ${attachment.name} (${attachment.mimeType}) fayli boshlandi ---\n${attachment.content}\n--- ${attachment.name} fayli tugadi ---`,
      });
    }
  }

  return inputItems;
}

async function callGemini(
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs = 55_000,
): Promise<GeminiAttempt> {
  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });

    let payload: InteractionPayload = {};
    try {
      payload = (await response.json()) as InteractionPayload;
    } catch {
      payload = {};
    }

    return { ok: response.ok, status: response.status, payload };
  } catch (error) {
    console.error("GeoAI Gemini network error", error);
    return {
      ok: false,
      status: 504,
      payload: { error: { message: "Gemini bilan tarmoq aloqasi uzildi." } },
    };
  }
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function functionCalls(payload: InteractionPayload) {
  return (Array.isArray(payload.steps) ? payload.steps : []).filter(
    (step) =>
      step.type === "function_call" &&
      typeof step.id === "string" &&
      typeof step.name === "string",
  );
}

async function runGeneralModel(
  apiKey: string,
  model: string,
  inputItems: Array<{ type: string; [key: string]: unknown }>,
) {
  // Gemini 3.x can combine built-in tools with custom function calling. For the
  // 2.5 fallback we keep only GeoCalc functions to avoid an unsupported mixed-
  // tool request while still preserving all core geodetic calculations.
  const tools = model.startsWith("gemini-2.5") ? GEOAI_FUNCTION_TOOLS : GENERAL_TOOLS;

  const initial = await callGemini(apiKey, {
    model,
    system_instruction: GEOAI_SYSTEM_PROMPT,
    input: inputItems,
    tools,
    store: true,
    generation_config: {
      max_output_tokens: 6_144,
      tool_choice: "auto",
    },
  });

  if (!initial.ok) return { ...initial, answer: "" };

  let payload = initial.payload;
  let answer = extractOutput(payload);

  for (let round = 0; round < 4; round += 1) {
    const calls = functionCalls(payload);
    if (!calls.length) {
      return { ok: true, status: 200, payload, answer };
    }

    if (!payload.id) {
      return {
        ok: false,
        status: 502,
        payload: { error: { message: "Gemini function-call interaction ID qaytarmadi." } },
        answer: "",
      };
    }

    const results = calls.map((step) => ({
      type: "function_result",
      name: step.name,
      call_id: step.id,
      result: [
        {
          type: "text",
          text: JSON.stringify(executeGeoCalcFunction(step.name as string, step.arguments)),
        },
      ],
    }));

    const continuation = await callGemini(apiKey, {
      model,
      previous_interaction_id: payload.id,
      system_instruction: GEOAI_SYSTEM_PROMPT,
      input: results,
      tools,
      store: true,
      generation_config: {
        max_output_tokens: 6_144,
        tool_choice: "auto",
      },
    });

    if (!continuation.ok) return { ...continuation, answer: "" };

    payload = continuation.payload;
    answer = extractOutput(payload) || answer;
  }

  return { ok: true, status: 200, payload, answer };
}

async function runGeneral(
  apiKey: string,
  inputItems: Array<{ type: string; [key: string]: unknown }>,
  message: string,
  attachments: GeoAIAttachment[],
) {
  let lastFailure: GeminiAttempt | null = null;

  for (const model of modelOrder(message, attachments)) {
    const result = await runGeneralModel(apiKey, model, inputItems);
    if (result.ok && result.answer.trim()) {
      return { answer: result.answer.trim(), model };
    }

    lastFailure = result;
    console.warn(
      "GeoAI model failed",
      model,
      result.status,
      result.payload.error?.message || "empty answer",
    );

    if (!isRetryableStatus(result.status) && result.status !== 400 && result.status !== 404) {
      break;
    }
  }

  return { answer: "", model: "", failure: lastFailure };
}

async function runLiveSearch(
  apiKey: string,
  inputItems: Array<{ type: string; [key: string]: unknown }>,
) {
  let lastFailure: GeminiAttempt | null = null;

  for (const model of SEARCH_MODELS) {
    const result = await callGemini(apiKey, {
      model,
      system_instruction: `${GEOAI_SYSTEM_PROMPT}\n\nBu so‘rov dolzarb ma’lumot talab qiladi. Google Search vositasidan foydalanib, topilgan eng yangi ma’lumotni tekshirib javob bering. Qidiruv natijasida aniq sana bo‘lsa, sanani ko‘rsating.`,
      input: inputItems,
      tools: [{ type: "google_search" }],
      store: false,
      generation_config: {
        max_output_tokens: 6_144,
      },
    });

    const answer = result.ok ? extractOutput(result.payload) : "";
    if (result.ok && answer.trim()) {
      return { answer: answer.trim(), model };
    }

    lastFailure = result;
    console.warn(
      "GeoAI search model failed",
      model,
      result.status,
      result.payload.error?.message || "empty answer",
    );

    if (!isRetryableStatus(result.status) && result.status !== 400 && result.status !== 404) {
      break;
    }
  }

  return { answer: "", model: "", failure: lastFailure };
}

function upstreamError(status: number, message?: string) {
  if (status === 401 || status === 403) {
    return "Gemini API kaliti yaroqsiz yoki ushbu Google AI Studio loyihasida ruxsat berilmagan. Vercel’dagi GEMINI_API_KEY ni tekshiring.";
  }
  if (status === 429) {
    return "Bepul Gemini API limiti hozircha tugagan. Limit tiklangach GeoAI avtomatik yana ishlaydi.";
  }
  if (status === 400 || status === 404) {
    return "Gemini modeli yoki so‘rov formati Google tomonidan qabul qilinmadi. GeoAI konfiguratsiyasini yangilash kerak.";
  }
  if (status >= 500) {
    return "Gemini xizmati vaqtincha javob bermayapti. Birozdan so‘ng qayta urinib ko‘ring.";
  }
  return message || "GeoAI xizmati vaqtincha javob bermadi.";
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      configured: Boolean(process.env.GEMINI_API_KEY),
      provider: "Gemini Developer API",
      generalModels: GENERAL_MODELS,
      searchModels: SEARCH_MODELS,
      liveSearch: "automatic-for-current-questions",
      googleSearchFreeMode: true,
      authRequired: true,
      note: "GET faqat konfiguratsiyani ko‘rsatadi; haqiqiy Gemini javobi GeoAI chatdagi POST so‘rovida tekshiriladi.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const currentUser = await verifyGeoCalcUser(request);
  if (!currentUser) {
    return NextResponse.json(
      { error: "GeoAI dan foydalanish uchun Google orqali kiring." },
      { status: 401 },
    );
  }

  if (isRateLimited(`${currentUser.uid}:${clientKey(request)}`)) {
    return NextResponse.json(
      { error: "So‘rovlar juda tez yuborildi. Bir necha daqiqadan so‘ng qayta urinib ko‘ring." },
      { status: 429 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GeoAI server kaliti sozlanmagan. Vercel → Project → Settings → Environment Variables ichiga GEMINI_API_KEY qo‘shing va Redeploy qiling.",
      },
      { status: 503 },
    );
  }

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];

  if ((!message && !attachments.length) || message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: "Xabar bo‘sh yoki ruxsat etilgan hajmdan katta." },
      { status: 400 },
    );
  }

  if (
    attachments.length > MAX_ATTACHMENTS ||
    attachments.some((attachment) => !isSafeAttachment(attachment))
  ) {
    return NextResponse.json(
      { error: "Fayl turi yoki hajmi qo‘llab-quvvatlanmaydi." },
      { status: 400 },
    );
  }

  const history = Array.isArray(body.history) ? body.history : [];
  const inputItems = buildInputItems(message, history, attachments);
  const wantsLiveSearch = shouldUseLiveSearch(message);

  try {
    if (wantsLiveSearch) {
      const searched = await runLiveSearch(apiKey, inputItems);
      if (searched.answer) {
        return NextResponse.json(
          {
            answer: withMandatoryContact(searched.answer),
            mode: "live-search",
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      }

      // Search grounding has its own free quota. If it is unavailable, do not make
      // GeoAI useless: fall back to ordinary free Gemini and clearly mark that the
      // answer could not be live-verified.
      const fallback = await runGeneral(apiKey, inputItems, message, attachments);
      if (fallback.answer) {
        return NextResponse.json(
          {
            answer: withMandatoryContact(
              `Eslatma: jonli Google qidiruvi limiti hozir mavjud emas, shuning uchun quyidagi javob real vaqtda tekshirilmagan.\n\n${fallback.answer}`,
            ),
            mode: "general-fallback",
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      }

      const failure = fallback.failure || searched.failure;
      const status = failure?.status || 502;
      return NextResponse.json(
        { error: upstreamError(status, failure?.payload.error?.message) },
        { status: status === 429 ? 429 : 502 },
      );
    }

    const result = await runGeneral(apiKey, inputItems, message, attachments);
    if (result.answer) {
      return NextResponse.json(
        {
          answer: withMandatoryContact(result.answer),
          mode: "general",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const status = result.failure?.status || 502;
    return NextResponse.json(
      { error: upstreamError(status, result.failure?.payload.error?.message) },
      { status: status === 429 ? 429 : 502 },
    );
  } catch (error) {
    console.error("GeoAI request failed", error);
    return NextResponse.json(
      { error: "GeoAI bilan bog‘lanishda vaqtinchalik xato yuz berdi." },
      { status: 504 },
    );
  }
}
