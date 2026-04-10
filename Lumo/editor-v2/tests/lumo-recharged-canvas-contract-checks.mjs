import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");
const lumoHtmlPath = resolve(repoRoot, "Lumo.html");
const html = readFileSync(lumoHtmlPath, "utf8");

assert.equal(html.includes("__LumoRechargedCanvas"), true, "expected compact canvas marker");
console.log("canvas contract marker ok");

assert.equal(html.includes('script.src = "src/app.js"'), true, "expected legacy src/app.js fallback path");
console.log("canvas contract legacy fallback ok");

assert.equal(
  html.includes("bootLumoRechargedFromQuery") && html.includes('search: window.location.search'),
  true,
  "expected Recharged query boot hook",
);
console.log("canvas contract query hook ok");
