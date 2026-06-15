"use strict";

const STORAGE_KEY = "life-log-stable-v1";
const IDLE_LIMIT_MS = 2 * 60 * 1000;
const AUTOSAVE_DELAY_MS = 500;

const FIELD_DEFS = [
  {
    id: "memo",
    title: "备忘",
    prompt: "今天要做什么？有什么临时提醒、待办、约定，或脑中悬着的事？",
    description: "这不是任务管理系统。只是把一天开始和过程中出现的事项先放下来。",
  },
  {
    id: "spiritual",
    title: "灵修",
    prompt: "今天是否有灵修？有哪些触动、提醒、问题、挣扎或领受？",
    description: "记录与信仰、属灵生命和内在成长相关的内容。",
    optionsLabel: "基础选项",
    options: ["祷告", "读经", "默想", "敬拜", "阅读属灵读物"],
  },
  {
    id: "sleep",
    title: "睡眠",
    prompt: "昨晚睡了多久？睡眠是否连贯？醒来后恢复感如何？今天是否午休？",
    optionsLabel: "基础选项",
    options: ["睡得连贯", "易醒", "入睡困难", "恢复感好", "恢复感不足", "午休"],
    metrics: [
      { id: "sleepHours", label: "睡眠小时", type: "number", min: 0, step: 0.5 },
      { id: "napMinutes", label: "午休分钟", type: "number", min: 0, step: 5 },
    ],
  },
  {
    id: "body",
    title: "身体",
    prompt: "今天身体有哪些信号？例如疼痛、疲劳、浮肿、紧绷、胀气、经期、头痛、过敏、精力变化、放松或不适。",
    description: "只记录身体层面的观察和感受。",
  },
  {
    id: "chores",
    title: "庶务",
    prompt: "今天吃好、洗好、拉好了吗？生活有没有被基本托住？",
    optionsLabel: "基础选项",
    options: ["洗澡", "洗衣", "排便", "饮食", "自我按摩"],
  },
  {
    id: "movement",
    title: "运动",
    prompt: "今天是否有一点点活动？任何身体活动都算。",
    optionsLabel: "基础选项",
    options: ["八段锦", "普拉提", "跑步机上坡走", "散步", "拉伸", "HIIT", "力量训练", "其他"],
    metrics: [
      { id: "movementMinutes", label: "活动分钟", type: "number", min: 0, step: 5 },
      { id: "movementKm", label: "走路公里", type: "number", min: 0, step: 0.1 },
    ],
  },
  {
    id: "awake",
    title: "清醒时间",
    prompt: "今天不在工作和睡眠中的清醒时间，主要被什么占据？它把我带向安息、创造和连接，还是继续兴奋、疲劳和反刍？",
    description: "娱乐不是休息。真正恢复体力的是睡眠、治疗，以及能安心停下来的安息。",
    optionsLabel: "观察选项",
    options: ["学习", "副业", "兴趣项目", "娱乐", "购物", "社交"],
    note: "清醒余量尽量交给能积累的项目、真实连接和足够的体力消耗；身体真的用过，晚上才更容易既想睡，也敢睡。",
  },
  {
    id: "inner",
    title: "内在",
    prompt: "今天心里主要停留在哪里？有没有反刍、脑雾、混乱、安静、期待、压力或困惑？",
    description: "如果一个想法在脑中转超过一分钟，可以先说出来，再回来整理。",
  },
  {
    id: "energy",
    title: "能量",
    prompt: "什么恢复了我？什么消耗了我？哪些事让我更清明，哪些事让我更散乱？",
  },
  {
    id: "creation",
    title: "创造",
    prompt: "今天有什么从模糊想法变成了可保存、可复用、可继续加工的东西？一句话、一个判断、一个片段、一个 brief、一个小 artifact 都算。",
    description: "不记录工具动作本身，记录今天真正外化出来的东西。",
  },
  {
    id: "relationship",
    title: "关系",
    prompt: "今天有哪些人际互动、连接、疏离、支持、冲突或社交娱乐？这些互动对我产生了什么影响？",
  },
  {
    id: "free",
    title: "自由",
    prompt: "任何不属于以上分类，但希望未来回顾时能看到的内容。",
  },
];

const PRIMING_CARDS = [
  { id: "theme", title: "今日主线" },
  { id: "firstAction", title: "第一动作" },
  { id: "process", title: "过程画面" },
  { id: "resistance", title: "阻力预案" },
  { id: "support", title: "生活托底" },
  { id: "artifact", title: "今日产出" },
];

const KEYWORD_BANK = [
  "祷告",
  "读经",
  "敬拜",
  "睡眠",
  "疲惫",
  "恢复",
  "反刍",
  "脑雾",
  "创造",
  "输出",
  "散步",
  "上坡走",
  "普拉提",
  "洗澡",
  "洗衣",
  "排便",
  "饮食",
  "关系",
  "社交",
  "上帝",
  "家",
];

let store = loadStore();
let selectedDateKey = toDateKey(new Date());
let autosaveTimer = null;
let activeSession = null;
let lastActivityAt = 0;
let lastTimerPersistAt = 0;
let messageTimer = null;

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  reconcileOpenSessions();
  renderForm();
  bindEvents();
  setSelectedDate(selectedDateKey);
  renderAll();
  startTimerLoop();
  registerServiceWorker();
});

