import assert from "node:assert/strict";
import worker from "../cloud-sync/src/worker.js";

class Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async first() {
    if (this.sql.includes("FROM life_log_manifest")) return this.db.manifest ? { ...this.db.manifest } : null;
    return null;
  }
  async all() {
    if (this.sql.includes("FROM life_log_chunks")) {
      return { results: [...this.db.chunks.entries()].sort((a,b) => a[0]-b[0]).map(([chunk_index, content]) => ({ chunk_index, content })) };
    }
    return { results: [] };
  }
  async execute() {
    if (this.sql.includes("INSERT INTO life_log_manifest")) {
      const [, schema_version, device_updated_at, chunk_count] = this.values;
      this.db.manifest = { schema_version, device_updated_at, updated_at: new Date().toISOString(), chunk_count };
    } else if (this.sql.includes("INSERT INTO life_log_chunks")) {
      const [, index, content] = this.values;
      this.db.chunks.set(index, content);
    } else if (this.sql.includes("DELETE FROM life_log_chunks")) {
      const [, minimum] = this.values;
      for (const key of this.db.chunks.keys()) if (key >= minimum) this.db.chunks.delete(key);
    }
  }
}

class FakeD1 {
  constructor() { this.manifest = null; this.chunks = new Map(); }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) { for (const statement of statements) await statement.execute(); }
}

const env = {
  DB: new FakeD1(),
  SYNC_TOKEN: "private-token-with-at-least-thirty-two-characters",
  ALLOWED_ORIGIN: "https://b5s474n4f8-ship-it.github.io"
};
const origin = env.ALLOWED_ORIGIN;

async function call(path, options = {}) {
  return worker.fetch(new Request("https://sync.example" + path, options), env);
}

let response = await call("/state", { headers: { Authorization: "Bearer wrong" } });
assert.equal(response.status, 401);

response = await call("/state", {
  headers: { Authorization: "Bearer " + env.SYNC_TOKEN, Origin: "https://example.org" }
});
assert.equal(response.status, 403);

response = await call("/state", { method: "OPTIONS", headers: { Origin: origin } });
assert.equal(response.status, 204);
assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);

response = await call("/state", { headers: { Authorization: "Bearer " + env.SYNC_TOKEN } });
assert.equal(response.status, 200);
assert.equal(await response.json(), null);

const largeText = "起".repeat(450000) + "🙂";
const state = {
  version: 2,
  notes: [{ id: "n1", date: "2026-08-12", text: largeText }],
  memos: [],
  primings: [],
  traces: [],
  trackers: [],
  monthPreferences: {},
  drafts: {},
  meta: { updatedAt: "2026-08-12T12:00:00.000Z" }
};
response = await call("/state", {
  method: "PUT",
  headers: {
    Authorization: "Bearer " + env.SYNC_TOKEN,
    Origin: origin,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ state, schemaVersion: 2, deviceUpdatedAt: state.meta.updatedAt })
});
assert.equal(response.status, 200);
const saved = await response.json();
assert.equal(saved.chunks, 2);
assert.equal(env.DB.chunks.size, 2);

response = await call("/state", { headers: { Authorization: "Bearer " + env.SYNC_TOKEN } });
assert.equal(response.status, 200);
const restored = await response.json();
assert.deepEqual(restored.state, state);
assert.equal(restored.deviceUpdatedAt, state.meta.updatedAt);

console.log("Worker protocol tests passed.");
