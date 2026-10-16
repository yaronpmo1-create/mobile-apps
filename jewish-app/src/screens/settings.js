import { h, openPage, openSheet, confirmBox, seg, field, sel, txt, toggle, toast } from '../ui.js';
import { ctx, commit } from '../core.js';
import { PALETTES, exportJson, replaceAll, reset } from '../lib/store.js';
import { getLoc, METHODS } from '../lib/zm.js';
import { dkey, addDays, parseKey, hebrewDate } from '../lib/dates.js';
import { saveFile, shareText, copyText } from '../lib/native.js';
import { openLocation, openHealth, openYahrzeits, openCompass } from './extras.js';
import { dayStatus, activeTracks, firstKey } from '../lib/tracks.js';

const row = (label, sub, control, onclick) => h('div', { class: 'row' + (onclick ? ' tap' : ''), onclick }, h('div', { class: 'grow' }, h('div', { class: 't' }, label), sub ? h('div', { class: 's' }, sub) : null), control);
const sw = (label, sub, obj, key, after) => row(label, sub, toggle(!!obj[key], (v) => { obj[key] = v; commit(); after && after(); }));
const arrow = () => h('span', { class: 'muted' }, '‹');

export function settingsMain() {
  const groups = [
    ['כללי', 'מראה, גודל כתב, תחילת שבוע', general],
    ['עיצוב ונראות', 'פלטת צבע, צפיפות, ניגודיות, פינות', design],
    ['לימוד', 'השלמות, חלון השלמה, שעות חלקי יום', learning],
    ['זמנים', 'מיקום, שיטת חישוב, צאת הכוכבים, החלפת יום', zmanim],
    ['התראות', 'צליל, נודניק, שעות שקט, תזכורות אוטומטיות', alerts],
    ['ימים מיוחדים', 'שבת וחג, מצב חופשה, יארצייטים וימי הולדת', special],
    ['הרשאות ואמינות', 'בדיקת תקינות ההתראות', openHealth],
    ['נתונים', 'גיבוי, שחזור, ייצוא, איפוס', data],
    ['אודות ועזרה', 'גרסה ושאלות נפוצות', about],
  ];
  openPage('הגדרות', () => h('div', null,
    h('div', { class: 'list' }, groups.map(([t, s, fn], i) => h('div', { class: 'row tap', onclick: () => fn() }, h('div', { class: 'grow' }, h('div', { class: 't' }, (i + 1) + '. ' + t), h('div', { class: 's' }, s)), arrow()))),
    h('button', { class: 'btn sec block', onclick: () => openCompass() }, 'מצפן לבית המקדש')));
}

