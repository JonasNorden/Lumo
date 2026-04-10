import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");

const lumoHtmlCandidates = [
  resolve(repoRoot, "Lumo.html"),
  resolve(repoRoot, "Lumo", "Lumo.html"),
];

const htmlPath = lumoHtmlCandidates.find((candidatePath) => {
  try {
    readFileSync(candidatePath, "utf8");
    return true;
  } catch {
    return false;
  }
});

assert.ok(htmlPath, "expected playable Lumo.html to exist");
const html = readFileSync(htmlPath, "utf8");

const hasRechargedInputHook =
  html.includes('src="src/core/input.js"') ||
  html.includes("src='src/core/input.js'") ||
  (html.includes("keydown") && html.includes("keyup"));
assert.equal(hasRechargedInputHook, true, "expected Recharged keyboard input listeners/hooks in Lumo.html");
console.log("playable contract input ok");

assert.equal(
  html.includes("requestAnimationFrame") && html.includes("runFrame"),
  true,
  "expected requestAnimationFrame loop in Lumo.html",
);
console.log("playable contract loop ok");

assert.equal(html.includes("__LumoRechargedCanvas"), true, "expected __LumoRechargedCanvas marker in Lumo.html");
console.log("playable contract canvas ok");

assert.equal(html.includes('script.src = "src/app.js"'), true, "expected legacy src/app.js fallback in Lumo.html");
console.log("playable contract legacy ok");
