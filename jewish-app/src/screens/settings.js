import { timeBtn, hebDate, h, openPage, openSheet, actionSheet, confirmBox, seg, chips, field, sel, txt, toggle, toast, icon } from '../ui.js';
import { ctx, commit } from '../core.js';
import { PALETTES, exportJson, replaceAll, reset } from '../lib/store.js';
import { getLoc, METHODS } from '../lib/zm.js';
import { dkey, addDays, parseKey, hebrewDate } from '../lib/dates.js';
import { saveFile, shareText, copyText, pickSound, testAlarm } from '../lib/native.js';
import { chabadList, HMONTHS, monthName } from '../lib/chabad.js';
import { uid } from '../lib/store.js';
import { openLocation, openHealth, openYahrzeits, openCompass } from './extras.js';
import { dayStatus, activeTracks, firstKey, learnInfo } from '../lib/tracks.js';
import { sourceList, customUrl } from '../lib/sources.js';
import { chime } from '../lib/chime.js';
import { backupNow, listBackups, backupStamp } from '../lib/autobackup.js';

const row = (label, sub, control, onclick) => h('div', { class: 'row' + (onclick ? ' tap' : ''), onclick }, h('div', { class: 'grow' }, h('div', { class: 't' }, label), sub ? h('div', { class: 's' }, sub) : null), control);
const sw = (label, sub, obj, key, after) => row(label, sub, toggle(!!obj[key], (v) => { obj[key] = v; commit(); after && after(); }));
const arrow = () => h('span', { class: 'muted' }, icon('left', 26));

