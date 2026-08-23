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
  createContext,
  useCallback,
  useContext,
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
  GEOAI_CONTACT_MARKERS,
  type GeoAIAttachment,
} from "@/lib/geoai";
import { firebaseAuth, googleProvider } from "@/lib/firebase-client";


type AppLanguage = "uz" | "ru" | "en";

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
};

const LanguageContext = createContext<LanguageContextValue>({
  language: "uz",
  setLanguage: () => undefined,
});

function useLanguage() {
  return useContext(LanguageContext);
}

function tr(language: AppLanguage, uz: string, ru: string, en: string) {
  return language === "ru" ? ru : language === "en" ? en : uz;
}


function localizeKnownError(message: string, language: AppLanguage) {
  const table: Record<string, [string, string, string]> = {
    "Invalid number.": ["Son noto‘g‘ri kiritilgan.", "Введено неверное число.", "Invalid number."],
    "Invalid values.": ["Qiymatlar noto‘g‘ri kiritilgan.", "Введены неверные значения.", "Invalid values."],
    "Minutes or seconds are out of range.": ["Minut yoki sekund ruxsat etilgan oraliqdan tashqarida.", "Минуты или секунды вне допустимого диапазона.", "Minutes or seconds are out of range."],
    "Latitude cannot be greater than 90.": ["Kenglik 90 dan katta bo‘lishi mumkin emas.", "Широта не может быть больше 90.", "Latitude cannot be greater than 90."],
    "Longitude cannot be greater than 180.": ["Uzunlik 180 dan katta bo‘lishi mumkin emas.", "Долгота не может быть больше 180.", "Longitude cannot be greater than 180."],
    "Kamida 3 ta balandlik nuqtasi kerak.": ["Kamida 3 ta balandlik nuqtasi kerak.", "Нужно минимум 3 высотные точки.", "At least 3 elevation points are required."],
    "Kenglik −90…90 oralig‘ida bo‘lishi kerak.": ["Kenglik −90…90 oralig‘ida bo‘lishi kerak.", "Широта должна быть в диапазоне −90…90.", "Latitude must be between −90 and 90."],
    "Uzunlik −180…180 oralig‘ida bo‘lishi kerak.": ["Uzunlik −180…180 oralig‘ida bo‘lishi kerak.", "Долгота должна быть в диапазоне −180…180.", "Longitude must be between −180 and 180."],
    "Loyiha balandligini son ko‘rinishida kiriting.": ["Loyiha balandligini son ko‘rinishida kiriting.", "Введите проектную отметку числом.", "Enter the design elevation as a number."],
    "X/Y, mavjud Z va loyiha Z qiymatlarini kiriting.": ["X/Y, mavjud Z va loyiha Z qiymatlarini kiriting.", "Введите X/Y, существующую Z и проектную Z.", "Enter X/Y, existing Z, and design Z."],
    "X/Y va mavjud Z qiymatlarini kiriting.": ["X/Y va mavjud Z qiymatlarini kiriting.", "Введите X/Y и существующую Z.", "Enter X/Y and existing Z."],
    "Bir xil X/Y nuqta takrorlangan.": ["Bir xil X/Y nuqta takrorlangan.", "Повторяется одинаковая точка X/Y.", "A duplicate X/Y point was found."],
    "Nuqtalar bir chiziqda joylashgan. Maydon hosil qiladigan nuqtalar kiriting.": ["Nuqtalar bir chiziqda joylashgan. Maydon hosil qiladigan nuqtalar kiriting.", "Точки лежат на одной линии. Введите точки, образующие площадь.", "The points are collinear. Enter points that form an area."],
    "TIN yuzasi hosil bo‘lmadi. Nuqtalarni tekshiring.": ["TIN yuzasi hosil bo‘lmadi. Nuqtalarni tekshiring.", "Не удалось построить поверхность TIN. Проверьте точки.", "Could not create a TIN surface. Check the points."],
  };
  const item = table[message];
  return item ? tr(language, item[0], item[1], item[2]) : message;
}

function localeFor(language: AppLanguage) {
  return language === "ru" ? "ru-RU" : language === "en" ? "en-US" : "uz-UZ";
}

function detectBrowserLanguage(): AppLanguage {
  if (typeof navigator === "undefined") return "uz";
  const value = navigator.language.toLowerCase();
  if (value.startsWith("ru")) return "ru";
  if (value.startsWith("en")) return "en";
  return "uz";
}

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


function getNavItems(language: AppLanguage): NavItem[] {
  return [
    {
      id: "area",
      label: tr(language, "Yuza hisoblash", "Расчёт площади", "Area calculation"),
      hint: tr(language, "WGS84 · m² · gektar", "WGS84 · м² · гектар", "WGS84 · m² · hectare"),
      icon: Calculator,
    },
    {
      id: "converter",
      label: tr(language, "Konvertor", "Конвертер", "Converter"),
      hint: tr(language, "O‘nli ↔ GMS", "Десятичные ↔ DMS", "Decimal ↔ DMS"),
      icon: RefreshCw,
    },
    {
      id: "volume",
      label: tr(language, "Hajm hisoblash", "Расчёт объёма", "Volume calculation"),
      hint: "TIN · Cut & Fill",
      icon: BoxIcon,
    },
    {
      id: "geoai",
      label: "GeoAI",
      hint: tr(language, "Hozircha tekin", "Пока бесплатно", "Free for now"),
      icon: Bot,
      beta: true,
    },
    {
      id: "guide",
      label: tr(language, "Qo‘llanma", "Руководство", "Guide"),
      hint: tr(language, "Sodda tushuntirish", "Простое объяснение", "Simple explanation"),
      icon: FileText,
    },
    {
      id: "history",
      label: tr(language, "Tarix", "История", "History"),
      hint: tr(language, "Oxirgi natijalar", "Последние результаты", "Recent results"),
      icon: History,
    },
  ];
}

