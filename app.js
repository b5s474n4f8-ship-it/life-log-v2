const STORAGE_KEY = "life-log-calendar-v1";
const DB_NAME = "life-log-calendar-db";
const DB_VERSION = 1;
const DB_STORE = "state";
const DB_KEY = "main";
const BACKUP_FORMAT = "life-log-calendar-backup";
const BACKUP_VERSION = 1;
const DEFAULT_FOCUS = ["faith", "sleep", "body", "movement", "reading", "people"];

const BUILT_IN_TRACKERS = [
  { id: "faith", name: "灵修", short: "灵", group: "人与精神", preset: "generic", mode: "occurrence", tone: "sun", builtIn: true },
  { id: "dream", name: "梦境", short: "梦", group: "人与精神", preset: "generic", mode: "occurrence", tone: "blue", builtIn: true },
  { id: "inner", name: "内在与能量", short: "内", group: "人与精神", preset: "generic", mode: "state", tone: "violet", builtIn: true },
  { id: "inspiration", name: "灵感", short: "感", group: "输入与创造", preset: "generic", mode: "occurrence", tone: "sun", builtIn: true },
  { id: "people", name: "社交", short: "社", group: "人与精神", preset: "people", mode: "occurrence", tone: "coral", builtIn: true },
  { id: "relationship", name: "关系", short: "系", group: "人与精神", preset: "generic", mode: "state", tone: "violet", builtIn: true },
  { id: "movement", name: "运动", short: "动", group: "身体与节律", preset: "movement", mode: "duration", tone: "mint", builtIn: true },
  { id: "sleep", name: "睡眠", short: "睡", group: "身体与节律", preset: "sleep", mode: "duration", tone: "blue", builtIn: true },
  { id: "body", name: "身体", short: "身", group: "身体与节律", preset: "body", mode: "state", tone: "coral", builtIn: true },
  { id: "cycle", name: "经期", short: "经", group: "身体与节律", preset: "generic", mode: "state", tone: "violet", builtIn: true },
  { id: "care", name: "生活照料", short: "照", group: "身体与节律", preset: "generic", mode: "occurrence", tone: "mint", builtIn: true },
  { id: "reading", name: "阅读", short: "读", group: "输入与创造", preset: "reading", mode: "quantity", unit: "页", tone: "violet", builtIn: true },
  { id: "learning", name: "学习", short: "学", group: "输入与创造", preset: "generic", mode: "duration", tone: "blue", builtIn: true },
  { id: "creation", name: "创造", short: "创", group: "输入与创造", preset: "generic", mode: "occurrence", tone: "sun", builtIn: true },
  { id: "leisure", name: "闲暇", short: "闲", group: "生活事件", preset: "generic", mode: "occurrence", tone: "coral", builtIn: true },
  { id: "travel", name: "出行旅行", short: "行", group: "生活事件", preset: "generic", mode: "occurrence", tone: "blue", builtIn: true },
  { id: "housework", name: "家务", short: "务", group: "生活事件", preset: "generic", mode: "duration", tone: "mint", builtIn: true },
  { id: "work", name: "工作", short: "工", group: "生活事件", preset: "generic", mode: "duration", tone: "violet", builtIn: true }
];

const GROUP_ORDER = ["人与精神", "身体与节律", "输入与创造", "生活事件", "自定义"];
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let state = createEmptyState();
let databasePromise = null;
let storageWriteQueue = Promise.resolve();
let storagePersistence = { supported: false, persisted: false };
let currentView = "today";
let activeDate = todayKey();
let lastToday = activeDate;
let calendarMonth = monthKey(activeDate);
let selectedCalendarDate = activeDate;
let editingNoteId = null;
let activeTraceNoteId = null;
let selectedTraceTrackers = new Set();
let traceDrafts = {};
let managerMonth = calendarMonth;
let managerIds = [];
let toastTimer = null;
let draftTimer = null;

function makeId(prefix = "id") {
  const suffix = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function keyFromDate(date) {
  return todayKey(date);
}

function addDays(key, amount) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + amount);
  return keyFromDate(date);
}

function monthKey(dateKey) {
  return dateKey.slice(0, 7);
}

function shiftMonth(key, amount) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function firstDateOfMonth(key) {
  return `${key}-01`;
}

function formatMonth(key) {
  const [year, month] = key.split("-").map(Number);
  return `${year}年${month}月`;
}

function formatDay(key, withWeekday = false) {
  const date = dateFromKey(key);
  const base = `${date.getMonth() + 1}月${date.getDate()}日`;
  if (!withWeekday) return base;
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(date);
  return `${base} ${weekday}`;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "现在";
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function noteTimeLabel(note) {
  return note?.timeKnown === false ? "补录" : formatTime(note?.createdAt);
}

function isoForDate(key, hour, minute) {
  const date = dateFromKey(key);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function createEmptyState() {
  const now = new Date().toISOString();
  return {
    version: 1,
    notes: [],
    traces: [],
    trackers: BUILT_IN_TRACKERS.map((tracker) => ({ ...tracker })),
    monthPreferences: { [monthKey(todayKey())]: [...DEFAULT_FOCUS] },
    drafts: {},
    meta: {
      createdAt: now,
      updatedAt: now,
      lastBackupAt: null,
      lastImportAt: null
    }
  };
}

function normalizeState(value) {
  const source = value && typeof value === "object" ? value : {};
  const savedTrackers = Array.isArray(source.trackers) ? source.trackers : [];
  const savedById = new Map(savedTrackers.map((tracker) => [tracker.id, tracker]));
  const trackers = BUILT_IN_TRACKERS.map((tracker) => ({ ...(savedById.get(tracker.id) || {}), ...tracker }));
  savedTrackers.filter((tracker) => !BUILT_IN_TRACKERS.some((builtIn) => builtIn.id === tracker.id)).forEach((tracker) => trackers.push(tracker));
  const monthPreferences = source.monthPreferences && typeof source.monthPreferences === "object" ? source.monthPreferences : {};
  Object.keys(monthPreferences).forEach((month) => {
    const ids = Array.isArray(monthPreferences[month]) ? monthPreferences[month] : [];
    monthPreferences[month] = ids.includes("faith") ? ["faith", ...ids.filter((id) => id !== "faith")] : ids;
  });
  return {
    version: 1,
    notes: Array.isArray(source.notes) ? source.notes : [],
    traces: Array.isArray(source.traces) ? source.traces : [],
    trackers,
    monthPreferences,
    drafts: source.drafts && typeof source.drafts === "object" ? source.drafts : {},
    meta: {
      createdAt: source.meta?.createdAt || source.seededAt || new Date().toISOString(),
      updatedAt: source.meta?.updatedAt || new Date().toISOString(),
      lastBackupAt: source.meta?.lastBackupAt || null,
      lastImportAt: source.meta?.lastImportAt || null
    }
  };
}

function loadLocalState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? normalizeState(JSON.parse(saved)) : null;
  } catch {
    return null;
  }
}

