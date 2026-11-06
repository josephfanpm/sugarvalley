// HUD: sunlight (owner) or whose valley it is (visitor), current reading with a mini graph,
// a tap-to-open graph panel, inventory (I), journal and weekly-goal windows, prompt, toasts,
// and the urgent-state banner (the game keeps running underneath).
import { PAL, hex, STATE_COLOR } from '../data/palette.js';
import { isUrgent, formatBg, unitLabel } from '../data/cgm.js';
import { sfx, setMuted, isMuted, unlockAudio } from '../audio.js';
import { graphTexture } from '../ui/graph.js';
import { captionFor } from '../data/captions.js';
import { ITEM_ICON } from '../world/farm.js';
import { ITEMS, RECIPES } from '../data/valley-rules.js';
import { WINDOWS } from '../data/insights.js';

const INTRO_KEY = (role) => `sugar-valley-intro-${role}`;
const seenIntro = (role) => { try { return !!localStorage.getItem(INTRO_KEY(role)); } catch { return true; } };
const markIntro = (role) => { try { localStorage.setItem(INTRO_KEY(role), '1'); } catch { /* blocked */ } };

const FONT = '"DotGothic16", monospace';
const ARROWS = (d) => (d > 12 ? '⇈' : d > 6 ? '↑' : d > 2 ? '↗' : d >= -2 ? '→' : d >= -6 ? '↘' : d >= -12 ? '↓' : '⇊');
const STATE_LABEL = { in_range: 'In range', high: 'High', low: 'Low', urgent_low: 'Urgent low', urgent_high: 'Urgent high', stale: 'No recent reading' };
const touch = () => window.matchMedia('(pointer: coarse)').matches;
// Break ligatures: DotGothic16' "fi"/"fl" glyphs render wrong in canvas text.
const noLig = (t) => String(t).replace(/f(?=[il])/g, 'f‌');
const HOUR = 3_600_000;

const MINI = { w: 64, h: 16, span: 3 * HOUR };
const BIG = { w: 168, h: 64 };

export class Hud extends Phaser.Scene {
  constructor() { super('Hud'); }

  create() {
    this.s = 3;
    this.view = null;
    this.graphOpen = false;
    this.build();
    this.game.events.on('zoom', (z) => { this.s = Math.max(2, Math.min(4, z)); this.layout(); }, this);
    this.game.events.on('status', (st) => { this.view = st.view; this.pending = st.pending; this.refresh(); }, this);
    this.game.events.on('prompt', (p) => this.showPrompt(p), this);
    this.game.events.on('toast', (t) => this.toast(t), this);
    this.game.events.on('sun-collected', () => this.bumpSun(), this);
    this.scale.on('resize', () => this.layout());
    this.events.once('shutdown', () => this.game.events.off('zoom').off('status').off('prompt').off('toast').off('sun-collected'));
    this.capPending = true; // show the blood sugar line on first load
    // Data refresh lives here: the HUD's clock keeps running even when a window is open.
    this.time.addEvent({ delay: 60_000, loop: true, callback: () => this.scene.get('World')?.refresh() });
    this.input.keyboard.on('keydown-G', () => this.toggleGraph());
    this.input.keyboard.on('keydown-ESC', () => this.toggleGraph(false));
    this.s = Math.max(2, Math.min(4, this.scene.get('World').zoom || 3));
    this.layout();
  }

  text(size, color = PAL.ink) {
    return this.add.text(0, 0, '', { fontFamily: FONT, fontSize: `${size}px`, color, resolution: 1 }).setOrigin(0, 0.5);
  }
  panel(w, h) { return this.add.nineslice(0, 0, 'panel', null, w, h, 4, 4, 4, 4).setOrigin(0); }
  setText(t, s) { t.setText(noLig(s)); return t; }

