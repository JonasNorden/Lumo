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
import { createLumoRechargedBootAdapter } from "../src/runtime/createLumoRechargedBootAdapter.js";
import { createRechargedLevelSourceRuntime } from "../src/runtime/createRechargedLevelSourceRuntime.js";
import { getSelectionEditorPanelContent, toAreaEditorDisplayValue, toAreaRuntimeValue } from "../src/ui/selectionEditorPanel.js";
import {
  getRuntimeGlowPointAlpha,
  getRuntimeGlowPointColor,
  getRuntimeGlowPointOffsetX,
  getRuntimeGlowPointOffsetY,
  getRuntimeGlowPointDirection,
  getRuntimeGlowPointTravelPhase,
  getRuntimeGlowPointUpdraftPhase,
  renderRuntimeGlowAreas,
} from "../src/runtime/renderRuntimeGlowAreas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const editorGlowLayerPath = path.resolve(__dirname, "../src/render/layers/glowAreaLayer.js");
const editorDustLayerPath = path.resolve(__dirname, "../src/render/layers/dustAreaLayer.js");
const editorStoneLayerPath = path.resolve(__dirname, "../src/render/layers/stoneAreaLayer.js");
const editorMirrorSurfaceLayerPath = path.resolve(__dirname, "../src/render/layers/mirrorSurfaceAreaLayer.js");
const viewportPath = path.resolve(__dirname, "../src/render/viewport.js");
const runtimeGlowPath = path.resolve(__dirname, "../src/runtime/renderRuntimeGlowAreas.js");
const rendererPath = path.resolve(__dirname, "../src/render/renderer.js");
const brushPanelPath = path.resolve(__dirname, "../src/ui/brushPanel.js");
const createEditorAppPath = path.resolve(__dirname, "../src/app/createEditorApp.js");
const worldAreasPath = path.resolve(__dirname, "../src/domain/worldAreas.js");
const lumoHtmlPath = path.resolve(__dirname, "../../Lumo.html");

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
  assert.equal(created.direction, "random");
  assert.equal(created.speed, 0.35);
}