function openStateDatabase() {
  if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB unavailable"));
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open IndexedDB"));
  });
  return databasePromise;
}

async function readStateFromDatabase() {
  const database = await openStateDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DB_STORE, "readonly");
    const request = transaction.objectStore(DB_STORE).get(DB_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Could not read IndexedDB"));
  });
}

async function writeStateToDatabase(value) {
  const database = await openStateDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DB_STORE, "readwrite");
    transaction.objectStore(DB_STORE).put(value, DB_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Could not write IndexedDB"));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB write aborted"));
  });
}

async function initializeState() {
  let databaseState = null;
  try {
    databaseState = await readStateFromDatabase();
  } catch {}
  state = normalizeState(databaseState || loadLocalState() || createEmptyState());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
  try {
    await writeStateToDatabase(state);
  } catch {}
}

function persistState(message = "已保存到本机") {
  state.meta = {
    ...(state.meta || {}),
    updatedAt: new Date().toISOString()
  };
  const snapshot = JSON.parse(JSON.stringify(state));
  let localSaved = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    localSaved = false;
  }
  storageWriteQueue = storageWriteQueue
    .then(() => writeStateToDatabase(snapshot))
    .catch(() => {
      const status = document.querySelector("#save-state");
      if (status && !localSaved) status.textContent = "当前浏览器无法保存";
    });
  const status = document.querySelector("#save-state");
  if (status) status.textContent = localSaved ? message : "正在尝试本机保存";
}

function trackerById(id) {
  return state.trackers.find((tracker) => tracker.id === id);
}

function trackerTone(trackerOrId) {
  const tracker = typeof trackerOrId === "string" ? trackerById(trackerOrId) : trackerOrId;
  return ["sun", "coral", "mint", "blue", "violet"].includes(tracker?.tone) ? tracker.tone : "blue";
}

function toneClass(trackerOrId) {
  return `tone-${trackerTone(trackerOrId)}`;
}

function getMonthFocusIds(key) {
  const direct = state.monthPreferences[key];
  if (Array.isArray(direct)) return direct.filter((id) => trackerById(id));
  const previous = Object.keys(state.monthPreferences)
    .filter((month) => month < key && Array.isArray(state.monthPreferences[month]))
    .sort()
    .reverse()[0];
  const inherited = previous ? state.monthPreferences[previous] : DEFAULT_FOCUS;
  return inherited.filter((id) => trackerById(id)).slice(0, 8);
}

function setMonthFocusIds(key, ids) {
  state.monthPreferences[key] = [...new Set(ids)].filter((id) => trackerById(id)).slice(0, 8);
  persistState();
}

function notesForDate(date) {
  return state.notes.filter((note) => note.date === date).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function tracesForDate(date) {
  return state.traces.filter((trace) => trace.date === date).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function tracesForNote(noteId) {
  return state.traces.filter((trace) => trace.noteId === noteId);
}

function noteById(noteId) {
  return state.notes.find((note) => note.id === noteId);
}

function renderFocusItems(target, month) {
  const trackers = getMonthFocusIds(month).map(trackerById).filter(Boolean);
  target.innerHTML = trackers.length
    ? trackers.map((tracker) => `<span class="${toneClass(tracker)}">${escapeHtml(tracker.name)}</span>`).join("")
    : "<span>暂时没有设定</span>";
}

function renderToday() {
  const today = todayKey();
  const isToday = activeDate === today;
  $("#today-weekday").textContent = `${isToday ? "今天" : "历史"} · ${new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(dateFromKey(activeDate))}`;
  $("#today-title").textContent = formatDay(activeDate);
  $("#return-today").hidden = isToday;
  $("#history-notice").hidden = isToday;
  renderFocusItems($("#today-focus-items"), monthKey(activeDate));

  const notes = notesForDate(activeDate);
  $("#note-count").textContent = `${notes.length} 条记录`;
  $("#note-list").innerHTML = notes.length ? notes.map(renderNote).join("") : `<p class="empty-copy">这一天还是空白。<br />可以只留下一句话。</p>`;

  if (!editingNoteId) $("#note-input").value = state.drafts[activeDate] || "";
  autoResize($("#note-input"));
}

function renderNote(note) {
  const traces = tracesForNote(note.id);
  const traceHtml = traces.length
    ? `<div class="note-traces">${traces.map((trace) => `<span class="${toneClass(trace.trackerId)}">${escapeHtml(traceSummary(trace))}</span>`).join("")}</div>`
    : "";
  return `
    <article class="note-item" data-note-id="${escapeAttr(note.id)}">
      <time class="note-time" datetime="${escapeAttr(note.createdAt)}">${escapeHtml(noteTimeLabel(note))}</time>
      <div class="note-body">
        <p class="note-text">${escapeHtml(note.text)}</p>
        ${traceHtml}
        <div class="note-actions">
          <button type="button" data-note-action="trace">${traces.length ? "调整月历痕迹" : "放进月历"}</button>
          <button type="button" data-note-action="edit">编辑</button>
          <button type="button" data-note-action="delete">删除</button>
        </div>
      </div>
    </article>`;
}

function renderMonth() {
  $("#month-title").textContent = formatMonth(calendarMonth);
  renderFocusItems($("#month-focus-items"), calendarMonth);
  renderCalendar();
  renderSelectedDay();
  renderMonthSummary();
}

function calendarDates(key) {
  const first = dateFromKey(firstDateOfMonth(key));
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return keyFromDate(date);
  });
}

