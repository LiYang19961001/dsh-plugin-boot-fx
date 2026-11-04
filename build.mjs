// Build `client.js` and `icon.svg` from the template + the official whale path.
// Usage: node build.mjs
import fs from 'node:fs';
import path from 'node:path';

const here = import.meta.dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'package.json'), 'utf8'));
const whalePath = fs.readFileSync(path.join(here, 'assets', 'whale-path.txt'), 'utf8').trim();
if (!whalePath.startsWith('M') || whalePath.length < 1000) {
  throw new Error('assets/whale-path.txt does not look like the whale silhouette path');
}

const template = fs.readFileSync(path.join(here, 'client.template.js'), 'utf8');
for (const token of ['__WHALE_PATH__', '__PACKAGE_ID__', '__PACKAGE_VERSION__']) {
  if (!template.includes(token)) throw new Error('client.template.js lost its ' + token + ' placeholder');
}
const client = template
  .replaceAll('__WHALE_PATH__', whalePath)
  .replaceAll('__PACKAGE_ID__', manifest.name)
  .replaceAll('__PACKAGE_VERSION__', manifest.version);
for (const token of ['__WHALE_PATH__', '__PACKAGE_ID__', '__PACKAGE_VERSION__']) {
  if (client.includes(token)) throw new Error('client.js still contains ' + token);
}
fs.writeFileSync(path.join(here, 'client.js'), client, 'utf8');

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="bfxB" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0b1030"/>
      <stop offset="1" stop-color="#04060e"/>
    </linearGradient>
    <linearGradient id="bfxW" x1="12" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
      <stop stop-color="#9dc2ff"/>
      <stop offset="0.45" stop-color="#4d6bfe"/>
      <stop offset="1" stop-color="#9b86ff"/>
    </linearGradient>
    <radialGradient id="bfxG" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(32 28) rotate(90) scale(26)">
      <stop stop-color="#4d6bfe" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#4d6bfe" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="64" height="64" rx="15" fill="url(#bfxB)"/>
  <circle cx="32" cy="30" r="24" fill="url(#bfxG)"/>
  <g transform="translate(9 7) scale(0.92)">
    <path d="${whalePath}" fill="url(#bfxW)"/>
  </g>
  <circle cx="48" cy="14" r="1.4" fill="#6fe6ff"/>
  <circle cx="14" cy="49" r="1" fill="#9b86ff"/>
</svg>
`;
fs.writeFileSync(path.join(here, 'icon.svg'), icon, 'utf8');

console.log('built client.js (' + client.length + ' chars, ' + manifest.name + '@' + manifest.version + ') and icon.svg');
