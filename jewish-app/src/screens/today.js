import { h, press, actionSheet, openSheet, toast, txt, navBar } from '../ui.js';
import { ctx, commit, nav, rerender } from '../core.js';
import { buildInstances } from '../lib/alarms.js';
import { pickTemplate } from './learn.js';
import { hebrewDate, weekdayName, parseKey, addDays, dkey, hhmm, pad } from '../lib/dates.js';
import { ZMAN_DEFS, zmanimFor, dayEvents, parshaOfWeek, timedOn, omerDay, isRestDay, zmanName } from '../lib/zm.js';
import { hebrewDate as _hd } from '../lib/dates.js';
import { dueTracks, getEntry, setEntry, learnInfo, progressOf, PARTS, markAll, undoMark, missingDays, streak, dayStatus, isFreeDay, isLateMark, beyondWindow } from '../lib/tracks.js';
import { setDone, openLink } from '../lib/native.js';
import { chabadOn } from '../lib/chabad.js';
import { linkBtn } from '../lib/linkbtn.js';
import { bookletsSection } from '../lib/booklets-ui.js';
import { chime } from '../lib/chime.js';
import { HDate } from '@hebcal/core';

export function nextZman(c) {
  const out = [];
  for (let i = 0; i < 3; i++) {
    const d = addDays(c.today, i);
    const z = zmanimFor(d, c.loc, c.s.method, c.s.tzeitMode);
    for (const def of ZMAN_DEFS) if (z[def.id] && z[def.id] > c.now) out.push({ id: def.id, name: def.name, t: z[def.id] });
    if (out.length) break;
  }
  out.sort((a, b) => a.t - b.t);
  return out[0] || null;
}
// ההתראה הפעילה הקרובה ביותר הקשורה לזמן הזה
function alarmFor(c, nz) {
  if (!nz) return null;
  let best = null;
  for (const a of c.st.alarms) {
    if (!a.enabled || a.type !== 'zman' || a.zman !== nz.id) continue;
    const t = nz.t.getTime() + (a.rel === 'before' ? -a.mins : a.rel === 'after' ? a.mins : 0) * 60000;
    if (t > c.now.getTime() && (!best || t < best)) best = t;
  }
  return best ? new Date(best) : null;
}
export const countdown = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return Math.floor(m / 60) + ':' + pad(m % 60); };

export function markTrack(c, key, track, status) {
  const prev = getEntry(c.st, key, track.id);
  const was = prev && (prev.s === 'done' || prev.s === 'late');
  setEntry(c.st, key, track, status, c.tk);
  const e = getEntry(c.st, key, track.id);
  setDone(key, track.id, e && (e.s === 'done' || e.s === 'late' || e.s === 'skip'));
  commit();
  if (e && (e.s === 'done' || e.s === 'late') && !was) chime(dayStatus(c.st, key).kind === 'full' ? 'all' : 'one');
  return { was, e };
}
export function checkbox(e, pend) {
  const cls = (!e ? '' : e.s === 'done' ? ' on' : e.s === 'late' ? ' late' : ' skip') + (pend ? ' pend' : '');
  return h('div', { class: 'chk' + cls }, !e ? '' : e.s === 'skip' ? '–' : '✓');
}