function general() {
  openPage('כללי', () => {
    const { s } = ctx();
    return h('div', null,
      h('label', { class: 'f' }, 'מראה'), seg([['auto', 'אוטומטי'], ['light', 'בהיר'], ['dark', 'כהה']], s.theme, (v) => { s.theme = v; commit(); }),
      h('label', { class: 'f' }, 'גודל כתב'), seg([[0.9, 'קטן'], [1, 'רגיל'], [1.15, 'גדול'], [1.3, 'גדול מאוד']], s.fontScale, (v) => { s.fontScale = v; commit(); }),
      h('label', { class: 'f' }, 'תחילת השבוע ביומן'), seg([[0, 'יום ראשון'], [1, 'יום שני']], s.weekStart, (v) => { s.weekStart = v; commit(); }));
  });
}
function design() {
  openPage('עיצוב ונראות', () => {
    const { s } = ctx();
    return h('div', null,
      h('label', { class: 'f' }, 'פלטת צבע'),
      h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 12px' }, Object.entries(PALETTES).map(([k, [n, col]]) => h('button', { class: 'pal' + (s.palette === k ? ' on' : ''), style: 'background:' + col, 'aria-label': n, onclick: () => { s.palette = k; commit(); } }))),
      h('label', { class: 'f' }, 'צפיפות'), seg([['compact', 'צפופה'], ['normal', 'רגילה'], ['roomy', 'מרווחת']], s.density, (v) => { s.density = v; commit(); }),
      h('label', { class: 'f' }, 'פינות'), seg([['round', 'עגולות'], ['sharp', 'חדות']], s.corners, (v) => { s.corners = v; commit(); }),
      h('div', { class: 'list', style: 'margin-top:10px' },
        sw('ניגודיות גבוהה', 'צבעים חדים וקווים בולטים', s, 'contrast'),
        sw('צבע שונה לכל לשונית', 'היום זהב, לימוד ירוק, זמנים כחול, יומן סגול', s, 'tabColors')));
  });
}
function learning() {
  openPage('לימוד', () => {
    const { s } = ctx();
    const hours = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => [a + i, (a + i) + ':00']);
    return h('div', null,
      h('div', { class: 'list' }, sw('השלמה באיחור נספרת', 'נספרת ברצף ובאחוזים, עם תווית "באיחור"', s, 'countLate')),
      h('label', { class: 'f' }, 'חלון השלמה (כמה ימים אחורה מוצגים כחסרים)'), seg([[7, '7 ימים'], [14, '14 ימים'], [30, '30 ימים']], s.lateWindow, (v) => { s.lateWindow = v; commit(); }),
      h('div', { class: 'inline' },
        field('בוקר עד שעה', sel(hours(9, 14), s.partMorning, (v) => { s.partMorning = Number(v); commit(); })),
        field('אחה״צ עד שעה', sel(hours(15, 20), s.partAfternoon, (v) => { s.partAfternoon = Number(v); commit(); }))),
      h('p', { class: 'dim small' }, 'חלקי היום משמשים לסידור המסלולים במסך היום.'));
  });
}
function zmanim() {
  openPage('זמנים', (pg) => {
    const c = ctx(); const { s } = c;
    return h('div', null,
      h('div', { class: 'list' }, row('מיקום', getLoc(s).name, arrow(), () => openLocation(() => commit()))),
      h('label', { class: 'f' }, 'שיטת חישוב'), seg(Object.entries(METHODS), s.method, (v) => { s.method = v; commit(); }),
      h('label', { class: 'f' }, 'צאת הכוכבים'), seg([['method', 'לפי השיטה'], ['min72', '72 דקות אחרי שקיעה']], s.tzeitMode, (v) => { s.tzeitMode = v; commit(); }),
      h('label', { class: 'f' }, 'מתי מתחלף היום (לסימון הלימוד)'), seg([['sunset', 'שקיעה'], ['tzeit', 'צאת הכוכבים'], ['midnight', 'חצות']], s.dayChange, (v) => { s.dayChange = v; commit(); }),
      field('הדלקת נרות: דקות לפני שקיעה', sel([[0, 'ברירת מחדל לפי המקום'], [18, '18 דקות'], [20, '20 דקות'], [30, '30 דקות'], [40, '40 דקות']], s.candleMins, (v) => { s.candleMins = Number(v); commit(); })));
  });
}
function alerts() {
  openPage('התראות', () => {
    const { s } = ctx();
    return h('div', null,
      h('div', { class: 'list' },
        sw('עוצמה עולה בהדרגה', 'הצלצול מתחיל חלש ועולה', s, 'ramp'),
        sw('רטט', '', s, 'vibrate'),
        sw('חוזרת עד כיבוי (ברירת מחדל)', 'צלצול ממשיך עד שמכבים', s, 'repeatUntilOff'),
        sw('שעות שקט', 'צלצול הופך להתראה שקטה', s, 'quiet')),
      s.quiet ? h('div', { class: 'inline' }, field('מ-', txt(s.quietFrom, (v) => { s.quietFrom = v; }, '', 'time')), field('עד', txt(s.quietTo, (v) => { s.quietTo = v; }, '', 'time'))) : null,
      h('label', { class: 'f' }, 'נודניק (דקות)'), seg([[5, '5'], [9, '9'], [10, '10'], [15, '15']], s.snoozeMin, (v) => { s.snoozeMin = v; commit(); }),
      h('div', { class: 'section-title' }, 'תזכורות אוטומטיות'),
      h('div', { class: 'list' },
        sw('ראש חודש', '', s.auto, 'roshChodesh'),
        sw('ערב שבת / חג', 'ביום שישי וערב חג בצהריים', s.auto, 'erevShabbat'),
        sw('הדלקת נרות', 'לפני זמן ההדלקה', s.auto, 'candles'),
        sw('ספירת העומר', 'בערבי הספירה', s.auto, 'omer'),
        sw('תאריכי חב״ד', 'י״ט כסלו, י״א ניסן, ג׳ תמוז ועוד', s, 'chabadDates'),
        sw('אבני דרך שקטות', 'הודעה על רצף 7, 30, 100', s, 'milestones')),
      field('הדלקת נרות: להתריע לפני (דקות)', sel([[10, '10'], [20, '20'], [30, '30'], [45, '45']], s.candleBefore, (v) => { s.candleBefore = Number(v); commit(); })));
  });
}
function special() {
  openPage('ימים מיוחדים', (pg) => {
    const c = ctx(); const { st, s } = c;
    return h('div', null,
      h('p', { class: 'muted' }, 'שבת וחג: אין בקשת סימון ואין צלצול (אפשר לשנות בכל התראה). אפשר להשלים במוצאי שבת/חג והלימוד נרשם בתאריך הנכון.'),
      h('div', { class: 'list' },
        sw('מצב חופשה כללי', 'כל הימים לא נספרים כהחמצה עד שמכבים', s, 'vacation'),
        row('יארצייטים וימי הולדת עבריים', st.yahrzeits.length + ' רשומות', arrow(), () => openYahrzeits())),
      h('div', { class: 'section-title' }, 'טווחי חופשה'),
      h('div', { class: 'list' }, st.vacations.map((v, i) => h('div', { class: 'row' }, h('div', { class: 'grow' }, v.from + ' עד ' + v.to), h('button', { class: 'iconbtn', onclick: () => { st.vacations.splice(i, 1); commit(); } }, '✕')))),
      h('button', { class: 'btn block', onclick: () => addVacation() }, '+ הוספת טווח חופשה'),
      h('p', { class: 'dim small' }, 'יום בודד מסמנים כמיוחד במסך השלמת היום ביומן.'));
  });
}
function addVacation() {
  const c = ctx();
  let from = c.tk, to = dkey(addDays(c.today, 7));
  openSheet('טווח חופשה', (sh) => h('div', null,
    field('מתאריך', h('input', { type: 'date', value: from, onchange: (e) => (from = e.target.value) })),
    field('עד תאריך', h('input', { type: 'date', value: to, onchange: (e) => (to = e.target.value) })),
    h('button', { class: 'btn block', style: 'margin-top:14px', onclick: () => { if (!from || !to || to < from) { toast('טווח לא תקין'); return; } c.st.vacations.push({ from, to }); sh.close(); commit(); } }, 'שמירה')));
}