function getModuleMeta(language: AppLanguage): Record<ModuleId, { eyebrow: string; title: string; description: string }> {
  return {
    area: {
      eyebrow: tr(language, "WGS84 MAYDON KALKULYATORI", "КАЛЬКУЛЯТОР ПЛОЩАДИ WGS84", "WGS84 AREA CALCULATOR"),
      title: tr(language, "Yer maydonini tez va aniq hisoblang", "Рассчитайте площадь участка быстро и точно", "Calculate land area quickly and accurately"),
      description: tr(language, "Koordinatalarni kiriting — GeoCalc shaklni tekshiradi va natijani barcha kerakli birliklarda beradi.", "Введите координаты — GeoCalc проверит контур и выдаст результат во всех нужных единицах.", "Enter coordinates — GeoCalc checks the shape and returns the result in all required units."),
    },
    converter: {
      eyebrow: tr(language, "KOORDINATA KONVERTORI", "КОНВЕРТЕР КООРДИНАТ", "COORDINATE CONVERTER"),
      title: tr(language, "Formatlar orasida xatosiz o‘ting", "Преобразуйте форматы без ошибок", "Convert between formats without errors"),
      description: tr(language, "O‘nli gradus va gradus–minut–sekund qiymatlarini ikki tomonga o‘giring.", "Преобразуйте десятичные градусы и градусы–минуты–секунды в обе стороны.", "Convert decimal degrees and degrees–minutes–seconds in both directions."),
    },
    volume: {
      eyebrow: "TIN · CUT & FILL",
      title: tr(language, "Relyef hajmini muvozanat bilan hisoblang", "Рассчитайте объёмы рельефа с балансом", "Calculate terrain volumes with balance"),
      description: tr(language, "Mavjud va loyiha balandliklari orasidagi qazish hamda to‘ldirish hajmini TIN yuzasi bo‘yicha oling.", "Получите объёмы выемки и насыпи между существующими и проектными отметками по поверхности TIN.", "Calculate cut and fill volumes between existing and design elevations using a TIN surface."),
    },
    geoai: {
      eyebrow: "GEOAI · BETA",
      title: tr(language, "Savollaringizga bir joyda javob", "Ответы на ваши вопросы в одном месте", "Answers to your questions in one place"),
      description: tr(language, "GeoAI umumiy savollar, kod, matn, fayllar, rasmlar va geodezik vazifalarda yordam beradi.", "GeoAI помогает с общими вопросами, кодом, текстом, файлами, изображениями и геодезическими задачами.", "GeoAI helps with general questions, code, text, files, images, and geodetic tasks."),
    },
    guide: {
      eyebrow: tr(language, "QO‘LLANMA", "РУКОВОДСТВО", "GUIDE"),
      title: tr(language, "Birinchi natijagacha uchta sodda qadam", "Три простых шага до первого результата", "Three simple steps to your first result"),
      description: tr(language, "Koordinata formatlari, hisoblash usullari va ishonchli natija olish bo‘yicha qisqa yo‘riqnoma.", "Краткое руководство по форматам координат, методам расчёта и получению надёжного результата.", "A short guide to coordinate formats, calculation methods, and reliable results."),
    },
    history: {
      eyebrow: tr(language, "QURILMADAGI TARIX", "ИСТОРИЯ НА УСТРОЙСТВЕ", "DEVICE HISTORY"),
      title: tr(language, "So‘nggi hisoblaringiz", "Ваши последние расчёты", "Your recent calculations"),
      description: tr(language, "Natijalar faqat shu brauzerda saqlanadi va istalgan payt tozalanadi.", "Результаты хранятся только в этом браузере и могут быть очищены в любое время.", "Results are stored only in this browser and can be cleared at any time."),
    },
  };
}

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

