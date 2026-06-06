import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createStoneAreaFromDrag,
  generateStoneAreaLayout,
  getStoneVisualGeometry,
  normalizeStoneAreaForEditor,
  updateStoneAreaField,
} from "../src/domain/worldAreas.js";
import { validateLevelDocument } from "../src/domain/level/levelDocument.js";
import { v2ToRuntimeLevelObject } from "../src/runtime/v2ToRuntimeLevelObject.js";
import { loadLevelDocument } from "../src/runtime/loadLevelDocument.js";
import { buildRuntimeWorldSkeleton } from "../src/runtime/buildRuntimeWorldSkeleton.js";
import { buildRuntimeWorldPacket } from "../src/runtime/buildRuntimeWorldPacket.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lumoHtmlPath = path.resolve(__dirname, "../../Lumo.html");
const editorStoneLayerPath = path.resolve(__dirname, "../src/render/layers/stoneAreaLayer.js");
const editorRendererPath = path.resolve(__dirname, "../src/render/renderer.js");

const baseDoc = {
  meta: { id: "stone-area-test", name: "Stone Area Test", version: "2.0.0" },
  dimensions: { width: 12, height: 8, tileSize: 24 },
  tiles: { base: Array.from({ length: 96 }, () => 0) },
  backgrounds: { layers: [] },
  background: { base: Array.from({ length: 96 }, () => null) },
  decor: [],
  entities: [],
  sounds: [],
  reactiveGrassPatches: [],
  mirrorSurfaceAreas: [],
  stoneAreas: [],
};

{
  const created = createStoneAreaFromDrag(baseDoc, { x: 1, y: 2 }, { x: 4, y: 5 });
  assert.equal(created.id, "stone_area-1");
  assert.equal(created.x, 24);
  assert.equal(created.y, 48);
  assert.equal(created.width, 96);
  assert.equal(created.height, 96);
  assert.equal(created.density, 0.35);
}

{
  const area = normalizeStoneAreaForEditor({ id: "field", width: 120, height: 80, density: 0.5, sizeVariation: 2, rotationVariation: -1, clusterStrength: 0.75 });
  assert.equal(area.sizeVariation, 1);
  assert.equal(area.rotationVariation, 0);
  assert.equal(area.clusterStrength, 0.75);
  assert.equal(updateStoneAreaField(area, "density", 0).density, 0);
  assert.equal(updateStoneAreaField(area, "density", 2).density, 1);
}

{
  const area = normalizeStoneAreaForEditor({ id: "stable", x: 24, y: 48, width: 144, height: 96, density: 0.5, sizeVariation: 0.6, rotationVariation: 0.8, clusterStrength: 0.7 });
  const first = generateStoneAreaLayout(area);
  const second = generateStoneAreaLayout({ ...area });
  assert.deepEqual(second, first, "same authored area must generate an identical layout");
  assert.ok(first.length > 0, "non-empty density should generate stones");

  const sparse = generateStoneAreaLayout({ ...area, density: 0.1 });
  const dense = generateStoneAreaLayout({ ...area, density: 0.9 });
  assert.ok(dense.length > sparse.length, "density should visibly affect generated count");
  assert.deepEqual(generateStoneAreaLayout({ ...area, density: 0 }), [], "empty density renders nothing");
}


