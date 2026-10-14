'use strict';
// Builds dist/studio-desk.html: the whole app in one file, with styles and
// script inlined. Open it by double-clicking; no server needed (no sync then).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, 'app', f), 'utf8');
const icon = 'data:image/svg+xml;base64,' + Buffer.from(read('icons/icon.svg')).toString('base64');

const css = read('styles.css').replace(/url\("fonts\/([\w.-]+\.woff2)"\)/g, (m, f) =>
  `url("data:font/woff2;base64,${fs.readFileSync(path.join(root, 'app', 'fonts', f)).toString('base64')}")`);

const html = read('index.html')
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script src="vendor/qrcode.js"></script>', () => `<script>\n${read('vendor/qrcode.js')}\n</script>`)
  .replace('<script src="app.js"></script>', () => `<script>\n${read('app.js').replace(/<\/script/gi, '<\\/script')}\n</script>`)
  .replace(/<link rel="manifest"[^>]*>\n/, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\n/, '')
  .replace('href="icons/icon.svg"', `href="${icon}"`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'studio-desk.html');
fs.writeFileSync(out, html);
console.log(`Wrote ${path.relative(root, out)} (${Math.round(html.length / 1024)} KB)`);
