// מסלולי לימוד: תבניות, מה ללמוד היום, מי חייב, סימון ורצף
import { HDate, DailyLearning } from '@hebcal/core';
import '@hebcal/learning';
import { dkey, parseKey, addDays, hebrewDayMonth, stripNikud, tishreiKey, gematria, hebrewDayLetter } from './dates.js';
import { getLoc, isRestDay, parshaOfWeek } from './zm.js';
import { uid } from './store.js';
import { TANYA_DAYS } from './tanya-data.js';

// חלקי התניא לפי סדר, ומספר הפרקים בכל חלק
const TANYA = [['ליקוטי אמרים', 53], ['שער היחוד והאמונה', 12], ['אגרת התשובה', 12], ['אגרת הקודש', 32]];
export function tanyaPos(n) {
  let x = Math.max(1, Math.floor(n));
  for (const [name, cnt] of TANYA) { if (x <= cnt) return name + ', פרק ' + gematria(x); x -= cnt; }
  return 'קונטרס אחרון';
}
// "ספר|מספר|מקום" -> "אגרת הקודש, אמצע אגרת כ״ו"
const T_BOOK = { L: 'ליקוטי אמרים', S: 'שער היחוד והאמונה', T: 'אגרת התשובה', K: 'אגרת הקודש', A: 'קונטרס אחרון' };
const T_SPECIAL = { x1: 'שער הספר והסכמות', x2: 'הסכמות (המשך)', x3: 'הקדמה', x4: 'הקדמת המלקט' };
const T_POS = { b: 'תחילת ', m: 'אמצע ', e: 'סוף ', w: '' };
export function tanyaText(code) {
  const [b, n, pos] = code.split('|');
  const what = T_SPECIAL[n] || ((b === 'K' ? 'אגרת ' : b === 'A' ? 'מאמר ' : 'פרק ') + gematria(Number(n)));
  return T_BOOK[b] + ', ' + T_POS[pos] + what;
}
export const ALIYOT = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי'];
export const PARTS = { morning: 'בוקר', afternoon: 'אחר הצהריים', evening: 'ערב ולילה', any: 'במהלך היום' };

const CH = 'https://www.chabad.org/dailystudy/';
// auto = סוג חישוב אוטומטי; counter = מונה ידני; weekly = שיעור שבועי
export const TEMPLATES = [
  { tpl: 'chumash', name: 'חומש עם רש״י', auto: 'chumash', freq: 'daily', part: 'morning', url: CH + 'torahreading.asp' },
  { tpl: 'tehilim', name: 'תהילים יומי', auto: 'psalms', freq: 'daily', part: 'morning', url: CH + 'tehillim.asp' },
  { tpl: 'tanya', name: 'תניא יומי', auto: 'tanyaYomi', freq: 'daily', part: 'morning', url: CH + 'tanya.asp' },
  { tpl: 'hayomyom', name: 'היום יום', auto: 'hayomyom', freq: 'daily', part: 'morning', url: CH + 'hayomyom.asp' },
  { tpl: 'rambam1', name: 'רמב״ם - פרק אחד ביום', auto: 'rambam1', freq: 'daily', part: 'afternoon' },
  { tpl: 'rambam3', name: 'רמב״ם - שלושה פרקים ביום', auto: 'rambam3', freq: 'daily', part: 'afternoon' },
  { tpl: 'dafyomi', name: 'דף יומי', auto: 'dafYomi', freq: 'daily', part: 'afternoon' },
  { tpl: 'mishna', name: 'משנה יומית', auto: 'mishnaYomi', freq: 'daily', part: 'evening' },
  { tpl: 'nach', name: 'נ״ך יומי', auto: 'tanakhYomi', freq: 'daily', part: 'evening' },
  { tpl: 'sicha', name: 'שיחה שבועית', freq: 'weekly', weeklyDay: 6, part: 'any' },
  { tpl: 'maamarRebbe', name: 'מאמר הרבי השבועי', freq: 'weekly', weeklyDay: 6, part: 'any' },
  { tpl: 'maamarZaken', name: 'מאמר אדמו״ר הזקן', freq: 'weekly', weeklyDay: 6, part: 'any' },
  { tpl: 'maamarOther', name: 'מאמר אדמו״ר אחר', freq: 'weekly', weeklyDay: 6, part: 'any' },
  { tpl: 'book', name: 'ספר עם מונה', counter: true, unit: 'עמוד', pos: 1, total: 0, step: 1, freq: 'daily', part: 'evening' },
  { tpl: 'free', name: 'מסלול בהתאמה אישית', freq: 'daily', part: 'any' },
];
export const AUTO_KINDS = {
  chumash: 'חומש לפי פרשת השבוע', tanyaYomi: 'תניא יומי (לוח חב״ד)', psalms: 'תהילים חודשי', hayomyom: 'היום יום', rambam1: 'רמב״ם 1', rambam3: 'רמב״ם 3',
  dafYomi: 'דף יומי', mishnaYomi: 'משנה יומית', tanakhYomi: 'נ״ך יומי', nachYomi: 'נביאים יומי', dafWeekly: 'דף שבועי',
};
export const CHITAS = ['chumash', 'tehilim', 'tanya', 'hayomyom'];

