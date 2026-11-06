// Lets the extension's pages run as a normal website at /app/ (no install needed).
// Stands in for the few chrome.* APIs they use; the API key is kept in localStorage.
(() => {
  if (window.chrome?.runtime?.id) return; // real extension: leave it alone
  const KEY = 'sugarpeek-web';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch {} };
  window.chrome = {
    storage: { local: {
      get: async (defaults) => ({ ...defaults, apiBase: location.origin, ...load() }),
      set: async (o) => save({ ...load(), ...o }),
      remove: async (k) => { const s = load(); delete s[k]; save(s); },
    } },
    runtime: {
      getURL: (p) => `${location.origin}/app/${p}`,
      sendMessage: async () => {},
      openOptionsPage: () => { location.href = '/app/app.html'; },
    },
  };
})();
