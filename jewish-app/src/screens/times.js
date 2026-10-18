import { hebrewDayMonth } from '../lib/dates.js';
import { hebDate, navBar, h, openPage, openSheet, actionSheet, confirmBox, seg, chips, field, sel, txt, toggle, toast } from '../ui.js';
import { ctx, commit, nav } from '../core.js';
import { ZMAN_DEFS, zmanimFor, zmanName, METHODS, timedOn, dayEvents, parshaOfWeek, isRestDay } from '../lib/zm.js';
import { hhmm, weekdayName, hebrewDate, addDays, dkey, parseKey, WD_LETTER } from '../lib/dates.js';
import { hebrewMonthAnchor, hebrewMonthDays, hebrewMonthYear } from '../lib/dates.js';
import { newAlarm, ALARM_TEMPLATES, alarmTitle, daysLabel, REL, buildInstances } from '../lib/alarms.js';
import { activeTracks } from '../lib/tracks.js';
import { shareText, testAlarm } from '../lib/native.js';
import { openCompass } from './extras.js';

let view = 'day';
let offset = 0;
let weekOff = 0;
export function shiftTimesDay(delta) { if (view !== 'day') return false; offset += delta; commit(); return true; }

export function times() {
  const c = ctx();
  const root = h('div', null);
  root.appendChild(h('div', { class: 'inline', style: 'margin-bottom:6px' },
    h('div', { style: 'flex:3' }, seg([['day', 'היום'], ['week', 'שבוע'], ['month', 'חודש']], view === 'alarms' ? '' : view, (v) => { view = v; commit(); })),
    h('button', { class: view === 'alarms' ? 'btn' : 'btn sec', style: 'flex:1;margin-bottom:8px', onclick: () => { view = 'alarms'; commit(); } }, 'התראות')));
  if (view === 'alarms') { root.appendChild(alarmsView(c)); return root; }
  if (view === 'day') root.appendChild(dayView(c));
  else if (view === 'week') root.appendChild(weekView(c));
  else root.appendChild(monthView(c));
  return root;
}

function zmanLines(c, d) {
  const z = zmanimFor(d, c.loc, c.s.method, c.s.tzeitMode);
  return ZMAN_DEFS.map((def) => ({ id: def.id, name: def.name, t: z[def.id] })).filter((x) => x.t);
}

function dayView(c) {
  const d = addDays(c.today, offset);
  const root = h('div', null);
  root.appendChild(navBar(h('div', { style: 'text-align:center' }, h('b', null, weekdayName(d)), h('div', { class: 'muted small' }, hebrewDate(d))), () => { offset--; commit(); }, () => { offset++; commit(); }));
  if (offset) root.appendChild(h('button', { class: 'btn ghost sm block', style: 'margin-bottom:8px', onclick: () => { offset = 0; commit(); } }, 'חזרה להיום'));
  root.appendChild(h('div', { class: 'h-sub' }, c.loc.name + ' · שיטת ' + METHODS[c.s.method]));
  const ev = dayEvents(d, c.loc, c.s);
  if (d.getDay() === 6) { const p = parshaOfWeek(d, c.loc, c.s); if (p) ev.unshift('פרשת ' + p); }
  if (ev.length) root.appendChild(h('div', { class: 'h-sub' }, ev.join(' · ')));
  const tt = timedOn(d, c.loc, c.s);
  const lines = zmanLines(c, d);
  let nextIdx = offset === 0 ? lines.findIndex((l) => l.t > c.now) : -1;
  const list = h('div', { class: 'list' });
  if (tt.candles) list.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow t' }, 'הדלקת נרות'), h('div', { class: 'ztime' }, hhmm(tt.candles, c.loc.tz))));
  lines.forEach((l, i) => {
    const alarms = c.st.alarms.filter((a) => a.enabled && a.type === 'zman' && a.zman === l.id);
    list.appendChild(h('div', { class: 'row tap' + (offset === 0 && l.t < c.now ? ' past' : '') + (i === nextIdx ? ' next' : ''), onclick: () => quickAlarm(l) },
      h('div', { class: 'grow' }, h('div', { class: 't' }, l.name), alarms.length ? h('div', { class: 's' }, 'התראה: ' + alarms.map((a) => (a.rel === 'at' ? 'בזמן' : a.mins + ' דק׳ ' + REL[a.rel])).join(', ')) : null),
      h('div', { class: 'ztime' }, hhmm(l.t, c.loc.tz))));
  });
  if (tt.havdalah) list.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow t' }, 'הבדלה'), h('div', { class: 'ztime' }, hhmm(tt.havdalah, c.loc.tz))));
  root.appendChild(list);
  root.appendChild(h('p', { class: 'dim small', style: 'text-align:center' }, 'לחיצה על זמן: הוספת התראה'));
  root.appendChild(h('div', { class: 'inline' },
    h('button', { class: 'btn sec', onclick: async () => { const r = await shareText('זמני היום', dayText(c, d)); if (r === 'copied') toast('הזמנים הועתקו ללוח'); } }, 'שיתוף זמנים')));
  return root;
}
function dayText(c, d) {
  return weekdayName(d) + ' ' + hebrewDate(d) + ' · ' + c.loc.name + '\n' + zmanLines(c, d).map((l) => l.name + ': ' + hhmm(l.t, c.loc.tz)).join('\n');
}

