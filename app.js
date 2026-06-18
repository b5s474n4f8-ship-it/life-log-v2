const STORAGE_KEY = "life-log-records-v3";
const SETTINGS_KEY = "life-log-settings-v3";

const fields = [
  {
    id: "memo",
    title: "to-dos",
    prompt: "今天有哪些计划、提醒、临时备忘或需要托住的事？写成几条就好，不需要做成很重的任务管理。",
  },
  {
    id: "spiritual",
    title: "灵修",
    prompt: "今天是否有灵修？有哪些触动、提醒、问题、挣扎或领受？今天与上帝的关系状态如何？",
    hint: "记录与信仰、属灵生命和内在成长相关的内容。",
    options: ["祷告", "读经", "默想", "敬拜", "阅读属灵读物"],
  },
  {
    id: "sleep",
    title: "睡眠",
    prompt: "昨晚睡了多久？睡眠质量如何？醒来后的恢复感如何？今天是否有午休或补觉？",
    options: ["入睡困难", "夜醒", "早醒", "睡得沉", "午休/补觉", "恢复感好"],
    metrics: [
      { id: "hours", label: "睡眠时长", suffix: "小时", step: "0.5" },
      { id: "napMinutes", label: "午休/补觉", suffix: "分钟", step: "5" },
    ],
  },
  {
    id: "dream",
    title: "梦境",
    prompt: "是否记得梦境？有哪些画面、情节、人物、情绪或象征值得记录？",
    hint: "无需分析，只记录内容即可。",
  },
  {
    id: "body",
    title: "身体状态",
    prompt: "今天身体有哪些值得记录的信号？例如疼痛、疲劳、浮肿、胃口变化、经期、头痛、过敏、精力变化、紧绷或放松等。",
    hint: "只记录身体层面的观察和感受。",
  },
  {
    id: "chores",
    title: "庶务",
    prompt: "今天做了哪些最基础的生活照料？身体和生活空间有没有被稍微照顾到一点？",
    options: ["洗澡", "洗衣", "排便", "自我按摩"],
  },
  {
    id: "movement",
    title: "运动",
    prompt: "今天是否有一点点活动？时长如何？过程中和结束后的身体感受如何？散步/走路类可以补充时间和公里数。",
    options: ["八段锦", "普拉提", "跑步机上坡走", "散步/走路", "拉伸", "HIIT", "力量训练", "其他"],
    metrics: [
      { id: "minutes", label: "运动时长", suffix: "分钟", step: "5" },
      { id: "km", label: "走路公里数", suffix: "公里", step: "0.1" },
    ],
  },
  {
    id: "inner",
    title: "内在与能量",
    prompt: "今天整体处于什么状态？哪些事让我恢复、被支持或更有动力？哪些事让我消耗、疲惫或失去动力？",
    hint: "把持续性的心理状态和具体能量变化放在一起看，减少重复记录。",
  },
  {
    id: "awake",
    title: "清醒时间",
    prompt: "非当班清醒时间大致流向了哪里？学习、副业、个人兴趣项目、娱乐、购物、社交中，哪些让一天更安稳，哪些让你更疲惫？",
    hint: "提醒：把清醒时间尽量交给有承接感的事，并保留一点有力度的身体活动，让身体真的有机会安静下来。",
    options: ["学习", "副业", "个人兴趣项目", "娱乐", "购物", "社交", "较强体力活动"],
  },
  {
    id: "creation",
    title: "创造",
    prompt: "今天有没有把想法、经验或价值变成某种可见的形式？哪怕只是整理出一句话、一个框架、一个小片段。",
    hint: "创造不一定是完成作品，重点是有东西从模糊变得更清楚。",
  },
  {
    id: "inspiration",
    title: "灵感",
    prompt: "今天是否出现值得保留的想法、洞见、观察、主题、句子、创意、问题或未来想探索的方向？",
    hint: "只记录灵感本身，不要求立即展开。",
  },
  {
    id: "relationship",
    title: "关系",
    prompt: "今天有没有值得记录的人际互动、关系变化、深度对话、冲突、支持、陪伴、连接感或疏离感？这些互动对我产生了什么影响？",
  },
  {
    id: "free",
    title: "自由记录",
    prompt: "任何不属于以上分类，但希望未来回顾时能看到的内容。可以记录当天的重要事件、环境变化、随机感悟或其他补充。",
  },
];

const $ = (selector) => document.querySelector(selector);
const form = $("#log-form");
const dateInput = $("#entry-date");
const saveStatus = $("#save-status");
const durationLabel = $("#duration-label");

let records = loadRecords();
let currentDate = todayKey();
let activeView = "today-view";
let saveTimer = null;
let interactionAt = Date.now();
let durationTickAt = Date.now();

