import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSmokeAreaFromDrag,
  generateSmokeAreaLayout,
  getSmokeAreaPuffCount,
  normalizeSmokeAreaForEditor,
  updateSmokeAreaField,
} from "../src/domain/worldAreas.js";
import { validateLevelDocument } from "../src/domain/level/levelDocument.js";
import { serializeLevelDocument } from "../src/data/exportLevelDocument.js";
import { v2ToRuntimeLevelObject } from "../src/runtime/v2ToRuntimeLevelObject.js";
import { loadLevelDocument } from "../src/runtime/loadLevelDocument.js";
import { buildRuntimeWorldSkeleton } from "../src/runtime/buildRuntimeWorldSkeleton.js";
import { buildRuntimeWorldPacket } from "../src/runtime/buildRuntimeWorldPacket.js";
import { createLumoRechargedBootAdapter } from "../src/runtime/createLumoRechargedBootAdapter.js";
import { createRechargedLevelSourceRuntime } from "../src/runtime/createRechargedLevelSourceRuntime.js";
import { getSelectionEditorPanelContent } from "../src/ui/selectionEditorPanel.js";
import {
  getRuntimeSmokePuffAlpha,
  getRuntimeSmokePuffOffsetX,
  getRuntimeSmokePuffOffsetY,
  getRuntimeSmokePuffTravelPhase,
  renderRuntimeSmokeAreas,
} from "../src/runtime/renderRuntimeSmokeAreas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const smokeLayerPath = path.resolve(root, "src/render/layers/smokeAreaLayer.js");
const runtimeSmokePath = path.resolve(root, "src/runtime/renderRuntimeSmokeAreas.js");
const worldAreasPath = path.resolve(root, "src/domain/worldAreas.js");
const rendererPath = path.resolve(root, "src/render/renderer.js");
const brushPanelPath = path.resolve(root, "src/ui/brushPanel.js");
const appPath = path.resolve(root, "src/app/createEditorApp.js");
const lumoHtmlPath = path.resolve(root, "../Lumo.html");

const baseDoc = {
  meta: { id: "smoke-area-test", name: "Smoke Area Test", version: "2.0.0" },
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
  smokeAreas: [],
};

{
  const created = createSmokeAreaFromDrag(baseDoc, { x: 1, y: 2 }, { x: 4, y: 5 });
  assert.equal(created.id, "smoke_area-1");
  assert.equal(created.x, 24);
  assert.equal(created.y, 48);
  assert.equal(created.width, 96);
  assert.equal(created.height, 96);
  assert.equal(created.density, 0.42);
  assert.equal(created.size, 0.58);
  assert.equal(created.strength, 0.46);
  assert.equal(created.direction, "up");
  assert.equal(created.speed, 0.28);
}

{
  const area = normalizeSmokeAreaForEditor({ id: "field", width: 120, height: 80, density: 2, size: -1, strength: 0.75, speed: 2, direction: "invalid-direction" });
  assert.equal(area.direction, "up", "invalid Smoke Area directions normalize to the up default");
  assert.equal(area.density, 1);
  assert.equal(area.size, 0);
  assert.equal(area.strength, 0.75);
  assert.equal(area.speed, 1);
  assert.equal(updateSmokeAreaField(area, "density", 0.25).density, 0.25);
  assert.equal(updateSmokeAreaField(area, "size", 2).size, 1);
  assert.equal(updateSmokeAreaField(area, "strength", -1).strength, 0);
  assert.equal(updateSmokeAreaField(area, "speed", -1).speed, 0);
  assert.equal(updateSmokeAreaField(area, "direction", "left").direction, "left");
  assert.equal(updateSmokeAreaField(area, "direction", "sideways").direction, "up");
}

