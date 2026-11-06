import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, PORT, PUBLIC_BASE } from './config.js';
import { q } from './db.js';
import { encrypt, decrypt, sha256, randomToken } from './secrets.js';
import { CONNECTORS, ConnectorError } from './connectors/index.js';
import { pollConnection, dropSession, startPoller } from './poller.js';
import { captionFor, stateOf, isUrgent, validateThresholds, DEFAULT_THRESHOLDS } from '../extension/shared/glucose.js';
import { THEMES } from '../extension/shared/scene.js';
import { DEFAULT_AVATAR } from '../extension/shared/avatar.js';
import { CHEERS } from '../extension/shared/game-data.js';
import { gameSummary, publicGameView, runGame } from './game-store.js';
import { checkIn, cheer, buy, equip } from './game.js';
import { valleyView, collect, restore, water, gift, chore, cook, journal, claim, ValleyError } from './valley.js';
import { authConfig, verifyIdToken, AuthError } from './auth.js';

const SPARK_MS = 12 * 3_600_000; // graph history sent to the app and share link
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
const STATIC = { '/app/': path.join(ROOT, 'extension'), '/sprites/': path.join(ROOT, 'extension', 'sprites'), '/shared/': path.join(ROOT, 'extension', 'shared'), '/web/': path.join(ROOT, 'web'), '/game/': path.join(ROOT, 'src'), '/art/': path.join(ROOT, 'assets', 'art'), '/audio/': path.join(ROOT, 'assets', 'audio') };

// ---------- helpers ----------
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'content-type': isJson ? 'application/json' : 'text/plain',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > 64_000) throw new HttpError(413, 'Body too large'); chunks.push(c); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Invalid JSON'); }
}

function auth(req) {
  const user = optionalAuth(req);
  if (!user) throw new HttpError(401, 'Not signed in');
  return user;
}
// API key from the no-account setup, or a session from Google/Apple sign-in.
function optionalAuth(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const h = sha256(m[1]);
  return q.userByKey.get(h) || q.userBySession.get(h, Date.now() - SESSION_DAYS * 86_400_000) || null;
}
const SESSION_DAYS = 90;
function newSession(userId) {
  q.pruneSessions.run(Date.now() - SESSION_DAYS * 86_400_000);
  const token = randomToken(24);
  q.insertSession.run(sha256(token), userId, Date.now());
  return token;
}