function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="segmented-control language-switcher" aria-label={tr(language, "Til", "Язык", "Language")}>
      {(["uz", "ru", "en"] as AppLanguage[]).map((code) => (
        <button
          type="button"
          key={code}
          className={language === code ? "is-active" : ""}
          onClick={() => setLanguage(code)}
          aria-pressed={language === code}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function ContactCard({ compact = false }: { compact?: boolean }) {
  const { language } = useLanguage();
  return (
    <div className={compact ? "contact-card contact-card--compact" : "contact-card"}>
      <p>
        {tr(
          language,
          "Xizmat, murojaat, shikoyat, qonunbuzarliklar va takliflar uchun mening Hojayinimning kontaktlari:",
          "Контакты моего владельца для обращений, жалоб, сообщений о нарушениях и предложений:",
          "My owner’s contacts for support, requests, complaints, violation reports, and suggestions:",
        )}
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
  const { language } = useLanguage();
  return (
    <div className="logo-lockup">
      <div className="logo-glyph" aria-hidden="true">
        <MapPin size={23} strokeWidth={2.2} />
        <span>G</span>
      </div>
      <div>
        <strong>GeoCalc</strong>
        <span>{tr(language, "Geodeziya sodda tilda", "Геодезия простым языком", "Geodesy made simple")}</span>
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
  const { language } = useLanguage();
  return (
    <main className="auth-shell">
      <motion.section
        className="auth-panel"
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <Logo />
        <LanguageSwitcher />
        <div className="auth-badge"><ShieldCheck size={15} /> {tr(language, "Himoyalangan ish maydoni", "Защищённое рабочее пространство", "Protected workspace")}</div>
        <div className="auth-copy">
          <p className="eyebrow"><span /> {tr(language, "GEODEZIYA SODDA TILDA", "ГЕОДЕЗИЯ ПРОСТЫМ ЯЗЫКОМ", "GEODESY MADE SIMPLE")}</p>
          <h1>{tr(language, "GeoCalc hisoblariga Google orqali kiring", "Войдите в GeoCalc через Google", "Sign in to GeoCalc with Google")}</h1>
          <p>
            {tr(language, "Maydon, koordinata, Cut & Fill va GeoAI vositalari bitta zamonaviy ish maydonida.", "Площадь, координаты, Cut & Fill и GeoAI — в одном современном рабочем пространстве.", "Area, coordinates, Cut & Fill, and GeoAI tools in one modern workspace.")}
          </p>
        </div>

        <button
          className="google-signin"
          type="button"
          onClick={onSignIn}
          disabled={checking || busy}
        >
          {checking || busy ? <LoaderCircle className="spin" size={21} /> : <GoogleMark />}
          {checking
            ? tr(language, "Hisob tekshirilmoqda…", "Проверяем аккаунт…", "Checking account…")
            : busy
              ? tr(language, "Google ochilmoqda…", "Открываем Google…", "Opening Google…")
              : tr(language, "Google orqali kirish", "Войти через Google", "Sign in with Google")}
        </button>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <div className="auth-features" aria-label={tr(language, "GeoCalc imkoniyatlari", "Возможности GeoCalc", "GeoCalc features")}>
          <span><Calculator size={15} /> {tr(language, "Aniq maydon", "Точная площадь", "Accurate area")}</span>
          <span><Mountain size={15} /> Cut &amp; Fill</span>
          <span><Bot size={15} /> GeoAI</span>
        </div>
        <p className="auth-privacy">
          {tr(language, "Kirish orqali hisobingiz aniqlanadi. Gemini kaliti brauzerga yuborilmaydi.", "Вход используется для идентификации аккаунта. Ключ Gemini не передаётся в браузер.", "Sign-in identifies your account. The Gemini key is never sent to the browser.")}
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
  const { language } = useLanguage();
  const navItems = getNavItems(language);
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.button
            className="sidebar-backdrop"
            aria-label={tr(language, "Menyuni yopish", "Закрыть меню", "Close menu")}
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
          <button className="icon-button sidebar-close" onClick={onClose} aria-label={tr(language, "Yopish", "Закрыть", "Close")}>
            <X size={20} />
          </button>
        </div>

        <nav className="main-nav" aria-label={tr(language, "Asosiy bo‘limlar", "Основные разделы", "Main sections")}>
          <p className="nav-kicker">{tr(language, "ASBOBLAR", "ИНСТРУМЕНТЫ", "TOOLS")}</p>
          {navItems.map((item) => {
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
              <strong>{user.displayName || tr(language, "GeoCalc foydalanuvchisi", "Пользователь GeoCalc", "GeoCalc user")}</strong>
              <span>{user.email || tr(language, "Google hisob", "Аккаунт Google", "Google account")}</span>
            </div>
            <button type="button" onClick={onSignOut} aria-label={tr(language, "Hisobdan chiqish", "Выйти", "Sign out")} title={tr(language, "Hisobdan chiqish", "Выйти", "Sign out")}>
              <LogOut size={16} />
            </button>
          </div>
          <LanguageSwitcher />
          <button className="theme-toggle" onClick={onToggleTheme}>
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            {theme === "dark" ? tr(language, "Yorug‘ rejim", "Светлая тема", "Light mode") : tr(language, "Tungi rejim", "Тёмная тема", "Dark mode")}
          </button>
        </div>
      </aside>
    </>
  );
}

function ModuleHeader({ module }: { module: ModuleId }) {
  const { language } = useLanguage();
  const meta = getModuleMeta(language)[module];
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
          <small>{tr(language, "Aniq yadro faol", "Точное ядро активно", "Precision core active")}</small>
        </div>
      </div>
    </header>
  );
}

function PolygonPreview({ points }: { points: GeoPoint[] }) {
  const { language } = useLanguage();
  const canvasPoints = useMemo(
    () => (points.length >= 2 ? projectPointsToCanvas(points, 720, 400, 50) : []),
    [points],
  );
  const polygon = canvasPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="map-preview" aria-label={tr(language, "Kiritilgan shakl ko‘rinishi", "Предпросмотр введённого контура", "Entered shape preview")}>
      <div className="preview-label">
        <span className="live-dot" /> {tr(language, "JONLI SHAKL", "ЖИВОЙ КОНТУР", "LIVE SHAPE")}
      </div>
      {canvasPoints.length < 2 ? (
        <div className="preview-empty">
          <Triangle size={34} />
          <strong>{tr(language, "Shakl shu yerda ko‘rinadi", "Контур появится здесь", "The shape will appear here")}</strong>
          <span>{tr(language, "Kamida 2 ta to‘g‘ri koordinata kiriting", "Введите как минимум 2 корректные координаты", "Enter at least 2 valid coordinates")}</span>
        </div>
      ) : (
        <svg viewBox="0 0 720 400" role="img" aria-label={`${points.length} ${tr(language, "nuqtali poligon", "точек в полигоне", "point polygon")}`}>
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

function areaErrorMessage(error: unknown, language: AppLanguage) {
  if (!(error instanceof CoordinateParseError)) {
    return error instanceof Error ? error.message : tr(language, "Koordinatalarni tekshiring.", "Проверьте координаты.", "Check the coordinates.");
  }
  const messages: Record<CoordinateParseError["code"], string> = {
    incomplete: tr(language, "ikki koordinata to‘liq kiritilmagan", "пара координат введена не полностью", "the coordinate pair is incomplete"),
    "invalid-number": tr(language, "son noto‘g‘ri kiritilgan", "введено неверное число", "an invalid number was entered"),
    "invalid-latitude": tr(language, "kenglik −90…90 oralig‘ida emas", "широта вне диапазона −90…90", "latitude is outside −90…90"),
    "invalid-longitude": tr(language, "uzunlik −180…180 oralig‘ida emas", "долгота вне диапазона −180…180", "longitude is outside −180…180"),
  };
  return tr(language, `${error.line}-qator: ${messages[error.code]}.`, `Строка ${error.line}: ${messages[error.code]}.`, `Line ${error.line}: ${messages[error.code]}.`);
}

function AreaCalculator({
  onHistory,
  notify,
}: {
  onHistory: (type: string, value: string) => void;
  notify: (message: string) => void;
}) {
  const { language } = useLanguage();
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
        setError(tr(language, "Yuza hisoblash uchun kamida 3 ta nuqta kerak.", "Для расчёта площади нужно минимум 3 точки.", "At least 3 points are required to calculate area."));
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
        tr(language, "Yuza", "Площадь", "Area"),
        `${formatNumber(next.areaHa)} ha · ${formatNumber(next.areaM2)} m²`,
      );
    } catch (caught) {
      setAnswer(null);
      setError(areaErrorMessage(caught, language));
    }
  };

  const answerText = answer
    ? tr(language,
        `GeoCalc natijasi\nMaydon: ${formatNumber(answer.areaHa)} gektar\n${formatNumber(answer.areaM2)} m²\n${formatNumber(answer.areaKm2)} km²\nPerimetr: ${formatNumber(answer.perimeter)} m\nNuqtalar: ${answer.points}`,
        `Результат GeoCalc\nПлощадь: ${formatNumber(answer.areaHa)} га\n${formatNumber(answer.areaM2)} м²\n${formatNumber(answer.areaKm2)} км²\nПериметр: ${formatNumber(answer.perimeter)} м\nТочки: ${answer.points}`,
        `GeoCalc result\nArea: ${formatNumber(answer.areaHa)} hectares\n${formatNumber(answer.areaM2)} m²\n${formatNumber(answer.areaKm2)} km²\nPerimeter: ${formatNumber(answer.perimeter)} m\nPoints: ${answer.points}`
      )
    : "";

  return (
    <div className="workspace-grid workspace-grid--area">
      <section className="panel input-panel">
        <div className="panel-head">
          <div>
            <span className="step-chip">01</span>
            <div>
              <h2>{tr(language, "Koordinatalarni kiriting", "Введите координаты", "Enter coordinates")}</h2>
              <p>{tr(language, "Avval kenglik, keyin uzunlik. Har nuqta — yangi qatorda.", "Сначала широта, затем долгота. Каждая точка — с новой строки.", "Latitude first, then longitude. Put each point on a new line.")}</p>
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
            <WandSparkles size={16} /> {tr(language, "Namuna qo‘yish", "Вставить пример", "Insert sample")}
          </button>
        </div>

        <div className="format-hint">
          <span>{tr(language, "TO‘G‘RI FORMAT", "ПРАВИЛЬНЫЙ ФОРМАТ", "CORRECT FORMAT")}</span>
          <code>41.311081, 69.240562</code>
        </div>

        <label className="field-label" htmlFor="area-coordinates">
          {tr(language, "Nuqtalar ro‘yxati", "Список точек", "Point list")} <small>{previewPoints.length || 0} {tr(language, "ta o‘qildi", "прочитано", "read")}</small>
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
            {tr(language, "Hisoblash", "Рассчитать", "Calculate")} <ArrowRight size={18} />
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setValue("");
              setAnswer(null);
              setError("");
            }}
          >
            <Trash2 size={17} /> {tr(language, "Tozalash", "Очистить", "Clear")}
          </button>
        </div>
      </section>

      <section className="panel preview-panel">
        <div className="panel-head panel-head--simple">
          <div>
            <span className="step-chip">02</span>
            <div>
              <h2>{tr(language, "Shaklni tekshiring", "Проверьте контур", "Check the shape")}</h2>
              <p>{tr(language, "Nuqtalar kiritilgan ketma-ketlikda ulanadi.", "Точки соединяются в порядке ввода.", "Points are connected in the order entered.")}</p>
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
              <span>{tr(language, "ASOSIY NATIJA", "ОСНОВНОЙ РЕЗУЛЬТАТ", "MAIN RESULT")}</span>
              <strong>{formatNumber(answer.areaHa)}</strong>
              <small>{tr(language, "gektar", "гектар", "hectares")}</small>
            </div>
            <div className="result-stats">
              <div><span>{tr(language, "Maydon", "Площадь", "Area")}</span><strong>{formatNumber(answer.areaM2)} m²</strong></div>
              <div><span>{tr(language, "Kilometr kvadrat", "Квадратные километры", "Square kilometers")}</span><strong>{formatNumber(answer.areaKm2)} km²</strong></div>
              <div><span>{tr(language, "Perimetr", "Периметр", "Perimeter")}</span><strong>{formatNumber(answer.perimeter)} m</strong></div>
              <div><span>{tr(language, "Nuqtalar", "Точки", "Points")}</span><strong>{answer.points}</strong></div>
            </div>
            <div className="result-actions">
              <button
                className="secondary-button"
                onClick={async () => {
                  await copyToClipboard(answerText);
                  notify(tr(language, "Natija nusxalandi", "Результат скопирован", "Result copied"));
                }}
              >
                <Copy size={17} /> {tr(language, "Nusxa olish", "Копировать", "Copy")}
              </button>
              <button
                className="secondary-button"
                onClick={() => saveTextFile("geocalc-maydon-natijasi.txt", answerText)}
              >
                <Download size={17} /> {tr(language, "Yuklab olish", "Скачать", "Download")}
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
  const { language } = useLanguage();
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
      onHistory(tr(language, "O‘nli → GMS", "Десятичные → DMS", "Decimal → DMS"), `${decimal} → ${result}`);
    } catch {
      setDmsAnswer("-");
      setError(tr(language, "O‘nli qiymatni tekshiring.", "Проверьте десятичное значение.", "Check the decimal value."));
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
        tr(language, "GMS → O‘nli", "DMS → Десятичные", "DMS → Decimal"),
        `${degrees}° ${minutes}' ${seconds}" ${hemisphere} → ${value}`,
      );
    } catch (caught) {
      setDecimalAnswer("-");
      setError(caught instanceof Error ? localizeKnownError(caught.message, language) : tr(language, "Qiymatlarni tekshiring.", "Проверьте значения.", "Check the values."));
    }
  };

  return (
    <div className="converter-layout">
      <section className="panel converter-card">
        <div className="converter-card-icon"><RefreshCw size={22} /></div>
        <div className="converter-title">
          <span>01</span>
          <div><h2>{tr(language, "O‘nli gradus → GMS", "Десятичные градусы → DMS", "Decimal degrees → DMS")}</h2><p>{tr(language, "Masalan", "Например", "Example")}: 41.311081 → 41° 18′ 39.8916″ N</p></div>
        </div>
        <div className="form-grid form-grid--two">
          <label className="form-field">
            <span>{tr(language, "O‘nli qiymat", "Десятичное значение", "Decimal value")}</span>
            <input value={decimal} onChange={(event) => setDecimal(event.target.value)} inputMode="decimal" />
          </label>
          <label className="form-field">
            <span>{tr(language, "Koordinata turi", "Тип координаты", "Coordinate type")}</span>
            <select value={coordinateType} onChange={(event) => setCoordinateType(event.target.value as "lat" | "lon")}>
              <option value="lat">{tr(language, "Kenglik (N/S)", "Широта (N/S)", "Latitude (N/S)")}</option>
              <option value="lon">{tr(language, "Uzunlik (E/W)", "Долгота (E/W)", "Longitude (E/W)")}</option>
            </select>
          </label>
        </div>
        <button className="primary-button" onClick={convertToDms}>{tr(language, "GMS ga o‘tkazish", "Преобразовать в DMS", "Convert to DMS")} <ArrowRight size={18} /></button>
        <div className="converter-answer">
          <div><span>{tr(language, "GMS NATIJA", "РЕЗУЛЬТАТ DMS", "DMS RESULT")}</span><strong>{dmsAnswer}</strong></div>
          <button
            className="icon-button"
            disabled={dmsAnswer === "-"}
            onClick={async () => {
              await copyToClipboard(dmsAnswer);
              notify(tr(language, "GMS natija nusxalandi", "Результат DMS скопирован", "DMS result copied"));
            }}
            aria-label={tr(language, "GMS natijani nusxalash", "Скопировать результат DMS", "Copy DMS result")}
          ><ClipboardCopy size={18} /></button>
        </div>
      </section>

      <section className="panel converter-card">
        <div className="converter-card-icon converter-card-icon--blue"><Ruler size={22} /></div>
        <div className="converter-title">
          <span>02</span>
          <div><h2>{tr(language, "GMS → O‘nli gradus", "DMS → Десятичные градусы", "DMS → Decimal degrees")}</h2><p>{tr(language, "Gradus, minut, sekund va yo‘nalishni kiriting.", "Введите градусы, минуты, секунды и направление.", "Enter degrees, minutes, seconds, and direction.")}</p></div>
        </div>
        <div className="form-grid form-grid--dms">
          <label className="form-field"><span>{tr(language, "Gradus", "Градусы", "Degrees")}</span><input value={degrees} onChange={(event) => setDegrees(event.target.value)} inputMode="decimal" /></label>
          <label className="form-field"><span>{tr(language, "Minut", "Минуты", "Minutes")}</span><input value={minutes} onChange={(event) => setMinutes(event.target.value)} inputMode="decimal" /></label>
          <label className="form-field"><span>{tr(language, "Sekund", "Секунды", "Seconds")}</span><input value={seconds} onChange={(event) => setSeconds(event.target.value)} inputMode="decimal" /></label>
          <label className="form-field"><span>{tr(language, "Yo‘nalish", "Направление", "Direction")}</span><select value={hemisphere} onChange={(event) => setHemisphere(event.target.value as typeof hemisphere)}><option>N</option><option>S</option><option>E</option><option>W</option></select></label>
        </div>
        <button className="primary-button primary-button--blue" onClick={convertToDecimal}>{tr(language, "O‘nli gradusga o‘tkazish", "Преобразовать в десятичные градусы", "Convert to decimal degrees")} <ArrowRight size={18} /></button>
        <div className="converter-answer converter-answer--blue">
          <div><span>{tr(language, "O‘NLI NATIJA", "ДЕСЯТИЧНЫЙ РЕЗУЛЬТАТ", "DECIMAL RESULT")}</span><strong>{decimalAnswer}</strong></div>
          <button
            className="icon-button"
            disabled={decimalAnswer === "-"}
            onClick={async () => {
              await copyToClipboard(decimalAnswer);
              notify(tr(language, "O‘nli natija nusxalandi", "Десятичный результат скопирован", "Decimal result copied"));
            }}
            aria-label={tr(language, "O‘nli natijani nusxalash", "Скопировать десятичный результат", "Copy decimal result")}
          ><ClipboardCopy size={18} /></button>
        </div>
      </section>

      {error && <div className="inline-error converter-error"><Info size={17} /> {error}</div>}
      <div className="explain-strip">
        <Info size={18} />
        <div><strong>{tr(language, "Kenglik va uzunlik farqi", "Разница между широтой и долготой", "Latitude vs longitude")}</strong><span>{tr(language, "Kenglik — shimol/janub (N/S), uzunlik — sharq/g‘arb (E/W). Minut va sekund 0 dan 60 gacha bo‘lishi kerak.", "Широта — север/юг (N/S), долгота — восток/запад (E/W). Минуты и секунды должны быть от 0 до 60.", "Latitude is north/south (N/S), longitude is east/west (E/W). Minutes and seconds must be between 0 and 60.")}</span></div>
      </div>
    </div>
  );
}

function VolumePreview({ result }: { result: VolumeResult | null }) {
  const { language } = useLanguage();
  const projected = useMemo(
    () => (result ? projectVolumePoints(result.points, 720, 390, 34) : []),
    [result],
  );

  return (
    <div className="tin-preview">
      <div className="preview-label"><span className="live-dot" /> {tr(language, "TIN MODELI", "МОДЕЛЬ TIN", "TIN MODEL")}</div>
      {!result ? (
        <div className="preview-empty">
          <Mountain size={38} />
          <strong>{tr(language, "Relyef tarmog‘i shu yerda ko‘rinadi", "Сетка рельефа появится здесь", "The terrain mesh will appear here")}</strong>
          <span>{tr(language, "Nuqtalarni kiriting va hajmni hisoblang", "Введите точки и рассчитайте объём", "Enter points and calculate volume")}</span>
        </div>
      ) : (
        <svg viewBox="0 0 720 390" role="img" aria-label={tr(language, "Cut va Fill TIN modeli", "Модель TIN Cut и Fill", "Cut and Fill TIN model")}>
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
      <div className="tin-legend"><span><i className="fill-color" /> Fill — {tr(language, "to‘ldirish", "насыпь", "fill")}</span><span><i className="cut-color" /> Cut — {tr(language, "qazish", "выемка", "cut")}</span></div>
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
  const { language } = useLanguage();
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
        const localizedMessage = localizeKnownError(caught.message, language);
        const prefix = caught.line
          ? tr(language, `${caught.line}-qator: `, `Строка ${caught.line}: `, `Line ${caught.line}: `)
          : "";
        setError(`${prefix}${localizedMessage}`);
      } else {
        setError(caught instanceof Error ? localizeKnownError(caught.message, language) : tr(language, "Hajmni hisoblab bo‘lmadi.", "Не удалось рассчитать объём.", "Could not calculate volume."));
      }
    }
  };

  const report = result
    ? tr(language,
        `GeoCalc Cut & Fill hisoboti\nUsul: Delaunay TIN, chiziqli balandlik interpolatsiyasi\nCut: ${formatNumber(result.cut)} m³\nFill: ${formatNumber(result.fill)} m³\nBalans (Fill - Cut): ${formatNumber(result.net)} m³\nReja maydoni: ${formatNumber(result.planArea)} m²\nNuqtalar: ${result.points.length}\nUchburchaklar: ${result.triangles.length}`,
        `Отчёт GeoCalc Cut & Fill\nМетод: Delaunay TIN, линейная интерполяция высот\nCut: ${formatNumber(result.cut)} м³\nFill: ${formatNumber(result.fill)} м³\nБаланс (Fill - Cut): ${formatNumber(result.net)} м³\nПлощадь в плане: ${formatNumber(result.planArea)} м²\nТочки: ${result.points.length}\nТреугольники: ${result.triangles.length}`,
        `GeoCalc Cut & Fill report\nMethod: Delaunay TIN, linear elevation interpolation\nCut: ${formatNumber(result.cut)} m³\nFill: ${formatNumber(result.fill)} m³\nBalance (Fill - Cut): ${formatNumber(result.net)} m³\nPlan area: ${formatNumber(result.planArea)} m²\nPoints: ${result.points.length}\nTriangles: ${result.triangles.length}`
      )
    : "";

  return (
    <div className="volume-layout">
      <section className="panel volume-controls">
        <div className="panel-head panel-head--simple">
          <div><span className="step-chip">01</span><div><h2>{tr(language, "Hisob shartlarini tanlang", "Выберите параметры расчёта", "Choose calculation settings")}</h2><p>{tr(language, "Mahalliy X/Y yoki WGS84 nuqtalaridan foydalaning.", "Используйте локальные X/Y или точки WGS84.", "Use local X/Y or WGS84 points.")}</p></div></div>
        </div>

        <div className="segmented-label">{tr(language, "KOORDINATA TURI", "ТИП КООРДИНАТ", "COORDINATE TYPE")}</div>
        <div className="segmented-control">
          <button className={coordinateMode === "local" ? "is-active" : ""} onClick={() => { setCoordinateMode("local"); setResult(null); }}>{tr(language, "Mahalliy X / Y", "Локальные X / Y", "Local X / Y")}</button>
          <button className={coordinateMode === "wgs84" ? "is-active" : ""} onClick={() => { setCoordinateMode("wgs84"); setResult(null); }}>WGS84</button>
        </div>

        <div className="segmented-label">{tr(language, "LOYIHA YUZASI", "ПРОЕКТНАЯ ПОВЕРХНОСТЬ", "DESIGN SURFACE")}</div>
        <div className="segmented-control">
          <button className={designMode === "level" ? "is-active" : ""} onClick={() => { setDesignMode("level"); setResult(null); }}>{tr(language, "Tekis loyiha sathi", "Плоская проектная отметка", "Level design surface")}</button>
          <button className={designMode === "per-point" ? "is-active" : ""} onClick={() => { setDesignMode("per-point"); setResult(null); }}>{tr(language, "Har nuqtada Z", "Z для каждой точки", "Z at each point")}</button>
        </div>

        {designMode === "level" && (
          <label className="form-field volume-level"><span>{tr(language, "Loyiha balandligi, m", "Проектная отметка, м", "Design elevation, m")}</span><input value={designLevel} onChange={(event) => { setDesignLevel(event.target.value); setResult(null); }} inputMode="decimal" /></label>
        )}

        <div className="volume-format">
          <span>{coordinateMode === "wgs84" ? tr(language, "Kenglik  Uzunlik", "Широта  Долгота", "Latitude  Longitude") : "X  Y"}  {tr(language, "Mavjud Z", "Существующая Z", "Existing Z")}{designMode === "per-point" ? `  ${tr(language, "Loyiha Z", "Проектная Z", "Design Z")}` : ""}</span>
          <code>{coordinateMode === "wgs84" ? "41.311081 69.240562 100.40" : "0 0 100.40"}{designMode === "per-point" ? " 100.50" : ""}</code>
        </div>

        <label className="field-label" htmlFor="volume-points">{tr(language, "Balandlik nuqtalari", "Высотные точки", "Elevation points")}</label>
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
              setError(tr(language, "Fayl 1.5 MB dan kichik bo‘lishi kerak.", "Файл должен быть меньше 1,5 МБ.", "The file must be smaller than 1.5 MB."));
              return;
            }
            setValue(await file.text());
            setResult(null);
            setError("");
            notify(`${file.name} ${tr(language, "yuklandi", "загружен", "loaded")}`);
            event.target.value = "";
          }}
        />

        {error && <div className="inline-error"><Info size={17} /> {error}</div>}

        <div className="action-row">
          <button className="primary-button" onClick={calculate}>{tr(language, "Hajmni hisoblash", "Рассчитать объём", "Calculate volume")} <ArrowRight size={18} /></button>
          <button className="secondary-button" onClick={() => fileInput.current?.click()}><Upload size={17} /> CSV / XYZ</button>
        </div>
      </section>

      <section className="panel volume-preview-panel">
        <div className="panel-head panel-head--simple">
          <div><span className="step-chip">02</span><div><h2>{tr(language, "TIN yuzasini tekshiring", "Проверьте поверхность TIN", "Check the TIN surface")}</h2><p>{tr(language, "Nuqtalar Delaunay uchburchaklari bilan bog‘lanadi.", "Точки соединяются треугольниками Делоне.", "Points are connected with Delaunay triangles.")}</p></div></div>
        </div>
        <VolumePreview result={result} />
        <div className="method-note"><Layers3 size={18} /><span>{tr(language, "Aralash Cut/Fill uchburchaklari nol konturi bo‘yicha bo‘linadi. Bu chiziqli TIN sirtida hajmni alohida integrallaydi.", "Смешанные треугольники Cut/Fill разделяются по нулевому контуру. Это позволяет отдельно интегрировать объёмы на линейной поверхности TIN.", "Mixed Cut/Fill triangles are split along the zero contour, allowing the volumes to be integrated separately on the linear TIN surface.")}</span></div>
      </section>

      <AnimatePresence>
        {result && (
          <motion.section className="volume-results" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="volume-result-card volume-result-card--cut"><span><i /> CUT · {tr(language, "QAZISH", "ВЫЕМКА", "EXCAVATION")}</span><strong>{formatNumber(result.cut)}</strong><small>m³</small></div>
            <div className="volume-result-card volume-result-card--fill"><span><i /> FILL · {tr(language, "TO‘LDIRISH", "НАСЫПЬ", "FILL")}</span><strong>{formatNumber(result.fill)}</strong><small>m³</small></div>
            <div className="volume-result-card volume-result-card--net"><span>{tr(language, "BALANS", "БАЛАНС", "BALANCE")} · FILL − CUT</span><strong>{result.net > 0 ? "+" : ""}{formatNumber(result.net)}</strong><small>m³</small></div>
            <div className="volume-summary">
              <div><span>{tr(language, "Reja maydoni", "Площадь в плане", "Plan area")}</span><strong>{formatNumber(result.planArea)} m²</strong></div>
              <div><span>{tr(language, "TIN uchburchaklari", "Треугольники TIN", "TIN triangles")}</span><strong>{result.triangles.length}</strong></div>
              <div><span>{tr(language, "Balandlik nuqtalari", "Высотные точки", "Elevation points")}</span><strong>{result.points.length}</strong></div>
              <div className="volume-report-actions">
                <button className="icon-button" onClick={async () => { await copyToClipboard(report); notify(tr(language, "Hajm hisoboti nusxalandi", "Отчёт по объёму скопирован", "Volume report copied")); }} aria-label={tr(language, "Hisobotni nusxalash", "Скопировать отчёт", "Copy report")}><Copy size={18} /></button>
                <button className="icon-button" onClick={() => saveTextFile("geocalc-cut-fill-hisoboti.txt", report)} aria-label={tr(language, "Hisobotni yuklab olish", "Скачать отчёт", "Download report")}><Download size={18} /></button>
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

function readImage(file: File, language: AppLanguage) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",")[1] : value);
    };
    reader.onerror = () => reject(new Error(tr(language, "Rasmni o‘qib bo‘lmadi.", "Не удалось прочитать изображение.", "Could not read the image.")));
    reader.readAsDataURL(file);
  });
}

