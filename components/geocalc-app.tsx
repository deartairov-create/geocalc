"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Box as BoxIcon,
  Calculator,
  Check,
  ChevronRight,
  ClipboardCopy,
  Compass,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Globe,
  History,
  Info,
  Layers,
  Layers3,
  LoaderCircle,
  LogIn,
  LogOut,
  Mail,
  Map as MapIcon,
  MapPin,
  Maximize2,
  Menu,
  Moon,
  Mountain,
  Navigation,
  Phone,
  Plus,
  RefreshCw,
  Ruler,
  Send,
  SendHorizontal,
  Share2,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  TrendingUp,
  Triangle,
  Upload,
  User as UserIcon,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/lib/firebase-client";

import {
  CoordinateParseError,
  calculateAccurateArea,
  calculateMetricPerimeter,
  formatNumber,
  fromDMS,
  parseCoordinates,
  projectPointsToCanvas,
  toDMS,
  trimTrailingZeros,
  type GeoPoint,
} from "@/lib/legacy-geometry";

import {
  calculateCutFill,
  parseVolumeRows,
  projectVolumePoints,
  VolumeInputError,
  type VolumeCoordinateMode,
  type VolumeDesignMode,
  type VolumeResult,
} from "@/lib/volume";

import {
  calculateVincentyDistanceAndAzimuth,
  calculateDirectGeodeticPoint,
  calculatePolygonProperties,
  calculateSlope,
  solveDifferentialLeveling,
  SimpleShapes,
  type AzimuthResult,
  type LevelingStation,
  type SlopeResult,
  type SimpleShapeResult,
} from "@/lib/geodesy-advanced";

import {
  GEOAI_CONTACT_TEXT,
  GEOAI_CONTACT_TEXT_RU,
  GEOAI_CONTACT_TEXT_EN,
} from "@/lib/geoai";

// Dynamic import for Leaflet Map to ensure SSR-safety
const InteractiveMap = dynamic(() => import("@/components/interactive-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[520px] rounded-3xl bg-[var(--panel-solid)]/70 backdrop-blur-xl border border-[var(--border)] flex flex-col items-center justify-center gap-3 text-[var(--muted)] animate-pulse shadow-2xl">
      <Globe className="w-8 h-8 text-[var(--accent)] animate-spin" />
      <span className="text-sm font-medium">Sun'iy yo‘ldosh xaritasi yuklanmoqda...</span>
    </div>
  ),
});

type AppLanguage = "uz" | "ru" | "en";

function tr(language: AppLanguage, uz: string, ru: string, en: string) {
  return language === "ru" ? ru : language === "en" ? en : uz;
}

type ModuleId =
  | "area"
  | "map"
  | "distance"
  | "converter"
  | "shapes"
  | "slope"
  | "volume"
  | "geoai"
  | "guide"
  | "history"
  | "contacts";

type HistoryRecord = {
  id: string;
  type: string;
  title: string;
  value: string;
  date: string;
  details?: Record<string, string | number>;
};

type NavItem = {
  id: ModuleId;
  label: string;
  hint: string;
  icon: LucideIcon;
  badge?: string;
};

const AREA_SAMPLE = `41.311081 69.240562
41.311081 69.241562
41.310281 69.241562
41.310281 69.240562`;

const VOLUME_SAMPLE = `0 0 100.40
40 0 101.10
80 0 99.90
0 40 100.80
40 40 102.20
80 40 100.30
0 80 99.60
40 80 101.40
80 80 100.00`;

function getNavItems(language: AppLanguage): NavItem[] {
  return [
    {
      id: "area",
      label: tr(language, "Yuza hisoblash", "Расчёт площади", "Area calculation"),
      hint: tr(language, "WGS84 · m² · gektar", "WGS84 · м² · гектар", "WGS84 · m² · hectare"),
      icon: Calculator,
    },
    {
      id: "map",
      label: tr(language, "Interfaol xarita", "Интерактивная карта", "Interactive map"),
      hint: tr(language, "Sputnik · GPS · Chizish", "Спутник · GPS · Черчение", "Satellite · GPS · Draw"),
      icon: MapIcon,
      badge: "NEW",
    },
    {
      id: "distance",
      label: tr(language, "Masofa va Azimut", "Расстояние и азимут", "Distance & Azimuth"),
      hint: tr(language, "Geodezik to‘g‘ri/teskari", "Геодезические задачи", "Geodetic problems"),
      icon: Compass,
      badge: "PRO",
    },
    {
      id: "converter",
      label: tr(language, "Konvertor", "Конвертер", "Converter"),
      hint: tr(language, "O‘nli ↔ GMS ↔ UTM", "Десятичные ↔ DMS", "Decimal ↔ DMS"),
      icon: RefreshCw,
    },
    {
      id: "shapes",
      label: tr(language, "Sodda shakllar", "Простые фигуры", "Simple shapes"),
      hint: tr(language, "To‘rtburchak, Geron, Doira", "Быстрый расчёт", "Fast geometry"),
      icon: Triangle,
    },
    {
      id: "slope",
      label: tr(language, "Nivelir & Nishablik", "Нивелир и уклоны", "Leveling & Slope"),
      hint: tr(language, "Stansiya jurnali · % / ‰", "Превышения и уклоны", "Elevations & slopes"),
      icon: TrendingUp,
    },
    {
      id: "volume",
      label: tr(language, "Hajm hisoblash", "Расчёт объёма", "Volume calculation"),
      hint: "TIN · Cut & Fill",
      icon: BoxIcon,
    },
    {
      id: "geoai",
      label: tr(language, "GeoAI yordamchi", "GeoAI ассистент", "GeoAI assistant"),
      hint: tr(language, "Sun'iy intellekt maslahati", "AI Консультация", "AI Geodesy chat"),
      icon: Sparkles,
      badge: "AI",
    },
    {
      id: "contacts",
      label: tr(language, "Bog‘lanish", "Контакты", "Contacts"),
      hint: tr(language, "Muallif kontaktlari", "Связь с автором", "Author contacts"),
      icon: Phone,
    },
    {
      id: "guide",
      label: tr(language, "Qo‘llanma", "Справка", "User guide"),
      hint: tr(language, "Formulalar va standartlar", "Формулы и теория", "Formulas & manual"),
      icon: Info,
    },
    {
      id: "history",
      label: tr(language, "Tarix", "История", "History"),
      hint: tr(language, "Saqlangan hisoblar", "Сохранённые расчёты", "Saved calculations"),
      icon: History,
    },
  ];
}

