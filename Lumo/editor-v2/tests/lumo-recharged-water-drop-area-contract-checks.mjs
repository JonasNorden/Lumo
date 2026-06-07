import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createWaterDropAreaFromDrag,
  generateWaterDropAreaLayout,
  getWaterDropAreaDropCount,
  normalizeWaterDropAreaForEditor,
  resolveWaterDropCollisionY,
  updateWaterDropAreaField,
} from "../src/domain/worldAreas.js";
import { validateLevelDocument } from "../src/domain/level/levelDocument.js";
import { serializeLevelDocument } from "../src/data/exportLevelDocument.js";
import { v2ToRuntimeLevelObject } from "../src/runtime/v2ToRuntimeLevelObject.js";
import { loadLevelDocument } from "../src/runtime/loadLevelDocument.js";
import { buildRuntimeWorldSkeleton } from "../src/runtime/buildRuntimeWorldSkeleton.js";
import { buildRuntimeWorldPacket } from "../src/runtime/buildRuntimeWorldPacket.js";
import { createLumoRechargedBootAdapter } from "../src/runtime/createLumoRechargedBootAdapter.js";
import { getSelectionEditorPanelContent } from "../src/ui/selectionEditorPanel.js";
import { createRuntimeWaterDropImpactPool, drawRuntimeWaterDropImpactRing, getActiveRuntimeWaterDropImpactEvents, getRuntimeWaterDropY, renderRuntimeWaterDropAreas, updateRuntimeWaterDropImpactPool } from "../src/runtime/renderRuntimeWaterDropAreas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const worldAreasPath = path.resolve(root, "src/domain/worldAreas.js");
const runtimeWaterPath = path.resolve(root, "src/runtime/renderRuntimeWaterDropAreas.js");
const waterLayerPath = path.resolve(root, "src/render/layers/waterDropAreaLayer.js");
const rendererPath = path.resolve(root, "src/render/renderer.js");
const brushPanelPath = path.resolve(root, "src/ui/brushPanel.js");
const appPath = path.resolve(root, "src/app/createEditorApp.js");
const lumoHtmlPath = path.resolve(root, "../Lumo.html");

const baseDoc = {
  meta: { id: "water-drop-area-test", name: "Water Drop Area Test", version: "2.0.0" },
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
  waterDropAreas: [],
};

{
  const spot = createWaterDropAreaFromDrag(baseDoc, { x: 2, y: 1 }, { x: 2, y: 1 });
  assert.equal(spot.mode, "spot", "single-cell placement creates Spot mode");
  assert.equal(spot.density, 35);
  assert.equal(spot.speed, 35);
  assert.equal(spot.size, 35);
  const line = createWaterDropAreaFromDrag(baseDoc, { x: 1, y: 2 }, { x: 5, y: 2 });
  assert.equal(line.mode, "line", "horizontal drag creates Line mode");
  assert.equal(line.length, 120, "Line mode exposes authored length");
}

{
  const normalized = normalizeWaterDropAreaForEditor({ mode: "bogus", density: 101, speed: -1, size: 55, length: 240 });
  assert.equal(normalized.mode, "spot");
  assert.equal(normalized.density, 100);
  assert.equal(normalized.speed, 0);
  assert.equal(normalized.size, 55);
  assert.equal(updateWaterDropAreaField(normalized, "mode", "line").mode, "line");
  assert.equal(updateWaterDropAreaField(normalized, "density", 20).density, 20);
  assert.equal(updateWaterDropAreaField(normalized, "speed", 85).speed, 85);
  assert.equal(updateWaterDropAreaField(normalized, "size", 10).size, 10);
}

{
  const area = normalizeWaterDropAreaForEditor({ id: "stable", x: 24, y: 12, mode: "line", length: 144, height: 180, density: 55, speed: 35, size: 35 });
  const first = generateWaterDropAreaLayout(area);
  const second = generateWaterDropAreaLayout({ ...area });
  assert.deepEqual(second, first, "same authored Water Drop Area must generate identical drops");
  assert.equal(second, first, "same authored Water Drop Area reuses cached deterministic layout");
  assert.equal(first.length, getWaterDropAreaDropCount(area));
  assert.ok(generateWaterDropAreaLayout({ ...area, density: 90 }).length > generateWaterDropAreaLayout({ ...area, density: 10 }).length, "density controls drop count over time");
  assert.ok(generateWaterDropAreaLayout({ ...area, speed: 100 })[0].fallSpeed > generateWaterDropAreaLayout({ ...area, speed: 0 })[0].fallSpeed, "speed controls believable fall speed");
  assert.ok(generateWaterDropAreaLayout({ ...area, size: 100 })[0].radius > generateWaterDropAreaLayout({ ...area, size: 1 })[0].radius, "size controls droplet size");
  assert.deepEqual(generateWaterDropAreaLayout({ ...area, density: 0 }), [], "zero density is no-op");
  assert.deepEqual(generateWaterDropAreaLayout({ ...area, enabled: false }), [], "disabled is no-op");
  assert.deepEqual(generateWaterDropAreaLayout({ ...area, visible: false }), [], "hidden is no-op");
}

