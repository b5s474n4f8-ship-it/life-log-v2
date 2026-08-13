const STORAGE_KEY = "life-log-calendar-v1";
const DB_NAME = "life-log-calendar-db";
const DB_VERSION = 1;
const DB_STORE = "state";
const DB_KEY = "main";
const BACKUP_FORMAT = "life-log-calendar-backup";
const BACKUP_VERSION = 3;
const STATE_VERSION = 2;
const ARTIFACT_LINEAGE = "life-log-v2-evolved";
const SYNC_SESSION_KEY = "life-log-cloud-session-v1";
const SYNC_CONFIG_RAW = window.LIFE_LOG_SYNC_CONFIG || {};
const SYNC_CONFIG = { workerUrl: String(SYNC_CONFIG_RAW.workerUrl || "").replace(/\/+$/, "") };
const SYNC_CONFIGURED = /^https:\/\//.test(SYNC_CONFIG.workerUrl);
const DEFAULT_FOCUS = ["faith", "sleep", "body", "care", "movement", "reading", "people", "completed", "dream"];
const QUICK_TRACKER_IDS = ["faith", "sleep", "body", "care", "movement", "reading", "people", "completed", "dream"];

const BUILT_IN_TRACKERS = [
  { id: "faith", name: "灵修", short: "灵", group: "人与精神", preset: "faith", mode: "occurrence", tone: "sun", builtIn: true },
  { id: "dream", name: "梦境", short: "梦", group: "人与精神", preset: "dream", mode: "occurrence", tone: "blue", builtIn: true },
  { id: "inner", name: "内在与能量", short: "内", group: "人与精神", preset: "generic", mode: "state", tone: "violet", builtIn: true },
  { id: "inspiration", name: "灵感", short: "感", group: "输入与创造", preset: "generic", mode: "occurrence", tone: "sun", builtIn: true },
  { id: "people", name: "社交", short: "社", group: "人与精神", preset: "people", mode: "occurrence", tone: "coral", builtIn: true },
  { id: "relationship", name: "关系", short: "系", group: "人与精神", preset: "generic", mode: "state", tone: "violet", builtIn: true },
  { id: "movement", name: "运动", short: "动", group: "身体与节律", preset: "movement", mode: "duration", tone: "mint", builtIn: true },
  { id: "completed", name: "完成", short: "成", group: "生活事件", preset: "completed", mode: "occurrence", tone: "blue", builtIn: true },
  { id: "sleep", name: "睡眠", short: "睡", group: "身体与节律", preset: "sleep", mode: "duration", tone: "blue", builtIn: true },
  { id: "body", name: "身体", short: "身", group: "身体与节律", preset: "body", mode: "state", tone: "coral", builtIn: true },
  { id: "cycle", name: "经期", short: "经", group: "身体与节律", preset: "generic", mode: "state", tone: "violet", builtIn: true },
  { id: "care", name: "庶务", short: "务", group: "身体与节律", preset: "care", mode: "occurrence", tone: "mint", builtIn: true },
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
let editingMemoId = null;
let activePrimingId = null;
let activeTraceNoteId = null;
let selectedTraceTrackers = new Set();
let traceDrafts = {};
let activeQuickTraceId = null;
let selectedQuickTrackerId = null;
let quickDraft = {};
let managerMonth = calendarMonth;
let managerIds = [];
let toastTimer = null;
let draftTimer = null;
let suppressCalendarClick = false;
const cloudSync = {
  configured: SYNC_CONFIGURED,
  session: null,
  status: SYNC_CONFIGURED ? "disconnected" : "unconfigured",
  error: "",
  timer: null,
  inFlight: null,
  pending: false
};
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

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

function dateInMonth(key, preferredDate = selectedCalendarDate) {
  const [year, month] = key.split("-").map(Number);
  const preferredDay = Math.max(1, Number(preferredDate?.slice(-2)) || 1);
  const lastDay = new Date(year, month, 0, 12).getDate();
  return `${key}-${String(Math.min(preferredDay, lastDay)).padStart(2, "0")}`;
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

function closeDialog(dialog) {
  if (!dialog?.open) return;
  const focused = document.activeElement;
  if (focused instanceof HTMLElement && dialog.contains(focused)) focused.blur();
  dialog.close();
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
    version: STATE_VERSION,
    notes: [],
    memos: [],
    primings: [],
    traces: [],
    trackers: BUILT_IN_TRACKERS.map((tracker) => ({ ...tracker })),
    monthPreferences: { [monthKey(todayKey())]: [...DEFAULT_FOCUS] },
    drafts: {},
    meta: {
      createdAt: now,
      updatedAt: now,
      lastBackupAt: null,
      lastImportAt: null,
      artifactLineage: ARTIFACT_LINEAGE
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
    version: STATE_VERSION,
    notes: Array.isArray(source.notes) ? source.notes : [],
    memos: Array.isArray(source.memos) ? source.memos : [],
    primings: Array.isArray(source.primings) ? source.primings : [],
    traces: Array.isArray(source.traces) ? source.traces : [],
    trackers,
    monthPreferences,
    drafts: source.drafts && typeof source.drafts === "object" ? source.drafts : {},
    meta: {
      createdAt: source.meta?.createdAt || source.seededAt || new Date().toISOString(),
      updatedAt: source.meta?.updatedAt || new Date().toISOString(),
      lastBackupAt: source.meta?.lastBackupAt || null,
      lastImportAt: source.meta?.lastImportAt || null,
      artifactLineage: source.meta?.artifactLineage || ARTIFACT_LINEAGE
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

function persistState(message = "已保存到本机", options = {}) {
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
  if (options.sync !== false) scheduleCloudSync(message.includes("草稿") ? 4500 : 900);
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
  return inherited.filter((id) => trackerById(id)).slice(0, 9);
}

function setMonthFocusIds(key, ids) {
  state.monthPreferences[key] = [...new Set(ids)].filter((id) => trackerById(id)).slice(0, 9);
  persistState();
}

function notesForDate(date) {
  return state.notes.filter((note) => note.date === date).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function memosForDate(date) {
  return state.memos.filter((memo) => memo.date === date).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function primingsForDate(date) {
  return state.primings.filter((priming) => priming.date === date).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function tracesForDate(date) {
  return state.traces.filter((trace) => trace.date === date).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function tracesForNote(noteId) {
  return state.traces.filter((trace) => trace.noteId === noteId);
}

function standaloneTracesForDate(date) {
  return tracesForDate(date).filter((trace) => !trace.noteId);
}

function quickTraceById(traceId) {
  return state.traces.find((trace) => trace.id === traceId && !trace.noteId);
}

function noteById(noteId) {
  return state.notes.find((note) => note.id === noteId);
}

function memoById(memoId) {
  return state.memos.find((memo) => memo.id === memoId);
}

function primingById(primingId) {
  return state.primings.find((priming) => priming.id === primingId);
}

function memoCompletionTrace(memo) {
  if (!memo) return null;
  return state.traces.find((trace) => trace.id === memo.completionTraceId || (trace.source === "memo" && trace.memoId === memo.id)) || null;
}

function renderFocusItems(target, month) {
  const trackers = getMonthFocusIds(month).map(trackerById).filter(Boolean);
  target.innerHTML = trackers.length
    ? trackers.map((tracker) => `<span class="${toneClass(tracker)}">${escapeHtml(tracker.name)}</span>`).join("")
    : "<span>暂时没有设定</span>";
}

function renderDailyMemo() {
  const memos = memosForDate(activeDate);
  $("#memo-list").innerHTML = memos.length
    ? memos.map((memo) => {
      const completed = memo.status === "completed";
      return `
        <div class="memo-row ${completed ? "completed" : ""}" data-memo-id="${escapeAttr(memo.id)}">
          <button class="memo-check" type="button" data-memo-action="toggle" aria-pressed="${completed}" aria-label="${completed ? "撤销完成" : "标记完成"}"><span aria-hidden="true">${completed ? "✓" : ""}</span></button>
          <button class="memo-copy" type="button" data-memo-action="edit">${escapeHtml(memo.text)}</button>
          ${completed ? "" : `<button class="memo-prime" type="button" data-memo-action="prime">预演</button>`}
          <button class="memo-remove" type="button" data-memo-action="delete" aria-label="删除这件事" title="删除">×</button>
        </div>`;
    }).join("")
    : `<p class="memo-empty">这里可以放今天要托住的小事。没有也很好。</p>`;
}

function renderPrimings() {
  const sessions = primingsForDate(activeDate);
  const space = $("#priming-space");
  space.hidden = !sessions.length;
  if (!sessions.length) {
    $("#priming-list").innerHTML = "";
    return;
  }
  $("#priming-list").innerHTML = sessions.map((priming) => {
    const memo = memoById(priming.memoId);
    const completed = memo?.status === "completed";
    const details = [
      priming.process ? `<p><strong>过程</strong>${escapeHtml(priming.process)}</p>` : "",
      priming.enough ? `<p><strong>边界</strong>${escapeHtml(priming.enough)}</p>` : "",
      priming.fallback ? `<p><strong>卡住时</strong>${escapeHtml(priming.fallback)}</p>` : ""
    ].filter(Boolean).join("");
    return `
      <article class="priming-card ${completed ? "completed" : ""}" data-priming-id="${escapeAttr(priming.id)}">
        <div class="priming-card-heading">
          <div><span>预演</span><h3>${escapeHtml(priming.target)}</h3></div>
          ${completed ? "<small>已完成</small>" : ""}
        </div>
        ${priming.firstStep ? `<div class="priming-next"><span>现在先做</span><strong>${escapeHtml(priming.firstStep)}</strong></div>` : ""}
        ${details ? `<details><summary>查看过程</summary><div class="priming-detail">${details}</div></details>` : ""}
        <div class="priming-actions">
          <button type="button" data-priming-action="edit">调整</button>
          ${memo && !completed ? `<button type="button" data-priming-action="complete">完成</button>` : ""}
        </div>
      </article>`;
  }).join("");
}

function renderStandaloneTrace(trace) {
  const tracker = trackerById(trace.trackerId);
  return `
    <article class="note-item stream-data" data-quick-trace="${escapeAttr(trace.id)}">
      <time class="note-time" datetime="${escapeAttr(trace.createdAt)}">${escapeHtml(trace.timeKnown === false ? "补录" : formatTime(trace.createdAt))}</time>
      <div class="note-body">
        <div class="stream-data-line ${toneClass(tracker)}">
          <span aria-hidden="true">${escapeHtml(tracker?.short || "记")}</span>
          <p>${escapeHtml(traceSummary(trace))}</p>
        </div>
        <div class="note-actions">
          <button type="button" data-stream-action="edit-trace">编辑</button>
        </div>
      </div>
    </article>`;
}

function renderTodayStream() {
  const items = [
    ...notesForDate(activeDate).map((note) => ({ kind: "note", value: note, moment: note.createdAt })),
    ...standaloneTracesForDate(activeDate).map((trace) => ({ kind: "trace", value: trace, moment: trace.createdAt }))
  ].sort((a, b) => new Date(a.moment) - new Date(b.moment));
  $("#note-count").textContent = `${items.length} 条痕迹`;
  $("#note-list").innerHTML = items.length
    ? items.map((item) => item.kind === "note" ? renderNote(item.value) : renderStandaloneTrace(item.value)).join("")
    : `<p class="empty-copy">这一天还是空白。<br />可以只留下一句话。</p>`;
}

function renderToday() {
  const today = todayKey();
  const isToday = activeDate === today;
  $("#today-weekday").textContent = `${isToday ? "今天" : "历史"} · ${new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(dateFromKey(activeDate))}`;
  $("#today-title").textContent = formatDay(activeDate);
  $("#return-today").hidden = isToday;
  $("#history-notice").hidden = isToday;
  renderDailyMemo();
  renderPrimings();
  renderTodayStream();

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

function animateCalendarElement(element, direction) {
  if (!element || reducedMotionQuery.matches || typeof element.animate !== "function") return;
  const offset = direction > 0 ? 18 : -18;
  element.animate(
    [
      { opacity: 0.62, transform: `translate3d(${offset}px, 0, 0)` },
      { opacity: 1, transform: "translate3d(0, 0, 0)" }
    ],
    { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
  );
}

function changeCalendarMonth(amount) {
  const nextMonth = shiftMonth(calendarMonth, amount);
  calendarMonth = nextMonth;
  selectedCalendarDate = dateInMonth(nextMonth);
  renderMonth();
  animateCalendarElement($("#calendar-grid"), amount);
  animateCalendarElement($("#selected-day-content"), amount);
}

function changeSelectedCalendarDate(amount) {
  const previousMonth = calendarMonth;
  selectedCalendarDate = addDays(selectedCalendarDate, amount);
  calendarMonth = monthKey(selectedCalendarDate);
  renderMonth();
  if (calendarMonth !== previousMonth) animateCalendarElement($("#calendar-grid"), amount);
  animateCalendarElement($("#selected-day-content"), amount);
}

function bindHorizontalSwipe(surface, onSwipe, options = {}) {
  if (!surface) return;
  const visual = options.visual || surface;
  let gesture = null;

  const reset = () => {
    if (gesture && surface.hasPointerCapture?.(gesture.pointerId)) {
      try { surface.releasePointerCapture(gesture.pointerId); } catch {}
    }
    visual.classList.remove("is-swiping");
    visual.style.removeProperty("--swipe-offset");
    gesture = null;
  };

  surface.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (options.ignoreInteractive && event.target.closest("button, a, input, textarea, select, summary")) return;
    gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      startedAt: performance.now(),
      axis: null
    };
  });

  surface.addEventListener("pointermove", (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.axis) {
      if (Math.hypot(dx, dy) < 8) return;
      gesture.axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? "horizontal" : "vertical";
      if (gesture.axis === "vertical") {
        reset();
        return;
      }
      try { surface.setPointerCapture(event.pointerId); } catch {}
    }
    if (gesture.axis !== "horizontal") return;
    event.preventDefault();
    visual.classList.add("is-swiping");
    const offset = Math.max(-34, Math.min(34, dx * 0.22));
    visual.style.setProperty("--swipe-offset", `${offset}px`);
  });

  const finish = (event, cancelled = false) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const dx = (Number.isFinite(event.clientX) ? event.clientX : gesture.lastX) - gesture.startX;
    const duration = Math.max(1, performance.now() - gesture.startedAt);
    const velocity = Math.abs(dx) / duration;
    const shouldCommit = !cancelled
      && gesture.axis === "horizontal"
      && (Math.abs(dx) >= 52 || (Math.abs(dx) >= 24 && velocity >= 0.42));
    reset();
    if (!shouldCommit) return;
    options.onCommit?.();
    onSwipe(dx < 0 ? 1 : -1);
  };

  surface.addEventListener("pointerup", (event) => finish(event));
  surface.addEventListener("pointercancel", (event) => finish(event, true));
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
  const memos = memosForDate(selectedCalendarDate);
  const primings = primingsForDate(selectedCalendarDate);
  if (!traces.length && !notes.length && !memos.length && !primings.length) {
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
  const memoRows = memos.length ? `
    <div class="day-originals">
      <strong>Daily Memo</strong>
      ${memos.map((memo) => `<p>${memo.status === "completed" ? "✓" : "○"}　${escapeHtml(memo.text)}</p>`).join("")}
    </div>` : "";
  const primingRows = primings.length ? `
    <div class="day-originals">
      <strong>当天预演</strong>
      ${primings.map((priming) => `<p>${escapeHtml(priming.target)}${priming.firstStep ? `；第一步：${escapeHtml(priming.firstStep)}` : ""}</p>`).join("")}
    </div>` : "";
  const originals = notes.length ? `
    <div class="day-originals">
      <strong>当天原文</strong>
      ${notes.map((note) => `<p><time>${escapeHtml(noteTimeLabel(note))}</time>　${escapeHtml(note.text)}</p>`).join("")}
    </div>` : "";
  $("#selected-day-content").innerHTML = traceRows + memoRows + primingRows + originals;
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
  if (tracker.preset === "faith") {
    const practices = countValues(traces.map((trace) => trace.fields?.practice));
    return `${days} 天 · ${count} 次${practices.length ? ` · ${practices.join("、")}` : ""}`;
  }
  if (tracker.preset === "care") {
    const activities = countValues(traces.map((trace) => trace.fields?.activity));
    return `${days} 天 · ${count} 次${activities.length ? ` · ${activities.join("、")}` : ""}`;
  }
  if (tracker.preset === "completed") {
    const details = traces.map((trace) => trace.fields?.detail).filter(Boolean);
    return `${count} 项${details.length ? ` · ${details.slice(0, 4).join("、")}${details.length > 4 ? "等" : ""}` : ""}`;
  }
  if (tracker.preset === "dream") {
    const clarity = countValues(traces.map((trace) => trace.fields?.clarity));
    return `记得 ${count} 次${clarity.length ? ` · ${clarity.join("、")}` : ""}`;
  }  if (tracker.preset === "movement") {
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
    const recovery = countValues(traces.map((trace) => trace.fields?.recovery));
    const naps = traces.map((trace) => numeric(trace.fields?.napMinutes)).filter(Boolean);
    const napTotal = naps.reduce((sum, value) => sum + value, 0);
    return `记录 ${days} 天${average ? ` · 平均 ${formatNumber(average)} 小时` : ""}${quality.length ? ` · 睡眠 ${quality.join("、")}` : ""}${recovery.length ? ` · 恢复感 ${recovery.join("、")}` : ""}${naps.length ? ` · 补觉 ${naps.length} 次 / ${formatNumber(napTotal, 0)} 分钟` : ""}`;
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
  if (tracker.preset === "faith") return fields.detail ? `${fields.practice || "灵修"} · ${fields.detail}` : (fields.practice || "灵修");
  if (tracker.preset === "care") return fields.detail ? `${fields.activity || "庶务"} · ${fields.detail}` : (fields.activity || "庶务");
  if (tracker.preset === "completed") return fields.detail ? `完成 · ${fields.detail}` : "完成一件事";
  if (tracker.preset === "dream") return fields.detail ? `梦 · ${fields.detail}` : "记得梦";  if (tracker.preset === "movement") {
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
  if (tracker?.preset === "sleep" && fields.bedtimeActivity) parts.push(`睡前：${fields.bedtimeActivity}`);
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
  if (tracker.preset === "faith") {
    content = selectField("实践", "practice", fields.practice || "", ["", "祷告", "读经", "默想", "敬拜", "阅读属灵读物", "其他"])
      + inputField("触动或一句记录", "detail", fields.detail, { placeholder: "可以留空", full: true });
  } else if (tracker.preset === "care") {
    content = selectField("项目", "activity", fields.activity || "", ["", "洗澡", "洗衣", "排便", "自我按摩", "其他"])
      + inputField("补充", "detail", fields.detail, { placeholder: "需要时再写", full: true });
  } else if (tracker.preset === "movement") {
    content = inputField("做了什么", "activity", fields.activity, { placeholder: "跑步机上坡走、八段锦、拉伸……", full: true })
      + inputField("分钟", "durationMin", fields.durationMin, { type: "number", inputmode: "decimal", min: 0, step: 1 })
      + inputField("公里数", "distanceKm", fields.distanceKm, { type: "number", inputmode: "decimal", min: 0, step: 0.1 });
  } else if (tracker.preset === "completed") {
    content = inputField("完成了什么", "detail", fields.detail, { placeholder: "例如：完成文件打包", full: true });
  } else if (tracker.preset === "dream") {
    content = inputField("留下一句话", "detail", fields.detail, { placeholder: "只写还记得的部分", full: true })
      + selectField("清晰度", "clarity", fields.clarity || "", ["", "清晰", "模糊"]);
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
      + selectField("恢复感", "recovery", fields.recovery || "", ["", "好", "一般", "差"])
      + inputField("补觉（分钟）", "napMinutes", fields.napMinutes, { type: "number", inputmode: "decimal", min: 0, step: 1 })
      + inputField("睡前活动", "bedtimeActivity", fields.bedtimeActivity, { placeholder: "例如：刷手机、阅读、深聊", full: true })
      + inputField("影响因素", "factors", fields.factors, { placeholder: "鸟叫、早醒、入睡困难、环境噪音……", full: true });
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
  closeDialog($("#trace-dialog"));
  renderAll();
  showToast(selectedTraceTrackers.size ? "月历痕迹已更新。" : "原文保留，没有加入月历。");
}

function removeTracesForActiveNote() {
  state.traces = state.traces.filter((trace) => trace.noteId !== activeTraceNoteId);
  persistState();
  closeDialog($("#trace-dialog"));
  renderAll();
  showToast("已移出月历，原文仍然保留。");
}

function quickChoiceButton(id) {
  const tracker = trackerById(id);
  if (!tracker) return "";
  const pressed = selectedQuickTrackerId === id;
  return `<button class="tracker-choice ${toneClass(tracker)}" type="button" data-quick-tracker="${escapeAttr(id)}" aria-pressed="${pressed}">${escapeHtml(tracker.name)}</button>`;
}

function captureQuickDraft() {
  const fieldset = $("[data-tracker-fields]", $("#quick-fields"));
  if (!fieldset) return;
  const fields = {};
  $$('[data-field]', fieldset).forEach((input) => { fields[input.dataset.field] = input.value; });
  quickDraft = fields;
}

function renderQuickFields() {
  const target = $("#quick-fields");
  const tracker = trackerById(selectedQuickTrackerId);
  target.innerHTML = tracker
    ? traceFieldset(tracker, quickDraft)
    : `<p class="quick-prompt">先选一类。只填今天真正想留下的部分。</p>`;
}

function renderQuickChoices() {
  const primary = QUICK_TRACKER_IDS.map(trackerById).filter(Boolean);
  const remaining = state.trackers.filter((tracker) => !QUICK_TRACKER_IDS.includes(tracker.id));
  $("#quick-primary-choices").innerHTML = primary.map((tracker) => quickChoiceButton(tracker.id)).join("");
  $("#quick-more-choices").innerHTML = remaining.map((tracker) => quickChoiceButton(tracker.id)).join("");
  renderQuickFields();
}

function openQuickDialog(traceId = null) {
  const existing = traceId ? quickTraceById(traceId) : null;
  activeQuickTraceId = existing?.id || null;
  selectedQuickTrackerId = existing?.trackerId || null;
  quickDraft = { ...(existing?.fields || {}) };
  $("#quick-dialog-title").textContent = existing ? "调整这笔数据" : "记一笔数据";
  $("#delete-quick-trace").hidden = !existing;
  const needsMore = Boolean(existing && !QUICK_TRACKER_IDS.includes(existing.trackerId));
  $("#toggle-quick-more").setAttribute("aria-expanded", String(needsMore));
  $("#quick-more-choices").hidden = !needsMore;
  renderQuickChoices();
  $("#quick-dialog").showModal();
}

function quickFieldsValid(tracker, fields) {
  const hasAny = Object.values(fields).some((value) => String(value || "").trim());
  if (!tracker) return false;
  if (tracker.preset === "completed") return Boolean(String(fields.detail || "").trim());
  if (tracker.preset === "movement" || tracker.preset === "sleep" || tracker.preset === "faith" || tracker.preset === "care") return hasAny;
  if (tracker.preset === "body") return Boolean(String(fields.signal || "").trim());
  if (tracker.preset === "reading") return Boolean(String(fields.title || fields.progressValue || "").trim());
  if (tracker.preset === "people") return Boolean(String(fields.name || fields.context || "").trim());
  if (tracker.preset === "dream") return hasAny;
  return hasAny;
}

function saveQuickTrace(event) {
  event.preventDefault();
  captureQuickDraft();
  const tracker = trackerById(selectedQuickTrackerId);
  if (!tracker) {
    showToast("先选择要记下的类型。", true);
    return;
  }
  if (!quickFieldsValid(tracker, quickDraft)) {
    showToast("留下一点内容或数值再保存。", true);
    return;
  }
  const now = new Date().toISOString();
  let existing = activeQuickTraceId ? quickTraceById(activeQuickTraceId) : null;
  if (!existing && selectedQuickTrackerId === "sleep") {
    existing = standaloneTracesForDate(activeDate).find((trace) => trace.trackerId === "sleep") || null;
  }
  const trace = {
    id: existing?.id || makeId("trace"),
    noteId: null,
    memoId: existing?.memoId || null,
    source: existing?.source || "quick",
    date: existing?.date || activeDate,
    trackerId: selectedQuickTrackerId,
    fields: { ...quickDraft },
    timeKnown: existing?.timeKnown ?? (activeDate === todayKey()),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (existing) state.traces = state.traces.map((item) => item.id === existing.id ? trace : item);
  else state.traces.push(trace);
  persistState();
  closeDialog($("#quick-dialog"));
  renderAll();
  showToast(existing ? "这笔数据已更新。" : "已记下，月历也会更新。");
}

function deleteQuickTrace() {
  const trace = activeQuickTraceId ? quickTraceById(activeQuickTraceId) : null;
  if (!trace || !window.confirm("删除这笔数据？原始文字记录不会受影响。")) return;
  if (trace.source === "memo" && trace.memoId) {
    closeDialog($("#quick-dialog"));
    setMemoCompleted(trace.memoId, false);
    return;
  }
  state.traces = state.traces.filter((item) => item.id !== trace.id);
  persistState();
  closeDialog($("#quick-dialog"));
  renderAll();
  showToast("这笔数据已删除。");
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

function resetMemoComposer() {
  editingMemoId = null;
  $("#memo-input").value = "";
  $("#save-memo").textContent = "＋";
  $("#save-memo").setAttribute("aria-label", "加入 Daily Memo");
  $("#cancel-memo-edit").hidden = true;
}

function saveMemo(event) {
  event.preventDefault();
  const text = $("#memo-input").value.trim();
  if (!text) {
    showToast("先记下一件事。", true);
    $("#memo-input").focus();
    return;
  }
  const now = new Date().toISOString();
  const existing = editingMemoId ? memoById(editingMemoId) : null;
  if (existing) {
    existing.text = text;
    existing.updatedAt = now;
    const completion = memoCompletionTrace(existing);
    if (completion) {
      completion.fields = { ...(completion.fields || {}), detail: text };
      completion.updatedAt = now;
    }
    state.primings.filter((priming) => priming.memoId === existing.id).forEach((priming) => {
      priming.target = text;
      priming.updatedAt = now;
    });
  } else {
    state.memos.push({
      id: makeId("memo"),
      date: activeDate,
      text,
      status: "open",
      completionTraceId: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now
    });
  }
  resetMemoComposer();
  persistState();
  renderAll();
  showToast(existing ? "Daily Memo 已更新。" : "已经放进今天。");
}

function editMemo(memoId) {
  const memo = memoById(memoId);
  if (!memo) return;
  editingMemoId = memo.id;
  $("#memo-input").value = memo.text;
  $("#save-memo").textContent = "✓";
  $("#save-memo").setAttribute("aria-label", "更新 Daily Memo");
  $("#cancel-memo-edit").hidden = false;
  $("#memo-input").focus();
}

function setMemoCompleted(memoId, completed) {
  const memo = memoById(memoId);
  if (!memo) return;
  const now = new Date().toISOString();
  memo.status = completed ? "completed" : "open";
  memo.completedAt = completed ? now : null;
  memo.updatedAt = now;
  const existing = memoCompletionTrace(memo);
  if (completed) {
    const trace = {
      id: existing?.id || makeId("trace"),
      noteId: null,
      memoId: memo.id,
      source: "memo",
      date: memo.date,
      trackerId: "completed",
      fields: { detail: memo.text },
      timeKnown: memo.date === todayKey(),
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    if (existing) state.traces = state.traces.map((item) => item.id === existing.id ? trace : item);
    else state.traces.push(trace);
    memo.completionTraceId = trace.id;
  } else {
    state.traces = state.traces.filter((trace) => trace.id !== existing?.id && !(trace.source === "memo" && trace.memoId === memo.id));
    memo.completionTraceId = null;
  }
  persistState();
  renderAll();
  showToast(completed ? "已记为完成，月历也会更新。" : "已撤销完成记录。");
}

function deleteMemo(memoId) {
  const memo = memoById(memoId);
  if (!memo || !window.confirm("删除这条 Daily Memo？相关的完成痕迹也会删除。")) return;
  const completion = memoCompletionTrace(memo);
  state.memos = state.memos.filter((item) => item.id !== memo.id);
  if (completion) state.traces = state.traces.filter((trace) => trace.id !== completion.id);
  state.primings.filter((priming) => priming.memoId === memo.id).forEach((priming) => {
    priming.memoId = null;
    priming.updatedAt = new Date().toISOString();
  });
  if (editingMemoId === memo.id) resetMemoComposer();
  persistState();
  renderAll();
  showToast("这条 Memo 已删除。");
}

function populatePrimingMemoOptions(selectedMemoId = "") {
  const memos = memosForDate(activeDate).filter((memo) => memo.status !== "completed" || memo.id === selectedMemoId);
  $("#priming-memo-select").innerHTML = [
    '<option value="">不关联 Daily Memo</option>',
    ...memos.map((memo) => `<option value="${escapeAttr(memo.id)}" ${memo.id === selectedMemoId ? "selected" : ""}>${escapeHtml(memo.text)}</option>`)
  ].join("");
}

function openPrimingDialog(memoId = null, primingId = null) {
  const priming = primingId ? primingById(primingId) : null;
  const memo = memoById(priming?.memoId || memoId);
  activePrimingId = priming?.id || null;
  populatePrimingMemoOptions(memo?.id || "");
  $("#priming-dialog-title").textContent = priming ? "调整行动线" : "预演一下";
  $("#priming-target").value = priming?.target || memo?.text || "";
  $("#priming-process").value = priming?.process || "";
  $("#priming-first-step").value = priming?.firstStep || "";
  $("#priming-enough").value = priming?.enough || "";
  $("#priming-fallback").value = priming?.fallback || "";
  $("#delete-priming").hidden = !priming;
  $("#priming-dialog").showModal();
  requestAnimationFrame(() => {
    const target = memo ? $("#priming-process") : $("#priming-target");
    target.focus();
  });
}

function savePriming(event) {
  event.preventDefault();
  const memoId = $("#priming-memo-select").value || null;
  const target = $("#priming-target").value.trim();
  const process = $("#priming-process").value.trim();
  const firstStep = $("#priming-first-step").value.trim();
  const enough = $("#priming-enough").value.trim();
  const fallback = $("#priming-fallback").value.trim();
  if (!target) {
    showToast("先写下这次要预演的事情。", true);
    $("#priming-target").focus();
    return;
  }
  if (!process && !firstStep) {
    showToast("说说过程，或留下一步可以开始的动作。", true);
    $("#priming-process").focus();
    return;
  }
  const now = new Date().toISOString();
  const existing = activePrimingId ? primingById(activePrimingId) : null;
  const value = {
    id: existing?.id || makeId("priming"),
    date: existing?.date || activeDate,
    memoId,
    target,
    process,
    firstStep,
    enough,
    fallback,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (existing) state.primings = state.primings.map((item) => item.id === existing.id ? value : item);
  else state.primings.push(value);
  persistState();
  closeDialog($("#priming-dialog"));
  renderAll();
  showToast(existing ? "行动线已更新。" : "行动线已经留下。");
}

function deletePriming() {
  const priming = activePrimingId ? primingById(activePrimingId) : null;
  if (!priming || !window.confirm("删除这次预演？Daily Memo 和原始记录不会受影响。")) return;
  state.primings = state.primings.filter((item) => item.id !== priming.id);
  persistState();
  closeDialog($("#priming-dialog"));
  renderAll();
  showToast("这次预演已删除。");
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
  const lines = [`# Life Log · ${formatMonth(key)}`, "", "> 基于你主动记下的数据。空白表示没有记录，不代表没有发生。", "", "## 本月留意", ""];
  const focusNames = getMonthFocusIds(key).map((id) => trackerById(id)?.name).filter(Boolean);
  lines.push(focusNames.length ? focusNames.join(" · ") : "未设定", "", "## 按日期", "");
  const dates = [...new Set([
    ...state.notes.filter((note) => monthKey(note.date) === key).map((note) => note.date),
    ...state.memos.filter((memo) => monthKey(memo.date) === key).map((memo) => memo.date),
    ...state.primings.filter((priming) => monthKey(priming.date) === key).map((priming) => priming.date),
    ...state.traces.filter((trace) => monthKey(trace.date) === key).map((trace) => trace.date)
  ])].sort();
  if (!dates.length) lines.push("这个月还没有记录。", "");
  dates.forEach((date) => {
    lines.push(`### ${formatDay(date, true)}`, "");
    memosForDate(date).forEach((memo) => lines.push(`- [${memo.status === "completed" ? "x" : " "}] Daily Memo · ${memo.text.replace(/\n/g, " ")}`));
    primingsForDate(date).forEach((priming) => {
      lines.push(`- 预演 · ${priming.target.replace(/\n/g, " ")}`);
      if (priming.process) lines.push(`  - 过程：${priming.process.replace(/\n/g, " ")}`);
      if (priming.firstStep) lines.push(`  - 第一步：${priming.firstStep.replace(/\n/g, " ")}`);
      if (priming.enough) lines.push(`  - 完成边界：${priming.enough.replace(/\n/g, " ")}`);
      if (priming.fallback) lines.push(`  - 卡住时：${priming.fallback.replace(/\n/g, " ")}`);
    });
    notesForDate(date).forEach((note) => {
      lines.push(`- ${noteTimeLabel(note)} ${note.text.replace(/\n/g, " ")}`);
      tracesForNote(note.id).forEach((trace) => lines.push(`  - ${trackerById(trace.trackerId)?.name || "记录"}：${traceDetail(trace)}`));
    });
    standaloneTracesForDate(date).filter((trace) => trace.source !== "memo").forEach((trace) => lines.push(`- 数据 · ${trackerById(trace.trackerId)?.name || "记录"}：${traceDetail(trace)}`));
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
  const exportedAt = new Date().toISOString();
  const allItems = [...state.notes, ...state.memos, ...state.primings, ...state.traces];
  const latestUpdatedAt = allItems.map((item) => item.updatedAt || item.createdAt).filter(Boolean).sort().at(-1) || null;
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    context: {
      artifactId: "life-log",
      lineage: ARTIFACT_LINEAGE,
      schemaVersion: STATE_VERSION,
      latestUpdatedAt,
      recordCounts: {
        notes: state.notes.length,
        memos: state.memos.length,
        primings: state.primings.length,
        traces: state.traces.length
      },
      handoff: "整合这份 Life Log"
    },
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

function hasMeaningfulState(value = state) {
  return ["notes", "memos", "primings", "traces"].some((key) => Array.isArray(value?.[key]) && value[key].length)
    || Object.values(value?.drafts || {}).some((draft) => String(draft || "").trim());
}

function syncTokenFromValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const token = String(new URLSearchParams(url.hash.slice(1)).get("sync") || "").trim();
    if (token.length >= 32) return token;
  } catch {}
  return raw.length >= 32 ? raw : "";
}

function tokenFromActivationLink() {
  if (!cloudSync.configured || !location.hash.startsWith("#")) return "";
  const token = syncTokenFromValue(location.href);
  if (!token) return "";
  history.replaceState(null, "", location.pathname + location.search);
  return token;
}

function loadCloudSession() {
  if (!cloudSync.configured) return null;
  try {
    const token = tokenFromActivationLink();
    const saved = token ? { token, lastSyncedAt: null } : JSON.parse(localStorage.getItem(SYNC_SESSION_KEY) || "null");
    if (!saved?.token) return null;
    cloudSync.session = saved;
    localStorage.setItem(SYNC_SESSION_KEY, JSON.stringify(saved));
    cloudSync.status = navigator.onLine ? "connected" : "offline";
    return saved;
  } catch {
    localStorage.removeItem(SYNC_SESSION_KEY);
    return null;
  }
}

function storeCloudSession(token, previous = cloudSync.session || {}) {
  const session = { token, lastSyncedAt: previous.lastSyncedAt || null };
  if (session.token.length < 32) throw new Error("同步口令无效");
  cloudSync.session = session;
  localStorage.setItem(SYNC_SESSION_KEY, JSON.stringify(session));
  return session;
}

function clearCloudSession() {
  cloudSync.session = null;
  cloudSync.pending = false;
  clearTimeout(cloudSync.timer);
  localStorage.removeItem(SYNC_SESSION_KEY);
}

async function parseCloudResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function cloudDataRequest(path, options = {}) {
  if (!cloudSync.configured || !cloudSync.session?.token) throw new Error("尚未连接云端");
  const response = await fetch(SYNC_CONFIG.workerUrl + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + cloudSync.session.token,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    cache: "no-store"
  });
  const payload = await parseCloudResponse(response);
  if (!response.ok) {
    const error = new Error(payload?.message || "云端暂时不可用");
    error.status = response.status;
    throw error;
  }
  return payload;
}

function setCloudStatus(status, error = "") {
  cloudSync.status = status;
  cloudSync.error = error;
  renderCloudStatus();
}

function renderCloudStatus() {
  const container = $("#cloud-status");
  if (!container) return;
  const connected = Boolean(cloudSync.session);
  const lastSynced = displayDateTime(cloudSync.session?.lastSyncedAt);
  container.className = "cloud-status is-" + cloudSync.status;
  $("#header-sync-mark").className = "header-sync-mark is-" + cloudSync.status;
  $("#sync-connect-form").hidden = !cloudSync.configured || connected;
  $("#sync-account").hidden = !connected;
  $("#sync-now").hidden = !connected || cloudSync.status === "syncing";

  const states = {
    unconfigured: ["自动同步尚未启用", "当前仍会可靠地保存在这台手机上。"],
    disconnected: ["连接一次，之后自动同步", "输入私人同步口令，或打开一次激活链接。"],
    connecting: ["正在连接", "请稍候，本机记录不会受到影响。"],
    connected: ["云端已连接", lastSynced ? "上次同步：" + lastSynced : "准备同步现有记录。"],
    syncing: ["正在同步", "你可以继续记录，不需要停在这里。"],
    waiting: ["已保存本机，等待同步", navigator.onLine ? "稍后会自动重试。" : "恢复网络后会自动补传。"],
    offline: ["当前离线，记录已保存在本机", "恢复网络后会自动补传。"],
    synced: ["已自动同步", lastSynced ? "最近同步：" + lastSynced : "云端已有最新记录。"],
    error: ["同步暂时未完成", cloudSync.error || "记录已在本机保存，稍后会自动重试。"]
  };
  const [title, copy] = states[cloudSync.status] || states.disconnected;
  $("#cloud-status-title").textContent = title;
  $("#cloud-status-copy").textContent = copy;

  const saveState = $("#save-state");
  if (saveState && connected) {
    if (cloudSync.status === "synced") saveState.textContent = "已保存 · 已同步";
    if (["waiting", "offline", "error"].includes(cloudSync.status)) saveState.textContent = "已保存本机 · 等待同步";
    if (cloudSync.status === "syncing") saveState.textContent = "已保存本机 · 正在同步";
  }
}

async function fetchCloudStateRow() {
  return cloudDataRequest("/state", { method: "GET" });
}

async function pushCloudSnapshot(snapshot, keepalive = false) {
  await cloudDataRequest("/state", {
    method: "PUT",
    keepalive,
    body: JSON.stringify({
      state: snapshot,
      schemaVersion: STATE_VERSION,
      deviceUpdatedAt: snapshot?.meta?.updatedAt || new Date().toISOString()
    })
  });
  cloudSync.session.lastSyncedAt = new Date().toISOString();
  localStorage.setItem(SYNC_SESSION_KEY, JSON.stringify(cloudSync.session));
}

async function replaceLocalStateFromCloud(remoteState) {
  state = normalizeState(remoteState);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
  storageWriteQueue = storageWriteQueue.then(() => writeStateToDatabase(state)).catch(() => {});
  await storageWriteQueue;
  editingNoteId = null;
  editingMemoId = null;
  resetComposer();
  resetMemoComposer();
  renderAll();
}

async function reconcileCloudState() {
  if (!cloudSync.configured || !cloudSync.session) return;
  if (!navigator.onLine) {
    cloudSync.pending = true;
    setCloudStatus("offline");
    return;
  }
  setCloudStatus("syncing");
  try {
    const remote = await fetchCloudStateRow();
    const localMeaningful = hasMeaningfulState(state);
    if (!remote?.state) {
      if (localMeaningful) await pushCloudSnapshot(JSON.parse(JSON.stringify(state)));
    } else {
      const remoteMeaningful = hasMeaningfulState(remote.state);
      const localUpdated = Date.parse(state.meta?.updatedAt || 0) || 0;
      const remoteUpdated = Date.parse(remote.deviceUpdatedAt || remote.state?.meta?.updatedAt || 0) || 0;
      if (!localMeaningful && remoteMeaningful) {
        await replaceLocalStateFromCloud(remote.state);
        cloudSync.session.lastSyncedAt = new Date().toISOString();
        localStorage.setItem(SYNC_SESSION_KEY, JSON.stringify(cloudSync.session));
      } else if (localMeaningful && !remoteMeaningful) {
        await pushCloudSnapshot(JSON.parse(JSON.stringify(state)));
      } else if (localMeaningful && remoteMeaningful && remoteUpdated > localUpdated) {
        await replaceLocalStateFromCloud(remote.state);
        cloudSync.session.lastSyncedAt = new Date().toISOString();
        localStorage.setItem(SYNC_SESSION_KEY, JSON.stringify(cloudSync.session));
      } else if (localMeaningful && remoteMeaningful && localUpdated > remoteUpdated) {
        await pushCloudSnapshot(JSON.parse(JSON.stringify(state)));
      } else {
        cloudSync.session.lastSyncedAt = new Date().toISOString();
        localStorage.setItem(SYNC_SESSION_KEY, JSON.stringify(cloudSync.session));
      }
    }
    cloudSync.pending = false;
    setCloudStatus("synced");
  } catch (error) {
    if (error?.status === 401) clearCloudSession();
    cloudSync.pending = Boolean(cloudSync.session);
    if (!navigator.onLine) setCloudStatus("offline");
    else if (!cloudSync.session) setCloudStatus("disconnected");
    else setCloudStatus("error", "记录已在本机保存，稍后会自动重试。");
  }
}

function scheduleCloudSync(delay = 900) {
  if (!cloudSync.configured || !cloudSync.session) {
    renderCloudStatus();
    return;
  }
  cloudSync.pending = true;
  clearTimeout(cloudSync.timer);
  if (!navigator.onLine) {
    setCloudStatus("offline");
    return;
  }
  setCloudStatus("waiting");
  cloudSync.timer = window.setTimeout(() => flushCloudSync(), delay);
}

async function flushCloudSync(keepalive = false) {
  if (!cloudSync.configured || !cloudSync.session || !cloudSync.pending) return;
  if (!navigator.onLine) {
    setCloudStatus("offline");
    return;
  }
  if (cloudSync.inFlight) return cloudSync.inFlight;
  const snapshot = JSON.parse(JSON.stringify(state));
  const targetUpdatedAt = snapshot.meta?.updatedAt;
  cloudSync.pending = false;
  setCloudStatus("syncing");
  cloudSync.inFlight = pushCloudSnapshot(snapshot, keepalive)
    .then(() => {
      setCloudStatus("synced");
      if (state.meta?.updatedAt !== targetUpdatedAt) scheduleCloudSync(500);
    })
    .catch((error) => {
      if (error?.status === 401) clearCloudSession();
      cloudSync.pending = Boolean(cloudSync.session);
      setCloudStatus(cloudSync.session ? (navigator.onLine ? "error" : "offline") : "disconnected", "记录已在本机保存，稍后会自动重试。");
    })
    .finally(() => {
      cloudSync.inFlight = null;
    });
  return cloudSync.inFlight;
}

async function connectCloudAccount(event) {
  event.preventDefault();
  const token = syncTokenFromValue($("#sync-token").value);
  if (!token) {
    $("#sync-form-note").textContent = "请粘贴完整的激活链接，或私人同步口令。";
    return;
  }
  setCloudStatus("connecting");
  $("#sync-form-note").textContent = "正在连接……";
  try {
    storeCloudSession(token);
    await reconcileCloudState();
    if (!cloudSync.session) throw new Error("同步口令不正确");
    $("#sync-token").value = "";
    $("#sync-form-note").textContent = "链接中的口令只保存在这台手机，不会写入公开网页。";
    showToast("已经连接。以后会自动同步。");
  } catch {
    clearCloudSession();
    setCloudStatus("disconnected");
    $("#sync-form-note").textContent = "没有连接成功，请检查同步口令。";
  }
}

function disconnectCloudAccount() {
  if (!window.confirm("断开后，这台手机会停止同步；本机和云端已有记录都不会删除。")) return;
  clearCloudSession();
  setCloudStatus(cloudSync.configured ? "disconnected" : "unconfigured");
  showToast("这台设备已断开，记录仍保存在本机。");
}

async function initializeCloudSync() {
  loadCloudSession();
  renderCloudStatus();
  if (cloudSync.session) await reconcileCloudState();
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
    memos: mergeItems(local.memos, imported.memos),
    primings: mergeItems(local.primings, imported.primings),
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
  merged.traces = merged.traces.filter((trace) => trackerIds.has(trace.trackerId) && (trace.noteId ? noteIds.has(trace.noteId) : true));
  return merged;
}

async function importBackupFile(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (parsed?.format !== BACKUP_FORMAT || ![1, 2, 3].includes(parsed?.version) || !parsed?.data) {
      throw new Error("无法识别这个备份文件。");
    }
    const incomingNotes = Array.isArray(parsed.data.notes) ? parsed.data.notes.length : 0;
    const incomingMemos = Array.isArray(parsed.data.memos) ? parsed.data.memos.length : 0;
    state = mergeImportedState(state, parsed.data);
    persistState("导入后已保存");
    await storageWriteQueue;
    renderAll();
    renderBackupStatus();
    closeDialog($("#backup-dialog"));
    showToast(`已合并 ${incomingNotes} 条原始记录${incomingMemos ? `和 ${incomingMemos} 条 Memo` : ""}。`);
  } catch (error) {
    showToast(error?.message || "备份导入失败。", true);
  } finally {
    $("#backup-file-input").value = "";
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const register = () => navigator.serviceWorker.register("./sw.js?v=20260813-v221-recovery").catch(() => {});
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

function checkDateChange() {
  const current = todayKey();
  if (current === lastToday) return;
  const wasOnToday = activeDate === lastToday;
  lastToday = current;
  if (wasOnToday) {
    activeDate = current;
    resetComposer();
    resetMemoComposer();
  }
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
    resetMemoComposer();
    switchView("today", { scrollToEnd: true });
  });
  $("#return-today").addEventListener("click", () => { activeDate = todayKey(); resetComposer(); resetMemoComposer(); switchView("today", { scrollToEnd: true }); });
  $("#history-return").addEventListener("click", () => { activeDate = todayKey(); resetComposer(); resetMemoComposer(); switchView("today", { scrollToEnd: true }); });
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
  $("#memo-form").addEventListener("submit", saveMemo);
  $("#cancel-memo-edit").addEventListener("click", resetMemoComposer);
  $("#memo-list").addEventListener("click", (event) => {
    const row = event.target.closest("[data-memo-id]");
    const action = event.target.closest("[data-memo-action]")?.dataset.memoAction;
    if (!row || !action) return;
    const memo = memoById(row.dataset.memoId);
    if (!memo) return;
    if (action === "toggle") setMemoCompleted(memo.id, memo.status !== "completed");
    if (action === "edit") editMemo(memo.id);
    if (action === "prime") openPrimingDialog(memo.id);
    if (action === "delete") deleteMemo(memo.id);
  });
  $("#open-day-priming").addEventListener("click", () => openPrimingDialog());
  $("#priming-list").addEventListener("click", (event) => {
    const card = event.target.closest("[data-priming-id]");
    const action = event.target.closest("[data-priming-action]")?.dataset.primingAction;
    if (!card || !action) return;
    const priming = primingById(card.dataset.primingId);
    if (!priming) return;
    if (action === "edit") openPrimingDialog(priming.memoId, priming.id);
    if (action === "complete" && priming.memoId) setMemoCompleted(priming.memoId, true);
  });
  $("#priming-form").addEventListener("submit", savePriming);
  $("#close-priming-dialog").addEventListener("click", () => closeDialog($("#priming-dialog")));
  $("#delete-priming").addEventListener("click", deletePriming);
  $("#priming-memo-select").addEventListener("change", (event) => {
    const memo = memoById(event.target.value);
    if (memo) $("#priming-target").value = memo.text;
  });
  $("#open-quick-log").addEventListener("click", () => openQuickDialog());
  $("#quick-dialog").addEventListener("click", (event) => {
    const choice = event.target.closest("[data-quick-tracker]");
    if (!choice) return;
    if (selectedQuickTrackerId === choice.dataset.quickTracker) return;
    selectedQuickTrackerId = choice.dataset.quickTracker;
    quickDraft = {};
    renderQuickChoices();
  });
  $("#quick-form").addEventListener("submit", saveQuickTrace);
  $("#close-quick-dialog").addEventListener("click", () => closeDialog($("#quick-dialog")));
  $("#delete-quick-trace").addEventListener("click", deleteQuickTrace);
  $("#toggle-quick-more").addEventListener("click", () => {
    const expanded = $("#toggle-quick-more").getAttribute("aria-expanded") === "true";
    $("#toggle-quick-more").setAttribute("aria-expanded", String(!expanded));
    $("#quick-more-choices").hidden = expanded;
  });
  $("#note-list").addEventListener("click", (event) => {
    const traceElement = event.target.closest("[data-quick-trace]");
    if (traceElement && event.target.closest("[data-stream-action]")) {
      const trace = quickTraceById(traceElement.dataset.quickTrace);
      if (trace?.source === "memo" && trace.memoId) editMemo(trace.memoId);
      else if (trace) openQuickDialog(trace.id);
      return;
    }
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
  $("#close-trace-dialog").addEventListener("click", () => closeDialog($("#trace-dialog")));
  $("#remove-note-traces").addEventListener("click", removeTracesForActiveNote);
  $("#toggle-more-trackers").addEventListener("click", () => {
    const expanded = $("#toggle-more-trackers").getAttribute("aria-expanded") === "true";
    $("#toggle-more-trackers").setAttribute("aria-expanded", String(!expanded));
    $("#more-tracker-choices").hidden = expanded;
  });

  $("#previous-month").addEventListener("click", () => changeCalendarMonth(-1));
  $("#next-month").addEventListener("click", () => changeCalendarMonth(1));
  $("#current-month").addEventListener("click", () => {
    calendarMonth = monthKey(todayKey());
    selectedCalendarDate = todayKey();
    renderMonth();
  });
  const calendarSection = $(".calendar-section");
  calendarSection.addEventListener("click", (event) => {
    if (!suppressCalendarClick) return;
    event.preventDefault();
    event.stopPropagation();
    suppressCalendarClick = false;
  }, true);
  bindHorizontalSwipe(calendarSection, (direction) => changeCalendarMonth(direction), {
    visual: $("#calendar-grid"),
    onCommit: () => {
      suppressCalendarClick = true;
      window.setTimeout(() => { suppressCalendarClick = false; }, 0);
    }
  });
  bindHorizontalSwipe($(".selected-day"), (direction) => changeSelectedCalendarDate(direction), {
    visual: $("#selected-day-content"),
    ignoreInteractive: true
  });

  $("#calendar-grid").addEventListener("click", (event) => {
    const day = event.target.closest("[data-calendar-date]");
    if (!day) return;
    selectedCalendarDate = day.dataset.calendarDate;
    if (monthKey(selectedCalendarDate) !== calendarMonth) calendarMonth = monthKey(selectedCalendarDate);
    renderMonth();
    if (window.innerWidth <= 720) requestAnimationFrame(() => $(".selected-day").scrollIntoView({ block: "start", behavior: "smooth" }));
  });
  $("#previous-day").addEventListener("click", () => changeSelectedCalendarDate(-1));
  $("#next-day").addEventListener("click", () => changeSelectedCalendarDate(1));
  $("#open-selected-day").addEventListener("click", () => {
    activeDate = selectedCalendarDate;
    resetComposer();
    resetMemoComposer();
    switchView("today", { scrollToEnd: true });
  });

  $("#manage-trackers-month").addEventListener("click", () => openTrackerManager(calendarMonth));
  $("#close-tracker-dialog").addEventListener("click", () => closeDialog($("#tracker-dialog")));
  $("#finish-tracker-management").addEventListener("click", () => closeDialog($("#tracker-dialog")));
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
  $("#close-backup-dialog").addEventListener("click", () => closeDialog($("#backup-dialog")));
  $("#finish-backup").addEventListener("click", () => closeDialog($("#backup-dialog")));
  $("#download-backup").addEventListener("click", downloadFullBackup);
  $("#export-month").addEventListener("click", downloadMonth);
  $("#choose-backup").addEventListener("click", () => $("#backup-file-input").click());
  $("#backup-file-input").addEventListener("change", (event) => importBackupFile(event.target.files?.[0]));
  $("#sync-connect-form").addEventListener("submit", connectCloudAccount);
  $("#disconnect-sync").addEventListener("click", disconnectCloudAccount);
  $("#sync-now").addEventListener("click", () => reconcileCloudState());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (draftTimer) {
        clearTimeout(draftTimer);
        persistState("草稿已保存");
      }
      flushCloudSync(true);
      return;
    }
    checkDateChange();
    if (cloudSync.session) reconcileCloudState();
  });
  window.addEventListener("pagehide", () => flushCloudSync(true));
  window.addEventListener("online", () => {
    if (cloudSync.session) reconcileCloudState();
  });
  window.addEventListener("offline", () => {
    if (cloudSync.session) setCloudStatus("offline");
  });
  window.setInterval(() => {
    checkDateChange();
    if (cloudSync.pending && document.visibilityState === "visible") flushCloudSync();
  }, 60000);
}

async function init() {
  await initializeState();
  bindEvents();
  renderAll();
  switchView("today", { scrollToEnd: true });
  registerServiceWorker();
  requestPersistentStorage();
  await initializeCloudSync();
}

init().catch(() => {
  const main = document.querySelector("#main-content");
  if (main) main.innerHTML = '<p class="empty-copy">暂时无法读取本机记录，请刷新页面再试一次。</p>';
});








