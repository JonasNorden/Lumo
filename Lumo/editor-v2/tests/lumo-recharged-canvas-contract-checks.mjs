import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const lumoHtmlPath = resolve(process.cwd(), "Lumo/Lumo.html");
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
