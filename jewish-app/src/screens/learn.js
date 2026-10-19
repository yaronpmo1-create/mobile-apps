import { tishreiKey, dkey } from '../lib/dates.js';
import { hebDate, dragSort, h, openPage, openSheet, actionSheet, confirmBox, seg, chips, field, sel, txt, toggle, toast } from '../ui.js';
import { ctx, commit, nav } from '../core.js';
import { TEMPLATES, AUTO_KINDS, PARTS, addTemplate, newTrack, progressOf, trackPct, streak } from '../lib/tracks.js';
import { ZMAN_DEFS } from '../lib/zm.js';
import { WD_LETTER, WEEKDAYS } from '../lib/dates.js';
import { REL } from '../lib/alarms.js';
import { uid } from '../lib/store.js';

const FREQ = { daily: 'יומי', days: 'ימים מסוימים', weekly: 'שבועי', monthly: 'חודשי' };

export function trackSummary(t, c) {
  const bits = [FREQ[t.freq] || 'יומי'];
  if (t.freq === 'weekly') bits[0] = 'שבועי (יום ' + WEEKDAYS[t.weeklyDay] + ')';
  if (t.freq === 'days') bits[0] = (t.days || []).map((d) => WD_LETTER[d]).join('׳ ') + '׳';
  bits.push(PARTS[t.part] || '');
  if (t.counter) bits.push((t.unit || 'מקום') + ' ' + t.pos + (t.total ? ' מתוך ' + t.total : ''));
  if (t.remind && t.remind.mode !== 'none') bits.push('תזכורת');
  return bits.join(' · ');
}

export function learn() {
  const c = ctx();
  const { st } = c;
  const root = h('div', null);
  root.appendChild(h('button', { class: 'btn block', style: 'margin:6px 0 12px', onclick: () => pickTemplate() }, '+ מסלול חדש'));
  const act = st.tracks.filter((t) => !t.archived).sort((a, b) => a.order - b.order);
  const arch = st.tracks.filter((t) => t.archived);
  if (!act.length) root.appendChild(h('div', { class: 'card empty-note' }, 'עוד אין מסלולים. אפשר להתחיל מערכת חת״ת מוכנה או מכל תבנית אחרת.'));
  const ORDER = ['morning', 'afternoon', 'evening', 'any'];
  const groups = ORDER.map((k) => [k, act.filter((t) => (ORDER.includes(t.part) ? t.part : 'any') === k)]);
  const wrap = h('div', { class: 'groups' });
  for (const [gk, gl] of groups) {
    const list = h('div', { class: 'list', 'data-group': gk });
    gl.forEach((t) => {
      const pr = progressOf(t);
      list.appendChild(h('div', { class: 'row tap', 'data-id': t.id, style: t.paused ? 'opacity:.6' : '', onclick: () => editTrack(t.id) },
        h('div', { class: 'grow' },
          h('div', { class: 't' }, t.name, t.paused ? h('span', { class: 'tag blue' }, 'מושהה') : null),
          h('div', { class: 's' }, trackSummary(t, c)),
          pr != null ? h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.round(pr * 100) + '%' })) : null),
        h('div', { class: 'mv nodrag' },
          h('button', { 'aria-label': 'הזזה למעלה', onclick: (e) => { e.stopPropagation(); moveTrack(t.id, -1); } }, '▲'),
          h('button', { 'aria-label': 'הזזה למטה', onclick: (e) => { e.stopPropagation(); moveTrack(t.id, 1); } }, '▼')),
        h('button', { class: 'iconbtn nodrag', onclick: (e) => { e.stopPropagation(); trackMenu(t); } }, '⋮')));
    });
    if (!gl.length) list.appendChild(h('div', { class: 'ph dim small' }, 'גררו לכאן מסלול'));
    wrap.appendChild(h('div', { class: 'grp' + (gl.length ? '' : ' grp-empty') }, h('div', { class: 'section-title' }, PARTS[gk]), list));
  }
  // לחיצה ארוכה וגרירה: שינוי סדר, וגם העברה בין הקבוצות (בוקר / אחה״צ / ערב / במהלך היום)
  dragSort(wrap, (byGroup) => {
    let i = 0;
    for (const gk of ORDER) for (const id of byGroup[gk] || []) { const t = st.tracks.find((x) => x.id === id); if (t) { t.part = gk; t.order = i++; } }
    commit();
  });
  root.appendChild(wrap);
  if (arch.length) {
    root.appendChild(h('div', { class: 'section-title' }, 'ארכיון'));
    root.appendChild(h('div', { class: 'list' }, arch.map((t) => h('div', { class: 'row tap', onclick: () => trackMenu(t) }, h('div', { class: 'grow' }, h('div', { class: 't' }, t.name), h('div', { class: 's' }, 'בארכיון. ההיסטוריה נשמרה'))))));
  }
  root.appendChild(h('p', { class: 'dim small', style: 'text-align:center;margin:12px 0 2px' }, 'לחיצה ארוכה וגרירה: שינוי סדר והעברה בין הקבוצות'));
  root.appendChild(h('p', { class: 'dim small', style: 'text-align:center;margin:2px 0' }, '⋮ בכל מסלול: השהיה, שכפול, ארכיון ומחיקה'));
  return root;
}