function todayKey() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
}

function emptyRecord(date) {
  return {
    date,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    durationMs: 0,
    fields: {},
  };
}

function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (Array.isArray(parsed)) {
      return Object.fromEntries(parsed.filter((item) => item.date).map((item) => [item.date, normalizeRecord(item)]));
    }
    if (parsed && Array.isArray(parsed.records)) {
      return Object.fromEntries(parsed.records.filter((item) => item.date).map((item) => [item.date, normalizeRecord(item)]));
    }
    return Object.fromEntries(Object.entries(parsed || {}).map(([date, record]) => [date, normalizeRecord({ ...record, date })]));
  } catch {
    return {};
  }
}

function normalizeRecord(record) {
  const normalized = emptyRecord(record.date || todayKey());
  normalized.createdAt = record.createdAt || normalized.createdAt;
  normalized.updatedAt = record.updatedAt || normalized.updatedAt;
  normalized.durationMs = Number(record.durationMs || record.recordingDurationMs || 0);
  normalized.fields = record.fields || {};
  if (normalized.fields.energy) {
    const inner = normalized.fields.inner || { text: "", options: [], metrics: {} };
    const energy = normalized.fields.energy || {};
    const innerText = inner.text?.trim() || "";
    const energyText = energy.text?.trim() || "";
    if (energyText && !innerText.includes(energyText)) {
      inner.text = innerText ? `${innerText}\n\n能量变化：${energyText}` : energyText;
    }
    normalized.fields.inner = inner;
    delete normalized.fields.energy;
  }
  for (const field of fields) {
    if (typeof record[field.id] === "string") {
      normalized.fields[field.id] = { text: record[field.id], options: [], metrics: {} };
    }
  }
  return normalized;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function getCurrentRecord() {
  if (!records[currentDate]) records[currentDate] = emptyRecord(currentDate);
  return records[currentDate];
}

function renderIndex() {
  $("#section-index").innerHTML = fields
    .map((field) => `<a class="index-chip" href="#field-${field.id}">${field.title}</a>`)
    .join("");
}

function renderForm() {
  const record = getCurrentRecord();
  form.innerHTML = fields.map((field, index) => renderField(field, index + 1, record.fields[field.id] || {})).join("");
  updateDurationLabel();
}

function renderField(field, number, value) {
  const selected = new Set(value.options || []);
  const metrics = value.metrics || {};
  const options = field.options
    ? `<div class="option-grid">${field.options
        .map(
          (option) => `
            <label class="option-pill">
              <input type="checkbox" data-field="${field.id}" data-kind="option" value="${escapeHtml(option)}" ${selected.has(option) ? "checked" : ""}>
              <span>${escapeHtml(option)}</span>
            </label>
          `,
        )
        .join("")}</div>`
    : "";
  const metricFields = field.metrics
    ? `<div class="metrics-row">${field.metrics
        .map(
          (metric) => `
            <label class="metric-field">
              <span>${metric.label}</span>
              <input inputmode="decimal" type="number" min="0" step="${metric.step}" data-field="${field.id}" data-kind="metric" data-metric="${metric.id}" value="${escapeHtml(metrics[metric.id] || "")}" placeholder="${metric.suffix}">
            </label>
          `,
        )
        .join("")}</div>`
    : "";

  return `
    <section class="log-section" id="field-${field.id}">
      <div class="section-head">
        <h2>${field.title}</h2>
        <span class="section-number">${String(number).padStart(2, "0")}</span>
      </div>
      <p class="prompt">${field.prompt}</p>
      ${field.hint ? `<p class="hint">${field.hint}</p>` : ""}
      ${options}
      ${metricFields}
      <textarea data-field="${field.id}" data-kind="text" placeholder="可以留空。">${escapeHtml(value.text || "")}</textarea>
      <div class="section-jump">
        <a class="jump-link" href="#top">顶部</a>
        <a class="jump-link" href="#save-panel">底部</a>
      </div>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function collectForm() {
  const record = getCurrentRecord();
  record.fields = {};
  for (const field of fields) {
    const text = form.querySelector(`[data-field="${field.id}"][data-kind="text"]`)?.value || "";
    const options = [...form.querySelectorAll(`[data-field="${field.id}"][data-kind="option"]:checked`)].map((input) => input.value);
    const metrics = {};
    form.querySelectorAll(`[data-field="${field.id}"][data-kind="metric"]`).forEach((input) => {
      if (input.value !== "") metrics[input.dataset.metric] = input.value;
    });
    record.fields[field.id] = { text, options, metrics };
  }
  record.updatedAt = new Date().toISOString();
  records[currentDate] = record;
}

function saveCurrent(status = "已保存今天的记录。") {
  addActiveDuration();
  collectForm();
  persist();
  renderHistory();
  renderReview();
  saveStatus.textContent = status;
  updateDurationLabel();
}

function scheduleSave() {
  saveStatus.textContent = "正在暂存...";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveCurrent("已自动暂存。"), 550);
}

function addActiveDuration() {
  const now = Date.now();
  const visible = document.visibilityState === "visible";
  const recentlyActive = now - interactionAt < 120000;
  if (visible && recentlyActive) {
    const diff = Math.min(now - durationTickAt, 30000);
    if (diff > 0) getCurrentRecord().durationMs = Number(getCurrentRecord().durationMs || 0) + diff;
  }
  durationTickAt = now;
}

function markInteraction() {
  interactionAt = Date.now();
}

function updateDurationLabel() {
  const minutes = Math.max(0, Math.round(Number(getCurrentRecord().durationMs || 0) / 60000));
  durationLabel.textContent = `今日记录用时：${minutes} 分钟`;
}

function switchDate(date) {
  saveCurrent("已保存当前日期的记录。");
  currentDate = date;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ currentDate }));
  dateInput.value = currentDate;
  durationTickAt = Date.now();
  renderForm();
  saveStatus.textContent = "可以继续补充这一天。";
}

function renderHistory() {
  const list = $("#history-list");
  const dates = Object.keys(records).sort().reverse();
  if (!dates.length) {
    list.innerHTML = `<div class="history-item"><p class="history-preview">还没有保存记录。</p></div>`;
    return;
  }
  list.innerHTML = dates
    .map((date) => {
      const record = records[date];
      const preview = fields.map((field) => record.fields?.[field.id]?.text).find(Boolean) || "这一天有一些安静的留白。";
      return `
        <button class="history-item" type="button" data-open-date="${date}">
          <div class="history-date">${date}</div>
          <div class="history-preview">${escapeHtml(preview.slice(0, 88))}</div>
        </button>
      `;
    })
    .join("");
}

function recentRecords() {
  const today = todayKey();
  return Object.values(records)
    .filter((record) => record.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .reverse();
}

function hasField(record, id) {
  const field = record.fields?.[id];
  return Boolean(field && ((field.text || "").trim() || field.options?.length || Object.keys(field.metrics || {}).length));
}

function optionCounts(items, id) {
  const counts = {};
  for (const record of items) {
    for (const option of record.fields?.[id]?.options || []) {
      counts[option] = (counts[option] || 0) + 1;
    }
  }
  return counts;
}

function metricSum(items, id, metric) {
  return items.reduce((sum, record) => sum + Number(record.fields?.[id]?.metrics?.[metric] || 0), 0);
}

function textSnippets(items, ids, limit = 4) {
  const snippets = [];
  for (const record of items) {
    for (const id of ids) {
      const text = record.fields?.[id]?.text?.trim();
      if (text) snippets.push(`${record.date}：${text}`);
    }
  }
  return snippets.slice(0, limit);
}

function renderReview() {
  const items = recentRecords();
  const container = $("#review-content");
  if (items.length < 2) {
    container.innerHTML = `
      <article class="review-card">
        <h3>本周记录还不多</h3>
        <p>可以先继续记录，不需要急着总结。等有两三天内容后，复盘会更有参考。</p>
      </article>
    `;
    return;
  }

  const spiritualDays = items.filter((record) => hasField(record, "spiritual")).length;
  const movementDays = items.filter((record) => hasField(record, "movement")).length;
  const movementMinutes = metricSum(items, "movement", "minutes");
  const walkKm = metricSum(items, "movement", "km");
  const chores = optionCounts(items, "chores");
  const movement = optionCounts(items, "movement");
  const sleepHours = items.map((record) => Number(record.fields?.sleep?.metrics?.hours || 0)).filter(Boolean);
  const avgSleep = sleepHours.length ? (sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length).toFixed(1) : "";
  const awakeCounts = optionCounts(items, "awake");

  container.innerHTML = `
    ${reviewCard("记录概况", [`本周记录 ${items.length} 天。`, avgSleep ? `有 ${sleepHours.length} 天记录了睡眠，平均约 ${avgSleep} 小时。` : "睡眠还没有形成可统计数据。"])}
    ${reviewCard("灵修", [`灵修相关记录 ${spiritualDays} 天。`, ...textSnippets(items, ["spiritual"], 2)])}
    ${reviewCard("运动", [`运动相关记录 ${movementDays} 天，总时长约 ${movementMinutes || 0} 分钟。`, walkKm ? `散步/走路记录约 ${walkKm.toFixed(1)} 公里。` : "走路公里数暂时不多。", formatCounts(movement)])}
    ${reviewCard("庶务", [formatCounts(chores) || "洗澡、洗衣、排便、自我按摩还可以继续轻量记录。"])}
    ${reviewCard("身体与睡眠", [...textSnippets(items, ["body", "sleep"], 4)])}
    ${reviewCard("内在与能量", [...textSnippets(items, ["inner"], 4)])}
    ${reviewCard("清醒时间", [formatCounts(awakeCounts) || "还看不出明显流向。可以继续观察学习、兴趣项目、娱乐、购物、社交对状态的影响。"])}
    ${reviewCard("创造与灵感", [...textSnippets(items, ["creation", "inspiration"], 4)])}
    ${reviewCard("关系", [...textSnippets(items, ["relationship"], 3)])}
    ${reviewCard("下周温和小行动", suggestActions(items, movementDays, spiritualDays, chores))}
  `;
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

function formatCounts(counts) {
  const parts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `${key} ${count} 次`);
  return parts.join("，");
}

function suggestActions(items, movementDays, spiritualDays, chores) {
  const actions = [];
  if (spiritualDays < 3) actions.push("选一个很小的灵修入口，例如只读一小段或安静祷告两分钟。");
  if (movementDays < 3) actions.push("给身体一个低门槛动作：八段锦、拉伸或走路 10 分钟都算。");
  if (!chores["洗澡"] || !chores["排便"]) actions.push("把洗澡、排便这类基础照料先托住，不追求完美。");
  if (!items.some((record) => hasField(record, "creation"))) actions.push("保留一个小产出：一句话、一个问题、一个片段都可以。");
  return actions.slice(0, 3);
}

function switchView(viewId) {
  activeView = viewId;
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
  if (viewId === "history-view") renderHistory();
  if (viewId === "review-view") renderReview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function exportJson() {
  download(`life-log-backup-${todayKey()}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), records }, null, 2), "application/json");
}

