// LibreLinkUp (unofficial): the follower API behind Abbott's LibreLinkUp app.
// The Libre user invites a follower in the Libre app; we log in as that follower.
import crypto from 'node:crypto';
import { ConnectorError, fetchJson, sanitize } from './common.js';

const VERSION = process.env.LIBRE_VERSION || '4.16.0';
const HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-cache', product: 'llu.android', version: VERSION };
const TRENDS = { 0: 'None', 1: 'SingleDown', 2: 'FortyFiveDown', 3: 'Flat', 4: 'FortyFiveUp', 5: 'SingleUp' };
export const REGIONS = ['us', 'eu', 'eu2', 'de', 'fr', 'jp', 'ap', 'au', 'ae', 'ca', 'la'];

export function normalizeConfig({ email, password, region }) {
  if (!email || !password) throw new ConnectorError('Enter the LibreLinkUp follower email and password.');
  return { email: email.trim(), password, region: REGIONS.includes(region) ? region : '' };
}

const base = (region) => (region ? `https://api-${region}.libreview.io` : 'https://api.libreview.io');

async function login(cfg, cache) {
  let region = cache.region || cfg.region;
  for (let hop = 0; hop < 2; hop++) {
    const r = await fetchJson(`${base(region)}/llu/auth/login`, { method: 'POST', headers: HEADERS, body: JSON.stringify({ email: cfg.email, password: cfg.password }) }, 'LibreLinkUp');
    const d = r.body?.data;
    if (r.body?.status === 920) throw new ConnectorError('LibreLinkUp says this app version is too old. Update LIBRE_VERSION on the server.');
    if (d?.redirect && d.region) { region = d.region; continue; }
    if (d?.step) throw new ConnectorError('Open the LibreLinkUp app with the follower account and accept the latest terms, then try again.', { auth: true });
    if (r.body?.status === 2 || r.status === 401) throw new ConnectorError('LibreLinkUp rejected that email or password.', { auth: true });
    const token = d?.authTicket?.token, userId = d?.user?.id;
    if (!token || !userId) throw new ConnectorError(`LibreLinkUp login failed (${r.status}).`);
    Object.assign(cache, { region, token, accountId: crypto.createHash('sha256').update(userId).digest('hex') });
    return;
  }
  throw new ConnectorError('LibreLinkUp kept redirecting between regions.');
}

function authHeaders(cache) {
  return { ...HEADERS, authorization: `Bearer ${cache.token}`, 'account-id': cache.accountId };
}

// FactoryTimestamp is UTC, formatted like "11/6/2026 3:04:05 PM"
function parseTs(s) {
  const m = /^(\d+)\/(\d+)\/(\d+) (\d+):(\d+):(\d+) (AM|PM)$/.exec(s || '');
  if (!m) return NaN;
  let h = Number(m[4]) % 12;
  if (m[7] === 'PM') h += 12;
  return Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]), h, Number(m[5]), Number(m[6]));
}

export async function fetchReadings(cfg, cache = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!cache.token) await login(cfg, cache);
    const conns = await fetchJson(`${base(cache.region)}/llu/connections`, { headers: authHeaders(cache) }, 'LibreLinkUp');
    if (conns.status === 401) { cache.token = undefined; continue; }
    const patient = conns.body?.data?.[0];
    if (!patient) throw new ConnectorError('This LibreLinkUp account isn\'t following anyone yet. Accept the invite in the LibreLinkUp app.');
    const g = await fetchJson(`${base(cache.region)}/llu/connections/${patient.patientId}/graph`, { headers: authHeaders(cache) }, 'LibreLinkUp');
    if (g.status === 401) { cache.token = undefined; continue; }
    const data = g.body?.data;
    if (!data) throw new ConnectorError(`LibreLinkUp returned an unexpected response (${g.status}).`);
    const points = (data.graphData || []).map((p) => ({ ts: parseTs(p.FactoryTimestamp), mgdl: Number(p.ValueInMgPerDl), trend: 'None' }));
    const cur = data.connection?.glucoseMeasurement;
    if (cur) points.push({ ts: parseTs(cur.FactoryTimestamp), mgdl: Number(cur.ValueInMgPerDl), trend: TRENDS[cur.TrendArrow] || 'None' });
    return sanitize(points);
  }
  throw new ConnectorError('LibreLinkUp session kept expiring.');
}
