import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadLevelDocument } from "../src/runtime/loadLevelDocument.js";
import { createRuntimeGameSession } from "../src/runtime/createRuntimeGameSession.js";
import { createLumoRechargedBootAdapter } from "../src/runtime/createLumoRechargedBootAdapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const editorFixturePaths = [
  "editor-v2/src/data/testLevelDocument.v1.json",
  "editor-v2/src/data/editorV2SavedLevel.sample.json",
  "editor-v2/src/data/test.json",
  "editor-v2/src/data/bg-test.json",
  "editor-v2/src/data/assets-tiles.json",
];

function readJson(relativePath) {
  const absPath = path.resolve(repoRoot, relativePath);
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
}

function pickSampleEntityByType(entities) {
  const byType = new Map();
  for (const entity of entities) {
    if (!entity || typeof entity !== "object") continue;
    const type = typeof entity.type === "string" ? entity.type : "";
    if (!type || byType.has(type)) continue;
    byType.set(type, entity);
  }
  return byType;
}

function extractV1EditorIdTruthSet() {
  const entitiesJsPath = path.resolve(repoRoot, "src/game/entities.js");
  const source = fs.readFileSync(entitiesJsPath, "utf8");
  const matches = [...source.matchAll(/if \(id === "([a-z0-9_]+)"\)/g)];
  return sortedUnique(matches.map((m) => m[1]));
}

