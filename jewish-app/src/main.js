import { load, get, save, onChange } from './lib/store.js';
import { applyTheme } from './lib/theme.js';
import { h, $, layerCount, hasPages, openLayer, icon, compassIcon, tabIcon, backPress, swipeNav } from './ui.js';
import { App as CapApp } from '@capacitor/app';
import { setRender, ctx, commit, nav } from './core.js';
import { today, nextZman, countdown, shiftDay, resetDay } from './screens/today.js';
import { learn } from './screens/learn.js';
import { times, shiftTimesDay } from './screens/times.js';
import { journal, shiftMonth, consumeSelDrag } from './screens/journal.js';
import { settingsMain } from './screens/settings.js';
import { firstRun, openCompass } from './screens/extras.js';
import { syncNow, takeDone, setWidget, setDone } from './lib/native.js';
import { dueTracks, getEntry, setEntry, addTemplate } from './lib/tracks.js';
import { hhmm, hebrewDate, hebrewDayLetter, WD_LETTER, dkey, addDays } from './lib/dates.js';
import { buildInstances, instTitle } from './lib/alarms.js';

load();
// תצוגה מקדימה בדפדפן: נתוני דוגמה (ערכת חת״ת) כדי שהמסך הראשי לא יהיה ריק
if (window.__PREVIEW && !get().tracks.length) { addTemplate(get(), 'chitas'); get().first = false; }
const TABS = [['today', 'היום'], ['times', 'זמנים\nוהתראות'], ['learn', 'לימוד\nומסלולים'], ['journal', 'יומן\nומעקב']];
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
  const bar = h('div', { class: 'tabbar' }, TABS.map(([k, l]) => h('button', { class: 'tab' + (k === tab ? ' on' : ''), onclick: () => goTab(k) }, h('span', { class: 'ic' }, tabIcon(k)), h('span', { class: 'lbl' }, l.split('\n').flatMap((x, i) => (i ? [h('br'), h('span', { class: 'l2' }, x)] : [h('span', { class: 'l1' }, x)]))))));
  // החלקה ימינה = הבא, שמאלה = הקודם (כיוון עברית): יום במסך היום ובזמנים, חודש ביומן
  if (tab === 'today') swipeNav(main, (d) => shiftDay(d));
  else if (tab === 'times') swipeNav(main, (d) => shiftTimesDay(d));
  else if (tab === 'journal') swipeNav(main, (d) => { if (consumeSelDrag()) return; shiftMonth(d); });
  app.replaceChildren(top, main, bar);
  mainEl = main;
  main.scrollTop = sc;
}
// מעבר בין לשוניות לא נרשם בהיסטוריה: כפתור "חזרה" של המכשיר חוזר ישר ל"היום", ומשם יוצא
function goTab(k) {
  if (k !== tab) { tab = k; if (mainEl) mainEl.scrollTop = 0; }
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
    let al = null;
    try { al = buildInstances(c.st, c.now, 3, 40)[0] || null; } catch (e) { /* */ }
    const events = (nz ? 'הזמן הבא: ' + nz.name + ' ' + hhmm(nz.t, c.loc.tz) + ' · בעוד ' + countdown(nz.t - c.now) : '') + (al ? '\nהתראה: ' + instTitle(al) + ' ' + hhmm(new Date(al.t)) : '');
    // 62 ימים קדימה: תאריך עברי לווידג'ט (מתעדכן בחצות גם כשהאפליקציה סגורה)
    const dates = [];
    for (let i = 0; i < 62; i++) {
      const d = addDays(c.now, i);
      const parts = hebrewDate(d).split(' ');
      const letter = hebrewDayLetter(d);
      dates.push({ k: dkey(d), wd: 'יום ' + WD_LETTER[d.getDay()] + '׳', d: letter.length <= 2 ? letter.replace('׳', '') : letter, m: parts.slice(1, -1).join(' '), y: parts[parts.length - 1] });
    }
    setWidget(events, due.length ? 'נשאר ללמוד: ' + due.map((t) => t.name).slice(0, 5).join(', ') : 'כל הלימוד של היום הושלם', dates);
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
    if (resetDay()) return;
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
