import { swipeNav, hebDate, chips, field, navBar, h, openPage, openSheet, actionSheet, confirmBox, toggle, toast, press } from '../ui.js';
import { ctx, commit, nav } from '../core.js';
import { HDate } from '@hebcal/core';
import { dkey, parseKey, addDays, hebrewDate, hebrewMonthYear, hebrewMonthDays, hd, stripNikud, WD_LETTER, weekdayName, WEEKDAYS } from '../lib/dates.js';
import { setEntry, isDue, dayStatus, dueTracks, activeTracks, getEntry, streak, missingDays, pctRange, trackPct, lateCount, markAll, undoMark, isFreeDay, firstKey, beyondWindow } from '../lib/tracks.js';
import { isChagDay } from '../lib/zm.js';
import { trackRow, confirmPending } from './today.js';
import { setDone, shareText } from '../lib/native.js';
import { tishreiKey, hebrewMonthAnchor } from '../lib/dates.js';
import { rerender } from '../core.js';

let mOff = 0; // היסטוריית חודשים יחסית לחודש הנוכחי

const dayLetter = (d) => stripNikud(hd(d).renderGematriya()).split(' ')[0];

const sel = new Set();
let selMode = false, selAct = 'skip';
export function shiftMonth(delta) { mOff += delta; commit(); }
// אחרי גרירת בחירה (לחיצה ארוכה והחלקה) אסור שהשחרור יחליף חודש
let dragDone = false;
export function consumeSelDrag() { const v = dragDone; dragDone = false; return v; }

export function journal() {
  const c = ctx();
  const { st } = c;
  const root = h('div', null);
  const anchor = mOff === 0 ? c.today : hebrewMonthAnchor(c.today, mOff);
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
    const hue = (r) => (r <= 0.5 ? 10 + r * 50 : 35 + (r - 0.5) * 150);
    const pstyle = !future && ds.kind === 'partial' && !(k === c.tk) ? 'background:hsl(' + Math.round(hue(ds.ratio)) + ' 78% 50%);color:#1a1a1a' : '';
    if (k === c.tk && ds.kind !== 'full') cls = ds.kind === 'special' ? 'special' : 'none';
    const chag = isChagDay(d, c.loc, c.s);
    const cell = h('button', { class: 'cell ' + cls + (k === c.tk ? ' today' : '') + (sel.has(k) ? ' sel' : ''), 'data-k': k, style: pstyle },
      dayLetter(d), h('small', null, d.getDate()), chag && ds.kind !== 'special' ? h('i', { class: 'dot' }) : null);
    press(cell, () => { if (selMode) { if (sel.has(k)) sel.delete(k); else sel.add(k); if (!sel.size) selMode = false; rerender(); } else openDay(k); },
      () => {
        // לחיצה ארוכה: מתחילים בחירה, ובהחלקה האצבע מסמנת גם את הימים שעוברת עליהם
        selMode = true; sel.add(k); cell.classList.add('sel');
        const move = (e) => {
          e.preventDefault();
          const t = e.touches[0], el = document.elementFromPoint(t.clientX, t.clientY), cc = el && el.closest && el.closest('[data-k]');
          if (cc && !sel.has(cc.dataset.k)) { sel.add(cc.dataset.k); cc.classList.add('sel'); }
        };
        const end = () => { grid.removeEventListener('touchmove', move); grid.removeEventListener('touchend', end); grid.removeEventListener('touchcancel', end); dragDone = true; setTimeout(() => { dragDone = false; }, 400); rerender(); };
        grid.addEventListener('touchmove', move, { passive: false });
        grid.addEventListener('touchend', end); grid.addEventListener('touchcancel', end);
      });
    grid.appendChild(cell);
  }
  root.appendChild(grid);
  root.appendChild(h('div', { class: 'legend' },
    [['var(--ok)', 'הכל'], ['var(--warn)', 'חלקי'], ['var(--bad)', 'חסר'], ['var(--info)', 'חג / מיוחד / לא נספר']].map(([col, t]) => h('span', null, h('i', { style: 'background:' + col }), t))));
  root.appendChild(h('p', { class: 'dim small', style: 'text-align:center' }, 'נגיעה פותחת יום · לחיצה ארוכה: בחירת כמה ימים · החלקה: חודש קודם/הבא · לחיצה ארוכה והחלקה: סימון כמה ימים ברצף'));
  root.appendChild(h('button', { class: 'btn block', style: 'margin:6px 0', onclick: () => retro() }, 'השלמה ועדכון רטרואקטיבי'));
  root.appendChild(h('button', { class: 'btn sec block', style: 'margin:6px 0', onclick: () => stats() }, 'מעקב והישגים'));
  if (selMode) {
    root.appendChild(h('div', { class: 'confirmbar', style: 'flex-direction:column' },
      h('div', { class: 'seg', style: 'margin:0' }, [['skip', 'חג / מיוחד / לא נספר'], ['count', 'נספר (רלוונטי)']].map(([v, l]) => h('button', { class: v === selAct ? 'on' : '', onclick: () => { selAct = v; rerender(); } }, l))),
      h('div', { style: 'display:flex;gap:10px' },
        h('button', { class: 'btn', onclick: () => {
          for (const k of sel) { if (selAct === 'skip') st.special[k] = 1; else delete st.special[k]; }
          const n = sel.size; sel.clear(); selMode = false; commit(); toast(selAct === 'skip' ? n + ' ימים סומנו כלא נספרים' : n + ' ימים חזרו להיספר');
        } }, 'אישור (' + sel.size + ')'),
        h('button', { class: 'btn sec', onclick: () => { sel.clear(); selMode = false; rerender(); } }, 'ביטול')),
      h('button', { class: 'btn ghost block', onclick: () => lessonsForSelected() }, 'סימון שיעורים בימים שנבחרו')));
  }
  return root;
}

