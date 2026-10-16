// מצפן לבית המקדש: חיישן כיוון של המכשיר, בלי אינטרנט
let handler = null, lastHeading = null, mode = '';

export function startCompass(onHeading, onState) {
  stopCompass();
  const abs = 'ondeviceorientationabsolute' in window;
  const evName = abs ? 'deviceorientationabsolute' : 'deviceorientation';
  let got = false;
  handler = (e) => {
    let h = null;
    if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
    else if (e.alpha != null && (e.absolute || abs)) h = (360 - e.alpha) % 360;
    if (h == null || isNaN(h)) return;
    got = true; mode = abs ? 'abs' : 'rel';
    // החלקה קלה
    if (lastHeading != null) {
      let d = ((h - lastHeading + 540) % 360) - 180;
      h = (lastHeading + d * 0.35 + 360) % 360;
    }
    lastHeading = h;
    onHeading(h, e.absolute || abs);
  };
  const go = () => window.addEventListener(evName, handler, true);
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then((r) => { if (r === 'granted') go(); else onState('denied'); });
    } else go();
  } catch (e) { onState('none'); }
  setTimeout(() => { if (!got) onState('none'); }, 3000);
}
export function stopCompass() {
  if (handler) { window.removeEventListener('deviceorientationabsolute', handler, true); window.removeEventListener('deviceorientation', handler, true); handler = null; }
  lastHeading = null;
}
export const compassMode = () => mode;

export const DIRS = ['צפון', 'צפון-מזרח', 'מזרח', 'דרום-מזרח', 'דרום', 'דרום-מערב', 'מערב', 'צפון-מערב'];
export const dirName = (deg) => DIRS[Math.round(deg / 45) % 8];