function renderCalendar() {
  const today = todayKey();
  $("#calendar-grid").innerHTML = calendarDates(calendarMonth).map((date) => {
    const traces = tracesForDate(date);
    const summaries = traces.map(traceSummary);
    const markerTrackers = [...new Map(traces.map((trace) => {
      const tracker = trackerById(trace.trackerId) || { short: "记", tone: "blue" };
      return [trace.trackerId, tracker];
    })).values()];
    const classes = ["calendar-day"];
    if (monthKey(date) !== calendarMonth) classes.push("outside");
    if (date === selectedCalendarDate) classes.push("selected");
    if (date === today) classes.push("today");
    const desktopLines = traces.slice(0, 3).map((trace) => `<span class="day-trace ${toneClass(trace.trackerId)}">${escapeHtml(traceSummary(trace))}</span>`).join("");
    const desktopMore = summaries.length > 3 ? `<span class="more-count">+${summaries.length - 3}</span>` : "";
    const markers = markerTrackers.slice(0, 3).map((tracker) => `<span class="${toneClass(tracker)}">${escapeHtml(tracker.short || "记")}</span>`).join("");
    const markerMore = markerTrackers.length > 3 ? `<span class="tone-blue">+${markerTrackers.length - 3}</span>` : "";
    return `
      <button class="${classes.join(" ")}" type="button" data-calendar-date="${date}" aria-label="${escapeAttr(formatDay(date))}，${traces.length} 条月历痕迹">
        <span class="day-number">${Number(date.slice(-2))}</span>
        <span class="day-traces">${desktopLines}${desktopMore}</span>
        <span class="mobile-markers">${markers}${markerMore}</span>
      </button>`;
  }).join("");
}

function renderSelectedDay() {
  $("#selected-day-title").textContent = formatDay(selectedCalendarDate, true);
  const traces = tracesForDate(selectedCalendarDate);
  const notes = notesForDate(selectedCalendarDate);
  if (!traces.length && !notes.length) {
    $("#selected-day-content").innerHTML = `<p class="empty-copy">这一天还没有留下内容。</p>`;
    return;
  }

  const traceRows = traces.length ? `
    <div class="day-detail-list">
      ${traces.map((trace) => {
        const tracker = trackerById(trace.trackerId);
        return `<div class="day-detail-row ${toneClass(tracker)}"><strong>${escapeHtml(tracker?.name || "记录")}</strong><p>${escapeHtml(traceDetail(trace))}</p></div>`;
      }).join("")}
    </div>` : "";
  const originals = notes.length ? `
    <div class="day-originals">
      <strong>当天原文</strong>
      ${notes.map((note) => `<p><time>${escapeHtml(noteTimeLabel(note))}</time>　${escapeHtml(note.text)}</p>`).join("")}
    </div>` : "";
  $("#selected-day-content").innerHTML = traceRows + originals;
}

function renderMonthSummary() {
  const monthTraces = state.traces.filter((trace) => monthKey(trace.date) === calendarMonth);
  if (!monthTraces.length) {
    $("#summary-list").innerHTML = `<p class="empty-copy">这个月还没有可汇总的月历痕迹。</p>`;
    return;
  }
  const grouped = new Map();
  monthTraces.forEach((trace) => {
    if (!grouped.has(trace.trackerId)) grouped.set(trace.trackerId, []);
    grouped.get(trace.trackerId).push(trace);
  });
  const focusIds = getMonthFocusIds(calendarMonth);
  const ids = [...grouped.keys()].sort((a, b) => {
    const ai = focusIds.indexOf(a);
    const bi = focusIds.indexOf(b);
    if (ai >= 0 || bi >= 0) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    return (trackerById(a)?.name || "").localeCompare(trackerById(b)?.name || "", "zh-CN");
  });
  $("#summary-list").innerHTML = ids.map((id) => {
    const tracker = trackerById(id);
    return `<div class="summary-row ${toneClass(tracker)}"><strong>${escapeHtml(tracker?.name || "记录")}</strong><p>${escapeHtml(summarizeTracker(tracker, grouped.get(id)))}</p></div>`;
  }).join("");
}

function numeric(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value, digits = 1) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits).replace(/\.0$/, "");
}

function countValues(values) {
  const counts = new Map();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => `${value}${count > 1 ? ` ${count}次` : ""}`);
}

function summarizeTracker(tracker, traces) {
  const days = new Set(traces.map((trace) => trace.date)).size;
  const count = traces.length;
  if (!tracker) return `${days} 天 · ${count} 次`;
  if (tracker.preset === "movement") {
    const minutes = traces.reduce((sum, trace) => sum + numeric(trace.fields?.durationMin), 0);
    const distance = traces.reduce((sum, trace) => sum + numeric(trace.fields?.distanceKm), 0);
    return `${days} 天 · ${count} 次${minutes ? ` · ${formatNumber(minutes, 0)} 分钟` : ""}${distance ? ` · ${formatNumber(distance)} 公里` : ""}`;
  }
  if (tracker.preset === "reading") {
    const titles = [...new Set(traces.map((trace) => trace.fields?.title).filter(Boolean))];
    const progressByUnit = new Map();
    traces.forEach((trace) => {
      const value = numeric(trace.fields?.progressValue);
      const unit = trace.fields?.progressUnit;
      if (value && unit) progressByUnit.set(unit, (progressByUnit.get(unit) || 0) + value);
    });
    const progress = [...progressByUnit].map(([unit, value]) => `${formatNumber(value)}${unit}`).join("、");
    return `${days} 天${titles.length ? ` · ${titles.slice(0, 3).join("、")}${titles.length > 3 ? `等 ${titles.length} 项` : ""}` : ""}${progress ? ` · ${progress}` : ""}`;
  }
  if (tracker.preset === "people") {
    const names = [...new Set(traces.map((trace) => trace.fields?.name).filter(Boolean))];
    return `${days} 天 · ${count} 次${names.length ? ` · ${names.join("、")}` : ""}`;
  }
  if (tracker.preset === "body") {
    const signals = countValues(traces.map((trace) => trace.fields?.signal));
    return `${days} 天${signals.length ? ` · ${signals.join("、")}` : ` · ${count} 次记录`}`;
  }
  if (tracker.preset === "sleep") {
    const hours = traces.map((trace) => numeric(trace.fields?.hours)).filter(Boolean);
    const average = hours.length ? hours.reduce((sum, value) => sum + value, 0) / hours.length : 0;
    const quality = countValues(traces.map((trace) => trace.fields?.quality));
    return `记录 ${days} 天${average ? ` · 平均 ${formatNumber(average)} 小时` : ""}${quality.length ? ` · ${quality.join("、")}` : ""}`;
  }
  if (tracker.mode === "duration") {
    const minutes = traces.reduce((sum, trace) => sum + numeric(trace.fields?.durationMin), 0);
    return `${days} 天 · ${count} 次${minutes ? ` · ${formatNumber(minutes, 0)} 分钟` : ""}`;
  }
  if (tracker.mode === "quantity") {
    const total = traces.reduce((sum, trace) => sum + numeric(trace.fields?.quantity), 0);
    return `${days} 天 · ${count} 次${total ? ` · ${formatNumber(total)}${tracker.unit || ""}` : ""}`;
  }
  if (tracker.mode === "state") {
    const states = countValues(traces.map((trace) => trace.fields?.state));
    return `${days} 天${states.length ? ` · ${states.join("、")}` : ` · ${count} 次记录`}`;
  }
  return `${days} 天 · ${count} 次`;
}