function ChatContact({ content }: { content: string }) {
  let body = content;
  for (const marker of GEOAI_CONTACT_MARKERS) {
    const index = body.indexOf(marker);
    if (index >= 0) body = body.slice(0, index);
  }
  return (
    <>
      <div className="message-text">{body.trim()}</div>
      <ContactCard compact />
    </>
  );
}

function GeoAIChat({ notify }: { notify: (message: string) => void }) {
  const { language } = useLanguage();
  const welcomeText = tr(
    language,
    "Assalomu alaykum! Men GeoAI. Menga istalgan savolni bering: umumiy bilim, matematika, dasturlash, tarjima, matn, fayl yoki rasm tahlili. Geodeziya, koordinatalar, KML/CSV/DXF va Cut & Fill bo‘yicha esa maxsus GeoCalc vositalarim bor.",
    "Здравствуйте! Я GeoAI. Задавайте любые вопросы: общие знания, математика, программирование, перевод, тексты, анализ файлов или изображений. Для геодезии, координат, KML/CSV/DXF и Cut & Fill у меня есть специальные инструменты GeoCalc.",
    "Hello! I’m GeoAI. Ask me anything: general knowledge, math, programming, translation, writing, file analysis, or image analysis. I also have specialized GeoCalc tools for geodesy, coordinates, KML/CSV/DXF, and Cut & Fill.",
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", content: welcomeText },
  ]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, sending]);

  useEffect(() => {
    setMessages((current) => current.map((message) =>
      message.id === "welcome" ? { ...message, content: welcomeText } : message,
    ));
  }, [welcomeText]);

  const attachFiles = async (files: FileList | null) => {
    if (!files) return;
    const room = Math.max(0, 4 - attachments.length);
    const selected = Array.from(files).slice(0, room);
    const next: PreparedAttachment[] = [];

    for (const file of selected) {
      try {
        if (file.type.startsWith("image/")) {
          if (file.size > 3_000_000) throw new Error(tr(language, "Rasm 3 MB dan kichik bo‘lishi kerak.", "Изображение должно быть меньше 3 МБ.", "The image must be smaller than 3 MB."));
          next.push({
            id: id(),
            kind: "image",
            name: file.name,
            mimeType: file.type || "image/jpeg",
            data: await readImage(file, language),
            sizeLabel: fileSize(file.size),
          });
        } else {
          if (file.size > 1_500_000) throw new Error(tr(language, "Matn fayli 1.5 MB dan kichik bo‘lishi kerak.", "Текстовый файл должен быть меньше 1,5 МБ.", "The text file must be smaller than 1.5 MB."));
          const content = await file.text();
          if (content.length > 350_000) throw new Error(tr(language, "Fayl matni juda katta.", "Текст файла слишком большой.", "The file text is too large."));
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
        notify(caught instanceof Error ? caught.message : `${file.name} ${tr(language, "o‘qilmadi", "не удалось прочитать", "could not be read")}`);
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
      content: message || tr(language, "Biriktirilgan faylni tahlil qiling.", "Проанализируйте прикреплённый файл.", "Analyze the attached file."),
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
        throw new Error(tr(language, "GeoAI dan foydalanish uchun Google orqali qayta kiring.", "Чтобы пользоваться GeoAI, снова войдите через Google.", "Sign in with Google again to use GeoAI."));
      }
      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/geoai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "x-geocalc-language": language,
        },
        body: JSON.stringify({
          message: userMessage.content,
          history: historyForApi,
          attachments: payloadAttachments,
          language,
        }),
      });
      const payload = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !payload.answer) {
        throw new Error(payload.error || tr(language, "GeoAI javob bermadi.", "GeoAI не ответил.", "GeoAI did not respond."));
      }
      setMessages((current) => [
        ...current,
        { id: id(), role: "assistant", content: payload.answer as string },
      ]);
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : tr(language, "GeoAI bilan bog‘lanib bo‘lmadi.", "Не удалось подключиться к GeoAI.", "Could not connect to GeoAI.");
      setMessages((current) => [
        ...current,
        { id: id(), role: "assistant", content: text },
      ]);
    } finally {
      setSending(false);
    }
  };

  const quickPrompts = [
    tr(language, "Bugungi eng muhim texnologiya yangiliklarini ayt", "Расскажи о главных технологических новостях сегодня", "Tell me today’s top technology news"),
    tr(language, "Python kodimdagi xatoni topishga yordam ber", "Помоги найти ошибку в моём Python-коде", "Help me find the bug in my Python code"),
    tr(language, "WGS84 va UTM farqini sodda tushuntir", "Просто объясни разницу между WGS84 и UTM", "Explain the difference between WGS84 and UTM simply"),
  ];

  return (
    <div className="geoai-layout">
      <section className="geoai-chat panel">
        <div className="chat-head">
          <div className="geoai-avatar"><Sparkles size={21} /></div>
          <div><strong>GeoAI</strong><span><i /> Beta · {tr(language, "Hozircha tekin", "Пока бесплатно", "Free for now")}</span></div>
          <div className="chat-security"><ShieldCheck size={15} /> {tr(language, "Kalit serverda himoyalangan", "Ключ защищён на сервере", "Key protected on server")}</div>
        </div>

        <div className="messages" aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className={`message-row message-row--${message.role}`}>
              {message.role === "assistant" && <div className="message-avatar"><Bot size={17} /></div>}
              <div className="message-stack">
                <div className="message-meta">{message.role === "assistant" ? "GeoAI" : tr(language, "Siz", "Вы", "You")}</div>
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
                <button onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))} aria-label={`${attachment.name} ${tr(language, "ni olib tashlash", "— удалить", "— remove")}`}><X size={15} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="chat-composer">
          <input ref={fileInput} className="visually-hidden" type="file" multiple accept=".kml,.csv,.dxf,.txt,.xyz,image/png,image/jpeg,image/webp" onChange={(event) => attachFiles(event.target.files)} />
          <button className="composer-attach" onClick={() => fileInput.current?.click()} aria-label={tr(language, "Fayl biriktirish", "Прикрепить файл", "Attach file")} title={tr(language, "KML, CSV, DXF yoki rasm", "KML, CSV, DXF или изображение", "KML, CSV, DXF, or image")}><Paperclip size={20} /></button>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder={tr(language, "GeoAI’ga istalgan savolingizni yozing…", "Напишите GeoAI любой вопрос…", "Ask GeoAI anything…")}
            rows={1}
          />
          <button className="composer-send" disabled={sending || (!input.trim() && !attachments.length)} onClick={() => void send()} aria-label={tr(language, "Yuborish", "Отправить", "Send")}>
            {sending ? <LoaderCircle className="spin" size={19} /> : <Send size={19} />}
          </button>
        </div>
        <div className="composer-note">{tr(language, "Enter — yuborish · Shift + Enter — yangi qator · Eng ko‘pi 4 ta fayl", "Enter — отправить · Shift + Enter — новая строка · До 4 файлов", "Enter — send · Shift + Enter — new line · Up to 4 files")}</div>
      </section>

      <aside className="geoai-side">
        <div className="panel capability-card">
          <span className="side-eyebrow">{tr(language, "GEOAI NIMALARNI BILADI?", "ЧТО УМЕЕТ GEOAI?", "WHAT CAN GEOAI DO?")}</span>
          <ul>
            <li><Sparkles size={17} /><span><strong>{tr(language, "Universal yordamchi", "Универсальный помощник", "Universal assistant")}</strong>{tr(language, "Ta’lim, matn, tarjima, g‘oya va umumiy savollar", "Учёба, тексты, перевод, идеи и общие вопросы", "Learning, writing, translation, ideas, and general questions")}</span></li>
            <li><FileText size={17} /><span><strong>{tr(language, "Kod va fayllar", "Код и файлы", "Code and files")}</strong>{tr(language, "Kod, KML, CSV, DXF, TXT va XYZ tahlili", "Анализ кода, KML, CSV, DXF, TXT и XYZ", "Analysis of code, KML, CSV, DXF, TXT, and XYZ")}</span></li>
            <li><ImageIcon size={17} /><span><strong>{tr(language, "Rasm tahlili", "Анализ изображений", "Image analysis")}</strong>{tr(language, "JPG, PNG va WebP rasmlaridagi ma’lumotni tushunish", "Понимание информации на изображениях JPG, PNG и WebP", "Understand information in JPG, PNG, and WebP images")}</span></li>
            <li><MapPin size={17} /><span><strong>{tr(language, "GeoCalc ekspertizasi", "Экспертиза GeoCalc", "GeoCalc expertise")}</strong>WGS84, UTM, DMS, {tr(language, "maydon", "площадь", "area")} {tr(language, "va", "и", "and")} Cut & Fill</span></li>
          </ul>
        </div>
        <div className="panel privacy-card">
          <ShieldCheck size={22} />
          <div><strong>{tr(language, "Maxfiylik eslatmasi", "Напоминание о конфиденциальности", "Privacy reminder")}</strong><p>{tr(language, "Hujjat yuborishdan oldin maxfiy kadastr yoki shaxsiy ma’lumotlarni olib tashlang.", "Перед отправкой документа удалите конфиденциальные кадастровые или персональные данные.", "Remove confidential cadastral or personal data before uploading a document.")}</p></div>
        </div>
        <ContactCard />
      </aside>
    </div>
  );
}

