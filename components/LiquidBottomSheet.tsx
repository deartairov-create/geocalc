"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useDragControls, PanInfo } from "framer-motion";
import {
  Calculator,
  Compass,
  RefreshCw,
  Triangle,
  TrendingUp,
  Box as BoxIcon,
  Sparkles,
  Phone,
  Info,
  History,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
  MapPin,
  Check,
  Copy,
  Send,
  Download,
  X,
  Sliders,
  Maximize2,
  Minimize2,
} from "lucide-react";

import LiquidButton from "@/components/LiquidButton";
import GeoAIChat from "@/components/geoai-chat";
import type { GeoPoint } from "@/lib/legacy-geometry";
import {
  calculateAccurateArea,
  calculateMetricPerimeter,
  formatNumber,
  fromDMS,
  parseCoordinates,
  toDMS,
} from "@/lib/legacy-geometry";
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
} from "@/lib/geodesy-advanced";
import {
  calculateCutFill,
  parseVolumeRows,
  type VolumeCoordinateMode,
  type VolumeDesignMode,
  type VolumeResult,
} from "@/lib/volume";
import type { User as FirebaseUser } from "firebase/auth";

export type SheetSnapState = "peek" | "half" | "full";
export type ModuleId =
  | "area"
  | "distance"
  | "converter"
  | "shapes"
  | "slope"
  | "volume"
  | "geoai"
  | "contacts"
  | "guide"
  | "history";

type AppLanguage = "uz" | "ru" | "en";

interface LiquidBottomSheetProps {
  points: GeoPoint[];
  onPointsChange: (pts: GeoPoint[]) => void;
  language: AppLanguage;
  currentUser: FirebaseUser | null;
  activeModule: ModuleId;
  onSelectModule: (m: ModuleId) => void;
  onClearPoints: () => void;
  onUndoPoint: () => void;
  onLocateMe: () => void;
  onFitBounds: () => void;
  snapState: SheetSnapState;
  onSnapChange: (snap: SheetSnapState) => void;
}

function tr(l: AppLanguage, uz: string, ru: string, en: string) {
  return l === "ru" ? ru : l === "en" ? en : uz;
}