export function newTrack(tpl, extra = {}) {
  const t = TEMPLATES.find((x) => x.tpl === tpl) || TEMPLATES[TEMPLATES.length - 1];
  const o = {
    id: uid('t'), tpl: t.tpl, name: t.name, auto: t.auto || '', counter: !!t.counter, unit: t.unit || '', pos: t.pos || 1, total: t.total || 0, step: t.step || 1,
    freq: t.freq || 'daily', days: [0, 1, 2, 3, 4, 5, 6], weeklyDay: t.weeklyDay == null ? 6 : t.weeklyDay, monthlyDay: 1,
    target: 1, part: t.part || 'any', remind: { mode: 'none', time: '21:00', zman: 'shkiah', rel: 'before', mins: 30, ring: false },
    url: t.url || '', paused: false, archived: false, order: 0, where: '', created: tishreiKey(),
  };
  return Object.assign(o, extra);
}
export function addTemplate(st, tpl) {
  const list = tpl === 'chitas' ? CHITAS : [tpl];
  for (const k of list) {
    const t = newTrack(k);
    t.order = st.tracks.length;
    st.tracks.push(t);
  }
}
export const activeTracks = (st) => st.tracks.filter((t) => !t.archived).sort((a, b) => a.order - b.order);

// ---- תוכן הלימוד לתאריך ----
export function learnInfo(track, date, st) {
  const loc = getLoc(st.settings);
  const out = { title: track.name, sub: '', url: track.url || '' };
  try {
    if (track.auto === 'chumash') {
      const p = parshaOfWeek(date, loc, st.settings);
      if (p) out.sub = 'פרשת ' + p + ' - ' + ALIYOT[date.getDay()];
    } else if (track.auto === 'tanyaYomi') {
      const code = TANYA_DAYS[dkey(date)];
      out.sub = code ? tanyaText(code) : 'לוח התניא לתאריך הזה יתווסף בעדכון';
    } else if (track.auto === 'hayomyom') {
      out.sub = hebrewDayMonth(date);
    } else if (track.auto) {
      const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
      const r = DailyLearning.lookup(track.auto, new HDate(noon));
      if (r) {
        out.sub = stripNikud(r.render ? r.render('he') : String(r.name || '')).replace(/^דף יומי:\s*/, '');
        if (track.auto === 'psalms') {
          const rng = out.sub.replace(/^תה[יל]*ים/, '').replace(/\s+/g, ' ').trim();
          out.sub = 'ליום ' + hebrewDayLetter(date) + ' לחודש, ' + (rng.includes('-') ? 'פרקים ' + rng.replace(/\s*-\s*/, ' - ') : 'פרק ' + rng);
        }
        if (r.url) out.url = r.url();
      }
    } else if (track.counter) {
      out.sub = track.tpl === 'tanya' ? tanyaPos(track.pos) : (track.unit || 'מקום') + ' ' + track.pos + (track.total ? ' מתוך ' + track.total : '');
    }
  } catch (e) { /* ממשיך בלי פירוט */ }
  if (track.where) out.where = track.where;
  return out;
}
export const progressOf = (t) => (t.counter && t.total ? Math.max(0, Math.min(1, (t.pos - 1) / t.total)) : null);

