import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createGlowAreaFromDrag,
  generateGlowAreaLayout,
  normalizeGlowAreaForEditor,
  updateGlowAreaField,
} from "../src/domain/worldAreas.js";
import { validateLevelDocument } from "../src/domain/level/levelDocument.js";
import { serializeLevelDocument } from "../src/data/exportLevelDocument.js";
import { v2ToRuntimeLevelObject } from "../src/runtime/v2ToRuntimeLevelObject.js";
import { loadLevelDocument } from "../src/runtime/loadLevelDocument.js";
import { buildRuntimeWorldSkeleton } from "../src/runtime/buildRuntimeWorldSkeleton.js";
import { buildRuntimeWorldPacket } from "../src/runtime/buildRuntimeWorldPacket.js";
import { getSelectionEditorPanelContent } from "../src/ui/selectionEditorPanel.js";
import {
  getRuntimeGlowPointAlpha,
  getRuntimeGlowPointColor,
  getRuntimeGlowPointOffsetX,
  getRuntimeGlowPointOffsetY,
  renderRuntimeGlowAreas,
} from "../src/runtime/renderRuntimeGlowAreas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const editorGlowLayerPath = path.resolve(__dirname, "../src/render/layers/glowAreaLayer.js");
const runtimeGlowPath = path.resolve(__dirname, "../src/runtime/renderRuntimeGlowAreas.js");
const rendererPath = path.resolve(__dirname, "../src/render/renderer.js");
const brushPanelPath = path.resolve(__dirname, "../src/ui/brushPanel.js");
const createEditorAppPath = path.resolve(__dirname, "../src/app/createEditorApp.js");
const worldAreasPath = path.resolve(__dirname, "../src/domain/worldAreas.js");

const baseDoc = {
  meta: { id: "glow-area-test", name: "Glow Area Test", version: "2.0.0" },
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
  dustAreas: [],
  glowAreas: [],
};

{
  const created = createGlowAreaFromDrag(baseDoc, { x: 1, y: 2 }, { x: 4, y: 5 });
  assert.equal(created.id, "glow_area-1");
  assert.equal(created.x, 24);
  assert.equal(created.y, 48);
  assert.equal(created.width, 96);
  assert.equal(created.height, 96);
  assert.equal(created.density, 0.32);
  assert.equal(created.sizeVariation, 0.38);
  assert.equal(created.strength, 0.42);
}

{
  const area = normalizeGlowAreaForEditor({ id: "field", width: 120, height: 80, density: 2, sizeVariation: -1, strength: 0.75 });
  assert.equal(area.density, 1);
  assert.equal(area.sizeVariation, 0);
  assert.equal(area.strength, 0.75);
  assert.equal(updateGlowAreaField(area, "density", 0.25).density, 0.25);
  assert.equal(updateGlowAreaField(area, "sizeVariation", 2).sizeVariation, 1);
  assert.equal(updateGlowAreaField(area, "strength", -1).strength, 0);
  assert.equal(updateGlowAreaField(area, "width", 240).width, 240);
}

