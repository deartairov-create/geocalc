"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FirebaseError } from "firebase/app";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  ArrowRight,
  Bot,
  Box as BoxIcon,
  Calculator,
  Check,
  ChevronRight,
  ClipboardCopy,
  Copy,
  Download,
  FileText,
  History,
  Image as ImageIcon,
  Info,
  Layers3,
  LoaderCircle,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Moon,
  Mountain,
  Paperclip,
  RefreshCw,
  Ruler,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Triangle,
  Upload,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  GEOAI_CONTACT_TEXT,
  type GeoAIAttachment,
} from "@/lib/geoai";
import { firebaseAuth, googleProvider } from "@/lib/firebase-client";

type ModuleId =
  | "area"
  | "converter"
  | "volume"
  | "geoai"
  | "guide"
  | "history";

type HistoryRecord = {
  id: string;
  type: string;
  value: string;
  date: string;
};

type NavItem = {
  id: ModuleId;
  label: string;
  hint: string;
  icon: LucideIcon;
  beta?: boolean;
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

const CONTACT_MARKER = GEOAI_CONTACT_TEXT.split("\n")[0];

const NAV_ITEMS: NavItem[] = [
  {
    id: "area",
    label: "Yuza hisoblash",
    hint: "WGS84 · m² · gektar",
    icon: Calculator,
  },
  {
    id: "converter",
    label: "Konvertor",
    hint: "O‘nli ↔ GMS",
    icon: RefreshCw,
  },
  {
    id: "volume",
    label: "Hajm hisoblash",
    hint: "TIN · Cut & Fill",
    icon: BoxIcon,
  },
  {
    id: "geoai",
    label: "GeoAI",
    hint: "Hozircha tekin",
    icon: Bot,
    beta: true,
  },
  {
    id: "guide",
    label: "Qo‘llanma",
    hint: "Sodda tushuntirish",
    icon: FileText,
  },
  {
    id: "history",
    label: "Tarix",
    hint: "Oxirgi natijalar",
    icon: History,
  },
];

const MODULE_META: Record<ModuleId, { eyebrow: string; title: string; description: string }> = {
  area: {
    eyebrow: "WGS84 MAYDON KALKULYATORI",
    title: "Yer maydonini tez va aniq hisoblang",
    description:
      "Koordinatalarni kiriting — GeoCalc shaklni tekshiradi va natijani barcha kerakli birliklarda beradi.",
  },
  converter: {
    eyebrow: "KOORDINATA KONVERTORI",
    title: "Formatlar orasida xatosiz o‘ting",
    description:
      "O‘nli gradus va gradus–minut–sekund qiymatlarini ikki tomonga o‘giring.",
  },
  volume: {
    eyebrow: "TIN · CUT & FILL",
    title: "Relyef hajmini muvozanat bilan hisoblang",
    description:
      "Mavjud va loyiha balandliklari orasidagi qazish hamda to‘ldirish hajmini TIN yuzasi bo‘yicha oling.",
  },
  geoai: {
    eyebrow: "GEOAI · BETA",
    title: "Geodezik savollaringizga bir joyda javob",
    description:
      "KML, CSV, DXF, koordinatalar yoki rasmdagi jadvalni yuboring — GeoAI tahlil qilishga yordam beradi.",
  },
  guide: {
    eyebrow: "QO‘LLANMA",
    title: "Birinchi natijagacha uchta sodda qadam",
    description:
      "Koordinata formatlari, hisoblash usullari va ishonchli natija olish bo‘yicha qisqa yo‘riqnoma.",
  },
  history: {
    eyebrow: "QURILMADAGI TARIX",
    title: "So‘nggi hisoblaringiz",
    description:
      "Natijalar faqat shu brauzerda saqlanadi va istalgan payt tozalanadi.",
  },
};

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function saveTextFile(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function copyToClipboard(value: string) {
  await navigator.clipboard.writeText(value);
}

function ContactCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "contact-card contact-card--compact" : "contact-card"}>
      <p>
        Xizmat, murojaat, shikoyat, qonunbuzarliklar va takliflar uchun mening
        Hojayinimning kontaktlari:
      </p>
      <div className="contact-links">
        <a href="mailto:deartairov@gmail.com">
          <Mail size={15} /> deartairov@gmail.com
        </a>
        <a href="https://t.me/dearr5" target="_blank" rel="noreferrer">
          <MessageCircle size={15} /> @dearr5
        </a>
        <a href="tel:+998958300142">
          <span className="phone-symbol">☎</span> +998(95)830-01-42
        </a>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="logo-lockup">
      <div className="logo-glyph" aria-hidden="true">
        <MapPin size={23} strokeWidth={2.2} />
        <span>G</span>
      </div>
      <div>
        <strong>GeoCalc</strong>
        <span>Geodeziya sodda tilda</span>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="google-mark">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.37l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.92A6.02 6.02 0 0 1 6.07 12c0-.67.12-1.32.32-1.92V7.46H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.54l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.82 1.5l2.88-2.88A9.67 9.67 0 0 0 12 2a10 10 0 0 0-8.96 5.46l3.35 2.62C7.18 7.71 9.39 5.95 12 5.95Z" />
    </svg>
  );
}

function AuthScreen({
  checking,
  busy,
  error,
  onSignIn,
}: {
  checking: boolean;
  busy: boolean;
  error: string;
  onSignIn: () => void;
}) {
  return (
    <main className="auth-shell">
      <motion.section
        className="auth-panel"
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <Logo />
        <div className="auth-badge"><ShieldCheck size={15} /> Himoyalangan ish maydoni</div>
        <div className="auth-copy">
          <p className="eyebrow"><span /> GEODEZIYA SODDA TILDA</p>
          <h1>GeoCalc hisoblariga Google orqali kiring</h1>
          <p>
            Maydon, koordinata, Cut &amp; Fill va GeoAI vositalari bitta zamonaviy
            ish maydonida.
          </p>
        </div>

        <button
          className="google-signin"
          type="button"
          onClick={onSignIn}
          disabled={checking || busy}
        >
          {checking || busy ? <LoaderCircle className="spin" size={21} /> : <GoogleMark />}
          {checking ? "Hisob tekshirilmoqda…" : busy ? "Google ochilmoqda…" : "Google orqali kirish"}
        </button>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <div className="auth-features" aria-label="GeoCalc imkoniyatlari">
          <span><Calculator size={15} /> Aniq maydon</span>
          <span><Mountain size={15} /> Cut &amp; Fill</span>
          <span><Bot size={15} /> GeoAI</span>
        </div>
        <p className="auth-privacy">
          Kirish orqali hisobingiz aniqlanadi. Gemini kaliti brauzerga yuborilmaydi.
        </p>
      </motion.section>
    </main>
  );
}

