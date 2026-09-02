"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  Box as BoxIcon,
  Calculator,
  Check,
  ChevronRight,
  Compass,
  Globe,
  History,
  Info,
  LogIn,
  LogOut,
  Mail,
  Map as MapIcon,
  Menu,
  Moon,
  Phone,
  RefreshCw,
  Send,
  Sparkles,
  Sun,
  TrendingUp,
  Triangle,
  X,
  Copy,
  Download,
  Trash2,
  Undo2,
  Crosshair,
  Award,
  BookOpen,
  Sprout,
  Navigation,
  FileSpreadsheet,
  Activity,
  Layers,
  Plus,
  Play,
  Square,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { onAuthStateChanged, signInWithPopup, signOut, type User as FirebaseUser } from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/lib/firebase-client";

import {
  calculateAccurateArea,
  calculateMetricPerimeter,
  formatNumber,
  parseCoordinates,
  toDMS,
  type GeoPoint,
} from "@/lib/legacy-geometry";

import {
  calculateCutFill,
  parseVolumeRows,
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
} from "@/lib/geodesy-advanced";

import GeoAIChat from "@/components/geoai-chat";
import AuthGate from "@/components/auth-gate";

const InteractiveMap = dynamic(() => import("@/components/interactive-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] rounded-3xl bg-black/60 border border-white/10 flex flex-col items-center justify-center gap-3 text-slate-400">
      <Globe className="w-8 h-8 text-emerald-400 animate-spin" />
      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Web-GIS Xaritasi yuklanmoqda...</span>
    </div>
  ),
});

type AppLanguage = "uz" | "ru" | "en";
function tr(l: AppLanguage, uz: string, ru: string, en: string) {
  return l === "ru" ? ru : l === "en" ? en : uz;
}

export type ModuleId =
  | "area"
  | "distance"
  | "converter"
  | "cadastre"
  | "gps_tracker"
  | "shapes"
  | "slope"
  | "volume"
  | "geoai"
  | "guide"
  | "contacts"
  | "history";

type HistoryRecord = { id: string; type: string; title: string; value: string; time: string };

const AREA_SAMPLE = "41.311081 69.240562\n41.311081 69.241562\n41.310281 69.241562\n41.310281 69.240562";
const VOLUME_SAMPLE = "0 0 100.40\n40 0 101.10\n80 0 99.90\n0 40 100.80\n40 40 102.20\n80 40 100.30\n0 80 99.60\n40 80 101.40\n80 80 100.00";