{
  const area = normalizeGlowAreaForEditor({ id: "stable", x: 24, y: 48, width: 144, height: 96, density: 0.5, sizeVariation: 0.6, strength: 0.8 });
  const first = generateGlowAreaLayout(area);
  const second = generateGlowAreaLayout({ ...area });
  assert.deepEqual(second, first, "same authored Glow Area must generate an identical point layout");
  assert.equal(second, first, "same authored Glow Area reuses the cached point layout instead of reallocating every frame");
  assert.ok(first.length > 0, "non-empty density should generate glow anchors");
  assert.ok(generateGlowAreaLayout({ ...area, density: 0.9 }).length > generateGlowAreaLayout({ ...area, density: 0.1 }).length, "density affects point count");
  assert.deepEqual(generateGlowAreaLayout({ ...area, density: 0 }), [], "empty Glow Areas render nothing");
  assert.deepEqual(generateGlowAreaLayout({ ...area, strength: 0 }), [], "zero-strength Glow Areas render nothing");
  assert.deepEqual(generateGlowAreaLayout({ ...area, enabled: false }), [], "disabled Glow Areas render nothing");
  assert.deepEqual(generateGlowAreaLayout({ ...area, visible: false }), [], "hidden Glow Areas render nothing");
  assert.ok(new Set(first.map((point) => point.phase)).size > 1, "points receive independent phases");
  assert.ok(new Set(first.map((point) => point.speed)).size > 1, "points receive independent drift speeds");
  assert.ok(new Set(first.map((point) => point.alphaPhase)).size > 1, "points receive independent alpha phases");
  assert.ok(new Set(first.map((point) => point.alphaSpeed)).size > 1, "points receive independent alpha speeds");
  assert.ok(first.every((point) => point.radius <= 1.6), "default glow points remain tiny instead of becoming blobs");
  assert.ok(first.every((point) => point.alphaMin > 0 && point.alphaMax > point.alphaMin && point.alphaMax <= 0.18), "points keep a non-zero floor and dim ceiling");
  assert.ok(first.some((point) => ["warm_gold", "pale_cyan", "crystal_blue"].includes(point.palette)), "glow uses the authored subtle magic palette");
  assert.ok(generateGlowAreaLayout({ ...area, strength: 1, id: "bright" })[0].alphaMax > generateGlowAreaLayout({ ...area, strength: 0.1, id: "dim" })[0].alphaMax, "strength affects brightness");
}

{
  const area = normalizeGlowAreaForEditor({ id: "runtime-motion", x: 0, y: 0, width: 192, height: 120, density: 0.65, sizeVariation: 0.45, strength: 0.75 });
  const points = generateGlowAreaLayout(area);
  const point = points[0];
  assert.notEqual(getRuntimeGlowPointOffsetX(point, 0), getRuntimeGlowPointOffsetX(point, 300), "runtime time changes glow x offset slowly");
  assert.notEqual(getRuntimeGlowPointOffsetY(point, 0), getRuntimeGlowPointOffsetY(point, 300), "runtime time changes glow y offset slowly");
  assert.notEqual(getRuntimeGlowPointAlpha(point, 0), getRuntimeGlowPointAlpha(point, 300), "runtime time changes glow alpha");
  assert.ok(Math.abs(getRuntimeGlowPointAlpha(point, 1) - getRuntimeGlowPointAlpha(point, 2)) < 0.01, "alpha changes smoothly without blinking");
  assert.ok(getRuntimeGlowPointAlpha(point, 900) > 0.008, "alpha never hard-blinks off");
  assert.notEqual(getRuntimeGlowPointOffsetX(points[0], 180), getRuntimeGlowPointOffsetX(points[1], 180), "independent point phases/speeds avoid synchronized waves");
  assert.match(getRuntimeGlowPointColor(point), /rgba\((1[0-9][0-9]|2[0-3][0-9]), (1[5-9][0-9]|2[0-2][0-9]), (9[0-9]|1[0-9][0-9]|2[0-2][0-9]), 1\)/, "runtime glow color remains soft and non-white");
}

{
  const calls = [];
  const ctx = {
    globalAlpha: 1,
    save() {},
    restore() {},
    beginPath() {},
    arc(x, y, radius) { calls.push({ x, y, radius, alpha: this.globalAlpha, fillStyle: this.fillStyle }); },
    fill() {},
    set globalCompositeOperation(value) { this._globalCompositeOperation = value; },
    get globalCompositeOperation() { return this._globalCompositeOperation; },
    set fillStyle(value) { this._fillStyle = value; },
    get fillStyle() { return this._fillStyle; },
  };
  assert.equal(renderRuntimeGlowAreas(ctx, [{ id: "hidden", visible: false, width: 120, height: 120, density: 1 }], {}, 120), 0, "hidden Glow Areas are runtime no-op");
  assert.equal(renderRuntimeGlowAreas(ctx, [{ id: "disabled", enabled: false, width: 120, height: 120, density: 1 }], {}, 120), 0, "disabled Glow Areas are runtime no-op");
  assert.equal(renderRuntimeGlowAreas(ctx, [{ id: "empty", width: 120, height: 120, density: 0 }], {}, 120), 0, "empty Glow Areas are runtime no-op");
  assert.equal(calls.length, 0, "runtime no-op Glow Areas do not draw points");
}

