import { api, session, refreshBadge } from './lib/api.js';
import { icon } from './lib/icons.js';
import { loadAssets } from './shared/avatar.js';
import { mountScene } from './shared/scene.js';
import { stateOf, formatBg, formatAgo, captionFor, TREND_ARROWS, STATE_LABEL } from './shared/glucose.js';
import { sparklineSvg } from './shared/sparkline.js';
import { bigNews } from './lib/rewards.js';

const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const openApp = (route = '') => { window.open(chrome.runtime.getURL(`app.html${route}`), '_blank'); window.close(); };

function empty(title, body, cta) {
  app.innerHTML = `<div class="pp-empty"><span class="brand-mark" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff">${icon('droplet', 20)}</span>
    <h2>${title}</h2><p class="muted">${body}</p><button id="go">${cta} ${icon('arrow-right')}</button></div>`;
  document.getElementById('go').onclick = () => openApp();
}

function render(me) {
  const t = me.thresholds, g = me.game, state = stateOf(me.latest, Date.now(), t);
  const bg = me.latest ? formatBg(me.latest.mgdl, me.unit).split(' ') : ['--', ''];
  const conn = me.connection;
  app.innerHTML = `
    <div class="pp-head"><span class="brand-mark">${icon('droplet', 14)}</span><b class="grow">Sugar Peek</b>
      <button class="ghost icon-btn sm" id="pp-settings" aria-label="Open Sugar Peek">${icon('settings')}</button></div>
    <div class="pp-scene"><canvas id="pp-canvas"></canvas>
      <div class="pp-reading"><div class="row" style="align-items:baseline;gap:5px"><span class="bg-value s-${state}">${bg[0]}</span><span class="bg-value s-${state}" style="font-size:20px">${state === 'stale' || !me.latest ? '' : TREND_ARROWS[me.latest.trend] || ''}</span><span class="unit">${bg[1]}</span></div>
        <div class="row" style="gap:8px;margin-top:4px"><span class="state s-${state}"><span class="dot"></span>${STATE_LABEL[state]}</span><span class="muted small">${me.latest ? formatAgo(me.latest.ts) : ''}</span></div></div>
      <div class="pp-activity"><span class="badge" id="pp-activity"></span></div>
    </div>
    ${!conn || conn.status !== 'ok' ? `<div class="pp-alert">${icon('circle-alert')}<span class="grow">${conn ? esc(conn.lastError) : 'No CGM connected yet.'}</span><a href="#" id="pp-fix">Fix</a></div>` : ''}
    <div class="pp-stats">
      <a href="#" class="card pp-stat" data-route="#/rewards"><div class="k">${icon('target', 13)} Today</div><div class="v">${g.today.tir}%<span class="muted small" style="font-weight:500"> / ${g.target}%</span></div></a>
      <a href="#" class="card pp-stat" data-route="#/rewards"><div class="k">${icon('flame', 13)} Streak</div><div class="v">${g.streak}d</div></a>
      <a href="#" class="card pp-stat" data-route="#/rewards"><div class="k">${icon('trophy', 13)} Level ${bigNews(g).length ? '<span class="pp-new">New</span>' : ''}</div><div class="v">${g.level}</div></a>
    </div>
    <p class="pp-caption">${esc(captionFor({ name: me.displayName, latest: me.latest, unit: me.unit, thresholds: t }))}</p>
    <div class="card pp-spark">${sparklineSvg(me.sparkline, { thresholds: t, height: 56 })}</div>
    <div class="pp-link"><input readonly value="${esc(me.share.url)}" aria-label="Share link"><button class="outline sm" id="pp-copy">${icon('copy', 14)} Copy</button></div>`;
  document.getElementById('pp-settings').onclick = () => openApp('#/overview');
  document.getElementById('pp-fix')?.addEventListener('click', (e) => { e.preventDefault(); openApp('#/cgm'); });
  document.querySelectorAll('[data-route]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); openApp(a.dataset.route); }));
  document.getElementById('pp-copy').onclick = async (e) => { await navigator.clipboard.writeText(me.share.url); e.currentTarget.innerHTML = `${icon('check', 14)} Copied`; };
  loadAssets(chrome.runtime.getURL('sprites')).then((assets) => {
    mountScene(document.getElementById('pp-canvas'), assets, { avatar: me.avatar, theme: me.scene, state, gear: g.equipped }, {
      scale: 2, focusY: 0.6, onActivity: (l) => { const el = document.getElementById('pp-activity'); if (el) el.textContent = l ? `Now: ${l}` : ''; },
    });
  });
}

const { apiKey } = await session();
if (!apiKey) empty('Welcome to Sugar Peek', 'Connect your CGM and build your character in a couple of minutes.', 'Get started');
else {
  try {
    render(await api('GET', '/api/me'));
    refreshBadge();
  } catch (e) {
    if (e.offline) app.innerHTML = `<div class="pp-empty"><h2>Can’t reach Sugar Peek</h2><p class="muted">${esc(e.message)}</p></div>`;
    else empty('Signed out', 'Open Sugar Peek to sign back in.', 'Open Sugar Peek');
  }
}