{
  const drop = generateWaterDropAreaLayout({ id: "collision", x: 48, y: 10, mode: "spot", density: 100, speed: 35, size: 35, height: 200 })[0];
  const collisionY = resolveWaterDropCollisionY(drop, [{ x: drop.sourceX - 4, y: 90, width: 16, height: 24 }]);
  assert.equal(collisionY, 90, "drops stop at authored/runtime collision truth");
  assert.ok(getRuntimeWaterDropY(drop, 10, [{ x: drop.sourceX - 4, y: 90, width: 16, height: 24 }]) <= 90, "runtime animation never passes collision stop");
}

{
  const ctx = { globalAlpha: 1, save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {}, set globalCompositeOperation(value) { this._op = value; }, get globalCompositeOperation() { return this._op; }, set strokeStyle(value) { this._stroke = value; }, set fillStyle(value) { this._fill = value; }, set lineWidth(value) { this._lineWidth = value; } };
  assert.equal(renderRuntimeWaterDropAreas(ctx, [{ id: "hidden", visible: false, density: 100 }], {}, 0), 0, "hidden Water Drop Areas are runtime no-op");
  assert.ok(renderRuntimeWaterDropAreas(ctx, [{ id: "run", x: 0, y: 0, mode: "spot", density: 100, speed: 35, size: 35, height: 120 }], {}, 2) > 0, "runtime handoff renders active drops");
}

{
  const area = { id: "impact", x: 12, y: 0, mode: "spot", density: 25, speed: 100, size: 35, height: 24, enabled: true, visible: true };
  const drop = generateWaterDropAreaLayout(area, 0)[0];
  const collisionRects = [{ x: drop.sourceX - 4, y: 28, width: 12, height: 12 }];
  const collisionY = resolveWaterDropCollisionY(drop, collisionRects);
  const cycleSeconds = Math.max(0.32, Math.max(1, collisionY - drop.sourceY) / drop.fallSpeed);
  const impactTime = cycleSeconds * (1 - drop.phase + 0.05);
  const pool = createRuntimeWaterDropImpactPool(2);
  updateRuntimeWaterDropImpactPool(pool, [area], 0, { collisionRects });
  assert.equal(getActiveRuntimeWaterDropImpactEvents(pool, 0).length, 0, "impact pool starts without fake impacts");
  updateRuntimeWaterDropImpactPool(pool, [area], impactTime, { collisionRects });
  const impacts = getActiveRuntimeWaterDropImpactEvents(pool, impactTime);
  assert.equal(impacts.length, 1, "drop cycle wrap creates one impact event");
  assert.equal(impacts[0].y, collisionY, "impact event uses existing Water Drop Area collision truth");
  assert.ok(impacts[0].lifetime >= 0.8 && impacts[0].lifetime <= 1.15, "impact lifetime matches short Lab-style ripple window");
  assert.equal(impacts[0].impactY, collisionY, "canonical impactY is the same collision/contact line used by the event y");
  updateRuntimeWaterDropImpactPool(pool, [area], cycleSeconds * 2.1, { collisionRects });
  updateRuntimeWaterDropImpactPool(pool, [area], cycleSeconds * 3.15, { collisionRects });
  assert.ok(pool.events.length <= 2, "impact pool reuses bounded event slots with no accumulation");
  assert.equal(getActiveRuntimeWaterDropImpactEvents(pool, cycleSeconds * 3.15 + 1).length, 0, "expired impact rings disappear");
}

{
  const area = { id: "platform-impact", x: 18, y: 0, mode: "spot", density: 25, speed: 100, size: 70, height: 96, enabled: true, visible: true };
  const drop = generateWaterDropAreaLayout(area, 0)[0];
  const platformTopY = 42;
  const groundTopY = 88;
  const collisionRects = [
    { x: drop.sourceX - 8, y: groundTopY, width: 18, height: 24 },
    { x: drop.sourceX - 8, y: platformTopY, width: 18, height: 8 },
  ];
  const collisionY = resolveWaterDropCollisionY(drop, collisionRects);
  assert.equal(collisionY, platformTopY, "platform impact resolves to the platform top instead of a lower ground tile");
  const cycleSeconds = Math.max(0.32, Math.max(1, collisionY - drop.sourceY) / drop.fallSpeed);
  const impactTime = cycleSeconds * (1 - drop.phase + 0.05);
  const pool = createRuntimeWaterDropImpactPool(4);
  updateRuntimeWaterDropImpactPool(pool, [area], 0, { collisionRects });
  updateRuntimeWaterDropImpactPool(pool, [area], impactTime, { collisionRects });
  const impacts = getActiveRuntimeWaterDropImpactEvents(pool, impactTime);
  assert.equal(impacts.length, 1, "one drop cycle creates exactly one ripple event");
  assert.equal(impacts[0].y, platformTopY, "ripple event uses canonical platform impactY");
  assert.equal(impacts[0].impactY, impacts[0].y, "drop termination and ripple spawn share one canonical contact point");
}

