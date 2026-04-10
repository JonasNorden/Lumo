import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import assert from 'node:assert/strict';

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

assert.equal(html.includes('adapter.tick('), true, 'Expected playable path to call adapter.tick(...).');
assert.equal(html.includes('getPlayerSnapshot'), true, 'Expected playable path to reference getPlayerSnapshot.');
assert.equal(html.includes('getBootPayload'), true, 'Expected playable path to reference getBootPayload.');
assert.equal(html.includes('__LumoRechargedBoot'), true, 'Expected playable path to reference __LumoRechargedBoot.');

console.log('playable contract adapter.tick ok');
console.log('playable contract getPlayerSnapshot ok');
console.log('playable contract getBootPayload ok');
console.log('playable contract __LumoRechargedBoot ok');
