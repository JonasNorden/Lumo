import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createStoneAreaFromDrag,
  generateStoneAreaLayout,
  getStoneVisualContactOffsetY,
  getStoneVisualGeometry,
  getStoneVisualWorldBottomY,
  getStoneVisualWorldTopY,
  normalizeStoneAreaForEditor,
  updateStoneAreaField,
} from "../src/domain/worldAreas.js";
import { validateLevelDocument } from "../src/domain/level/levelDocument.js";
import { v2ToRuntimeLevelObject } from "../src/runtime/v2ToRuntimeLevelObject.js";
import { loadLevelDocument } from "../src/runtime/loadLevelDocument.js";
import { buildRuntimeWorldSkeleton } from "../src/runtime/buildRuntimeWorldSkeleton.js";
import { buildRuntimeWorldPacket } from "../src/runtime/buildRuntimeWorldPacket.js";
import { getSelectionEditorPanelContent } from "../src/ui/selectionEditorPanel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lumoHtmlPath = path.resolve(__dirname, "../../Lumo.html");
const editorStoneLayerPath = path.resolve(__dirname, "../src/render/layers/stoneAreaLayer.js");
const editorRendererPath = path.resolve(__dirname, "../src/render/renderer.js");
const selectionEditorPanelPath = path.resolve(__dirname, "../src/ui/selectionEditorPanel.js");
const createEditorAppPath = path.resolve(__dirname, "../src/app/createEditorApp.js");

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
  assert.equal(created.minStoneHeight, 24);
  assert.equal(created.maxStoneHeight, 96);
}

{
  const area = normalizeStoneAreaForEditor({ id: "field", width: 120, height: 80, density: 0.5, sizeVariation: 2, rotationVariation: -1, clusterStrength: 0.75 });
  assert.equal(area.sizeVariation, 1);
  assert.equal(area.rotationVariation, 0);
  assert.equal(area.clusterStrength, 0.75);
  assert.equal(area.minStoneHeight, 24);
  assert.equal(area.maxStoneHeight, 80);
  const clampedHeights = normalizeStoneAreaForEditor({ id: "clamp", width: 120, height: 80, minStoneHeight: -5, maxStoneHeight: 120 });
  assert.equal(clampedHeights.minStoneHeight, 24, "missing/invalid minimum stone height uses the authored default");
  assert.equal(clampedHeights.maxStoneHeight, 80, "maximum stone height cannot exceed the authored footprint height");
  const raisedMin = updateStoneAreaField(area, "minStoneHeight", 88);
  assert.equal(raisedMin.minStoneHeight, 80, "minimum stone height clamps inside the authored footprint");
  assert.equal(raisedMin.maxStoneHeight, 80, "maximum stone height remains at least the clamped minimum");
  const loweredMax = updateStoneAreaField(area, "maxStoneHeight", 12);
  assert.equal(loweredMax.maxStoneHeight, area.minStoneHeight, "maximum stone height cannot fall below the minimum");
  const resized = updateStoneAreaField({ ...area, maxStoneHeight: 80 }, "height", 48);
  assert.equal(resized.maxStoneHeight, 48, "changing area height clamps maxStoneHeight immediately");
  const grownImplicitMax = updateStoneAreaField({ ...area, height: 80, maxStoneHeight: 80 }, "height", 240);
  assert.equal(grownImplicitMax.maxStoneHeight, 240, "growing an area whose max followed area height keeps maxStoneHeight useful for taller stones");
  const grownMissingMax = updateStoneAreaField({ id: "old-missing-max", width: 120, height: 80, minStoneHeight: 24 }, "height", 240);
  assert.equal(grownMissingMax.maxStoneHeight, 240, "old areas without authored maxStoneHeight keep maxStoneHeight following resized area height");
  const grownExplicitMax = updateStoneAreaField({ ...area, height: 80, maxStoneHeight: 48 }, "height", 240);
  assert.equal(grownExplicitMax.maxStoneHeight, 48, "growing an area with an explicit lower maxStoneHeight preserves the authored cap");
  assert.equal(updateStoneAreaField(area, "minStoneHeight", 30).minStoneHeight, 30, "editing minStoneHeight updates the selected Stone Area data");
  assert.equal(updateStoneAreaField(area, "maxStoneHeight", 64).maxStoneHeight, 64, "editing maxStoneHeight updates the selected Stone Area data");
  assert.equal(updateStoneAreaField(area, "density", 0).density, 0);
  assert.equal(updateStoneAreaField(area, "density", 2).density, 1);
}


