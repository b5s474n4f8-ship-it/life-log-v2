const DB_KEY = "life-log-v4";
const LEGACY_KEYS = ["life-log-records-v3", "life-log-records-v2", "life-log-records-v1"];

const entryTypes = [
  { id: "sleep", label: "睡眠" },
  { id: "dream", label: "梦境" },
  { id: "body", label: "身体" },
  { id: "chores", label: "庶务" },
  { id: "movement", label: "运动" },
  { id: "spiritual", label: "灵修" },
  { id: "relationship", label: "关系" },
  { id: "inner", label: "内在与能量" },
  { id: "creation", label: "创造" },
  { id: "inspiration", label: "灵感" },
  { id: "leisure", label: "闲暇" },
  { id: "free", label: "自由" },
];

const typeDetails = {
  sleep: {
    options: ["入睡困难", "躺下但没睡意", "夜醒", "早醒", "环境噪音", "鸟叫", "身体不适", "午睡/补觉", "睡得沉", "恢复感好", "恢复感差"],
    metrics: [
      { id: "sleepHours", label: "睡眠时长", unit: "小时", step: "0.5" },
      { id: "napMinutes", label: "午睡/补觉时长", unit: "分钟", step: "5" },
      { id: "sleepRecovery", label: "恢复感", unit: "/5", step: "1", min: "1", max: "5" },
    ],
    extras: [
      { id: "bedtimeActivity", label: "睡前活动", placeholder: "例如刷手机、读书、祷告、聊天、运动、吃东西。" },
      { id: "sleepFactors", label: "影响睡眠的因素", placeholder: "例如躺下没睡意、噪音、鸟叫、光线、身体不适、压力。" },
    ],
  },

  chores: {
    options: ["洗澡", "洗衣", "排便", "自我按摩"],
  },
  movement: {
    options: ["八段锦", "普拉提", "跑步机上坡走", "散步/走路", "拉伸", "HIIT", "力量训练", "其他"],
    metrics: [
      { id: "movementMinutes", label: "运动时长", unit: "分钟", step: "5" },
      { id: "walkKm", label: "走路公里数", unit: "公里", step: "0.1" },
    ],
  },
  spiritual: {
    options: ["祷告", "读经", "默想", "敬拜", "阅读属灵读物"],
  },
};

const leisureLabels = {
  kind: { series: "剧", reality: "综艺", game: "游戏", book: "书", documentary: "纪录片", video: "视频", movie: "电影", other: "其他" },
  status: { want: "想看", watching: "在看", paused: "暂停", finished: "看完", dropped: "弃置" },
  context: { bored: "无聊时", "low-energy": "低能量", relax: "想放松", inspire: "想被启发", social: "想社交" },
  feeling: { nourishing: "滋养", company: "陪伴", exciting: "兴奋", draining: "消耗", plain: "一般" },
};


const typePlaceholders = {
  sleep: "例如：昨晚躺下很久没睡意，早上被鸟叫醒；午睡 40 分钟后恢复感 3/5。",
  dream: "只记录梦里的画面、人物、情绪或片段，不需要分析。",
  body: "例如：头痛、浮肿、疲劳、经期、胃口、紧绷或放松。",
  movement: "例如：八段锦 20 分钟，结束后腰舒服一点。",
  spiritual: "例如：今天的祷告、读经、提醒、挣扎或领受。",
  relationship: "例如：一次对话、冲突、支持、连接感或疏离感。",
  leisure: "例如：看了哪一集、读到哪里、玩了什么，感觉是滋养还是消耗。",
  free: "先写下来。可以是一句话、一段身体信号、一点关系感受，或者只是‘今天有点无聊’。",
};
const dailyThemes = [
  { a: "#dff2ff", b: "#e8f6df", c: "#fff8df", ink: "#284d51", accent: "#4f8a73", strong: "#2f6a57" },
  { a: "#e7f8f4", b: "#e7edff", c: "#fff0f5", ink: "#36505f", accent: "#6686b5", strong: "#365f91" },
  { a: "#f0ecff", b: "#e4f7ff", c: "#f6f9df", ink: "#4b4261", accent: "#7f78b6", strong: "#5e5798" },
  { a: "#fff3d6", b: "#e7f5e9", c: "#e5f4ff", ink: "#66512e", accent: "#8d9661", strong: "#686f3e" },
  { a: "#ffeaf0", b: "#e8f6ff", c: "#eff8e6", ink: "#604653", accent: "#b07b87", strong: "#8c5a66" },
];

const dailyLines = [
  "慢慢来，今天先接住真实的一点。",
  "可以轻一点，但不要从自己的生活里缺席。",
  "今天不需要完整，只需要有一个入口。",
  "把模糊放下来一点，身体和心会自己说话。",
  "先记录，再整理；先看见，再判断。",
  "给生活一点秩序，也给自己一点余地。",
  "不急着成为更好的人，先和今天在一起。",
];

const legacyMap = {
  spiritual: "spiritual",
  sleep: "sleep",
  dream: "dream",
  body: "body",
  chores: "chores",
  movement: "movement",
  inner: "inner",
  energy: "inner",
  awake: "free",
  creation: "creation",
  inspiration: "inspiration",
  relationship: "relationship",
  free: "free",
};

const legacyTitles = {
  spiritual: "灵修",
  sleep: "睡眠",
  dream: "梦境",
  body: "身体",
  chores: "庶务",
  movement: "运动",
  inner: "内在与能量",
  energy: "内在与能量",
  awake: "清醒时间",
  creation: "创造",
  inspiration: "灵感",
  relationship: "关系",
  free: "自由记录",
};

