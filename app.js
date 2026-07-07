const STORAGE_PREFIX = "ihm_v4";
const SESSION_KEY = `${STORAGE_PREFIX}_session`;
const THEME_KEY = `${STORAGE_PREFIX}_theme`;
const ACCENT_KEY = `${STORAGE_PREFIX}_accent`;
const SETTINGS_KEY = `${STORAGE_PREFIX}_settings`;
const USERS_KEY = `${STORAGE_PREFIX}_users`;

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
  Object.keys(iconMap).forEach(key => delete iconMap[key]);
  Object.assign(iconMap, defaultIconMap, customCategoryIcons);
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
let settings = loadJson(SETTINGS_KEY, { syncMode: "local", supabaseUrl: "", supabaseKey: "", driveFolder: "", lastBackup: "" });

const els = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheElements();
  applyTheme(localStorage.getItem(THEME_KEY) || "light");
  applyAccent(localStorage.getItem(ACCENT_KEY) || "green");
  bindAuthEvents();
  bindAppEvents();
  const session = loadJson(SESSION_KEY, null);
  if (session?.email) loginSession(session.email);
  else showAuth("login");
  registerServiceWorker();
}

function cacheElements() {
  ["authScreen","appShell","loginTab","signupTab","loginForm","signupForm","loginEmail","loginPassword","signupName","signupEmail","signupPassword","demoLogin","greeting","syncStatus","syncNow","themeToggle","monthBalance","monthIncome","monthExpense","todayNet","weekNet","monthCount","transactionForm","editId","date","amount","category","customCategory","categorySuggestions","categoryChips","note","receipt","receiptPreview","submitBtn","clearForm","calendarTitle","calendarGrid","selectedDateTitle","selectedDateTotal","transactionList","categoryReport","exportCsv","prevMonth","nextMonth","budgetForm","budgetCategory","budgetCustomCategory","expenseCategorySuggestions","budgetCategoryChips","budgetAmount","budgetList","budgetTotal","budgetMonthTitle","monthlyChart","syncMode","supabaseUrl","supabaseKey","driveFolder","backupJson","restoreJson","lastBackup","accountInfo","logoutBtn","appearanceMode","accentTheme","themePreviewText","themeSwatches","categoryForm","categoryType","categoryName","categoryIcon","categoryCount","showExpenseCats","showIncomeCats","customCategoryList","receiptDialog","receiptImage","closeReceipt"].forEach(id => els[id] = document.getElementById(id));
}

function bindAuthEvents() {
  els.loginTab.addEventListener("click", () => showAuth("login"));
  els.signupTab.addEventListener("click", () => showAuth("signup"));
  els.signupForm.addEventListener("submit", onSignup);
  els.loginForm.addEventListener("submit", onLogin);
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
  els.logoutBtn.addEventListener("click", logout);
  els.themeToggle.addEventListener("click", () => {
    const next = document.body.classList.contains("dark") ? "light" : "dark";
    setAppearance(next);
  });
  els.appearanceMode.addEventListener("change", () => setAppearance(els.appearanceMode.value));
  els.accentTheme.addEventListener("change", () => setAccent(els.accentTheme.value));
  els.receipt.addEventListener("change", onReceiptSelected);
  els.closeReceipt.addEventListener("click", () => els.receiptDialog.close());
  [els.syncMode, els.supabaseUrl, els.supabaseKey, els.driveFolder].forEach(el => el.addEventListener("change", saveSettingsFromForm));
}

function showAuth(mode) {
  els.authScreen.classList.remove("hidden");
  els.appShell.classList.add("hidden");
  els.loginTab.classList.toggle("active", mode === "login");
  els.signupTab.classList.toggle("active", mode === "signup");
  els.loginForm.classList.toggle("hidden", mode !== "login");
  els.signupForm.classList.toggle("hidden", mode !== "signup");
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
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
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
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  startUser(email);
}