{
  const area = normalizeGlowAreaForEditor({ id: "field", width: 120, height: 80, density: 2, sizeVariation: -1, strength: 0.75, speed: 2, direction: "invalid-direction", motionMode: "invalid-legacy" });
  assert.equal(area.direction, "random", "old Glow Areas without a valid direction normalize to random");
  assert.equal(area.density, 1);
  assert.equal(area.sizeVariation, 0);
  assert.equal(area.strength, 0.75);
  assert.equal(area.speed, 1);
  assert.equal(updateGlowAreaField(area, "density", 0.25).density, 0.25);
  assert.equal(updateGlowAreaField(area, "sizeVariation", 2).sizeVariation, 1);
  assert.equal(updateGlowAreaField(area, "strength", -1).strength, 0);
  assert.equal(updateGlowAreaField(area, "width", 240).width, 240);
  assert.equal(updateGlowAreaField(area, "speed", -1).speed, 0);
  assert.equal(updateGlowAreaField(area, "direction", "left").direction, "left");
  assert.equal(updateGlowAreaField(area, "direction", "sideways").direction, "random");
  assert.equal(updateGlowAreaField(area, "motionMode", "ambient").direction, "random", "legacy ambient migrates to random");
  assert.equal(updateGlowAreaField(area, "motionMode", "updraft").direction, "up", "legacy updraft migrates to up");
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
  assert.ok(first.every((point) => point.direction === "random" && point.authoredSpeed === 0.35), "default generated glow motes carry random direction and authored speed");
  assert.ok(generateGlowAreaLayout({ id: "updraft-layout", x: area.x, y: area.y, width: area.width, height: area.height, density: area.density, sizeVariation: area.sizeVariation, strength: area.strength, motionMode: "updraft" }).every((point) => point.direction === "up" && Number.isFinite(point.travelSpeed)), "legacy updraft generated glow motes migrate to up with deterministic travel speed");
  assert.ok(generateGlowAreaLayout({ ...area, id: "left-layout", direction: "left", speed: 0.8 }).every((point) => point.direction === "left" && point.authoredSpeed === 0.8), "authored direction and speed survive deterministic layout generation");
  assert.ok(first.every((point) => point.radius <= 2.6 && point.coreRadius < point.radius && point.auraRadius > point.radius), "default glow motes keep a tiny core with a larger soft aura instead of becoming blobs");
  assert.ok(first.every((point) => point.alphaMin > 0 && point.alphaMax > point.alphaMin && point.alphaMax <= 0.38), "points keep a non-zero floor and readable ember ceiling");
  assert.ok(first.some((point) => ["ember_orange", "warm_gold", "deep_ember", "pale_gold"].includes(point.palette)), "glow uses the warm ember/gold default palette");
  assert.ok(first.filter((point) => ["ember_orange", "warm_gold", "deep_ember", "pale_gold"].includes(point.palette)).length === first.length, "warm ember/gold tones dominate Glow Area V2 by default");
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
  assert.match(getRuntimeGlowPointColor(point), /rgba\((1[8-9][0-9]|2[0-5][0-9]), ([8-9][0-9]|1[0-9][0-9]|2[0-3][0-9]), ([2-9][0-9]|1[0-6][0-9]), 1\)/, "runtime glow color remains warm ember/gold and non-white");

  const updraftArea = normalizeGlowAreaForEditor({ ...area, id: "runtime-updraft-motion", direction: "up", speed: 0.6 });
  const updraftPoint = generateGlowAreaLayout(updraftArea).find((candidate) => getRuntimeGlowPointTravelPhase(candidate, 0) > 0.2 && getRuntimeGlowPointTravelPhase(candidate, 0) < 0.6) || generateGlowAreaLayout(updraftArea)[0];
  assert.equal(getRuntimeGlowPointDirection(updraftPoint), "up", "runtime recognizes authored upward direction");
  assert.ok(getRuntimeGlowPointOffsetY(updraftPoint, 8) < getRuntimeGlowPointOffsetY(updraftPoint, 0), "up direction moves motes upward over time before recycle");
  const topTime = (0.92 - getRuntimeGlowPointUpdraftPhase(updraftPoint, 0)) / updraftPoint.travelSpeed;
  const midTime = (0.45 - getRuntimeGlowPointUpdraftPhase(updraftPoint, 0) + 1) / updraftPoint.travelSpeed;
  assert.ok(getRuntimeGlowPointAlpha(updraftPoint, topTime) < getRuntimeGlowPointAlpha(updraftPoint, midTime), "directional glow fades motes near the travel edge before soft recycle");
  const downPoint = generateGlowAreaLayout({ ...area, id: "runtime-down-motion", direction: "down", speed: 0.6 })[0];
  assert.ok(getRuntimeGlowPointOffsetY(downPoint, 8) > getRuntimeGlowPointOffsetY(downPoint, 0), "down direction descends over time");
  const leftPoint = generateGlowAreaLayout({ ...area, id: "runtime-left-motion", direction: "left", speed: 0.6 })[0];
  assert.ok(getRuntimeGlowPointOffsetX(leftPoint, 8) < getRuntimeGlowPointOffsetX(leftPoint, 0), "left direction moves horizontally left over time");
  const rightPoint = generateGlowAreaLayout({ ...area, id: "runtime-right-motion", direction: "right", speed: 0.6 })[0];
  assert.ok(getRuntimeGlowPointOffsetX(rightPoint, 8) > getRuntimeGlowPointOffsetX(rightPoint, 0), "right direction moves horizontally right over time");
  const slowPoint = generateGlowAreaLayout({ ...area, id: "runtime-slow-motion", direction: "right", speed: 0 })[0];
  const fastPoint = generateGlowAreaLayout({ ...area, id: "runtime-fast-motion", direction: "right", speed: 1 })[0];
  assert.ok(Math.abs(getRuntimeGlowPointOffsetX(fastPoint, 8) - getRuntimeGlowPointOffsetX(fastPoint, 0)) > Math.abs(getRuntimeGlowPointOffsetX(slowPoint, 8) - getRuntimeGlowPointOffsetX(slowPoint, 0)), "authored speed affects runtime movement distance");
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
  assert.equal(renderRuntimeGlowAreas(ctx, [{ id: "zero-strength", width: 120, height: 120, density: 1, strength: 0 }], {}, 120), 0, "strength 0 Glow Areas render no visible glow");
  assert.equal(calls.length, 0, "runtime no-op Glow Areas do not draw points");

  const brightArea = { id: "bright-runtime", x: 0, y: 0, width: 120, height: 120, density: 1, sizeVariation: 0.5, strength: 1, enabled: true, visible: true };
  const dimArea = { ...brightArea, id: "dim-runtime", strength: 0.5 };
  const dimPoint = generateGlowAreaLayout(dimArea)[0];
  const brightPoint = generateGlowAreaLayout(brightArea)[0];
  assert.ok(brightPoint.alphaMax > dimPoint.alphaMax, "strength affects generated alpha/brightness");
  assert.equal(renderRuntimeGlowAreas(ctx, [brightArea], {}, 120), generateGlowAreaLayout(brightArea).length, "strength 1 renders all visible mote anchors");
  const brightArcs = calls.filter((call) => call.radius > 0);
  assert.ok(brightArcs.length >= generateGlowAreaLayout(brightArea).length * 3, "strength 1 produces visible aura, mote, and core draw calls");
  assert.ok(brightArcs.some((call) => call.radius > brightPoint.radius * 2), "runtime glow draws a low-alpha outer aura");
  assert.ok(brightArcs.some((call) => call.radius <= brightPoint.radius), "runtime glow draws a tiny bright core/mote");
}

