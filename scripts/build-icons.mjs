// Renders app icons / splash / PWA icons from one SVG using headless Chrome.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-'));

// Bus front, built on a 64-unit grid. `bg` null = transparent.
const glyph = (scale = 1) => `
  <g transform="translate(32 32) scale(${scale}) translate(-32 -32)">
    <rect x="17" y="11" width="30" height="36" rx="7" fill="#F4F5F1"/>
    <rect x="21" y="16" width="22" height="13" rx="3" fill="#15171A"/>
    <rect x="17" y="34.5" width="30" height="4" fill="#B8F23A"/>
    <circle cx="22.5" cy="42.5" r="1.8" fill="#15171A"/>
    <circle cx="41.5" cy="42.5" r="1.8" fill="#15171A"/>
    <rect x="20" y="47" width="6" height="5" rx="2" fill="#F4F5F1"/>
    <rect x="38" y="47" width="6" height="5" rx="2" fill="#F4F5F1"/>
  </g>`;
const svg = ({ bg = '#15171A', rx = 0, scale = 1 } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${bg ? `<rect width="64" height="64" rx="${rx}" fill="${bg}"/>` : ''}${glyph(scale)}</svg>`;

function render(name, size, markup, transparent = false) {
  const html = path.join(tmp, name.replace(/\W/g, '_') + '.html');
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div></body></html>`);
  const out = path.join(ROOT, name);
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${size},${size}`,
    ...(transparent ? ['--default-background-color=00000000'] : []),
    `--screenshot=${out}`, 'file://' + html,
  ], { stdio: 'ignore' });
  console.log('✓', name);
}

render('assets/icon.png', 1024, svg());
render('assets/adaptive-icon.png', 1024, svg({ bg: null, scale: 0.62 }), true);
render('assets/splash-icon.png', 512, svg({ rx: 14 }), true);
render('assets/favicon.png', 96, svg({ rx: 14 }), true);
render('public/icon-192.png', 192, svg({ rx: 14 }), true);
render('public/icon-512.png', 512, svg({ rx: 14 }), true);
render('public/icon-maskable-512.png', 512, svg({ scale: 0.72 }));
render('public/apple-touch-icon.png', 180, svg());
