// בניית רשימת ההתראות העתידיות (עד 60 יום) מחושבת מראש בטלפון, לשליחה ל-Android
import { HDate } from '@hebcal/core';
import { dkey, addDays, hhmm, hebrewDayMonth, stripNikud, parseKey } from './dates.js';
import { getLoc, zmanimFor, restIntervals, inRest, isRoshChodesh, isRestDay, omerDay, timedOn, todayKey, zmanName } from './zm.js';
import { isDue, getEntry, isFreeDay, activeTracks, learnInfo } from './tracks.js';
import { chabadOn } from './chabad.js';

export const REL = { before: 'לפני', at: 'בזמן', after: 'אחרי' };
export const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

export function newAlarm(type = 'zman') {
  return {
    id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type, label: '', enabled: true,
    zman: 'shkiah', rel: 'before', mins: 30, time: '07:30', date: '', days: [0, 1, 2, 3, 4, 5, 6], noRest: true, ring: true, repeat: false, snooze: true, pre: 0,
  };
}
export const ALARM_TEMPLATES = [
  { name: '30 דקות לפני שקיעה', a: { type: 'zman', zman: 'shkiah', rel: 'before', mins: 30 } },
  { name: '15 דקות לפני סוף זמן ק״ש', a: { type: 'zman', zman: 'shma', rel: 'before', mins: 15 } },
  { name: 'מנחה גדולה', a: { type: 'zman', zman: 'gedola', rel: 'at', mins: 0 } },
  { name: 'חצות היום', a: { type: 'zman', zman: 'chatzot', rel: 'at', mins: 0 } },
  { name: 'ערב שבת: 70 דקות לפני שקיעה (ימי שישי)', a: { type: 'zman', zman: 'shkiah', rel: 'before', mins: 70, days: [5] } },
];

export function alarmTitle(a, st) {
  if (a.label) return a.label;
  if (a.type === 'fixed') return 'התראה ב-' + a.time;
  if (a.type === 'learning') {
    const t = st.tracks.find((x) => x.id === a.trackId);
    return 'תזכורת לימוד' + (t ? ': ' + t.name : '');
  }
  return (a.rel === 'at' ? '' : a.mins + ' דקות ' + REL[a.rel] + ' ') + zmanName(a.zman);
}
// כותרת קצרה להתראה מחושבת (גם תזכורות אוטומטיות ולימוד)
export function instTitle(i) {
  return i.title === 'זמן לימוד' && i.text ? i.text.replace(' - עדיין לא סומן היום', '').replace('עכשיו ', 'לימוד: ') : i.title;
}
export function daysLabel(days, date) {
  if (date) { const p = date.split('-'); return 'בתאריך ' + hebrewDayMonth(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12)); }
  if (!days || days.length === 7) return 'כל יום';
  return days.map((d) => DAY_LETTERS[d]).join('׳ ') + '׳';
}

const toMs = (d, hm) => { const [h, m] = hm.split(':').map(Number); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0).getTime(); };
const relMs = (base, rel, mins) => base.getTime() + (rel === 'before' ? -mins : rel === 'after' ? mins : 0) * 60000;
function inQuiet(st, ms) {
  const s = st.settings;
  if (!s.quiet) return false;
  const d = new Date(ms), cur = d.getHours() * 60 + d.getMinutes();
  const [fh, fm] = s.quietFrom.split(':').map(Number), [th, tm] = s.quietTo.split(':').map(Number);
  const f = fh * 60 + fm, t = th * 60 + tm;
  return f <= t ? cur >= f && cur < t : cur >= f || cur < t;
}

