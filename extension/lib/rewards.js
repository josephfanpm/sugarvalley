// Rewards page (streaks, quests, calendar, collection, achievements) on the design system.
import { api, refreshBadge } from './api.js';
import { icon } from './icons.js';
import { characterSheet, FRAME, DEFAULT_AVATAR } from '../shared/avatar.js';
import { GAME_ITEMS, ITEM_BY_ID, RARITY, SLOTS, ACHIEVEMENTS, STREAK_MILESTONES, CHEERS } from '../shared/game-data.js';
import { drawPetIcon, drawTrailIcon } from '../shared/fx.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function ring(pct, target, size = 132) {
  const r = 46, c = 2 * Math.PI * r, val = Math.min(100, pct) / 100, t = target / 100;
  const tx = 60 + r * Math.sin(2 * Math.PI * t), ty = 60 - r * Math.cos(2 * Math.PI * t);
  return `<svg viewBox="0 0 120 120" class="ring" style="width:${size}px;height:${size}px" role="img" aria-label="${pct}% in range today, goal ${target}%">
    <circle cx="60" cy="60" r="${r}" class="ring-bg"/>
    <circle cx="60" cy="60" r="${r}" class="ring-fg ${pct >= target ? 'hit' : ''}" stroke-dasharray="${c * val} ${c}" transform="rotate(-90 60 60)"/>
    <circle cx="${tx}" cy="${ty}" r="4" class="ring-target"/>
    <text x="60" y="62" text-anchor="middle" class="ring-num">${pct}%</text>
    <text x="60" y="80" text-anchor="middle" class="ring-sub">goal ${target}%</text></svg>`;
}

function track(streak) {
  const max = Math.max(30, Math.ceil((streak + 1) / 30) * 30);
  const marks = [...STREAK_MILESTONES.map((m) => m.days), ...(max > 30 ? [max] : [])];
  return `<div class="track"><div class="track-fill" style="width:${Math.min(100, (streak / max) * 100)}%"></div>
    ${marks.map((d) => `<span class="track-mark ${streak >= d ? 'got' : ''}" style="left:${(d / max) * 100}%">${streak >= d ? icon('check', 12) : ''}<b>${d}</b></span>`).join('')}</div>`;
}

function calendar(days) {
  const label = { good: 'Good day', frozen: 'Saved by a streak freeze', miss: 'Below goal', incomplete: 'Not enough CGM data', today: 'Today so far', none: 'No data' };
  return `<div class="cal">${days.map((d) => `<div class="cal-day ${d.result}" title="${d.day}: ${label[d.result]}${d.tir != null && d.result !== 'none' ? ` · ${d.tir}%` : ''}">${Number(d.day.slice(8))}</div>`).join('')}</div>
    <div class="cal-legend"><span><i style="background:var(--c-ok)"></i>Good day</span><span><i style="background:#60a5fa"></i>Freeze used</span><span><i style="background:var(--surface-3)"></i>Below goal</span><span><i style="background:repeating-linear-gradient(45deg,var(--surface-2) 0 3px,var(--border) 3px 6px)"></i>Not enough data</span></div>`;
}

