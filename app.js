const STORAGE_PREFIX = "ihm_v4";
const SESSION_KEY = `${STORAGE_PREFIX}_session`;
const THEME_KEY = `${STORAGE_PREFIX}_theme`;
const ACCENT_KEY = `${STORAGE_PREFIX}_accent`;
const SETTINGS_KEY = `${STORAGE_PREFIX}_settings`;
const USERS_KEY = `${STORAGE_PREFIX}_users`;
const GOOGLE_CONFIG_FILE = "google.config.js";
const GOOGLE_IDENTITY_URL = "https://accounts.google.com/gsi/client";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GOOGLE_DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const GOOGLE_BACKUP_FILENAME = "i-have-money-backup.json";
const GOOGLE_DRIVE_SCOPES_FALLBACK = "https://www.googleapis.com/auth/drive.appdata";
const AUTO_LOCAL_BACKUP_KEY = `${STORAGE_PREFIX}_auto_local_backups`;

const defaultIncomeCategories = ["เงินเดือน", "ขายของ", "โบนัส", "โอนเข้า", "คืนเงิน", "อื่น ๆ"];
const defaultExpenseCategories = ["อาหาร", "เดินทาง", "ของใช้", "บ้าน", "ค่าส่ง", "ผ่อน/หนี้", "สุขภาพ", "ช้อปปิ้ง", "ธุรกิจ", "อื่น ๆ"];
const iconMap = {
  "เงินเดือน": "💼", "ขายของ": "🛍️", "โบนัส": "🎁", "โอนเข้า": "💸", "คืนเงิน": "↩️",
  "อาหาร": "🍜", "เดินทาง": "🚗", "ของใช้": "🧴", "บ้าน": "🏠", "ค่าส่ง": "📦",
  "ผ่อน/หนี้": "💳", "สุขภาพ": "💊", "ช้อปปิ้ง": "🛒", "ธุรกิจ": "🏪", "อื่น ๆ": "📝"
};
// Snapshot of the built-in icons, captured before any user/custom icons are merged in.
// Used to rebuild iconMap cleanly on login/restore so icons from a previous account
// (or a previous backup) never bleed into the currently signed-in user's session.
const defaultIconMap = { ...iconMap };
function resetIconMap() {
  normalizeCategoryIcons();
  Object.keys(iconMap).forEach(key => delete iconMap[key]);
  Object.assign(iconMap, defaultIconMap, customCategoryIcons);
}
function normalizeCategoryIcons() {
  if (!customCategoryIcons || typeof customCategoryIcons !== "object" || Array.isArray(customCategoryIcons)) {
    customCategoryIcons = {};
    return;
  }
  customCategoryIcons = Object.fromEntries(
    Object.entries(customCategoryIcons)
      .map(([cat, icon]) => [String(cat || "").trim(), String(icon || "").trim().slice(0, 8)])
      .filter(([cat, icon]) => cat && icon && !["__proto__", "prototype", "constructor"].includes(cat))
  );
}

const accentThemes = {
  green: { name: "Money Green", colors: ["#1f8a5b", "#2ea872"] },
  blue: { name: "Trust Blue", colors: ["#2563eb", "#38bdf8"] },
  purple: { name: "Premium Purple", colors: ["#7c3aed", "#a855f7"] },
  rose: { name: "Soft Rose", colors: ["#e11d48", "#fb7185"] },
  amber: { name: "Warm Amber", colors: ["#d97706", "#f59e0b"] },
  slate: { name: "Minimal Slate", colors: ["#334155", "#64748b"] }
};

let currentUser = null;
let transactions = [];
let budgets = {};
let selectedType = "income";
let customCategories = { income: [], expense: [] };
let customCategoryIcons = {};
let categoryViewType = "expense";
let currentMonth = new Date();
let selectedDate = toDateInputValue(new Date());
let receiptData = "";
let settings = normalizeSettings(loadJson(SETTINGS_KEY, {}));
let googleConfig = null;
let googleLoginTokenClient = null;
let googleDriveTokenClient = null;
let googleAccessToken = "";
let googleDriveAccessToken = "";
let googleProfile = null;
let shouldCheckDriveConflict = false;
let currentAuthProvider = "local";

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  applyTheme(localStorage.getItem(THEME_KEY) || "light");
  applyAccent(localStorage.getItem(ACCENT_KEY) || "green");
  bindAuthEvents();
  bindAppEvents();
  await initGoogleAuth();
  const session = loadJson(SESSION_KEY, null);
  if (session?.provider === "google" && session?.email) startGoogleUser(session.user || session);
  else if (session?.email) loginSession(session.email);
  else showAuth("login");
  registerServiceWorker();
}

function cacheElements() {
  ["authScreen","appShell","loginTab","signupTab","loginForm","signupForm","loginEmail","loginPassword","signupName","signupEmail","signupPassword","googleLogin","googleLoginStatus","demoLogin","greeting","syncStatus","syncNow","themeToggle","monthBalance","monthIncome","monthExpense","todayNet","weekNet","monthCount","transactionForm","editId","date","amount","category","customCategory","categorySuggestions","categoryChips","note","receipt","receiptPreview","submitBtn","clearForm","calendarTitle","calendarGrid","selectedDateTitle","selectedDateTotal","transactionList","categoryReport","exportCsv","prevMonth","nextMonth","budgetForm","budgetCategory","budgetCustomCategory","expenseCategorySuggestions","budgetCategoryChips","budgetAmount","budgetList","budgetTotal","budgetMonthTitle","monthlyChart","syncMode","connectGoogleDrive","backupDrive","restoreDrive","backupJson","restoreJson","lastBackup","accountInfo","logoutBtn","appearanceMode","accentTheme","themePreviewText","themeSwatches","categoryForm","categoryType","categoryName","categoryIcon","categoryCount","showExpenseCats","showIncomeCats","customCategoryList","receiptDialog","receiptImage","closeReceipt","storageUsage","restorePointList","updateBanner","updateReloadBtn"].forEach(id => els[id] = document.getElementById(id));
}

function bindAuthEvents() {
  els.loginTab.addEventListener("click", () => showAuth("login"));
  els.signupTab.addEventListener("click", () => showAuth("signup"));
  els.signupForm.addEventListener("submit", onSignup);
  els.loginForm.addEventListener("submit", onLogin);
  els.googleLogin.addEventListener("click", handleGoogleLogin);
  els.demoLogin.addEventListener("click", () => {
    ensureDemoUser();
    startUser("demo@ihavemoney.app");
  });
}

function bindAppEvents() {
  document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.view)));
  document.querySelectorAll(".seg").forEach(btn => btn.addEventListener("click", () => selectType(btn.dataset.type)));
  els.transactionForm.addEventListener("submit", onSaveTransaction);
  els.clearForm.addEventListener("click", () => resetForm(true));
  els.prevMonth.addEventListener("click", () => moveMonth(-1));
  els.nextMonth.addEventListener("click", () => moveMonth(1));
  els.exportCsv.addEventListener("click", exportCsv);
  els.budgetForm.addEventListener("submit", onSaveBudget);
  els.categoryForm.addEventListener("submit", onAddCategory);
  els.showExpenseCats.addEventListener("click", () => setCategoryView("expense"));
  els.showIncomeCats.addEventListener("click", () => setCategoryView("income"));
  els.backupJson.addEventListener("click", backupJson);
  els.restoreJson.addEventListener("change", restoreJson);
  els.syncNow.addEventListener("click", syncNow);
  els.connectGoogleDrive?.addEventListener("click", requestGoogleDriveAccess);
  els.backupDrive?.addEventListener("click", syncToGoogleDrive);
  els.restoreDrive?.addEventListener("click", syncFromGoogleDrive);
  els.logoutBtn.addEventListener("click", logout);
  els.themeToggle.addEventListener("click", () => {
    const next = document.body.classList.contains("dark") ? "light" : "dark";
    setAppearance(next);
  });
  els.appearanceMode.addEventListener("change", () => setAppearance(els.appearanceMode.value));
  els.accentTheme.addEventListener("change", () => setAccent(els.accentTheme.value));
  els.receipt.addEventListener("change", onReceiptSelected);
  els.closeReceipt.addEventListener("click", () => els.receiptDialog.close());
  [els.syncMode].forEach(el => el?.addEventListener("change", saveSettingsFromForm));
}

function showAuth(mode) {
  els.authScreen.classList.remove("hidden");
  els.appShell.classList.add("hidden");
  els.loginTab.classList.toggle("active", mode === "login");
  els.signupTab.classList.toggle("active", mode === "signup");
  els.loginForm.classList.toggle("hidden", mode !== "login");
  els.signupForm.classList.toggle("hidden", mode !== "signup");
  updateThemeColor();
}

async function initGoogleAuth() {
  updateGoogleLoginState("checking");
  googleConfig = await loadGoogleConfig();
  if (!isGoogleConfigReady(googleConfig)) {
    updateGoogleLoginState("missing");
    return;
  }
  try {
    await loadScriptOnce(GOOGLE_IDENTITY_URL, "google-identity-services");
    if (!window.google?.accounts?.oauth2) throw new Error("Google Identity Services is unavailable");
    googleLoginTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: googleConfig.clientId,
      scope: "openid email profile",
      callback: handleGoogleTokenResponse
    });
    googleDriveTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: googleConfig.clientId,
      scope: googleConfig.driveScopes,
      callback: handleGoogleTokenResponse
    });
    updateGoogleLoginState("ready");
  } catch (error) {
    console.warn("Google Identity Services is not ready:", error);
    googleLoginTokenClient = null;
    googleDriveTokenClient = null;
    updateGoogleLoginState("error");
  }
}