// חיצי ▲▼: הזזה צעד אחד, ובקצה הקבוצה מעבר לקבוצה הסמוכה
const ORDER_P = ['morning', 'afternoon', 'evening', 'any'];
function moveTrack(id, dir) {
  const c = ctx();
  const act = c.st.tracks.filter((t) => !t.archived).sort((a, b) => a.order - b.order);
  const groups = ORDER_P.map((k) => act.filter((t) => (ORDER_P.includes(t.part) ? t.part : 'any') === k));
  const gi = groups.findIndex((g) => g.some((t) => t.id === id));
  if (gi < 0) return;
  const g = groups[gi], i = g.findIndex((t) => t.id === id), t = g[i];
  const j = i + dir;
  if (j >= 0 && j < g.length) { g[i] = g[j]; g[j] = t; }
  else {
    const ng = gi + dir;
    if (ng < 0 || ng >= groups.length) return;
    g.splice(i, 1);
    t.part = ORDER_P[ng];
    if (dir < 0) groups[ng].push(t); else groups[ng].unshift(t);
  }
  let n = 0;
  for (const grp of groups) for (const x of grp) x.order = n++;
  commit();
}
function move(act, i, dir) {
  const j = i + dir;
  if (j < 0 || j >= act.length) return;
  const x = act[i]; act[i] = act[j]; act[j] = x;
  act.forEach((t, k) => (t.order = k));
  commit();
}

export function trackMenu(t) {
  const c = ctx();
  actionSheet(t.name, [
    { label: 'עריכה', fn: () => editTrack(t.id) },
    !t.archived && { label: t.paused ? 'חידוש מסלול' : 'השהיה (לא נספר כהחמצה)', fn: () => { t.paused = !t.paused; commit(); } },
    { label: 'שכפול', fn: () => { const n = JSON.parse(JSON.stringify(t)); n.id = uid('t'); n.name += ' (עותק)'; n.order = c.st.tracks.length; n.archived = false; c.st.tracks.push(n); commit(); } },
    { label: t.archived ? 'החזרה מהארכיון' : 'העברה לארכיון (בלי מחיקה)', fn: () => { t.archived = !t.archived; commit(); } },
    { label: 'מחיקה לצמיתות (כולל ההיסטוריה שלו)', danger: true, fn: async () => {
      if (!(await confirmBox('למחוק את "' + t.name + '" ואת כל ההיסטוריה שלו? אי אפשר לשחזר.', 'מחיקה', true))) return;
      const st = c.st;
      st.tracks = st.tracks.filter((x) => x.id !== t.id);
      for (const k in st.entries) { delete st.entries[k][t.id]; if (!Object.keys(st.entries[k]).length) delete st.entries[k]; }
      commit();
    } },
  ]);
}

export function pickTemplate() {
  const c = ctx();
  openSheet('מסלול חדש', (sh) => h('div', null,
    h('button', { class: 'opt', onclick: () => { sh.close(); const n = newTrack('free'); n.order = c.st.tracks.length; editTrack(null, n); } }, h('div', null, h('b', null, 'מסלול בהתאמה אישית'), h('div', { class: 's muted small' }, 'שם, תדירות ותזכורת לפי בחירתכם'))),
    h('button', { class: 'opt', onclick: () => { addTemplate(c.st, 'chitas'); sh.close(); commit(); toast('נוספו חמשת מסלולי החת״ת'); } }, h('div', null, h('b', null, 'חת״ת יומי - חמישה מסלולים'), h('div', { class: 's muted small' }, 'חומש, תהילים, תניא, היום יום, משיח וגאולה יומי'))),
    TEMPLATES.filter((t) => t.tpl !== 'free').map((t) => h('button', { class: 'opt', onclick: () => { sh.close(); const n = newTrack(t.tpl); n.order = c.st.tracks.length; editTrack(null, n); } }, t.name))));
}

