// Dexcom Share (unofficial): the real-time endpoint used by Dexcom's Follow app,
// Nightscout's share2nightscout-bridge and pydexcom. Requires Share to be turned on in the Dexcom app.
import { ConnectorError, fetchJson, sanitize } from './common.js';

const REGIONS = {
  us: { base: 'https://share2.dexcom.com/ShareWebServices/Services', appId: 'd89443d2-327c-4a6f-89e5-496bbb0317db' },
  ous: { base: 'https://shareous1.dexcom.com/ShareWebServices/Services', appId: 'd89443d2-327c-4a6f-89e5-496bbb0317db' },
  jp: { base: 'https://share.dexcom.jp/ShareWebServices/Services', appId: 'd8665ade-9673-4e27-9ff6-92db4ce13d13' },
};
const NULL_ID = '00000000-0000-0000-0000-000000000000';
const TRENDS = ['None', 'DoubleUp', 'SingleUp', 'FortyFiveUp', 'Flat', 'FortyFiveDown', 'SingleDown', 'DoubleDown', 'NotComputable', 'RateOutOfRange'];
const HEADERS = { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0' };

export function normalizeConfig({ username, password, region }) {
  if (!username || !password) throw new ConnectorError('Enter your Dexcom username and password.');
  if (!REGIONS[region]) throw new ConnectorError('Pick your Dexcom region.');
  return { username: username.trim(), password, region };
}

async function post(region, endpoint, body, query) {
  const url = new URL(`${REGIONS[region].base}/${endpoint}`);
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
  return fetchJson(url, { method: 'POST', headers: HEADERS, body: body ? JSON.stringify(body) : undefined }, 'Dexcom Share');
}

function explain(body) {
  const code = body?.Code || '';
  if (/AccountPasswordInvalid|SSO_AuthenticatePasswordInvalid|InvalidArgument/.test(code)) return 'Dexcom rejected that username or password.';
  if (/MaxAttempts/.test(code)) return 'Dexcom locked logins for a bit after too many attempts. Try again later.';
  return `Dexcom Share error${code ? ` (${code})` : ''}.`;
}

async function login(cfg) {
  const { appId } = REGIONS[cfg.region];
  const a = await post(cfg.region, 'General/AuthenticatePublisherAccount', { accountName: cfg.username, password: cfg.password, applicationId: appId });
  if (a.status !== 200 || typeof a.body !== 'string' || a.body === NULL_ID) throw new ConnectorError(explain(a.body), { auth: true });
  const s = await post(cfg.region, 'General/LoginPublisherAccountById', { accountId: a.body, password: cfg.password, applicationId: appId });
  if (s.status !== 200 || typeof s.body !== 'string' || s.body === NULL_ID) throw new ConnectorError(explain(s.body), { auth: true });
  return s.body;
}

function parseWT(wt) {
  const m = /Date\((\d+)/.exec(wt || '');
  return m ? Number(m[1]) : NaN;
}

/** cache: per-user object that survives between polls (holds the session id). */
export async function fetchReadings(cfg, cache = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    cache.sessionId ??= await login(cfg);
    const r = await post(cfg.region, 'Publisher/ReadPublisherLatestGlucoseValues', null, { sessionId: cache.sessionId, minutes: 720, maxCount: 150 });
    if (r.status === 200 && Array.isArray(r.body)) {
      return sanitize(r.body.map((e) => ({
        ts: parseWT(e.WT),
        mgdl: Number(e.Value),
        trend: typeof e.Trend === 'number' ? TRENDS[e.Trend] : e.Trend,
      })));
    }
    if (/Session/i.test(r.body?.Code || '')) { cache.sessionId = undefined; continue; }
    throw new ConnectorError(explain(r.body));
  }
  throw new ConnectorError('Dexcom session kept expiring.');
}
