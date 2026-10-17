// בדיקות לוגיקה: node scripts/test.mjs
import { defaults } from '../src/lib/store.js';
import { getLoc, zmanimFor, parshaOfWeek, isRestDay, restIntervals, inRest, todayKey, bearingTo, dayEvents } from '../src/lib/zm.js';
import { gematria, tishreiKey, hhmm, dkey, parseKey, hebrewDate, addDays } from '../src/lib/dates.js';
import { addTemplate, dueTracks, setEntry, dayStatus, streak, learnInfo, isLateMark, missingDays, markAll, undoMark, getEntry } from '../src/lib/tracks.js';
import { buildInstances, newAlarm } from '../src/lib/alarms.js';

let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.log('FAIL:', msg); } };
const eq = (a, b, msg) => ok(a === b, msg + ' (got ' + a + ', want ' + b + ')');

const st = defaults();
const s = st.settings;
const loc = getLoc(s);
eq(loc.name, 'ירושלים', 'default city');

// זמנים מול ערכים שאומתו מול Hebcal (ירושלים, 16.10.2026, בעל התניא)
const z = zmanimFor(new Date(2026, 9, 16, 12), loc, 'baal');
eq(hhmm(z.alot, loc.tz), '05:27', 'alot');
eq(hhmm(z.shma, loc.tz), '09:32', 'shma baal');
eq(hhmm(z.tfila, loc.tz), '10:29', 'tfila baal');
eq(hhmm(z.chatzot, loc.tz), '12:24', 'chatzot');
eq(hhmm(z.shkiah, loc.tz), '18:06', 'shkiah');
eq(hhmm(z.tzeit, loc.tz), '18:31', 'tzeit baal');
const zg = zmanimFor(new Date(2026, 9, 16, 12), loc, 'gra');
eq(hhmm(zg.shma, loc.tz), '09:34', 'shma gra');

// תאריך עברי ופרשה
eq(hebrewDate(new Date(2026, 9, 16, 12)).includes('חשוון') || hebrewDate(new Date(2026, 9, 16, 12)).includes('חשון'), true, 'hebrew date month');
eq(parshaOfWeek(new Date(2026, 9, 16, 12), loc, s), 'נח', 'parsha');
eq(isRestDay(new Date(2026, 9, 3, 12), loc, s), true, 'shmini atzeret rest');
eq(isRestDay(new Date(2026, 9, 7, 12), loc, s), false, 'weekday not rest');
eq(dayEvents(new Date(2026, 9, 11, 12), loc, s)[0], 'ראש חודש חשון', 'rosh chodesh');

// מצפן: מניו יורק לירושלים בערך 54 מעלות
const b = bearingTo(40.67, -73.94);
ok(b > 53 && b < 56, 'bearing NY ' + b);

// מסלולים
addTemplate(st, 'chitas');
eq(st.tracks.length, 4, 'chitas = 4 tracks');
const today = '2026-10-16';
st.tracks.forEach((t) => (t.created = '2026-10-01'));
eq(dueTracks(st, today).length, 4, 'all due daily');
const chumash = st.tracks.find((t) => t.tpl === 'chumash');
eq(learnInfo(chumash, parseKey(today), st).sub, 'פרשת נח - שישי', 'chumash label');
const tehilim = st.tracks.find((t) => t.tpl === 'tehilim');
ok(/^ליום .׳ לחודש, פרקים .+ - .+$/.test(learnInfo(tehilim, parseKey(today), st).sub), 'psalms label ' + learnInfo(tehilim, parseKey(today), st).sub);
eq(learnInfo(tehilim, new Date(2026, 9, 18, 12), st).sub, 'ליום ז׳ לחודש, פרקים ל״ט - מ״ג', 'psalms 7 Cheshvan');
const tanya = st.tracks.find((t) => t.tpl === 'tanya');
tanya.counter = true; tanya.pos = 1; tanya.step = 1; // בדיקת מנגנון המונה (בפועל התניא לפי לוח)
setEntry(st, today, tanya, 'done', today);
eq(tanya.pos, 2, 'tanya advanced');
setEntry(st, today, tanya, null, today);
eq(tanya.pos, 1, 'tanya reverted');

// סימון, יום מלא, רצף
for (let i = 1; i <= 5; i++) {
  const k = dkey(addDays(parseKey(today), -i));
  for (const t of st.tracks) setEntry(st, k, t, 'done', k);
}
eq(dayStatus(st, '2026-10-15').kind, 'full', 'full day');
eq(dayStatus(st, today).kind, 'missing', 'today missing before marking');
markAll(st, today, today);
eq(dayStatus(st, today).kind, 'full', 'full after markAll');
eq(streak(st, today).cur, 6, 'streak 6');
undoMark(st, today, st.tracks.map((t) => t.id), today);
eq(dayStatus(st, today).kind, 'missing', 'undo');
eq(streak(st, today).cur, 5, 'streak after undo');

