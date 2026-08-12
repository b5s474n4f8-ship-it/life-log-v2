import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML IDs must be unique");
JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));
JSON.parse(fs.readFileSync("cloud-sync/wrangler.jsonc", "utf8"));
assert.ok(html.includes('name="viewport"'), "Viewport meta tag is required");
assert.ok(html.includes("sync-config.js"), "Public sync configuration must load before app.js");
console.log("Structure and JSON tests passed.");
