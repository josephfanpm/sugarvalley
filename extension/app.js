// Sugar Peek app: onboarding for new users, then a sidebar app shell with
// Overview, Rewards, Character, CGM, Ranges & goal, Sharing and Account pages.
import { api, session, refreshBadge } from './lib/api.js';
import { icon } from './lib/icons.js';
import { avatarControls, themePicker } from './lib/builder.js';
import { cgmForm, SOURCES } from './lib/cgm.js';
import { renderRewards, showUnseen, ring, bigNews } from './lib/rewards.js';
import { loadAssets, characterSheet, FRAME, DEFAULT_AVATAR } from './shared/avatar.js';
import { mountScene } from './shared/scene.js';
import { STATE_LABEL, formatAgo, formatBg, stateOf, captionFor, TREND_ARROWS, DEFAULT_THRESHOLDS, toUnit, fromUnit, unitLabel } from './shared/glucose.js';
import { ITEM_BY_ID } from './shared/game-data.js';

const root = document.getElementById('root');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, el = document) => el.querySelector(sel);
const assets = await loadAssets(chrome.runtime.getURL('sprites'));
const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
let me = null, cleanups = [];

// ---------- small UI kit ----------
function toast(msg, kind = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast-item';
  t.innerHTML = `${icon(kind === 'ok' ? 'circle-check' : 'circle-alert')}<span>${esc(msg)}</span>`;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 2600);
}

function confirmDialog({ title, body, confirm = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'modal';
    d.innerHTML = `<div class="modal-body"><h2>${esc(title)}</h2><p class="muted">${esc(body)}</p></div>
      <div class="modal-foot"><button class="outline" data-v="0">Cancel</button><button class="${danger ? 'danger' : ''}" data-v="1">${esc(confirm)}</button></div>`;
    document.body.append(d);
    d.showModal();
    d.addEventListener('click', (e) => { const v = e.target.closest('[data-v]')?.dataset.v; if (v) { d.close(); d.remove(); resolve(v === '1'); } });
    d.addEventListener('cancel', () => { d.remove(); resolve(false); });
  });
}

async function copy(text, msg = 'Copied to clipboard') {
  try { await navigator.clipboard.writeText(text); toast(msg); } catch { toast('Couldn’t copy', 'err'); }
}

function setTheme(t) {
  try { localStorage.setItem('sp-theme', t); } catch {}
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}
function currentTheme() { try { return localStorage.getItem('sp-theme') || 'system'; } catch { return 'system'; } }

/** Draws the user's character (head and shoulders) into a canvas. */
async function drawPortrait(cv, avatar, equipped) {
  const hat = ITEM_BY_ID[equipped?.hat], glasses = ITEM_BY_ID[equipped?.glasses];
  const gear = hat || glasses ? { hat: hat && { part: hat.part, color: hat.color }, glasses: glasses && { part: glasses.part } } : null;
  const sheet = await characterSheet(assets, { ...DEFAULT_AVATAR, ...avatar }, 'idle', 'happy', gear);
  cv.width = cv.height = 64;
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, 64, 64); c.drawImage(sheet, 16, 2 * FRAME + 6, 32, 32, 0, 0, 64, 64);
}

function cleanup() { cleanups.forEach((f) => f()); cleanups = []; }

// ===================================================================
// Onboarding
// ===================================================================
const STEPS = ['name', 'character', 'cgm', 'ranges', 'sharing', 'done'];

