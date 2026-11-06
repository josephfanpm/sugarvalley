import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { DATA_DIR, RETENTION_DAYS } from './config.js';

export const db = new DatabaseSync(process.env.SUGARPEEK_DB || path.join(DATA_DIR, 'sugarpeek.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    api_key_hash TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_json TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'mgdl',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS connections (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,              -- nightscout | dexcom | librelinkup | demo
    config_enc TEXT NOT NULL,        -- AES-GCM encrypted credentials
    status TEXT NOT NULL DEFAULT 'pending', -- ok | error | pending
    last_error TEXT,
    last_polled_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS readings (
    user_id TEXT NOT NULL,
    ts INTEGER NOT NULL,
    mgdl REAL NOT NULL,
    trend TEXT,
    PRIMARY KEY (user_id, ts)
  ) WITHOUT ROWID;
  CREATE TABLE IF NOT EXISTS identities (
    provider TEXT NOT NULL,          -- google | apple
    sub TEXT NOT NULL,               -- the provider's stable account id
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (provider, sub)
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS share_links (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    token_enc TEXT NOT NULL,         -- so the owner can copy it again
    created_at INTEGER NOT NULL,
    revoked_at INTEGER
  );
`);

// Columns added after the first prototype: add them to older databases in place.
const userCols = new Set(db.prepare('PRAGMA table_info(users)').all().map((c) => c.name));
for (const [col, ddl] of [
  ['scene', "ALTER TABLE users ADD COLUMN scene TEXT NOT NULL DEFAULT 'forest'"],
  ['show_graph', 'ALTER TABLE users ADD COLUMN show_graph INTEGER NOT NULL DEFAULT 1'],
  ['thresholds_json', 'ALTER TABLE users ADD COLUMN thresholds_json TEXT'],
  ['contact_phone', 'ALTER TABLE users ADD COLUMN contact_phone TEXT'],
  ['game_json', 'ALTER TABLE users ADD COLUMN game_json TEXT'],
  ['tir_target', 'ALTER TABLE users ADD COLUMN tir_target INTEGER NOT NULL DEFAULT 70'],
  ['tz', "ALTER TABLE users ADD COLUMN tz TEXT NOT NULL DEFAULT 'UTC'"],
  ['valley_json', 'ALTER TABLE users ADD COLUMN valley_json TEXT'],
]) if (!userCols.has(col)) db.exec(ddl);

export const q = {
  insertUser: db.prepare('INSERT INTO users (id, api_key_hash, display_name, avatar_json, unit, show_graph, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  userByKey: db.prepare('SELECT * FROM users WHERE api_key_hash = ?'),
  userBySession: db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.created_at > ?'),
  pruneSessions: db.prepare('DELETE FROM sessions WHERE created_at <= ?'),
  insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?, ?, ?)'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  identity: db.prepare('SELECT * FROM identities WHERE provider = ? AND sub = ?'),
  identitiesForUser: db.prepare('SELECT provider, email FROM identities WHERE user_id = ?'),
  insertIdentity: db.prepare('INSERT INTO identities (provider, sub, user_id, email, created_at) VALUES (?, ?, ?, ?, ?)'),
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  updateUser: db.prepare('UPDATE users SET display_name = ?, avatar_json = ?, unit = ?, scene = ?, show_graph = ?, thresholds_json = ?, contact_phone = ? WHERE id = ?'),
  deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
  saveGame: db.prepare('UPDATE users SET game_json = ? WHERE id = ?'),
  saveValley: db.prepare('UPDATE users SET valley_json = ? WHERE id = ?'),
  setGameSettings: db.prepare('UPDATE users SET tir_target = ?, tz = ? WHERE id = ?'),

  upsertConnection: db.prepare(`INSERT INTO connections (user_id, type, config_enc, status, last_error, last_polled_at, created_at)
    VALUES (?, ?, ?, 'pending', NULL, NULL, ?)
    ON CONFLICT(user_id) DO UPDATE SET type = excluded.type, config_enc = excluded.config_enc, status = 'pending', last_error = NULL, last_polled_at = NULL`),
  connection: db.prepare('SELECT * FROM connections WHERE user_id = ?'),
  allConnections: db.prepare('SELECT * FROM connections'),
  setConnectionStatus: db.prepare('UPDATE connections SET status = ?, last_error = ?, last_polled_at = ? WHERE user_id = ?'),
  deleteConnection: db.prepare('DELETE FROM connections WHERE user_id = ?'),

  insertReading: db.prepare('INSERT OR REPLACE INTO readings (user_id, ts, mgdl, trend) VALUES (?, ?, ?, ?)'),
  latest: db.prepare('SELECT ts, mgdl, trend FROM readings WHERE user_id = ? ORDER BY ts DESC LIMIT 1'),
  since: db.prepare('SELECT ts, mgdl FROM readings WHERE user_id = ? AND ts >= ? ORDER BY ts'),
  clearReadings: db.prepare('DELETE FROM readings WHERE user_id = ?'),
  pruneReadings: db.prepare('DELETE FROM readings WHERE ts < ?'),

  insertLink: db.prepare('INSERT INTO share_links (id, user_id, label, token_hash, token_enc, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  linksForUser: db.prepare('SELECT * FROM share_links WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at'),
  linkByHash: db.prepare('SELECT * FROM share_links WHERE token_hash = ? AND revoked_at IS NULL'),
  revokeLink: db.prepare('UPDATE share_links SET revoked_at = ? WHERE id = ? AND user_id = ?'),
};

export function pruneOld() {
  q.pruneReadings.run(Date.now() - RETENTION_DAYS * 86_400_000);
}