export function trackNoteSheet(c, key, track) {
  const e = getEntry(c.st, key, track.id) || {};
  let note = ((c.st.notes || {})[key] || {})[track.id] || '', where = track.where || '';
  openSheet(track.name, (sh) => h('div', null,
    h('label', { class: 'f' }, 'איפה עצרתי (יוצג בהמשך)'), txt(where, (v) => (where = v), 'למשל: סעיף ג׳'),
    h('label', { class: 'f' }, 'הערה ליום הזה'), h('textarea', { oninput: (ev) => (note = ev.target.value) }, note),
    h('div', { class: 'inline', style: 'margin-top:12px' },
      ((getEntry(c.st, key, track.id) || {}).s === 'skip')
        ? h('button', { class: 'btn', onclick: () => { markTrack(c, key, track, null); sh.close(); } }, 'ביטול הדילוג')
        : h('button', { class: 'btn sec', onclick: () => { markTrack(c, key, track, 'skip'); sh.close(); toast('סומן דילוג', 'ביטול', () => markTrack(c, key, track, null)); } }, 'דלג היום'),
      h('button', { class: 'btn', onclick: () => {
        track.where = where;
        c.st.notes = c.st.notes || {};
        const dn = (c.st.notes[key] = c.st.notes[key] || {});
        if (note) dn[track.id] = note; else delete dn[track.id];
        if (!Object.keys(dn).length) delete c.st.notes[key];
        commit(); sh.close();
      } }, 'שמירה')),
    (learnInfo(track, parseKey(key), c.st).url ? h('button', { class: 'btn ghost block', style: 'margin-top:10px', onclick: async () => { const r = await openLink(learnInfo(track, parseKey(key), c.st).url); if (r === 'copied') toast('אין דפדפן במכשיר - הקישור הועתק ללוח'); } }, 'פתיחת הטקסט (קישור)') : null)));
}

export function trackRow(c, key, track, opts = {}) {
  const e = getEntry(c.st, key, track.id);
  const info = learnInfo(track, parseKey(key), c.st);
  const pr = progressOf(track);
  const isDone0 = e && (e.s === 'done' || e.s === 'late');
  const pend = opts.pend;
  const toggled = !!(pend && pend.has(track.id));
  const eff = toggled ? (isDone0 ? null : { s: 'done' }) : e;
  const done = eff && (eff.s === 'done' || eff.s === 'late');
  const el = h('div', { class: 'row tap' + (done ? ' done' : '') },
    checkbox(eff, toggled),
    h('div', { class: 'grow' },
      h('div', { class: 't' }, info.title, e && e.s === 'late' ? h('span', { class: 'tag' }, 'באיחור') : null),
      info.sub ? h('div', { class: 's' }, info.sub) : null,
      info.where ? h('div', { class: 's' }, 'המשך: ' + info.where) : null,
      pr != null ? h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.round(pr * 100) + '%' })) : null),
    linkBtn(c.st, track, parseKey(key)));
  press(el, () => {
    if (opts.readonly) { toast('אפשר לסמן עד שישה ימים קדימה'); return; }
    if (pend) { if (pend.has(track.id)) pend.delete(track.id); else pend.add(track.id); rerender(); return; }
    const r = markTrack(c, key, track, e && e.s !== 'skip' ? null : 'done');
    if (!r.was && r.e && opts.milestone !== false) milestone(c);
  }, () => trackNoteSheet(c, key, track));
  return el;
}
export function milestone(c) {
  if (!c.s.milestones) return;
  const d = dayStatus(c.st, c.tk);
  if (d.kind !== 'full') return;
  const n = streak(c.st, c.tk).cur;
  if ([7, 30, 100, 365].includes(n)) toast('רצף של ' + n + ' ימים. כל הכבוד!');
}

const pending = new Set();
const secHead = (title, acts) => h('div', { class: 'sechead' }, h('h2', null, title), h('div', { class: 'acts' }, acts.map(([l, fn]) => h('button', { class: 'btn sm sec', onclick: fn }, l))));

function confirmPending(c, key, set = pending) {
  const ids = [...set];
  let marked = 0;
  for (const id of ids) {
    const track = c.st.tracks.find((x) => x.id === id);
    if (!track) continue;
    const e = getEntry(c.st, key, id);
    const isDone = e && (e.s === 'done' || e.s === 'late');
    setEntry(c.st, key, track, isDone ? null : 'done', c.tk);
    const n = getEntry(c.st, key, id);
    setDone(key, id, !!(n && (n.s === 'done' || n.s === 'late' || n.s === 'skip')));
    if (!isDone) marked++;
  }
  set.clear();
  commit();
  if (marked) { toast('נשמר: ' + marked + ' לימודים סומנו'); chime(dayStatus(c.st, key).kind === 'full' ? 'all' : 'one'); milestone(c); } else toast('השינויים נשמרו');
}

