import { navBar, h, openPage, openSheet, actionSheet, confirmBox, toggle, toast, press } from '../ui.js';
import { ctx, commit, nav } from '../core.js';
import { HDate } from '@hebcal/core';
import { dkey, parseKey, addDays, hebrewDate, hebrewMonthYear, hebrewMonthDays, hd, stripNikud, WD_LETTER, weekdayName, WEEKDAYS } from '../lib/dates.js';
import { dayStatus, dueTracks, activeTracks, getEntry, streak, missingDays, pctRange, trackPct, lateCount, markAll, undoMark, isFreeDay, firstKey } from '../lib/tracks.js';
import { isChagDay } from '../lib/zm.js';
import { trackRow } from './today.js';
import { setDone, shareText } from '../lib/native.js';

let mOff = 0; // היסטוריית חודשים יחסית לחודש הנוכחי

const dayLetter = (d) => stripNikud(hd(d).renderGematriya()).split(' ')[0];

function monthAnchor(c) {
  const h0 = hd(c.today);
  let a = new HDate(1, h0.getMonth(), h0.getFullYear());
  for (let i = 0; i < Math.abs(mOff); i++) {
    if (mOff > 0) a = a.add(a.daysInMonth(), 'd');
    else { const p = a.add(-1, 'd'); a = new HDate(1, p.getMonth(), p.getFullYear()); }
  }
  return a.greg();
}

export function journal() {
  const c = ctx();
  const { st } = c;
  const root = h('div', null);
  const anchor = mOff === 0 ? c.today : monthAnchor(c);
  const days = hebrewMonthDays(anchor);
  root.appendChild(navBar(h('div', { style: 'text-align:center' }, h('b', { style: 'font-size:1.2rem' }, hebrewMonthYear(days[0])), h('div', { class: 'muted small' }, mOff ? 'חזרה להיום בלחיצה' : 'החודש הנוכחי')), () => { mOff--; commit(); }, () => { mOff++; commit(); }));
  if (mOff) root.lastChild.children[1].onclick = () => { mOff = 0; commit(); };
  const ws = 0;
  const grid = h('div', { class: 'cal' });
  for (let i = 0; i < 7; i++) grid.appendChild(h('div', { class: 'wd' }, WD_LETTER[(i + ws) % 7]));
  const lead = (days[0].getDay() - ws + 7) % 7;
  for (let i = 0; i < lead; i++) grid.appendChild(h('div', { class: 'cell empty' }));
  for (const d of days) {
    const k = dkey(d);
    const ds = dayStatus(st, k);
    const future = k > c.tk;
    let cls = future ? 'none future' : ds.kind;
    if (k === c.tk && ds.kind !== 'full') cls = ds.kind === 'special' ? 'special' : 'none';
    const chag = isChagDay(d, c.loc, c.s);
    grid.appendChild(h('button', { class: 'cell ' + cls + (k === c.tk ? ' today' : ''), onclick: () => openDay(k) },
      dayLetter(d), h('small', null, d.getDate()), chag && ds.kind !== 'special' ? h('i', { class: 'dot' }) : null));
  }
  root.appendChild(grid);
  root.appendChild(h('div', { class: 'legend' },
    [['var(--ok)', 'הכל'], ['var(--warn)', 'חלקי'], ['var(--bad)', 'חסר'], ['var(--info)', 'חג / מיוחד']].map(([col, t]) => h('span', null, h('i', { style: 'background:' + col }), t))));
  const miss = missingDays(st, c.tk);
  if (miss.length) root.appendChild(h('div', { class: 'banner' }, h('span', null, 'חסרים ' + miss.length + ' ימים'), h('button', { class: 'btn sm', onclick: () => openDay(miss[miss.length - 1]) }, 'להשלמה')));
  else root.appendChild(h('p', { class: 'h-sub' }, 'אין ימים חסרים בחלון ההשלמה.'));
  root.appendChild(h('button', { class: 'btn sec block', style: 'margin:6px 0', onclick: () => stats() }, 'סטטיסטיקה והישגים'));
  return root;
}