{
  const oldStoneAreaState = {
    document: {
      status: "ready",
      error: null,
      active: {
        ...baseDoc,
        stoneAreas: [{ id: "legacy-stone-area", x: 0, y: 0, width: 240, height: 240, density: 0.8, sizeVariation: 1, enabled: true, visible: true }],
      },
    },
    interaction: { selectedStoneAreaId: "legacy-stone-area", selectedStoneAreaIndex: 0 },
  };
  const { markup } = getSelectionEditorPanelContent(oldStoneAreaState, { emptyMessage: "No selection" });
  assert.match(markup, />Stone Area · World Phenomena \/ Areas</, "selected Stone Areas render the Stone Area inspector path");
  assert.match(markup, />Min stone height</, "Stone Area inspector renders the Min stone height field label");
  assert.match(markup, />Max stone height</, "Stone Area inspector renders the Max stone height field label");
  assert.match(markup, /data-stone-area-field="minStoneHeight"/, "Min stone height is wired to stoneArea.minStoneHeight");
  assert.match(markup, /data-stone-area-field="maxStoneHeight"/, "Max stone height is wired to stoneArea.maxStoneHeight");
  assert.match(markup, /aria-label="Min stone height"/, "Min stone height is exposed as an editable numeric input");
  assert.match(markup, /aria-label="Max stone height"/, "Max stone height is exposed as an editable numeric input");
  assert.match(markup, /data-stone-area-field="minStoneHeight"[\s\S]*?value="24"/, "old Stone Areas render normalized minStoneHeight value in the inspector");
  assert.match(markup, /data-stone-area-field="maxStoneHeight"[\s\S]*?value="240"/, "old Stone Areas render normalized maxStoneHeight value in the inspector");
  assert.match(markup, /data-stone-area-field="density"[\s\S]*?value="80"/, "Stone density displays normalized 0.8 as human-readable 80");
  assert.match(markup, /data-stone-area-field="sizeVariation"[\s\S]*?value="100"/, "Stone sizeVariation displays normalized 1 as human-readable 100");
  assert.match(markup, /data-stone-area-field="minStoneHeight"[\s\S]*?data-human-scale="units"/, "Stone minStoneHeight remains a raw unit field");
  assert.match(markup, /data-stone-area-field="density"[\s\S]*?data-human-scale="percent-0-100"/, "Stone normalized controls declare percent-style human scaling");

  const selectionEditorPanelSource = fs.readFileSync(selectionEditorPanelPath, "utf8");
  assert.match(selectionEditorPanelSource, /"stoneAreaField"/, "Stone Area inputs participate in bottom-panel draft/focus tracking");
  assert.match(selectionEditorPanelSource, /onStoneAreaUpdate\?\.\(field, parsedValue, \{ areaId \}\)/, "Stone Area numeric inputs dispatch parsed edits through onStoneAreaUpdate");

  const createEditorAppSource = fs.readFileSync(createEditorAppPath, "utf8");
  assert.match(createEditorAppSource, /"minStoneHeight", "maxStoneHeight"/, "createEditorApp accepts minStoneHeight and maxStoneHeight update dispatch fields");
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

function getGeneratedVisualHeight(stone) {
  return getStoneVisualWorldBottomY(stone) - getStoneVisualWorldTopY(stone);
}

{
  const largeArea = normalizeStoneAreaForEditor({
    id: "large-size-range",
    x: 0,
    y: 0,
    width: 240,
    height: 240,
    minStoneHeight: 24,
    maxStoneHeight: 240,
    density: 0.8,
    sizeVariation: 1,
    rotationVariation: 0.5,
    clusterStrength: 0.4,
    seed: 0x51524,
  });
  const stones = generateStoneAreaLayout(largeArea);
  assert.ok(stones.length > 0, "large Stone Area should generate stones");
  const heights = stones.map(getGeneratedVisualHeight);
  const widths = stones.map((stone) => stone.radiusX * 2);
  assert.ok(heights.every((height) => height >= largeArea.minStoneHeight - 0.75 && height <= largeArea.maxStoneHeight + 0.75), "generated stone heights stay within authored min/max");
  assert.ok(Math.max(...heights) >= largeArea.maxStoneHeight * 0.9, "large Stone Areas can generate stones close to maxStoneHeight");
  assert.ok(Math.min(...heights) <= largeArea.minStoneHeight + ((largeArea.maxStoneHeight - largeArea.minStoneHeight) * 0.35), "high variation includes smaller stones near the lower range");
  assert.ok(widths[heights.indexOf(Math.max(...heights))] > widths[heights.indexOf(Math.min(...heights))], "width scales proportionally with generated height");
  const lowVariationHeights = generateStoneAreaLayout({ ...largeArea, id: "low-spread", sizeVariation: 0 }).map(getGeneratedVisualHeight);
  assert.ok((Math.max(...heights) - Math.min(...heights)) > (Math.max(...lowVariationHeights) - Math.min(...lowVariationHeights)) + 80, "sizeVariation controls spread across min/max");
  for (const stone of stones) {
    assert.equal(Math.round(getStoneVisualWorldBottomY(stone) * 100) / 100, largeArea.y + largeArea.height, "flat-bottom baseline remains exact for scaled stones");
    assert.ok(getStoneVisualWorldTopY(stone) >= largeArea.y - 0.01, "scaled stone tops remain inside the authored footprint");
  }
}

{
  const area = normalizeStoneAreaForEditor({ id: "visual-style", x: 24, y: 48, width: 144, height: 96, density: 0.5, sizeVariation: 0.6, rotationVariation: 0.8, clusterStrength: 0.7 });
  const stones = generateStoneAreaLayout(area);
  assert.ok(stones.length > 0, "visual test area should generate stones");
  const firstVisual = stones[0].visual;
  assert.equal(firstVisual.kind, "stonelab-grounded-faceted-polygon", "stones use the StoneLab grounded faceted polygon visual model");
  assert.ok(firstVisual.points.length >= 7 && firstVisual.points.length <= 9, "stone silhouette should use the StoneLab 7-9 point contract");
  assert.equal(firstVisual.points[0].y, 1, "stone silhouette starts with a flat left baseline point");
  assert.equal(firstVisual.points.at(-1).y, 1, "stone silhouette ends with a flat right baseline point");
  assert.ok(firstVisual.points.slice(1, -1).some((point) => point.y < -0.45), "stone silhouette should keep an irregular dome-like upper profile");
  assert.ok(firstVisual.points.every((point) => point.y <= 1), "no stone silhouette geometry may extend below the normalized baseline");
  assert.ok(firstVisual.facets.length >= 5, "stone visual should expose multiple large shaded StoneLab facet patches");
  assert.ok(firstVisual.facets.every((facet) => facet.points.every((point) => point.y <= 1)), "internal facets must remain clipped above the flat baseline");
  assert.ok(Array.isArray(firstVisual.topHighlight) && firstVisual.topHighlight.length >= 3, "stone visual should expose the StoneLab top highlight pass");
  const baselineY = area.y + area.height;
  for (const stone of stones) {
    assert.equal(Math.round(getStoneVisualWorldBottomY(stone) * 100) / 100, baselineY, "every generated stone must rest exactly on the Stone Area baseline");
    assert.ok(stone.visual.points.every((point) => point.y <= stone.visual.baselineY), "no generated stone geometry should sit below the baseline");
    assert.equal(getStoneVisualContactOffsetY(stone), stone.radiusY, "flat bottom contact offset remains exactly one radiusY");
  }
  assert.equal(getStoneVisualGeometry(stones[0]), firstVisual, "stone visual geometry should be cached and reusable for the same stone");
  assert.deepEqual(generateStoneAreaLayout(area)[0].visual, firstVisual, "generated stone visual geometry should be deterministic");

  const editorStoneLayerSource = fs.readFileSync(editorStoneLayerPath, "utf8");
  assert.equal(editorStoneLayerSource.includes("ctx.ellipse(0, 0, 1, 1"), false, "Editor V2 Stone Area preview should not use the old plain ellipse as the primary stone visual");
  assert.equal(editorStoneLayerSource.includes("tracePolygon"), true, "Editor V2 Stone Area preview should draw polygon silhouettes/facets");
  assert.equal(editorStoneLayerSource.includes("ctx.rotate(stone.rotation"), false, "Editor V2 Stone Area preview must not rotate the grounded flat baseline");
  assert.equal(editorStoneLayerSource.includes("createLinearGradient(-0.78, -0.86, 0.72, 1)"), true, "Editor V2 Stone Area preview should use the StoneLab upper-left gradient body fill");

  const lumoHtmlSource = fs.readFileSync(lumoHtmlPath, "utf8");
  assert.equal(lumoHtmlSource.includes("createRadialGradient(-rect.w * 0.18"), false, "runtime should not use the old gradient ellipse stone renderer");
  assert.equal(lumoHtmlSource.includes("traceRechargedStonePolygon"), true, "runtime should draw stylized polygon stone silhouettes/facets");
  assert.equal(lumoHtmlSource.includes("ctx.rotate(stone.rotation"), false, "runtime Stone Area rendering must not rotate the grounded flat baseline");
  assert.equal(lumoHtmlSource.includes("reflected: true"), true, "runtime mirror Stone Area path should use the reflected stone renderer treatment");
  assert.equal(lumoHtmlSource.includes("if (!reflected)"), true, "reflected Stone Area rendering should suppress the contact shadow");
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
    stoneAreas: [{ id: "save-me", x: 24, y: 48, width: 120, height: 72, minStoneHeight: 18, maxStoneHeight: 60, density: 0.4, sizeVariation: 0.5, rotationVariation: 0.25, clusterStrength: 0.8 }],
  });
  assert.equal(normalized.stoneAreas.length, 1, "Stone Area saves in the Editor V2 document");
  assert.equal(normalized.stoneAreas[0].id, "save-me");
  assert.equal(normalized.stoneAreas[0].minStoneHeight, 18);
  assert.equal(normalized.stoneAreas[0].maxStoneHeight, 60);

  const { runtimeLevel } = v2ToRuntimeLevelObject(normalized);
  assert.equal(runtimeLevel.stoneAreas.length, 1, "Stone Area exports to the runtime level object");
  assert.equal(runtimeLevel.stoneAreas[0].minStoneHeight, 18, "runtime export preserves minStoneHeight");
  assert.equal(runtimeLevel.stoneAreas[0].maxStoneHeight, 60, "runtime export preserves maxStoneHeight");
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
  assert.equal(packet.stoneAreas[0].minStoneHeight, 18, "runtime world packet carries minStoneHeight");
  assert.equal(packet.stoneAreas[0].maxStoneHeight, 60, "runtime world packet carries maxStoneHeight");
}

console.log("stone area contracts passed");
