// Account setup: name + units → CGM → visitors. Works for new and returning owners.
import { api, getKey, setKey, clearKey } from './net.js';
import { MGDL_PER_MMOL } from './data/cgm.js';

const $ = (s, el = document) => el.querySelector(s);
const steps = { you: $('#step-you'), cgm: $('#step-cgm'), share: $('#step-share') };
const SOURCE_NAME = { dexcom: 'Dexcom', librelinkup: 'Libre', nightscout: 'Nightscout', demo: 'Demo data' };
let me = null;

// ---------- segmented buttons ----------
function seg(el, onChange) {
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    onChange?.(b.dataset.v);
  });
}
const segValue = (el) => el.querySelector('[aria-pressed="true"]').dataset.v;
const setSeg = (el, v) => el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === v)));

// ---------- step state ----------
function open(name) {
  for (const [k, el] of Object.entries(steps)) {
    const isOpen = k === name;
    $('form', el).hidden = !isOpen;
    el.classList.toggle('locked', !isOpen && !el.classList.contains('done'));
    $('.edit', el).hidden = isOpen || !el.classList.contains('done');
    $('.summary', el).hidden = isOpen || !el.classList.contains('done');
  }
  if (name) $('input:not([type=checkbox]), select', steps[name])?.focus({ preventScroll: true });
}
function done(name, summary) {
  steps[name].classList.add('done');
  $('.summary', steps[name]).textContent = summary;
}
for (const [k, el] of Object.entries(steps)) $('.edit', el).addEventListener('click', () => { open(k); $('#done').hidden = true; });

async function submitting(form, fn) {
  const btn = $('.btn', form), err = $('.error', form), label = btn.textContent;
  err.textContent = ''; btn.disabled = true; btn.textContent = 'One moment…';
  try { await fn(); } catch (e) { err.textContent = e.message; }
  btn.disabled = false; btn.textContent = label;
}

// ---------- units ----------
const toUnit = (mgdl, unit) => (unit === 'mmol' ? (mgdl / MGDL_PER_MMOL).toFixed(1) : String(Math.round(mgdl)));
const fromUnit = (v, unit) => (unit === 'mmol' ? Math.round(Number(v) * MGDL_PER_MMOL) : Math.round(Number(v)));