function traceSummary(trace) {
  const tracker = trackerById(trace.trackerId);
  const fields = trace.fields || {};
  if (!tracker) return "记录";
  if (tracker.preset === "movement") {
    return `${fields.activity || "运动"}${fields.durationMin ? ` ${formatNumber(numeric(fields.durationMin), 0)}m` : ""}${fields.distanceKm ? ` ${formatNumber(numeric(fields.distanceKm))}km` : ""}`;
  }
  if (tracker.preset === "reading") {
    const title = fields.title ? `《${fields.title}》` : "阅读";
    return `${fields.itemType === "文章" ? "读文" : "读"}${title}${fields.progressValue ? ` ${formatNumber(numeric(fields.progressValue))}${fields.progressUnit || ""}` : ""}`;
  }
  if (tracker.preset === "people") return fields.name ? `和 ${fields.name}` : "社交";
  if (tracker.preset === "body") return fields.signal || "身体";
  if (tracker.preset === "sleep") return `睡${fields.hours ? ` ${formatNumber(numeric(fields.hours))}h` : ""}${fields.quality ? ` · ${fields.quality}` : ""}`;
  const detail = fields.detail || fields.state || "";
  if (tracker.mode === "duration" && fields.durationMin) return `${detail || tracker.name} ${formatNumber(numeric(fields.durationMin), 0)}m`;
  if (tracker.mode === "quantity" && fields.quantity) return `${detail || tracker.name} ${formatNumber(numeric(fields.quantity))}${tracker.unit || ""}`;
  return detail ? `${tracker.name} · ${detail}` : tracker.name;
}

function traceDetail(trace) {
  const tracker = trackerById(trace.trackerId);
  const fields = trace.fields || {};
  const parts = [traceSummary(trace)];
  if (tracker?.preset === "people" && fields.context) parts.push(fields.context);
  if (tracker?.preset === "sleep" && fields.factors) parts.push(`影响：${fields.factors}`);
  return parts.join("；");
}

function renderTraceChoices() {
  const note = noteById(activeTraceNoteId);
  if (!note) return;
  const focusIds = getMonthFocusIds(monthKey(note.date));
  const remaining = state.trackers.filter((tracker) => !focusIds.includes(tracker.id));
  $("#month-tracker-choices").innerHTML = focusIds.map(trackerChoiceButton).join("");
  $("#more-tracker-choices").innerHTML = remaining.map((tracker) => trackerChoiceButton(tracker.id)).join("");
  renderTraceFields();
}

function trackerChoiceButton(id) {
  const tracker = trackerById(id);
  if (!tracker) return "";
  const pressed = selectedTraceTrackers.has(id);
  return `<button class="tracker-choice ${toneClass(tracker)}" type="button" data-tracker-choice="${escapeAttr(id)}" aria-pressed="${pressed}">${escapeHtml(tracker.name)}</button>`;
}

function captureTraceDrafts() {
  $$("[data-tracker-fields]", $("#trace-fields")).forEach((fieldset) => {
    const trackerId = fieldset.dataset.trackerFields;
    const fields = {};
    $$('[data-field]', fieldset).forEach((input) => { fields[input.dataset.field] = input.value; });
    traceDrafts[trackerId] = fields;
  });
}

function renderTraceFields() {
  const ordered = state.trackers.filter((tracker) => selectedTraceTrackers.has(tracker.id));
  $("#trace-fields").innerHTML = ordered.map((tracker) => traceFieldset(tracker, traceDrafts[tracker.id] || {})).join("");
}

function inputField(label, field, value = "", options = {}) {
  const type = options.type || "text";
  const attrs = [
    `type="${type}"`,
    `data-field="${escapeAttr(field)}"`,
    `value="${escapeAttr(value)}"`,
    options.placeholder ? `placeholder="${escapeAttr(options.placeholder)}"` : "",
    options.step ? `step="${escapeAttr(options.step)}"` : "",
    options.min !== undefined ? `min="${escapeAttr(options.min)}"` : "",
    options.max !== undefined ? `max="${escapeAttr(options.max)}"` : "",
    options.inputmode ? `inputmode="${escapeAttr(options.inputmode)}"` : ""
  ].filter(Boolean).join(" ");
  return `<label class="${options.full ? "full" : ""}">${escapeHtml(label)}<input ${attrs} /></label>`;
}

function selectField(label, field, value, choices, full = false) {
  return `<label class="${full ? "full" : ""}">${escapeHtml(label)}<select data-field="${escapeAttr(field)}">${choices.map((choice) => `<option value="${escapeAttr(choice)}" ${choice === value ? "selected" : ""}>${escapeHtml(choice)}</option>`).join("")}</select></label>`;
}

