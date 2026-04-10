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
  `expected Lumo.html to exist; attempted paths:\n${lumoHtmlCandidates.join("\n")}`,
);
const html = readFileSync(htmlPath, "utf8");

assert.equal(html.includes("__LumoRechargedBoot"), true, "expected __LumoRechargedBoot marker in Lumo.html");
console.log("live adapter contract boot ok");

assert.equal(html.includes(".adapter"), true, "expected adapter attachment marker in Lumo.html");
console.log("live adapter contract adapter ok");

assert.equal(html.includes(".tick("), true, "expected live adapter tick marker in Lumo.html");
console.log("live adapter contract tick ok");

assert.equal(html.includes("__LumoRechargedCanvas"), true, "expected __LumoRechargedCanvas marker in Lumo.html");
console.log("live adapter contract canvas ok");
