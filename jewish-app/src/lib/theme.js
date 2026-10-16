// עיצוב: מראה בהיר/כהה, פלטות, גודל כתב, צפיפות, ניגודיות, פינות
import { PALETTES, TAB_COLORS } from './store.js';

const DARK = { bg: '#0A101B', card: '#17233A', card2: '#1E2D48', line: '#243149', text: '#F3EFE8', muted: '#AEB9CC', dim: '#8F9BB0', ok: '#4CC9B0', warn: '#F0A04B', bad: '#E5586B', info: '#6FA3FF', onAccent: '#0A101B' };
const LIGHT = { bg: '#F4F1EA', card: '#FFFFFF', card2: '#EFEAE0', line: '#DDD6C8', text: '#1B2433', muted: '#586277', dim: '#7A8498', ok: '#18866F', warn: '#C46B10', bad: '#C23046', info: '#2A62C4', onAccent: '#FFFFFF' };
const HC_DARK = { bg: '#000000', card: '#0D0D0D', card2: '#1A1A1A', line: '#FFFFFF', text: '#FFFFFF', muted: '#F0F0F0', dim: '#DDDDDD', ok: '#36F0C8', warn: '#FFB04A', bad: '#FF6B80', info: '#8CBBFF', onAccent: '#000000' };
const HC_LIGHT = { bg: '#FFFFFF', card: '#FFFFFF', card2: '#EDEDED', line: '#000000', text: '#000000', muted: '#1A1A1A', dim: '#333333', ok: '#006B52', warn: '#9A4A00', bad: '#A00020', info: '#0A3FA0', onAccent: '#FFFFFF' };

export function isDark(s) {
  if (s.theme === 'dark') return true;
  if (s.theme === 'light') return false;
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return true; }
}
export function applyTheme(s, tab) {
  const dark = isDark(s);
  const base = s.contrast ? (dark ? HC_DARK : HC_LIGHT) : dark ? DARK : LIGHT;
  const r = document.documentElement.style;
  for (const k in base) r.setProperty('--' + k, base[k]);
  let accent = (PALETTES[s.palette] || PALETTES.gold)[1];
  if (s.tabColors && tab && TAB_COLORS[tab]) accent = TAB_COLORS[tab];
  if (dark && !s.contrast) accent = lighten(accent, 0.18);
  r.setProperty('--accent', accent);
  r.setProperty('--accentSoft', accent + '33');
  r.setProperty('--radius', s.corners === 'sharp' ? '4px' : '16px');
  r.setProperty('--radiusS', s.corners === 'sharp' ? '3px' : '10px');
  r.setProperty('--fs', String(s.fontScale || 1));
  r.setProperty('--pad', s.density === 'compact' ? '8px' : s.density === 'roomy' ? '16px' : '12px');
  document.documentElement.dataset.contrast = s.contrast ? '1' : '0';
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.setAttribute('content', base.bg);
}
function lighten(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.round(c + (255 - c) * a);
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
