// Loads, advances and saves a user's game state.
import { q } from './db.js';
import { advance, defaultGame, summary, publicGame } from './game.js';
import { DEFAULT_THRESHOLDS } from '../extension/shared/glucose.js';

const DAY = 86_400_000;
const thresholdsOf = (user) => (user.thresholds_json ? JSON.parse(user.thresholds_json) : DEFAULT_THRESHOLDS);

export function loadGame(user) {
  const g = defaultGame();
  return user.game_json ? Object.assign(g, JSON.parse(user.game_json)) : g;
}

export function saveGame(user, g) {
  user.game_json = JSON.stringify(g);
  q.saveGame.run(user.game_json, user.id);
}

/** Brings the game up to date and returns { g, todayStats }. Optionally applies an action first. */
export function runGame(user, { now = Date.now(), action } = {}) {
  const g = loadGame(user);
  action?.(g);
  // Readings from the day after the last closed day (with slack for any time zone).
  const since = g.lastDay ? Date.parse(`${g.lastDay}T00:00:00Z`) + DAY - 15 * 3_600_000 : now - 31 * DAY;
  const todayStats = advance(g, {
    readings: q.since.all(user.id, since), now, tz: user.tz || 'UTC',
    target: user.tir_target ?? 70, thresholds: thresholdsOf(user), seed: user.id,
  });
  saveGame(user, g);
  return { g, todayStats };
}

export function gameSummary(user, opts) {
  const { g, todayStats } = runGame(user, opts);
  return summary(g, { todayStats, target: user.tir_target ?? 70, tz: user.tz || 'UTC', now: opts?.now });
}

export function publicGameView(user, now = Date.now()) {
  return publicGame(loadGame(user), now);
}