export function renderRewards(el, ctx) {
  let { game } = ctx;
  let slot = 'hat';
  const render = () => {
    const g = game, nm = g.nextMilestone;
    el.innerHTML = `
      <div class="grid-3">
        <div class="card stat-card"><div class="k">${icon('star')} Level</div><div class="row" style="margin-top:8px;gap:12px"><span class="level-badge">${g.level}</span><div class="grow"><div class="sub">${g.levelInto} / ${g.levelNeed} XP</div><div class="progress"><div style="width:${(g.levelInto / g.levelNeed) * 100}%"></div></div></div></div></div>
        <div class="card stat-card"><div class="k">${icon('flame')} Current streak</div><div class="v">${g.streak} ${g.streak === 1 ? 'day' : 'days'}</div><div class="sub">Best ${g.best} · ${g.freezes} streak ${g.freezes === 1 ? 'freeze' : 'freezes'}</div></div>
        <div class="card stat-card"><div class="k">${icon('coins')} Coins</div><div class="v">${g.coins.toLocaleString()}</div><div class="sub">${g.goodDays} good days all time</div></div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-head"><div><h3>Today</h3><p>Scored at midnight in your time zone</p></div></div>
          <div class="card-body row" style="gap:20px">
            ${ring(g.today.tir, g.target)}
            <div class="grow"><b style="font-size:15px">${g.today.hoursInRange} h in range so far</b>
              <p class="hint">Days with less than half the usual CGM readings don’t count and never break your streak.</p>
              <a href="#/ranges" class="small">Change daily goal</a></div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div><h3>Next streak reward</h3><p>${nm.left} more good ${nm.left === 1 ? 'day' : 'days'} to ${nm.days} days</p></div><span class="rarity-chip" style="--rarity:${RARITY[nm.rarity].color}">${RARITY[nm.rarity].label}</span></div>
          <div class="card-body">${track(g.streak)}<p class="hint">Good day: coins, XP and an item. 7 days: rare item + streak freeze. 14: epic, usually a pet. 30: legendary.</p></div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card"><div class="card-head"><div><h3>Daily quests</h3><p>New quests every day</p></div></div>
          <div class="card-body"><ul class="quests">${g.quests.map((q) => `<li class="quest ${q.status}"><span class="q-icon">${q.status === 'done' ? icon('check', 12) : ''}</span>
            <span class="grow"><b>${esc(q.title)}</b>${q.progress ? `<br><span class="muted small">${esc(q.progress)}</span>` : ''}</span>
            <span class="q-reward">${icon('coins', 14)} ${q.coins}</span></li>`).join('')}</ul></div></div>
        <div class="card"><div class="card-head"><div><h3>Last 30 days</h3><p>${g.calendar.filter((d) => d.result === 'good').length} good days</p></div></div>
          <div class="card-body">${calendar(g.calendar)}</div></div>
      </div>

      <div class="card">
        <div class="card-head"><div><h3>Collection</h3><p>${g.inventory.length} of ${GAME_ITEMS.length} unlocked · earn more with good days or spend coins</p></div></div>
        <div class="card-body">
          <div class="tabs" role="tablist">${SLOTS.map((s) => `<button type="button" role="tab" data-slot="${s.id}" aria-selected="${s.id === slot}">${s.label}</button>`).join('')}</div>
          <div class="items">${GAME_ITEMS.filter((i) => i.slot === slot).map((item) => {
            const owned = g.inventory.includes(item.id), worn = g.equipped[item.slot] === item.id, price = RARITY[item.rarity].price;
            const action = worn ? `<button class="secondary" data-unequip="${item.slot}">Remove</button>`
              : owned ? `<button class="outline" data-equip="${item.id}">${item.slot === 'title' ? 'Show on link' : 'Equip'}</button>`
              : `<button data-buy="${item.id}" ${g.coins < price ? 'disabled' : ''}>${icon('coins', 14)} ${price}</button>`;
            return `<div class="item ${owned ? 'owned' : 'locked'} ${worn ? 'worn' : ''}" style="--rarity:${RARITY[item.rarity].color}">
              <div class="item-art">${item.slot === 'title' ? `<span class="title-chip">${esc(item.name)}</span>` : `<canvas width="72" height="72" data-art="${item.id}"></canvas>`}</div>
              <div class="item-name">${esc(item.name)} ${owned ? '' : icon('lock', 13, 'muted')}</div>
              <div class="item-rarity">${RARITY[item.rarity].label}</div>${action}</div>`;
          }).join('')}</div>
          <p class="error" id="shop-err" style="margin-top:10px"></p>
        </div>
      </div>

      <div class="grid-2">
        <div class="card"><div class="card-head"><div><h3>Achievements</h3><p>${g.achievements.length} of ${ACHIEVEMENTS.length}</p></div></div>
          <div class="card-body"><div class="badges">${ACHIEVEMENTS.map((a) => `<div class="ach ${g.achievements.includes(a.id) ? '' : 'locked'}" title="${esc(a.desc)}"><span class="ach-icon">${a.icon}</span><div><b>${esc(a.name)}</b><span>${esc(a.desc)}</span></div></div>`).join('')}</div></div></div>
        <div class="card"><div class="card-head"><div><h3>Cheers</h3><p>${g.cheersToday} today · ${g.cheersTotal} all time</p></div></div>
          <div class="card-body"><p style="font-size:22px">${g.recentCheers.map((c) => CHEERS[c.kind]).join(' ') || '<span class="muted" style="font-size:14px">When friends cheer on your link, it shows up here.</span>'}</p></div></div>
      </div>`;

    el.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => { slot = b.dataset.slot; render(); }));
    el.querySelectorAll('[data-equip]').forEach((b) => b.addEventListener('click', () => act('/api/game/equip', { slot: ITEM_BY_ID[b.dataset.equip].slot, itemId: b.dataset.equip }, `${ITEM_BY_ID[b.dataset.equip].name} equipped`)));
    el.querySelectorAll('[data-unequip]').forEach((b) => b.addEventListener('click', () => act('/api/game/equip', { slot: b.dataset.unequip, itemId: null }, 'Removed')));
    el.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => act('/api/game/buy', { itemId: b.dataset.buy }, `Unlocked ${ITEM_BY_ID[b.dataset.buy].name}`)));
    el.querySelectorAll('[data-art]').forEach(async (cv) => {
      const item = ITEM_BY_ID[cv.dataset.art];
      if (item.slot === 'pet') return drawPetIcon(cv, item.id);
      if (item.slot === 'trail') return drawTrailIcon(cv, item.id);
      const sheet = await characterSheet(ctx.assets, { ...DEFAULT_AVATAR, ...ctx.me.avatar }, 'idle', 'happy', { [item.slot]: { part: item.part, color: item.color } });
      const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
      c.clearRect(0, 0, cv.width, cv.height); c.drawImage(sheet, 14, 2 * FRAME, 36, 36, 0, 0, 72, 72);
    });
  };
  async function act(path, body, msg) {
    try { game = await api('POST', path, body); ctx.onChange?.(game); ctx.toast?.(msg); render(); refreshBadge(); }
    catch (e) { el.querySelector('#shop-err').textContent = e.message; }
  }
  render();
}

