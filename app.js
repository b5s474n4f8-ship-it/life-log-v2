const DB_NAME = "life-log-v5";
const DB_STORE = "state";
const DB_KEY = "app";
const FALLBACK_KEY = "life-log-v5-fallback";
const LEGACY_KEY = "life-log-v4";
const PROMPT_VERSION = "life-log-organizer-v1";

const leisureOptions = {
  kind: { series: "剧", reality: "综艺", game: "游戏", book: "书", article: "文章", documentary: "纪录片", video: "视频", movie: "电影", other: "其他" },
  status: { want: "稍后", watching: "进行中", paused: "暂停", finished: "完成", dropped: "放下" },
  context: { bored: "无聊时", "low-energy": "低能量", relax: "想放松", inspire: "想被启发", social: "想社交" },
  feeling: { plain: "一般", nourishing: "滋养", company: "陪伴", exciting: "兴奋", draining: "消耗" },
};

const detailLabels = { sleep: "睡眠", movement: "运动", chores: "庶务管理", leisure: "闲暇", spiritual: "灵修" };
const legacyTypeLabels = {
  sleep: "睡眠", dream: "梦境", body: "身体", chores: "庶务", movement: "运动", spiritual: "灵修",
  relationship: "关系", inner: "内在与能量", creation: "创造", inspiration: "灵感", leisure: "闲暇", free: "自由记录",
};
const metricLabels = { sleepHours: ["睡眠时长", "小时"], napMinutes: ["午睡/补觉", "分钟"], sleepRecovery: ["恢复感", "/5"], movementMinutes: ["运动时长", "分钟"], walkKm: ["距离", "公里"] };