// Behind a hosting proxy (Fly, Render, Cloudflare), set TRUST_PROXY=1 so limits apply per visitor,
// not to the proxy's address.
function clientIp(req) {
  if (process.env.TRUST_PROXY) {
    const fwd = String(req.headers['fly-client-ip'] || req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (fwd) return fwd;
  }
  return req.socket.remoteAddress;
}

const hits = new Map();
function rateLimit(req, limit = 120) {
  const ip = clientIp(req), minute = Math.floor(Date.now() / 60_000), key = `${ip}:${minute}`;
  const n = (hits.get(key) || 0) + 1; hits.set(key, n);
  if (hits.size > 10_000) hits.clear();
  if (n > limit) throw new HttpError(429, 'Slow down');
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function cleanAvatar(a) {
  if (!a || typeof a !== 'object') return DEFAULT_AVATAR;
  const out = { ...DEFAULT_AVATAR };
  for (const k of Object.keys(DEFAULT_AVATAR)) {
    if (k === 't1d') out.t1d = { cgm: !!a.t1d?.cgm, pump: !!a.t1d?.pump };
    else if (k === 'v') out.v = 1;
    else if (typeof a[k] === 'string' && /^[a-z0-9_]{1,32}$/.test(a[k])) out[k] = a[k];
  }
  return out;
}

const thresholdsOf = (user) => (user.thresholds_json ? JSON.parse(user.thresholds_json) : DEFAULT_THRESHOLDS);

function glucosePayload(user) {
  const latest = q.latest.get(user.id) || null;
  const now = Date.now(), thresholds = thresholdsOf(user);
  return {
    latest,
    thresholds,
    state: stateOf(latest, now, thresholds),
    caption: captionFor({ name: user.display_name, latest, unit: user.unit, now, thresholds }),
    sparkline: q.since.all(user.id, now - SPARK_MS),
  };
}

function cleanPhone(p) {
  const s = String(p ?? '').trim();
  if (!s) return null;
  if (!/^\+?[0-9 ().-]{7,20}$/.test(s)) throw new HttpError(400, 'That phone number doesn\'t look right.');
  return s;
}

function connectionView(conn) {
  if (!conn) return null;
  const cfg = decrypt(conn.config_enc);
  const detail = conn.type === 'nightscout' ? cfg.url
    : conn.type === 'dexcom' ? `${cfg.username} (${cfg.region.toUpperCase()})`
    : conn.type === 'librelinkup' ? cfg.email
    : cfg.scenario;
  return { type: conn.type, detail, status: conn.status, lastError: conn.last_error, lastPolledAt: conn.last_polled_at };
}

// One public link per account. Anyone with it can view; no viewer accounts.
function createLink(userId) {
  const token = randomToken(16);
  q.insertLink.run(crypto.randomUUID(), userId, 'Everyone', sha256(token), encrypt(token), Date.now());
}

function shareView(userId) {
  let link = q.linksForUser.all(userId).at(-1);
  if (!link) { createLink(userId); link = q.linksForUser.all(userId).at(-1); }
  return { url: `${PUBLIC_BASE}/s/${decrypt(link.token_enc)}`, createdAt: link.created_at };
}

function meView(user) {
  return {
    displayName: user.display_name,
    avatar: JSON.parse(user.avatar_json),
    unit: user.unit,
    scene: user.scene,
    showGraph: !!user.show_graph,
    contactPhone: user.contact_phone,
    tirTarget: user.tir_target ?? 70,
    tz: user.tz,
    connection: connectionView(q.connection.get(user.id)),
    signIns: q.identitiesForUser.all(user.id).map((i) => ({ provider: i.provider, email: i.email })),
    share: shareView(user.id),
    game: gameSummary(user),
    ...glucosePayload(user),
  };
}

function cleanTz(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return String(tz).slice(0, 64); } catch { return null; }
}

// Game actions: apply, re-run the game, and return the fresh summary.
function gameAction(user, fn) {
  try { runGame(user, { action: fn }); } catch (e) { throw new HttpError(400, e.message); }
  return gameSummary(user);
}
const cheerHits = new Map();

function cleanName(s) {
  const n = String(s || '').trim().slice(0, 40);
  if (!n) throw new HttpError(400, 'Pick a display name.');
  return n;
}

// ---------- routes ----------
const routes = [
  ['POST', /^\/api\/account$/, async (req, res) => {
    const body = await readBody(req);
    const id = crypto.randomUUID(), apiKey = randomToken(24);
    q.insertUser.run(id, sha256(apiKey), cleanName(body.displayName), JSON.stringify(cleanAvatar(body.avatar)), body.unit === 'mmol' ? 'mmol' : 'mgdl', body.showGraph === false ? 0 : 1, Date.now());
    q.setGameSettings.run(70, cleanTz(body.tz) || 'UTC', id);
    send(res, 201, { apiKey, me: meView(q.userById.get(id)) });
  }],
  // ---- sign in with Google / Apple ----
  ['GET', /^\/api\/auth\/config$/, (req, res) => send(res, 200, authConfig())],
  ['POST', /^\/api\/auth\/(google|apple)$/, async (req, res, [, provider]) => {
    rateLimit(req, 20);
    const body = await readBody(req);
    let id;
    try { id = await verifyIdToken(provider, body.idToken); } catch (e) { throw new HttpError(401, e instanceof AuthError ? e.message : 'Sign-in failed.'); }
    const current = optionalAuth(req);
    const known = q.identity.get(provider, id.sub);
    let user, created = false;
    if (known) user = q.userById.get(known.user_id);
    else if (current) { q.insertIdentity.run(provider, id.sub, current.id, id.email, Date.now()); user = current; } // link to this account
    else {
      const uid = crypto.randomUUID();
      const name = String(body.name || id.name || (id.email || '').split('@')[0] || 'Friend').slice(0, 40);
      q.insertUser.run(uid, sha256(randomToken(24)), name, JSON.stringify(cleanAvatar(null)), 'mgdl', 1, Date.now());
      q.setGameSettings.run(70, cleanTz(body.tz) || 'UTC', uid);
      q.insertIdentity.run(provider, id.sub, uid, id.email, Date.now());
      user = q.userById.get(uid); created = true;
    }
    send(res, 200, { apiKey: newSession(user.id), created, me: meView(user) });
  }],
  ['POST', /^\/api\/auth\/sign-out$/, (req, res) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (m) q.deleteSession.run(sha256(m[1]));
    send(res, 200, { ok: true });
  }],
  ['GET', /^\/api\/me$/, (req, res) => {
    const user = auth(req);
    runGame(user, { action: (g) => checkIn(g, Date.now(), user.tz) }); // opening the app counts as a check-in
    send(res, 200, meView(user));
  }],
  ['GET', /^\/api\/game$/, (req, res) => send(res, 200, gameSummary(auth(req)))],
  ['POST', /^\/api\/game\/seen$/, (req, res) => { const user = auth(req); send(res, 200, gameAction(user, (g) => { g.seenSeq = g.logSeq; })); }],
  ['POST', /^\/api\/game\/buy$/, async (req, res) => { const user = auth(req), body = await readBody(req); send(res, 200, gameAction(user, (g) => buy(g, body.itemId, Date.now()))); }],
  ['POST', /^\/api\/game\/equip$/, async (req, res) => { const user = auth(req), body = await readBody(req); send(res, 200, gameAction(user, (g) => equip(g, body.slot, body.itemId ?? null))); }],
  ['PUT', /^\/api\/me$/, async (req, res) => {
    const user = auth(req), body = await readBody(req);
    let thresholds = user.thresholds_json;
    if (body.thresholds !== undefined) {
      try { thresholds = JSON.stringify(validateThresholds(body.thresholds)); } catch (e) { throw new HttpError(400, e.message); }
    }
    q.updateUser.run(
      body.displayName !== undefined ? cleanName(body.displayName) : user.display_name,
      body.avatar ? JSON.stringify(cleanAvatar(body.avatar)) : user.avatar_json,
      body.unit === 'mmol' || body.unit === 'mgdl' ? body.unit : user.unit,
      THEMES.some((t) => t.id === body.scene) ? body.scene : user.scene,
      typeof body.showGraph === 'boolean' ? Number(body.showGraph) : user.show_graph,
      thresholds,
      body.contactPhone !== undefined ? cleanPhone(body.contactPhone) : user.contact_phone,
      user.id,
    );
    if (body.tirTarget !== undefined || body.tz !== undefined) {
      const t = body.tirTarget !== undefined ? Math.round(Number(body.tirTarget)) : user.tir_target;
      if (!(t >= 50 && t <= 95)) throw new HttpError(400, 'Pick a target between 50% and 95%.');
      q.setGameSettings.run(t, (body.tz !== undefined && cleanTz(body.tz)) || user.tz, user.id);
    }
    send(res, 200, meView(q.userById.get(user.id)));
  }],
  ['DELETE', /^\/api\/me$/, (req, res) => {
    const user = auth(req);
    q.clearReadings.run(user.id); q.deleteUser.run(user.id); dropSession(user.id);
    send(res, 200, { deleted: true });
  }],
  // ---- Sugar Valley (owner) ----
  ['GET', /^\/api\/valley$/, (req, res) => { const user = auth(req); send(res, 200, valleyView(user, 'owner', { shareUrl: shareView(user.id).url })); }],
  ['POST', /^\/api\/valley\/(collect|restore|water|chore|cook|journal|quest)$/, async (req, res, [, action]) => {
    const user = auth(req), body = await readBody(req);
    let result = {};
    try {
      if (action === 'collect') result = collect(user);
      else if (action === 'restore') restore(user, String(body.id || ''));
      else if (action === 'chore') result = chore(user, String(body.id || ''));
      else if (action === 'cook') result = cook(user, String(body.id || ''));
      else if (action === 'journal') result = journal(user, body.day, Array.isArray(body.tags) ? body.tags.map(String) : []);
      else if (action === 'quest') result = claim(user);
      else water(user);
    } catch (e) { if (e instanceof ValleyError) throw new HttpError(400, e.message); throw e; }
    send(res, 200, { ...result, view: valleyView(q.userById.get(user.id), 'owner', { shareUrl: shareView(user.id).url }) });
  }],

  ['GET', /^\/api\/me\/glucose$/, (req, res) => {
    const user = auth(req);
    send(res, 200, { ...glucosePayload(user), unit: user.unit, connection: connectionView(q.connection.get(user.id)) });
  }],
  ['PUT', /^\/api\/connection$/, async (req, res) => {
    const user = auth(req), body = await readBody(req);
    const connector = CONNECTORS[body.type];
    if (!connector) throw new HttpError(400, 'Unknown CGM source.');
    let cfg;
    try { cfg = connector.normalizeConfig(body); } catch (e) { throw new HttpError(400, e.message); }
    q.upsertConnection.run(user.id, body.type, encrypt(cfg), Date.now());
    q.clearReadings.run(user.id);
    dropSession(user.id);
    const result = await pollConnection(q.connection.get(user.id));
    if (!result.ok) { q.deleteConnection.run(user.id); dropSession(user.id); } // never keep credentials that didn't work
    send(res, result.ok ? 200 : 422, { ...meView(user), error: result.error });
  }],
  ['DELETE', /^\/api\/connection$/, (req, res) => {
    const user = auth(req);
    q.deleteConnection.run(user.id); q.clearReadings.run(user.id); dropSession(user.id);
    send(res, 200, meView(user));
  }],
  // Reset: the old link stops working and a new one replaces it.
  ['POST', /^\/api\/share-link\/reset$/, (req, res) => {
    const user = auth(req);
    for (const l of q.linksForUser.all(user.id)) q.revokeLink.run(Date.now(), l.id, user.id);
    createLink(user.id);
    send(res, 200, meView(user));
  }],

  // ---- public ----
  ['GET', /^\/api\/share\/([\w-]{10,64})$/, (req, res, [, token]) => {
    rateLimit(req);
    const link = q.linkByHash.get(sha256(token));
    if (!link) throw new HttpError(404, 'This link was turned off or never existed.');
    const user = q.userById.get(link.user_id);
    const g = glucosePayload(user);
    send(res, 200, {
      name: user.display_name,
      avatar: JSON.parse(user.avatar_json),
      scene: user.scene,
      unit: user.unit,
      latest: user.show_graph ? g.latest : null,
      thresholds: user.show_graph ? g.thresholds : null,
      state: g.state,
      // Only what the owner chose to share: the graph is optional, and the phone
      // number is only sent while an urgent low/high is happening.
      sparkline: user.show_graph ? g.sparkline : null,
      contactPhone: isUrgent(g.state) ? user.contact_phone : null,
      game: publicGameView(user),
      cheersToday: gameSummary(user).cheersToday,
    }, { 'cache-control': 'public, max-age=0, s-maxage=30', 'x-robots-tag': 'noindex' });
  }],
  // Visitors play in the owner's valley without an account.
  ['GET', /^\/api\/share\/([\w-]{10,64})\/valley$/, (req, res, [, token]) => {
    rateLimit(req);
    const link = q.linkByHash.get(sha256(token));
    if (!link) throw new HttpError(404, 'This link was turned off or never existed.');
    send(res, 200, valleyView(q.userById.get(link.user_id), 'viewer'), { 'x-robots-tag': 'noindex' });
  }],
  ['POST', /^\/api\/share\/([\w-]{10,64})\/gift$/, async (req, res, [, token]) => {
    rateLimit(req, 30);
    const link = q.linkByHash.get(sha256(token));
    if (!link) throw new HttpError(404, 'This link was turned off.');
    const body = await readBody(req);
    const key = `gift:${clientIp(req)}:${link.id}`, last = cheerHits.get(key) || 0;
    if (Date.now() - last < 10_000) throw new HttpError(429, 'Give it a few seconds.');
    cheerHits.set(key, Date.now());
    if (cheerHits.size > 5000) cheerHits.clear();
    const user = q.userById.get(link.user_id);
    try { gift(user, String(body.kind || '')); } catch (e) { if (e instanceof ValleyError) throw new HttpError(400, e.message); throw e; }
    send(res, 200, { ok: true, view: valleyView(q.userById.get(user.id), 'viewer') });
  }],
  // Viewers can cheer without an account; light per-viewer rate limit.
  ['POST', /^\/api\/share\/([\w-]{10,64})\/cheer$/, async (req, res, [, token]) => {
    rateLimit(req, 30);
    const link = q.linkByHash.get(sha256(token));
    if (!link) throw new HttpError(404, 'This link was turned off.');
    const body = await readBody(req);
    if (!CHEERS[body.kind]) throw new HttpError(400, 'Unknown cheer.');
    const key = `${clientIp(req)}:${link.id}`, last = cheerHits.get(key) || 0;
    if (Date.now() - last < 15_000) throw new HttpError(429, 'Give it a few seconds before cheering again.');
    cheerHits.set(key, Date.now());
    if (cheerHits.size > 5000) cheerHits.clear();
    const user = q.userById.get(link.user_id);
    const s = gameAction(user, (g) => cheer(g, body.kind, Date.now(), user.tz));
    send(res, 200, { ok: true, cheersToday: s.cheersToday });
  }],
  ['GET', /^\/s\/([\w-]{10,64})$/, (req, res, [, token]) => {
    rateLimit(req);
    const link = q.linkByHash.get(sha256(token));
    const user = link && q.userById.get(link.user_id);
    const title = user ? `${user.display_name}'s valley · Sugar Valley` : 'Sugar Valley';
    const html = fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8')
      .replace('<title>Sugar Valley</title>', `<title>${esc(title)}</title><meta name="robots" content="noindex">`);
    send(res, link ? 200 : 404, html, { 'content-type': MIME['.html'], 'x-robots-tag': 'noindex', 'referrer-policy': 'no-referrer' });
  }],
  ['GET', /^\/$/, (req, res) => { res.writeHead(302, { location: '/game/' }); res.end(); }],
  ['GET', /^\/game$/, (req, res) => { res.writeHead(302, { location: '/game/' }); res.end(); }],
];