function ensureDemoUser() {
  const users = loadJson(USERS_KEY, []);
  if (!users.some(user => user.email === "demo@ihavemoney.app")) {
    users.push({ name: "Demo User", email: "demo@ihavemoney.app", passwordHash: "demo-123456", createdAt: new Date().toISOString() });
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
}

function startUser(email) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ email }));
  loginSession(email);
}

function loginSession(email) {
  const users = loadJson(USERS_KEY, []);
  currentUser = users.find(user => user.email === email) || { name: "ผู้ใช้", email };
  transactions = loadJson(userKey("transactions"), []);
  budgets = loadJson(userKey("budgets"), {});
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
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  showAuth("login");
}

function userKey(name) { return `${STORAGE_PREFIX}_${currentUser.email}_${name}`; }

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
  if (!amount || amount <= 0) return alert("กรุณาใส่จำนวนเงินให้ถูกต้อง");
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
  const defaults = type === "income" ? defaultIncomeCategories : defaultExpenseCategories;
  const custom = Array.isArray(customCategories[type]) ? customCategories[type] : [];
  const used = transactions.filter(t => t.type === type).map(t => t.category).filter(Boolean);
  return uniqueCategories([...defaults, ...custom, ...used]);
}
function uniqueCategories(list) {
  return [...new Set(list.map(cat => String(cat || "").trim()).filter(Boolean))];
}
function normalizeCategories() {
  customCategories = {
    income: uniqueCategories(customCategories?.income || []),
    expense: uniqueCategories(customCategories?.expense || [])
  };
}
function saveCategories() {
  normalizeCategories();
  localStorage.setItem(userKey("categories"), JSON.stringify(customCategories));
  localStorage.setItem(userKey("categoryIcons"), JSON.stringify(customCategoryIcons));
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
  container.innerHTML = list.slice(0, 14).map(cat => `<button type="button" class="chip-btn" data-cat="${escapeHtml(cat)}">${customCategoryIcons[cat] || iconMap[cat] || "📝"} ${escapeHtml(cat)}</button>`).join("");
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
  }).catch(() => alert("ไม่สามารถอ่านรูปใบเสร็จได้"));
  reader.readAsDataURL(file);
}

function compressImage(dataUrl, maxWidth, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
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
  els.categoryReport.innerHTML = entries.length ? entries.map(([cat, value]) => `<div class="cat-row"><span>${iconMap[cat] || "📝"} ${cat}</span><b>${money(value)}</b><div class="cat-bar-wrap"><div class="cat-bar" style="width:${Math.round((value / max) * 100)}%"></div></div></div>`).join("") : `<p class="hint">ยังไม่มีรายจ่ายในเดือนนี้</p>`;
}

function renderBudgets() {
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
    return `<div class="cat-row"><span>${iconMap[cat] || "📝"} ${cat}<br><small class="hint">ใช้ ${money(use)} / งบ ${budget ? money(budget) : "ยังไม่ตั้ง"}</small></span><b>${budget ? pct + "%" : "-"}</b><div class="cat-bar-wrap"><div class="cat-bar ${state}" style="width:${width}%"></div></div></div>`;
  }).join("") : `<p class="hint">ยังไม่ได้ตั้งงบประมาณ เริ่มจากเลือกหมวดและใส่วงเงินต่อเดือน</p>`;
}