  build() {
    // Left: sunlight (owner) / "Sam's valley" (visitor)
    this.sunPanel = this.panel(40, 16);
    this.sunIcon = this.add.image(0, 0, 'icon-sun').setOrigin(0.5);
    this.sunText = this.text(10);
    // Right: reading chip + mini graph (tap to open the big graph)
    this.bgPanel = this.panel(80, 40).setInteractive({ useHandCursor: true });
    this.bgPanel.on('pointerdown', (p, x, y, e) => { e?.stopPropagation(); unlockAudio(); this.toggleGraph(); });
    this.bgDot = this.add.rectangle(0, 0, 3, 3, hex(PAL.leafMid)).setOrigin(0.5);
    this.bgIcon = this.add.image(0, 0, 'icon-drop').setOrigin(0.5);
    this.bgText = this.text(10);
    this.bgSub = this.text(7, PAL.woodMid);
    this.mini = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setVisible(false);
    // Caption one-liner
    this.capBox = this.add.container(0, 0).setVisible(false);
    this.capPanel = this.panel(80, 14).setTint(0xfff8e6);
    this.capText = this.text(7).setOrigin(0.5).setAlign('center');
    this.capBox.add([this.capPanel, this.capText]);
    // Big graph panel
    this.big = this.add.container(0, 0).setVisible(false).setDepth(5);
    this.bigPanel = this.panel(BIG.w + 34, BIG.h + 34).setInteractive();
    this.bigPanel.on('pointerdown', (p, x, y, e) => { e?.stopPropagation(); this.toggleGraph(false); });
    this.bigTitle = this.text(8);
    this.bigClose = this.text(7, PAL.woodMid).setOrigin(1, 0.5);
    this.bigImg = this.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.bigHigh = this.text(6, PAL.leaf).setOrigin(1, 0.5);
    this.bigLow = this.text(6, PAL.leaf).setOrigin(1, 0.5);
    this.bigStart = this.text(6, PAL.woodMid);
    this.bigEnd = this.text(6, PAL.woodMid).setOrigin(1, 0.5);
    this.big.add([this.bigPanel, this.bigTitle, this.bigClose, this.bigImg, this.bigHigh, this.bigLow, this.bigStart, this.bigEnd]);
    // Prompt
    this.prompt = this.add.container(0, 0).setVisible(false);
    this.promptPanel = this.add.nineslice(0, 0, 'panel', null, 100, 18, 4, 4, 4, 4).setOrigin(0.5);
    this.promptKey = this.add.nineslice(0, 0, 'panel', null, 12, 12, 4, 4, 4, 4).setOrigin(0.5).setTint(hex(PAL.goldLight));
    this.promptKeyText = this.text(8).setOrigin(0.5);
    this.promptText = this.text(9);
    this.promptSun = this.add.image(0, 0, 'icon-sun').setOrigin(0.5);
    this.promptCost = this.text(9, PAL.peachDark);
    this.prompt.add([this.promptPanel, this.promptKey, this.promptKeyText, this.promptText, this.promptSun, this.promptCost]);
    this.promptPanel.setInteractive({ useHandCursor: true }).on('pointerdown', (p, x, y, e) => { e?.stopPropagation(); unlockAudio(); this.game.events.emit('hud-interact'); });
    // Toast
    this.toastBox = this.add.container(0, 0).setVisible(false).setDepth(6);
    this.toastPanel = this.add.nineslice(0, 0, 'panel', null, 100, 16, 4, 4, 4, 4).setOrigin(0.5);
    this.toastText = this.text(8).setOrigin(0.5);
    this.toastBox.add([this.toastPanel, this.toastText]);
    // Bottom-left buttons: mute, settings (owner)
    this.muteBtn = this.panel(14, 14).setOrigin(0, 1).setInteractive({ useHandCursor: true });
    this.muteText = this.text(8).setOrigin(0.5);
    const mute = () => { unlockAudio(); setMuted(!isMuted()); this.sound.mute = isMuted(); this.setText(this.muteText, isMuted() ? '×' : '♪'); };
    this.muteBtn.on('pointerdown', () => { mute(); sfx.blip(); });
    this.setText(this.muteText, '♪');
    this.input.keyboard.on('keydown-M', mute);
    this.gearBtn = this.panel(14, 14).setOrigin(0, 1).setInteractive({ useHandCursor: true }).setVisible(false);
    this.gearIcon = this.add.image(0, 0, 'icon-gear').setOrigin(0.5).setVisible(false);
    this.gearBtn.on('pointerdown', () => { location.href = '/game/setup.html'; });
    this.bagBtn = this.panel(14, 14).setOrigin(0, 1).setInteractive({ useHandCursor: true }).setVisible(false);
    this.bagIcon = this.add.image(0, 0, 'icon-bag').setOrigin(0.5).setVisible(false);
    this.bagBtn.on('pointerdown', () => { unlockAudio(); this.toggleInventory(); });
    this.input.keyboard.on('keydown-I', () => this.toggleInventory());
    this.helpBtn = this.panel(14, 14).setOrigin(0, 1).setInteractive({ useHandCursor: true });
    this.helpIcon = this.add.image(0, 0, 'icon-help').setOrigin(0.5);
    this.helpBtn.on('pointerdown', () => { unlockAudio(); this.showIntro(); });
    this.input.keyboard.on('keydown-H', () => this.showIntro());
    // How-it-works card
    this.intro = this.add.container(0, 0).setVisible(false).setDepth(8);
    this.introShade = this.add.rectangle(0, 0, 10, 10, 0x1d1e2e, 0.55).setOrigin(0).setInteractive();
    this.introPanel = this.panel(150, 120);
    this.introTitle = this.text(10).setOrigin(0.5);
    this.introRows = [0, 1, 2, 3].map(() => ({ img: this.add.image(0, 0, '__DEFAULT').setOrigin(0.5), t: this.text(7) }));
    this.introBtn = this.panel(50, 18).setOrigin(0.5).setTint(0xd8f0b0).setInteractive({ useHandCursor: true });
    this.introBtnText = this.text(9).setOrigin(0.5);
    this.introBtn.on('pointerdown', (p, x, y, e) => { e?.stopPropagation(); this.hideIntro(); });
    this.input.keyboard.on('keydown-ENTER', () => { if (this.intro.visible) this.hideIntro(); });
    this.intro.add([this.introShade, this.introPanel, this.introTitle, ...this.introRows.flatMap((r) => [r.img, r.t]), this.introBtn, this.introBtnText]);
    // Urgent banner: always on top, can't be dismissed; the game keeps going underneath.
    this.urgent = this.add.container(0, 0).setVisible(false).setDepth(10);
    this.urgentBg = this.panel(100, 40).setTint(0xffd9d2);
    this.urgentIcon = this.add.image(0, 0, 'icon-bang').setOrigin(0.5);
    this.urgentTitle = this.text(16, PAL.roseDark).setOrigin(0, 0.5);
    this.urgentBody = this.text(10, PAL.ink).setOrigin(0, 0.5);
    this.callBtns = [['Text', 'sms'], ['Call', 'tel']].map(([label, scheme]) => {
      const b = this.panel(40, 16).setOrigin(0.5).setInteractive({ useHandCursor: true });
      const t = this.setText(this.text(9).setOrigin(0.5), label);
      b.on('pointerdown', () => { if (this.view?.contactPhone) location.href = `${scheme}:${this.view.contactPhone.replace(/[^\d+]/g, '')}`; });
      return { b, t };
    });
    this.urgent.add([this.urgentBg, this.urgentIcon, this.urgentTitle, this.urgentBody, ...this.callBtns.flatMap(({ b, t }) => [b, t])]);
    this.tweens.add({ targets: this.urgentIcon, scale: { from: this.s, to: this.s * 1.25 }, duration: 600, yoyo: true, repeat: -1 });

    // Modal window (journal, weekly goal)
    this.modal = this.add.container(0, 0).setVisible(false).setDepth(9);
    this.modalShade = this.add.rectangle(0, 0, 10, 10, 0x1d1e2e, 0.55).setOrigin(0).setInteractive();
    this.modalShade.on('pointerdown', () => this.closeModal());
    this.modalPanel = this.panel(180, 150).setInteractive();
    this.modal.add([this.modalShade, this.modalPanel]);
    this.modalItems = [];
    this.game.events.on('open-journal', () => this.openJournal(), this);
    this.game.events.on('open-quest', () => this.openQuest(), this);
    this.input.keyboard.on('keydown-ESC', () => this.closeModal());
  }

