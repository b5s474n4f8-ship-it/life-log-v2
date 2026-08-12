import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const defaultConfig = "D:\\LifeLog-Private-Archive\\life-log-cloud-config.json";
const configPath = path.resolve(process.argv[2] || defaultConfig);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = filePath + ".tmp-" + process.pid;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2) + "\n", "utf8");
  await fs.rename(tempPath, filePath);
}

function counts(state) {
  return {
    notes: state.notes?.length || 0,
    memos: state.memos?.length || 0,
    primings: state.primings?.length || 0,
    traces: state.traces?.length || 0
  };
}

function dateRange(state) {
  const values = [...(state.notes || []), ...(state.memos || []), ...(state.primings || []), ...(state.traces || [])]
    .map((item) => item.date)
    .filter(Boolean)
    .sort();
  return values.length ? { first: values[0], last: values.at(-1) } : { first: null, last: null };
}

const config = await readJson(configPath);
const validWorkerUrl = /^https:\/\//.test(config.workerUrl || "") || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(config.workerUrl || "");
if (!validWorkerUrl || String(config.token || "").length < 32) {
  throw new Error("Private cloud config is incomplete: " + configPath);
}

const response = await fetch(config.workerUrl.replace(/\/+$/, "") + "/state", {
  headers: { Authorization: "Bearer " + config.token },
  cache: "no-store"
});
const body = await response.text();
const remote = body ? JSON.parse(body) : null;
if (!response.ok) throw new Error(remote?.message || "Cloud read failed with HTTP " + response.status);
if (!remote?.state) throw new Error("Cloud is connected but no phone record has been uploaded yet.");

const archiveRoot = path.resolve(config.archiveRoot || "D:\\LifeLog-Private-Archive\\cloud");
const latestPath = path.join(archiveRoot, "life-log-cloud-latest.json");
let previousUpdatedAt = null;
try {
  const previous = await readJson(latestPath);
  previousUpdatedAt = previous?.sync?.deviceUpdatedAt || previous?.data?.meta?.updatedAt || null;
} catch {}

const pulledAt = new Date().toISOString();
const payload = {
  format: "life-log-calendar-backup",
  version: 3,
  exportedAt: pulledAt,
  sync: {
    source: "private-cloud",
    pulledAt,
    deviceUpdatedAt: remote.deviceUpdatedAt || remote.state?.meta?.updatedAt || null,
    storedAt: remote.storedAt || null
  },
  context: {
    artifactId: "life-log",
    lineage: "life-log-v2-evolved",
    schemaVersion: remote.schemaVersion || remote.state?.version || 2,
    latestUpdatedAt: remote.deviceUpdatedAt || remote.state?.meta?.updatedAt || null,
    recordCounts: counts(remote.state),
    dateRange: dateRange(remote.state),
    handoff: "Codex automatic read-only cloud snapshot"
  },
  data: remote.state
};

await writeJsonAtomic(latestPath, payload);

let snapshotPath = null;
if (payload.sync.deviceUpdatedAt !== previousUpdatedAt) {
  const stamp = pulledAt.replace(/[:.]/g, "-");
  snapshotPath = path.join(archiveRoot, "snapshots", "life-log-cloud-" + stamp + ".json");
  await writeJsonAtomic(snapshotPath, payload);
}

process.stdout.write(JSON.stringify({
  ok: true,
  latestPath,
  snapshotPath,
  deviceUpdatedAt: payload.sync.deviceUpdatedAt,
  counts: payload.context.recordCounts,
  dateRange: payload.context.dateRange
}, null, 2) + "\n");