export default function LiquidBottomSheet({
  points,
  onPointsChange,
  language,
  currentUser,
  activeModule,
  onSelectModule,
  onClearPoints,
  onUndoPoint,
  onLocateMe,
  onFitBounds,
  snapState,
  onSnapChange,
}: LiquidBottomSheetProps) {
  // Manual Input State (Decimal keypad ready)
  const [inputLat, setInputLat] = useState("");
  const [inputLon, setInputLon] = useState("");
  const [batchText, setBatchText] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 1. Distance & Azimuth State
  const [distP1, setDistP1] = useState({ lat: "41.311081", lon: "69.240562" });
  const [distP2, setDistP2] = useState({ lat: "39.654700", lon: "66.975800" });
  const [distResult, setDistResult] = useState<AzimuthResult | null>(null);
  const [directStart, setDirectStart] = useState({ lat: "41.311081", lon: "69.240562" });
  const [directAz, setDirectAz] = useState("45");
  const [directDist, setDirectDist] = useState("1000");
  const [directResult, setDirectResult] = useState<GeoPoint | null>(null);

  // 2. Converter State
  const [convLat, setConvLat] = useState("41.311081");
  const [convLon, setConvLon] = useState("69.240562");
  const [convBatchIn, setConvBatchIn] = useState("");
  const [convBatchOut, setConvBatchOut] = useState("");

  // 3. Shapes State
  const [shapeType, setShapeType] = useState<"rect" | "tri" | "trap" | "circ" | "pit">("rect");
  const [sp, setSp] = useState<Record<string, number>>({
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
  const [shapeResult, setShapeResult] = useState<Record<string, number> | null>(null);

  // 4. Slope & Leveling State
  const [slopeH, setSlopeH] = useState("2.5");
  const [slopeD, setSlopeD] = useState("100");
  const [slopeRes, setSlopeRes] = useState<SlopeResult | null>(null);
  const [bmVal, setBmVal] = useState("100.00");
  const [levelRows] = useState([
    { bs: 1.45, remark: "BM-1" },
    { is: 1.20, remark: "0+00" },
    { is: 1.65, remark: "0+50" },
    { fs: 2.10, bs: 1.35, remark: "TP-1" },
    { fs: 0.95, remark: "TBM-2" },
  ]);
  const [levelTable, setLevelTable] = useState<LevelingStation[]>([]);

  // 5. Volume TIN State
  const [volIn, setVolIn] = useState("0 0 100.40\n40 0 101.10\n80 0 99.90\n0 40 100.80\n40 40 102.20\n80 40 100.30");
  const [volCoord, setVolCoord] = useState<VolumeCoordinateMode>("local");
  const [volDesign, setVolDesign] = useState<VolumeDesignMode>("level");
  const [volLevel, setVolLevel] = useState("101.00");
  const [volResult, setVolResult] = useState<VolumeResult | null>(null);
  const [volError, setVolError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Live Polygon Metrics
  const polygonMetrics = React.useMemo(() => {
    if (points.length < 3) return null;
    return calculatePolygonProperties(points);
  }, [points]);

  // Handle Add Coordinate manually
  const handleAddManualPoint = () => {
    const lat = parseFloat(inputLat);
    const lon = parseFloat(inputLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      showToast(tr(language, "Koordinatani to‘g‘ri kiriting", "Введите корректные координаты", "Invalid coordinates"));
      return;
    }
    const newPts = [...points, { lat, lon }];
    onPointsChange(newPts);
    setInputLat("");
    setInputLon("");
    showToast(tr(language, "Nuqta qo‘shildi!", "Точка добавлена!", "Point added!"));
  };

  // Remove individual point
  const handleRemovePoint = (index: number) => {
    const newPts = points.filter((_, i) => i !== index);
    onPointsChange(newPts);
  };

  // Shape Calculation on change
  useEffect(() => {
    try {
      if (shapeType === "rect") setShapeResult(SimpleShapes.rectangle(sp.w || 0, sp.l || 0) as any);
      else if (shapeType === "tri") setShapeResult(SimpleShapes.triangleHeron(sp.a || 0, sp.b || 0, sp.c || 0) as any);
      else if (shapeType === "trap") setShapeResult(SimpleShapes.trapezoid(sp.a || 0, sp.b || 0, sp.h || 0) as any);
      else if (shapeType === "circ") setShapeResult(SimpleShapes.circle(sp.r || 0) as any);
      else if (shapeType === "pit") setShapeResult(SimpleShapes.pitVolume(sp.topArea || 0, sp.bottomArea || 0, sp.depth || 0) as any);
    } catch {
      setShapeResult(null);
    }
  }, [shapeType, sp]);

  // Snap heights configuration
  const snapHeights = {
    peek: "115px",
    half: "46vh",
    full: "88vh",
  };

  // Gesture Drag Handler
  const handleDragEnd = (_: any, info: PanInfo) => {
    const offset = info.offset.y;
    const velocity = info.velocity.y;

    if (velocity < -400 || offset < -100) {
      if (snapState === "peek") onSnapChange("half");
      else onSnapChange("full");
    } else if (velocity > 400 || offset > 100) {
      if (snapState === "full") onSnapChange("half");
      else onSnapChange("peek");
    }
  };

  // Modules list
  const modules = [
    { id: "area", label: tr(language, "Yuza", "Площадь", "Area"), icon: Calculator },
    { id: "distance", label: tr(language, "Masofa/Azimut", "Азимут", "Distance"), icon: Compass, badge: "PRO" },
    { id: "converter", label: tr(language, "Konvertor", "Конвертер", "Converter"), icon: RefreshCw },
    { id: "shapes", label: tr(language, "Shakllar", "Фигуры", "Shapes"), icon: Triangle },
    { id: "slope", label: tr(language, "Nivelir", "Нивелир", "Leveling"), icon: TrendingUp },
    { id: "volume", label: tr(language, "TIN Hajm", "Объём", "Volume"), icon: BoxIcon },
    { id: "geoai", label: "GeoAI", icon: Sparkles, badge: "BETA · Tekin" },
    { id: "contacts", label: tr(language, "Aloqa", "Контакты", "Contacts"), icon: Phone },
    { id: "guide", label: tr(language, "Qo‘llanma", "Справка", "Guide"), icon: Info },
  ];

  return (
    <>
      {/* Toast popup */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-full liquid-glass text-[var(--accent)] text-xs font-extrabold shadow-2xl flex items-center gap-2 border border-emerald-400/50"
          >
            <Check className="w-4 h-4 text-[var(--accent)]" /> {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sheet Container with Framer Motion Physics */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        animate={{ height: snapHeights[snapState] }}
        transition={{ type: "spring", stiffness: 350, damping: 32 }}
        className="fixed inset-x-0 bottom-0 z-40 liquid-glass-sheet rounded-t-[34px] flex flex-col overflow-hidden shadow-[0_-15px_40px_rgba(0,0,0,0.6)]"
      >
        {/* Top Grab Handle & Peek Bar (Thumb Zone Action) */}
        <div
          onClick={() => {
            if (snapState === "peek") onSnapChange("half");
            else if (snapState === "half") onSnapChange("full");
            else onSnapChange("peek");
          }}
          className="pt-3 pb-2 px-4 flex flex-col items-center cursor-pointer select-none flex-shrink-0"
        >
          {/* Specular Pill Handle */}
          <div className="w-12 h-1.5 rounded-full bg-white/40 shadow-[0_1px_2px_rgba(0,0,0,0.5)] mb-2" />

          {/* Quick Peek Status Line */}
          <div className="w-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] animate-ping" />
              <span className="text-xs font-black tracking-tight text-[var(--text)] uppercase">
                {modules.find((m) => m.id === activeModule)?.label || "GeoCalc"}
              </span>
              <span className="text-[11px] font-mono font-bold text-[var(--muted)]">
                ({points.length} {tr(language, "nuqta", "точек", "pts")})
              </span>
            </div>

            {/* Quick Metrics or Result in Peek */}
            {polygonMetrics ? (
              <div className="flex items-center gap-2 font-mono">
                <span className="text-xs font-black text-[var(--accent)]">
                  {formatNumber(polygonMetrics.areaM2)} m²
                </span>
                <span className="text-[10px] text-[var(--muted-2)]">|</span>
                <span className="text-[11px] font-bold text-[var(--text)]">
                  {polygonMetrics.areaSotix.toFixed(1)} sotix
                </span>
              </div>
            ) : (
              <div className="text-[11px] text-[var(--muted)] font-medium flex items-center gap-1">
                <span>{tr(language, "Xaritani bosing yoki torting", "Кликните на карту", "Tap map to add")}</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        </div>

        {/* Module Switcher Pill Ribbon */}
        <div className="px-3 pb-2.5 overflow-x-auto flex items-center gap-1.5 flex-shrink-0 no-scrollbar">
          {modules.map((m) => {
            const Icon = m.icon;
            const isActive = activeModule === m.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  onSelectModule(m.id as ModuleId);
                  if (snapState === "peek") onSnapChange("half");
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? "liquid-btn-primary text-black shadow-md scale-[1.03]"
                    : "liquid-pill text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{m.label}</span>
                {m.badge && (
                  <span className="text-[8px] font-black px-1.5 py-0.2 rounded-full bg-black/20 text-black uppercase">
                    {m.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4">
          {/* ========================================================= */}
          {/* 1. MODULE: AREA (YUZA HISOBLASH) */}
          {/* ========================================================= */}
          {activeModule === "area" && (
            <div className="space-y-4">
              {/* Decimal Input Bar with Native Numeric Keyboard */}
              <div className="liquid-pill p-2 flex items-center gap-2">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Lat (41.3110)"
                    value={inputLat}
                    onChange={(e) => setInputLat(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-full bg-white/5 border border-[var(--border-glass)] text-xs font-mono text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Lon (69.2405)"
                    value={inputLon}
                    onChange={(e) => setInputLon(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-full bg-white/5 border border-[var(--border-glass)] text-xs font-mono text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <LiquidButton
                  variant="primary"
                  size="sm"
                  onClick={handleAddManualPoint}
                  icon={<Plus className="w-4 h-4 text-black" />}
                >
                  {tr(language, "Qo‘shish", "Добавить", "Add")}
                </LiquidButton>
              </div>

              {/* Live Metric Cards Grid */}
              {polygonMetrics && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 rounded-[20px] liquid-pill text-center">
                    <div className="text-[9px] font-bold text-[var(--muted)] uppercase">Maydon (m²)</div>
                    <div className="text-sm font-black text-[var(--accent)] mt-0.5 font-mono">
                      {formatNumber(polygonMetrics.areaM2)} m²
                    </div>
                  </div>
                  <div className="p-3 rounded-[20px] liquid-pill text-center">
                    <div className="text-[9px] font-bold text-[var(--muted)] uppercase">Sotix (Ar)</div>
                    <div className="text-sm font-black text-[var(--text)] mt-0.5 font-mono">
                      {polygonMetrics.areaSotix.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3 rounded-[20px] liquid-pill text-center">
                    <div className="text-[9px] font-bold text-[var(--muted)] uppercase">Gektar (ha)</div>
                    <div className="text-sm font-black text-[var(--text)] mt-0.5 font-mono">
                      {polygonMetrics.areaHectares.toFixed(4)} ha
                    </div>
                  </div>
                  <div className="p-3 rounded-[20px] liquid-pill text-center">
                    <div className="text-[9px] font-bold text-[var(--muted)] uppercase">Perimetr</div>
                    <div className="text-sm font-black text-[var(--blue)] mt-0.5 font-mono">
                      {polygonMetrics.perimeterMeters.toFixed(1)} m
                    </div>
                  </div>
                </div>
              )}

              {/* Point Chips Carousel / List (Swipe to delete ready) */}
              {points.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[var(--muted)] px-1">
                    <span>{tr(language, "Nuqtalar ketma-ketligi", "Список точек", "Points Sequence")}</span>
                    <button
                      onClick={onClearPoints}
                      className="text-[11px] text-[var(--danger)] hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> {tr(language, "Tozalash", "Очистить", "Clear all")}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
                    {points.map((p, idx) => (
                      <div
                        key={idx}
                        className="liquid-pill px-3 py-2 flex items-center justify-between gap-2 text-xs font-mono"
                      >
                        <span className="w-5 h-5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-[var(--text)] truncate">
                          {p.lat.toFixed(6)}, {p.lon.toFixed(6)}
                        </span>
                        <button
                          onClick={() => handleRemovePoint(idx)}
                          className="p-1 rounded-full text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-[22px] liquid-glass text-center text-xs text-[var(--muted)]">
                  {tr(
                    language,
                    "Nuqta qo‘shish uchun xaritani bosing yoki yuqoridagi maydonga koordinatalarni kiriting.",
                    "Кликните на карту для добавления точек участка.",
                    "Tap anywhere on the map to add polygon vertices.",
                  )}
                </div>
              )}

              {/* Thumb Action Buttons Row */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <LiquidButton
                  variant="glass"
                  onClick={onFitBounds}
                  icon={<Maximize2 className="w-4 h-4" />}
                >
                  {tr(language, "Fokuslash", "Границы", "Fit Bounds")}
                </LiquidButton>
                <LiquidButton
                  variant="glass"
                  onClick={() => {
                    const text = points.map((p) => `${p.lat.toFixed(6)} ${p.lon.toFixed(6)}`).join("\n");
                    navigator.clipboard.writeText(text);
                    showToast(tr(language, "Nusxalandi!", "Скопировано!", "Copied!"));
                  }}
                  icon={<Copy className="w-4 h-4" />}
                >
                  {tr(language, "Nusxalash", "Копировать", "Copy text")}
                </LiquidButton>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. MODULE: DISTANCE & AZIMUTH */}
          {/* ========================================================= */}
          {activeModule === "distance" && (
            <div className="space-y-4">
              <div className="p-4 rounded-[24px] liquid-glass space-y-3">
                <div className="text-xs font-black text-[var(--accent)] uppercase">
                  Vincenty Geodezik Masofa & Azimut
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Lat 1"
                    value={distP1.lat}
                    onChange={(e) => setDistP1({ ...distP1, lat: e.target.value })}
                    className="px-3 py-2 rounded-full bg-white/5 border border-[var(--border-glass)] text-xs text-[var(--text)]"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Lon 1"
                    value={distP1.lon}
                    onChange={(e) => setDistP1({ ...distP1, lon: e.target.value })}
                    className="px-3 py-2 rounded-full bg-white/5 border border-[var(--border-glass)] text-xs text-[var(--text)]"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Lat 2"
                    value={distP2.lat}
                    onChange={(e) => setDistP2({ ...distP2, lat: e.target.value })}
                    className="px-3 py-2 rounded-full bg-white/5 border border-[var(--border-glass)] text-xs text-[var(--text)]"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Lon 2"
                    value={distP2.lon}
                    onChange={(e) => setDistP2({ ...distP2, lon: e.target.value })}
                    className="px-3 py-2 rounded-full bg-white/5 border border-[var(--border-glass)] text-xs text-[var(--text)]"
                  />
                </div>
                <LiquidButton
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    try {
                      const res = calculateVincentyDistanceAndAzimuth(
                        { lat: parseFloat(distP1.lat), lon: parseFloat(distP1.lon) },
                        { lat: parseFloat(distP2.lat), lon: parseFloat(distP2.lon) },
                      );
                      setDistResult(res);
                      showToast("Hisoblandi!");
                    } catch (e: any) {
                      showToast(e.message);
                    }
                  }}
                >
                  <Compass className="w-4 h-4 text-black" /> Hisoblash
                </LiquidButton>

                {distResult && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10 font-mono">
                    <div className="liquid-pill p-2.5 text-center">
                      <div className="text-[9px] text-[var(--muted)]">Masofa</div>
                      <div className="text-xs font-black text-[var(--accent)]">
                        {distResult.distanceMeters.toFixed(1)} m
                      </div>
                    </div>
                    <div className="liquid-pill p-2.5 text-center">
                      <div className="text-[9px] text-[var(--muted)]">Km</div>
                      <div className="text-xs font-black text-[var(--text)]">
                        {distResult.distanceKm.toFixed(3)} km
                      </div>
                    </div>
                    <div className="liquid-pill p-2.5 text-center">
                      <div className="text-[9px] text-[var(--muted)]">Azimut</div>
                      <div className="text-xs font-black text-[var(--blue)]">
                        {distResult.initialAzimuthDeg.toFixed(2)}°
                      </div>
                    </div>
                    <div className="liquid-pill p-2.5 text-center">
                      <div className="text-[9px] text-[var(--muted)]">Rumb</div>
                      <div className="text-xs font-black text-[var(--warning)]">
                        {distResult.rhumbString}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. MODULE: CONVERTER */}
          {/* ========================================================= */}
          {activeModule === "converter" && (
            <div className="space-y-4">
              <div className="p-4 rounded-[24px] liquid-glass space-y-3 font-mono">
                <div className="text-xs font-black text-[var(--accent)] uppercase">
                  O‘nli gradus → DMS (Gradus Minut Sekund)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={convLat}
                      onChange={(e) => setConvLat(e.target.value)}
                      className="w-full px-3 py-2 rounded-full bg-white/5 border border-[var(--border-glass)] text-xs text-[var(--text)]"
                    />
                    <div className="text-[11px] text-[var(--accent)] font-bold mt-1 px-1">
                      {Number.isFinite(parseFloat(convLat)) ? toDMS(parseFloat(convLat), "lat") : "-"}
                    </div>
                  </div>
                  <div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={convLon}
                      onChange={(e) => setConvLon(e.target.value)}
                      className="w-full px-3 py-2 rounded-full bg-white/5 border border-[var(--border-glass)] text-xs text-[var(--text)]"
                    />
                    <div className="text-[11px] text-[var(--accent)] font-bold mt-1 px-1">
                      {Number.isFinite(parseFloat(convLon)) ? toDMS(parseFloat(convLon), "lon") : "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. MODULE: SHAPES */}
          {/* ========================================================= */}
          {activeModule === "shapes" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5 p-1 liquid-pill">
                {[
                  { id: "rect", l: "To‘rtburchak" },
                  { id: "tri", l: "Uchburchak" },
                  { id: "trap", l: "Trapetsiya" },
                  { id: "circ", l: "Doira" },
                  { id: "pit", l: "Kotlovan" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setShapeType(s.id as any)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      shapeType === s.id
                        ? "bg-white text-black shadow-md"
                        : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {s.l}
                  </button>
                ))}
              </div>

              <div className="p-4 rounded-[24px] liquid-glass space-y-3">
                {shapeType === "rect" && (
                  <div className="grid grid-cols-2 gap-2 font-mono">
                    <input
                      type="number"
                      placeholder="Eni (a)"
                      value={sp.w}
                      onChange={(e) => setSp({ ...sp, w: parseFloat(e.target.value) })}
                      className="px-3 py-2 rounded-full bg-white/5 border border-[var(--border-glass)] text-xs"
                    />
                    <input
                      type="number"
                      placeholder="Bo‘yi (b)"
                      value={sp.l}
                      onChange={(e) => setSp({ ...sp, l: parseFloat(e.target.value) })}
                      className="px-3 py-2 rounded-full bg-white/5 border border-[var(--border-glass)] text-xs"
                    />
                  </div>
                )}

                {shapeResult && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 font-mono">
                    {shapeResult.area !== undefined && (
                      <div className="liquid-pill p-2.5 text-center">
                        <div className="text-[9px] text-[var(--muted)]">Maydon</div>
                        <div className="text-xs font-black text-[var(--accent)]">{shapeResult.area} m²</div>
                      </div>
                    )}
                    {shapeResult.perimeter !== undefined && (
                      <div className="liquid-pill p-2.5 text-center">
                        <div className="text-[9px] text-[var(--muted)]">Perimetr</div>
                        <div className="text-xs font-black text-[var(--text)]">{shapeResult.perimeter} m</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. MODULE: SLOPE & LEVELING */}
          {/* ========================================================= */}
          {activeModule === "slope" && (
            <div className="space-y-4">
              <div className="p-4 rounded-[24px] liquid-glass space-y-3 font-mono">
                <div className="text-xs font-black text-[var(--accent)] uppercase">Nishablik hisoblash</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Δh (m)"
                    value={slopeH}
                    onChange={(e) => setSlopeH(e.target.value)}
                    className="px-3 py-2 rounded-full bg-white/5 border border-[var(--border-glass)] text-xs"
                  />
                  <input
                    type="number"
                    placeholder="d (m)"
                    value={slopeD}
                    onChange={(e) => setSlopeD(e.target.value)}
                    className="px-3 py-2 rounded-full bg-white/5 border border-[var(--border-glass)] text-xs"
                  />
                </div>
                <LiquidButton
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    const r = calculateSlope(parseFloat(slopeH), parseFloat(slopeD));
                    setSlopeRes(r);
                    showToast("Nishablik hisoblandi!");
                  }}
                >
                  Nishablikni hisoblash
                </LiquidButton>

                {slopeRes && (
                  <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-white/10 text-center font-mono">
                    <div className="liquid-pill p-2">
                      <div className="text-[8px] text-[var(--muted)]">%</div>
                      <div className="text-xs font-black text-[var(--accent)]">{slopeRes.slopePercent}%</div>
                    </div>
                    <div className="liquid-pill p-2">
                      <div className="text-[8px] text-[var(--muted)]">‰</div>
                      <div className="text-xs font-black text-[var(--text)]">{slopeRes.slopePromille}‰</div>
                    </div>
                    <div className="liquid-pill p-2">
                      <div className="text-[8px] text-[var(--muted)]">°</div>
                      <div className="text-xs font-black text-[var(--blue)]">{slopeRes.slopeAngleDeg}°</div>
                    </div>
                    <div className="liquid-pill p-2">
                      <div className="text-[8px] text-[var(--muted)]">1:N</div>
                      <div className="text-xs font-black text-[var(--warning)]">{slopeRes.ratioString}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. MODULE: VOLUME TIN */}
          {/* ========================================================= */}
          {activeModule === "volume" && (
            <div className="space-y-4">
              <div className="p-4 rounded-[24px] liquid-glass space-y-3 font-mono">
                <div className="text-xs font-black text-[var(--accent)] uppercase">
                  Yer ishlari hajmi (TIN Cut & Fill)
                </div>
                <textarea
                  rows={4}
                  value={volIn}
                  onChange={(e) => setVolIn(e.target.value)}
                  className="w-full px-3 py-2 rounded-[18px] bg-white/5 border border-[var(--border-glass)] text-xs resize-none"
                />
                <LiquidButton
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    try {
                      const rows = parseVolumeRows(volIn, volCoord, volDesign, parseFloat(volLevel));
                      const r = calculateCutFill(rows);
                      setVolResult(r);
                      showToast("Hajm hisoblandi!");
                    } catch (e: any) {
                      showToast(e.message);
                    }
                  }}
                >
                  TIN Hajmini hisoblash
                </LiquidButton>

                {volResult && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center font-mono">
                    <div className="liquid-pill p-2 bg-rose-500/15 border-rose-500/30">
                      <div className="text-[8px] text-rose-400">Cut (Qazish)</div>
                      <div className="text-xs font-black text-rose-400">{volResult.cut.toFixed(1)} m³</div>
                    </div>
                    <div className="liquid-pill p-2 bg-blue-500/15 border-blue-500/30">
                      <div className="text-[8px] text-blue-400">Fill (To‘kish)</div>
                      <div className="text-xs font-black text-blue-400">{volResult.fill.toFixed(1)} m³</div>
                    </div>
                    <div className="liquid-pill p-2">
                      <div className="text-[8px] text-[var(--muted)]">Plan m²</div>
                      <div className="text-xs font-black text-[var(--accent)]">{volResult.planArea.toFixed(0)} m²</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 7. MODULE: GEOAI (BETA TEKIN) */}
          {/* ========================================================= */}
          {activeModule === "geoai" && (
            <div className="h-[52vh] rounded-[24px] overflow-hidden liquid-glass flex flex-col">
              <GeoAIChat language={language} currentUser={currentUser} />
            </div>
          )}

          {/* ========================================================= */}
          {/* 8. MODULE: CONTACTS & GUIDE */}
          {/* ========================================================= */}
          {activeModule === "contacts" && (
            <div className="p-5 rounded-[26px] liquid-glass space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center font-black text-black text-lg">
                  TA
                </div>
                <div>
                  <div className="text-sm font-black text-[var(--text)]">Toirov Azizbek</div>
                  <div className="text-xs text-[var(--accent)] font-semibold">GeoCalc arxitektori</div>
                  <div className="text-[10px] text-[var(--muted)]">Powered by Toirov Azizbek</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <a
                  href="mailto:deartairov@gmail.com"
                  className="p-3 rounded-full liquid-pill flex items-center justify-center gap-2 text-xs font-bold text-[var(--text)]"
                >
                  deartairov@gmail.com
                </a>
                <a
                  href="https://t.me/dearr5"
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 rounded-full liquid-pill flex items-center justify-center gap-2 text-xs font-bold text-[var(--blue)]"
                >
                  Telegram: @dearr5
                </a>
                <a
                  href="tel:+998958300142"
                  className="p-3 rounded-full liquid-pill flex items-center justify-center gap-2 text-xs font-bold text-[var(--warning)]"
                >
                  +998(95) 830-01-42
                </a>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