  get owner() { return this.view?.role === 'owner'; }

  layout() {
    const s = this.s, { width, height } = this.scale, m = 6 * s;
    const fs = (n) => `${Math.round(n * s)}px`;
    for (const t of [this.sunText, this.bgText, this.promptText, this.promptCost, this.bigTitle]) t.setFontSize(fs(8));
    for (const t of [this.bgSub, this.toastText, this.promptKeyText, this.muteText, this.bigClose]) t.setFontSize(fs(6.5));
    for (const t of [this.bigHigh, this.bigLow, this.bigStart, this.bigEnd]) t.setFontSize(fs(5.5));
    this.urgentTitle.setFontSize(fs(9)); this.urgentBody.setFontSize(fs(7));
    for (const { t } of this.callBtns) t.setFontSize(fs(8));

    this.sunPanel.setPosition(m, m).setScale(s);
    this.sunIcon.setPosition(m + 11 * s, m + 8 * s).setScale(s);
    this.sunText.setPosition(m + (this.owner ? 19 : 8) * s, m + 8.5 * s);
    this.fitSun();
    this.layoutReading();
    this.layoutBig();
    this.narrow = width < 560;
    this.prompt.setPosition(width / 2, height - m - (this.narrow ? 30 : 12) * s);
    this.prompt.baseY = this.prompt.y;
    this.layoutPrompt();
    this.toastBox.setPosition(width / 2, m + 30 * s);
    this.muteBtn.setPosition(m, height - m).setScale(s);
    this.muteText.setPosition(m + 7 * s, height - m - 7 * s);
    this.gearBtn.setPosition(m + 17 * s, height - m).setScale(s);
    this.gearIcon.setPosition(m + 24 * s, height - m - 7 * s).setScale(s);
    this.bagBtn.setPosition(m + 34 * s, height - m).setScale(s);
    this.bagIcon.setPosition(m + 41 * s, height - m - 7 * s).setScale(s);
    const hx = m + (this.owner ? 51 : 17) * s;
    this.helpBtn.setPosition(hx, height - m).setScale(s);
    this.helpIcon.setPosition(hx + 7 * s, height - m - 7 * s).setScale(s);
    this.capText.setFontSize(fs(6.5));
    this.introTitle.setFontSize(fs(10)); this.introBtnText.setFontSize(fs(8));
    for (const r of this.introRows) r.t.setFontSize(fs(7));
    this.layoutCaption();
    this.layoutIntro();
    this.layoutUrgent();
  }

  layoutUrgent() {
    const s = this.s, { width, height } = this.scale, m = 6 * s;
    const phone = !!this.view?.contactPhone && !this.owner;
    const bw = Math.min((width - 2 * m) / s, 260), bh = phone ? 44 : 30;
    const x0 = width / 2 - (bw * s) / 2, y0 = height - m - (bh + (this.narrow ? 40 : 22)) * s;
    this.urgentBg.setPosition(x0, y0).setScale(s).setSize(bw, bh);
    this.urgentIcon.setPosition(x0 + 12 * s, y0 + 15 * s);
    this.urgentTitle.setPosition(x0 + 22 * s, y0 + 10 * s).setWordWrapWidth((bw - 28) * s);
    this.urgentBody.setPosition(x0 + 22 * s, y0 + 21 * s).setWordWrapWidth((bw - 28) * s);
    this.callBtns.forEach(({ b, t }, i) => {
      const x = x0 + (22 + 20 + i * 44) * s, y = y0 + 34 * s;
      b.setScale(s).setPosition(x, y); t.setPosition(x, y);
    });
  }


  fitSun() {
    this.sunPanel.setSize(Math.ceil((this.owner ? 22 : 12) + this.sunText.width / this.s + 5), 16);
  }

