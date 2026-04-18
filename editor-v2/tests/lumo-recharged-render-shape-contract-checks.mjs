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
  html.includes("y: playerFootY + 1 - tileSize")
    || html.includes("y: playerFootY + 1 - RECHARGED_PLAYER_HITBOX_HEIGHT"),
  true,
  "expected Recharged player draw rect to remain foot-aligned in world space",
);
console.log("render shape contract player/support alignment mapping ok");

assert.equal(
  html.includes("entity.x,") && html.includes("entity.y,") && !html.includes("entity.y - entity.size"),
  true,
  "expected Recharged entity draw rect to treat runtime entity coordinates as top-left pixels",
);
console.log("render shape contract entity top-left mapping ok");

assert.equal(html.includes("__LumoRechargedCanvas"), true, "expected __LumoRechargedCanvas marker");
console.log("render shape contract marker ok");

assert.equal(
  html.includes("const projectileSpritePath = typeof entity._projectileSpritePath === \"string\" && entity._projectileSpritePath.length > 0") &&
    html.includes("getRechargedDarkSpellCustomSprite(entityVisualState, projectileSpritePath)"),
  true,
  "expected Recharged dark projectile render path to prefer _projectileSpritePath custom art first",
);
console.log("render shape contract dark projectile custom-path preference ok");

assert.equal(
  html.includes("RECHARGED_ENTITY_SPRITE_DARK_SPELL_FLIGHT = \"data/assets/sprites/creatures/void_m_04.png\"") &&
    html.includes("RECHARGED_ENTITY_SPRITE_DARK_SPELL_IMPACT03 = \"data/assets/sprites/creatures/void_m_03.png\"") &&
    html.includes("RECHARGED_ENTITY_SPRITE_DARK_SPELL_IMPACT02 = \"data/assets/sprites/creatures/void_m_02.png\"") &&
    html.includes("RECHARGED_ENTITY_SPRITE_DARK_SPELL_IMPACT01 = \"data/assets/sprites/creatures/void_m_01.png\""),
  true,
  "expected Recharged dark spell fallback assets to match V1 legacy paths",
);
console.log("render shape contract dark spell legacy fallback assets ok");

assert.equal(
  html.includes("let hazardSprite = darkSpellSprites.impact01;") &&
    html.includes("if (hazardT < 0.15) hazardSprite = darkSpellSprites.impact03;") &&
    html.includes("else if (hazardT < 0.3) hazardSprite = darkSpellSprites.impact02;"),
  true,
  "expected Recharged dark hazard fallback sequence to match V1 impact03/impact02/impact01 timing order",
);
console.log("render shape contract dark hazard fallback sequence ok");
