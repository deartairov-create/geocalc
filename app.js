document.addEventListener("DOMContentLoaded", () => {
  const firebaseConfig = {
    apiKey: "AIzaSyAlAkhctwyK52iZH0Wa57nMH_yM74A3HAU",
    authDomain: "geocalc-64d8b.firebaseapp.com",
    projectId: "geocalc-64d8b",
    storageBucket: "geocalc-64d8b.firebasestorage.app",
    messagingSenderId: "834604276162",
    appId: "1:834604276162:web:e9fe5688c5a3d0d8871e5b",
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const auth = firebase.auth();

  if (typeof proj4 !== "undefined") {
    proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs +type=crs");
    proj4.defs("EPSG:32641", "+proj=utm +zone=41 +datum=WGS84 +units=m +no_defs +type=crs");
    proj4.defs("EPSG:32642", "+proj=utm +zone=42 +datum=WGS84 +units=m +no_defs +type=crs");
    proj4.defs("EPSG:32643", "+proj=utm +zone=43 +datum=WGS84 +units=m +no_defs +type=crs");
  }

  const pages = {
    login: document.getElementById("loginPage"),
    home: document.getElementById("homePage"),
    profile: document.getElementById("profilePage"),
    area: document.getElementById("areaPage"),
    converter: document.getElementById("converterPage"),
  };

  const topbar = document.getElementById("topbar");
  const logoSub = document.getElementById("logoSub");

  const googleLoginBtn = document.getElementById("googleLoginBtn");
  const profileBtn = document.getElementById("profileBtn");
  const backHomeBtn = document.getElementById("backHomeBtn");
  const signOutBtn = document.getElementById("signOutBtn");
  const themeToggle = document.getElementById("themeToggle");
  const languageSelect = document.getElementById("languageSelect");
  const historyBtn = document.getElementById("historyBtn");

  const areaBtn = document.getElementById("areaBtn");
  const convertBtn = document.getElementById("convertBtn");
  const backFromArea = document.getElementById("backFromArea");
  const backFromConverter = document.getElementById("backFromConverter");

  const calculateAreaBtn = document.getElementById("calculateAreaBtn");
  const clearAreaBtn = document.getElementById("clearAreaBtn");
  const coordsInput = document.getElementById("coordsInput");
  const areaHint = document.getElementById("areaHint");
  const areaError = document.getElementById("areaError");
  const areaResult = document.getElementById("areaResult");
  const resultM2 = document.getElementById("resultM2");
  const resultHa = document.getElementById("resultHa");
  const resultKm2 = document.getElementById("resultKm2");
  const resultPoints = document.getElementById("resultPoints");
  const resultPointsLabel = document.getElementById("resultPointsLabel");
  const resultHaUnit = document.getElementById("resultHaUnit");

  const shapeCanvas = document.getElementById("shapeCanvas");
  const shapeCtx = shapeCanvas ? shapeCanvas.getContext("2d") : null;

  const profileName = document.getElementById("profileName");
  const profileEmail = document.getElementById("profileEmail");
  const profileAvatar = document.getElementById("profileAvatar");

  const historyList = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");

  const ddInput = document.getElementById("ddInput");
  const ddType = document.getElementById("ddType");
  const convertToDmsBtn = document.getElementById("convertToDmsBtn");
  const copyDmsBtn = document.getElementById("copyDmsBtn");
  const dmsResult = document.getElementById("dmsResult");

  const degInput = document.getElementById("degInput");
  const minInput = document.getElementById("minInput");
  const secInput = document.getElementById("secInput");
  const hemisphereSelect = document.getElementById("hemisphereSelect");
  const convertToDdBtn = document.getElementById("convertToDdBtn");
  const copyDdBtn = document.getElementById("copyDdBtn");
  const ddResult = document.getElementById("ddResult");

  const i18n = {
    uz: {
      appTitle: "GeoCalc",
      logoSub: "(Maydon yuzasini hisoblash)",
      loginDesc: "Koordinata va maydon hisoblash platformasi",
      googleBtnText: "Google orqali kirish",
      profileBtn: "Profil",

      areaBtnTitle: "1. Yuza hisoblash",
      areaBtnSub: "WGS84 · m² · km² · gektar",
      convertBtnTitle: "2. Konvertor",
      convertBtnSub: "O‘nli gradus ↔ GMS va nusxa olish",
      thirdBtnTitle: "3. Hajmni hisoblash",
      thirdBtnSub: "Tez orada qo‘shiladi",

      historyLabel: "Tarix",
      historyBtn: "Ochish",
      historyTitle: "Tarix",
      historyEmpty: "Hali tarix yo‘q",
      clearHistoryBtn: "Tarixni tozalash",

      languageLabel: "Til",
      themeLabel: "Kun / Tun",
      themeToggle: "Kun / Tun",
      backHomeBtn: "Bosh sahifa",
      signOutBtn: "Chiqish",

      areaPageTitle: "Yuza hisoblash",
      areaPageDesc:
        "Nuqtalarni har qatorda kiriting:\nXX.XXXXXXX YY.YYYYYYY\nyoki\nXX.XXXXXXX, YY.YYYYYYY",
      areaHint: "Hisoblash faqat WGS 84 koordinatalari asosida bajariladi.",
      coordsPlaceholder:
        "XX.XXXXXXX YY.YYYYYYY\nXX.XXXXXXX YY.YYYYYYY\nXX.XXXXXXX YY.YYYYYYY\nXX.XXXXXXX YY.YYYYYYY",
      calculateAreaBtn: "Hisoblash",
      clearAreaBtn: "Tozalash",
      backFromArea: "Ortga",
      resultPointsLabel: "Nuqtalar soni",
      hectareUnit: "gektar",

      converterPageTitle: "Konvertor",
      converterPageDesc: "O‘nli gradus va gradus-minut-sekund formatlari orasida o‘tkazish.",
      converterBlock1Title: "O‘nli gradus → GMS",
      ddInputLabel: "O‘nli qiymat",
      ddInputPlaceholder: "61.05164",
      ddTypeLabel: "Turi",
      ddTypeLon: "Uzunlik",
      ddTypeLat: "Kenglik",
      convertToDmsBtn: "GMS ga o‘tkazish",
      copyDmsBtn: "Nusxa olish",
      dmsResultLabel: "GMS natija",
      converterBlock2Title: "GMS → O‘nli gradus",
      degInputLabel: "Gradus",
      minInputLabel: "Minut",
      secInputLabel: "Sekund",
      hemisphereLabel: "Yo‘nalish",
      convertToDdBtn: "O‘nli gradusga o‘tkazish",
      copyDdBtn: "Nusxa olish",
      ddResultLabel: "O‘nli natija",
      backFromConverter: "Ortga",

      areaEmpty: "Avval koordinatalarni kiriting.",
      areaNeed3: "Yuza hisoblash uchun kamida 3 ta nuqta kerak.",
      areaLineError: "qatorda koordinata to‘liq emas.",
      areaNumberError: "qatorda son noto‘g‘ri.",
      areaLatError: "qatorda kenglik noto‘g‘ri.",
      areaLonError: "qatorda uzunlik noto‘g‘ri.",
      copySuccess: "Nusxa olindi.",
      copyFailed: "Nusxa olib bo‘lmadi.",
      historyCleared: "Tarix tozalandi.",
      loginError: "Google login ishlamadi.",
      popupBlocked: "Popup bloklandi. Redirect orqali davom etiladi.",
      areaType: "Yuza",
      ddToDmsType: "O‘nli gradus → GMS",
      dmsToDdType: "GMS → O‘nli gradus",
    },

    en: {
      appTitle: "GeoCalc",
      logoSub: "(Area calculation)",
      loginDesc: "Coordinate and area calculation platform",
      googleBtnText: "Sign in with Google",
      profileBtn: "Profile",

      areaBtnTitle: "1. Area Calculation",
      areaBtnSub: "WGS84 · m² · km² · hectare",
      convertBtnTitle: "2. Converter",
      convertBtnSub: "Decimal Degrees ↔ DMS and copy",
      thirdBtnTitle: "Volume Calculation",
      thirdBtnSub: "Coming soon",

      historyLabel: "History",
      historyBtn: "Open",
      historyTitle: "History",
      historyEmpty: "No history yet",
      clearHistoryBtn: "Clear history",

      languageLabel: "Language",
      themeLabel: "Day / Night",
      themeToggle: "Day / Night",
      backHomeBtn: "Home",
      signOutBtn: "Sign out",

      areaPageTitle: "Area Calculation",
      areaPageDesc:
        "Enter points line by line:\nXX.XXXXXXX YY.YYYYYYY\nor\nXX.XXXXXXX, YY.YYYYYYY",
      areaHint: "Calculation is performed only using WGS 84 coordinates.",
      coordsPlaceholder:
        "XX.XXXXXXX YY.YYYYYYY\nXX.XXXXXXX YY.YYYYYYY\nXX.XXXXXXX YY.YYYYYYY\nXX.XXXXXXX YY.YYYYYYY",
      calculateAreaBtn: "Calculate",
      clearAreaBtn: "Clear",
      backFromArea: "Back",
      resultPointsLabel: "Points count",
      hectareUnit: "hectare",

      converterPageTitle: "Converter",
      converterPageDesc: "Convert between Decimal Degrees and DMS formats.",
      converterBlock1Title: "Decimal Degrees → DMS",
      ddInputLabel: "Decimal value",
      ddInputPlaceholder: "61.05164",
      ddTypeLabel: "Type",
      ddTypeLon: "Longitude",
      ddTypeLat: "Latitude",
      convertToDmsBtn: "Convert to DMS",
      copyDmsBtn: "Copy",
      dmsResultLabel: "DMS result",
      converterBlock2Title: "DMS → Decimal Degrees",
      degInputLabel: "Degrees",
      minInputLabel: "Minutes",
      secInputLabel: "Seconds",
      hemisphereLabel: "Direction",
      convertToDdBtn: "Convert to Decimal",
      copyDdBtn: "Copy",
      ddResultLabel: "Decimal result",
      backFromConverter: "Back",

      areaEmpty: "Enter coordinates first.",
      areaNeed3: "At least 3 points are required to calculate area.",
      areaLineError: "line has incomplete coordinates.",
      areaNumberError: "line has invalid number.",
      areaLatError: "line has invalid latitude.",
      areaLonError: "line has invalid longitude.",
      copySuccess: "Copied.",
      copyFailed: "Copy failed.",
      historyCleared: "History cleared.",
      loginError: "Google login failed.",
      popupBlocked: "Popup was blocked. Continuing with redirect.",
      areaType: "Area",
      ddToDmsType: "Decimal Degrees → DMS",
      dmsToDdType: "DMS → Decimal Degrees",
    },

    ru: {
      appTitle: "GeoCalc",
      logoSub: "(Расчёт площади участка)",
      loginDesc: "Платформа для расчёта координат и площади",
      googleBtnText: "Войти через Google",
      profileBtn: "Профиль",

      areaBtnTitle: "1. Расчёт площади",
      areaBtnSub: "WGS84 · м² · км² · гектар",
      convertBtnTitle: "2. Конвертер",
      convertBtnSub: "Десятичные градусы ↔ ГМС и копирование",
      thirdBtnTitle: "3. Расчёт объёма",
      thirdBtnSub: "Скоро будет доступно",

      historyLabel: "История",
      historyBtn: "Открыть",
      historyTitle: "История",
      historyEmpty: "Истории пока нет",
      clearHistoryBtn: "Очистить историю",

      languageLabel: "Язык",
      themeLabel: "День / Ночь",
      themeToggle: "День / Ночь",
      backHomeBtn: "Главная",
      signOutBtn: "Выйти",

      areaPageTitle: "Расчёт площади",
      areaPageDesc:
        "Введите точки построчно:\nXX.XXXXXXX YY.YYYYYYY\nили\nXX.XXXXXXX, YY.YYYYYYY",
      areaHint: "Расчёт выполняется только по координатам WGS 84.",
      coordsPlaceholder:
        "XX.XXXXXXX YY.YYYYYYY\nXX.XXXXXXX YY.YYYYYYY\nXX.XXXXXXX YY.YYYYYYY\nXX.XXXXXXX YY.YYYYYYY",
      calculateAreaBtn: "Рассчитать",
      clearAreaBtn: "Очистить",
      backFromArea: "Назад",
      resultPointsLabel: "Количество точек",
      hectareUnit: "гектар",

      converterPageTitle: "Конвертер",
      converterPageDesc: "Преобразование между десятичными градусами и форматом ГМС.",
      converterBlock1Title: "Десятичные градусы → ГМС",
      ddInputLabel: "Десятичное значение",
      ddInputPlaceholder: "61.05164",
      ddTypeLabel: "Тип",
      ddTypeLon: "Долгота",
      ddTypeLat: "Широта",
      convertToDmsBtn: "Перевести в ГМС",
      copyDmsBtn: "Копировать",
      dmsResultLabel: "Результат ГМС",
      converterBlock2Title: "ГМС → Десятичные градусы",
      degInputLabel: "Градусы",
      minInputLabel: "Минуты",
      secInputLabel: "Секунды",
      hemisphereLabel: "Направление",
      convertToDdBtn: "Перевести в десятичный вид",
      copyDdBtn: "Копировать",
      ddResultLabel: "Десятичный результат",
      backFromConverter: "Назад",

      areaEmpty: "Сначала введите координаты.",
      areaNeed3: "Для расчёта площади нужно минимум 3 точки.",
      areaLineError: "строка содержит неполные координаты.",
      areaNumberError: "строка содержит неверное число.",
      areaLatError: "строка содержит неверную широту.",
      areaLonError: "строка содержит неверную долготу.",
      copySuccess: "Скопировано.",
      copyFailed: "Не удалось скопировать.",
      historyCleared: "История очищена.",
      loginError: "Ошибка входа через Google.",
      popupBlocked: "Popup был заблокирован. Продолжаем через redirect.",
      areaType: "Площадь",
      ddToDmsType: "Десятичные градусы → ГМС",
      dmsToDdType: "ГМС → Десятичные градусы",
    },
  };

  let currentUser = null;

  function currentLang() {
    return localStorage.getItem("geocalc_lang") || "uz";
  }

  function t(key) {
    const lang = currentLang();
    return (i18n[lang] && i18n[lang][key]) || i18n.uz[key] || key;
  }

  function hideAllPages() {
    Object.values(pages).forEach((page) => {
      if (page) page.classList.add("hidden");
    });
  }

  function showPage(pageName) {
    hideAllPages();

    if (pages[pageName]) {
      pages[pageName].classList.remove("hidden");
    }

    if (pageName === "login") {
      topbar.classList.add("hidden");
    } else {
      topbar.classList.remove("hidden");
    }

    if (pageName === "profile") {
      renderHistory();
    }
  }

  function setMultilineText(elementId, text) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = String(text).replace(/\n/g, "<br>");
  }

  function applyLanguage(lang) {
    const dict = i18n[lang] || i18n.uz;
    document.documentElement.lang = lang;

    document.getElementById("appTitle").textContent = dict.appTitle;
    document.getElementById("loginDesc").textContent = dict.loginDesc;
    document.getElementById("googleBtnText").textContent = dict.googleBtnText;
    profileBtn.textContent = dict.profileBtn;
    if (logoSub) logoSub.textContent = dict.logoSub;

    document.getElementById("areaBtnTitle").textContent = dict.areaBtnTitle;
    document.getElementById("areaBtnSub").textContent = dict.areaBtnSub;
    document.getElementById("convertBtnTitle").textContent = dict.convertBtnTitle;
    document.getElementById("convertBtnSub").textContent = dict.convertBtnSub;
    document.getElementById("thirdBtnTitle").textContent = dict.thirdBtnTitle;
    document.getElementById("thirdBtnSub").textContent = dict.thirdBtnSub;

    document.getElementById("historyLabel").textContent = dict.historyLabel;
    historyBtn.textContent = dict.historyBtn;
    document.getElementById("historyTitle").textContent = dict.historyTitle;
    clearHistoryBtn.textContent = dict.clearHistoryBtn;

    document.getElementById("languageLabel").textContent = dict.languageLabel;
    document.getElementById("themeLabel").textContent = dict.themeLabel;
    themeToggle.textContent = dict.themeToggle;
    backHomeBtn.textContent = dict.backHomeBtn;
    signOutBtn.textContent = dict.signOutBtn;

    document.getElementById("areaPageTitle").textContent = dict.areaPageTitle;
    setMultilineText("areaPageDesc", dict.areaPageDesc);
    areaHint.textContent = dict.areaHint;
    coordsInput.placeholder = dict.coordsPlaceholder;
    calculateAreaBtn.textContent = dict.calculateAreaBtn;
    clearAreaBtn.textContent = dict.clearAreaBtn;
    backFromArea.textContent = dict.backFromArea;
    resultPointsLabel.textContent = dict.resultPointsLabel;
    resultHaUnit.textContent = dict.hectareUnit;

    document.getElementById("converterPageTitle").textContent = dict.converterPageTitle;
    document.getElementById("converterPageDesc").textContent = dict.converterPageDesc;
    document.getElementById("converterBlock1Title").textContent = dict.converterBlock1Title;
    document.getElementById("ddInputLabel").textContent = dict.ddInputLabel;
    ddInput.placeholder = dict.ddInputPlaceholder;
    document.getElementById("ddTypeLabel").textContent = dict.ddTypeLabel;
    ddType.options[0].text = dict.ddTypeLon;
    ddType.options[1].text = dict.ddTypeLat;

    convertToDmsBtn.textContent = dict.convertToDmsBtn;
    copyDmsBtn.textContent = dict.copyDmsBtn;
    document.getElementById("dmsResultLabel").textContent = dict.dmsResultLabel;

    document.getElementById("converterBlock2Title").textContent = dict.converterBlock2Title;
    document.getElementById("degInputLabel").textContent = dict.degInputLabel;
    document.getElementById("minInputLabel").textContent = dict.minInputLabel;
    document.getElementById("secInputLabel").textContent = dict.secInputLabel;
    document.getElementById("hemisphereLabel").textContent = dict.hemisphereLabel;
    convertToDdBtn.textContent = dict.convertToDdBtn;
    copyDdBtn.textContent = dict.copyDdBtn;
    document.getElementById("ddResultLabel").textContent = dict.ddResultLabel;
    backFromConverter.textContent = dict.backFromConverter;

    renderHistory();
  }

  function applySavedTheme() {
    const savedTheme = localStorage.getItem("geocalc_theme") || "dark";
    document.body.classList.remove("light", "dark");
    document.body.classList.add(savedTheme);
  }

  function toggleTheme() {
    const isLight = document.body.classList.contains("light");
    const newTheme = isLight ? "dark" : "light";
    document.body.classList.remove("light", "dark");
    document.body.classList.add(newTheme);
    localStorage.setItem("geocalc_theme", newTheme);

    const savedPoints = parseCoordinatesSafe(coordsInput ? coordsInput.value.trim() : "");
    if (savedPoints.length >= 2) {
      drawPolygonPreview(savedPoints);
    } else {
      clearCanvas();
    }
  }

  async function realGoogleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      await auth.signInWithPopup(provider);
    } catch (error) {
      console.error("Popup login error:", error);

      const fallbackCodes = [
        "auth/popup-blocked",
        "auth/popup-closed-by-user",
        "auth/cancelled-popup-request",
      ];

      if (fallbackCodes.includes(error.code)) {
        alert(t("popupBlocked"));
        try {
          await auth.signInWithRedirect(provider);
        } catch (redirectError) {
          console.error("Redirect login error:", redirectError);
          alert(`${t("loginError")} (${redirectError.code || "unknown"})`);
        }
        return;
      }

      alert(`${t("loginError")} (${error.code || "unknown"})`);
    }
  }

  function setCurrentUser(user) {
    currentUser = user
      ? {
          uid: user.uid,
          name: user.displayName || "User",
          email: user.email || "",
          photo: user.photoURL || "https://via.placeholder.com/84/1e293b/ffffff?text=G",
        }
      : null;

    if (!currentUser) return;

    profileName.textContent = currentUser.name;
    profileEmail.textContent = currentUser.email;
    profileAvatar.src = currentUser.photo;
  }

  function listenAuth() {
    auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
        showPage("home");
        renderHistory();
      } else {
        currentUser = null;
        showPage("login");
      }
    });
  }

  async function signOut() {
    try {
      await auth.signOut();
    } catch (error) {
      console.error(error);
    }
  }

  function showAreaError(message) {
    areaError.textContent = message;
    areaError.classList.remove("hidden");
    areaResult.classList.add("hidden");
  }

  function hideAreaError() {
    areaError.textContent = "";
    areaError.classList.add("hidden");
  }

  function clearCanvas() {
    if (!shapeCanvas || !shapeCtx) return;
    shapeCtx.clearRect(0, 0, shapeCanvas.width, shapeCanvas.height);
  }

  function getMetricCrsForLon(lon) {
    if (lon >= 60 && lon < 66) return "EPSG:32641";
    if (lon >= 66 && lon < 72) return "EPSG:32642";
    if (lon >= 72 && lon < 78) return "EPSG:32643";
    return "EPSG:32642";
  }

  function parseCoordinates(text) {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const points = [];

    for (let i = 0; i < lines.length; i++) {
      const clean = lines[i].replace(/,/g, " ").replace(/;/g, " ");
      const parts = clean.split(/\s+/).filter(Boolean);

      if (parts.length < 2) {
        throw new Error(`${i + 1}-${t("areaLineError")}`);
      }

      const lat = Number(parts[0]);
      const lon = Number(parts[1]);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error(`${i + 1}-${t("areaNumberError")}`);
      }

      if (lat < -90 || lat > 90) {
        throw new Error(`${i + 1}-${t("areaLatError")}`);
      }

      if (lon < -180 || lon > 180) {
        throw new Error(`${i + 1}-${t("areaLonError")}`);
      }

      points.push({ lat, lon });
    }

    return points;
  }

  function parseCoordinatesSafe(text) {
    try {
      return text ? parseCoordinates(text) : [];
    } catch {
      return [];
    }
  }

  function transformPointsToMetric(points) {
    if (!points.length) return [];

    if (typeof proj4 === "undefined") {
      return points.map((p) => ({ x: p.lon, y: p.lat }));
    }

    const meanLon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;
    const dst = getMetricCrsForLon(meanLon);

    return points.map((p) => {
      const [x, y] = proj4("EPSG:4326", dst, [p.lon, p.lat]);
      return { x, y };
    });
  }

  function calculatePolygonAreaXY(projectedPoints) {
    let area = 0;

    for (let i = 0; i < projectedPoints.length; i++) {
      const p1 = projectedPoints[i];
      const p2 = projectedPoints[(i + 1) % projectedPoints.length];
      area += p1.x * p2.y - p2.x * p1.y;
    }

    return Math.abs(area) / 2;
  }

  function calculateAccurateArea(points) {
    const metricPoints = transformPointsToMetric(points);
    return calculatePolygonAreaXY(metricPoints);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 3,
    }).format(value);
  }

  function projectPointsToCanvas(points, width, height, padding = 40) {
    const projected = transformPointsToMetric(points);

    const xs = projected.map((p) => p.x);
    const ys = projected.map((p) => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    let xRange = maxX - minX;
    let yRange = maxY - minY;

    if (xRange === 0) xRange = 1;
    if (yRange === 0) yRange = 1;

    const drawWidth = width - padding * 2;
    const drawHeight = height - padding * 2;

    const scaleX = drawWidth / xRange;
    const scaleY = drawHeight / yRange;
    const scale = Math.min(scaleX, scaleY);

    const contentWidth = xRange * scale;
    const contentHeight = yRange * scale;

    const offsetX = (width - contentWidth) / 2;
    const offsetY = (height - contentHeight) / 2;

    return projected.map((p) => {
      const x = offsetX + (p.x - minX) * scale;
      const y = height - (offsetY + (p.y - minY) * scale);
      return { x, y };
    });
  }

  function drawPolygonPreview(points) {
    if (!shapeCanvas || !shapeCtx) return;

    const ctx = shapeCtx;
    const width = shapeCanvas.width;
    const height = shapeCanvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!points || points.length < 2) return;

    const projected = projectPointsToCanvas(points, width, height, 40);
    const isLight = document.body.classList.contains("light");

    const gridColor = isLight ? "rgba(50, 60, 70, 0.10)" : "rgba(180, 190, 200, 0.16)";
    const lineColor = isLight ? "rgba(15, 143, 165, 0.95)" : "rgba(87, 214, 255, 0.95)";
    const fillColor = isLight ? "rgba(15, 143, 165, 0.14)" : "rgba(87, 214, 255, 0.16)";
    const pointFill = isLight ? "rgba(24, 34, 44, 0.95)" : "rgba(255,255,255,0.96)";
    const labelColor = isLight ? "rgba(24, 34, 44, 0.95)" : "rgba(255,255,255,0.96)";

    ctx.lineWidth = 1;
    ctx.strokeStyle = gridColor;

    for (let x = 0; x <= width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(projected[0].x, projected[0].y);
    for (let i = 1; i < projected.length; i++) {
      ctx.lineTo(projected[i].x, projected[i].y);
    }

    if (projected.length >= 3) {
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
    }

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    projected.forEach((p, index) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = pointFill;
      ctx.fill();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = labelColor;
      ctx.font = "14px Arial";
      ctx.fillText(String(index + 1), p.x + 8, p.y - 8);
    });
  }

  function calculateArea() {
    hideAreaError();

    const rawText = coordsInput.value.trim();

    if (!rawText) {
      showAreaError(t("areaEmpty"));
      clearCanvas();
      return;
    }

    let points = [];

    try {
      points = parseCoordinates(rawText);
    } catch (error) {
      const parts = String(error.message).split("-");
      if (parts.length > 1) {
        showAreaError(`${parts[0]} ${parts.slice(1).join("-")}`);
      } else {
        showAreaError(error.message);
      }
      clearCanvas();
      return;
    }

    if (points.length < 3) {
      showAreaError(t("areaNeed3"));
      drawPolygonPreview(points);
      return;
    }

    const areaM2 = calculateAccurateArea(points);
    const areaHa = areaM2 / 10000;
    const areaKm2 = areaM2 / 1000000;

    resultM2.textContent = formatNumber(areaM2);
    resultHa.textContent = formatNumber(areaHa);
    resultKm2.textContent = formatNumber(areaKm2);
    resultPoints.textContent = points.length;

    drawPolygonPreview(points);
    areaResult.classList.remove("hidden");

    addHistoryItem(
      t("areaType"),
      `${points.length} · ${formatNumber(areaM2)} m² · ${formatNumber(areaHa)} ha · ${formatNumber(areaKm2)} km²`
    );
  }

  function clearAreaForm() {
    coordsInput.value = "";
    hideAreaError();
    areaResult.classList.add("hidden");
    resultM2.textContent = "0";
    resultHa.textContent = "0";
    resultKm2.textContent = "0";
    resultPoints.textContent = "0";
    clearCanvas();
  }

  function trimTrailingZeros(numStr) {
    if (!numStr.includes(".")) return numStr;
    return numStr.replace(/\.?0+$/, "");
  }

  function toDMS(decimalValue, type) {
    if (!Number.isFinite(decimalValue)) {
      throw new Error("Invalid number.");
    }

    const abs = Math.abs(decimalValue);
    const degrees = Math.floor(abs);
    const minutesFull = (abs - degrees) * 60;
    const minutes = Math.floor(minutesFull);
    let seconds = (minutesFull - minutes) * 60;

    seconds = Number(seconds.toFixed(10));
    const secondsStr = trimTrailingZeros(seconds.toString());

    let hemisphere = "";
    if (type === "lat") {
      hemisphere = decimalValue >= 0 ? "N" : "S";
    } else {
      hemisphere = decimalValue >= 0 ? "E" : "W";
    }

    return `${degrees}° ${minutes}' ${secondsStr}" ${hemisphere}`;
  }

  function fromDMS(deg, min, sec, hemisphere) {
    if (!Number.isFinite(deg) || !Number.isFinite(min) || !Number.isFinite(sec)) {
      throw new Error("Invalid values.");
    }

    if (min < 0 || min >= 60 || sec < 0 || sec >= 60) {
      throw new Error("Minutes or seconds are out of range.");
    }

    let decimal = Math.abs(deg) + min / 60 + sec / 3600;

    if (["W", "S"].includes(hemisphere)) {
      decimal *= -1;
    }

    if (["N", "S"].includes(hemisphere) && decimal > 90) {
      throw new Error("Latitude cannot be greater than 90.");
    }

    if (["E", "W"].includes(hemisphere) && decimal > 180) {
      throw new Error("Longitude cannot be greater than 180.");
    }

    return decimal;
  }

  function convertDecimalToDMS() {
    try {
      const value = Number(ddInput.value);
      const type = ddType.value;
      const result = toDMS(value, type);
      dmsResult.textContent = result;
      addHistoryItem(t("ddToDmsType"), `${value} → ${result}`);
    } catch (error) {
      dmsResult.textContent = error.message;
    }
  }

  function convertDMSToDecimal() {
    try {
      const deg = Number(degInput.value);
      const min = Number(minInput.value);
      const sec = Number(secInput.value);
      const hemisphere = hemisphereSelect.value;

      const result = fromDMS(deg, min, sec, hemisphere);
      const finalValue = trimTrailingZeros(result.toFixed(10));
      ddResult.textContent = finalValue;

      addHistoryItem(
        t("dmsToDdType"),
        `${deg}° ${min}' ${sec}" ${hemisphere} → ${finalValue}`
      );
    } catch (error) {
      ddResult.textContent = error.message;
    }
  }

  async function copyTextValue(text) {
    if (!text || text === "-") return;

    try {
      await navigator.clipboard.writeText(text);
      alert(t("copySuccess"));
    } catch {
      alert(t("copyFailed"));
    }
  }

  function getHistoryKey() {
    return currentUser ? `geocalc_history_${currentUser.uid}` : "geocalc_history_guest";
  }

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(getHistoryKey())) || [];
    } catch {
      return [];
    }
  }

  function saveHistory(items) {
    localStorage.setItem(getHistoryKey(), JSON.stringify(items));
  }

  function addHistoryItem(type, text) {
    if (!currentUser) return;

    const items = getHistory();
    items.unshift({
      id: Date.now(),
      type,
      text,
      createdAt: new Date().toLocaleString(),
    });

    saveHistory(items.slice(0, 50));
    renderHistory();
  }

  function renderHistory() {
    if (!historyList) return;

    const items = getHistory();

    if (!items.length) {
      historyList.innerHTML = `<div class="history-empty">${t("historyEmpty")}</div>`;
      return;
    }

    historyList.innerHTML = items
      .map(
        (item) => `
          <div class="history-item">
            <div class="history-item-top">
              <span class="history-type">${item.type}</span>
              <span class="history-date">${item.createdAt}</span>
            </div>
            <div class="history-text">${item.text}</div>
          </div>
        `
      )
      .join("");
  }

  function clearHistory() {
    localStorage.removeItem(getHistoryKey());
    renderHistory();
    alert(t("historyCleared"));
  }

  googleLoginBtn.addEventListener("click", realGoogleLogin);

  profileBtn.addEventListener("click", () => {
    if (currentUser) showPage("profile");
  });

  backHomeBtn.addEventListener("click", () => {
    showPage("home");
  });

  signOutBtn.addEventListener("click", signOut);

  areaBtn.addEventListener("click", () => {
    showPage("area");
    const points = parseCoordinatesSafe(coordsInput.value.trim());
    if (points.length >= 2) {
      drawPolygonPreview(points);
    }
  });

  convertBtn.addEventListener("click", () => {
    showPage("converter");
  });

  backFromArea.addEventListener("click", () => {
    showPage("home");
  });

  backFromConverter.addEventListener("click", () => {
    showPage("home");
  });

  calculateAreaBtn.addEventListener("click", calculateArea);
  clearAreaBtn.addEventListener("click", clearAreaForm);

  coordsInput.addEventListener("input", () => {
    const points = parseCoordinatesSafe(coordsInput.value.trim());
    if (points.length >= 2) {
      drawPolygonPreview(points);
    } else {
      clearCanvas();
    }
  });

  themeToggle.addEventListener("click", toggleTheme);

  languageSelect.addEventListener("change", (e) => {
    const lang = e.target.value;
    localStorage.setItem("geocalc_lang", lang);
    applyLanguage(lang);
  });

  historyBtn.addEventListener("click", () => {
    showPage("profile");
  });

  clearHistoryBtn.addEventListener("click", clearHistory);
  convertToDmsBtn.addEventListener("click", convertDecimalToDMS);
  convertToDdBtn.addEventListener("click", convertDMSToDecimal);

  copyDmsBtn.addEventListener("click", () => {
    copyTextValue(dmsResult.textContent);
  });

  copyDdBtn.addEventListener("click", () => {
    copyTextValue(ddResult.textContent);
  });

  const savedLang = localStorage.getItem("geocalc_lang") || "uz";
  languageSelect.value = savedLang;

  applyLanguage(savedLang);
  applySavedTheme();
  listenAuth();
  renderHistory();
  clearCanvas();
});