function traceFieldset(tracker, fields) {
  let content = "";
  if (tracker.preset === "movement") {
    content = inputField("做了什么", "activity", fields.activity, { placeholder: "例如：跑步机上坡走", full: true })
      + inputField("分钟", "durationMin", fields.durationMin, { type: "number", inputmode: "decimal", min: 0, step: 1 })
      + inputField("公里数", "distanceKm", fields.distanceKm, { type: "number", inputmode: "decimal", min: 0, step: 0.1 });
  } else if (tracker.preset === "reading") {
    content = selectField("类型", "itemType", fields.itemType || "书", ["书", "文章"])
      + inputField("名称", "title", fields.title, { placeholder: "书名或文章名", full: true })
      + inputField("进度", "progressValue", fields.progressValue, { type: "number", inputmode: "decimal", min: 0, step: 1 })
      + selectField("单位", "progressUnit", fields.progressUnit || "页", ["页", "章", "分钟", "篇"]);
  } else if (tracker.preset === "people") {
    content = inputField("对象或简称", "name", fields.name, { placeholder: "例如：L、家人、同事", full: true })
      + inputField("互动情境", "context", fields.context, { placeholder: "例如：晚饭，聊近况", full: true });
  } else if (tracker.preset === "body") {
    content = inputField("身体信号", "signal", fields.signal, { placeholder: "例如：头痛、浮肿、肩背紧", full: true });
  } else if (tracker.preset === "sleep") {
    content = inputField("睡眠时长（小时）", "hours", fields.hours, { type: "number", inputmode: "decimal", min: 0, max: 24, step: 0.1 })
      + selectField("睡得如何", "quality", fields.quality || "", ["", "好", "一般", "差"])
      + inputField("影响因素", "factors", fields.factors, { placeholder: "例如：鸟叫、早醒、睡前活动", full: true });
  } else if (tracker.mode === "duration") {
    content = inputField("简短痕迹", "detail", fields.detail, { placeholder: "发生了什么", full: true })
      + inputField("分钟", "durationMin", fields.durationMin, { type: "number", inputmode: "decimal", min: 0, step: 1 });
  } else if (tracker.mode === "quantity") {
    content = inputField("简短痕迹", "detail", fields.detail, { placeholder: "发生了什么", full: true })
      + inputField(`数量${tracker.unit ? `（${tracker.unit}）` : ""}`, "quantity", fields.quantity, { type: "number", inputmode: "decimal", min: 0, step: 0.1 });
  } else if (tracker.mode === "state") {
    content = inputField("状态", "state", fields.state, { placeholder: "用几个字留下状态", full: true });
  } else {
    content = inputField("简短痕迹", "detail", fields.detail, { placeholder: "可以留空", full: true });
  }
  return `<fieldset class="trace-fieldset" data-tracker-fields="${escapeAttr(tracker.id)}"><legend>${escapeHtml(tracker.name)}</legend><div class="field-grid">${content}</div></fieldset>`;
}

function openTraceDialog(noteId) {
  const note = noteById(noteId);
  if (!note) return;
  activeTraceNoteId = noteId;
  const existing = tracesForNote(noteId);
  selectedTraceTrackers = new Set(existing.map((trace) => trace.trackerId));
  traceDrafts = Object.fromEntries(existing.map((trace) => [trace.trackerId, { ...(trace.fields || {}) }]));
  $("#trace-note-preview").textContent = note.text;
  $("#toggle-more-trackers").setAttribute("aria-expanded", "false");
  $("#more-tracker-choices").hidden = true;
  renderTraceChoices();
  $("#trace-dialog").showModal();
}

