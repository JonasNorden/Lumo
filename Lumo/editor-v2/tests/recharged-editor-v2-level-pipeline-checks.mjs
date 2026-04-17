import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadLevelDocument } from "../src/runtime/loadLevelDocument.js";
import { startRuntimeFromLevelDocument } from "../src/runtime/startRuntimeFromLevelDocument.js";
import { startRuntimeFromLevelUrl } from "../src/runtime/startRuntimeFromLevelUrl.js";
import { bootLumoRechargedFromQuery } from "../src/runtime/bootLumoRechargedFromQuery.js";
import { createRuntimeGameSession } from "../src/runtime/createRuntimeGameSession.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRelativePath = "../src/data/editorV2SavedLevel.sample.json";
const fixturePath = path.resolve(__dirname, fixtureRelativePath);
const fixtureUrlPath = "editor-v2/src/data/editorV2SavedLevel.sample.json";

function loadEditorFixture() {
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function createFileFetchStub() {
  return async function fetchStub(url) {
    const normalized = String(url || "").replace(/^https?:\/\/[^/]+\//, "");
    const fromRoot = path.resolve(__dirname, "../../", normalized);
    if (!fs.existsSync(fromRoot)) {
      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        async text() {
          return "";
        },
        async json() {
          return {};
        },
      };
    }

    const text = fs.readFileSync(fromRoot, "utf8");
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      async text() {
        return text;
      },
      async json() {
        return JSON.parse(text);
      },
    };
  };
}

async function withPatchedFetch(run) {
  const originalFetch = globalThis.fetch;
  const originalLocation = globalThis.location;
  globalThis.fetch = createFileFetchStub();
  globalThis.location = { href: "http://localhost/Lumo.html?recharged=1" };

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.location = originalLocation;
  }
}

function runEditorFixtureConversionChecks() {
  const source = loadEditorFixture();
  const loaded = loadLevelDocument(source);

  assert.equal(loaded.ok, true);
  assert.equal(loaded.level?.identity?.id, "editor-v2-authored-sample");
  assert.equal(loaded.level?.world?.width, 8);
  assert.equal(loaded.level?.world?.height, 6);
  assert.equal(loaded.level?.world?.tileSize, 24);
  assert.equal(loaded.level?.world?.spawn?.x, 2 * 24);
  assert.equal(loaded.level?.world?.spawn?.y, 1 * 24);
  assert.equal(
    loaded.warnings.some((warning) => warning.includes("defaulting to grid (1,1)")),
    false,
    "valid Editor V2 spawn should never trigger fallback spawn warning",
  );
  assert.equal(Array.isArray(loaded.level?.layers?.tiles), true);
  assert.equal(loaded.level.layers.tiles.length > 0, true);

  console.log("editor v2 conversion ok");
}

function runEditorDecorConversionChecks() {
  const source = loadEditorFixture();
  source.decor = [
    {
      id: "decor-alpha",
      name: "Flower A",
      type: "decor_flower_01",
      x: 4,
      y: 3,
      order: 9,
      flipX: true,
      variant: "b",
      visible: true,
      params: { bloom: 2 },
    },
  ];

  const loaded = loadLevelDocument(source);
  assert.equal(loaded.ok, true, "expected fixture to load successfully");
  assert.equal(Array.isArray(loaded.level?.layers?.decor), true);
  assert.equal(loaded.level.layers.decor.length, 1);

  const [decor] = loaded.level.layers.decor;
  assert.equal(decor.decorId, "decor-alpha");
  assert.equal(decor.x, 4);
  assert.equal(decor.y, 3);
  assert.equal(decor.order, 9);
  assert.equal(decor.flipX, true);
  assert.equal(decor.variant, "b");
  assert.equal(typeof decor.drawAnchor, "string");

  const session = createRuntimeGameSession({ levelDocument: loaded.level });
  assert.equal(session.start().ok, true, "expected session start");
  const worldSnapshot = session.getWorldSnapshot();
  assert.equal(Array.isArray(worldSnapshot.decorItems), true);
  assert.equal(worldSnapshot.decorItems.length, 1);
  assert.equal(worldSnapshot.decorItems[0].decorId, "decor-alpha");
  assert.equal(worldSnapshot.decorItems[0].flipX, true);
  assert.equal(worldSnapshot.decorItems[0].variant, "b");

  console.log("editor v2 decor conversion ok");
}


