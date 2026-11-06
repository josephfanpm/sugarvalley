import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, defaultGame, summary, buy, equip, cheer } from './game.js';
import { ITEM_BY_ID } from '../extension/shared/game-data.js';

const DAY = 86_400_000, STEP = 300_000;
const NOW = Date.UTC(2026, 10, 20, 15, 0); // Nov 20, 15:00 UTC

/** Builds full days of readings ending yesterday. kinds[0] is the oldest day. */
function days(kinds) {
  const out = [], today = Math.floor(NOW / DAY) * DAY;
  kinds.forEach((kind, idx) => {
    const start = today - (kinds.length - idx) * DAY;
    const count = kind === 'gap' ? 60 : 288;
    for (let i = 0; i < count; i++) {
      // good: 100% in range; miss: 50% in range; low: in range except one urgent low
      const mgdl = kind === 'miss' ? (i % 2 ? 120 : 220) : kind === 'low' && i === 10 ? 45 : 120;
      out.push({ ts: start + i * STEP, mgdl });
    }
  });
  return out;
}

const run = (g, readings, extra = {}) => advance(g, { readings, now: NOW, tz: 'UTC', target: 70, seed: 'u1', ...extra });

test('a good day pays coins, XP and a daily unlock', () => {
  const g = defaultGame();
  run(g, days(['good']));
  assert.equal(g.streak, 1);
  assert.equal(g.goodDays, 1);
  assert.ok(g.coins >= 20);
  assert.equal(g.inventory.length, 1);
  assert.ok(g.achievements.includes('first_day'));
});

test('7-day streak gives a milestone reward and a streak freeze', () => {
  const g = defaultGame();
  run(g, days(Array(7).fill('good')));
  assert.equal(g.streak, 7);
  assert.equal(g.freezes, 1);
  assert.ok(g.achievements.includes('streak_7'));
  assert.ok(g.achievements.includes('total_7'));
  assert.ok(g.inventory.some((id) => ['rare', 'epic'].includes(ITEM_BY_ID[id].rarity)), 'got a rare-or-better item');
});

test('a missed day uses a freeze instead of breaking the streak', () => {
  const g = defaultGame();
  run(g, days([...Array(7).fill('good'), 'miss', 'good']));
  assert.equal(g.freezes, 0);
  assert.equal(g.streak, 8);
});

test('without a freeze, a miss resets the streak but keeps the best', () => {
  const g = defaultGame();
  run(g, days(['good', 'good', 'miss', 'good']));
  assert.equal(g.streak, 1);
  assert.equal(g.best, 2);
  assert.ok(g.achievements.includes('comeback'));
});

test('days without enough CGM data never count or break a streak', () => {
  const g = defaultGame();
  run(g, days(['good', 'gap', 'good']));
  assert.equal(g.streak, 2);
  assert.equal(Object.values(g.days).filter((d) => d.result === 'incomplete').length, 1);
});

test('days are only scored once', () => {
  const g = defaultGame(), r = days(['good', 'good']);
  run(g, r);
  const coins = g.coins;
  run(g, r);
  assert.equal(g.coins, coins);
});

test('the target is user-defined', () => {
  const g = defaultGame();
  run(g, days(['miss']), { target: 50 }); // 50% in range meets a 50% target
  assert.equal(g.streak, 1);
});

test('quests settle at day close, shop and equip work, cheers pay a little', () => {
  const g = defaultGame();
  run(g, days(['good']));
  assert.equal(g.quests.list.length, 3);
  g.coins = 1000;
  buy(g, 'pet_dragon', NOW);
  equip(g, 'pet', 'pet_dragon');
  assert.equal(g.equipped.pet, 'pet_dragon');
  assert.throws(() => equip(g, 'hat', 'hat_crown'), /don’t own/);
  const before = g.coins;
  cheer(g, 'heart', NOW, 'UTC');
  assert.equal(g.coins, before + 2);
  const s = summary(g, { todayStats: { tir: 80, coverage: 0.5, inRange: 100 }, target: 70, tz: 'UTC', now: NOW });
  assert.equal(s.calendar.length, 30);
  assert.equal(s.cheersToday, 1);
});

test('history that arrives after the first run still gets scored', () => {
  const g = defaultGame();
  run(g, []); // account created before any CGM data
  run(g, days(['good', 'good', 'good']));
  assert.equal(g.streak, 3);
});
