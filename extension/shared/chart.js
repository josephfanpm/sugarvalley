// Scrollable 12-hour glucose chart with grid lines, the owner's ranges, and tap/hover readouts.
// The visible window is 3 hours; viewers scroll (drag, swipe, trackpad, or the arrow buttons)
// back through the last 12. Pure SVG + DOM, no dependencies.
import { rangeOf, toUnit, unitLabel, DEFAULT_THRESHOLDS } from './glucose.js';

const HOUR = 3_600_000;
const SPAN = 12 * HOUR, WINDOW = 3 * HOUR;
const PLOT_H = 132, AXIS_H = 20, YAXIS_W = 36;
const COLORS = { urgent_low: 'var(--c-urgent)', low: 'var(--c-low)', in_range: 'var(--c-ok)', high: 'var(--c-high)', urgent_high: 'var(--c-urgent)' };
const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const fmtHour = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric' });

export function mountChart(root) {
  root.innerHTML = `
    <div class="chart">
      <div class="chart-head">
        <span class="chart-title">Last 12 hours</span>
        <span class="chart-tir"></span>
        <span class="chart-nav">
          <button type="button" class="chart-btn" data-step="-1" aria-label="Earlier">‹</button>
          <button type="button" class="chart-btn" data-step="1" aria-label="Later">›</button>
        </span>
      </div>
      <div class="chart-body">
        <svg class="chart-y" width="${YAXIS_W}" height="${PLOT_H + AXIS_H}" aria-hidden="true"></svg>
        <div class="chart-scroll" tabindex="0" aria-label="Blood sugar graph, scroll for earlier readings">
          <svg class="chart-plot" height="${PLOT_H + AXIS_H}"></svg>
        </div>
      </div>
      <div class="chart-tip" hidden></div>
    </div>`;
  const scroller = root.querySelector('.chart-scroll');
  const plot = root.querySelector('.chart-plot');
  const yAxis = root.querySelector('.chart-y');
  const tip = root.querySelector('.chart-tip');
  let state = null, geom = null, pinnedRight = true;

  scroller.addEventListener('scroll', () => {
    pinnedRight = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 4;
    tip.hidden = true;
  });
  root.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    scroller.scrollBy({ left: Number(b.dataset.step) * scroller.clientWidth * 0.66, behavior: 'smooth' });
  }));

  // drag to scroll with a mouse (touch and trackpads scroll natively)
  let drag = null;
  scroller.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') drag = { x: e.clientX, left: scroller.scrollLeft, moved: false }; });
  window.addEventListener('pointerup', () => { drag = null; });
  scroller.addEventListener('pointermove', (e) => {
    if (drag) {
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 3) drag.moved = true;
      scroller.scrollLeft = drag.left - dx;
    }
    showTip(e);
  });
  scroller.addEventListener('pointerleave', () => { if (!drag) tip.hidden = true; });
  scroller.addEventListener('click', showTip);

  function showTip(e) {
    if (!geom || !state?.points.length) return;
    const rect = plot.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ts = geom.start + (x / geom.width) * SPAN;
    let best = null;
    for (const p of state.points) if (!best || Math.abs(p.ts - ts) < Math.abs(best.ts - ts)) best = p;
    if (!best || Math.abs(best.ts - ts) > 20 * 60_000) { tip.hidden = true; return; }
    const px = geom.x(best.ts), py = geom.y(best.mgdl);
    plot.querySelector('.chart-cursor')?.remove();
    plot.insertAdjacentHTML('beforeend', `<g class="chart-cursor"><line x1="${px}" x2="${px}" y1="0" y2="${PLOT_H}"/><circle cx="${px}" cy="${py}" r="4.5" fill="${COLORS[rangeOf(best.mgdl, state.thresholds)]}"/></g>`);
    tip.innerHTML = `<strong>${toUnit(best.mgdl, state.unit)}</strong> ${unitLabel(state.unit)} · ${fmtTime(best.ts)}`;
    tip.hidden = false;
    const host = root.querySelector('.chart').getBoundingClientRect();
    const left = Math.min(Math.max(rect.left + px - host.left - tip.offsetWidth / 2, 4), host.width - tip.offsetWidth - 4);
    tip.style.left = `${left}px`;
  }

  function render({ points, thresholds = DEFAULT_THRESHOLDS, unit = 'mgdl', now = Date.now() }) {
    state = { points: points.filter((p) => p.ts >= now - SPAN).sort((a, b) => a.ts - b.ts), thresholds, unit };
    const viewW = Math.max(160, scroller.clientWidth || 280);
    const width = Math.round(viewW * (SPAN / WINDOW));
    const start = now - SPAN;
    const maxV = Math.max(300, ...state.points.map((p) => p.mgdl + 20));
    const lo = 40, hi = Math.min(400, Math.ceil(maxV / 50) * 50);
    const x = (ts) => +(((ts - start) / SPAN) * (width - 8) + 4).toFixed(1);
    const y = (v) => +(PLOT_H - 4 - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (PLOT_H - 8)).toFixed(1);
    geom = { start, width, x, y };

    // horizontal grid in the owner's unit
    const steps = unit === 'mmol' ? [3, 6, 9, 12, 15, 18, 21].map((m) => m * 18.0182) : [50, 100, 150, 200, 250, 300, 350, 400];
    const gridY = steps.filter((v) => v > lo && v < hi);
    const hLines = gridY.map((v) => `<line class="grid" x1="0" x2="${width}" y1="${y(v)}" y2="${y(v)}"/>`).join('');
    yAxis.innerHTML = gridY.map((v) => `<text x="${YAXIS_W - 6}" y="${y(v) + 4}" text-anchor="end">${toUnit(v, unit)}</text>`).join('') +
      `<text x="${YAXIS_W - 6}" y="${PLOT_H + 14}" text-anchor="end" class="unit">${unit === 'mmol' ? 'mmol' : 'mg/dL'}</text>`;

    // vertical grid: every 30 minutes, labelled on the hour
    let vLines = '', labels = '';
    for (let t = Math.ceil(start / (HOUR / 2)) * (HOUR / 2); t <= now; t += HOUR / 2) {
      const onHour = new Date(t).getMinutes() === 0;
      vLines += `<line class="${onHour ? 'grid' : 'grid minor'}" x1="${x(t)}" x2="${x(t)}" y1="0" y2="${PLOT_H}"/>`;
      if (onHour) labels += `<text x="${x(t)}" y="${PLOT_H + 14}" text-anchor="middle">${fmtHour(t)}</text>`;
    }

    const t = thresholds;
    const band = `<rect class="band" x="0" width="${width}" y="${y(t.high)}" height="${y(t.low) - y(t.high)}"/>`;
    const limits = [t.low, t.high].map((v) => `<line class="limit" x1="0" x2="${width}" y1="${y(v)}" y2="${y(v)}"/>`).join('') +
      [t.urgentLow, t.urgentHigh].map((v) => `<line class="limit urgent" x1="0" x2="${width}" y1="${y(v)}" y2="${y(v)}"/>`).join('');

    // line, broken across gaps longer than 15 minutes
    let path = '', prev = null;
    for (const p of state.points) {
      path += `${!prev || p.ts - prev.ts > 15 * 60_000 ? 'M' : 'L'}${x(p.ts)},${y(p.mgdl)} `;
      prev = p;
    }
    const dots = state.points.map((p) => `<circle cx="${x(p.ts)}" cy="${y(p.mgdl)}" r="2.6" fill="${COLORS[rangeOf(p.mgdl, t)]}"/>`).join('');
    const nowLine = `<line class="now" x1="${x(now)}" x2="${x(now)}" y1="0" y2="${PLOT_H}"/>`;

    plot.setAttribute('width', width);
    plot.setAttribute('viewBox', `0 0 ${width} ${PLOT_H + AXIS_H}`);
    plot.innerHTML = `${band}${hLines}${vLines}${limits}${nowLine}<path class="line" d="${path}"/>${dots}<g class="xlabels">${labels}</g>`;

    const inRange = state.points.filter((p) => rangeOf(p.mgdl, t) === 'in_range').length;
    root.querySelector('.chart-tir').textContent = state.points.length ? `${Math.round((inRange / state.points.length) * 100)}% in range` : 'No readings yet';
    tip.hidden = true;
    if (pinnedRight) scroller.scrollLeft = scroller.scrollWidth;
  }

  return { render };
}
