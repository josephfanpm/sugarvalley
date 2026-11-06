// Tuning knobs. See design/gdd/sunlight.md and design/gdd/safety.md.
export const SUN_PER_READING = 1;
export const RECOVERY_BONUS = 6;
export const RECOVERY_WINDOW_MIN = 60;
export const RECOVERY_DAILY_CAP = 4;
export const GOOD_DAY_BONUS = 40;
export const DEFAULT_TIR_GOAL = 70; // percent
export const MAX_TBR = 4; // percent below range allowed on a good day
export const MIN_DAY_COVERAGE = 0.5; // share of 288 readings needed to score a day
export const STALE_AFTER_MIN = 15;

export const DEFAULT_THRESHOLDS = { urgentLow: 55, low: 70, high: 180, urgentHigh: 250 };

// Restorable things in the Forest hamlet.
export const RESTORE_COST = { bridge: 150, coop: 200, patch: 200, kitchen: 300, lanterns: 250, pasture: 250, orchard: 350, dock: 300 };

// Farm (design/gdd/farm.md)
export const HARVEST_IN_RANGE_READINGS = 72; // 6 hours in range today ripens crops
export const SUN_PER_DISH = 5;
export const DISHES_WITH_SUN_PER_DAY = 3;
export const NEW_RECIPE_SUN = 20;

// Weekly pattern quest and Garden Journal (design/gdd/quests-journal.md)
export const QUEST_SUN = 75;
export const JOURNAL_SUN = 10;
export const WELCOME_SUN = 100;

// Visitor gifts (design/gdd/visitors.md)
export const GIFT_KINDS = ['flower', 'heart', 'star', 'sun'];
export const SUN_PER_GIFT = 3;
export const GIFT_SUN_DAILY_CAP = 5; // gifts per day that add sunlight
