import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateLevelDocument } from "../src/domain/level/levelDocument.js";
import { getSelectionEditorPanelContent } from "../src/ui/selectionEditorPanel.js";
import { updateMirrorSurfaceAreaField } from "../src/domain/worldAreas.js";
import { serializeLevelDocument } from "../src/data/exportLevelDocument.js";
import { loadLevelDocument } from "../src/runtime/loadLevelDocument.js";
import { createRuntimeGameSession } from "../src/runtime/createRuntimeGameSession.js";
import { createLumoRechargedBootAdapter } from "../src/runtime/createLumoRechargedBootAdapter.js";
import { bootLumoRechargedFromQuery } from "../src/runtime/bootLumoRechargedFromQuery.js";
import { v2ToRuntimeLevelObject } from "../src/runtime/v2ToRuntimeLevelObject.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, "../src/data/editorV2SavedLevel.sample.json");
const lumoHtmlPath = path.resolve(__dirname, "../../Lumo.html");

function loadFixture() {
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function withMirrorArea(source) {
  return {
    ...source,
    mirrorSurfaceAreas: [
      {
        id: "mirror-row-1",
        x: 48,
        y: 96,
        width: 96,
        height: 12,
        yOffset: -2,
        reflectionHeight: 96,
        reflectionStrength: 0.8,
        distortion: 0,
        surfaceStrength: 0.5,
        fade: 0.2,
        enabled: true,
        visible: true,
      },
    ],
  };
}


function withStaticMirrorDecor(source) {
  return {
    ...source,
    decor: [
      { id: "flower-mirror-candidate", type: "decor_flower_01", x: 3, y: 4, order: 1 },
      { id: "icecream-mirror-candidate", type: "decor_icecream_01", x: 4, y: 4, order: 2 },
      { id: "raspberry-mirror-candidate", type: "decor_raspberry_01", x: 5, y: 4, order: 3 },
    ],
    entities: [
      { id: "ghost-no-reflect", type: "ghost", x: 4, y: 4, params: {} },
    ],
    reactiveGrassPatches: [{ id: "reactive-no-reflect", kind: "reactive_grass", x: 72, y: 96, width: 48 }],
  };
}

function assertCanonicalMirrorPath(holder, label, expectedLength = 1) {
  assert.equal(Array.isArray(holder?.mirrorSurfaceAreas), true, `${label} must expose top-level mirrorSurfaceAreas`);
  assert.equal(holder.mirrorSurfaceAreas.length, expectedLength, `${label} top-level mirrorSurfaceAreas length`);
  assert.equal(holder?.layers?.mirrorSurfaceAreas, undefined, `${label} must not expose layers.mirrorSurfaceAreas`);
}

function runEditorSaveCheck() {
  const validated = validateLevelDocument(withMirrorArea(loadFixture()));
  assertCanonicalMirrorPath(validated, "Editor save document");
  assert.deepEqual(validated.mirrorSurfaceAreas[0], {
    id: "mirror-row-1",
    x: 48,
    y: 96,
    width: 96,
    height: 12,
    yOffset: -2,
    reflectionHeight: 96,
    reflectionStrength: 0.8,
    distortion: 0,
    surfaceStrength: 0.5,
    fade: 0.2,
    enabled: true,
    visible: true,
  });
  console.log("mirror surface editor save path ok");
}

function runEditorExportCheck() {
  const exported = JSON.parse(serializeLevelDocument(withMirrorArea(loadFixture())));
  assertCanonicalMirrorPath(exported, "Editor exported level");
  assert.equal(exported.mirrorSurfaceAreas[0].id, "mirror-row-1");
  assert.equal(exported.mirrorSurfaceAreas[0].width, 96);
  assert.equal(exported.mirrorSurfaceAreas[0].reflectionHeight, 96);
  assert.equal(exported.mirrorSurfaceAreas[0].reflectionStrength, 0.8);
  assert.equal(exported.mirrorSurfaceAreas[0].distortion, 0);
  assert.equal(exported.mirrorSurfaceAreas[0].surfaceStrength, 0.5);
  assert.equal(exported.mirrorSurfaceAreas[0].fade, 0.2);
  console.log("mirror surface editor export path ok");
}

function runRuntimeLevelObjectCheck() {
  const { runtimeLevel } = v2ToRuntimeLevelObject(withMirrorArea(loadFixture()));
  assertCanonicalMirrorPath(runtimeLevel, "Runtime level object");
  assert.equal(runtimeLevel.mirrorSurfaceAreas[0].id, "mirror-row-1");
  assert.equal(runtimeLevel.mirrorSurfaceAreas[0].width, 96);
  assert.equal(runtimeLevel.mirrorSurfaceAreas[0].reflectionHeight, 96);
  assert.equal(runtimeLevel.mirrorSurfaceAreas[0].reflectionStrength, 0.8);
  assert.equal(runtimeLevel.mirrorSurfaceAreas[0].distortion, 0);
  assert.equal(runtimeLevel.mirrorSurfaceAreas[0].surfaceStrength, 0.5);
  assert.equal(runtimeLevel.mirrorSurfaceAreas[0].fade, 0.2);
  assert.equal(Array.isArray(runtimeLevel.layers.ents), true, "mirror surface must not export as an entity");
  assert.equal(runtimeLevel.layers.ents.some((entity) => entity?.id === "mirror_surface_area"), false);
  console.log("mirror surface runtime level object path ok");
}

async function runRechargedPipelineCheck() {
  const loaded = loadLevelDocument(withMirrorArea(loadFixture()));
  assert.equal(loaded.ok, true);
  assertCanonicalMirrorPath(loaded.level, "Runtime level");

  const session = createRuntimeGameSession({ levelDocument: loaded.level });
  assert.equal(session.start().ok, true);
  const worldSnapshot = session.getWorldSnapshot();
  assertCanonicalMirrorPath(worldSnapshot, "Runtime world packet");
  assert.equal(worldSnapshot.mirrorSurfaceAreas[0].id, "mirror-row-1");
  assert.equal(worldSnapshot.mirrorSurfaceAreas[0].reflectionHeight, 96);
  assert.equal(worldSnapshot.mirrorSurfaceAreas[0].reflectionStrength, 0.8);

  const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: loaded.level });
  assert.equal((await adapter.prepare()).ok, true);
  assert.equal((await adapter.boot()).ok, true);
  const bootPayload = adapter.getBootPayload();
  assertCanonicalMirrorPath(bootPayload, "Boot payload");
  assert.equal(bootPayload.mirrorSurfaceAreas[0].id, "mirror-row-1");
  assert.equal(bootPayload.mirrorSurfaceAreas[0].reflectionHeight, 96);
  assert.equal(bootPayload.mirrorSurfaceAreas[0].reflectionStrength, 0.8);
  console.log("mirror surface recharged pipeline path ok");
}