export default function GeoCalcApp() {
  const [language, setLanguage] = useState<AppLanguage>("uz");
  const [activeModule, setActiveModule] = useState<ModuleId>("area");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>([]);

  // Firebase Auth State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // 1. Area Module State
  const [areaInput, setAreaInput] = useState<string>(AREA_SAMPLE);
  const [areaPoints, setAreaPoints] = useState<GeoPoint[]>([]);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [areaViewMode, setAreaViewMode] = useState<"canvas" | "map">("map");

  // 2. Distance Module State
  const [distP1, setDistP1] = useState<{ lat: string; lon: string }>({
    lat: "41.311081",
    lon: "69.240562",
  });
  const [distP2, setDistP2] = useState<{ lat: string; lon: string }>({
    lat: "39.654700",
    lon: "66.975800",
  });
  const [distResult, setDistResult] = useState<AzimuthResult | null>(null);

  // Direct Geodetic State
  const [directStart, setDirectStart] = useState({ lat: "41.311081", lon: "69.240562" });
  const [directAzimuth, setDirectAzimuth] = useState("45");
  const [directDistance, setDirectDistance] = useState("1000");
  const [directResult, setDirectResult] = useState<GeoPoint | null>(null);

  // 3. Converter State
  const [convLatDec, setConvLatDec] = useState("41.311081");
  const [convLonDec, setConvLonDec] = useState("69.240562");
  const [convBatchText, setConvBatchText] = useState(AREA_SAMPLE);
  const [convBatchResult, setConvBatchResult] = useState<string>("");

  // 4. Shapes State
  const [shapeType, setShapeType] = useState<"rect" | "tri" | "trap" | "circ" | "pit">("rect");
  const [shapeParams, setShapeParams] = useState<Record<string, number>>({
    w: 25,
    l: 40,
    a: 30,
    b: 40,
    c: 50,
    h: 15,
    r: 12,
    topArea: 200,
    bottomArea: 120,
    depth: 3,
  });
  const [shapeResult, setShapeResult] = useState<SimpleShapeResult | any | null>(null);

  // 5. Slope & Leveling State
  const [slopeH, setSlopeH] = useState("2.5");
  const [slopeD, setSlopeD] = useState("100");
  const [slopeResult, setSlopeResult] = useState<SlopeResult | null>(null);
  const [levelingBm, setLevelingBm] = useState("100.00");
  const [levelingRows, setLevelingRows] = useState<
    Array<{ bs?: number; is?: number; fs?: number; remark?: string }>
  >([
    { bs: 1.45, remark: "BM-1 boshlang‘ich reper" },
    { is: 1.20, remark: "Pikyet 0+00" },
    { is: 1.65, remark: "Pikyet 0+50" },
    { fs: 2.10, bs: 1.35, remark: "Burilish nuqtasi TP-1" },
    { fs: 0.95, remark: "TBM-2 oxirgi reper" },
  ]);
  const [levelingTable, setLevelingTable] = useState<LevelingStation[]>([]);

  // 6. Volume State
  const [volumeInput, setVolumeInput] = useState(VOLUME_SAMPLE);
  const [volumeCoordMode, setVolumeCoordMode] = useState<VolumeCoordinateMode>("local");
  const [volumeDesignMode, setVolumeDesignMode] = useState<VolumeDesignMode>("level");
  const [volumeDesignLevel, setVolumeDesignLevel] = useState("101.00");
  const [volumeResult, setVolumeResult] = useState<VolumeResult | null>(null);
  const [volumeError, setVolumeError] = useState<string | null>(null);

  // 7. GeoAI Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "bot"; text: string }>>([
    {
      role: "bot",
      text: tr(
        language,
        "Assalomu alaykum! Men GeoAI — GeoCalc platformasining sun'iy intellekt muhandislik yordamchisiman. Geodeziya, topografiya, yer maydoni, koordinatalar, yer ishlari va hisob-kitoblar bo‘yicha savollaringizga to‘liq va professional javob beraman.",
        "Здравствуйте! Я GeoAI — AI ассистент платформы GeoCalc. Отвечу на любые вопросы по геодезии, съёмке, координатам и земляным работам.",
        "Hello! I am GeoAI — your AI engineering assistant on GeoCalc. I provide expert solutions for geodesy, land survey, coordinates, and earthwork calculations.",
      ),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Toast / Copy helper
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Auth Listener
  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        setCurrentUser(user);
        setIsAuthLoading(false);
      });
      return () => unsubscribe();
    } catch (e) {
      setIsAuthLoading(false);
    }
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(firebaseAuth, googleProvider);
      showToast(tr(language, "Google orqali kirdingiz!", "Вход через Google выполнен!", "Signed in with Google!"));
    } catch (err: any) {
      console.error("Auth error", err);
      showToast(err.message || "Kirishda xatolik yuz berdi");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(firebaseAuth);
      showToast(tr(language, "Tizimdan chiqildi", "Вы вышли из системы", "Signed out"));
    } catch (err: any) {
      console.error("Sign out error", err);
    }
  };

  // Theme switch effect
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("geocalc_history");
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  const addHistory = (item: Omit<HistoryRecord, "id" | "date">) => {
    const record: HistoryRecord = {
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setHistory((prev) => {
      const next = [record, ...prev.slice(0, 49)];
      try {
        localStorage.setItem("geocalc_history", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Re-calculate Area whenever areaInput changes
  useEffect(() => {
    try {
      if (!areaInput.trim()) {
        setAreaPoints([]);
        setAreaError(null);
        return;
      }
      const pts = parseCoordinates(areaInput);
      setAreaPoints(pts);
      setAreaError(null);
    } catch (e: any) {
      setAreaError(e.message || "Koordinata kiritishda xatolik");
    }
  }, [areaInput]);

  // Handle map points update in Area Module
  const handleMapPointsChange = (pts: GeoPoint[]) => {
    setAreaPoints(pts);
    const text = pts.map((p) => `${p.lat.toFixed(6)} ${p.lon.toFixed(6)}`).join("\n");
    setAreaInput(text);
  };

  // Run Area Calculation
  const areaProperties = useMemo(() => {
    if (areaPoints.length < 3) return null;
    return calculatePolygonProperties(areaPoints);
  }, [areaPoints]);

  // Distance Calculation
  const handleCalculateDistance = () => {
    try {
      const p1: GeoPoint = { lat: Number(distP1.lat), lon: Number(distP1.lon) };
      const p2: GeoPoint = { lat: Number(distP2.lat), lon: Number(distP2.lon) };
      if (!Number.isFinite(p1.lat) || !Number.isFinite(p1.lon) || !Number.isFinite(p2.lat) || !Number.isFinite(p2.lon)) {
        showToast(tr(language, "Koordinatalarni to‘g‘ri kiriting", "Введите корректные координаты", "Invalid coordinates"));
        return;
      }
      const res = calculateVincentyDistanceAndAzimuth(p1, p2);
      setDistResult(res);
      addHistory({
        type: "distance",
        title: tr(language, "Masofa va Azimut", "Расстояние", "Distance & Azimuth"),
        value: `${res.distanceKm.toFixed(3)} km (${res.initialAzimuthDeg.toFixed(2)}°)`,
      });
      showToast(tr(language, "Hisoblandi!", "Рассчитано!", "Calculated!"));
    } catch (e: any) {
      showToast(e.message || "Xatolik");
    }
  };

  // Direct Geodetic
  const handleCalculateDirect = () => {
    try {
      const p1: GeoPoint = { lat: Number(directStart.lat), lon: Number(directStart.lon) };
      const az = Number(directAzimuth);
      const d = Number(directDistance);
      const res = calculateDirectGeodeticPoint(p1, az, d);
      setDirectResult(res);
      showToast(tr(language, "Yangi nuqta topildi!", "Новая точка найдена!", "Target point found!"));
    } catch (e: any) {
      showToast(e.message || "Xatolik");
    }
  };

  // Batch Converter
  const handleBatchConvert = () => {
    try {
      const pts = parseCoordinates(convBatchText);
      const lines = pts.map((p, i) => `Nuqta #${i + 1}: ${toDMS(p.lat, "lat")} , ${toDMS(p.lon, "lon")}`);
      setConvBatchResult(lines.join("\n"));
      showToast(tr(language, "Konvertatsiya qilindi!", "Сконвертировано!", "Converted!"));
    } catch (e: any) {
      showToast(e.message || "Xato");
    }
  };

  // Shape Calculation
  useEffect(() => {
    try {
      if (shapeType === "rect") {
        setShapeResult(SimpleShapes.rectangle(shapeParams.w || 0, shapeParams.l || 0));
      } else if (shapeType === "tri") {
        setShapeResult(SimpleShapes.triangleHeron(shapeParams.a || 0, shapeParams.b || 0, shapeParams.c || 0));
      } else if (shapeType === "trap") {
        setShapeResult(SimpleShapes.trapezoid(shapeParams.a || 0, shapeParams.b || 0, shapeParams.h || 0));
      } else if (shapeType === "circ") {
        setShapeResult(SimpleShapes.circle(shapeParams.r || 0));
      } else if (shapeType === "pit") {
        setShapeResult(SimpleShapes.pitVolume(shapeParams.topArea || 0, shapeParams.bottomArea || 0, shapeParams.depth || 0));
      }
    } catch (e: any) {
      setShapeResult(null);
    }
  }, [shapeType, shapeParams]);

  // Slope Calculation
  const handleCalculateSlope = () => {
    try {
      const res = calculateSlope(Number(slopeH), Number(slopeD));
      setSlopeResult(res);
      addHistory({
        type: "slope",
        title: tr(language, "Nishablik", "Уклон", "Slope"),
        value: `${res.slopePercent}% (${res.slopeAngleDeg.toFixed(2)}°)`,
      });
      showToast(tr(language, "Nishablik hisoblandi!", "Рассчитано!", "Calculated!"));
    } catch (e: any) {
      showToast(e.message || "Xatolik");
    }
  };

  // Leveling Calculation
  const handleCalculateLeveling = () => {
    try {
      const res = solveDifferentialLeveling(Number(levelingBm), levelingRows);
      setLevelingTable(res);
      showToast(tr(language, "Nivelir jurnali tayyor!", "Журнал готов!", "Leveling solved!"));
    } catch (e: any) {
      showToast(e.message || "Xatolik");
    }
  };

  // Volume Calculation
  const handleCalculateVolume = () => {
    try {
      const rows = parseVolumeRows(volumeInput, volumeCoordMode, volumeDesignMode, Number(volumeDesignLevel));
      const res = calculateCutFill(rows);
      setVolumeResult(res);
      setVolumeError(null);
      addHistory({
        type: "volume",
        title: tr(language, "Cut & Fill Hajmi", "Объём Cut & Fill", "Volume Cut & Fill"),
        value: `Cut: ${res.cut.toFixed(1)} m³ | Fill: ${res.fill.toFixed(1)} m³`,
      });
      showToast(tr(language, "Hajm hisoblandi!", "Объём рассчитан!", "Volume computed!"));
    } catch (e: any) {
      setVolumeError(e.message || "Hajm hisoblashda xatolik");
      setVolumeResult(null);
    }
  };

  // GeoAI Chat Send (Supports Vercel API with graceful local fallback)
  const handleSendChat = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      // 1. Attempt API call to /api/geoai
      const token = currentUser ? await currentUser.getIdToken().catch(() => null) : null;
      const res = await fetch("/api/geoai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: userMsg,
          history: chatMessages.slice(-8).map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.text,
          })),
          language,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.answer) {
          setChatMessages((prev) => [...prev, { role: "bot", text: data.answer }]);
          setIsChatLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("GeoAI API endpoint offline or key pending, switching to built-in knowledge", err);
    }

    // 2. Built-in Instant AI Knowledge Response (Full Geodesy & Contact Support)
    setTimeout(() => {
      let reply = "";
      const lower = userMsg.toLowerCase();

      if (lower.includes("kontakt") || lower.includes("aloqa") || lower.includes("bog'lanish") || lower.includes("author") || lower.includes("telefon")) {
        reply = tr(
          language,
          `Muallif bilan bog‘lanish va takliflar uchun kontaktlar:\n\n📧 Email: deartairov@gmail.com\n💬 Telegram: @dearr5\n📞 Telefon: +998(95) 830-01-42\n\nPowered by Toirov Azizbek`,
          `Контакты для связи и предложений:\n\n📧 Email: deartairov@gmail.com\n💬 Telegram: @dearr5\n📞 Телефон: +998(95) 830-01-42\n\nPowered by Toirov Azizbek`,
          `Author and support contacts:\n\n📧 Email: deartairov@gmail.com\n💬 Telegram: @dearr5\n📞 Phone: +998(95) 830-01-42\n\nPowered by Toirov Azizbek`,
        );
      } else if (lower.includes("sotix") || lower.includes("gektar") || lower.includes("yuza") || lower.includes("maydon")) {
        reply = tr(
          language,
          "1 Sotix (Ar) = 100 m² ga teng.\n1 Gektar (ha) = 10,000 m² = 100 sotix.\n1 km² = 100 gektar = 1,000,000 m².\n\nGeoCalc 'Yuza hisoblash' va 'Interfaol xarita' bo‘limlarida WGS84 koordinatalarini Gauss-Krüger (UTM 41N, 42N, 43N) proyeksiyalariga aylantirib, eng yuqori aniqlikda maydonni hisoblab beradi.",
          "1 сотка (ар) = 100 м².\n1 гектар (га) = 10 000 м² = 100 соток.\n1 км² = 100 га = 1 000 000 м².\n\nGeoCalc переводит координаты WGS84 в проекцию Гаусса-Крюгера/UTM и вычисляет точную геодезическую площадь.",
          "1 Sotix (Ar) = 100 m².\n1 Hectare (ha) = 10,000 m² = 100 sotix.\n1 km² = 100 hectares = 1,000,000 m².\n\nGeoCalc transforms WGS84 coordinates to local UTM zones for geodetic-grade area computations.",
        );
      } else if (lower.includes("cut") || lower.includes("fill") || lower.includes("hajm") || lower.includes("tuproq")) {
        reply = tr(
          language,
          "Cut & Fill (Qazish va to‘kish) yer tekislash ishlarida relef balandliklarini loyiha balandligiga moslash uchun ishlatiladi.\n\nDelaunay triangulyatsiyasi (TIN) orqali yer relyefi 3D prizmalarga ajratiladi va qaziladigan (Cut) hamda to‘kiladigan (Fill) tuproq hajmi m³ da hisoblanadi.",
          "Расчёт объёма Cut & Fill делит рельеф на 3D-призмы методом триангуляции Делоне (TIN) для точного вычисления выемки и насыпи грунта в м³.",
          "Cut & Fill calculation uses Delaunay Triangulation (TIN) to compute 3D prism volumes for excavation and embankment in cubic meters.",
        );
      } else if (lower.includes("azimut") || lower.includes("rumb") || lower.includes("masofa")) {
        reply = tr(
          language,
          "Azimut — shimoliy yo‘nalishdan soat mili bo‘yicha o‘lchanadigan burchak (0° dan 360° gacha).\nRumb esa eng yaqin meridian (Shimol yoki Janub)dan 0° dan 90° gacha burchak bo‘lib, 4 ta chorakka (NE, SE, SW, NW) bo‘linadi.\n\nGeoCalc Vincenty formulasi orqali 0.5 mm aniqlikda masofa va azimutni hisoblaydi.",
          "Азимут измеряется от севера по часовой стрелке (0°–360°). Румб — угол от ближайшего меридиана (0°–90°) в четвертях СВ, ЮВ, ЮЗ, СЗ.\n\nGeoCalc вычисляет расстояние по формуле Винсенти с точностью до 0.5 мм.",
          "Azimuth is measured clockwise from True North (0°–360°). Bearing (Rhumb) is measured 0°–90° from North or South within NE, SE, SW, NW quadrants.",
        );
      } else {
        reply = tr(
          language,
          `GeoAI savolingizni qabul qildi: "${userMsg}".\n\nGeoCalc platformasi yordamida WGS84 koordinatalar, yer maydoni, masofalar, azimut, nivelirlash, nishablik va yer ishlari hajmini to‘liq hisoblashingiz mumkin.`,
          `GeoAI принял ваш запрос: "${userMsg}".\n\nGeoCalc обеспечивает высокоточные расчёты координат WGS84, площадей, расстояний, нивелирования и объёмов.`,
          `GeoAI received your request: "${userMsg}".\n\nGeoCalc provides full engineering computations for areas, coordinates, distances, leveling, and volumes.`,
        );
      }

      setChatMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: `${reply}\n\n---\n📧 deartairov@gmail.com · 💬 @dearr5 · 📞 +998(95)830-01-42\nPowered by Toirov Azizbek`,
        },
      ]);
      setIsChatLoading(false);
    }, 500);
  };

  const navItems = getNavItems(language);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--bg)] text-[var(--text)] selection:bg-[var(--accent)] selection:text-black font-sans relative overflow-x-hidden">
      {/* Background Luxury Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-[var(--accent)]/10 blur-[130px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] rounded-full bg-[var(--blue)]/10 blur-[150px]" />
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-2xl bg-[var(--panel-solid)]/90 text-[var(--accent)] border border-[var(--border-strong)] shadow-2xl font-bold text-xs flex items-center gap-2.5 backdrop-blur-2xl"
          >
            <Check className="w-4 h-4 text-[var(--accent)]" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main App Container */}
      <div className="flex-1 flex flex-col md:flex-row w-full max-w-[1750px] mx-auto z-10">
        {/* Left Sidebar (Glassmorphism) */}
        <aside
          className={`w-full md:w-[290px] lg:w-[320px] flex-shrink-0 bg-[var(--sidebar)] backdrop-blur-2xl border-r border-[var(--border)] p-4 flex flex-col justify-between transition-all ${
            isSidebarOpen ? "block" : "hidden md:flex"
          }`}
        >
          <div>
            {/* Logo & Brand Header */}
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] flex items-center justify-center text-black font-extrabold text-xl shadow-lg shadow-[var(--accent)]/20">
                  <Globe className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="font-extrabold text-lg tracking-tight flex items-center gap-1.5 text-[var(--text)]">
                    GeoCalc <span className="text-[var(--accent)] text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[var(--accent-soft)] border border-[var(--border-strong)]">PRO</span>
                  </h1>
                  <p className="text-[11px] text-[var(--muted)] font-medium">
                    Geodeziya & GeoAI Platformasi
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsSidebarOpen(false)}
                className="md:hidden p-1.5 rounded-xl text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Profile / Google Auth Box */}
            <div className="mb-4 p-3 rounded-2xl bg-[var(--panel)]/70 border border-[var(--border)] backdrop-blur-lg">
              {isAuthLoading ? (
                <div className="flex items-center gap-2 text-xs text-[var(--muted)] animate-pulse">
                  <LoaderCircle className="w-4 h-4 animate-spin" /> Tekshirilmoqda...
                </div>
              ) : currentUser ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full border border-[var(--accent)] object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center font-bold text-xs">
                        {currentUser.displayName?.[0] || "U"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--text)] truncate">
                        {currentUser.displayName || "Foydalanuvchi"}
                      </div>
                      <div className="text-[10px] text-[var(--muted-2)] truncate">
                        {currentUser.email}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSignOut}
                    title="Chiqish"
                    className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGoogleSignIn}
                  className="w-full py-2 px-3 rounded-xl bg-[var(--panel-raised)] hover:bg-[var(--accent)] hover:text-black border border-[var(--border-strong)] text-xs font-bold text-[var(--text)] transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <LogIn className="w-4 h-4 text-[var(--accent)] group-hover:text-black" />
                  Google orqali kirish
                </button>
              )}
            </div>

            {/* Navigation List */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveModule(item.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-between transition-all group ${
                      isActive
                        ? "bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] text-black font-extrabold shadow-lg shadow-[var(--accent)]/15"
                        : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-raised)]/80"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? "text-black" : "text-[var(--muted-2)] group-hover:text-[var(--accent)]"}`} />
                      <div>
                        <div className="leading-tight">{item.label}</div>
                        <div className={`text-[10px] font-normal ${isActive ? "text-black/80" : "text-[var(--muted-2)]"}`}>
                          {item.hint}
                        </div>
                      </div>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                          isActive
                            ? "bg-black/20 text-black"
                            : "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border-strong)]"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Footer Controls: Language & Theme Switcher */}
          <div className="pt-4 border-t border-[var(--border)] mt-4 space-y-3">
            <div className="flex items-center justify-between">
              {/* Language Switch */}
              <div className="flex items-center bg-[var(--panel-solid)] border border-[var(--border)] rounded-xl p-0.5 text-[11px] font-bold">
                {(["uz", "ru", "en"] as AppLanguage[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLanguage(l)}
                    className={`px-2.5 py-1 rounded-lg uppercase transition-all ${
                      language === l
                        ? "bg-[var(--accent)] text-black shadow-sm"
                        : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {/* Day / Night Theme Toggle */}
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2.5 rounded-xl bg-[var(--panel-solid)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] transition-all flex items-center gap-1.5 text-xs font-semibold"
                title="Kun / Tun rejimi"
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="w-4 h-4 text-[var(--warning)]" />
                    <span className="text-[10px]">Kun</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-[var(--blue)]" />
                    <span className="text-[10px]">Tun</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-[10px] text-[var(--muted-2)] text-center font-medium">
              Powered by <strong className="text-[var(--accent)]">Toirov Azizbek</strong>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-[var(--bg-deep)]/80 backdrop-blur-md p-3 md:p-6 lg:p-8 overflow-y-auto">
          {/* Top Mobile Bar */}
          <div className="md:hidden flex items-center justify-between pb-4 mb-4 border-b border-[var(--border)]">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2.5 rounded-2xl bg-[var(--panel)] border border-[var(--border)] text-[var(--text)] shadow-sm"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-extrabold text-sm text-[var(--text)] flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-[var(--accent)]" /> GeoCalc PRO
            </span>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2.5 rounded-2xl bg-[var(--panel)] border border-[var(--border)] text-[var(--muted)]"
            >
              {theme === "dark" ? <Sun className="w-4 h-4 text-[var(--warning)]" /> : <Moon className="w-4 h-4 text-[var(--blue)]" />}
            </button>
          </div>

          {/* ========================================================================= */}
          {/* MODULE 1: AREA (YUZA HISOBLASH VA XARITA) */}
          {/* ========================================================================= */}
          {activeModule === "area" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-[var(--text)] tracking-tight flex items-center gap-2">
                    <Calculator className="w-6 h-6 text-[var(--accent)]" />
                    {tr(language, "Yer maydonini aniq hisoblash", "Расчёт площади земельного участка", "Precision Land Area Calculation")}
                  </h2>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {tr(
                      language,
                      "WGS84 koordinatalarini kiriting yoki quyidagi sun'iy yo‘ldosh xaritasida to‘g‘ridan-to‘g‘ri chizing.",
                      "Введите координаты WGS84 или нарисуйте участок прямо на интерактивной карте со спутником.",
                      "Enter WGS84 coordinates or draw directly on the interactive satellite map.",
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-[var(--panel)]/80 border border-[var(--border)] p-1 rounded-2xl backdrop-blur-xl">
                  <button
                    onClick={() => setAreaViewMode("map")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      areaViewMode === "map" ? "bg-[var(--accent)] text-black shadow-md" : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    <MapIcon className="w-3.5 h-3.5" />
                    {tr(language, "Interfaol xarita", "Карта", "Map View")}
                  </button>
                  <button
                    onClick={() => setAreaViewMode("canvas")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      areaViewMode === "canvas" ? "bg-[var(--accent)] text-black shadow-md" : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    <Layers3 className="w-3.5 h-3.5" />
                    {tr(language, "Sxema (2D)", "Схема 2D", "2D Scheme")}
                  </button>
                </div>
              </div>

              {/* Grid: Input + Map */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-5 rounded-3xl bg-[var(--panel)]/80 border border-[var(--border)] shadow-2xl backdrop-blur-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-[var(--accent)]" />
                        {tr(language, "Koordinatalar ro‘yxati (Kenglik Uzunlik)", "Список координат", "Coordinates List")}
                      </label>
                      <span className="text-[10px] font-mono text-[var(--muted)]">
                        {areaPoints.length} {tr(language, "ta nuqta", "точек", "points")}
                      </span>
                    </div>

                    <textarea
                      rows={7}
                      value={areaInput}
                      onChange={(e) => setAreaInput(e.target.value)}
                      placeholder="41.311081 69.240562&#10;41.311081 69.241562&#10;41.310281 69.241562"
                      className="w-full p-3.5 rounded-2xl bg-[var(--field)] border border-[var(--border)] font-mono text-xs text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all resize-y"
                    />

                    {areaError && (
                      <div className="p-3 rounded-xl bg-[var(--danger-soft)] border border-[var(--danger)] text-[var(--danger)] text-xs font-medium">
                        {areaError}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => setAreaInput(AREA_SAMPLE)}
                        className="px-3 py-1.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--text)] transition-all"
                      >
                        {tr(language, "Namuna", "Пример", "Sample")}
                      </button>
                      <button
                        onClick={() => setAreaInput("")}
                        className="px-3 py-1.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--border)] text-xs text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-all"
                      >
                        {tr(language, "Tozalash", "Очистить", "Clear")}
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(areaInput);
                          showToast(tr(language, "Koordinatalar nusxalandi!", "Скопировано!", "Copied!"));
                        }}
                        className="ml-auto px-3.5 py-1.5 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] font-bold text-xs hover:bg-[var(--accent)] hover:text-black transition-all flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {tr(language, "Nusxalash", "Копировать", "Copy")}
                      </button>
                    </div>
                  </div>

                  {areaProperties && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="p-4 rounded-2xl bg-[var(--panel)]/80 border border-[var(--border)] backdrop-blur-xl">
                        <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Maydon (m²)</div>
                        <div className="text-lg font-black text-[var(--accent)] mt-0.5">
                          {formatNumber(areaProperties.areaM2)} m²
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-[var(--panel)]/80 border border-[var(--border)] backdrop-blur-xl">
                        <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Sotix (Ar)</div>
                        <div className="text-lg font-black text-[var(--text)] mt-0.5">
                          {areaProperties.areaSotix.toFixed(2)} sotix
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-[var(--panel)]/80 border border-[var(--border)] backdrop-blur-xl">
                        <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Gektar (ha)</div>
                        <div className="text-lg font-black text-[var(--text)] mt-0.5">
                          {areaProperties.areaHectares.toFixed(4)} ga
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-[var(--panel)]/80 border border-[var(--border)] backdrop-blur-xl">
                        <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Perimetr</div>
                        <div className="text-sm font-black text-[var(--blue)] mt-0.5">
                          {areaProperties.perimeterMeters.toFixed(1)} m
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-[var(--panel)]/80 border border-[var(--border)] backdrop-blur-xl col-span-2">
                        <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Centroid Koordinatasi</div>
                        <div className="text-xs font-mono font-bold text-[var(--text)] mt-0.5">
                          {areaProperties.centroid.lat.toFixed(6)}°, {areaProperties.centroid.lon.toFixed(6)}°
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-7">
                  {areaViewMode === "map" ? (
                    <InteractiveMap
                      initialPoints={areaPoints}
                      onPointsChange={handleMapPointsChange}
                      language={language}
                      height="540px"
                    />
                  ) : (
                    <div className="p-6 rounded-3xl bg-[var(--panel)]/80 border border-[var(--border)] h-[540px] flex flex-col items-center justify-center backdrop-blur-xl text-center">
                      <Layers3 className="w-10 h-10 text-[var(--accent)] mb-2" />
                      <div className="text-xs text-[var(--muted)] font-mono">
                        {areaPoints.length >= 3
                          ? `${areaPoints.length} ta nuqta aniqlandi. Xaritada ko‘rish uchun "Interfaol xarita"ga o‘ting.`
                          : "Kamida 3 ta koordinata kiriting."}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODULE 2: MAP */}
          {/* ========================================================================= */}
          {activeModule === "map" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-[var(--text)] flex items-center gap-2">
                  <MapIcon className="w-6 h-6 text-[var(--accent)]" />
                  {tr(language, "To‘liq ekranli Sun'iy yo‘ldosh xaritasi", "Интерактивная спутниковая карта", "Full Interactive Satellite Map")}
                </h2>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Xaritada poligon, masofa va koordinatalarni o‘lchang.
                </p>
              </div>

              <InteractiveMap language={language} height="calc(100vh - 220px)" />
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODULE 3: DISTANCE & AZIMUTH */}
          {/* ========================================================================= */}
          {activeModule === "distance" && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-[var(--text)] flex items-center gap-2">
                  <Compass className="w-6 h-6 text-[var(--accent)]" />
                  {tr(language, "Masofa, Azimut va Rumb hisoblash", "Расчёт расстояния, азимута и румба", "Distance, Azimuth & Bearing")}
                </h2>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Vincenty ellipsoidal formulasi bo‘yicha 0.5 mm aniqlikdagi geodezik masofa.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 rounded-3xl bg-[var(--panel)]/80 border border-[var(--border)] shadow-2xl backdrop-blur-xl">
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-[var(--accent)] flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" /> 1-Boshlang‘ich nuqta
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[var(--muted)]">Lat</label>
                      <input
                        type="text"
                        value={distP1.lat}
                        onChange={(e) => setDistP1({ ...distP1, lat: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--muted)]">Lon</label>
                      <input
                        type="text"
                        value={distP1.lon}
                        onChange={(e) => setDistP1({ ...distP1, lon: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-[var(--blue)] flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" /> 2-Oxirgi nuqta
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[var(--muted)]">Lat</label>
                      <input
                        type="text"
                        value={distP2.lat}
                        onChange={(e) => setDistP2({ ...distP2, lat: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--muted)]">Lon</label>
                      <input
                        type="text"
                        value={distP2.lon}
                        onChange={(e) => setDistP2({ ...distP2, lon: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 pt-2">
                  <button
                    onClick={handleCalculateDistance}
                    className="w-full py-3 rounded-2xl bg-[var(--accent)] text-black font-extrabold text-xs shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-2"
                  >
                    <Calculator className="w-4 h-4" />
                    Masofa va Azimutni hisoblash
                  </button>
                </div>
              </div>

              {distResult && (
                <div className="p-5 rounded-3xl bg-[var(--panel)]/80 border border-[var(--border-strong)] shadow-2xl backdrop-blur-xl">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Masofa (metr)</div>
                      <div className="text-base font-black text-[var(--accent)] mt-0.5">{distResult.distanceMeters.toFixed(2)} m</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Masofa (km)</div>
                      <div className="text-base font-black text-[var(--text)] mt-0.5">{distResult.distanceKm.toFixed(3)} km</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Azimut</div>
                      <div className="text-base font-black text-[var(--blue)] mt-0.5">{distResult.initialAzimuthDeg.toFixed(2)}°</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Rumb</div>
                      <div className="text-sm font-black text-[var(--warning)] mt-0.5 font-mono">{distResult.rhumbString}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODULE 4: CONVERTER */}
          {/* ========================================================================= */}
          {activeModule === "converter" && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-[var(--text)] flex items-center gap-2">
                  <RefreshCw className="w-6 h-6 text-[var(--accent)]" />
                  Koordinatalar Konvertori
                </h2>
                <p className="text-xs text-[var(--muted)] mt-1">
                  O‘nli gradus va Gradus Minut Sekund (GMS/DMS) orasida o‘girish.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-[var(--panel)]/80 border border-[var(--border)] shadow-2xl backdrop-blur-xl space-y-4">
                <h3 className="text-xs font-bold text-[var(--accent)] uppercase">Bitta nuqtani aylantirish</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[var(--muted)] font-semibold">Lat DD</label>
                    <input
                      type="text"
                      value={convLatDec}
                      onChange={(e) => setConvLatDec(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                    />
                    <div className="text-[11px] font-mono text-[var(--accent)] mt-1">
                      {Number.isFinite(Number(convLatDec)) ? toDMS(Number(convLatDec), "lat") : "-"}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--muted)] font-semibold">Lon DD</label>
                    <input
                      type="text"
                      value={convLonDec}
                      onChange={(e) => setConvLonDec(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                    />
                    <div className="text-[11px] font-mono text-[var(--accent)] mt-1">
                      {Number.isFinite(Number(convLonDec)) ? toDMS(Number(convLonDec), "lon") : "-"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-[var(--panel)]/80 border border-[var(--border)] shadow-2xl backdrop-blur-xl space-y-4">
                <h3 className="text-xs font-bold text-[var(--blue)] uppercase">Ommaviy (Batch) Ro‘yxat Konvertori</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <textarea
                      rows={6}
                      value={convBatchText}
                      onChange={(e) => setConvBatchText(e.target.value)}
                      className="w-full p-3 rounded-2xl bg-[var(--field)] border border-[var(--border)] font-mono text-xs"
                    />
                    <button
                      onClick={handleBatchConvert}
                      className="mt-2 px-4 py-2.5 rounded-xl bg-[var(--blue)] text-white font-bold text-xs shadow-md"
                    >
                      Barchasini GMS ga o‘girish
                    </button>
                  </div>
                  <div>
                    <textarea
                      rows={6}
                      readOnly
                      value={convBatchResult}
                      placeholder="Natijalar bu yerda chiqadi..."
                      className="w-full p-3 rounded-2xl bg-[var(--panel-raised)] border border-[var(--border)] font-mono text-xs text-[var(--accent)]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODULE 5: SIMPLE SHAPES */}
          {/* ========================================================================= */}
          {activeModule === "shapes" && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-[var(--text)] flex items-center gap-2">
                  <Triangle className="w-6 h-6 text-[var(--accent)]" />
                  Sodda Geometrik Shakllar Kalkulyatori
                </h2>
                <p className="text-xs text-[var(--muted)] mt-1">
                  To‘rtburchak, Geron uchburchagi, trapetsiya, doira va kotlovan hajmi.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 p-1.5 bg-[var(--panel)]/80 border border-[var(--border)] rounded-2xl backdrop-blur-xl">
                {[
                  { id: "rect", label: "To‘rtburchak" },
                  { id: "tri", label: "Uchburchak (Geron)" },
                  { id: "trap", label: "Trapetsiya" },
                  { id: "circ", label: "Doira" },
                  { id: "pit", label: "Kotlovan hajmi" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setShapeType(s.id as any)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      shapeType === s.id
                        ? "bg-[var(--accent)] text-black shadow-md"
                        : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 rounded-3xl bg-[var(--panel)]/80 border border-[var(--border)] shadow-2xl backdrop-blur-xl">
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-[var(--text)] uppercase">O‘lchamlar (metr)</h3>
                  {shapeType === "rect" && (
                    <div className="space-y-2">
                      <input
                        type="number"
                        placeholder="Eni (a)"
                        value={shapeParams.w}
                        onChange={(e) => setShapeParams({ ...shapeParams, w: Number(e.target.value) })}
                        className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                      />
                      <input
                        type="number"
                        placeholder="Bo‘yi (b)"
                        value={shapeParams.l}
                        onChange={(e) => setShapeParams({ ...shapeParams, l: Number(e.target.value) })}
                        className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                      />
                    </div>
                  )}

                  {shapeType === "tri" && (
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        placeholder="a"
                        value={shapeParams.a}
                        onChange={(e) => setShapeParams({ ...shapeParams, a: Number(e.target.value) })}
                        className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                      />
                      <input
                        type="number"
                        placeholder="b"
                        value={shapeParams.b}
                        onChange={(e) => setShapeParams({ ...shapeParams, b: Number(e.target.value) })}
                        className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                      />
                      <input
                        type="number"
                        placeholder="c"
                        value={shapeParams.c}
                        onChange={(e) => setShapeParams({ ...shapeParams, c: Number(e.target.value) })}
                        className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                      />
                    </div>
                  )}

                  {shapeType === "trap" && (
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        placeholder="a"
                        value={shapeParams.a}
                        onChange={(e) => setShapeParams({ ...shapeParams, a: Number(e.target.value) })}
                        className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                      />
                      <input
                        type="number"
                        placeholder="b"
                        value={shapeParams.b}
                        onChange={(e) => setShapeParams({ ...shapeParams, b: Number(e.target.value) })}
                        className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                      />
                      <input
                        type="number"
                        placeholder="h"
                        value={shapeParams.h}
                        onChange={(e) => setShapeParams({ ...shapeParams, h: Number(e.target.value) })}
                        className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                      />
                    </div>
                  )}

                  {shapeType === "circ" && (
                    <input
                      type="number"
                      placeholder="Radius R"
                      value={shapeParams.r}
                      onChange={(e) => setShapeParams({ ...shapeParams, r: Number(e.target.value) })}
                      className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                    />
                  )}

                  {shapeType === "pit" && (
                    <div className="space-y-2">
                      <input
                        type="number"
                        placeholder="S1 (Yuqori yuzasi m²)"
                        value={shapeParams.topArea}
                        onChange={(e) => setShapeParams({ ...shapeParams, topArea: Number(e.target.value) })}
                        className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                      />
                      <input
                        type="number"
                        placeholder="S2 (Tub yuzasi m²)"
                        value={shapeParams.bottomArea}
                        onChange={(e) => setShapeParams({ ...shapeParams, bottomArea: Number(e.target.value) })}
                        className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                      />
                      <input
                        type="number"
                        placeholder="Chuqurlik H (m)"
                        value={shapeParams.depth}
                        onChange={(e) => setShapeParams({ ...shapeParams, depth: Number(e.target.value) })}
                        className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                      />
                    </div>
                  )}
                </div>

                <div className="p-5 rounded-2xl bg-[var(--panel-raised)]/90 border border-[var(--border)] flex flex-col justify-center space-y-2">
                  <div className="text-xs font-bold text-[var(--accent)] uppercase">Hisob natijasi</div>
                  {shapeResult ? (
                    <div className="space-y-2">
                      {shapeResult.area !== undefined && (
                        <div>
                          <span className="text-xs text-[var(--muted)]">Maydon: </span>
                          <span className="text-xl font-black text-[var(--accent)]">{shapeResult.area} m²</span>
                          <span className="text-xs text-[var(--muted-2)] ml-2">({(shapeResult.area / 100).toFixed(2)} sotix)</span>
                        </div>
                      )}
                      {shapeResult.perimeter !== undefined && (
                        <div>
                          <span className="text-xs text-[var(--muted)]">Perimetr: </span>
                          <span className="text-base font-bold text-[var(--text)]">{shapeResult.perimeter} m</span>
                        </div>
                      )}
                      {shapeResult.volume !== undefined && (
                        <div>
                          <span className="text-xs text-[var(--muted)]">Hajm: </span>
                          <span className="text-xl font-black text-[var(--blue)]">{shapeResult.volume} m³</span>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODULE 6: SLOPE & LEVELING */}
          {/* ========================================================================= */}
          {activeModule === "slope" && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-[var(--text)] flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-[var(--accent)]" />
                  Nivelirlash va Nishablik
                </h2>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Nishablik foizda, promilleda va gradusda; Stansiya nivelir jurnali.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-[var(--panel)]/80 border border-[var(--border)] shadow-2xl backdrop-blur-xl space-y-4">
                <h3 className="text-xs font-bold text-[var(--accent)] uppercase">1. Nishablikni hisoblash</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[var(--muted)]">Balandlik farqi Δh (metr)</label>
                    <input
                      type="number"
                      value={slopeH}
                      onChange={(e) => setSlopeH(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--muted)]">Gorizontal masofa d (metr)</label>
                    <input
                      type="number"
                      value={slopeD}
                      onChange={(e) => setSlopeD(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                    />
                  </div>
                </div>

                <button
                  onClick={handleCalculateSlope}
                  className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-black font-extrabold text-xs shadow-md"
                >
                  Nishablikni hisoblash
                </button>

                {slopeResult && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3 rounded-2xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] text-[var(--muted)]">Foizda (%)</div>
                      <div className="text-lg font-black text-[var(--accent)]">{slopeResult.slopePercent}%</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] text-[var(--muted)]">Promille (‰)</div>
                      <div className="text-lg font-black text-[var(--text)]">{slopeResult.slopePromille} ‰</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] text-[var(--muted)]">Burchak (°)</div>
                      <div className="text-lg font-black text-[var(--blue)]">{slopeResult.slopeAngleDeg}°</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] text-[var(--muted)]">Nisbat</div>
                      <div className="text-base font-black text-[var(--warning)]">{slopeResult.ratioString}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 rounded-3xl bg-[var(--panel)]/80 border border-[var(--border)] shadow-2xl backdrop-blur-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[var(--blue)] uppercase">2. Stansiyada Nivelirlash jurnali</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--muted)]">Reper (BM):</span>
                    <input
                      type="number"
                      value={levelingBm}
                      onChange={(e) => setLevelingBm(e.target.value)}
                      className="w-20 p-1.5 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse font-mono">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--muted)] font-bold font-sans">
                        <th className="p-2">Nuqta</th>
                        <th className="p-2">BS</th>
                        <th className="p-2">IS</th>
                        <th className="p-2">FS</th>
                        <th className="p-2">HI</th>
                        <th className="p-2">RL</th>
                        <th className="p-2 font-sans">Izoh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levelingTable.map((row) => (
                        <tr key={row.id} className="border-b border-[var(--border)]/50">
                          <td className="p-2 font-bold text-[var(--accent)]">{row.stationName}</td>
                          <td className="p-2">{row.backsight ?? "-"}</td>
                          <td className="p-2">{row.intermediate ?? "-"}</td>
                          <td className="p-2">{row.foresight ?? "-"}</td>
                          <td className="p-2 font-bold text-[var(--blue)]">{row.heightOfInstrument?.toFixed(3)}</td>
                          <td className="p-2 font-bold text-[var(--text)]">{row.reducedLevel?.toFixed(3)}</td>
                          <td className="p-2 text-[var(--muted-2)] font-sans">{row.remark ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={handleCalculateLeveling}
                  className="px-4 py-2.5 rounded-xl bg-[var(--blue)] text-white font-extrabold text-xs shadow-md"
                >
                  Nivelir jurnalini hisoblash
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODULE 7: VOLUME */}
          {/* ========================================================================= */}
          {activeModule === "volume" && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-[var(--text)] flex items-center gap-2">
                  <BoxIcon className="w-6 h-6 text-[var(--accent)]" />
                  Yer ishlari hajmi (TIN Cut & Fill)
                </h2>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Delaunay triangulyatsiyasi orqali tuproq qazish va to‘kish hajmi.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-[var(--panel)]/80 border border-[var(--border)] shadow-2xl backdrop-blur-xl space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-[var(--muted)] font-semibold">Koordinata turi</label>
                    <select
                      value={volumeCoordMode}
                      onChange={(e) => setVolumeCoordMode(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs"
                    >
                      <option value="local">Metrik (X Y Z)</option>
                      <option value="wgs84">WGS84 (Lat Lon Z)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-[var(--muted)] font-semibold">Loyiha turi</label>
                    <select
                      value={volumeDesignMode}
                      onChange={(e) => setVolumeDesignMode(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs"
                    >
                      <option value="level">Yagona sath (Level Z)</option>
                      <option value="per-point">Har bir nuqta uchun</option>
                    </select>
                  </div>

                  {volumeDesignMode === "level" && (
                    <div>
                      <label className="text-[10px] text-[var(--muted)] font-semibold">Loyiha sathi Z (m)</label>
                      <input
                        type="number"
                        value={volumeDesignLevel}
                        onChange={(e) => setVolumeDesignLevel(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono"
                      />
                    </div>
                  )}
                </div>

                <textarea
                  rows={6}
                  value={volumeInput}
                  onChange={(e) => setVolumeInput(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-[var(--field)] border border-[var(--border)] font-mono text-xs"
                />

                {volumeError && (
                  <div className="p-3 rounded-xl bg-[var(--danger-soft)] text-[var(--danger)] text-xs">{volumeError}</div>
                )}

                <button
                  onClick={handleCalculateVolume}
                  className="w-full py-3 rounded-2xl bg-[var(--accent)] text-black font-extrabold text-xs shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  <BoxIcon className="w-4 h-4" /> Hajmni hisoblash (TIN)
                </button>
              </div>

              {volumeResult && (
                <div className="p-6 rounded-3xl bg-[var(--panel)]/80 border border-[var(--border-strong)] shadow-2xl backdrop-blur-xl">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] font-bold text-[var(--danger)] uppercase">Qazish (Cut)</div>
                      <div className="text-lg font-black text-[var(--danger)] mt-0.5">{volumeResult.cut.toFixed(2)} m³</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] font-bold text-[var(--blue)] uppercase">To‘kish (Fill)</div>
                      <div className="text-lg font-black text-[var(--blue)] mt-0.5">{volumeResult.fill.toFixed(2)} m³</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] font-bold text-[var(--text)] uppercase">Sof hajm</div>
                      <div className="text-lg font-black text-[var(--text)] mt-0.5">
                        {volumeResult.net > 0 ? `+${volumeResult.net.toFixed(2)}` : volumeResult.net.toFixed(2)} m³
                      </div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Plan maydoni</div>
                      <div className="text-base font-black text-[var(--accent)] mt-0.5">{volumeResult.planArea.toFixed(1)} m²</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODULE 8: GEOAI ASSISTANT */}
          {/* ========================================================================= */}
          {activeModule === "geoai" && (
            <div className="space-y-4 max-w-4xl flex flex-col h-[calc(100vh-140px)]">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-[var(--text)] flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-[var(--accent)]" />
                  GeoAI Sun'iy Intellekt Maslahatchisi
                </h2>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Geodeziya, topografiya, formulalar va me'yorlar bo‘yicha to‘liq universal AI maslahatchi.
                </p>
              </div>

              {/* Chat Window */}
              <div className="flex-1 p-5 rounded-3xl bg-[var(--panel)]/80 border border-[var(--border)] overflow-y-auto space-y-4 flex flex-col backdrop-blur-xl shadow-2xl">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 max-w-[85%] ${
                      msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 text-xs font-extrabold shadow-md ${
                        msg.role === "user"
                          ? "bg-[var(--blue)] text-white"
                          : "bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-black"
                      }`}
                    >
                      {msg.role === "user" ? (currentUser?.displayName?.[0] || "U") : <Bot className="w-5 h-5" />}
                    </div>
                    <div
                      className={`p-4 rounded-3xl text-xs leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-[var(--blue)] text-white rounded-tr-none shadow-lg"
                          : "bg-[var(--panel-raised)]/95 text-[var(--text)] border border-[var(--border)] rounded-tl-none shadow-xl"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex items-center gap-2.5 text-xs text-[var(--accent)] p-2 animate-pulse font-medium">
                    <LoaderCircle className="w-4 h-4 animate-spin text-[var(--accent)]" />
                    GeoAI javob tayyorlamoqda...
                  </div>
                )}
              </div>

              {/* Input Bar */}
              <div className="flex items-center gap-2 p-2 bg-[var(--panel)]/90 border border-[var(--border-strong)] rounded-2xl backdrop-blur-2xl shadow-xl">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder="GeoAI dan geodeziya yoki hisob-kitoblar haqida so‘rang..."
                  className="flex-1 bg-transparent px-4 py-2.5 text-xs text-[var(--text)] outline-none"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || isChatLoading}
                  className="p-3 rounded-xl bg-[var(--accent)] text-black font-extrabold disabled:opacity-30 hover:brightness-110 transition-all shadow-md"
                >
                  <SendHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODULE 9: CONTACTS */}
          {/* ========================================================================= */}
          {activeModule === "contacts" && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-[var(--text)] flex items-center gap-2">
                  <Phone className="w-6 h-6 text-[var(--accent)]" />
                  Bog‘lanish va Muallif Kontaktlari
                </h2>
                <p className="text-xs text-[var(--muted)] mt-1">
                  GeoCalc platformasi bo‘yicha takliflar, murojaatlar va texnik hamkorlik.
                </p>
              </div>

              <div className="p-6 md:p-8 rounded-3xl bg-[var(--panel)]/80 border border-[var(--border-strong)] shadow-2xl backdrop-blur-2xl space-y-6">
                <div className="flex items-center gap-4 pb-6 border-b border-[var(--border)]">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[var(--accent)] to-[var(--blue)] flex items-center justify-center text-black font-black text-2xl shadow-xl">
                    TA
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[var(--text)]">Toirov Azizbek</h3>
                    <p className="text-xs text-[var(--accent)] font-semibold">
                      GeoCalc asoschisi va dasturchi muhandisi
                    </p>
                    <p className="text-[11px] text-[var(--muted)] mt-0.5">
                      Powered by Toirov Azizbek
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <a
                    href="mailto:deartairov@gmail.com"
                    className="p-4 rounded-2xl bg-[var(--panel-raised)] border border-[var(--border)] hover:border-[var(--accent)] transition-all flex flex-col items-center text-center group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div className="text-[10px] text-[var(--muted)] uppercase font-bold">Email</div>
                    <div className="text-xs font-extrabold text-[var(--text)] mt-0.5">deartairov@gmail.com</div>
                  </a>

                  <a
                    href="https://t.me/dearr5"
                    target="_blank"
                    rel="noreferrer"
                    className="p-4 rounded-2xl bg-[var(--panel-raised)] border border-[var(--border)] hover:border-[var(--blue)] transition-all flex flex-col items-center text-center group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--blue-soft)] text-[var(--blue)] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Send className="w-5 h-5" />
                    </div>
                    <div className="text-[10px] text-[var(--muted)] uppercase font-bold">Telegram</div>
                    <div className="text-xs font-extrabold text-[var(--text)] mt-0.5">@dearr5</div>
                  </a>

                  <a
                    href="tel:+998958300142"
                    className="p-4 rounded-2xl bg-[var(--panel-raised)] border border-[var(--border)] hover:border-[var(--warning)] transition-all flex flex-col items-center text-center group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--danger-soft)] text-[var(--warning)] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div className="text-[10px] text-[var(--muted)] uppercase font-bold">Telefon</div>
                    <div className="text-xs font-extrabold text-[var(--text)] mt-0.5">+998(95) 830-01-42</div>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODULE 10: GUIDE */}
          {/* ========================================================================= */}
          {activeModule === "guide" && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-[var(--text)] flex items-center gap-2">
                  <Info className="w-6 h-6 text-[var(--accent)]" />
                  Qo‘llanma va Geodeziya Formulalari
                </h2>
                <p className="text-xs text-[var(--muted)] mt-1">
                  GeoCalc platformasining hisoblash standartlari.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 rounded-3xl bg-[var(--panel)]/80 border border-[var(--border)] backdrop-blur-xl space-y-2">
                  <h3 className="text-sm font-extrabold text-[var(--accent)]">1. Maydon hisoblash (WGS84 va UTM)</h3>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    WGS84 koordinatalari O‘zbekiston hududi uchun mos UTM zonalari (EPSG:32641, 32642, 32643)ga proyeksiyalanadi va Gauss maydon formulasi orqali hisoblanadi.
                  </p>
                </div>

                <div className="p-6 rounded-3xl bg-[var(--panel)]/80 border border-[var(--border)] backdrop-blur-xl space-y-2">
                  <h3 className="text-sm font-extrabold text-[var(--blue)]">2. Vincenty Masofa va Azimut</h3>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    WGS84 ellipsoidida ikki nuqta orasidagi to‘g‘ri geodezik masofa va yo‘nalish burchaklarini 0.5 mm aniqlikda hisoblaydi.
                  </p>
                </div>

                <div className="p-6 rounded-3xl bg-[var(--panel)]/80 border border-[var(--border)] backdrop-blur-xl space-y-2">
                  <h3 className="text-sm font-extrabold text-[var(--warning)]">3. TIN Cut & Fill Hajmi</h3>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    Delaunay triangulyatsiyasi orqali relyef 3D prizmalarga ajratilib, tuproq qazish va to‘kish hajmi topiladi.
                  </p>
                </div>

                <div className="p-6 rounded-3xl bg-[var(--panel)]/80 border border-[var(--border)] backdrop-blur-xl space-y-2">
                  <h3 className="text-sm font-extrabold text-[var(--text)]">4. Nivelirlash va Nishablik</h3>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    Asbob balandligi (HI) va Relyef nuqtasi (RL) orqali nishablik foizda va gradusda aniqlanadi.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODULE 11: HISTORY */}
          {/* ========================================================================= */}
          {activeModule === "history" && (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-[var(--text)] flex items-center gap-2">
                    <History className="w-6 h-6 text-[var(--accent)]" />
                    Hisob-kitoblar tarixi
                  </h2>
                  <p className="text-xs text-[var(--muted)] mt-1">Oxirgi amalga oshirilgan hisob-kitoblar.</p>
                </div>

                {history.length > 0 && (
                  <button
                    onClick={() => {
                      setHistory([]);
                      localStorage.removeItem("geocalc_history");
                      showToast("Tarix tozalandi!");
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[var(--danger-soft)] text-[var(--danger)] text-xs font-bold"
                  >
                    Tozalash
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {history.length > 0 ? (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-[var(--panel)]/80 border border-[var(--border)] backdrop-blur-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-[var(--accent)]">{item.title}</div>
                        <div className="font-mono text-sm font-extrabold text-[var(--text)] mt-0.5">{item.value}</div>
                      </div>
                      <div className="text-[10px] text-[var(--muted-2)] font-mono">{item.date}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-[var(--muted)] rounded-3xl bg-[var(--panel)]/70 border border-[var(--border)]">
                    Hali hech qanday hisob-kitob saqlanmagan.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* FIXED BOTTOM FOOTER (POWERED BY TOIROV AZIZBEK) */}
          {/* ========================================================================= */}
          <footer className="w-full py-8 mt-12 border-t border-[var(--border)] text-center text-xs text-[var(--muted)] flex flex-col items-center justify-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6 text-xs font-semibold">
              <a href="mailto:deartairov@gmail.com" className="hover:text-[var(--accent)] transition-all flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[var(--accent)]" /> deartairov@gmail.com
              </a>
              <span>·</span>
              <a href="https://t.me/dearr5" target="_blank" rel="noreferrer" className="hover:text-[var(--blue)] transition-all flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-[var(--blue)]" /> Telegram: @dearr5
              </a>
              <span>·</span>
              <a href="tel:+998958300142" className="hover:text-[var(--warning)] transition-all flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[var(--warning)]" /> +998(95) 830-01-42
              </a>
            </div>

            <div className="font-extrabold text-sm text-[var(--text)] flex items-center gap-1.5 tracking-tight mt-1">
              Powered by <span className="text-[var(--accent)]">Toirov Azizbek</span>
            </div>

            <div className="text-[11px] text-[var(--muted-2)]">
              GeoCalc — Geodezik va topografik hisoblash platformasi © {new Date().getFullYear()}
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