{
  const area = normalizeSmokeAreaForEditor({ id: "stable", x: 24, y: 48, width: 144, height: 96, density: 0.5, size: 0.6, strength: 0.8 });
  const first = generateSmokeAreaLayout(area);
  const second = generateSmokeAreaLayout({ ...area });
  assert.deepEqual(second, first, "same authored Smoke Area must generate an identical puff layout");
  assert.equal(second, first, "same authored Smoke Area reuses the cached puff layout");
  assert.ok(first.length > 0, "non-empty density should generate smoke puff anchors");
  assert.equal(first.length, getSmokeAreaPuffCount(area), "puff count helper matches generated layout");
  assert.ok(generateSmokeAreaLayout({ ...area, density: 0.9 }).length > generateSmokeAreaLayout({ ...area, density: 0.1 }).length, "density affects puff count");
  assert.ok(generateSmokeAreaLayout({ ...area, size: 1 }).reduce((sum, puff) => sum + puff.radius, 0) > generateSmokeAreaLayout({ ...area, size: 0 }).reduce((sum, puff) => sum + puff.radius, 0), "size affects puff scale");
  assert.ok(generateSmokeAreaLayout({ ...area, strength: 1 })[0].alphaMax > generateSmokeAreaLayout({ ...area, strength: 0.1 })[0].alphaMax, "strength affects visibility");
  assert.deepEqual(generateSmokeAreaLayout({ ...area, density: 0 }), [], "empty Smoke Areas render nothing");
  assert.deepEqual(generateSmokeAreaLayout({ ...area, strength: 0 }), [], "zero-strength Smoke Areas render nothing");
  assert.deepEqual(generateSmokeAreaLayout({ ...area, enabled: false }), [], "disabled Smoke Areas render nothing");
  assert.deepEqual(generateSmokeAreaLayout({ ...area, visible: false }), [], "hidden Smoke Areas render nothing");
}

{
  const area = normalizeSmokeAreaForEditor({ id: "motion", x: 0, y: 0, width: 120, height: 120, density: 1, size: 0.5, strength: 0.7, direction: "up", speed: 0.8 });
  const puff = generateSmokeAreaLayout(area)[0];
  assert.notEqual(getRuntimeSmokePuffTravelPhase(puff, 0), getRuntimeSmokePuffTravelPhase(puff, 120), "speed advances the soft recycling phase");
  assert.ok(Math.abs(getRuntimeSmokePuffOffsetY({ ...puff, direction: "up" }, 120)) > 0, "up direction moves puffs vertically");
  assert.ok(Math.abs(getRuntimeSmokePuffOffsetY({ ...puff, direction: "down" }, 120)) > 0, "down direction moves puffs vertically");
  assert.ok(Math.abs(getRuntimeSmokePuffOffsetX({ ...puff, direction: "left" }, 120)) > 0, "left direction moves puffs horizontally");
  assert.ok(Math.abs(getRuntimeSmokePuffOffsetX({ ...puff, direction: "right" }, 120)) > 0, "right direction moves puffs horizontally");
  assert.ok(getRuntimeSmokePuffAlpha(puff, 42) > 0, "runtime alpha remains atmospheric and visible");
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
    createRadialGradient() { return { addColorStop() {} }; },
    set globalCompositeOperation(value) { this._globalCompositeOperation = value; },
    get globalCompositeOperation() { return this._globalCompositeOperation; },
    set fillStyle(value) { this._fillStyle = value; },
    get fillStyle() { return this._fillStyle; },
  };
  assert.equal(renderRuntimeSmokeAreas(ctx, [{ id: "hidden", visible: false, width: 120, height: 120, density: 1 }], {}, 120), 0, "hidden Smoke Areas are runtime no-op");
  assert.equal(renderRuntimeSmokeAreas(ctx, [{ id: "disabled", enabled: false, width: 120, height: 120, density: 1 }], {}, 120), 0, "disabled Smoke Areas are runtime no-op");
  assert.equal(renderRuntimeSmokeAreas(ctx, [{ id: "empty", width: 120, height: 120, density: 0 }], {}, 120), 0, "empty Smoke Areas are runtime no-op");
  assert.equal(calls.length, 0, "runtime no-op Smoke Areas do not draw puffs");
}