const metricLabels = {
  hours: "睡眠时长",
  sleepHours: "睡眠时长",
  napMinutes: "午睡/补觉",
  sleepRecovery: "恢复感",
  minutes: "运动时长",
  movementMinutes: "运动时长",
  km: "走路公里数",
  walkKm: "走路公里数",
};

const metricUnits = {
  hours: "小时",
  sleepHours: "小时",
  napMinutes: "分钟",
  sleepRecovery: "/5",
  minutes: "分钟",
  movementMinutes: "分钟",
  km: "公里",
  walkKm: "公里",
};

const extraLabels = {
  bedtimeActivity: "睡前活动",
  sleepFactors: "影响睡眠的因素",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let db = loadDatabase();
let activeView = "today-view";
let currentDate = getTodayKey();
let selectedRecordDate = currentDate;
let selectedRecordType = "all";
let currentType = "free";
let editingEntryId = null;
let editingLeisureId = null;
let lastTodayKey = currentDate;
let lastTickAt = Date.now();
let lastInteractionAt = Date.now();

function createEmptyDb() {
  return {
    version: 4,
    entries: [],
    todosByDate: {},
    leisureItems: [],
    durationsByDate: {},
    migratedLegacy: false,
  };
}

function loadDatabase() {
  const empty = createEmptyDb();
  try {
    const saved = JSON.parse(localStorage.getItem(DB_KEY) || "null");
    if (saved && saved.version === 4) {
      return {
        ...empty,
        ...saved,
        entries: Array.isArray(saved.entries) ? saved.entries : [],
        todosByDate: saved.todosByDate || {},
        leisureItems: Array.isArray(saved.leisureItems) ? saved.leisureItems : [],
        durationsByDate: saved.durationsByDate || {},
      };
    }
  } catch {
    // Keep going and try legacy data.
  }
  migrateLegacyInto(empty);
  saveDatabase(empty);
  return empty;
}

function saveDatabase(nextDb = db) {
  localStorage.setItem(DB_KEY, JSON.stringify(nextDb));
}

function migrateLegacyInto(target) {
  for (const key of LEGACY_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      migrateLegacyRecords(target, parsed);
      target.migratedLegacy = true;
      return;
    } catch {
      // Ignore malformed legacy backups.
    }
  }
}

function migrateLegacyRecords(target, source) {
  const records = extractLegacyRecords(source);
  for (const record of records) {
    if (!record.date) continue;
    const fields = record.fields || {};
    for (const [fieldId, rawValue] of Object.entries(fields)) {
      if (fieldId === "memo") {
        migrateTodos(target, record.date, rawValue);
        continue;
      }
      const value = normalizeLegacyField(rawValue);
      if (!hasLegacyContent(value)) continue;
      const type = legacyMap[fieldId] || "free";
      const heading = legacyTitles[fieldId] || findType(type).label;
      const text = value.text ? value.text.trim() : "";
      target.entries.push({
        id: uid("entry"),
        date: record.date,
        type,
        text: text || heading,
        tags: value.options,
        metrics: normalizeLegacyMetrics(value.metrics),
        createdAt: record.createdAt || `${record.date}T09:00:00.000`,
        updatedAt: record.updatedAt || record.createdAt || `${record.date}T09:00:00.000`,
        migratedFrom: fieldId,
      });
    }
  }
}

function migrateTodos(target, date, rawValue) {
  const value = normalizeLegacyField(rawValue);
  const lines = value.text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  if (!lines.length) return;
  if (!target.todosByDate[date]) target.todosByDate[date] = [];
  for (const line of lines) {
    target.todosByDate[date].push({
      id: uid("todo"),
      text: line,
      done: false,
      createdAt: `${date}T08:00:00.000`,
      completedAt: null,
    });
  }
}

function extractLegacyRecords(source) {
  if (Array.isArray(source)) return source;
  if (Array.isArray(source.records)) return source.records;
  if (source.records && typeof source.records === "object") {
    return Object.entries(source.records).map(([date, record]) => ({ ...record, date: record.date || date }));
  }
  if (source && typeof source === "object") {
    return Object.entries(source)
      .filter(([, value]) => value && typeof value === "object")
      .map(([date, record]) => ({ ...record, date: record.date || date }));
  }
  return [];
}

function normalizeLegacyField(value) {
  if (typeof value === "string") return { text: value, options: [], metrics: {} };
  return {
    text: value?.text || "",
    options: Array.isArray(value?.options) ? value.options : [],
    metrics: value?.metrics || {},
  };
}

function hasLegacyContent(value) {
  return Boolean(value.text.trim() || value.options.length || Object.keys(value.metrics || {}).length);
}

function normalizeLegacyMetrics(metrics) {
  const normalized = {};
  for (const [key, value] of Object.entries(metrics || {})) {
    if (value === "" || value == null) continue;
    if (key === "hours") normalized.sleepHours = value;
    else if (key === "minutes") normalized.movementMinutes = value;
    else if (key === "km") normalized.walkKm = value;
    else normalized[key] = value;
  }
  return normalized;
}

