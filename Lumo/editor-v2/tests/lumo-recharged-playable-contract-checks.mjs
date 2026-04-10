import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const candidates = [
  resolve(__dirname, '../../Lumo.html'),
  resolve(__dirname, '../../../Lumo.html')
];

const lumoHtmlPath = candidates.find((p) => existsSync(p));

if (!lumoHtmlPath) {
  throw new Error(`Could not find Lumo.html. Tried: ${candidates.join(' | ')}`);
}

const html = readFileSync(lumoHtmlPath, 'utf8');

if (
  html.includes('src/core/input.js') ||
  html.includes('./src/core/input.js') ||
  html.includes('keydown') ||
  html.includes('keyup')
) {
  console.log('playable contract input ok');
}

if (html.includes('requestAnimationFrame')) {
  console.log('playable contract loop ok');
}

if (html.includes('__LumoRechargedCanvas')) {
  console.log('playable contract canvas ok');
}

if (html.includes('src/app.js')) {
  console.log('playable contract legacy ok');
}
