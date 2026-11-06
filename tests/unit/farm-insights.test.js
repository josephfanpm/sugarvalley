// Farm rules (restore order, chores, cooking) and the pattern loops (weekly quest, journal).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreRule, doChore, cook, suggestRecipe, nextRestorable, ripeness, RuleError } from '../../src/data/valley-rules.js';
import { pickQuest, questView, tagDay, insightsFrom, weekStart } from '../../src/data/insights.js';
import * as B from '../../src/data/balance.js';

const T = B.DEFAULT_THRESHOLDS, DAY = 86_400_000, HOUR = 3_600_000;
const fresh = (over = {}) => ({ sun: 1000, restored: {}, inventory: {}, chores: {}, cookbook: {}, day: 0, dishesToday: 0, ...over });

test('restores need sunlight and their requirement', () => {
  const s = fresh({ sun: 100 });
  assert.throws(() => restoreRule(s, 'bridge'), /50 more sunlight/);
  s.sun = 1000;
  assert.throws(() => restoreRule(s, 'pasture'), /footbridge first/);
  restoreRule(s, 'bridge');
  restoreRule(s, 'pasture');
  assert.equal(s.sun, 1000 - B.RESTORE_COST.bridge - B.RESTORE_COST.pasture);
  assert.equal(nextRestorable(s.restored).id, 'coop');
});

test('chores are once a day and need their building', () => {
  const s = fresh();
  assert.throws(() => doChore(s, 'eggs', { today: 1, inRangeToday: 0 }), /chicken coop first/);
  s.restored.coop = 1;
  assert.deepEqual(doChore(s, 'eggs', { today: 1, inRangeToday: 0 }), { egg: 3 });
  assert.throws(() => doChore(s, 'eggs', { today: 1, inRangeToday: 0 }), /Already done/);
  assert.deepEqual(doChore(s, 'eggs', { today: 2, inRangeToday: 0 }), { egg: 3 }); // new day
});

test('crops ripen only with in-range time', () => {
  const s = fresh({ restored: { patch: 1 } });
  assert.equal(ripeness(36), 0.5);
  assert.throws(() => doChore(s, 'harvest', { today: 1, inRangeToday: 36 }), /Not ripe/);
  assert.deepEqual(doChore(s, 'harvest', { today: 1, inRangeToday: B.HARVEST_IN_RANGE_READINGS }), { wheat: 2, eggplant: 1 });
});

test('cooking uses ingredients; sunlight is small and capped', () => {
  const s = fresh({ sun: 0, restored: { kitchen: 1 }, inventory: { egg: 20, milk: 0, wheat: 0 } });
  assert.equal(suggestRecipe(s).id, 'omelette');
  const first = cook(s, 'omelette', { today: 1 });
  assert.equal(first.sun, B.SUN_PER_DISH + B.NEW_RECIPE_SUN);
  cook(s, 'omelette', { today: 1 }); cook(s, 'omelette', { today: 1 });
  assert.equal(cook(s, 'omelette', { today: 1 }).sun, 0); // 4th dish of the day
  assert.equal(s.inventory.egg, 12);
  assert.throws(() => cook(s, 'pancakes', { today: 1 }), RuleError);
});

// Readings: mornings run high, everything else in range.
function history(weekStartTs, days = 14) {
  const out = [];
  for (let d = days; d >= 1; d--) {
    const start = weekStartTs - d * DAY;
    for (let i = 0; i < 288; i++) {
      const h = (i * 5) / 60;
      out.push({ ts: start + i * 5 * 60_000, mgdl: h >= 6 && h < 12 ? 210 : 120 });
    }
  }
  return out;
}

test('weekly quest targets the weakest time of day with a reachable step', () => {
  const week = weekStart(new Date(2026, 10, 4, 12).getTime(), 'UTC');
  const q = pickQuest(history(week), { t: T, tz: 'UTC', week });
  assert.equal(q.window, 'morning');
  assert.equal(q.kind, 'steady');
  assert.equal(q.threshold, 60); // baseline 0% → floor of 60
});

test('a window with lows becomes a "without lows" goal', () => {
  const week = weekStart(new Date(2026, 10, 4, 12).getTime(), 'UTC');
  const rs = history(week).map((r) => { const h = ((r.ts % DAY) / HOUR); return { ...r, mgdl: h < 6 ? (h < 1 ? 60 : 110) : 120 }; });
  const q = pickQuest(rs, { t: T, tz: 'UTC', week });
  assert.equal(q.window, 'overnight');
  assert.equal(q.kind, 'nolows');
});

test('quest progress counts finished windows; sick days lower the bar', () => {
  const now = Date.UTC(2026, 10, 5, 20); // Thursday evening
  const week = weekStart(now, 'UTC');
  const rs = [...history(week)];
  for (let d = 0; d < 4; d++) for (let i = 0; i < 288; i++) rs.push({ ts: week + d * DAY + i * 300_000, mgdl: 120 });
  const state = { sun: 0, quests: {} };
  const v = questView(state, rs.filter((r) => r.ts <= now), { t: T, tz: 'UTC', now });
  assert.equal(v.window, 'morning');
  assert.equal(v.done, 4); // Mon–Thu mornings all in range
  assert.equal(v.claimable, true);
  state.journal = { [week]: ['sick'], [week + DAY]: ['sick'] };
  assert.equal(questView(state, rs, { t: T, tz: 'UTC', now }).need, 1);
});

test('journal: tags are validated, reflection reward is once per day', () => {
  const s = { sun: 0 };
  const day = new Date().setHours(0, 0, 0, 0) - DAY;
  assert.equal(tagDay(s, day, ['walk', 'bogus']).sun, B.JOURNAL_SUN);
  assert.deepEqual(s.journal[day], ['walk']);
  assert.equal(tagDay(s, day, ['walk', 'sleep']).sun, 0);
  assert.throws(() => tagDay(s, day - 30 * DAY, ['walk']), /last 7 days/);
  // Not a real day start: can't be used to farm the reflection reward.
  assert.throws(() => tagDay(s, day + 1000, ['walk']), /last 7 days/);
});

test('insights compare tagged days with other journaled days', () => {
  const days = [], journal = {};
  for (let i = 0; i < 8; i++) {
    const start = i * DAY;
    const walked = i % 2 === 0;
    days.push({ start, enough: true, tir: walked ? 80 : 60 });
    journal[start] = walked ? ['walk'] : ['stress'];
  }
  const ins = insightsFrom(journal, days);
  assert.equal(ins[0].tag, 'walk');
  assert.match(ins[0].text, /80% in range vs 60%/);
});