function cacheElements() {
  elements.primingDate = document.querySelector("#primingDate");
  elements.primingTranscript = document.querySelector("#primingTranscript");
  elements.primingSessionList = document.querySelector("#primingSessionList");
  elements.generatePriming = document.querySelector("#generatePriming");
  elements.savePriming = document.querySelector("#savePriming");
  elements.newPriming = document.querySelector("#newPriming");
  elements.primingCards = document.querySelector("#primingCards");
  elements.primingMessage = document.querySelector("#primingMessage");
  elements.writePrimingToMemo = document.querySelector("#writePrimingToMemo");
  elements.todayTitle = document.querySelector("#todayTitle");
  elements.todayWritingTime = document.querySelector("#todayWritingTime");
  elements.timerState = document.querySelector("#timerState");
  elements.dateInput = document.querySelector("#dateInput");
  elements.entryToc = document.querySelector("#entryToc");
  elements.entryForm = document.querySelector("#entryForm");
  elements.saveEntry = document.querySelector("#saveEntry");
  elements.saveMessage = document.querySelector("#saveMessage");
  elements.historyList = document.querySelector("#historyList");
  elements.weeklyReview = document.querySelector("#weeklyReview");
  elements.exportJson = document.querySelector("#exportJson");
  elements.exportJsonTop = document.querySelector("#exportJsonTop");
  elements.exportMarkdown = document.querySelector("#exportMarkdown");
  elements.importJson = document.querySelector("#importJson");
  elements.prevDay = document.querySelector("#prevDay");
  elements.nextDay = document.querySelector("#nextDay");
}

function bindEvents() {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  elements.dateInput.addEventListener("change", () => {
    finalizeActiveSession();
    setSelectedDate(elements.dateInput.value || toDateKey(new Date()));
    renderAll();
  });

  elements.prevDay.addEventListener("click", () => {
    finalizeActiveSession();
    setSelectedDate(shiftDateKey(selectedDateKey, -1));
    renderAll();
  });

  elements.nextDay.addEventListener("click", () => {
    finalizeActiveSession();
    setSelectedDate(shiftDateKey(selectedDateKey, 1));
    renderAll();
  });

  elements.entryForm.addEventListener("input", handleFormActivity);
  elements.entryForm.addEventListener("change", handleFormActivity);
  elements.entryForm.addEventListener("focusin", beginWritingActivity);
  elements.entryForm.addEventListener("touchstart", beginWritingActivity, { passive: true });
  elements.entryForm.addEventListener("click", beginWritingActivity);

  elements.saveEntry.addEventListener("click", () => {
    saveCurrentEntry({ manual: true });
    showMessage(elements.saveMessage, "已保存。", 1800);
  });

  elements.primingTranscript.addEventListener("input", () => savePriming({ quiet: true }));
  elements.generatePriming.addEventListener("click", generatePrimingCards);
  elements.savePriming.addEventListener("click", () => savePriming({ quiet: false }));
  elements.newPriming.addEventListener("click", newPrimingSession);
  elements.writePrimingToMemo.addEventListener("click", writePrimingToMemo);

  elements.exportJson.addEventListener("click", exportJsonBackup);
  elements.exportJsonTop.addEventListener("click", exportJsonBackup);
  elements.exportMarkdown.addEventListener("click", exportMarkdown);
  elements.importJson.addEventListener("change", importJsonBackup);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persistAndFinalize();
  });
  window.addEventListener("pagehide", persistAndFinalize);
  window.addEventListener("beforeunload", persistAndFinalize);
}

function renderForm() {
  elements.entryForm.innerHTML = FIELD_DEFS.map((field) => {
    const optionsMarkup = field.options?.length
      ? `
        <div class="option-group">
          <p class="option-label">${escapeHtml(field.optionsLabel || "可多选")}</p>
          <div class="chips">
            ${field.options
              .map(
                (option) => `
                  <label class="chip">
                    <input type="checkbox" name="${field.id}__option" value="${escapeAttribute(option)}" />
                    <span>${escapeHtml(option)}</span>
                  </label>
                `,
              )
              .join("")}
          </div>
        </div>
      `
      : "";

    const metricsMarkup = field.metrics?.length
      ? `
        <div class="metric-grid">
          ${field.metrics
            .map(
              (metric) => `
                <label class="metric-field">
                  <span>${escapeHtml(metric.label)}</span>
                  <input type="${metric.type || "text"}" name="${field.id}__metric__${metric.id}" min="${metric.min ?? ""}" step="${metric.step ?? ""}" inputmode="decimal" />
                </label>
              `,
            )
            .join("")}
        </div>
      `
      : "";

    return `
      <section class="field-card" data-field-id="${field.id}">
        <div class="field-header">
          <div class="field-title-row">
            <h3>${escapeHtml(field.title)}</h3>
            <span class="empty-hint">可留空</span>
          </div>
          <p class="prompt">${escapeHtml(field.prompt)}</p>
          ${field.description ? `<p class="description">${escapeHtml(field.description)}</p>` : ""}
          ${field.note ? `<p class="note">${escapeHtml(field.note)}</p>` : ""}
        </div>
        ${optionsMarkup}
        ${metricsMarkup}
        <textarea name="${field.id}__text" placeholder="写一两句就可以。"></textarea>
      </section>
    `;
  }).join("");
  renderEntryToc();
}