// ---- ימים חופשיים ומיוחדים ----
export function isFreeDay(st, key) {
  if (st.special[key]) return true;
  if (st.settings.vacation) return key >= dkey(new Date(st.created)) && key <= dkey(new Date());
  return st.vacations.some((v) => key >= v.from && key <= v.to);
}

// ---- מי חייב ביום מסוים ----
export function isDue(track, key) {
  if (track.archived || track.paused) return false;
  if (track.created && key < track.created) return false;
  const d = parseKey(key);
  switch (track.freq) {
    case 'daily': return true;
    case 'days': return (track.days || []).includes(d.getDay());
    case 'weekly': return d.getDay() === track.weeklyDay;
    case 'monthly': return new HDate(d).getDate() === Number(track.monthlyDay);
    default: return true;
  }
}
export const dueTracks = (st, key) => activeTracks(st).filter((t) => isDue(t, key));

// ---- סימונים ----
export const getEntry = (st, key, id) => (st.entries[key] || {})[id] || null;

// האם סימון בזמן "עכשיו" ליום key נחשב באיחור (שבת וחג: אפשר להשלים עד מוצאי השבת/החג)
export function isLateMark(st, key, nowKey) {
  if (nowKey <= key) return false;
  const loc = getLoc(st.settings);
  let d = parseKey(key);
  if (isRestDay(d, loc, st.settings)) {
    while (isRestDay(addDays(d, 1), loc, st.settings)) d = addDays(d, 1);
    return nowKey > dkey(addDays(d, 1));
  }
  return true;
}

export function setEntry(st, key, track, status, nowKey, note) {
  const day = (st.entries[key] = st.entries[key] || {});
  const prev = day[track.id];
  if (!status) {
    if (prev && prev.p != null && track.counter && track.pos === prev.p + track.step) track.pos = prev.p;
    delete day[track.id];
    if (!Object.keys(day).length) delete st.entries[key];
    return;
  }
  const e = { s: status, t: Date.now() };
  if (status === 'done' && isLateMark(st, key, nowKey)) e.s = 'late';
  if (note || (prev && prev.n)) e.n = note != null ? note : prev.n;
  if (prev && prev.p != null) e.p = prev.p;
  if ((e.s === 'done' || e.s === 'late') && track.counter && !(prev && (prev.s === 'done' || prev.s === 'late'))) { e.p = track.pos; track.pos += track.step; }
  day[track.id] = e;
}
export const isDoneStatus = (e, st) => !!e && (e.s === 'done' || (e.s === 'late' && st.settings.countLate));

// ---- מצב יום: full/partial/missing/none/special ----
export function dayStatus(st, key) {
  const due = dueTracks(st, key);
  const day = st.entries[key] || {};
  let done = 0, late = 0, skipped = 0, total = 0;
  for (const t of due) {
    const e = day[t.id];
    if (e && e.s === 'skip') { skipped++; continue; }
    total++;
    if (e && (e.s === 'done' || e.s === 'late')) { done++; if (e.s === 'late') late++; }
  }
  const lateOk = st.settings.countLate;
  const counted = done - (lateOk ? 0 : late);
  let kind;
  if (isFreeDay(st, key)) kind = 'special';
  else if (!total) kind = 'none';
  else if (counted >= total) kind = 'full';
  else if (counted > 0) kind = 'partial';
  else kind = 'missing';
  return { kind, total, done, late, skipped };
}