{
  const area = { id: "ground-impact", x: 30, y: 0, mode: "spot", density: 25, speed: 100, size: 35, height: 96, enabled: true, visible: true };
  const drop = generateWaterDropAreaLayout(area, 0)[0];
  const groundTopY = 72;
  const collisionRects = [{ x: drop.sourceX - 8, y: groundTopY, width: 18, height: 24 }];
  const collisionY = resolveWaterDropCollisionY(drop, collisionRects);
  assert.equal(collisionY, groundTopY, "ground impact resolves to the ground top contact line");
  const cycleSeconds = Math.max(0.32, Math.max(1, collisionY - drop.sourceY) / drop.fallSpeed);
  const contactTime = cycleSeconds * Math.max(0, 1 - drop.phase - 0.000001);
  assert.ok(Math.abs(getRuntimeWaterDropY(drop, contactTime, collisionRects) - groundTopY) < 0.01, "drop terminates at the same impactY used by the ripple");
}

{
  const calls = [];
  const ctx = {
    globalAlpha: 1,
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    beginPath() { calls.push(["beginPath"]); },
    ellipse(...args) { calls.push(["ellipse", ...args]); },
    arc(...args) { calls.push(["arc", ...args]); },
    stroke() { calls.push(["stroke"]); },
    set strokeStyle(value) { this._strokeStyle = value; },
    get strokeStyle() { return this._strokeStyle; },
    set lineWidth(value) { calls.push(["lineWidth", value]); this._lineWidth = value; },
    get lineWidth() { return this._lineWidth; },
  };
  const event = { active: true, x: 50, y: 64, impactY: 64, bornAt: 10, lifetime: 1, radiusBase: 24, radiusYBase: 4, alpha: 0.42 };
  assert.equal(drawRuntimeWaterDropImpactRing(ctx, event, { cameraX: 0, cameraY: 0 }, 10.5), true, "active ripple ring renders during lifetime");
  const ellipseCall = calls.find((call) => call[0] === "ellipse");
  assert.ok(ellipseCall, "impact ring draws a Lab-style ellipse");
  assert.equal(calls.some((call) => call[0] === "arc"), false, "impact ring is not circular");
  assert.equal(ellipseCall[1], event.x, "ellipse x uses impactX");
  assert.equal(ellipseCall[2], event.impactY, "ellipse y uses canonical impactY");
  assert.ok(ellipseCall[3] > ellipseCall[4] * 3, "ellipse is flat and much wider than tall");
  assert.ok(calls.some((call) => call[0] === "lineWidth" && call[1] === 1), "ripple uses Lab-style 1px stroke");
}

{
  const authored = validateLevelDocument({ ...baseDoc, waterDropAreas: [{ id: "water", x: 24, y: 24, mode: "line", length: 120, height: 144, density: 45, speed: 55, size: 35, enabled: true, visible: true }] });
  assert.equal(authored.waterDropAreas.length, 1, "Water Drop Area saves in editor document");
  assert.equal(JSON.parse(serializeLevelDocument(authored)).waterDropAreas.length, 1, "Water Drop Area exports at canonical top-level waterDropAreas path");
  assert.equal(v2ToRuntimeLevelObject(authored).runtimeLevel.waterDropAreas.length, 1, "runtime receives authored Water Drop Areas");
  const loaded = loadLevelDocument(authored);
  assert.equal(loaded.level.waterDropAreas.length, 1, "runtime loader preserves authored Water Drop Areas");
  assert.equal(buildRuntimeWorldPacket({ skeleton: buildRuntimeWorldSkeleton(loaded.level) }).waterDropAreas.length, 1, "world packet carries Water Drop Areas");
  const bootAdapter = createLumoRechargedBootAdapter({ sourceDescriptor: { levelDocument: loaded.level } });
  assert.equal(bootAdapter.ok, true);
  assert.equal((await bootAdapter.prepare()).ok, true);
  assert.equal((await bootAdapter.boot()).ok, true);
  assert.equal(bootAdapter.getBootPayload().waterDropAreas.length, 1, "boot payload carries Water Drop Areas into Lumo.html");
}

