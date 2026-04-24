import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");
const lumoHtmlPath = resolve(repoRoot, "Lumo.html");
const html = readFileSync(lumoHtmlPath, "utf8");

function runRealRechargedRenderPathChecks() {
  assert.equal(html.includes("function renderRechargedCanvasFrame(canvas, state)"), true, "expected real Recharged render function in Lumo.html");
  assert.equal(html.includes("const backdropGradient = ctx.createLinearGradient"), true, "expected Recharged runtime background gradient for readability in live Lumo.html path");
  assert.equal(html.includes("drawRechargedPlayerSprite(ctx, mapper"), true, "expected live Recharged path to use the shared player sprite renderer");
  assert.equal(html.includes("const RECHARGED_PLAYER_HITBOX_WIDTH = 22;"), true, "expected Recharged render path to mirror V1 22px player hitbox width");
  assert.equal(html.includes("const RECHARGED_PLAYER_HITBOX_HEIGHT = 28;"), true, "expected Recharged render path to mirror V1 28px player hitbox height");
  assert.equal(html.includes("const RECHARGED_PLAYER_SPRITE_HEIGHT = 38;"), true, "expected Recharged render path to mirror V1 38px body sprite height");
  assert.equal(html.includes("const RECHARGED_PLAYER_BRAKE_SPRITE_HEIGHT = 48;"), true, "expected Recharged render path to keep V1 brake sprite visual height");
}

function runSupportGeometryPresentationChecks() {
  assert.equal(html.includes("for (const supportTile of supportTiles)"), true, "expected support drawing to come directly from runtime supportTiles data");
  assert.equal(html.includes("const supportCanvasRect = mapper.worldToCanvasRect"), true, "expected support geometry to stay in true world-to-canvas mapper");
  assert.equal(html.includes("function drawRechargedTileV1Visual("), true, "expected Recharged tile visuals to use a V1-style tile image draw helper");
  assert.equal(html.includes("const drewV1Visual = drawRechargedTileV1Visual"), true, "expected support tile loop to attempt V1 tile visual draw before fallback");
  assert.equal(html.includes("window?.Lumo?.Tileset"), true, "expected fallback colors to mirror V1 tile behavior palette when tile art is unavailable");
  assert.equal(html.includes("normalizedEntityType === \"player-spawn\" || normalizedEntityType === \"start_01\" || normalizedEntityType === \"start\""), true, "expected Recharged entity render loop to keep spawn/start markers invisible so they cannot hit unknown fallback visuals");
}

function runMovingPlatformVisualContractChecks() {
  assert.equal(html.includes("normalizedEntityType === \"movingplatform\" || normalizedEntityType === \"moving_platform\""), true, "expected movingPlatform type to have a dedicated runtime render branch");
  assert.equal(html.includes("const spriteTileId = typeof platformParams.spriteTileId === \"string\""), true, "expected movingPlatform runtime branch to read params.spriteTileId for tile-art resolution");
  assert.equal(html.includes("const movingPlatformSupportLikeTile = {"), true, "expected movingPlatform runtime branch to build a supportTile-shape visual object");
  assert.equal(html.includes("const renderedMovingPlatformVisual = drawRechargedTileV1Visual("), true, "expected movingPlatform runtime branch to reuse the support tile visual helper");
  assert.equal(html.includes("if (renderedMovingPlatformVisual) {\n              continue;\n            }"), true, "expected movingPlatform to skip generic entity debug fallback when tile visual draw succeeds");
}

runRealRechargedRenderPathChecks();
runSupportGeometryPresentationChecks();
runMovingPlatformVisualContractChecks();

console.log("lumo-recharged-runtime-visual-contract-checks: ok");
