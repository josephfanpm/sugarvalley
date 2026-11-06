// Valley rules shared by the server (authoritative) and the offline demo.
// Daily chores and cooking add small, capped rewards; sunlight still comes almost entirely from
// in-range readings (design/gdd/game-concept.md pillar 2, design/gdd/farm.md).
import * as B from './balance.js';

export class RuleError extends Error {}

// Restore order is also the order the goal arrow suggests them.
export const RESTORABLES = [
  { id: 'bridge', name: 'footbridge', unlocks: 'East meadow and the cow' },
  { id: 'coop', name: 'chicken coop', unlocks: 'Eggs every day' },
  { id: 'patch', name: 'veggie patch', unlocks: 'Crops that grow while you stay in range' },
  { id: 'kitchen', name: 'campfire kitchen', unlocks: 'Cooking' },
  { id: 'lanterns', name: 'lantern path', unlocks: 'Light at night' },
  { id: 'pasture', name: 'cow pasture', unlocks: 'Twice the milk', requires: 'bridge' },
  { id: 'orchard', name: 'apple orchard', unlocks: 'Apples every day', requires: 'bridge' },
  { id: 'dock', name: 'pond dock', unlocks: 'A quiet spot by the water' },
];
for (const r of RESTORABLES) r.cost = B.RESTORE_COST[r.id];
export const RESTORE_BY_ID = Object.fromEntries(RESTORABLES.map((r) => [r.id, r]));

export const ITEMS = {
  egg: { name: 'Egg', plural: 'eggs' },
  milk: { name: 'Milk', plural: 'milk' },
  wheat: { name: 'Wheat', plural: 'wheat' },
  eggplant: { name: 'Eggplant', plural: 'eggplants' },
  apple: { name: 'Apple', plural: 'apples' },
};

export const CHORES = {
  eggs: { needs: 'coop', label: 'Collect eggs', gives: () => ({ egg: 3 }) },
  milk: { needs: 'bridge', label: 'Milk the cow', gives: (r) => ({ milk: r.pasture ? 2 : 1 }) },
  harvest: { needs: 'patch', label: 'Harvest the veggie patch', gives: () => ({ wheat: 2, eggplant: 1 }), ripe: true },
  apples: { needs: 'orchard', label: 'Pick apples', gives: () => ({ apple: 2 }), ripe: true },
};

export const RECIPES = [
  { id: 'pancakes', name: 'Pancakes', needs: { egg: 1, milk: 1, wheat: 1 } },
  { id: 'applepie', name: 'Apple pie', needs: { apple: 2, wheat: 1, egg: 1 } },
  { id: 'omelette', name: 'Omelette', needs: { egg: 2 } },
  { id: 'roast', name: 'Roasted eggplant', needs: { eggplant: 1 } },
  { id: 'bread', name: 'Bread', needs: { wheat: 2 } },
  { id: 'cider', name: 'Warm apple cider', needs: { apple: 1 } },
  { id: 'cocoa', name: 'Warm milk', needs: { milk: 1 } },
];
export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export function restoreRule(state, id) {
  const r = RESTORE_BY_ID[id];
  if (!r) throw new RuleError('Nothing to restore there.');
  state.restored ||= {};
  if (state.restored[id]) throw new RuleError('Already restored.');
  if (r.requires && !state.restored[r.requires]) throw new RuleError(`Restore the ${RESTORE_BY_ID[r.requires].name} first.`);
  if (state.sun < r.cost) throw new RuleError(`${r.cost - state.sun} more sunlight needed.`);
  state.sun -= r.cost;
  state.restored[id] = Date.now();
  return r;
}

/** The next thing to restore: first in order whose requirement is met. */
export const nextRestorable = (restored = {}) => RESTORABLES.find((r) => !restored[r.id] && (!r.requires || restored[r.requires])) || null;

/** Crops ripen with in-range time today: 0..1 (safety: never with lows, which aren't in range). */
export const ripeness = (inRangeToday) => Math.min(1, inRangeToday / B.HARVEST_IN_RANGE_READINGS);

export function freshDay(state, today) {
  if (state.day !== today) { state.day = today; state.chores = {}; state.dishesToday = 0; }
  state.inventory ||= {};
  state.cookbook ||= {};
  state.chores ||= {};
}

export function doChore(state, id, { today, inRangeToday }) {
  const c = CHORES[id];
  if (!c) throw new RuleError('Nothing to do there.');
  freshDay(state, today);
  if (!state.restored?.[c.needs]) throw new RuleError(`Restore the ${RESTORE_BY_ID[c.needs].name} first.`);
  if (state.chores[id]) throw new RuleError('Already done today.');
  if (c.ripe && ripeness(inRangeToday) < 1) throw new RuleError('Not ripe yet. It grows while you stay in range.');
  const gives = c.gives(state.restored);
  for (const [k, n] of Object.entries(gives)) state.inventory[k] = (state.inventory[k] || 0) + n;
  state.chores[id] = Date.now();
  return gives;
}

export const canCook = (inv, r) => Object.entries(r.needs).every(([k, n]) => (inv[k] || 0) >= n);

/** The recipe the kitchen suggests: a new one if possible, else the first you can make. */
export function suggestRecipe(state) {
  const inv = state.inventory || {}, book = state.cookbook || {};
  return RECIPES.find((r) => canCook(inv, r) && !book[r.id]) || RECIPES.find((r) => canCook(inv, r)) || null;
}

export function cook(state, recipeId, { today }) {
  freshDay(state, today);
  if (!state.restored?.kitchen) throw new RuleError('Restore the campfire kitchen first.');
  const r = RECIPE_BY_ID[recipeId];
  if (!r) throw new RuleError('Unknown recipe.');
  if (!canCook(state.inventory, r)) throw new RuleError(`Not enough ingredients for ${r.name.toLowerCase()}.`);
  for (const [k, n] of Object.entries(r.needs)) state.inventory[k] -= n;
  state.dishesToday += 1;
  const first = !state.cookbook[r.id];
  state.cookbook[r.id] = (state.cookbook[r.id] || 0) + 1;
  const sun = (state.dishesToday <= B.DISHES_WITH_SUN_PER_DAY ? B.SUN_PER_DISH : 0) + (first ? B.NEW_RECIPE_SUN : 0);
  state.sun += sun;
  return { recipe: r, sun, first };
}
