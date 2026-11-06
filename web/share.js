import { loadAssets, creditsFor } from '/shared/avatar.js';
import { mountScene } from '/shared/scene.js';
import { stateOf, captionFor, formatBg, formatAgo, isUrgent, TREND_ARROWS, STATE_LABEL } from '/shared/glucose.js';
import { mountChart } from '/shared/chart.js';

const token = location.pathname.split('/').pop();
const $ = (id) => document.getElementById(id);
let data = null, scene = null, chart = null, lastCheers = null;
const CHEER_EMOJI = { heart: '❤️', party: '🎉', muscle: '💪', star: '⭐' };

function toast(text, ms = 5000) {
  $('toast').textContent = text; $('toast').hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { $('toast').hidden = true; }, ms);
}

function floatEmoji(emoji, from) {
  const r = from.getBoundingClientRect(), el = document.createElement('span');
  el.className = 'float-emoji'; el.textContent = emoji;
  el.style.left = `${r.left + r.width / 2}px`; el.style.top = `${r.top}px`;
  document.body.append(el); setTimeout(() => el.remove(), 1600);
}

document.querySelectorAll('[data-cheer]').forEach((b) => b.addEventListener('click', async () => {
  const kind = b.dataset.cheer;
  floatEmoji(CHEER_EMOJI[kind], b);
  scene?.react(kind);
  document.querySelectorAll('[data-cheer]').forEach((x) => { x.disabled = true; });
  const r = await fetch(`/api/share/${token}/cheer`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind }) });
  const body = await r.json().catch(() => ({}));
  $('cheers-label').textContent = r.ok ? 'Sent! Thanks for the support' : (body.error || 'Couldn’t send');
  if (r.ok) lastCheers = body.cheersToday;
  setTimeout(() => {
    document.querySelectorAll('[data-cheer]').forEach((x) => { x.disabled = false; });
    $('cheers-label').textContent = `Cheer ${data?.name || 'them'} on`;
  }, 15000);
}));
let graphOpen = innerWidth >= 700;
try { const saved = localStorage.getItem('sp-graph'); if (saved) graphOpen = saved === '1'; } catch {}

function setGraphOpen(open) {
  graphOpen = open;
  try { localStorage.setItem('sp-graph', open ? '1' : '0'); } catch {}
  render();
}
$('graph-toggle').addEventListener('click', () => setGraphOpen(!graphOpen));

function render() {
  if (!data) return;
  const now = Date.now();
  const { latest, unit, thresholds } = data;
  const state = stateOf(latest, now, thresholds);

  $('who').textContent = data.name;
  if (latest) {
    const [num, label] = formatBg(latest.mgdl, unit).split(' ');
    $('bg').textContent = num;
    $('unit').textContent = label;
    $('trend').textContent = state === 'stale' ? '' : TREND_ARROWS[latest.trend] || '';
    $('ago').textContent = formatAgo(latest.ts, now);
  }
  $('bg').className = `bg-value num s-${state}`;
  $('trend').className = `trend s-${state}`;
  $('state').className = `state s-${state}`;
  $('state-label').textContent = STATE_LABEL[state];
  $('caption').textContent = captionFor({ name: data.name, latest, unit, now, thresholds });

  const urgent = isUrgent(state);
  // game: level / streak / title; cheering is hidden during urgent states so the focus is on reaching out
  const game = data.game || {};
  $('game-row').innerHTML = [
    `<span class="chip">Lv ${game.level ?? 1}</span>`,
    game.streak ? `<span class="chip">🔥 ${game.streak}-day streak</span>` : '',
    game.title ? `<span class="chip title">${game.title.replace(/[<>&]/g, '')}</span>` : '',
    data.cheersToday ? `<span class="chip">💖 ${data.cheersToday}</span>` : '',
  ].join('');
  $('cheers').hidden = urgent || state === 'stale' || state === 'no_data';
  $('dialog').classList.toggle('urgent', urgent);
  const phone = urgent && data.contactPhone;
  $('contact').hidden = !phone;
  if (phone) {
    const digits = phone.replace(/[^\d+]/g, '');
    $('text-btn').href = `sms:${digits}`;
    $('text-btn').textContent = `Text ${data.name}`;
    $('call-btn').href = `tel:${digits}`;
  }

  // The owner can turn the graph off entirely; viewers can collapse it.
  $('graph-toggle').hidden = !data.sparkline;
  $('graph-toggle').setAttribute('aria-expanded', String(graphOpen));
  $('graph-toggle').textContent = graphOpen ? 'Hide graph' : 'Show graph';
  $('graph').hidden = !data.sparkline || !graphOpen;
  if (data.sparkline && graphOpen) {
    chart ??= mountChart($('graph'));
    chart.render({ points: data.sparkline, thresholds, unit, now });
  }

  document.title = latest && state !== 'stale' ? `${formatBg(latest.mgdl, unit)} · ${data.name}` : data.name;
  scene?.update({ avatar: data.avatar, theme: data.scene, state, gear: data.game?.equipped });
}

async function load() {
  const r = await fetch(`/api/share/${token}`);
  if (r.status === 404) {
    document.body.innerHTML = '<div class="gone"><h2>This link was turned off</h2><p>Ask for a new one.</p></div>';
    return false;
  }
  if (!r.ok) return true;
  data = await r.json();
  if (!scene) {
    const assets = await loadAssets('/sprites');
    scene = mountScene($('scene'), assets, { avatar: data.avatar, theme: data.scene, state: stateOf(data.latest, Date.now(), data.thresholds), gear: data.game?.equipped }, { focusY: 0.58, onActivity: (label) => { $('activity').textContent = label ? `Now: ${label}` : ''; } });
    $('credits').innerHTML = creditsFor(assets, data.avatar)
      .map((c) => `<p>${c.authors.join(', ')} — ${c.licenses.join(' / ')}</p>`).join('') +
      '<p>Liberated Pixel Cup character art via the Universal LPC Spritesheet Generator. Scenes and T1D accessories by Sugar Peek (CC-BY-SA 3.0).</p>';
  }
  render();
  $('cheers-label').textContent = `Cheer ${data.name} on`;
  const celebrate = data.game?.celebrate;
  let seen = null;
  try { seen = sessionStorage.getItem('sp-celebrated'); } catch {}
  if (celebrate && seen !== celebrate && !isUrgent(stateOf(data.latest, Date.now(), data.thresholds))) {
    try { sessionStorage.setItem('sp-celebrated', celebrate); } catch {}
    scene?.celebrate();
    toast(`🎉 ${data.name}: ${celebrate}`, 7000);
  }
  if (lastCheers !== null && data.cheersToday > lastCheers) scene?.react('heart'); // someone else cheered
  lastCheers = data.cheersToday;
  return true;
}

if (await load()) {
  setInterval(load, 60_000); // readings arrive every 5 min; 60s keeps it fresh
  setInterval(render, 15_000); // re-evaluate staleness even if the network drops
}