function uid(prefix) {
  if (window.crypto && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getTodayKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function dateFromKey(dateKey) {
  return new Date(`${dateKey}T12:00:00`);
}

function dateHash(dateKey) {
  return [...dateKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function findType(typeId) {
  return entryTypes.find((type) => type.id === typeId) || entryTypes[entryTypes.length - 1];
}

function formatDateTitle(dateKey) {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(dateFromKey(dateKey));
}

function formatWeekday(dateKey) {
  return new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(dateFromKey(dateKey));
}

function formatTime(iso) {
  try {
    return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return "";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function applyTheme(dateKey) {
  const theme = dailyThemes[dateHash(dateKey) % dailyThemes.length];
  const root = document.documentElement;
  root.style.setProperty("--theme-a", theme.a);
  root.style.setProperty("--theme-b", theme.b);
  root.style.setProperty("--theme-c", theme.c);
  root.style.setProperty("--theme-ink", theme.ink);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-strong", theme.strong);
}

function getTodos(dateKey) {
  if (!db.todosByDate[dateKey]) db.todosByDate[dateKey] = [];
  return db.todosByDate[dateKey];
}

function getEntries(dateKey) {
  return db.entries
    .filter((entry) => entry.date === dateKey)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function markInteraction() {
  lastInteractionAt = Date.now();
}

function trackDuration() {
  const now = Date.now();
  const visible = document.visibilityState === "visible";
  const recentlyActive = now - lastInteractionAt < 120000;
  if (visible && recentlyActive && activeView === "today-view") {
    const diff = Math.min(now - lastTickAt, 30000);
    db.durationsByDate[currentDate] = Number(db.durationsByDate[currentDate] || 0) + diff;
    saveDatabase();
  }
  lastTickAt = now;
  renderDuration();
}

function renderDuration() {
  const minutes = Math.round(Number(db.durationsByDate[currentDate] || 0) / 60000);
  $("#duration-label").textContent = `今日记录用时约 ${minutes} 分钟`;
}

function updateEntryPlaceholder() {
  const textarea = $("#entry-text");
  if (!textarea) return;
  textarea.placeholder = typePlaceholders[currentType] || typePlaceholders.free;
}
function renderTypeGrid() {
  updateEntryPlaceholder();
  $("#entry-type-grid").innerHTML = entryTypes
    .map(
      (type) => `
        <button class="type-button ${type.id === currentType ? "active" : ""}" type="button" data-entry-type="${type.id}">
          ${type.label}
        </button>
      `,
    )
    .join("");
}

function renderDetailBox(entry = null) {
  const details = typeDetails[currentType];
  const selected = new Set(entry?.tags || []);
  const metrics = entry?.metrics || {};
  const extras = entry?.extras || {};
  if (!details) {
    $("#entry-detail-box").innerHTML = "";
    return;
  }
  const help = details.help ? `<p class="detail-help">${details.help}</p>` : "";
  const options = details.options
    ? `<div class="choice-grid">${details.options
        .map(
          (option) => `
            <label class="choice-pill ${selected.has(option) ? "active" : ""}">
              <input type="checkbox" value="${escapeHtml(option)}" ${selected.has(option) ? "checked" : ""}>
              <span>${escapeHtml(option)}</span>
            </label>
          `,
        )
        .join("")}</div>`
    : "";
  const metricInputs = details.metrics
    ? `<div class="metric-grid">${details.metrics
        .map(
          (metric) => `
            <label>
              <span>${metric.label}</span>
              <input type="number" inputmode="decimal" min="${metric.min || "0"}" ${metric.max ? 'max="' + metric.max + '"' : ""} step="${metric.step}" data-metric="${metric.id}" value="${escapeHtml(metrics[metric.id] || "")}" placeholder="${metric.unit}">
            </label>
          `,
        )
        .join("")}</div>`
    : "";
  const extraInputs = details.extras
    ? `<div class="extra-grid">${details.extras
        .map(
          (extra) => `
            <label>
              <span>${extra.label}</span>
              <textarea data-extra="${extra.id}" placeholder="${escapeHtml(extra.placeholder || "")}">${escapeHtml(extras[extra.id] || "")}</textarea>
            </label>
          `,
        )
        .join("")}</div>`
    : "";
  $("#entry-detail-box").innerHTML = `${help}${options}${metricInputs}${extraInputs}`;
}

function renderToday() {
  applyTheme(currentDate);
  const today = getTodayKey();
  $("#date-label").textContent = formatDateTitle(currentDate);
  $("#weekday-label").textContent = currentDate === today ? `今天 · ${formatWeekday(currentDate)}` : `${formatWeekday(currentDate)} · 历史`;
  $("#daily-line").textContent = dailyLines[dateHash(currentDate) % dailyLines.length];
  $("#jump-today-button").hidden = currentDate === today;
  renderHistoryNotice();
  renderTodos();
  renderEntryList("#today-entry-list", getEntries(currentDate));
  $("#entry-count").textContent = `${getEntries(currentDate).length} 条`;
  renderDuration();
}

function renderHistoryNotice(message = "") {
  const notice = $("#history-notice");
  const today = getTodayKey();
  if (message) {
    notice.hidden = false;
    notice.textContent = message;
    return;
  }
  if (currentDate !== today) {
    notice.hidden = false;
    notice.textContent = `正在查看 ${currentDate} 的历史记录。点“回到今天”会回到 ${today}。`;
  } else {
    notice.hidden = true;
    notice.textContent = "";
  }
}

function renderTodos() {
  const todos = getTodos(currentDate);
  const done = todos.filter((todo) => todo.done).length;
  $("#todo-count").textContent = `${done}/${todos.length}`;
  $("#todo-list").innerHTML = todos.length
    ? todos
        .map(
          (todo) => `
            <div class="todo-item" data-todo-id="${todo.id}">
              <input type="checkbox" ${todo.done ? "checked" : ""} aria-label="完成 ${escapeHtml(todo.text)}">
              <span class="todo-text ${todo.done ? "done" : ""}">${escapeHtml(todo.text)}</span>
              <button class="icon-button" type="button" data-delete-todo="${todo.id}" aria-label="删除">×</button>
            </div>
          `,
        )
        .join("")
    : `<p class="empty-state">这里可以放今天要托住的小事。没有也很好。</p>`;
}

function collectEntryDetails() {
  const tags = $$("#entry-detail-box input[type='checkbox']:checked").map((input) => input.value);
  const metrics = {};
  $$("#entry-detail-box [data-metric]").forEach((input) => {
    if (input.value !== "") metrics[input.dataset.metric] = input.value;
  });
  const extras = {};
  $$("#entry-detail-box [data-extra]").forEach((input) => {
    const value = input.value.trim();
    if (value) extras[input.dataset.extra] = value;
  });
  return { tags, metrics, extras };
}

function resetEntryForm() {
  editingEntryId = null;
  currentType = "free";
  $("#entry-text").value = "";
  $("#entry-submit-button").textContent = "保存这一条";
  $("#cancel-edit-button").hidden = true;
  renderTypeGrid();
  renderDetailBox();
}

function submitEntry(event) {
  event.preventDefault();
  markInteraction();
  const text = $("#entry-text").value.trim();
  const { tags, metrics, extras } = collectEntryDetails();
  const hasDetails = tags.length || Object.keys(metrics).length || Object.keys(extras).length;
  if (!text && !hasDetails) {
    $("#save-status").textContent = "可以先写一点，或者选择一个小标签。";
    return;
  }

  const now = new Date().toISOString();
  if (editingEntryId) {
    const entry = db.entries.find((item) => item.id === editingEntryId);
    if (entry) {
      entry.type = currentType;
      entry.text = text;
      entry.tags = tags;
      entry.metrics = metrics;
      entry.extras = extras;
      entry.updatedAt = now;
      entry.date = currentDate;
    }
    $("#save-status").textContent = "这一条已更新。";
  } else {
    db.entries.push({
      id: uid("entry"),
      date: currentDate,
      type: currentType,
      text,
      tags,
      metrics,
      extras,
      createdAt: now,
      updatedAt: now,
    });
    $("#save-status").textContent = "已保存这一条。";
  }
  saveDatabase();
  resetEntryForm();
  renderAll();
}

function renderEntryList(selector, entries) {
  const container = $(selector);
  if (!entries.length) {
    container.innerHTML = `<article class="entry-card"><p class="empty-state">还没有记录。生活不需要被填满，想到什么再放进来。</p></article>`;
    return;
  }
  container.innerHTML = entries
    .map((entry) => {
      const type = findType(entry.type);
      const detail = renderEntryDetail(entry);
      return `
        <article class="entry-card" data-entry-id="${entry.id}">
          <div class="entry-meta">
            <span class="type-badge">${type.label}</span>
            <span class="time-text">${entry.date} · ${formatTime(entry.createdAt)}</span>
          </div>
          ${entry.text ? `<p>${escapeHtml(entry.text)}</p>` : ""}
          ${detail}
          <div class="card-actions">
            <button class="mini-button" type="button" data-open-entry="${entry.id}">打开这天</button>
            <button class="mini-button" type="button" data-edit-entry="${entry.id}">编辑</button>
            <button class="danger-button" type="button" data-delete-entry="${entry.id}">删除</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderEntryDetail(entry) {
  const chips = [];
  for (const tag of entry.tags || []) chips.push(`<span class="data-chip">${escapeHtml(tag)}</span>`);
  for (const [key, value] of Object.entries(entry.metrics || {})) {
    chips.push(`<span class="data-chip">${metricLabels[key] || key} ${escapeHtml(value)}${metricUnits[key] || ""}</span>`);
  }
  const extraLines = Object.entries(entry.extras || {})
    .filter(([, value]) => value)
    .map(([key, value]) => `<p class="extra-line"><strong>${extraLabels[key] || key}：</strong>${escapeHtml(value)}</p>`);
  const chipHtml = chips.length ? `<div class="entry-meta">${chips.join("")}</div>` : "";
  const extraHtml = extraLines.length ? `<div class="extra-lines">${extraLines.join("")}</div>` : "";
  return `${chipHtml}${extraHtml}`;
}

function editEntry(entryId) {
  const entry = db.entries.find((item) => item.id === entryId);
  if (!entry) return;
  currentDate = entry.date;
  activeView = "today-view";
  currentType = entry.type;
  editingEntryId = entry.id;
  $("#entry-text").value = entry.text || "";
  $("#entry-submit-button").textContent = "更新这一条";
  $("#cancel-edit-button").hidden = false;
  renderTypeGrid();
  renderDetailBox(entry);
  switchView("today-view", { keepDate: true, keepEditing: true });
  setTimeout(() => $("#entry-text").focus(), 0);
}

function deleteEntry(entryId) {
  db.entries = db.entries.filter((entry) => entry.id !== entryId);
  saveDatabase();
  renderAll();
}

function openEntryDate(entryId) {
  const entry = db.entries.find((item) => item.id === entryId);
  if (!entry) return;
  currentDate = entry.date;
  switchView("today-view", { keepDate: true });
}

function renderRecords() {
  $("#record-date-input").value = selectedRecordDate;
  $("#record-type-filter").innerHTML = `<option value="all">全部类型</option>${entryTypes
    .map((type) => `<option value="${type.id}">${type.label}</option>`)
    .join("")}`;
  $("#record-type-filter").value = selectedRecordType;
  const entries = getEntries(selectedRecordDate).filter((entry) => selectedRecordType === "all" || entry.type === selectedRecordType);
  renderEntryList("#record-entry-list", entries);
}

function addTodo(event) {
  event.preventDefault();
  const input = $("#todo-input");
  const text = input.value.trim();
  if (!text) return;
  getTodos(currentDate).push({
    id: uid("todo"),
    text,
    done: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
  });
  input.value = "";
  saveDatabase();
  renderTodos();
}

function toggleTodo(todoId, done) {
  const todo = getTodos(currentDate).find((item) => item.id === todoId);
  if (!todo) return;
  todo.done = done;
  todo.completedAt = done ? new Date().toISOString() : null;
  saveDatabase();
  renderTodos();
}

function deleteTodo(todoId) {
  db.todosByDate[currentDate] = getTodos(currentDate).filter((todo) => todo.id !== todoId);
  saveDatabase();
  renderTodos();
}

function renderLeisure() {
  $("#leisure-count").textContent = `${db.leisureItems.length} 个`;
  const items = [...db.leisureItems].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  $("#leisure-list").innerHTML = items.length
    ? items.map(renderLeisureCard).join("")
    : `<article class="leisure-card"><p class="empty-state">还没有闲暇条目。下一次想起一部剧、一本书、一个综艺，就先放这里。</p></article>`;
}

function renderLeisureCard(item) {
  return `
    <article class="leisure-card" data-leisure-id="${item.id}">
      <div class="leisure-meta">
        <span class="type-badge">${leisureLabels.kind[item.kind] || "其他"}</span>
        <span class="data-chip">${leisureLabels.status[item.status] || item.status}</span>
        <span class="data-chip">${leisureLabels.context[item.context] || item.context}</span>
        <span class="data-chip">${leisureLabels.feeling[item.feeling] || item.feeling}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      ${item.progress ? `<p>进度：${escapeHtml(item.progress)}</p>` : ""}
      ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}
      <div class="card-actions">
        <button class="mini-button" type="button" data-log-leisure="${item.id}">记到今天</button>
        <button class="mini-button" type="button" data-edit-leisure="${item.id}">编辑</button>
        <button class="danger-button" type="button" data-delete-leisure="${item.id}">删除</button>
      </div>
    </article>
  `;
}

function submitLeisure(event) {
  event.preventDefault();
  const title = $("#leisure-title").value.trim();
  if (!title) return;
  const now = new Date().toISOString();
  const item = {
    id: editingLeisureId || uid("leisure"),
    title,
    kind: $("#leisure-kind").value,
    status: $("#leisure-status").value,
    progress: $("#leisure-progress").value.trim(),
    context: $("#leisure-context").value,
    feeling: $("#leisure-feeling").value,
    note: $("#leisure-note").value.trim(),
    createdAt: now,
    updatedAt: now,
  };
  if (editingLeisureId) {
    const index = db.leisureItems.findIndex((existing) => existing.id === editingLeisureId);
    if (index >= 0) item.createdAt = db.leisureItems[index].createdAt || now;
    if (index >= 0) db.leisureItems[index] = item;
  } else {
    db.leisureItems.push(item);
  }
  saveDatabase();
  resetLeisureForm();
  renderLeisure();
  renderReview();
}

function resetLeisureForm() {
  editingLeisureId = null;
  $("#leisure-form").reset();
  $("#leisure-form-title").textContent = "添加一个闲暇条目";
  $("#leisure-submit-button").textContent = "保存闲暇条目";
  $("#cancel-leisure-edit").hidden = true;
}

function editLeisure(itemId) {
  const item = db.leisureItems.find((leisure) => leisure.id === itemId);
  if (!item) return;
  editingLeisureId = item.id;
  $("#leisure-title").value = item.title || "";
  $("#leisure-kind").value = item.kind || "other";
  $("#leisure-status").value = item.status || "want";
  $("#leisure-progress").value = item.progress || "";
  $("#leisure-context").value = item.context || "bored";
  $("#leisure-feeling").value = item.feeling || "plain";
  $("#leisure-note").value = item.note || "";
  $("#leisure-form-title").textContent = "编辑闲暇条目";
  $("#leisure-submit-button").textContent = "更新闲暇条目";
  $("#cancel-leisure-edit").hidden = false;
  $("#leisure-title").focus();
}

function deleteLeisure(itemId) {
  db.leisureItems = db.leisureItems.filter((item) => item.id !== itemId);
  saveDatabase();
  renderLeisure();
  renderReview();
}

function logLeisureToToday(itemId) {
  const item = db.leisureItems.find((leisure) => leisure.id === itemId);
  if (!item) return;
  currentDate = getTodayKey();
  db.entries.push({
    id: uid("entry"),
    date: currentDate,
    type: "leisure",
    text: `${item.title}${item.progress ? `：${item.progress}` : ""}${item.note ? `\n${item.note}` : ""}`,
    tags: [leisureLabels.kind[item.kind], leisureLabels.feeling[item.feeling]].filter(Boolean),
    metrics: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  saveDatabase();
  switchView("today-view");
  $("#save-status").textContent = "已记到今天的生活流。";
}

function showBoredSuggestions() {
  const candidates = db.leisureItems
    .filter((item) => !["finished", "dropped"].includes(item.status))
    .map((item) => ({ item, score: leisureScore(item) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item }) => item);
  const box = $("#bored-result");
  box.hidden = false;
  if (!candidates.length) {
    box.innerHTML = `<p>现在还没有可选项。可以先放进一部剧、一本书，或者也允许自己真正休息。</p>`;
    return;
  }
  box.innerHTML = `
    <p>可以从这几个里面选一个，不需要临时刷半小时来找：</p>
    <ul>
      ${candidates
        .map(
          (item) =>
            `<li>${escapeHtml(item.title)} · ${leisureLabels.status[item.status]} · ${item.progress ? escapeHtml(item.progress) : leisureLabels.context[item.context]}</li>`,
        )
        .join("")}
    </ul>
  `;
}

function leisureScore(item) {
  let score = 0;
  if (item.status === "watching") score += 5;
  if (item.status === "want") score += 3;
  if (item.context === "bored") score += 3;
  if (item.context === "low-energy") score += 2;
  if (["nourishing", "company"].includes(item.feeling)) score += 2;
  if (item.feeling === "draining") score -= 3;
  return score;
}

function lastNDates(n) {
  const dates = [];
  const base = dateFromKey(getTodayKey());
  for (let i = n - 1; i >= 0; i -= 1) {
    const next = new Date(base);
    next.setDate(base.getDate() - i);
    dates.push(getTodayKey(next));
  }
  return dates;
}

function renderReview() {
  const dates = lastNDates(7);
  const weekEntries = db.entries.filter((entry) => dates.includes(entry.date));
  const daysWithRecords = new Set(weekEntries.map((entry) => entry.date));
  const cards = [];
  if (daysWithRecords.size < 2) {
    cards.push(reviewCard("本周记录还不多", ["可以先继续记录，不需要急着总结。等有两三天内容后，复盘会更有参考。"]));
  }
  cards.push(reviewCard("记录概况", [`最近 7 天记录了 ${daysWithRecords.size} 天，共 ${weekEntries.length} 条生活流。`, `to-dos 共 ${countTodos(dates)} 条，完成 ${countDoneTodos(dates)} 条。`]));
  cards.push(reviewCard("睡眠", sleepReview(weekEntries)));
  cards.push(reviewCard("身体与梦境", [...snippets(weekEntries, ["body", "dream"], 4)]));
  cards.push(reviewCard("灵修", spiritualReview(weekEntries)));
  cards.push(reviewCard("庶务", choresReview(weekEntries)));
  cards.push(reviewCard("运动", movementReview(weekEntries)));
  cards.push(reviewCard("关系", snippets(weekEntries, ["relationship"], 4)));
  cards.push(reviewCard("内在与能量", snippets(weekEntries, ["inner"], 4)));
  cards.push(reviewCard("创造与灵感", snippets(weekEntries, ["creation", "inspiration"], 4)));
  cards.push(reviewCard("闲暇", leisureReview(weekEntries)));
  cards.push(reviewCard("下周温和小行动", suggestActions(weekEntries)));
  $("#review-content").innerHTML = cards.join("");
}

function reviewCard(title, lines) {
  const clean = lines.filter(Boolean);
  return `
    <article class="review-card">
      <h3>${title}</h3>
      ${clean.length ? `<ul>${clean.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : `<p>这一项暂时没有太多内容。</p>`}
    </article>
  `;
}

function entriesOf(entries, type) {
  return entries.filter((entry) => entry.type === type);
}

function uniqueDays(entries) {
  return new Set(entries.map((entry) => entry.date)).size;
}

function countTags(entries) {
  const counts = {};
  for (const entry of entries) {
    for (const tag of entry.tags || []) counts[tag] = (counts[tag] || 0) + 1;
  }
  return counts;
}

function formatCounts(counts) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${label} ${count} 次`)
    .join("，");
}

function sumMetric(entries, metric) {
  return entries.reduce((sum, entry) => sum + Number(entry.metrics?.[metric] || 0), 0);
}

function sleepReview(entries) {
  const sleep = entriesOf(entries, "sleep");
  if (!sleep.length) return ["本周还没有睡眠记录。可以先轻量记录 2-3 天，不急着总结。"];

  const hours = sleep.map((entry) => Number(entry.metrics?.sleepHours || 0)).filter(Boolean);
  const avg = hours.length ? (hours.reduce((a, b) => a + b, 0) / hours.length).toFixed(1) : "";
  const napEntries = sleep.filter((entry) => Number(entry.metrics?.napMinutes || 0) > 0 || entry.tags?.includes("午睡/补觉") || entry.tags?.includes("午休/补觉"));
  const napTotal = sumMetric(sleep, "napMinutes");
  const recoveries = sleep.map((entry) => Number(entry.metrics?.sleepRecovery || 0)).filter((value) => value >= 1);
  const avgRecovery = recoveries.length ? (recoveries.reduce((a, b) => a + b, 0) / recoveries.length).toFixed(1) : "";
  const tags = countTags(sleep);
  const signalLabels = ["入睡困难", "躺下但没睡意", "夜醒", "早醒", "环境噪音", "鸟叫", "身体不适"];
  const signalText = signalLabels.filter((label) => tags[label]).map((label) => `${label} ${tags[label]} 次`).join("，");
  const lines = [
    `睡眠记录 ${sleep.length} 条，覆盖 ${uniqueDays(sleep)} 天。`,
    avg ? `记录睡眠时长的 ${hours.length} 天里，平均约 ${avg} 小时。` : "",
    napEntries.length ? `午睡/补觉 ${napEntries.length} 次，总时长约 ${napTotal || 0} 分钟。` : "",
    avgRecovery ? `平均恢复感约 ${avgRecovery}/5。` : "",
    signalText ? `本周出现：${signalText}。` : "",
  ];
  if ((tags["环境噪音"] || 0) + (tags["鸟叫"] || 0) >= 2) {
    lines.push("环境干扰出现较多，可以继续观察耳塞、窗户、白噪音或入睡时间是否有帮助。");
  }
  if ((tags["入睡困难"] || 0) + (tags["躺下但没睡意"] || 0) >= 2) {
    lines.push("入睡前状态值得继续观察，尤其是睡前活动、屏幕、聊天、压力和身体疲劳之间的关系。");
  }
  return lines;
}

function spiritualReview(entries) {
  const spiritual = entriesOf(entries, "spiritual");
  const tags = formatCounts(countTags(spiritual));
  return [`灵修相关记录 ${uniqueDays(spiritual)} 天。`, tags ? `本周出现：${tags}。` : "", ...snippets(entries, ["spiritual"], 2)];
}

function choresReview(entries) {
  const chores = entriesOf(entries, "chores");
  const counts = formatCounts(countTags(chores));
  return [counts || "洗澡、洗衣、排便、自我按摩还没有形成可统计记录。"];
}

function movementReview(entries) {
  const movement = entriesOf(entries, "movement");
  const minutes = sumMetric(movement, "movementMinutes");
  const km = sumMetric(movement, "walkKm");
  const counts = formatCounts(countTags(movement));
  return [
    `运动记录 ${movement.length} 条，覆盖 ${uniqueDays(movement)} 天。`,
    minutes ? `总运动时长约 ${minutes} 分钟。` : "",
    km ? `散步/走路约 ${km.toFixed(1)} 公里。` : "",
    counts ? `项目分布：${counts}。` : "",
  ];
}

function leisureReview(entries) {
  const leisureEntries = entriesOf(entries, "leisure");
  const active = db.leisureItems.filter((item) => ["want", "watching", "paused"].includes(item.status));
  const finished = db.leisureItems.filter((item) => item.status === "finished");
  return [
    `生活流里有 ${leisureEntries.length} 条闲暇记录。`,
    active.length ? `当前清单里有 ${active.length} 个可继续的闲暇条目。` : "闲暇清单还不多，可以先放 2-3 个低成本选择。",
    finished.length ? `已看完/读完 ${finished.length} 个。` : "",
    ...active.slice(0, 3).map((item) => `${item.title}：${leisureLabels.status[item.status]}${item.progress ? `，${item.progress}` : ""}`),
  ];
}

function snippets(entries, types, limit = 4) {
  return entries
    .filter((entry) => types.includes(entry.type) && entry.text)
    .slice(-limit)
    .map((entry) => `${entry.date}：${entry.text.slice(0, 90)}`);
}

function countTodos(dates) {
  return dates.reduce((sum, date) => sum + getTodos(date).length, 0);
}

function countDoneTodos(dates) {
  return dates.reduce((sum, date) => sum + getTodos(date).filter((todo) => todo.done).length, 0);
}

function suggestActions(entries) {
  const actions = [];
  if (!entriesOf(entries, "spiritual").length) actions.push("给灵修留一个很小的入口：祷告两分钟或读一小段都算。");
  if (uniqueDays(entriesOf(entries, "movement")) < 3) actions.push("给身体一个低门槛动作：八段锦、拉伸或走路 10 分钟。");
  if (!entriesOf(entries, "chores").some((entry) => entry.tags?.includes("排便"))) actions.push("庶务里继续轻量记录排便和洗澡，先观察规律。");
  if (!db.leisureItems.length) actions.push("放 2-3 个闲暇条目，给无聊时刻一个更有边界的选择。");
  if (!actions.length) actions.push("继续保持现在这种轻量记录，不需要把生活写满。");
  return actions.slice(0, 3);
}

function exportJson() {
  download(`life-log-backup-${getTodayKey()}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), ...db }, null, 2), "application/json;charset=utf-8");
}

function exportMarkdown() {
  const dates = [...new Set([...db.entries.map((entry) => entry.date), ...Object.keys(db.todosByDate)])].sort();
  const sections = dates.map(markdownForDate).filter(Boolean);
  if (db.leisureItems.length) sections.push(markdownForLeisure());
  download(`life-log-${getTodayKey()}.md`, sections.join("\n\n---\n\n"), "text/markdown;charset=utf-8", true);
}

function markdownForDate(date) {
  const parts = [`# ${date}`];
  const todos = getTodos(date);
  if (todos.length) {
    parts.push(`## to-dos\n${todos.map((todo) => `- [${todo.done ? "x" : " "}] ${todo.text}`).join("\n")}`);
  }
  for (const entry of getEntries(date)) {
    const type = findType(entry.type).label;
    const meta = [];
    if (entry.tags?.length) meta.push(`选项：${entry.tags.join("，")}`);
    const metricText = formatMetricText(entry.metrics);
    if (metricText) meta.push(`数据：${metricText}`);
    const extrasText = formatExtrasText(entry.extras);
    if (extrasText) meta.push(extrasText);
    parts.push(`## ${type} · ${formatTime(entry.createdAt)}\n${meta.join("\n")}${meta.length ? "\n" : ""}${entry.text || ""}`.trim());
  }
  return parts.length > 1 ? parts.join("\n\n") : "";
}

function markdownForLeisure() {
  const lines = ["# 闲暇清单"];
  for (const item of db.leisureItems) {
    lines.push(
      `## ${item.title}\n类型：${leisureLabels.kind[item.kind] || item.kind}\n状态：${leisureLabels.status[item.status] || item.status}\n进度：${item.progress || "未填写"}\n适合：${leisureLabels.context[item.context] || item.context}\n感受：${leisureLabels.feeling[item.feeling] || item.feeling}\n${item.note || ""}`.trim(),
    );
  }
  return lines.join("\n\n");
}

function formatMetricText(metrics = {}) {
  return Object.entries(metrics)
    .filter(([, value]) => value !== "" && value != null)
    .map(([key, value]) => `${metricLabels[key] || key} ${value}${metricUnits[key] || ""}`)
    .join("，");
}

function formatExtrasText(extras = {}) {
  return Object.entries(extras)
    .filter(([, value]) => value)
    .map(([key, value]) => `${extraLabels[key] || key}：${value}`)
    .join("\n");
}
function download(filename, content, type, withBom = false) {
  const body = withBom ? `\ufeff${content}` : content;
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (parsed.version === 4 || parsed.entries || parsed.leisureItems) {
        db.entries = mergeById(db.entries, parsed.entries || []);
        db.leisureItems = mergeById(db.leisureItems, parsed.leisureItems || []);
        db.todosByDate = { ...db.todosByDate, ...(parsed.todosByDate || {}) };
        db.durationsByDate = { ...db.durationsByDate, ...(parsed.durationsByDate || {}) };
      } else {
        migrateLegacyRecords(db, parsed);
      }
      saveDatabase();
      renderAll();
      alert("备份已导入。");
    } catch {
      alert("导入失败：这个文件不像 Life Log 备份。");
    }
  };
  reader.readAsText(file);
}

function mergeById(existing, incoming) {
  const map = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) {
    if (item?.id) map.set(item.id, item);
  }
  return [...map.values()];
}

function switchView(viewId, options = {}) {
  activeView = viewId;
  if (viewId === "today-view" && !options.keepDate) currentDate = getTodayKey();
  if (!options.keepEditing) resetEntryForm();
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  $$(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAll() {
  renderToday();
  renderRecords();
  renderLeisure();
  renderReview();
}

function checkDateRoll() {
  const today = getTodayKey();
  if (today === lastTodayKey) return;
  const previousToday = lastTodayKey;
  lastTodayKey = today;
  const hasDraft = $("#entry-text") && $("#entry-text").value.trim();
  if (activeView === "today-view" && currentDate === previousToday && !editingEntryId && !hasDraft) {
    currentDate = today;
    renderAll();
    $("#save-status").textContent = "新的一天已经开始，已自动切到今天。";
  } else {
    renderHistoryNotice(`今天已经是 ${today}。你当前内容不会被移动；需要时点“回到今天”。`);
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .register("./sw.js", { updateViaCache: "none" })
    .then((registration) => {
      registration.update();
      if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
    })
    .catch(() => {});
}

function bindEvents() {
  document.addEventListener("click", markInteraction);
  document.addEventListener("input", markInteraction);
  document.addEventListener("touchstart", markInteraction, { passive: true });

  $("#todo-form").addEventListener("submit", addTodo);
  $("#todo-list").addEventListener("change", (event) => {
    const item = event.target.closest("[data-todo-id]");
    if (item && event.target.matches("input[type='checkbox']")) toggleTodo(item.dataset.todoId, event.target.checked);
  });
  $("#todo-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-todo]");
    if (button) deleteTodo(button.dataset.deleteTodo);
  });

  $("#entry-form").addEventListener("submit", submitEntry);
  $("#entry-type-grid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-entry-type]");
    if (!button) return;
    currentType = button.dataset.entryType;
    renderTypeGrid();
    renderDetailBox();
  });
  $("#entry-detail-box").addEventListener("change", (event) => {
    const label = event.target.closest(".choice-pill");
    if (label) label.classList.toggle("active", event.target.checked);
  });
  $("#cancel-edit-button").addEventListener("click", resetEntryForm);
  $("#jump-today-button").addEventListener("click", () => {
    currentDate = getTodayKey();
    renderAll();
  });

  document.body.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-entry]");
    const remove = event.target.closest("[data-delete-entry]");
    const open = event.target.closest("[data-open-entry]");
    if (edit) editEntry(edit.dataset.editEntry);
    if (remove) deleteEntry(remove.dataset.deleteEntry);
    if (open) openEntryDate(open.dataset.openEntry);
  });

  $(".bottom-nav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (button) switchView(button.dataset.view);
  });

  $("#record-date-input").addEventListener("change", (event) => {
    selectedRecordDate = event.target.value || getTodayKey();
    renderRecords();
  });
  $("#record-type-filter").addEventListener("change", (event) => {
    selectedRecordType = event.target.value || "all";
    renderRecords();
  });

  $("#leisure-form").addEventListener("submit", submitLeisure);
  $("#cancel-leisure-edit").addEventListener("click", resetLeisureForm);
  $("#bored-button").addEventListener("click", showBoredSuggestions);
  $("#leisure-list").addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-leisure]");
    const remove = event.target.closest("[data-delete-leisure]");
    const log = event.target.closest("[data-log-leisure]");
    if (edit) editLeisure(edit.dataset.editLeisure);
    if (remove) deleteLeisure(remove.dataset.deleteLeisure);
    if (log) logLeisureToToday(log.dataset.logLeisure);
  });

  $("#export-json").addEventListener("click", exportJson);
  $("#export-md").addEventListener("click", exportMarkdown);
  $("#import-file").addEventListener("change", (event) => importBackup(event.target.files[0]));

  document.addEventListener("visibilitychange", () => {
    trackDuration();
    if (document.visibilityState === "visible") checkDateRoll();
  });
  window.addEventListener("focus", checkDateRoll);
  setInterval(() => {
    trackDuration();
    checkDateRoll();
  }, 15000);
}

function init() {
  selectedRecordDate = currentDate;
  renderTypeGrid();
  renderDetailBox();
  renderAll();
  bindEvents();
  registerServiceWorker();
}

init();