function runEditorEntityRuntimePipelineChecks() {
  const source = loadEditorFixture();
  source.entities = [
    ...(Array.isArray(source.entities) ? source.entities : []),
    {
      id: "editor-dark-creature",
      name: "Dark Creature",
      type: "dark_creature_01",
      x: 2,
      y: 1,
      visible: true,
      params: { hp: 2 },
    },
  ];

  const loaded = loadLevelDocument(source);
  assert.equal(loaded.ok, true, "expected fixture to load successfully");

  const runtimeEntity = loaded.level.layers.entities.find((entity) => entity.id === "editor-dark-creature");
  assert.ok(runtimeEntity, "expected converted runtime entity");
  assert.equal(runtimeEntity.type, "dark_creature_01", "expected runtime type");
  assert.equal(runtimeEntity.x, 2 * 24, "expected grid x to convert to pixels");
  assert.equal(runtimeEntity.y, 1 * 24, "expected grid y to convert to pixels");
  assert.equal(runtimeEntity.hp, 2, "expected hp sourced from params");

  const session = createRuntimeGameSession({ levelDocument: loaded.level });
  assert.equal(session.start().ok, true, "expected session start");

  const startSnapshot = session.getPlayerSnapshot();
  assert.equal(startSnapshot.entities.some((entity) => entity.id === "editor-dark-creature"), true, "expected entity in initial snapshot");

  session.tick({ pulse: true });
  const afterPulse = session.getPlayerSnapshot();
  const pulsedEntity = afterPulse.entities.find((entity) => entity.id === "editor-dark-creature");
  assert.ok(pulsedEntity, "expected entity after pulse tick");
  assert.equal(pulsedEntity.hp, 1, "expected pulse interaction to reduce hp");

  console.log("editor v2 entity runtime pipeline ok");
}

function runPulseTargetFilteringChecks() {
  const source = loadEditorFixture();
  source.entities = [
    { id: "enemy-dark", name: "Dark Creature", type: "dark_creature_01", x: 2, y: 1, visible: true, params: { hp: 2 } },
    { id: "enemy-hover", name: "Hover Void", type: "hover_void_01", x: 2, y: 1, visible: true, params: { maxHp: 2 } },
    {
      id: "pickup-flare",
      name: "Flare Pickup",
      type: "flare_pickup_01",
      x: 2,
      y: 1,
      visible: true,
      hp: 5,
      state: "idle",
      hitFlashTicks: 2,
      lastPulseIdHit: 77,
      params: { hp: 5 },
    },
    {
      id: "decor-flower",
      name: "Flower Decor",
      type: "decor_flower_01",
      x: 2,
      y: 1,
      visible: true,
      hp: 3,
      state: "idle",
      hitFlashTicks: 1,
      lastPulseIdHit: 88,
      params: { hp: 3 },
    },
    {
      id: "unknown-type",
      name: "Unknown",
      type: "unknown_entity_type",
      x: 2,
      y: 1,
      visible: true,
      hp: 4,
      state: "idle",
      hitFlashTicks: 4,
      lastPulseIdHit: 99,
      params: { hp: 4 },
    },
  ];

  const loaded = loadLevelDocument(source);
  assert.equal(loaded.ok, true, "expected fixture to load successfully");

  const session = createRuntimeGameSession({ levelDocument: loaded.level });
  assert.equal(session.start().ok, true, "expected session start");

  session.tick({ pulse: true });
  const afterPulse = session.getPlayerSnapshot();
  const byId = (entityId) => afterPulse.entities.find((entity) => entity.id === entityId);

  assert.equal(byId("enemy-dark")?.hp, 1, "pulse should affect dark_creature entities");
  assert.equal(byId("enemy-hover")?.hp, 1, "pulse should affect hover_void entities");

  assert.equal(byId("pickup-flare")?.hp, 5, "pulse should not affect flare pickups");
  assert.equal(byId("pickup-flare")?.state, "idle", "pulse should not alter flare pickup state");
  assert.equal(byId("pickup-flare")?.hitFlashTicks, 2, "pulse should not alter flare pickup hit flash");
  assert.equal(byId("pickup-flare")?.lastPulseIdHit, 77, "pulse should not alter flare pickup pulse tracking");

  assert.equal(byId("decor-flower")?.hp, 3, "pulse should not affect decor entities");
  assert.equal(byId("decor-flower")?.state, "idle", "pulse should not alter decor state");
  assert.equal(byId("decor-flower")?.hitFlashTicks, 1, "pulse should not alter decor hit flash");
  assert.equal(byId("decor-flower")?.lastPulseIdHit, 88, "pulse should not alter decor pulse tracking");

  assert.equal(byId("unknown-type")?.hp, 4, "pulse should not affect unknown entity types");
  assert.equal(byId("unknown-type")?.state, "idle", "pulse should not alter unknown entity state");
  assert.equal(byId("unknown-type")?.hitFlashTicks, 4, "pulse should not alter unknown entity hit flash");
  assert.equal(byId("unknown-type")?.lastPulseIdHit, 99, "pulse should not alter unknown entity pulse tracking");

  console.log("editor v2 pulse target filtering ok");
}