function renderEntryToc() {
  elements.entryToc.innerHTML = FIELD_DEFS.map(
    (field) => `<button class="toc-button" type="button" data-field-id="${field.id}">${escapeHtml(field.title)}</button>`,
  ).join("");

  elements.entryToc.querySelectorAll(".toc-button").forEach((button) => {
    button.addEventListener("click", () => {
      const card = elements.entryForm.querySelector(`[data-field-id="${button.dataset.fieldId}"]`);
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => card.querySelector("textarea")?.focus({ preventScroll: true }), 250);
    });
  });
}

function renderAll() {
  elements.primingDate.textContent = formatDateTitle(selectedDateKey);
  renderPriming();
  renderTodayHeader();
  renderEntryIntoForm();
  renderTimer();
  renderLibrary();
  renderWeeklyReview();
}

function renderTodayHeader() {
  elements.todayTitle.textContent = formatDateTitle(selectedDateKey);
  elements.dateInput.value = selectedDateKey;
}

function renderEntryIntoForm() {
  const entry = getEntry(selectedDateKey, false);
  FIELD_DEFS.forEach((field) => {
    const value = getFieldValue(entry, field.id);
    const textarea = elements.entryForm.querySelector(`[name="${field.id}__text"]`);
    if (textarea) textarea.value = value.text || "";

    elements.entryForm.querySelectorAll(`[name="${field.id}__option"]`).forEach((input) => {
      input.checked = Array.isArray(value.options) && value.options.includes(input.value);
    });

    field.metrics?.forEach((metric) => {
      const input = elements.entryForm.querySelector(`[name="${field.id}__metric__${metric.id}"]`);
      if (input) input.value = value.metrics?.[metric.id] ?? "";
    });
  });
}

function renderPriming() {
  const session = getActivePrimingSession(false);
  elements.primingTranscript.value = session?.rawTranscript || "";
  renderPrimingCards(session?.cards || []);
  renderPrimingSessionList();
}

function renderPrimingSessionList() {
  const record = getPriming(selectedDateKey, false);
  const sessions = getPrimingSessions(record);
  if (!sessions.length) {
    elements.primingSessionList.innerHTML = `<span class="muted">今天还没有热启动。</span>`;
    return;
  }

  const activeId = record?.activeSessionId || sessions[sessions.length - 1]?.id;
  elements.primingSessionList.innerHTML = sessions
    .map((session, index) => {
      const label = session.createdAt ? formatTime(new Date(session.createdAt)) : `第${index + 1}次`;
      return `<button class="session-button ${session.id === activeId ? "active" : ""}" type="button" data-session-id="${session.id}">${escapeHtml(label)}</button>`;
    })
    .join("");

  elements.primingSessionList.querySelectorAll(".session-button").forEach((button) => {
    button.addEventListener("click", () => {
      savePriming({ quiet: true });
      const nextRecord = getPriming(selectedDateKey, true);
      nextRecord.activeSessionId = button.dataset.sessionId;
      saveStore();
      renderPriming();
    });
  });
}

function renderPrimingCards(cards) {
  if (!cards.length) {
    elements.primingCards.innerHTML = `<p class="empty-state">还没有生成今日卡片。先粘贴一段 Typeless 转写。</p>`;
    return;
  }

  elements.primingCards.innerHTML = PRIMING_CARDS.map((def) => {
    const card = cards.find((item) => item.id === def.id) || { id: def.id, title: def.title, text: "" };
    return `
      <section class="review-card priming-card">
        <h3>${escapeHtml(card.title || def.title)}</h3>
        <textarea data-card-id="${def.id}" placeholder="可以手动调整这张卡。">${escapeHtml(card.text || "")}</textarea>
      </section>
    `;
  }).join("");

  elements.primingCards.querySelectorAll("textarea").forEach((textarea) => {
    textarea.addEventListener("input", () => savePriming({ quiet: true }));
  });
}

function generatePrimingCards() {
  const raw = elements.primingTranscript.value.trim();
  if (!raw) {
    showMessage(elements.primingMessage, "先粘贴一段转写。", 1600);
    return;
  }

  const sentences = splitSentences(raw);
  const cards = [
    makeCard("theme", "今日主线", pickSentence(sentences, ["今天", "主线", "重要", "目标"]) || firstChunk(raw)),
    makeCard("firstAction", "第一动作", pickSentence(sentences, ["第一步", "先", "开始", "打开", "坐下"]) || "先做一个能启动的最小动作。"),
    makeCard("process", "过程画面", pickSentence(sentences, ["过程", "在哪里", "怎么", "然后", "显化"]) || "把地点、动作和顺序说具体，而不是只想结果。"),
    makeCard("resistance", "阻力预案", pickSentence(sentences, ["卡住", "阻力", "反刍", "手机", "刷"]) || "如果开始反刍或想刷手机，就先开口说一分钟。"),
    makeCard("support", "生活托底", pickSentence(sentences, ["灵修", "睡眠", "运动", "庶务", "饮食", "洗澡", "排便"]) || "用灵修、睡眠、运动和庶务托住今天。"),
    makeCard("artifact", "今日产出", pickSentence(sentences, ["输出", "创造", "沉淀", "语料", "artifact", "作品"]) || "至少沉淀一个可保存、可复用的小产出。"),
  ];

  renderPrimingCards(cards);
  savePriming({ quiet: true, cards });
  showMessage(elements.primingMessage, "已生成今日卡片。", 1600);
}