function csv(c) {
  const rows = [['תאריך', 'מסלול', 'מצב', 'הערה']];
  const st = c.st;
  for (const k of Object.keys(st.entries).sort()) for (const id in st.entries[k]) {
    const t = st.tracks.find((x) => x.id === id);
    const e = st.entries[k][id];
    rows.push([k, t ? t.name : id, e.s === 'done' ? 'הושלם' : e.s === 'late' ? 'הושלם באיחור' : 'דולג', ((st.notes || {})[k] || {})[id] || '']);
  }
  return '﻿' + rows.map((r) => r.map((x) => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n');
}
function data() {
  openPage('נתונים', () => {
    const c = ctx();
    const fileIn = h('input', { type: 'file', accept: '.json,.txt,application/json,text/plain', style: 'display:none', onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      restoreFrom(await f.text());
    } });
    return h('div', null,
      h('p', { class: 'muted' }, 'כל הנתונים נשמרים בטלפון בלבד. מומלץ לגבות מדי פעם.'),
      h('button', { class: 'btn block', onclick: async () => { const r = await saveFile('jewish-app-backup-' + c.tk + '.json', exportJson()); toast(r === 'copied' ? 'אין שיתוף במכשיר - הגיבוי הועתק ללוח' : r === 'fail' ? 'הגיבוי נכשל' : 'הגיבוי מוכן'); } }, 'גיבוי לקובץ ושיתוף'),
      h('button', { class: 'btn sec block', style: 'margin-top:8px', onclick: async () => toast((await copyText(exportJson())) ? 'הגיבוי הועתק ללוח' : 'ההעתקה נכשלה') }, 'העתקת גיבוי ללוח'),
      h('div', { class: 'section-title' }, 'שחזור'),
      h('button', { class: 'btn sec block', onclick: () => fileIn.click() }, 'שחזור מקובץ'), fileIn,
      h('button', { class: 'btn sec block', style: 'margin-top:8px', onclick: () => pasteRestore() }, 'שחזור מטקסט מודבק'),
      h('div', { class: 'section-title' }, 'ייצוא'),
      h('button', { class: 'btn sec block', onclick: async () => { const r = await saveFile('jewish-app-' + c.tk + '.csv', csv(c)); toast(r === 'copied' ? 'הועתק ללוח' : 'הייצוא מוכן'); } }, 'ייצוא CSV (לאקסל)'),
      h('div', { class: 'section-title' }, 'איפוס'),
      h('button', { class: 'btn danger block', onclick: async () => {
        if (!(await confirmBox('למחוק את כל הנתונים וההגדרות?', 'המשך', true))) return;
        if (!(await confirmBox('בטוח? אי אפשר לשחזר, אלא מגיבוי.', 'כן, למחוק הכל', true))) return;
        reset(); location.reload();
      } }, 'איפוס כל הנתונים'));
  });
}
async function restoreFrom(text) {
  let obj;
  try { obj = JSON.parse(text); if (!obj || !obj.settings || !obj.tracks) throw 0; } catch (e) { toast('הקובץ לא נראה כגיבוי תקין'); return; }
  if (!(await confirmBox('השחזור יחליף את כל הנתונים הנוכחיים. להמשיך?', 'שחזור', true))) return;
  replaceAll(obj); location.reload();
}
function pasteRestore() {
  let v = '';
  openSheet('הדבקת גיבוי', (sh) => h('div', null, h('textarea', { placeholder: 'הדביקו כאן את טקסט הגיבוי', oninput: (e) => (v = e.target.value) }), h('button', { class: 'btn block', style: 'margin-top:10px', onclick: () => { sh.close(); restoreFrom(v); } }, 'שחזור')));
}
function about() {
  openPage('אודות ועזרה', () => h('div', null,
    h('div', { class: 'card' }, h('b', { style: 'font-size:1.2rem;color:var(--accent)' }, 'אפליקציה יהודית'), h('div', { class: 'muted' }, 'גרסה 1.0 · לימוד יומי, יומן, זמנים והתראות')),
    h('div', { class: 'list' },
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'איך מסמנים לימוד?'), h('div', { class: 's' }, 'נגיעה במסך היום. לחיצה ארוכה: הערה ו"איפה עצרתי".'))),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'איך מוסיפים התראה?'), h('div', { class: 's' }, 'בלשונית זמנים: לוחצים על זמן, או בלשונית "התראות".'))),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'ההתראה לא צלצלה?'), h('div', { class: 's' }, 'הגדרות > הרשאות ואמינות, ולבצע את התיקונים המוצעים.'))),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'בלי אינטרנט?'), h('div', { class: 's' }, 'הכל מחושב בטלפון. הזמנים תואמים ל-Hebcal לדקה.'))),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'ספירת הימים בשבת'), h('div', { class: 's' }, 'אפשר להשלים במוצאי שבת/חג והלימוד נרשם בתאריך הנכון, לא כאיחור.'))))));
}
