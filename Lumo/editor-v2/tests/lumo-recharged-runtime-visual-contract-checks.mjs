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
  assert.equal(html.includes("const movingPlatformLooksTileBased = Number.isFinite(entity?.x)"), true, "expected movingPlatform branch to detect tile-vs-pixel coordinates from live snapshot values");
  assert.equal(html.includes("const movingPlatformWorldX = movingPlatformLooksTileBased ? (entity.x * worldUnitsToPx) : entity.x;"), true, "expected pixel-space movingPlatform x to bypass tileSize multiplication");
  assert.equal(html.includes("const movingPlatformWorldY = movingPlatformLooksTileBased ? (entity.y * worldUnitsToPx) : entity.y;"), true, "expected pixel-space movingPlatform y to bypass tileSize multiplication");
  assert.equal(html.includes("const movingPlatformWidthPx = Math.max(1, widthTiles * tileSize);"), true, "expected movingPlatform visual width to come from params.widthTiles");
  assert.equal(html.includes("const movingPlatformHeightPx = Math.max(1, heightTiles * tileSize);"), true, "expected movingPlatform visual height to come from params.heightTiles");
  assert.equal(html.includes("const spriteTileId = typeof platformParams.spriteTileId === \"string\""), true, "expected movingPlatform runtime branch to read params.spriteTileId for tile-art resolution");
  assert.equal(html.includes("function drawRechargedTileV1VisualAtWorldRect("), true, "expected movingPlatform visuals to use a helper that draws with explicit world rect input");
  assert.equal(html.includes("function drawMovingPlatformVisual("), true, "expected movingPlatform visuals to use dedicated draw helper preserving runtime position");
  assert.equal(html.includes("const visualResult = drawRechargedTileV1VisualAtWorldRect"), true, "expected movingPlatform path to resolve tile catalog art while drawing at explicit world x/y");
  assert.equal(html.includes("const fallbackWorldDrawRect = visualDescriptor"), true, "expected fallback rendering rect to align with resolved sprite draw metadata");
  assert.equal(html.includes("const movingPlatformVisualResult = drawMovingPlatformVisual("), true, "expected movingPlatform render branch to call dedicated visual helper");
  assert.equal(html.includes("let renderedMovingPlatformFallback = false;"), false, "expected movingPlatform fallback flag to come from helper result");
  assert.equal(html.includes("if (!renderedMovingPlatformVisual) {"), false, "expected movingPlatform fallback drawing to be encapsulated in helper");
  assert.equal(html.includes("visualMode: renderedMovingPlatformVisual ? \"sprite\" : (renderedMovingPlatformFallback ? \"fallback\" : \"none\")"), true, "expected movingPlatform debug payload to expose visual mode for jitter tracing");
  assert.equal(html.includes("if (renderedMovingPlatformVisual || renderedMovingPlatformFallback) {\n              continue;\n            }"), true, "expected generic entity debug fallback to be skipped only after movingPlatform drew visual or fallback");
}

runRealRechargedRenderPathChecks();
runSupportGeometryPresentationChecks();
runMovingPlatformVisualContractChecks();

console.log("lumo-recharged-runtime-visual-contract-checks: ok");