function Guide() {
  const { language } = useLanguage();
  const steps = [
    { number: "01", icon: MapPin, title: tr(language, "Ma’lumotni tayyorlang", "Подготовьте данные", "Prepare the data"), text: tr(language, "Maydon uchun lat/lon, hajm uchun esa X/Y/Z nuqtalarini bir qatordan kiriting.", "Для площади вводите lat/lon, а для объёма — точки X/Y/Z по одной строке на точку.", "For area, enter lat/lon; for volume, enter X/Y/Z points one point per line.") },
    { number: "02", icon: Triangle, title: tr(language, "Shakl yoki TIN ni tekshiring", "Проверьте контур или TIN", "Check the shape or TIN"), text: tr(language, "Nuqtalar tartibi, takrorlangan qiymatlar va hosil bo‘lgan yuzani ko‘zdan kechiring.", "Проверьте порядок точек, дубликаты и получившуюся поверхность.", "Check point order, duplicate values, and the resulting surface.") },
    { number: "03", icon: Check, title: tr(language, "Natijani saqlang", "Сохраните результат", "Save the result"), text: tr(language, "Birliklarni tekshiring, nusxa oling yoki matn hisoboti sifatida yuklab oling.", "Проверьте единицы, скопируйте результат или скачайте текстовый отчёт.", "Check the units, copy the result, or download it as a text report.") },
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
              <div><h2>{step.title}</h2><p>{step.text}</p></div>
            </motion.article>
          );
        })}
      </section>

      <section className="panel guide-table-card">
        <div className="panel-head panel-head--simple"><div><span className="step-chip">A</span><div><h2>{tr(language, "Qaysi format qayerda ishlatiladi?", "Где используется каждый формат?", "Where is each format used?")}</h2><p>{tr(language, "Fayl va koordinata turini bo‘limga mos tanlang.", "Выберите тип файла и координат в соответствии с разделом.", "Choose the file and coordinate type that matches the section.")}</p></div></div></div>
        <div className="format-table" role="table">
          <div className="format-row format-row--head" role="row"><span>{tr(language, "Format", "Формат", "Format")}</span><span>{tr(language, "Qayerda", "Где", "Where")}</span><span>{tr(language, "Misol / izoh", "Пример / пояснение", "Example / note")}</span></div>
          <div className="format-row" role="row"><strong>WGS84</strong><span>{tr(language, "Yuza va hajm", "Площадь и объём", "Area and volume")}</span><code>41.311081 69.240562</code></div>
          <div className="format-row" role="row"><strong>{tr(language, "Mahalliy X/Y/Z", "Локальные X/Y/Z", "Local X/Y/Z")}</strong><span>Cut & Fill</span><code>1000 2000 102.45</code></div>
          <div className="format-row" role="row"><strong>KML</strong><span>GeoAI</span><span>{tr(language, "Chegara va nuqtalar", "Границы и точки", "Boundaries and points")}</span></div>
          <div className="format-row" role="row"><strong>CSV / XYZ</strong><span>{tr(language, "Hajm va GeoAI", "Объём и GeoAI", "Volume and GeoAI")}</span><span>{tr(language, "Jadval ko‘rinishidagi nuqtalar", "Точки в табличном виде", "Points in table form")}</span></div>
          <div className="format-row" role="row"><strong>DXF</strong><span>GeoAI</span><span>{tr(language, "Matnli ASCII DXF tavsiya etiladi", "Рекомендуется текстовый ASCII DXF", "Text-based ASCII DXF is recommended")}</span></div>
          <div className="format-row" role="row"><strong>JPG / PNG</strong><span>GeoAI OCR</span><span>{tr(language, "Aniq va tekis olingan rasm", "Чёткое изображение без наклона", "A clear, straight image")}</span></div>
        </div>
      </section>

      <div className="guide-notes">
        <article className="panel note-card"><Calculator size={22} /><div><h3>{tr(language, "Maydon algoritmi saqlangan", "Алгоритм площади сохранён", "Area algorithm preserved")}</h3><p>{tr(language, "Asl GeoCalc WGS84 → UTM zona tanlovi va Shoelace formulasi o‘zgartirilmagan.", "Исходный выбор зоны WGS84 → UTM и формула Shoelace в GeoCalc не изменены.", "The original GeoCalc WGS84 → UTM zone selection and Shoelace formula are unchanged.")}</p></div></article>
        <article className="panel note-card"><Layers3 size={22} /><div><h3>{tr(language, "Cut & Fill nimani anglatadi?", "Что означает Cut & Fill?", "What does Cut & Fill mean?")}</h3><p>{tr(language, "Cut — qazib olinadigan, Fill — to‘ldiriladigan hajm. Balans Fill minus Cut sifatida ko‘rsatiladi.", "Cut — объём выемки, Fill — объём насыпи. Баланс отображается как Fill минус Cut.", "Cut is excavation volume, Fill is embankment volume. Balance is shown as Fill minus Cut.")}</p></div></article>
        <article className="panel note-card"><ShieldCheck size={22} /><div><h3>{tr(language, "Muhim tekshiruv", "Важная проверка", "Important verification")}</h3><p>{tr(language, "Kadastr yoki qurilish qarori oldidan natijani sertifikatlangan geodezist bilan tekshiring.", "Перед кадастровым или строительным решением проверьте результат у сертифицированного геодезиста.", "Before cadastral or construction decisions, verify the result with a certified surveyor.")}</p></div></article>
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
  const { language } = useLanguage();
  return (
    <section className="panel history-panel">
      <div className="history-head">
        <div><History size={21} /><div><h2>{tr(language, "Mahalliy hisoblash tarixi", "Локальная история расчётов", "Local calculation history")}</h2><p>{tr(language, "Eng so‘nggi 40 ta natija shu qurilmada saqlanadi.", "Последние 40 результатов хранятся на этом устройстве.", "The latest 40 results are stored on this device.")}</p></div></div>
        {records.length > 0 && <button className="secondary-button" onClick={onClear}><Trash2 size={17} /> {tr(language, "Tarixni tozalash", "Очистить историю", "Clear history")}</button>}
      </div>
      {records.length === 0 ? (
        <div className="history-empty-state"><History size={36} /><strong>{tr(language, "Hali natija yo‘q", "Результатов пока нет", "No results yet")}</strong><span>{tr(language, "Maydon, konvertor yoki hajm hisoblang — natija bu yerda paydo bo‘ladi.", "Рассчитайте площадь, выполните конвертацию или объём — результат появится здесь.", "Calculate area, convert coordinates, or calculate volume — the result will appear here.")}</span></div>
      ) : (
        <div className="history-records">
          {records.map((record) => (
            <article key={record.id} className="history-record">
              <div className="history-record-icon">{record.type.includes("Cut") ? <BoxIcon size={18} /> : record.type.includes("GMS") || record.type.includes("DMS") || record.type.includes("O‘nli") ? <RefreshCw size={18} /> : <Calculator size={18} />}</div>
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
  const [language, setLanguageState] = useState<AppLanguage>("uz");
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
      const savedLanguage = localStorage.getItem("geocalc_language");
      const nextLanguage: AppLanguage = savedLanguage === "ru" || savedLanguage === "en" || savedLanguage === "uz"
        ? savedLanguage
        : detectBrowserLanguage();
      setTheme(savedTheme);
      setLanguageState(nextLanguage);
      document.documentElement.dataset.theme = savedTheme;
      document.documentElement.lang = nextLanguage;
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
          ? tr(language, "Bu domen Firebase’da ruxsat etilmagan. Firebase Console → Authentication → Authorized domains bo‘limiga sayt domenini qo‘shing.", "Этот домен не разрешён в Firebase. Добавьте домен сайта в Firebase Console → Authentication → Authorized domains.", "This domain is not authorized in Firebase. Add the site domain in Firebase Console → Authentication → Authorized domains.")
          : tr(language, "Google kirishni yakunlab bo‘lmadi. Qayta urinib ko‘ring.", "Не удалось завершить вход через Google. Попробуйте снова.", "Could not complete Google sign-in. Try again."),
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
  }, [language]);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    document.documentElement.lang = nextLanguage;
    localStorage.setItem("geocalc_language", nextLanguage);
  }, []);

  const languageContextValue = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

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
          date: new Intl.DateTimeFormat(localeFor(language), {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date()),
        },
        ...current,
      ].slice(0, 40);
      localStorage.setItem(historyKey, JSON.stringify(next));
      return next;
    });
  }, [historyKey, language]);

  const clearHistory = () => {
    localStorage.removeItem(historyKey);
    setHistory([]);
    notify(tr(language, "Tarix tozalandi", "История очищена", "History cleared"));
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
        setAuthError(tr(language, "Google oynasi yopildi. Kirish uchun tugmani yana bosing.", "Окно Google было закрыто. Нажмите кнопку входа ещё раз.", "The Google window was closed. Click the sign-in button again."));
      } else if (code === "auth/unauthorized-domain") {
        setAuthError(
          tr(language, "Bu domen Firebase’da ruxsat etilmagan. Firebase Console → Authentication → Authorized domains bo‘limiga sayt domenini qo‘shing.", "Этот домен не разрешён в Firebase. Добавьте домен сайта в Firebase Console → Authentication → Authorized domains.", "This domain is not authorized in Firebase. Add the site domain in Firebase Console → Authentication → Authorized domains."),
        );
      } else if (code === "auth/operation-not-allowed") {
        setAuthError(tr(language, "Firebase Authentication ichida Google provayderini yoqing.", "Включите провайдер Google в Firebase Authentication.", "Enable the Google provider in Firebase Authentication."));
      } else {
        setAuthError(tr(language, "Google orqali kirishda xato yuz berdi. Internetni tekshirib, qayta urinib ko‘ring.", "Произошла ошибка при входе через Google. Проверьте интернет и повторите попытку.", "An error occurred while signing in with Google. Check your internet connection and try again."));
      }
    }
  };

  const logOut = async () => {
    try {
      await signOut(firebaseAuth);
      setMobileNav(false);
    } catch {
      notify(tr(language, "Hisobdan chiqib bo‘lmadi. Qayta urinib ko‘ring.", "Не удалось выйти из аккаунта. Попробуйте снова.", "Could not sign out. Try again."));
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
      <LanguageContext.Provider value={languageContextValue}>
        <AuthScreen
          checking={!authReady}
          busy={authBusy}
          error={authError}
          onSignIn={signIn}
        />
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={languageContextValue}>
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
          <button className="icon-button" onClick={() => setMobileNav(true)} aria-label={tr(language, "Menyuni ochish", "Открыть меню", "Open menu")}><Menu size={21} /></button>
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
    </LanguageContext.Provider>
  );
}