{
  const authored = validateLevelDocument({
    ...baseDoc,
    glowAreas: [{ id: "authored-glow", x: 24, y: 48, width: 144, height: 96, density: 0.5, sizeVariation: 0.6, strength: 0.8, direction: "down", speed: 0.72, enabled: true, visible: true }],
  });
  assert.equal(authored.glowAreas.length, 1, "Glow Area saves in the Editor V2 document shape");
  const exported = JSON.parse(serializeLevelDocument(authored));
  assert.equal(exported.glowAreas.length, 1, "Glow Area exports with the level document");
  assert.equal(exported.glowAreas[0].direction, "down", "direction saves/exports with Glow Areas");
  assert.equal(exported.glowAreas[0].speed, 0.72, "speed saves/exports with Glow Areas");
  const runtime = v2ToRuntimeLevelObject(authored);
  assert.equal(runtime.runtimeLevel.glowAreas.length, 1, "Runtime receives authored Glow Areas from the V2 bridge");
  assert.equal(runtime.runtimeLevel.glowAreas[0].direction, "down", "Runtime receives authored direction from the V2 bridge");
  assert.equal(runtime.runtimeLevel.glowAreas[0].speed, 0.72, "Runtime receives authored speed from the V2 bridge");
  const loaded = loadLevelDocument(authored);
  assert.equal(loaded.level.glowAreas.length, 1, "Recharged runtime loader preserves authored Glow Areas");
  const packet = buildRuntimeWorldPacket({ skeleton: buildRuntimeWorldSkeleton(loaded.level) });
  assert.equal(packet.glowAreas.length, 1, "runtime world packets carry Glow Areas");
  assert.equal(packet.glowAreas[0].direction, "down", "runtime world packets carry Glow Area direction");
  assert.equal(packet.glowAreas[0].speed, 0.72, "runtime world packets carry Glow Area speed");

  const sourceRuntime = createRechargedLevelSourceRuntime({ levelSource: { levelDocument: loaded.level } });
  assert.equal(sourceRuntime.ok, true, "Recharged level-source runtime accepts authored Glow Area levels");
  assert.equal(sourceRuntime.initialize().ok, true, "Recharged level-source runtime initializes with authored Glow Areas");
  assert.equal(sourceRuntime.start().ok, true, "Recharged level-source runtime starts with authored Glow Areas");
  assert.equal(sourceRuntime.getWorldSnapshot().glowAreas.length, 1, "runtime world snapshot preserves canonical top-level glowAreas");
  assert.equal(sourceRuntime.getBootPayload().glowAreas.length, 1, "runtime boot payload preserves canonical top-level glowAreas");

  const adapter = createLumoRechargedBootAdapter({
    sourceDescriptor: { levelDocument: loaded.level },
  });
  assert.equal(adapter.ok, true, "Lumo.html boot adapter can be created for authored Glow Area levels");
  assert.equal((await adapter.prepare()).ok, true, "Lumo.html boot adapter prepares authored Glow Areas");
  assert.equal((await adapter.boot()).ok, true, "Lumo.html boot adapter boots authored Glow Areas");
  assert.equal(adapter.getWorldSnapshot().glowAreas.length, 1, "Lumo.html adapter world snapshot preserves canonical top-level glowAreas");
  assert.equal(adapter.getBootPayload().glowAreas.length, 1, "Lumo.html receives non-empty authored glowAreas on the boot payload");
  assert.equal(adapter.getBootPayload().glowAreas[0].direction, "down", "Lumo.html receives direction on the boot payload");
  assert.equal(adapter.getBootPayload().glowAreas[0].speed, 0.72, "Lumo.html receives speed on the boot payload");
}