// ---- רצף ----
export function firstKey(st) {
  let m = dkey(new Date(st.created));
  for (const t of st.tracks) if (t.created && t.created < m) m = t.created;
  for (const k in st.entries) if (k < m) m = k;
  return m;
}
export function streak(st, todayK) {
  const first = firstKey(st);
  let cur = 0, k = todayK, d = parseKey(k);
  const t = dayStatus(st, k);
  if (t.kind === 'full') cur++;
  d = addDays(d, -1);
  for (let i = 0; i < 2000; i++) {
    k = dkey(d);
    if (k < first) break;
    const s = dayStatus(st, k);
    if (s.kind === 'full') cur++;
    else if (s.kind === 'none' || s.kind === 'special') { /* מדלג */ }
    else break;
    d = addDays(d, -1);
  }
  let best = 0, run = 0;
  d = parseKey(first);
  const end = parseKey(todayK);
  while (d <= end) {
    const s = dayStatus(st, dkey(d));
    if (s.kind === 'full') { run++; if (run > best) best = run; }
    else if (s.kind === 'missing' || s.kind === 'partial') { if (dkey(d) !== todayK) run = 0; }
    d = addDays(d, 1);
  }
  return { cur, best: Math.max(best, cur) };
}
// ימים חסרים (עד חלון ההשלמה) לפני היום
// כמה ימים אחורה בודקים: 7/14/30, החודש העברי הנוכחי, או השנה העברית
export function windowDays(s, todayK) {
  const w = s.lateWindow;
  if (w === 'month' || w === 'year') {
    const t = parseKey(todayK), h = new HDate(t);
    const start = (w === 'month' ? new HDate(1, h.getMonth(), h.getFullYear()) : new HDate(1, 7, h.getFullYear())).greg();
    return Math.max(0, Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000));
  }
  return Number(w) || 14;
}
export function missingDays(st, todayK) {
  const out = [];
  const first = firstKey(st);
  let d = addDays(parseKey(todayK), -1);
  const n = windowDays(st.settings, todayK);
  for (let i = 0; i < n; i++) {
    const k = dkey(d);
    if (k < first) break;
    const s = dayStatus(st, k);
    if (s.kind === 'missing' || s.kind === 'partial') out.push(k);
    d = addDays(d, -1);
  }
  return out;
}
export function pctRange(st, fromKey, toKey) {
  let due = 0, ok = 0;
  let d = parseKey(fromKey);
  const end = parseKey(toKey);
  while (d <= end) {
    const s = dayStatus(st, dkey(d));
    if (s.kind === 'full' || s.kind === 'partial' || s.kind === 'missing') { due += s.total; ok += s.done - (st.settings.countLate ? 0 : s.late); }
    d = addDays(d, 1);
  }
  return due ? Math.round((ok / due) * 100) : 0;
}
export function trackPct(st, track, days, todayK) {
  let due = 0, ok = 0;
  let d = parseKey(todayK);
  for (let i = 0; i < days; i++) {
    const k = dkey(d);
    if (isDue(track, k) && !isFreeDay(st, k)) { due++; const e = getEntry(st, k, track.id); if (isDoneStatus(e, st)) ok++; }
    d = addDays(d, -1);
  }
  return due ? Math.round((ok / due) * 100) : 0;
}
export function lateCount(st, fromKey, toKey) {
  let n = 0;
  for (const k in st.entries) if (k >= fromKey && k <= toKey) for (const id in st.entries[k]) if (st.entries[k][id].s === 'late') n++;
  return n;
}
// כל המסלולים של היום סומנו (לכפתור "סימנתי הכל")
export function markAll(st, key, nowKey) {
  const changed = [];
  for (const t of dueTracks(st, key)) {
    const e = getEntry(st, key, t.id);
    if (!e || e.s === 'skip') { setEntry(st, key, t, 'done', nowKey); changed.push(t.id); }
  }
  return changed;
}
export function undoMark(st, key, ids, nowKey) {
  for (const id of ids) { const t = st.tracks.find((x) => x.id === id); if (t) setEntry(st, key, t, null, nowKey); }
}
