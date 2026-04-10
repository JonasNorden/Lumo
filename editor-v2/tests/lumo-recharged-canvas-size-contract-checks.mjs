import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const lumoHtmlCandidates = [
  resolve(__dirname, "..", "..", "Lumo.html"),
  resolve(__dirname, "..", "..", "Lumo", "Lumo.html"),
  resolve(__dirname, "..", "..", "..", "Lumo.html"),
  resolve(__dirname, "..", "..", "..", "Lumo", "Lumo.html"),
];

const htmlPath = lumoHtmlCandidates.find((candidatePath) => existsSync(candidatePath));
assert.ok(
  htmlPath,
  `expected playable Lumo.html to exist; attempted paths:\n${lumoHtmlCandidates.join("\n")}`,
);

const html = readFileSync(htmlPath, "utf8");

assert.equal(html.includes(".width ="), true, "expected explicit canvas drawing width assignment");
console.log("canvas size contract width ok");

assert.equal(html.includes(".height ="), true, "expected explicit canvas drawing height assignment");
console.log("canvas size contract height ok");

assert.equal(html.includes("__LumoRechargedCanvas"), true, "expected __LumoRechargedCanvas marker");
console.log("canvas size contract marker ok");

assert.equal(html.includes("requestAnimationFrame"), true, "expected requestAnimationFrame loop");
console.log("canvas size contract loop ok");
