// Game catalog shared by the server (rewards) and the clients (rendering). No DOM access.

export const RARITY = {
  common: { label: 'Common', color: '#94a3b8', price: 60 },
  rare: { label: 'Rare', color: '#3b82f6', price: 150 },
  epic: { label: 'Epic', color: '#a855f7', price: 350 },
  legendary: { label: 'Legendary', color: '#f59e0b', price: 900 },
};

export const SLOTS = [
  { id: 'hat', label: 'Hats' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'pet', label: 'Pets' },
  { id: 'trail', label: 'Trails' },
  { id: 'title', label: 'Titles' },
];

// hat/glasses `part` = LPC part id in the sprite catalog; `color` = cloth palette variant.
export const GAME_ITEMS = [
  { id: 'hat_bandana_red', slot: 'hat', part: 'bandana', color: 'red', name: 'Red Bandana', rarity: 'common' },
  { id: 'hat_bandana_blue', slot: 'hat', part: 'bandana', color: 'blue', name: 'Blue Bandana', rarity: 'common' },
  { id: 'hat_headband', slot: 'hat', part: 'headband', color: 'green', name: 'Sweatband', rarity: 'common' },
  { id: 'hat_bowler', slot: 'hat', part: 'bowler', name: 'Bowler Hat', rarity: 'common' },
  { id: 'hat_elf', slot: 'hat', part: 'elf', name: 'Elf Hat', rarity: 'rare' },
  { id: 'hat_tophat', slot: 'hat', part: 'tophat', name: 'Top Hat', rarity: 'rare' },
  { id: 'hat_santa', slot: 'hat', part: 'santa', name: 'Santa Hat', rarity: 'epic' },
  { id: 'hat_wizard', slot: 'hat', part: 'wizard', name: 'Wizard Hat', rarity: 'epic' },
  { id: 'hat_tiara', slot: 'hat', part: 'tiara', name: 'Tiara', rarity: 'epic' },
  { id: 'hat_crown', slot: 'hat', part: 'crown', name: 'Crown', rarity: 'legendary' },
  { id: 'glasses_round', slot: 'glasses', part: 'round', name: 'Round Glasses', rarity: 'common' },
  { id: 'glasses_nerd', slot: 'glasses', part: 'nerd', name: 'Thick Frames', rarity: 'common' },
  { id: 'glasses_sun', slot: 'glasses', part: 'sunglasses', name: 'Sunglasses', rarity: 'rare' },
  { id: 'pet_chick', slot: 'pet', name: 'Chick', rarity: 'common' },
  { id: 'pet_cat', slot: 'pet', name: 'Cat', rarity: 'rare' },
  { id: 'pet_dog', slot: 'pet', name: 'Pup', rarity: 'rare' },
  { id: 'pet_slime', slot: 'pet', name: 'Slime', rarity: 'epic' },
  { id: 'pet_drone', slot: 'pet', name: 'Drone', rarity: 'epic' },
  { id: 'pet_dragon', slot: 'pet', name: 'Baby Dragon', rarity: 'legendary' },
  { id: 'trail_sparkles', slot: 'trail', name: 'Sparkles', rarity: 'common' },
  { id: 'trail_leaves', slot: 'trail', name: 'Leaves', rarity: 'common' },
  { id: 'trail_bubbles', slot: 'trail', name: 'Bubbles', rarity: 'rare' },
  { id: 'trail_hearts', slot: 'trail', name: 'Hearts', rarity: 'rare' },
  { id: 'trail_rainbow', slot: 'trail', name: 'Rainbow', rarity: 'legendary' },
  { id: 'title_steady', slot: 'title', name: 'Steady Eddie', rarity: 'common' },
  { id: 'title_carbs', slot: 'title', name: 'Carb Counter', rarity: 'common' },
  { id: 'title_rover', slot: 'title', name: 'Range Rover', rarity: 'rare' },
  { id: 'title_bolus', slot: 'title', name: 'Bolus Boss', rarity: 'rare' },
  { id: 'title_guru', slot: 'title', name: 'Glucose Guru', rarity: 'epic' },
  { id: 'title_pro', slot: 'title', name: 'Pancreas Pro', rarity: 'legendary' },
];
export const ITEM_BY_ID = Object.fromEntries(GAME_ITEMS.map((i) => [i.id, i]));