async function onboarding(startStep = 0) {
  cleanup();
  let step = startStep, draft = { ...DEFAULT_AVATAR, ...(me?.avatar || {}) }, theme = me?.scene || 'forest', unit = me?.unit || 'mgdl';
  root.innerHTML = `
    <div class="onboard">
      <section class="onboard-form">
        <div class="brand"><span class="brand-mark">${icon('droplet', 16)}</span> Sugar Peek</div>
        <div class="stepper" aria-hidden="true">${STEPS.slice(0, -1).map(() => '<span></span>').join('')}</div>
        <div class="onboard-body" id="ob-body"></div>
        <div class="onboard-nav" id="ob-nav"></div>
      </section>
      <section class="onboard-stage">
        <div class="stage-frame"><canvas id="ob-scene"></canvas><div class="stage-caption" id="ob-caption"></div></div>
      </section>
    </div>`;
  const scene = mountScene($('#ob-scene'), assets, { avatar: draft, theme, state: 'in_range' }, { scale: 3, focusY: 0.5 });
  cleanups.push(() => scene.stop());
  const caption = () => captionFor({ name: $('#ob-name')?.value || me?.displayName || 'Sam', latest: { ts: Date.now(), mgdl: 112 }, unit });
  const setCaption = () => { $('#ob-caption').textContent = caption(); };

  function nav({ back = true, next = 'Continue', skip = null, disabled = false } = {}) {
    $('#ob-nav').innerHTML = `${back && step > 0 ? `<button class="ghost" id="ob-back">${icon('chevron-left')} Back</button>` : ''}<span class="spacer"></span>
      ${skip ? `<button class="ghost" id="ob-skip">${skip}</button>` : ''}${next ? `<button id="ob-next" class="lg" ${disabled ? 'disabled' : ''}>${next} ${icon('arrow-right')}</button>` : ''}`;
    $('#ob-back')?.addEventListener('click', () => go(step - 1));
    $('#ob-skip')?.addEventListener('click', () => go(step + 1));
  }
  function header(title, lead) {
    document.querySelectorAll('.stepper span').forEach((s, i) => s.classList.toggle('done', i <= step));
    return `<div class="step-meta">Step ${step + 1} of ${STEPS.length - 1}</div><h1>${title}</h1><p class="lead">${lead}</p>`;
  }

  function go(n) {
    step = Math.max(0, Math.min(STEPS.length - 1, n));
    const body = $('#ob-body'), s = STEPS[step];
    if (s === 'name') {
      body.innerHTML = header('Let friends peek at how you’re doing', 'Sugar Peek turns your CGM into a live pixel character your family can check on. No account needed for them.') + `
        <form id="ob-form"><div class="field"><label for="ob-name">What should we call you?</label><input id="ob-name" maxlength="40" placeholder="Your first name" value="${esc(me?.displayName || '')}" autofocus required></div>
        <p class="error" id="ob-err" style="margin-top:8px"></p></form>
        <p class="signin-link">Already set up on another browser? <a href="#" id="ob-signin">Sign in with your key</a></p>`;
      nav({ next: me ? 'Continue' : 'Create account' });
      $('#ob-name').addEventListener('input', setCaption);
      const submit = async (e) => {
        e?.preventDefault();
        const name = $('#ob-name').value.trim();
        if (!name) { $('#ob-err').textContent = 'Enter a name to continue.'; return; }
        try {
          if (!me) {
            const r = await api('POST', '/api/account', { displayName: name, avatar: draft, tz: browserTz });
            await chrome.storage.local.set({ apiKey: r.apiKey });
            me = r.me;
          } else me = await api('PUT', '/api/me', { displayName: name });
          go(step + 1);
        } catch (ex) { $('#ob-err').textContent = ex.message; }
      };
      $('#ob-form').addEventListener('submit', submit);
      $('#ob-next').addEventListener('click', submit);
      $('#ob-signin').addEventListener('click', (e) => { e.preventDefault(); signInDialog(); });
    } else if (s === 'character') {
      body.innerHTML = header('Make your character', 'This is who your friends will see. You can change it any time.') + `
        <div class="opt-group"><div class="label">Scene</div><div class="themes" id="ob-themes"></div></div>
        <div id="ob-controls" style="margin-top:18px"></div>`;
      themePicker($('#ob-themes'), theme, (t) => { theme = t; scene.update({ theme }); });
      avatarControls($('#ob-controls'), assets, draft, (a) => { draft = a; scene.update({ avatar: a }); }, { compact: true });
      nav();
      $('#ob-next').addEventListener('click', async () => { me = await api('PUT', '/api/me', { avatar: draft, scene: theme }); go(step + 1); });
    } else if (s === 'cgm') {
      body.innerHTML = header('Connect your CGM', 'Readings stay private until you share your link.') + '<div id="ob-cgm"></div>';
      cgmForm($('#ob-cgm'), { current: me.connection, onConnected: (r) => { me = r; toast(`${SOURCES[r.connection.type].name} connected`); go(step + 1); } });
      nav({ next: me.connection ? 'Continue' : null, skip: me.connection ? null : 'Skip for now' });
      $('#ob-next')?.addEventListener('click', () => go(step + 1));
    } else if (s === 'ranges') {
      const t = me.thresholds;
      body.innerHTML = header('Set your ranges', 'These decide what your character does and when friends are asked to check in.') + `
        <div class="field"><label>Units</label><div class="seg" id="ob-unit"><button type="button" data-u="mgdl">mg/dL</button><button type="button" data-u="mmol">mmol/L</button></div></div>
        <div class="form-grid" style="margin-top:16px" id="ob-ranges">
          ${[['urgentLow', 'Urgent low below', 's-urgent_low'], ['low', 'Low below', 's-low'], ['high', 'High above', 's-high'], ['urgentHigh', 'Urgent high above', 's-urgent_high']].map(([k, l, c]) =>
            `<div class="field"><label class="${c}">${l}</label><input type="number" step="any" name="${k}" value="${toUnit(t[k], unit)}"></div>`).join('')}
        </div>
        <div class="field" style="margin-top:18px"><label for="ob-goal">Daily time-in-range goal: <b id="ob-goal-out">${me.tirTarget}%</b></label><input type="range" id="ob-goal" min="50" max="95" step="5" value="${me.tirTarget}">
          <p class="hint">Hit it for the day to earn coins, XP and new items. Most people start at 70%.</p></div>
        <p class="error" id="ob-err"></p>`;
      const seg = () => document.querySelectorAll('#ob-unit button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.u === unit)));
      seg();
      document.querySelectorAll('#ob-unit button').forEach((b) => b.addEventListener('click', () => {
        const vals = readRanges('#ob-ranges', unit); unit = b.dataset.u; seg();
        for (const [k, v] of Object.entries(vals)) $(`#ob-ranges [name=${k}]`).value = toUnit(v, unit);
        setCaption();
      }));
      $('#ob-goal').addEventListener('input', (e) => { $('#ob-goal-out').textContent = `${e.target.value}%`; });
      nav();
      $('#ob-next').addEventListener('click', async () => {
        try { me = await api('PUT', '/api/me', { unit, thresholds: readRanges('#ob-ranges', unit), tirTarget: Number($('#ob-goal').value) }); go(step + 1); }
        catch (ex) { $('#ob-err').textContent = ex.message; }
      });
    } else if (s === 'sharing') {
      body.innerHTML = header('Choose what friends see', 'Everyone with your link sees your character, your number and a caption.') + `
        <div class="card card-pad">
          <div class="setting"><div class="text"><b>Show my 12-hour graph</b><span>Viewers can scroll through your last 12 hours.</span></div>
            <div class="control"><button type="button" class="switch" role="switch" id="ob-graph" aria-checked="${me.showGraph}" aria-label="Show graph"></button></div></div>
          <div class="setting" style="display:block"><div class="text"><b>Contact number for urgent moments</b><span>Optional. Adds Text and Call buttons during urgent lows and highs only.</span></div>
            <input id="ob-phone" type="tel" placeholder="+1 555 123 4567" style="margin-top:10px" value="${esc(me.contactPhone || '')}"></div>
        </div><p class="error" id="ob-err" style="margin-top:8px"></p>`;
      $('#ob-graph').addEventListener('click', (e) => e.currentTarget.setAttribute('aria-checked', String(e.currentTarget.getAttribute('aria-checked') !== 'true')));
      nav({ next: 'Finish setup' });
      $('#ob-next').addEventListener('click', async () => {
        try { me = await api('PUT', '/api/me', { showGraph: $('#ob-graph').getAttribute('aria-checked') === 'true', contactPhone: $('#ob-phone').value }); go(step + 1); }
        catch (ex) { $('#ob-err').textContent = ex.message; }
      });
    } else {
      document.querySelectorAll('.stepper span').forEach((x) => x.classList.add('done'));
      body.innerHTML = `<div class="done-hero"><span class="done-check">${icon('circle-check', 26)}</span><h1>You’re all set, ${esc(me.displayName)}</h1>
        <p class="lead" style="margin:0">Send this link to anyone you want to keep in the loop.</p></div>
        <div class="link-field" style="margin-top:20px"><input readonly value="${esc(me.share.url)}" aria-label="Share link"><button class="outline" id="ob-copy">${icon('copy')} Copy</button></div>`;
      $('#ob-copy').addEventListener('click', () => copy(me.share.url, 'Link copied'));
      nav({ back: false, next: 'Go to dashboard' });
      $('#ob-next').addEventListener('click', () => { location.hash = '#/overview'; start(); });
      refreshBadge();
    }
    setCaption();
  }
  go(step);
}

function readRanges(sel, unit) {
  const out = {};
  for (const k of Object.keys(DEFAULT_THRESHOLDS)) out[k] = fromUnit($(`${sel} [name=${k}]`).value, unit);
  return out;
}

function signInDialog() {
  const d = document.createElement('dialog');
  d.className = 'modal';
  d.innerHTML = `<form method="dialog"><div class="modal-body"><h2>Sign in with your key</h2><p class="muted">Find it in Account → Sign-in key on the browser you set up first.</p>
    <div class="field" style="margin-top:16px"><label for="si-key">Sign-in key</label><input id="si-key" autocomplete="off" spellcheck="false" required></div><p class="error" id="si-err" style="margin-top:8px"></p></div>
    <div class="modal-foot"><button type="button" class="outline" id="si-cancel">Cancel</button><button type="submit">Sign in</button></div></form>`;
  document.body.append(d); d.showModal();
  $('#si-cancel', d).onclick = () => { d.close(); d.remove(); };
  $('form', d).addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = $('#si-key', d).value.trim();
    await chrome.storage.local.set({ apiKey: key });
    try { me = await api('GET', '/api/me'); d.close(); d.remove(); toast(`Welcome back, ${me.displayName}`); location.hash = '#/overview'; start(); }
    catch { await chrome.storage.local.remove('apiKey'); $('#si-err', d).textContent = 'That key didn’t work.'; }
  });
}