function weekView(c) {
  const cols = ['alot', 'netz', 'shma', 'tfila', 'chatzot', 'gedola', 'plag', 'shkiah', 'tzeit'];
  const start = addDays(c.today, weekOff * 7);
  const root = h('div', null);
  root.appendChild(navBar(h('div', { style: 'text-align:center' }, h('b', null, hebrewDayMonth(start) + ' - ' + hebrewDayMonth(addDays(start, 6))), h('div', { class: 'muted small' }, '7 ימים מהיום · ' + c.loc.name + ' · ' + METHODS[c.s.method])), () => { weekOff--; commit(); }, () => { weekOff++; commit(); }));
  if (weekOff) root.appendChild(h('button', { class: 'btn ghost sm block', style: 'margin-bottom:8px', onclick: () => { weekOff = 0; commit(); } }, 'חזרה להיום'));
  const names = (id) => ZMAN_DEFS.find((z) => z.id === id).name;
  const tbl = h('table', { class: 'wk' }, h('thead', null, h('tr', null, h('th', null, 'יום'), cols.map((id) => h('th', null, names(id))))),
    h('tbody', null, [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d = addDays(start, i), z = zmanimFor(d, c.loc, c.s.method, c.s.tzeitMode);
      return h('tr', { style: dkey(d) === c.tk ? 'color:var(--accent);font-weight:700' : '' }, h('td', null, WD_LETTER[d.getDay()] + '׳ ' + hebrewDayMonth(d)), cols.map((id) => h('td', { style: 'direction:ltr' }, hhmm(z[id], c.loc.tz))));
    })));
  root.appendChild(h('div', { class: 'scrollx card' }, tbl));
  root.appendChild(h('button', { class: 'btn sec block', onclick: async () => {
    const txt0 = [0, 1, 2, 3, 4, 5, 6].map((i) => dayText(c, addDays(start, i))).join('\n\n');
    const r = await shareText('זמני השבוע', txt0); if (r === 'copied') toast('הטבלה הועתקה ללוח');
  } }, 'שיתוף זמני השבוע'));
  return root;
}

export function newAlarmSheet() {
  const back = () => newAlarmSheet();
  openSheet('התראה חדשה', (sh) => h('div', null,
    h('button', { class: 'opt', onclick: () => { sh.close(); editAlarm(null, 'fixed', null, back); } }, h('div', null, h('b', null, 'התראה כללית בשעה קבועה'), h('div', { class: 's muted small' }, 'אפשר גם בתאריך מסוים בלבד (כמו אירוע ביומן)'))),
    h('button', { class: 'opt', onclick: () => { sh.close(); editAlarm(null, 'zman', null, back); } }, 'לפי זמן הלכתי (לפני / בזמן / אחרי)'),
    h('button', { class: 'opt', onclick: () => { sh.close(); editAlarm(null, 'learning', null, back); } }, 'תזכורת לימוד (רק אם לא סומן)'),
    h('div', { class: 'section-title' }, 'תבניות מוכנות'),
    ALARM_TEMPLATES.map((t) => h('button', { class: 'opt', onclick: () => { sh.close(); const a = Object.assign(newAlarm(t.a.type), t.a); editAlarm(null, a.type, a, back); } }, t.name))));
}
nav.newAlarm = newAlarmSheet;
nav.timesView = (v) => { view = v; };