// Consecutive good days. After 30, every further 30 days repeats the legendary reward.
export const STREAK_MILESTONES = [
  { days: 7, rarity: 'rare', coins: 100, freezes: 1 },
  { days: 14, rarity: 'epic', coins: 200, freezes: 1, prefer: 'pet' },
  { days: 30, rarity: 'legendary', coins: 500, freezes: 1 },
];
export function milestoneFor(streak) {
  const exact = STREAK_MILESTONES.find((m) => m.days === streak);
  if (exact) return exact;
  if (streak > 30 && streak % 30 === 0) return { ...STREAK_MILESTONES[2], days: streak };
  return null;
}
export function nextMilestone(streak) {
  const m = STREAK_MILESTONES.find((x) => x.days > streak);
  return m || { ...STREAK_MILESTONES[2], days: (Math.floor(streak / 30) + 1) * 30 };
}

// Total good days ever (they never reset).
export const LIFETIME_MILESTONES = [
  { days: 7, coins: 50 }, { days: 14, coins: 100 }, { days: 30, coins: 200 }, { days: 60, coins: 300 }, { days: 100, coins: 500 },
];

export const ACHIEVEMENTS = [
  { id: 'first_day', icon: '🌱', name: 'First good day', desc: 'Hit your time-in-range target for a day.' },
  { id: 'streak_7', icon: '🔥', name: 'Week warrior', desc: 'Reach a 7-day streak.' },
  { id: 'streak_14', icon: '⚡', name: 'Fortnight force', desc: 'Reach a 14-day streak.' },
  { id: 'streak_30', icon: '👑', name: 'Monthly monarch', desc: 'Reach a 30-day streak.' },
  { id: 'total_7', icon: '🥉', name: '7 good days', desc: '7 good days in total.' },
  { id: 'total_14', icon: '🥈', name: '14 good days', desc: '14 good days in total.' },
  { id: 'total_30', icon: '🥇', name: '30 good days', desc: '30 good days in total.' },
  { id: 'total_60', icon: '🏅', name: '60 good days', desc: '60 good days in total.' },
  { id: 'total_100', icon: '💯', name: '100 good days', desc: '100 good days in total.' },
  { id: 'perfect', icon: '🎯', name: 'Bullseye', desc: 'A full day at 95% or more in range.' },
  { id: 'comeback', icon: '🌅', name: 'Comeback', desc: 'A good day right after a missed one.' },
  { id: 'quests_10', icon: '📜', name: 'Quest hunter', desc: 'Complete 10 daily quests.' },
  { id: 'cheers_25', icon: '💖', name: 'Fan club', desc: 'Receive 25 cheers from friends.' },
  { id: 'level_5', icon: '⭐', name: 'Level 5', desc: 'Reach level 5.' },
  { id: 'level_10', icon: '🌟', name: 'Level 10', desc: 'Reach level 10.' },
];
export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// Daily quests: "target" is always offered; two more rotate by date.
export const QUESTS = {
  target: { title: 'Hit your time-in-range target', coins: 25, xp: 30 },
  run3h: { title: 'Stay in range 3 hours straight', coins: 20, xp: 20 },
  morning: { title: 'Steady morning: 80% in range, 6 am–noon', coins: 20, xp: 20 },
  overnight: { title: 'Steady night: 80% in range, midnight–6 am', coins: 20, xp: 20 },
  no_urgent_low: { title: 'No urgent lows today', coins: 20, xp: 20 },
  cheers3: { title: 'Get 3 cheers from friends', coins: 15, xp: 15 },
  checkin: { title: 'Check in on your Sugar Peek', coins: 10, xp: 10 },
};
export const ROTATING_QUESTS = ['run3h', 'morning', 'overnight', 'no_urgent_low', 'cheers3', 'checkin'];

export const CHEERS = { heart: '❤️', party: '🎉', muscle: '💪', star: '⭐' };

export const DEFAULT_TIR_TARGET = 70;

/** level = 1 + floor(sqrt(xp / 50)): 50 XP for level 2, 200 for 3, 450 for 4… */
export function levelFor(xp) {
  const level = 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 50));
  const floor = 50 * (level - 1) ** 2, next = 50 * level ** 2;
  return { level, into: xp - floor, need: next - floor };
}
