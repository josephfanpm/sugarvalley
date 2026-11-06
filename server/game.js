// Game engine: turns CGM readings into rewards. Pure functions over a JSON game state,
// so it is easy to test. Design rules:
//   - rewards only, no penalties; a missed day just ends the streak (or uses a freeze)
//   - days without enough CGM data ("incomplete") never count and never break a streak
//   - urgent alerts always win on the share page; the game never hides them
import { rangeOf, DEFAULT_THRESHOLDS } from '../extension/shared/glucose.js';
import {
  GAME_ITEMS, ITEM_BY_ID, RARITY, ACHIEVEMENT_BY_ID, QUESTS, ROTATING_QUESTS, LIFETIME_MILESTONES,
  milestoneFor, nextMilestone, levelFor, CHEERS, DEFAULT_TIR_TARGET,
} from '../extension/shared/game-data.js';

const READINGS_PER_DAY = 288; // one every 5 minutes
const MIN_COVERAGE = 0.5;     // a day needs half its readings to count
const DAY_MS = 86_400_000;

export function defaultGame() {
  return {
    v: 1, lastDay: null, streak: 0, best: 0, freezes: 0, goodDays: 0, coins: 0, xp: 0,
    inventory: [], equipped: { hat: null, glasses: null, pet: null, trail: null, title: null },
    achievements: [], days: {}, quests: { day: null, list: [] }, questsDone: 0,
    cheers: { day: null, count: 0, total: 0, recent: [] }, checkins: {}, log: [], logSeq: 0, seenSeq: 0,
  };
}

// ---------- time zones ----------
const fmts = new Map();
function fmt(tz) {
  if (!fmts.has(tz)) {
    let f;
    try { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }); }
    catch { f = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }); }
    fmts.set(tz, f);
  }
  return fmts.get(tz);
}
export function localParts(ts, tz) {
  const p = Object.fromEntries(fmt(tz).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 };
}