function makeCard(id, title, text) {
  return { id, title, text };
}

function savePriming({ quiet, cards } = {}) {
  const rawTranscript = elements.primingTranscript.value;
  const nextCards = cards || readPrimingCards();
  const existing = getPriming(selectedDateKey, false);
  if (quiet && !existing && !rawTranscript.trim() && !nextCards.length) return;

  const record = getPriming(selectedDateKey, true);
  const session = getActivePrimingSession(true);
  session.rawTranscript = rawTranscript;
  session.cards = nextCards;
  session.updatedAt = new Date().toISOString();
  record.updatedAt = new Date().toISOString();
  saveStore();
  renderPrimingSessionList();
  renderLibrary();
  renderWeeklyReview();
  if (!quiet) showMessage(elements.primingMessage, "已保存热启动。", 1600);
}

function newPrimingSession() {
  savePriming({ quiet: true });
  const record = getPriming(selectedDateKey, true);
  const session = createPrimingSession();
  record.sessions = getPrimingSessions(record);
  record.sessions.push(session);
  record.activeSessionId = session.id;
  record.updatedAt = new Date().toISOString();
  elements.primingTranscript.value = "";
  renderPrimingCards([]);
  saveStore();
  renderPriming();
  showMessage(elements.primingMessage, "已新建一次热启动。", 1400);
}

function readPrimingCards() {
  return PRIMING_CARDS.map((def) => {
    const textarea = elements.primingCards.querySelector(`[data-card-id="${def.id}"]`);
    return { id: def.id, title: def.title, text: textarea?.value || "" };
  }).filter((card) => card.text.trim());
}

function writePrimingToMemo() {
  savePriming({ quiet: true });
  const session = getActivePrimingSession(false);
  if (!session || (!session.rawTranscript && !session.cards?.length)) {
    showMessage(elements.primingMessage, "还没有可写入的热启动内容。", 1800);
    return;
  }

  const summary = [
    "【热启动】",
    ...(session.cards || []).map((card) => `${card.title}：${card.text}`),
  ].join("\n");

  const entry = getEntry(selectedDateKey, true);
  const existingMemo = getFieldValue(entry, "memo");
  entry.fields = entry.fields || {};
  entry.fields.memo = {
    text: [existingMemo.text, summary].filter(Boolean).join("\n\n"),
    options: existingMemo.options || [],
    metrics: existingMemo.metrics || {},
  };
  entry.updatedAt = new Date().toISOString();
  saveStore();
  renderEntryIntoForm();
  renderLibrary();
  switchView("todayView");
}

function renderTimer() {
  const entry = getEntry(selectedDateKey, false);
  const total = (entry?.totalWritingSeconds || 0) + getLiveSessionSeconds();
  elements.todayWritingTime.textContent = formatDuration(total);
  elements.timerState.textContent = activeSession ? "正在记录" : total > 0 ? "已暂停" : "未开始";
}

