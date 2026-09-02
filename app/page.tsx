"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Sun,
  Moon,
  Crosshair,
  Layers,
  MapPin,
  Trash2,
  Undo2,
  Maximize2,
  Sparkles,
  Phone,
  Calculator,
  User as UserIcon,
  LogIn,
  LogOut,
  ShieldCheck,
} from "lucide-react";

import { onAuthStateChanged, signInWithPopup, signOut, type User as FirebaseUser } from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/lib/firebase-client";

import LiquidButton from "@/components/LiquidButton";
import LiquidBottomSheet, { type SheetSnapState, type ModuleId } from "@/components/LiquidBottomSheet";
import AuthGate from "@/components/auth-gate";
import type { GeoPoint } from "@/lib/legacy-geometry";
import { formatNumber } from "@/lib/legacy-geometry";
import { calculatePolygonProperties } from "@/lib/geodesy-advanced";

// Dynamic SSR-Safe Interactive Leaflet Map
const InteractiveMap = dynamic(() => import("@/components/interactive-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#060b14] text-slate-400">
      <Globe className="w-8 h-8 text-emerald-400 animate-spin" />
      <span className="text-xs font-bold uppercase tracking-wider">Web-GIS Xaritasi yuklanmoqda...</span>
    </div>
  ),
});

type AppLanguage = "uz" | "ru" | "en";

function tr(l: AppLanguage, uz: string, ru: string, en: string) {
  return l === "ru" ? ru : l === "en" ? en : uz;
}

const INITIAL_SAMPLE_POINTS: GeoPoint[] = [
  { lat: 41.311081, lon: 69.240562 },
  { lat: 41.311081, lon: 69.241562 },
  { lat: 41.310281, lon: 69.241562 },
  { lat: 41.310281, lon: 69.240562 },
];

