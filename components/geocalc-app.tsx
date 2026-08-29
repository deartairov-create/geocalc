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
  type LucideIcon,
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
    <div className="w-full h-[520px] liquid-glass flex flex-col items-center justify-center gap-3 text-[var(--muted)]">
      <Globe className="w-8 h-8 text-[var(--accent)] animate-spin" />
      <span className="text-sm font-semibold">Sun'iy yo'ldosh xaritasi yuklanmoqda...</span>
    </div>
  ),
});

type AppLanguage = "uz" | "ru" | "en";
function tr(l: AppLanguage, uz: string, ru: string, en: string) {
  return l === "ru" ? ru : l === "en" ? en : uz;
}

type ModuleId = "area" | "map" | "distance" | "converter" | "shapes" | "slope" | "volume" | "geoai" | "contacts" | "guide" | "history";

type HistoryRecord = { id: string; type: string; title: string; value: string; time: string; };

type NavItem = { id: ModuleId; label: string; icon: LucideIcon; badge?: string; };

function getNavItems(l: AppLanguage): NavItem[] {
  return [
    { id: "area",      label: tr(l, "Yuza hisoblash",   "Площадь",      "Area"),         icon: Calculator },
    { id: "map",       label: tr(l, "Interfaol xarita", "Карта",        "Map"),           icon: MapIcon,     badge: "GPS" },
    { id: "distance",  label: tr(l, "Masofa & Azimut",  "Азимут",       "Distance"),      icon: Compass,     badge: "PRO" },
    { id: "converter", label: tr(l, "Konvertor",        "Конвертер",    "Converter"),     icon: RefreshCw },
    { id: "shapes",    label: tr(l, "Shakllar",         "Фигуры",       "Shapes"),        icon: Triangle },
    { id: "slope",     label: tr(l, "Nishablik",        "Уклон",        "Slope"),         icon: TrendingUp },
    { id: "volume",    label: tr(l, "Hajm (Cut&Fill)",  "Объём",        "Volume"),        icon: BoxIcon },
    { id: "geoai",     label: "GeoAI",                                                     icon: Sparkles,    badge: "BETA · Tekin" },
    { id: "contacts",  label: tr(l, "Bog'lanish",       "Контакты",     "Contacts"),      icon: Phone },
    { id: "guide",     label: tr(l, "Qo'llanma",       "Справка",      "Guide"),         icon: Info },
    { id: "history",   label: tr(l, "Tarix",            "История",      "History"),       icon: History },
  ];
}

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

// ─── Liquid Glass UI Primitives ───────────────────────────────────────────────

function LiquidCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`liquid-glass ${className}`}>
      {children}
    </div>
  );
}

