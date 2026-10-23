// מצפן לבית המקדש: חוגה מעוצבת (SVG), חץ עם סמל וכיתוב, מרחק, זריחה ושקיעה, הסבר "לאן מתפללים" וכיול
import { h, openPage, openSheet, toast } from '../ui.js';
import { ctx } from '../core.js';
import { bearingTo, distanceKm, getLoc, inIsrael } from '../lib/zm.js';
import { startCompass, stopCompass, dirName, compassMode } from '../lib/compass.js';

const NS = 'http://www.w3.org/2000/svg';
const rad = (d) => (d * Math.PI) / 180;

// כיוון זריחה ושקיעה (מעלות מצפון) ליום נתון, לפי קו רוחב והנטייה השמשית
export function sunAzimuths(lat, date) {
  const n = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const dec = 23.44 * Math.sin(rad((360 / 365) * (284 + n)));
  const x = Math.sin(rad(dec)) / Math.cos(rad(lat));
  if (Math.abs(x) > 1) return null;
  const rise = (Math.acos(x) * 180) / Math.PI;
  return { rise, set: 360 - rise };
}

const polar = (cx, cy, r, a) => [cx + r * Math.sin(rad(a)), cy - r * Math.cos(rad(a))];

function dialSvg(sun) {
  let t = '';
  for (let a = 0; a < 360; a += 10) {
    const major = a % 30 === 0;
    const [x1, y1] = polar(160, 160, major ? 134 : 140, a), [x2, y2] = polar(160, 160, 148, a);
    t += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" style="stroke:var(--dim)" stroke-width="' + (major ? 2 : 1) + '"/>';
  }
  const card = [['צ', 0, 'var(--bad)'], ['מז', 90, 'var(--text)'], ['ד', 180, 'var(--text)'], ['מע', 270, 'var(--text)']];
  card.forEach(([l, a, col]) => {
    const [x, y] = polar(160, 160, 118, a);
    t += '<text x="' + x.toFixed(1) + '" y="' + (y + 5).toFixed(1) + '" text-anchor="middle" font-size="15" font-weight="800" style="fill:' + col + '">' + l + '</text>';
  });
  if (sun) {
    [[sun.rise, 'זריחה', 'var(--warn)'], [sun.set, 'שקיעה', 'var(--info)']].forEach(([a, l, col]) => {
      const [x, y] = polar(160, 160, 104, a), [lx, ly] = polar(160, 160, 80, a);
      t += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="6" style="fill:' + col + '"/>';
      t += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="middle" font-size="10" style="fill:' + col + '">' + l + '</text>';
    });
  }
  return t;
}

const TEMPLE = '<path d="M-8 -3 0 -9 8 -3zM-7 -1.5h14M-5.5 0v7M-2 0v7M2 0v7M5.5 0v7M-8 8.5h16" fill="none" style="stroke:var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';

function prayInfo(loc, dist) {
  if (dist < 1) return 'אתם בהר הבית: מתפללים לכיוון קודש הקודשים. יש לברר את הכללים להתנהגות בהר הבית אצל רב מוסמך.';
  if (dist < 25) return 'אתם בירושלים: מתפללים לכיוון הר הבית, מקום בית המקדש.';
  if (inIsrael(loc.lat, loc.lon)) return 'אתם בארץ ישראל: מתפללים לכיוון ירושלים, ובירושלים לכיוון בית המקדש.';
  return 'בחוץ לארץ: מתפללים לכיוון ארץ ישראל, ובארץ ישראל לכיוון ירושלים, ובירושלים לכיוון בית המקדש. המצפן מציג את הכיוון הקצר ביותר מהמיקום שהגדרתם (' + loc.name + ').';
}