// סימון שיעורים בכמה ימים יחד: בוחרים מסלולים ופעולה, והיא חלה על כל הימים הנבחרים שבהם המסלול מתוזמן
function lessonsForSelected() {
  const c = ctx(), st = c.st;
  const keys = [...sel].sort();
  const tracks = activeTracks(st);
  const chosen = new Set(tracks.map((t) => t.id));
  let act = 'done';
  openSheet('סימון שיעורים ב-' + keys.length + ' ימים', (sh) => {
    const trBtns = tracks.map((t) => { const b = h('button', { class: 'chip on', onclick: () => { if (chosen.has(t.id)) chosen.delete(t.id); else chosen.add(t.id); b.classList.toggle('on', chosen.has(t.id)); } }, t.name); return b; });
    const acts = [['done', 'סומן שנלמד'], ['skip', 'דלג (לא נספר)'], ['clear', 'ביטול סימון']];
    const aBtns = acts.map(([v, l]) => { const b = h('button', { class: v === act ? 'on' : '', onclick: () => { act = v; aBtns.forEach((x, i) => x.classList.toggle('on', acts[i][0] === v)); } }, l); return b; });
    return h('div', null,
      h('label', { class: 'f' }, 'אילו שיעורים'),
      h('div', { class: 'chips' }, trBtns),
      h('label', { class: 'f' }, 'מה לעשות'),
      h('div', { class: 'seg' }, aBtns),
      h('div', { class: 'inline', style: 'margin-top:12px' },
        h('button', { class: 'btn', onclick: () => {
          let n = 0;
          for (const k of keys) {
            if (beyondWindow(k, c.tk)) continue;
            for (const t of dueTracks(st, k)) {
              if (!chosen.has(t.id)) continue;
              setEntry(st, k, t, act === 'clear' ? null : act, c.tk);
              const e = getEntry(st, k, t.id);
              setDone(k, t.id, !!(e && (e.s === 'done' || e.s === 'late' || e.s === 'skip')));
              n++;
            }
          }
          sh.close(); sel.clear(); selMode = false; commit(); toast('עודכנו ' + n + ' סימונים');
        } }, 'אישור'),
        h('button', { class: 'btn sec', onclick: () => sh.close() }, 'ביטול')));
  });
}