{
  const authored = validateLevelDocument({
    ...baseDoc,
    smokeAreas: [{ id: "authored-smoke", x: 24, y: 48, width: 144, height: 96, density: 0.5, size: 0.6, strength: 0.8, direction: "up", speed: 0.35, enabled: true, visible: true }],
  });
  assert.equal(authored.smokeAreas.length, 1, "Smoke Area saves in the Editor V2 document shape");
  const exported = JSON.parse(serializeLevelDocument(authored));
  assert.equal(exported.smokeAreas.length, 1, "Smoke Area exports with the level document");
  const runtime = v2ToRuntimeLevelObject(authored);
  assert.equal(runtime.runtimeLevel.smokeAreas.length, 1, "Runtime receives authored Smoke Areas from the V2 bridge");
  const loaded = loadLevelDocument(authored);
  assert.equal(loaded.level.smokeAreas.length, 1, "runtime loader preserves authored Smoke Areas");
  const packet = buildRuntimeWorldPacket({ skeleton: buildRuntimeWorldSkeleton(loaded.level) });
  assert.equal(packet.smokeAreas.length, 1, "runtime world packets carry Smoke Areas");
  const bootAdapter = createLumoRechargedBootAdapter({ sourceDescriptor: { levelDocument: loaded.level } });
  assert.equal(bootAdapter.ok, true, "Lumo.html boot adapter can be created for authored Smoke Area levels");
  assert.equal((await bootAdapter.prepare()).ok, true, "Lumo.html boot adapter prepares authored Smoke Areas");
  assert.equal((await bootAdapter.boot()).ok, true, "Lumo.html boot adapter boots authored Smoke Areas");
  assert.equal(bootAdapter.getBootPayload().smokeAreas.length, 1, "boot payload carries Smoke Areas into Lumo.html");
  const levelSourceRuntime = createRechargedLevelSourceRuntime({ levelSource: { levelDocument: loaded.level } });
  assert.equal(levelSourceRuntime.ok, true, "level source runtime accepts authored Smoke Area levels");
  assert.equal(levelSourceRuntime.initialize().ok, true, "level source runtime initializes authored Smoke Areas");
  assert.equal(levelSourceRuntime.start().ok, true, "level source runtime starts authored Smoke Areas");
  assert.equal(levelSourceRuntime.getBootPayload().smokeAreas.length, 1, "level source runtime carries Smoke Areas into the boot payload");
}

{
  const state = {
    document: { status: "ready", error: null, active: { ...baseDoc, smokeAreas: [{ id: "selected-smoke", x: 0, y: 0, width: 240, height: 120, density: 0.8, size: 1, strength: 0.5, direction: "up", speed: 0.3, enabled: true, visible: true }] } },
    interaction: { selectedSmokeAreaId: "selected-smoke", selectedSmokeAreaIndex: 0 },
  };
  const { markup } = getSelectionEditorPanelContent(state, { emptyMessage: "No selection" });
  assert.match(markup, />Smoke Area · World Phenomena \/ Areas</, "selected Smoke Areas render the Smoke Area inspector path");
  assert.match(markup, /data-smoke-area-field="density"/, "Smoke density is editable");
  assert.match(markup, /data-smoke-area-field="size"/, "Smoke size is editable");
  assert.match(markup, /data-smoke-area-field="strength"/, "Smoke strength is editable");
  assert.match(markup, /data-smoke-area-field="direction"/, "Smoke direction is editable");
  assert.match(markup, /data-smoke-area-field="speed"/, "Smoke speed is editable");
  assert.match(markup, /data-smoke-area-field="density"[\s\S]*?value="80"/, "Smoke density displays normalized 0.8 as human-readable 80");
  assert.match(markup, /data-smoke-area-field="size"[\s\S]*?value="100"/, "Smoke size displays normalized 1 as human-readable 100");
  assert.match(markup, /data-smoke-area-field="strength"[\s\S]*?data-human-scale="percent-0-100"/, "Smoke normalized controls declare percent-style human scaling");
}