function exportMarkdown() {
  const content = Object.values(records)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((record) => {
      const sections = fields
        .map((field) => {
          const value = record.fields?.[field.id] || {};
          const optionText = value.options?.length ? `\n选项：${value.options.join("，")}` : "";
          const metricText = value.metrics && Object.keys(value.metrics).length ? `\n数据：${Object.entries(value.metrics).map(([k, v]) => `${k} ${v}`).join("，")}` : "";
          const text = value.text?.trim() || "";
          return `### ${field.title}${optionText}${metricText}\n${text}`;
        })
        .join("\n\n");
      return `# ${record.date}\n\n${sections}\n`;
    })
    .join("\n---\n\n");
  download(`life-log-${todayKey()}.md`, content, "text/markdown");
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
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
      const incoming = Array.isArray(parsed.records) ? parsed.records : Array.isArray(parsed) ? parsed : Object.values(parsed.records || parsed);
      for (const item of incoming) {
        if (item?.date) records[item.date] = normalizeRecord(item);
      }
      persist();
      renderHistory();
      renderReview();
      saveStatus.textContent = "备份已导入。";
      switchView("today-view");
    } catch {
      alert("导入失败：这个文件不像 Life Log 备份。");
    }
  };
  reader.readAsText(file);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((registration) => {
    registration.update();
    if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!sessionStorage.getItem("life-log-reloaded")) {
      sessionStorage.setItem("life-log-reloaded", "1");
      window.location.reload();
    }
  });
}

