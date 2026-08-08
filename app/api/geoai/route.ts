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

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 18;
const MAX_MESSAGE_LENGTH = 6_000;
const MAX_TEXT_ATTACHMENT_LENGTH = 350_000;
const MAX_IMAGE_DATA_LENGTH = 4_200_000;
const MAX_ATTACHMENTS = 4;

const rateStore = new Map<string, RateState>();

type InteractionStep = {
  type?: string;
  id?: string;
  name?: string;
  arguments?: unknown;
  content?: Array<{ type?: string; text?: string; [key: string]: unknown }>;
  [key: string]: unknown;
};

type InteractionPayload = {
  output_text?: string;
  steps?: InteractionStep[];
  error?: { message?: string };
};

const GEOAI_TOOLS: Array<Record<string, unknown>> = [
  { type: "google_search" },
  { type: "code_execution" },
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
      if (!(["N", "S", "E", "W"] as string[]).includes(hemisphere)) {
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

function extractOutput(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as InteractionPayload;

  if (typeof response.output_text === "string") {
    return response.output_text.trim();
  }

  if (!Array.isArray(response.steps)) return "";

  return response.steps
    .filter((step) => step?.type === "model_output" && Array.isArray(step.content))
    .flatMap((step) => step.content ?? [])
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => String(block.text).trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function withMandatoryContact(answer: string) {
  const marker =
    "Xizmat, murojaat, shikoyat, qonunbuzarliklar va takliflar uchun";
  const markerIndex = answer.indexOf(marker);
  const body = (markerIndex >= 0 ? answer.slice(0, markerIndex) : answer).trim();
  return `${body || "Savolingiz bo‘yicha aniq javob tayyor bo‘lmadi. Iltimos, ma’lumotni boshqacha yozib ko‘ring."}\n\n${GEOAI_CONTACT_TEXT}`;
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GeoAI server kaliti hali sozlanmagan." },
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

  const history = (Array.isArray(body.history) ? body.history : [])
    .filter(
      (item): item is ChatMessage =>
        Boolean(
          item &&
            (item.role === "user" || item.role === "assistant") &&
            typeof item.content === "string",
        ),
    )
    .slice(-8)
    .map((item) => {
      const contactIndex = item.content.indexOf(GEOAI_CONTACT_TEXT.split("\n")[0]);
      const content = contactIndex >= 0 ? item.content.slice(0, contactIndex) : item.content;
      return `${item.role === "user" ? "Foydalanuvchi" : "GeoAI"}: ${content.slice(0, 4_000)}`;
    })
    .join("\n\n");

  const inputItems: Array<{ type: string; [key: string]: unknown }> = [
    {
      type: "text",
      text: `Oldingi suhbat:\n${history || "Yangi suhbat."}\n\nFoydalanuvchining yangi so‘rovi:\n${message || "Biriktirilgan faylni tahlil qiling."}`,
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

  const endpoint =
    process.env.GEMINI_API_URL ||
    "https://generativelanguage.googleapis.com/v1beta/interactions";
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";

  try {
    let interactionInput: InteractionStep[] = [
      { type: "user_input", content: inputItems },
    ];
    let answer = "";

    for (let round = 0; round < 4; round += 1) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
          "Api-Revision": "2026-05-20",
        },
        body: JSON.stringify({
          model,
          system_instruction: GEOAI_SYSTEM_PROMPT,
          input: interactionInput,
          tools: GEOAI_TOOLS,
          store: false,
        }),
        signal: AbortSignal.timeout(55_000),
      });

      const payload = (await response.json()) as InteractionPayload;
      if (!response.ok) {
        console.error("GeoAI upstream error", response.status, payload.error?.message);
        return NextResponse.json(
          { error: "GeoAI xizmati vaqtincha javob bermadi. Keyinroq qayta urinib ko‘ring." },
          { status: 502 },
        );
      }

      answer = extractOutput(payload) || answer;
      const steps = Array.isArray(payload.steps) ? payload.steps : [];
      const functionCalls = steps.filter(
        (step) =>
          step.type === "function_call" &&
          typeof step.id === "string" &&
          typeof step.name === "string",
      );

      if (!functionCalls.length) break;

      const functionResults: InteractionStep[] = functionCalls.map((step) => ({
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

      interactionInput = [...interactionInput, ...steps, ...functionResults];
    }

    return NextResponse.json(
      { answer: withMandatoryContact(answer) },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("GeoAI request failed", error);
    return NextResponse.json(
      { error: "GeoAI bilan bog‘lanishda vaqtinchalik xato yuz berdi." },
      { status: 504 },
    );
  }
}
