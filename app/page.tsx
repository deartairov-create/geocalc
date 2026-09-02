"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Globe,
  Sun,
  Moon,
  Layers,
  MapPin,
  Trash2,
  Undo2,
  Crosshair,
  Compass,
  Sliders,
  Sparkles,
} from "lucide-react";

import { onAuthStateChanged, signInWithPopup, signOut, type User as FirebaseUser } from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/lib/firebase-client";

import LiquidBottomSheet, { type ModuleId } from "@/components/LiquidBottomSheet";
import AuthGate from "@/components/auth-gate";
import type { GeoPoint } from "@/lib/legacy-geometry";
import { formatNumber } from "@/lib/legacy-geometry";
import { calculatePolygonProperties } from "@/lib/geodesy-advanced";

// SSR-Safe Fast Interactive Leaflet GIS Canvas
const InteractiveMap = dynamic(() => import("@/components/interactive-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#0a0a0a] text-neutral-400">
      <Globe className="w-7 h-7 text-emerald-400 animate-spin" />
      <span className="text-[11px] font-bold uppercase tracking-wider">Web-GIS Xaritasi yuklanmoqda...</span>
    </div>
  ),
});

type AppLanguage = "uz" | "ru" | "en";

export default function MobileFirstGeoCalc() {
  const [language, setLanguage] = useState<AppLanguage>("uz");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [points, setPoints] = useState<GeoPoint[]>([
    { lat: 41.311081, lon: 69.240562 },
    { lat: 41.311081, lon: 69.241562 },
    { lat: 41.310281, lon: 69.241562 },
    { lat: 41.310281, lon: 69.240562 },
  ]);

  // Mode: polygon (Yuza), distance (Masofa), pinpoint (Koordinata)
  const [mapMode, setMapMode] = useState<"polygon" | "distance" | "pinpoint">("polygon");
  const [baseLayer, setBaseLayer] = useState<"satellite" | "osm" | "dark">("satellite");

  // Bottom Sheet state
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleId>("coordinates");
  const [unitMode, setUnitMode] = useState<"m2" | "sotix" | "ha">("m2");

  // Auth State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Sync Theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Auth Listener
  useEffect(() => {
    try {
      const unsub = onAuthStateChanged(firebaseAuth, (user) => {
        setCurrentUser(user);
        setIsAuthLoading(false);
      });
      return () => unsub();
    } catch {
      setIsAuthLoading(false);
    }
  }, []);

  // Live Polygon Calculations
  const polygonMetrics = React.useMemo(() => {
    if (points.length < 3) return null;
    return calculatePolygonProperties(points);
  }, [points]);

  // Actions
  const handleUndo = () => setPoints((prev) => prev.slice(0, -1));
  const handleClear = () => setPoints([]);

  return (
    <div className="relative w-full h-[100dvh] max-h-[100dvh] overflow-hidden bg-[var(--bg)] text-[var(--text)] select-none">
      {/* Auth Gate Modal */}
      <AuthGate
        currentUser={currentUser}
        isAuthLoading={isAuthLoading}
        onSignIn={() => signInWithPopup(firebaseAuth, googleProvider)}
        language={language}
      />

      {/* ========================================================================= */}
      {/* ZONE 1: TOP BAR (Single Compact Row: Brand + Lang + Theme + User) */}
      {/* ========================================================================= */}
      <header className="absolute top-3 inset-x-3 z-30 flex items-center justify-between pointer-events-none">
        {/* Left: Brand Pill */}
        <div className="liquid-pill px-3 py-1.5 flex items-center gap-2 pointer-events-auto shadow-md">
          <div className="w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center font-black text-xs">
            G
          </div>
          <span className="text-xs font-black tracking-tight text-[var(--text)]">
            GeoCalc <span className="text-[8px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400">PRO</span>
          </span>
        </div>

        {/* Right: Lang + Theme + Profile */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Language pill */}
          <div className="liquid-pill p-0.5 flex items-center">
            {(["uz", "ru", "en"] as AppLanguage[]).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase transition-all ${
                  language === l ? "bg-white text-black shadow-sm" : "text-[var(--muted)]"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Theme switch */}
          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="w-8 h-8 rounded-full liquid-pill flex items-center justify-center text-[var(--muted)]"
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-blue-400" />}
          </button>

          {/* User Profile */}
          {currentUser && (
            <div className="w-8 h-8 rounded-full liquid-pill flex items-center justify-center p-0.5 border border-emerald-400/40">
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-xs font-black text-[var(--accent)]">{currentUser.displayName?.[0] || "U"}</span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* ZONE 2: RIGHT FLOATING BAR (Map Utilities: Layers, Undo, Clear) */}
      {/* ========================================================================= */}
      <div className="absolute right-3 top-16 z-30 flex flex-col gap-2 pointer-events-auto">
        {/* Layer Switcher Button */}
        <button
          onClick={() => {
            if (baseLayer === "satellite") setBaseLayer("osm");
            else if (baseLayer === "osm") setBaseLayer("dark");
            else setBaseLayer("satellite");
          }}
          className="w-11 h-11 rounded-full liquid-pill flex items-center justify-center text-[var(--text)] shadow-lg"
          title="Xarita qatlamini almashtirish"
        >
          <Layers className="w-5 h-5 text-[var(--accent)]" />
        </button>

        {/* Undo Point */}
        {points.length > 0 && (
          <button
            onClick={handleUndo}
            className="w-11 h-11 rounded-full liquid-pill flex items-center justify-center text-[var(--text)] shadow-lg"
            title="Nuqtani bekor qilish"
          >
            <Undo2 className="w-5 h-5 text-[var(--text)]" />
          </button>
        )}

        {/* Clear Points */}
        {points.length > 0 && (
          <button
            onClick={handleClear}
            className="w-11 h-11 rounded-full bg-red-500/80 text-white flex items-center justify-center shadow-lg"
            title="Tozalash"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ZONE 3: CENTER CANVAS (100dvh Full Web-GIS Leaflet Engine) */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 z-10 w-full h-full">
        <InteractiveMap
          initialPoints={points}
          onPointsChange={setPoints}
          language={language}
          mode={mapMode}
          baseLayer={baseLayer}
          hideInternalHUD={true}
        />
      </div>

      {/* ========================================================================= */}
      {/* ZONE 4: BOTTOM ACTION ZONE (Floating Result Chip + Mode Bar + Sheet Trigger) */}
      {/* ========================================================================= */}
      <div className="absolute inset-x-3 bottom-3 z-30 flex flex-col items-center gap-2.5 pointer-events-none">
        {/* Floating Live Result Chip */}
        {polygonMetrics && mapMode === "polygon" && (
          <button
            onClick={() => {
              if (unitMode === "m2") setUnitMode("sotix");
              else if (unitMode === "sotix") setUnitMode("ha");
              else setUnitMode("m2");
            }}
            className="pointer-events-auto liquid-pill px-4 py-2 flex items-center gap-2 shadow-xl border border-emerald-400/50 hover:scale-[1.02] transition-transform"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-mono font-black text-[var(--accent)]">
              {unitMode === "m2"
                ? `${formatNumber(polygonMetrics.areaM2)} m²`
                : unitMode === "sotix"
                ? `${polygonMetrics.areaSotix.toFixed(2)} sotix`
                : `${polygonMetrics.areaHectares.toFixed(4)} ha`}
            </span>
            <span className="text-[10px] text-[var(--muted-2)] font-mono">|</span>
            <span className="text-xs font-mono font-bold text-[var(--text)]">
              {polygonMetrics.perimeterMeters.toFixed(1)} m
            </span>
          </button>
        )}

        {/* Master Bottom Action Bar (Mode Pill + Tools Sheet Button) */}
        <div className="w-full flex items-center justify-between gap-2 pointer-events-auto">
          {/* Geodesy Mode Selector */}
          <div className="flex-1 liquid-pill p-1 flex items-center justify-between gap-1 shadow-xl">
            <button
              onClick={() => setMapMode("polygon")}
              className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all ${
                mapMode === "polygon"
                  ? "bg-[var(--accent)] text-black shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              📐 Yuza
            </button>
            <button
              onClick={() => setMapMode("distance")}
              className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all ${
                mapMode === "distance"
                  ? "bg-[var(--blue)] text-white shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              📏 Masofa
            </button>
            <button
              onClick={() => setMapMode("pinpoint")}
              className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all ${
                mapMode === "pinpoint"
                  ? "bg-amber-400 text-black shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              📍 Nuqta
            </button>
          </div>

          {/* Tools / Coordinates Drawer Trigger */}
          <button
            onClick={() => setIsSheetOpen(true)}
            className="w-12 h-12 rounded-full liquid-btn-primary flex items-center justify-center flex-shrink-0 shadow-xl min-w-[48px]"
            title="Qo‘shimcha vositalar va koordinatalar"
          >
            <Sliders className="w-5 h-5 text-black" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EXTENDED TOOLS & COORDINATES BOTTOM SHEET */}
      {/* ========================================================================= */}
      <LiquidBottomSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        points={points}
        onPointsChange={setPoints}
        language={language}
        currentUser={currentUser}
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        onClearPoints={handleClear}
      />
    </div>
  );
}