function saveTracesForActiveNote() {
  captureTraceDrafts();
  const note = noteById(activeTraceNoteId);
  if (!note) return;
  const existing = new Map(tracesForNote(note.id).map((trace) => [trace.trackerId, trace]));
  state.traces = state.traces.filter((trace) => trace.noteId !== note.id);
  selectedTraceTrackers.forEach((trackerId) => {
    const old = existing.get(trackerId);
    state.traces.push({
      id: old?.id || makeId("trace"),
      noteId: note.id,
      date: note.date,
      trackerId,
      fields: { ...(traceDrafts[trackerId] || {}) },
      createdAt: old?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });
  persistState();
  $("#trace-dialog").close();
  renderAll();
  showToast(selectedTraceTrackers.size ? "月历痕迹已更新。" : "原文保留，没有加入月历。");
}

function removeTracesForActiveNote() {
  state.traces = state.traces.filter((trace) => trace.noteId !== activeTraceNoteId);
  persistState();
  $("#trace-dialog").close();
  renderAll();
  showToast("已移出月历，原文仍然保留。");
}

function openTrackerManager(month) {
  managerMonth = month;
  managerIds = [...getMonthFocusIds(month)];
  renderTrackerManager();
  $("#tracker-dialog").showModal();
}

function renderTrackerManager() {
  $("#tracker-dialog-title").textContent = `${formatMonth(managerMonth)} · 本月留意`;
  $("#active-tracker-list").innerHTML = managerIds.length ? managerIds.map((id, index) => {
    const tracker = trackerById(id);
    return `
      <div class="active-tracker-row ${toneClass(tracker)}" data-active-tracker="${escapeAttr(id)}">
        <strong>${escapeHtml(tracker?.name || id)}</strong>
        <button class="mini-icon-button" type="button" data-manager-action="up" aria-label="上移 ${escapeAttr(tracker?.name || id)}" title="上移" ${index === 0 ? "disabled" : ""}>↑</button>
        <button class="mini-icon-button" type="button" data-manager-action="down" aria-label="下移 ${escapeAttr(tracker?.name || id)}" title="下移" ${index === managerIds.length - 1 ? "disabled" : ""}>↓</button>
        <button class="mini-icon-button remove" type="button" data-manager-action="remove" aria-label="移除 ${escapeAttr(tracker?.name || id)}" title="移除">×</button>
      </div>`;
  }).join("") : `<p class="empty-copy">本月还没有放在前面的项目。</p>`;

  const available = state.trackers.filter((tracker) => !managerIds.includes(tracker.id));
  const grouped = new Map(GROUP_ORDER.map((group) => [group, []]));
  available.forEach((tracker) => {
    const group = grouped.has(tracker.group) ? tracker.group : "自定义";
    grouped.get(group).push(tracker);
  });
  $("#tracker-library").innerHTML = [...grouped.entries()].filter(([, trackers]) => trackers.length).map(([group, trackers]) => `
    <div class="library-group">
      <strong>${escapeHtml(group)}</strong>
      <div class="library-items">${trackers.map((tracker) => `<button class="library-item ${toneClass(tracker)}" type="button" data-library-add="${escapeAttr(tracker.id)}">${escapeHtml(tracker.name)}</button>`).join("")}</div>
    </div>`).join("");
}

function commitManagerIds() {
  setMonthFocusIds(managerMonth, managerIds);
  renderAll();
}

function addManagerTracker(id) {
  if (managerIds.includes(id)) return;
  if (managerIds.length >= 8) {
    showToast("本月留意最多放 8 项。先移除一项再添加。", true);
    return;
  }
  managerIds.push(id);
  commitManagerIds();
  renderTrackerManager();
}

function createCustomTracker(event) {
  event.preventDefault();
  if (managerIds.length >= 8) {
    showToast("本月留意最多放 8 项。先移除一项再新建。", true);
    return;
  }
  const name = $("#new-tracker-name").value.trim();
  const mode = $("#new-tracker-mode").value;
  const unit = $("#new-tracker-unit").value.trim();
  if (!name) return;
  const duplicate = state.trackers.find((tracker) => tracker.name === name);
  if (duplicate) {
    addManagerTracker(duplicate.id);
    showToast("已把同名项目加入本月。");
    return;
  }
  const tracker = {
    id: makeId("custom"),
    name,
    short: [...name][0] || "记",
    group: "自定义",
    preset: "generic",
    mode,
    unit: mode === "quantity" ? unit : "",
    builtIn: false
  };
  state.trackers.push(tracker);
  managerIds.push(tracker.id);
  commitManagerIds();
  renderTrackerManager();
  $("#new-tracker-form").reset();
  $("#new-tracker-unit-label").hidden = true;
  showToast(`已加入“${name}”。`);
}

function switchView(view, options = {}) {
  currentView = view === "month" ? "month" : "today";
  $$(".app-view").forEach((section) => {
    const active = section.dataset.view === currentView;
    section.classList.toggle("active", active);
    section.hidden = !active;
  });
  $$(".view-tab").forEach((button) => {
    const active = button.dataset.viewTarget === currentView;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (currentView === "today") {
    renderToday();
    if (options.scrollToEnd) requestAnimationFrame(() => $("#note-form").scrollIntoView({ block: "end" }));
  } else {
    renderMonth();
    if (options.scrollTop !== false) window.scrollTo({ top: 0, behavior: "auto" });
  }
}

function resetComposer() {
  editingNoteId = null;
  $("#note-input").value = state.drafts[activeDate] || "";
  $("#save-note").textContent = "保存";
  $("#cancel-edit").hidden = true;
  autoResize($("#note-input"));
}

function saveNote(event) {
  event.preventDefault();
  const text = $("#note-input").value.trim();
  if (!text) {
    showToast("先留下一点内容。", true);
    $("#note-input").focus();
    return;
  }
  const wasEditing = Boolean(editingNoteId);
  if (wasEditing) {
    const note = noteById(editingNoteId);
    if (note) {
      note.text = text;
      note.updatedAt = new Date().toISOString();
    }
  } else {
    state.notes.push({ id: makeId("note"), date: activeDate, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), text });
  }
  delete state.drafts[activeDate];
  persistState();
  resetComposer();
  renderAll();
  requestAnimationFrame(() => $("#note-form").scrollIntoView({ block: "end", behavior: "smooth" }));
  showToast(wasEditing ? "记录已更新。" : "记录已保存。需要时再放进月历。");
}

function editNote(noteId) {
  const note = noteById(noteId);
  if (!note) return;
  editingNoteId = noteId;
  $("#note-input").value = note.text;
  $("#save-note").textContent = "更新";
  $("#cancel-edit").hidden = false;
  autoResize($("#note-input"));
  $("#note-form").scrollIntoView({ block: "end", behavior: "smooth" });
  $("#note-input").focus();
}

function deleteNote(noteId) {
  const note = noteById(noteId);
  if (!note || !window.confirm("删除这条原文及其月历痕迹？删除后只能从备份中恢复。")) return;
  state.notes = state.notes.filter((item) => item.id !== noteId);
  state.traces = state.traces.filter((trace) => trace.noteId !== noteId);
  if (editingNoteId === noteId) resetComposer();
  persistState();
  renderAll();
  showToast("记录已删除。");
}

function renderAll() {
  renderToday();
  renderMonth();
}

function autoResize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 132), 360)}px`;
}

function showToast(message, urgent = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  toast.style.borderColor = urgent ? "#c69b96" : "";
  toast.style.color = urgent ? "#78362f" : "";
  toast.style.background = urgent ? "#fbefed" : "";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function monthSummaryRows(key) {
  const grouped = new Map();
  state.traces.filter((trace) => monthKey(trace.date) === key).forEach((trace) => {
    if (!grouped.has(trace.trackerId)) grouped.set(trace.trackerId, []);
    grouped.get(trace.trackerId).push(trace);
  });
  return [...grouped.entries()].map(([id, traces]) => ({ tracker: trackerById(id), text: summarizeTracker(trackerById(id), traces) }));
}

function buildMonthMarkdown(key) {
  const lines = [`# Life Log · ${formatMonth(key)}`, "", "> 基于已经放进月历的记录。空白表示没有记录，不代表没有发生。", "", "## 本月留意", ""];
  const focusNames = getMonthFocusIds(key).map((id) => trackerById(id)?.name).filter(Boolean);
  lines.push(focusNames.length ? focusNames.join(" · ") : "未设定", "", "## 按日期", "");
  const dates = [...new Set([
    ...state.notes.filter((note) => monthKey(note.date) === key).map((note) => note.date),
    ...state.traces.filter((trace) => monthKey(trace.date) === key).map((trace) => trace.date)
  ])].sort();
  if (!dates.length) lines.push("这个月还没有记录。", "");
  dates.forEach((date) => {
    lines.push(`### ${formatDay(date, true)}`, "");
    notesForDate(date).forEach((note) => {
      lines.push(`- ${noteTimeLabel(note)} ${note.text.replace(/\n/g, " ")}`);
      tracesForNote(note.id).forEach((trace) => lines.push(`  - ${trackerById(trace.trackerId)?.name || "记录"}：${traceDetail(trace)}`));
    });
    lines.push("");
  });
  lines.push("## 月度小结", "");
  const rows = monthSummaryRows(key);
  if (!rows.length) lines.push("还没有可汇总的月历痕迹。", "");
  rows.forEach(({ tracker, text }) => lines.push(`- **${tracker?.name || "记录"}**：${text}`));
  lines.push("");
  return lines.join("\n");
}

