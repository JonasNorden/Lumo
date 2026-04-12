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
runEditorEntityRuntimePipelineChecks();
runMissingSpawnWarningChecks();
await runRuntimeStartChecks();
await runNoRespawnLoopOnValidSpawnChecks();
await runQueryContractChecks();

console.log("recharged-editor-v2-level-pipeline-checks: ok");