let monthOff = 0;
function monthView(c) {
  const cols = ['alot', 'netz', 'shma', 'tfila', 'chatzot', 'shkiah', 'tzeit'];
  const days = Array.from({ length: 30 }, (_, i) => addDays(c.today, monthOff * 30 + i));
  const root = h('div', null);
  root.appendChild(navBar(h('div', { style: 'text-align:center' }, h('b', null, hebrewDayMonth(days[0]) + ' - ' + hebrewDayMonth(days[29])), h('div', { class: 'muted small' }, '30 יום מהיום · ' + c.loc.name + ' · ' + METHODS[c.s.method])), () => { monthOff--; commit(); }, () => { monthOff++; commit(); }));
  if (monthOff) root.appendChild(h('button', { class: 'btn ghost sm block', style: 'margin-bottom:8px', onclick: () => { monthOff = 0; commit(); } }, 'חזרה להיום'));
  const names = (id) => ZMAN_DEFS.find((z) => z.id === id).name;
  const tbl = h('table', { class: 'wk' }, h('thead', null, h('tr', null, h('th', null, 'יום'), cols.map((id) => h('th', null, names(id))))),
    h('tbody', null, days.map((d) => {
      const z = zmanimFor(d, c.loc, c.s.method, c.s.tzeitMode);
      return h('tr', { style: dkey(d) === c.tk ? 'color:var(--accent);font-weight:700' : '' }, h('td', null, WD_LETTER[d.getDay()] + '׳ ' + hebrewDayMonth(d)), cols.map((id) => h('td', { style: 'direction:ltr' }, hhmm(z[id], c.loc.tz))));
    })));
  root.appendChild(h('div', { class: 'scrollx card' }, tbl));
  root.appendChild(h('button', { class: 'btn sec block', onclick: async () => {
    const r = await shareText('זמני החודש', days.map((d) => dayText(c, d)).join('\n\n')); if (r === 'copied') toast('הטבלה הועתקה ללוח');
  } }, 'שיתוף זמני החודש'));
  return root;
}

function alarmsView(c) {
  const root = h('div', null);
  root.appendChild(h('button', { class: 'btn block', style: 'margin-bottom:12px', onclick: () => newAlarmSheet() }, '+ התראה חדשה'));
  if (!c.st.alarms.length) root.appendChild(h('div', { class: 'card empty-note' }, 'אין התראות עדיין. אפשר ללחוץ על זמן במסך הזמנים, או על "התראה חדשה".'));
  const nextAt = {};
  for (const i of buildInstances(c.st, c.now, 14)) { const m = /^A\|([^|]+)\|/.exec(i.id); if (m && !nextAt[m[1]]) nextAt[m[1]] = i.t; }
  const list = h('div', { class: 'list' });
  c.st.alarms.forEach((a) => {
    const nt = nextAt[a.id];
    list.appendChild(h('div', { class: 'row tap', style: a.enabled ? '' : 'opacity:.55', onclick: () => editAlarm(a.id, a.type) },
      h('div', { class: 'grow' }, h('div', { class: 't' }, alarmTitle(a, c.st)),
        h('div', { class: 's' }, daysLabel(a.days, a.date) + (a.type === 'fixed' ? ' · ' + a.time : '') + (nt ? ' · הבאה ' + hhmm(new Date(nt)) : '') + (a.noRest !== false ? ' · לא בשבת וחג' : '') + (a.ring === false ? ' · התראה שקטה' : ''))),
      toggle(a.enabled, (v) => { a.enabled = v; commit(); }),
      h('button', { class: 'iconbtn', onclick: (e) => { e.stopPropagation(); alarmMenu(a); } }, '⋮')));
  });
  if (c.st.alarms.length) root.appendChild(list);
  root.appendChild(h('div', { class: 'section-title' }, 'תזכורות אוטומטיות (ראש חודש, ערב שבת, הדלקת נרות) - בהגדרות'));
  return root;
}
function alarmMenu(a) {
  const c = ctx();
  actionSheet(alarmTitle(a, c.st), [
    { label: 'עריכה', fn: () => editAlarm(a.id, a.type) },
    { label: 'שכפול', fn: () => { const n = JSON.parse(JSON.stringify(a)); n.id = 'a' + Date.now().toString(36); c.st.alarms.push(n); commit(); } },
    { label: 'מחיקה', danger: true, fn: async () => { if (await confirmBox('למחוק את ההתראה?', 'מחיקה', true)) { c.st.alarms = c.st.alarms.filter((x) => x.id !== a.id); commit(); } } },
  ]);
}

// לחיצה על זמן: הצעה מהירה
function quickAlarm(l) {
  const opts = [[30, 'before'], [15, 'before'], [0, 'at'], [10, 'after']];
  openSheet(l.name + ' - הוספת התראה', (sh) => h('div', null,
    opts.map(([m, rel]) => h('button', { class: 'opt', onclick: () => { sh.close(); const a = Object.assign(newAlarm('zman'), { zman: l.id, rel, mins: m }); editAlarm(null, 'zman', a, () => quickAlarm(l)); } }, rel === 'at' ? 'בזמן ' + l.name : m + ' דקות ' + REL[rel] + ' ' + l.name)),
    h('button', { class: 'opt', onclick: () => { sh.close(); const a = Object.assign(newAlarm('zman'), { zman: l.id }); editAlarm(null, 'zman', a, () => quickAlarm(l)); } }, 'התאמה אישית...')));
}

