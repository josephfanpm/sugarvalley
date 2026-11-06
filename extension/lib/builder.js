// Character builder + scene picker, shared by onboarding and the Character page.
import { DEFAULT_AVATAR } from '../shared/avatar.js';
import { THEMES, drawThemeThumb } from '../shared/scene.js';

const SKINS = ['light', 'amber', 'olive', 'taupe', 'bronze', 'brown', 'black', 'blue', 'green', 'lavender'];
const pretty = (s) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const HAIR_NAMES = { plain: 'Classic', messy: 'Messy', pixie: 'Pixie', buzzcut: 'Buzz cut', spiked: 'Spiky', bob: 'Bob', curly: 'Curly', afro: 'Afro', ponytail: 'Ponytail', long: 'Long' };
const PART_NAMES = { tshirt: 'T-shirt', longsleeve: 'Long sleeve', pants: 'Pants', shorts: 'Shorts', skirt: 'Skirt' };

export function themePicker(el, current, onPick) {
  el.innerHTML = THEMES.map((t) => `<button type="button" class="theme" data-theme="${t.id}" aria-pressed="${t.id === current}"><canvas width="240" height="168"></canvas><span>${t.label}</span></button>`).join('');
  el.querySelectorAll('[data-theme]').forEach((b) => {
    drawThemeThumb(b.querySelector('canvas'), b.dataset.theme);
    b.addEventListener('click', () => {
      el.querySelectorAll('[data-theme]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      onPick(b.dataset.theme);
    });
  });
}

/** Renders the avatar controls into `el`. Calls onChange(avatar) on every change. */
export function avatarControls(el, assets, initial, onChange, { compact = false } = {}) {
  let draft = { ...DEFAULT_AVATAR, ...initial };
  const swatch = (m, k) => assets.palettes[m].colors[k][Math.min(3, assets.palettes[m].colors[k].length - 1)];
  const cloth = Object.keys(assets.palettes.cloth.colors);
  const chips = (label, key, options) => `<div class="opt-group"><div class="label">${label}</div><div class="chips">${options.map(([v, t]) =>
    `<button type="button" class="chip-btn" data-key="${key}" data-val="${v}" aria-pressed="${draft[key] === v}">${t}</button>`).join('')}</div></div>`;
  const swatches = (label, key, material, keys) => `<div class="opt-group"><div class="label">${label}</div><div class="swatches">${keys.map((k) =>
    `<button type="button" data-key="${key}" data-val="${k}" title="${pretty(k)}" aria-label="${label}: ${pretty(k)}" aria-pressed="${draft[key] === k}" style="background:${swatch(material, k)}"></button>`).join('')}</div></div>`;
  const parts = (slot, names) => assets.catalog.slots[slot].filter((p) => p.paths[draft.body]).map((p) => [p.id, names[p.id] || pretty(p.id)]);

  function render() {
    el.innerHTML = [
      chips('Body type', 'body', [['male', 'Broad'], ['female', 'Slim']]),
      swatches('Skin tone', 'skin', 'body', SKINS),
      chips('Hairstyle', 'hair', parts('hair', HAIR_NAMES)),
      swatches('Hair color', 'hairColor', 'hair', Object.keys(assets.palettes.hair.colors)),
      compact ? '' : swatches('Eye color', 'eyes', 'eye', Object.keys(assets.palettes.eye.colors)),
      chips('Top', 'shirt', parts('shirt', PART_NAMES)),
      swatches('Top color', 'shirtColor', 'cloth', cloth),
      chips('Bottoms', 'legs', parts('legs', PART_NAMES)),
      swatches('Bottoms color', 'legsColor', 'cloth', cloth),
      compact ? '' : swatches('Shoes', 'shoesColor', 'cloth', cloth),
      `<div class="opt-group"><div class="label">T1D gear</div><div class="toggle-row">
        <label class="check"><input type="checkbox" data-gear="cgm" ${draft.t1d.cgm ? 'checked' : ''}> CGM sensor</label>
        <label class="check"><input type="checkbox" data-gear="pump" ${draft.t1d.pump ? 'checked' : ''}> Insulin pump</label></div></div>`,
    ].join('');
    el.querySelectorAll('[data-key]').forEach((b) => b.addEventListener('click', () => {
      draft = { ...draft, [b.dataset.key]: b.dataset.val };
      render(); onChange(draft);
    }));
    el.querySelectorAll('[data-gear]').forEach((c) => c.addEventListener('change', () => {
      draft = { ...draft, t1d: { ...draft.t1d, [c.dataset.gear]: c.checked } };
      onChange(draft);
    }));
  }
  render();
  return { get avatar() { return draft; } };
}