  layoutReading() {
    const s = this.s, { width } = this.scale, m = 6 * s;
    const shown = this.bgPanel.visible;
    if (!shown) return;
    const hasMini = this.mini.visible;
    const inner = Math.max(this.bgText.width / s, this.bgSub.width / s, hasMini ? MINI.w - 16 : 0);
    const w = Math.ceil(inner + 26), h = hasMini ? 44 : 24;
    if (hasMini && this.miniW !== w - 10) this.drawMini(w - 10);
    this.bgPanel.setPosition(width - m - w * s, m).setScale(s).setSize(w, h);
    const left = width - m - w * s;
    this.bgIcon.setPosition(left + 10 * s, m + 12 * s).setScale(s);
    this.bgText.setPosition(left + 18 * s, m + 9 * s);
    this.bgSub.setPosition(left + 18 * s, m + 17 * s);
    this.bgDot.setPosition(width - m - 6 * s, m + 6 * s).setSize(3 * s, 3 * s);
    this.mini.setPosition(left + 5 * s, m + 24 * s).setScale(s);
  }

  drawMini(w = this.miniW || MINI.w) {
    const v = this.view;
    graphTexture(this, 'graph-mini', v.graph, { t: v.thresholds, spanMs: MINI.span, w, h: MINI.h });
    this.mini.setTexture('graph-mini');
    this.miniW = w;
  }

  refresh() {
    const v = this.view;
    if (!v) return;
    // Left panel
    this.sunIcon.setVisible(this.owner);
    this.setText(this.sunText, this.owner ? `${v.valley.sun}` : `${v.name}'s valley`);
    this.gearBtn.setVisible(this.owner); this.gearIcon.setVisible(this.owner);
    this.bagBtn.setVisible(this.owner); this.bagIcon.setVisible(this.owner);
    // Reading chip: visitors only see numbers if the owner shares them
    const r = v.latest, showChip = this.owner || v.showNumbers;
    for (const o of [this.bgPanel, this.bgDot, this.bgIcon, this.bgText, this.bgSub]) o.setVisible(showChip);
    if (showChip) {
      const who = this.owner ? '' : `${v.name} · `;
      if (v.state === 'stale' || !r) {
        this.setText(this.bgText, `${who}No recent reading`);
        this.setText(this.bgSub, r ? `Last one ${Math.round((Date.now() - r.ts) / 60000)} min ago` : this.owner ? 'Connect your CGM in settings' : '');
      } else {
        const g = v.graph || [], prev = g.length > 1 ? g[g.length - 2][1] : r.mgdl;
        this.setText(this.bgText, `${who}${formatBg(r.mgdl, v.unit)} ${ARROWS(r.mgdl - prev)}`);
        const h = Math.floor((v.steady || 0) / 60), mm = (v.steady || 0) % 60;
        const steady = v.state === 'in_range' && h >= 1 ? ` · ${h}h${h < 3 && mm >= 10 ? ` ${mm}m` : ''} steady` : '';
        this.setText(this.bgSub, `${unitLabel(v.unit)} · ${STATE_LABEL[v.state]}${steady}`);
      }
      this.bgDot.setFillStyle(hex(STATE_COLOR[v.state] || PAL.stone));
      const hasGraph = (v.graph || []).length > 1;
      this.mini.setVisible(hasGraph);
      if (hasGraph) this.drawMini();
      if (this.graphOpen) this.drawBig();
    } else { this.mini.setVisible(false); this.toggleGraph(false); }
    const ts = v.latest?.ts ?? null;
    if (ts !== this.lastReadingTs) { if (this.lastReadingTs !== undefined) this.capPending = true; this.lastReadingTs = ts; }
    this.maybeShowCaption();
    this.layout();
    if (!this.introChecked && !isUrgent(v.state)) {
      this.introChecked = true;
      const q = new URLSearchParams(location.search);
      if (!seenIntro(v.role) && !q.has('nointro')) this.time.delayedCall(700, () => this.showIntro());
      else if (this.owner && v.recap && !q.has('norecap') && this.recapDue(v.recap)) this.time.delayedCall(900, () => this.openRecap());
    }
    // Safety rule #2: urgent states show a banner that can't be dismissed. The game keeps running
    // (the character sits and treats) but jokes, gifts and prompts step aside.
    const urgent = isUrgent(v.state);
    this.urgent.setVisible(urgent);
    if (urgent) {
      const low = v.state === 'urgent_low';
      const value = r ? ` · ${formatBg(r.mgdl, v.unit)} ${unitLabel(v.unit)}` : '';
      if (this.owner) {
        this.setText(this.urgentTitle, `${low ? 'Urgent low' : 'Urgent high'}${value}`);
        this.setText(this.urgentBody, 'Take care of yourself first. The valley will wait.');
      } else {
        this.setText(this.urgentTitle, `${v.name} · ${low ? 'urgent low' : 'urgent high'}${value}`);
        this.setText(this.urgentBody, `Check on ${v.name} now.`);
      }
      for (const { b, t } of this.callBtns) { b.setVisible(!!v.contactPhone && !this.owner); t.setVisible(!!v.contactPhone && !this.owner); }
      this.prompt.setVisible(false);
      this.layoutUrgent();
    }
    if (urgent) { this.closeModal(); if (this.intro.visible) { this.intro.setVisible(false); this.lockWorld(false); } }
  }

  /** Windows lock player input; the world (and its glucose state) keeps running. */
  lockWorld(on) { const w = this.scene.get('World'); if (w) w.inputLocked = on; }

