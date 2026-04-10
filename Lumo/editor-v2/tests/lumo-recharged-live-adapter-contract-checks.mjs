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

if (html.includes('__LumoRechargedBoot')) {
  console.log('live adapter contract boot ok');
}

if (html.includes('.adapter')) {
  console.log('live adapter contract adapter ok');
}

if (html.includes('.tick(')) {
  console.log('live adapter contract tick ok');
}

if (html.includes('__LumoRechargedCanvas')) {
  console.log('live adapter contract canvas ok');
}