// ===================================================================
// App shell
// ===================================================================
const PAGES = {
  overview: { label: 'Overview', icon: 'layout-dashboard', desc: 'Your character, reading and progress at a glance' },
  rewards: { label: 'Rewards', icon: 'trophy', desc: 'Streaks, quests and your collection' },
  character: { label: 'Character', icon: 'palette', desc: 'How you look to friends' },
  cgm: { label: 'CGM connection', icon: 'activity', desc: 'Where your readings come from' },
  ranges: { label: 'Ranges & goal', icon: 'sliders-horizontal', desc: 'Units, ranges and your daily goal' },
  sharing: { label: 'Sharing', icon: 'share-2', desc: 'Your link and what friends see' },
  account: { label: 'Account', icon: 'user-round', desc: 'Profile, sign-in and data' },
};
const NAV = [['Home', ['overview', 'rewards']], ['Settings', ['character', 'cgm', 'ranges', 'sharing', 'account']]];

function shell() {
  root.innerHTML = `
    <div class="app" id="app">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark">${icon('droplet', 16)}</span> Sugar Peek</div>
        ${NAV.map(([label, ids]) => `<div class="nav-label">${label}</div><nav class="nav">${ids.map((id) => `<a href="#/${id}" data-page="${id}">${icon(PAGES[id].icon)} ${PAGES[id].label}${id === 'rewards' ? '<span class="count" id="rewards-count" hidden></span>' : ''}</a>`).join('')}</nav>`).join('')}
        <div class="sidebar-foot">
          <button class="user-btn" id="user-btn" aria-haspopup="menu" aria-expanded="false">
            <span class="portrait"><canvas id="portrait"></canvas></span>
            <span class="who grow"><b id="user-name"></b><span id="user-sub"></span></span>${icon('chevrons-up-down', 16, 'muted')}
          </button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="ghost icon-btn menu-toggle" id="menu-toggle" aria-label="Open navigation">${icon('menu')}</button>
          <h1 id="page-title"></h1>
          <div class="actions">
            <button class="outline sm" id="copy-link">${icon('link', 14)} Copy share link</button>
            <a class="btn sm" id="open-link" target="_blank" rel="noopener">${icon('external-link', 14)} View as friend</a>
          </div>
        </header>
        <div class="content" id="content"></div>
      </div>
    </div>`;
  $('#copy-link').addEventListener('click', () => copy(me.share.url, 'Share link copied'));
  $('#menu-toggle').addEventListener('click', () => $('#app').classList.toggle('nav-open'));
  $('#user-btn').addEventListener('click', (e) => { e.stopPropagation(); userMenu(); });
}

