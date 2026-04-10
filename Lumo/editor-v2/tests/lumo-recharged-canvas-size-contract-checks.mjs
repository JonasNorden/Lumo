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

if (html.includes('.width =') || html.includes('canvas.width =')) {
  console.log('canvas size contract width ok');
}

if (html.includes('.height =') || html.includes('canvas.height =')) {
  console.log('canvas size contract height ok');
}

if (html.includes('__LumoRechargedCanvas')) {
  console.log('canvas size contract marker ok');
}

if (html.includes('requestAnimationFrame')) {
  console.log('canvas size contract loop ok');
}
