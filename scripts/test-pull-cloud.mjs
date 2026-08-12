import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const token = "test-token-with-at-least-thirty-two-characters";
const state = {
  version: 2,
  notes: [{ id: "note-1", date: "2026-08-12", text: "测试记录", createdAt: "2026-08-12T08:00:00.000Z" }],
  memos: [],
  primings: [],
  traces: [],
  trackers: [],
  monthPreferences: {},
  drafts: {},
  meta: { updatedAt: "2026-08-12T08:00:00.000Z" }
};

const server = http.createServer((request, response) => {
  if (request.url !== "/state" || request.headers.authorization !== "Bearer " + token) {
    response.writeHead(401, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ message: "unauthorized" }));
    return;
  }
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({
    state,
    schemaVersion: 2,
    deviceUpdatedAt: state.meta.updatedAt,
    storedAt: "2026-08-12T08:00:01.000Z"
  }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "life-log-pull-test-"));
const archiveRoot = path.join(tempRoot, "archive");
const configPath = path.join(tempRoot, "config.json");
const address = server.address();
await fs.writeFile(configPath, JSON.stringify({
  workerUrl: `http://127.0.0.1:${address.port}`,
  token,
  archiveRoot
}), "utf8");

async function runPull() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve("scripts/pull-cloud-backup.mjs"), configPath], {
      cwd: path.resolve("."),
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("exit", (code) => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(stderr || "pull exited " + code)));
  });
}

try {
  const first = await runPull();
  assert.ok(first.snapshotPath);
  const latest = JSON.parse(await fs.readFile(first.latestPath, "utf8"));
  assert.equal(latest.format, "life-log-calendar-backup");
  assert.equal(latest.version, 3);
  assert.deepEqual(latest.data, state);

  const second = await runPull();
  assert.equal(second.snapshotPath, null);
  const snapshots = await fs.readdir(path.join(archiveRoot, "snapshots"));
  assert.equal(snapshots.length, 1);
  console.log("Codex pull tests passed.");
} finally {
  server.close();
  await fs.rm(tempRoot, { recursive: true, force: true });
}