function onSaveBudget(event) {
  event.preventDefault();
  const cat = resolveBudgetCategory();
  if (!cat) return alert("กรุณาเลือกหรือพิมพ์หมวดงบประมาณ");
  budgets[cat] = Number(els.budgetAmount.value || 0);
  localStorage.setItem(userKey("budgets"), JSON.stringify(budgets));
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
function saveTransactions() { localStorage.setItem(userKey("transactions"), JSON.stringify(transactions)); }
function groupSum(items, field) { return items.reduce((acc, item) => { acc[item[field]] = (acc[item[field]] || 0) + Number(item.amount); return acc; }, {}); }
function sum(items) { return items.reduce((total, item) => total + Number(item.amount), 0); }
function net(items) { return sum(items.filter(t => t.type === "income")) - sum(items.filter(t => t.type === "expense")); }
function money(value) { return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(value); }
function compactMoney(value) { return new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
function toDateInputValue(date) { const tzOffset = date.getTimezoneOffset() * 60000; return new Date(date - tzOffset).toISOString().slice(0, 10); }
function filterByMonth(items, date) { const year = date.getFullYear(); const month = date.getMonth(); return items.filter(item => { const d = new Date(item.date + "T12:00:00"); return d.getFullYear() === year && d.getMonth() === month; }); }
function filterCurrentWeek(items) { const today = new Date(); const day = (today.getDay() + 6) % 7; const monday = new Date(today); monday.setDate(today.getDate() - day); monday.setHours(0, 0, 0, 0); const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999); return items.filter(item => { const d = new Date(item.date + "T12:00:00"); return d >= monday && d <= sunday; }); }
function formatThaiDate(dateStr) { return new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(dateStr + "T12:00:00")); }
function loadJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  if (els.themeToggle) els.themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  if (els.appearanceMode) els.appearanceMode.value = theme === "dark" ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", getCss("--brand") || "#1f8a5b");
}
function applyAccent(accent) {
  const safeAccent = accentThemes[accent] ? accent : "green";
  document.body.dataset.accent = safeAccent;
  if (els.accentTheme) els.accentTheme.value = safeAccent;
  if (els.themePreviewText) els.themePreviewText.textContent = accentThemes[safeAccent].name;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", getCss("--brand") || accentThemes[safeAccent].colors[0]);
  document.querySelectorAll(".swatch-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.accent === safeAccent));
}
function setAppearance(theme) {
  applyTheme(theme);
  localStorage.setItem(THEME_KEY, theme);
  saveUserPreferences();
  renderMonthlyChart();
}
function setAccent(accent) {
  applyAccent(accent);
  localStorage.setItem(ACCENT_KEY, accent);
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
  localStorage.setItem(userKey("preferences"), JSON.stringify(prefs));
}
function renderThemeOptions() {
  if (!els.themeSwatches) return;
  els.themeSwatches.innerHTML = Object.entries(accentThemes).map(([key, theme]) => `
    <button type="button" class="swatch-btn" data-accent="${key}" style="--swatch-1:${theme.colors[0]};--swatch-2:${theme.colors[1]}">
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
  if (typed) addCustomCategory(selectedType, typed, "📝", true);
  return category;
}
function resolveBudgetCategory() {
  const typed = els.budgetCustomCategory.value.trim();
  const selected = els.budgetCategory.value.trim();
  const category = typed || selected;
  if (typed) addCustomCategory("expense", typed, "🎯", true);
  return category;
}
function addCustomCategory(type, name, icon = "📝", shouldRender = true, overwriteIcon = false) {
  const category = String(name || "").trim();
  if (!category) return false;
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
    localStorage.setItem(userKey("budgets"), JSON.stringify(budgets));
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
    const actions = isCustom ? `<div class="cat-item-actions"><button type="button" class="edit-cat-btn" data-type="${type}" data-cat="${escapeHtml(cat)}">แก้ไข</button><button type="button" class="del-cat-btn" data-type="${type}" data-cat="${escapeHtml(cat)}">ลบ</button></div>` : "";
    return `<div class="custom-cat-item"><span><b>${customCategoryIcons[cat] || iconMap[cat] || "📝"} ${escapeHtml(cat)}</b><small>${badge}</small></span>${actions}</div>`;
  }).join("");
  els.customCategoryList.querySelectorAll("button.del-cat-btn").forEach(btn => btn.addEventListener("click", () => deleteCustomCategory(btn.dataset.type, btn.dataset.cat)));
  els.customCategoryList.querySelectorAll("button.edit-cat-btn").forEach(btn => btn.addEventListener("click", () => editCustomCategory(btn.dataset.type, btn.dataset.cat)));
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}
function exportCsv() {
  const header = ["date", "type", "category", "amount", "note", "hasReceipt"];
  const rows = transactions.map(t => [t.date, t.type, t.category, t.amount, t.note, Boolean(t.receipt)]);
  const csv = [header, ...rows].map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  downloadFile("i-have-money-export.csv", "\ufeff" + csv, "text/csv;charset=utf-8");
}
function backupJson() {
  // Export the account's public profile info only; never write passwordHash into a file
  // the user may share, upload, or store outside the device.
  const safeUser = currentUser ? { name: currentUser.name, email: currentUser.email, createdAt: currentUser.createdAt } : null;
  const payload = { app: "I Have Money", version: 4, user: safeUser, transactions, budgets, categories: customCategories, categoryIcons: customCategoryIcons, settings, preferences: loadJson(userKey("preferences"), {}), exportedAt: new Date().toISOString() };
  settings.lastBackup = new Date().toISOString();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  downloadFile(`i-have-money-backup-${toDateInputValue(new Date())}.json`, JSON.stringify(payload, null, 2), "application/json");
  renderSettings();
}
function restoreJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      transactions = Array.isArray(data.transactions) ? data.transactions : [];
      budgets = data.budgets || {};
      saveTransactions();
      localStorage.setItem(userKey("budgets"), JSON.stringify(budgets));
      customCategories = data.categories || { income: [], expense: [] };
      customCategoryIcons = data.categoryIcons || {};
      resetIconMap();
      saveCategories();
      if (data.preferences) { localStorage.setItem(userKey("preferences"), JSON.stringify(data.preferences)); loadUserPreferences(); }
      if (data.settings) {
        settings = { syncMode: data.settings.syncMode || "local", supabaseUrl: data.settings.supabaseUrl || "", supabaseKey: data.settings.supabaseKey || "", driveFolder: data.settings.driveFolder || "", lastBackup: data.settings.lastBackup || settings.lastBackup || "" };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        loadSettingsToForm();
      }
      renderThemeOptions();
      updateCategoryOptions();
      updateBudgetOptions();
      renderCategoryManager();
      render();
      event.target.value = "";
      alert("Restore ข้อมูลเรียบร้อย");
    } catch {
      event.target.value = "";
      alert("ไฟล์ Backup ไม่ถูกต้อง");
    }
  };
  reader.readAsText(file);
}
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
function loadSettingsToForm() {
  els.syncMode.value = settings.syncMode || "local";
  els.supabaseUrl.value = settings.supabaseUrl || "";
  els.supabaseKey.value = settings.supabaseKey || "";
  els.driveFolder.value = settings.driveFolder || "";
}
function saveSettingsFromForm() {
  settings = { syncMode: els.syncMode.value, supabaseUrl: els.supabaseUrl.value, supabaseKey: els.supabaseKey.value, driveFolder: els.driveFolder.value, lastBackup: settings.lastBackup || "" };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  renderSettings();
}
function syncNow() {
  saveSettingsFromForm();
  const modeName = settings.syncMode === "local" ? "Local only" : settings.syncMode === "supabase" ? "Supabase พร้อมต่อ API" : "Google Drive พร้อมต่อ API";
  els.syncStatus.textContent = `Sync: ${modeName} • ${new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`;
  alert(`${modeName}\nเวอร์ชันนี้เตรียมโครงหน้าและ config แล้ว ขั้นถัดไปให้ Codex ต่อ API จริง`);
}
function renderSettings() {
  const modeName = settings.syncMode === "local" ? "Local only" : settings.syncMode;
  els.syncStatus.textContent = `Sync: ${modeName}`;
  els.lastBackup.textContent = settings.lastBackup ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(settings.lastBackup)) : "ยังไม่ Backup";
  els.accountInfo.textContent = `${currentUser?.name || "ผู้ใช้"} • ${currentUser?.email || ""}`;
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
  localStorage.setItem(userKey("budgets"), JSON.stringify(budgets));
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
function registerServiceWorker() { if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js").catch(() => {}); }