export function editAlarm(id, type, preset, back) {
  let saved = false;
  const c = ctx();
  const orig = id ? c.st.alarms.find((a) => a.id === id) : null;
  const d = JSON.parse(JSON.stringify(orig || preset || newAlarm(type || 'zman')));
  if (!orig && !d.type) d.type = type;
  if (d.type === 'learning') { d.timeMode = d.timeMode || 'time'; if (!d.trackId) { const t = activeTracks(c.st)[0]; d.trackId = t ? t.id : ''; } d.time = d.time || '21:00'; d.ring = d.ring === true; }
  openPage(orig ? 'עריכת התראה' : 'התראה חדשה', (pg) => {
    const root = h('div', null);
    root.appendChild(seg([['zman', 'זמן הלכתי'], ['fixed', 'שעה קבועה'], ['learning', 'תזכורת לימוד']], d.type, (v) => { d.type = v; if (v === 'learning') { d.timeMode = d.timeMode || 'time'; d.ring = false; const t = activeTracks(c.st)[0]; if (!d.trackId && t) d.trackId = t.id; } pg.refresh(); }));
    root.appendChild(field('שם (אופציונלי)', txt(d.label, (v) => (d.label = v), 'למשל: מנחה')));
    const zmanPick = () => h('div', { class: 'inline' },
      field('זמן', sel(ZMAN_DEFS.map((z) => [z.id, z.name]), d.zman, (v) => { d.zman = v; pg.refresh(); })),
      field('יחס', sel(Object.entries(REL), d.rel, (v) => { d.rel = v; pg.refresh(); })),
      d.rel === 'at' ? null : field('דקות', txt(d.mins, (v) => { d.mins = Math.max(0, Number(v) || 0); }, '', 'number')));
    if (d.type === 'zman') root.appendChild(zmanPick());
    if (d.type === 'fixed') root.appendChild(field('שעה', txt(d.time, (v) => (d.time = v), '', 'time')));
    if (d.type === 'learning') {
      root.appendChild(field('מסלול', sel(activeTracks(c.st).map((t) => [t.id, t.name]), d.trackId, (v) => (d.trackId = v))));
      root.appendChild(seg([['time', 'עד שעה'], ['zman', 'יחסית לזמן הלכתי']], d.timeMode, (v) => { d.timeMode = v; pg.refresh(); }));
      if (d.timeMode === 'time') root.appendChild(field('אם לא סומן עד', txt(d.time, (v) => (d.time = v), '', 'time')));
      else root.appendChild(zmanPick());
      root.appendChild(h('p', { class: 'dim small' }, 'מצלצלת/מתריעה רק אם המסלול עדיין לא סומן, ושותקת אם כבר למדת.'));
    } else {
      root.appendChild(h('label', { class: 'f' }, 'תאריך מסוים (לא חובה): ההתראה תפעל רק בו'));
      root.appendChild(h('div', { class: 'inline' },
        d.date ? h('div', { style: 'flex:3' }, hebDate(d.date, (v) => { d.date = v; })) : h('button', { class: 'btn sec', onclick: () => { d.date = c.tk; pg.refresh(); } }, 'קביעת תאריך מסוים'),
        d.date ? h('button', { class: 'btn sec sm', style: 'flex:none', onclick: () => { d.date = ''; pg.refresh(); } }, 'ניקוי תאריך') : null));
      if (!d.date) {
        root.appendChild(h('label', { class: 'f' }, 'ימים'));
        root.appendChild(chips(WD_LETTER.map((l, i) => [i, l]), d.days, (v) => { d.days = d.days.includes(v) ? d.days.filter((x) => x !== v) : d.days.concat(v).sort(); pg.refresh(); }));
      }
    }
    const sw = (label, key, def = true) => h('div', { class: 'row' }, h('div', { class: 'grow' }, label), toggle(d[key] === undefined ? def : d[key], (v) => { d[key] = v; pg.refresh(); }));
    root.appendChild(h('div', { class: 'list' },
      sw('לא בשבת וחג', 'noRest', true),
      sw('מסך צלצול מלא (כבוי: התראה בוילון בלבד)', 'ring', d.type !== 'learning'),
      sw('חוזרת עד כיבוי', 'repeat', false),
      sw('אפשר נודניק', 'snooze', true)));
    root.appendChild(h('button', { class: 'btn block', onclick: () => {
      if (d.type === 'learning' && !d.trackId) { toast('צריך לבחור מסלול'); return; }
      if (d.date && d.type !== 'learning' && d.date < c.tk) { toast('התאריך כבר עבר'); return; }
      if (orig) Object.assign(orig, d); else c.st.alarms.push(d);
      saved = true;
      pg.close(); commit(); toast('ההתראה נשמרה');
    } }, 'שמירה'));
    if (orig) root.appendChild(h('button', { class: 'btn ghost block', style: 'margin-top:10px', onclick: () => testAlarm(d.ring === false ? 'notify' : 'ring') }, 'בדיקה: צלצול בעוד 10 שניות'));
    return root;
  }, { onClose: () => { if (!saved && back) setTimeout(back, 40); } });
}
nav.openAlarmEdit = editAlarm;