function extractLumoHtmlEntityReadKeys() {
  const htmlPath = path.resolve(repoRoot, "Lumo.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const sectionMatch = html.match(/function readRechargedEntitySnapshots\(payload, state\) \{([\s\S]*?)\n    \}/);
  assert.ok(sectionMatch, "Expected readRechargedEntitySnapshots in Lumo.html.");
  const section = sectionMatch[1];

  const keys = [];
  for (const match of section.matchAll(/\n\s+([_a-zA-Z][_a-zA-Z0-9]*): /g)) {
    keys.push(match[1]);
  }

  const normalized = sortedUnique(keys);
  return { html, normalized };
}

function buildEntityRuntimeInventory() {
  const fixtureInventories = editorFixturePaths.map((fixturePath) => {
    const editorDoc = readJson(fixturePath);
    const editorEntities = Array.isArray(editorDoc?.entities) ? editorDoc.entities : [];
    const editorTypes = sortedUnique(editorEntities.map((entity) => entity?.type).filter((type) => typeof type === "string"));

    const loaded = loadLevelDocument(editorDoc);
    assert.equal(loaded.ok, true, `Expected level conversion ok for ${fixturePath}.`);

    const runtimeLayerEntities = Array.isArray(loaded?.level?.layers?.entities) ? loaded.level.layers.entities : [];
    const runtimeLayerTypes = sortedUnique(runtimeLayerEntities.map((entity) => entity?.type).filter((type) => typeof type === "string"));

    return {
      fixturePath,
      editorEntityCount: editorEntities.length,
      editorTypes,
      runtimeLayerEntityCount: runtimeLayerEntities.length,
      runtimeLayerTypes,
      runtimeLayerEntities,
      loaded,
    };
  });

  return fixtureInventories;
}

async function runEntityRuntimeTruthMapChecks() {
  const fixtureInventories = buildEntityRuntimeInventory();

  const editorTypesAll = sortedUnique(fixtureInventories.flatMap((entry) => entry.editorTypes));
  const runtimeLayerTypesAll = sortedUnique(fixtureInventories.flatMap((entry) => entry.runtimeLayerTypes));

  const introducedRuntimeOnlyTypes = runtimeLayerTypesAll.filter((type) => !editorTypesAll.includes(type));
  const missingRuntimeTypes = editorTypesAll.filter((type) => !runtimeLayerTypesAll.includes(type));
  assert.deepEqual(missingRuntimeTypes, [], "Expected all editor-authored types to survive conversion.");

  const richFixture = fixtureInventories.find((entry) => entry.fixturePath.endsWith("src/data/test.json"));
  assert.ok(richFixture, "Expected src/data/test.json fixture inventory.");
  const richRuntimeEntities = richFixture.runtimeLayerEntities;
  assert.ok(richRuntimeEntities.length > 0, "Expected runtime entities in rich fixture.");

  const session = createRuntimeGameSession({ levelDocument: richFixture.loaded.level });
  const startResult = session.start();
  assert.equal(startResult.ok, true, "Expected runtime session start to succeed.");

  const playerSnapshot = session.getPlayerSnapshot();
  const sessionEntities = Array.isArray(playerSnapshot?.entities) ? playerSnapshot.entities : [];
  assert.ok(sessionEntities.length > 0, "Expected runtime player snapshot entities.");

  const runtimeSampleByType = pickSampleEntityByType(richRuntimeEntities);
  const sessionSampleByType = pickSampleEntityByType(sessionEntities);

  for (const [entityType, runtimeEntity] of runtimeSampleByType.entries()) {
    const sessionEntity = sessionSampleByType.get(entityType);
    assert.ok(sessionEntity, `Expected session entity type '${entityType}' to survive.`);
    assert.equal(sessionEntity.id, runtimeEntity.id, `Expected id survival for type '${entityType}'.`);
    assert.equal(sessionEntity.x, runtimeEntity.x, `Expected x survival for type '${entityType}'.`);
    assert.equal(sessionEntity.y, runtimeEntity.y, `Expected y survival for type '${entityType}'.`);
    assert.equal(sessionEntity.size, runtimeEntity.size, `Expected size survival for type '${entityType}'.`);
    assert.equal(sessionEntity.hp, runtimeEntity.hp, `Expected hp survival for type '${entityType}'.`);
    assert.equal(sessionEntity.maxHp, runtimeEntity.maxHp, `Expected maxHp survival for type '${entityType}'.`);
    assert.equal(sessionEntity.state, runtimeEntity.state, `Expected state survival for type '${entityType}'.`);
  }

  const richEntityWithParams = richRuntimeEntities.find((entity) => Object.keys(entity?.params || {}).length > 0);
  assert.ok(richEntityWithParams, "Expected at least one runtime layer entity with params.");

  const matchingSessionEntity = sessionEntities.find((entity) => entity.id === richEntityWithParams.id);
  assert.ok(matchingSessionEntity, "Expected matching session entity for runtime params check.");
  assert.equal(Object.prototype.hasOwnProperty.call(matchingSessionEntity, "params"), true, "Expected params to be preserved in runtime session entity snapshots.");
  assert.deepEqual(matchingSessionEntity.params, richEntityWithParams.params, "Expected runtime session snapshot params to match converted runtime layer params.");
  assert.notEqual(matchingSessionEntity.params, richEntityWithParams.params, "Expected runtime session snapshot params to be cloned.");

  const adapter = createLumoRechargedBootAdapter({
    sourceDescriptor: { levelDocument: richFixture.loaded.level },
  });
  const prepared = await adapter.prepare();
  assert.equal(prepared.ok, true, "Expected boot adapter prepare to succeed.");
  const booted = await adapter.boot();
  assert.equal(booted.ok, true, "Expected boot adapter boot to succeed.");

  const payload = adapter.getBootPayload();
  assert.ok(payload && typeof payload === "object", "Expected boot payload object.");
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "entities"), false, "Expected boot payload to not include top-level entities array.");

  const adapterPlayerSnapshot = adapter.getPlayerSnapshot();
  assert.ok(Array.isArray(adapterPlayerSnapshot?.entities), "Expected entities from adapter.getPlayerSnapshot().");

  const adapterEntity = adapterPlayerSnapshot.entities.find((entity) => entity.id === richEntityWithParams.id);
  assert.ok(adapterEntity, "Expected matching adapter entity.");
  assert.equal(Object.prototype.hasOwnProperty.call(adapterEntity, "params"), true, "Expected params to be preserved in adapter player snapshot entities.");
  assert.deepEqual(adapterEntity.params, richEntityWithParams.params, "Expected adapter snapshot params to match converted runtime layer params.");
  assert.notEqual(adapterEntity.params, matchingSessionEntity.params, "Expected adapter snapshot params to be cloned and detached from session snapshots.");

  const { html, normalized: lumoEntityReadKeys } = extractLumoHtmlEntityReadKeys();
  assert.deepEqual(
    lumoEntityReadKeys,
    [
      "_angryT",
      "_blinkDur",
      "_blinkT",
      "_facingX",
      "_lungeState",
      "_projectileSpritePath",
      "_tail",
      "active",
      "alive",
      "alpha",
      "awake",
      "consumesFlare",
      "dir",
      "eyeBlend",
      "flareExposure",
      "h",
      "hitFlashTicks",
      "id",
      "illuminated",
      "lightK",
      "lightRadius",
      "lightStrength",
      "mode",
      "params",
      "projectileSpritePath",
      "rot",
      "size",
      "sleepBlend",
      "state",
      "t",
      "type",
      "w",
      "x",
      "y",
    ],
    "Expected Lumo.html entity reader to preserve hover eye runtime fields used by live render path.",
  );
  assert.equal(html.includes("const drawSize = Math.min(16, Math.max(1, baseSize));"), true, "Expected firefly visual cap to clamp draw size at 16x16.");
  assert.equal(html.includes("const hoverEyesAfterDarkness = [];"), true, "Expected dedicated hover eye post-pass collection in live render loop.");
  assert.equal(html.includes("drawHoverVoidEyesV1(ctx, eyeDraw.x, eyeDraw.y, eyeDraw.entity, 1);"), true, "Expected live render loop to draw hover eyes via V1 procedural helper.");
  assert.equal(
    html.includes("const angry = (Number.isFinite(entity?._angryT) && entity._angryT > 0) || (typeof entity?._lungeState === \"string\" && entity._lungeState !== \"idle\");"),
    true,
    "Expected hover eye renderer to select angry-eye path from _angryT or non-idle lunge state.",
  );
  assert.equal(
    html.includes("const blink = Number.isFinite(entity?._blinkDur) && entity._blinkDur > 0 ? 0.15 : 1;"),
    true,
    "Expected hover eye renderer to select blink squash/line path from _blinkDur.",
  );
  assert.equal(
    html.includes("if (isHoverEyeRenderableFromRuntime(entity, mapper)) {"),
    true,
    "Expected live renderer to guard hover eye draw input by awake + eyeBlend + near-camera visibility.",
  );

  assert.equal(html.includes("ctx.fillStyle = entity.hitFlashTicks > 0 ? `rgba(250, 204, 21, ${hitAlpha})` : \"rgba(239, 68, 68, 0.72)\";"), true, "Expected red-box debug fill path in renderer.");

  const v1EditorIdTruth = extractV1EditorIdTruthSet();
  const survivingTypes = sortedUnique(sessionEntities.map((entity) => entity?.type).filter((type) => typeof type === "string"));
  const v1RestorationCandidates = survivingTypes.filter((type) => v1EditorIdTruth.includes(type));

  const inventory = {
    fixtures: fixtureInventories.map((entry) => ({
      fixturePath: entry.fixturePath,
      editorEntityCount: entry.editorEntityCount,
      editorTypes: entry.editorTypes,
      runtimeLayerEntityCount: entry.runtimeLayerEntityCount,
      runtimeLayerTypes: entry.runtimeLayerTypes,
    })),
    runtimeContract: {
      survivingTypes,
      editorTypesAll,
      runtimeLayerTypesAll,
      introducedRuntimeOnlyTypes,
      paramsPreservedInSessionSnapshot: true,
      paramsPreservedInAdapterSnapshot: true,
      liveLumoEntityReadKeys: lumoEntityReadKeys,
    },
    v1Truth: {
      v1EditorIdTruth,
      v1RestorationCandidates,
    },
  };

  console.log(JSON.stringify(inventory, null, 2));
  console.log("lumo-recharged-entity-runtime-truth-map-checks: ok");
}

await runEntityRuntimeTruthMapChecks();