function StatChip({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex-1 min-w-0 p-3.5 liquid-pill text-center">
      <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-sm font-black truncate ${accent ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>{value}</div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: React.ReactNode; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl md:text-2xl font-black text-[var(--text)] tracking-tight flex items-center flex-wrap gap-2">{title}</h2>
      {subtitle && <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed font-medium">{subtitle}</p>}
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────

export default function GeoCalcApp() {
  const [language, setLanguage] = useState<AppLanguage>("uz");
  const [activeModule, setActiveModule] = useState<ModuleId>("area");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [historyList, setHistoryList] = useState<HistoryRecord[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Auth
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Area
  const [areaInput, setAreaInput] = useState(AREA_SAMPLE);
  const [areaPoints, setAreaPoints] = useState<GeoPoint[]>([]);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [areaMapView, setAreaMapView] = useState(true);

  // Distance
  const [distP1, setDistP1] = useState({ lat: "41.311081", lon: "69.240562" });
  const [distP2, setDistP2] = useState({ lat: "39.654700", lon: "66.975800" });
  const [distResult, setDistResult] = useState<AzimuthResult | null>(null);
  const [directStart, setDirectStart] = useState({ lat: "41.311081", lon: "69.240562" });
  const [directAz, setDirectAz] = useState("45");
  const [directDist, setDirectDist] = useState("1000");
  const [directResult, setDirectResult] = useState<GeoPoint | null>(null);

  // Converter
  const [convLat, setConvLat] = useState("41.311081");
  const [convLon, setConvLon] = useState("69.240562");
  const [batchIn, setBatchIn] = useState(AREA_SAMPLE);
  const [batchOut, setBatchOut] = useState("");

  // Shapes
  const [shapeType, setShapeType] = useState<"rect"|"tri"|"trap"|"circ"|"pit">("rect");
  const [sp, setSp] = useState<Record<string,number>>({ w:25,l:40,a:30,b:40,c:50,h:15,r:12,topArea:200,bottomArea:120,depth:3 });
  const [shapeResult, setShapeResult] = useState<Record<string,number>|null>(null);

  // Slope / Leveling
  const [slopeH, setSlopeH] = useState("2.5");
  const [slopeD, setSlopeD] = useState("100");
  const [slopeRes, setSlopeRes] = useState<SlopeResult | null>(null);
  const [bmVal, setBmVal] = useState("100.00");
  const [levelRows] = useState([
    { bs: 1.45, remark: "BM-1" }, { is: 1.20, remark: "0+00" }, { is: 1.65, remark: "0+50" },
    { fs: 2.10, bs: 1.35, remark: "TP-1" }, { fs: 0.95, remark: "TBM-2" },
  ]);
  const [levelTable, setLevelTable] = useState<LevelingStation[]>([]);

  // Volume
  const [volIn, setVolIn] = useState(VOLUME_SAMPLE);
  const [volCoord, setVolCoord] = useState<VolumeCoordinateMode>("local");
  const [volDesign, setVolDesign] = useState<VolumeDesignMode>("level");
  const [volLevel, setVolLevel] = useState("101.00");
  const [volResult, setVolResult] = useState<VolumeResult | null>(null);
  const [volError, setVolError] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const addHistory = (item: Omit<HistoryRecord, "id" | "time">) => {
    const rec = { ...item, id: Math.random().toString(36).slice(2,9), time: new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) };
    setHistoryList((prev) => { const next = [rec, ...prev.slice(0,49)]; try { localStorage.setItem("geocalc_history", JSON.stringify(next)); } catch {} return next; });
  };

  // Auth listener
  useEffect(() => {
    try {
      const unsub = onAuthStateChanged(firebaseAuth, (user) => { setCurrentUser(user); setIsAuthLoading(false); });
      return () => unsub();
    } catch { setIsAuthLoading(false); }
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(firebaseAuth, googleProvider);
      showToast(tr(language, "Muvaffaqiyatli kirdingiz!", "Вход выполнен!", "Signed in!"));
    } catch (e: any) { showToast(e.message || "Kirishda xatolik"); }
  };

  const handleSignOut = async () => {
    try { await signOut(firebaseAuth); showToast(tr(language, "Chiqildi", "Вышли", "Signed out")); }
    catch {}
  };

  // Theme
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);

  // Load history
  useEffect(() => { try { const s = localStorage.getItem("geocalc_history"); if (s) setHistoryList(JSON.parse(s)); } catch {} }, []);

  // Area parse
  useEffect(() => {
    try {
      if (!areaInput.trim()) { setAreaPoints([]); setAreaError(null); return; }
      setAreaPoints(parseCoordinates(areaInput)); setAreaError(null);
    } catch (e: any) { setAreaError(e.message || "Xatolik"); }
  }, [areaInput]);

  const areaProps = useMemo(() => {
    if (areaPoints.length < 3) return null;
    return calculatePolygonProperties(areaPoints);
  }, [areaPoints]);

  const handleMapPoints = (pts: GeoPoint[]) => {
    setAreaPoints(pts);
    setAreaInput(pts.map((p) => `${p.lat.toFixed(6)} ${p.lon.toFixed(6)}`).join("\n"));
  };

  // Shape calc
  useEffect(() => {
    try {
      if (shapeType==="rect") setShapeResult(SimpleShapes.rectangle(sp.w||0,sp.l||0) as any);
      else if (shapeType==="tri") setShapeResult(SimpleShapes.triangleHeron(sp.a||0,sp.b||0,sp.c||0) as any);
      else if (shapeType==="trap") setShapeResult(SimpleShapes.trapezoid(sp.a||0,sp.b||0,sp.h||0) as any);
      else if (shapeType==="circ") setShapeResult(SimpleShapes.circle(sp.r||0) as any);
      else if (shapeType==="pit") setShapeResult(SimpleShapes.pitVolume(sp.topArea||0,sp.bottomArea||0,sp.depth||0) as any);
    } catch { setShapeResult(null); }
  }, [shapeType, sp]);

  const navItems = getNavItems(language);

  // Nav Item
  const NavButton = ({ item }: { item: NavItem }) => {
    const isActive = activeModule === item.id;
    const Icon = item.icon;
    return (
      <button
        onClick={() => { setActiveModule(item.id); setIsSidebarOpen(false); }}
        className={`group w-full text-left px-4 py-3 rounded-full flex items-center gap-3 transition-all duration-200 ${
          isActive
            ? "liquid-btn-primary text-black shadow-lg"
            : "text-[var(--muted)] hover:bg-white/10 hover:text-[var(--text)]"
        }`}
      >
        <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? "text-black" : "text-[var(--muted-2)] group-hover:text-[var(--accent)]"}`} />
        <span className="text-xs font-bold flex-1 truncate">{item.label}</span>
        {item.badge && (
          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
            isActive ? "bg-black/25 text-black" : "bg-[var(--accent-soft)] text-[var(--accent)] border border-white/20"
          }`}>{item.badge}</span>
        )}
      </button>
    );
  };

  // Field
  const Field = ({ label, value, onChange, type = "text", placeholder = "" }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
  }) => (
    <div>
      <label className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-full bg-white/5 border border-[var(--border-glass)] text-[var(--text)] text-sm font-mono outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--muted-2)] shadow-inner" />
    </div>
  );

  const PrimaryBtn = ({ onClick, children, className = "" }: { onClick: () => void; children: React.ReactNode; className?: string }) => (
    <button onClick={onClick}
      className={`liquid-btn-primary flex items-center justify-center gap-2 px-6 py-3 text-sm ${className}`}>
      {children}
    </button>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--bg)] text-[var(--text)] selection:bg-[var(--accent)]/30 font-sans relative overflow-x-hidden">

      {/* Auth Gate */}
      <AuthGate currentUser={currentUser} isAuthLoading={isAuthLoading} onSignIn={handleSignIn} language={language} />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity:0, y:-16, scale:0.95 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:-16 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[9998] flex items-center gap-2 px-5 py-3 rounded-full liquid-glass text-[var(--accent)] text-xs font-bold shadow-2xl">
            <Check className="w-4 h-4" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row max-w-[1850px] mx-auto w-full">

        {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
        <aside className={`fixed md:static inset-y-0 left-0 z-50 w-[310px] flex flex-col liquid-glass rounded-none md:rounded-r-[36px] border-y-0 border-l-0 p-5 transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}>

          {/* Brand */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--blue)] flex items-center justify-center shadow-lg border border-white/50">
                <Globe className="w-6 h-6 text-black" />
              </div>
              <div>
                <div className="text-lg font-black text-[var(--text)] tracking-tight leading-tight flex items-center gap-1.5">
                  GeoCalc <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-white/20">PRO</span>
                </div>
                <div className="text-[11px] text-[var(--muted)] font-medium">Geodeziya & GeoAI</div>
              </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 rounded-full hover:bg-white/10 text-[var(--muted)]"><X className="w-5 h-5" /></button>
          </div>

          {/* User Profile */}
          <div className="mb-5 p-3 rounded-full liquid-pill">
            {currentUser ? (
              <div className="flex items-center gap-2.5 justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  {currentUser.photoURL ? (
                    <img src={currentUser.photoURL} alt="" className="w-8 h-8 rounded-full border border-white/50 object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-black font-black text-xs">
                      {currentUser.displayName?.[0] || "U"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate text-[var(--text)]">{currentUser.displayName || "Foydalanuvchi"}</div>
                    <div className="text-[10px] text-[var(--muted-2)] truncate">{currentUser.email}</div>
                  </div>
                </div>
                <button onClick={handleSignOut} title="Chiqish"
                  className="p-2 rounded-full text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-all flex-shrink-0">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button onClick={handleSignIn}
                className="w-full py-2 px-4 rounded-full liquid-btn-primary text-black text-xs font-bold flex items-center justify-center gap-2">
                <LogIn className="w-4 h-4" /> Google orqali kirish
              </button>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-1 overflow-y-auto">
            {navItems.map((item) => <NavButton key={item.id} item={item} />)}
          </nav>

          {/* Bottom Settings */}
          <div className="pt-4 mt-4 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center liquid-pill p-1">
                {(["uz","ru","en"] as AppLanguage[]).map((l) => (
                  <button key={l} onClick={() => setLanguage(l)}
                    className={`px-3 py-1 rounded-full text-[11px] font-black uppercase transition-all ${language===l ? "bg-white text-black shadow-sm" : "text-[var(--muted)] hover:text-[var(--text)]"}`}>
                    {l}
                  </button>
                ))}
              </div>
              <button onClick={() => setTheme(t => t==="dark"?"light":"dark")}
                className="p-2.5 rounded-full liquid-pill text-[var(--muted)] hover:text-[var(--text)] transition-all">
                {theme==="dark" ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-[var(--blue)]" />}
              </button>
            </div>
            <div className="text-center text-[11px] text-[var(--muted-2)] font-medium">
              Powered by <strong className="text-[var(--accent)]">Toirov Azizbek</strong>
            </div>
          </div>
        </aside>

        {isSidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setIsSidebarOpen(false)} />}

        {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto p-4 md:p-6 lg:p-8">

          {/* Top Mobile Bar */}
          <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 liquid-glass rounded-full mb-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 rounded-full text-[var(--text)]">
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-black text-sm flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-[var(--accent)]" /> GeoCalc PRO
            </span>
            <button onClick={() => setTheme(t => t==="dark"?"light":"dark")}
              className="p-2 rounded-full text-[var(--muted)]">
              {theme==="dark" ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-[var(--blue)]" />}
            </button>
          </div>

          <div className="flex-1 space-y-6">

          {/* ──────────── MODULE: AREA ──────────── */}
          {activeModule==="area" && (
            <div>
              <SectionHeader
                title={<><Calculator className="inline w-6 h-6 text-[var(--accent)] mr-2 mb-0.5" />{tr(language,"Yer maydonini aniq hisoblash","Расчёт площади участка","Precision Land Area Calculation")}</>}
                subtitle={tr(language,"WGS84 koordinatalarni kiriting yoki quyidagi sun'iy yo'ldosh xaritasida chizing.","Введите координаты WGS84 или нарисуйте участок на спутниковой карте.","Enter WGS84 coordinates or draw directly on the interactive satellite map.")}
              />

              <div className="flex items-center gap-2 mb-5 p-1 liquid-pill w-fit">
                {[{v:true,l:tr(language,"🗺️ Sun'iy yo'ldosh xarita","🗺️ Спутниковая карта","🗺️ Satellite Map")},{v:false,l:tr(language,"✏️ Matnli koordinatalar","✏️ Текст координат","✏️ Text coordinates")}].map(o=>(
                  <button key={String(o.v)} onClick={() => setAreaMapView(o.v)}
                    className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${areaMapView===o.v?"bg-white text-black shadow-md":"text-[var(--muted)] hover:text-[var(--text)]"}`}>
                    {o.l}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-4">
                  <LiquidCard className="p-6 space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-2">
                        {tr(language,"Koordinatalar (Kenglik Uzunlik)","Координаты (Широта Долгота)","Coordinates (Lat Lon)")}
                        <span className="ml-2 text-[var(--accent)] font-mono">({areaPoints.length} {tr(language,"nuqta","точек","points")})</span>
                      </label>
                      <textarea rows={7} value={areaInput} onChange={e=>setAreaInput(e.target.value)}
                        placeholder="41.311081 69.240562\n41.311081 69.241562\n..."
                        className="w-full px-4 py-3 rounded-[20px] bg-white/5 border border-[var(--border-glass)] font-mono text-xs text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors resize-y placeholder:text-[var(--muted-2)] shadow-inner" />
                    </div>
                    {areaError && <div className="px-4 py-2.5 rounded-full bg-[var(--danger-soft)] border border-[var(--danger)]/40 text-[var(--danger)] text-xs font-semibold">{areaError}</div>}
                    <div className="flex gap-2">
                      <button onClick={()=>setAreaInput(AREA_SAMPLE)} className="px-4 py-2 rounded-full liquid-pill text-xs font-bold text-[var(--muted)] hover:text-[var(--text)]">{tr(language,"Namuna","Пример","Sample")}</button>
                      <button onClick={()=>setAreaInput("")} className="px-4 py-2 rounded-full bg-[var(--danger-soft)] text-xs font-bold text-[var(--danger)] border border-[var(--danger)]/30">{tr(language,"Tozalash","Очистить","Clear")}</button>
                    </div>
                  </LiquidCard>

                  {areaProps && (
                    <div className="grid grid-cols-2 gap-3">
                      <StatChip label="Maydon (m²)" value={formatNumber(areaProps.areaM2)} accent />
                      <StatChip label="Sotix (Ar)" value={areaProps.areaSotix.toFixed(2)} />
                      <StatChip label="Gektar (ha)" value={areaProps.areaHectares.toFixed(4)+" ha"} />
                      <StatChip label="Perimetr" value={areaProps.perimeterMeters.toFixed(1)+" m"} />
                    </div>
                  )}
                </div>

                <div className="lg:col-span-7">
                  {areaMapView ? (
                    <InteractiveMap initialPoints={areaPoints} onPointsChange={handleMapPoints} language={language} height="540px" />
                  ) : (
                    <LiquidCard className="h-[540px] flex flex-col items-center justify-center text-center p-8 text-[var(--muted)]">
                      <Globe className="w-12 h-12 text-[var(--accent)] mb-3 opacity-60" />
                      <div className="text-sm font-semibold">{tr(language,"Xaritada ko'rish uchun yuqoridagi 'Sun'iy yo'ldosh xarita' tugmasini bosing.","Переключитесь на карту для интерактивного черчения.","Switch to satellite map to draw interactively.")}</div>
                    </LiquidCard>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ──────────── MODULE: MAP ──────────── */}
          {activeModule==="map" && (
            <div>
              <SectionHeader title={<><MapIcon className="inline w-6 h-6 text-[var(--accent)] mr-2 mb-0.5" />{tr(language,"To'liq ekranli Sun'iy yo'ldosh xaritasi","Спутниковая интерактивная карта","Full Satellite Interactive Map")}</>} />
              <InteractiveMap language={language} height="calc(100vh - 210px)" />
            </div>
          )}

          {/* ──────────── MODULE: DISTANCE ──────────── */}
          {activeModule==="distance" && (
            <div className="max-w-3xl space-y-6">
              <SectionHeader
                title={<><Compass className="inline w-6 h-6 text-[var(--accent)] mr-2 mb-0.5" />{tr(language,"Masofa, Azimut va Rumb","Расстояние, Азимут и Румб","Distance, Azimuth & Bearing")}</>}
                subtitle="Vincenty ellipsoidal formula — 0.5 mm geodezik aniqlik"
              />

              <LiquidCard className="p-6 md:p-8 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="text-xs font-black text-[var(--accent)] uppercase tracking-wider">{tr(language,"1-Boshlang'ich nuqta","Точка 1","Point 1")}</div>
                    <Field label="Lat" value={distP1.lat} onChange={v=>setDistP1({...distP1,lat:v})} />
                    <Field label="Lon" value={distP1.lon} onChange={v=>setDistP1({...distP1,lon:v})} />
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs font-black text-[var(--blue)] uppercase tracking-wider">{tr(language,"2-Oxirgi nuqta","Точка 2","Point 2")}</div>
                    <Field label="Lat" value={distP2.lat} onChange={v=>setDistP2({...distP2,lat:v})} />
                    <Field label="Lon" value={distP2.lon} onChange={v=>setDistP2({...distP2,lon:v})} />
                  </div>
                </div>
                <PrimaryBtn onClick={() => {
                  try {
                    const r = calculateVincentyDistanceAndAzimuth({lat:Number(distP1.lat),lon:Number(distP1.lon)},{lat:Number(distP2.lat),lon:Number(distP2.lon)});
                    setDistResult(r); addHistory({type:"distance",title:"Masofa & Azimut",value:`${r.distanceKm.toFixed(3)} km | ${r.initialAzimuthDeg.toFixed(2)}°`}); showToast("Hisoblandi!");
                  } catch(e:any){showToast(e.message);}
                }} className="w-full">
                  <Calculator className="w-4 h-4 text-black" /> {tr(language,"Hisoblash","Рассчитать","Calculate")}
                </PrimaryBtn>
                {distResult && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/10">
                    <StatChip label="Metr" value={distResult.distanceMeters.toFixed(1)+" m"} accent />
                    <StatChip label="Km" value={distResult.distanceKm.toFixed(3)+" km"} />
                    <StatChip label="Azimut" value={distResult.initialAzimuthDeg.toFixed(2)+"°"} />
                    <StatChip label="Rumb" value={distResult.rhumbString} />
                  </div>
                )}
              </LiquidCard>

              <LiquidCard className="p-6 md:p-8 space-y-4">
                <div className="text-xs font-black text-[var(--blue)] uppercase tracking-wider">{tr(language,"To'g'ri geodezik masala (Nuqta + Azimut + Masofa)","Прямая геодезическая задача","Direct Geodetic Problem")}</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start Lat" value={directStart.lat} onChange={v=>setDirectStart({...directStart,lat:v})} />
                  <Field label="Start Lon" value={directStart.lon} onChange={v=>setDirectStart({...directStart,lon:v})} />
                  <Field label="Azimut (°)" value={directAz} onChange={setDirectAz} />
                  <Field label="Masofa (m)" value={directDist} onChange={setDirectDist} />
                </div>
                <PrimaryBtn onClick={() => {
                  try {
                    const r = calculateDirectGeodeticPoint({lat:Number(directStart.lat),lon:Number(directStart.lon)},Number(directAz),Number(directDist));
                    setDirectResult(r); showToast("Yangi nuqta topildi!");
                  } catch(e:any){showToast(e.message);}
                }}>
                  <ChevronRight className="w-4 h-4 text-black" /> {tr(language,"Nuqta topish","Найти точку","Find Point")}
                </PrimaryBtn>
                {directResult && (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
                    <StatChip label="Lat" value={directResult.lat.toFixed(7)} accent />
                    <StatChip label="Lon" value={directResult.lon.toFixed(7)} accent />
                  </div>
                )}
              </LiquidCard>
            </div>
          )}

          {/* ──────────── MODULE: CONVERTER ──────────── */}
          {activeModule==="converter" && (
            <div className="max-w-3xl space-y-6">
              <SectionHeader title={<><RefreshCw className="inline w-6 h-6 text-[var(--accent)] mr-2 mb-0.5" />{tr(language,"Koordinatalar Konvertori","Конвертер координат","Coordinate Converter")}</>} />
              <LiquidCard className="p-6 md:p-8 space-y-5">
                <div className="text-xs font-black text-[var(--accent)] uppercase tracking-wider">O'nli gradus → DMS (GMS)</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Field label="Lat DD" value={convLat} onChange={setConvLat} />
                    <div className="text-xs font-mono font-bold text-[var(--accent)] mt-2 px-2">
                      {Number.isFinite(Number(convLat)) ? toDMS(Number(convLat),"lat") : "—"}
                    </div>
                  </div>
                  <div>
                    <Field label="Lon DD" value={convLon} onChange={setConvLon} />
                    <div className="text-xs font-mono font-bold text-[var(--accent)] mt-2 px-2">
                      {Number.isFinite(Number(convLon)) ? toDMS(Number(convLon),"lon") : "—"}
                    </div>
                  </div>
                </div>
              </LiquidCard>

              <LiquidCard className="p-6 md:p-8 space-y-4">
                <div className="text-xs font-black text-[var(--blue)] uppercase tracking-wider">Ommaviy (Batch) Ro'yxat Konvertori</div>
                <div className="grid grid-cols-2 gap-4">
                  <textarea rows={6} value={batchIn} onChange={e=>setBatchIn(e.target.value)}
                    className="w-full px-4 py-3 rounded-[20px] bg-white/5 border border-[var(--border-glass)] font-mono text-xs outline-none focus:border-[var(--accent)] resize-none shadow-inner" />
                  <textarea rows={6} readOnly value={batchOut} placeholder={tr(language,"Natijalar...","Результаты...","Results...")}
                    className="w-full px-4 py-3 rounded-[20px] bg-white/10 border border-[var(--border-glass)] font-mono text-xs text-[var(--accent)] resize-none outline-none shadow-inner" />
                </div>
                <PrimaryBtn onClick={() => {
                  try {
                    const pts = parseCoordinates(batchIn);
                    setBatchOut(pts.map((p,i)=>`#${i+1}: ${toDMS(p.lat,"lat")} | ${toDMS(p.lon,"lon")}`).join("\n"));
                    showToast("Konvertatsiya qilindi!");
                  } catch(e:any){showToast(e.message);}
                }}>Barchasini GMS ga o'girish</PrimaryBtn>
              </LiquidCard>
            </div>
          )}

          {/* ──────────── MODULE: SHAPES ──────────── */}
          {activeModule==="shapes" && (
            <div className="max-w-3xl space-y-6">
              <SectionHeader title={<><Triangle className="inline w-6 h-6 text-[var(--accent)] mr-2 mb-0.5" />{tr(language,"Sodda Geometrik Shakllar","Простые фигуры","Simple Shapes")}</>} />

              <div className="flex flex-wrap gap-2 p-1.5 liquid-pill w-fit">
                {[{v:"rect",l:tr(language,"To'rtburchak","Прямоугольник","Rectangle")},{v:"tri",l:tr(language,"Uchburchak","Треугольник","Triangle")},{v:"trap",l:tr(language,"Trapetsiya","Трапеция","Trapezoid")},{v:"circ",l:tr(language,"Doira","Окружность","Circle")},{v:"pit",l:tr(language,"Kotlovan","Котлован","Pit")}].map(s=>(
                  <button key={s.v} onClick={()=>setShapeType(s.v as any)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${shapeType===s.v?"bg-white text-black shadow-md":"text-[var(--muted)] hover:text-[var(--text)]"}`}>{s.l}</button>
                ))}
              </div>

              <LiquidCard className="p-6 md:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    {shapeType==="rect" && <><Field label="Eni a (m)" value={String(sp.w)} onChange={v=>setSp({...sp,w:Number(v)})} type="number" /><Field label="Bo'yi b (m)" value={String(sp.l)} onChange={v=>setSp({...sp,l:Number(v)})} type="number" /></>}
                    {shapeType==="tri" && <><Field label="a (m)" value={String(sp.a)} onChange={v=>setSp({...sp,a:Number(v)})} type="number" /><Field label="b (m)" value={String(sp.b)} onChange={v=>setSp({...sp,b:Number(v)})} type="number" /><Field label="c (m)" value={String(sp.c)} onChange={v=>setSp({...sp,c:Number(v)})} type="number" /></>}
                    {shapeType==="trap" && <><Field label="a (m)" value={String(sp.a)} onChange={v=>setSp({...sp,a:Number(v)})} type="number" /><Field label="b (m)" value={String(sp.b)} onChange={v=>setSp({...sp,b:Number(v)})} type="number" /><Field label="h (m)" value={String(sp.h)} onChange={v=>setSp({...sp,h:Number(v)})} type="number" /></>}
                    {shapeType==="circ" && <Field label="Radius R (m)" value={String(sp.r)} onChange={v=>setSp({...sp,r:Number(v)})} type="number" />}
                    {shapeType==="pit" && <><Field label="S1 (yuqori m²)" value={String(sp.topArea)} onChange={v=>setSp({...sp,topArea:Number(v)})} type="number" /><Field label="S2 (tub m²)" value={String(sp.bottomArea)} onChange={v=>setSp({...sp,bottomArea:Number(v)})} type="number" /><Field label="Chuqurlik H (m)" value={String(sp.depth)} onChange={v=>setSp({...sp,depth:Number(v)})} type="number" /></>}
                  </div>
                  <div className="flex flex-col justify-center space-y-3">
                    {shapeResult?.area != null && <StatChip label="Maydon" value={`${shapeResult.area} m² (${(shapeResult.area/100).toFixed(2)} sotix)`} accent />}
                    {shapeResult?.perimeter != null && <StatChip label="Perimetr" value={`${shapeResult.perimeter} m`} />}
                    {shapeResult?.volume != null && <StatChip label="Hajm" value={`${shapeResult.volume} m³`} />}
                  </div>
                </div>
              </LiquidCard>
            </div>
          )}

          {/* ──────────── MODULE: SLOPE ──────────── */}
          {activeModule==="slope" && (
            <div className="max-w-3xl space-y-6">
              <SectionHeader title={<><TrendingUp className="inline w-6 h-6 text-[var(--accent)] mr-2 mb-0.5" />{tr(language,"Nivelirlash va Nishablik","Нивелирование и Уклон","Leveling & Slope")}</>} />

              <LiquidCard className="p-6 md:p-8 space-y-4">
                <div className="text-xs font-black text-[var(--accent)] uppercase tracking-wider">1. Nishablikni hisoblash</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Δh (m)" value={slopeH} onChange={setSlopeH} type="number" />
                  <Field label="d (m)" value={slopeD} onChange={setSlopeD} type="number" />
                </div>
                <PrimaryBtn onClick={() => {
                  try { const r=calculateSlope(Number(slopeH),Number(slopeD)); setSlopeRes(r); addHistory({type:"slope",title:"Nishablik",value:`${r.slopePercent}%`}); showToast("Hisoblandi!"); }
                  catch(e:any){showToast(e.message);}
                }}>
                  <Calculator className="w-4 h-4 text-black" /> {tr(language,"Hisoblash","Рассчитать","Calculate")}
                </PrimaryBtn>
                {slopeRes && (
                  <div className="grid grid-cols-4 gap-2 pt-3 border-t border-white/10">
                    <StatChip label="%" value={slopeRes.slopePercent+"%"} accent />
                    <StatChip label="‰" value={slopeRes.slopePromille+"‰"} />
                    <StatChip label="°" value={slopeRes.slopeAngleDeg+"°"} />
                    <StatChip label="Nisbat" value={slopeRes.ratioString} />
                  </div>
                )}
              </LiquidCard>

              <LiquidCard className="p-6 md:p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black text-[var(--blue)] uppercase tracking-wider">2. Nivelirlash jurnali</div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--muted)] font-bold">Reper (BM):</span>
                    <input type="number" value={bmVal} onChange={e=>setBmVal(e.target.value)}
                      className="w-20 px-3 py-1.5 rounded-full bg-white/5 border border-[var(--border-glass)] text-xs font-mono outline-none focus:border-[var(--accent)]" />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left font-mono">
                    <thead>
                      <tr className="border-b border-white/10">
                        {["Nuqta","BS","IS","FS","HI","RL","Izoh"].map(h=>(
                          <th key={h} className="px-3 py-2.5 text-[var(--muted)] font-bold font-sans text-[10px] uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {levelTable.map(row=>(
                        <tr key={row.id} className="border-b border-white/5">
                          <td className="px-3 py-2 font-bold text-[var(--accent)]">{row.stationName}</td>
                          <td className="px-3 py-2">{row.backsight ?? "—"}</td>
                          <td className="px-3 py-2">{row.intermediate ?? "—"}</td>
                          <td className="px-3 py-2">{row.foresight ?? "—"}</td>
                          <td className="px-3 py-2 font-bold text-[var(--blue)]">{row.heightOfInstrument?.toFixed(3)}</td>
                          <td className="px-3 py-2 font-bold text-[var(--text)]">{row.reducedLevel?.toFixed(3)}</td>
                          <td className="px-3 py-2 text-[var(--muted-2)] font-sans">{row.remark ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <PrimaryBtn onClick={() => {
                  try { const r=solveDifferentialLeveling(Number(bmVal),levelRows); setLevelTable(r); showToast("Jurnal hisoblandi!"); }
                  catch(e:any){showToast(e.message);}
                }}>
                  <Calculator className="w-4 h-4 text-black" /> {tr(language,"Jurnalni hisoblash","Рассчитать журнал","Calculate Journal")}
                </PrimaryBtn>
              </LiquidCard>
            </div>
          )}

          {/* ──────────── MODULE: VOLUME ──────────── */}
          {activeModule==="volume" && (
            <div className="max-w-3xl space-y-6">
              <SectionHeader title={<><BoxIcon className="inline w-6 h-6 text-[var(--accent)] mr-2 mb-0.5" />{tr(language,"Yer ishlari hajmi (TIN Cut & Fill)","Объём Cut & Fill (TIN)","Volume Cut & Fill (TIN)")}</>} />

              <LiquidCard className="p-6 md:p-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--muted)] uppercase mb-1.5">{tr(language,"Koordinata turi","Координаты","Coord Type")}</label>
                    <select value={volCoord} onChange={e=>setVolCoord(e.target.value as any)}
                      className="w-full px-4 py-2.5 rounded-full bg-white/5 border border-[var(--border-glass)] text-xs text-[var(--text)] outline-none">
                      <option value="local">Metrik (X Y Z)</option>
                      <option value="wgs84">WGS84 (Lat Lon Z)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--muted)] uppercase mb-1.5">{tr(language,"Loyiha turi","Тип проекта","Design Mode")}</label>
                    <select value={volDesign} onChange={e=>setVolDesign(e.target.value as any)}
                      className="w-full px-4 py-2.5 rounded-full bg-white/5 border border-[var(--border-glass)] text-xs text-[var(--text)] outline-none">
                      <option value="level">Yagona sath</option>
                      <option value="per-point">Har bir nuqta</option>
                    </select>
                  </div>
                  {volDesign==="level" && <Field label="Loyiha sathi Z (m)" value={volLevel} onChange={setVolLevel} type="number" />}
                </div>

                <textarea rows={7} value={volIn} onChange={e=>setVolIn(e.target.value)}
                  className="w-full px-4 py-3 rounded-[20px] bg-white/5 border border-[var(--border-glass)] font-mono text-xs outline-none focus:border-[var(--accent)] resize-y shadow-inner" />

                {volError && <div className="px-4 py-2.5 rounded-full bg-[var(--danger-soft)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs font-semibold">{volError}</div>}

                <PrimaryBtn onClick={() => {
                  try {
                    const rows = parseVolumeRows(volIn,volCoord,volDesign,Number(volLevel));
                    const r = calculateCutFill(rows);
                    setVolResult(r); setVolError(null);
                    addHistory({type:"volume",title:"Cut & Fill",value:`Cut:${r.cut.toFixed(1)}m³ Fill:${r.fill.toFixed(1)}m³`});
                    showToast("Hajm hisoblandi!");
                  } catch(e:any){setVolError(e.message);setVolResult(null);}
                }} className="w-full">
                  <BoxIcon className="w-4 h-4 text-black" /> TIN bilan hisoblash
                </PrimaryBtn>

                {volResult && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/10">
                    <div className="p-3.5 rounded-full bg-[var(--danger-soft)] border border-[var(--danger)]/30 text-center">
                      <div className="text-[10px] font-bold text-[var(--danger)] uppercase mb-0.5">Qazish (Cut)</div>
                      <div className="text-base font-black text-[var(--danger)]">{volResult.cut.toFixed(2)} m³</div>
                    </div>
                    <div className="p-3.5 rounded-full bg-[var(--blue-soft)] border border-[var(--blue)]/30 text-center">
                      <div className="text-[10px] font-bold text-[var(--blue)] uppercase mb-0.5">To'kish (Fill)</div>
                      <div className="text-base font-black text-[var(--blue)]">{volResult.fill.toFixed(2)} m³</div>
                    </div>
                    <StatChip label="Sof hajm" value={(volResult.net>0?"+":"")+volResult.net.toFixed(2)+" m³"} />
                    <StatChip label="Plan maydon" value={volResult.planArea.toFixed(1)+" m²"} accent />
                  </div>
                )}
              </LiquidCard>
            </div>
          )}

          {/* ──────────── MODULE: GEOAI (BETA - TEKIN) ──────────── */}
          {activeModule==="geoai" && (
            <div className="flex flex-col h-[calc(100vh-140px)]">
              <SectionHeader
                title={
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-6 h-6 text-[var(--accent)]" />
                    <span>GeoAI</span>
                    <span className="text-xs font-black px-3 py-1 rounded-full liquid-btn-primary text-black shadow-md">
                      BETA · Hozircha tekin
                    </span>
                  </div>
                }
                subtitle={tr(
                  language,
                  "Har qanday savolga javob beruvchi, rasm va fayl tahlil qiladigan universal sun'iy intellekt yordamchi. BETA davrida barcha uchun mutlaqo bepul!",
                  "Универсальный AI-ассистент: ответы на любые вопросы, анализ изображений и файлов. В период BETA бесплатно для всех!",
                  "Universal AI assistant: answers any question, analyzes images and files. Completely free during BETA!"
                )}
              />
              <LiquidCard className="flex-1 overflow-hidden flex flex-col p-0">
                <GeoAIChat language={language} currentUser={currentUser} />
              </LiquidCard>
            </div>
          )}

          {/* ──────────── MODULE: CONTACTS ──────────── */}
          {activeModule==="contacts" && (
            <div className="max-w-2xl space-y-6">
              <SectionHeader title={<><Phone className="inline w-6 h-6 text-[var(--accent)] mr-2 mb-0.5" />{tr(language,"Bog'lanish va Muallif","Контакты автора","Author & Contacts")}</>} />

              <LiquidCard className="p-8 space-y-6">
                <div className="flex items-center gap-5 pb-6 border-b border-white/10">
                  <div className="w-18 h-18 rounded-full bg-gradient-to-br from-[var(--accent)] via-[#00e5ff] to-[var(--blue)] flex items-center justify-center text-2xl font-black text-black shadow-xl border border-white/60">
                    TA
                  </div>
                  <div>
                    <div className="text-xl font-black text-[var(--text)]">Toirov Azizbek</div>
                    <div className="text-xs text-[var(--accent)] font-bold mt-0.5">GeoCalc asoschisi va dasturchi muhandisi</div>
                    <div className="text-[11px] text-[var(--muted)] mt-1">Powered by Toirov Azizbek</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { href:"mailto:deartairov@gmail.com", icon:Mail, label:"Email", value:"deartairov@gmail.com", color:"var(--accent)" },
                    { href:"https://t.me/dearr5", icon:Send, label:"Telegram", value:"@dearr5", color:"var(--blue)" },
                    { href:"tel:+998958300142", icon:Phone, label:"Telefon", value:"+998 95 830-01-42", color:"var(--warning)" },
                  ].map(c=>(
                    <a key={c.label} href={c.href} target={c.href.startsWith("http")?"_blank":undefined} rel="noreferrer"
                      className="p-5 rounded-[24px] liquid-pill flex flex-col items-center text-center group transition-all">
                      <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform shadow-md" style={{color:c.color}}>
                        <c.icon className="w-5 h-5" />
                      </div>
                      <div className="text-[10px] text-[var(--muted)] uppercase font-black">{c.label}</div>
                      <div className="text-xs font-bold text-[var(--text)] mt-1 break-all">{c.value}</div>
                    </a>
                  ))}
                </div>
              </LiquidCard>
            </div>
          )}

          {/* ──────────── MODULE: GUIDE ──────────── */}
          {activeModule==="guide" && (
            <div className="max-w-3xl space-y-6">
              <SectionHeader title={<><Info className="inline w-6 h-6 text-[var(--accent)] mr-2 mb-0.5" />{tr(language,"Qo'llanma va Formulalar","Справка и формулы","User Guide & Formulas")}</>} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {t:"1. Maydon — WGS84 & UTM",c:"WGS84 koordinatalari UTM 41N/42N/43N zonalariga proyeksiyalanib, Gauss-Krüger formulasi orqali hisoblanadi.",col:"accent"},
                  {t:"2. Vincenty Masofa va Azimut",c:"Ellipsoidal formula orqali ikki nuqta orasidagi masofa va azimut 0.5 mm aniqlikda hisoblanadi.",col:"blue"},
                  {t:"3. TIN Cut & Fill Hajmi",c:"Delaunay triangulyatsiyasi orqali tuproq qazish va to'kish hajmi 3D prizmalar yordamida aniqlanadi.",col:"warning"},
                ].map(g=>(
                  <LiquidCard key={g.t} className="p-6 space-y-2">
                    <div className={`text-sm font-black ${g.col==="accent"?"text-[var(--accent)]":g.col==="blue"?"text-[var(--blue)]":"text-[var(--warning)]"}`}>{g.t}</div>
                    <p className="text-xs text-[var(--muted)] leading-relaxed font-medium">{g.c}</p>
                  </LiquidCard>
                ))}
              </div>
            </div>
          )}

          {/* ──────────── MODULE: HISTORY ──────────── */}
          {activeModule==="history" && (
            <div className="max-w-3xl space-y-4">
              <div className="flex items-center justify-between mb-4">
                <SectionHeader title={<><History className="inline w-6 h-6 text-[var(--accent)] mr-2 mb-0.5" />{tr(language,"Hisob-kitoblar tarixi","История расчётов","Calculations History")}</>} />
                {historyList.length>0 && (
                  <button onClick={()=>{setHistoryList([]);localStorage.removeItem("geocalc_history");showToast("Tarix tozalandi!");}}
                    className="px-4 py-2 rounded-full bg-[var(--danger-soft)] border border-[var(--danger)]/30 text-xs text-[var(--danger)] font-bold">{tr(language,"Tozalash","Очистить","Clear")}</button>
                )}
              </div>
              <div className="space-y-2.5">
                {historyList.length>0 ? historyList.map(item=>(
                  <div key={item.id} className="px-5 py-4 rounded-full liquid-pill flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black text-[var(--accent)] uppercase">{item.title}</div>
                      <div className="text-sm font-bold text-[var(--text)] font-mono mt-0.5">{item.value}</div>
                    </div>
                    <div className="text-[11px] text-[var(--muted-2)] font-mono flex-shrink-0">{item.time}</div>
                  </div>
                )) : (
                  <LiquidCard className="p-12 text-center text-sm text-[var(--muted)] font-medium">
                    {tr(language,"Hali hech qanday hisob-kitob saqlanmagan","История пуста","No history yet")}
                  </LiquidCard>
                )}
              </div>
            </div>
          )}

          </div>

          {/* ── FOOTER (POWERED BY TOIROV AZIZBEK) ─────────────────────────── */}
          <footer className="mt-12 px-6 py-8 border-t border-white/10 flex flex-col items-center gap-3 text-center">
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--muted)] font-semibold">
              <a href="mailto:deartairov@gmail.com" className="hover:text-[var(--accent)] transition-colors flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[var(--accent)]" /> deartairov@gmail.com
              </a>
              <span>·</span>
              <a href="https://t.me/dearr5" target="_blank" rel="noreferrer" className="hover:text-[var(--blue)] transition-colors flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-[var(--blue)]" /> @dearr5
              </a>
              <span>·</span>
              <a href="tel:+998958300142" className="hover:text-[var(--warning)] transition-colors flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[var(--warning)]" /> +998 95 830-01-42
              </a>
            </div>
            <div className="text-sm font-black text-[var(--text)]">
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