// ---------- 1. you ----------
const youForm = $('form', steps.you), unitSeg = $('[data-name=unit]', youForm);
seg(unitSeg);
youForm.addEventListener('submit', (e) => {
  e.preventDefault();
  submitting(youForm, async () => {
    const body = { displayName: youForm.displayName.value.trim(), unit: segValue(unitSeg), tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
    if (!body.displayName) throw new Error('Add your name.');
    if (me) me = await api('PUT', '/api/me', body);
    else { const r = await api('POST', '/api/account', body); setKey(r.apiKey); me = r.me; }
    render();
    if (me.connection) showDone(); else open('cgm');
  });
});

// ---------- 2. cgm ----------
const cgmForm = $('form', steps.cgm), typeSeg = $('[data-name=type]', cgmForm);
const showSource = (v) => cgmForm.querySelectorAll('[data-src]').forEach((d) => { d.hidden = d.dataset.src !== v; });
seg(typeSeg, showSource);
cgmForm.addEventListener('submit', (e) => {
  e.preventDefault();
  submitting(cgmForm, async () => {
    const type = segValue(typeSeg), body = { type };
    for (const el of cgmForm.querySelectorAll(`[data-src="${type}"] [name]`)) body[el.name] = el.value;
    const r = await api('PUT', '/api/connection', body);
    if (r.error) throw new Error(r.error);
    me = r;
    cgmForm.querySelectorAll('input[type=password]').forEach((i) => { i.value = ''; });
    render();
    if (steps.share.classList.contains('done')) { open(null); showDone(); } else open('share');
  });
});

// ---------- 3. visitors ----------
const shareForm = $('form', steps.share);
shareForm.addEventListener('submit', (e) => {
  e.preventDefault();
  submitting(shareForm, async () => {
    const u = me.unit, f = shareForm;
    const thresholds = { urgentLow: fromUnit(f.urgentLow.value, u), low: fromUnit(f.low.value, u), high: fromUnit(f.high.value, u), urgentHigh: fromUnit(f.urgentHigh.value, u) };
    me = await api('PUT', '/api/me', {
      showGraph: f.showGraph.checked, contactPhone: f.contactPhone.value.trim(), thresholds, tirTarget: Number(f.tirTarget.value),
    });
    render();
    open(null);
    showDone();
  });
});

// ---------- render from /api/me ----------
function render() {
  if (!me) return;
  youForm.displayName.value = me.displayName;
  setSeg(unitSeg, me.unit);
  const via = (me.signIns || []).map((s) => (s.provider === 'google' ? 'Google' : 'Apple')).join(', ');
  done('you', `${me.displayName} · ${me.unit === 'mmol' ? 'mmol/L' : 'mg/dL'}${via ? ` · ${via}` : ''}`);
  if (me.connection) {
    const c = me.connection;
    done('cgm', '');
    const s = $('.summary', steps.cgm);
    s.innerHTML = '';
    const st = document.createElement('span');
    st.className = `status${c.status === 'ok' ? '' : ' err'}`;
    st.textContent = `${SOURCE_NAME[c.type]}${c.detail && c.type !== 'demo' ? ` · ${c.detail}` : ''} · ${c.status === 'ok' ? 'Connected' : c.lastError || 'Not connected'}`;
    s.append(st);
    setSeg(typeSeg, c.type); showSource(c.type);
  }
  const f = shareForm, t = me.thresholds, u = me.unit;
  f.showGraph.checked = me.showGraph;
  f.contactPhone.value = me.contactPhone || '';
  f.low.value = toUnit(t.low, u); f.high.value = toUnit(t.high, u);
  f.urgentLow.value = toUnit(t.urgentLow, u); f.urgentHigh.value = toUnit(t.urgentHigh, u);
  f.tirTarget.value = me.tirTarget;
  if (me.connection && me.showGraph !== undefined && steps.share.dataset.saved) {
    done('share', `${me.showGraph ? 'Numbers shown' : 'Numbers hidden'}${me.contactPhone ? ' · Urgent contact set' : ''}`);
  }
}

function showDone() {
  steps.share.dataset.saved = '1';
  done('share', `${me.showGraph ? 'Numbers shown' : 'Numbers hidden'}${me.contactPhone ? ' · Urgent contact set' : ''}`);
  open(null);
  $('#done').hidden = false;
  $('#done [name=link]').value = me.share.url;
}

$('#copy').addEventListener('click', async () => {
  const input = $('#done [name=link]');
  try { await navigator.clipboard.writeText(input.value); } catch { input.select(); document.execCommand('copy'); }
  $('#copy').textContent = 'Copied';
  setTimeout(() => { $('#copy').textContent = 'Copy'; }, 1500);
});

// ---------- sign in with Google / Apple (only when the server has them configured) ----------
const loadScript = (src) => new Promise((resolve, reject) => {
  const s = document.createElement('script'); s.src = src; s.async = true; s.onload = resolve; s.onerror = reject; document.head.append(s);
});
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

async function signIn(provider, idToken, name) {
  const err = $('#signin-error');
  err.textContent = '';
  try {
    const r = await api('POST', `/api/auth/${provider}`, { idToken, name, tz: tz() });
    setKey(r.apiKey);
    me = r.me;
    render();
    if (me.connection) showDone(); else open('cgm');
  } catch (e) { err.textContent = e.message; }
}

async function initSignIn() {
  let cfg = {};
  try { cfg = await api('GET', '/api/auth/config'); } catch { return; }
  const linked = new Set((me?.signIns || []).map((s) => s.provider));
  const google = cfg.google && !linked.has('google'), apple = cfg.apple && !linked.has('apple');
  if (!google && !apple) return;
  $('#signin').hidden = false;
  $('#signin-or').hidden = !!me;
  if (google) {
    try {
      await loadScript('https://accounts.google.com/gsi/client');
      window.google.accounts.id.initialize({ client_id: cfg.google.clientId, callback: (r) => signIn('google', r.credential) });
      window.google.accounts.id.renderButton($('#google-btn'), { theme: 'outline', size: 'large', text: me ? 'signin_with' : 'continue_with', width: 300 });
    } catch { $('#signin-error').textContent = 'Google sign-in could not load.'; }
  }
  if (apple) {
    try {
      await loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js');
      window.AppleID.auth.init({ clientId: cfg.apple.clientId, scope: 'name email', redirectURI: cfg.apple.redirectUri, usePopup: true });
      const btn = $('#apple-btn');
      btn.hidden = false;
      btn.addEventListener('click', async () => {
        try {
          const r = await window.AppleID.auth.signIn();
          const n = r.user?.name; // Apple only sends the name the first time
          signIn('apple', r.authorization.id_token, n ? [n.firstName, n.lastName].filter(Boolean).join(' ') : undefined);
        } catch (e) { if (e?.error !== 'popup_closed_by_user') $('#signin-error').textContent = 'Apple sign-in did not finish.'; }
      });
    } catch { $('#signin-error').textContent = 'Apple sign-in could not load.'; }
  }
}

$('#signout').addEventListener('click', async (e) => {
  e.preventDefault();
  try { await api('POST', '/api/auth/sign-out'); } catch { /* still sign out locally */ }
  clearKey();
  location.reload();
});

// ---------- start ----------
(async () => {
  if (getKey()) {
    try { me = await api('GET', '/api/me'); } catch { me = null; }
  }
  initSignIn();
  if (!me) { open('you'); return; }
  $('#signout-wrap').hidden = false;
  render();
  if (!me.connection) { open('cgm'); return; }
  showDone();
})();
