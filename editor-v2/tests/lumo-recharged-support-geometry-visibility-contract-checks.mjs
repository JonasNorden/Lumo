import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function resolveExistingPath(candidates, label) {
  const match = candidates.find((candidatePath) => existsSync(candidatePath));
  assert.ok(match, `expected ${label} to exist; attempted paths:\n${candidates.join("\n")}`);
  return match;
}

const htmlPath = resolveExistingPath(
  [
    resolve(__dirname, "..", "..", "Lumo.html"),
    resolve(__dirname, "..", "..", "Lumo", "Lumo.html"),
    resolve(__dirname, "..", "..", "..", "Lumo.html"),
    resolve(__dirname, "..", "..", "..", "Lumo", "Lumo.html"),
  ],
  "Lumo.html",
);
const html = readFileSync(htmlPath, "utf8");

assert.equal(
  html.includes("const worldUnitsToPx = coordinatesLookTileBased ? tileSize : 1"),
  true,
  "expected renderer to normalize world/support units into world pixel space",
);
console.log("support geometry visibility contract world unit normalization ok");

assert.equal(
  html.includes("const supportCanvasRect = mapper.worldToCanvasRect(worldRectX, worldRectY, worldRectW, worldRectH)") &&
    html.includes("ctx.fillRect(supportCanvasRect.x, supportCanvasRect.y, supportCanvasRect.w, supportCanvasRect.h)"),
  true,
  "expected renderer to draw full support rect height via world-to-canvas mapping",
);
console.log("support geometry visibility contract full-height rect render ok");

assert.equal(
  html.includes("y: playerFootY + 1 - tileSize") && html.includes("const playerCanvasRect = mapper.worldToCanvasRect"),
  true,
  "expected renderer to foot-align player to support top using same mapper",
);
console.log("support geometry visibility contract player foot alignment ok");

const levelPath = resolveExistingPath(
  [
    resolve(__dirname, "..", "src", "data", "testLevelDocument.v1.json"),
    resolve(__dirname, "..", "..", "Lumo", "editor-v2", "src", "data", "testLevelDocument.v1.json"),
  ],
  "testLevelDocument.v1.json",
);
const level = JSON.parse(readFileSync(levelPath, "utf8"));
const tileSize = Number(level?.world?.tileSize) || 0;
const supportTiles = Array.isArray(level?.layers?.tiles) ? level.layers.tiles : [];
assert.ok(tileSize > 0, "expected default Recharged test level to expose a valid tileSize");

const maxSupportBottom = supportTiles.reduce((maxBottom, tile) => {
  if (!Number.isFinite(tile?.y) || !Number.isFinite(tile?.h)) {
    return maxBottom;
  }
  return Math.max(maxBottom, tile.y + tile.h);
}, 0);

const lowerSupportRow = supportTiles.find((tile) => (
  Number.isFinite(tile?.y) &&
  Number.isFinite(tile?.h) &&
  tile.y + tile.h === maxSupportBottom
));
assert.ok(lowerSupportRow, "expected default Recharged runtime data to include a lower floor support row");
assert.ok(lowerSupportRow.h >= tileSize, "expected lower support row height to be at least one full tile");
console.log("support geometry visibility contract lower floor row exists and is full tile height ok");

const upperPlatform = supportTiles.find((tile) => (
  Number.isFinite(tile?.y) && Number.isFinite(tile?.h) && tile.y + tile.h < level.world.height - tileSize
));
assert.ok(upperPlatform, "expected default Recharged runtime data to include at least one elevated support platform");
assert.ok(upperPlatform.h >= tileSize, "expected elevated support platform to be at least one full tile high");
console.log("support geometry visibility contract elevated platform exists and is full tile height ok");