// הסבר + "סמן הכל" ו"בטל הכל" (פועלים מיד, עם "ביטול" בהודעה). set לא בשימוש, refresh = רענון המסך
export function dayMarkControls(c, key, due, set, refresh) {
  const st = c.st;
  const isDoneE = (tr) => { const e = getEntry(st, key, tr.id); return !!(e && (e.s === 'done' || e.s === 'late')); };
  const undone = due.filter((tr) => !isDoneE(tr)), done = due.filter(isDoneE);
  const apply = (arr) => () => {
    const ids = new Set(arr.map((tr) => tr.id));
    confirmPending(c, key, ids);
    toast(arr === undone ? 'סומנו ' + arr.length + ' לימודים' : 'בוטל הסימון של ' + arr.length + ' לימודים', 'ביטול', () => { confirmPending(c, key, new Set(ids)); refresh(); });
    refresh();
  };
  const out = [
    h('p', { class: 'dim small', style: 'text-align:center;margin:6px 0;white-space:nowrap;font-size:.78rem' }, 'לחיצה ארוכה על לימוד: הערה ו"איפה עצרתי"'),
    h('div', { class: 'inline', style: 'margin-bottom:6px' },
      h('button', { class: 'btn', disabled: !undone.length, onclick: apply(undone) }, undone.length ? 'סמן הכל' : 'הכל סומן ✓'),
      h('button', { class: 'btn sec', disabled: !done.length, onclick: apply(done) }, 'בטל הכל')),
  ];
  return out;
}

let dayOff = 0;
let pendKey = '';
export function shiftDay(delta) { dayOff += delta; rerender(); }
// חזרה אחורה במכשיר: אם מוצג יום אחר - חוזרים להיום קודם. מחזיר true אם בוצע
export function resetDay() { if (!dayOff) return false; dayOff = 0; rerender(); return true; }
export { confirmPending };