/** "New rewards" dialog for anything unlocked since the user last looked. */
/** Unseen rewards worth a celebration (items, milestones, achievements, levels, or several good days). */
export function bigNews(game) {
  const big = game.unseen.filter((e) => ['unlock', 'milestone', 'achievement', 'level'].includes(e.type));
  return big.length ? game.unseen : [];
}

export function showUnseen(game, onSeen) {
  const list = bigNews(game);
  if (!list.length) {
    // small stuff (a finished quest, a scored day) shows in the activity feed; just mark it seen
    if (game.unseen.length) api('POST', '/api/game/seen').then((g) => onSeen?.(g));
    return;
  }
  const rank = (e) => e.type === 'milestone' ? 0 : e.type === 'unlock' ? 1 + ['legendary', 'epic', 'rare', 'common'].indexOf(ITEM_BY_ID[e.item]?.rarity) : e.type === 'achievement' ? 5 : e.type === 'level' ? 6 : 7;
  const items = list.filter((e) => e.type !== 'day').sort((a, b) => rank(a) - rank(b));
  const goodDays = list.filter((e) => e.type === 'day' && /good day/.test(e.title)).length;
  const dlg = document.createElement('dialog');
  dlg.className = 'modal';
  const iconFor = (e) => e.type === 'milestone' ? icon('flame') : e.type === 'unlock' ? icon('gift') : e.type === 'level' ? icon('star') : e.type === 'quest' ? icon('target') : icon('trophy');
  dlg.innerHTML = `<canvas id="confetti" aria-hidden="true"></canvas>
    <div class="modal-body"><h2>New rewards</h2><p class="muted">Here’s what you earned since your last visit.</p>
      <ul class="reward-list">
        ${goodDays > 1 ? `<li class="sum">${icon('calendar-days')}<div><b>${goodDays} good days scored</b><span>Nice consistency.</span></div></li>` : ''}
        ${items.slice(0, 12).map((e) => `<li>${iconFor(e)}<div><b>${esc(e.title)}</b><span>${esc(e.detail || '')}</span></div></li>`).join('')}
        ${items.length > 12 ? `<li><div><span>And ${items.length - 12} more in your activity feed</span></div></li>` : ''}
      </ul></div>
    <div class="modal-foot"><button class="lg" style="width:100%">Continue</button></div>`;
  document.body.append(dlg);
  dlg.showModal();
  confetti(dlg.querySelector('#confetti'));
  dlg.querySelector('.modal-foot button').onclick = async () => { dlg.close(); dlg.remove(); onSeen?.(await api('POST', '/api/game/seen')); };
}

function confetti(cv) {
  const c = cv.getContext('2d'); cv.width = cv.clientWidth; cv.height = cv.clientHeight;
  const colors = ['#6366f1', '#a855f7', '#ec4899', '#f97316', '#facc15', '#22c55e'];
  const bits = Array.from({ length: 80 }, (_, i) => ({ x: Math.random() * cv.width, y: -Math.random() * cv.height, vy: 70 + Math.random() * 90, vx: (Math.random() - 0.5) * 40, c: colors[i % colors.length], w: 4 + Math.random() * 4, r: Math.random() * 6 }));
  let last = performance.now(), elapsed = 0;
  (function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; elapsed += dt;
    c.clearRect(0, 0, cv.width, cv.height);
    for (const b of bits) { b.y += b.vy * dt; b.x += b.vx * dt; c.save(); c.translate(b.x, b.y); c.rotate(b.r + elapsed * 4); c.fillStyle = b.c; c.fillRect(-b.w / 2, -2, b.w, 4); c.restore(); }
    if (elapsed < 3.5) requestAnimationFrame(tick); else c.clearRect(0, 0, cv.width, cv.height);
  })(last);
}