async function runEmptyNoOpCheck() {
  const source = loadFixture();
  delete source.mirrorSurfaceAreas;
  const loaded = loadLevelDocument(source);
  assert.equal(loaded.ok, true);
  assertCanonicalMirrorPath(loaded.level, "Empty runtime level", 0);
  const session = createRuntimeGameSession({ levelDocument: loaded.level });
  assert.equal(session.start().ok, true);
  assertCanonicalMirrorPath(session.getWorldSnapshot(), "Empty runtime world packet", 0);
  const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: loaded.level });
  await adapter.prepare();
  await adapter.boot();
  assertCanonicalMirrorPath(adapter.getBootPayload(), "Empty boot payload", 0);
  console.log("mirror surface empty no-op path ok");
}

async function runQueryBootPathCheck() {
  const bootArea = withMirrorArea({}).mirrorSurfaceAreas[0];
  const result = await bootLumoRechargedFromQuery({
    search: "?recharged=1",
    createAdapter() {
      return {
        prepare: async () => ({ ok: true }),
        boot: async () => ({ ok: true, booted: true }),
        getBootPayload: () => ({
          ok: true,
          status: "running",
          worldWidth: 8,
          worldHeight: 6,
          tileSize: 24,
          mirrorSurfaceAreas: [bootArea],
        }),
      };
    },
  });
  assert.equal(result.ok, true);
  assertCanonicalMirrorPath(result, "Query boot payload");
  assert.equal(result.mirrorSurfaceAreas[0].id, "mirror-row-1");
  assert.equal(result.mirrorSurfaceAreas[0].reflectionHeight, 96);
  assert.equal(result.mirrorSurfaceAreas[0].reflectionStrength, 0.8);
  console.log("mirror surface query boot path ok");
}

