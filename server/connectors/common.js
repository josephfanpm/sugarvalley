/** An error whose message is safe to show the user in the extension. */
export class ConnectorError extends Error {
  constructor(message, { auth = false } = {}) {
    super(message);
    this.auth = auth; // true = credentials are wrong; drop cached sessions
  }
}

export async function fetchJson(url, opts = {}, label = 'request') {
  let res;
  try {
    res = await fetch(url, { ...opts, signal: AbortSignal.timeout(15_000) });
  } catch (e) {
    throw new ConnectorError(`Couldn't reach ${label} (${e.cause?.code || e.name}).`);
  }
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

/** Readings: [{ ts: epoch ms, mgdl: number, trend: Dexcom-style trend name }] */
export function sanitize(readings) {
  return readings
    .filter((r) => Number.isFinite(r.ts) && Number.isFinite(r.mgdl) && r.mgdl >= 20 && r.mgdl <= 600)
    .sort((a, b) => a.ts - b.ts);
}