export function settingsMain() {
  const groups = [
    ['כללי', 'מראה וגודל כתב', general],
    ['עיצוב ונראות', 'פלטת צבע, צפיפות, ניגודיות, פינות', design],
    ['לימוד', 'השלמות, חלון השלמה, שעות חלקי יום', learning],
    ['זמנים', 'מיקום, שיטת חישוב, צאת הכוכבים, החלפת יום', zmanim],
    ['התראות', 'צליל, נודניק, שעות שקט, תזכורות אוטומטיות', alerts],
    ['ימים מיוחדים', 'שבת וחג, מצב חופשה, יארצייטים וימי הולדת', special],
    ['הרשאות ואמינות', 'בדיקת תקינות ההתראות', openHealth],
    ['קישורי הלימוד של היום', 'כל קישור להעתקה, לבדיקה בלי דפדפן', links],
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
      h('label', { class: 'f' }, 'גודל כתב'), seg([[0.9, 'קטן'], [1, 'רגיל'], [1.15, 'גדול'], [1.3, 'גדול מאוד']], s.fontScale, (v) => { s.fontScale = v; commit(); }));
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
// שדה שעה: בחירה מהירה + הקלדה חופשית (HH:MM). השעה נשמרת כמספר שעות (24 = חצות)
const hourStr = (v) => { const x = v >= 24 ? 0 : v; const hh = Math.floor(x), mm = Math.round((x - hh) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
function hourField(label, s, key, presets, allowMidnight) {
  const set = (v) => { s[key] = v; commit(); };
  return h('div', { class: 'card' },
    h('div', { style: 'font-weight:700;margin-bottom:6px' }, label),
    h('div', { class: 'chips' }, presets.map(([v, l]) => h('button', { class: 'chip' + (Number(s[key]) === v ? ' on' : ''), onclick: () => set(v) }, l))),
    h('div', { class: 'inline' }, h('label', { class: 'f', style: 'flex:none;margin:0' }, 'או הקלדת שעה:'),
      timeBtn(hourStr(s[key]), (val) => { const [hh, mm] = (val || '').split(':').map(Number); if (isNaN(hh)) return; let v = hh + (mm || 0) / 60; if (v === 0 && allowMidnight) v = 24; if (v === 0) return; set(v); })));
}
function learning() {
  openPage('לימוד', () => {
    const { s } = ctx();
    return h('div', null,
      h('div', { class: 'list' }, sw('השלמה באיחור נספרת', 'נספרת ברצף ובאחוזים, עם תווית "באיחור"', s, 'countLate')),
      h('label', { class: 'f' }, 'חלון השלמה (כמה אחורה מוצגים כחסרים)'),
      h('div', { class: 'chips' }, [[7, '7 ימים'], [14, '14 ימים'], [30, '30 ימים'], ['month', 'החודש העברי הנוכחי'], ['year', 'שנה (מתחילת השנה העברית)']].map(([v, l]) => h('button', { class: 'chip' + (s.lateWindow === v ? ' on' : ''), onclick: () => { s.lateWindow = v; commit(); } }, l))),
      h('div', { class: 'section-title' }, 'חלקי היום (עד איזו שעה כל חלק)'),
      hourField('בוקר עד', s, 'partMorning', [[10, '10:00'], [11, '11:00'], [12, '12:00'], [13, '13:00']]),
      hourField('אחר הצהריים עד', s, 'partAfternoon', [[16, '16:00'], [17, '17:00'], [18, '18:00'], [19, '19:00']]),
      hourField('ערב ולילה עד', s, 'partEvening', [[22, '22:00'], [23, '23:00'], [24, '12 בלילה (חצות)']], true),
      h('p', { class: 'dim small' }, 'חלקי היום משמשים לסידור המסלולים במסך היום. ברירת המחדל: הלילה נמשך עד 12 בלילה.'));
  });
}
function zmanim() {
  openPage('זמנים', (pg) => {
    const c = ctx(); const { s } = c;
    return h('div', null,
      h('div', { class: 'list' }, row('מיקום', getLoc(s).name, arrow(), () => openLocation(() => commit()))),
      h('label', { class: 'f' }, 'שיטת חישוב'), seg(Object.entries(METHODS), s.method, (v) => { s.method = v; commit(); }),
      h('label', { class: 'f' }, 'צאת הכוכבים'), seg([['method', 'לפי השיטה'], ['min72', '72 דקות אחרי שקיעה']], s.tzeitMode, (v) => { s.tzeitMode = v; commit(); }),
      h('label', { class: 'f' }, 'מתי מתחלף היום (לסימון הלימוד)'), seg([['sunset', 'שקיעה'], ['tzeit', 'צאת הכוכבים'], ['midnight', '12 בלילה'], ['time', 'שעה מסוימת']], s.dayChange, (v) => { s.dayChange = v; commit(); }),
      s.dayChange === 'time' ? field('החלפת היום בשעה', txt(s.dayChangeTime || '21:00', (v) => { if (v) { s.dayChangeTime = v; } }, '', 'time')) : null);
  });
}
function alerts() {
  openPage('התראות', () => {
    const { s } = ctx();
    return h('div', null,
      h('div', { class: 'list' },
        row('צליל ההתראה', s.soundName || 'צליל השעון של המכשיר (ברירת מחדל)', arrow(), () => chooseSound()),
        row('בדיקת צלצול עכשיו', 'מצלצל בעוד כמה שניות עם הצליל שבחרת', arrow(), () => { testAlarm('ring'); toast('צלצול בעוד 5 שניות'); })),
      h('div', { class: 'list', style: 'margin-top:10px' },
        sw('עוצמה עולה בהדרגה', 'הצלצול מתחיל חלש ועולה', s, 'ramp'),
        sw('רטט', '', s, 'vibrate'),
        sw('צליל עדין בסימון לימוד', 'צליל קצר בסימון, ומעט מלא יותר כשכל משימות היום הושלמו', s, 'markSound'),
        row('בדיקת צליל הסימון', 'נוגן בעוצמת המדיה: לחיצה = צליל סימון אחד, ואחריו צליל "הכל הושלם"', arrow(), () => { chime('one'); setTimeout(() => chime('all'), 900); }),
        sw('חוזרת עד כיבוי (ברירת מחדל)', 'צלצול ממשיך עד שמכבים', s, 'repeatUntilOff'),
        sw('שעות שקט', 'צלצול הופך להתראה שקטה', s, 'quiet')),
      s.quiet ? h('div', { class: 'inline' }, field('מ-', txt(s.quietFrom, (v) => { s.quietFrom = v; }, '', 'time')), field('עד', txt(s.quietTo, (v) => { s.quietTo = v; }, '', 'time'))) : null,
      h('label', { class: 'f' }, 'נודניק (דקות)'), seg([[5, '5'], [10, '10'], [15, '15']], s.snoozeMin, (v) => { s.snoozeMin = v; commit(); }),
      h('div', { class: 'section-title' }, 'תזכורות אוטומטיות'),
      h('div', { class: 'list' },
        sw('ראש חודש', '', s.auto, 'roshChodesh'),
        row('הדלקת נרות', 'התראה ' + s.candleBefore + ' דקות לפני ההדלקה · ההדלקה ' + (s.candleMins ? s.candleMins + ' דקות לפני שקיעה' : 'לפי המקום') + ' · לחיצה לשינוי', toggle(!!s.auto.candles, (v) => { s.auto.candles = v; commit(); }), () => candleSheet()),
        sw('ספירת העומר', 'בערבי הספירה', s.auto, 'omer'),
        sw('הבדלה', 'תזכורת בצאת שבת וחג, בזמן ההבדלה', s.auto, 'havdalah'),
        sw('נרות חנוכה', 'התראה לפני כל הדלקה, נר 1 עד 8', s.auto, 'chanukah'),
        sw('תאריכי חב״ד', 'מתריע בתאריכים שנבחרו ברשימה', s, 'chabadDates'),
        row('רשימת תאריכי חב״ד', chabadList(s).filter((x) => x.on !== false).length + ' מתוך ' + chabadList(s).length + ' פעילים · בחירה, עריכה והוספה', arrow(), () => openChabad()),
        sw('אבני דרך שקטות', 'הודעה על רצף 7, 30, 100', s, 'milestones')));
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
    field('מתאריך', hebDate(from, (v) => { from = v; })),
    field('עד תאריך', hebDate(to, (v) => { to = v; })),
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
function links() {
  openPage('קישורי הלימוד של היום', () => {
    const c = ctx(), d = parseKey(c.tk);
    const rows = activeTracks(c.st).map((t) => ({ t, i: learnInfo(t, d, c.st) })).filter((x) => x.i.url || x.i.params);
    return h('div', null,
      h('p', { class: 'muted' }, 'לכל מסלול אפשר לבחור מאיפה ללמוד. המקור הראשון הוא ברירת המחדל, ובחירה נשמרת במסלול. נגיעה בקישור מעתיקה אותו ללוח.'),
      rows.length ? h('div', { class: 'list' }, rows.map((x) => {
        const list = x.i.params && !customUrl(x.t) ? sourceList(x.t, x.i.params) : [];
        const cur = list.find((l) => l.url === x.i.url);
        return h('div', { class: 'row', style: 'display:block' },
          h('div', { class: 't' }, x.t.name),
          x.i.sub ? h('div', { class: 's' }, x.i.sub) : null,
          list.length ? h('div', { class: 'chips', style: 'margin:6px 0' }, list.map((l) => h('button', {
            class: 'chip' + (cur && cur.i === l.i ? ' on' : ''), disabled: !l.url, style: l.url ? '' : 'opacity:.4',
            onclick: () => { x.t.src = l.i; commit(); },
          }, l.name + ' (' + l.lang + ')'))) : null,
          h('div', { class: 's tap', style: 'direction:ltr;text-align:left;word-break:break-all', onclick: async () => toast((await copyText(x.i.url)) ? 'הקישור הועתק ללוח' : 'ההעתקה נכשלה') }, x.i.url));
      })) : h('div', { class: 'card empty-note' }, 'אין מסלולים עם קישור.'));
  });
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
      h('div', { class: 'section-title' }, 'גיבוי אוטומטי'),
      h('div', { class: 'list' }, sw('גיבוי אוטומטי שבועי', c.s.lastAutoBackup ? 'הגיבוי האחרון: ' + backupStamp(c.s.lastAutoBackup) : 'עוד לא בוצע גיבוי', c.s, 'autoBackup')),
      h('button', { class: 'btn sec block', style: 'margin-top:8px', onclick: async () => { const ok = await backupNow(); toast(ok ? 'הגיבוי נשמר' : 'הגיבוי נכשל'); } }, 'גיבוי עכשיו'),
      listBackups().map((b) => h('button', { class: 'btn ghost block', style: 'margin-top:6px', onclick: () => restoreFrom(b.d) }, 'שחזור מגיבוי אוטומטי מ-' + backupStamp(b.t))),
      h('p', { class: 'dim small' }, 'העותקים נשמרים בטלפון, וגם בגיבוי של גוגל (אם הוא פעיל במכשיר), כך שבמכשיר חדש הנתונים חוזרים אחרי ההתקנה. לגיבוי שאפשר להעביר לבד: "גיבוי לקובץ ושיתוף".'),
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

async function chooseSound() {
  const { s } = ctx();
  const r = await pickSound(s.soundUri || '');
  if (!r || r.cancelled) return;
  s.soundUri = r.uri || ''; s.soundName = r.name || '';
  commit(); toast('הצליל נבחר' + (s.soundName ? ': ' + s.soundName : ''));
}

// ---- תאריכי חב״ד: בחירה, עריכה והוספה ----
function openChabad() {
  openPage('תאריכי חב״ד', () => {
    const { s } = ctx();
    const list = chabadList(s);
    const ordered = list.slice().sort((a, b) => ((a.m + 5) % 12) - ((b.m + 5) % 12) || a.d - b.d);
    return h('div', null,
      h('p', { class: 'muted' }, 'בוחרים על אילו תאריכים להתריע (בשעה 08:00), ואפשר לערוך, למחוק ולהוסיף.'),
      h('div', { class: 'list' }, ordered.map((c) => h('div', { class: 'row tap', style: c.on === false ? 'opacity:.55' : '', onclick: () => editChabad(c) },
        h('div', { class: 'grow' }, h('div', { class: 't' }, c.t), h('div', { class: 's' }, c.d + ' ב' + monthName(c.m))),
        toggle(c.on !== false, (v) => { c.on = v; commit(); })))),
      h('button', { class: 'btn block', onclick: () => editChabad(null) }, '+ הוספת תאריך'),
      h('button', { class: 'btn ghost block', style: 'margin-top:8px', onclick: async () => { if (await confirmBox('להחזיר את רשימת תאריכי חב״ד לברירת המחדל? שינויים שעשית יימחקו.', 'החזרה', true)) { s.chabadList = null; commit(); } } }, 'החזרה לרשימת ברירת המחדל'));
  });
}
function editChabad(c) {
  const { s } = ctx();
  const d = c ? Object.assign({}, c) : { id: uid('c'), m: 9, d: 1, t: '', on: true };
  openSheet(c ? 'עריכת תאריך' : 'תאריך חדש', (sh) => h('div', null,
    field('תיאור (מה יוצג בהתראה)', txt(d.t, (v) => (d.t = v), 'למשל: י״ט כסלו - ראש השנה לחסידות')),
    h('div', { class: 'inline' },
      field('יום בחודש', txt(d.d, (v) => (d.d = Math.max(1, Math.min(30, Number(v) || 1))), '', 'number')),
      field('חודש עברי', sel(HMONTHS, d.m, (v) => (d.m = Number(v))))),
    h('div', { class: 'inline', style: 'margin-top:12px' },
      c ? h('button', { class: 'btn danger', onclick: () => { s.chabadList = chabadList(s).filter((x) => x.id !== c.id); sh.close(); commit(); } }, 'מחיקה') : null,
      h('button', { class: 'btn', onclick: () => { if (!d.t.trim()) { toast('צריך תיאור'); return; } const L = chabadList(s); if (c) Object.assign(L.find((x) => x.id === c.id), d); else L.push(d); sh.close(); commit(); } }, 'שמירה'))));
}

// הדלקת נרות: כמה דקות לפני ההדלקה להתריע, ומתי ההדלקה (לפי המקום או מספר דקות לפני שקיעה)
function candleSheet() {
  const { s } = ctx();
  const num = (key, ph) => h('input', { type: 'number', min: '1', max: '120', placeholder: ph, style: 'margin-top:6px', onchange: (e) => { const v = Math.round(Number(e.target.value)); if (v >= 0 && v <= 120) { s[key] = v; commit(); sh.refresh(); } } });
  let sh;
  sh = openSheet('הדלקת נרות', () => h('div', null,
    h('label', { class: 'f' }, 'להתריע לפני ההדלקה (דקות)'),
    chips([[10, '10'], [15, '15'], [20, '20'], [30, '30'], [45, '45']], [s.candleBefore], (v) => { s.candleBefore = v; commit(); sh.refresh(); }),
    num('candleBefore', 'מספר אחר, בדקות (כרגע ' + s.candleBefore + ')'),
    h('label', { class: 'f' }, 'זמן ההדלקה עצמו'),
    chips([[0, 'לפי המקום'], [18, '18 דק׳ לפני שקיעה'], [20, '20'], [30, '30'], [40, '40']], [Number(s.candleMins) || 0], (v) => { s.candleMins = v; commit(); sh.refresh(); }),
    num('candleMins', 'מספר אחר, בדקות לפני שקיעה (כרגע ' + (s.candleMins || 'לפי המקום') + ')'),
    h('button', { class: 'btn block', style: 'margin-top:14px', onclick: () => sh.close() }, 'סגירה')));
}