function AppSidebar({
  active,
  onSelect,
  open,
  onClose,
  theme,
  onToggleTheme,
  user,
  onSignOut,
}: {
  active: ModuleId;
  onSelect: (id: ModuleId) => void;
  open: boolean;
  onClose: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  user: FirebaseUser;
  onSignOut: () => void;
}) {
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.button
            className="sidebar-backdrop"
            aria-label="Menyuni yopish"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <aside className={`app-sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-head">
          <Logo />
          <button className="icon-button sidebar-close" onClick={onClose} aria-label="Yopish">
            <X size={20} />
          </button>
        </div>

        <nav className="main-nav" aria-label="Asosiy bo‘limlar">
          <p className="nav-kicker">ASBOBLAR</p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${active === item.id ? "is-active" : ""}`}
                onClick={() => {
                  onSelect(item.id);
                  onClose();
                }}
              >
                <span className="nav-icon">
                  <Icon size={19} />
                </span>
                <span className="nav-copy">
                  <span className="nav-label-row">
                    <strong>{item.label}</strong>
                    {item.beta && <span className="beta-pill">BETA</span>}
                  </span>
                  <small>{item.hint}</small>
                </span>
                <ChevronRight size={16} className="nav-chevron" />
              </button>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />
        <ContactCard compact />

        <div className="sidebar-foot">
          <div className="account-card">
            {user.photoURL ? (
              // Google profile photos use dynamic URLs, so a plain image is intentional here.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="account-fallback">{(user.displayName || user.email || "G").charAt(0).toUpperCase()}</span>
            )}
            <div>
              <strong>{user.displayName || "GeoCalc foydalanuvchisi"}</strong>
              <span>{user.email || "Google hisob"}</span>
            </div>
            <button type="button" onClick={onSignOut} aria-label="Hisobdan chiqish" title="Hisobdan chiqish">
              <LogOut size={16} />
            </button>
          </div>
          <button className="theme-toggle" onClick={onToggleTheme}>
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            {theme === "dark" ? "Yorug‘ rejim" : "Tungi rejim"}
          </button>
        </div>
      </aside>
    </>
  );
}

function ModuleHeader({ module }: { module: ModuleId }) {
  const meta = MODULE_META[module];
  return (
    <header className="module-header">
      <div>
        <p className="eyebrow">
          <span /> {meta.eyebrow}
        </p>
        <h1>{meta.title}</h1>
        <p className="module-description">{meta.description}</p>
      </div>
      <div className="precision-badge">
        <span className="precision-dot" />
        <div>
          <strong>WGS84</strong>
          <small>Aniq yadro faol</small>
        </div>
      </div>
    </header>
  );
}

function PolygonPreview({ points }: { points: GeoPoint[] }) {
  const canvasPoints = useMemo(
    () => (points.length >= 2 ? projectPointsToCanvas(points, 720, 400, 50) : []),
    [points],
  );
  const polygon = canvasPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="map-preview" aria-label="Kiritilgan shakl ko‘rinishi">
      <div className="preview-label">
        <span className="live-dot" /> JONLI SHAKL
      </div>
      {canvasPoints.length < 2 ? (
        <div className="preview-empty">
          <Triangle size={34} />
          <strong>Shakl shu yerda ko‘rinadi</strong>
          <span>Kamida 2 ta to‘g‘ri koordinata kiriting</span>
        </div>
      ) : (
        <svg viewBox="0 0 720 400" role="img" aria-label={`${points.length} nuqtali poligon`}>
          <defs>
            <pattern id="area-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" className="grid-path" fill="none" />
            </pattern>
            <linearGradient id="polygon-fill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#37e6bd" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#4aa9ff" stopOpacity="0.13" />
            </linearGradient>
          </defs>
          <rect width="720" height="400" fill="url(#area-grid)" />
          <motion.polygon
            points={polygon}
            fill={points.length >= 3 ? "url(#polygon-fill)" : "none"}
            className="polygon-line"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
          {canvasPoints.map((point, index) => (
            <g key={`${point.x}-${point.y}-${index}`}>
              <circle cx={point.x} cy={point.y} r="11" className="point-halo" />
              <circle cx={point.x} cy={point.y} r="5" className="point-dot" />
              <text x={point.x + 12} y={point.y - 12} className="point-label">
                {index + 1}
              </text>
            </g>
          ))}
        </svg>
      )}
      <div className="preview-compass" aria-hidden="true">
        <span>N</span>
        <ArrowRight size={17} />
      </div>
    </div>
  );
}

type AreaAnswer = {
  areaM2: number;
  areaHa: number;
  areaKm2: number;
  perimeter: number;
  points: number;
};

function areaErrorMessage(error: unknown) {
  if (!(error instanceof CoordinateParseError)) {
    return error instanceof Error ? error.message : "Koordinatalarni tekshiring.";
  }
  const messages: Record<CoordinateParseError["code"], string> = {
    incomplete: "ikki koordinata to‘liq kiritilmagan",
    "invalid-number": "son noto‘g‘ri kiritilgan",
    "invalid-latitude": "kenglik −90…90 oralig‘ida emas",
    "invalid-longitude": "uzunlik −180…180 oralig‘ida emas",
  };
  return `${error.line}-qator: ${messages[error.code]}.`;
}