{
  const state = {
    document: { status: "ready", error: null, active: { ...baseDoc, glowAreas: [{ id: "selected-glow", x: 0, y: 0, width: 240, height: 120, density: 0.8, sizeVariation: 1, strength: 0.5, direction: "up", speed: 0.6, enabled: true, visible: true }] } },
    interaction: { selectedGlowAreaId: "selected-glow", selectedGlowAreaIndex: 0 },
  };
  const { markup } = getSelectionEditorPanelContent(state, { emptyMessage: "No selection" });
  assert.match(markup, />Glow Area · World Phenomena \/ Areas</, "selected Glow Areas render the Glow Area inspector path");
  assert.match(markup, /data-glow-area-field="density"/, "Glow density is editable");
  assert.match(markup, /data-glow-area-field="sizeVariation"/, "Glow sizeVariation is editable");
  assert.match(markup, /data-glow-area-field="strength"/, "Glow strength is editable");
  assert.match(markup, />Direction</, "Glow Area inspector exposes Direction label");
  assert.match(markup, /data-glow-area-field="direction"/, "Glow direction is editable");
  assert.match(markup, /data-glow-area-field="speed"/, "Glow speed is editable");
  assert.match(markup, /data-glow-area-field="density"[\s\S]*?value="80"/, "Glow density displays normalized 0.8 as human-readable 80");
  assert.match(markup, /data-glow-area-field="strength"[\s\S]*?value="50"/, "Glow strength displays normalized 0.5 as human-readable 50");
  assert.match(markup, /data-glow-area-field="speed"[\s\S]*?data-human-scale="percent-0-100"/, "Glow normalized controls declare percent-style human scaling");
  assert.match(markup, /data-glow-area-field="speed"[\s\S]*?step="1"/, "Glow normalized controls expose stepper/native step metadata");
  assert.match(markup, /selectionStepperButton/, "Glow Area inspector renders compact stepper controls");
  assert.match(markup, /fieldRowCompact selectionInlineField selectionCoordField/, "Glow Area inspector uses compact inline rows");
  assert.match(markup, /<option value="up" selected>up<\/option>/, "Glow direction select reflects authored up value");
}

{
  const normalizedScale = { min: 0, max: 1, presentationScale: 100 };
  assert.equal(toAreaEditorDisplayValue(0.65, normalizedScale), "65", "UI displays normalized 0.65 as 65");
  assert.equal(toAreaRuntimeValue("80", normalizedScale), 0.8, "editing UI value 80 stores/runtime-normalizes to 0.8");
}

