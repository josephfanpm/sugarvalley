// Sugar Valley state on the server: what the owner has earned, spent and restored, and what
// visitors left. Sunlight is always computed here from stored readings, never trusted from a client.
import { q } from './db.js';
import { buildDays, sunlightFrom, stateOf, isUrgent, dayStart } from '../src/data/cgm.js';
import * as B from '../src/data/balance.js';
import { doChore, cook as cookRule, freshDay, ripeness, restoreRule, RuleError } from '../src/data/valley-rules.js';
import { questView, journalView, tagDay, claimQuest, comebacksFrom, steadyMinutes, recapFor } from '../src/data/insights.js';

const DAY = 86_400_000;
const GRAPH_MS = { owner: 24 * 3_600_000, viewer: 12 * 3_600_000 };

export class ValleyError extends Error {}

const thresholdsOf = (user) => (user.thresholds_json ? JSON.parse(user.thresholds_json) : B.DEFAULT_THRESHOLDS);

function fresh(user) {
  return {
    sun: B.WELCOME_SUN,
    collectedThrough: dayStart(Date.now(), user.tz), // today's readings count from the start
    restored: {},
    wateredDay: 0,
    gifts: [], // uncollected: [{ kind, ts }]
    giftDay: 0, giftsToday: 0,
    inventory: {}, chores: {}, cookbook: {}, day: 0, dishesToday: 0,
  };
}

export function loadValley(user) {
  const v = user.valley_json ? JSON.parse(user.valley_json) : null;
  return v ? { ...fresh(user), ...v } : fresh(user);
}
const saveValley = (user, v) => q.saveValley.run(JSON.stringify(v), user.id);

function inRangeToday(user, history, todayStart) {
  const t = thresholdsOf(user);
  return history.filter((r) => r.ts >= todayStart && r.mgdl >= t.low && r.mgdl <= t.high).length;
}

function pendingSun(user, v, now = Date.now()) {
  const rs = q.since.all(user.id, v.collectedThrough + 1);
  return sunlightFrom(rs.filter((r) => r.ts <= now), thresholdsOf(user), user.tz);
}

/** Everything the game needs. role: 'owner' | 'viewer'. */
export function valleyView(user, role, { shareUrl } = {}) {
  const now = Date.now(), t = thresholdsOf(user), v = loadValley(user);
  const latest = q.latest.get(user.id) || null;
  const state = stateOf(latest, now, t);
  const showNumbers = role === 'owner' || !!user.show_graph;
  const history = q.since.all(user.id, now - 30 * DAY);
  const { days, todayStart, todayProgress } = buildDays(history, { t, goal: user.tir_target ?? B.DEFAULT_TIR_GOAL, tz: user.tz, now });
  const graph = showNumbers ? history.filter((r) => r.ts >= now - GRAPH_MS[role]).map((r) => [r.ts, Math.round(r.mgdl)]) : null;
  const base = {
    role,
    name: user.display_name,
    unit: user.unit,
    thresholds: t,
    tz: user.tz,
    showNumbers,
    latest: showNumbers ? latest : null,
    state,
    graph,
    // Without numbers, visitors get only what the plant needs, rounded.
    days: days.map((d) => (showNumbers ? d : {
      start: d.start, enough: d.enough, good: d.good, hidden: true,
      tir: d.tir == null ? null : Math.round(d.tir / 10) * 10, mean: bucket(d.mean), cv: 0.25,
      curve: coarse(d.curve),
    })),
    latestTs: latest?.ts ?? null,
    todayStart,
    todayProgress,
    valley: { sun: v.sun, restored: v.restored, wateredToday: v.wateredDay === todayStart, gifts: v.gifts.length, ribbons: v.ribbons || 0 },
  };
  freshDay(v, todayStart);
  const inRange = inRangeToday(user, history, todayStart);
  base.farm = {
    inventory: v.inventory, chores: v.chores, cookbook: v.cookbook, dishesToday: v.dishesToday,
    ripeness: ripeness(inRange),
  };
  if (showNumbers) {
    base.comebacks = comebacksFrom(history.filter((r) => r.ts >= todayStart - 2 * 3_600_000), t, { from: todayStart });
    base.steady = steadyMinutes(history, t, now);
  }
  if (role === 'owner') base.recap = recapFor(days[days.length - 1], history, t, user.tz);
  if (role === 'owner') {
    const before = JSON.stringify(v);
    base.quest = questView(v, history, { t, tz: user.tz, now });
    base.journal = journalView(v, days, todayStart);
    if (JSON.stringify(v) !== before) saveValley(user, v); // a new week's quest was picked
  }
  if (role === 'owner') {
    base.valley.pending = pendingSun(user, v, now);
    base.valley.giftKinds = v.gifts.map((g) => g.kind);
    base.share = shareUrl;
    const conn = q.connection.get(user.id);
    base.connection = conn ? { type: conn.type, status: conn.status } : null;
  } else {
    // Safety: only during urgent states, and only if the owner added a number.
    base.contactPhone = isUrgent(state) ? user.contact_phone : null;
  }
  return base;
}

