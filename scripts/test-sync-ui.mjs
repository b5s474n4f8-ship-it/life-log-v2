import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(".");
const artifactDir = path.resolve("..", "life-log-v220-test-artifacts");
await fs.mkdir(artifactDir, { recursive: true });
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const file = path.resolve(root, relative);
    if (!file.startsWith(root)) throw new Error("invalid path");
    const body = await fs.readFile(file);
    response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const appUrl = `http://127.0.0.1:${port}/`;
const workerUrl = "https://life-log-sync.test";
const token = "ui-test-token-with-at-least-thirty-two-characters";
let cloudState = null;
let putCount = 0;

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true
});

async function configuredContext() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript((url) => { window.LIFE_LOG_SYNC_CONFIG = { workerUrl: url }; }, workerUrl);
  await context.route(workerUrl + "/state", async (route) => {
    const request = route.request();
    if (request.headers().authorization !== "Bearer " + token) {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "unauthorized" }) });
      return;
    }
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(cloudState ? {
          state: cloudState,
          schemaVersion: 2,
          deviceUpdatedAt: cloudState.meta.updatedAt,
          storedAt: new Date().toISOString()
        } : null)
      });
      return;
    }
    if (request.method() === "PUT") {
      const payload = JSON.parse(request.postData());
      cloudState = payload.state;
      putCount += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    await route.fulfill({ status: 204 });
  });
  return context;
}