const dayPend = new Set();
export function openDay(key0) {
  let key = key0;
  const titleFor = (k) => { const d = parseKey(k); return weekdayName(d) + ' ' + hebrewDate(d); };
  const pg0 = openPage(titleFor(key), (pg) => {
    const d = parseKey(key);
    const c2 = ctx();
    const st = c2.st;
    const root = h('div', null);
    root.appendChild(h('div', { class: 'h-sub' }, d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear()));
    if (beyondWindow(key, c2.tk)) root.appendChild(h('div', { class: 'banner' }, 'אפשר לסמן עד שישה ימים קדימה, לא מעבר לכך.'));
    const due = dueTracks(st, key);
    const free = isFreeDay(st, key);
    const ds = dayStatus(st, key);
    if (!due.length) root.appendChild(h('div', { class: 'card empty-note' }, 'אין לימוד מתוזמן ליום הזה.'));
    root.appendChild(h('div', { class: 'list' }, due.map((t) => {
      const row = trackRow(c2, key, t, { milestone: key === c2.tk, readonly: beyondWindow(key, c2.tk), pend: beyondWindow(key, c2.tk) ? null : dayPend });
      const n = ((st.notes || {})[key] || {})[t.id];
      if (n) row.querySelector('.grow').appendChild(h('div', { class: 's' }, 'הערה: ' + n));
      return row;
    })));
    const others = activeTracks(st).filter((t) => !due.includes(t));
    if (others.length) root.appendChild(h('p', { class: 'dim small' }, 'מסלולים שלא מתוזמנים ליום הזה לא מוצגים.'));
    if (due.length && !beyondWindow(key, c2.tk)) {
      const undone = due.filter((tr) => { const e = getEntry(st, key, tr.id); return !(e && (e.s === 'done' || e.s === 'late')); });
      const allSel = undone.length && undone.every((tr) => dayPend.has(tr.id));
      root.appendChild(h('button', { class: 'btn sec block', style: 'flex-direction:column;gap:0', disabled: !undone.length, onclick: () => { if (allSel) undone.forEach((tr) => dayPend.delete(tr.id)); else undone.forEach((tr) => dayPend.add(tr.id)); pg.refresh(); } },
        h('span', null, !undone.length ? 'כל היום הושלם ✓' : allSel ? 'ביטול בחירת הכל' : 'סמן הכל'),
        h('span', { style: 'font-weight:400;font-size:.78rem;opacity:.8' }, 'לחיצה ארוכה: הערה ו"איפה עצרתי"')));
      if (dayPend.size) root.appendChild(h('div', { class: 'confirmbar', style: 'position:static;margin:8px 0' },
        h('button', { class: 'btn', onclick: () => { confirmPending(c2, key, dayPend); pg.refresh(); } }, 'אישור (' + dayPend.size + ')'),
        h('button', { class: 'btn sec', onclick: () => { dayPend.clear(); pg.refresh(); } }, 'ביטול')));
    }
    root.appendChild(h('div', { class: 'list', style: 'margin-top:12px' },
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'חג / מיוחד / לא נספר'), h('div', { class: 's' }, 'לא נספר כהחמצה ולא שובר רצף')),
        toggle(!!st.special[key], (v) => { if (v) st.special[key] = 1; else delete st.special[key]; commit(); }))));
    if (ds.late) root.appendChild(h('p', { class: 'small muted' }, ds.late + ' סימונים באיחור (מסומנים בכתום)'));
    return root;
  });
  swipeNav(pg0.body, (dir) => { key = dkey(addDays(parseKey(key), dir)); dayPend.clear(); pg0.setTitle(titleFor(key)); pg0.refresh(); });
}
nav.openDay = openDay;
nav.retro = () => retro();

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

// סימון לימוד לטווח ימים בעבר, בבת אחת. אם הטווח מתחיל לפני תחילת המסלול, המסלול מוקדם לתחילת הטווח
export function retro() {
  const c = ctx();
  const tracks = activeTracks(c.st);
  if (!tracks.length) { toast('עוד אין מסלולים'); return; }
  const sel = new Set(tracks.map((t) => t.id));
  let from = tishreiKey(), to = dkey(addDays(c.today, -1));
  let sh;
  sh = openSheet('השלמה רטרואקטיבית', () => h('div', null,
    h('p', { class: 'muted small' }, 'מסמן כהושלם את הימים שבטווח, רק במסלולים שנבחרו ורק בימים שהם מתוזמנים. ימים שכבר סומנו לא משתנים.'),
    h('label', { class: 'f' }, 'מסלולים'),
    chips(tracks.map((t) => [t.id, t.name]), [...sel], (v) => { if (sel.has(v)) sel.delete(v); else sel.add(v); sh.refresh(); }),
    h('div', { class: 'inline' },
      field('מתאריך', hebDate(from, (v) => { from = v; })),
      field('עד תאריך', hebDate(to, (v) => { to = v; }))),
    h('button', { class: 'btn sec sm', style: 'margin-top:8px', onclick: () => { from = tishreiKey(); sh.refresh(); } }, 'התחלה מראש השנה (תשרי)'),
    h('button', { class: 'btn block', style: 'margin-top:14px', onclick: async () => {
      if (!sel.size) { toast('צריך לבחור מסלול'); return; }
      if (to < from) { toast('טווח לא תקין'); return; }
      const end = dkey(addDays(c.today, -1)); if (to > end) to = end;
      const todo = [];
      for (const t of tracks) {
        if (!sel.has(t.id)) continue;
        let d = parseKey(from);
        while (dkey(d) <= to) {
          const k = dkey(d);
          if (isDue(t, k) && !getEntry(c.st, k, t.id) && !c.st.special[k]) todo.push([t, k]);
          d = addDays(d, 1);
        }
      }
      if (!todo.length) { toast('אין מה לסמן בטווח הזה'); return; }
      if (!(await confirmBox('לסמן ' + todo.length + ' לימודים כהושלמו?', 'אישור'))) return;
      for (const t of tracks) if (sel.has(t.id) && t.created > from) t.created = from;
      for (const [t, k] of todo) { setEntry(c.st, k, t, 'done', k); setDone(k, t.id, true); }
      sh.close(); commit(); toast('סומנו ' + todo.length + ' לימודים');
    } }, 'סמן כהושלם')));
}
