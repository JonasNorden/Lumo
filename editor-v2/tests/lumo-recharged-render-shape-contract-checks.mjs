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

assert.equal(html.includes("playerX"), true, "expected Recharged render path to read playerX");
console.log("render shape contract x ok");

assert.equal(html.includes("playerY"), true, "expected Recharged render path to read playerY");
console.log("render shape contract y ok");

assert.equal(html.includes("playerStatus"), true, "expected Recharged render path to read playerStatus");
console.log("render shape contract status ok");

assert.equal(html.includes("supportTiles"), true, "expected Recharged render path to read supportTiles");
console.log("render shape contract support tiles data ok");

assert.equal(
  html.includes("for (const supportTile of supportTiles)") && html.includes("supportCanvasRect") && html.includes("fillRect(supportCanvasRect.x, supportCanvasRect.y, supportCanvasRect.w, supportCanvasRect.h)"),
  true,
  "expected Recharged renderer to draw runtime support tile geometry",
);
console.log("render shape contract support tiles render ok");

assert.equal(
  html.includes("buildRechargedWorldToCanvasMapper") && html.includes("worldToCanvasRect"),
  true,
  "expected Recharged renderer to use a shared world-to-canvas mapper",
);
console.log("render shape contract world-to-canvas mapper ok");

assert.equal(
  html.includes("const worldRectH = tileH * worldUnitsToPx") && html.includes("const worldRectW = tileW * worldUnitsToPx"),
  true,
  "expected Recharged support render to scale tile rects by normalized world unit size",
);
console.log("render shape contract support world unit scaling ok");

assert.equal(
  html.includes("y: playerFootY + 1 - tileSize") && html.includes("x: playerCenterX - tileSize * 0.5"),
  true,
  "expected Recharged player draw rect to be foot-aligned and centered in world space",
);
console.log("render shape contract player/support alignment mapping ok");

assert.equal(html.includes("__LumoRechargedCanvas"), true, "expected __LumoRechargedCanvas marker");
console.log("render shape contract marker ok");