try {
  const plain = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const plainPage = await plain.newPage();
  await plainPage.goto(appUrl);
  assert.equal(await plainPage.locator("[data-cloud-empty-state]").isVisible(), true);
  assert.equal((await plainPage.locator("[data-cloud-empty-state]").textContent()).includes("云端历史尚未载入"), true);
  await plainPage.click('[data-cloud-empty-action="connect"]');
  assert.equal(await plainPage.locator("#sync-connect-form").isVisible(), true);
  assert.equal((await plainPage.locator(".sync-token-field").textContent()).trim(), "私密激活链接");
  await plain.close();

  const cloudSeedContext = await configuredContext();
  const cloudSeedPage = await cloudSeedContext.newPage();
  await cloudSeedPage.goto(appUrl + "#sync=" + encodeURIComponent(token));
  await cloudSeedPage.waitForFunction(() => document.querySelector("#header-sync-mark")?.classList.contains("is-synced"));
  await cloudSeedPage.fill("#note-input", "云端已有历史记录");
  await cloudSeedPage.click("#save-note");
  await cloudSeedPage.waitForFunction(() => document.querySelector("#note-list")?.textContent.includes("云端已有历史记录"));
  await cloudSeedPage.click("#open-backup");
  await cloudSeedPage.click("#sync-now");
  await cloudSeedPage.waitForFunction(() => document.querySelector("#header-sync-mark")?.classList.contains("is-synced"));
  assert.equal(cloudState?.notes.some((note) => note.text === "云端已有历史记录"), true);
  await cloudSeedContext.close();

  const migrationContext = await configuredContext();
  const migrationPage = await migrationContext.newPage();
  await migrationPage.goto(appUrl);
  await migrationPage.fill("#note-input", "新入口本地记录");
  await migrationPage.click("#save-note");
  await migrationPage.click("#open-backup");
  await migrationPage.fill("#sync-token", workerUrl + "/#sync=" + encodeURIComponent(token));
  await migrationPage.click("#sync-connect-form button[type=submit]");
  await migrationPage.waitForFunction(() => document.querySelector("#header-sync-mark")?.classList.contains("is-synced"));
  assert.equal(cloudState.notes.some((note) => note.text === "云端已有历史记录"), true);
  assert.equal(cloudState.notes.some((note) => note.text === "新入口本地记录"), true);
  assert.equal(cloudState.notes.length, 2);
  await migrationContext.close();
  cloudState = null;
  putCount = 0;

  const context = await configuredContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(appUrl + "#sync=" + encodeURIComponent(token));
  await page.waitForFunction(() => !location.hash);
  await page.waitForFunction(() => document.querySelector("#header-sync-mark")?.classList.contains("is-synced"));
  assert.equal(cloudState, null);

  const monthThemes = await page.evaluate(() => {
    applyMonthTheme("2026-09");
    const september = {
      id: document.documentElement.dataset.monthTheme,
      accent: getComputedStyle(document.documentElement).getPropertyValue("--blue").trim()
    };
    applyMonthTheme("2026-10");
    const october = {
      id: document.documentElement.dataset.monthTheme,
      accent: getComputedStyle(document.documentElement).getPropertyValue("--blue").trim()
    };
    renderToday();
    return { september, october };
  });
  assert.deepEqual(monthThemes.september, { id: "september", accent: "#3f7b59" });
  assert.deepEqual(monthThemes.october, { id: "october", accent: "#b66731" });
  const brandStyle = await page.locator(".brand-mark").evaluate((element) => {
    const style = getComputedStyle(element);
    return { border: style.borderTopWidth, image: style.backgroundImage, size: style.backgroundSize };
  });
  assert.equal(brandStyle.border, "0px");
  assert.equal(brandStyle.image.includes("brand-art-v240.png"), true);
  assert.equal(brandStyle.size, "100% 100%");

  assert.equal(await page.locator(".daily-memo").isVisible(), false);
  assert.deepEqual(
    await page.locator("[data-core-tracker]").allTextContents(),
    ["睡眠", "运动", "身体", "梦境", "完成", "庶务"]
  );

  await page.click('[data-core-tracker="movement"]');
  assert.equal(await page.locator("#quick-entry-picker").isVisible(), false);
  await page.click('[data-field-choice="八段锦＋拍八虚"]');
  assert.equal(await page.locator('[data-field="durationMin"]').inputValue(), "16");
  await page.screenshot({ path: path.join(artifactDir, "iphone-movement.png"), fullPage: true });
  await page.click('#quick-form button[type="submit"]');
  await page.waitForFunction(() => document.querySelector("#note-list")?.textContent.includes("八段锦＋拍八虚 16m"));

  await page.click('[data-core-tracker="care"]');
  await page.click('[data-field-choice="洗澡"]');
  await page.click('[data-field-choice="排便"]');
  await page.click('[data-field-choice="按摩"]');
  await page.screenshot({ path: path.join(artifactDir, "iphone-care.png"), fullPage: true });
  await page.click('#quick-form button[type="submit"]');
  await page.waitForFunction(() => document.querySelector("#note-list")?.textContent.includes("洗澡、排便、按摩"));

  const todayTitle = await page.locator("#today-title").textContent();
  await page.click("#previous-today-day");
  assert.equal(await page.locator("#history-notice").isVisible(), true);
  assert.equal(await page.locator("#next-today-day").isEnabled(), true);
  await page.fill("#note-input", "补记到昨天，而不是今天");
  await page.click("#save-note");
  await page.click("#next-today-day");
  assert.equal(await page.locator("#today-title").textContent(), todayTitle);
  assert.equal(await page.locator("#next-today-day").isDisabled(), true);
  assert.equal((await page.locator("#note-list").textContent()).includes("补记到昨天，而不是今天"), false);

  const swipeDay = async (startX, endX) => page.evaluate(({ startX, endX }) => {
    const target = document.querySelector(".day-line");
    const dispatch = (type, x) => target.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 7,
      pointerType: "touch",
      isPrimary: true,
      clientX: x,
      clientY: 180
    }));
    dispatch("pointerdown", startX);
    dispatch("pointermove", endX);
    dispatch("pointerup", endX);
  }, { startX, endX });
  await swipeDay(330, 40);
  assert.equal(await page.locator("#history-notice").isVisible(), true);
  await swipeDay(40, 330);
  assert.equal(await page.locator("#today-title").textContent(), todayTitle);
  await page.fill("#note-input", "第一条自动同步记录");
  await page.click("#save-note");
  await page.waitForFunction(() => document.querySelector("#note-list")?.textContent.includes("第一条自动同步记录"));
  await page.waitForFunction(() => document.querySelector("#header-sync-mark")?.classList.contains("is-synced"));
  assert.equal(cloudState.notes.some((note) => note.text === "第一条自动同步记录"), true);

  const beforeOffline = putCount;
  await context.setOffline(true);
  await page.fill("#note-input", "离线后继续记录");
  await page.click("#save-note");
  await page.waitForFunction(() => document.querySelector("#note-list")?.textContent.includes("离线后继续记录"));
  await new Promise((resolve) => setTimeout(resolve, 1200));
  assert.equal(putCount, beforeOffline);

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForFunction(() => document.querySelector("#header-sync-mark")?.classList.contains("is-synced"));
  assert.equal(cloudState.notes.some((note) => note.text === "离线后继续记录"), true);

  const layout = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    noteFont: parseFloat(getComputedStyle(document.querySelector("#note-input")).fontSize),
    saveHeight: document.querySelector("#save-note").getBoundingClientRect().height
  }));
  assert.equal(layout.scrollWidth, layout.width);
  assert.ok(layout.noteFont >= 16);
  assert.ok(layout.saveHeight >= 44);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(artifactDir, "iphone-today.png"), fullPage: true });
  await page.click("#open-backup");
  await page.screenshot({ path: path.join(artifactDir, "iphone-sync-dialog.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: path.join(artifactDir, "desktop-sync-dialog.png"), fullPage: true });
  await context.close();

  const restoredContext = await configuredContext();
  const restoredPage = await restoredContext.newPage();
  await restoredPage.goto(appUrl + "#sync=" + encodeURIComponent(token));
  await restoredPage.waitForFunction(() => document.querySelector("#note-list")?.textContent.includes("离线后继续记录"));
  assert.equal(await restoredPage.evaluate(() => location.hash), "");
  await restoredContext.close();

  const compactContext = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const compactPage = await compactContext.newPage();
  await compactPage.goto(appUrl);
  const compactLayout = await compactPage.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    coreButtons: document.querySelectorAll("[data-core-tracker]").length,
    inputFont: parseFloat(getComputedStyle(document.querySelector("#note-input")).fontSize)
  }));
  assert.equal(compactLayout.scrollWidth, compactLayout.width);
  assert.equal(compactLayout.coreButtons, 6);
  assert.ok(compactLayout.inputFont >= 16);
  await compactPage.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await compactPage.reload();
  await compactContext.setOffline(true);
  await compactPage.reload({ waitUntil: "domcontentloaded" });
  assert.equal(await compactPage.locator("[data-core-tracker]").count(), 6);
  await compactContext.setOffline(false);
  await compactPage.screenshot({ path: path.join(artifactDir, "iphone-375-today.png"), fullPage: true });
  await compactPage.setViewportSize({ width: 1280, height: 900 });
  await compactPage.screenshot({ path: path.join(artifactDir, "desktop-today.png"), fullPage: true });
  await compactContext.close();

  console.log("iPhone sync UI tests passed.");
} finally {
  await browser.close();
  server.close();
}