function AreaCalculator({
  onHistory,
  notify,
}: {
  onHistory: (type: string, value: string) => void;
  notify: (message: string) => void;
}) {
  const [value, setValue] = useState(AREA_SAMPLE);
  const [answer, setAnswer] = useState<AreaAnswer | null>(null);
  const [error, setError] = useState("");

  const previewPoints = useMemo(() => {
    try {
      return value.trim() ? parseCoordinates(value) : [];
    } catch {
      return [];
    }
  }, [value]);

  const calculate = () => {
    setError("");
    try {
      const points = parseCoordinates(value.trim());
      if (points.length < 3) {
        setAnswer(null);
        setError("Yuza hisoblash uchun kamida 3 ta nuqta kerak.");
        return;
      }
      const areaM2 = calculateAccurateArea(points);
      const next = {
        areaM2,
        areaHa: areaM2 / 10_000,
        areaKm2: areaM2 / 1_000_000,
        perimeter: calculateMetricPerimeter(points),
        points: points.length,
      };
      setAnswer(next);
      onHistory(
        "Yuza",
        `${formatNumber(next.areaHa)} ha · ${formatNumber(next.areaM2)} m²`,
      );
    } catch (caught) {
      setAnswer(null);
      setError(areaErrorMessage(caught));
    }
  };

  const answerText = answer
    ? `GeoCalc natijasi\nMaydon: ${formatNumber(answer.areaHa)} gektar\n${formatNumber(answer.areaM2)} m²\n${formatNumber(answer.areaKm2)} km²\nPerimetr: ${formatNumber(answer.perimeter)} m\nNuqtalar: ${answer.points}`
    : "";

  return (
    <div className="workspace-grid workspace-grid--area">
      <section className="panel input-panel">
        <div className="panel-head">
          <div>
            <span className="step-chip">01</span>
            <div>
              <h2>Koordinatalarni kiriting</h2>
              <p>Avval kenglik, keyin uzunlik. Har nuqta — yangi qatorda.</p>
            </div>
          </div>
          <button
            className="text-button"
            onClick={() => {
              setValue(AREA_SAMPLE);
              setError("");
              setAnswer(null);
            }}
          >
            <WandSparkles size={16} /> Namuna qo‘yish
          </button>
        </div>

        <div className="format-hint">
          <span>TO‘G‘RI FORMAT</span>
          <code>41.311081, 69.240562</code>
        </div>

        <label className="field-label" htmlFor="area-coordinates">
          Nuqtalar ro‘yxati <small>{previewPoints.length || 0} ta o‘qildi</small>
        </label>
        <textarea
          id="area-coordinates"
          className="data-textarea"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setAnswer(null);
            setError("");
          }}
          spellCheck={false}
          placeholder="41.311081 69.240562"
        />

        {error && (
          <motion.div className="inline-error" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
            <Info size={17} /> {error}
          </motion.div>
        )}

        <div className="action-row">
          <button className="primary-button" onClick={calculate}>
            Hisoblash <ArrowRight size={18} />
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setValue("");
              setAnswer(null);
              setError("");
            }}
          >
            <Trash2 size={17} /> Tozalash
          </button>
        </div>
      </section>

      <section className="panel preview-panel">
        <div className="panel-head panel-head--simple">
          <div>
            <span className="step-chip">02</span>
            <div>
              <h2>Shaklni tekshiring</h2>
              <p>Nuqtalar kiritilgan ketma-ketlikda ulanadi.</p>
            </div>
          </div>
        </div>
        <PolygonPreview points={previewPoints} />
      </section>

      <AnimatePresence>
        {answer && (
          <motion.section
            className="result-panel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <div className="result-main">
              <span>ASOSIY NATIJA</span>
              <strong>{formatNumber(answer.areaHa)}</strong>
              <small>gektar</small>
            </div>
            <div className="result-stats">
              <div><span>Maydon</span><strong>{formatNumber(answer.areaM2)} m²</strong></div>
              <div><span>Kilometr kvadrat</span><strong>{formatNumber(answer.areaKm2)} km²</strong></div>
              <div><span>Perimetr</span><strong>{formatNumber(answer.perimeter)} m</strong></div>
              <div><span>Nuqtalar</span><strong>{answer.points} ta</strong></div>
            </div>
            <div className="result-actions">
              <button
                className="secondary-button"
                onClick={async () => {
                  await copyToClipboard(answerText);
                  notify("Natija nusxalandi");
                }}
              >
                <Copy size={17} /> Nusxa olish
              </button>
              <button
                className="secondary-button"
                onClick={() => saveTextFile("geocalc-maydon-natijasi.txt", answerText)}
              >
                <Download size={17} /> Yuklab olish
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function Converter({
  onHistory,
  notify,
}: {
  onHistory: (type: string, value: string) => void;
  notify: (message: string) => void;
}) {
  const [decimal, setDecimal] = useState("41.311081");
  const [coordinateType, setCoordinateType] = useState<"lat" | "lon">("lat");
  const [dmsAnswer, setDmsAnswer] = useState("-");
  const [degrees, setDegrees] = useState("41");
  const [minutes, setMinutes] = useState("18");
  const [seconds, setSeconds] = useState("39.8916");
  const [hemisphere, setHemisphere] = useState<"E" | "W" | "N" | "S">("N");
  const [decimalAnswer, setDecimalAnswer] = useState("-");
  const [error, setError] = useState("");

  const convertToDms = () => {
    try {
      const numeric = Number(decimal);
      const result = toDMS(numeric, coordinateType);
      setDmsAnswer(result);
      setError("");
      onHistory("O‘nli → GMS", `${decimal} → ${result}`);
    } catch {
      setDmsAnswer("-");
      setError("O‘nli qiymatni tekshiring.");
    }
  };

  const convertToDecimal = () => {
    try {
      const result = fromDMS(
        Number(degrees),
        Number(minutes),
        Number(seconds),
        hemisphere,
      );
      const value = trimTrailingZeros(result.toFixed(10));
      setDecimalAnswer(value);
      setError("");
      onHistory(
        "GMS → O‘nli",
        `${degrees}° ${minutes}' ${seconds}" ${hemisphere} → ${value}`,
      );
    } catch (caught) {
      setDecimalAnswer("-");
      setError(caught instanceof Error ? caught.message : "Qiymatlarni tekshiring.");
    }
  };

  return (
    <div className="converter-layout">
      <section className="panel converter-card">
        <div className="converter-card-icon"><RefreshCw size={22} /></div>
        <div className="converter-title">
          <span>01</span>
          <div><h2>O‘nli gradus → GMS</h2><p>Masalan: 41.311081 → 41° 18′ 39.8916″ N</p></div>
        </div>
        <div className="form-grid form-grid--two">
          <label className="form-field">
            <span>O‘nli qiymat</span>
            <input value={decimal} onChange={(event) => setDecimal(event.target.value)} inputMode="decimal" />
          </label>
          <label className="form-field">
            <span>Koordinata turi</span>
            <select value={coordinateType} onChange={(event) => setCoordinateType(event.target.value as "lat" | "lon")}>
              <option value="lat">Kenglik (N/S)</option>
              <option value="lon">Uzunlik (E/W)</option>
            </select>
          </label>
        </div>
        <button className="primary-button" onClick={convertToDms}>GMS ga o‘tkazish <ArrowRight size={18} /></button>
        <div className="converter-answer">
          <div><span>GMS NATIJA</span><strong>{dmsAnswer}</strong></div>
          <button
            className="icon-button"
            disabled={dmsAnswer === "-"}
            onClick={async () => {
              await copyToClipboard(dmsAnswer);
              notify("GMS natija nusxalandi");
            }}
            aria-label="GMS natijani nusxalash"
          ><ClipboardCopy size={18} /></button>
        </div>
      </section>

      <section className="panel converter-card">
        <div className="converter-card-icon converter-card-icon--blue"><Ruler size={22} /></div>
        <div className="converter-title">
          <span>02</span>
          <div><h2>GMS → O‘nli gradus</h2><p>Gradus, minut, sekund va yo‘nalishni kiriting.</p></div>
        </div>
        <div className="form-grid form-grid--dms">
          <label className="form-field"><span>Gradus</span><input value={degrees} onChange={(event) => setDegrees(event.target.value)} inputMode="decimal" /></label>
          <label className="form-field"><span>Minut</span><input value={minutes} onChange={(event) => setMinutes(event.target.value)} inputMode="decimal" /></label>
          <label className="form-field"><span>Sekund</span><input value={seconds} onChange={(event) => setSeconds(event.target.value)} inputMode="decimal" /></label>
          <label className="form-field"><span>Yo‘nalish</span><select value={hemisphere} onChange={(event) => setHemisphere(event.target.value as typeof hemisphere)}><option>N</option><option>S</option><option>E</option><option>W</option></select></label>
        </div>
        <button className="primary-button primary-button--blue" onClick={convertToDecimal}>O‘nli gradusga o‘tkazish <ArrowRight size={18} /></button>
        <div className="converter-answer converter-answer--blue">
          <div><span>O‘NLI NATIJA</span><strong>{decimalAnswer}</strong></div>
          <button
            className="icon-button"
            disabled={decimalAnswer === "-"}
            onClick={async () => {
              await copyToClipboard(decimalAnswer);
              notify("O‘nli natija nusxalandi");
            }}
            aria-label="O‘nli natijani nusxalash"
          ><ClipboardCopy size={18} /></button>
        </div>
      </section>

      {error && <div className="inline-error converter-error"><Info size={17} /> {error}</div>}
      <div className="explain-strip">
        <Info size={18} />
        <div><strong>Kenglik va uzunlik farqi</strong><span>Kenglik — shimol/janub (N/S), uzunlik — sharq/g‘arb (E/W). Minut va sekund 0 dan 60 gacha bo‘lishi kerak.</span></div>
      </div>
    </div>
  );
}

function VolumePreview({ result }: { result: VolumeResult | null }) {
  const projected = useMemo(
    () => (result ? projectVolumePoints(result.points, 720, 390, 34) : []),
    [result],
  );

  return (
    <div className="tin-preview">
      <div className="preview-label"><span className="live-dot" /> TIN MODELI</div>
      {!result ? (
        <div className="preview-empty">
          <Mountain size={38} />
          <strong>Relyef tarmog‘i shu yerda ko‘rinadi</strong>
          <span>Nuqtalarni kiriting va hajmni hisoblang</span>
        </div>
      ) : (
        <svg viewBox="0 0 720 390" role="img" aria-label="Cut va Fill TIN modeli">
          <defs>
            <pattern id="tin-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" className="grid-path" fill="none" />
            </pattern>
          </defs>
          <rect width="720" height="390" fill="url(#tin-grid)" />
          {result.triangles.map((triangle, index) => {
            const points = triangle.indices.map((pointIndex) => projected[pointIndex]);
            return (
              <motion.polygon
                key={`${triangle.indices.join("-")}-${index}`}
                points={points.map((point) => `${point.x},${point.y}`).join(" ")}
                className={triangle.meanDifference >= 0 ? "tin-fill" : "tin-cut"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(index * 0.025, 0.35) }}
              />
            );
          })}
          {projected.map((point, index) => (
            <g key={`${point.x}-${point.y}-${index}`}>
              <circle cx={point.x} cy={point.y} r="4" className="tin-point" />
              <text x={point.x + 7} y={point.y - 7} className="point-label">{index + 1}</text>
            </g>
          ))}
        </svg>
      )}
      <div className="tin-legend"><span><i className="fill-color" /> Fill — to‘ldirish</span><span><i className="cut-color" /> Cut — qazish</span></div>
    </div>
  );
}

function VolumeCalculator({
  onHistory,
  notify,
}: {
  onHistory: (type: string, value: string) => void;
  notify: (message: string) => void;
}) {
  const [coordinateMode, setCoordinateMode] = useState<VolumeCoordinateMode>("local");
  const [designMode, setDesignMode] = useState<VolumeDesignMode>("level");
  const [designLevel, setDesignLevel] = useState("100.50");
  const [value, setValue] = useState(VOLUME_SAMPLE);
  const [result, setResult] = useState<VolumeResult | null>(null);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const calculate = () => {
    try {
      const points = parseVolumeRows(value, coordinateMode, designMode, Number(designLevel));
      const next = calculateCutFill(points);
      setResult(next);
      setError("");
      onHistory(
        "Cut & Fill",
        `Cut ${formatNumber(next.cut)} m³ · Fill ${formatNumber(next.fill)} m³`,
      );
    } catch (caught) {
      setResult(null);
      if (caught instanceof VolumeInputError) {
        setError(`${caught.line ? `${caught.line}-qator: ` : ""}${caught.message}`);
      } else {
        setError(caught instanceof Error ? caught.message : "Hajmni hisoblab bo‘lmadi.");
      }
    }
  };

  const report = result
    ? `GeoCalc Cut & Fill hisoboti\nUsul: Delaunay TIN, chiziqli balandlik interpolatsiyasi\nCut: ${formatNumber(result.cut)} m³\nFill: ${formatNumber(result.fill)} m³\nBalans (Fill - Cut): ${formatNumber(result.net)} m³\nReja maydoni: ${formatNumber(result.planArea)} m²\nNuqtalar: ${result.points.length}\nUchburchaklar: ${result.triangles.length}`
    : "";

  return (
    <div className="volume-layout">
      <section className="panel volume-controls">
        <div className="panel-head panel-head--simple">
          <div><span className="step-chip">01</span><div><h2>Hisob shartlarini tanlang</h2><p>Mahalliy X/Y yoki WGS84 nuqtalaridan foydalaning.</p></div></div>
        </div>

        <div className="segmented-label">KOORDINATA TURI</div>
        <div className="segmented-control">
          <button className={coordinateMode === "local" ? "is-active" : ""} onClick={() => { setCoordinateMode("local"); setResult(null); }}>Mahalliy X / Y</button>
          <button className={coordinateMode === "wgs84" ? "is-active" : ""} onClick={() => { setCoordinateMode("wgs84"); setResult(null); }}>WGS84</button>
        </div>

        <div className="segmented-label">LOYIHA YUZASI</div>
        <div className="segmented-control">
          <button className={designMode === "level" ? "is-active" : ""} onClick={() => { setDesignMode("level"); setResult(null); }}>Tekis loyiha sathi</button>
          <button className={designMode === "per-point" ? "is-active" : ""} onClick={() => { setDesignMode("per-point"); setResult(null); }}>Har nuqtada Z</button>
        </div>

        {designMode === "level" && (
          <label className="form-field volume-level"><span>Loyiha balandligi, m</span><input value={designLevel} onChange={(event) => { setDesignLevel(event.target.value); setResult(null); }} inputMode="decimal" /></label>
        )}

        <div className="volume-format">
          <span>{coordinateMode === "wgs84" ? "Kenglik  Uzunlik" : "X  Y"}  Mavjud Z{designMode === "per-point" ? "  Loyiha Z" : ""}</span>
          <code>{coordinateMode === "wgs84" ? "41.311081 69.240562 100.40" : "0 0 100.40"}{designMode === "per-point" ? " 100.50" : ""}</code>
        </div>

        <label className="field-label" htmlFor="volume-points">Balandlik nuqtalari</label>
        <textarea id="volume-points" className="data-textarea data-textarea--volume" value={value} onChange={(event) => { setValue(event.target.value); setResult(null); setError(""); }} spellCheck={false} />
        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          accept=".csv,.txt,.xyz,text/csv,text/plain"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 1_500_000) {
              setError("Fayl 1.5 MB dan kichik bo‘lishi kerak.");
              return;
            }
            setValue(await file.text());
            setResult(null);
            setError("");
            notify(`${file.name} yuklandi`);
            event.target.value = "";
          }}
        />

        {error && <div className="inline-error"><Info size={17} /> {error}</div>}

        <div className="action-row">
          <button className="primary-button" onClick={calculate}>Hajmni hisoblash <ArrowRight size={18} /></button>
          <button className="secondary-button" onClick={() => fileInput.current?.click()}><Upload size={17} /> CSV / XYZ</button>
        </div>
      </section>

      <section className="panel volume-preview-panel">
        <div className="panel-head panel-head--simple">
          <div><span className="step-chip">02</span><div><h2>TIN yuzasini tekshiring</h2><p>Nuqtalar Delaunay uchburchaklari bilan bog‘lanadi.</p></div></div>
        </div>
        <VolumePreview result={result} />
        <div className="method-note"><Layers3 size={18} /><span>Aralash Cut/Fill uchburchaklari nol konturi bo‘yicha bo‘linadi. Bu chiziqli TIN sirtida hajmni alohida integrallaydi.</span></div>
      </section>

      <AnimatePresence>
        {result && (
          <motion.section className="volume-results" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="volume-result-card volume-result-card--cut"><span><i /> CUT · QAZISH</span><strong>{formatNumber(result.cut)}</strong><small>m³</small></div>
            <div className="volume-result-card volume-result-card--fill"><span><i /> FILL · TO‘LDIRISH</span><strong>{formatNumber(result.fill)}</strong><small>m³</small></div>
            <div className="volume-result-card volume-result-card--net"><span>BALANS · FILL − CUT</span><strong>{result.net > 0 ? "+" : ""}{formatNumber(result.net)}</strong><small>m³</small></div>
            <div className="volume-summary">
              <div><span>Reja maydoni</span><strong>{formatNumber(result.planArea)} m²</strong></div>
              <div><span>TIN uchburchaklari</span><strong>{result.triangles.length} ta</strong></div>
              <div><span>Balandlik nuqtalari</span><strong>{result.points.length} ta</strong></div>
              <div className="volume-report-actions">
                <button className="icon-button" onClick={async () => { await copyToClipboard(report); notify("Hajm hisoboti nusxalandi"); }} aria-label="Hisobotni nusxalash"><Copy size={18} /></button>
                <button className="icon-button" onClick={() => saveTextFile("geocalc-cut-fill-hisoboti.txt", report)} aria-label="Hisobotni yuklab olish"><Download size={18} /></button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

type PreparedAttachment = GeoAIAttachment & { id: string; sizeLabel: string };
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: string[];
};

function fileSize(size: number) {
  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",")[1] : value);
    };
    reader.onerror = () => reject(new Error("Rasmni o‘qib bo‘lmadi."));
    reader.readAsDataURL(file);
  });
}