function runDarkCreatureCastFallbackChecks() {
  const source = loadEditorFixture();
  source.entities = [
    {
      id: "enemy-dark-cast-fallback",
      name: "Dark Creature",
      type: "dark_creature_01",
      x: 2,
      y: 1,
      visible: true,
      params: {
        hp: 3,
        hitCooldown: 0.6,
        safeDelay: 0.6,
        patrolTiles: 0,
        aggroTiles: 0,
        castCooldown: 0.01,
        energyLoss: 40,
        knockbackX: 260,
        knockbackY: -220,
        reactsToFlares: true,
      },
    },
  ];

  const loaded = loadLevelDocument(source);
  assert.equal(loaded.ok, true, "expected fixture to load successfully");

  const session = createRuntimeGameSession({ levelDocument: loaded.level });
  assert.equal(session.start().ok, true, "expected session start");

  let snapshot = session.getPlayerSnapshot();
  let castSource = snapshot.entities.find((entity) => entity.id === "enemy-dark-cast-fallback");
  assert.ok(castSource, "expected dark creature in runtime snapshot");

  const initialProjectileCount = Array.isArray(snapshot.darkProjectiles) ? snapshot.darkProjectiles.length : 0;
  let observedCastActivity = false;
  for (let tick = 0; tick < 60; tick += 1) {
    session.tick({});
    const tickSnapshot = session.getPlayerSnapshot();
    const tickEntity = tickSnapshot.entities.find((entity) => entity.id === "enemy-dark-cast-fallback");
    const tickProjectileCount = Array.isArray(tickSnapshot.darkProjectiles) ? tickSnapshot.darkProjectiles.length : 0;
    if ((tickEntity?.castCooldownT ?? 0) > 0.1 || tickProjectileCount > initialProjectileCount) {
      observedCastActivity = true;
      break;
    }
  }

  snapshot = session.getPlayerSnapshot();
  castSource = snapshot.entities.find((entity) => entity.id === "enemy-dark-cast-fallback");
  assert.ok(castSource, "expected dark creature to remain active");
  assert.equal(observedCastActivity, true, "expected cast fallback config to trigger cast activity");

  console.log("editor v2 dark creature cast fallback ok");
}