// 4 points, direction only: enough for the stem to sway, not enough to rebuild a graph.
const coarse = (curve) => (curve ? [0, 1, 2, 3].map((i) => Math.sign(Math.round(curve[Math.floor((i * curve.length) / 4)] * 2))) : undefined);
// Viewers who can't see numbers still get a plant color, from a coarse bucket.
const bucket = (mean) => (mean == null ? null : Math.round(mean / 20) * 20);

export function collect(user) {
  const v = loadValley(user), now = Date.now();
  const fromReadings = pendingSun(user, v, now);
  const fromGifts = v.gifts.reduce((a, g) => a + (g.sun || 0), 0);
  v.sun += fromReadings + fromGifts;
  // High-water mark of readings counted (not the clock), so delayed uploads still count later.
  const last = q.latest.get(user.id);
  v.collectedThrough = Math.max(v.collectedThrough, Math.min(now, last?.ts ?? v.collectedThrough));
  const gifts = v.gifts.length;
  v.gifts = [];
  saveValley(user, v);
  return { collected: fromReadings + fromGifts, fromReadings, fromGifts, gifts };
}

export function restore(user, id) {
  const v = loadValley(user);
  try { restoreRule(v, id); } catch (e) { if (e instanceof RuleError) throw new ValleyError(e.message); throw e; }
  saveValley(user, v);
}

export function water(user) {
  const v = loadValley(user);
  v.wateredDay = dayStart(Date.now(), user.tz);
  saveValley(user, v);
}

/** A visitor leaves a gift at the Sun Well. Never during urgent states (safety.md #2). */
export function gift(user, kind) {
  if (!B.GIFT_KINDS.includes(kind)) throw new ValleyError('Unknown gift.');
  const latest = q.latest.get(user.id);
  if (isUrgent(stateOf(latest, Date.now(), thresholdsOf(user)))) throw new ValleyError('Not right now.');
  const v = loadValley(user), today = dayStart(Date.now(), user.tz);
  if (v.giftDay !== today) { v.giftDay = today; v.giftsToday = 0; }
  v.giftsToday++;
  const sun = v.giftsToday <= B.GIFT_SUN_DAILY_CAP ? B.SUN_PER_GIFT : 0;
  v.gifts.push({ kind, ts: Date.now(), sun });
  if (v.gifts.length > 50) v.gifts.shift();
  saveValley(user, v);
  return { sun };
}

function todayCtx(user) {
  const now = Date.now(), todayStart = dayStart(now, user.tz);
  return { today: todayStart, inRangeToday: inRangeToday(user, q.since.all(user.id, todayStart), todayStart) };
}

/** Daily chores: eggs, milk, harvest, apples. */
export function chore(user, id) {
  const v = loadValley(user);
  try { const gives = doChore(v, id, todayCtx(user)); saveValley(user, v); return { gives }; } catch (e) {
    if (e instanceof RuleError) throw new ValleyError(e.message); throw e;
  }
}

export function cook(user, recipe) {
  const v = loadValley(user);
  try { const r = cookRule(v, recipe, todayCtx(user)); saveValley(user, v); return { dish: r.recipe.id, sun: r.sun, first: r.first }; } catch (e) {
    if (e instanceof RuleError) throw new ValleyError(e.message); throw e;
  }
}

export function journal(user, day, tags) {
  const v = loadValley(user);
  try { const r = tagDay(v, day, tags, user.tz); saveValley(user, v); return r; } catch (e) { throw new ValleyError(e.message); }
}

export function claim(user) {
  const v = loadValley(user), now = Date.now();
  const history = q.since.all(user.id, now - 30 * DAY);
  try { const r = claimQuest(v, history, { t: thresholdsOf(user), tz: user.tz, now }); saveValley(user, v); return r; } catch (e) { throw new ValleyError(e.message); }
}
