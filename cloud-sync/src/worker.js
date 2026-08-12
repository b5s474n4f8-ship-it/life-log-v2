const MAX_STATE_BYTES = 20 * 1024 * 1024;
const CHUNK_CHARACTERS = 250000;

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== env.ALLOWED_ORIGIN) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(request, env)
    }
  });
}

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

async function secureEqual(left, right) {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  if (a.byteLength !== b.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < a.byteLength; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function isAuthorized(request, env) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ") || !env.SYNC_TOKEN) return false;
  return secureEqual(header.slice(7), env.SYNC_TOKEN);
}

function isAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  return !origin || origin === env.ALLOWED_ORIGIN;
}

function splitState(serialized) {
  const chunks = [];
  for (let offset = 0; offset < serialized.length; offset += CHUNK_CHARACTERS) {
    let end = Math.min(offset + CHUNK_CHARACTERS, serialized.length);
    const finalCode = serialized.charCodeAt(end - 1);
    if (end < serialized.length && finalCode >= 0xd800 && finalCode <= 0xdbff) end -= 1;
    chunks.push(serialized.slice(offset, end));
    offset = end - CHUNK_CHARACTERS;
  }
  return chunks;
}

function validateState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  return ["notes", "memos", "primings", "traces", "trackers"].every((key) => Array.isArray(state[key]));
}

async function readState(env) {
  const manifest = await env.DB.prepare(
    "SELECT schema_version, device_updated_at, updated_at, chunk_count FROM life_log_manifest WHERE id = ?"
  ).bind("main").first();
  if (!manifest) return null;

  const rows = await env.DB.prepare(
    "SELECT chunk_index, content FROM life_log_chunks WHERE state_id = ? ORDER BY chunk_index ASC"
  ).bind("main").all();
  const chunks = rows.results || [];
  if (chunks.length !== manifest.chunk_count) throw new Error("Cloud state is incomplete.");

  return {
    state: JSON.parse(chunks.map((row) => row.content).join("")),
    schemaVersion: manifest.schema_version,
    deviceUpdatedAt: manifest.device_updated_at,
    storedAt: manifest.updated_at
  };
}

async function writeState(request, env) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_STATE_BYTES) return json(request, env, { message: "记录超过当前同步容量。" }, 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(request, env, { message: "请求不是有效的 JSON。" }, 400);
  }

  if (!validateState(payload?.state)) return json(request, env, { message: "记录结构无效。" }, 400);

  const serialized = JSON.stringify(payload.state);
  if (new TextEncoder().encode(serialized).byteLength > MAX_STATE_BYTES) {
    return json(request, env, { message: "记录超过当前同步容量。" }, 413);
  }

  const chunks = splitState(serialized);
  const schemaVersion = Number(payload.schemaVersion) || 1;
  const deviceUpdatedAt = String(payload.deviceUpdatedAt || payload.state?.meta?.updatedAt || new Date().toISOString());
  const statements = [
    env.DB.prepare(
      `INSERT INTO life_log_manifest (id, schema_version, device_updated_at, updated_at, chunk_count)
       VALUES (?, ?, ?, datetime('now'), ?)
       ON CONFLICT(id) DO UPDATE SET
         schema_version = excluded.schema_version,
         device_updated_at = excluded.device_updated_at,
         updated_at = datetime('now'),
         chunk_count = excluded.chunk_count`
    ).bind("main", schemaVersion, deviceUpdatedAt, chunks.length),
    ...chunks.map((chunk, index) => env.DB.prepare(
      `INSERT INTO life_log_chunks (state_id, chunk_index, content)
       VALUES (?, ?, ?)
       ON CONFLICT(state_id, chunk_index) DO UPDATE SET content = excluded.content`
    ).bind("main", index, chunk)),
    env.DB.prepare("DELETE FROM life_log_chunks WHERE state_id = ? AND chunk_index >= ?")
      .bind("main", chunks.length)
  ];

  await env.DB.batch(statements);
  return json(request, env, { ok: true, deviceUpdatedAt, chunks: chunks.length });
}

export default {
  async fetch(request, env) {
    if (!isAllowedOrigin(request, env)) return json(request, env, { message: "这个来源不能访问同步空间。" }, 403);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json(request, env, { ok: true, service: "life-log-sync" });
    }

    if (url.pathname !== "/state") return json(request, env, { message: "Not found." }, 404);
    if (!(await isAuthorized(request, env))) return json(request, env, { message: "同步口令不正确。" }, 401);

    try {
      if (request.method === "GET") return json(request, env, await readState(env));
      if (request.method === "PUT") return writeState(request, env);
      return json(request, env, { message: "Method not allowed." }, 405);
    } catch (error) {
      console.error(error);
      return json(request, env, { message: "云端暂时不可用，手机本地记录不受影响。" }, 500);
    }
  }
};
