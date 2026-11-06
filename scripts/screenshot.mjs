// Headless-Chrome screenshot + console capture for QA evidence.
// Usage: node scripts/screenshot.mjs <url> <out.png> [width] [height] [waitMs] [keys]
//   keys: optional comma list of "key:ms" presses, e.g. "d:800,s:400,e:100"
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [url, out, w = '1280', h = '800', wait = '2500', keys = ''] = process.argv.slice(2);
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-shot-'));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${w},${h}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled') logs.push(`[${m.params.type}] ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
  if (m.method === 'Runtime.exceptionThrown') logs.push(`[exception] ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`);
  if (m.method === 'Log.entryAdded') logs.push(`[${m.params.entry.level}] ${m.params.entry.text} ${m.params.entry.url || ''}`);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: false });
// SHOT_KEY: sign in as an owner first (key goes in localStorage, never in the URL).
if (process.env.SHOT_KEY) {
  await send('Page.navigate', { url: new URL('/game/setup.html', url).href });
  await sleep(800);
  await send('Runtime.evaluate', { expression: `localStorage.setItem('sugar-valley-key', ${JSON.stringify(process.env.SHOT_KEY)})` });
}
await send('Page.navigate', { url });
await sleep(+wait);
for (const k of keys.split(',').filter(Boolean)) {
  const [key, ms] = k.split(':');
  const code = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', enter: 'Enter', esc: 'Escape' }[key] || `Key${key.toUpperCase()}`;
  const keyName = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', enter: 'Enter', esc: 'Escape' }[key] || key;
  const kc = { up: 38, down: 40, left: 37, right: 39, enter: 13, esc: 27 }[key] || key.toUpperCase().charCodeAt(0);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code, windowsVirtualKeyCode: kc });
  await sleep(+ms || 100);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: kc });
  await sleep(150);
}
await sleep(400);
// SHOT_EVAL: an expression to evaluate in the page before the screenshot (debugging).
if (process.env.SHOT_EVAL) {
  const r = await send('Runtime.evaluate', { expression: process.env.SHOT_EVAL, returnByValue: true });
  logs.push(`[eval] ${JSON.stringify(r.result?.value ?? r.exceptionDetails?.text)}`);
}
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log(logs.join('\n') || '(no console output)');
ws.close(); chrome.kill();
try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* chrome may hold files briefly */ }
