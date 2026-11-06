// Building interiors: layout, staff and what happens inside. Scripts run for the owner's character
// (automatically or when the player asks), and for Sam when a visitor walks in on them.
// Paying is cosmetic: getting food for a low never costs anything in the game.
import { PAL } from '../data/palette.js';
import { RECIPES } from '../data/valley-rules.js';
import { sfx } from '../audio.js';

const T = 16;
const FURN = {
  bed: [1, 26, 14, 22], dresser: [49, 32, 14, 16], table: [49, 49, 14, 14], chairR: [67, 33, 10, 13], chairL: [83, 33, 10, 13],
  armchair: [99, 33, 10, 13], clock: [81, 48, 13, 15], lampG: [51, 16, 10, 11], lampB: [67, 16, 10, 11], lampP: [83, 16, 10, 11],
  plantBig: [51, 0, 11, 15], plantSmall: [84, 1, 7, 12], plantTiny: [68, 4, 8, 9],
  pic1: [1, 6, 15, 7], pic2: [19, 6, 11, 7], pic3: [35, 5, 12, 8], rugG: [52, 82, 24, 13], rugP: [84, 82, 24, 13], rugB: [116, 82, 24, 13],
};
export function registerFurniture(scene) {
  const fur = scene.textures.get('furniture');
  for (const [k, [x, y, w, h]] of Object.entries(FURN)) if (!fur.has(k)) fur.add(k, 0, x, y, w, h);
}

// ---------- shared script pieces ----------
const FOODS = {
  coffee: [['icon-coffee'], ['icon-croissant']],
  bakery: [['icon-croissant'], ['dish-bread'], ['dish-applepie']],
  restaurant: [['icon-meal'], ['icon-forkknife'], ['icon-plate']],
};

/** Sit at a table and eat until told to stop (back in range, or a short visit). */
async function sitAndEat(s, a, ctx, seat, foods, plateKey) {
  if (!seat.already) {
    // come around the side of the table, then take the seat behind it
    await s.go(a, seat.table.x - 18, seat.table.y + 2);
    await s.go(a, seat.table.x - 16, seat.y);
    s.sit(a, seat);
  }
  const plate = s.place(plateKey, seat.table.x, seat.table.y - 7, seat.table.depth + 1);
  let i = 0;
  s.bob(a, 0.96, 520);
  while (ctx.keepGoing()) {
    const [k, f] = foods[i++ % foods.length];
    s.bubble(a, k, f);
    await s.wait(4.5);
  }
  s.unbob(a);
  plate.destroy();
  s.stand(a);
}

async function orderAtCounter(s, a, staff, front, item, counterTop) {
  await s.go(a, front.x, front.y);
  s.face(a, 'up');
  s.bubble(a, 'icon-chat');
  s.faceStaff(staff, a);
  await s.wait(0.6);
  s.bubble(staff, item);
  sfx.open();
  await s.wait(1.6);
  s.bubble(a, 'icon-coin');
  sfx.confirm();
  await s.wait(1.2);
  s.clearBubble(staff);
  const cup = s.place(item, counterTop.x, counterTop.y, 50000);
  await s.wait(0.8);
  cup.destroy();
  s.bubble(a, item);
  sfx.pickup();
}