{
  const area = normalizeStoneAreaForEditor({ id: "visual-style", x: 24, y: 48, width: 144, height: 96, density: 0.5, sizeVariation: 0.6, rotationVariation: 0.8, clusterStrength: 0.7 });
  const stones = generateStoneAreaLayout(area);
  assert.ok(stones.length > 0, "visual test area should generate stones");
  const firstVisual = stones[0].visual;
  assert.equal(firstVisual.kind, "stylized-faceted-polygon", "stones use the StoneLab faceted polygon visual model");
  assert.ok(firstVisual.points.length >= 7, "stone silhouette should be an irregular polygon, not a single ellipse");
  assert.ok(firstVisual.facets.length >= 3 && firstVisual.facets.length <= 5, "stone visual should expose 3-5 large shaded facets");
  assert.equal(getStoneVisualGeometry(stones[0]), firstVisual, "stone visual geometry should be cached and reusable for the same stone");
  assert.deepEqual(generateStoneAreaLayout(area)[0].visual, firstVisual, "generated stone visual geometry should be deterministic");

  const editorStoneLayerSource = fs.readFileSync(editorStoneLayerPath, "utf8");
  assert.equal(editorStoneLayerSource.includes("ctx.ellipse(0, 0, 1, 1"), false, "Editor V2 Stone Area preview should not use the old plain ellipse as the primary stone visual");
  assert.equal(editorStoneLayerSource.includes("tracePolygon"), true, "Editor V2 Stone Area preview should draw polygon silhouettes/facets");

  const lumoHtmlSource = fs.readFileSync(lumoHtmlPath, "utf8");
  assert.equal(lumoHtmlSource.includes("createRadialGradient(-rect.w * 0.18"), false, "runtime should not use the old gradient ellipse stone renderer");
  assert.equal(lumoHtmlSource.includes("traceRechargedStonePolygon"), true, "runtime should draw stylized polygon stone silhouettes/facets");
  assert.ok(
    lumoHtmlSource.indexOf("drawRechargedStoneAreas(ctx, mapper, stoneAreas, { tileSize });") < lumoHtmlSource.indexOf("renderReactiveGrass("),
    "runtime Stone Areas must render before reactive grass so grass appears in front",
  );

  const editorRendererSource = fs.readFileSync(editorRendererPath, "utf8");
  assert.ok(
    editorRendererSource.indexOf("renderStoneAreas(worldCtx") < editorRendererSource.indexOf("renderReactiveGrassPatches(worldCtx"),
    "Editor V2 Stone Area preview must render before reactive grass",
  );
}

{
  const disabledArea = normalizeStoneAreaForEditor({ id: "disabled", width: 120, height: 80, density: 0.8, enabled: false });
  const hiddenArea = normalizeStoneAreaForEditor({ id: "hidden", width: 120, height: 80, density: 0.8, visible: false });
  assert.deepEqual(generateStoneAreaLayout(disabledArea), [], "disabled Stone Areas remain no-op");
  assert.deepEqual(generateStoneAreaLayout(hiddenArea), [], "hidden Stone Areas remain no-op");
}

{
  const normalized = validateLevelDocument({
    ...baseDoc,
    stoneAreas: [{ id: "save-me", x: 24, y: 48, width: 120, height: 72, density: 0.4, sizeVariation: 0.5, rotationVariation: 0.25, clusterStrength: 0.8 }],
  });
  assert.equal(normalized.stoneAreas.length, 1, "Stone Area saves in the Editor V2 document");
  assert.equal(normalized.stoneAreas[0].id, "save-me");

  const { runtimeLevel } = v2ToRuntimeLevelObject(normalized);
  assert.equal(runtimeLevel.stoneAreas.length, 1, "Stone Area exports to the runtime level object");
  assert.equal(Array.isArray(runtimeLevel.layers.ents), true, "Stone Area must not export as gameplay entity");

  const loaded = loadLevelDocument({
    identity: { id: "stone-runtime", name: "Stone Runtime", formatVersion: "recharged-1", themeId: "lumo" },
    world: { width: 12, height: 8, tileSize: 24, spawn: { x: 0, y: 0 } },
    layers: { tiles: [], background: [], bg: [], decor: [], entities: [], audio: [] },
    stoneAreas: runtimeLevel.stoneAreas,
    mirrorSurfaceAreas: [],
  });
  assert.equal(loaded.ok, true, loaded.errors.join("; "));
  assert.equal(loaded.level.stoneAreas.length, 1, "runtime loader receives authored Stone Areas");

  const skeleton = buildRuntimeWorldSkeleton(loaded.level);
  const packet = buildRuntimeWorldPacket({ skeleton });
  assert.equal(packet.stoneAreas.length, 1, "runtime world packet carries Stone Areas");
}

console.log("stone area contracts passed");