async function loadGoogleConfig() {
  if (window.IHM_GOOGLE_CONFIG) return normalizeGoogleConfig(window.IHM_GOOGLE_CONFIG);
  try {
    await loadScriptOnce(GOOGLE_CONFIG_FILE, "ihm-google-config");
  } catch {
    return null;
  }
  const clientId = typeof GOOGLE_CLIENT_ID !== "undefined" ? GOOGLE_CLIENT_ID : "";
  const driveScopes = typeof GOOGLE_DRIVE_SCOPES !== "undefined" ? GOOGLE_DRIVE_SCOPES : "";
  return normalizeGoogleConfig(window.IHM_GOOGLE_CONFIG || { clientId, driveScopes });
}

function normalizeGoogleConfig(config = {}) {
  return {
    clientId: String(config.clientId || config.GOOGLE_CLIENT_ID || "").trim(),
    driveScopes: String(config.driveScopes || config.GOOGLE_DRIVE_SCOPES || GOOGLE_DRIVE_SCOPES_FALLBACK).trim() || GOOGLE_DRIVE_SCOPES_FALLBACK
  };
}

function isGoogleConfigReady(config) {
  return Boolean(config?.clientId);
}

function loadScriptOnce(src, id) {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Cannot load ${src}`));
    document.head.appendChild(script);
  });
}

function updateGoogleLoginState(state) {
  if (!els.googleLogin || !els.googleLoginStatus) return;
  els.googleLoginStatus.classList.remove("ready", "error");
  if (state === "ready") {
    els.googleLogin.disabled = false;
    els.googleLoginStatus.textContent = "Google Login พร้อมใช้งาน";
    els.googleLoginStatus.classList.add("ready");
  } else if (state === "checking") {
    els.googleLogin.disabled = true;
    els.googleLoginStatus.textContent = "กำลังตรวจสอบ Google Login...";
  } else if (state === "error") {
    els.googleLogin.disabled = true;
    els.googleLoginStatus.textContent = "ตั้งค่า Google Login ไม่สำเร็จ ใช้ Email หรือ Demo ได้ตามปกติ";
    els.googleLoginStatus.classList.add("error");
  } else {
    els.googleLogin.disabled = true;
    els.googleLoginStatus.textContent = "ยังไม่ได้ตั้งค่า Google Client ID";
  }
}

async function handleGoogleLogin() {
  if (!googleLoginTokenClient) {
    alert("ยังไม่ได้ตั้งค่า Google Client ID\nให้คัดลอก google.config.example.js เป็น google.config.js แล้วใส่ Google OAuth Client ID");
    return;
  }
  googleLoginTokenClient.requestAccessToken({ prompt: "consent" });
}

async function handleGoogleTokenResponse(response) {
  if (response?.error) {
    setSyncStatus("failed");
    alert(`Google authorization failed\n${response.error}`);
    return;
  }
  const accessToken = response?.access_token || "";
  const scope = response?.scope || "";
  if (!accessToken) return;
  if (scope.includes("drive.appdata")) {
    googleDriveAccessToken = accessToken;
    settings.googleDriveConnected = "true";
    settings.lastSyncError = "";
    safeSetItem(SETTINGS_KEY, JSON.stringify(settings));
    renderSettings();
    if (shouldCheckDriveConflict && currentAuthProvider === "google") {
      shouldCheckDriveConflict = false;
      try {
        const existing = await findDriveBackupFile();
        if (existing) {
          await resolveDriveConflict(existing);
          renderSettings();
        }
      } catch (error) {
        console.warn("Google Drive conflict check failed:", error);
        settings.lastSyncError = error.message || "Sync failed";
        safeSetItem(SETTINGS_KEY, JSON.stringify(settings));
        setSyncStatus("failed");
      }
    }
    return;
  }
  googleAccessToken = accessToken;
  try {
    const profile = await fetchGoogleProfile(accessToken);
    startGoogleUser(profile);
    await promptGoogleDriveConflictIfNeeded();
  } catch (error) {
    console.warn("Google profile load failed:", error);
    updateGoogleLoginState("error");
    alert("เข้าสู่ระบบด้วย Google ไม่สำเร็จ");
  }
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(`Google profile failed (${response.status})`);
  const profile = await response.json();
  return {
    email: String(profile.email || "").toLowerCase(),
    name: profile.name || profile.given_name || "ผู้ใช้ Google",
    picture: profile.picture || "",
    googleId: profile.sub || ""
  };
}

async function onSignup(event) {
  event.preventDefault();
  const name = els.signupName.value.trim();
  const email = els.signupEmail.value.trim().toLowerCase();
  const password = els.signupPassword.value;
  const users = loadJson(USERS_KEY, []);
  if (!name) return alert("กรุณากรอกชื่อผู้ใช้");
  if (password.length < 6) return alert("รหัสผ่านควรมีอย่างน้อย 6 ตัว");
  if (users.some(user => user.email === email)) return alert("อีเมลนี้สมัครไว้แล้ว");
  users.push({ name, email, passwordHash: await hashPassword(password), createdAt: new Date().toISOString() });
  safeSetItem(USERS_KEY, JSON.stringify(users));
  startUser(email);
}

async function onLogin(event) {
  event.preventDefault();
  const email = els.loginEmail.value.trim().toLowerCase();
  const password = els.loginPassword.value;
  const users = loadJson(USERS_KEY, []);
  const user = users.find(item => item.email === email);
  if (!user || !(await verifyPassword(user, password))) return alert("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  if (user.password && !user.passwordHash) {
    user.passwordHash = await hashPassword(password);
    delete user.password;
    safeSetItem(USERS_KEY, JSON.stringify(users));
  }
  startUser(email);
}

function ensureDemoUser() {
  const users = loadJson(USERS_KEY, []);
  if (!users.some(user => user.email === "demo@ihavemoney.app")) {
    users.push({ name: "Demo User", email: "demo@ihavemoney.app", passwordHash: "demo-123456", createdAt: new Date().toISOString() });
    safeSetItem(USERS_KEY, JSON.stringify(users));
  }
}

function startUser(email) {
  currentAuthProvider = "local";
  safeSetItem(SESSION_KEY, JSON.stringify({ provider: "local", email }));
  loginSession(email);
}

function startGoogleUser(user) {
  const email = String(user.email || "").toLowerCase();
  if (!email) {
    alert("บัญชี Google นี้ไม่มีอีเมลที่ใช้ได้");
    return;
  }
  const profile = {
    email,
    name: user.name || email.split("@")[0] || "ผู้ใช้ Google",
    picture: user.picture || "",
    googleId: user.googleId || user.sub || user.id || ""
  };
  googleProfile = profile;
  currentAuthProvider = "google";
  safeSetItem(SESSION_KEY, JSON.stringify({ provider: "google", email, user: profile }));
  loginSession(email, { provider: "google", id: profile.googleId, name: profile.name, picture: profile.picture, googleId: profile.googleId });
}

function loginSession(email, options = {}) {
  const users = loadJson(USERS_KEY, []);
  currentAuthProvider = options.provider || "local";
  currentUser = users.find(user => user.email === email) || { name: options.name || "ผู้ใช้", email };
  if (currentAuthProvider === "google") {
    currentUser = {
      ...currentUser,
      name: options.name || currentUser.name || "ผู้ใช้ Google",
      id: options.id,
      googleId: options.googleId || options.id || "",
      picture: options.picture || "",
      provider: "google",
      storageKey: options.googleId || options.id || email
    };
  }
  transactions = loadJson(userKey("transactions"), []);
  budgets = normalizeBudgets(loadJson(userKey("budgets"), {}));
  customCategories = loadJson(userKey("categories"), { income: [], expense: [] });
  customCategoryIcons = loadJson(userKey("categoryIcons"), {});
  resetIconMap();
  normalizeCategories();
  if (!transactions.length) seedExampleDataIfEmpty();
  els.authScreen.classList.add("hidden");
  els.appShell.classList.remove("hidden");
  els.greeting.textContent = `สวัสดี ${currentUser.name || "ค่ะ"}`;
  els.date.value = selectedDate;
  loadUserPreferences();
  loadSettingsToForm();
  renderThemeOptions();
  updateCategoryOptions();
  updateBudgetOptions();
  renderCategoryManager();
  showView("dashboard");
  render();
  reportCorruptedStorageIfAny();
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  currentAuthProvider = "local";
  googleAccessToken = "";
  googleDriveAccessToken = "";
  googleProfile = null;
  currentUser = null;
  showAuth("login");
  renderSettings();
}

function userKey(name) { return `${STORAGE_PREFIX}_${currentUser.storageKey || currentUser.email}_${name}`; }

function showView(viewName) {
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === viewName));
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === viewName));
  if (viewName === "reports") renderMonthlyChart();
}

function selectType(type) {
  selectedType = type;
  document.querySelectorAll(".seg").forEach(btn => btn.classList.toggle("active", btn.dataset.type === type));
  if (els.customCategory) els.customCategory.value = "";
  updateCategoryOptions();
}

async function onSaveTransaction(event) {
  event.preventDefault();
  const amount = Number(els.amount.value);
  if (!Number.isFinite(amount) || amount <= 0) return alert("กรุณาใส่จำนวนเงินให้ถูกต้อง");
  if (!els.date.value) return alert("กรุณาเลือกวันที่");
  const category = resolveCategory();
  if (!category) return;
  const item = {
    id: els.editId.value || newId(),
    type: selectedType,
    date: els.date.value,
    amount,
    category,
    note: els.note.value.trim() || category,
    receipt: receiptData,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  const existingIndex = transactions.findIndex(tx => tx.id === item.id);
  if (existingIndex >= 0) item.createdAt = transactions[existingIndex].createdAt;
  if (existingIndex >= 0) transactions[existingIndex] = item;
  else transactions.unshift(item);
  selectedDate = item.date;
  currentMonth = new Date(item.date + "T12:00:00");
  saveTransactions();
  resetForm(false);
  showView("dashboard");
  render();
}

function resetForm(resetDate) {
  els.editId.value = "";
  els.amount.value = "";
  els.note.value = "";
  els.receipt.value = "";
  els.customCategory.value = "";
  receiptData = "";
  els.receiptPreview.classList.add("hidden");
  els.receiptPreview.innerHTML = "";
  els.submitBtn.textContent = "บันทึก";
  if (resetDate) els.date.value = toDateInputValue(new Date());
}

function getCategories(type) {
  ensureCategoryBuckets();
  const defaults = type === "income" ? defaultIncomeCategories : defaultExpenseCategories;
  const custom = Array.isArray(customCategories[type]) ? customCategories[type] : [];
  const used = transactions.filter(t => t.type === type).map(t => t.category).filter(Boolean);
  return uniqueCategories([...defaults, ...custom, ...used]);
}
function uniqueCategories(list) {
  return [...new Set(list.map(cat => String(cat || "").trim()).filter(cat => cat && !isReservedKey(cat)))];
}
function normalizeCategories() {
  ensureCategoryBuckets();
  customCategories = {
    income: uniqueCategories(customCategories?.income || []),
    expense: uniqueCategories(customCategories?.expense || [])
  };
}
function normalizeBudgets(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value).reduce((acc, [cat, amount]) => {
    const key = String(cat || "").trim();
    const numericAmount = Number(amount || 0);
    if (key && !isReservedKey(key) && Number.isFinite(numericAmount) && numericAmount >= 0) {
      acc[key] = numericAmount;
    }
    return acc;
  }, {});
}
function ensureCategoryBuckets() {
  if (!customCategories || typeof customCategories !== "object" || Array.isArray(customCategories)) {
    customCategories = { income: [], expense: [] };
  }
  if (!Array.isArray(customCategories.income)) customCategories.income = [];
  if (!Array.isArray(customCategories.expense)) customCategories.expense = [];
}
function saveCategories() {
  normalizeCategories();
  safeSetItem(userKey("categories"), JSON.stringify(customCategories));
  safeSetItem(userKey("categoryIcons"), JSON.stringify(customCategoryIcons));
}
function updateCategoryOptions() {
  const list = getCategories(selectedType);
  els.category.innerHTML = list.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join("");
  els.categorySuggestions.innerHTML = list.map(cat => `<option value="${escapeHtml(cat)}"></option>`).join("");
  renderCategoryChips(els.categoryChips, list, value => { els.customCategory.value = value; els.note.focus(); });
}
function updateBudgetOptions() {
  const list = getCategories("expense");
  els.budgetCategory.innerHTML = list.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join("");
  els.expenseCategorySuggestions.innerHTML = list.map(cat => `<option value="${escapeHtml(cat)}"></option>`).join("");
  renderCategoryChips(els.budgetCategoryChips, list, value => { els.budgetCustomCategory.value = value; els.budgetAmount.focus(); });
}
function renderCategoryChips(container, list, onPick) {
  if (!container) return;
  container.innerHTML = list.slice(0, 14).map(cat => `<button type="button" class="chip-btn btn btn-subtle btn-sm" data-cat="${escapeHtml(cat)}">${categoryLabelHtml(cat)}</button>`).join("");
  container.querySelectorAll("button[data-cat]").forEach(btn => btn.addEventListener("click", () => onPick(btn.dataset.cat)));
}

function onReceiptSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    event.target.value = "";
    return alert("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
  }
  if (file.size > 8 * 1024 * 1024) {
    event.target.value = "";
    return alert("รูปใบเสร็จใหญ่เกินไป แนะนำไม่เกิน 8 MB");
  }
  const reader = new FileReader();
  reader.onload = () => compressImage(reader.result, 900, 0.72).then(data => {
    receiptData = data;
    els.receiptPreview.innerHTML = `<img src="${data}" alt="ตัวอย่างใบเสร็จ" />`;
    els.receiptPreview.classList.remove("hidden");
  }).catch(() => {
    event.target.value = "";
    alert("ไม่สามารถอ่านรูปใบเสร็จได้");
  });
  reader.onerror = () => {
    event.target.value = "";
    alert("ไม่สามารถอ่านไฟล์ใบเสร็จได้");
  };
  reader.readAsDataURL(file);
}

function compressImage(dataUrl, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (!img.width || !img.height) {
        reject(new Error("Invalid image"));
        return;
      }
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
  });
}

function render() {
  renderSummary();
  renderCalendar();
  renderTransactions();
  renderCategoryReport();
  renderBudgets();
  renderSettings();
  renderCategoryManager();
  renderMonthlyChart();
}

function renderSummary() {
  const monthItems = filterByMonth(transactions, currentMonth);
  const monthIncome = sum(monthItems.filter(t => t.type === "income"));
  const monthExpense = sum(monthItems.filter(t => t.type === "expense"));
  const todayItems = transactions.filter(t => t.date === toDateInputValue(new Date()));
  const weekItems = filterCurrentWeek(transactions);
  els.monthIncome.textContent = money(monthIncome);
  els.monthExpense.textContent = money(monthExpense);
  els.monthBalance.textContent = money(monthIncome - monthExpense);
  els.todayNet.textContent = money(net(todayItems));
  els.weekNet.textContent = money(net(weekItems));
  els.monthCount.textContent = monthItems.length;
}

function renderCalendar() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  els.calendarTitle.textContent = `${monthNames[month]} ${year + 543}`;
  els.budgetMonthTitle.textContent = `${monthNames[month]} ${year + 543}`;
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  els.calendarGrid.innerHTML = "";
  for (let i = 0; i < 42; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const dateStr = toDateInputValue(day);
    const dayItems = transactions.filter(t => t.date === dateStr);
    const dayNet = net(dayItems);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day-cell";
    if (day.getMonth() !== month) cell.classList.add("muted");
    if (dateStr === selectedDate) cell.classList.add("selected");
    cell.innerHTML = `<span class="day-num">${day.getDate()}</span>${dayItems.length ? `<span class="day-net ${dayNet >= 0 ? "plus" : "minus"}">${compactMoney(dayNet)}</span>` : ""}`;
    cell.addEventListener("click", () => { selectedDate = dateStr; els.date.value = dateStr; render(); });
    els.calendarGrid.appendChild(cell);
  }
}

function renderTransactions() {
  const items = transactions.filter(t => t.date === selectedDate).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  els.selectedDateTitle.textContent = formatThaiDate(selectedDate);
  els.selectedDateTotal.textContent = money(net(items));
  els.transactionList.innerHTML = "";
  els.transactionList.classList.toggle("empty", items.length === 0);
  const template = document.querySelector("#txTemplate");
  items.forEach(item => {
    const node = template.content.cloneNode(true);
    const isIncome = item.type === "income";
    node.querySelector(".tx-icon").textContent = iconMap[item.category] || "📝";
    node.querySelector(".tx-note").textContent = item.note;
    node.querySelector(".tx-meta").textContent = `${item.category} • ${isIncome ? "รายรับ" : "รายจ่าย"}`;
    const amount = node.querySelector(".tx-amount");
    amount.textContent = `${isIncome ? "+" : "-"}${money(item.amount)}`;
    amount.classList.add(isIncome ? "plus" : "minus");
    const receiptBtn = node.querySelector(".receipt-link");
    if (item.receipt) {
      receiptBtn.classList.remove("hidden");
      receiptBtn.addEventListener("click", () => openReceipt(item.receipt));
    }
    node.querySelector(".edit-btn").addEventListener("click", () => editItem(item.id));
    node.querySelector(".delete-btn").addEventListener("click", () => deleteItem(item.id));
    els.transactionList.appendChild(node);
  });
}

function renderCategoryReport() {
  const monthItems = filterByMonth(transactions, currentMonth).filter(t => t.type === "expense");
  const totals = groupSum(monthItems, "category");
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, value]) => value), 1);
  els.categoryReport.innerHTML = entries.length ? entries.map(([cat, value]) => `<div class="cat-row"><span>${categoryLabelHtml(cat)}</span><b>${money(value)}</b><div class="cat-bar-wrap"><div class="cat-bar" style="width:${Math.round((value / max) * 100)}%"></div></div></div>`).join("") : `<p class="hint">ยังไม่มีรายจ่ายในเดือนนี้</p>`;
}

function renderBudgets() {
  budgets = normalizeBudgets(budgets);
  const monthItems = filterByMonth(transactions, currentMonth).filter(t => t.type === "expense");
  const spent = groupSum(monthItems, "category");
  const cats = [...new Set([...getCategories("expense"), ...Object.keys(budgets)])];
  const active = cats.filter(cat => budgets[cat] || spent[cat]);
  const totalBudget = active.reduce((sum, cat) => sum + Number(budgets[cat] || 0), 0);
  els.budgetTotal.textContent = money(totalBudget);
  els.budgetList.innerHTML = active.length ? active.map(cat => {
    const budget = Number(budgets[cat] || 0);
    const use = Number(spent[cat] || 0);
    const pct = budget ? Math.round((use / budget) * 100) : 0;
    const width = Math.min(pct || (use ? 100 : 0), 100);
    const state = pct >= 100 ? "over" : pct >= 80 ? "warn" : "";
    return `<div class="cat-row"><span>${categoryLabelHtml(cat)}<br><small class="hint">ใช้ ${money(use)} / งบ ${budget ? money(budget) : "ยังไม่ตั้ง"}</small></span><b>${budget ? pct + "%" : "-"}</b><div class="cat-bar-wrap"><div class="cat-bar ${state}" style="width:${width}%"></div></div></div>`;
  }).join("") : `<p class="hint">ยังไม่ได้ตั้งงบประมาณ เริ่มจากเลือกหมวดและใส่วงเงินต่อเดือน</p>`;
}

function onSaveBudget(event) {
  event.preventDefault();
  const cat = resolveBudgetCategory();
  if (!cat) return alert("กรุณาเลือกหรือพิมพ์หมวดงบประมาณ");
  const amount = Number(els.budgetAmount.value || 0);
  if (!Number.isFinite(amount) || amount < 0) return alert("กรุณาใส่งบประมาณให้ถูกต้อง");
  budgets[cat] = amount;
  safeSetItem(userKey("budgets"), JSON.stringify(budgets));
  saveCategories();
  els.budgetAmount.value = "";
  els.budgetCustomCategory.value = "";
  updateBudgetOptions();
  renderBudgets();
  renderCategoryManager();
}

function renderMonthlyChart() {
  if (!els.monthlyChart || !currentUser) return;
  const canvas = els.monthlyChart;
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const labels = [];
  const income = [];
  const expense = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - i, 1);
    labels.push(new Intl.DateTimeFormat("th-TH", { month: "short" }).format(d));
    const items = filterByMonth(transactions, d);
    income.push(sum(items.filter(t => t.type === "income")));
    expense.push(sum(items.filter(t => t.type === "expense")));
  }
  const max = Math.max(...income, ...expense, 1);
  const textColor = getCss("--muted");
  ctx.font = "13px system-ui";
  ctx.fillStyle = textColor;
  ctx.fillText("รายรับ / รายจ่าย 6 เดือนล่าสุด", 18, 24);
  const chartTop = 44, chartBottom = h - 34, chartLeft = 22, chartRight = w - 16;
  const groupW = (chartRight - chartLeft) / labels.length;
  labels.forEach((label, i) => {
    const x = chartLeft + i * groupW + groupW * 0.18;
    const incH = (income[i] / max) * (chartBottom - chartTop);
    const expH = (expense[i] / max) * (chartBottom - chartTop);
    ctx.fillStyle = getCss("--brand");
    roundRect(ctx, x, chartBottom - incH, groupW * 0.24, incH, 7);
    ctx.fillStyle = getCss("--expense");
    roundRect(ctx, x + groupW * 0.30, chartBottom - expH, groupW * 0.24, expH, 7);
    ctx.fillStyle = textColor;
    ctx.fillText(label, x, h - 12);
  });
}
function roundRect(ctx, x, y, width, height, radius) {
  if (height < 1) height = 1;
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.fill();
}
function getCss(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }

function editItem(id) {
  const item = transactions.find(t => t.id === id);
  if (!item) return;
  selectType(item.type);
  els.editId.value = item.id;
  els.date.value = item.date;
  els.amount.value = item.amount;
  if (!getCategories(item.type).includes(item.category)) addCustomCategory(item.type, item.category, "📝", false);
  updateCategoryOptions();
  els.category.value = item.category;
  els.customCategory.value = item.category;
  els.note.value = item.note;
  receiptData = item.receipt || "";
  els.receiptPreview.innerHTML = receiptData ? `<img src="${receiptData}" alt="ตัวอย่างใบเสร็จ" />` : "";
  els.receiptPreview.classList.toggle("hidden", !receiptData);
  els.submitBtn.textContent = "บันทึกการแก้ไข";
  showView("add");
}
function deleteItem(id) {
  if (!confirm("ลบรายการนี้ใช่ไหม?")) return;
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  render();
}
function openReceipt(src) { els.receiptImage.src = src; els.receiptDialog.showModal(); }
function moveMonth(delta) { currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1); render(); }
function saveTransactions() {
  safeSetItem(userKey("transactions"), JSON.stringify(transactions));
}
function groupSum(items, field) { return items.reduce((acc, item) => { const key = String(item[field] || "").trim(); if (!key || isReservedKey(key)) return acc; acc[key] = (acc[key] || 0) + Number(item.amount); return acc; }, Object.create(null)); }
function sum(items) { return items.reduce((total, item) => total + Number(item.amount), 0); }
function net(items) { return sum(items.filter(t => t.type === "income")) - sum(items.filter(t => t.type === "expense")); }
function money(value) { return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(value); }
function compactMoney(value) { return new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
function toDateInputValue(date) { const tzOffset = date.getTimezoneOffset() * 60000; return new Date(date - tzOffset).toISOString().slice(0, 10); }
function filterByMonth(items, date) { const year = date.getFullYear(); const month = date.getMonth(); return items.filter(item => { const d = new Date(item.date + "T12:00:00"); return d.getFullYear() === year && d.getMonth() === month; }); }
function filterCurrentWeek(items) { const today = new Date(); const day = (today.getDay() + 6) % 7; const monday = new Date(today); monday.setDate(today.getDate() - day); monday.setHours(0, 0, 0, 0); const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999); return items.filter(item => { const d = new Date(item.date + "T12:00:00"); return d >= monday && d <= sunday; }); }
function formatThaiDate(dateStr) { return new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(dateStr + "T12:00:00")); }
const corruptedStorageKeys = [];
function loadJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) ?? fallback;
  } catch {
    // Data existed under this key but was not valid JSON (corrupted write,
    // manual tampering, or a browser storage bug). Track it instead of
    // silently pretending the key was simply empty, so the user can be
    // told which piece of their data reverted to defaults.
    if (!corruptedStorageKeys.includes(key)) corruptedStorageKeys.push(key);
    return fallback;
  }
}
/**
 * Wrapper around localStorage.setItem() that NEVER throws. setItem() throws
 * a *synchronous* DOMException (QuotaExceededError) the moment storage is
 * full — without this wrapper, that exception aborts whatever function was
 * writing (login, saving a transaction, restoring a backup, ...) partway
 * through, potentially leaving app state half-written. This wrapper catches
 * that, reports a clear message to the user via reportStorageWriteFailure,
 * and lets the caller decide how to proceed (see restoreFromBackupPayload
 * for the rollback-aware caller).
 */
function safeSetItem(key, value) {
  const result = window.IHM_STORAGE_SAFETY.trySetItem(localStorage, key, value);
  if (!result.ok) reportStorageWriteFailure(result.classification, key);
  return result.ok;
}
function reportStorageWriteFailure(classification, key) {
  if (classification?.isQuotaError) {
    alert(
      "พื้นที่จัดเก็บข้อมูลในเครื่องเต็มแล้ว บันทึกข้อมูลล่าสุดไม่สำเร็จ\n" +
      "ลองลบรูปใบเสร็จเก่าที่ไม่จำเป็น หรือ Export ข้อมูลเป็นไฟล์ JSON แล้วลบรายการเก่าบางส่วนออกจากเครื่องนี้"
    );
  } else if (classification?.isStorageUnavailable) {
    alert(
      "เบราว์เซอร์บล็อกการบันทึกข้อมูลในเครื่องนี้ (อาจอยู่ในโหมดส่วนตัว/Private Browsing)\n" +
      "ข้อมูลที่เพิ่งทำอาจไม่ถูกบันทึกถาวร"
    );
  } else {
    console.error("safeSetItem failed for key:", key);
    alert("บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }
}
function reportCorruptedStorageIfAny() {
  if (!corruptedStorageKeys.length) return;
  const count = corruptedStorageKeys.length;
  corruptedStorageKeys.length = 0;
  alert(
    `พบข้อมูล ${count} รายการในเครื่องนี้ที่เปิดอ่านไม่ได้ (ไฟล์เสีย) ระบบจึงใช้ค่าเริ่มต้นแทนในส่วนนั้นเพื่อให้แอปยังใช้งานต่อได้\n` +
    "แนะนำให้ตรวจสอบข้อมูลของคุณ และ Restore จากไฟล์ Backup JSON หรือจุดคืนค่าอัตโนมัติล่าสุดถ้าจำเป็น"
  );
}
function updateThemeColor() {
  const authVisible = els.authScreen && !els.authScreen.classList.contains("hidden");
  const color = authVisible ? "#faf7f1" : (getCss("--brand") || "#1f8a5b");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
}
function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  if (els.themeToggle) {
    const label = theme === "dark" ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด";
    els.themeToggle.setAttribute("aria-label", label);
    els.themeToggle.title = label;
  }
  if (els.appearanceMode) els.appearanceMode.value = theme === "dark" ? "dark" : "light";
  updateThemeColor();
}
function applyAccent(accent) {
  const safeAccent = accentThemes[accent] ? accent : "green";
  document.body.dataset.accent = safeAccent;
  if (els.accentTheme) els.accentTheme.value = safeAccent;
  if (els.themePreviewText) els.themePreviewText.textContent = accentThemes[safeAccent].name;
  document.querySelectorAll(".swatch-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.accent === safeAccent));
  updateThemeColor();
}
function setAppearance(theme) {
  applyTheme(theme);
  safeSetItem(THEME_KEY, theme);
  saveUserPreferences();
  renderMonthlyChart();
}
function setAccent(accent) {
  applyAccent(accent);
  safeSetItem(ACCENT_KEY, accent);
  saveUserPreferences();
  renderMonthlyChart();
}
function loadUserPreferences() {
  if (!currentUser) return;
  const prefs = loadJson(userKey("preferences"), {});
  applyTheme(prefs.appearance || localStorage.getItem(THEME_KEY) || "light");
  applyAccent(prefs.accent || localStorage.getItem(ACCENT_KEY) || "green");
}
function saveUserPreferences() {
  if (!currentUser) return;
  const prefs = {
    appearance: document.body.classList.contains("dark") ? "dark" : "light",
    accent: document.body.dataset.accent || "green",
    updatedAt: new Date().toISOString()
  };
  safeSetItem(userKey("preferences"), JSON.stringify(prefs));
}
function renderThemeOptions() {
  if (!els.themeSwatches) return;
  els.themeSwatches.innerHTML = Object.entries(accentThemes).map(([key, theme]) => `
    <button type="button" class="swatch-btn btn btn-subtle" data-accent="${key}" style="--swatch-1:${theme.colors[0]};--swatch-2:${theme.colors[1]}">
      <span class="swatch-dot"></span><span class="swatch-name">${theme.name}</span>
    </button>`).join("");
  els.themeSwatches.querySelectorAll(".swatch-btn").forEach(btn => btn.addEventListener("click", () => setAccent(btn.dataset.accent)));
  applyAccent(document.body.dataset.accent || "green");
}
function resolveCategory() {
  const typed = els.customCategory.value.trim();
  const selected = els.category.value.trim();
  const category = typed || selected;
  if (!category) { alert("กรุณาเลือกหรือพิมพ์หมวด"); return ""; }
  if (isReservedKey(category)) { alert("ชื่อนี้ใช้เป็นหมวดไม่ได้"); return ""; }
  if (typed) addCustomCategory(selectedType, typed, "📝", true);
  return category;
}
function resolveBudgetCategory() {
  const typed = els.budgetCustomCategory.value.trim();
  const selected = els.budgetCategory.value.trim();
  const category = typed || selected;
  if (isReservedKey(category)) { alert("ชื่อนี้ใช้เป็นหมวดไม่ได้"); return ""; }
  if (typed) addCustomCategory("expense", typed, "🎯", true);
  return category;
}
function addCustomCategory(type, name, icon = "📝", shouldRender = true, overwriteIcon = false) {
  ensureCategoryBuckets();
  normalizeCategoryIcons();
  const category = String(name || "").trim();
  if (!category || isReservedKey(category)) return false;
  const defaults = type === "income" ? defaultIncomeCategories : defaultExpenseCategories;
  const isNewCategory = !defaults.includes(category) && !customCategories[type].includes(category);
  if (isNewCategory) {
    customCategories[type].push(category);
  }
  // Only assign the icon when the category is brand new, or when the caller explicitly
  // asks to overwrite (e.g. editing a category on purpose in the category manager).
  // Otherwise, typing an existing category name while adding a transaction/budget would
  // silently reset its previously chosen emoji back to the generic default every time.
  if (icon && icon.trim() && (isNewCategory || overwriteIcon || !customCategoryIcons[category])) {
    iconMap[category] = icon.trim();
    customCategoryIcons[category] = icon.trim();
  }
  saveCategories();
  if (shouldRender) {
    updateCategoryOptions();
    updateBudgetOptions();
    renderCategoryManager();
  }
  return true;
}
function onAddCategory(event) {
  event.preventDefault();
  const type = els.categoryType.value;
  const name = els.categoryName.value.trim();
  const icon = els.categoryIcon.value.trim() || (type === "income" ? "💰" : "📝");
  if (!name) return alert("กรุณากรอกชื่อหมวด");
  addCustomCategory(type, name, icon, true, true);
  els.categoryName.value = "";
  els.categoryIcon.value = "";
  categoryViewType = type;
  renderCategoryManager();
}
function setCategoryView(type) {
  categoryViewType = type;
  renderCategoryManager();
}
function deleteCustomCategory(type, name) {
  if (!confirm(`ลบหมวด "${name}" ออกจากรายการเลือกใช่ไหม?`)) return;
  customCategories[type] = customCategories[type].filter(cat => cat !== name);
  saveCategories();
  updateCategoryOptions();
  updateBudgetOptions();
  renderCategoryManager();
}
function editCustomCategory(type, name) {
  const newName = prompt("แก้ไขชื่อหมวด", name);
  if (newName === null) return;
  const trimmedName = newName.trim();
  if (!trimmedName) return alert("ชื่อหมวดห้ามว่าง");
  const newIcon = prompt("ไอคอน / Emoji (เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน)", customCategoryIcons[name] || iconMap[name] || "");
  renameCategory(type, name, trimmedName);
  if (newIcon !== null && newIcon.trim()) {
    iconMap[trimmedName] = newIcon.trim();
    customCategoryIcons[trimmedName] = newIcon.trim();
    saveCategories();
  }
  updateCategoryOptions();
  updateBudgetOptions();
  renderCategoryManager();
  render();
}
function renameCategory(type, oldName, newName) {
  if (oldName === newName) return;
  customCategories[type] = customCategories[type].map(cat => cat === oldName ? newName : cat);
  if (customCategoryIcons[oldName] && !customCategoryIcons[newName]) {
    customCategoryIcons[newName] = customCategoryIcons[oldName];
  }
  delete customCategoryIcons[oldName];
  let transactionsChanged = false;
  transactions.forEach(item => {
    if (item.type === type && item.category === oldName) {
      item.category = newName;
      transactionsChanged = true;
    }
  });
  if (transactionsChanged) saveTransactions();
  if (Object.prototype.hasOwnProperty.call(budgets, oldName)) {
    budgets[newName] = budgets[oldName];
    delete budgets[oldName];
    safeSetItem(userKey("budgets"), JSON.stringify(budgets));
  }
  resetIconMap();
  saveCategories();
}
function renderCategoryManager() {
  if (!els.customCategoryList) return;
  const type = categoryViewType;
  els.showExpenseCats.classList.toggle("active", type === "expense");
  els.showIncomeCats.classList.toggle("active", type === "income");
  els.categoryType.value = type;
  const defaults = type === "income" ? defaultIncomeCategories : defaultExpenseCategories;
  const custom = customCategories[type] || [];
  const all = getCategories(type);
  els.categoryCount.textContent = `${getCategories("income").length + getCategories("expense").length} หมวด`;
  els.customCategoryList.innerHTML = all.map(cat => {
    const isDefault = defaults.includes(cat);
    const isCustom = custom.includes(cat);
    const badge = isDefault ? "มาตรฐาน" : isCustom ? "เพิ่มเอง" : "จากรายการเก่า";
    const actions = isCustom ? `<div class="cat-item-actions"><button type="button" class="edit-cat-btn btn btn-subtle btn-compact" data-type="${type}" data-cat="${escapeHtml(cat)}">แก้ไข</button><button type="button" class="del-cat-btn btn btn-danger btn-compact" data-type="${type}" data-cat="${escapeHtml(cat)}">ลบ</button></div>` : "";
    return `<div class="custom-cat-item"><span><b>${categoryLabelHtml(cat)}</b><small>${badge}</small></span>${actions}</div>`;
  }).join("");
  els.customCategoryList.querySelectorAll("button.del-cat-btn").forEach(btn => btn.addEventListener("click", () => deleteCustomCategory(btn.dataset.type, btn.dataset.cat)));
  els.customCategoryList.querySelectorAll("button.edit-cat-btn").forEach(btn => btn.addEventListener("click", () => editCustomCategory(btn.dataset.type, btn.dataset.cat)));
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}
function isReservedKey(value) {
  return ["__proto__", "prototype", "constructor"].includes(String(value || "").trim());
}
function categoryIcon(cat) {
  return customCategoryIcons?.[cat] || iconMap[cat] || "📝";
}
function categoryLabelHtml(cat) {
  return `${escapeHtml(categoryIcon(cat))} ${escapeHtml(cat)}`;
}
function exportCsv() {
  const header = ["date", "type", "category", "amount", "note", "hasReceipt"];
  const rows = transactions.map(t => [t.date, t.type, t.category, t.amount, t.note, Boolean(t.receipt)]);
  const csv = window.IHM_CSV_EXPORT.buildCsv(header, rows);
  downloadFile("i-have-money-export.csv", "\ufeff" + csv, "text/csv;charset=utf-8");
}
function backupJson() {
  const payload = buildBackupPayload();
  downloadFile(`i-have-money-backup-${toDateInputValue(new Date())}.json`, JSON.stringify(payload, null, 2), "application/json");
  renderSettings();
}
const MAX_RESTORE_FILE_BYTES = 20 * 1024 * 1024; // 20 MB — generous for base64 receipts, still bounded
function restoreJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const looksLikeJson = file.type === "application/json" || file.type === "text/json" || file.type === "" || /\.json$/i.test(file.name || "");
  if (!looksLikeJson) {
    event.target.value = "";
    alert("กรุณาเลือกไฟล์ .json เท่านั้น");
    return;
  }
  if (file.size > MAX_RESTORE_FILE_BYTES) {
    event.target.value = "";
    alert(`ไฟล์ใหญ่เกินไป (${window.IHM_STORAGE_SAFETY.formatBytes(file.size)}) ไฟล์สำรองข้อมูลไม่ควรเกิน ${window.IHM_STORAGE_SAFETY.formatBytes(MAX_RESTORE_FILE_BYTES)}`);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try {
      data = window.IHM_BACKUP_SCHEMA.safeJsonParse(reader.result);
    } catch {
      event.target.value = "";
      alert("ไฟล์สำรองข้อมูลไม่ถูกต้อง (เปิดอ่านเป็น JSON ไม่ได้)");
      return;
    }
    const confirmed = confirm(
      "นำข้อมูลกลับจากไฟล์ JSON จะเขียนทับข้อมูลปัจจุบันในเครื่องนี้\n" +
      "ระบบจะสร้างจุดคืนค่าของข้อมูลปัจจุบันไว้อัตโนมัติก่อนเริ่มนำข้อมูลกลับ\n" +
      "ต้องการดำเนินการต่อหรือไม่?"
    );
    if (!confirmed) {
      event.target.value = "";
      return;
    }
    let restored = false;
    try {
      restored = restoreFromBackupPayload(data);
    } catch (error) {
      console.error("restoreFromBackupPayload threw:", error);
      alert(`นำข้อมูลกลับไม่สำเร็จ: ${error.message || "เกิดข้อผิดพลาดที่ไม่คาดคิด"}`);
    }
    event.target.value = "";
    if (restored) alert("นำข้อมูลกลับเรียบร้อย");
  };
  reader.onerror = () => {
    event.target.value = "";
    alert("อ่านไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  };
  reader.readAsText(file);
}
function buildBackupPayload() {
  const updatedAt = new Date().toISOString();
  const safeSettings = normalizeSettings({ ...settings, lastBackup: updatedAt });
  settings = safeSettings;
  safeSetItem(SETTINGS_KEY, JSON.stringify(settings));
  const user = currentUser ? {
    email: currentUser.email || "",
    name: currentUser.name || "",
    googleId: currentUser.googleId || googleProfile?.googleId || ""
  } : { email: "", name: "", googleId: "" };
  const payload = {
    app: "I Have Money",
    version: window.IHM_BACKUP_SCHEMA.BACKUP_SCHEMA_VERSION,
    updatedAt,
    user,
    transactions: Array.isArray(transactions) ? transactions : [],
    budgets: normalizeBudgets(budgets),
    categories: normalizeBackupCategories(customCategories),
    categoryIcons: normalizeBackupCategoryIcons(customCategoryIcons),
    settings: safeSettings,
    preferences: currentUser ? loadJson(userKey("preferences"), {}) : {}
  };
  warnIfBackupIsLarge(payload);
  return payload;
}
/**
 * Restore a backup payload safely:
 *   1. Validate + normalize the ENTIRE payload in memory first (never
 *      touches localStorage). Rejects the whole file if any transaction
 *      fails validation — no partial import of "the good half" of a file,
 *      since that could silently drop data the user expected to keep.
 *   2. Warn (and allow cancelling) if the backup belongs to a different
 *      Google account than the one currently signed in.
 *   3. Snapshot every localStorage key about to be overwritten, then write
 *      the new values. If any write fails partway through (most likely
 *      QuotaExceededError), write the snapshotted values back immediately.
 *      localStorage has no real transactions, so this is a best-effort
 *      compensating rollback, not an atomic guarantee — see
 *      lib/storageSafety.mjs for the two possible failure shapes this can
 *      still leave behind, both surfaced to the user rather than hidden.
 *   4. Only update the app's in-memory state (and re-render) after every
 *      write has succeeded, so a failed restore never leaves the running
 *      app showing data that does not match what is actually in storage.
 */
function restoreFromBackupPayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== "object") throw new Error("Invalid backup payload");

  const validation = window.IHM_BACKUP_SCHEMA.validateAndNormalizeBackupPayload(rawPayload);
  if (!validation.ok) {
    const shown = validation.errors.slice(0, 8);
    const more = validation.errors.length > shown.length ? `\n...และอีก ${validation.errors.length - shown.length} ข้อ` : "";
    alert(`ไฟล์สำรองข้อมูลไม่ผ่านการตรวจสอบ ยังไม่มีการเปลี่ยนแปลงข้อมูลใด ๆ:\n\n${shown.map(e => `• ${e}`).join("\n")}${more}`);
    return false;
  }
  const payload = validation.normalized;

  const backupEmail = payload.user.email;
  const activeEmail = String(currentUser?.email || "").trim().toLowerCase();
  if (backupEmail && activeEmail && backupEmail !== activeEmail) {
    const proceed = confirm(
      `ไฟล์สำรองข้อมูลนี้เป็นของบัญชี "${payload.user.email}"\n` +
      `แต่ตอนนี้เข้าสู่ระบบด้วยบัญชี "${currentUser.email}"\n` +
      "ถ้าดำเนินการต่อ ข้อมูลของบัญชีนี้จะถูกเขียนทับด้วยข้อมูลจากบัญชีอื่น\n" +
      "ต้องการดำเนินการต่อหรือไม่?"
    );
    if (!proceed) return false;
  }

  createRestorePoint();

  // Only touch settings/preferences keys if the incoming file actually
  // declared them — an omitted field must leave the user's current
  // settings/preferences untouched, not reset them to blank defaults.
  const hasPreferences = rawPayload.preferences !== undefined && rawPayload.preferences !== null;
  const hasSettings = rawPayload.settings !== undefined && rawPayload.settings !== null;
  const finalSettings = hasSettings
    ? normalizeSettings({ ...payload.settings, lastBackup: payload.updatedAt || rawPayload.exportedAt || payload.settings.lastBackup || settings.lastBackup || "" })
    : null;

  const keysToWrite = [userKey("transactions"), userKey("budgets"), userKey("categories"), userKey("categoryIcons")];
  if (hasPreferences) keysToWrite.push(userKey("preferences"));
  if (hasSettings) keysToWrite.push(SETTINGS_KEY);
  const snapshot = window.IHM_STORAGE_SAFETY.snapshotKeys(localStorage, keysToWrite);

  let writeFailed = false;
  writeFailed = !safeSetItem(userKey("transactions"), JSON.stringify(payload.transactions)) || writeFailed;
  writeFailed = !safeSetItem(userKey("budgets"), JSON.stringify(payload.budgets)) || writeFailed;
  writeFailed = !safeSetItem(userKey("categories"), JSON.stringify(payload.categories)) || writeFailed;
  writeFailed = !safeSetItem(userKey("categoryIcons"), JSON.stringify(payload.categoryIcons)) || writeFailed;
  if (hasPreferences) writeFailed = !safeSetItem(userKey("preferences"), JSON.stringify(payload.preferences)) || writeFailed;
  if (hasSettings) writeFailed = !safeSetItem(SETTINGS_KEY, JSON.stringify(finalSettings)) || writeFailed;

  if (writeFailed) {
    const failedKeys = window.IHM_STORAGE_SAFETY.restoreSnapshot(localStorage, snapshot);
    alert(
      "การนำข้อมูลกลับล้มเหลวระหว่างเขียนข้อมูล ระบบพยายามคืนค่าข้อมูลเดิมกลับให้แล้ว\n" +
      "(localStorage ไม่รองรับ transaction จริง การคืนค่านี้จึงเป็นความพยายามที่ดีที่สุด ไม่ใช่การรับประกัน 100%)\n" +
      (failedKeys.length
        ? `พบ ${failedKeys.length} รายการที่คืนค่าไม่สำเร็จ กรุณาลบข้อมูล/รูปใบเสร็จเก่าบางส่วนเพื่อเพิ่มพื้นที่ว่าง แล้วลองใหม่`
        : "ข้อมูลเดิมถูกคืนค่าเรียบร้อยแล้ว แอปยังใช้งานได้ตามปกติ")
    );
    // In-memory state (transactions/budgets/etc. module variables) was never
    // reassigned above — only localStorage was touched — so the running app
    // is already consistent with the just-restored snapshot. No further
    // in-memory rollback is needed.
    return false;
  }

  transactions = payload.transactions;
  budgets = payload.budgets;
  customCategories = payload.categories;
  customCategoryIcons = payload.categoryIcons;
  resetIconMap();
  if (hasSettings) settings = finalSettings;
  if (hasPreferences) loadUserPreferences();
  loadSettingsToForm();
  renderThemeOptions();
  updateCategoryOptions();
  updateBudgetOptions();
  renderCategoryManager();
  render();
  renderSettings();

  if (validation.warnings?.length) alert(validation.warnings.join("\n"));
  return true;
}
function normalizeBackupCategories(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    income: Array.isArray(source.income) ? source.income.map(item => String(item || "").trim()).filter(item => item && !isReservedKey(item)) : [],
    expense: Array.isArray(source.expense) ? source.expense.map(item => String(item || "").trim()).filter(item => item && !isReservedKey(item)) : []
  };
}
function normalizeBackupCategoryIcons(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([cat, icon]) => [String(cat || "").trim(), String(icon || "").trim().slice(0, 8)])
      .filter(([cat, icon]) => cat && icon && !isReservedKey(cat))
  );
}
// Renamed from "createAutomaticLocalBackup": this snapshot lives in the same
// localStorage origin/quota as the app's main data (key AUTO_LOCAL_BACKUP_KEY
// is unchanged for backward compatibility with anything already saved on a
// user's device). It is NOT an off-device backup — clearing site data or
// switching devices deletes it along with everything else. The UI calls
// this a "จุดคืนค่า" (restore point) rather than "Auto Local Backup" to make
// that distinction clear to the user.
function createRestorePoint() {
  if (!currentUser) return;
  const backups = loadJson(AUTO_LOCAL_BACKUP_KEY, []);
  const snapshot = {
    createdAt: new Date().toISOString(),
    userKey: currentUser.storageKey || currentUser.email,
    payload: buildBackupPayload()
  };
  backups.unshift(snapshot);
  // NOTE: this 5-slot buffer is currently shared across every local account
  // on the same device/browser (not namespaced per user beyond the
  // `userKey` field used for display filtering below) — a heavy user
  // switching between multiple local accounts on one device could evict
  // another account's restore points sooner than expected. Tracked as a
  // known limitation; namespacing this key per-account is a larger storage
  // migration left for a future pass rather than folded into this change.
  safeSetItem(AUTO_LOCAL_BACKUP_KEY, JSON.stringify(backups.slice(0, 5)));
}
function currentUserStorageKey() {
  return currentUser?.storageKey || currentUser?.email || "";
}
function renderRestorePoints() {
  if (!els.restorePointList) return;
  const all = loadJson(AUTO_LOCAL_BACKUP_KEY, []);
  const mine = all.filter(entry => entry.userKey === currentUserStorageKey());
  if (!mine.length) {
    els.restorePointList.innerHTML = `<p class="hint">ยังไม่มีจุดคืนค่าในเครื่องนี้ ระบบจะสร้างให้อัตโนมัติก่อนนำข้อมูลกลับครั้งถัดไป</p>`;
    return;
  }
  const formatter = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });
  els.restorePointList.innerHTML = mine.map((entry, index) => {
    const count = Array.isArray(entry.payload?.transactions) ? entry.payload.transactions.length : 0;
    const when = formatter.format(new Date(entry.createdAt));
    return `<div class="restore-point-item"><span>${escapeHtml(when)} • ${count} รายการ</span><button type="button" class="ghost-btn btn btn-secondary restore-point-btn" data-index="${index}">กู้คืนจุดนี้</button></div>`;
  }).join("");
  els.restorePointList.querySelectorAll(".restore-point-btn").forEach(btn => {
    btn.addEventListener("click", () => restoreFromRestorePoint(Number(btn.dataset.index)));
  });
}
function restoreFromRestorePoint(index) {
  const all = loadJson(AUTO_LOCAL_BACKUP_KEY, []);
  const mine = all.filter(entry => entry.userKey === currentUserStorageKey());
  const entry = mine[index];
  if (!entry) return;
  const formatter = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });
  const confirmed = confirm(
    `กู้คืนข้อมูลกลับไปเป็นจุดคืนค่าเมื่อ ${formatter.format(new Date(entry.createdAt))} ใช่ไหม?\n` +
    "ข้อมูลปัจจุบันในเครื่องนี้จะถูกเขียนทับ (ระบบจะสร้างจุดคืนค่าใหม่ของสถานะปัจจุบันไว้ก่อนเช่นกัน)"
  );
  if (!confirmed) return;
  let restored = false;
  try {
    restored = restoreFromBackupPayload(entry.payload);
  } catch (error) {
    console.error("restoreFromRestorePoint threw:", error);
    alert(`กู้คืนไม่สำเร็จ: ${error.message || "เกิดข้อผิดพลาดที่ไม่คาดคิด"}`);
  }
  if (restored) alert("กู้คืนข้อมูลจากจุดคืนค่าเรียบร้อย");
}
function renderStorageUsage() {
  if (!els.storageUsage) return;
  const bytes = window.IHM_STORAGE_SAFETY.estimateStorageUsageBytes(localStorage);
  els.storageUsage.textContent = `ใช้พื้นที่ ~${window.IHM_STORAGE_SAFETY.formatBytes(bytes)}`;
}
function warnIfBackupIsLarge(payload) {
  const sizeMb = new Blob([JSON.stringify(payload)]).size / (1024 * 1024);
  if (sizeMb > 8) {
    alert("ไฟล์สำรองข้อมูลมีขนาดใหญ่ เพราะรูปใบเสร็จยังเก็บเป็น base64\nTODO: แยกรูปใบเสร็จเป็นไฟล์ใน Google Drive แล้วเก็บ fileId ใน JSON");
  }
}
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
async function requestGoogleDriveAccess() {
  if (!googleDriveTokenClient) {
    alert("ยังไม่ได้ตั้งค่า Google Client ID\nให้คัดลอก google.config.example.js เป็น google.config.js แล้วใส่ Google OAuth Client ID");
    return false;
  }
  googleDriveTokenClient.requestAccessToken({ prompt: googleDriveAccessToken ? "" : "consent" });
  return true;
}
async function ensureGoogleDriveAccess() {
  if (googleDriveAccessToken) return true;
  await requestGoogleDriveAccess();
  return false;
}
async function driveFetch(url, options = {}) {
  if (!googleDriveAccessToken) throw new Error("Google Drive is not connected");
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${googleDriveAccessToken}`
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Google Drive request failed (${response.status})`);
  }
  return response;
}
async function findDriveBackupFile() {
  const query = encodeURIComponent(`name='${GOOGLE_BACKUP_FILENAME}' and trashed=false`);
  const fields = encodeURIComponent("files(id,name,modifiedTime)");
  const response = await driveFetch(`${GOOGLE_DRIVE_FILES_URL}?spaces=appDataFolder&q=${query}&fields=${fields}`);
  const data = await response.json();
  return data.files?.[0] || null;
}
async function createDriveBackupFile(payload) {
  const boundary = `ihm_${Date.now()}`;
  const metadata = { name: GOOGLE_BACKUP_FILENAME, parents: ["appDataFolder"], mimeType: "application/json" };
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(payload, null, 2),
    `--${boundary}--`
  ].join("\r\n");
  const response = await driveFetch(`${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,modifiedTime`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body
  });
  return response.json();
}
async function updateDriveBackupFile(fileId, payload) {
  const response = await driveFetch(`${GOOGLE_DRIVE_UPLOAD_URL}/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,modifiedTime`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(payload, null, 2)
  });
  return response.json();
}
async function downloadDriveBackupFile(fileId) {
  const response = await driveFetch(`${GOOGLE_DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?alt=media`);
  return response.json();
}
async function syncToGoogleDrive() {
  if (!googleDriveAccessToken) {
    await requestGoogleDriveAccess();
    alert("เชื่อมต่อ Google Drive แล้วกดสำรองข้อมูลไป Google Drive อีกครั้ง");
    return;
  }
  try {
    setSyncStatus("syncing");
    const payload = buildBackupPayload();
    const existing = await findDriveBackupFile();
    const result = existing ? await updateDriveBackupFile(existing.id, payload) : await createDriveBackupFile(payload);
    settings.syncMode = "google-drive";
    settings.googleDriveConnected = "true";
    settings.lastBackup = payload.updatedAt;
    settings.lastSync = result.modifiedTime || payload.updatedAt;
    settings.lastSyncError = "";
    safeSetItem(SETTINGS_KEY, JSON.stringify(settings));
    renderSettings();
    alert("สำรองข้อมูลไป Google Drive เรียบร้อย");
  } catch (error) {
    console.warn("Google Drive backup failed:", error);
    settings.lastSyncError = error.message || "Sync failed";
    safeSetItem(SETTINGS_KEY, JSON.stringify(settings));
    setSyncStatus("failed");
    alert("สำรองข้อมูลไป Google Drive ไม่สำเร็จ");
  }
}
async function syncFromGoogleDrive() {
  if (!googleDriveAccessToken) {
    await requestGoogleDriveAccess();
    alert("เชื่อมต่อ Google Drive แล้วกดดึงข้อมูลจาก Google Drive อีกครั้ง");
    return;
  }
  try {
    setSyncStatus("syncing");
    const existing = await findDriveBackupFile();
    if (!existing) {
      renderSettings();
      alert("ยังไม่พบไฟล์สำรองใน Google Drive");
      return;
    }
    const payload = await downloadDriveBackupFile(existing.id);
    if (!confirm("พบข้อมูลบน Google Drive ต้องการนำข้อมูลบน Drive มาใช้กับเครื่องนี้หรือไม่?\nระบบจะสร้าง local backup อัตโนมัติก่อนนำข้อมูลกลับ")) {
      renderSettings();
      return;
    }
    const restored = restoreFromBackupPayload(payload);
    if (!restored) {
      renderSettings();
      return;
    }
    settings.syncMode = "google-drive";
    settings.googleDriveConnected = "true";
    settings.lastSync = new Date().toISOString();
    settings.lastSyncError = "";
    safeSetItem(SETTINGS_KEY, JSON.stringify(settings));
    renderSettings();
    alert("ดึงข้อมูลจาก Google Drive เรียบร้อย");
  } catch (error) {
    console.warn("Google Drive restore failed:", error);
    settings.lastSyncError = error.message || "Sync failed";
    safeSetItem(SETTINGS_KEY, JSON.stringify(settings));
    setSyncStatus("failed");
    alert("ดึงข้อมูลจาก Google Drive ไม่สำเร็จ");
  }
}
async function promptGoogleDriveConflictIfNeeded() {
  if (!googleConfig || !currentUser) return;
  shouldCheckDriveConflict = true;
  await requestGoogleDriveAccess();
  setSyncStatus("google");
}
async function resolveDriveConflict(file) {
  const choice = prompt("พบไฟล์สำรองบน Google Drive\nพิมพ์ 1 ใช้ข้อมูลบนเครื่อง\nพิมพ์ 2 ใช้ข้อมูลจาก Google Drive\nพิมพ์ 3 รวมข้อมูลแบบ merge", "1");
  if (choice === "2") {
    const payload = await downloadDriveBackupFile(file.id);
    if (!restoreFromBackupPayload(payload)) return "local";
    return "drive";
  }
  if (choice === "3") {
    const payload = await downloadDriveBackupFile(file.id);
    if (!restoreFromBackupPayload(mergeBackupPayloads(buildBackupPayload(), payload))) return "local";
    await syncToGoogleDrive();
    return "merge";
  }
  return "local";
}
function mergeBackupPayloads(localPayload, drivePayload) {
  const byId = new Map();
  [...(drivePayload.transactions || []), ...(localPayload.transactions || [])].forEach(item => {
    if (item?.id) byId.set(item.id, item);
  });
  const categories = {
    income: [...new Set([...(drivePayload.categories?.income || []), ...(localPayload.categories?.income || [])])],
    expense: [...new Set([...(drivePayload.categories?.expense || []), ...(localPayload.categories?.expense || [])])]
  };
  return {
    ...drivePayload,
    ...localPayload,
    updatedAt: new Date().toISOString(),
    transactions: [...byId.values()],
    budgets: normalizeBudgets({ ...(drivePayload.budgets || {}), ...(localPayload.budgets || {}) }),
    categories,
    categoryIcons: normalizeBackupCategoryIcons({ ...(drivePayload.categoryIcons || {}), ...(localPayload.categoryIcons || {}) }),
    settings: normalizeSettings({ ...(drivePayload.settings || {}), ...(localPayload.settings || {}), syncMode: "google-drive" })
  };
}
function setSyncStatus(state) {
  if (state === "syncing") {
    if (els.syncStatus) els.syncStatus.textContent = "Syncing...";
    return;
  }
  if (state === "failed") {
    if (els.syncStatus) els.syncStatus.textContent = "Sync failed";
    return;
  }
  renderSettings();
}
function normalizeSettings(value = {}) {
  const allowedModes = new Set(["local", "google-drive"]);
  const syncMode = allowedModes.has(value.syncMode) ? value.syncMode : "local";
  return {
    syncMode,
    googleDriveConnected: String(value.googleDriveConnected || ""),
    lastBackup: String(value.lastBackup || ""),
    lastSync: String(value.lastSync || ""),
    lastSyncError: String(value.lastSyncError || "")
  };
}
function syncModeLabel(mode) {
  if (mode === "google-drive") return "Google Drive";
  return "Local only";
}
function loadSettingsToForm() {
  settings = normalizeSettings(settings);
  els.syncMode.value = settings.syncMode || "local";
}
function saveSettingsFromForm() {
  settings = normalizeSettings({ ...settings, syncMode: els.syncMode.value, lastBackup: settings.lastBackup || "" });
  safeSetItem(SETTINGS_KEY, JSON.stringify(settings));
  renderSettings();
}
async function syncNow() {
  saveSettingsFromForm();
  if (settings.syncMode === "google-drive" || googleDriveAccessToken) {
    await syncToGoogleDrive();
    return;
  }
  els.syncStatus.textContent = "Local only";
  alert("Local only\nข้อมูลยังเก็บในเครื่องและสามารถสำรองเป็นไฟล์ JSON ได้");
}
function renderSettings() {
  settings = normalizeSettings(settings);
  const modeName = getSyncStatusLabel();
  els.syncStatus.textContent = modeName;
  els.lastBackup.textContent = settings.lastBackup ? `Last backup: ${new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(settings.lastBackup))}` : "Last backup: ยังไม่มี";
  els.accountInfo.textContent = `${currentUser?.name || "ผู้ใช้"} • ${currentUser?.email || ""}${currentAuthProvider === "google" ? " • Google Account" : ""}`;
  renderRestorePoints();
  renderStorageUsage();
}
function getSyncStatusLabel() {
  if (settings.lastSyncError) return "Sync failed";
  if (googleDriveAccessToken) return "Google Drive connected";
  if (currentAuthProvider === "google") return "Google connected";
  return syncModeLabel(settings.syncMode);
}
function seedExampleDataIfEmpty() {
  if (transactions.length) return;
  const today = toDateInputValue(new Date());
  const dates = [today, offsetDate(-1), offsetDate(-2), offsetDate(-8), offsetDate(-33)];
  transactions = [
    { id: newId(), type: "income", date: dates[0], amount: 1200, category: "ขายของ", note: "ขายสินค้า", receipt: "", createdAt: new Date().toISOString() },
    { id: newId(), type: "expense", date: dates[0], amount: 85, category: "อาหาร", note: "มื้อกลางวัน", receipt: "", createdAt: new Date().toISOString() },
    { id: newId(), type: "expense", date: dates[1], amount: 45, category: "เดินทาง", note: "ค่าน้ำมัน/รถ", receipt: "", createdAt: new Date().toISOString() },
    { id: newId(), type: "expense", date: dates[2], amount: 350, category: "ค่าส่ง", note: "ค่าส่งสินค้า", receipt: "", createdAt: new Date().toISOString() },
    { id: newId(), type: "income", date: dates[3], amount: 2800, category: "ขายของ", note: "ยอดขายรายสัปดาห์", receipt: "", createdAt: new Date().toISOString() },
    { id: newId(), type: "expense", date: dates[4], amount: 990, category: "บ้าน", note: "ของใช้ในบ้าน", receipt: "", createdAt: new Date().toISOString() }
  ];
  budgets = { "อาหาร": 5000, "เดินทาง": 2500, "ค่าส่ง": 3000, "ช้อปปิ้ง": 2000 };
  customCategories = { income: ["รายได้เสริม"], expense: ["ค่าแมว", "ค่าโฆษณา"] };
  customCategoryIcons = { "รายได้เสริม": "💵", "ค่าแมว": "🐱", "ค่าโฆษณา": "📣" };
  resetIconMap();
  saveTransactions();
  safeSetItem(userKey("budgets"), JSON.stringify(budgets));
  saveCategories();
}
function offsetDate(days) { const d = new Date(); d.setDate(d.getDate() + days); return toDateInputValue(d); }

function newId() {
  return (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}
async function hashPassword(password) {
  if (password === "123456") return "demo-123456";
  if (crypto?.subtle && window.isSecureContext) {
    const data = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return "sha256:" + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }
  // Fallback for opening index.html directly from file:// during testing.
  let hash = 2166136261;
  for (const char of password) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return "fnv1a:" + (hash >>> 0).toString(16);
}
async function verifyPassword(user, password) {
  if (user.passwordHash) return user.passwordHash === await hashPassword(password);
  return user.password === password;
}
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("service-worker.js", { type: "module" }).then(registration => {
    // A worker already waiting (e.g. the tab was open when a new version
    // finished installing in the background) — offer the update immediately.
    if (registration.waiting) showUpdateBanner(registration);
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        // "installed" while there's already an active controller means this
        // is an UPDATE (not the very first install on this device), and the
        // new worker is now sitting in "waiting" because service-worker.js
        // no longer calls self.skipWaiting() automatically.
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          showUpdateBanner(registration);
        }
      });
    });
  }).catch(() => {});

  let reloadedAfterUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadedAfterUpdate) return;
    reloadedAfterUpdate = true;
    window.location.reload();
  });
}
function showUpdateBanner(registration) {
  if (!els.updateBanner || !els.updateReloadBtn) return;
  els.updateBanner.classList.remove("hidden");
  els.updateReloadBtn.onclick = () => {
    registration.waiting?.postMessage("SKIP_WAITING");
  };
}