// ---------- buildings ----------
export const BUILDINGS = {
  cottage: {
    name: 'Your cottage', w: 12, h: 8, tint: 0xffffff,
    build(s) {
      s.add.image(6 * T, 5.2 * T, 'furniture', 'rugG').setScale(2, 2).setDepth(-6);
      s.piece('bed', 1.6, 3.4); s.piece('dresser', 3.2, 2.4); s.piece('lampG', 4.3, 2.3);
      s.piece('plantBig', 10.4, 2.4); s.piece('plantSmall', 1.2, 6.6); s.piece('armchair', 10.2, 6.4);
      s.piece('clock', 8.8, 1.45, { wall: true }); s.piece('pic1', 5.4, 1.2, { wall: true }); s.piece('pic3', 6.7, 1.25, { wall: true });
      const table = { x: 7.5 * T, y: 4.6 * T };
      s.piece('table', 7, 4.6); s.piece('table', 7.875, 4.6); s.piece('chairR', 5.9, 4.7); s.piece('chairL', 9, 4.7);
      const w = s.world, v = s.view;
      s.interactables.push({ x: 1.6 * T, y: 3.6 * T, r: 16, label: () => ({ text: w.owner ? 'Rest a moment' : `${v.name}'s bed` }), action: w.owner ? () => s.rest() : null });
      if (w.owner) s.interactables.push({ x: 3.2 * T, y: 2.7 * T, r: 14, label: () => ({ text: 'Open the Garden Journal' }), action: () => s.game.events.emit('open-journal') });
      // trophies: ribbons on the wall, a dish for every recipe cooked
      const ribbons = Math.min(10, v.valley.ribbons || 0);
      for (let i = 0; i < ribbons; i++) s.add.image((1.4 + i * 0.5) * T + (i > 4 ? 0.5 * T : 0), 0.95 * T + (i % 2) * 3, 'ribbon').setDepth(-4);
      const book = v.farm?.cookbook || {}, cooked = RECIPES.filter((r) => book[r.id]);
      cooked.forEach((r, i) => s.add.image(table.x - 9 + (i % 4) * 7, table.y - 8 - Math.floor(i / 4) * 5, `dish-${r.id}`).setOrigin(0.5, 1).setDepth(table.y + 1 + i));
      s.interactables.push({ x: table.x, y: table.y + 4, r: 18, label: () => ({ text: cooked.length ? `Cookbook · ${cooked.length} of ${RECIPES.length}: ${cooked.map((r) => r.name.toLowerCase()).join(', ')}` : 'Dishes you cook will show up here' }) });
    },
  },

  coffee: {
    name: 'The Sunny Cup', w: 12, h: 8, tint: 0xffe9d6, rug: 'rugP',
    build(s) {
      s.wallItem('menu-board', 8.6, 1.35);
      s.wallItem('pic2', 3, 1.1, true);
      s.counterBar('counter-64', 4.4, 3.5);
      s.add.image(2.6 * T, 2.45 * T, 'espresso').setOrigin(0.5, 1).setDepth(3.5 * T + 2);
      s.add.image(6.1 * T, 2.45 * T, 'register').setOrigin(0.5, 1).setDepth(3.5 * T + 2);
      s.add.image(4.4 * T, 2.5 * T, 'pastry-case').setOrigin(0.5, 1).setDepth(3.5 * T + 3);
      s.staffAt('barista', 4.4, 2.1, PAL.peachLight, ['"Cocoa\'s warm, croissants are fresh!"', '"Take any table you like."']);
      s.table(8.4, 4.6); s.table(10.4, 6.4); s.table(2.6, 6.2); s.table(8.4, 6.6);
      s.piece('plantBig', 10.8, 2.6); s.piece('plantTiny', 1.2, 3.8); s.piece('lampP', 6.9, 2.4);
      s.spots = { front: { x: 4.4 * T, y: 4.4 * T }, counterTop: { x: 4.4 * T, y: 2.3 * T } };
      s.interactables.push({ x: 4.4 * T, y: 4.2 * T, r: 18, label: () => ({ text: s.world.owner ? 'Order a hot cocoa and a croissant' : 'The counter' }), action: s.world.owner ? () => s.playerVisit() : null });
    },
    async script(s, a, ctx) {
      await orderAtCounter(s, a, s.staff.barista, s.spots.front, 'icon-coffee', s.spots.counterTop);
      await sitAndEat(s, a, ctx, s.freeSeat(a), FOODS.coffee, 'icon-croissant');
    },
  },

  bakery: {
    name: 'Rise & Shine Bakery', w: 12, h: 8, tint: 0xfff3d4, rug: 'rugG',
    build(s) {
      s.wallItem('bread-shelf', 2.6, 2.2);
      s.add.image(10.3 * T, 2.6 * T, 'oven').setOrigin(0.5, 1).setDepth(2.6 * T);
      s.colliders.push({ x: 9.6 * T, y: 1.6 * T, w: 26, h: 16 });
      s.lights.push({ x: 10.3 * T, y: 1.9 * T });
      s.counterBar('counter-48', 6, 3.5);
      s.add.image(6 * T, 2.5 * T, 'pastry-case').setOrigin(0.5, 1).setDepth(3.5 * T + 3);
      s.staffAt('baker', 6, 2.1, PAL.yellowLight, ['"Fresh out of the oven!"', '"The croissants are folded 27 times."']);
      s.table(3, 5.6); s.table(9.2, 5.8); s.table(3.6, 3.9);
      s.piece('plantSmall', 1.2, 6.6); s.piece('lampG', 8, 2.4);
      s.spots = { front: { x: 6 * T, y: 4.4 * T }, counterTop: { x: 6.6 * T, y: 2.3 * T } };
      s.interactables.push({ x: 6 * T, y: 4.2 * T, r: 18, label: () => ({ text: s.world.owner ? 'Buy a croissant' : 'The counter' }), action: s.world.owner ? () => s.playerVisit() : null });
    },
    async script(s, a, ctx) {
      await orderAtCounter(s, a, s.staff.baker, s.spots.front, 'icon-croissant', s.spots.counterTop);
      await sitAndEat(s, a, ctx, s.freeSeat(a), FOODS.bakery, 'dish-bread');
    },
  },

  restaurant: {
    name: 'Valley Kitchen', w: 14, h: 9, tint: 0xffe2dc, rug: 'rugP',
    build(s) {
      s.wallItem('kitchen-pass', 7, 1.6);
      s.staffAt('chef', 7, 1.45, '#fbf4df', ['"Order up!"', '"Tonight\'s special: whatever the valley grew."'], { behindWall: true });
      s.add.image(4.6 * T, 7.4 * T, 'host-stand').setOrigin(0.5, 1).setDepth(7.4 * T);
      s.colliders.push({ x: 4.6 * T - 7, y: 7.4 * T - 6, w: 14, h: 6 });
      s.staffAt('waiter', 3.6, 7.2, PAL.blueLight, ['"Right this way!"', '"Can I get you anything else?"']);
      for (const [x, y] of [[3.4, 3.8], [7, 4.2], [10.6, 3.8], [3.4, 6], [10.6, 6]]) s.table(x, y, 'cloth-table');
      s.piece('plantBig', 12.6, 2.6); s.piece('plantBig', 1.4, 2.6); s.piece('lampB', 12.6, 7.4);
      s.spots = { host: { x: 4.6 * T + 10, y: 8.1 * T }, pass: { x: 7 * T, y: 2.6 * T } };
      s.interactables.push({ x: 4.6 * T, y: 7.8 * T, r: 16, label: () => ({ text: s.world.owner ? 'Get a table' : 'The host stand' }), action: s.world.owner ? () => s.playerVisit() : null });
    },
    // Townsfolk: seated, then eat (the waiter is busy with you)
    async npcScript(s, a, ctx) {
      await sitAndEat(s, a, ctx, s.freeSeat(a), FOODS.restaurant, 'icon-plate');
    },
    async script(s, a, ctx) {
      const waiter = s.staff.waiter;
      await s.go(a, s.spots.host.x, s.spots.host.y);
      s.face(a, 'left');
      s.faceStaff(waiter, a);
      s.bubble(waiter, 'icon-chat');
      await s.wait(1.2);
      const seat = s.freeSeat(a);
      s.clearBubble(waiter);
      await Promise.all([s.go(waiter, seat.table.x + 18, seat.table.y + 4), s.go(a, seat.table.x - 18, seat.table.y + 2)]);
      await s.go(a, seat.table.x - 16, seat.y);
      s.sit(a, seat);
      s.bubble(a, 'icon-book'); // reading the menu
      await s.wait(2);
      s.faceStaff(waiter, a);
      s.bubble(waiter, 'icon-chat'); s.bubble(a, 'icon-meal');
      sfx.open();
      await s.wait(1.6);
      s.clearBubble(waiter); s.clearBubble(a);
      await s.go(waiter, s.spots.pass.x, s.spots.pass.y + 6);
      s.face(waiter, 'up');
      s.bubble(s.staff.chef, 'icon-plate');
      await s.wait(2);
      s.clearBubble(s.staff.chef);
      const carried = s.carry(waiter, 'icon-plate');
      await s.go(waiter, seat.table.x + 18, seat.table.y + 4);
      carried.destroy();
      sfx.pickup();
      await sitAndEat(s, a, { keepGoing: () => ctx.keepGoing() }, { ...seat, already: true }, FOODS.restaurant, 'icon-plate');
      s.bubble(a, 'icon-coin'); sfx.confirm();
      s.bubble(waiter, 'gift-heart');
      await s.wait(1.2);
      s.clearBubble(waiter);
      s.go(waiter, s.staff.waiter.home.x, s.staff.waiter.home.y);
    },
  },

  gym: {
    name: 'Steady Strength Gym', w: 16, h: 10, tint: 0xdfe8ff, rug: 'rugB',
    build(s) {
      s.wallItem('mirror', 8.6, 1.2);
      s.counterBar('counter-desk', 3.4, 7.4);
      s.add.image(2.8 * T, 6.5 * T, 'computer').setOrigin(0.5, 1).setDepth(7.4 * T + 2);
      s.staffAt('coach', 3.4, 6.1, PAL.leafLight, ['"Welcome in! Grab a machine."', '"Water\'s by the mirror. Hydrate!"']);
      s.machine('treadmill', 'treadmill-0', 2.6, 2.9, { label: 'Run on the treadmill', spot: [2.8, 2.6], face: 'right', anim: 'walk-right', rate: 1.8, belt: true, icon: 'icon-shoe' });
      s.machine('treadmill2', 'treadmill-0', 5.2, 2.9, { label: 'Run on the treadmill', spot: [5.4, 2.6], face: 'right', anim: 'walk-right', rate: 1.8, belt: true, icon: 'icon-shoe' });
      s.machine('squat', 'squat-rack', 8.6, 3.4, { label: 'Squats at the squat rack', spot: [8.6, 3.0], face: 'down', bob: [0.78, 520], icon: 'icon-dumbbell', front: true });
      s.machine('bench', 'bench-press', 11.8, 3.0, { label: 'Bench press', spot: [11.6, 2.7], face: 'down', bob: [0.88, 600], icon: 'icon-dumbbell' });
      s.machine('bike', 'bike', 14.2, 4.6, { label: 'Ride the exercise bike', spot: [14.1, 4.3], face: 'left', anim: 'walk-left', rate: 0.9, icon: 'icon-shoe', front: true });
      s.machine('dumbbells', 'dumbbell-rack', 12.4, 6.6, { label: 'Curl some dumbbells', spot: [12.4, 7.2], face: 'up', bob: [0.92, 450], icon: 'icon-dumbbell', approach: true });
      s.machine('yoga', 'yoga-mat', 8.4, 6.6, { label: 'Stretch on the mat', spot: [8.4, 6.4], face: 'down', bob: [0.9, 1300], icon: 'gift-heart', flat: true });
      s.add.image(15.1 * T, 2.6 * T, 'water-cooler').setOrigin(0.5, 1).setDepth(2.6 * T);
      s.colliders.push({ x: 15.1 * T - 5, y: 2.6 * T - 6, w: 10, h: 6 });
      s.spots = { desk: { x: 3.4 * T, y: 8.2 * T }, water: { x: 15.1 * T - 14, y: 2.9 * T } };
      s.interactables.push({ x: 3.4 * T, y: 8 * T, r: 16, label: () => ({ text: s.world.owner ? 'Check in and work out' : 'The front desk' }), action: s.world.owner ? () => s.playerVisit() : null });
      s.interactables.push({ x: s.spots.water.x, y: s.spots.water.y, r: 14, label: () => ({ text: 'Drink some water' }), action: () => s.playerDo(async (a) => { await s.go(a, s.spots.water.x, s.spots.water.y); s.face(a, 'right'); s.bubble(a, 'milk-grass', 'water'); await s.wait(2.5); }) });
    },
    async script(s, a, ctx) {
      await s.go(a, s.spots.desk.x, s.spots.desk.y);
      s.face(a, 'up');
      s.bubble(a, 'icon-card');
      s.faceStaff(s.staff.coach, a);
      s.bubble(s.staff.coach, 'icon-chat');
      sfx.confirm();
      await s.wait(1.6);
      s.clearBubble(s.staff.coach);
      const order = s.shuffle(Object.keys(s.machines));
      let i = 0;
      do {
        const m = s.machines[order[i++ % order.length]];
        if (m.busy) { await s.wait(0.5); continue; }
        await s.useMachine(a, m, 7);
        if (i % 3 === 0) { await s.go(a, s.spots.water.x, s.spots.water.y); s.face(a, 'right'); s.bubble(a, 'milk-grass', 'water'); await s.wait(2); }
      } while (ctx.keepGoing());
    },
  },
};