export function today() {
  const c = ctx();
  const { st, s, loc } = c;
  const d = addDays(c.today, dayOff);
  const key = dkey(d);
  const isToday = dayOff === 0;
  const future = beyondWindow(key, c.tk);
  if (pendKey !== key) { pending.clear(); pendKey = key; }
  const root = h('div', null);
  // כותרת תאריך עם חיצים ליום הקודם / הבא
  root.appendChild(navBar(
    h('div', null, h('div', { class: 'h-date', style: 'margin:0' }, weekdayName(d) + ', ' + hebrewDate(d)), h('div', { class: 'muted small' }, d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear())),
    () => { dayOff--; rerender(); }, () => { dayOff++; rerender(); }));
  if (!isToday) root.appendChild(h('button', { class: 'btn ghost sm block', style: 'margin-bottom:8px', onclick: () => { dayOff = 0; rerender(); } }, 'חזרה להיום'));
  // אירועי היום
  const ev = dayEvents(d, loc, s);
  const hd = new HDate(d);
  const extra = [];
  const par = d.getDay() === 6 ? parshaOfWeek(d, loc, s) : '';
  if (par) extra.push('פרשת ' + par);
  const om = omerDay(d, loc, s);
  if (om) extra.push('היום ' + om + ' בעומר');
  if (s.chabadDates) for (const cd of chabadOn(s)) if (cd.m === hd.getMonth() && cd.d === hd.getDate()) extra.push(cd.t);
  for (const y of st.yahrzeits) if ((y.m === hd.getMonth() || (y.m === 12 && hd.getMonth() === 13)) && y.d === hd.getDate()) extra.push((y.type === 'birthday' ? 'יום הולדת עברי: ' : 'יום זיכרון: ') + y.name);
  const tt = timedOn(d, loc, s);
  if (tt.candles) extra.push('הדלקת נרות ' + hhmm(tt.candles, loc.tz));
  if (tt.havdalah) extra.push('הבדלה ' + hhmm(tt.havdalah, loc.tz));
  const line = ev.concat(extra);
  if (line.length) root.appendChild(h('p', { class: 'h-sub' }, line.join(' · ')));

  // האירוע הבא: זמן והתראה, שני כרטיסים קטנים באותו גובה
  if (isToday) {
    root.appendChild(secHead('האירוע הבא', []));
    const nz = nextZman(c);
    const al = nz ? alarmFor(c, nz) : null;
    let nextAl = null;
    try { nextAl = buildInstances(st, c.now, 3, 40)[0] || null; } catch (e) { /* */ }
    root.appendChild(h('div', { class: 'pair' },
      h('div', { class: 'card mini tap', onclick: () => { nav.timesView('day'); nav.goTab('times'); } },
        h('div', { class: 'muted small' }, 'הזמן הבא · ' + (nz ? hhmm(nz.t, loc.tz) : '')),
        h('div', { class: 'big mid wrap' }, nz ? nz.name : '-'),
        h('div', { class: 'muted small' }, nz ? 'בעוד ' + countdown(nz.t - c.now) : '')),
      h('div', { class: 'card mini tap', onclick: () => { nav.timesView('alarms'); nav.goTab('times'); } },
        h('div', { class: 'muted small' }, 'ההתראה הבאה · ' + (nextAl ? hhmm(new Date(nextAl.t)) : '')),
        h('div', { class: 'big mid wrap' }, nextAl ? nextAl.title : 'אין התראה בקרוב'),
        h('div', { class: 'muted small' }, nextAl ? 'בעוד ' + countdown(nextAl.t - c.now.getTime()) : ''))));
    if (tt.candles && tt.candles > c.now) root.appendChild(h('div', { class: 'card mini', style: 'margin-top:8px;border:1px solid var(--accent)' }, h('span', { class: 'muted small' }, 'הדלקת נרות היום '), h('b', null, hhmm(tt.candles, loc.tz) + ' · בעוד ' + countdown(tt.candles - c.now))));
  }

  // לימוד יומי
  root.appendChild(secHead('לימוד יומי', []));
  const due = dueTracks(st, key);
  const free = isFreeDay(st, key);
  if (future) root.appendChild(h('div', { class: 'banner' }, h('span', null, 'אפשר לסמן עד שישה ימים קדימה, לא מעבר לכך.')));
  if (free) root.appendChild(h('div', { class: 'banner' }, h('span', null, st.special[key] ? 'יום מיוחד - לא נספר כהחמצה' : 'מצב חופשה - לא נספר כהחמצה')));
  if (isRestDay(d, loc, s) && due.length) root.appendChild(h('p', { class: 'h-sub' }, 'שבת/חג: בלי תזכורות וצלצול. אפשר לסמן במוצאי שבת/חג והלימוד יירשם בתאריך הנכון, לא כאיחור.'));

  if (!st.tracks.filter((t) => !t.archived).length) {
    root.appendChild(h('div', { class: 'card empty-note' }, h('p', null, 'עוד אין מסלולי לימוד.'), h('button', { class: 'btn', onclick: () => pickTemplate() }, 'הוספת מסלול')));
  } else if (!due.length) {
    root.appendChild(h('div', { class: 'card empty-note' }, 'אין לימוד מתוזמן ליום הזה.'));
  }
  const groups = { morning: [], afternoon: [], evening: [], any: [] };
  due.forEach((t) => (groups[t.part] || groups.any).push(t));
  for (const k of ['morning', 'afternoon', 'evening', 'any']) {
    if (!groups[k].length) continue;
    root.appendChild(h('div', { class: 'section-title' }, PARTS[k]));
    root.appendChild(h('div', { class: 'list' }, groups[k].map((t) => trackRow(c, key, t, { readonly: future }))));
  }
  if (due.length && !future) {
    dayMarkControls(c, key, due, pending, () => rerender()).forEach((el) => root.appendChild(el));
    const sk = streak(st, c.tk);
    if (isToday && sk.cur) root.appendChild(h('p', { class: 'h-sub', style: 'text-align:center;margin-top:10px' }, 'רצף נוכחי: ' + sk.cur + ' ימים'));
  }

  const bk = bookletsSection(c, d);
  if (bk) root.appendChild(bk);
  return root;
}
