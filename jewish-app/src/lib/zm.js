// חישוב זמנים הלכתיים, חגים ופרשה. הכל מחושב בתוך הטלפון, בלי אינטרנט.
import { HebrewCalendar, Zmanim, GeoLocation, Location, flags } from '@hebcal/core';
import { dkey, parseKey, addDays, roundMin, stripNikud } from './dates.js';
import { cityById, deviceTz } from './cities.js';

export const METHODS = { baal: 'בעל התניא', gra: 'הגר״א', mga: 'מגן אברהם' };

// id, שם, פונקציה לפי שיטה
export const ZMAN_DEFS = [
  { id: 'alot', name: 'עלות השחר', fn: { baal: 'alosBaalHatanya', gra: 'alotHaShachar', mga: 'alotHaShachar72' } },
  { id: 'misheyakir', name: 'זמן טלית ותפילין', fn: { baal: 'misheyakir', gra: 'misheyakir', mga: 'misheyakir' } },
  { id: 'netz', name: 'זריחה', fn: { baal: 'sunrise', gra: 'sunrise', mga: 'sunrise' } },
  { id: 'shma', name: 'סוף זמן קריאת שמע', fn: { baal: 'sofZmanShmaBaalHatanya', gra: 'sofZmanShma', mga: 'sofZmanShmaMGA' } },
  { id: 'tfila', name: 'סוף זמן תפילה', fn: { baal: 'sofZmanTfilaBaalHatanya', gra: 'sofZmanTfilla', mga: 'sofZmanTfillaMGA' } },
  { id: 'chatzot', name: 'חצות היום', fn: { baal: 'chatzot', gra: 'chatzot', mga: 'chatzot' } },
  { id: 'gedola', name: 'מנחה גדולה', fn: { baal: 'minchaGedolaBaalHatanya', gra: 'minchaGedola', mga: 'minchaGedolaMGA' } },
  { id: 'ketana', name: 'מנחה קטנה', fn: { baal: 'minchaKetanaBaalHatanya', gra: 'minchaKetana', mga: 'minchaKetanaMGA' } },
  { id: 'plag', name: 'פלג המנחה', fn: { baal: 'plagHaminchaBaalHatanya', gra: 'plagHaMincha', mga: 'plagHaMincha' } },
  { id: 'shkiah', name: 'שקיעה', fn: { baal: 'sunset', gra: 'sunset', mga: 'sunset' } },
  { id: 'tzeit', name: 'צאת הכוכבים', fn: { baal: 'tzaisBaalHatanya', gra: 'tzeit', mga: 'tzeit72' } },
  { id: 'chatzotNight', name: 'חצות לילה', fn: { baal: 'chatzotNight', gra: 'chatzotNight', mga: 'chatzotNight' }, nextNight: true },
];
export const zmanName = (id) => (ZMAN_DEFS.find((z) => z.id === id) || {}).name || id;

export function inIsrael(lat, lon) { return lat > 29.4 && lat < 33.4 && lon > 34.2 && lon < 35.9; }

// מיקום פעיל לפי ההגדרות
export function getLoc(st) {
  const s = st.loc || {};
  if (s.mode === 'city' || !s.mode) {
    const c = cityById(s.cityId || 'jerusalem') || cityById('jerusalem');
    return { name: c.name, lat: c.lat, lon: c.lon, tz: c.tz, il: c.il };
  }
  const lat = Number(s.lat), lon = Number(s.lon);
  if (isFinite(lat) && isFinite(lon) && (lat || lon)) return { name: s.name || 'מיקום שלי', lat, lon, tz: s.tz || deviceTz(), il: inIsrael(lat, lon) };
  const c = cityById('jerusalem');
  return { name: c.name, lat: c.lat, lon: c.lon, tz: c.tz, il: c.il };
}

const zCache = new Map();
const locKey = (l) => l.lat + ',' + l.lon + ',' + l.tz;

// כל הזמנים ליום אחד (Date לפי id)
export function zmanimFor(date, loc, method = 'baal', tzeitMode = 'method') {
  const key = dkey(date) + '|' + locKey(loc) + '|' + method + '|' + tzeitMode;
  if (zCache.has(key)) return zCache.get(key);
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const gl = new GeoLocation(loc.name, loc.lat, loc.lon, 0, loc.tz);
  const z = new Zmanim(gl, noon, false);
  const out = {};
  for (const d of ZMAN_DEFS) {
    let t = null;
    try {
      if (d.nextNight) {
        t = new Zmanim(gl, addDays(noon, 1), false).chatzotNight();
      } else if (d.id === 'tzeit' && tzeitMode === 'min72') {
        t = z.tzeit72();
      } else t = z[d.fn[method]]();
    } catch (e) { t = null; }
    out[d.id] = t && !isNaN(t.getTime()) ? roundMin(t) : null;
  }
  if (zCache.size > 3000) zCache.clear();
  zCache.set(key, out);
  return out;
}