{
  const authored = validateLevelDocument({
    ...baseDoc,
    glowAreas: [{ id: "authored-glow", x: 24, y: 48, width: 144, height: 96, density: 0.5, sizeVariation: 0.6, strength: 0.8, enabled: true, visible: true }],
  });
  assert.equal(authored.glowAreas.length, 1, "Glow Area saves in the Editor V2 document shape");
  const exported = JSON.parse(serializeLevelDocument(authored));
  assert.equal(exported.glowAreas.length, 1, "Glow Area exports with the level document");
  const runtime = v2ToRuntimeLevelObject(authored);
  assert.equal(runtime.runtimeLevel.glowAreas.length, 1, "Runtime receives authored Glow Areas from the V2 bridge");
  const loaded = loadLevelDocument(authored);
  assert.equal(loaded.level.glowAreas.length, 1, "Recharged runtime loader preserves authored Glow Areas");
  const packet = buildRuntimeWorldPacket({ skeleton: buildRuntimeWorldSkeleton(loaded.level) });
  assert.equal(packet.glowAreas.length, 1, "runtime world packets carry Glow Areas");
}

{
  const state = {
    document: { status: "ready", error: null, active: { ...baseDoc, glowAreas: [{ id: "selected-glow", x: 0, y: 0, width: 240, height: 120, density: 0.8, sizeVariation: 1, strength: 0.5, enabled: true, visible: true }] } },
    interaction: { selectedGlowAreaId: "selected-glow", selectedGlowAreaIndex: 0 },
  };
  const { markup } = getSelectionEditorPanelContent(state, { emptyMessage: "No selection" });
  assert.match(markup, />Glow Area · World Phenomena \/ Areas</, "selected Glow Areas render the Glow Area inspector path");
  assert.match(markup, /data-glow-area-field="density"/, "Glow density is editable");
  assert.match(markup, /data-glow-area-field="sizeVariation"/, "Glow sizeVariation is editable");
  assert.match(markup, /data-glow-area-field="strength"/, "Glow strength is editable");
}

{
  const glowLayerSource = fs.readFileSync(editorGlowLayerPath, "utf8");
  const runtimeGlowSource = fs.readFileSync(runtimeGlowPath, "utf8");
  const worldAreasSource = fs.readFileSync(worldAreasPath, "utf8");
  const rendererSource = fs.readFileSync(rendererPath, "utf8");
  const brushSource = fs.readFileSync(brushPanelPath, "utf8");
  const appSource = fs.readFileSync(createEditorAppPath, "utf8");
  assert.match(brushSource, /arm-glow-area/, "World Areas panel exposes Glow Area creation");
  assert.match(appSource, /createGlowAreaFromDrag/, "Editor app can create Glow Areas from drag placement");
  assert.match(appSource, /moveGlowArea/, "Editor app can move authored Glow Areas");
  assert.match(appSource, /deleteSelectedGlowArea/, "Editor app can delete authored Glow Areas");
  assert.match(rendererSource, /renderBackground\(worldCtx, doc, state\.viewport\);\n  renderGlowAreas/, "editor preview renders Glow Areas in front of background");
  assert.match(glowLayerSource, /generateGlowAreaLayout/, "editor preview uses deterministic generated glow anchors");
  assert.match(runtimeGlowSource, /Math\.sin/, "runtime glow uses cheap sinusoidal drift");
  assert.match(runtimeGlowSource, /timeSeconds/, "runtime glow animation consumes runtime time input");
  assert.doesNotMatch(runtimeGlowSource, /Math\.random/, "runtime glow rendering must not use Math.random");
  assert.doesNotMatch(worldAreasSource, /Math\.random/, "glow layout generation must not use Math.random");
  assert.doesNotMatch(runtimeGlowSource, /\.filter\s*=/, "runtime glow must not use canvas filters");
  assert.doesNotMatch(runtimeGlowSource, /shadowBlur|shadowColor/, "runtime glow must not use glow/shadow rendering");
  assert.doesNotMatch(runtimeGlowSource, /spawn|despawn|lifecycle/i, "runtime glow must not expose an emitter lifecycle");
}

console.log("Glow Area V1 contract checks passed");