export default function MasterGeoCalc() {
  const [language, setLanguage] = useState<AppLanguage>("uz");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activeModule, setActiveModule] = useState<ModuleId>("area");
  const [historyList, setHistoryList] = useState<HistoryRecord[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [points, setPoints] = useState<GeoPoint[]>([
    { lat: 41.311081, lon: 69.240562 },
    { lat: 41.311081, lon: 69.241562 },
    { lat: 41.310281, lon: 69.241562 },
    { lat: 41.310281, lon: 69.240562 },
  ]);
  const [mapMode, setMapMode] = useState<"polygon" | "distance" | "pinpoint">("polygon");
  const [baseLayer, setBaseLayer] = useState<"satellite" | "osm" | "dark">("satellite");
  const [unitMode, setUnitMode] = useState<"m2" | "sotix" | "ha">("m2");

  const [areaInput, setAreaInput] = useState(AREA_SAMPLE);
  const [areaError, setAreaError] = useState<string | null>(null);

  const [distP1, setDistP1] = useState({ lat: "41.311081", lon: "69.240562" });
  const [distP2, setDistP2] = useState({ lat: "39.654700", lon: "66.975800" });
  const [distResult, setDistResult] = useState<AzimuthResult | null>(null);

  const [convLat, setConvLat] = useState("41.311081");
  const [convLon, setConvLon] = useState("69.240562");

  const [cadastreArea, setCadastreArea] = useState("50");
  const [cadastrePricePerSotix, setCadastrePricePerSotix] = useState("2500");
  const [cropType, setCropType] = useState<"cotton" | "wheat" | "orchard" | "greenhouse">("greenhouse");

  const [isTracking, setIsTracking] = useState(false);
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);
  const [currentGpsPos, setCurrentGpsPos] = useState<{ lat: number; lon: number; acc: number; speed: number; alt: number } | null>(null);
  const [gpsTrackLog, setGpsTrackLog] = useState<GeoPoint[]>([]);

  const [shapeType, setShapeType] = useState<"rect" | "tri" | "trap" | "circ">("rect");
  const [sp, setSp] = useState<Record<string, number>>({ w: 25, l: 40, a: 30, b: 40, c: 50, h: 15, r: 12 });
  const [shapeResult, setShapeResult] = useState<Record<string, number> | null>(null);

  const [slopeH, setSlopeH] = useState("2.5");
  const [slopeD, setSlopeD] = useState("100");
  const [slopeRes, setSlopeRes] = useState<SlopeResult | null>(null);

  const [volIn, setVolIn] = useState(VOLUME_SAMPLE);
  const [volCoord, setVolCoord] = useState<VolumeCoordinateMode>("local");
  const [volDesign, setVolDesign] = useState<VolumeDesignMode>("level");
  const [volLevel, setVolLevel] = useState("101.00");
  const [volResult, setVolResult] = useState<VolumeResult | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const addHistory = (item: Omit<HistoryRecord, "id" | "time">) => {
    const rec = {
      ...item,
      id: Math.random().toString(36).slice(2, 9),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setHistoryList((prev) => {
      const next = [rec, ...prev.slice(0, 49)];
      try { localStorage.setItem("geocalc_history", JSON.stringify(next)); } catch {}
      return next;
    });
  };

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
      showToast(tr(language, "Muvaffaqiyatli kirdingiz!", "Вход выполнен!", "Signed in!"));
    } catch (e: any) {
      showToast(e.message || "Kirishda xatolik");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(firebaseAuth);
      showToast(tr(language, "Chiqildi", "Вышли", "Signed out"));
    } catch {}
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    try {
      const s = localStorage.getItem("geocalc_history");
      if (s) setHistoryList(JSON.parse(s));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (!areaInput.trim()) { setAreaError(null); return; }
      const parsed = parseCoordinates(areaInput);
      setPoints(parsed);
      setAreaError(null);
    } catch (e: any) {
      setAreaError(e.message || "Xatolik");
    }
  }, [areaInput]);

  const handleMapPointsChange = (pts: GeoPoint[]) => {
    setPoints(pts);
    setAreaInput(pts.map((p) => p.lat.toFixed(6) + " " + p.lon.toFixed(6)).join("\n"));
  };

  const polygonMetrics = useMemo(() => {
    if (points.length < 3) return null;
    return calculatePolygonProperties(points);
  }, [points]);

  useEffect(() => {
    try {
      if (shapeType === "rect") setShapeResult(SimpleShapes.rectangle(sp.w || 0, sp.l || 0) as any);
      else if (shapeType === "tri") setShapeResult(SimpleShapes.triangleHeron(sp.a || 0, sp.b || 0, sp.c || 0) as any);
      else if (shapeType === "trap") setShapeResult(SimpleShapes.trapezoid(sp.a || 0, sp.b || 0, sp.h || 0) as any);
      else if (shapeType === "circ") setShapeResult(SimpleShapes.circle(sp.r || 0) as any);
    } catch {
      setShapeResult(null);
    }
  }, [shapeType, sp]);

  const cadastreMetrics = useMemo(() => {
    const areaSotixVal = parseFloat(cadastreArea) || 0;
    const priceVal = parseFloat(cadastrePricePerSotix) || 0;
    const totalLandValue = areaSotixVal * priceVal;
    const areaHectaresVal = areaSotixVal / 100;

    let expectedYieldTons = 0;
    let expectedRevenueUSD = 0;
    let waterUsageM3 = 0;

    if (cropType === "cotton") {
      expectedYieldTons = areaHectaresVal * 3.8;
      expectedRevenueUSD = expectedYieldTons * 800;
      waterUsageM3 = areaHectaresVal * 6500;
    } else if (cropType === "wheat") {
      expectedYieldTons = areaHectaresVal * 6.2;
      expectedRevenueUSD = expectedYieldTons * 320;
      waterUsageM3 = areaHectaresVal * 4200;
    } else if (cropType === "orchard") {
      expectedYieldTons = areaHectaresVal * 22;
      expectedRevenueUSD = expectedYieldTons * 1100;
      waterUsageM3 = areaHectaresVal * 5500;
    } else if (cropType === "greenhouse") {
      expectedYieldTons = areaHectaresVal * 120;
      expectedRevenueUSD = expectedYieldTons * 1400;
      waterUsageM3 = areaHectaresVal * 7500;
    }

    const estimatedTaxUZS = areaHectaresVal * 1450000;

    return { totalLandValue, areaHectaresVal, expectedYieldTons, expectedRevenueUSD, waterUsageM3, estimatedTaxUZS };
  }, [cadastreArea, cadastrePricePerSotix, cropType]);

  const toggleGpsTracking = () => {
    if (isTracking) {
      if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
      setIsTracking(false);
      setGpsWatchId(null);
      showToast("GPS kuzatuv to‘xtatildi");
    } else {
      if (!navigator.geolocation) {
        showToast("GPS qo‘llab-quvvatlanmaydi");
        return;
      }
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = parseFloat(pos.coords.latitude.toFixed(6));
          const lon = parseFloat(pos.coords.longitude.toFixed(6));
          const acc = Math.round(pos.coords.accuracy);
          const speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
          const alt = pos.coords.altitude ? Math.round(pos.coords.altitude) : 0;
          setCurrentGpsPos({ lat, lon, acc, speed, alt });
          const newPt: GeoPoint = { lat, lon };
          setGpsTrackLog((prev) => [...prev, newPt]);
          setPoints((prev) => [...prev, newPt]);
        },
        (err) => showToast("GPS xatosi: " + err.message),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 },
      );
      setGpsWatchId(id);
      setIsTracking(true);
      showToast("GPS o‘lchash boshlandi! Maydon bo‘ylab yuring.");
    }
  };

  const modulesList = [
    { id: "area", label: tr(language, "Maydon hisoblash", "Площадь участка", "Land Area"), icon: Calculator, badge: "WGS84" },
    { id: "distance", label: tr(language, "Masofa & Azimut", "Азимут и расстояние", "Distance & Azimuth"), icon: Compass, badge: "PRO" },
    { id: "converter", label: tr(language, "Koordinata Konvertor", "Конвертер координат", "Converter"), icon: RefreshCw },
    { id: "cadastre", label: tr(language, "Kadastr & Hosildorlik", "Кадастр и урожай", "Cadastre & Yield"), icon: Sprout, badge: "YANGI" },
    { id: "gps_tracker", label: tr(language, "Jonli GPS O‘lchash", "Живой GPS замер", "Live GPS Walk"), icon: Navigation, badge: "LIVE" },
    { id: "shapes", label: tr(language, "Geometrik Shakllar", "Геометрические фигуры", "Simple Shapes"), icon: Triangle },
    { id: "slope", label: tr(language, "Nivelirlash & Nishablik", "Нивелирование", "Leveling & Slope"), icon: TrendingUp },
    { id: "volume", label: tr(language, "Yer ishlari (TIN Hajm)", "Объём Cut & Fill", "TIN Cut & Fill"), icon: BoxIcon },
    { id: "geoai", label: "GeoAI BETA", icon: Sparkles, badge: "TEKIN" },
    { id: "guide", label: tr(language, "Qo‘llanma & Formulalar", "Справка и формулы", "Formulas & Guide"), icon: BookOpen },
    { id: "contacts", label: tr(language, "Muallif & Aloqa", "Контакты автора", "Author Contacts"), icon: Phone },
    { id: "history", label: tr(language, "Hisoblar Tarixi", "История расчётов", "History"), icon: History },
  ];

  return (
    <div className="w-full h-[100dvh] max-h-[100dvh] overflow-hidden bg-[var(--bg)] text-[var(--text)] font-sans select-none flex flex-col">
      <AuthGate currentUser={currentUser} isAuthLoading={isAuthLoading} onSignIn={handleSignIn} language={language} />

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-full liquid-glass text-emerald-400 text-xs font-black shadow-2xl flex items-center gap-2 border border-emerald-400/50">
            <Check className="w-4 h-4 text-emerald-400" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP CONTROL HUB */}
      <header className="h-14 px-4 bg-black/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between flex-shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg border border-white/40">
            <Globe className="w-5 h-5 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-tight text-white">GeoCalc</span>
              <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">PRO v3.5</span>
            </div>
            <div className="text-[10px] text-neutral-400 font-medium hidden sm:block">WGS-84 & O‘zDSt Sertifikatlangan Geodeziya Veb-GIS</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="liquid-pill p-0.5 flex items-center">
            {(["uz", "ru", "en"] as AppLanguage[]).map((l) => (
              <button key={l} onClick={() => setLanguage(l)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase transition-all ${language === l ? "bg-white text-black shadow-sm" : "text-[var(--muted)]"}`}>{l}</button>
            ))}
          </div>
          <button onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="w-8 h-8 rounded-full liquid-pill flex items-center justify-center text-[var(--muted)]">
            {theme === "dark" ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-blue-400" />}
          </button>
          {currentUser ? (
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <div className="w-8 h-8 rounded-full liquid-pill p-0.5 border border-emerald-400/50">
                {currentUser.photoURL ? <img src={currentUser.photoURL} alt="" className="w-full h-full rounded-full object-cover" /> :
                  <span className="text-xs font-black text-emerald-400 flex items-center justify-center h-full">{currentUser.displayName?.[0] || "U"}</span>}
              </div>
              <button onClick={handleSignOut} title="Chiqish" className="text-neutral-400 hover:text-red-400 p-1"><LogOut className="w-4 h-4" /></button>
            </div>
          ) : (
            <button onClick={handleSignIn} className="px-3 py-1.5 rounded-full bg-emerald-500 text-black font-extrabold text-xs flex items-center gap-1.5"><LogIn className="w-3.5 h-3.5" /> Kirish</button>
          )}
        </div>
      </header>

      {/* MODULES NAVIGATION RIBBON */}
      <div className="h-11 px-3 bg-black/60 backdrop-blur-sm border-b border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0 z-20">
        {modulesList.map((m) => {
          const Icon = m.icon;
          const isActive = activeModule === m.id;
          return (
            <button key={m.id} onClick={() => setActiveModule(m.id as ModuleId)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                isActive ? "bg-emerald-500 text-black shadow-md scale-[1.02]" : "bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
              }`}>
              <Icon className="w-3.5 h-3.5" />
              <span>{m.label}</span>
              {m.badge && <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase ${isActive ? "bg-black/30 text-black" : "bg-emerald-500/20 text-emerald-400"}`}>{m.badge}</span>}
            </button>
          );
        })}
      </div>

      {/* MAIN DUAL WORKSPACE */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
        {/* LEFT STATION (Scrollable) */}
        <aside className="w-full lg:w-[480px] xl:w-[540px] h-full overflow-y-auto p-4 md:p-5 bg-[#0a0a0a]/90 backdrop-blur-md border-r border-white/10 flex flex-col gap-4 z-20 flex-shrink-0">

          {/* MODULE 1: AREA */}
          {activeModule === "area" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2"><Calculator className="w-5 h-5 text-emerald-400" /> Yer Maydoni (WGS84 & UTM)</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">Gauss-Krüger proyeksiyasi orqali aniq hisoblanadi</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setAreaInput(AREA_SAMPLE)} className="px-2.5 py-1 rounded-lg bg-white/5 text-[11px] font-bold text-neutral-300 hover:bg-white/10">Namuna</button>
                  <button onClick={() => { setPoints([]); setAreaInput(""); }} className="px-2.5 py-1 rounded-lg bg-red-500/20 text-[11px] font-bold text-red-400 hover:bg-red-500/30">Tozalash</button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Koordinatalar (Lat Lon) — <span className="text-emerald-400 font-mono">{points.length} ta nuqta</span></label>
                <textarea rows={5} value={areaInput} onChange={(e) => setAreaInput(e.target.value)}
                  placeholder="41.311081 69.240562\n..." className="w-full px-3.5 py-2.5 rounded-2xl bg-white/5 border border-white/10 font-mono text-xs text-white outline-none focus:border-emerald-400 resize-y" />
              </div>
              {areaError && <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">{areaError}</div>}
              {polygonMetrics && (
                <div className="grid grid-cols-2 gap-2.5 font-mono">
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                    <div className="text-[10px] font-bold text-emerald-400 uppercase">Maydon (m²)</div>
                    <div className="text-lg font-black text-emerald-400 mt-0.5">{formatNumber(polygonMetrics.areaM2)} m²</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <div className="text-[10px] font-bold text-neutral-400 uppercase">Sotix (Ar)</div>
                    <div className="text-lg font-black text-white mt-0.5">{polygonMetrics.areaSotix.toFixed(2)} sotix</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <div className="text-[10px] font-bold text-neutral-400 uppercase">Gektar (ha)</div>
                    <div className="text-lg font-black text-white mt-0.5">{polygonMetrics.areaHectares.toFixed(4)} ha</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <div className="text-[10px] font-bold text-neutral-400 uppercase">Perimetr</div>
                    <div className="text-lg font-black text-blue-400 mt-0.5">{polygonMetrics.perimeterMeters.toFixed(1)} m</div>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => { const text = points.map((p) => p.lat.toFixed(6) + " " + p.lon.toFixed(6)).join("\n"); navigator.clipboard.writeText(text); showToast("Nusxalandi!"); }}
                  className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-xs font-extrabold text-white flex items-center justify-center gap-1.5"><Copy className="w-4 h-4" /> Nusxalash</button>
                <button onClick={() => { const geojson = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [points.map(p => [p.lon, p.lat]).concat([[points[0].lon, points[0].lat]])] }, properties: { areaM2: polygonMetrics?.areaM2 || 0 } }] }; const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "geocalc_polygon.geojson"; a.click(); showToast("GeoJSON yuklab olindi!"); }}
                  className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-xs font-black text-black flex items-center justify-center gap-1.5"><Download className="w-4 h-4" /> GeoJSON Eksport</button>
              </div>
            </div>
          )}

          {/* MODULE 2: DISTANCE */}
          {activeModule === "distance" && (
            <div className="space-y-4 font-mono">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2"><Compass className="w-5 h-5 text-blue-400" /> Vincenty Geodezik Masofa & Azimut</h2>
                <p className="text-xs text-neutral-400 mt-0.5">WGS-84 ellipsoidi bo‘yicha 0.5 mm millimetrik aniqlikda</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="text-xs font-bold text-emerald-400 uppercase">1-Nuqta</div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" inputMode="decimal" placeholder="Lat 1" value={distP1.lat} onChange={(e) => setDistP1({ ...distP1, lat: e.target.value })} className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white" />
                  <input type="text" inputMode="decimal" placeholder="Lon 1" value={distP1.lon} onChange={(e) => setDistP1({ ...distP1, lon: e.target.value })} className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white" />
                </div>
                <div className="text-xs font-bold text-blue-400 uppercase">2-Nuqta</div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" inputMode="decimal" placeholder="Lat 2" value={distP2.lat} onChange={(e) => setDistP2({ ...distP2, lat: e.target.value })} className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white" />
                  <input type="text" inputMode="decimal" placeholder="Lon 2" value={distP2.lon} onChange={(e) => setDistP2({ ...distP2, lon: e.target.value })} className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white" />
                </div>
                <button onClick={() => { try { const res = calculateVincentyDistanceAndAzimuth({ lat: parseFloat(distP1.lat), lon: parseFloat(distP1.lon) }, { lat: parseFloat(distP2.lat), lon: parseFloat(distP2.lon) }); setDistResult(res); addHistory({ type: "distance", title: "Masofa & Azimut", value: res.distanceKm.toFixed(3) + " km | " + res.initialAzimuthDeg.toFixed(2) + "°" }); showToast("Masofa va Azimut hisoblandi!"); } catch (e: any) { showToast(e.message); } }}
                  className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-black text-xs flex items-center justify-center gap-1.5"><Compass className="w-4 h-4" /> Vincenty Formula bilan hisoblash</button>
                {distResult && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                    <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-[10px] text-neutral-400 font-bold">Masofa (m)</div><div className="text-sm font-black text-emerald-400">{distResult.distanceMeters.toFixed(1)} m</div></div>
                    <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-[10px] text-neutral-400 font-bold">Masofa (km)</div><div className="text-sm font-black text-white">{distResult.distanceKm.toFixed(3)} km</div></div>
                    <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-[10px] text-neutral-400 font-bold">Boshlang‘ich Azimut</div><div className="text-sm font-black text-blue-400">{distResult.initialAzimuthDeg.toFixed(2)}°</div></div>
                    <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-[10px] text-neutral-400 font-bold">Rumb</div><div className="text-sm font-black text-amber-400">{distResult.rhumbString}</div></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODULE 3: CONVERTER */}
          {activeModule === "converter" && (
            <div className="space-y-4 font-mono">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2"><RefreshCw className="w-5 h-5 text-amber-400" /> Koordinata Konvertori (DD ↔ DMS)</h2>
                <p className="text-xs text-neutral-400 mt-0.5">O‘nli gradus va GMS o‘zaro aylantirish</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-400">Lat (DD)</label>
                    <input type="text" inputMode="decimal" value={convLat} onChange={(e) => setConvLat(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white" />
                    <div className="text-xs font-bold text-emerald-400 mt-1">{toDMS(parseFloat(convLat) || 0, "lat")}</div>
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400">Lon (DD)</label>
                    <input type="text" inputMode="decimal" value={convLon} onChange={(e) => setConvLon(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white" />
                    <div className="text-xs font-bold text-emerald-400 mt-1">{toDMS(parseFloat(convLon) || 0, "lon")}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 4: CADASTRE (YANGI) */}
          {activeModule === "cadastre" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2"><Sprout className="w-5 h-5 text-emerald-400" /> Kadastr & Qishloq Xo‘jaligi Yer Kalkulyatori</h2>
                <p className="text-xs text-neutral-400 mt-0.5">Yer bahosi, ekin hosildorligi, suv sarfi va soliq me’yori</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 font-mono">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-400">Maydon (Sotixda)</label>
                    <input type="number" value={cadastreArea} onChange={(e) => setCadastreArea(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white" />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400">1 Sotix Bahosi ($)</label>
                    <input type="number" value={cadastrePricePerSotix} onChange={(e) => setCadastrePricePerSotix(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 font-sans">
                  {[ { id: "cotton", l: "Paxtachilik" }, { id: "wheat", l: "G‘allachilik" }, { id: "orchard", l: "Meva bog‘i" }, { id: "greenhouse", l: "Issiqxona" } ].map((c) => (
                    <button key={c.id} onClick={() => setCropType(c.id as any)} className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${cropType === c.id ? "bg-emerald-500 text-black shadow-md" : "bg-white/5 text-neutral-400 hover:text-white"}`}>{c.l}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center"><div className="text-[9px] font-bold text-emerald-400 uppercase">Yer Bahosi</div><div className="text-sm font-black text-emerald-400">${formatNumber(cadastreMetrics.totalLandValue)}</div></div>
                  <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-[9px] font-bold text-neutral-400 uppercase">Kutilgan Hosil</div><div className="text-sm font-black text-white">{cadastreMetrics.expectedYieldTons.toFixed(1)} tonna</div></div>
                  <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-[9px] font-bold text-neutral-400 uppercase">Suv Sarfi (m³)</div><div className="text-sm font-black text-blue-400">{formatNumber(cadastreMetrics.waterUsageM3)} m³</div></div>
                  <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-[9px] font-bold text-neutral-400 uppercase">Yillik Yer Solig‘i</div><div className="text-sm font-black text-amber-400">{formatNumber(cadastreMetrics.estimatedTaxUZS)} so‘m</div></div>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 5: GPS TRACKER (YANGI) */}
          {activeModule === "gps_tracker" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2"><Navigation className="w-5 h-5 text-cyan-400" /> Jonli GPS O‘lchash (Walk & Measure)</h2>
                <p className="text-xs text-neutral-400 mt-0.5">Maydon chegarasi bo‘ylab yurganda nuqtalar avtomatik yoziladi</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 font-mono">
                <button onClick={toggleGpsTracking} className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${isTracking ? "bg-red-500 hover:bg-red-400 text-white shadow-lg animate-pulse" : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg"}`}>{isTracking ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}{isTracking ? "GPS O‘lchashni to‘xtatish" : "Jonli GPS O‘lchashni boshlash"}</button>
                {currentGpsPos && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10 text-center">
                    <div className="p-2.5 rounded-xl bg-white/5"><div className="text-[9px] text-neutral-400">Aniqlik</div><div className="text-xs font-bold text-emerald-400">±{currentGpsPos.acc} m</div></div>
                    <div className="p-2.5 rounded-xl bg-white/5"><div className="text-[9px] text-neutral-400">Tezlik</div><div className="text-xs font-bold text-white">{currentGpsPos.speed} km/h</div></div>
                    <div className="p-2.5 rounded-xl bg-white/5"><div className="text-[9px] text-neutral-400">Balandlik</div><div className="text-xs font-bold text-blue-400">{currentGpsPos.alt} m</div></div>
                    <div className="p-2.5 rounded-xl bg-white/5"><div className="text-[9px] text-neutral-400">Yozilgan</div><div className="text-xs font-bold text-amber-400">{gpsTrackLog.length} nuqta</div></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODULE 6: SHAPES */}
          {activeModule === "shapes" && (
            <div className="space-y-4 font-mono">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2"><Triangle className="w-5 h-5 text-indigo-400" /> Sodda Geometrik Shakllar</h2>
                <p className="text-xs text-neutral-400 mt-0.5">To‘rtburchak, Heron uchburchagi, trapetsiya va doira</p>
              </div>
              <div className="flex flex-wrap gap-1 p-1 rounded-2xl bg-white/5 border border-white/10 font-sans">
                {[ { id: "rect", l: "To‘rtburchak" }, { id: "tri", l: "Uchburchak" }, { id: "trap", l: "Trapetsiya" }, { id: "circ", l: "Doira" } ].map((s) => (
                  <button key={s.id} onClick={() => setShapeType(s.id as any)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === s.id ? "bg-white text-black shadow-md" : "text-neutral-400 hover:text-white"}`}>{s.l}</button>
                ))}
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                {shapeType === "rect" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-[10px] text-neutral-400">Eni a (m)</label><input type="number" value={sp.w} onChange={(e) => setSp({ ...sp, w: parseFloat(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white" /></div>
                    <div><label className="text-[10px] text-neutral-400">Bo‘yi b (m)</label><input type="number" value={sp.l} onChange={(e) => setSp({ ...sp, l: parseFloat(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white" /></div>
                  </div>
                )}
                {shapeResult && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-center">
                    {shapeResult.area !== undefined && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30"><div className="text-[9px] font-bold text-emerald-400">Maydon</div><div className="text-sm font-black text-emerald-400">{shapeResult.area} m² ({(shapeResult.area / 100).toFixed(2)} sotix)</div></div>}
                    {shapeResult.perimeter !== undefined && <div className="p-3 rounded-xl bg-white/5"><div className="text-[9px] font-bold text-neutral-400">Perimetr</div><div className="text-sm font-black text-white">{shapeResult.perimeter} m</div></div>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODULE 7: SLOPE */}
          {activeModule === "slope" && (
            <div className="space-y-4 font-mono">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2"><TrendingUp className="w-5 h-5 text-teal-400" /> Nivelirlash & Nishablik</h2>
                <p className="text-xs text-neutral-400 mt-0.5">Balandlik ayirmasi, qiyalik foizi va stansiya hisoblari</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-[10px] text-neutral-400">Balandlik Δh (m)</label><input type="number" value={slopeH} onChange={(e) => setSlopeH(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white" /></div>
                  <div><label className="text-[10px] text-neutral-400">Masofa d (m)</label><input type="number" value={slopeD} onChange={(e) => setSlopeD(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white" /></div>
                </div>
                <button onClick={() => { const r = calculateSlope(parseFloat(slopeH), parseFloat(slopeD)); setSlopeRes(r); addHistory({ type: "slope", title: "Nishablik", value: r.slopePercent + "%" }); showToast("Hisoblandi!"); }} className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-black font-black text-xs">Hisoblash</button>
                {slopeRes && (
                  <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-white/10 text-center">
                    <div className="p-2 rounded-xl bg-white/5"><div className="text-[8px] text-neutral-400">%</div><div className="text-xs font-bold text-emerald-400">{slopeRes.slopePercent}%</div></div>
                    <div className="p-2 rounded-xl bg-white/5"><div className="text-[8px] text-neutral-400">‰</div><div className="text-xs font-bold text-white">{slopeRes.slopePromille}‰</div></div>
                    <div className="p-2 rounded-xl bg-white/5"><div className="text-[8px] text-neutral-400">°</div><div className="text-xs font-bold text-blue-400">{slopeRes.slopeAngleDeg}°</div></div>
                    <div className="p-2 rounded-xl bg-white/5"><div className="text-[8px] text-neutral-400">Nisbat</div><div className="text-xs font-bold text-amber-400">{slopeRes.ratioString}</div></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODULE 8: VOLUME */}
          {activeModule === "volume" && (
            <div className="space-y-4 font-mono">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2"><BoxIcon className="w-5 h-5 text-rose-400" /> Yer Ishlari Hajmi (TIN Cut & Fill)</h2>
                <p className="text-xs text-neutral-400 mt-0.5">Delaunay triangulyatsiyasi orqali tuproq hajmi</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <textarea rows={4} value={volIn} onChange={(e) => setVolIn(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white resize-none" />
                <button onClick={() => { try { const rows = parseVolumeRows(volIn, volCoord, volDesign, parseFloat(volLevel)); const r = calculateCutFill(rows); setVolResult(r); addHistory({ type: "volume", title: "TIN Cut & Fill", value: "Cut:" + r.cut.toFixed(1) + "m³ | Fill:" + r.fill.toFixed(1) + "m³" }); showToast("Hajm hisoblandi!"); } catch (e: any) { showToast(e.message); } }} className="w-full py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs">TIN Hajmini hisoblash</button>
                {volResult && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center">
                    <div className="p-2 rounded-xl bg-red-500/15 border border-red-500/30"><div className="text-[8px] text-red-400">Qazish (Cut)</div><div className="text-xs font-black text-red-400">{volResult.cut.toFixed(1)} m³</div></div>
                    <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/30"><div className="text-[8px] text-blue-400">To‘kish (Fill)</div><div className="text-xs font-black text-blue-400">{volResult.fill.toFixed(1)} m³</div></div>
                    <div className="p-2 rounded-xl bg-white/5"><div className="text-[8px] text-neutral-400">Plan m²</div><div className="text-xs font-black text-emerald-400">{volResult.planArea.toFixed(0)} m²</div></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODULE 9: GEOAI */}
          {activeModule === "geoai" && (
            <div className="h-[560px] rounded-3xl overflow-hidden liquid-glass flex flex-col border border-white/15">
              <GeoAIChat language={language} currentUser={currentUser} />
            </div>
          )}


          {/* MODULE 11: GUIDE */}
          {activeModule === "guide" && (
            <div className="space-y-4 text-xs font-mono">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2"><BookOpen className="w-5 h-5 text-cyan-400" /> Formula Qo‘llanmasi</h2>
                <p className="text-xs text-neutral-400 mt-0.5 font-sans">Geodezik formulalar va matematik modellar</p>
              </div>
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1"><div className="font-bold text-emerald-400 font-sans">1. Gauss Maydon Formulasi</div><div className="text-neutral-300">{"S = 0.5 * |Σ (X_i * (Y_i+1 - Y_i-1))|"}</div></div>
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1"><div className="font-bold text-blue-400 font-sans">2. Nishablik Formulasi</div><div className="text-neutral-300">{"i = (Δh / d) * 100% | α = arctan(Δh / d)"}</div></div>
              </div>
            </div>
          )}

          {/* MODULE 12: CONTACTS */}
          {activeModule === "contacts" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2"><Phone className="w-5 h-5 text-emerald-400" /> Muallif & Aloqa</h2>
                <p className="text-xs text-neutral-400 mt-0.5">Rasmiy ishlab chiquvchi va qo‘llab-quvvatlash</p>
              </div>
              <div className="p-5 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-black font-black text-base flex items-center justify-center shadow-lg">TA</div>
                  <div>
                    <div className="text-base font-black text-white">Toirov Azizbek</div>
                    <div className="text-xs text-emerald-400 font-bold">GeoCalc Asoschisi & Dasturchi</div>
                    <div className="text-[10px] text-neutral-400">Powered by Toirov Azizbek</div>
                  </div>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <a href="mailto:deartairov@gmail.com" className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center gap-2 text-white block">✉️ deartairov@gmail.com</a>
                  <a href="https://t.me/dearr5" target="_blank" rel="noreferrer" className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center gap-2 text-blue-400 block">✈️ Telegram: @dearr5</a>
                  <a href="tel:+998958300142" className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center gap-2 text-amber-400 block">📞 +998 95 830-01-42</a>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 13: HISTORY */}
          {activeModule === "history" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2"><History className="w-5 h-5 text-amber-400" /> Hisob-kitoblar Tarixi</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">Avtomatik saqlangan amallar</p>
                </div>
                {historyList.length > 0 && (
                  <button onClick={() => { setHistoryList([]); localStorage.removeItem("geocalc_history"); showToast("Tarix tozalandi"); }} className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold">Tozalash</button>
                )}
              </div>
              <div className="space-y-2">
                {historyList.length > 0 ? (
                  historyList.map((h) => (
                    <div key={h.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between font-mono text-xs">
                      <div><div className="text-[10px] text-emerald-400 font-bold uppercase">{h.title}</div><div className="text-white font-bold mt-0.5">{h.value}</div></div>
                      <div className="text-[10px] text-neutral-400">{h.time}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 rounded-2xl bg-white/5 text-center text-xs text-neutral-400">Hozircha hech qanday hisob saqlanmagan</div>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* RIGHT WORKSPACE: INTERACTIVE MAP CANVAS */}
        <main className="flex-1 h-full min-h-[350px] relative overflow-hidden bg-black">
          <div className="w-full h-full">
            <InteractiveMap initialPoints={points} onPointsChange={handleMapPointsChange} language={language} mode={mapMode} baseLayer={baseLayer} hideInternalHUD={true} />
          </div>

          {/* FLOATING RESULT BADGE */}
          {polygonMetrics && (
            <div onClick={() => { if (unitMode === "m2") setUnitMode("sotix"); else if (unitMode === "sotix") setUnitMode("ha"); else setUnitMode("m2"); }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-20 cursor-pointer liquid-pill px-5 py-2.5 flex items-center gap-3 shadow-2xl border border-emerald-400/50 hover:scale-[1.02] transition-transform">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <div className="font-mono text-sm font-black text-emerald-400">
                {unitMode === "m2" ? formatNumber(polygonMetrics.areaM2) + " m²" : unitMode === "sotix" ? polygonMetrics.areaSotix.toFixed(2) + " sotix" : polygonMetrics.areaHectares.toFixed(4) + " ha"}
              </div>
              <div className="font-mono text-xs text-blue-400 font-bold pl-2 border-l border-white/20">{polygonMetrics.perimeterMeters.toFixed(1)} m</div>
            </div>
          )}

          {/* RIGHT TOOLBAR: LAYERS, UNDO, CLEAR */}
          <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
            <button onClick={() => { setBaseLayer(b => b === "satellite" ? "osm" : b === "osm" ? "dark" : "satellite"); showToast("Qatlam almashtirildi"); }}
              className="w-11 h-11 rounded-2xl liquid-pill flex items-center justify-center text-white shadow-xl hover:scale-105 transition-transform" title="Qatlam">
              <Layers className="w-5 h-5 text-emerald-400" />
            </button>
            {points.length > 0 && (
              <>
                <button onClick={() => setPoints(p => p.slice(0, -1))} className="w-11 h-11 rounded-2xl liquid-pill flex items-center justify-center text-white shadow-xl hover:scale-105 transition-transform" title="Qaytarish">
                  <Undo2 className="w-5 h-5 text-white" />
                </button>
                <button onClick={() => { setPoints([]); setAreaInput(""); }} className="w-11 h-11 rounded-2xl bg-red-500/80 text-white flex items-center justify-center shadow-xl hover:scale-105 transition-transform" title="Tozalash">
                  <Trash2 className="w-5 h-5 text-white" />
                </button>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}