// בדיקות לוגיקה: node scripts/test.mjs
import { defaults, replaceAll, get } from '../src/lib/store.js';
import { getLoc, zmanimFor, parshaOfWeek, isRestDay, restIntervals, inRest, todayKey, bearingTo, dayEvents } from '../src/lib/zm.js';
import { gematria, tishreiKey, hhmm, dkey, parseKey, hebrewDate, addDays } from '../src/lib/dates.js';
import { newTrack, addTemplate, dueTracks, setEntry, dayStatus, streak, learnInfo, isLateMark, missingDays, markAll, undoMark, getEntry } from '../src/lib/tracks.js';
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
eq(st.tracks.length, 5, 'chitas = 5 tracks');
const today = '2026-10-16';
st.tracks.forEach((t) => (t.created = '2026-10-01'));
eq(dueTracks(st, today).length, 5, 'all due daily');
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
  eq(learnInfo(tn, new Date(2026, 9, 18, 12), st3).sub, 'אגרת הקודש, אגרת כ״ו, מפסקה כ׳', 'tanya 18.10.2026');
  eq(learnInfo(tn, new Date(2026, 11, 4, 12), st3).sub, 'ליקוטי אמרים, פרק א׳, מפסקה א׳', 'tanya 4.12.2026');
  eq(learnInfo(tn, new Date(2027, 5, 11, 12), st3).sub, 'שער היחוד והאמונה, חינוך קטן, מפסקה א׳', 'tanya 11.6.2027'); }
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
// שבת/חג וערבם: משקיעה עד צאת הכוכבים, ברירת מחדל של התראה חדשה
{
  const stR = defaults(); const sR = stR.settings; const locR = getLoc(sR);
  const fri = new Date(2026, 9, 23, 12), sat = new Date(2026, 9, 24, 12);
  const zf = zmanimFor(fri, locR, sR.method, sR.tzeitMode), zs = zmanimFor(sat, locR, sR.method, sR.tzeitMode);
  const iv = restIntervals(fri, sat, locR, sR);
  const mk = (d, hh, mm) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm).getTime();
  const cand = iv.find((x) => x[0] > mk(fri, 0, 0) && x[0] < mk(fri, 23, 59));
  ok(!!cand, 'rest interval found on erev shabbat');
  ok(inRest(cand[0] + 60000, iv), 'rest starts at candle lighting');
  ok(!inRest(cand[0] - 60000, iv), 'before candle lighting is not rest');
  ok(inRest(mk(sat, 12, 0), iv), 'shabbat noon is rest');
  ok(inRest(cand[1] - 60000, iv), 'just before havdalah is rest');
  ok(!inRest(cand[1] + 60000, iv), 'after havdalah is not rest');
  eq(newAlarm('fixed').noRest, true, 'new alarm excludes shabbat/chag by default');
}
// חת״ת חמישה מסלולים: שדרוג ממצב ישן מוסיף "משיח וגאולה" ולא נוגע בקיים
{
  const old = defaults(); old.v = 5;
  for (const k of ['chumash', 'tehilim', 'tanya', 'hayomyom']) addTemplate(old, k);
  const t0 = old.tracks[0];
  old.entries['2026-10-18'] = { [t0.id]: { s: 'done', t: 1 } };
  replaceAll(JSON.parse(JSON.stringify(old)));
  const s2 = get();
  eq(s2.tracks.length, 5, 'moshiach added on upgrade');
  eq(s2.tracks[4].name, 'משיח וגאולה יומי', 'moshiach name');
  eq(s2.tracks[0].name, 'חומש עם רש״י', 'existing name kept');
  eq(s2.entries['2026-10-18'][t0.id].s, 'done', 'history kept');
  replaceAll(JSON.parse(JSON.stringify(s2)));
  eq(get().tracks.length, 5, 'moshiach not added twice');
  const fresh = defaults(); addTemplate(fresh, 'chitas');
  eq(fresh.tracks.length, 5, 'chitas template has 5');
}
// ---- סבב 18 ----
{
  const { newTrack, tanyaLink } = await import('../src/lib/tracks.js');
  const s18 = defaults(); addTemplate(s18, 'chitas');
  const now18 = new Date(2026, 11, 3, 8, 0);
  const inst = buildInstances(s18, now18, 10, 500);
  const ck = inst.filter((i) => i.id.startsWith('CK|'));
  eq(ck.length, 8, 'chanukah 8 candle reminders');
  eq(ck[0].title, 'נר 1 של חנוכה', 'chanukah night 1 title');
  eq(ck[0].id, 'CK|2026-12-04', 'chanukah night 1 date');
  ok(ck.find((i) => i.id === 'CK|2026-12-04').text.startsWith('לפני הדלקת נרות שבת'), 'chanukah friday text');
  s18.settings.auto.chanukah = false;
  eq(buildInstances(s18, now18, 10, 500).filter((i) => i.id.startsWith('CK|')).length, 0, 'chanukah toggle off');
  const al = Object.assign(newAlarm('fixed'), { time: '09:00', pre: 10, days: [0, 1, 2, 3, 4, 5, 6], noRest: false });
  s18.alarms.push(al);
  eq(buildInstances(s18, now18, 3, 500).filter((i) => i.id.startsWith('P|')).length, 0, 'pre hidden from lists');
  const pre = buildInstances(s18, now18, 3, 500, true).filter((i) => i.id.startsWith('P|'));
  ok(pre.length >= 2, 'pre pings built');
  const main0 = buildInstances(s18, now18, 3, 500).find((i) => i.id === 'A|' + al.id + '|2026-12-03');
  eq(pre[0].t, main0.t - 600000, 'pre is 10 minutes before');
  eq(pre[0].kind, 'notify', 'pre is a quiet notification');
  eq(pre[0].until, main0.t, 'pre disappears when the alarm fires');
  const s19 = defaults(); addTemplate(s19, 'chitas');
  const tk = s19.tracks[0]; tk.remind = { mode: 'time', time: '21:00', zman: 'shkiah', rel: 'before', mins: 30, ring: false };
  const li = buildInstances(s19, new Date(2026, 9, 21, 8, 0), 1, 100).find((i) => i.id.startsWith('L|' + tk.id));
  ok(li.text.includes('פרשת'), 'learning reminder includes the day portion: ' + li.text);
  const tn = s19.tracks.find((x) => x.tpl === 'tanya');
  const u = learnInfo(tn, new Date(2026, 9, 21, 12), s19).url;
  ok(u.startsWith('https://www.sefaria.org.il/Tanya%2C_Part_IV%3B_Iggeret_HaKodesh.') && /\.\d+\.\d+\?lang=he$/.test(u), 'tanya sefaria link ' + u);
  const hy = s19.tracks.find((x) => x.tpl === 'hayomyom');
  ok(learnInfo(hy, new Date(2026, 9, 21, 12), s19).url.includes('tdate=10/21/2026'), 'chabad link has tdate');
  const ch = s19.tracks.find((x) => x.tpl === 'chumash');
  ok(learnInfo(ch, new Date(2026, 9, 21, 12), s19).url.includes('torahreading.asp?tdate='), 'chumash link');
  eq(tanyaLink('L|x1|1'), 'https://www.sefaria.org.il/Tanya%2C_Part_I%3B_Likkutei_Amarim?lang=he', 'tanya special page link');
// בורר מקורות לימוד
{
  const d = new Date(2026, 9, 23, 12);
  const mk = (tpl) => { const t = newTrack(tpl); return t; };
  const info = (tpl, src) => { const t = mk(tpl); if (src != null) t.src = src; return learnInfo(t, d, s19); };
  eq(info('chumash').url, 'https://he.chabad.org/dailystudy/torahreading.asp?tdate=10/23/2026', 'chumash src0');
  ok(/chabad\.org\.il\/Lessons\/Chumash\.asp\?CategoryID=175&DateParam=-?\d+$/.test(info('chumash', 1).url), 'chumash src1 DateParam');
  eq(info('chumash', 2).url, 'https://www.chabad.org/dailystudy/torahreading.asp?tdate=10/23/2026', 'chumash src2');
  eq(info('hayomyom', 2).url, 'https://www.chabad.org/dailystudy/hayomyom.asp?tdate=10/23/2026', 'hayomyom en');
  ok(info('tehilim', 2).url.startsWith('https://www.sefaria.org.il/Psalms.'), 'tehilim sefaria il ' + info('tehilim', 2).url);
  eq(info('mishna', 1).url, 'https://he.wikisource.org/wiki/' + encodeURIComponent('משנה_אהלות_יב'), 'mishna wikisource');
  eq(info('nach', 1).url, 'https://he.wikisource.org/wiki/' + encodeURIComponent('שופטים_ג'), 'nach wikisource');
  eq(info('halacha', 1).url, 'https://he.wikisource.org/wiki/' + encodeURIComponent('קיצור_שולחן_ערוך_י'), 'kitzur wikisource');
  eq(info('dafyomi', 1).url, 'https://www.dafyomi.org/index.php?masechta=bechoros&daf=35a&page=insights', 'dafyomi.org');
  ok(info('shnayim', 2).url.startsWith('https://www.hebcal.com/sedrot/lech-lecha-20261024'), 'shnayim hebcal ' + info('shnayim', 2).url);
  eq(info('shnayim', 1).url, 'https://www.chabad.org/parshah/torahreading.asp?tdate=10/24/2026', 'shnayim chabad.org');
  eq(info('rambam3', 0).url, 'https://he.chabad.org/dailystudy/rambam.asp?rambamchapters=3&tdate=10/23/2026', 'rambam3 src0');
  const tt = mk('chumash'); tt.url = 'https://example.com/x';
  eq(learnInfo(tt, d, s19).url, 'https://example.com/x', 'custom url wins');
}
  eq(newTrack('tefillin').days.length, 6, 'tefillin Sun-Fri');
  eq(newTrack('tzedaka').freq, 'daily', 'tzedaka daily');
  for (const tp of ['halacha', 'sefermitzvos', 'shnayim']) { const x = newTrack(tp); ok(learnInfo(x, new Date(2026, 9, 21, 12), s19).sub.length > 3, tp + ' has daily text'); }
}
// סבב 19: הבדלה, בלי "ערב שבת", ורגע החלפת היום
{
  const { dayChangeMs } = await import('../src/lib/zm.js');
  const st2 = defaults();
  const items = buildInstances(st2, new Date(2026, 9, 22, 9), 4, 100);
  ok(items.some((i) => i.id === 'HV|2026-10-24'), 'havdalah reminder on Shabbat');
  ok(!items.some((i) => i.id.startsWith('ES|')), 'no erev-shabbat reminder');
  st2.settings.auto.havdalah = false;
  ok(!buildInstances(st2, new Date(2026, 9, 22, 9), 4, 100).some((i) => i.id.startsWith('HV|')), 'havdalah toggle off');
  st2.settings.dayChange = 'midnight';
  ok(dayChangeMs(st2.settings, new Date(2026, 9, 22)) === null, 'midnight: no flip');
  st2.settings.dayChange = 'sunset';
  const f = dayChangeMs(st2.settings, new Date(2026, 9, 22));
  { const hm = hhmm(new Date(f), loc.tz); ok(f && hm >= '16:00' && hm <= '19:00', 'sunset flip in the afternoon/evening (' + hm + ')'); }
  st2.settings.dayChange = 'time'; st2.settings.dayChangeTime = '20:30';
  eq(new Date(dayChangeMs(st2.settings, new Date(2026, 9, 22))).getHours(), 20, 'fixed time flip');
}
// חוברות דבר מלכות
{
  const { weeklyBooklets } = await import('../src/lib/dm.js');
  const fri = weeklyBooklets(new Date(2026, 9, 23, 12), true, false);
  eq(fri.length, 2, 'dm two links');
  ok(fri[0].title.startsWith('לך לך') && fri[0].label === 'השבוע', 'dm this week ' + fri[0].title);
  ok(fri[1].title.startsWith('נח') && fri[1].label === 'השבוע שעבר', 'dm last week ' + fri[1].title);
  const sat = weeklyBooklets(new Date(2026, 9, 24, 12), true, true);
  ok(sat[0].title.startsWith('וירא') && sat[0].label === 'השבוע הבא' && sat[1].title.startsWith('לך לך') && sat[1].label === 'השבוע', 'dm motzei shabbat ' + sat.map((x) => x.title));
  ok(fri[0].url.startsWith('https://dvarmalchus.com/Download/') && fri[0].url.endsWith('.pdf'), 'dm url');
  const bk = weeklyBooklets(new Date(2026, 9, 6, 12), true, false);
  ok(bk[0].title.includes('בארץ הקודש'), 'dm bereshit il ' + bk[0].title);
  const bw = weeklyBooklets(new Date(2026, 9, 6, 12), false, false);
  ok(bw[0].title.includes('בכל העולם'), 'dm bereshit world ' + bw[0].title);
}
console.log(n + ' בדיקות, ' + fails + ' נכשלו');
process.exit(fails ? 1 : 0);