  // ---------- modal windows ----------
  clearModal() { for (const o of this.modalItems) o.destroy(); this.modalItems = []; this.modalKind = null; }
  closeModal() {
    if (!this.modal.visible) return;
    this.modal.setVisible(false); this.clearModal();
    this.lockWorld(false);
  }
  modalBox(pw, ph) {
    const { width, height } = this.scale;
    const s = Math.max(1, Math.min(this.s, Math.floor((width - 12) / pw), Math.floor((height - 12) / ph)));
    const x0 = Math.round(width / 2 - (pw * s) / 2), y0 = Math.round(height / 2 - (ph * s) / 2);
    this.modalShade.setSize(width, height);
    this.modalPanel.setPosition(x0, y0).setScale(s).setSize(pw, ph);
    this.modal.setVisible(true);
    this.lockWorld(true);
    return { s, x0, y0 };
  }
  mText(x, y, str, size, s, color = PAL.ink, origin = 0) {
    const t = this.add.text(x, y, noLig(str), { fontFamily: FONT, fontSize: `${Math.round(size * s)}px`, color, resolution: 1 }).setOrigin(origin, 0.5);
    this.modal.add(t); this.modalItems.push(t); return t;
  }
  mButton(x, y, w, label, s, onClick, tint) {
    const b = this.add.nineslice(x, y, 'panel', null, w, 16, 4, 4, 4, 4).setOrigin(0.5).setScale(s).setInteractive({ useHandCursor: true });
    if (tint) b.setTint(tint);
    const t = this.add.text(x, y, noLig(label), { fontFamily: FONT, fontSize: `${Math.round(7 * s)}px`, color: PAL.ink, resolution: 1 }).setOrigin(0.5);
    b.on('pointerdown', (p, lx, ly, e) => { e?.stopPropagation(); onClick(); });
    this.modal.add([b, t]); this.modalItems.push(b, t);
    return { b, t };
  }

  // Inventory (I): basket, cookbook, ribbons
  toggleInventory() {
    if (this.modal.visible && this.modalKind === 'inventory') { this.closeModal(); return; }
    this.openInventory();
  }
  openInventory() {
    const v = this.view;
    if (!v || !this.owner || isUrgent(v.state)) return;
    this.clearModal();
    this.modalKind = 'inventory';
    const pw = 180, ph = 132;
    const { s, x0, y0 } = this.modalBox(pw, ph);
    const X = (n) => x0 + n * s, Y = (n) => y0 + n * s;
    this.mText(X(10), Y(12), 'Basket', 9, s);
    this.mText(X(pw - 10), Y(12), touch() ? '' : 'I to close', 6, s, PAL.woodMid, 1);
    const inv = v.farm?.inventory || {};
    Object.keys(ITEMS).forEach((k, i) => {
      const cx = X(22 + i * 34), cy = Y(36);
      const slot = this.add.nineslice(cx, cy, 'panel', null, 26, 24, 4, 4, 4, 4).setScale(s).setTint(inv[k] ? 0xffffff : 0xdedede);
      const [key, frame] = ITEM_ICON[k];
      const img = this.add.image(cx, cy - 2 * s, key, frame);
      img.setScale((s * 12) / Math.max(img.width, img.height)).setAlpha(inv[k] ? 1 : 0.35);
      this.modal.add([slot, img]); this.modalItems.push(slot, img);
      this.mText(cx + 9 * s, cy + 7 * s, `${inv[k] || 0}`, 6.5, s, PAL.ink, 1);
      this.mText(cx, cy + 17 * s, ITEMS[k].name, 5.5, s, PAL.woodMid, 0.5);
    });
    const book = v.farm?.cookbook || {};
    const cooked = Object.keys(book).length;
    this.mText(X(10), Y(70), `Cookbook: ${cooked} of 7 recipes`, 7, s);
    const names = RECIPES.filter((r) => book[r.id]).map((r) => r.name).join(', ');
    this.mText(X(10), Y(82), cooked ? names : 'Cook at the campfire kitchen to fill it.', 6, s, PAL.woodMid).setWordWrapWidth((pw - 20) * s);
    this.mText(X(10), Y(100), `Ribbons: ${v.valley.ribbons || 0}`, 7, s);
    this.mText(X(10), Y(114), `Sunlight: ${v.valley.sun}`, 7, s);
    this.mButton(X(pw - 30), Y(114), 40, 'OK', s, () => this.closeModal());
  }