function runDefaultNormalizationCheck() {
  const validated = validateLevelDocument({
    ...loadFixture(),
    mirrorSurfaceAreas: [{ id: "legacy-mirror", x: 1, y: 2, width: 24, height: 12, yOffset: 0 }],
  });
  assert.deepEqual(
    {
      reflectionHeight: validated.mirrorSurfaceAreas[0].reflectionHeight,
      reflectionStrength: validated.mirrorSurfaceAreas[0].reflectionStrength,
      distortion: validated.mirrorSurfaceAreas[0].distortion,
      surfaceStrength: validated.mirrorSurfaceAreas[0].surfaceStrength,
      fade: validated.mirrorSurfaceAreas[0].fade,
    },
    { reflectionHeight: 72, reflectionStrength: 0.35, distortion: 0.12, surfaceStrength: 0.25, fade: 0.65 },
  );
  console.log("mirror surface visual defaults normalize ok");
}

function runEditorPanelVisualFieldCheck() {
  const area = withMirrorArea({}).mirrorSurfaceAreas[0];
  const state = {
    document: { active: { ...loadFixture(), mirrorSurfaceAreas: [area] } },
    interaction: { selectedMirrorSurfaceAreaId: "mirror-row-1", selectedMirrorSurfaceAreaIndex: 0 },
  };
  const { markup, isEmpty } = getSelectionEditorPanelContent(state);
  assert.equal(isEmpty, false);
  for (const label of ["Reflection height", "Reflection strength", "Distortion", "Surface strength", "Fade"]) {
    assert.equal(markup.includes(label), true, `selection panel must expose ${label}`);
  }
  const updated = updateMirrorSurfaceAreaField(area, "reflectionStrength", 0.6);
  assert.equal(updated.reflectionStrength, 0.6, "editor mirror field update must preserve authored reflection strength");
  assert.equal(updated.reflectionHeight, 96, "editor mirror field update must preserve authored reflection height");
  console.log("mirror surface editor panel visual fields ok");
}


async function runStaticDecorReflectionPayloadCheck() {
  const loaded = loadLevelDocument(withMirrorArea(withStaticMirrorDecor(loadFixture())));
  assert.equal(loaded.ok, true);
  const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: loaded.level });
  assert.equal((await adapter.prepare()).ok, true);
  assert.equal((await adapter.boot()).ok, true);
  const bootPayload = adapter.getBootPayload();
  assertCanonicalMirrorPath(bootPayload, "Static decor mirror boot payload");
  assert.equal(Array.isArray(bootPayload.decorItems), true, "boot payload must include static decor reflection candidates from layers.decor");
  assert.deepEqual(
    bootPayload.decorItems.map((decor) => decor.decorId),
    ["flower-mirror-candidate", "icecream-mirror-candidate", "raspberry-mirror-candidate"],
    "only static decor items should enter the mirror decor reflection candidate source",
  );
  assert.equal(
    bootPayload.decorItems.some((decor) => /ghost|reactive/i.test(`${decor.decorId} ${decor.decorType}`)),
    false,
    "ghost/reactive/non-static objects must not enter this static decor reflection step",
  );
  console.log("mirror surface static decor payload candidates ok");
}

async function runEmptyDecorNoOpCheck() {
  const source = loadFixture();
  const loaded = loadLevelDocument(withMirrorArea({ ...source, decor: [] }));
  assert.equal(loaded.ok, true);
  const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: loaded.level });
  await adapter.prepare();
  await adapter.boot();
  const bootPayload = adapter.getBootPayload();
  assertCanonicalMirrorPath(bootPayload, "Empty decor mirror boot payload");
  assert.deepEqual(bootPayload.decorItems, [], "empty decor remains a no-op for mirror decor reflections");
  console.log("mirror surface empty decor no-op path ok");
}

