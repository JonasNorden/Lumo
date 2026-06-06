import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  generateStoneAreaLayout,
  getStoneVisualContactOffsetY,
  getStoneVisualGeometry,
} from "../../Lumo/editor-v2/src/domain/worldAreas.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const stoneLayerSource = readFileSync(resolve(repoRoot, "Lumo", "editor-v2", "src", "render", "layers", "stoneAreaLayer.js"), "utf8");
const runtimeSource = readFileSync(resolve(repoRoot, "Lumo", "Lumo.html"), "utf8");

const testArea = {
  id: "stone_area_contract",
  x: 48,
  y: 96,
  width: 240,
  height: 72,
  density: 0.8,
  sizeVariation: 0.55,
  rotationVariation: 0.75,
  clusterStrength: 0.6,
  enabled: true,
  visible: true,
};

const stones = generateStoneAreaLayout(testArea, 0);
assert.ok(stones.length > 0, "expected enabled visible stone area to generate stones");
const baselineY = testArea.y + testArea.height;
for (const stone of stones) {
  const bottomY = stone.y + getStoneVisualContactOffsetY(stone);
  assert.equal(Math.round(bottomY * 100) / 100, baselineY, `stone ${stone.id} bottom must sit exactly on baseline`);
  assert.ok(stone.visual.points.every((point) => point.y <= 1), `stone ${stone.id} geometry must not pass below baseline`);
}

assert.deepEqual(generateStoneAreaLayout({ ...testArea, enabled: false }, 0), [], "disabled stone areas remain no-op");
assert.deepEqual(generateStoneAreaLayout({ ...testArea, visible: false }, 0), [], "hidden stone areas remain no-op");
assert.deepEqual(generateStoneAreaLayout({ ...testArea, density: 0 }, 0), [], "empty stone areas remain no-op");

const firstVisual = getStoneVisualGeometry(stones[0]);
assert.equal(firstVisual.kind, "stonelab-grounded-faceted-polygon", "stone visuals use the grounded StoneLab faceted polygon geometry contract");
assert.ok(firstVisual.points.length >= 7 && firstVisual.points.length <= 9, "stone visual uses the StoneLab 7-9 silhouette point range");
assert.equal(firstVisual.points[0].y, 1, "stone visual starts with a flat baseline point");
assert.equal(firstVisual.points.at(-1).y, 1, "stone visual ends with a flat baseline point");
assert.ok(Array.isArray(firstVisual.facets) && firstVisual.facets.length >= 5, "stone visual exposes multiple StoneLab facets");
assert.deepEqual(generateStoneAreaLayout(testArea, 0), generateStoneAreaLayout(testArea, 0), "stone layout is deterministic for runtime/editor parity");

assert.match(stoneLayerSource, /export function drawStone/, "Editor V2 exposes the shared faceted stone draw helper");
assert.match(stoneLayerSource, /tracePolygon\(ctx, visual\.points\)/, "Editor V2 Stone Area preview draws polygon bodies");
assert.doesNotMatch(stoneLayerSource, /ctx\.rotate\(stone\.rotation/, "Editor V2 Stone Area preview keeps flat bottom baselines unrotated");
assert.match(stoneLayerSource, /for \(const facet of visual\.facets\)/, "Editor V2 Stone Area preview draws stone facets");
assert.match(stoneLayerSource, /generateStoneAreaLayout\(preview, areas\.length\)/, "Editor V2 placement preview renders generated faceted stones, not just an area rectangle");
assert.doesNotMatch(stoneLayerSource, /ctx\.ellipse\([^\n]+stone\.radiusX[^\n]+stone\.radiusY/, "Editor V2 must not render placeholder ellipse stone bodies");

assert.match(runtimeSource, /kind: "stonelab-grounded-faceted-polygon"/, "runtime uses the same grounded StoneLab geometry kind as editor");
assert.match(runtimeSource, /getRechargedStoneVisualContactOffsetY/, "runtime grounds stones by visual contact point");
assert.match(runtimeSource, /buildRechargedMirrorStoneReflectionCandidates/, "runtime prepares cheap cached Stone Area reflection candidates");
assert.match(runtimeSource, /drawRechargedStoneMirrorReflections/, "runtime draws clipped local Stone Area reflections");
assert.match(runtimeSource, /reflected: true/, "runtime mirror reflection path uses the reflected stone renderer without contact shadows");
assert.match(runtimeSource, /stoneAreas,/, "Mirror Surface receives Stone Area layouts for reflection without a full-canvas pass");

assert.match(runtimeSource, /resolveRechargedPlayerRenderVisual/, "Lumo reflection shares the current player render visual resolver");
assert.match(runtimeSource, /playerVisual\?\.sprite/, "Mirror Surface uses the current player visual sprite instead of a hard-coded idle sprite");
assert.doesNotMatch(runtimeSource, /const sprite = spriteCache\?\.idle\?\.complete === true \? spriteCache\.idle : null/, "Mirror Surface must not hardcode idle/front Lumo reflection sprite");
assert.match(runtimeSource, /ctx\.scale\(playerVisual\.facing < 0 \? -1 : 1, -1\)/, "Lumo reflection preserves current facing while mirroring vertically");

assert.match(runtimeSource, /buildRechargedMirrorDecorReflectionCandidates/, "static decor mirror reflection contract remains wired");
assert.match(runtimeSource, /drawReactiveDecorMirrorReflections/, "reactive decor mirror reflection contract remains wired");

console.log("lumo-recharged-stone-mirror-fix-contract-checks: ok");