  // Morning recap: yesterday's plant blooms
  recapDue(r) { try { return localStorage.getItem('sugar-valley-recap') !== String(r.day); } catch { return false; } }
  openRecap() {
    const r = this.view?.recap;
    if (!r || this.modal.visible || this.intro.visible || isUrgent(this.view.state)) return;
    try { localStorage.setItem('sugar-valley-recap', String(r.day)); } catch { /* blocked */ }
    this.clearModal();
    const pw = 170, ph = 136;
    const { s, x0, y0 } = this.modalBox(pw, ph);
    const X = (n) => x0 + n * s, Y = (n) => y0 + n * s;
    this.mText(X(pw / 2), Y(12), 'Yesterday bloomed', 9, s, PAL.ink, 0.5);
    const key = `plant-${r.day}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(X(34), Y(70), key).setOrigin(0.5, 1).setScale(s * 1.6);
      this.modal.add(img); this.modalItems.push(img);
      this.tweens.add({ targets: img, scaleY: { from: 0.2 * s, to: s * 1.6 }, duration: 700, ease: 'Back.easeOut' });
    }
    const date = new Date(r.day).toLocaleDateString(undefined, { weekday: 'long' });
    this.mText(X(62), Y(32), date, 6.5, s, PAL.woodMid);
    this.mText(X(62), Y(44), `${r.tir}% in range${r.good ? ' · a good day' : ''}`, 7.5, s);
    this.mText(X(62), Y(56), r.comebacks ? `${r.comebacks} comeback${r.comebacks > 1 ? 's' : ''}` : 'No comebacks needed', 6.5, s);
    if (r.best) this.mText(X(62), Y(68), `Best: ${r.best.label.toLowerCase()} (${r.best.tir}%)`, 6.5, s);
    this.mText(X(10), Y(92), 'What happened yesterday? Tags help you see what works.', 6, s, PAL.woodMid).setWordWrapWidth((pw - 20) * s);
    this.mButton(X(48), Y(118), 72, 'Tag yesterday', s, () => { this.closeModal(); this.openJournal(1); }, 0xd8f0b0);
    this.mButton(X(pw - 32), Y(118), 44, 'Later', s, () => this.closeModal());
  }

  // Weekly goal from Maple
  openQuest() {
    const q = this.view?.quest;
    if (!q) return;
    if (isUrgent(this.view.state)) return;
    this.clearModal();
    const pw = 190, ph = 132;
    const { s, x0, y0 } = this.modalBox(pw, ph);
    const X = (n) => x0 + n * s, Y = (n) => y0 + n * s;
    this.mText(X(10), Y(12), "Maple's weekly goal", 6.5, s, PAL.woodMid);
    this.mText(X(10), Y(24), q.title, 10, s);
    this.mText(X(10), Y(37), q.detail, 6.5, s).setWordWrapWidth((pw - 20) * s);
    if (q.why) this.mText(X(10), Y(50), q.why, 6, s, PAL.woodMid).setWordWrapWidth((pw - 20) * s);
    // Mon..Sun dots
    const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const COLOR = { done: PAL.leafMid, missed: PAL.creamDark, nodata: PAL.stoneLight, future: '#fbf4df' };
    q.days.forEach((d, i) => {
      const cx = X(22 + i * 24), cy = Y(72);
      const dot = this.add.rectangle(cx, cy, 14 * s, 14 * s, hex(COLOR[d.status])).setStrokeStyle(s, hex(PAL.woodDark));
      this.modal.add(dot); this.modalItems.push(dot);
      if (d.status === 'done') { const ic = this.add.image(cx, cy, 'gift-flower').setScale(s * 0.9); this.modal.add(ic); this.modalItems.push(ic); }
      this.mText(cx, Y(86), DAYS[i], 6, s, PAL.woodMid, 0.5);
    });
    this.mText(X(10), Y(100), `${Math.min(q.done, q.need)} of ${q.need} done${q.claimed ? ' · ribbon earned' : ''}`, 7, s);
    if (q.claimable) this.mButton(X(pw - 46), Y(116), 64, `Claim +${q.reward}`, s, () => { this.closeModal(); this.game.events.emit('farm-action', { type: 'claim' }); }, 0xd8f0b0);
    else this.mButton(X(pw - 36), Y(116), 44, 'OK', s, () => this.closeModal());
    this.mText(X(10), Y(116), 'A goal, not a rule. Sick days count for you.', 5.5, s, PAL.woodMid).setWordWrapWidth((pw - 70) * s);
  }

  // Garden Journal: tag a day, see what helped
  openJournal(dayIndex = 0) {
    const j = this.view?.journal;
    if (!j) return;
    if (isUrgent(this.view.state)) return;
    this.clearModal();
    this.jIndex = dayIndex;
    this.jTags = new Set(j.recent[dayIndex]?.tags || []);
    const pw = 200, ph = 160;
    const { s, x0, y0 } = this.modalBox(pw, ph);
    const X = (n) => x0 + n * s, Y = (n) => y0 + n * s;
    const day = j.recent[dayIndex];
    this.mText(X(10), Y(12), 'Garden Journal', 9, s);
    // Insights first: this is what the journal is for
    if (j.insights.length) j.insights.slice(0, 2).forEach((ins, i) => this.mText(X(10), Y(26 + i * 11), ins.text, 5.8, s, PAL.leaf).setWordWrapWidth((pw - 20) * s));
    else this.mText(X(10), Y(28), j.needForInsights > 0 ? `Tag ${j.needForInsights} more day${j.needForInsights > 1 ? 's' : ''} to see what helps your days.` : 'Keep tagging. Patterns show up after a few weeks.', 6, s, PAL.woodMid).setWordWrapWidth((pw - 20) * s);
    // Day switcher
    const date = day.today ? 'Today' : new Date(day.day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const tir = day.enough && day.tir != null ? ` · ${Math.round(day.tir)}% in range` : '';
    this.mText(X(pw / 2), Y(52), `${date}${tir}`, 7.5, s, PAL.ink, 0.5);
    if (dayIndex < j.recent.length - 1) this.mButton(X(16), Y(52), 16, '<', s, () => this.openJournal(dayIndex + 1));
    if (dayIndex > 0) this.mButton(X(pw - 16), Y(52), 16, '>', s, () => this.openJournal(dayIndex - 1));
    // Tag chips 2 x 4
    j.tags.forEach((tag, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const cx = X(52 + col * 96), cy = Y(70 + row * 18);
      const on = () => this.jTags.has(tag.id);
      const chip = this.mButton(cx, cy, 88, tag.label, s, () => {
        if (on()) this.jTags.delete(tag.id); else this.jTags.add(tag.id);
        chip.b.setTint(on() ? 0xd8f0b0 : 0xffffff);
        sfx.blip();
      }, on() ? 0xd8f0b0 : null);
    });
    this.mButton(X(pw - 40), Y(ph - 12), 60, 'Save', s, () => {
      this.game.events.emit('farm-action', { type: 'journal', day: day.day, tags: [...this.jTags] });
      this.closeModal();
    }, 0xd8f0b0);
    const cooked = Object.keys(this.view.farm?.cookbook || {}).length;
    this.mText(X(10), Y(ph - 16), 'Only you see this.', 5.5, s, PAL.woodMid);
    this.mText(X(10), Y(ph - 8), `Recipes cooked: ${cooked} of 7 · Ribbons: ${this.view.valley.ribbons || 0}`, 5.5, s, PAL.woodMid);
  }

  // ---------- caption one-liner ----------
  /** The blood sugar line shows on first load and whenever a new reading arrives, until you can
   *  interact with something. It doesn't come back on its own after that. */
  maybeShowCaption() {
    if (!this.view || !this.capPending || this.current || isUrgent(this.view.state)) return;
    this.capPending = false;
    this.capSalt = (this.capSalt || 0) + 1;
    this.caption = captionFor(this.view, Date.now(), this.capSalt);
    this.setText(this.capText, this.caption);
    this.layoutCaption();
    this.fadeIn(this.capBox);
  }

  // Soft transitions: rise and fade in, fade out
  fadeIn(c, base = c === this.capBox ? 0 : null) {
    const y = base ?? c.baseY ?? c.y;
    c.baseY = y;
    this.tweens.killTweensOf(c);
    c.setVisible(true).setAlpha(0).setY(y + 6 * this.s);
    this.tweens.add({ targets: c, alpha: 1, y, duration: 280, ease: 'Cubic.easeOut' });
  }
  fadeOut(c) {
    if (!c.visible) return;
    const y = c.baseY ?? c.y;
    this.tweens.killTweensOf(c);
    this.tweens.add({ targets: c, alpha: 0, y: y + 3 * this.s, duration: 160, ease: 'Quad.easeIn', onComplete: () => { c.setVisible(false).setY(y); } });
  }

  layoutCaption() {
    if (!this.caption) return;
    const s = this.s, { width, height } = this.scale, m = 6 * s;
    // Stay clear of the bottom-left buttons (on narrow screens the box already sits above them).
    const room = this.narrow ? width - 2 * m : width - 2 * (m + 74 * s);
    this.capText.setWordWrapWidth(Math.max(120 * s, Math.min(room - 12 * s, 300 * s)));
    const w = Math.ceil(this.capText.width / s + 12), h = Math.ceil(this.capText.height / s + 6);
    // Same spot as the interaction prompt (they take turns)
    const y = (this.prompt.baseY ?? this.prompt.y) - (h * s) / 2;
    this.capPanel.setPosition(width / 2 - (w * s) / 2, y).setScale(s).setSize(w, h);
    this.capText.setPosition(width / 2, y + (h * s) / 2 + s * 0.5);
  }

  // ---------- how it works ----------
  showIntro() {
    const v = this.view;
    if (!v || isUrgent(v.state)) return;
    const owner = this.owner;
    this.setText(this.introTitle, owner ? 'How Sugar Valley works' : `Welcome to ${v.name}'s valley`);
    const rows = owner ? [
      ['icon-sun', 'Stay in range. Every reading fills the Sun Well with sunlight.'],
      ['well-full', 'Collect it at the well, then spend it to restore the valley.'],
      ['gift-flower', 'Each day grows a plant in your Garden of Days.'],
      ['notice-board', 'Chores, cooking and a weekly goal from Maple. Follow the arrow.'],
    ] : [
      ['gift-heart', `Leave gifts at the Sun Well. They become sunlight for ${v.name}.`],
      ['gift-flower', `Each plant in the garden is one of ${v.name}'s days.`],
      ['icon-sun', `${v.name} spends sunlight to bring the valley back.`],
      ['arrow', `${v.name} walks around doing their thing. Follow the arrow to explore.`],
    ];
    rows.forEach(([key, txt], i) => { this.introRows[i].img.setTexture(key); this.setText(this.introRows[i].t, txt); });
    this.setText(this.introBtnText, owner ? 'Start' : "Let's go");
    this.intro.setVisible(true);
    this.layoutIntro();
    this.lockWorld(true);
  }