function downloadFile(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadMonth() {
  const key = currentView === "month" ? calendarMonth : monthKey(activeDate);
  downloadFile("﻿" + buildMonthMarkdown(key), "text/markdown;charset=utf-8", "life-log-" + key + ".md");
  showToast(formatMonth(key) + "已导出。");
}

function fullBackupPayload() {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: JSON.parse(JSON.stringify(state))
  };
}

function downloadFullBackup() {
  const exportedAt = new Date().toISOString();
  state.meta.lastBackupAt = exportedAt;
  persistState("已完成本机保存");
  const payload = fullBackupPayload();
  payload.exportedAt = exportedAt;
  payload.data.meta.lastBackupAt = exportedAt;
  downloadFile(JSON.stringify(payload, null, 2), "application/json;charset=utf-8", "life-log-backup-" + todayKey() + ".json");
  renderBackupStatus();
  showToast("全部记录已备份。");
}

function displayDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function renderBackupStatus() {
  const status = $("#storage-status");
  if (!status) return;
  status.classList.toggle("is-limited", !storagePersistence.persisted);
  $("#storage-status-title").textContent = storagePersistence.persisted ? "已启用更稳定的本机存储" : "本机保存已启用";
  $("#storage-status-copy").textContent = storagePersistence.persisted
    ? "刷新、离线或从主屏幕重开后会继续读取这些记录。"
    : "系统未确认持久存储，建议定期导出完整备份。";
  const lastBackup = displayDateTime(state.meta?.lastBackupAt);
  $("#last-backup-copy").textContent = lastBackup
    ? "最近一次完整备份：" + lastBackup
    : "尚未在这台设备上导出完整备份。";
}

async function requestPersistentStorage() {
  const storage = navigator.storage;
  storagePersistence.supported = Boolean(storage?.persisted);
  if (!storage?.persisted) {
    renderBackupStatus();
    return;
  }
  try {
    let persisted = await storage.persisted();
    if (!persisted && storage.persist) persisted = await storage.persist();
    storagePersistence.persisted = Boolean(persisted);
  } catch {
    storagePersistence.persisted = false;
  }
  renderBackupStatus();
}

function openBackupDialog() {
  renderBackupStatus();
  $("#backup-dialog").showModal();
}

function updatedMoment(item) {
  const value = item?.updatedAt || item?.createdAt || "";
  const moment = Date.parse(value);
  return Number.isFinite(moment) ? moment : 0;
}

function mergeItems(localItems, importedItems) {
  const merged = new Map();
  (Array.isArray(importedItems) ? importedItems : []).forEach((item) => {
    if (item?.id) merged.set(item.id, item);
  });
  (Array.isArray(localItems) ? localItems : []).forEach((item) => {
    if (!item?.id) return;
    const existing = merged.get(item.id);
    if (!existing || updatedMoment(item) >= updatedMoment(existing)) merged.set(item.id, item);
  });
  return [...merged.values()];
}

function mergeImportedState(localValue, importedValue) {
  const local = normalizeState(localValue);
  const imported = normalizeState(importedValue);
  const merged = normalizeState({
    version: Math.max(local.version || 1, imported.version || 1),
    notes: mergeItems(local.notes, imported.notes),
    traces: mergeItems(local.traces, imported.traces),
    trackers: mergeItems(local.trackers, imported.trackers),
    monthPreferences: { ...imported.monthPreferences, ...local.monthPreferences },
    drafts: { ...imported.drafts, ...local.drafts },
    meta: {
      ...imported.meta,
      ...local.meta,
      createdAt: local.meta?.createdAt || imported.meta?.createdAt,
      lastImportAt: new Date().toISOString()
    }
  });
  const noteIds = new Set(merged.notes.map((note) => note.id));
  const trackerIds = new Set(merged.trackers.map((tracker) => tracker.id));
  merged.traces = merged.traces.filter((trace) => noteIds.has(trace.noteId) && trackerIds.has(trace.trackerId));
  return merged;
}