const dailyLines = [
  "今天不需要完整，留下一点真实就好。",
  "先记录，再整理；先看见，再判断。",
  "短短几句也可以，生活不需要被写满。",
  "给生活一点秩序，也给自己一点余地。",
  "可以轻一点，但不要从自己的生活里缺席。",
  "今天先接住真实的一点。",
  "不急着总结，先和今天在一起。",
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let db = null;
let state = createEmptyState();
let activeView = "today-view";
let currentDate = todayKey();
let selectedMonth = currentDate.slice(0, 7);
let editingLeisureId = null;
let saveTimer = null;
let detailTimer = null;
let toastTimer = null;
let lastInteractionAt = Date.now();
let lastDurationTick = Date.now();
let lastToday = currentDate;

function createEmptyState() {
  return {
    version: 5,
    daily_logs_by_date: {},
    leisure_items: [],
    durations_by_date: {},
    settings: { ai_api_url: "", ai_access_code: "" },
    migrations: [],
    seed_ids: [],
  };
}

function emptyLog(date) {
  const now = new Date().toISOString();
  return {
    date,
    raw_input: "",
    todos: [],
    confirmed_details: {},
    legacy_sections: [],
    ai_organized: null,
    ai_versions: [],
    metadata: { source: "app", created_at: now, updated_at: now },
  };
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("IndexedDB unavailable"));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const next = request.result;
      if (!next.objectStoreNames.contains(DB_STORE)) next.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGet(key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const request = tx.objectStore(DB_STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function idbPut(key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadState() {
  try {
    db = await openDb();
    const saved = await idbGet(DB_KEY);
    if (saved?.version === 5) return normalizeState(saved);
  } catch {
    db = null;
    try {
      const fallback = JSON.parse(localStorage.getItem(FALLBACK_KEY) || "null");
      if (fallback?.version === 5) return normalizeState(fallback);
    } catch {}
  }
  return createEmptyState();
}

function normalizeState(value) {
  return {
    ...createEmptyState(),
    ...value,
    daily_logs_by_date: value.daily_logs_by_date || {},
    leisure_items: Array.isArray(value.leisure_items) ? value.leisure_items : [],
    durations_by_date: value.durations_by_date || {},
    settings: { ...createEmptyState().settings, ...(value.settings || {}) },
    migrations: Array.isArray(value.migrations) ? value.migrations : [],
    seed_ids: Array.isArray(value.seed_ids) ? value.seed_ids : [],
  };
}

async function persistState() {
  try {
    if (db) await idbPut(DB_KEY, state);
    else localStorage.setItem(FALLBACK_KEY, JSON.stringify(state));
  } catch {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(state));
  }
  renderStorageStatus();
}

function ensureLog(date) {
  if (!state.daily_logs_by_date[date]) state.daily_logs_by_date[date] = emptyLog(date);
  return state.daily_logs_by_date[date];
}

function migrateV4() {
  if (state.migrations.includes("localstorage-v4")) return false;
  let old = null;
  try { old = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null"); } catch {}
  if (old?.version === 4) {
    for (const entry of old.entries || []) {
      if (!entry?.date) continue;
      const log = ensureLog(entry.date);
      const label = legacyTypeLabels[entry.type] || "记录";
      const details = [];
      if (entry.tags?.length) details.push(`选项：${entry.tags.join("，")}`);
      const metrics = formatMetrics(entry.metrics || {});
      if (metrics) details.push(`数据：${metrics}`);
      for (const [key, value] of Object.entries(entry.extras || {})) {
        const extraLabel = key === "bedtimeActivity" ? "睡前活动" : key === "sleepFactors" ? "影响睡眠的因素" : key;
        if (value) details.push(`${extraLabel}：${value}`);
      }
      if (entry.text) details.push(entry.text);
      const content = details.join("\n");
      const time = formatTime(entry.createdAt);
      log.legacy_sections.push({ title: label, time, content });
      log.raw_input += `${log.raw_input ? "\n\n" : ""}【${label}${time ? ` · ${time}` : ""}】\n${content}`;
      mergeLegacyDetail(log, entry);
      log.metadata = { ...log.metadata, source: "localstorage-v4", updated_at: entry.updatedAt || entry.createdAt || log.metadata.updated_at };
    }
    for (const [date, todos] of Object.entries(old.todosByDate || {})) {
      ensureLog(date).todos = Array.isArray(todos) ? todos : [];
    }
    for (const item of old.leisureItems || []) {
      if (!state.leisure_items.some((saved) => saved.id === item.id || saved.title === item.title)) state.leisure_items.push(normalizeLeisure(item));
    }
    state.durations_by_date = { ...old.durationsByDate, ...state.durations_by_date };
  }
  state.migrations.push("localstorage-v4");
  return Boolean(old);
}

function mergeLegacyDetail(log, entry) {
  const type = entry.type;
  if (!["sleep", "movement", "chores", "spiritual"].includes(type)) return;
  const existing = log.confirmed_details[type] || { tags: [], metrics: {}, extras: {}, note: "" };
  existing.tags = [...new Set([...(existing.tags || []), ...(entry.tags || [])])];
  existing.metrics = { ...(existing.metrics || {}), ...(entry.metrics || {}) };
  existing.extras = { ...(existing.extras || {}), ...(entry.extras || {}) };
  if (entry.text) existing.note = [existing.note, entry.text].filter(Boolean).join("\n\n");
  log.confirmed_details[type] = existing;
}

function hasLogContent(log) {
  return Boolean(log?.raw_input?.trim() || log?.todos?.length || Object.keys(log?.confirmed_details || {}).length || log?.legacy_sections?.length || log?.ai_organized);
}

function normalizeLeisure(item) {
  return {
    id: item.id || uid("leisure"), title: item.title || "", kind: item.kind || "other", original_kind: item.original_kind || "",
    status: item.status || "want", progress: item.progress || "", context: item.context || "bored", feeling: item.feeling || "plain",
    note: item.note || "", created_at: item.created_at || item.createdAt || new Date().toISOString(), updated_at: item.updated_at || item.updatedAt || new Date().toISOString(), metadata: item.metadata || {},
  };
}

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateFromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function formatDate(key, options = { month: "long", day: "numeric" }) {
  return new Intl.DateTimeFormat("zh-CN", options).format(dateFromKey(key));
}

function formatTime(value) {
  if (!value) return "";
  try { return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); } catch { return ""; }
}

function dateHash(value) {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(value) {
  return String(value || "").trim().toLocaleLowerCase("zh-CN");
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function fingerprint(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16);
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showToast(message) {
  clearTimeout(toastTimer);
  const toast = $("#toast");
  toast.textContent = message; toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2400);
}

function updateWordCount() {
  const count = $("#raw-input").value.replace(/\s/g, "").length;
  $("#word-count").textContent = `${count} 字`;
}

function autoResize() {
  const input = $("#raw-input");
  input.style.height = "auto";
  input.style.height = `${Math.max(230, Math.min(input.scrollHeight, 760))}px`;
}

function renderDateHeader() {
  const isToday = currentDate === todayKey();
  $("#weekday").textContent = `${isToday ? "今天" : "历史"} · ${formatDate(currentDate, { weekday: "long" })}`;
  $("#day-title").textContent = formatDate(currentDate);
  $("#daily-line").textContent = dailyLines[dateHash(currentDate) % dailyLines.length];
  $("#history-mode").hidden = isToday;
}

function renderToday() {
  const log = ensureLog(currentDate);
  renderDateHeader();
  $("#raw-input").value = log.raw_input || "";
  updateWordCount(); autoResize();
  renderTodos(log);
  renderDetailStack(log);
  renderAi(log);
  renderDuration();
}

function scheduleRawSave() {
  const log = ensureLog(currentDate);
  log.raw_input = $("#raw-input").value;
  log.metadata = { ...(log.metadata || {}), updated_at: new Date().toISOString() };
  updateWordCount(); autoResize(); markAiStale(log);
  const status = $("#autosave-status");
  status.classList.add("saving"); status.querySelector("span:last-child").textContent = "正在自动保存";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await persistState();
    status.classList.remove("saving"); status.querySelector("span:last-child").textContent = `已自动保存 · ${formatTime(new Date().toISOString())}`;
  }, 550);
}

async function saveNow() {
  const log = ensureLog(currentDate);
  log.raw_input = $("#raw-input").value;
  log.metadata = { ...(log.metadata || {}), updated_at: new Date().toISOString() };
  await persistState();
  $("#autosave-status").querySelector("span:last-child").textContent = `已保存 · ${formatTime(new Date().toISOString())}`;
  showToast("已保存。原始记录完整保留在 app 中。");
}

function renderTodos(log) {
  const todos = log.todos || [];
  $("#todo-count").textContent = `${todos.filter((todo) => todo.done).length}/${todos.length}`;
  $("#todo-list").innerHTML = todos.length ? todos.map((todo) => `
    <div class="todo-item" data-todo-id="${escapeHtml(todo.id)}">
      <input type="checkbox" ${todo.done ? "checked" : ""} aria-label="完成：${escapeHtml(todo.text)}" />
      <span class="${todo.done ? "done" : ""}">${escapeHtml(todo.text)}</span>
      <button type="button" class="remove-button" data-delete-todo aria-label="删除这件事">×</button>
    </div>`).join("") : `<p class="empty-note">这里可以放今天要托住的小事。没有也很好。</p>`;
}

async function addTodo(event) {
  event.preventDefault();
  const input = $("#todo-input");
  const text = input.value.trim();
  if (!text) return;
  const log = ensureLog(currentDate);
  log.todos.push({ id: uid("todo"), text, done: false, created_at: new Date().toISOString() });
  input.value = ""; await persistState(); renderTodos(log);
}

async function handleTodoClick(event) {
  const item = event.target.closest("[data-todo-id]");
  if (!item) return;
  const log = ensureLog(currentDate);
  if (event.target.matches("input[type='checkbox']")) {
    const todo = log.todos.find((value) => value.id === item.dataset.todoId);
    if (todo) { todo.done = event.target.checked; todo.completed_at = todo.done ? new Date().toISOString() : null; }
  }
  if (event.target.closest("[data-delete-todo]")) log.todos = log.todos.filter((value) => value.id !== item.dataset.todoId);
  await persistState(); renderTodos(log);
}

function renderDetailStack(log) {
  $("#detail-stack").innerHTML = [renderSleepPanel(), renderMovementPanel(), renderChoresPanel(), renderDailyLeisurePanel(), renderSpiritualPanel()].join("");
  populateDetail("sleep", log.confirmed_details?.sleep);
  populateDetail("movement", log.confirmed_details?.movement);
  populateDetail("chores", log.confirmed_details?.chores);
  populateDetail("spiritual", log.confirmed_details?.spiritual);
  markFilledPanels(log);
}

function panelShell(type, mark, markClass, title, subtitle, content) {
  return `<details class="detail-panel" data-detail="${type}"><summary><span class="detail-mark ${markClass}">${mark}</span><span><strong>${title}</strong><small>${subtitle}</small></span></summary><div class="detail-content" id="${type}-form">${content}</div></details>`;
}

function chips(values) {
  return `<div class="chip-checks" data-tags>${values.map((value) => `<label><input type="checkbox" value="${escapeHtml(value)}" /><span>${escapeHtml(value)}</span></label>`).join("")}</div>`;
}

function renderSleepPanel() {
  return panelShell("sleep", "睡", "sky", "睡眠", "昨晚睡得如何？", `
    <fieldset><legend>整体感受</legend><div class="segmented-control">${["好", "一般", "差"].map((v) => `<label><input type="radio" name="sleep-quality" value="${v}" /><span>${v}</span></label>`).join("")}</div></fieldset>
    <div class="two-fields three-fields">
      <label>睡眠时长<input data-metric="sleepHours" type="number" inputmode="decimal" min="0" step="0.5" /><small>小时</small></label>
      <label>午睡/补觉<input data-metric="napMinutes" type="number" inputmode="numeric" min="0" step="5" /><small>分钟</small></label>
      <label>恢复感<input data-metric="sleepRecovery" type="number" inputmode="numeric" min="1" max="5" /><small>/5</small></label>
    </div>
    ${chips(["入睡困难", "躺下但没睡意", "夜醒", "早醒", "环境噪音", "鸟叫", "身体不适", "睡得沉"])}
    <label class="field-label">睡前活动<textarea data-extra="bedtimeActivity" rows="2" placeholder="例如聊天、刷手机、读书、祷告"></textarea></label>
    <label class="field-label">影响睡眠的因素<textarea data-extra="sleepFactors" rows="2" placeholder="例如鸟叫、噪音、光线、身体不适"></textarea></label>`);
}

function renderMovementPanel() {
  return panelShell("movement", "动", "mint-bg", "运动", "今天是否有一点点活动？", `
    ${chips(["八段锦", "普拉提", "跑步机上坡走", "散步/走路", "拉伸", "HIIT", "力量训练", "其他"])}
    <div class="two-fields"><label>时长<input data-metric="movementMinutes" type="number" inputmode="numeric" min="0" step="5" /><small>分钟</small></label><label>距离<input data-metric="walkKm" type="number" inputmode="decimal" min="0" step="0.1" /><small>公里</small></label></div>
    <label class="field-label">身体感受<textarea data-note rows="2" placeholder="过程中或结束后，身体感觉如何？"></textarea></label>`);
}

function renderChoresPanel() {
  return panelShell("chores", "务", "warm", "庶务管理", "基础生活照料", chips(["洗澡", "洗衣", "排便", "自我按摩"]));
}

function renderDailyLeisurePanel() {
  return panelShell("leisure", "闲", "lilac-bg", "闲暇", "看、读、玩了什么？", `
    <div class="form-stack" id="daily-leisure-fields"><label class="field-label">名称<input data-field="title" type="text" placeholder="剧、综艺、游戏、书、文章……" /></label>
    <div class="two-fields plain"><label>类型<select data-field="kind">${optionHtml(leisureOptions.kind, "article")}</select></label><label>感受<select data-field="feeling">${optionHtml(leisureOptions.feeling, "plain")}</select></label></div>
    <label class="field-label">进度<input data-field="progress" type="text" placeholder="例如 S1E3、第 120 页、读完一半" /></label>
    <label class="field-label">一句话<textarea data-field="note" rows="2" placeholder="为什么想继续，或者它留下了什么。"></textarea></label>
    <button class="inline-save" id="save-daily-leisure" type="button">保存到闲暇清单</button></div>`);
}

function renderSpiritualPanel() {
  return panelShell("spiritual", "灵", "rose", "灵修", "今天是否有灵修？", `${chips(["祷告", "读经", "默想", "敬拜", "阅读属灵读物"])}<label class="field-label">想留下的触动<textarea data-note rows="3" placeholder="触动、提醒、问题、挣扎或领受；可以只写一句。"></textarea></label>`);
}

function optionHtml(map, selected = "") {
  return Object.entries(map).map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
}

function populateDetail(type, value = {}) {
  const panel = $(`[data-detail="${type}"]`);
  if (!panel) return;
  for (const input of panel.querySelectorAll("[data-tags] input")) input.checked = (value.tags || []).includes(input.value);
  for (const input of panel.querySelectorAll("[data-metric]")) input.value = value.metrics?.[input.dataset.metric] ?? "";
  for (const input of panel.querySelectorAll("[data-extra]")) input.value = value.extras?.[input.dataset.extra] || "";
  const note = panel.querySelector("[data-note]");
  if (note) note.value = value.note || "";
  const quality = panel.querySelector(`input[name="${type}-quality"][value="${CSS.escape(value.quality || "")}"]`);
  if (quality) quality.checked = true;
}

function collectDetail(type) {
  const panel = $(`[data-detail="${type}"]`);
  const tags = [...panel.querySelectorAll("[data-tags] input:checked")].map((input) => input.value);
  const metrics = {};
  for (const input of panel.querySelectorAll("[data-metric]")) if (input.value !== "") metrics[input.dataset.metric] = Number(input.value);
  const extras = {};
  for (const input of panel.querySelectorAll("[data-extra]")) if (input.value.trim()) extras[input.dataset.extra] = input.value.trim();
  const note = panel.querySelector("[data-note]")?.value.trim() || "";
  const quality = panel.querySelector(`input[name="${type}-quality"]:checked`)?.value || "";
  return { tags, metrics, extras, note, quality };
}

function detailHasContent(value) {
  return Boolean(value?.tags?.length || Object.keys(value?.metrics || {}).length || Object.keys(value?.extras || {}).length || value?.note || value?.quality || value?.items?.length || value?.ai_facts?.length);
}

function saveDetailFromEvent(event) {
  const panel = event.target.closest("[data-detail]");
  if (!panel || panel.dataset.detail === "leisure") return;
  const type = panel.dataset.detail;
  clearTimeout(detailTimer);
  detailTimer = setTimeout(async () => {
    const log = ensureLog(currentDate);
    const value = collectDetail(type);
    if (detailHasContent(value)) log.confirmed_details[type] = value;
    else delete log.confirmed_details[type];
    log.metadata.updated_at = new Date().toISOString();
    await persistState(); markFilledPanels(log);
  }, 350);
}

function markFilledPanels(log) {
  for (const panel of $$(".detail-panel")) panel.classList.toggle("has-data", detailHasContent(log.confirmed_details?.[panel.dataset.detail]));
}

async function saveDailyLeisure() {
  const fields = $("#daily-leisure-fields");
  const title = fields.querySelector('[data-field="title"]').value.trim();
  if (!title) { showToast("先写下名称，再保存到闲暇清单。"); return; }
  const item = {
    id: uid("leisure"), title, kind: fields.querySelector('[data-field="kind"]').value, status: "watching",
    progress: fields.querySelector('[data-field="progress"]').value.trim(), context: "bored", feeling: fields.querySelector('[data-field="feeling"]').value,
    note: fields.querySelector('[data-field="note"]').value.trim(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), metadata: { source: "daily-detail" },
  };
  state.leisure_items.push(item);
  const log = ensureLog(currentDate);
  const detail = log.confirmed_details.leisure || { items: [] };
  detail.items = [...new Set([...(detail.items || []), item.id])];
  log.confirmed_details.leisure = detail;
  await persistState(); renderDetailStack(log); showToast("已放进闲暇清单，也记在今天。");
}

function markAiStale(log) {
  if (!log.ai_organized) return;
  const stale = log.ai_organized.metadata?.source_hash !== fingerprint(log.raw_input || "");
  $("#stale-notice").hidden = !stale;
  $("#organize-button .button-label").textContent = stale ? "重新整理今天" : "再次整理";
}

function renderAi(log) {
  const ai = log.ai_organized;
  $("#ai-section").hidden = !ai;
  if (!ai) { $("#organize-button .button-label").textContent = "帮我整理今天"; return; }
  $("#ai-summary").textContent = ai.summary || ai.daily_sentence || "";
  $("#ai-reflection").textContent = ai.reflection || "";
  $("#theme-row").innerHTML = (ai.themes || []).map((theme) => `<span>${escapeHtml(theme)}</span>`).join("");
  const facts = ai.facts || [];
  $("#extracted-fields").innerHTML = facts.length ? facts.map((fact, index) => `
    <div class="extracted-row" data-fact-index="${index}">
      <input type="checkbox" ${fact.selected !== false ? "checked" : ""} ${ai.confirmed ? "disabled" : ""} aria-label="将${escapeHtml(fact.label || fact.category)}记入复盘" />
      <span class="extracted-name">${escapeHtml(fact.label || fact.category)}</span>
      <input class="extracted-value" type="text" value="${escapeHtml(fact.value || "")}" ${ai.confirmed ? "disabled" : ""} aria-label="${escapeHtml(fact.label || fact.category)}提取结果" />
    </div>`).join("") : `<p class="empty-note">没有提取到需要单独确认的内容。</p>`;
  $("#confirmation-state").textContent = ai.confirmed ? "已确认" : "待确认";
  $("#confirmation-state").classList.toggle("confirmed", Boolean(ai.confirmed));
  $("#confirm-button").disabled = Boolean(ai.confirmed);
  $("#confirm-button").textContent = ai.confirmed ? "已记入复盘" : "确认并记入复盘";
  $("#extracted-fields").classList.toggle("locked", Boolean(ai.confirmed));
  $("#ai-version").textContent = `第 ${(log.ai_versions?.length || 0) + 1} 版`;
  const meta = ai.metadata || {};
  $("#generated-time").textContent = [meta.model, meta.generated_at ? formatTime(meta.generated_at) : "", meta.prompt_version].filter(Boolean).join(" · ");
  markAiStale(log);
}

async function organizeToday() {
  const log = ensureLog(currentDate);
  log.raw_input = $("#raw-input").value;
  if (!log.raw_input.trim()) { showToast("先留下一点原始记录，再请 AI 整理。"); $("#raw-input").focus(); return; }
  const { ai_api_url: url, ai_access_code: code } = state.settings;
  if (!url || !code) { switchView("backup-view"); $("#ai-settings").scrollIntoView({ behavior: "smooth" }); showToast("先在备份与设置里连接 AI 接口。"); return; }
  const button = $("#organize-button");
  button.disabled = true; button.classList.add("is-loading"); button.querySelector(".button-label").hidden = true; button.querySelector(".button-progress").hidden = false;
  try {
    await persistState();
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json", "X-App-Access-Code": code },
      body: JSON.stringify({ date: currentDate, raw_input: log.raw_input, confirmed_details: log.confirmed_details, prompt_version: PROMPT_VERSION }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ai_organized) throw new Error(result.error || "AI 整理暂时没有完成");
    if (log.ai_organized) log.ai_versions = [...(log.ai_versions || []), log.ai_organized].slice(-5);
    log.ai_organized = {
      ...result.ai_organized,
      confirmed: false,
      facts: (result.ai_organized.facts || []).map((fact) => ({ ...fact, selected: true })),
      metadata: { ...(result.metadata || {}), source_hash: fingerprint(log.raw_input), prompt_version: result.metadata?.prompt_version || PROMPT_VERSION },
    };
    await persistState(); renderAi(log); $("#ai-section").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showToast(`${error.message || "AI 整理失败"}。原始记录和旧整理都没有变化。`);
  } finally {
    button.disabled = false; button.classList.remove("is-loading"); button.querySelector(".button-label").hidden = false; button.querySelector(".button-progress").hidden = true;
  }
}

async function confirmAi() {
  const log = ensureLog(currentDate);
  if (!log.ai_organized) return;
  const facts = [...$("#extracted-fields").querySelectorAll("[data-fact-index]")].map((row) => {
    const original = log.ai_organized.facts[Number(row.dataset.factIndex)];
    return { ...original, selected: row.querySelector('input[type="checkbox"]').checked, value: row.querySelector(".extracted-value").value.trim() };
  });
  log.ai_organized.facts = facts;
  log.ai_organized.confirmed = true;
  log.confirmed_details.ai_facts = facts.filter((fact) => fact.selected).map(({ category, label, value }) => ({ category, label, value }));
  await persistState(); renderAi(log); showToast("已确认。原始记录仍完整保留。");
}

function adjustAi() {
  const log = ensureLog(currentDate);
  if (!log.ai_organized) return;
  log.ai_organized.confirmed = false;
  renderAi(log);
  $("#extracted-fields .extracted-value")?.focus();
}

function recordedDates() {
  return Object.keys(state.daily_logs_by_date).filter((date) => hasLogContent(state.daily_logs_by_date[date])).sort().reverse();
}

function previewText(log) {
  return (log.raw_input || log.metadata?.source_markdown || "").replace(/【[^】]+】/g, " ").replace(/^#+\s.*$/gm, " ").replace(/\s+/g, " ").trim().slice(0, 118);
}

function recordTags(log) {
  const tags = [];
  for (const key of ["sleep", "movement", "chores", "spiritual", "leisure"]) if (detailHasContent(log.confirmed_details?.[key])) tags.push(detailLabels[key]);
  for (const theme of log.ai_organized?.themes || []) if (!tags.includes(theme)) tags.push(theme);
  return tags.slice(0, 5);
}

function renderRecords() {
  $("#record-month").value = selectedMonth;
  const all = recordedDates();
  const dates = selectedMonth ? all.filter((date) => date.startsWith(selectedMonth)) : all;
  $("#record-total").textContent = `${dates.length} 天`;
  $("#record-list").innerHTML = dates.length ? dates.map((date) => {
    const log = state.daily_logs_by_date[date];
    const tags = recordTags(log);
    return `<button class="record-row" type="button" data-open-record="${date}">
      <span class="record-date"><strong>${formatDate(date, { month: "numeric", day: "numeric" })}</strong><small>${formatDate(date, { weekday: "short" })}</small></span>
      <span class="record-preview"><strong>${escapeHtml(previewText(log) || "这一天留下了结构化记录")}</strong><span>${tags.map((tag) => `<i>${escapeHtml(tag)}</i>`).join("")}${log.metadata?.source === "markdown-import" ? "<i>历史导入</i>" : ""}</span></span>
      <span class="record-arrow" aria-hidden="true">›</span>
    </button>`;
  }).join("") : `<p class="empty-state">这个月份还没有记录。日期本身不需要被填满。</p>`;
  $("#record-detail").hidden = true;
}

function renderRecordDetail(date) {
  const log = state.daily_logs_by_date[date];
  if (!log) return;
  const detail = $("#record-detail");
  const imported = log.metadata?.source === "markdown-import";
  detail.innerHTML = `
    <div class="record-detail-heading"><button type="button" class="text-button" data-close-record>‹ 返回记录</button><span>${imported ? "历史导入 · 原文保留" : "app 记录"}</span></div>
    <h2>${formatDate(date, { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</h2>
    <section class="raw-record"><h3>原始记录</h3><pre>${escapeHtml(log.raw_input || "这一天没有自然语言记录。")}</pre></section>
    ${renderRecordedDetails(log)}
    ${log.ai_organized ? `<section class="record-ai"><h3>AI 整理</h3><p>${escapeHtml(log.ai_organized.summary || "")}</p><p>${escapeHtml(log.ai_organized.reflection || "")}</p></section>` : ""}
    ${renderAiVersions(log)}
    ${imported ? `<details class="source-proof"><summary>查看原始导入 Markdown</summary><pre>${escapeHtml(log.metadata.source_markdown || "")}</pre></details>` : ""}
    <div class="record-actions"><button type="button" class="secondary-button" data-edit-date="${date}">编辑这一天</button><button type="button" class="primary-button" data-export-date="${date}">导出这一天</button></div>`;
  $("#record-list").hidden = true;
  detail.hidden = false;
  detail.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderAiVersions(log) {
  const versions = log.ai_versions || [];
  if (!versions.length) return "";
  return `<details class="source-proof"><summary>查看过去 ${versions.length} 版 AI 整理</summary>${versions.slice().reverse().map((version) => `<div class="ai-version-item"><strong>${escapeHtml(version.metadata?.generated_at ? formatTime(version.metadata.generated_at) : "较早版本")}</strong><p>${escapeHtml(version.summary || "")}</p></div>`).join("")}</details>`;
}

function renderRecordedDetails(log) {
  const details = log.confirmed_details || {};
  const blocks = [];
  for (const type of ["sleep", "movement", "chores", "spiritual", "leisure"]) {
    const value = details[type];
    if (!detailHasContent(value)) continue;
    const lines = [];
    if (value.tags?.length) lines.push(value.tags.join("，"));
    if (value.metrics && formatMetrics(value.metrics)) lines.push(formatMetrics(value.metrics));
    if (value.note) lines.push(value.note);
    if (value.items?.length) lines.push(`${value.items.length} 个闲暇条目`);
    blocks.push(`<div><strong>${detailLabels[type]}</strong><p>${escapeHtml(lines.join(" · "))}</p></div>`);
  }
  for (const fact of details.ai_facts || []) blocks.push(`<div><strong>${escapeHtml(fact.label || fact.category)}</strong><p>${escapeHtml(fact.value)}</p></div>`);
  return blocks.length ? `<section class="recorded-details"><h3>已确认的详情</h3>${blocks.join("")}</section>` : "";
}

function formatMetrics(metrics = {}) {
  return Object.entries(metrics).filter(([, value]) => value !== "" && value != null).map(([key, value]) => `${metricLabels[key]?.[0] || key} ${value}${metricLabels[key]?.[1] || ""}`).join("，");
}

function populateLeisureSelects() {
  $("#leisure-kind").innerHTML = optionHtml(leisureOptions.kind);
  $("#leisure-status").innerHTML = optionHtml(leisureOptions.status);
  $("#leisure-context").innerHTML = optionHtml(leisureOptions.context);
  $("#leisure-feeling").innerHTML = optionHtml(leisureOptions.feeling);
}

function renderLeisure() {
  const items = [...state.leisure_items].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
  $("#leisure-count").textContent = `${items.length} 个`;
  $("#leisure-list").innerHTML = items.length ? items.map((item) => `
    <article class="leisure-card" data-leisure-id="${escapeHtml(item.id)}">
      <div class="leisure-meta"><span>${leisureOptions.kind[item.kind] || "其他"}</span><span>${leisureOptions.status[item.status] || "稍后"}</span><span>${leisureOptions.feeling[item.feeling] || "一般"}</span></div>
      <h3>${escapeHtml(item.title)}</h3>${item.progress ? `<p>进度：${escapeHtml(item.progress)}</p>` : ""}${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}
      <div class="card-actions"><button type="button" data-log-leisure>记到今天</button><button type="button" data-edit-leisure>编辑</button><button type="button" class="danger" data-delete-leisure>删除</button></div>
    </article>`).join("") : `<p class="empty-state">还没有闲暇条目。下一次想起一部剧、一本书或一篇文章，可以先放这里。</p>`;
}

async function submitLeisure(event) {
  event.preventDefault();
  const title = $("#leisure-title").value.trim();
  if (!title) return;
  const old = editingLeisureId ? state.leisure_items.find((item) => item.id === editingLeisureId) : null;
  const item = {
    id: old?.id || uid("leisure"), title, kind: $("#leisure-kind").value, status: $("#leisure-status").value,
    progress: $("#leisure-progress").value.trim(), context: $("#leisure-context").value, feeling: $("#leisure-feeling").value,
    note: $("#leisure-note").value.trim(), created_at: old?.created_at || new Date().toISOString(), updated_at: new Date().toISOString(), metadata: old?.metadata || { source: "app" },
  };
  if (old) Object.assign(old, item); else state.leisure_items.push(item);
  await persistState(); resetLeisureForm(); renderLeisure(); showToast(old ? "闲暇条目已更新。" : "已放进闲暇清单。");
}

function resetLeisureForm() {
  editingLeisureId = null; $("#leisure-form").reset(); populateLeisureSelects();
  $("#leisure-form-title").textContent = "放进闲暇清单"; $("#leisure-submit").textContent = "保存闲暇条目"; $("#cancel-leisure-edit").hidden = true;
}

function editLeisure(id) {
  const item = state.leisure_items.find((value) => value.id === id); if (!item) return;
  editingLeisureId = id; $("#leisure-title").value = item.title; $("#leisure-kind").value = item.kind; $("#leisure-status").value = item.status;
  $("#leisure-progress").value = item.progress; $("#leisure-context").value = item.context; $("#leisure-feeling").value = item.feeling; $("#leisure-note").value = item.note;
  $("#leisure-form-title").textContent = "编辑闲暇条目"; $("#leisure-submit").textContent = "更新闲暇条目"; $("#cancel-leisure-edit").hidden = false;
  $("#leisure-title").focus();
}

async function handleLeisureClick(event) {
  const card = event.target.closest("[data-leisure-id]"); if (!card) return;
  const id = card.dataset.leisureId;
  if (event.target.closest("[data-edit-leisure]")) editLeisure(id);
  if (event.target.closest("[data-delete-leisure]")) {
    if (!window.confirm("删除这个闲暇条目？历史日记不会被删除。")) return;
    state.leisure_items = state.leisure_items.filter((item) => item.id !== id); await persistState(); renderLeisure();
  }
  if (event.target.closest("[data-log-leisure]")) {
    const log = ensureLog(todayKey()); const detail = log.confirmed_details.leisure || { items: [] };
    detail.items = [...new Set([...(detail.items || []), id])]; log.confirmed_details.leisure = detail;
    await persistState(); showToast("已记到今天，不会改变闲暇清单状态。");
  }
}

function showBoredSuggestions() {
  const active = state.leisure_items.filter((item) => ["want", "watching", "paused"].includes(item.status)).sort((a, b) => leisureScore(b) - leisureScore(a)).slice(0, 3);
  const box = $("#bored-result"); box.hidden = false;
  box.innerHTML = active.length ? `<strong>现在可以继续：</strong>${active.map((item) => `<span>${escapeHtml(item.title)} · ${leisureOptions.kind[item.kind]}</span>`).join("")}` : "清单里还没有可继续的内容。先放两三项低成本选择就好。";
}

function leisureScore(item) {
  return (item.status === "watching" ? 5 : item.status === "want" ? 3 : 1) + (item.context === "bored" ? 3 : 0) + (["nourishing", "company"].includes(item.feeling) ? 2 : 0) - (item.feeling === "draining" ? 3 : 0);
}

function lastDates(count) {
  const base = dateFromKey(todayKey()); const dates = [];
  for (let index = count - 1; index >= 0; index -= 1) { const date = new Date(base); date.setDate(base.getDate() - index); dates.push(todayKey(date)); }
  return dates;
}

function renderReview() {
  const dates = lastDates(7); const logs = dates.map((date) => state.daily_logs_by_date[date]).filter(Boolean); const cards = [];
  const recorded = logs.filter(hasLogContent);
  cards.push(reviewCard("记录概况", [`最近 7 天记录了 ${recorded.length} 天。`, `完成 to-dos ${recorded.reduce((sum, log) => sum + (log.todos || []).filter((todo) => todo.done).length, 0)} 项。`]));
  cards.push(reviewCard("睡眠", sleepReview(logs)));
  cards.push(reviewCard("身体与梦境", sectionReview(logs, ["身体", "身体状态", "梦境"])));
  cards.push(reviewCard("庶务管理", choresReview(logs)));
  cards.push(reviewCard("运动", movementReview(logs)));
  cards.push(reviewCard("灵修", spiritualReview(logs)));
  cards.push(reviewCard("内在与能量", sectionReview(logs, ["内在与能量", "清醒时间"])));
  cards.push(reviewCard("关系", sectionReview(logs, ["关系"])));
  cards.push(reviewCard("创造与灵感", sectionReview(logs, ["创造", "灵感"])));
  cards.push(reviewCard("闲暇", leisureReview(logs)));
  cards.push(reviewCard("下周可以轻轻尝试", suggestActions(logs)));
  $("#review-content").innerHTML = cards.join("");
}

function reviewCard(title, lines) {
  const clean = lines.filter(Boolean);
  return `<article class="review-card"><h2>${title}</h2>${clean.length ? `<ul>${clean.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : `<p>这一项暂时没有太多内容。</p>`}</article>`;
}

function sleepReview(logs) {
  const values = logs.map((log) => log.confirmed_details?.sleep).filter(detailHasContent);
  if (!values.length) return ["本周还没有睡眠记录，可以先继续轻量观察。"];
  const hours = values.map((v) => Number(v.metrics?.sleepHours)).filter(Boolean); const naps = values.map((v) => Number(v.metrics?.napMinutes)).filter(Boolean); const recovery = values.map((v) => Number(v.metrics?.sleepRecovery)).filter(Boolean);
  const tags = countTags(values); const signals = ["入睡困难", "躺下但没睡意", "夜醒", "早醒", "环境噪音", "鸟叫", "身体不适"].filter((tag) => tags[tag]).map((tag) => `${tag} ${tags[tag]} 次`);
  return [`记录睡眠 ${values.length} 天。`, hours.length ? `平均睡眠时长约 ${(hours.reduce((a, b) => a + b, 0) / hours.length).toFixed(1)} 小时。` : "", naps.length ? `午睡/补觉 ${naps.length} 次，共 ${naps.reduce((a, b) => a + b, 0)} 分钟。` : "", recovery.length ? `平均恢复感 ${(recovery.reduce((a, b) => a + b, 0) / recovery.length).toFixed(1)}/5。` : "", signals.length ? `出现：${signals.join("，")}。` : ""];
}

function movementReview(logs) {
  const values = logs.map((log) => log.confirmed_details?.movement).filter(detailHasContent); const tags = countTags(values);
  const minutes = values.reduce((sum, v) => sum + Number(v.metrics?.movementMinutes || 0), 0); const km = values.reduce((sum, v) => sum + Number(v.metrics?.walkKm || 0), 0);
  return [values.length ? `运动记录 ${values.length} 天。` : "本周还没有结构化运动记录。", minutes ? `总运动时长约 ${minutes} 分钟。` : "", km ? `散步/走路约 ${km.toFixed(1)} 公里。` : "", Object.keys(tags).length ? `项目：${formatCounts(tags)}。` : ""];
}

function choresReview(logs) {
  const values = logs.map((log) => log.confirmed_details?.chores).filter(detailHasContent); const tags = countTags(values);
  return [Object.keys(tags).length ? formatCounts(tags) : "洗澡、洗衣、排便和自我按摩还没有形成可统计记录。"];
}

function spiritualReview(logs) {
  const values = logs.map((log) => log.confirmed_details?.spiritual).filter(detailHasContent); const tags = countTags(values);
  return [`灵修相关记录 ${values.length} 天。`, Object.keys(tags).length ? `实践：${formatCounts(tags)}。` : "", ...sectionReview(logs, ["灵修"], 2)];
}

function leisureReview(logs) {
  const ids = new Set(logs.flatMap((log) => log.confirmed_details?.leisure?.items || [])); const active = state.leisure_items.filter((item) => ["want", "watching", "paused"].includes(item.status));
  return [ids.size ? `本周记到当天的闲暇内容 ${ids.size} 个。` : "本周还没有把闲暇内容记到具体日期。", active.length ? `清单里有 ${active.length} 个可继续的选择。` : "清单里暂时没有可继续的内容。", ...active.slice(0, 3).map((item) => `${item.title}：${leisureOptions.status[item.status]}${item.progress ? `，${item.progress}` : ""}`)];
}

function sectionReview(logs, titles, limit = 3) {
  const found = [];
  for (const log of logs) for (const section of log.legacy_sections || []) if (titles.includes(section.title) && section.content) found.push(`${log.date}：${section.content.replace(/\s+/g, " ").slice(0, 100)}`);
  for (const log of logs) for (const fact of log.confirmed_details?.ai_facts || []) if (titles.includes(fact.label) || titles.includes(fact.category)) found.push(`${log.date}：${fact.value.slice(0, 100)}`);
  return found.slice(-limit);
}

function countTags(values) {
  const counts = {}; for (const value of values) for (const tag of value.tags || []) counts[tag] = (counts[tag] || 0) + 1; return counts;
}

function formatCounts(counts) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name} ${count} 次`).join("，");
}

function suggestActions(logs) {
  const actions = [];
  if (logs.map((log) => log.confirmed_details?.sleep).filter(detailHasContent).length < 3) actions.push("给睡眠留一个很小的入口，只记时长或恢复感也可以。");
  if (logs.map((log) => log.confirmed_details?.movement).filter(detailHasContent).length < 2) actions.push("给身体十分钟低门槛活动，不需要完整训练。");
  if (!state.leisure_items.some((item) => ["want", "watching"].includes(item.status))) actions.push("给无聊时刻留两三个能继续的内容选择。");
  if (!actions.length) actions.push("继续保持现在这种轻量记录，不需要把生活写满。");
  return actions.slice(0, 3);
}

function markdownForDate(date) {
  const log = state.daily_logs_by_date[date]; if (!log) return "";
  const parts = [`# ${date}`];
  if (log.todos?.length) parts.push(`## to-dos\n${log.todos.map((todo) => `- [${todo.done ? "x" : " "}] ${todo.text}`).join("\n")}`);
  if (log.raw_input?.trim()) parts.push(`## 原始记录\n${log.raw_input.trim()}`);
  const details = [];
  for (const [type, value] of Object.entries(log.confirmed_details || {})) {
    if (type === "ai_facts") continue;
    const lines = [];
    if (value.tags?.length) lines.push(`选项：${value.tags.join("，")}`);
    if (formatMetrics(value.metrics || {})) lines.push(`数据：${formatMetrics(value.metrics)}`);
    for (const [key, text] of Object.entries(value.extras || {})) if (text) lines.push(`${key === "bedtimeActivity" ? "睡前活动" : key === "sleepFactors" ? "影响睡眠的因素" : key}：${text}`);
    if (value.note) lines.push(value.note);
    if (value.items?.length) lines.push(`闲暇条目：${value.items.map((id) => state.leisure_items.find((item) => item.id === id)?.title).filter(Boolean).join("，")}`);
    if (lines.length) details.push(`### ${detailLabels[type] || type}\n${lines.join("\n")}`);
  }
  if (details.length) parts.push(`## 已确认详情\n${details.join("\n\n")}`);
  if (log.ai_organized) parts.push(`## AI 整理\n${log.ai_organized.summary || ""}\n\n${log.ai_organized.reflection || ""}`.trim());
  if (log.metadata?.source_markdown) parts.push(`## 原始导入来源\n${log.metadata.source_markdown}`);
  return parts.join("\n\n");
}

function markdownForLeisure() {
  if (!state.leisure_items.length) return "";
  return ["# 闲暇清单", ...state.leisure_items.map((item) => `## ${item.title}\n类型：${leisureOptions.kind[item.kind] || "其他"}\n状态：${leisureOptions.status[item.status] || "稍后"}\n进度：${item.progress || "未填写"}\n适合：${leisureOptions.context[item.context] || "无聊时"}\n感受：${leisureOptions.feeling[item.feeling] || "一般"}\n${item.note || ""}`.trim())].join("\n\n");
}

function exportAllJson() {
  download(`life-log-backup-${todayKey()}.json`, JSON.stringify({ exported_at: new Date().toISOString(), ...state }, null, 2), "application/json;charset=utf-8");
  showToast("完整备份已导出，app 内记录仍然保留。");
}

function exportAllMarkdown() {
  const content = [...recordedDates()].reverse().map(markdownForDate).filter(Boolean); const leisure = markdownForLeisure(); if (leisure) content.push(leisure);
  download(`life-log-${todayKey()}.md`, content.join("\n\n---\n\n"), "text/markdown;charset=utf-8");
  showToast("Markdown 已导出，app 内记录没有变化。");
}

function exportDate(date) {
  download(`life-log-${date}.md`, markdownForDate(date), "text/markdown;charset=utf-8");
}

async function importBackup(file) {
  if (!file) return;
  try {
    const incoming = JSON.parse(await file.text());
    if (!incoming.daily_logs_by_date || !Array.isArray(incoming.leisure_items)) throw new Error("这不是可识别的 Life Log 备份");
    if (!window.confirm("导入会合并记录；同一天已有内容时，保留更新时间较新的版本。继续吗？")) return;
    for (const [date, log] of Object.entries(incoming.daily_logs_by_date)) {
      const current = state.daily_logs_by_date[date];
      if (!current || new Date(log.metadata?.updated_at || 0) > new Date(current.metadata?.updated_at || 0)) state.daily_logs_by_date[date] = log;
    }
    const map = new Map(state.leisure_items.map((item) => [item.id, item]));
    for (const item of incoming.leisure_items) if (item?.id) map.set(item.id, normalizeLeisure(item));
    state.leisure_items = [...map.values()];
    await persistState(); renderAll(); showToast("备份已合并，原有较新记录得到保留。");
  } catch (error) { showToast(error.message || "导入失败"); }
  $("#import-file").value = "";
}

function renderSettings() {
  $("#ai-api-url").value = state.settings.ai_api_url || "";
  $("#ai-access-code").value = state.settings.ai_access_code || "";
  renderStorageStatus();
}

function renderStorageStatus() {
  const target = $("#storage-status"); if (!target) return;
  target.textContent = `当前保存 ${recordedDates().length} 天记录、${state.leisure_items.length} 个闲暇条目。${db ? "使用 IndexedDB 持久存储。" : "当前使用本地备用存储。"}`;
}

async function saveAiSettings(event) {
  event.preventDefault();
  state.settings.ai_api_url = $("#ai-api-url").value.trim();
  state.settings.ai_access_code = $("#ai-access-code").value;
  await persistState(); $("#ai-settings-status").textContent = "AI 设置已保存在这台设备；OpenAI API Key 不在前端。"; showToast("AI 设置已保存。");
}

function switchView(viewId, options = {}) {
  activeView = viewId;
  if (viewId === "today-view" && !options.keepDate) currentDate = todayKey();
  $$(".app-view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  $$(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.viewTarget === viewId));
  if (viewId === "today-view") renderToday();
  if (viewId === "records-view") { $("#record-list").hidden = false; renderRecords(); }
  if (viewId === "leisure-view") renderLeisure();
  if (viewId === "review-view") renderReview();
  if (viewId === "backup-view") renderSettings();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDuration() {
  const minutes = Math.round(Number(state.durations_by_date[currentDate] || 0) / 60000);
  $("#duration-note").textContent = `今日在这里停留约 ${minutes} 分钟`;
}

function trackDuration() {
  const now = Date.now(); const active = document.visibilityState === "visible" && activeView === "today-view" && now - lastInteractionAt < 120000;
  if (active) state.durations_by_date[currentDate] = Number(state.durations_by_date[currentDate] || 0) + Math.min(now - lastDurationTick, 30000);
  lastDurationTick = now; renderDuration(); if (active) persistState();
}

function checkDateRoll() {
  const today = todayKey(); if (today === lastToday) return;
  const previous = lastToday; lastToday = today;
  if (activeView === "today-view" && currentDate === previous && !$("#raw-input").value.trim()) { currentDate = today; renderToday(); showToast("新的一天已经开始，已自动切到今天。"); }
}

function renderAll() {
  renderToday(); renderRecords(); renderLeisure(); renderReview(); renderSettings();
}

function bindEvents() {
  document.addEventListener("click", () => { lastInteractionAt = Date.now(); });
  document.addEventListener("input", () => { lastInteractionAt = Date.now(); });
  $$('[data-view-target]').forEach((button) => button.addEventListener("click", () => switchView(button.dataset.viewTarget)));
  $("#return-today").addEventListener("click", () => { currentDate = todayKey(); renderToday(); });
  $("#raw-input").addEventListener("input", scheduleRawSave);
  $("#save-button").addEventListener("click", saveNow);
  $("#organize-button").addEventListener("click", organizeToday);
  $("#confirm-button").addEventListener("click", confirmAi);
  $("#adjust-button").addEventListener("click", adjustAi);
  $("#todo-form").addEventListener("submit", addTodo);
  $("#todo-list").addEventListener("click", handleTodoClick);
  $("#todo-list").addEventListener("change", handleTodoClick);
  $("#detail-stack").addEventListener("input", saveDetailFromEvent);
  $("#detail-stack").addEventListener("change", saveDetailFromEvent);
  $("#detail-stack").addEventListener("click", (event) => { if (event.target.closest("#save-daily-leisure")) saveDailyLeisure(); });
  $("#detail-stack").addEventListener("toggle", (event) => {
    const panel = event.target.closest(".detail-panel"); if (!panel?.open) return;
    $$(".detail-panel").forEach((other) => { if (other !== panel) other.open = false; });
  }, true);
  $("#record-month").addEventListener("change", (event) => { selectedMonth = event.target.value; renderRecords(); });
  $("#show-all-records").addEventListener("click", () => { selectedMonth = ""; renderRecords(); });
  $("#record-list").addEventListener("click", (event) => { const row = event.target.closest("[data-open-record]"); if (row) renderRecordDetail(row.dataset.openRecord); });
  $("#record-detail").addEventListener("click", (event) => {
    if (event.target.closest("[data-close-record]")) { $("#record-detail").hidden = true; $("#record-list").hidden = false; }
    const edit = event.target.closest("[data-edit-date]"); if (edit) { currentDate = edit.dataset.editDate; switchView("today-view", { keepDate: true }); }
    const exportButton = event.target.closest("[data-export-date]"); if (exportButton) exportDate(exportButton.dataset.exportDate);
  });
  $("#export-all-from-records").addEventListener("click", exportAllMarkdown);
  $("#leisure-form").addEventListener("submit", submitLeisure);
  $("#cancel-leisure-edit").addEventListener("click", resetLeisureForm);
  $("#leisure-list").addEventListener("click", handleLeisureClick);
  $("#bored-button").addEventListener("click", showBoredSuggestions);
  $("#export-json").addEventListener("click", exportAllJson);
  $("#export-md").addEventListener("click", exportAllMarkdown);
  $("#import-file").addEventListener("change", (event) => importBackup(event.target.files[0]));
  $("#ai-settings-form").addEventListener("submit", saveAiSettings);
  document.addEventListener("visibilitychange", () => { trackDuration(); if (document.visibilityState === "visible") checkDateRoll(); });
  window.addEventListener("focus", checkDateRoll);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((registration) => registration.update()).catch(() => {});
}

async function init() {
  state = await loadState();
  migrateV4();
  await persistState();
  populateLeisureSelects();
  bindEvents();
  renderAll();
  registerServiceWorker();
  setInterval(trackDuration, 30000);
  setInterval(checkDateRoll, 60000);
}

init();