function ChatContact({ content }: { content: string }) {
  const index = content.indexOf(CONTACT_MARKER);
  const body = index >= 0 ? content.slice(0, index).trim() : content;
  return (
    <>
      <div className="message-text">{body}</div>
      <ContactCard compact />
    </>
  );
}

function GeoAIChat({ notify }: { notify: (message: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Assalomu alaykum! Men GeoAI. Koordinatalar, geodeziya, KML/CSV/DXF fayllari, Cut & Fill yoki rasmdagi jadvalni o‘qish bo‘yicha yordam beraman.\n\n${GEOAI_CONTACT_TEXT}`,
    },
  ]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, sending]);

  const attachFiles = async (files: FileList | null) => {
    if (!files) return;
    const room = Math.max(0, 4 - attachments.length);
    const selected = Array.from(files).slice(0, room);
    const next: PreparedAttachment[] = [];

    for (const file of selected) {
      try {
        if (file.type.startsWith("image/")) {
          if (file.size > 3_000_000) throw new Error("Rasm 3 MB dan kichik bo‘lishi kerak.");
          next.push({
            id: id(),
            kind: "image",
            name: file.name,
            mimeType: file.type || "image/jpeg",
            data: await readImage(file),
            sizeLabel: fileSize(file.size),
          });
        } else {
          if (file.size > 1_500_000) throw new Error("Matn fayli 1.5 MB dan kichik bo‘lishi kerak.");
          const content = await file.text();
          if (content.length > 350_000) throw new Error("Fayl matni juda katta.");
          next.push({
            id: id(),
            kind: "text",
            name: file.name,
            mimeType: file.type || "text/plain",
            content,
            sizeLabel: fileSize(file.size),
          });
        }
      } catch (caught) {
        notify(caught instanceof Error ? caught.message : `${file.name} o‘qilmadi`);
      }
    }
    setAttachments((current) => [...current, ...next].slice(0, 4));
    if (fileInput.current) fileInput.current.value = "";
  };

  const send = async () => {
    const message = input.trim();
    if ((!message && !attachments.length) || sending) return;

    const userMessage: ChatMessage = {
      id: id(),
      role: "user",
      content: message || "Biriktirilgan faylni tahlil qiling.",
      attachments: attachments.map((attachment) => attachment.name),
    };
    const historyForApi = messages.map(({ role, content }) => ({ role, content }));
    const payloadAttachments = attachments.map((attachment) => {
      if (attachment.kind === "image") {
        return {
          kind: attachment.kind,
          name: attachment.name,
          mimeType: attachment.mimeType,
          data: attachment.data,
        } satisfies GeoAIAttachment;
      }
      return {
        kind: attachment.kind,
        name: attachment.name,
        mimeType: attachment.mimeType,
        content: attachment.content,
      } satisfies GeoAIAttachment;
    });

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setAttachments([]);
    setSending(true);

    try {
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) {
        throw new Error("GeoAI dan foydalanish uchun Google orqali qayta kiring.");
      }
      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/geoai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          message: userMessage.content,
          history: historyForApi,
          attachments: payloadAttachments,
        }),
      });
      const payload = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !payload.answer) {
        throw new Error(payload.error || "GeoAI javob bermadi.");
      }
      setMessages((current) => [
        ...current,
        { id: id(), role: "assistant", content: payload.answer as string },
      ]);
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : "GeoAI bilan bog‘lanib bo‘lmadi.";
      setMessages((current) => [
        ...current,
        { id: id(), role: "assistant", content: `${text}\n\n${GEOAI_CONTACT_TEXT}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  const quickPrompts = [
    "WGS84 va UTM farqini sodda tushuntir",
    "KML faylimni tekshirib ber",
    "Cut & Fill natijasini qanday tekshiraman?",
  ];

  return (
    <div className="geoai-layout">
      <section className="geoai-chat panel">
        <div className="chat-head">
          <div className="geoai-avatar"><Sparkles size={21} /></div>
          <div><strong>GeoAI</strong><span><i /> Beta · Hozircha tekin</span></div>
          <div className="chat-security"><ShieldCheck size={15} /> Kalit serverda himoyalangan</div>
        </div>

        <div className="messages" aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className={`message-row message-row--${message.role}`}>
              {message.role === "assistant" && <div className="message-avatar"><Bot size={17} /></div>}
              <div className="message-stack">
                <div className="message-meta">{message.role === "assistant" ? "GeoAI" : "Siz"}</div>
                <div className="message-bubble">
                  {message.attachments?.length ? (
                    <div className="message-files">
                      {message.attachments.map((name) => <span key={name}><Paperclip size={13} /> {name}</span>)}
                    </div>
                  ) : null}
                  {message.role === "assistant" ? <ChatContact content={message.content} /> : <div className="message-text">{message.content}</div>}
                </div>
              </div>
            </div>
          ))}
          {sending && (
            <div className="message-row message-row--assistant">
              <div className="message-avatar"><Bot size={17} /></div>
              <div className="message-stack"><div className="message-meta">GeoAI</div><div className="message-bubble typing"><span /><span /><span /></div></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="quick-prompts">
          {quickPrompts.map((prompt) => <button key={prompt} onClick={() => setInput(prompt)}>{prompt}</button>)}
        </div>

        {attachments.length > 0 && (
          <div className="attachment-list">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="attachment-chip">
                {attachment.kind === "image" ? <ImageIcon size={16} /> : <FileText size={16} />}
                <span><strong>{attachment.name}</strong><small>{attachment.sizeLabel}</small></span>
                <button onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))} aria-label={`${attachment.name} ni olib tashlash`}><X size={15} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="chat-composer">
          <input ref={fileInput} className="visually-hidden" type="file" multiple accept=".kml,.csv,.dxf,.txt,.xyz,image/png,image/jpeg,image/webp" onChange={(event) => attachFiles(event.target.files)} />
          <button className="composer-attach" onClick={() => fileInput.current?.click()} aria-label="Fayl biriktirish" title="KML, CSV, DXF yoki rasm"><Paperclip size={20} /></button>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder="Koordinata, fayl yoki geodeziya haqida yozing…"
            rows={1}
          />
          <button className="composer-send" disabled={sending || (!input.trim() && !attachments.length)} onClick={() => void send()} aria-label="Yuborish">
            {sending ? <LoaderCircle className="spin" size={19} /> : <Send size={19} />}
          </button>
        </div>
        <div className="composer-note">Enter — yuborish · Shift + Enter — yangi qator · Eng ko‘pi 4 ta fayl</div>
      </section>

      <aside className="geoai-side">
        <div className="panel capability-card">
          <span className="side-eyebrow">GEOAI NIMALARNI BILADI?</span>
          <ul>
            <li><MapPin size={17} /><span><strong>Koordinatalar</strong>WGS84, UTM, GMS va format xatolari</span></li>
            <li><FileText size={17} /><span><strong>Fayllar</strong>KML, CSV, DXF va XYZ matn tahlili</span></li>
            <li><ImageIcon size={17} /><span><strong>OCR</strong>Rasmdagi jadval va koordinata matni</span></li>
            <li><BoxIcon size={17} /><span><strong>Cut & Fill</strong>Hajm, loyiha sathi va TIN izohi</span></li>
          </ul>
        </div>
        <div className="panel privacy-card">
          <ShieldCheck size={22} />
          <div><strong>Maxfiylik eslatmasi</strong><p>Hujjat yuborishdan oldin maxfiy kadastr yoki shaxsiy ma’lumotlarni olib tashlang.</p></div>
        </div>
        <ContactCard />
      </aside>
    </div>
  );
}

