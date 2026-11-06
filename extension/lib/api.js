// Talks to the Sugar Peek backend. The API key lives in chrome.storage.local.
export const DEFAULT_API = 'http://localhost:8787';

export async function session() {
  return chrome.storage.local.get({ apiBase: DEFAULT_API, apiKey: null });
}

export async function api(method, path, body) {
  const { apiBase, apiKey } = await session();
  let res;
  try {
    res = await fetch(apiBase + path, {
      method,
      headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error('Can\'t reach the Sugar Peek server. Is it running?'), { offline: true });
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) await chrome.storage.local.remove('apiKey');
  if (!res.ok && !(res.status === 422 && data.connection !== undefined)) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const refreshBadge = () => chrome.runtime.sendMessage({ type: 'refresh' }).catch(() => {});
