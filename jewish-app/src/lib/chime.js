// צליל עדין בסימון לימוד: קצר מאוד לסימון אחד, ומעט מלא יותר כשכל משימות היום הושלמו
import { get } from './store.js';
import { isNative, playPing } from './native.js';

let ac = null;
function audio() {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    return ac;
  } catch (e) { return null; }
}
function tone(a, freq, t0, dur, vol) {
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
export function chime(kind) {
  if (get().settings.markSound === false) return;
  if (isNative()) { playPing(kind); return; }
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.01;
  // כמו ב-native: כל המסלולים = מי (1319Hz), מסלול אחד = סי (988Hz, רבע למטה) וחלש יותר
  if (kind === 'all') tone(a, 1319, t, 0.6, 0.07);
  else tone(a, 988, t, 0.7, 0.045);
}
