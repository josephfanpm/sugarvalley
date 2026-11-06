// Publishes one owner's CGM readings for the static prototype (GitHub Pages).
// Runs in a scheduled GitHub Action. The Dexcom login comes only from environment variables
// (repo secrets) and is never written, logged, or published: the output holds readings only.
//
//   DEXCOM_USERNAME, DEXCOM_PASSWORD, DEXCOM_REGION (us | ous | jp)   — required, from secrets
//   node scripts/publish-readings.mjs <data-dir> [--minutes N] [--every S]
//
// <data-dir> is a checkout of the `data` branch. readings.json there keeps its { name, unit,
// thresholds } and gains new readings (14 days kept). With --minutes, it keeps polling and
// pushes each change, so one Action run covers the gap until the next scheduled run.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fetchReadings, normalizeConfig } from '../server/connectors/dexcom.js';

const args = process.argv.slice(2);
const dir = args[0];
const opt = (name, d) => { const i = args.indexOf(`--${name}`); return i > 0 ? Number(args[i + 1]) : d; };
const minutes = opt('minutes', 0), every = opt('every', 150);
const KEEP_MS = 14 * 24 * 3_600_000;
const file = path.join(dir, 'readings.json');

let cfg;
try {
  cfg = normalizeConfig({ username: process.env.DEXCOM_USERNAME, password: process.env.DEXCOM_PASSWORD, region: process.env.DEXCOM_REGION || 'us' });
} catch (e) { console.error(e.message); process.exit(1); }

const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
const cache = {}; // Dexcom session id lives here, in memory only

async function once() {
  const doc = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { readings: [] };
  // Display settings are public (they're on the page anyway): name and unit from the workflow
  doc.name = process.env.SV_NAME || doc.name || 'Your friend';
  doc.unit = process.env.SV_UNIT || doc.unit || 'mgdl';
  let fresh;
  try { fresh = await fetchReadings(cfg, cache); } catch (e) {
    console.error(`Dexcom: ${e.message}`); // connector messages never include credentials
    if (e.auth) process.exit(1); // wrong login: stop instead of locking the account
    return;
  }
  const byTs = new Map(doc.readings.map((r) => [r[0], r]));
  for (const r of fresh) byTs.set(r.ts, [r.ts, Math.round(r.mgdl), r.trend ?? null]);
  const cutoff = Date.now() - KEEP_MS;
  const readings = [...byTs.values()].filter((r) => r[0] >= cutoff).sort((a, b) => a[0] - b[0]);
  const latest = readings.at(-1)?.[0];
  if (latest === doc.readings.at(-1)?.[0] && readings.length === doc.readings.length) { console.log('No new readings.'); return; }
  fs.writeFileSync(file, JSON.stringify({ name: doc.name, unit: doc.unit, thresholds: doc.thresholds, updated: Date.now(), readings }));
  // One commit on an orphan branch, replaced each time, so the branch never grows.
  git('add', 'readings.json');
  let first = false;
  try { git('rev-parse', '--verify', 'HEAD'); } catch { first = true; }
  git('commit', ...(first ? ['-m', 'Prototype readings'] : ['--amend', '--no-edit', '--date', new Date().toISOString()]), '--quiet');
  git('push', '--force', '--quiet', 'origin', 'HEAD:data');
  console.log(`Published ${readings.length} readings, latest ${new Date(latest).toISOString()}.`);
}

const end = Date.now() + minutes * 60_000;
for (;;) {
  await once();
  if (Date.now() + every * 1000 > end) break;
  await new Promise((r) => setTimeout(r, every * 1000));
}
