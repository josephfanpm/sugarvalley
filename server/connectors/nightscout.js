// Nightscout: documented public API. Uses a read-only access token (Admin Tools → Subjects → readable role).
import { ConnectorError, fetchJson, sanitize } from './common.js';

export function normalizeConfig({ url, token }) {
  if (!url) throw new ConnectorError('Enter your Nightscout URL.');
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try { new URL(u); } catch { throw new ConnectorError('That Nightscout URL doesn\'t look right.'); }
  return { url: u.replace(/\/+$/, ''), token: (token || '').trim() };
}

export async function fetchReadings(cfg) {
  const url = new URL(`${cfg.url}/api/v1/entries/sgv.json`);
  url.searchParams.set('count', '150'); // ~12 h at 5-min readings
  if (cfg.token) url.searchParams.set('token', cfg.token);
  const { status, body } = await fetchJson(url, { headers: { accept: 'application/json' } }, 'your Nightscout site');
  if (status === 401 || status === 403) throw new ConnectorError('Nightscout rejected the access token.', { auth: true });
  if (status !== 200 || !Array.isArray(body)) throw new ConnectorError(`Nightscout returned an unexpected response (${status}).`);
  return sanitize(body.filter((e) => e.sgv).map((e) => ({ ts: Number(e.date), mgdl: Number(e.sgv), trend: e.direction || 'None' })));
}
