'use strict';
// Builds dist/studio-desk.html: the whole app in one file, with styles and
// script inlined. Open it by double-clicking; no server needed (no sync then).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, 'app', f), 'utf8');
const icon = 'data:image/svg+xml;base64,' + Buffer.from(read('icons/icon.svg')).toString('base64');

const html = read('index.html')
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${read('styles.css')}\n</style>`)
  .replace('<script src="app.js"></script>', () => `<script>\n${read('app.js').replace(/<\/script/gi, '<\\/script')}\n</script>`)
  .replace(/<link rel="manifest"[^>]*>\n/, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\n/, '')
  .replace('href="icons/icon.svg"', `href="${icon}"`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'studio-desk.html');
fs.writeFileSync(out, html);
console.log(`Wrote ${path.relative(root, out)} (${Math.round(html.length / 1024)} KB)`);
