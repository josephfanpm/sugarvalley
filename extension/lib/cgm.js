// CGM source picker + credentials form, shared by onboarding and the CGM page.
import { api } from './api.js';
import { icon } from './icons.js';

export const SOURCES = {
  dexcom: { name: 'Dexcom', blurb: 'G6, G7 and ONE+ via Dexcom Share', icon: 'activity' },
  librelinkup: { name: 'FreeStyle Libre', blurb: 'Libre 2 and 3 via LibreLinkUp', icon: 'droplet' },
  nightscout: { name: 'Nightscout', blurb: 'Your own Nightscout site', icon: 'link' },
  demo: { name: 'Demo data', blurb: 'Try Sugar Peek without a sensor', icon: 'sparkles' },
};

const FIELDS = {
  dexcom: `
    <div class="form-grid">
      <div class="field"><label for="f-user">Dexcom username</label><input id="f-user" name="username" autocomplete="username" required></div>
      <div class="field"><label for="f-pass">Password</label><input id="f-pass" name="password" type="password" autocomplete="current-password" required></div>
      <div class="field"><label for="f-region">Region</label><select id="f-region" name="region"><option value="us">United States</option><option value="ous">Outside the US</option><option value="jp">Japan</option></select></div>
    </div>
    <p class="hint">Share must be turned on in the Dexcom app. Your password is encrypted and never shown again.</p>`,
  librelinkup: `
    <ol class="steps"><li>In the Libre app, open Connected Apps → LibreLinkUp and invite a follower.</li><li>Accept the invite in the LibreLinkUp app.</li><li>Sign in with that follower account below.</li></ol>
    <div class="form-grid" style="margin-top:14px">
      <div class="field"><label for="f-email">LibreLinkUp email</label><input id="f-email" name="email" type="email" autocomplete="username" required></div>
      <div class="field"><label for="f-lpass">Password</label><input id="f-lpass" name="password" type="password" autocomplete="current-password" required></div>
    </div>`,
  nightscout: `
    <div class="form-grid">
      <div class="field"><label for="f-url">Site URL</label><input id="f-url" name="url" placeholder="https://your-site.herokuapp.com" required></div>
      <div class="field"><label for="f-token">Read-only token</label><input id="f-token" name="token" placeholder="sugarpeek-1a2b3c…"></div>
    </div>`,
  demo: `
    <div class="field"><label for="f-scn">Scenario</label><select id="f-scn" name="scenario">
      <option value="live">Live: drifts through every range</option><option value="in_range">Normal</option><option value="high">High</option>
      <option value="urgent_high">Urgent high</option><option value="low">Low</option><option value="urgent_low">Urgent low</option><option value="stale">No recent data</option>
    </select></div>
    <p class="hint">Includes three weeks of history so you can see streaks and rewards right away.</p>`,
};

/** Renders source cards + the matching form. onConnected(me) after a successful connection. */
export function cgmForm(el, { current = null, submitLabel = 'Connect', onConnected }) {
  let source = current?.type || 'dexcom';
  function render() {
    el.innerHTML = `
      <div class="sources">${Object.entries(SOURCES).map(([id, s]) => `
        <button type="button" class="source" data-src="${id}" aria-pressed="${id === source}">
          <span class="src-icon">${icon(s.icon, 16)}</span><b>${s.name}</b><span>${s.blurb}</span>
        </button>`).join('')}</div>
      <form class="cgm-fields" style="margin-top:20px" novalidate>
        ${FIELDS[source]}
        <div class="row" style="margin-top:18px"><button type="submit">${icon('plug-zap')} ${submitLabel}</button><span class="error" role="alert"></span></div>
      </form>`;
    el.querySelectorAll('[data-src]').forEach((b) => b.addEventListener('click', () => { source = b.dataset.src; render(); }));
    if (source === 'demo' && current?.type === 'demo') el.querySelector('[name=scenario]').value = current.detail;
    const form = el.querySelector('form'), err = form.querySelector('.error'), btn = form.querySelector('[type=submit]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      btn.disabled = true; btn.innerHTML = 'Connecting…';
      try {
        const r = await api('PUT', '/api/connection', { type: source, ...Object.fromEntries(new FormData(form)) });
        if (r.error) err.textContent = r.error;
        else onConnected(r);
      } catch (ex) { err.textContent = ex.message; }
      btn.disabled = false; btn.innerHTML = `${icon('plug-zap')} ${submitLabel}`;
    });
  }
  render();
}