async function importBackupFile(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (parsed?.format !== BACKUP_FORMAT || parsed?.version !== BACKUP_VERSION || !parsed?.data) {
      throw new Error("无法识别这个备份文件。");
    }
    const incomingNotes = Array.isArray(parsed.data.notes) ? parsed.data.notes.length : 0;
    state = mergeImportedState(state, parsed.data);
    persistState("导入后已保存");
    await storageWriteQueue;
    renderAll();
    renderBackupStatus();
    $("#backup-dialog").close();
    showToast("已导入并合并 " + incomingNotes + " 条原始记录。");
  } catch (error) {
    showToast(error?.message || "备份导入失败。", true);
  } finally {
    $("#backup-file-input").value = "";
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const register = () => navigator.serviceWorker.register("./sw.js?v=20260719-formal").catch(() => {});
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

function checkDateChange() {
  const current = todayKey();
  if (current === lastToday) return;
  const wasOnToday = activeDate === lastToday;
  lastToday = current;
  if (wasOnToday) activeDate = current;
  if (calendarMonth === monthKey(addDays(current, -1))) {
    calendarMonth = monthKey(current);
    selectedCalendarDate = current;
  }
  renderAll();
  showToast("新的一天已经翻开。");
}

function bindEvents() {
  $$("[data-view-target]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.viewTarget, { scrollToEnd: button.dataset.viewTarget === "today" })));
  $("#brand-today").addEventListener("click", () => {
    activeDate = todayKey();
    resetComposer();
    switchView("today", { scrollToEnd: true });
  });
  $("#return-today").addEventListener("click", () => { activeDate = todayKey(); resetComposer(); switchView("today", { scrollToEnd: true }); });
  $("#history-return").addEventListener("click", () => { activeDate = todayKey(); resetComposer(); switchView("today", { scrollToEnd: true }); });
  $("#note-form").addEventListener("submit", saveNote);
  $("#note-input").addEventListener("input", (event) => {
    autoResize(event.target);
    if (editingNoteId) return;
    state.drafts[activeDate] = event.target.value;
    $("#save-state").textContent = "正在保存草稿…";
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => persistState("草稿已保存"), 300);
  });
  $("#cancel-edit").addEventListener("click", resetComposer);
  $("#note-list").addEventListener("click", (event) => {
    const noteElement = event.target.closest("[data-note-id]");
    const action = event.target.closest("[data-note-action]")?.dataset.noteAction;
    if (!noteElement || !action) return;
    const noteId = noteElement.dataset.noteId;
    if (action === "trace") openTraceDialog(noteId);
    if (action === "edit") editNote(noteId);
    if (action === "delete") deleteNote(noteId);
  });

  $("#trace-dialog").addEventListener("click", (event) => {
    const choice = event.target.closest("[data-tracker-choice]");
    if (!choice) return;
    captureTraceDrafts();
    const id = choice.dataset.trackerChoice;
    if (selectedTraceTrackers.has(id)) selectedTraceTrackers.delete(id);
    else selectedTraceTrackers.add(id);
    renderTraceChoices();
  });
  $("#trace-form").addEventListener("submit", (event) => { event.preventDefault(); saveTracesForActiveNote(); });
  $("#close-trace-dialog").addEventListener("click", () => $("#trace-dialog").close());
  $("#remove-note-traces").addEventListener("click", removeTracesForActiveNote);
  $("#toggle-more-trackers").addEventListener("click", () => {
    const expanded = $("#toggle-more-trackers").getAttribute("aria-expanded") === "true";
    $("#toggle-more-trackers").setAttribute("aria-expanded", String(!expanded));
    $("#more-tracker-choices").hidden = expanded;
  });

  $("#previous-month").addEventListener("click", () => {
    calendarMonth = shiftMonth(calendarMonth, -1);
    selectedCalendarDate = firstDateOfMonth(calendarMonth);
    renderMonth();
  });
  $("#next-month").addEventListener("click", () => {
    calendarMonth = shiftMonth(calendarMonth, 1);
    selectedCalendarDate = firstDateOfMonth(calendarMonth);
    renderMonth();
  });
  $("#current-month").addEventListener("click", () => {
    calendarMonth = monthKey(todayKey());
    selectedCalendarDate = todayKey();
    renderMonth();
  });
  $("#calendar-grid").addEventListener("click", (event) => {
    const day = event.target.closest("[data-calendar-date]");
    if (!day) return;
    selectedCalendarDate = day.dataset.calendarDate;
    if (monthKey(selectedCalendarDate) !== calendarMonth) calendarMonth = monthKey(selectedCalendarDate);
    renderMonth();
    if (window.innerWidth <= 720) requestAnimationFrame(() => $(".selected-day").scrollIntoView({ block: "start", behavior: "smooth" }));
  });
  $("#open-selected-day").addEventListener("click", () => {
    activeDate = selectedCalendarDate;
    resetComposer();
    switchView("today", { scrollToEnd: true });
  });

  $("#manage-trackers-today").addEventListener("click", () => openTrackerManager(monthKey(activeDate)));
  $("#manage-trackers-month").addEventListener("click", () => openTrackerManager(calendarMonth));
  $("#close-tracker-dialog").addEventListener("click", () => $("#tracker-dialog").close());
  $("#finish-tracker-management").addEventListener("click", () => $("#tracker-dialog").close());
  $("#active-tracker-list").addEventListener("click", (event) => {
    const row = event.target.closest("[data-active-tracker]");
    const action = event.target.closest("[data-manager-action]")?.dataset.managerAction;
    if (!row || !action) return;
    const index = managerIds.indexOf(row.dataset.activeTracker);
    if (index < 0) return;
    if (action === "up" && index > 0) [managerIds[index - 1], managerIds[index]] = [managerIds[index], managerIds[index - 1]];
    if (action === "down" && index < managerIds.length - 1) [managerIds[index + 1], managerIds[index]] = [managerIds[index], managerIds[index + 1]];
    if (action === "remove") managerIds.splice(index, 1);
    commitManagerIds();
    renderTrackerManager();
  });
  $("#tracker-library").addEventListener("click", (event) => {
    const button = event.target.closest("[data-library-add]");
    if (button) addManagerTracker(button.dataset.libraryAdd);
  });
  $("#new-tracker-mode").addEventListener("change", (event) => { $("#new-tracker-unit-label").hidden = event.target.value !== "quantity"; });
  $("#new-tracker-form").addEventListener("submit", createCustomTracker);
  $("#open-backup").addEventListener("click", openBackupDialog);
  $("#close-backup-dialog").addEventListener("click", () => $("#backup-dialog").close());
  $("#finish-backup").addEventListener("click", () => $("#backup-dialog").close());
  $("#download-backup").addEventListener("click", downloadFullBackup);
  $("#export-month").addEventListener("click", downloadMonth);
  $("#choose-backup").addEventListener("click", () => $("#backup-file-input").click());
  $("#backup-file-input").addEventListener("change", (event) => importBackupFile(event.target.files?.[0]));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkDateChange(); });
  window.setInterval(checkDateChange, 60000);
}

async function init() {
  await initializeState();
  bindEvents();
  renderAll();
  switchView("today", { scrollToEnd: true });
  registerServiceWorker();
  requestPersistentStorage();
}

init().catch(() => {
  const main = document.querySelector("#main-content");
  if (main) main.innerHTML = '<p class="empty-copy">暂时无法读取本机记录，请刷新页面再试一次。</p>';
});