function renderLibrary() {
  const dates = Array.from(new Set([...Object.keys(store.entries || {}), ...Object.keys(store.priming || {})])).sort((a, b) => b.localeCompare(a));

  if (!dates.length) {
    elements.historyList.innerHTML = `<p class="empty-state">还没有记录。先做一次热启动或今日记录。</p>`;
    return;
  }

  elements.historyList.innerHTML = dates
    .map((date) => {
      const entry = store.entries?.[date];
      const priming = store.priming?.[date];
      const primingSessions = getPrimingSessions(priming);
      const recordedTitles = FIELD_DEFS.filter((field) => hasFieldContent(getFieldValue(entry, field.id))).map((field) => field.title);
      const bits = [];
      if (primingSessions.length) bits.push(`热启动 ${primingSessions.length}次`);
      if (recordedTitles.length) bits.push(recordedTitles.join("、"));
      return `
        <button class="history-card" type="button" data-date="${date}">
          <strong>${formatDateTitle(date)}</strong>
          <p>${bits.length ? escapeHtml(bits.join("；")) : "有日期，还没有具体内容"}</p>
          <p>记录用时：${formatDuration(entry?.totalWritingSeconds || 0)}</p>
        </button>
      `;
    })
    .join("");

  elements.historyList.querySelectorAll(".history-card").forEach((card) => {
    card.addEventListener("click", () => {
      finalizeActiveSession();
      setSelectedDate(card.dataset.date);
      renderAll();
      switchView("todayView");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function renderWeeklyReview() {
  const recentKeys = getRecentDateKeys(7);
  const entries = recentKeys.map((key) => store.entries?.[key]).filter(Boolean);
  const primings = recentKeys.flatMap((key) => getPrimingSessions(store.priming?.[key])).filter((item) => item && (item.rawTranscript || item.cards?.length));
  const recordedEntries = entries.filter(entryHasAnyContent);
  const totalWritingSeconds = entries.reduce((sum, entry) => sum + (entry.totalWritingSeconds || 0), 0);
  const cards = [
    reviewCard(
      "概览",
      `
        <p>本周记录 ${recordedEntries.length} 天，热启动 ${primings.length} 次。</p>
        <p>总记录用时约 ${formatDuration(totalWritingSeconds)}。</p>
        <p>${recordedEntries.length < 3 ? "数据还不多，先继续记录。" : "复盘只做观察，不做评判。"}</p>
      `,
    ),
    reviewCard("常见主题", getWeeklyKeywords(entries, primings).length ? listMarkup(getWeeklyKeywords(entries, primings)) : "<p>暂时还没有足够关键词。</p>"),
  ];

  FIELD_DEFS.forEach((field) => {
    cards.push(reviewCard(field.title, buildFieldReview(field, entries)));
  });

  cards.push(reviewCard("下周小行动", orderedListMarkup(suggestNextActions(entries, primings))));
  elements.weeklyReview.innerHTML = cards.join("");
}

function buildFieldReview(field, entries) {
  const fieldEntries = entries
    .map((entry) => ({ entry, value: getFieldValue(entry, field.id) }))
    .filter(({ value }) => hasFieldContent(value));
  const days = fieldEntries.length;
  if (!days) return `<p>本周没有${escapeHtml(field.title)}记录。</p>`;

  const optionCounts = countOptions(fieldEntries.map(({ value }) => value));
  const topOptions = Object.entries(optionCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${label} ${count}天`);

  if (field.id === "spiritual") {
    return `<p>本周有灵修记录 ${days} 天。</p>${topOptions.length ? `<p>${escapeHtml(topOptions.join("，"))}。</p>` : ""}`;
  }

  if (field.id === "sleep") {
    const hours = numericMetrics(fieldEntries, "sleepHours");
    const naps = numericMetrics(fieldEntries, "napMinutes");
    return `
      <p>本周有睡眠记录 ${days} 天。</p>
      ${hours.length ? `<p>平均睡眠约 ${roundOne(average(hours))} 小时。</p>` : ""}
      ${sum(naps) > 0 ? `<p>午休总计约 ${sum(naps)} 分钟。</p>` : ""}
      ${topOptions.length ? `<p>${escapeHtml(topOptions.join("，"))}。</p>` : ""}
    `;
  }

  if (field.id === "chores") {
    return `
      <p>本周有庶务记录 ${days} 天。</p>
      ${topOptions.length ? `<p>${escapeHtml(topOptions.join("，"))}。</p>` : ""}
    `;
  }

  if (field.id === "movement") {
    const minutes = numericMetrics(fieldEntries, "movementMinutes");
    const kms = numericMetrics(fieldEntries, "movementKm");
    return `
      <p>本周有运动记录 ${days} 天。</p>
      ${sum(minutes) > 0 ? `<p>活动时间约 ${sum(minutes)} 分钟。</p>` : ""}
      ${sum(kms) > 0 ? `<p>走路距离约 ${roundOne(sum(kms))} 公里。</p>` : ""}
      ${topOptions.length ? `<p>${escapeHtml(topOptions.join("，"))}。</p>` : ""}
    `;
  }

  if (field.id === "awake") {
    return `
      <p>本周有清醒时间记录 ${days} 天。</p>
      ${topOptions.length ? `<p>${escapeHtml(topOptions.join("，"))}。</p>` : ""}
      <p>重点看清醒时间是否更少滑向反刍和纯消费，更多转向创造、连接、庶务和真正能睡下来的安息。</p>
    `;
  }

  return `
    <p>本周有${escapeHtml(field.title)}记录 ${days} 天。</p>
    ${topOptions.length ? `<p>${escapeHtml(topOptions.join("，"))}。</p>` : ""}
    ${extractShortLines(fieldEntries, 3, "可回看的片段")}
  `;
}

function handleFormActivity() {
  beginWritingActivity();
  saveCurrentEntry({ manual: false });
}

function beginWritingActivity() {
  lastActivityAt = Date.now();
  if (activeSession) {
    activeSession.lastActivityAt = lastActivityAt;
    return;
  }

  activeSession = {
    id: createId(),
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    lastActivityAt,
    lastTickAt: Date.now(),
    accumulatedSeconds: 0,
  };

  const entry = getEntry(selectedDateKey, true);
  entry.activeSession = { ...activeSession };
  saveStore();
  renderTimer();
}

function startTimerLoop() {
  window.setInterval(() => {
    if (!activeSession) {
      renderTimer();
      return;
    }

    const now = Date.now();
    if (now - lastActivityAt > IDLE_LIMIT_MS) {
      finalizeActiveSession();
      return;
    }

    activeSession.accumulatedSeconds += Math.max(0, Math.min(5, (now - activeSession.lastTickAt) / 1000));
    activeSession.lastTickAt = now;

    if (now - lastTimerPersistAt > 5000) {
      const entry = getEntry(selectedDateKey, true);
      entry.activeSession = { ...activeSession };
      saveStore();
      lastTimerPersistAt = now;
    }
    renderTimer();
  }, 1000);
}

function persistAndFinalize() {
  persistCurrentEntry({ manual: false });
  finalizeActiveSession();
  savePriming({ quiet: true });
}

function finalizeActiveSession() {
  if (!activeSession) return;

  const now = Date.now();
  activeSession.accumulatedSeconds += Math.max(0, Math.min(5, (now - activeSession.lastTickAt) / 1000));
  activeSession.lastTickAt = now;

  const durationSeconds = Math.round(activeSession.accumulatedSeconds);
  const entry = getEntry(selectedDateKey, true);
  entry.sessions = Array.isArray(entry.sessions) ? entry.sessions : [];

  if (durationSeconds > 0) {
    entry.sessions.push({
      id: activeSession.id,
      startedAt: activeSession.startedAt,
      endedAt: new Date(activeSession.lastTickAt).toISOString(),
      durationSeconds,
    });
    entry.totalWritingSeconds = (entry.totalWritingSeconds || 0) + durationSeconds;
  }

  entry.activeSession = null;
  entry.updatedAt = new Date().toISOString();
  activeSession = null;
  saveStore();
  renderTimer();
}

function getLiveSessionSeconds() {
  return activeSession ? Math.round(activeSession.accumulatedSeconds) : 0;
}

function saveCurrentEntry({ manual }) {
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    persistCurrentEntry({ manual });
    renderLibrary();
    renderWeeklyReview();
    if (!manual) showMessage(elements.saveMessage, "已自动保存。", 900);
  }, manual ? 0 : AUTOSAVE_DELAY_MS);
}

function persistCurrentEntry({ manual }) {
  const fields = readFormFields();
  const existingEntry = getEntry(selectedDateKey, false);
  if (!manual && !activeSession && !existingEntry && !fieldsHaveAnyContent(fields)) return;

  const entry = getEntry(selectedDateKey, true);
  entry.fields = { ...(entry.fields || {}), ...fields };
  entry.updatedAt = new Date().toISOString();
  if (manual) entry.manualSavedAt = new Date().toISOString();
  if (activeSession) entry.activeSession = { ...activeSession };
  saveStore();
}

function readFormFields() {
  const fields = {};
  FIELD_DEFS.forEach((field) => {
    const text = elements.entryForm.querySelector(`[name="${field.id}__text"]`)?.value || "";
    const options = Array.from(elements.entryForm.querySelectorAll(`[name="${field.id}__option"]:checked`)).map((input) => input.value);
    const metrics = {};
    field.metrics?.forEach((metric) => {
      const raw = elements.entryForm.querySelector(`[name="${field.id}__metric__${metric.id}"]`)?.value || "";
      metrics[metric.id] = raw === "" ? "" : Number(raw);
    });
    fields[field.id] = { text, options, metrics };
  });
  return fields;
}

function getEntry(dateKey, createIfMissing) {
  store.entries = store.entries || {};
  if (!store.entries[dateKey] && createIfMissing) {
    store.entries[dateKey] = {
      date: dateKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalWritingSeconds: 0,
      sessions: [],
      fields: {},
    };
  }
  return store.entries[dateKey];
}

function getPriming(dateKey, createIfMissing) {
  store.priming = store.priming || {};
  if (!store.priming[dateKey] && createIfMissing) {
    store.priming[dateKey] = {
      date: dateKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rawTranscript: "",
      cards: [],
    };
  }
  return store.priming[dateKey];
}

function getPrimingSessions(record) {
  if (!record) return [];
  if (Array.isArray(record.sessions)) return record.sessions;
  if (record.rawTranscript || record.cards?.length) {
    return [
      {
        id: record.activeSessionId || createId(),
        createdAt: record.createdAt || record.updatedAt || new Date().toISOString(),
        updatedAt: record.updatedAt || new Date().toISOString(),
        rawTranscript: record.rawTranscript || "",
        cards: record.cards || [],
      },
    ];
  }
  return [];
}

function getActivePrimingSession(createIfMissing) {
  const record = getPriming(selectedDateKey, createIfMissing);
  if (!record) return null;

  record.sessions = getPrimingSessions(record);
  if (!record.sessions.length && createIfMissing) {
    record.sessions.push(createPrimingSession());
  }

  if (!record.activeSessionId && record.sessions.length) {
    record.activeSessionId = record.sessions[record.sessions.length - 1].id;
  }

  let session = record.sessions.find((item) => item.id === record.activeSessionId);
  if (!session && record.sessions.length) {
    session = record.sessions[record.sessions.length - 1];
    record.activeSessionId = session.id;
  }
  return session || null;
}

function createPrimingSession() {
  const now = new Date().toISOString();
  return {
    id: createId(),
    createdAt: now,
    updatedAt: now,
    rawTranscript: "",
    cards: [],
  };
}

function setSelectedDate(dateKey) {
  selectedDateKey = dateKey || toDateKey(new Date());
  elements.dateInput.value = selectedDateKey;
}

function switchView(viewId) {
  if (viewId !== "todayView") finalizeActiveSession();
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
  renderLibrary();
  renderWeeklyReview();
}

function loadStore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 2, entries: {}, priming: {} };
    const parsed = JSON.parse(raw);
    return { version: 2, entries: parsed.entries || {}, priming: parsed.priming || {} };
  } catch {
    return { version: 2, entries: {}, priming: {} };
  }
}

function saveStore() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function reconcileOpenSessions() {
  Object.values(store.entries || {}).forEach((entry) => {
    const session = entry.activeSession;
    if (!session) return;
    const durationSeconds = Math.round(Number(session.accumulatedSeconds || 0));
    entry.sessions = Array.isArray(entry.sessions) ? entry.sessions : [];
    if (durationSeconds > 0) {
      entry.sessions.push({
        id: session.id || createId(),
        startedAt: session.startedAt || entry.updatedAt || new Date().toISOString(),
        endedAt: session.lastTickAt ? new Date(session.lastTickAt).toISOString() : entry.updatedAt || new Date().toISOString(),
        durationSeconds,
      });
      entry.totalWritingSeconds = (entry.totalWritingSeconds || 0) + durationSeconds;
    }
    entry.activeSession = null;
  });
  saveStore();
}

function exportJsonBackup() {
  finalizeActiveSession();
  savePriming({ quiet: true });
  const payload = { ...store, exportedAt: new Date().toISOString(), app: "life-log-stable" };
  downloadFile(`life-log-backup-${toDateKey(new Date())}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function exportMarkdown() {
  finalizeActiveSession();
  savePriming({ quiet: true });
  const dates = Array.from(new Set([...Object.keys(store.entries || {}), ...Object.keys(store.priming || {})])).sort();
  const lines = ["# 生命力日志导出", "", `导出时间：${formatDateTime(new Date())}`, ""];

  dates.forEach((date) => {
    const entry = store.entries?.[date];
    const priming = store.priming?.[date];
    const primingSessions = getPrimingSessions(priming);
    lines.push(`## ${formatDateTitle(date)}`);

    if (primingSessions.length) {
      lines.push("### 热启动");
      primingSessions.forEach((session, index) => {
        lines.push(`#### 第 ${index + 1} 次`);
        session.cards?.forEach((card) => {
          if (card.text?.trim()) lines.push(`- ${card.title}：${card.text.trim()}`);
        });
        if (session.rawTranscript?.trim()) lines.push("", session.rawTranscript.trim());
        lines.push("");
      });
    }

    if (entry) {
      lines.push(`记录用时：${formatDuration(entry.totalWritingSeconds || 0)}`, "");
      FIELD_DEFS.forEach((field) => {
        const value = getFieldValue(entry, field.id);
        if (!hasFieldContent(value)) return;
        lines.push(`### ${field.title}`);
        if (value.options?.length) lines.push(`标签：${value.options.join("、")}`);
        const metricText = formatMetricLine(field, value.metrics);
        if (metricText) lines.push(metricText);
        if (value.text?.trim()) lines.push(value.text.trim());
        lines.push("");
      });
    }
  });

  downloadFile(`life-log-${toDateKey(new Date())}.md`, lines.join("\n"), "text/markdown");
}

function importJsonBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result || "{}"));
      if (!imported.entries && !imported.priming) {
        window.alert("没有识别到可导入的记录。");
        return;
      }
      store.entries = { ...store.entries, ...(imported.entries || {}) };
      store.priming = { ...store.priming, ...(imported.priming || {}) };
      store.version = 2;
      saveStore();
      renderAll();
      window.alert("导入完成。");
    } catch {
      window.alert("导入失败。请确认选择的是 JSON 备份。");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getWeeklyKeywords(entries, primings) {
  const counts = {};
  entries.forEach((entry) => {
    FIELD_DEFS.forEach((field) => {
      const value = getFieldValue(entry, field.id);
      value.options?.forEach((option) => addCount(counts, option, 1));
      const text = value.text || "";
      KEYWORD_BANK.forEach((keyword) => {
        if (text.includes(keyword)) addCount(counts, keyword, 1);
      });
    });
  });
  primings.forEach((priming) => {
    const text = [priming.rawTranscript, ...(priming.cards || []).map((card) => card.text)].join(" ");
    KEYWORD_BANK.forEach((keyword) => {
      if (text.includes(keyword)) addCount(counts, keyword, 1);
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword, count]) => `${keyword} ${count}次`);
}

function suggestNextActions(entries, primings) {
  const actions = [];
  const primingCount = primings.length;
  const movementMinutes = sum(entries.map((entry) => Number(getFieldValue(entry, "movement").metrics?.movementMinutes || 0)));
  const choresDays = entries.filter((entry) => hasFieldContent(getFieldValue(entry, "chores"))).length;
  const creationDays = entries.filter((entry) => hasFieldContent(getFieldValue(entry, "creation"))).length;

  if (primingCount < 3) actions.push("下周先做 3 次热启动，每次只要求说出过程，不要求完整。");
  if (movementMinutes < 60) actions.push("保留一点体力消耗：八段锦、普拉提、上坡走或散步都可以。");
  if (choresDays < 3) actions.push("庶务只记录四件基础事：洗澡、洗衣、排便、饮食。");
  if (creationDays < 3) actions.push("每天至少沉淀一个可复用的小产出，可以只是一句话或一个 brief。");
  if (!actions.length) actions.push("保持当前节奏，不需要额外加任务。");
  return actions.slice(0, 3);
}

function extractShortLines(fieldEntries, limit, title) {
  const snippets = [];
  fieldEntries.forEach(({ value }) => {
    const sentences = splitSentences(value.text || "");
    sentences.forEach((sentence) => {
      if (snippets.length < limit) snippets.push(sentence.length > 42 ? `${sentence.slice(0, 42)}...` : sentence);
    });
  });
  return snippets.length ? `<p>${escapeHtml(title)}：</p>${listMarkup(snippets)}` : "";
}

function reviewCard(title, body) {
  return `<section class="review-card"><h3>${escapeHtml(title)}</h3>${body}</section>`;
}

function listMarkup(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function orderedListMarkup(items) {
  return `<ol>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
}

function countOptions(values) {
  const counts = {};
  values.forEach((value) => value.options?.forEach((option) => addCount(counts, option, 1)));
  return counts;
}

function addCount(counts, key, amount) {
  counts[key] = (counts[key] || 0) + amount;
}

function numericMetrics(fieldEntries, metricId) {
  return fieldEntries.map(({ value }) => Number(value.metrics?.[metricId])).filter((number) => Number.isFinite(number) && number > 0);
}

function formatMetricLine(field, metrics = {}) {
  const parts = [];
  field.metrics?.forEach((metric) => {
    const value = metrics[metric.id];
    if (value === "" || value === undefined || value === null) return;
    parts.push(`${metric.label}：${value}`);
  });
  return parts.length ? parts.join("；") : "";
}

function getFieldValue(entry, fieldId) {
  if (!entry) return {};
  const value = entry.fields?.[fieldId] || {};

  if (fieldId === "chores") {
    return mergeValues(value, entry.fields?.food, entry.fields?.care);
  }
  if (fieldId === "awake") {
    return mergeValues(value, entry.fields?.rest);
  }
  if (fieldId === "creation") {
    return mergeValues(value, entry.fields?.inspiration);
  }
  if (fieldId === "free") {
    const free = { ...value, options: value.options || [], metrics: value.metrics || {} };
    const dream = entry.fields?.dream;
    if (hasFieldContent(dream) && !(free.text || "").includes("旧梦境记录")) {
      free.text = [free.text, `旧梦境记录：\n${dream.text || ""}`].filter(Boolean).join("\n\n");
      free.options = Array.from(new Set([...(free.options || []), ...(dream.options || [])]));
    }
    return free;
  }
  return value;
}

function mergeValues(...values) {
  const valid = values.filter((value) => hasFieldContent(value));
  if (!valid.length) return values[0] || {};
  return {
    text: valid.map((value) => value.text).filter((text) => text && text.trim()).join("\n\n"),
    options: Array.from(new Set(valid.flatMap((value) => value.options || []))),
    metrics: Object.assign({}, ...valid.map((value) => value.metrics || {})),
  };
}

function hasFieldContent(value) {
  if (!value) return false;
  if (value.text && value.text.trim()) return true;
  if (value.options && value.options.length) return true;
  if (value.metrics) return Object.values(value.metrics).some((metric) => metric !== "" && metric !== null && metric !== undefined && Number(metric) > 0);
  return false;
}

function fieldsHaveAnyContent(fields) {
  return FIELD_DEFS.some((field) => hasFieldContent(fields?.[field.id]));
}

function entryHasAnyContent(entry) {
  return Boolean(entry && FIELD_DEFS.some((field) => hasFieldContent(getFieldValue(entry, field.id))));
}

function average(numbers) {
  return numbers.length ? sum(numbers) / numbers.length : 0;
}

function sum(numbers) {
  return numbers.reduce((total, number) => total + Number(number || 0), 0);
}

function roundOne(number) {
  return Math.round(number * 10) / 10;
}

function splitSentences(text) {
  return String(text || "")
    .split(/[。！？!?;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pickSentence(sentences, keywords) {
  return sentences.find((sentence) => keywords.some((keyword) => sentence.includes(keyword))) || "";
}

function firstChunk(text) {
  const sentence = splitSentences(text)[0] || text;
  return sentence.length > 80 ? `${sentence.slice(0, 80)}...` : sentence;
}

function showMessage(target, message, timeout = 1800) {
  window.clearTimeout(messageTimer);
  target.textContent = message;
  messageTimer = window.setTimeout(() => {
    target.textContent = "";
  }, timeout);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDateKey(dateKey, amount) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getRecentDateKeys(dayCount) {
  const today = new Date();
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    return toDateKey(date);
  });
}

function formatDateTitle(dateKey) {
  return parseDateKey(dateKey).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function formatDateTime(date) {
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(date) {
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}小时${minutes}分钟`;
  if (minutes > 0) return `${minutes}分钟`;
  return seconds > 0 ? "少于1分钟" : "0分钟";
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