{
  const [glowLayer, rendererLayer, dustLayer, stoneLayer, mirrorSurfaceLayer, viewportModule] = await Promise.all([
    import(editorGlowLayerPath),
    import(rendererPath),
    import(editorDustLayerPath),
    import(editorStoneLayerPath),
    import(editorMirrorSurfaceLayerPath),
    import(viewportPath),
  ]);
  assert.equal(typeof glowLayer.renderGlowAreas, "function", "Editor V2 can import glowAreaLayer without module export errors");
  assert.equal(typeof rendererLayer.renderEditorFrame, "function", "Editor V2 renderer can import the Glow Area layer without module export errors");
  assert.equal(typeof dustLayer.renderDustAreas, "function", "Dust Area layer still imports correctly");
  assert.equal(typeof stoneLayer.renderStoneAreas, "function", "Stone Area layer still imports correctly");
  assert.equal(typeof mirrorSurfaceLayer.renderMirrorSurfaceAreas, "function", "Mirror Surface Area layer still imports correctly");
  assert.equal(viewportModule.worldToCanvas, undefined, "viewport.js does not export worldToCanvas; Glow Area must not import it");

  const calls = [];
  const ctx = {
    globalAlpha: 1,
    save() { calls.push({ type: "save" }); },
    restore() { calls.push({ type: "restore" }); },
    beginPath() { calls.push({ type: "beginPath" }); },
    arc(x, y, radius) { calls.push({ type: "arc", x, y, radius, alpha: this.globalAlpha, fillStyle: this.fillStyle }); },
    fill() { calls.push({ type: "fill", alpha: this.globalAlpha, fillStyle: this.fillStyle }); },
    stroke() { calls.push({ type: "stroke", strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }); },
    roundRect(x, y, width, height, radius) { calls.push({ type: "roundRect", x, y, width, height, radius }); },
    fillText(text, x, y) { calls.push({ type: "fillText", text, x, y }); },
    setLineDash(pattern) { calls.push({ type: "setLineDash", pattern }); },
    set fillStyle(value) { this._fillStyle = value; },
    get fillStyle() { return this._fillStyle; },
    set strokeStyle(value) { this._strokeStyle = value; },
    get strokeStyle() { return this._strokeStyle; },
    set lineWidth(value) { this._lineWidth = value; },
    get lineWidth() { return this._lineWidth; },
    set font(value) { this._font = value; },
    get font() { return this._font; },
  };
  glowLayer.renderGlowAreas(ctx, {
    ...baseDoc,
    glowAreas: [{ id: "preview-glow", x: 24, y: 48, width: 96, height: 72, density: 0.45, sizeVariation: 0.4, strength: 0.7, enabled: true, visible: true }],
  }, { offsetX: 10, offsetY: 20, zoom: 2 }, { selectedGlowAreaId: "preview-glow" });
  assert.ok(calls.some((call) => call.type === "arc"), "Glow Area preview render contract draws glow points");
  const previewArcs = calls.filter((call) => call.type === "arc");
  assert.ok(previewArcs.length >= generateGlowAreaLayout({ id: "preview-glow", x: 24, y: 48, width: 96, height: 72, density: 0.45, sizeVariation: 0.4, strength: 0.7, enabled: true, visible: true }).length * 3, "Editor preview uses visible aura, mote, and core styling");
  assert.ok(previewArcs.some((call) => /rgba\(255,/.test(call.fillStyle || "")), "Editor preview includes a bright ember core fill");
  assert.deepEqual(
    calls.find((call) => call.type === "roundRect"),
    { type: "roundRect", x: 58, y: 116, width: 192, height: 144, radius: 12 },
    "Glow Area preview render contract maps authored world bounds through viewport offset and zoom",
  );
  assert.ok(calls.some((call) => call.type === "fillText" && call.text === "Glow Area"), "Glow Area preview render contract labels the editor area");
}

{
  const glowLayerSource = fs.readFileSync(editorGlowLayerPath, "utf8");
  const runtimeGlowSource = fs.readFileSync(runtimeGlowPath, "utf8");
  const viewportSource = fs.readFileSync(viewportPath, "utf8");
  const worldAreasSource = fs.readFileSync(worldAreasPath, "utf8");
  const rendererSource = fs.readFileSync(rendererPath, "utf8");
  const lumoHtmlSource = fs.readFileSync(lumoHtmlPath, "utf8");
  const brushSource = fs.readFileSync(brushPanelPath, "utf8");
  const appSource = fs.readFileSync(createEditorAppPath, "utf8");
  assert.match(brushSource, /arm-glow-area/, "World Areas panel exposes Glow Area creation");
  assert.match(appSource, /createGlowAreaFromDrag/, "Editor app can create Glow Areas from drag placement");
  assert.match(appSource, /moveGlowArea/, "Editor app can move authored Glow Areas");
  assert.match(appSource, /deleteSelectedGlowArea/, "Editor app can delete authored Glow Areas");
  assert.match(rendererSource, /renderBackground\(worldCtx, doc, state\.viewport\);\n  renderGlowAreas/, "editor preview renders Glow Areas in front of background");
  assert.match(glowLayerSource, /generateGlowAreaLayout/, "editor preview uses deterministic generated glow anchors");
  assert.doesNotMatch(glowLayerSource, /import\s*\{[^}]*worldToCanvas[^}]*\}\s*from\s*["']\.\.\/viewport\.js["']/, "Glow Area layer must not import missing viewport exports");
  assert.doesNotMatch(viewportSource, /export function worldToCanvas\b/, "viewport.js still lacks a worldToCanvas export, preserving the regression fixture");
  assert.match(runtimeGlowSource, /Math\.sin/, "runtime glow uses cheap sinusoidal drift");
  assert.match(runtimeGlowSource, /timeSeconds/, "runtime glow animation consumes runtime time input");
  assert.doesNotMatch(runtimeGlowSource, /Math\.random/, "runtime glow rendering must not use Math.random");
  assert.doesNotMatch(worldAreasSource, /Math\.random/, "glow layout generation must not use Math.random");
  assert.doesNotMatch(runtimeGlowSource, /\.filter\s*=/, "runtime glow must not use canvas filters");
  assert.doesNotMatch(runtimeGlowSource, /shadowBlur|shadowColor/, "runtime glow must not use glow/shadow rendering");
  assert.doesNotMatch(runtimeGlowSource, /spawn|despawn|lifecycle/i, "runtime glow must not expose an emitter lifecycle");
  assert.doesNotMatch(runtimeGlowSource, /createRadialGradient|drawImage|getImageData|putImageData/, "runtime glow must not use fullscreen passes, textures, or expensive image operations");
  assert.doesNotMatch(glowLayerSource, /\.filter\s*=|shadowBlur|shadowColor/, "editor Glow Area preview must not use canvas filters or shadow blur");
  assert.equal(lumoHtmlSource.includes("function readRechargedGlowAreas(payload) {\n      const sourceAreas = Array.isArray(payload?.glowAreas) ? payload.glowAreas : [];"), true, "Lumo.html reads the canonical top-level glowAreas payload path");
  assert.doesNotMatch(lumoHtmlSource, /payload\?\.layers\?\.glowAreas/, "Lumo.html must not read Glow Areas from layers.glowAreas");
  assert.match(lumoHtmlSource, /const glowAreas = readRechargedGlowAreas\(payload\);/, "Lumo.html resolves authored Glow Areas from the live boot payload");
  assert.match(lumoHtmlSource, /drawRechargedGlowAreas\(ctx, mapper, glowAreas, \{ tileSize, timeSeconds:/, "Lumo.html invokes Glow Area rendering every frame with runtime timeSeconds");
  assert.match(lumoHtmlSource, /drawBgMaterialRect[\s\S]*drawRechargedGlowAreas\(ctx, mapper, glowAreas[\s\S]*for \(const supportTile of supportTiles\)/, "Lumo.html renders Glow Areas after opaque background tilemap and before support/gameplay tiles");
  const lumoGlowSlice = lumoHtmlSource.slice(lumoHtmlSource.indexOf("function buildRechargedGlowLayout"), lumoHtmlSource.indexOf("function getRechargedStoneAreaSeed"));
  assert.match(lumoGlowSlice, /coreRadius/, "Lumo.html runtime Glow Area draws bright ember cores");
  assert.match(lumoGlowSlice, /auraRadius/, "Lumo.html runtime Glow Area draws larger low-alpha auras");
  assert.match(lumoGlowSlice, /direction/, "Lumo.html render path uses Glow Area direction");
  assert.match(lumoGlowSlice, /travelPhase/, "Lumo.html render path computes deterministic directional travel phase");
  assert.match(lumoGlowSlice, /authoredSpeed/, "Lumo.html render path uses authored Glow Area speed");
  assert.doesNotMatch(lumoGlowSlice, /Math\.random/, "Lumo.html Glow Area layout must not use Math.random");
  assert.doesNotMatch(lumoGlowSlice, /\.filter\s*=|shadowBlur|shadowColor|createRadialGradient|drawImage|getImageData|putImageData/, "Lumo.html Glow Area must avoid filters, shadow blur, fullscreen passes, textures, and image operations");
}

console.log("Glow Area V2 ember mote contract checks passed");
