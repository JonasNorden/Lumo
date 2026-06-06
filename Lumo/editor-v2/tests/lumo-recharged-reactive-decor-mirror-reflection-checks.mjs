import assert from "node:assert/strict";
import { readFile, writeFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const sourcePath = resolve(repoRoot, "Lumo/editor-v2/src/runtime/mirrorReactiveDecorReflection.js");
const tempPath = resolve(__dirname, ".tmp-mirrorReactiveDecorReflection.test-subject.mjs");

const source = await readFile(sourcePath, "utf8");
const transformed = source.replace(
  /import \{ renderReactiveBloomPlants \} from "\.\/renderReactiveBloomPlants\.js";\nimport \{ renderReactiveCrystals \} from "\.\/renderReactiveCrystals\.js";\nimport \{ renderReactiveGrass \} from "\.\/renderReactiveGrass\.js";\n/,
  `export const renderCalls = [];\nfunction renderReactiveBloomPlants(ctx, playerX, playerY, time, options = {}) { renderCalls.push({ type: "bloom", playerX, playerY, time, options, alpha: ctx.globalAlpha }); }\nfunction renderReactiveCrystals(ctx, playerX, playerY, time, options = {}) { renderCalls.push({ type: "crystal", playerX, playerY, time, options, alpha: ctx.globalAlpha }); }\nfunction renderReactiveGrass(ctx, playerX, playerY, time, options = {}) { renderCalls.push({ type: "grass", playerX, playerY, time, options, alpha: ctx.globalAlpha }); }\n`,
);
await writeFile(tempPath, transformed);

try {
  const mod = await import(`${pathToFileURL(tempPath).href}?v=${Date.now()}`);
  const { buildReactiveDecorMirrorReflectionCandidates, drawReactiveDecorMirrorReflections, renderCalls } = mod;

  const mirror = { x: 100, y: 200, width: 180, height: 12, reflectionHeight: 80, reflectionStrength: 0.5, distortion: 0.25, fade: 0.5 };
  const grassPatch = { id: "g1", kind: "reactive_grass", x: 140, y: 196, width: 70, heightMin: 10, heightMax: 36 };
  const bloomPatch = { id: "b1", kind: "reactive_bloom", x: 190, y: 198, width: 60, heightMin: 24, heightMax: 44, bloomRadiusMax: 12 };
  const crystalPatch = { id: "c1", kind: "reactive_crystal", x: 250, y: 199, width: 50, heightMin: 16, heightMax: 48 };

  const allCandidates = buildReactiveDecorMirrorReflectionCandidates(mirror, {
    grassPatches: [grassPatch],
    bloomPatches: [bloomPatch],
    crystalPatches: [crystalPatch],
  });
  assert.deepEqual(allCandidates.map((candidate) => candidate.type), ["grass", "bloom", "crystal"], "grass, bloom, and crystal should become mirror reflection candidates");

  assert.equal(buildReactiveDecorMirrorReflectionCandidates(mirror, {}).length, 0, "empty reactive decor should be a no-op");
  assert.equal(buildReactiveDecorMirrorReflectionCandidates(null, { grassPatches: [grassPatch] }).length, 0, "empty mirror surface areas should be a no-op");
  assert.equal(buildReactiveDecorMirrorReflectionCandidates(mirror, {
    grassPatches: [{ ...grassPatch, kind: "ghost" }],
    bloomPatches: [{ ...bloomPatch, kind: "decor_flower_01" }],
    crystalPatches: [],
    ghostSnapshots: [{ x: 140, y: 196, w: 24, h: 32 }],
  }).length, 0, "ghost and non-reactive authored visuals must stay excluded");

  const ctxOps = [];
  const ctx = {
    canvas: {},
    _alpha: 1,
    save() { ctxOps.push(["save"]); },
    restore() { ctxOps.push(["restore"]); },
    beginPath() { ctxOps.push(["beginPath"]); },
    rect(x, y, w, h) { ctxOps.push(["rect", x, y, w, h]); },
    clip() { ctxOps.push(["clip"]); },
    translate(x, y) { ctxOps.push(["translate", x, y]); },
    set globalAlpha(value) { this._alpha = value; ctxOps.push(["globalAlpha", value]); },
    get globalAlpha() { return this._alpha; },
  };
  const mapper = { worldToCanvasRect: (x, y, w, h) => ({ x, y, w, h }) };
  const drew = drawReactiveDecorMirrorReflections(ctx, mapper, mirror, {
    grassPatches: [grassPatch],
    bloomPatches: [bloomPatch],
    crystalPatches: [crystalPatch],
  }, { playerCenterX: 150, playerFootY: 196, time: 1000, crystalWakeSources: [{ x: 120, y: 180, radius: 80, strength: 1 }] });

  assert.equal(drew, true, "draw should report reflected reactive decor");
  assert.deepEqual(renderCalls.map((call) => call.type), ["grass", "bloom", "crystal"], "draw should reuse existing reactive renderers");
  assert.equal(renderCalls[0].options.disableGustUpdate, true, "grass reflection should not spawn independent gust updates");
  assert.equal(renderCalls[2].options.wakeSources.length, 1, "crystal reflection should reuse current wake sources");
  assert.ok(ctxOps.some((op) => op[0] === "rect" && op[4] === mirror.reflectionHeight), "reflection should clip to authored reflectionHeight");
  assert.ok(renderCalls.every((call) => call.alpha > 0 && call.alpha <= mirror.reflectionStrength), "reflectionStrength and fade should affect reflected alpha");
  assert.ok(ctxOps.some((op) => op[0] === "translate" && Math.abs(op[1]) > 0), "authored distortion should apply a cheap shimmer translation");

  const lumoHtml = await readFile(resolve(repoRoot, "Lumo/Lumo.html"), "utf8");
  assert.match(lumoHtml, /drawReactiveDecorMirrorReflections\(ctx, mapper, area, options\.reactiveDecor/, "Lumo.html should draw reactive decor through the mirror surface pass");
  assert.match(lumoHtml, /grassPatches: reactiveGrassPatches[\s\S]*bloomPatches: reactiveBloomPatches[\s\S]*crystalPatches: reactiveCrystalPatches/, "Lumo.html should pass authored reactive arrays to mirror reflection");

  const grassRuntime = await readFile(resolve(repoRoot, "Lumo/editor-v2/src/runtime/renderReactiveGrass.js"), "utf8");
  assert.match(grassRuntime, /disableGustUpdate !== true/, "real grass rendering should remain unchanged unless reflection opts out of duplicate gust updates");
} finally {
  await rm(tempPath, { force: true });
}