  hideIntro() {
    this.intro.setVisible(false);
    markIntro(this.view.role);
    sfx.open();
    this.lockWorld(false);
  }

  layoutIntro() {
    if (!this.intro.visible) return;
    const { width, height } = this.scale;
    const pw = 168, ph = 136;
    const s = Math.max(1, Math.min(this.s, Math.floor((width - 16) / pw), Math.floor((height - 16) / ph)));
    const fs = (n) => `${Math.round(n * s)}px`;
    this.introTitle.setFontSize(fs(10)); this.introBtnText.setFontSize(fs(8));
    const x0 = Math.round(width / 2 - (pw * s) / 2), y0 = Math.round(height / 2 - (ph * s) / 2);
    this.introShade.setSize(width, height);
    this.introPanel.setPosition(x0, y0).setScale(s).setSize(pw, ph);
    this.introTitle.setPosition(width / 2, y0 + 14 * s);
    this.introRows.forEach((r, i) => {
      const y = y0 + (34 + i * 22) * s;
      r.img.setPosition(x0 + 16 * s, y).setScale(s * (r.img.texture.key === 'well-full' ? 0.6 : 1));
      r.t.setFontSize(fs(6.5)).setPosition(x0 + 30 * s, y).setWordWrapWidth((pw - 38) * s);
    });
    this.introBtn.setPosition(width / 2, y0 + (ph - 14) * s).setScale(s);
    this.introBtnText.setPosition(width / 2, y0 + (ph - 14) * s);
  }