function Guide() {
  const steps = [
    { number: "01", icon: MapPin, title: "Ma’lumotni tayyorlang", text: "Maydon uchun lat/lon, hajm uchun esa X/Y/Z nuqtalarini bir qatordan kiriting." },
    { number: "02", icon: Triangle, title: "Shakl yoki TIN ni tekshiring", text: "Nuqtalar tartibi, takrorlangan qiymatlar va hosil bo‘lgan yuzani ko‘zdan kechiring." },
    { number: "03", icon: Check, title: "Natijani saqlang", text: "Birliklarni tekshiring, nusxa oling yoki matn hisoboti sifatida yuklab oling." },
  ];
  return (
    <div className="guide-layout">
      <section className="guide-steps">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <motion.article className="panel guide-step" key={step.number} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
              <span className="guide-number">{step.number}</span>
              <div className="guide-icon"><Icon size={23} /></div>
              <h2>{step.title}</h2>
              <p>{step.text}</p>
            </motion.article>
          );
        })}
      </section>

      <section className="panel guide-table-card">
        <div className="panel-head panel-head--simple"><div><span className="step-chip">A</span><div><h2>Qaysi format qayerda ishlatiladi?</h2><p>Fayl va koordinata turini bo‘limga mos tanlang.</p></div></div></div>
        <div className="format-table" role="table">
          <div className="format-row format-row--head" role="row"><span>Format</span><span>Qayerda</span><span>Misol / izoh</span></div>
          <div className="format-row" role="row"><strong>WGS84</strong><span>Yuza va hajm</span><code>41.311081 69.240562</code></div>
          <div className="format-row" role="row"><strong>Mahalliy X/Y/Z</strong><span>Cut & Fill</span><code>1000 2000 102.45</code></div>
          <div className="format-row" role="row"><strong>KML</strong><span>GeoAI</span><span>Chegara va nuqtalar</span></div>
          <div className="format-row" role="row"><strong>CSV / XYZ</strong><span>Hajm va GeoAI</span><span>Jadval ko‘rinishidagi nuqtalar</span></div>
          <div className="format-row" role="row"><strong>DXF</strong><span>GeoAI</span><span>Matnli ASCII DXF tavsiya etiladi</span></div>
          <div className="format-row" role="row"><strong>JPG / PNG</strong><span>GeoAI OCR</span><span>Aniq va tekis olingan rasm</span></div>
        </div>
      </section>

      <div className="guide-notes">
        <article className="panel note-card"><Calculator size={22} /><div><h3>Maydon algoritmi saqlangan</h3><p>Asl GeoCalc WGS84 → UTM zona tanlovi va Shoelace formulasi o‘zgartirilmagan.</p></div></article>
        <article className="panel note-card"><Layers3 size={22} /><div><h3>Cut & Fill nimani anglatadi?</h3><p>Cut — qazib olinadigan, Fill — to‘ldiriladigan hajm. Balans Fill minus Cut sifatida ko‘rsatiladi.</p></div></article>
        <article className="panel note-card"><ShieldCheck size={22} /><div><h3>Muhim tekshiruv</h3><p>Kadastr yoki qurilish qarori oldidan natijani sertifikatlangan geodezist bilan tekshiring.</p></div></article>
      </div>
    </div>
  );
}

