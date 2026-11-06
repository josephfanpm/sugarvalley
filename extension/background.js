// Service worker: keeps the toolbar badge showing the latest reading.
// It only asks our backend (never the CGM provider), so it's cheap and works with any source.
import { api, session } from './lib/api.js';
import { stateOf, formatBg } from './shared/glucose.js';

const COLORS = { in_range: '#2f9e44', low: '#e8590c', high: '#7048e8', urgent_low: '#e03131', urgent_high: '#e03131', stale: '#868e96', no_data: '#868e96' };

async function refresh() {
  const { apiKey } = await session();
  if (!apiKey) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  try {
    const g = await api('GET', '/api/me/glucose');
    const state = stateOf(g.latest, Date.now(), g.thresholds);
    const text = !g.latest ? '' : state === 'stale' ? '…' : formatBg(g.latest.mgdl, g.unit).split(' ')[0];
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color: COLORS[state] });
    await chrome.action.setBadgeTextColor?.({ color: '#ffffff' });
    await chrome.action.setTitle({ title: g.latest ? `Sugar Peek: ${formatBg(g.latest.mgdl, g.unit)}` : 'Sugar Peek' });
  } catch {
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#868e96' });
  }
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  chrome.alarms.create('refresh', { periodInMinutes: 1 });
  if (reason === 'install') chrome.runtime.openOptionsPage();
  refresh();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('refresh', { periodInMinutes: 1 });
  refresh();
});
chrome.alarms.onAlarm.addListener((a) => a.name === 'refresh' && refresh());
chrome.runtime.onMessage.addListener((msg) => { if (msg?.type === 'refresh') refresh(); });