export function openCompass() {
  const c = ctx();
  const loc = getLoc(c.s);
  const bear = bearingTo(loc.lat, loc.lon);
  const dist = Math.round(distanceKm(loc.lat, loc.lon));
  const sun = sunAzimuths(loc.lat, new Date());
  let aligned = false, jumps = [], warned = false, lastHd = null;
  openPage('מצפן לבית המקדש', () => {
    const root = h('div', { style: 'text-align:center' });
    const wrap = h('div', { style: 'width:min(86vw,340px);margin:6px auto 0' });
    wrap.innerHTML = '<svg viewBox="0 0 320 320" width="100%" role="img" aria-label="מצפן לבית המקדש">' +
      '<circle id="cring" cx="160" cy="160" r="156" style="fill:var(--card);stroke:var(--line)" stroke-width="3"/>' +
      '<g id="cdial" style="transform-origin:160px 160px;transition:transform .12s linear">' + dialSvg(sun) + '</g>' +
      '<g id="cneedle" style="transform-origin:160px 160px;transition:transform .12s linear">' +
      '<path d="M160 160 L152 150 L160 66 L168 150Z" style="fill:var(--accent)"/>' +
      '<path d="M160 160 L153 152 L160 190 L167 152Z" style="fill:var(--line)"/>' +
      '<circle cx="160" cy="58" r="19" style="fill:var(--card);stroke:var(--accent)" stroke-width="2"/>' +
      '<g transform="translate(160 58)">' + TEMPLE + '</g>' +
      '<g id="clabel" style="transform-origin:160px 104px"><rect x="120" y="94" width="80" height="20" rx="10" style="fill:var(--card);stroke:var(--accent)" stroke-width="1.5"/>' +
      '<text x="160" y="108.5" text-anchor="middle" font-size="12" font-weight="800" style="fill:var(--text)">בית המקדש</text></g>' +
      '</g>' +
      '<circle cx="160" cy="160" r="9" style="fill:var(--text)"/><circle cx="160" cy="160" r="3.5" style="fill:var(--card)"/></svg>';
    root.appendChild(wrap);
    const msg = h('p', { class: 'muted', style: 'margin:2px 0 8px;min-height:1.4em' }, 'מחפש חיישן כיוון...');
    root.appendChild(msg);
    const chip = (k, v) => h('div', { class: 'card mini', style: 'text-align:center;min-width:0' }, h('div', { class: 'muted small' }, k), h('div', { class: 'big mid' }, v));
    const hdChip = h('div', { class: 'big mid' }, '-');
    root.appendChild(h('div', { style: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:6px 0 10px' },
      chip('מרחק', dist < 2 ? 'כאן' : dist.toLocaleString('he-IL') + ' ק״מ'),
      chip('כיוון · ' + dirName(bear), Math.round(bear) + '°'),
      h('div', { class: 'card mini', style: 'text-align:center;min-width:0' }, h('div', { class: 'muted small' }, 'הטלפון'), hdChip)));
    if (sun) root.appendChild(h('p', { class: 'dim small', style: 'margin:0 0 8px' }, 'על החוגה: זריחה היום ב-' + Math.round(sun.rise) + '° ושקיעה ב-' + Math.round(sun.set) + '° (' + dirName(sun.rise) + ' ו' + dirName(sun.set) + ')'));
    root.appendChild(h('div', { class: 'inline', style: 'margin-top:4px' },
      h('button', { class: 'btn sec', onclick: () => openSheet('לאן מתפללים?', () => h('div', null, h('p', { style: 'line-height:1.7' }, prayInfo(loc, dist)), h('p', { class: 'dim small' }, 'לשאלות הלכתיות לגבי מקום מסוים: לפנות לרב.')) ) }, 'לאן מתפללים?'),
      h('button', { class: 'btn sec', onclick: () => calibSheet() }, 'כיול')));
    root.appendChild(h('p', { class: 'dim small', style: 'margin-top:10px' }, 'המצפן עובד בלי אינטרנט, לפי חיישן הכיוון. כשהחוגה נצבעת בירוק אתם מכוונים לבית המקדש.'));
    const el = (id) => wrap.querySelector('#' + id);
    setTimeout(() => {
      startCompass((hd) => {
        const rot = bear - hd;
        el('cneedle').style.transform = 'rotate(' + rot + 'deg)';
        el('clabel').style.transform = 'rotate(' + -rot + 'deg)';
        el('cdial').style.transform = 'rotate(' + -hd + 'deg)';
        const diff = Math.abs(((rot + 540) % 360) - 180);
        const now = diff < 6;
        el('cring').style.stroke = now ? 'var(--ok)' : 'var(--line)';
        el('cring').setAttribute('stroke-width', now ? '7' : '3');
        if (now && !aligned) { try { navigator.vibrate && navigator.vibrate(60); } catch (e) { /* */ } }
        aligned = now;
        hdChip.textContent = Math.round(hd) + '°';
        msg.textContent = now ? 'מכוונים לבית המקדש ✓' : 'כיוון הטלפון: ' + dirName(hd);
        // הפרעה מגנטית: קפיצות גדולות חוזרות בכיוון
        const t = Date.now();
        if (lastHd != null && Math.abs(((hd - lastHd + 540) % 360) - 180) > 35) jumps.push(t);
        jumps = jumps.filter((x) => t - x < 4000);
        if (jumps.length >= 3 && !warned) { warned = true; toast('הכיוון קופץ: ייתכן שיש הפרעה מגנטית. התרחקו ממתכת וכיילו (כפתור כיול)'); setTimeout(() => (warned = false), 15000); }
        lastHd = hd;
      }, (state) => { msg.textContent = state === 'denied' ? 'אין הרשאה לחיישן.' : 'לא נמצא חיישן כיוון במכשיר. כיוון לבית המקדש: ' + Math.round(bear) + '° (' + dirName(bear) + ')'; });
    }, 50);
    return root;
  }, { onClose: stopCompass });
}

function calibSheet() {
  openSheet('כיול המצפן', () => {
    const d = h('div', { style: 'text-align:center' });
    d.innerHTML = '<svg viewBox="0 0 200 100" width="70%" aria-hidden="true"><path id="inf" d="M100 50C80 10 20 10 20 50S80 90 100 50 120 10 180 50 120 90 100 50Z" fill="none" style="stroke:var(--accent)" stroke-width="3"/><circle r="7" style="fill:var(--accent)"><animateMotion dur="3s" repeatCount="indefinite"><mpath href="#inf"/></animateMotion></circle></svg>';
    return h('div', null, d,
      h('p', { style: 'line-height:1.7' }, 'מחזיקים את הטלפון ומסובבים אותו בתנועת 8 באוויר, כמה פעמים, בכל הכיוונים.'),
      h('p', { class: 'dim small' }, 'מתרחקים ממתכת, מגנטים, רמקולים, כיסויי טלפון מגנטיים ומכשירי חשמל. בתוך רכב ובניין עם שלד ברזל החיישן פחות מדויק.' + (compassMode() === 'rel' ? ' במכשיר הזה החיישן יחסי ולא מוחלט, ולכן הדיוק נמוך יותר.' : '')));
  });
}