// ---- לוח שנה, חגים והדלקת נרות (מטמון לפי שנה לועזית) ----
const yCache = new Map();
function yearData(year, loc, st) {
  const key = year + '|' + locKey(loc) + '|' + loc.il + '|' + (st.candleMins || 0);
  if (yCache.has(key)) return yCache.get(key);
  const opts = {
    start: new Date(year, 0, 1, 12), end: new Date(year, 11, 31, 12), il: loc.il, sedrot: true, omer: true,
    candlelighting: true, location: new Location(loc.lat, loc.lon, loc.il, loc.tz, loc.name),
  };
  if (st.candleMins) opts.candleLightingMins = -Math.abs(st.candleMins);
  let events = [];
  try { events = HebrewCalendar.calendar(opts); } catch (e) { events = []; }
  const byDay = {}, timed = [];
  for (const e of events) {
    const k = dkey(e.getDate().greg());
    const desc = e.getDesc();
    if (e.eventTime && (desc === 'Candle lighting' || desc === 'Havdalah')) {
      timed.push({ t: roundMin(e.eventTime), kind: desc === 'Havdalah' ? 'havdalah' : 'candles', key: k });
      continue;
    }
    (byDay[k] = byDay[k] || []).push(e);
  }
  timed.sort((a, b) => a.t - b.t);
  // מרווחי שבת/חג: מהדלקת נרות עד הבדלה
  const rest = [];
  let open = null;
  for (const t of timed) {
    if (t.kind === 'candles' && open === null) open = t.t.getTime();
    else if (t.kind === 'havdalah' && open !== null) { rest.push([open, t.t.getTime()]); open = null; }
  }
  const d = { byDay, timed, rest };
  yCache.set(key, d);
  return d;
}

export function isChagDay(date, loc, st = {}) {
  const evs = yearData(date.getFullYear(), loc, st).byDay[dkey(date)] || [];
  return evs.some((e) => e.getFlags() & flags.CHAG);
}
export function isRestDay(date, loc, st = {}) {
  return date.getDay() === 6 || isChagDay(date, loc, st);
}

const SKIP_FLAGS = flags.PARSHA_HASHAVUA | flags.OMER_COUNT | flags.MOLAD | flags.DAF_YOMI | flags.YOM_KIPPUR_KATAN | flags.SHABBAT_MEVARCHIM;
// שמות אירועי היום (חגים, ראש חודש וכו') בעברית
export function dayEvents(date, loc, st = {}) {
  const evs = yearData(date.getFullYear(), loc, st).byDay[dkey(date)] || [];
  const out = [];
  for (const e of evs) {
    if (e.getFlags() & SKIP_FLAGS) continue;
    if (/School Observance/i.test(e.getDesc())) continue; // "שמירת בית הספר ליום העלייה": לא רלוונטי
    out.push(stripNikud(e.render('he')));
  }
  return out;
}
export function omerDay(date, loc, st = {}) {
  const evs = yearData(date.getFullYear(), loc, st).byDay[dkey(date)] || [];
  for (const e of evs) if (e.getFlags() & flags.OMER_COUNT) return e.omer || null;
  return null;
}
export function isRoshChodesh(date, loc, st = {}) {
  return (yearData(date.getFullYear(), loc, st).byDay[dkey(date)] || []).some((e) => e.getFlags() & flags.ROSH_CHODESH);
}
// הפרשה של השבוע הנוכחי (השבת הקרובה שיש בה פרשה)
export function parshaOfWeek(date, loc, st = {}) {
  let sat = addDays(date, 6 - date.getDay());
  for (let i = 0; i < 6; i++) {
    const evs = yearData(sat.getFullYear(), loc, st).byDay[dkey(sat)] || [];
    const p = evs.find((e) => e.getFlags() & flags.PARSHA_HASHAVUA);
    if (p) return stripNikud(p.render('he')).replace(/^פרשת\s*/, '');
    sat = addDays(sat, 7);
  }
  return '';
}
// הדלקת נרות והבדלה ביום מסוים
export function timedOn(date, loc, st = {}) {
  const k = dkey(date);
  const out = { candles: null, havdalah: null };
  for (const t of yearData(date.getFullYear(), loc, st).timed) if (t.key === k) out[t.kind] = t.t;
  return out;
}
export function restIntervals(from, to, loc, st = {}) {
  const out = [];
  for (let y = from.getFullYear(); y <= to.getFullYear(); y++) out.push(...yearData(y, loc, st).rest);
  return out;
}
export function inRest(ms, intervals) { return intervals.some(([a, b]) => ms >= a && ms < b); }

// ---- היום ההלכתי ----
export function todayKey(st, now = new Date()) {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const mode = st.dayChange || 'midnight';
  if (mode === 'midnight') return dkey(base);
  if (mode === 'time') {
    const [hh, mm] = String(st.dayChangeTime || '21:00').split(':').map(Number);
    return now.getHours() * 60 + now.getMinutes() >= hh * 60 + (mm || 0) ? dkey(addDays(base, 1)) : dkey(base);
  }
  const loc = getLoc(st);
  const z = zmanimFor(base, loc, st.method || 'baal', st.tzeitMode || 'method');
  const t = mode === 'tzeit' ? z.tzeit : z.shkiah;
  return t && now >= t ? dkey(addDays(base, 1)) : dkey(base);
}

// כיוון ומרחק לבית המקדש (הר הבית)
export const TEMPLE = { lat: 31.7781, lon: 35.2360 };
export function bearingTo(lat, lon, to = TEMPLE) {
  const r = Math.PI / 180;
  const y = Math.sin((to.lon - lon) * r) * Math.cos(to.lat * r);
  const x = Math.cos(lat * r) * Math.sin(to.lat * r) - Math.sin(lat * r) * Math.cos(to.lat * r) * Math.cos((to.lon - lon) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}
export function distanceKm(lat, lon, to = TEMPLE) {
  const r = Math.PI / 180, R = 6371;
  const a = Math.sin(((to.lat - lat) * r) / 2) ** 2 + Math.cos(lat * r) * Math.cos(to.lat * r) * Math.sin(((to.lon - lon) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
export { parseKey };
