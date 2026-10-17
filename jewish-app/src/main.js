import { load, get, save, onChange } from './lib/store.js';
import { applyTheme } from './lib/theme.js';
import { h, $, layerCount, hasPages, openLayer, icon, compassIcon, backPress } from './ui.js';
import { App as CapApp } from '@capacitor/app';
import { setRender, ctx, commit, nav } from './core.js';
import { today, nextZman, countdown } from './screens/today.js';
import { learn } from './screens/learn.js';
import { times } from './screens/times.js';
import { journal, shiftMonth } from './screens/journal.js';
import { settingsMain } from './screens/settings.js';
import { firstRun, openCompass } from './screens/extras.js';
import { syncNow, takeDone, setWidget, setDone } from './lib/native.js';
import { dueTracks, getEntry, setEntry, addTemplate } from './lib/tracks.js';
import { hhmm } from './lib/dates.js';

load();
// תצוגה מקדימה בדפדפן: נתוני דוגמה (ערכת חת״ת) כדי שהמסך הראשי לא יהיה ריק
if (window.__PREVIEW && !get().tracks.length) { addTemplate(get(), 'chitas'); get().first = false; }
const TABS = [['today', 'היום', '◉'], ['times', 'זמנים והתראות', '◔'], ['learn', 'לימוד ומסלולים', '☰'], ['journal', 'יומן ומעקב', '▦']];
const TITLES = { today: 'אפליקציה יהודית', learn: 'לימוד ומסלולים', times: 'זמנים והתראות', journal: 'יומן ומעקב' };
const SCREENS = { today, learn, times, journal };
let tab = 'today';
const app = document.getElementById('app');
let mainEl = null;

function render() {
  const st = get();
  applyTheme(st.settings, tab);
  const sc = mainEl ? mainEl.scrollTop : 0;
  const top = h('div', { class: 'top' }, h('h1', null, TITLES[tab]), h('div', { style: 'display:flex;gap:2px' }, h('button', { class: 'iconbtn', style: 'color:var(--accent)', 'aria-label': 'מצפן לבית המקדש', onclick: () => openCompass() }, compassIcon(30)), h('button', { class: 'iconbtn', 'aria-label': 'הגדרות', onclick: () => settingsMain() }, '⚙')));
  let body;
  try { body = SCREENS[tab](); } catch (e) { body = h('pre', { style: 'white-space:pre-wrap;color:var(--bad)' }, 'שגיאה: ' + e.message + '\n' + (e.stack || '')); console.error(e); }
  const main = h('div', { class: 'main' }, body);
  const bar = h('div', { class: 'tabbar' }, TABS.map(([k, l, ic]) => h('button', { class: 'tab' + (k === tab ? ' on' : ''), onclick: () => goTab(k) }, h('span', { class: 'ic' }, ic), l)));
  if (tab === 'journal') {
    // החלקה ימינה = חודש הבא, שמאלה = חודש קודם (כיוון עברית)
    let sx = 0, sy = 0;
    main.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    main.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 70 && Math.abs(dy) < 50) shiftMonth(dx > 0 ? 1 : -1);
    }, { passive: true });
  }
  app.replaceChildren(top, main, bar);
  mainEl = main;
  main.scrollTop = sc;
}
// כל מעבר בין לשוניות נרשם בהיסטוריה, כך שכפתור "חזרה" של המכשיר חוזר ללשונית הקודמת ולא יוצא
function goTab(k) {
  if (k !== tab) {
    const prev = tab;
    openLayer(() => { tab = prev; nav.tab = tab; if (mainEl) mainEl.scrollTop = 0; render(); });
    tab = k; if (mainEl) mainEl.scrollTop = 0;
  }
  nav.tab = tab; render();
}
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
setInterval(() => { if (!document.hidden && !hasPages() && (tab === 'today' || tab === 'times')) render(); }, 60000);
setInterval(pushWidget, 15 * 60000);
try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render); } catch (e) { /* */ }

// כפתור "חזרה" בבסיס: אם אין שכבות פתוחות והלשונית אינה "היום" - חוזרים להיום
history.replaceState({ base: 1 }, '');

render();
// כפתור "חזרה" של המכשיר: סוגר שכבה פתוחה או חוזר ללשונית הקודמת; רק במסך הראשי יוצאים מהאפליקציה
try {
  CapApp.addListener('backButton', () => {
    if (backPress()) return;
    if (tab !== 'today') { goTab('today'); return; }
    CapApp.exitApp();
  });
} catch (e) { /* בדפדפן אין */ }

// מסך פתיחה: מוצג זמן קבוע ומתייצב לפני שהמסך הראשי ("היום") נחשף
const splash = document.getElementById('splash');
const showApp = () => {
  document.body.classList.add('ready');
  if (splash) { splash.classList.add('out'); setTimeout(() => splash.remove(), 450); }
};
setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(showApp)), 1700);
if (get().first) setTimeout(() => firstRun(() => { render(); }), 2300);
intake().then(() => { syncNow(); pushWidget(); });
window.__app = { get, render, goTab, ctx, commit };
