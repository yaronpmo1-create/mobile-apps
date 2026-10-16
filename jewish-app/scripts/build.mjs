// בונה www/: חבילת JS אחת (כולל Hebcal), HTML, CSS ואייקון
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
await build({
  entryPoints: [path.join(root, 'src/main.js')], bundle: true, minify: true, format: 'iife', target: ['chrome90'],
  outfile: path.join(out, 'app.js'), legalComments: 'none', logLevel: 'info', define: { 'process.env.NODE_ENV': '"production"' },
});
for (const f of ['index.html', 'styles.css']) fs.copyFileSync(path.join(root, 'src', f), path.join(out, f));
console.log('www ready');
