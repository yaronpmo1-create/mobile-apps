import { h, press, actionSheet, openSheet, toast, txt } from '../ui.js';
import { ctx, commit, nav } from '../core.js';
import { hebrewDate, weekdayName, parseKey, addDays, dkey, hhmm, pad } from '../lib/dates.js';
import { ZMAN_DEFS, zmanimFor, dayEvents, parshaOfWeek, timedOn, omerDay, isRestDay, zmanName } from '../lib/zm.js';
import { dueTracks, getEntry, setEntry, learnInfo, progressOf, PARTS, markAll, undoMark, missingDays, streak, dayStatus, isFreeDay, isLateMark } from '../lib/tracks.js';
import { setDone, openLink } from '../lib/native.js';
import { CHABAD } from '../lib/chabad.js';
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
  return { was, e };
}
export function checkbox(e) {
  const cls = !e ? '' : e.s === 'done' ? ' on' : e.s === 'late' ? ' late' : ' skip';
  return h('div', { class: 'chk' + cls }, !e ? '' : e.s === 'skip' ? '–' : '✓');
}

export function trackNoteSheet(c, key, track) {
  const e = getEntry(c.st, key, track.id) || {};
  let note = ((c.st.notes || {})[key] || {})[track.id] || '', where = track.where || '';
  openSheet(track.name, (sh) => h('div', null,
    h('label', { class: 'f' }, 'איפה עצרתי (יוצג בהמשך)'), txt(where, (v) => (where = v), 'למשל: סעיף ג׳'),
    h('label', { class: 'f' }, 'הערה ליום הזה'), h('textarea', { oninput: (ev) => (note = ev.target.value) }, note),
    h('div', { class: 'inline', style: 'margin-top:12px' },
      h('button', { class: 'btn sec', onclick: () => { markTrack(c, key, track, 'skip'); sh.close(); } }, 'דלג היום'),
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
  const done = e && (e.s === 'done' || e.s === 'late');
  const el = h('div', { class: 'row tap' + (done ? ' done' : '') },
    checkbox(e),
    h('div', { class: 'grow' },
      h('div', { class: 't' }, info.title, e && e.s === 'late' ? h('span', { class: 'tag' }, 'באיחור') : null),
      info.sub ? h('div', { class: 's' }, info.sub) : null,
      info.where ? h('div', { class: 's' }, 'המשך: ' + info.where) : null,
      pr != null ? h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.round(pr * 100) + '%' })) : null));
  press(el, () => {
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

export function today() {
  const c = ctx();
  const { st, s, loc } = c;
  const d = c.today;
  const root = h('div', null);
  // כותרת תאריך
  root.appendChild(h('div', { class: 'h-date' }, weekdayName(d) + ', ' + hebrewDate(d) + ' · ' + d.getDate() + '.' + (d.getMonth() + 1)));
  // אירועי היום
  const ev = dayEvents(d, loc, s);
  const hd = new HDate(d);
  const extra = [];
  const par = d.getDay() === 6 ? parshaOfWeek(d, loc, s) : '';
  if (par) extra.push('פרשת ' + par);
  const om = omerDay(d, loc, s);
  if (om) extra.push('היום ' + om + ' בעומר');
  if (s.chabadDates) for (const cd of CHABAD) if (cd.m === hd.getMonth() && cd.d === hd.getDate()) extra.push(cd.t);
  for (const y of st.yahrzeits) if ((y.m === hd.getMonth() || (y.m === 12 && hd.getMonth() === 13)) && y.d === hd.getDate()) extra.push((y.type === 'birthday' ? 'יום הולדת עברי: ' : 'יום זיכרון: ') + y.name);
  const tt = timedOn(d, loc, s);
  if (tt.candles) extra.push('הדלקת נרות ' + hhmm(tt.candles, loc.tz));
  if (tt.havdalah) extra.push('הבדלה ' + hhmm(tt.havdalah, loc.tz));
  const line = ev.concat(extra);
  if (line.length) root.appendChild(h('p', { class: 'h-sub' }, line.join(' · ')));

  // הזמן הבא
  const nz = nextZman(c);
  if (nz) {
    const al = alarmFor(c, nz);
    root.appendChild(h('div', { class: 'card accent tap', onclick: () => nav.goTab('times') },
      h('div', { class: 'muted' }, 'הבא: ' + nz.name + ' ' + hhmm(nz.t, loc.tz)),
      h('div', { class: 'big' }, 'בעוד ' + countdown(nz.t - c.now) + (al ? ' · התראה ב-' + hhmm(al, loc.tz) : ''))));
  }

  // באנר השלמה
  const miss = missingDays(st, c.tk);
  if (miss.length) {
    const yk = dkey(addDays(d, -1));
    const txt1 = miss.length === 1 && miss[0] === yk ? (miss.length && dayStatus(st, yk).total - dayStatus(st, yk).done === 1 ? 'אתמול חסר לימוד אחד' : 'אתמול חסרים לימודים') : 'חסרים ' + miss.length + ' ימים';
    root.appendChild(h('div', { class: 'banner' }, h('span', null, txt1), h('button', { class: 'btn sm', onclick: () => nav.openDay(miss[0]) }, 'השלם')));
  }

  const due = dueTracks(st, c.tk);
  const free = isFreeDay(st, c.tk);
  if (free) root.appendChild(h('div', { class: 'banner' }, h('span', null, st.special[c.tk] ? 'יום מיוחד - לא נספר כהחמצה' : 'מצב חופשה - לא נספר כהחמצה')));
  if (isRestDay(d, loc, s) && due.length) root.appendChild(h('p', { class: 'h-sub' }, 'שבת/חג: בלי תזכורות וצלצול. אפשר לסמן במוצאי שבת/חג והלימוד יירשם בתאריך הנכון, לא כאיחור.'));

  if (!st.tracks.filter((t) => !t.archived).length) {
    root.appendChild(h('div', { class: 'card empty-note' }, h('p', null, 'עוד אין מסלולי לימוד.'), h('button', { class: 'btn', onclick: () => nav.goTab('learn') }, 'הוספת מסלול')));
  } else if (!due.length) {
    root.appendChild(h('div', { class: 'card empty-note' }, 'אין לימוד מתוזמן להיום.'));
  }
  // לפי חלקי היום
  const groups = { morning: [], afternoon: [], evening: [], any: [] };
  due.forEach((t) => (groups[t.part] || groups.any).push(t));
  for (const k of ['morning', 'afternoon', 'evening', 'any']) {
    if (!groups[k].length) continue;
    const hr = c.now.getHours(); const curPart = hr < s.partMorning ? 'morning' : hr < s.partAfternoon ? 'afternoon' : 'evening';
    root.appendChild(h('div', { class: 'section-title', style: k === curPart ? 'color:var(--accent)' : '' }, PARTS[k] + (k === curPart ? ' · עכשיו' : '')));
    root.appendChild(h('div', { class: 'list' }, groups[k].map((t) => trackRow(c, c.tk, t))));
  }
  if (due.length) {
    const all = dayStatus(st, c.tk).kind === 'full';
    root.appendChild(h('button', { class: 'btn ' + (all ? 'sec' : '') + ' block', disabled: all, onclick: () => {
      const ids = markAll(st, c.tk, c.tk);
      ids.forEach((id) => setDone(c.tk, id, true));
      commit();
      toast('סומנו ' + ids.length + ' לימודים', 'ביטול', () => { undoMark(st, c.tk, ids, c.tk); ids.forEach((id) => setDone(c.tk, id, false)); commit(); });
      milestone(c);
    } }, all ? 'כל הלימוד של היום סומן ✓' : 'סימנתי הכל'));
    const sk = streak(st, c.tk);
    if (sk.cur) root.appendChild(h('p', { class: 'h-sub', style: 'text-align:center;margin-top:10px' }, 'רצף נוכחי: ' + sk.cur + ' ימים'));
  }
  root.appendChild(h('p', { class: 'dim small', style: 'text-align:center' }, 'נגיעה מסמנת · לחיצה ארוכה: הערה ו"איפה עצרתי"'));
  return root;
}