// עריכה: טיוטה נשמרת רק בלחיצה על שמירה
export function editTrack(id, fresh) {
  const c = ctx();
  const orig = fresh ? null : c.st.tracks.find((t) => t.id === id);
  if (!fresh && !orig) return;
  const d = JSON.parse(JSON.stringify(fresh || orig));
  openPage(fresh ? 'מסלול חדש' : 'עריכת מסלול', (pg) => {
    const root = h('div', null);
    const up = (k, v) => { d[k] = v; };
    root.appendChild(field('שם המסלול', txt(d.name, (v) => up('name', v))));
    if (d.auto) root.appendChild(field('תוכן אוטומטי', sel(Object.entries(AUTO_KINDS), d.auto, (v) => { up('auto', v); })));
    root.appendChild(h('label', { class: 'f' }, 'תדירות'));
    root.appendChild(seg(Object.entries(FREQ), d.freq, (v) => { up('freq', v); pg.refresh(); }));
    if (d.freq === 'days') root.appendChild(chips(WD_LETTER.map((l, i) => [i, l]), d.days || [], (v) => { d.days = d.days.includes(v) ? d.days.filter((x) => x !== v) : d.days.concat(v); pg.refresh(); }));
    if (d.freq === 'weekly') root.appendChild(field('יום בשבוע', sel(WEEKDAYS.map((w, i) => [i, 'יום ' + w]), d.weeklyDay, (v) => up('weeklyDay', Number(v)))));
    if (d.freq === 'monthly') root.appendChild(field('יום בחודש העברי (1-30)', txt(d.monthlyDay, (v) => up('monthlyDay', Math.max(1, Math.min(30, Number(v) || 1))), '', 'number')));
    root.appendChild(h('label', { class: 'f' }, 'חלק ביום'));
    root.appendChild(seg(Object.entries(PARTS), d.part, (v) => { up('part', v); pg.refresh(); }));
    if (d.counter) {
      root.appendChild(h('hr'));
      root.appendChild(h('div', { class: 'inline' }, field('יחידה', txt(d.unit, (v) => up('unit', v), 'פרק, עמוד...')), field('מיקום נוכחי', txt(d.pos, (v) => up('pos', Math.max(0, Number(v) || 1)), '', 'number'))));
      root.appendChild(h('div', { class: 'inline' }, field('סה״כ (אופציונלי)', txt(d.total || '', (v) => up('total', Number(v) || 0), '', 'number')), field('יעד ליום (קידום)', txt(d.step, (v) => up('step', Math.max(1, Number(v) || 1)), '', 'number'))));
      root.appendChild(h('p', { class: 'dim small' }, 'המיקום מתקדם אוטומטית בכל סימון, ומתבטל בביטול הסימון.'));
    }
    root.appendChild(h('hr'));
    root.appendChild(h('label', { class: 'f' }, 'תזכורת (מצלצלת רק אם לא סימנת)'));
    const r = d.remind;
    root.appendChild(seg([['none', 'בלי'], ['time', 'שעה קבועה'], ['zman', 'לפי זמן הלכתי']], r.mode, (v) => { r.mode = v; pg.refresh(); }));
    if (r.mode === 'time') root.appendChild(field('אם לא סומן עד השעה', txt(r.time, (v) => (r.time = v), '', 'time')));
    if (r.mode === 'zman') {
      root.appendChild(h('div', { class: 'inline' },
        field('זמן', sel(ZMAN_DEFS.map((z) => [z.id, z.name]), r.zman, (v) => (r.zman = v))),
        field('יחס', sel(Object.entries(REL), r.rel, (v) => (r.rel = v))),
        field('דקות', txt(r.mins, (v) => (r.mins = Number(v) || 0), '', 'number'))));
    }
    if (r.mode !== 'none') root.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow' }, 'מסך צלצול מלא (ולא רק התראה בוילון)'), toggle(r.ring, (v) => { r.ring = v; pg.refresh(); })));
    root.appendChild(h('hr'));
    root.appendChild(field('קישור לטקסט (אופציונלי)', txt(d.url, (v) => up('url', v), 'https://...')));
    root.appendChild(field('איפה עצרתי', txt(d.where, (v) => up('where', v))));
    root.appendChild(h('label', { class: 'f' }, 'המסלול מתחיל בתאריך (אפשר אחורה, כדי להשלים רטרואקטיבית)'));
    root.appendChild(hebDate(d.created || dkey(new Date()), (v) => { up('created', v); }));
    root.appendChild(h('button', { class: 'btn sec sm', style: 'margin-top:6px', onclick: () => { up('created', tishreiKey()); pg.refresh(); } }, 'ראש השנה (תשרי)'));
    root.appendChild(h('button', { class: 'btn block', style: 'margin-top:18px', onclick: () => {
      if (!d.name.trim()) { toast('צריך שם למסלול'); return; }
      if (fresh) c.st.tracks.push(d);
      else Object.assign(orig, d);
      pg.close(); commit();
    } }, 'שמירה'));
    return root;
  });
}