function updateChrome() {
  $('#user-name').textContent = me.displayName;
  $('#user-sub').textContent = `Level ${me.game.level} · ${me.game.streak}-day streak`;
  $('#open-link').href = me.share.url;
  const n = bigNews(me.game).filter((e) => e.type !== 'day' && e.type !== 'quest').length;
  $('#rewards-count').hidden = !n; $('#rewards-count').textContent = n;
  drawPortrait($('#portrait'), me.avatar, me.game.equipped);
}

function userMenu() {
  const existing = $('#user-menu');
  if (existing) { existing.remove(); $('#user-btn').setAttribute('aria-expanded', 'false'); return; }
  const m = document.createElement('div');
  m.className = 'menu up'; m.id = 'user-menu'; m.setAttribute('role', 'menu');
  const theme = currentTheme();
  m.innerHTML = `
    <div class="menu-head"><span class="portrait"><canvas id="menu-portrait"></canvas></span><div><b>${esc(me.displayName)}</b><span>Level ${me.game.level} · ${me.game.coins.toLocaleString()} coins</span></div></div>
    <div class="menu-sep"></div>
    <button class="menu-item" role="menuitem" data-act="view">${icon('external-link')} View my link</button>
    <button class="menu-item" role="menuitem" data-act="copy">${icon('copy')} Copy share link</button>
    <button class="menu-item" role="menuitem" data-act="rewards">${icon('trophy')} Rewards</button>
    <div class="menu-sep"></div>
    <div class="menu-theme"><span>Theme</span><div class="seg">${[['system', 'monitor'], ['light', 'sun'], ['dark', 'moon']].map(([t, i]) => `<button type="button" data-theme="${t}" aria-pressed="${t === theme}" aria-label="${t} theme" title="${t[0].toUpperCase() + t.slice(1)}">${icon(i, 14)}</button>`).join('')}</div></div>
    <div class="menu-sep"></div>
    <button class="menu-item" role="menuitem" data-act="account">${icon('settings')} Account settings</button>
    <button class="menu-item" role="menuitem" data-act="signout">${icon('log-out')} Sign out</button>`;
  $('.sidebar-foot').append(m);
  $('#user-btn').setAttribute('aria-expanded', 'true');
  drawPortrait($('#menu-portrait'), me.avatar, me.game.equipped);
  m.addEventListener('click', async (e) => {
    e.stopPropagation();
    const t = e.target.closest('[data-theme]');
    if (t) { setTheme(t.dataset.theme); m.querySelectorAll('[data-theme]').forEach((b) => b.setAttribute('aria-pressed', String(b === t))); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    m.remove();
    if (act === 'view') window.open(me.share.url, '_blank', 'noopener');
    if (act === 'copy') copy(me.share.url, 'Share link copied');
    if (act === 'rewards') location.hash = '#/rewards';
    if (act === 'account') location.hash = '#/account';
    if (act === 'signout') signOut();
  });
  const close = (e) => { if (!m.contains(e.target)) { m.remove(); $('#user-btn')?.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', close); document.removeEventListener('keydown', esc_); } };
  const esc_ = (e) => { if (e.key === 'Escape') close(e); };
  setTimeout(() => { document.addEventListener('click', close); document.addEventListener('keydown', esc_); });
}

async function signOut() {
  const ok = await confirmDialog({ title: 'Sign out of Sugar Peek?', body: 'Your link keeps working for friends. To sign back in, you’ll need the sign-in key from Account settings.', confirm: 'Sign out' });
  if (!ok) return;
  await chrome.storage.local.remove('apiKey');
  me = null; location.hash = ''; start();
}

function route() {
  cleanup();
  const id = (location.hash.match(/^#\/(\w+)/) || [])[1];
  const page = PAGES[id] ? id : 'overview';
  document.querySelectorAll('[data-page]').forEach((a) => { if (a.dataset.page === page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#page-title').textContent = PAGES[page].label;
  $('#app').classList.remove('nav-open');
  document.title = `${PAGES[page].label} · Sugar Peek`;
  const content = $('#content');
  content.innerHTML = `<div class="page-head"><div><h2>${PAGES[page].label}</h2><p>${PAGES[page].desc}</p></div></div><div id="page" class="stack"></div>`;
  ({ overview, rewards, character, cgm, ranges, sharing, account })[page]($('#page'));
  updateChrome();
}

function setMe(next) { me = next; updateChrome(); }

// ---------- pages ----------
function overview(el) {
  const t = me.thresholds, state = stateOf(me.latest, Date.now(), t), g = me.game;
  const bg = me.latest ? formatBg(me.latest.mgdl, me.unit).split(' ') : ['--', ''];
  const conn = me.connection;
  el.innerHTML = `
    ${!conn || conn.status !== 'ok' ? `<div class="card card-pad row" style="gap:12px;border-color:color-mix(in srgb,var(--c-low) 40%,var(--border))">${icon('cloud-off', 18)}<div class="grow"><b>${conn ? 'Your CGM connection needs attention' : 'No CGM connected yet'}</b><div class="muted small">${conn ? esc(conn.lastError || '') : 'Connect a sensor so your character can show your real numbers.'}</div></div><a class="btn sm" href="#/cgm">Fix</a></div>` : ''}
    <div class="grid-3">
      <div class="card hero-card span-2">
        <canvas id="ov-scene"></canvas>
        <div class="hero-overlay">
          <div class="row" style="align-items:baseline;gap:6px"><span class="bg-value s-${state}">${bg[0]}</span><span class="bg-value s-${state}" style="font-size:26px">${state === 'stale' || !me.latest ? '' : TREND_ARROWS[me.latest.trend] || ''}</span><span class="unit">${bg[1]}</span></div>
          <div class="row" style="gap:10px;margin-top:6px"><span class="state s-${state}"><span class="dot"></span>${STATE_LABEL[state]}</span><span class="muted small">${me.latest ? formatAgo(me.latest.ts) : ''}</span></div>
        </div>
        <div class="hero-activity"><span class="badge" id="ov-activity"></span></div>
      </div>
      <div class="stack">
        <div class="card stat-card"><div class="k">${icon('target')} Today’s goal</div>
          <div class="row" style="gap:14px;margin-top:6px">${ring(g.today.tir, g.target, 84)}<div><div class="v" style="margin:0;font-size:22px">${g.today.hoursInRange} h</div><div class="sub">in range today</div></div></div></div>
        <div class="card stat-card"><div class="k">${icon('flame')} Streak</div><div class="v">${g.streak} ${g.streak === 1 ? 'day' : 'days'}</div>
          <div class="sub">${g.nextMilestone.left} to your ${g.nextMilestone.days}-day reward</div><div class="progress"><div style="width:${Math.min(100, (g.streak / g.nextMilestone.days) * 100)}%"></div></div></div>
      </div>
    </div>
    <div class="grid-2">
      <div class="card"><div class="card-head"><div><h3>Your share link</h3><p>Anyone with this link can peek. No account needed.</p></div></div>
        <div class="card-body"><div class="link-field"><input readonly value="${esc(me.share.url)}" aria-label="Share link"><button class="outline" id="ov-copy">${icon('copy')} Copy</button></div>
          <p class="hint" style="margin-top:12px">“${esc(captionFor({ name: me.displayName, latest: me.latest, unit: me.unit, thresholds: t }))}”</p></div>
        <div class="card-foot"><a class="btn ghost sm" href="#/sharing">Sharing settings ${icon('chevron-right', 14)}</a></div></div>
      <div class="card"><div class="card-head"><div><h3>Recent activity</h3><p>Rewards, streaks and quests</p></div></div>
        <div class="card-body"><ul class="feed">${g.log.slice(0, 5).map((e) => `<li><span class="dot-icon">${icon(e.type === 'unlock' ? 'gift' : e.type === 'milestone' ? 'flame' : e.type === 'quest' ? 'target' : e.type === 'level' ? 'star' : e.type === 'achievement' ? 'trophy' : 'calendar-days', 15)}</span><div><b>${esc(e.title)}</b><span>${esc(e.detail || '')}</span></div></li>`).join('') || '<li class="muted">Your first day is scored at midnight.</li>'}</ul></div>
        <div class="card-foot"><a class="btn ghost sm" href="#/rewards">All rewards ${icon('chevron-right', 14)}</a></div></div>
    </div>`;
  const scene = mountScene($('#ov-scene'), assets, { avatar: me.avatar, theme: me.scene, state, gear: g.equipped }, { scale: 3, focusY: 0.55, onActivity: (l) => { const a = $('#ov-activity'); if (a) a.textContent = l ? `Now: ${l}` : ''; } });
  cleanups.push(() => scene.stop());
  $('#ov-copy').addEventListener('click', () => copy(me.share.url, 'Share link copied'));
  showUnseen(g, (game) => setMe({ ...me, game }));
}

function rewards(el) {
  renderRewards(el, { me, game: me.game, assets, toast, onChange: (game) => setMe({ ...me, game }) });
  showUnseen(me.game, (game) => { setMe({ ...me, game }); route(); });
}

function character(el) {
  let draft = { ...DEFAULT_AVATAR, ...me.avatar }, theme = me.scene, mood = 'in_range', saveTimer;
  el.innerHTML = `
    <div class="builder">
      <div class="card preview-card"><div class="preview-stage"><canvas id="ch-scene"></canvas></div>
        <div class="preview-foot"><div class="label muted small" style="margin-bottom:6px">Preview a reading</div><div class="chips" id="ch-moods"></div></div></div>
      <div class="stack">
        <div class="card"><div class="card-head"><div><h3>Scene</h3><p>Where your character hangs out</p></div><span class="badge" id="ch-saved">Saved</span></div><div class="card-body"><div class="themes" id="ch-themes"></div></div></div>
        <div class="card"><div class="card-head"><div><h3>Appearance</h3><p>Hats, glasses and pets are in <a href="#/rewards">Rewards</a></p></div></div><div class="card-body" id="ch-controls"></div></div>
      </div>
    </div>`;
  const scene = mountScene($('#ch-scene'), assets, { avatar: draft, theme, state: mood, gear: me.game.equipped }, { scale: 3, focusY: 0.55 });
  cleanups.push(() => scene.stop());
  const saved = (txt) => { $('#ch-saved').textContent = txt; };
  const save = (patch) => { saved('Saving…'); clearTimeout(saveTimer); saveTimer = setTimeout(async () => { setMe(await api('PUT', '/api/me', patch())); saved('Saved'); }, 450); };
  themePicker($('#ch-themes'), theme, (t) => { theme = t; scene.update({ theme }); save(() => ({ scene: theme })); });
  avatarControls($('#ch-controls'), assets, draft, (a) => { draft = a; scene.update({ avatar: a }); save(() => ({ avatar: draft })); });
  const moods = () => {
    $('#ch-moods').innerHTML = ['urgent_low', 'low', 'in_range', 'high', 'urgent_high', 'stale'].map((s) => `<button type="button" class="chip-btn sm" data-mood="${s}" aria-pressed="${s === mood}">${STATE_LABEL[s]}</button>`).join('');
    document.querySelectorAll('[data-mood]').forEach((b) => b.addEventListener('click', () => { mood = b.dataset.mood; moods(); scene.update({ state: mood }); }));
  };
  moods();
}

function cgm(el) {
  const c = me.connection;
  el.innerHTML = `
    <div class="card"><div class="card-head"><div><h3>Status</h3><p>We check for new readings every 5 minutes</p></div></div>
      <div class="card-body">${c ? `<div class="conn-status"><span class="src-icon">${icon(SOURCES[c.type].icon)}</span><div class="grow"><b>${SOURCES[c.type].name}</b><div class="muted small">${esc(c.detail)}</div></div>
        ${c.status === 'ok' ? `<span class="badge ok">${icon('circle-check', 12)} Connected · ${formatAgo(c.lastPolledAt)}</span>` : `<span class="badge danger">${icon('circle-alert', 12)} ${esc(c.lastError || 'Error')}</span>`}
        <button class="ghost sm" id="cgm-disconnect">Disconnect</button></div>` : `<div class="conn-status"><span class="src-icon">${icon('cloud-off')}</span><div class="grow"><b>Not connected</b><div class="muted small">Pick a source below.</div></div></div>`}</div></div>
    <div class="card"><div class="card-head"><div><h3>${c ? 'Change source' : 'Connect a source'}</h3><p>Credentials are encrypted and only used to read glucose values</p></div></div><div class="card-body" id="cgm-form"></div></div>`;
  cgmForm($('#cgm-form'), { current: c, submitLabel: c ? 'Save and reconnect' : 'Connect', onConnected: (r) => { setMe(r); toast(`${SOURCES[r.connection.type].name} connected`); route(); refreshBadge(); } });
  $('#cgm-disconnect')?.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Disconnect your CGM?', body: 'Your character will show “no recent data” until you connect again.', confirm: 'Disconnect', danger: true }))) return;
    setMe(await api('DELETE', '/api/connection')); toast('Disconnected'); route(); refreshBadge();
  });
}

function ranges(el) {
  let unit = me.unit;
  const t = me.thresholds;
  el.innerHTML = `
    <div class="card"><div class="card-head"><div><h3>Units</h3><p>Used in the app and on your share link</p></div></div>
      <div class="card-body"><div class="seg" id="rg-unit"><button type="button" data-u="mgdl">mg/dL</button><button type="button" data-u="mmol">mmol/L</button></div></div></div>
    <form class="card" id="rg-form"><div class="card-head"><div><h3>Your ranges</h3><p>Drive the character, captions, colors and alerts to friends</p></div></div>
      <div class="card-body"><div class="form-grid" id="rg-ranges">
        ${[['urgentLow', 'Urgent low below', 's-urgent_low'], ['low', 'Low below', 's-low'], ['high', 'High above', 's-high'], ['urgentHigh', 'Urgent high above', 's-urgent_high']].map(([k, l, c]) =>
          `<div class="field"><label class="${c}">${l}</label><input type="number" step="any" name="${k}" value="${toUnit(t[k], unit)}"></div>`).join('')}
      </div><p class="hint" id="rg-normal"></p></div>
      <div class="card-foot"><p class="error" id="rg-err"></p><button type="button" class="ghost" id="rg-reset">Reset to defaults</button><button type="submit">Save ranges</button></div></form>
    <div class="card"><div class="card-head"><div><h3>Daily time-in-range goal</h3><p>Hit it to earn rewards and grow your streak</p></div><span class="badge accent" id="rg-goal-out">${me.tirTarget}%</span></div>
      <div class="card-body"><input type="range" id="rg-goal" min="50" max="95" step="5" value="${me.tirTarget}" style="width:100%"><div class="row muted small" style="justify-content:space-between"><span>50%</span><span>70% is a common target</span><span>95%</span></div></div></div>`;
  const seg = () => document.querySelectorAll('#rg-unit button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.u === unit)));
  const normal = () => { $('#rg-normal').innerHTML = `<span class="s-in_range">●</span> Normal: ${esc($('[name=low]').value)}–${esc($('[name=high]').value)} ${unitLabel(unit)}`; };
  seg(); normal();
  $('#rg-ranges').addEventListener('input', normal);
  document.querySelectorAll('#rg-unit button').forEach((b) => b.addEventListener('click', async () => {
    const vals = readRanges('#rg-ranges', unit); unit = b.dataset.u; seg();
    for (const [k, v] of Object.entries(vals)) $(`#rg-ranges [name=${k}]`).value = toUnit(v, unit);
    normal(); setMe(await api('PUT', '/api/me', { unit })); toast(`Showing ${unitLabel(unit)}`); refreshBadge();
  }));
  $('#rg-reset').addEventListener('click', () => { for (const [k, v] of Object.entries(DEFAULT_THRESHOLDS)) $(`#rg-ranges [name=${k}]`).value = toUnit(v, unit); normal(); });
  $('#rg-form').addEventListener('submit', async (e) => {
    e.preventDefault(); $('#rg-err').textContent = '';
    try { setMe(await api('PUT', '/api/me', { thresholds: readRanges('#rg-ranges', unit) })); toast('Ranges saved'); refreshBadge(); }
    catch (ex) { $('#rg-err').textContent = ex.message; }
  });
  $('#rg-goal').addEventListener('input', (e) => { $('#rg-goal-out').textContent = `${e.target.value}%`; });
  $('#rg-goal').addEventListener('change', async (e) => { setMe(await api('PUT', '/api/me', { tirTarget: Number(e.target.value) })); toast(`Daily goal set to ${e.target.value}%`); });
}

function sharing(el) {
  el.innerHTML = `
    <div class="card"><div class="card-head"><div><h3>Share link</h3><p>Anyone with this link can see your character, reading and caption</p></div></div>
      <div class="card-body"><div class="link-field"><input readonly value="${esc(me.share.url)}" aria-label="Share link"><button class="outline" id="sh-copy">${icon('copy')} Copy</button><a class="btn outline" href="${esc(me.share.url)}" target="_blank" rel="noopener">${icon('external-link')} Open</a></div></div>
      <div class="card-foot"><p class="hint">Shared it too widely? Resetting turns off the old link.</p><button class="danger-outline sm" id="sh-reset">${icon('refresh-cw', 14)} Reset link</button></div></div>
    <div class="card"><div class="card-head"><div><h3>What friends see</h3><p>Changes apply right away</p></div></div>
      <div class="card-body">
        <div class="setting"><div class="text"><b>12-hour graph</b><span>Let viewers scroll through your last 12 hours of readings.</span></div>
          <div class="control"><button type="button" class="switch" role="switch" id="sh-graph" aria-checked="${me.showGraph}" aria-label="Show graph"></button></div></div>
        <div class="setting"><div class="text"><b>Units</b><span>Friends see ${unitLabel(me.unit)}. They can’t change it.</span></div><div class="control"><a class="btn outline sm" href="#/ranges">Change</a></div></div>
        <div class="setting"><div class="text"><b>Title and cosmetics</b><span>Your equipped title, hat and pet show on your link.</span></div><div class="control"><a class="btn outline sm" href="#/rewards">Manage</a></div></div>
      </div></div>
    <form class="card" id="sh-form"><div class="card-head"><div><h3>Urgent contact</h3><p>Optional. Shows Text and Call buttons on your link only during urgent lows and highs.</p></div></div>
      <div class="card-body"><div class="field" style="max-width:320px"><label for="sh-phone">Phone number</label><input id="sh-phone" type="tel" placeholder="+1 555 123 4567" value="${esc(me.contactPhone || '')}"></div></div>
      <div class="card-foot"><p class="error" id="sh-err"></p><button type="submit">Save</button></div></form>`;
  $('#sh-copy').addEventListener('click', () => copy(me.share.url, 'Share link copied'));
  $('#sh-graph').addEventListener('click', async (e) => {
    const on = e.currentTarget.getAttribute('aria-checked') !== 'true';
    e.currentTarget.setAttribute('aria-checked', String(on));
    setMe(await api('PUT', '/api/me', { showGraph: on })); toast(on ? 'Graph is visible on your link' : 'Graph hidden from your link');
  });
  $('#sh-reset').addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Reset your share link?', body: 'The current link stops working immediately. You’ll need to send the new one to friends.', confirm: 'Reset link', danger: true }))) return;
    setMe(await api('POST', '/api/share-link/reset')); toast('New link created'); route();
  });
  $('#sh-form').addEventListener('submit', async (e) => {
    e.preventDefault(); $('#sh-err').textContent = '';
    try { setMe(await api('PUT', '/api/me', { contactPhone: $('#sh-phone').value })); toast('Contact number saved'); }
    catch (ex) { $('#sh-err').textContent = ex.message; }
  });
}

async function account(el) {
  const { apiKey } = await session();
  el.innerHTML = `
    <form class="card" id="ac-form"><div class="card-head"><div><h3>Profile</h3><p>Your name appears on your link and in captions</p></div></div>
      <div class="card-body row" style="gap:16px;align-items:flex-end"><span class="portrait lg"><canvas id="ac-portrait"></canvas></span>
        <div class="field grow" style="max-width:360px"><label for="ac-name">Display name</label><input id="ac-name" maxlength="40" value="${esc(me.displayName)}" required></div></div>
      <div class="card-foot"><p class="error" id="ac-err"></p><button type="submit">Save</button></div></form>
    <div class="card"><div class="card-head"><div><h3>Sign-in key</h3><p>Use it to sign in on another browser. Keep it private, like a password.</p></div></div>
      <div class="card-body"><div class="key-box"><input id="ac-key" type="password" readonly value="${esc(apiKey)}" aria-label="Sign-in key"><button class="outline icon-btn" id="ac-reveal" aria-label="Show key">${icon('eye')}</button><button class="outline" id="ac-copy">${icon('copy')} Copy</button></div>
        <p class="hint">Time zone: ${esc(me.tz)}. Days are scored at midnight there.</p></div></div>
    <div class="card"><div class="card-head"><div><h3>Session</h3><p>Signing out keeps your link working for friends</p></div></div>
      <div class="card-foot" style="border-top:0;background:none;justify-content:flex-start;padding-top:12px"><button class="outline" id="ac-signout">${icon('log-out')} Sign out</button></div></div>
    <div class="card danger-zone"><div class="card-head"><div><h3>Delete account</h3><p>Permanently deletes your account, CGM connection, readings, rewards and share link.</p></div></div>
      <div class="card-foot" style="border-top:0;background:none;justify-content:flex-start;padding-top:12px"><button class="danger" id="ac-delete">${icon('trash-2')} Delete account</button></div></div>`;
  drawPortrait($('#ac-portrait'), me.avatar, me.game.equipped);
  $('#ac-form').addEventListener('submit', async (e) => {
    e.preventDefault(); $('#ac-err').textContent = '';
    try { setMe(await api('PUT', '/api/me', { displayName: $('#ac-name').value })); toast('Profile saved'); }
    catch (ex) { $('#ac-err').textContent = ex.message; }
  });
  $('#ac-reveal').addEventListener('click', (e) => {
    const k = $('#ac-key'), show = k.type === 'password';
    k.type = show ? 'text' : 'password'; e.currentTarget.innerHTML = icon(show ? 'eye-off' : 'eye');
  });
  $('#ac-copy').addEventListener('click', () => copy(apiKey, 'Sign-in key copied'));
  $('#ac-signout').addEventListener('click', signOut);
  $('#ac-delete').addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Delete your account?', body: 'This permanently deletes everything, including your rewards. Your share link stops working. This can’t be undone.', confirm: 'Delete account', danger: true }))) return;
    await api('DELETE', '/api/me');
    await chrome.storage.local.remove('apiKey');
    me = null; location.hash = ''; refreshBadge(); start();
  });
}

// ---------- boot ----------
async function start() {
  const { apiKey } = await session();
  if (!apiKey) { me = null; return onboarding(0); }
  try {
    me = await api('GET', '/api/me');
  } catch (e) {
    if (e.offline) { root.innerHTML = `<div style="display:grid;place-items:center;min-height:100vh"><div class="card card-pad" style="max-width:420px"><h2>Can’t reach Sugar Peek</h2><p class="muted" style="margin-top:6px">${esc(e.message)}</p></div></div>`; return; }
    return onboarding(0);
  }
  if (me.tz !== browserTz) me = await api('PUT', '/api/me', { tz: browserTz });
  shell();
  route();
}
window.addEventListener('hashchange', () => { if (me && $('#app')) route(); });
start();