// ---------- day statistics ----------
export function dayStats(readings, thresholds = DEFAULT_THRESHOLDS) {
  const s = { n: 0, inRange: 0, urgentLow: 0, longestRun: 0, morning: { n: 0, in: 0 }, overnight: { n: 0, in: 0 } };
  let run = 0, prevTs = null;
  for (const r of readings) {
    const range = rangeOf(r.mgdl, thresholds), ok = range === 'in_range';
    s.n++;
    if (ok) s.inRange++;
    if (range === 'urgent_low') s.urgentLow++;
    run = ok ? (prevTs !== null && r.ts - prevTs <= 11 * 60_000 ? run + 1 : 1) : 0;
    s.longestRun = Math.max(s.longestRun, run);
    prevTs = r.ts;
    if (r.hour >= 6 && r.hour < 12) { s.morning.n++; if (ok) s.morning.in++; }
    if (r.hour < 6) { s.overnight.n++; if (ok) s.overnight.in++; }
  }
  s.tir = s.n ? Math.round((s.inRange / s.n) * 100) : 0;
  s.coverage = s.n / READINGS_PER_DAY;
  return s;
}

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function seeded(seed) {
  let s = seed || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// ---------- rewards ----------
function log(g, now, entry) {
  g.logSeq += 1;
  g.log.unshift({ id: g.logSeq, ts: now, coins: 0, xp: 0, ...entry });
  g.log = g.log.slice(0, 80);
}

function addXp(g, xp, now) {
  const before = levelFor(g.xp).level;
  g.xp += xp;
  const after = levelFor(g.xp).level;
  for (let L = before + 1; L <= after; L++) {
    const bonus = 20 * L;
    g.coins += bonus;
    log(g, now, { type: 'level', title: `Level ${L}!`, detail: `+${bonus} coins`, coins: bonus });
    if (L === 5) achieve(g, 'level_5', now);
    if (L === 10) achieve(g, 'level_10', now);
  }
}

function achieve(g, id, now) {
  if (g.achievements.includes(id)) return;
  g.achievements.push(id);
  const a = ACHIEVEMENT_BY_ID[id];
  log(g, now, { type: 'achievement', title: `${a.icon} ${a.name}`, detail: a.desc, achievement: id });
}

/** Picks an item the user doesn't own: the wanted rarity first, then nearby rarities. */
function pickItem(g, rarity, rnd, prefer) {
  const order = { common: ['common', 'rare'], rare: ['rare', 'epic', 'common'], epic: ['epic', 'legendary', 'rare'], legendary: ['legendary', 'epic', 'rare'] }[rarity];
  for (const r of order) {
    let pool = GAME_ITEMS.filter((i) => i.rarity === r && !g.inventory.includes(i.id));
    if (prefer && pool.some((i) => i.slot === prefer)) pool = pool.filter((i) => i.slot === prefer);
    if (pool.length) return pool[Math.floor(rnd() * pool.length)];
  }
  return null;
}

function giveItem(g, item, now, reason, quiet = false) {
  if (!item) return null;
  g.inventory.push(item.id);
  for (const slot of ['hat', 'glasses', 'pet', 'trail', 'title']) if (item.slot === slot && !g.equipped[slot]) g.equipped[slot] = item.id; // auto-wear first of a kind
  log(g, now, { type: 'unlock', title: `Unlocked ${item.name}`, detail: `${RARITY[item.rarity].label} ${item.slot} · ${reason}`, item: item.id, quiet });
  return item;
}

function closeDay(g, day, stats, target, now, seed) {
  const rnd = seeded(hashStr(seed + day));
  if (stats.coverage < MIN_COVERAGE) {
    g.days[day] = { tir: stats.tir, cov: +stats.coverage.toFixed(2), result: 'incomplete' };
    log(g, now, { type: 'day', title: `${day}: not enough CGM data`, detail: 'Doesn’t count, and your streak is safe.' });
    return;
  }
  const good = stats.tir >= target;
  const prev = Object.keys(g.days).filter((d) => d < day && g.days[d].result !== 'incomplete').sort().pop();
  g.days[day] = { tir: stats.tir, cov: +stats.coverage.toFixed(2), result: good ? 'good' : 'miss' };

  if (!good) {
    addXp(g, 10, now);
    if (g.streak > 0 && g.freezes > 0) {
      g.freezes -= 1;
      g.days[day].result = 'frozen';
      log(g, now, { type: 'day', title: `${day}: ${stats.tir}% in range`, detail: `A streak freeze kept your ${g.streak}-day streak going. +10 XP for showing up.`, xp: 10 });
    } else {
      const had = g.streak;
      g.streak = 0;
      log(g, now, { type: 'day', title: `${day}: ${stats.tir}% in range`, detail: had ? `Your ${had}-day streak ended. Tomorrow starts a new one. +10 XP` : 'Tomorrow is a new day. +10 XP', xp: 10 });
    }
    return;
  }

  g.streak += 1; g.goodDays += 1; g.best = Math.max(g.best, g.streak);
  const coins = 20 + Math.max(0, Math.min(10, stats.tir - target)), xp = 50 + Math.max(0, stats.tir - target);
  g.coins += coins;
  log(g, now, { type: 'day', title: `${day}: good day! ${stats.tir}% in range`, detail: `Streak ${g.streak} · +${coins} coins · +${xp} XP`, coins, xp });
  addXp(g, xp, now);
  const daily = pickItem(g, rnd() < 0.15 ? 'rare' : 'common', rnd);
  if (daily) giveItem(g, daily, now, 'daily reward');
  else { g.coins += 15; log(g, now, { type: 'day', title: 'Collection bonus', detail: 'You own every common item: +15 coins', coins: 15 }); }

  achieve(g, 'first_day', now);
  if (stats.tir >= 95) achieve(g, 'perfect', now);
  if (prev && g.days[prev].result === 'miss') achieve(g, 'comeback', now);

  const m = milestoneFor(g.streak);
  if (m) {
    g.coins += m.coins; g.freezes = Math.min(3, g.freezes + m.freezes);
    log(g, now, { type: 'milestone', title: `🔥 ${g.streak}-day streak!`, detail: `+${m.coins} coins · +${m.freezes} streak freeze · ${RARITY[m.rarity].label} reward`, coins: m.coins });
    giveItem(g, pickItem(g, m.rarity, rnd, m.prefer), now, `${g.streak}-day streak`);
    if (g.streak === 7) achieve(g, 'streak_7', now);
    if (g.streak === 14) achieve(g, 'streak_14', now);
    if (g.streak >= 30) achieve(g, 'streak_30', now);
  }
  const life = LIFETIME_MILESTONES.find((x) => x.days === g.goodDays);
  if (life) {
    g.coins += life.coins;
    log(g, now, { type: 'milestone', title: `${life.days} good days in total`, detail: `+${life.coins} coins`, coins: life.coins });
    achieve(g, `total_${life.days}`, now);
  }
}

// ---------- quests ----------
function questsFor(seed, day) {
  const rnd = seeded(hashStr(`${seed}:q:${day}`));
  const pool = [...ROTATING_QUESTS], picks = [];
  while (picks.length < 2) picks.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return ['target', ...picks].map((id) => ({ id, status: 'open', progress: '' }));
}

function evalQuest(q, ctx) {
  const { stats: s, target, hour, closed, cheers, checkedIn } = ctx;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  switch (q.id) {
    case 'target':
      if (closed) return s.coverage >= MIN_COVERAGE && s.tir >= target ? 'done' : 'missed';
      q.progress = `${s.tir}% so far · goal ${target}%`; return 'open';
    case 'run3h':
      q.progress = `Best run ${(s.longestRun * 5 / 60).toFixed(1)} h of 3 h`;
      return s.longestRun >= 36 ? 'done' : closed ? 'missed' : 'open';
    case 'morning':
      q.progress = `${pct(s.morning.in, s.morning.n)}% in range this morning`;
      if (closed || hour >= 12) return s.morning.n >= 36 && s.morning.in / s.morning.n >= 0.8 ? 'done' : 'missed';
      return 'open';
    case 'overnight':
      q.progress = `${pct(s.overnight.in, s.overnight.n)}% in range overnight`;
      if (closed || hour >= 6) return s.overnight.n >= 36 && s.overnight.in / s.overnight.n >= 0.8 ? 'done' : 'missed';
      return 'open';
    case 'no_urgent_low':
      q.progress = s.urgentLow ? 'Not today. Treating lows always comes first.' : 'So far, so good';
      if (s.urgentLow) return 'missed';
      return closed ? (s.coverage >= MIN_COVERAGE ? 'done' : 'missed') : 'open';
    case 'cheers3':
      q.progress = `${Math.min(3, cheers)} of 3 cheers`;
      return cheers >= 3 ? 'done' : closed ? 'missed' : 'open';
    case 'checkin':
      return checkedIn ? 'done' : closed ? 'missed' : 'open';
    default: return 'open';
  }
}

function settleQuests(g, ctx, now) {
  for (const q of g.quests.list) {
    if (q.status !== 'open') continue;
    q.status = evalQuest(q, ctx);
    if (q.status === 'done') {
      const def = QUESTS[q.id];
      g.coins += def.coins; g.questsDone += 1;
      log(g, now, { type: 'quest', title: `Quest done: ${def.title}`, detail: `+${def.coins} coins · +${def.xp} XP`, coins: def.coins, xp: def.xp });
      addXp(g, def.xp, now);
      if (g.questsDone >= 10) achieve(g, 'quests_10', now);
    }
  }
}

/**
 * Advances the game to `now`: closes finished days (in the user's time zone) and
 * settles today's quests. `readings` must cover every day after g.lastDay.
 */
export function advance(g, { readings, now = Date.now(), tz = 'UTC', target = DEFAULT_TIR_TARGET, thresholds = DEFAULT_THRESHOLDS, seed = 'user' }) {
  const today = localParts(now, tz).day;
  const byDay = new Map();
  for (const r of readings) {
    const p = localParts(r.ts, tz);
    if (!byDay.has(p.day)) byDay.set(p.day, []);
    byDay.get(p.day).push({ ...r, hour: p.hour });
  }
  const oldest = localParts(now - 30 * DAY_MS, tz).day;
  const closable = [...byDay.keys()].filter((d) => d < today && d >= oldest && (!g.lastDay || d > g.lastDay)).sort();
  for (const day of closable) {
    const stats = dayStats(byDay.get(day).sort((a, b) => a.ts - b.ts), thresholds);
    if (g.quests.day === day) settleQuests(g, { stats, target, hour: 24, closed: true, cheers: g.cheers.day === day ? g.cheers.count : 0, checkedIn: !!g.checkins[day] }, now);
    closeDay(g, day, stats, target, now, seed);
    g.lastDay = day;
  }

  const todayStats = dayStats((byDay.get(today) || []).sort((a, b) => a.ts - b.ts), thresholds);
  if (g.quests.day !== today) g.quests = { day: today, list: questsFor(seed, today) };
  settleQuests(g, { stats: todayStats, target, hour: localParts(now, tz).hour, closed: false, cheers: g.cheers.day === today ? g.cheers.count : 0, checkedIn: !!g.checkins[today] }, now);

  const keep = Object.keys(g.days).sort().slice(-60);
  g.days = Object.fromEntries(keep.map((d) => [d, g.days[d]]));
  return todayStats;
}

// ---------- player actions ----------
export function checkIn(g, now, tz) {
  const day = localParts(now, tz).day;
  g.checkins = { [day]: true };
}

export function cheer(g, kind, now, tz) {
  if (!CHEERS[kind]) throw new Error('Unknown cheer.');
  const day = localParts(now, tz).day;
  if (g.cheers.day !== day) Object.assign(g.cheers, { day, count: 0 });
  g.cheers.count += 1; g.cheers.total += 1;
  g.cheers.recent = [{ kind, ts: now }, ...g.cheers.recent].slice(0, 20);
  if (g.cheers.count <= 10) g.coins += 2;
  if (g.cheers.total >= 25) achieve(g, 'cheers_25', now);
}

export function buy(g, itemId, now) {
  const item = ITEM_BY_ID[itemId];
  if (!item) throw new Error('No such item.');
  if (g.inventory.includes(itemId)) throw new Error('You already own that.');
  const price = RARITY[item.rarity].price;
  if (g.coins < price) throw new Error(`You need ${price - g.coins} more coins.`);
  g.coins -= price;
  giveItem(g, item, now, `bought for ${price} coins`, true); // quiet: no celebration for your own purchase
}

export function equip(g, slot, itemId) {
  if (!(slot in g.equipped)) throw new Error('Unknown slot.');
  if (itemId === null) { g.equipped[slot] = null; return; }
  const item = ITEM_BY_ID[itemId];
  if (!item || item.slot !== slot || !g.inventory.includes(itemId)) throw new Error('You don’t own that item yet.');
  g.equipped[slot] = itemId;
}

// ---------- views ----------
export function summary(g, { todayStats, target, tz, now = Date.now() }) {
  const lvl = levelFor(g.xp), next = nextMilestone(g.streak);
  const calendar = [];
  for (let i = 29; i >= 0; i--) {
    const day = localParts(now - i * DAY_MS, tz).day;
    if (calendar.some((c) => c.day === day)) continue;
    calendar.push(i === 0 ? { day, tir: todayStats.tir, result: 'today' } : { day, ...(g.days[day] || { result: 'none' }) });
  }
  return {
    target, coins: g.coins, xp: g.xp, level: lvl.level, levelInto: lvl.into, levelNeed: lvl.need,
    streak: g.streak, best: g.best, freezes: g.freezes, goodDays: g.goodDays,
    today: { tir: todayStats.tir, coverage: +todayStats.coverage.toFixed(2), hoursInRange: +(todayStats.inRange * 5 / 60).toFixed(1) },
    nextMilestone: { days: next.days, left: next.days - g.streak, rarity: next.rarity },
    quests: g.quests.list.map((q) => ({ ...q, ...QUESTS[q.id] })),
    calendar, inventory: g.inventory, equipped: g.equipped, achievements: g.achievements,
    cheersToday: g.cheers.day === localParts(now, tz).day ? g.cheers.count : 0, cheersTotal: g.cheers.total, recentCheers: g.cheers.recent.slice(0, 8),
    log: g.log.slice(0, 30), unseen: g.log.filter((e) => e.id > g.seenSeq && !e.quiet).reverse(),
  };
}

/** What viewers of the share link see. */
export function publicGame(g, now) {
  const title = g.equipped.title ? ITEM_BY_ID[g.equipped.title]?.name : null;
  const recent = g.log.find((e) => (e.type === 'milestone' || e.type === 'level') && now - e.ts < DAY_MS);
  return { level: levelFor(g.xp).level, streak: g.streak, title, equipped: g.equipped, celebrate: recent ? recent.title : null };
}