{
  const smokeLayerSource = fs.readFileSync(smokeLayerPath, "utf8");
  const runtimeSmokeSource = fs.readFileSync(runtimeSmokePath, "utf8");
  const worldAreasSource = fs.readFileSync(worldAreasPath, "utf8");
  const rendererSource = fs.readFileSync(rendererPath, "utf8");
  const brushSource = fs.readFileSync(brushPanelPath, "utf8");
  const appSource = fs.readFileSync(appPath, "utf8");
  const lumoHtmlSource = fs.readFileSync(lumoHtmlPath, "utf8");
  assert.match(brushSource, /arm-smoke-area/, "World Areas panel exposes Smoke Area creation");
  assert.match(appSource, /createSmokeAreaFromDrag/, "Editor app can create Smoke Areas from drag placement");
  assert.match(appSource, /moveSmokeArea/, "Editor app can move authored Smoke Areas");
  assert.match(appSource, /deleteSelectedSmokeArea/, "Editor app can delete authored Smoke Areas");
  assert.match(rendererSource, /renderBackground\(worldCtx, doc, state\.viewport\);[\s\S]*renderSmokeAreas[\s\S]*renderTiles/, "editor preview renders Smoke Areas above background and behind gameplay tiles");
  assert.match(smokeLayerSource, /generateSmokeAreaLayout/, "editor preview uses deterministic generated smoke anchors");
  assert.match(runtimeSmokeSource, /Math\.sin/, "runtime smoke uses cheap sinusoidal drift");
  assert.match(runtimeSmokeSource, /timeSeconds/, "runtime smoke animation consumes runtime time input");
  assert.doesNotMatch(runtimeSmokeSource, /Math\.random/, "runtime smoke rendering must not use Math.random");
  assert.doesNotMatch(worldAreasSource, /Math\.random/, "smoke layout generation must not use Math.random");
  assert.doesNotMatch(runtimeSmokeSource, /\.filter\s*=|shadowBlur|shadowColor|drawImage|getImageData|putImageData/, "runtime smoke must avoid filters, shadow blur, textures, and fullscreen pixel passes");
  assert.doesNotMatch(runtimeSmokeSource, /spawn|despawn|lifecycle|emitter/i, "runtime smoke must not expose particle emitter behavior");
  assert.doesNotMatch(smokeLayerSource, /\.filter\s*=|shadowBlur|shadowColor|drawImage|getImageData|putImageData/, "editor Smoke Area preview must avoid filters, shadow blur, textures, and fullscreen pixel passes");
  assert.match(lumoHtmlSource, /function readRechargedSmokeAreas\(payload\) {\n      const sourceAreas = Array\.isArray\(payload\?\.smokeAreas\) \? payload\.smokeAreas : \[\];/, "Lumo.html reads canonical top-level smokeAreas payload path");
  assert.match(lumoHtmlSource, /const smokeAreas = readRechargedSmokeAreas\(payload\);/, "Lumo.html resolves authored Smoke Areas from the live boot payload");
  assert.match(lumoHtmlSource, /drawRechargedSmokeAreas\(ctx, mapper, smokeAreas, \{ tileSize, timeSeconds:/, "Lumo.html invokes Smoke Area rendering every frame with runtime timeSeconds");
  assert.match(lumoHtmlSource, /drawBgMaterialRect[\s\S]*drawRechargedSmokeAreas\(ctx, mapper, smokeAreas[\s\S]*for \(const supportTile of supportTiles\)/, "Lumo.html renders Smoke Areas after opaque background tilemap and before support/gameplay tiles");
  const smokeSlice = lumoHtmlSource.slice(lumoHtmlSource.indexOf("function readRechargedSmokeAreas"), lumoHtmlSource.indexOf("function roundRechargedStoneValue"));
  assert.match(smokeSlice, /createRadialGradient/, "Lumo.html Smoke Area uses soft canvas gradients for puffs");
  assert.match(smokeSlice, /direction/, "Lumo.html render path uses Smoke Area direction");
  assert.match(smokeSlice, /travelPhase/, "Lumo.html render path softly recycles directional modes");
  assert.match(smokeSlice, /authoredSpeed/, "Lumo.html render path uses authored Smoke Area speed");
  assert.doesNotMatch(smokeSlice, /Math\.random/, "Lumo.html Smoke Area layout must not use Math.random");
  assert.doesNotMatch(smokeSlice, /\.filter\s*=|shadowBlur|shadowColor|drawImage|getImageData|putImageData/, "Lumo.html Smoke Area must avoid filters, shadow blur, textures, and fullscreen pixel passes");
}

console.log("Smoke Area V1 contract checks passed");
