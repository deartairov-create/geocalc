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

export const maxDuration = 60;

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

const GEOAI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "calculate_land_area",
        description:
          "GeoCalc'ning saqlangan WGS84/UTM formulasida koordinatalardan maydon va perimetr hisoblaydi.",
        parameters: {
          type: "OBJECT",
          properties: {
            coordinates: {
              type: "STRING",
              description: "Kamida 3 qator WGS84 koordinata. Masalan: 41.31 69.24",
            },
          },
          required: ["coordinates"],
        },
      },
      {
        name: "convert_decimal_to_dms",
        description: "O'nli koordinatani gradus-minut-sekund (GMS/DMS) formatiga o'tkazadi.",
        parameters: {
          type: "OBJECT",
          properties: {
            value: { type: "NUMBER", description: "O'nli koordinata qiymati" },
            coordinate_type: {
              type: "STRING",
              enum: ["lat", "lon"],
              description: "lat — kenglik, lon — uzunlik",
            },
          },
          required: ["value", "coordinate_type"],
        },
      },
      {
        name: "convert_dms_to_decimal",
        description: "Gradus-minut-sekund koordinatani o'nli formatga o'tkazadi.",
        parameters: {
          type: "OBJECT",
          properties: {
            degrees: { type: "NUMBER" },
            minutes: { type: "NUMBER" },
            seconds: { type: "NUMBER" },
            hemisphere: { type: "STRING", enum: ["N", "S", "E", "W"] },
          },
          required: ["degrees", "minutes", "seconds", "hemisphere"],
        },
      },
      {
        name: "calculate_cut_fill",
        description:
          "GeoCalc TIN usulida qazish (cut), to'ldirish (fill), sof hajm va reja maydonini hisoblaydi.",
        parameters: {
          type: "OBJECT",
          properties: {
            rows: {
              type: "STRING",
              description:
                "Har qatorda X Y mavjudZ; per_point rejimida X Y mavjudZ loyihaZ.",
            },
            coordinate_mode: { type: "STRING", enum: ["local", "wgs84"] },
            design_mode: { type: "STRING", enum: ["level", "per_point"] },
            design_level: {
              type: "NUMBER",
              description: "design_mode=level bo'lsa umumiy loyiha balandligi",
            },
          },
          required: ["rows", "coordinate_mode", "design_mode"],
        },
      },
    ],
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
      return { ok: true, decimal: value, dms: toDMS(value, coordinateType as "lat" | "lon") };
    }

    if (name === "convert_dms_to_decimal") {
      const degrees = requiredNumber(args, "degrees");
      const minutes = requiredNumber(args, "minutes");
      const seconds = requiredNumber(args, "seconds");
      const hemisphere = requiredString(args, "hemisphere").toUpperCase();
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
      const designLevel = designMode === "level" ? requiredNumber(args, "design_level") : 0;
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

function withMandatoryContact(answer: string) {
  const marker = "Xizmat, murojaat, shikoyat, qonunbuzarliklar va takliflar uchun";
  const markerIndex = answer.indexOf(marker);
  const body = (markerIndex >= 0 ? answer.slice(0, markerIndex) : answer).trim();
  return `${body || "Savolingiz bo‘yicha aniq javob tayyor bo‘lmadi."}\n\n${GEOAI_CONTACT_TEXT}`;
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
      { error: "GeoAI server kaliti (GEMINI_API_KEY) kiritilmagan." },
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

  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];

  // Tarixni qo'shish
  if (Array.isArray(body.history)) {
    body.history.slice(-6).forEach((item) => {
      const contactIndex = item.content.indexOf(GEOAI_CONTACT_TEXT.split("\n")[0]);
      const content = contactIndex >= 0 ? item.content.slice(0, contactIndex) : item.content;
      contents.push({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: content.slice(0, 3000) }],
      });
    });
  }

  // Yangi so'rov
  const currentParts: Array<Record<string, unknown>> = [];
  if (message) {
    currentParts.push({ text: message });
  }

  for (const attachment of attachments) {
    if (attachment.kind === "image") {
      const base64Data = attachment.data.includes(",")
        ? attachment.data.split(",")[1]
        : attachment.data;
      currentParts.push({
        inline_data: {
          mime_type: attachment.mimeType,
          data: base64Data,
        },
      });
    } else {
      currentParts.push({
        text: `\n--- Fayl: ${attachment.name} ---\n${attachment.content}\n--- Fayl oxiri ---`,
      });
    }
  }

  contents.push({ role: "user", parts: currentParts });

  try {
    let answer = "";

    for (let round = 0; round < 3; round += 1) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: GEOAI_SYSTEM_PROMPT }],
          },
          contents,
          tools: GEOAI_TOOLS,
        }),
        signal: AbortSignal.timeout(25_000),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Gemini API Xatosi:", data);
        return NextResponse.json(
          { error: `Gemini API Xatosi: ${data.error?.message || "Noma'lum xato"}` },
          { status: 502 },
        );
      }

      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      let functionCallFound = false;

      for (const part of parts) {
        if (part.text) {
          answer += part.text;
        }
        if (part.functionCall) {
          functionCallFound = true;
          const { name, args } = part.functionCall;
          const result = executeGeoCalcFunction(name, args);

          contents.push({
            role: "model",
            parts: [{ functionCall: part.functionCall }],
          });

          contents.push({
            role: "user",
            parts: [
              {
                functionResponse: {
                  name,
                  response: result,
                },
              },
            ],
          });
        }
      }

      if (!functionCallFound) break;
    }

    return NextResponse.json(
      { answer: withMandatoryContact(answer) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("GeoAI API xatolik:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `GeoAI Server Xatosi: ${error.message}`
            : "GeoAI so'rovida vaqt tugadi.",
      },
      { status: 504 },
    );
  }
}
