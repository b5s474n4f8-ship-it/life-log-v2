CREATE TABLE IF NOT EXISTS life_log_manifest (
  id TEXT PRIMARY KEY CHECK (id = 'main'),
  schema_version INTEGER NOT NULL,
  device_updated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  chunk_count INTEGER NOT NULL CHECK (chunk_count > 0)
);

CREATE TABLE IF NOT EXISTS life_log_chunks (
  state_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (state_id, chunk_index),
  FOREIGN KEY (state_id) REFERENCES life_log_manifest(id) ON DELETE CASCADE
);
