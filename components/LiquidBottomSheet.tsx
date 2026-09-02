"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Trash2,
  Plus,
  X,
  Copy,
  Check,
} from "lucide-react";

import GeoAIChat from "@/components/geoai-chat";
import type { GeoPoint } from "@/lib/legacy-geometry";
import { formatNumber, toDMS } from "@/lib/legacy-geometry";
import {
  calculateVincentyDistanceAndAzimuth,
  calculatePolygonProperties,
  calculateSlope,
  SimpleShapes,
  type AzimuthResult,
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

export type ModuleId =
  | "coordinates"
  | "distance"
  | "converter"
  | "shapes"
  | "slope"
  | "volume"
  | "geoai"
  | "contacts";

type AppLanguage = "uz" | "ru" | "en";

interface LiquidBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  points: GeoPoint[];
  onPointsChange: (pts: GeoPoint[]) => void;
  language: AppLanguage;
  currentUser: FirebaseUser | null;
  activeModule: ModuleId;
  onSelectModule: (m: ModuleId) => void;
  onClearPoints: () => void;
}

function tr(l: AppLanguage, uz: string, ru: string, en: string) {
  return l === "ru" ? ru : l === "en" ? en : uz;
}

export default function LiquidBottomSheet({
  isOpen,
  onClose,
  points,
  onPointsChange,
  language,
  currentUser,
  activeModule,
  onSelectModule,
  onClearPoints,
}: LiquidBottomSheetProps) {
  // Input fields
  const [inputLat, setInputLat] = useState("");
  const [inputLon, setInputLon] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Distance & Azimuth
  const [distP1, setDistP1] = useState({ lat: "41.311081", lon: "69.240562" });
  const [distP2, setDistP2] = useState({ lat: "39.654700", lon: "66.975800" });
  const [distResult, setDistResult] = useState<AzimuthResult | null>(null);

  // Converter
  const [convLat, setConvLat] = useState("41.311081");
  const [convLon, setConvLon] = useState("69.240562");

  // Shapes
  const [shapeType, setShapeType] = useState<"rect" | "tri" | "trap" | "circ">("rect");
  const [sp, setSp] = useState<Record<string, number>>({ w: 25, l: 40, a: 30, b: 40, c: 50, h: 15, r: 12 });
  const [shapeResult, setShapeResult] = useState<Record<string, number> | null>(null);

  // Slope
  const [slopeH, setSlopeH] = useState("2.5");
  const [slopeD, setSlopeD] = useState("100");
  const [slopeRes, setSlopeRes] = useState<SlopeResult | null>(null);

  // Volume
  const [volIn, setVolIn] = useState("0 0 100.40\n40 0 101.10\n80 0 99.90\n0 40 100.80\n40 40 102.20");
  const [volLevel, setVolLevel] = useState("101.00");
  const [volResult, setVolResult] = useState<VolumeResult | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const handleAddManualPoint = () => {
    const lat = parseFloat(inputLat);
    const lon = parseFloat(inputLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      showToast(tr(language, "Koordinata noto‘g‘ri", "Неверные координаты", "Invalid coordinates"));
      return;
    }
    onPointsChange([...points, { lat, lon }]);
    setInputLat("");
    setInputLon("");
    showToast(tr(language, "Nuqta qo‘shildi!", "Точка добавлена!", "Point added!"));
  };

  const handleRemovePoint = (index: number) => {
    onPointsChange(points.filter((_, i) => i !== index));
  };

  const modules = [
    { id: "coordinates", label: tr(language, "Nuqtalar", "Точки", "Points"), icon: Calculator },
    { id: "distance", label: tr(language, "Masofa/Azimut", "Азимут", "Distance"), icon: Compass },
    { id: "converter", label: tr(language, "Konvertor", "Конвертер", "Converter"), icon: RefreshCw },
    { id: "shapes", label: tr(language, "Shakllar", "Фигуры", "Shapes"), icon: Triangle },
    { id: "slope", label: tr(language, "Nivelir", "Нивелир", "Leveling"), icon: TrendingUp },
    { id: "volume", label: tr(language, "TIN Hajm", "Объём", "Volume"), icon: BoxIcon },
    { id: "geoai", label: "GeoAI BETA", icon: Sparkles },
    { id: "contacts", label: tr(language, "Aloqa", "Контакты", "Contacts"), icon: Phone },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          {/* Bottom Sheet Modal */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[82vh] h-[82vh] liquid-glass-sheet rounded-t-[28px] flex flex-col overflow-hidden"
          >
            {/* Grab Bar */}
            <div className="pt-3 pb-2 px-4 flex items-center justify-between border-b border-[var(--border)]">
              <div className="w-8" />
              <div className="w-10 h-1 rounded-full bg-white/30" />
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Horizontal Module Tabs */}
            <div className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto border-b border-[var(--border)] no-scrollbar flex-shrink-0">
              {modules.map((m) => {
                const Icon = m.icon;
                const isActive = activeModule === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => onSelectModule(m.id as ModuleId)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                      isActive
                        ? "bg-[var(--accent)] text-black shadow-md"
                        : "bg-white/5 text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Scrollable Sheet Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* ========================================= */}
              {/* 1. COORDINATES LIST & DECIMAL ENTRY */}
              {/* ========================================= */}
              {activeModule === "coordinates" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Lat (41.3110)"
                      value={inputLat}
                      onChange={(e) => setInputLat(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/5 border border-[var(--border-glass)] text-xs font-mono text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Lon (69.2405)"
                      value={inputLon}
                      onChange={(e) => setInputLon(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/5 border border-[var(--border-glass)] text-xs font-mono text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                    <button
                      onClick={handleAddManualPoint}
                      className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-black font-bold text-xs flex items-center gap-1 min-h-[44px]"
                    >
                      <Plus className="w-4 h-4" /> {tr(language, "Qo‘shish", "Добавить", "Add")}
                    </button>
                  </div>

                  {points.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-[var(--muted)] font-bold">
                        <span>{tr(language, "Koordinatalar ro‘yxati", "Список точек", "Points List")} ({points.length})</span>
                        <button onClick={onClearPoints} className="text-red-400 hover:underline flex items-center gap-1">
                          <Trash2 className="w-3.5 h-3.5" /> {tr(language, "Tozalash", "Очистить", "Clear")}
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                        {points.map((p, i) => (
                          <div
                            key={i}
                            className="px-3 py-2 rounded-xl bg-white/5 border border-[var(--border)] flex items-center justify-between text-xs font-mono"
                          >
                            <span className="w-5 h-5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] font-bold text-[10px] flex items-center justify-center">
                              {i + 1}
                            </span>
                            <span className="text-[var(--text)]">
                              {p.lat.toFixed(6)}, {p.lon.toFixed(6)}
                            </span>
                            <button
                              onClick={() => handleRemovePoint(i)}
                              className="p-1 text-[var(--muted)] hover:text-red-400"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => {
                          const text = points.map((p) => `${p.lat.toFixed(6)} ${p.lon.toFixed(6)}`).join("\n");
                          navigator.clipboard.writeText(text);
                          showToast(tr(language, "Nusxalandi!", "Скопировано!", "Copied!"));
                        }}
                        className="w-full py-2.5 rounded-xl bg-white/10 text-xs font-bold text-[var(--text)] flex items-center justify-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" /> {tr(language, "Barcha koordinatalarni nusxalash", "Копировать все", "Copy All")}
                      </button>
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl bg-white/5 text-center text-xs text-[var(--muted)]">
                      {tr(language, "Nuqta qo‘shish uchun xarita ustiga bosing", "Кликните на карту", "Tap map to add points")}
                    </div>
                  )}
                </div>
              )}

              {/* ========================================= */}
              {/* 2. DISTANCE & AZIMUTH */}
              {/* ========================================= */}
              {activeModule === "distance" && (
                <div className="space-y-3 font-mono">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Lat 1"
                      value={distP1.lat}
                      onChange={(e) => setDistP1({ ...distP1, lat: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-white/5 border border-[var(--border-glass)] text-xs text-[var(--text)]"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Lon 1"
                      value={distP1.lon}
                      onChange={(e) => setDistP1({ ...distP1, lon: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-white/5 border border-[var(--border-glass)] text-xs text-[var(--text)]"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Lat 2"
                      value={distP2.lat}
                      onChange={(e) => setDistP2({ ...distP2, lat: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-white/5 border border-[var(--border-glass)] text-xs text-[var(--text)]"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Lon 2"
                      value={distP2.lon}
                      onChange={(e) => setDistP2({ ...distP2, lon: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-white/5 border border-[var(--border-glass)] text-xs text-[var(--text)]"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const res = calculateVincentyDistanceAndAzimuth(
                        { lat: parseFloat(distP1.lat), lon: parseFloat(distP1.lon) },
                        { lat: parseFloat(distP2.lat), lon: parseFloat(distP2.lon) },
                      );
                      setDistResult(res);
                    }}
                    className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-black font-bold text-xs"
                  >
                    Vincenty Masofani hisoblash
                  </button>

                  {distResult && (
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center">
                      <div className="p-2 rounded-xl bg-white/5">
                        <div className="text-[9px] text-[var(--muted)]">Masofa</div>
                        <div className="text-xs font-bold text-[var(--accent)]">{distResult.distanceMeters.toFixed(1)} m</div>
                      </div>
                      <div className="p-2 rounded-xl bg-white/5">
                        <div className="text-[9px] text-[var(--muted)]">Km</div>
                        <div className="text-xs font-bold text-[var(--text)]">{distResult.distanceKm.toFixed(3)} km</div>
                      </div>
                      <div className="p-2 rounded-xl bg-white/5">
                        <div className="text-[9px] text-[var(--muted)]">Azimut</div>
                        <div className="text-xs font-bold text-[var(--blue)]">{distResult.initialAzimuthDeg.toFixed(2)}°</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================= */}
              {/* 3. CONVERTER */}
              {/* ========================================= */}
              {activeModule === "converter" && (
                <div className="space-y-3 font-mono">
                  <div className="text-xs text-[var(--muted)] font-sans">O‘nli gradus → GMS (Gradus Minut Sekund)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={convLat}
                        onChange={(e) => setConvLat(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-[var(--border-glass)] text-xs text-[var(--text)]"
                      />
                      <div className="text-xs text-[var(--accent)] font-bold mt-1 px-1">
                        {toDMS(parseFloat(convLat) || 0, "lat")}
                      </div>
                    </div>
                    <div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={convLon}
                        onChange={(e) => setConvLon(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-[var(--border-glass)] text-xs text-[var(--text)]"
                      />
                      <div className="text-xs text-[var(--accent)] font-bold mt-1 px-1">
                        {toDMS(parseFloat(convLon) || 0, "lon")}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================= */}
              {/* 4. GEOAI (BETA) */}
              {/* ========================================= */}
              {activeModule === "geoai" && (
                <div className="h-[46vh] rounded-2xl overflow-hidden bg-black/40 border border-white/10 flex flex-col">
                  <GeoAIChat language={language} currentUser={currentUser} />
                </div>
              )}

              {/* ========================================= */}
              {/* 5. CONTACTS */}
              {/* ========================================= */}
              {activeModule === "contacts" && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--accent)] text-black font-black flex items-center justify-center">
                      TA
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[var(--text)]">Toirov Azizbek</div>
                      <div className="text-xs text-[var(--accent)]">GeoCalc asoschisi</div>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <a href="mailto:deartairov@gmail.com" className="block p-3 rounded-xl bg-white/5 text-[var(--text)]">
                      ✉️ deartairov@gmail.com
                    </a>
                    <a href="https://t.me/dearr5" target="_blank" rel="noreferrer" className="block p-3 rounded-xl bg-white/5 text-[var(--blue)]">
                      ✈️ Telegram: @dearr5
                    </a>
                    <a href="tel:+998958300142" className="block p-3 rounded-xl bg-white/5 text-[var(--warning)]">
                      📞 +998 95 830-01-42
                    </a>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
