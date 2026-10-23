// מקורות לימוד לכל מסלול: רשימה מסודרת, הראשון = ברירת מחדל. הקישור מחושב ברגע השימוש (ליום המוצג).
import { gematria, addDays } from './dates.js';

const HE = 'https://he.chabad.org/dailystudy/';
const EN = 'https://www.chabad.org/dailystudy/';
const IL = 'https://www.chabad.org.il/Lessons/';
const SEF = 'https://www.sefaria.org.il/';
const WIKI = 'https://he.wikisource.org/wiki/';

// p = { t: "M/D/YYYY" של היום המוצג, off: ימים מהיום (לחב״ד ישראל), hc: קישור Hebcal (ספריא) של היום, hcText: טקסט, tanya: קישור ספריא לפסקה, sat: Date של השבת, parshaUrl }
const sefariaIl = (u) => (u ? u.replace(/^https?:\/\/(www\.)?sefaria\.org(\.il)?\//, SEF) : '');
const letters = (n) => gematria(n).replace(/[׳״]/g, '');
const wiki = (title) => WIKI + encodeURIComponent(title.replace(/ /g, '_'));
const chapterOf = (hc, idx) => Number(((hc || '').split('?')[0].split('/').pop().split('.')[idx] || '').split('-')[0]) || 0;
const sefName = (hc) => ((hc || '').split('?')[0].split('/').pop().split('.')[0] || '');

const NACH = {
  Joshua: 'יהושע', Judges: 'שופטים', I_Samuel: 'שמואל א', II_Samuel: 'שמואל ב', I_Kings: 'מלכים א', II_Kings: 'מלכים ב', Isaiah: 'ישעיהו', Jeremiah: 'ירמיהו', Ezekiel: 'יחזקאל',
  Hosea: 'הושע', Joel: 'יואל', Amos: 'עמוס', Obadiah: 'עובדיה', Jonah: 'יונה', Micah: 'מיכה', Nahum: 'נחום', Habakkuk: 'חבקוק', Zephaniah: 'צפניה', Haggai: 'חגי', Zechariah: 'זכריה', Malachi: 'מלאכי',
  Psalms: 'תהילים', Proverbs: 'משלי', Job: 'איוב', Song_of_Songs: 'שיר השירים', Ruth: 'רות', Lamentations: 'איכה', Ecclesiastes: 'קהלת', Esther: 'אסתר', Daniel: 'דניאל', Ezra: 'עזרא', Nehemiah: 'נחמיה',
  I_Chronicles: 'דברי הימים א', II_Chronicles: 'דברי הימים ב',
};
// שמות המסכתות בספריא -> שם באתר dafyomi.org
const DAFYOMI = {
  Berakhot: 'brachos', Shabbat: 'shabbos', Eruvin: 'eruvin', Pesachim: 'pesachim', Shekalim: 'shekalim', Yoma: 'yoma', Sukkah: 'succah', Beitzah: 'beitzah', Rosh_Hashanah: 'rosh_hashana', Taanit: 'taanis',
  Megillah: 'megilah', Moed_Katan: 'moed_katan', Chagigah: 'chagiga', Yevamot: 'yevamos', Ketubot: 'kesuvos', Nedarim: 'nedarim', Nazir: 'nazir', Sotah: 'sotah', Gittin: 'gitin', Kiddushin: 'kiddushin',
  Bava_Kamma: 'bava_kama', Bava_Metzia: 'bava_metzia', Bava_Batra: 'bava_basra', Sanhedrin: 'sanhedrin', Makkot: 'makkos', Shevuot: 'shevuos', Avodah_Zarah: 'avoda_zara', Horayot: 'horayos', Zevachim: 'zevachim',
  Menachot: 'menachos', Chullin: 'chulin', Bekhorot: 'bechoros', Arakhin: 'erchin', Temurah: 'temurah', Keritot: 'kerisus', Meilah: 'meilah', Niddah: 'nidah',
};

const chabadSet = (he, il, en) => [
  { id: 'bethchabad', name: 'בית חב״ד', lang: 'עברית', url: he },
  { id: 'chabadil', name: 'חב״ד ישראל', lang: 'עברית', url: il },
  { id: 'chabadorg', name: 'חב״ד.אורג', lang: 'אנגלית', url: en },
];
const sefariaSrc = { id: 'sefaria', name: 'ספריא ישראל', lang: 'עברית ואנגלית', url: (p) => sefariaIl(p.hc) };

export const SOURCES = {
  chumash: chabadSet((p) => HE + 'torahreading.asp?tdate=' + p.t, (p) => IL + 'Chumash.asp?CategoryID=175&DateParam=' + p.off, (p) => EN + 'torahreading.asp?tdate=' + p.t),
  tehilim: [...chabadSet((p) => HE + 'tehillim.asp?tdate=' + p.t, (p) => IL + 'Thilim.asp?CategoryID=175&DateParam=' + p.off, (p) => EN + 'tehillim.asp?tdate=' + p.t).slice(0, 2), sefariaSrc],
  tanya: [
    { id: 'sefaria', name: 'ספריא ישראל', lang: 'עברית', url: (p) => p.tanya },
    { id: 'chabadil', name: 'חב״ד ישראל', lang: 'עברית', url: (p) => IL + 'Tanya.asp?CategoryID=175&TanyaType=1&DateParam=' + p.off },
    { id: 'bethchabad', name: 'בית חב״ד', lang: 'עברית', url: (p) => HE + 'tanya.asp?tdate=' + p.t },
    { id: 'chabadorg', name: 'חב״ד.אורג', lang: 'אנגלית', url: (p) => EN + 'tanya.asp?tdate=' + p.t },
  ],
  hayomyom: chabadSet((p) => HE + 'hayomyom.asp?tdate=' + p.t, (p) => IL + 'Yom.asp?CategoryID=175&DateParam=' + p.off, (p) => EN + 'hayomyom.asp?tdate=' + p.t),
  rambam1: [...chabadSet((p) => HE + 'rambam.asp?rambamchapters=1&tdate=' + p.t, (p) => IL + 'Rambam1.asp?CategoryID=175&DateParam=' + p.off, (p) => EN + 'rambam.asp?rambamchapters=1&tdate=' + p.t), sefariaSrc],
  rambam3: [...chabadSet((p) => HE + 'rambam.asp?rambamchapters=3&tdate=' + p.t, (p) => IL + 'Rambam3.asp?CategoryID=175&DateParam=' + p.off, (p) => EN + 'rambam.asp?rambamchapters=3&tdate=' + p.t), sefariaSrc],
  sefermitzvos: [
    { id: 'bethchabad', name: 'בית חב״ד', lang: 'אנגלית', url: (p) => HE + 'seferHamitzvos.asp?tdate=' + p.t },
    { id: 'chabadil', name: 'חב״ד ישראל', lang: 'עברית', url: (p) => IL + 'RambamMitzvot.asp?CategoryID=175&DateParam=' + p.off },
    { id: 'chabadorg', name: 'חב״ד.אורג', lang: 'אנגלית', url: (p) => EN + 'seferHamitzvos.asp?tdate=' + p.t },
  ],
  dafyomi: [
    sefariaSrc,
    { id: 'dafyomi', name: 'dafyomi.org (תובנות)', lang: 'אנגלית', url: (p) => { const a = (p.hc || '').split('?')[0].split('/').pop(); const m = DAFYOMI[a.split('.')[0]]; return m ? 'https://www.dafyomi.org/index.php?masechta=' + m + '&daf=' + a.split('.')[1] + '&page=insights' : ''; } },
  ],
  mishna: [
    sefariaSrc,
    { id: 'wikisource', name: 'ויקיטקסט', lang: 'עברית', url: (p) => { const n = (p.hcText || '').replace(/\s*\d+:.*$/, '').trim(); const c = chapterOf(p.hc, 1); return n && c ? wiki('משנה ' + n + ' ' + letters(c)) : ''; } },
  ],
  nach: [
    sefariaSrc,
    { id: 'wikisource', name: 'ויקיטקסט', lang: 'עברית', url: (p) => { const n = NACH[sefName(p.hc)]; const c = chapterOf(p.hc, 1); return n && c ? wiki(n + ' ' + letters(c)) : ''; } },
  ],
  halacha: [
    sefariaSrc,
    { id: 'wikisource', name: 'ויקיטקסט', lang: 'עברית', url: (p) => { const c = chapterOf(p.hc, 1); return c ? wiki('קיצור שולחן ערוך ' + letters(c)) : ''; } },
  ],
  shnayim: [
    { id: 'bethchabad', name: 'בית חב״ד', lang: 'עברית', url: (p) => HE + 'torahreading.asp?tdate=' + p.satT },
    { id: 'chabadorg', name: 'חב״ד.אורג', lang: 'אנגלית', url: (p) => 'https://www.chabad.org/parshah/torahreading.asp?tdate=' + p.satT },
    { id: 'hebcal', name: 'Hebcal', lang: 'אנגלית', url: (p) => p.parshaUrl },
  ],
};

export const hasSources = (track) => !!SOURCES[track.tpl];
// קישור שנקבע ידנית על ידי המשתמש גובר על המקורות; קישור ברירת המחדל הישן לא
const isDefaultUrl = (u) => !u || u.startsWith('https://www.chabad.org/dailystudy/') || u === 'https://www.sefaria.org/calendars';

// הפרמטרים לחישוב קישורים ליום date; today = היום בפועל (להיסט ימים)
export function srcParams(date, today, extra = {}) {
  const mid = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const T = (d) => (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
  const off = Math.round((mid(date) - mid(today)) / 86400000);
  const sat = addDays(date, 6 - date.getDay());
  return Object.assign({ t: T(date), off, sat, satT: T(sat) }, extra);
}
// רשימת המקורות עם הקישור של כל אחד (url ריק = אין מקור זמין ליום הזה)
export function sourceList(track, params) {
  return (SOURCES[track.tpl] || []).map((s, i) => ({ i, id: s.id, name: s.name, lang: s.lang, url: s.url(params) || '' }));
}
// הקישור הנבחר: track.src (אינדקס), ואם אין ליום הזה - המקור הזמין הבא
export function pickSource(track, params) {
  const list = sourceList(track, params);
  if (!list.length) return null;
  const want = Math.min(Math.max(Number(track.src) || 0, 0), list.length - 1);
  return list[want].url ? list[want] : list.find((x) => x.url) || null;
}
export const customUrl = (track) => !isDefaultUrl(track.url);