// איחור ושבת: סימון ליום שבת במוצאי שבת = בזמן, יום חול = באיחור
const sat = '2026-10-17', sun = '2026-10-18', mon = '2026-10-19';
eq(isLateMark(st, sat, sun), false, 'sat completed on motzei is on time');
eq(isLateMark(st, sat, mon), true, 'sat completed monday late');
eq(isLateMark(st, '2026-10-14', today), true, 'weekday late');
eq(isLateMark(st, today, today), false, 'same day on time');
const wd = '2026-10-13';
setEntry(st, wd, tanya, null, today);
for (const t of st.tracks) setEntry(st, wd, t, null, today);
for (const t of st.tracks.slice(0, 2)) setEntry(st, wd, t, 'done', today);
eq(dayStatus(st, wd).kind, 'partial', 'partial day');
ok(missingDays(st, today).includes(wd), 'missing days include partial');
setEntry(st, wd, st.tracks[2], 'done', today);
eq(getEntry(st, wd, st.tracks[2].id).s, 'late', 'late flagged');
s.countLate = false;
eq(dayStatus(st, wd).kind, 'missing', 'late not counted when off');
s.countLate = true;

// התראות
const al = newAlarm('zman');
st.alarms.push(al); // 30 דקות לפני שקיעה כל יום
const fixed = newAlarm('fixed'); fixed.time = '05:45'; fixed.days = [0, 1, 2, 3, 4]; fixed.noRest = true; st.alarms.push(fixed);
const now = new Date(2026, 9, 16, 8, 0, 0);
const inst = buildInstances(st, now, 14);
ok(inst.length > 10, 'instances built ' + inst.length);
ok(inst.every((i) => i.t > now.getTime()), 'all future');
// שבת וחג: אין התראה בתוך שבת
const rest = restIntervals(now, addDays(now, 20), loc, s);
ok(inst.filter((i) => i.id.startsWith('A|')).every((i) => !inRest(i.t, rest)), 'no alarm inside shabbat');
ok(inst.some((i) => i.id.startsWith('ES|')), 'erev shabbat reminder exists');
// תזכורת לימוד: מדלגת אם סומן
tanya.remind = { mode: 'time', time: '21:00', zman: 'shkiah', rel: 'before', mins: 30, ring: false };
const a1 = buildInstances(st, now, 3).filter((i) => i.id.startsWith('L|'));
ok(a1.length >= 1, 'learning reminder exists');
const dk = a1[0].dk;
for (const t of st.tracks) setEntry(st, dk, t, 'done', dk);
const a2 = buildInstances(st, now, 3).filter((i) => i.id === a1[0].id);
eq(a2.length, 0, 'learning reminder skipped when done');

s.loc = { mode: 'city', cityId: 'newyork' };
eq(getLoc(s).name, 'ניו יורק', 'location from settings');
ok(buildInstances(st, now, 3).length > 0, 'instances with NY');
// שנה עברית עם ה׳, ותחילת תשרי
ok(/ה[א-ת]+״[א-ת]$/.test(hebrewDate(new Date(2026, 9, 16))), 'hebrew year starts with he: ' + hebrewDate(new Date(2026, 9, 16)));
eq(tishreiKey(new Date(2026, 9, 16)), '2026-09-12', 'tishrei key');
eq(defaults().settings.auto.omer, true, 'omer default on');
// גימטריה, מרחשון, החלפת יום
eq(gematria(26), 'כ״ו', 'gematria 26'); eq(gematria(15), 'ט״ו', 'gematria 15'); eq(gematria(7), 'ז׳', 'gematria 7');
ok(hebrewDate(new Date(2026, 9, 18)).includes('מרחשון'), 'marcheshvan name');
{ const sx = defaults().settings; sx.dayChange = 'time'; sx.dayChangeTime = '21:00'; eq(todayKey(sx, new Date(2026, 9, 18, 21, 30)), '2026-10-19', 'day changes at custom time'); eq(todayKey(sx, new Date(2026, 9, 18, 20, 30)), '2026-10-18', 'before custom time'); eq(todayKey(defaults().settings, new Date(2026, 9, 18, 23, 30)), '2026-10-18', 'default change at midnight'); }
// לוח התניא היומי
{ const st3 = defaults(); addTemplate(st3, 'tanya'); const tn = st3.tracks[0];
  eq(learnInfo(tn, new Date(2026, 9, 18, 12), st3).sub, 'אגרת הקודש, אמצע אגרת כ״ו', 'tanya 18.10.2026');
  eq(learnInfo(tn, new Date(2026, 11, 4, 12), st3).sub, 'ליקוטי אמרים, תחילת פרק א׳', 'tanya 4.12.2026');
  eq(learnInfo(tn, new Date(2027, 5, 11, 12), st3).sub, 'שער היחוד והאמונה, הקדמה', 'tanya 11.6.2027'); }
// התראה בתאריך מסוים: מופיעה רק בו
{
  const st2 = defaults();
  const al = Object.assign(newAlarm('fixed'), { time: '09:00', date: '2026-10-20', noRest: false });
  st2.alarms.push(al);
  const inst = buildInstances(st2, new Date(2026, 9, 16, 10), 10).filter((i) => i.id.startsWith('A|' + al.id));
  eq(inst.length, 1, 'dated alarm fires once');
  eq(inst[0].id.split('|')[2], '2026-10-20', 'dated alarm on right date');
  st2.settings.chabadList = [{ id: 'x', m: 8, d: 5, t: 'בדיקה', on: false }];
  eq(buildInstances(st2, new Date(2026, 9, 16, 10), 60).filter((i) => i.id.startsWith('CH|')).length, 0, 'chabad off respected');
}
console.log(n + ' בדיקות, ' + fails + ' נכשלו');
process.exit(fails ? 1 : 0);