{
  const state = { document: { status: "ready", error: null, active: { ...baseDoc, waterDropAreas: [{ id: "selected-water", x: 0, y: 0, mode: "line", length: 96, density: 35, speed: 35, size: 35, enabled: true, visible: true }] } }, interaction: { selectedWaterDropAreaId: "selected-water", selectedWaterDropAreaIndex: 0 } };
  const { markup } = getSelectionEditorPanelContent(state, { emptyMessage: "No selection" });
  assert.match(markup, />Water Drop Area · World Phenomena \/ Areas</);
  assert.match(markup, /data-water-drop-area-field="mode"/);
  assert.match(markup, /data-water-drop-area-field="density"[\s\S]*?value="35"/, "Water Drop Area uses human-readable 0-100 density scale");
  assert.match(markup, /data-water-drop-area-field="length"/, "Line mode exposes length");
}

{
  const sources = [worldAreasPath, runtimeWaterPath, waterLayerPath, rendererPath, brushPanelPath, appPath, lumoHtmlPath].map((sourcePath) => fs.readFileSync(sourcePath, "utf8")).join("\n");
  assert.match(sources, /waterDropAreas/, "canonical waterDropAreas path is wired through editor/export/runtime/Lumo.html");
  assert.match(sources, /drawRechargedWaterDropAreas/, "Lumo.html runtime draws Water Drop Areas");
  assert.match(sources, /drawRechargedMirrorSurfaceAreas[\s\S]*waterDropAreas|waterDropAreas[\s\S]*drawRechargedMirrorSurfaceAreas/, "Mirror Surface path receives Water Drop Areas for reflection compatibility");
  assert.match(sources, /impactPool|WaterDropImpact/, "runtime uses a bounded Water Drop impact event pool for subtle landing rings");
  const runtimeSource = fs.readFileSync(runtimeWaterPath, "utf8");
  const bridgeSource = fs.readFileSync(path.resolve(root, "src/runtime/drawRuntimeBridgeView.js"), "utf8");
  const lumoSource = fs.readFileSync(lumoHtmlPath, "utf8");
  assert.match(runtimeSource, /ctx\.ellipse\(x, y, radiusX, radiusY, 0, 0, Math\.PI \* 2\)/, "runtime impact rings render as flat horizontal ellipses");
  assert.doesNotMatch(runtimeSource, /ctx\.arc\(x, y, radius/, "runtime impact rings must not use circular ripples");
  assert.match(lumoSource, /drawRechargedStoneAreas\(ctx, mapper, stoneAreas[\s\S]*drawRechargedWaterDropAreas\(ctx, mapper, waterDropAreas/, "Lumo.html renders Water Drop rings after Stone Areas so stones cannot hide impacts");
  assert.match(lumoSource, /for \(const supportTile of supportTiles\)[\s\S]*drawRechargedWaterDropAreas\(ctx, mapper, waterDropAreas/, "Lumo.html renders Water Drop rings above support tile surfaces");
  assert.match(bridgeSource, /for \(const tile of tiles\)[\s\S]*renderRuntimeWaterDropAreas/, "runtime bridge renders Water Drop rings above impacted tile surfaces");
  assert.match(bridgeSource, /createRuntimeWaterDropImpactPool/, "runtime bridge keeps a bounded impact pool so rings can appear in Recharged runtime");
  assert.match(lumoSource, /getRechargedWaterDropImpactEvents\(options\.impactPool, timeSeconds\)/, "Mirror Surface reflects existing active Water Drop rings without spawning new events");
  assert.doesNotMatch(lumoSource.slice(lumoSource.indexOf("function buildRechargedMirrorWaterDropReflectionCandidates"), lumoSource.indexOf("function drawRechargedWaterDropMirrorReflections")), /updateRechargedWaterDropImpactPool/, "Mirror Surface must not spawn extra ripple events");
  const waterDomainSlice = fs.readFileSync(worldAreasPath, "utf8").slice(fs.readFileSync(worldAreasPath, "utf8").indexOf("export function normalizeWaterDropAreaMode"), fs.readFileSync(worldAreasPath, "utf8").indexOf("export function normalizeGlowAreaForEditor"));
  assert.doesNotMatch(waterDomainSlice + fs.readFileSync(runtimeWaterPath, "utf8") + fs.readFileSync(waterLayerPath, "utf8"), /Math\.random/, "Water Drop Area implementation must not use Math.random");
  assert.doesNotMatch(fs.readFileSync(runtimeWaterPath, "utf8"), /fluid|splash|weather|rain|snow|storm|wind|shadowBlur|drawImage|getImageData|putImageData/i, "runtime Water Drop Area must stay cheap and avoid fluid/weather systems");
}

console.log("Water Drop Area impact-ring contract checks passed");
