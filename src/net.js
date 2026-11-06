// How the game gets its data. Three modes:
//   owner  — the T1D player, signed in with the key from setup (localStorage)
//   viewer — a visitor on the owner's share link (/s/<token>)
//   demo   — offline: demo readings + localStorage save (?demo), used for screenshots and trying it out
import { demoView, demoAct } from './demo.js';

export const params = new URLSearchParams(location.search);
const share = location.pathname.match(/^\/s\/([\w-]{10,64})/);
export const MODE = share ? 'viewer' : params.has('demo') ? 'demo' : 'owner';
const TOKEN = share?.[1];
const KEY = 'sugar-valley-key';

export function getKey() { try { return localStorage.getItem(KEY); } catch { return null; } }
export function setKey(k) { try { localStorage.setItem(KEY, k); } catch { /* blocked storage */ } }
export function clearKey() { try { localStorage.removeItem(KEY); } catch { /* blocked storage */ } }

export class NetError extends Error { constructor(status, message) { super(message); this.status = status; } }

export async function api(method, path, body) {
  const headers = { 'content-type': 'application/json' };
  const key = getKey();
  if (key) headers.authorization = `Bearer ${key}`;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 422) throw new NetError(res.status, data.error || 'Something went wrong.');
  return data;
}

export function goToSetup() { location.href = '/game/setup.html'; }

/** Load the valley for the current mode. */
export async function loadView() {
  if (MODE === 'demo') return demoView();
  if (MODE === 'viewer') return api('GET', `/api/share/${TOKEN}/valley`);
  if (!getKey()) { goToSetup(); return new Promise(() => {}); }
  try { return await api('GET', '/api/valley'); } catch (e) {
    if (e.status === 401) { clearKey(); goToSetup(); return new Promise(() => {}); }
    throw e;
  }
}

/** Owner: collect | restore {id} | water.  Viewer: gift {kind}. Returns { view, ...result }. */
export async function act(action, body = {}) {
  if (MODE === 'demo') return demoAct(action, body);
  if (MODE === 'viewer') return api('POST', `/api/share/${TOKEN}/${action}`, body);
  return api('POST', `/api/valley/${action}`, body);
}