function runLumoRenderContractCheck() {
  const html = fs.readFileSync(lumoHtmlPath, "utf8");
  assert.equal(html.includes("function readRechargedMirrorSurfaceAreas"), true);
  assert.equal(html.includes("function drawRechargedMirrorSurfaceAreas"), true);
  assert.match(html, /const sourceAreas = Array\.isArray\(payload\?\.mirrorSurfaceAreas\)/, "Lumo.html must read authored mirror areas from payload.mirrorSurfaceAreas");
  assert.doesNotMatch(html, /const sourceAreas = Array\.isArray\(payload\?\.layers\?\.mirrorSurfaceAreas\)/, "Lumo.html must not render from layers.mirrorSurfaceAreas");
  assert.match(html, /const mirrorSurfaceAreas = readRechargedMirrorSurfaceAreas\(payload\);/, "non-empty authored mirrorSurfaceAreas must enter the final render path");
  assert.match(html, /drawRechargedMirrorSurfaceAreas\(ctx, mapper, state, mirrorSurfaceAreas, \{/, "final render must consume the normalized mirrorSurfaceAreas array");
  assert.match(html, /decorSnapshots: decorWorldLane,/, "mirror render contract must receive static world decor reflection candidates");
  assert.equal(html.includes("function buildRechargedMirrorDecorReflectionCandidates"), true, "mirror renderer must build local static decor reflection candidates");
  assert.match(html, /decor\.anchorLayer === "background" \|\| decor\.reactive === true \|\| decor\.static === false/, "ghost/reactive/non-static objects must be excluded from static decor reflection candidates");
  assert.match(html, /const decorReflectionCandidates = buildRechargedMirrorDecorReflectionCandidates/, "mirror areas must compute local reflected static decor candidates");
  assert.match(html, /reflectionHeight: Number\.isFinite\(area\?\.reflectionHeight\)/, "Lumo.html must read reflectionHeight");
  assert.match(html, /reflectionStrength: Number\.isFinite\(area\?\.reflectionStrength\)/, "Lumo.html must read reflectionStrength");
  assert.match(html, /distortion: Number\.isFinite\(area\?\.distortion\)/, "Lumo.html must read distortion");
  assert.match(html, /surfaceStrength: Number\.isFinite\(area\?\.surfaceStrength\)/, "Lumo.html must read surfaceStrength");
  assert.match(html, /fade: Number\.isFinite\(area\?\.fade\)/, "Lumo.html must read fade");
  assert.match(html, /const clipRect = mapper\.worldToCanvasRect\(surfaceX, surfaceY, surfaceW, reflectionHeight\);/, "reflectionHeight must drive reflection clipping depth");
  assert.match(html, /ctx\.globalAlpha = reflectionStrength \* fadeByDistance;/, "reflectionStrength must drive reflected Lumo alpha");
  assert.match(html, /const subtleAlpha = reflectionStrength \* fadeByDistance \* 0\.62;/, "reflectionStrength and fade must drive subtle reflected static decor alpha");
  assert.match(html, /function drawRechargedMirrorSubjectWithLocalShimmer/, "distortion must use a local banded shimmer helper");
  assert.match(html, /const bandCount = Math\.max\(3, Math\.ceil\(clipRect\.h \/ bandHeight\)\);/, "distortion shimmer must be split into multiple anchored bands");
  assert.match(html, /if \(!\(distortion > 0\)\) \{[\s\S]*?drawSubject\(\);[\s\S]*?return;/, "distortion 0 must render a stable subject without shimmer bands");
  assert.match(html, /drawRechargedMirrorSubjectWithLocalShimmer\(ctx, clipRect, distortion, surfaceX, decorVisual\.worldRect\.x \+ decorVisual\.worldRect\.w \* 0\.5/, "static decor reflection should use anchored local shimmer");
  assert.match(html, /drawRechargedMirrorSubjectWithLocalShimmer\(ctx, clipRect, distortion, surfaceX, playerCenterX/, "Lumo reflection should use anchored local shimmer");
  assert.doesNotMatch(html, /const shimmerOffsetX = distortion > 0/, "distortion must not apply one whole-subject horizontal offset");
  assert.match(html, /if \(surfaceStrength > 0\)/, "surfaceStrength must allow disabling surface sheen and line");
  assert.match(html, /const fadeByDistance = 1 - \(fadeProgress \* fade\);/, "fade must drive downward reflection fade");
  assert.match(html, /if \(!ctx \|\| !mapper \|\| !state \|\| !Array\.isArray\(mirrorSurfaceAreas\) \|\| mirrorSurfaceAreas\.length === 0\) \{\n\s*return false;/, "empty arrays must remain a draw no-op");
  console.log("mirror surface Lumo.html render path ok");
}

runDefaultNormalizationCheck();
runEditorSaveCheck();
runEditorPanelVisualFieldCheck();
runEditorExportCheck();
runRuntimeLevelObjectCheck();
await runRechargedPipelineCheck();
await runEmptyNoOpCheck();
await runStaticDecorReflectionPayloadCheck();
await runEmptyDecorNoOpCheck();
await runQueryBootPathCheck();
runLumoRenderContractCheck();