// withPre: כולל גם התראות מקדימות (פינג בוילון), רק לשליחה ל-Android ולא לרשימות המסך
export function buildInstances(st, now = new Date(), days = 60, max = 480, withPre = false) {
  const s = st.settings, loc = getLoc(s);
  const out = [];
  const seen = new Set();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const intervals = restIntervals(start, addDays(start, days + 2), loc, s);
  const nowMs = now.getTime();
  const common = { snooze: s.snoozeMin, rep: s.repeatUntilOff, sound: s.sound, snd: s.soundUri || '', ramp: s.ramp, vib: s.vibrate };
  const push = (o) => {
    if (o.t <= nowMs + 1000 || seen.has(o.id) || (o.pre && !withPre)) return;
    if (o.kind === 'ring' && inQuiet(st, o.t)) o.kind = 'notify';
    seen.add(o.id);
    out.push(Object.assign({}, common, o));
  };
  const learnAlarms = [];
  for (const t of activeTracks(st)) {
    const r = t.remind;
    if (r && r.mode !== 'none' && !t.paused) learnAlarms.push({ track: t, r });
  }
  for (const a of st.alarms) if (a.enabled && a.type === 'learning') learnAlarms.push({ track: st.tracks.find((x) => x.id === a.trackId), r: { mode: a.timeMode || 'time', time: a.time, zman: a.zman, rel: a.rel, mins: a.mins, ring: a.ring }, alarm: a });

  for (let i = 0; i <= days; i++) {
    const date = addDays(start, i);
    const key = dkey(date);
    const z = zmanimFor(date, loc, s.method, s.tzeitMode);
    const dow = date.getDay();
    // התראות רגילות
    for (const a of st.alarms) {
      if (!a.enabled || a.type === 'learning') continue;
      if (a.date) { if (a.date !== key) continue; } else if (!(a.days || []).includes(dow)) continue;
      let t = null;
      if (a.type === 'fixed') t = toMs(date, a.time);
      else if (z[a.zman]) t = relMs(z[a.zman], a.rel, a.mins);
      if (t == null) continue;
      if (a.noRest !== false && inRest(t, intervals)) continue;
      push({ id: 'A|' + a.id + '|' + key, t, kind: a.ring === false ? 'notify' : 'ring', title: alarmTitle(a, st), text: a.type === 'zman' && z[a.zman] ? zmanName(a.zman) + ' ב-' + hhmm(z[a.zman], loc.tz) : '', rep: a.repeat ? true : common.rep, snooze: a.repeat || a.snooze === false ? 0 : (a.snoozeMin || s.snoozeMin) });
      const pre = Number(a.pre) || 0;
      if (pre > 0) push({ id: 'P|' + a.id + '|' + key, t: t - pre * 60000, kind: 'notify', pre: true, until: t, title: 'בעוד ' + pre + ' דק׳: ' + alarmTitle(a, st), text: '' });
    }
    // תזכורות לימוד: רק אם לא סומן
    for (const { track, r, alarm } of learnAlarms) {
      if (!track) continue;
      let t = null;
      const mode = r.mode;
      if (mode === 'time') t = toMs(date, r.time || '21:00');
      else if (mode === 'zman' && z[r.zman]) t = relMs(z[r.zman], r.rel || 'before', r.mins || 0);
      if (t == null || t <= nowMs) continue;
      const dk = todayKey(s, new Date(t));
      if (!isDue(track, dk) || isFreeDay(st, dk)) continue;
      const e = getEntry(st, dk, track.id);
      if (e && (e.s === 'done' || e.s === 'late' || e.s === 'skip')) continue;
      if ((alarm ? alarm.noRest !== false : true) && inRest(t, intervals)) continue;
      let sub = '';
      try { sub = learnInfo(track, parseKey(dk), st).sub; } catch (e) { /* */ }
      push({ id: 'L|' + track.id + '|' + dk, t, kind: (alarm ? alarm.ring : r.ring) ? 'ring' : 'learn', title: 'זמן לימוד', text: 'עכשיו ' + track.name + (sub ? ': ' + sub : '') + ' - עדיין לא סומן היום', dk, tid: track.id });
      const lpre = Number(alarm ? alarm.pre : r.pre) || 0;
      if (lpre > 0) push({ id: 'LP|' + track.id + '|' + dk, t: t - lpre * 60000, kind: 'notify', pre: true, until: t, title: 'בעוד ' + lpre + ' דק׳: זמן לימוד', text: track.name + (sub ? ': ' + sub : '') });
    }
    // תזכורות אוטומטיות
    const au = s.auto || {}, at = s.autoTimes || {};
    if (au.roshChodesh && isRoshChodesh(date, loc, s)) push({ id: 'RC|' + key, t: toMs(date, at.roshChodesh || '08:00'), kind: 'notify', title: 'ראש חודש', text: 'היום ראש חודש - יעלה ויבוא, הלל' });
    const tmr = addDays(date, 1);
    if (au.erevShabbat && !isRestDay(date, loc, s) && isRestDay(tmr, loc, s)) {
      const tt = timedOn(date, loc, s);
      push({ id: 'ES|' + key, t: toMs(date, at.erevShabbat || '12:00'), kind: 'notify', title: dow === 5 ? 'ערב שבת' : 'ערב חג', text: tt.candles ? 'הדלקת נרות ב-' + hhmm(tt.candles, loc.tz) : 'מתכוננים לשבת וחג' });
    }
    if (au.candles) {
      const tt = timedOn(date, loc, s);
      if (tt.candles) push({ id: 'CN|' + key, t: tt.candles.getTime() - (s.candleBefore || 20) * 60000, kind: 'notify', title: 'הדלקת נרות', text: 'הדלקת נרות ב-' + hhmm(tt.candles, loc.tz) + ' (בעוד ' + (s.candleBefore || 20) + ' דקות)' });
    }
    // נרות חנוכה: התראה לפני כל הדלקה, נר 1 עד 8
    if (au.chanukah !== false) {
      const hdd = new HDate(date);
      const night = hdd.abs() - new HDate(24, 'Kislev', hdd.getFullYear()).abs() + 1;
      if (night >= 1 && night <= 8) {
        const tt = timedOn(date, loc, s);
        const lit = dow === 5 && tt.candles ? tt.candles : dow === 6 && tt.havdalah ? tt.havdalah : z.tzeit;
        if (lit) push({ id: 'CK|' + key, t: lit.getTime() - (s.candleBefore || 20) * 60000, kind: 'notify', title: 'נר ' + night + ' של חנוכה', text: (dow === 5 ? 'לפני הדלקת נרות שבת. ' : '') + 'הדלקה ב-' + hhmm(lit, loc.tz) + ' (בעוד ' + (s.candleBefore || 20) + ' דקות)' });
      }
    }
    if (au.omer) {
      const n = omerDay(tmr, loc, s);
      if (n) push({ id: 'OM|' + key, t: toMs(date, at.omer || '21:00'), kind: 'notify', title: 'ספירת העומר', text: 'הלילה סופרים ' + n + ' בעומר' });
    }
    if (s.chabadDates) {
      const h = new HDate(date);
      for (const c of chabadOn(s)) {
        if (c.m === h.getMonth() && c.d === h.getDate()) push({ id: 'CH|' + key + c.d, t: toMs(date, '08:00'), kind: 'notify', title: hebrewDayMonth(date), text: c.t });
      }
    }
    // יארצייט ויום הולדת
    for (const y of st.yahrzeits) {
      const h = new HDate(date);
      const before = new HDate(addDays(date, y.before ? 1 : 0));
      const ok = (hh) => (hh.getMonth() === y.m || (y.m === 12 && hh.getMonth() === 13)) && hh.getDate() === y.d;
      if (y.remind !== false && ok(before)) push({ id: 'Y|' + y.id + '|' + key, t: toMs(date, y.time || '09:00'), kind: 'notify', title: y.type === 'birthday' ? 'יום הולדת עברי' : 'יום זיכרון', text: y.name + (y.before ? ' - מחר' : ' - היום') });
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out.slice(0, max);
}
