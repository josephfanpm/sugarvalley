// Polls each user's CGM source on a schedule. Readings land every 5 minutes;
// failures back off exponentially (5 → 10 → 20 → 30 min max).
import { q, pruneOld } from './db.js';
import { decrypt } from './secrets.js';
import { CONNECTORS, ConnectorError } from './connectors/index.js';
import { POLL_EVERY_MS } from './config.js';
import { runGame } from './game-store.js';

const sessions = new Map(); // userId -> connector session cache (tokens, never persisted)
const failures = new Map(); // userId -> consecutive failures

export function dropSession(userId) {
  sessions.delete(userId);
  failures.delete(userId);
}

function dueAt(conn) {
  if (!conn.last_polled_at) return 0;
  if (conn.status === 'auth_error') return Infinity; // wrong credentials: wait for the user to reconnect
  if (conn.type === 'demo') return conn.last_polled_at + 60_000;
  const f = failures.get(conn.user_id) || 0;
  return conn.last_polled_at + Math.min(30 * 60_000, POLL_EVERY_MS * 2 ** f);
}

/** Poll one connection now. Returns {ok, error, count}. */
export async function pollConnection(conn) {
  const connector = CONNECTORS[conn.type];
  const cache = sessions.get(conn.user_id) || {};
  sessions.set(conn.user_id, cache);
  const now = Date.now();
  try {
    const readings = await connector.fetchReadings(decrypt(conn.config_enc), cache);
    for (const r of readings) q.insertReading.run(conn.user_id, r.ts, r.mgdl, r.trend ?? null);
    q.setConnectionStatus.run('ok', null, now, conn.user_id);
    try { runGame(q.userById.get(conn.user_id)); } catch (e) { console.error('[game]', e); }
    failures.delete(conn.user_id);
    return { ok: true, count: readings.length };
  } catch (e) {
    const msg = e instanceof ConnectorError ? e.message : 'Something went wrong reading your CGM.';
    if (!(e instanceof ConnectorError)) console.error(`[poll ${conn.type}]`, e);
    if (e.auth) sessions.delete(conn.user_id);
    failures.set(conn.user_id, (failures.get(conn.user_id) || 0) + 1);
    q.setConnectionStatus.run(e.auth ? 'auth_error' : 'error', msg, now, conn.user_id);
    return { ok: false, error: msg };
  }
}

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    const now = Date.now();
    const due = q.allConnections.all().filter((c) => dueAt(c) <= now);
    // Small fan-out limit so one slow provider can't stall everyone.
    for (let i = 0; i < due.length; i += 10) await Promise.all(due.slice(i, i + 10).map(pollConnection));
    pruneOld();
  } finally {
    running = false;
  }
}

export function startPoller() {
  tick();
  return setInterval(tick, 20_000);
}