function bindEvents() {
  form.addEventListener("input", () => {
    markInteraction();
    scheduleSave();
  });
  form.addEventListener("change", () => {
    markInteraction();
    scheduleSave();
  });
  document.addEventListener("click", markInteraction);
  document.addEventListener("touchstart", markInteraction, { passive: true });
  dateInput.addEventListener("change", () => switchDate(dateInput.value || todayKey()));
  $("#save-button").addEventListener("click", () => saveCurrent());
  $(".bottom-nav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (button) switchView(button.dataset.view);
  });
  $("#history-list").addEventListener("click", (event) => {
    const item = event.target.closest("[data-open-date]");
    if (item) {
      switchDate(item.dataset.openDate);
      switchView("today-view");
    }
  });
  $("#export-json").addEventListener("click", exportJson);
  $("#export-md").addEventListener("click", exportMarkdown);
  $("#import-file").addEventListener("change", (event) => importBackup(event.target.files[0]));
  document.addEventListener("visibilitychange", () => {
    addActiveDuration();
    if (document.visibilityState === "hidden") saveCurrent("已保存。");
  });
  setInterval(() => {
    addActiveDuration();
    updateDurationLabel();
  }, 15000);
}

function init() {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    currentDate = settings.currentDate || todayKey();
  } catch {
    currentDate = todayKey();
  }
  dateInput.value = currentDate;
  renderIndex();
  renderForm();
  renderHistory();
  renderReview();
  bindEvents();
  registerServiceWorker();
}

init();