function serveStatic(req, res, url) {
  const prefix = Object.keys(STATIC).find((p) => url.pathname.startsWith(p));
  if (!prefix || req.method !== 'GET') return false;
  const root = STATIC[prefix];
  let file = path.resolve(root, '.' + decodeURIComponent(url.pathname.slice(prefix.length - 1)));
  if (url.pathname === prefix) file = path.join(root, 'index.html');
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache', 'access-control-allow-origin': '*' });
  // /app/ serves the extension's pages as a plain website, with chrome.* faked by web/chrome-shim.js
  if (prefix === '/app/' && file.endsWith('.html')) {
    res.end(fs.readFileSync(file, 'utf8').replace('<head>', '<head><script src="/web/chrome-shim.js"></script>'));
    return true;
  }
  fs.createReadStream(file).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, PUBLIC_BASE);
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (serveStatic(req, res, url)) return;
    for (const [method, re, handler] of routes) {
      const m = re.exec(url.pathname);
      if (m && method === req.method) return await handler(req, res, m);
    }
    throw new HttpError(404, 'Not found');
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    send(res, e.status || 500, { error: e instanceof HttpError || e instanceof ConnectorError ? e.message : 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Sugar Valley running at ${PUBLIC_BASE}/game/`);
  startPoller();
});