  // ---------- big graph ----------
  toggleGraph(open = !this.graphOpen) {
    const v = this.view;
    if (open && !((v?.graph || []).length > 1)) return;
    this.graphOpen = open;
    this.big.setVisible(open);
    if (open) { sfx.open(); this.drawBig(); }
  }

  drawBig() {
    const v = this.view;
    const span = this.owner ? 24 * HOUR : 12 * HOUR;
    graphTexture(this, 'graph-big', v.graph, { t: v.thresholds, spanMs: span, w: BIG.w, h: BIG.h, ticksEveryMs: this.owner ? 6 * HOUR : 3 * HOUR });
    this.bigImg.setTexture('graph-big');
    this.setText(this.bigTitle, `${this.owner ? 'Last 24 hours' : `${v.name} · last 12 hours`}`);
    this.setText(this.bigClose, touch() ? 'Tap to close' : 'G to close');
    this.setText(this.bigHigh, formatBg(v.thresholds.high, v.unit));
    this.setText(this.bigLow, formatBg(v.thresholds.low, v.unit));
    const fmt = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric' }).replace(' ', '').toLowerCase();
    this.setText(this.bigStart, fmt(Date.now() - span));
    this.setText(this.bigEnd, 'now');
    this.layoutBig();
  }

  layoutBig() {
    const s = this.s, { width, height } = this.scale;
    const pw = BIG.w + 34, ph = BIG.h + 34;
    const scale = Math.min(s, Math.floor((width - 12) / pw) || 1);
    const x0 = Math.round(width / 2 - (pw * scale) / 2), y0 = Math.round(Math.min(height / 2 - (ph * scale) / 2, height * 0.22));
    this.bigPanel.setPosition(x0, y0).setScale(scale).setSize(pw, ph);
    this.bigTitle.setPosition(x0 + 8 * scale, y0 + 9 * scale);
    this.bigClose.setPosition(x0 + (pw - 8) * scale, y0 + 9 * scale);
    const gx = x0 + 24 * scale, gy = y0 + 17 * scale;
    this.bigImg.setPosition(gx, gy).setScale(scale);
    const v = this.view;
    if (v?.thresholds) {
      const yOf = (val) => gy + ((BIG.h - 2) - ((Math.max(40, Math.min(300, val)) - 40) / 260) * (BIG.h - 3)) * scale;
      this.bigHigh.setPosition(gx - 3 * scale, yOf(v.thresholds.high));
      this.bigLow.setPosition(gx - 3 * scale, yOf(v.thresholds.low));
    }
    this.bigStart.setPosition(gx, gy + (BIG.h + 6) * scale);
    this.bigEnd.setPosition(gx + BIG.w * scale, gy + (BIG.h + 6) * scale);
  }

  // ---------- prompt & toast ----------
  showPrompt(p) {
    const prev = this.current;
    this.current = p;
    // One box at the bottom: an interaction replaces the blood sugar line.
    if (!p || this.urgent.visible) {
      if (prev) this.fadeOut(this.prompt);
      if (!p) this.time.delayedCall(170, () => this.maybeShowCaption()); // a new reading may be waiting
      return;
    }
    this.fadeOut(this.capBox);
    const changed = !prev || prev.text !== p.text || prev.cost !== p.cost;
    this.setText(this.promptText, p.text);
    this.setText(this.promptCost, p.cost || '');
    this.promptSun.setVisible(!!p.cost);
    this.promptKey.setVisible(!!p.action);
    this.promptKeyText.setVisible(!!p.action);
    this.setText(this.promptKeyText, touch() ? 'Tap' : 'E');
    this.layoutPrompt();
    if (changed || !this.prompt.visible) this.fadeIn(this.prompt);
  }

  layoutPrompt() {
    if (!this.current) return;
    const s = this.s;
    const keyW = this.current.action ? (touch() ? 22 : 14) : 0;
    const costW = this.current.cost ? 14 + this.promptCost.width / s : 0;
    const w = Math.ceil(12 + keyW + this.promptText.width / s + costW + 4);
    this.promptPanel.setScale(s).setSize(w, 20);
    let x = (-w / 2 + 7) * s;
    this.promptKey.setScale(s).setSize(Math.max(4, keyW - 4), 12).setPosition(x + ((keyW - 4) / 2) * s, 0);
    this.promptKeyText.setPosition(x + ((keyW - 4) / 2) * s, 0);
    x += keyW * s;
    this.promptText.setPosition(x, s * 0.5);
    x += this.promptText.width + 6 * s;
    this.promptSun.setScale(s).setPosition(x + 3 * s, 0);
    this.promptCost.setPosition(x + 10 * s, s * 0.5);
  }

  toast(msg) {
    const s = this.s;
    this.setText(this.toastText, msg);
    this.toastText.setWordWrapWidth(this.scale.width - 24 * s);
    this.toastPanel.setScale(s).setSize(Math.ceil(this.toastText.width / s + 14), Math.ceil(this.toastText.height / s + 8));
    const y = 6 * s + (this.mini.visible ? 56 : 36) * s;
    this.toastBox.setVisible(true).setAlpha(0).setY(y - 4 * s);
    this.tweens.killTweensOf(this.toastBox);
    this.tweens.add({ targets: this.toastBox, alpha: 1, y, duration: 220, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: this.toastBox, alpha: 0, delay: 3400, duration: 400, onComplete: () => this.toastBox.setVisible(false) });
  }

  bumpSun() {
    this.tweens.add({ targets: [this.sunIcon], scale: { from: this.s * 1.5, to: this.s }, angle: { from: -30, to: 0 }, duration: 500, ease: 'Back.easeOut' });
  }
}