export function openDay(key) {
  const c = ctx();
  const d = parseKey(key);
  openPage(weekdayName(d) + ' ' + hebrewDate(d), (pg) => {
    const c2 = ctx();
    const st = c2.st;
    const root = h('div', null);
    root.appendChild(h('div', { class: 'h-sub' }, d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear()));
    if (key > c2.tk) root.appendChild(h('div', { class: 'banner' }, 'יום עתידי. אפשר לסמן רק מהיום והלאה לאחור.'));
    const due = dueTracks(st, key);
    const free = isFreeDay(st, key);
    const ds = dayStatus(st, key);
    if (!due.length) root.appendChild(h('div', { class: 'card empty-note' }, 'אין לימוד מתוזמן ליום הזה.'));
    root.appendChild(h('div', { class: 'list' }, due.map((t) => {
      const row = trackRow(c2, key, t, { milestone: key === c2.tk });
      const n = ((st.notes || {})[key] || {})[t.id];
      if (n) row.querySelector('.grow').appendChild(h('div', { class: 's' }, 'הערה: ' + n));
      return row;
    })));
    const others = activeTracks(st).filter((t) => !due.includes(t));
    if (others.length) root.appendChild(h('p', { class: 'dim small' }, 'מסלולים שלא מתוזמנים ליום הזה לא מוצגים.'));
    if (due.length && key <= c2.tk) {
      root.appendChild(h('button', { class: 'btn block', disabled: ds.kind === 'full', onclick: () => {
        const ids = markAll(st, key, c2.tk);
        ids.forEach((id) => setDone(key, id, true));
        commit();
        toast('סומנו ' + ids.length, 'ביטול', () => { undoMark(st, key, ids, c2.tk); ids.forEach((id) => setDone(key, id, false)); commit(); });
      } }, ds.kind === 'full' ? 'כל היום הושלם ✓' : 'סימנתי הכל'));
    }
    root.appendChild(h('div', { class: 'list', style: 'margin-top:12px' },
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'יום מיוחד / חופשה'), h('div', { class: 's' }, 'לא נספר כהחמצה ולא שובר רצף')),
        toggle(!!st.special[key], (v) => { if (v) st.special[key] = 1; else delete st.special[key]; commit(); }))));
    if (ds.late) root.appendChild(h('p', { class: 'small muted' }, ds.late + ' סימונים באיחור (מסומנים בכתום)'));
    return root;
  });
}
nav.openDay = openDay;

export function summaryText(c) {
  const st = c.st;
  const to = c.tk, from = dkey(addDays(c.today, -6));
  const s = streak(st, c.tk);
  const lines = ['סיכום שבועי - ' + hebrewDate(c.today)];
  let d = parseKey(from);
  for (let i = 0; i < 7; i++) {
    const k = dkey(d), ds = dayStatus(st, k);
    lines.push(WEEKDAYS[d.getDay()] + ': ' + (ds.kind === 'none' || ds.kind === 'special' ? '-' : ds.done + '/' + ds.total));
    d = addDays(d, 1);
  }
  lines.push('הצלחה: ' + pctRange(st, from, to) + '%', 'רצף: ' + s.cur + ' ימים (שיא ' + s.best + ')');
  return lines.join('\n');
}

export function stats() {
  openPage('סטטיסטיקה', (pg) => {
    const c = ctx();
    const { st } = c;
    const root = h('div', null);
    const sk = streak(st, c.tk);
    const mFrom = dkey(hebrewMonthDays(c.today)[0]);
    root.appendChild(h('div', { class: 'stat' },
      h('div', null, h('b', null, sk.cur), h('span', null, 'רצף נוכחי')),
      h('div', null, h('b', null, sk.best), h('span', null, 'שיא')),
      h('div', null, h('b', null, pctRange(st, mFrom, c.tk) + '%'), h('span', null, 'החודש'))));
    // 8 שבועות
    const weeks = [];
    for (let i = 7; i >= 0; i--) { const e = addDays(c.today, -7 * i), f = addDays(e, -6); weeks.push(pctRange(st, dkey(f), dkey(e))); }
    root.appendChild(h('div', { class: 'section-title' }, '8 שבועות אחרונים (אחוז הצלחה)'));
    root.appendChild(h('div', { class: 'card' }, h('div', { class: 'chart' }, weeks.map((p) => h('div', { style: 'height:' + Math.max(3, p) + '%' }, h('span', null, p))))));
    root.appendChild(h('div', { class: 'section-title' }, 'לפי מסלול (30 ימים)'));
    root.appendChild(h('div', { class: 'list' }, activeTracks(st).map((t) => h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, t.name), h('div', { class: 'bar' }, h('i', { style: 'width:' + trackPct(st, t, 30, c.tk) + '%' }))), h('b', null, trackPct(st, t, 30, c.tk) + '%')))));
    const lc = lateCount(st, dkey(addDays(c.today, -30)), c.tk);
    root.appendChild(h('div', { class: 'card' }, h('b', null, 'השלמות באיחור (30 ימים): '), lc));
    if (c.s.milestones) {
      const ms = [7, 30, 100, 365];
      root.appendChild(h('div', { class: 'section-title' }, 'אבני דרך'));
      root.appendChild(h('div', { class: 'chips' }, ms.map((m) => h('span', { class: 'chip' + (sk.best >= m ? ' on' : '') }, (sk.best >= m ? '✓ ' : '') + m + ' ימים'))));
    }
    root.appendChild(h('button', { class: 'btn block', style: 'margin-top:14px', onclick: async () => { const r = await shareText('סיכום שבועי', summaryText(c)); if (r === 'copied') toast('הסיכום הועתק ללוח'); } }, 'שיתוף סיכום שבועי'));
    return root;
  });
}