async function runRuntimeStartChecks() {
  await withPatchedFetch(async () => {
    const result = await startRuntimeFromLevelUrl(fixtureUrlPath, { steps: 0 });

    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.levelDocument?.identity?.id, "editor-v2-authored-sample");
    assert.equal(result.initialization?.world?.id, "editor-v2-authored-sample");
    assert.equal(result.initialization?.player?.startPosition?.x, 2 * 24);
    assert.equal(result.initialization?.player?.startPosition?.y, 1 * 24);
  });

  console.log("editor v2 runtime start ok");
}

function runMissingSpawnWarningChecks() {
  const source = loadEditorFixture();
  source.entities = source.entities.filter((entity) => entity?.type !== "player-spawn");

  const loaded = loadLevelDocument(source);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.level?.world?.spawn?.x, 24);
  assert.equal(loaded.level?.world?.spawn?.y, 24);
  assert.equal(
    loaded.warnings.some((warning) => warning.includes("missing player spawn data")),
    true,
    "missing Editor V2 spawn should emit an explicit warning",
  );

  console.log("editor v2 missing spawn warning ok");
}

async function runNoRespawnLoopOnValidSpawnChecks() {
  const safeEditorLevel = {
    meta: { id: "editor-v2-safe-spawn", name: "Safe Spawn", version: "2.0.0", themeId: "cavern" },
    dimensions: { width: 6, height: 6, tileSize: 24 },
    tiles: {
      base: [
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 1, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        1, 1, 1, 1, 1, 1,
      ],
      placements: [],
    },
    backgrounds: { layers: [] },
    background: { base: new Array(36).fill(null), placements: [], materials: [], defaultMaterialId: "bg_void" },
    decor: [],
    entities: [{ id: "spawn-a", name: "Spawn", type: "player-spawn", x: 1, y: 1, visible: true, params: {} }],
    sounds: [],
    extra: {},
  };
  const loaded = loadLevelDocument(safeEditorLevel);
  assert.equal(loaded.ok, true);
  const result = startRuntimeFromLevelDocument(loaded.level, { steps: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.initialization?.player?.startPosition?.x, 24);
  assert.equal(result.initialization?.player?.startPosition?.y, 24);
  assert.notEqual(result.initialization?.player?.status, "respawned-out-of-bounds");
  assert.equal(
    result.warnings.some((warning) => warning.includes("respawned at authored spawn")),
    false,
    "valid spawn should not emit an immediate out-of-bounds respawn warning at level load",
  );

  console.log("editor v2 no respawn loop on valid spawn ok");
}

async function runQueryContractChecks() {
  await withPatchedFetch(async () => {
    const encodedPath = encodeURIComponent(fixtureUrlPath);
    const result = await bootLumoRechargedFromQuery({
      search: `?recharged=1&level=${encodedPath}`,
    });

    assert.equal(result.enabled, true);
    assert.equal(result.booted, true);
    assert.equal(result.ok, true);
    assert.equal(result.levelSourceType, "url");
    assert.equal(result.worldId, "editor-v2-authored-sample");
    assert.equal(Number.isFinite(result.playerX), true);
    assert.equal(Number.isFinite(result.playerY), true);
  });

  await withPatchedFetch(async () => {
    const result = await bootLumoRechargedFromQuery({
      search: "?recharged=1&level=chrome-extension://bad/path.json",
    });

    assert.equal(result.enabled, true);
    assert.equal(result.levelSourceType, "default-url");
    assert.equal(result.warnings.some((warning) => warning.includes("Invalid level query path")), true);
  });

  console.log("editor v2 query contract ok");
}

runEditorFixtureConversionChecks();
runEditorDecorConversionChecks();
runEditorEntityRuntimePipelineChecks();
runPulseTargetFilteringChecks();
runDarkCreatureCastFallbackChecks();
runMissingSpawnWarningChecks();
await runRuntimeStartChecks();
await runNoRespawnLoopOnValidSpawnChecks();
await runQueryContractChecks();

console.log("recharged-editor-v2-level-pipeline-checks: ok");