function HistoryView({
  records,
  onClear,
}: {
  records: HistoryRecord[];
  onClear: () => void;
}) {
  return (
    <section className="panel history-panel">
      <div className="history-head">
        <div><History size={21} /><div><h2>Mahalliy hisoblash tarixi</h2><p>Eng so‘nggi 40 ta natija shu qurilmada saqlanadi.</p></div></div>
        {records.length > 0 && <button className="secondary-button" onClick={onClear}><Trash2 size={17} /> Tarixni tozalash</button>}
      </div>
      {records.length === 0 ? (
        <div className="history-empty-state"><History size={36} /><strong>Hali natija yo‘q</strong><span>Maydon, konvertor yoki hajm hisoblang — natija bu yerda paydo bo‘ladi.</span></div>
      ) : (
        <div className="history-records">
          {records.map((record) => (
            <article key={record.id} className="history-record">
              <div className="history-record-icon">{record.type.includes("Cut") ? <BoxIcon size={18} /> : record.type.includes("GMS") || record.type.includes("O‘nli") ? <RefreshCw size={18} /> : <Calculator size={18} />}</div>
              <div><span>{record.type}</span><strong>{record.value}</strong></div>
              <time>{record.date}</time>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <motion.div className="toast" initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}>
      <Check size={17} /> {message}
    </motion.div>
  );
}

export default function GeoCalcApp() {
  const [active, setActive] = useState<ModuleId>("area");
  const [mobileNav, setMobileNav] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [toast, setToast] = useState("");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyKey = user ? `geocalc_history_${user.uid}` : "geocalc_history_guest";

  useEffect(() => {
    const hydrateLocalPreferences = window.setTimeout(() => {
      const savedTheme = localStorage.getItem("geocalc_theme") === "light" ? "light" : "dark";
      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
    }, 0);

    return () => window.clearTimeout(hydrateLocalPreferences);
  }, []);

  useEffect(() => {
    let mounted = true;

    getRedirectResult(firebaseAuth).catch((error: unknown) => {
      if (!mounted) return;
      const code = error instanceof FirebaseError ? error.code : "";
      setAuthError(
        code === "auth/unauthorized-domain"
          ? "Bu domen Firebase’da ruxsat etilmagan. Firebase Console → Authentication → Authorized domains bo‘limiga sayt domenini qo‘shing."
          : "Google kirishni yakunlab bo‘lmadi. Qayta urinib ko‘ring.",
      );
    });

    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      if (!mounted) return;
      setUser(nextUser);
      setAuthReady(true);
      setAuthBusy(false);
      if (nextUser) {
        setAuthError("");
        try {
          const key = `geocalc_history_${nextUser.uid}`;
          const saved = JSON.parse(localStorage.getItem(key) || "[]");
          setHistory(Array.isArray(saved) ? saved.slice(0, 40) : []);
        } catch {
          setHistory([]);
        }
      } else {
        setHistory([]);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }, []);

  const addHistory = useCallback((type: string, value: string) => {
    setHistory((current) => {
      const next = [
        {
          id: id(),
          type,
          value,
          date: new Intl.DateTimeFormat("uz-UZ", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date()),
        },
        ...current,
      ].slice(0, 40);
      localStorage.setItem(historyKey, JSON.stringify(next));
      return next;
    });
  }, [historyKey]);

  const clearHistory = () => {
    localStorage.removeItem(historyKey);
    setHistory([]);
    notify("Tarix tozalandi");
  };

  const signIn = async () => {
    setAuthBusy(true);
    setAuthError("");
    try {
      await signInWithPopup(firebaseAuth, googleProvider);
    } catch (error) {
      const code = error instanceof FirebaseError ? error.code : "";
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        try {
          await signInWithRedirect(firebaseAuth, googleProvider);
          return;
        } catch (redirectError) {
          console.error("Google redirect sign-in failed", redirectError);
        }
      }

      setAuthBusy(false);
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setAuthError("Google oynasi yopildi. Kirish uchun tugmani yana bosing.");
      } else if (code === "auth/unauthorized-domain") {
        setAuthError(
          "Bu domen Firebase’da ruxsat etilmagan. Firebase Console → Authentication → Authorized domains bo‘limiga sayt domenini qo‘shing.",
        );
      } else if (code === "auth/operation-not-allowed") {
        setAuthError("Firebase Authentication ichida Google provayderini yoqing.");
      } else {
        setAuthError("Google orqali kirishda xato yuz berdi. Internetni tekshirib, qayta urinib ko‘ring.");
      }
    }
  };

  const logOut = async () => {
    try {
      await signOut(firebaseAuth);
      setMobileNav(false);
    } catch {
      notify("Hisobdan chiqib bo‘lmadi. Qayta urinib ko‘ring.");
    }
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("geocalc_theme", next);
  };

  if (!authReady || !user) {
    return (
      <AuthScreen
        checking={!authReady}
        busy={authBusy}
        error={authError}
        onSignIn={signIn}
      />
    );
  }

  return (
    <div className="app-shell">
      <AppSidebar
        active={active}
        onSelect={setActive}
        open={mobileNav}
        onClose={() => setMobileNav(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
        user={user}
        onSignOut={logOut}
      />

      <main className="app-main">
        <div className="mobile-topbar">
          <Logo />
          <button className="icon-button" onClick={() => setMobileNav(true)} aria-label="Menyuni ochish"><Menu size={21} /></button>
        </div>
        <ModuleHeader module={active} />

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            className="module-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            {active === "area" && <AreaCalculator onHistory={addHistory} notify={notify} />}
            {active === "converter" && <Converter onHistory={addHistory} notify={notify} />}
            {active === "volume" && <VolumeCalculator onHistory={addHistory} notify={notify} />}
            {active === "geoai" && <GeoAIChat notify={notify} />}
            {active === "guide" && <Guide />}
            {active === "history" && <HistoryView records={history} onClear={clearHistory} />}
          </motion.div>
        </AnimatePresence>

        <footer className="app-footer">
          <span>© 2026 GeoCalc</span>
          <span>WGS84 · TIN · GeoAI</span>
        </footer>
      </main>

      <AnimatePresence>{toast && <Toast message={toast} />}</AnimatePresence>
    </div>
  );
}