export default function MobileFirstGeoCalc() {
  const [language, setLanguage] = useState<AppLanguage>("uz");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [points, setPoints] = useState<GeoPoint[]>(INITIAL_SAMPLE_POINTS);
  const [activeModule, setActiveModule] = useState<ModuleId>("area");
  const [snapState, setSnapState] = useState<SheetSnapState>("peek");
  const [activeUnit, setActiveUnit] = useState<"m2" | "sotix" | "ha">("m2");

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

  const handleSignIn = async () => {
    try {
      await signInWithPopup(firebaseAuth, googleProvider);
    } catch (e: any) {
      console.error("Auth error", e);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(firebaseAuth);
    } catch (e: any) {
      console.error("Sign out error", e);
    }
  };

  // Live Area & Perimeter Metrics
  const polygonMetrics = React.useMemo(() => {
    if (points.length < 3) return null;
    return calculatePolygonProperties(points);
  }, [points]);

  // Map action triggers
  const handleClearPoints = () => setPoints([]);
  const handleUndoPoint = () => setPoints((prev) => prev.slice(0, -1));

  return (
    <div className="relative w-full h-[100dvh] max-h-[100dvh] overflow-hidden bg-[var(--bg)] text-[var(--text)] font-sans select-none flex flex-col">
      {/* Auth Gate (Blocks app if not logged in with Google) */}
      <AuthGate
        currentUser={currentUser}
        isAuthLoading={isAuthLoading}
        onSignIn={handleSignIn}
        language={language}
      />

      {/* Dynamic Fluid Animated Aurora Mesh Layers (Background Glow) */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[10%] w-[550px] h-[550px] rounded-full bg-emerald-500/20 blur-[130px] aurora-layer-1" />
        <div className="absolute top-[30%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/22 blur-[140px] aurora-layer-2" />
        <div className="absolute bottom-[-10%] left-[25%] w-[500px] h-[500px] rounded-full bg-teal-400/18 blur-[120px] aurora-layer-3" />
      </div>

      {/* ========================================================================= */}
      {/* TOP LIQUID GLASS STATUS BAR */}
      {/* ========================================================================= */}
      <header className="absolute top-3 inset-x-3 z-30 flex items-center justify-between pointer-events-auto">
        {/* Brand Chip */}
        <div className="liquid-pill px-3.5 py-1.5 flex items-center gap-2 shadow-lg">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-md">
            <Globe className="w-4 h-4 text-black" />
          </div>
          <span className="text-xs font-black tracking-tight text-[var(--text)]">
            GeoCalc <span className="text-[8px] font-black px-1.5 py-0.2 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-emerald-400/30">PRO</span>
          </span>
        </div>

        {/* Right Action Tools: Language + Theme + Profile */}
        <div className="flex items-center gap-1.5">
          {/* Language pill */}
          <div className="liquid-pill p-0.5 flex items-center">
            {(["uz", "ru", "en"] as AppLanguage[]).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase transition-all ${
                  language === l ? "bg-white text-black shadow-sm" : "text-[var(--muted)]"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Theme Switcher */}
          <LiquidButton
            variant="glass"
            size="icon"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="w-9 h-9 min-w-[36px] min-h-[36px]"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
          </LiquidButton>

          {/* User Profile Avatar */}
          {currentUser && (
            <div className="w-9 h-9 rounded-full liquid-pill flex items-center justify-center p-0.5 border border-emerald-400/40">
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
      {/* FLOATING RESULT CHIP (OVER MAP HERO STAGE) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {polygonMetrics && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto cursor-pointer"
            onClick={() => {
              // Cycle units: m2 -> sotix -> ha
              if (activeUnit === "m2") setActiveUnit("sotix");
              else if (activeUnit === "sotix") setActiveUnit("ha");
              else setActiveUnit("m2");
            }}
          >
            <div className="liquid-glass px-5 py-2.5 rounded-full flex items-center gap-3 shadow-[0_12px_36px_rgba(0,0,0,0.45)] border border-emerald-400/50 hover:scale-[1.02] transition-transform">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div className="flex items-baseline gap-1.5 font-mono">
                <span className="text-sm font-black text-[var(--accent)]">
                  {activeUnit === "m2"
                    ? `${formatNumber(polygonMetrics.areaM2)} m²`
                    : activeUnit === "sotix"
                    ? `${polygonMetrics.areaSotix.toFixed(2)} sotix`
                    : `${polygonMetrics.areaHectares.toFixed(4)} ha`}
                </span>
                <span className="text-[10px] text-[var(--muted-2)] font-sans">
                  ({tr(language, "tegish orqali birlikni o‘zgartiring", "нажмите для смены", "tap to switch unit")})
                </span>
              </div>
              <div className="text-[11px] font-mono text-[var(--blue)] font-bold pl-2 border-l border-white/15">
                {polygonMetrics.perimeterMeters.toFixed(1)} m
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* FULLSCREEN MAP BACKDROP (HERO STAGE) */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 z-10 w-full h-full">
        <InteractiveMap
          initialPoints={points}
          onPointsChange={setPoints}
          language={language}
          height="100%"
        />
      </div>

      {/* ========================================================================= */}
      {/* FLOATING MAP CONTROLS (THUMB RIGHT ACTION BAR) */}
      {/* ========================================================================= */}
      <div className="absolute right-3.5 top-28 z-20 flex flex-col gap-2 pointer-events-auto">
        {points.length > 0 && (
          <>
            <LiquidButton
              variant="glass"
              size="icon"
              onClick={handleUndoPoint}
              title="Oxirgi nuqtani bekor qilish"
              className="shadow-xl"
            >
              <Undo2 className="w-4.5 h-4.5 text-[var(--text)]" />
            </LiquidButton>
            <LiquidButton
              variant="danger"
              size="icon"
              onClick={handleClearPoints}
              title="Barcha nuqtalarni tozalash"
              className="shadow-xl"
            >
              <Trash2 className="w-4.5 h-4.5 text-white" />
            </LiquidButton>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* GESTURE DRAGGABLE LIQUID BOTTOM SHEET */}
      {/* ========================================================================= */}
      <LiquidBottomSheet
        points={points}
        onPointsChange={setPoints}
        language={language}
        currentUser={currentUser}
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        onClearPoints={handleClearPoints}
        onUndoPoint={handleUndoPoint}
        onLocateMe={() => {}}
        onFitBounds={() => {}}
        snapState={snapState}
        onSnapChange={setSnapState}
      />
    </div>
  );
}
