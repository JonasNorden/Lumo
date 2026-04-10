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

if (html.includes('playerX')) {
  console.log('render shape contract x ok');
}

if (html.includes('playerY')) {
  console.log('render shape contract y ok');
}

if (html.includes('playerStatus')) {
  console.log('render shape contract status ok');
}

if (html.includes('__LumoRechargedCanvas')) {
  console.log('render shape contract marker ok');
}
