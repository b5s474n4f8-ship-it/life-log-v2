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
  await plainPage.click("#open-backup");
  assert.equal(await plainPage.locator("#sync-connect-form").isVisible(), true);
  await plain.close();

  const migrationContext = await configuredContext();
  const migrationPage = await migrationContext.newPage();
  await migrationPage.goto(appUrl);
  await migrationPage.fill("#note-input", "旧图标中的一条记录");
  await migrationPage.click("#save-note");
  await migrationPage.click("#open-backup");
  await migrationPage.fill("#sync-token", workerUrl + "/#sync=" + encodeURIComponent(token));
  await migrationPage.click("#sync-connect-form button[type=submit]");
  await migrationPage.waitForFunction(() => document.querySelector("#header-sync-mark")?.classList.contains("is-synced"));
  assert.equal(cloudState.notes.some((note) => note.text === "旧图标中的一条记录"), true);
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

  console.log("iPhone sync UI tests passed.");
} finally {
  await browser.close();
  server.close();
}
