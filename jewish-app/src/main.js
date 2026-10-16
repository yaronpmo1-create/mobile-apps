import { load, get, save, onChange } from './lib/store.js';
import { applyTheme } from './lib/theme.js';
import { h, $, layerCount, hasPages } from './ui.js';
import { setRender, ctx, commit, nav } from './core.js';
import { today, nextZman, countdown } from './screens/today.js';
import { learn } from './screens/learn.js';
import { times } from './screens/times.js';
import { journal } from './screens/journal.js';
import { settingsMain } from './screens/settings.js';
import { firstRun } from './screens/extras.js';
import { syncNow, takeDone, setWidget, setDone } from './lib/native.js';
import { dueTracks, getEntry, setEntry } from './lib/tracks.js';
import { hhmm } from './lib/dates.js';

load();
const TABS = [['today', 'היום', '◉'], ['learn', 'לימוד', '☰'], ['times', 'זמנים', '◔'], ['journal', 'יומן', '▦']];
const TITLES = { today: 'אפליקציה יהודית', learn: 'המסלולים שלי', times: 'זמנים והתראות', journal: 'יומן' };
const SCREENS = { today, learn, times, journal };
let tab = 'today';
const app = document.getElementById('app');
let mainEl = null;

function render() {
  const st = get();
  applyTheme(st.settings, tab);
  const sc = mainEl ? mainEl.scrollTop : 0;
  const top = h('div', { class: 'top' }, h('h1', null, TITLES[tab]), h('button', { class: 'iconbtn', 'aria-label': 'הגדרות', onclick: () => settingsMain() }, '⚙'));
  let body;
  try { body = SCREENS[tab](); } catch (e) { body = h('pre', { style: 'white-space:pre-wrap;color:var(--bad)' }, 'שגיאה: ' + e.message + '\n' + (e.stack || '')); console.error(e); }
  const main = h('div', { class: 'main' }, body);
  const bar = h('div', { class: 'tabbar' }, TABS.map(([k, l, ic]) => h('button', { class: 'tab' + (k === tab ? ' on' : ''), onclick: () => goTab(k) }, h('span', { class: 'ic' }, ic), l)));
  app.replaceChildren(top, main, bar);
  mainEl = main;
  main.scrollTop = sc;
}
function goTab(k) { if (k !== tab) { tab = k; if (mainEl) mainEl.scrollTop = 0; } nav.tab = tab; render(); }
nav.goTab = goTab;
setRender(render);

// קליטת סימונים שנעשו מההתראה ("למדתי")
async function intake() {
  const items = await takeDone();
  if (!items || !items.length) return;
  const c = ctx();
  for (const it of items) {
    const [dk, tid] = String(it).split('|');
    const t = c.st.tracks.find((x) => x.id === tid);
    if (t && !getEntry(c.st, dk, tid)) setEntry(c.st, dk, t, 'done', c.tk);
  }
  commit();
}
function pushWidget() {
  try {
    const c = ctx();
    const nz = nextZman(c);
    const due = dueTracks(c.st, c.tk).filter((t) => { const e = getEntry(c.st, c.tk, t.id); return !e; });
    setWidget(nz ? nz.name + ' ' + hhmm(nz.t, c.loc.tz) + ' · בעוד ' + countdown(nz.t - c.now) : '', due.length ? 'נשאר ללמוד: ' + due.map((t) => t.name).slice(0, 4).join(', ') : 'כל הלימוד של היום הושלם');
  } catch (e) { /* */ }
}

document.addEventListener('visibilitychange', () => { if (!document.hidden) { intake().then(() => { render(); syncNow(); pushWidget(); }); } });
setInterval(() => { if (!document.hidden && !hasPages() && layerCount() === 0 && (tab === 'today' || tab === 'times')) render(); }, 60000);
setInterval(pushWidget, 15 * 60000);
try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render); } catch (e) { /* */ }

// כפתור "חזרה" בבסיס: אם אין שכבות פתוחות והלשונית אינה "היום" - חוזרים להיום
history.replaceState({ base: 1 }, '');

render();
if (get().first) setTimeout(() => firstRun(() => { render(); }), 50);
intake().then(() => { syncNow(); pushWidget(); });
window.__app = { get, render, goTab, ctx, commit };
