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
  Map as MapIcon,
  MapPin,
  Maximize2,
  Menu,
  Moon,
  Mountain,
  Navigation,
  Plus,
  RefreshCw,
  Ruler,
  Send,
  Share2,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  TrendingUp,
  Triangle,
  Upload,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";

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

import { GEOAI_CONTACT_MARKERS, type GeoAIAttachment } from "@/lib/geoai";

// Dynamic import for Leaflet Map to ensure SSR-safety
const InteractiveMap = dynamic(() => import("@/components/interactive-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[520px] rounded-2xl bg-[var(--panel-solid)] border border-[var(--border)] flex flex-col items-center justify-center gap-3 text-[var(--muted)] animate-pulse">
      <Globe className="w-8 h-8 text-[var(--accent)] animate-spin" />
      <span className="text-sm font-medium">Interfaol xarita yuklanmoqda...</span>
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
  | "history";

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
      hint: tr(language, "Savol-javob · Maslahat", "Консультация", "AI Geodesy chat"),
      icon: Sparkles,
      badge: "AI",
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
  const [convLatDms, setConvLatDms] = useState({ deg: "41", min: "18", sec: "39.89", hemi: "N" });
  const [convLonDms, setConvLonDms] = useState({ deg: "69", min: "14", sec: "26.02", hemi: "E" });
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
        "Assalomu alaykum! Men GeoCalc sun'iy intellekt muhandislik yordamchisiman. Geodeziya, topografiya, koordinatalar, yer ishlari va hisob-kitoblar bo‘yicha savollaringiz bo‘lsa marhamat!",
        "Здравствуйте! Я AI ассистент GeoCalc. Готов ответить на вопросы по геодезии, съёмке, координатам и земляным работам.",
        "Hello! I am your GeoCalc AI assistant. Ask me anything about geodesy, coordinates, leveling, and calculations.",
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

  // Converter Calculations
  const handleConvertDecToDms = () => {
    try {
      const lat = Number(convLatDec);
      const lon = Number(convLonDec);
      const dmsLat = toDMS(lat, "lat");
      const dmsLon = toDMS(lon, "lon");
      showToast(`${dmsLat} | ${dmsLon}`);
    } catch (e: any) {
      showToast("Xato qiymat");
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

  // GeoAI Chat Send
  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setChatInput("");
    setIsChatLoading(true);

    setTimeout(() => {
      let reply = "";
      const lower = userMsg.toLowerCase();

      if (lower.includes("sotix") || lower.includes("gektar") || lower.includes("yuza")) {
        reply = tr(
          language,
          "1 Sotix (Ar) = 100 m² ga teng. 1 Gektar (ha) = 10,000 m² = 100 sotix. 1 km² = 100 gektar = 1,000,000 m². GeoCalc 'Yuza hisoblash' bo‘limida WGS84 koordinatalari orqali avtomatik tarzda Gauss-Krüger (UTM) proyeksiyasida eng yuqori aniqlikda maydonni hisoblaydi.",
          "1 сотка (ар) = 100 м². 1 гектар (га) = 10 000 м² = 100 соток. В разделе «Расчёт площади» GeoCalc вычисляет площадь через геодезическую проекцию Гаусса-Крюгера.",
          "1 Sotix (Ar) = 100 m². 1 Hectare = 10,000 m² = 100 sotix. GeoCalc computes high-precision geodesic polygon areas using localized UTM projection.",
        );
      } else if (lower.includes("cut") || lower.includes("fill") || lower.includes("hajm")) {
        reply = tr(
          language,
          "Cut & Fill (Qazish va to‘kish) yer tekislash ishlarida relef balandliklarini loyiha balandligiga moslash uchun ishlatiladi. Delaunay triangulyatsiyasi (TIN) orqali relyef prizmalarga bo‘linadi va qaziladigan hamda to‘kiladigan tuproq hajmi m³ da hisoblanadi.",
          "Расчёт Cut & Fill делит рельеф на призмы методом триангуляции Делоне (TIN) для точного вычисления объёма выемки и насыпи в кубических метрах.",
          "Cut & Fill calculation uses Delaunay Triangulation (TIN) to compute exact earthwork volumes for excavation and embankment in cubic meters.",
        );
      } else if (lower.includes("azimut") || lower.includes("rumb")) {
        reply = tr(
          language,
          "Azimut — shimoliy yo‘nalishdan soat mili bo‘yicha o‘lchanadigan burchak (0° dan 360° gacha). Rumb esa eng yaqin meridian (Shimol yoki Janub)dan o‘lchanadigan 0° dan 90° gacha burchak bo‘lib, 4 chorakka (NE, SE, SW, NW) bo‘linadi.",
          "Азимут измеряется от севера по часовой стрелке (0°–360°). Румб — острый угол от ближайшего меридиана (0°–90°) с указанием четверти (СВ, ЮВ, ЮЗ, СЗ).",
          "Azimuth is measured clockwise from True North (0°–360°). Rhumb (bearing) is measured 0°–90° from North or South within 4 quadrants.",
        );
      } else {
        reply = tr(
          language,
          `Savolingiz uchun rahmat! "${userMsg}" bo‘yicha: GeoCalc sizga yer maydoni, masofa, azimut, nivelirlash, nishablik, koordinata konvertatsiyasi va hajm hisoblashda 100% aniqlikni ta'minlaydi.`,
          `Спасибо за вопрос! По вашему запросу: GeoCalc обеспечивает полный спектр геодезических вычислений площади, расстояний, нивелирования и объёмов.`,
          `Thank you! GeoCalc provides precision geodetic computation for areas, distances, azimuths, leveling, coordinates, and earthwork volumes.`,
        );
      }

      setChatMessages((prev) => [...prev, { role: "bot", text: reply }]);
      setIsChatLoading(false);
    }, 600);
  };

  const navItems = getNavItems(language);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--bg)] text-[var(--text)] selection:bg-[var(--accent)] selection:text-black font-sans">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-xl bg-[var(--panel-solid)] text-[var(--accent)] border border-[var(--border-strong)] shadow-2xl font-semibold text-xs flex items-center gap-2 backdrop-blur-lg"
          >
            <Check className="w-4 h-4 text-[var(--accent)]" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main App Layout */}
      <div className="flex-1 flex flex-col md:flex-row w-full max-w-[1700px] mx-auto">
        {/* Left Sidebar */}
        <aside
          className={`w-full md:w-[280px] lg:w-[310px] flex-shrink-0 bg-[var(--sidebar)] border-r border-[var(--border)] p-4 flex flex-col justify-between ${
            isSidebarOpen ? "block" : "hidden md:flex"
          }`}
        >
          <div>
            {/* Logo & Brand */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center text-black font-extrabold text-lg shadow-lg">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="font-extrabold text-lg tracking-tight flex items-center gap-1.5 text-[var(--text)]">
                    GeoCalc <span className="text-[var(--accent)] text-xs font-bold px-1.5 py-0.5 rounded-md bg-[var(--accent-soft)]">PRO</span>
                  </h1>
                  <p className="text-[11px] text-[var(--muted)] font-medium">
                    Geodeziya & Yer kalkulyatori
                  </p>
                </div>
              </div>

              {/* Close on mobile */}
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="md:hidden p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X className="w-5 h-5" />
              </button>
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
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all group ${
                      isActive
                        ? "bg-[var(--accent)] text-black font-bold shadow-md shadow-[var(--accent)]/10"
                        : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-raised)]"
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

          {/* Footer Controls: Language & Theme */}
          <div className="pt-4 border-t border-[var(--border)] mt-4 space-y-3">
            <div className="flex items-center justify-between">
              {/* Language Switch */}
              <div className="flex items-center bg-[var(--panel-solid)] border border-[var(--border)] rounded-lg p-0.5 text-[11px] font-bold">
                {(["uz", "ru", "en"] as AppLanguage[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLanguage(l)}
                    className={`px-2.5 py-1 rounded-md uppercase transition-all ${
                      language === l
                        ? "bg-[var(--accent)] text-black shadow-sm"
                        : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-lg bg-[var(--panel-solid)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] transition-all"
                title="Mavzuni o‘zgartirish"
              >
                {theme === "dark" ? <Sun className="w-4 h-4 text-[var(--warning)]" /> : <Moon className="w-4 h-4 text-[var(--blue)]" />}
              </button>
            </div>

            <div className="text-[10px] text-[var(--muted-2)] text-center font-medium">
              GeoCalc Modern v2.1 · WGS84 & UTM 41-43N
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-[var(--bg-deep)] p-3 md:p-6 lg:p-8 overflow-y-auto">
          {/* Top Mobile Bar */}
          <div className="md:hidden flex items-center justify-between pb-4 mb-4 border-b border-[var(--border)]">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-xl bg-[var(--panel)] border border-[var(--border)] text-[var(--text)]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-bold text-sm text-[var(--text)] flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-[var(--accent)]" /> GeoCalc
            </span>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-xl bg-[var(--panel)] border border-[var(--border)] text-[var(--muted)]"
            >
              {theme === "dark" ? <Sun className="w-4 h-4 text-[var(--warning)]" /> : <Moon className="w-4 h-4 text-[var(--blue)]" />}
            </button>
          </div>

          {/* ========================================================================= */}
          {/* MODULE 1: AREA (YUZA HISOBLASH VA XARITA) */}
          {/* ========================================================================= */}
          {activeModule === "area" && (
            <div className="space-y-6">
              {/* Header */}
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

                {/* View Switcher */}
                <div className="flex items-center gap-1 bg-[var(--panel)] border border-[var(--border)] p-1 rounded-xl">
                  <button
                    onClick={() => setAreaViewMode("map")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      areaViewMode === "map" ? "bg-[var(--accent)] text-black shadow-sm" : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    <MapIcon className="w-3.5 h-3.5" />
                    {tr(language, "Interfaol xarita", "Карта", "Map View")}
                  </button>
                  <button
                    onClick={() => setAreaViewMode("canvas")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      areaViewMode === "canvas" ? "bg-[var(--accent)] text-black shadow-sm" : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    <Layers3 className="w-3.5 h-3.5" />
                    {tr(language, "Sxema (2D)", "Схема 2D", "2D Scheme")}
                  </button>
                </div>
              </div>

              {/* Grid: Coordinates input and Map View */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Text Input & Fast Actions */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-4 rounded-2xl bg-[var(--panel)] border border-[var(--border)] shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-[var(--accent)]" />
                        {tr(language, "Koordinatalar ro‘yxati (Kenglik Uzunlik)", "Список координат (Широта Долгота)", "Coordinates (Lat Lon)")}
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
                      className="w-full p-3 rounded-xl bg-[var(--field)] border border-[var(--border)] font-mono text-xs text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all resize-y"
                    />

                    {areaError && (
                      <div className="p-2.5 rounded-lg bg-[var(--danger-soft)] border border-[var(--danger)] text-[var(--danger)] text-xs font-medium">
                        {areaError}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => setAreaInput(AREA_SAMPLE)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--text)] transition-all"
                      >
                        {tr(language, "Namuna yuklash", "Пример", "Load Sample")}
                      </button>
                      <button
                        onClick={() => setAreaInput("")}
                        className="px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--border)] text-xs text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-all"
                      >
                        {tr(language, "Tozalash", "Очистить", "Clear")}
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(areaInput);
                          showToast(tr(language, "Koordinatalar nusxalandi!", "Скопировано!", "Copied!"));
                        }}
                        className="ml-auto px-3 py-1.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] font-semibold text-xs hover:bg-[var(--accent)] hover:text-black transition-all flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {tr(language, "Nusxalash", "Копировать", "Copy")}
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  {areaProperties ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--border)]">
                        <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Maydon (m²)</div>
                        <div className="text-lg font-black text-[var(--accent)] mt-0.5">
                          {formatNumber(areaProperties.areaM2)} m²
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--border)]">
                        <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Sotix (Ar)</div>
                        <div className="text-lg font-black text-[var(--text)] mt-0.5">
                          {areaProperties.areaSotix.toFixed(2)} sotix
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--border)]">
                        <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Gektar (ha)</div>
                        <div className="text-lg font-black text-[var(--text)] mt-0.5">
                          {areaProperties.areaHectares.toFixed(4)} ga
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--border)]">
                        <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Perimetr</div>
                        <div className="text-sm font-black text-[var(--blue)] mt-0.5">
                          {areaProperties.perimeterMeters.toFixed(1)} m
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--border)] col-span-2">
                        <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Markaziy nuqta (Centroid)</div>
                        <div className="text-xs font-mono font-bold text-[var(--text)] mt-0.5">
                          {areaProperties.centroid.lat.toFixed(6)}°, {areaProperties.centroid.lon.toFixed(6)}°
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Right Column: Visualizer (Map or Canvas) */}
                <div className="lg:col-span-7">
                  {areaViewMode === "map" ? (
                    <InteractiveMap
                      initialPoints={areaPoints}
                      onPointsChange={handleMapPointsChange}
                      language={language}
                      height="540px"
                    />
                  ) : (
                    <div className="p-4 rounded-2xl bg-[var(--panel)] border border-[var(--border)] h-[540px] flex flex-col items-center justify-center">
                      <p className="text-xs text-[var(--muted)] mb-3">2D Proyeksiyalangan chizma sxemasi</p>
                      <div className="text-xs text-[var(--muted-2)]">
                        {areaPoints.length >= 3 ? (
                          <div className="text-center font-mono">
                            {areaPoints.length} ta burchak nuqtasi aniqlandi.
                            <br />
                            Yuqoridagi "Interfaol xarita" tugmasi orqali sun'iy yo‘ldoshda ko‘ring.
                          </div>
                        ) : (
                          "Sxemani ko‘rish uchun kamida 3 ta nuqta kiriting."
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODULE 2: INTERACTIVE MAP FULL SCREEN */}
          {/* ========================================================================= */}
          {activeModule === "map" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-[var(--text)] flex items-center gap-2">
                    <MapIcon className="w-6 h-6 text-[var(--accent)]" />
                    {tr(language, "To‘liq ekranli Interfaol Xarita", "Интерактивная карта со спутником", "Full Interactive Satellite Map")}
                  </h2>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {tr(
                      language,
                      "Sun'iy yo‘ldosh tasvirlarida yer chegaralarini o‘lchang, masofalarni hisoblang va nuqtalarni aniqlang.",
                      "Измеряйте границы участков, расстояния и определяйте координаты на спутниковых снимках.",
                      "Measure plot boundaries, distances, and pin coordinates on satellite imagery.",
                    )}
                  </p>
                </div>
              </div>

              <InteractiveMap language={language} height="calc(100vh - 160px)" />
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
                  {tr(
                    language,
                    "Vincenty ellipsoidal formulasidan foydalangan holda 2 ta geodezik nuqta orasidagi aniq masofa va yo‘nalish burchaklari.",
                    "Высокоточный расчёт геодезического расстояния и азимутов по формуле Винсенти на эллипсоиде WGS84.",
                    "High-precision geodetic distance and azimuth calculation via Vincenty's inverse formula on WGS84.",
                  )}
                </p>
              </div>

              {/* 2 Points Input */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-2xl bg-[var(--panel)] border border-[var(--border)] shadow-xl">
                {/* Point 1 */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-[var(--accent)] flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {tr(language, "1-Boshlang‘ich nuqta", "1-я Начальная точка", "Point 1 (Start)")}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-[var(--muted)]">Kenglik (Lat)</label>
                      <input
                        type="text"
                        value={distP1.lat}
                        onChange={(e) => setDistP1({ ...distP1, lat: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[var(--muted)]">Uzunlik (Lon)</label>
                      <input
                        type="text"
                        value={distP1.lon}
                        onChange={(e) => setDistP1({ ...distP1, lon: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                      />
                    </div>
                  </div>
                </div>

                {/* Point 2 */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-[var(--blue)] flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {tr(language, "2-Oxirgi nuqta", "2-я Конечная точка", "Point 2 (End)")}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-[var(--muted)]">Kenglik (Lat)</label>
                      <input
                        type="text"
                        value={distP2.lat}
                        onChange={(e) => setDistP2({ ...distP2, lat: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[var(--muted)]">Uzunlik (Lon)</label>
                      <input
                        type="text"
                        value={distP2.lon}
                        onChange={(e) => setDistP2({ ...distP2, lon: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 pt-2">
                  <button
                    onClick={handleCalculateDistance}
                    className="w-full py-3 rounded-xl bg-[var(--accent)] text-black font-extrabold text-xs shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-2"
                  >
                    <Calculator className="w-4 h-4" />
                    {tr(language, "Masofa va Yo‘nalishni hisoblash", "Рассчитать расстояние и азимут", "Compute Distance & Azimuth")}
                  </button>
                </div>
              </div>

              {/* Distance Result Display */}
              {distResult && (
                <div className="p-5 rounded-2xl bg-[var(--panel)] border border-[var(--border-strong)] shadow-2xl space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Masofa (metr)</div>
                      <div className="text-base font-black text-[var(--accent)] mt-0.5">
                        {distResult.distanceMeters.toFixed(2)} m
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Masofa (km)</div>
                      <div className="text-base font-black text-[var(--text)] mt-0.5">
                        {distResult.distanceKm.toFixed(3)} km
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Boshlang‘ich Azimut</div>
                      <div className="text-base font-black text-[var(--blue)] mt-0.5">
                        {distResult.initialAzimuthDeg.toFixed(2)}°
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Geodezik Rumb</div>
                      <div className="text-sm font-black text-[var(--warning)] mt-0.5 font-mono">
                        {distResult.rhumbString}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Direct Geodetic Problem Section */}
              <div className="p-5 rounded-2xl bg-[var(--panel)] border border-[var(--border)] shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-[var(--accent)]" />
                  {tr(language, "To‘g‘ri geodezik masala (Nuqta + Azimut + Masofa → Yangi koordinata)", "Прямая геодезическая задача", "Direct Geodetic Problem")}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-[var(--muted)]">Boshlang‘ich Lat, Lon</label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={directStart.lat}
                        onChange={(e) => setDirectStart({ ...directStart, lat: e.target.value })}
                        className="w-1/2 p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                      />
                      <input
                        type="text"
                        value={directStart.lon}
                        onChange={(e) => setDirectStart({ ...directStart, lon: e.target.value })}
                        className="w-1/2 p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-[var(--muted)]">Azimut (°)</label>
                    <input
                      type="number"
                      value={directAzimuth}
                      onChange={(e) => setDirectAzimuth(e.target.value)}
                      className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-[var(--muted)]">Masofa (metr)</label>
                    <input
                      type="number"
                      value={directDistance}
                      onChange={(e) => setDirectDistance(e.target.value)}
                      className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                    />
                  </div>
                </div>

                <button
                  onClick={handleCalculateDirect}
                  className="px-4 py-2 rounded-xl bg-[var(--panel-raised)] border border-[var(--border-strong)] text-xs font-bold text-[var(--text)] hover:bg-[var(--accent)] hover:text-black transition-all"
                >
                  {tr(language, "Yangi nuqtani topish", "Найти координаты", "Calculate Target Point")}
                </button>

                {directResult && (
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] text-xs font-mono">
                    Natija: <strong>Lat: {directResult.lat.toFixed(6)}°</strong>,{" "}
                    <strong>Lon: {directResult.lon.toFixed(6)}°</strong>
                  </div>
                )}
              </div>
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
                  {tr(language, "Koordinatalar va Formatlar Konvertori", "Конвертер форматов координат", "Coordinate Format Converter")}
                </h2>
                <p className="text-xs text-[var(--muted)] mt-1">
                  {tr(
                    language,
                    "O‘nli gradus (DD), Gradus Minut Sekund (GMS/DMS) va UTM koordinata formatlari orasida konvertatsiya.",
                    "Перевод между десятичными градусами и форматом ГМС (градусы, минуты, секунды).",
                    "Convert between Decimal Degrees (DD) and Degrees Minutes Seconds (DMS).",
                  )}
                </p>
              </div>

              {/* Single Converter */}
              <div className="p-5 rounded-2xl bg-[var(--panel)] border border-[var(--border)] shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-[var(--accent)] uppercase">
                  {tr(language, "Bitta nuqtani konvertatsiya qilish", "Одиночный конвертер", "Single Coordinate")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-[var(--muted)]">O‘nli Kenglik (Lat DD)</label>
                    <input
                      type="text"
                      value={convLatDec}
                      onChange={(e) => setConvLatDec(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                    />
                    <div className="text-[11px] font-mono text-[var(--accent)] mt-1.5">
                      GMS: {Number.isFinite(Number(convLatDec)) ? toDMS(Number(convLatDec), "lat") : "-"}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-[var(--muted)]">O‘nli Uzunlik (Lon DD)</label>
                    <input
                      type="text"
                      value={convLonDec}
                      onChange={(e) => setConvLonDec(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                    />
                    <div className="text-[11px] font-mono text-[var(--accent)] mt-1.5">
                      GMS: {Number.isFinite(Number(convLonDec)) ? toDMS(Number(convLonDec), "lon") : "-"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Batch Converter */}
              <div className="p-5 rounded-2xl bg-[var(--panel)] border border-[var(--border)] shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-[var(--blue)] uppercase">
                  {tr(language, "Ommaviy (Batch) konvertor", "Пакетный конвертер списка", "Batch Coordinates List")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-semibold text-[var(--muted)]">Kiruvchi ro‘yxat (Lat Lon)</label>
                    <textarea
                      rows={6}
                      value={convBatchText}
                      onChange={(e) => setConvBatchText(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] font-mono text-xs text-[var(--text)]"
                    />
                    <button
                      onClick={handleBatchConvert}
                      className="mt-2 px-4 py-2 rounded-xl bg-[var(--blue)] text-white font-bold text-xs shadow-md hover:brightness-110 transition-all"
                    >
                      {tr(language, "Barchasini GMS ga o‘girish", "Конвертировать всё", "Convert All")}
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-[var(--muted)]">Natija (GMS)</label>
                    <textarea
                      rows={6}
                      readOnly
                      value={convBatchResult}
                      placeholder="Konvertatsiya natijasi bu yerda chiqadi..."
                      className="w-full p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--border)] font-mono text-xs text-[var(--accent)]"
                    />
                    {convBatchResult && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(convBatchResult);
                          showToast(tr(language, "Nusxalandi!", "Скопировано!", "Copied!"));
                        }}
                        className="mt-2 px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--border)] text-xs text-[var(--text)] hover:text-[var(--accent)]"
                      >
                        Nusxalash
                      </button>
                    )}
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
                  {tr(language, "Sodda geometrik shakllar kalkulyatori", "Калькулятор простых геометрических фигур", "Simple Shapes Geometry Calculator")}
                </h2>
                <p className="text-xs text-[var(--muted)] mt-1">
                  {tr(
                    language,
                    "To‘g‘ri to‘rtburchak, Geron uchburchagi, trapetsiya, doira va kotlovan hajmini tezkor hisoblash.",
                    "Быстрый расчёт прямоугольника, треугольника по Герону, трапеции, круга и объёма котлована.",
                    "Instant calculations for rectangles, Heron triangles, trapezoids, circles, and pit excavations.",
                  )}
                </p>
              </div>

              {/* Shape Selector Tabs */}
              <div className="flex flex-wrap gap-2 p-1.5 bg-[var(--panel)] border border-[var(--border)] rounded-2xl">
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
                        : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-raised)]"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Inputs & Results Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 rounded-2xl bg-[var(--panel)] border border-[var(--border)] shadow-xl">
                {/* Inputs */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-[var(--text)] uppercase">O‘lchamlar</h3>
                  {shapeType === "rect" && (
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] text-[var(--muted)]">Eni (a, metr)</label>
                        <input
                          type="number"
                          value={shapeParams.w}
                          onChange={(e) => setShapeParams({ ...shapeParams, w: Number(e.target.value) })}
                          className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs text-[var(--text)]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--muted)]">Bo‘yi (b, metr)</label>
                        <input
                          type="number"
                          value={shapeParams.l}
                          onChange={(e) => setShapeParams({ ...shapeParams, l: Number(e.target.value) })}
                          className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs text-[var(--text)]"
                        />
                      </div>
                    </div>
                  )}

                  {shapeType === "tri" && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-[var(--muted)]">a tomon</label>
                        <input
                          type="number"
                          value={shapeParams.a}
                          onChange={(e) => setShapeParams({ ...shapeParams, a: Number(e.target.value) })}
                          className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs text-[var(--text)]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--muted)]">b tomon</label>
                        <input
                          type="number"
                          value={shapeParams.b}
                          onChange={(e) => setShapeParams({ ...shapeParams, b: Number(e.target.value) })}
                          className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs text-[var(--text)]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--muted)]">c tomon</label>
                        <input
                          type="number"
                          value={shapeParams.c}
                          onChange={(e) => setShapeParams({ ...shapeParams, c: Number(e.target.value) })}
                          className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs text-[var(--text)]"
                        />
                      </div>
                    </div>
                  )}

                  {shapeType === "trap" && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-[var(--muted)]">Asos a</label>
                        <input
                          type="number"
                          value={shapeParams.a}
                          onChange={(e) => setShapeParams({ ...shapeParams, a: Number(e.target.value) })}
                          className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs text-[var(--text)]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--muted)]">Asos b</label>
                        <input
                          type="number"
                          value={shapeParams.b}
                          onChange={(e) => setShapeParams({ ...shapeParams, b: Number(e.target.value) })}
                          className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs text-[var(--text)]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--muted)]">Balandlik h</label>
                        <input
                          type="number"
                          value={shapeParams.h}
                          onChange={(e) => setShapeParams({ ...shapeParams, h: Number(e.target.value) })}
                          className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs text-[var(--text)]"
                        />
                      </div>
                    </div>
                  )}

                  {shapeType === "circ" && (
                    <div>
                      <label className="text-[10px] text-[var(--muted)]">Radius R (metr)</label>
                      <input
                        type="number"
                        value={shapeParams.r}
                        onChange={(e) => setShapeParams({ ...shapeParams, r: Number(e.target.value) })}
                        className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs text-[var(--text)]"
                      />
                    </div>
                  )}

                  {shapeType === "pit" && (
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] text-[var(--muted)]">Yuqori yuzasi S1 (m²)</label>
                        <input
                          type="number"
                          value={shapeParams.topArea}
                          onChange={(e) => setShapeParams({ ...shapeParams, topArea: Number(e.target.value) })}
                          className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs text-[var(--text)]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--muted)]">Pastki tub yuzasi S2 (m²)</label>
                        <input
                          type="number"
                          value={shapeParams.bottomArea}
                          onChange={(e) => setShapeParams({ ...shapeParams, bottomArea: Number(e.target.value) })}
                          className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs text-[var(--text)]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--muted)]">Chuqurligi H (metr)</label>
                        <input
                          type="number"
                          value={shapeParams.depth}
                          onChange={(e) => setShapeParams({ ...shapeParams, depth: Number(e.target.value) })}
                          className="w-full p-2 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs text-[var(--text)]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Results */}
                <div className="p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--border)] flex flex-col justify-center space-y-3">
                  <div className="text-xs font-bold text-[var(--accent)] uppercase">Natijalar</div>
                  {shapeResult ? (
                    <div className="space-y-2">
                      {shapeResult.area !== undefined && (
                        <div>
                          <span className="text-xs text-[var(--muted)]">Maydon: </span>
                          <span className="text-lg font-black text-[var(--accent)]">{shapeResult.area} m²</span>
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
                  ) : (
                    <div className="text-xs text-[var(--muted)]">O‘lchamlarni kiriting</div>
                  )}
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
                  {tr(language, "Nivelirlash va Nishablik hisoblagich", "Нивелирование и расчёт уклонов", "Leveling & Slope Calculator")}
                </h2>
                <p className="text-xs text-[var(--muted)] mt-1">
                  {tr(
                    language,
                    "Stansiyada nivelirlash jurnali va nishablikni foiz (%), promille (‰), gradus (°) formatlarida hisoblash.",
                    "Журнал геометрического нивелирования и расчёт уклонов в процентах, промилле и градусах.",
                    "Differential leveling log book and slope calculation in percent, promille, and degrees.",
                  )}
                </p>
              </div>

              {/* Slope Section */}
              <div className="p-5 rounded-2xl bg-[var(--panel)] border border-[var(--border)] shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-[var(--accent)] uppercase">
                  1. Nishablik (Slope) hisoblash
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-[var(--muted)]">Balandlik farqi Δh (metr)</label>
                    <input
                      type="number"
                      value={slopeH}
                      onChange={(e) => setSlopeH(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs text-[var(--text)]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-[var(--muted)]">Gorizontal masofa d (metr)</label>
                    <input
                      type="number"
                      value={slopeD}
                      onChange={(e) => setSlopeD(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs text-[var(--text)]"
                    />
                  </div>
                </div>

                <button
                  onClick={handleCalculateSlope}
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-extrabold text-xs shadow-md"
                >
                  Nishablikni hisoblash
                </button>

                {slopeResult && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] text-[var(--muted)]">Foizda (%)</div>
                      <div className="text-lg font-black text-[var(--accent)]">{slopeResult.slopePercent}%</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] text-[var(--muted)]">Promille (‰)</div>
                      <div className="text-lg font-black text-[var(--text)]">{slopeResult.slopePromille} ‰</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] text-[var(--muted)]">Burchak (°)</div>
                      <div className="text-lg font-black text-[var(--blue)]">{slopeResult.slopeAngleDeg}°</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] text-[var(--muted)]">Nisbat</div>
                      <div className="text-base font-black text-[var(--warning)]">{slopeResult.ratioString}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Leveling Journal Section */}
              <div className="p-5 rounded-2xl bg-[var(--panel)] border border-[var(--border)] shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[var(--blue)] uppercase">
                    2. Stansiyada Nivelirlash jurnali (BS, IS, FS, HI, RL)
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--muted)]">Boshlang‘ich reper (BM):</span>
                    <input
                      type="number"
                      value={levelingBm}
                      onChange={(e) => setLevelingBm(e.target.value)}
                      className="w-20 p-1.5 rounded-lg bg-[var(--field)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--muted)] font-bold">
                        <th className="p-2">Nuqta</th>
                        <th className="p-2">Ortga (BS)</th>
                        <th className="p-2">Oraliq (IS)</th>
                        <th className="p-2">Oldinga (FS)</th>
                        <th className="p-2">Asbob balandligi (HI)</th>
                        <th className="p-2">Relyef balandligi (RL)</th>
                        <th className="p-2">Izoh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levelingTable.length > 0
                        ? levelingTable.map((row) => (
                            <tr key={row.id} className="border-b border-[var(--border)]/50 font-mono">
                              <td className="p-2 font-bold text-[var(--accent)]">{row.stationName}</td>
                              <td className="p-2">{row.backsight ?? "-"}</td>
                              <td className="p-2">{row.intermediate ?? "-"}</td>
                              <td className="p-2">{row.foresight ?? "-"}</td>
                              <td className="p-2 font-bold text-[var(--blue)]">{row.heightOfInstrument?.toFixed(3)}</td>
                              <td className="p-2 font-bold text-[var(--text)]">{row.reducedLevel?.toFixed(3)}</td>
                              <td className="p-2 text-[var(--muted-2)] font-sans">{row.remark ?? ""}</td>
                            </tr>
                          ))
                        : (
                          <tr>
                            <td colSpan={7} className="p-3 text-center text-[var(--muted)]">
                              Hisoblash tugmasini bosing
                            </td>
                          </tr>
                        )}
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
          {/* MODULE 7: VOLUME (CUT & FILL) */}
          {/* ========================================================================= */}
          {activeModule === "volume" && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-[var(--text)] flex items-center gap-2">
                  <BoxIcon className="w-6 h-6 text-[var(--accent)]" />
                  {tr(language, "Yer ishlari hajmi (TIN Cut & Fill)", "Расчёт объёма земляных работ", "Earthwork Volume (TIN Cut & Fill)")}
                </h2>
                <p className="text-xs text-[var(--muted)] mt-1">
                  {tr(
                    language,
                    "Delaunay triangulyatsiyasi (TIN) orqali tuproq qazish (Cut) va to‘kish (Fill) hajmini kub metrda hisoblash.",
                    "Вычисление выемки и насыпи по сетке триангуляции Делоне (TIN).",
                    "Compute excavation and embankment volume in cubic meters via Delaunay TIN.",
                  )}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[var(--panel)] border border-[var(--border)] shadow-xl space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-[var(--muted)]">Koordinata turi</label>
                    <select
                      value={volumeCoordMode}
                      onChange={(e) => setVolumeCoordMode(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs text-[var(--text)]"
                    >
                      <option value="local">Metrik (X Y Z)</option>
                      <option value="wgs84">WGS84 (Lat Lon Z)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-[var(--muted)]">Loyiha turi</label>
                    <select
                      value={volumeDesignMode}
                      onChange={(e) => setVolumeDesignMode(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs text-[var(--text)]"
                    >
                      <option value="level">Yagona sath (Level Z)</option>
                      <option value="per-point">Har bir nuqta uchun</option>
                    </select>
                  </div>

                  {volumeDesignMode === "level" && (
                    <div>
                      <label className="text-[10px] font-semibold text-[var(--muted)]">Loyiha sathi (Z, metr)</label>
                      <input
                        type="number"
                        value={volumeDesignLevel}
                        onChange={(e) => setVolumeDesignLevel(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-[var(--field)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-[var(--muted)]">Balandlik nuqtalari ro‘yxati</label>
                  <textarea
                    rows={6}
                    value={volumeInput}
                    onChange={(e) => setVolumeInput(e.target.value)}
                    className="w-full p-3 rounded-xl bg-[var(--field)] border border-[var(--border)] font-mono text-xs text-[var(--text)] mt-1"
                  />
                </div>

                {volumeError && (
                  <div className="p-3 rounded-xl bg-[var(--danger-soft)] border border-[var(--danger)] text-[var(--danger)] text-xs">
                    {volumeError}
                  </div>
                )}

                <button
                  onClick={handleCalculateVolume}
                  className="w-full py-3 rounded-xl bg-[var(--accent)] text-black font-extrabold text-xs shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  <BoxIcon className="w-4 h-4" />
                  Hajmni hisoblash (TIN)
                </button>
              </div>

              {volumeResult && (
                <div className="p-5 rounded-2xl bg-[var(--panel)] border border-[var(--border-strong)] shadow-2xl space-y-4">
                  <h3 className="text-xs font-bold text-[var(--accent)] uppercase">Hajm Natijalari</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] font-bold text-[var(--danger)] uppercase">Qazish (Cut)</div>
                      <div className="text-lg font-black text-[var(--danger)] mt-0.5">
                        {volumeResult.cut.toFixed(2)} m³
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] font-bold text-[var(--blue)] uppercase">To‘kish (Fill)</div>
                      <div className="text-lg font-black text-[var(--blue)] mt-0.5">
                        {volumeResult.fill.toFixed(2)} m³
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] font-bold text-[var(--text)] uppercase">Sof hajm (Net)</div>
                      <div className="text-lg font-black text-[var(--text)] mt-0.5">
                        {volumeResult.net > 0 ? `+${volumeResult.net.toFixed(2)}` : volumeResult.net.toFixed(2)} m³
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--panel-raised)]">
                      <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Plan maydoni</div>
                      <div className="text-base font-black text-[var(--accent)] mt-0.5">
                        {volumeResult.planArea.toFixed(1)} m²
                      </div>
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
            <div className="space-y-4 max-w-3xl flex flex-col h-[calc(100vh-140px)]">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-[var(--text)] flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-[var(--accent)]" />
                  GeoAI Geodeziya Maslahatchisi
                </h2>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Geodeziya, topografiya, me'yorlar va formulalar bo‘yicha savollaringizni bering.
                </p>
              </div>

              {/* Chat Container */}
              <div className="flex-1 p-4 rounded-2xl bg-[var(--panel)] border border-[var(--border)] overflow-y-auto space-y-3 flex flex-col">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 max-w-[85%] ${
                      msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                        msg.role === "user" ? "bg-[var(--blue)] text-white" : "bg-[var(--accent)] text-black"
                      }`}
                    >
                      {msg.role === "user" ? "U" : <Bot className="w-4 h-4" />}
                    </div>
                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[var(--blue)] text-white rounded-tr-none"
                          : "bg-[var(--panel-raised)] text-[var(--text)] border border-[var(--border)] rounded-tl-none"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex items-center gap-2 text-xs text-[var(--muted)] p-2">
                    <LoaderCircle className="w-4 h-4 animate-spin text-[var(--accent)]" />
                    GeoAI javob tayyorlamoqda...
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <div className="flex items-center gap-2 p-2 bg-[var(--panel)] border border-[var(--border)] rounded-2xl">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder="Geodeziya bo‘yicha savolingizni yozing..."
                  className="flex-1 bg-transparent px-3 py-2 text-xs text-[var(--text)] outline-none"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || isChatLoading}
                  className="p-2.5 rounded-xl bg-[var(--accent)] text-black font-bold disabled:opacity-30 hover:brightness-110 transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODULE 9: GUIDE & FORMULAS */}
          {/* ========================================================================= */}
          {activeModule === "guide" && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-[var(--text)] flex items-center gap-2">
                  <Info className="w-6 h-6 text-[var(--accent)]" />
                  Qo‘llanma va Geodeziya Formulalari
                </h2>
                <p className="text-xs text-[var(--muted)] mt-1">
                  GeoCalc dasturida foydalanilgan xalqaro standartlar va matematik formulalar.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-[var(--panel)] border border-[var(--border)] space-y-2">
                  <h3 className="text-sm font-bold text-[var(--accent)]">1. Maydon hisoblash (WGS84 va Gauss-Krüger)</h3>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    WGS84 ellipsoidi (EPSG:4326) koordinatalari O‘zbekiston hududiga mos keluvchi UTM zonalari (EPSG:32641, 32642, 32643)ga proyeksiyalanadi. Shoelace (Gauss maydon formulasi) orqali yuzalar m², sotix va gektarlarga o‘tkaziladi.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[var(--panel)] border border-[var(--border)] space-y-2">
                  <h3 className="text-sm font-bold text-[var(--blue)]">2. Vincenty Masofa va Azimut formulasi</h3>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    Ellipsoid sirtida 2 ta nuqta orasidagi to‘g‘ri geodesik masofani 0.5 mm aniqlikda hisoblaydi. To‘g‘ri va teskari azimut hamda 4 chorakli rumb burchaklari aniqlanadi.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[var(--panel)] border border-[var(--border)] space-y-2">
                  <h3 className="text-sm font-bold text-[var(--warning)]">3. TIN Cut & Fill (Yer ishlari)</h3>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    Balandlik nuqtalaridan Delaunay triangulyatsiyasi qurilib, 3D uchburchak prizmalar hosil qilinadi. Nol balandlik chizig‘ida kesilgan prizmalar alohida integrallanib qazish va to‘kish hajmi topiladi.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[var(--panel)] border border-[var(--border)] space-y-2">
                  <h3 className="text-sm font-bold text-[var(--text)]">4. Geometrik Nivelirlash va Nishablik</h3>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    Asbob balandligi (HI = BM + BS) va Relyef nuqtasi (RL = HI - IS/FS) orqali nishablik foiz (%), promille (‰) va burchak (°) shaklida hisoblanadi.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODULE 10: HISTORY */}
          {/* ========================================================================= */}
          {activeModule === "history" && (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-[var(--text)] flex items-center gap-2">
                    <History className="w-6 h-6 text-[var(--accent)]" />
                    Hisob-kitoblar tarixi
                  </h2>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Oxirgi amalga oshirilgan hisob-kitoblar ro‘yxati.
                  </p>
                </div>

                {history.length > 0 && (
                  <button
                    onClick={() => {
                      setHistory([]);
                      localStorage.removeItem("geocalc_history");
                      showToast("Tarix tozalandi!");
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[var(--danger-soft)] text-[var(--danger)] text-xs font-semibold"
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
                      className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--border)] flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-[var(--accent)]">{item.title}</div>
                        <div className="font-mono text-sm font-bold text-[var(--text)] mt-0.5">{item.value}</div>
                      </div>
                      <div className="text-[10px] text-[var(--muted-2)] font-mono">{item.date}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-[var(--muted)] rounded-2xl bg-[var(--panel)] border border-[var(--border)]">
                    Hali hech qanday hisob-kitob saqlanmagan.
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
