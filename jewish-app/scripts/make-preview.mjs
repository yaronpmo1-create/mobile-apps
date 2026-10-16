// בונה קובץ HTML יחיד לתצוגה מקדימה של האפליקציה בדפדפן (בתוך מסגרת טלפון)
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const www = (f) => fs.readFileSync(path.join(root, 'www', f), 'utf8');
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
const doc = www('index.html')
  .replace('<link rel="stylesheet" href="styles.css">', () => '<style>' + www('styles.css') + '</style>')
  .replace('<script src="app.js"></script>', () => '<script>window.__PREVIEW=true;</script><script>' + safe(www('app.js')) + '</script>');
const tpl = fs.readFileSync(path.join(root, 'scripts/preview-shell.html'), 'utf8');
const lt = String.fromCharCode(92) + 'u003c';
const json = JSON.stringify(doc).split('<').join(lt);
const out = tpl.replace('/*DOC*/null', () => json);
fs.mkdirSync(path.join(root, 'preview'), { recursive: true });
fs.writeFileSync(path.join(root, 'preview/index.html'), out);
console.log('preview', (out.length / 1024).toFixed(0) + 'KB');
