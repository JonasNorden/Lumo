import assert from "node:assert/strict";

import { bootLumoRechargedFromQuery } from "../src/runtime/bootLumoRechargedFromQuery.js";
import { createLumoRechargedBootAdapter } from "../src/runtime/createLumoRechargedBootAdapter.js";

function createStubAdapter(payloadOverrides = {}) {
  const payload = {
    status: "running",
    tick: 2,
    worldId: "world.stub",
    themeId: "theme.stub",
    playerStatus: "grounded",
    playerX: 42,
    playerY: 84,
    ...payloadOverrides,
  };

  return {
    async prepare() {
      return { ok: true, prepared: true };
    },
    async boot() {
      return { ok: true, booted: true };
    },
    tickSteps() {
      return { ok: true, stepsRun: 4 };
    },
    getBootPayload() {
      return payload;
    },
  };
}

async function runLegacyModeCheck() {
  const result = await bootLumoRechargedFromQuery({ search: "" });

  assert.equal(result.enabled, false);
  assert.equal(result.mode, "legacy");
  assert.equal(Array.isArray(result.errors), true);

  console.log("query boot legacy ok");
}

async function runDirectInjectedAdapterCheck() {
  const result = await bootLumoRechargedFromQuery({
    search: "?recharged=1",
    createAdapter() {
      return createStubAdapter();
    },
  });

  assert.equal(result.enabled, true);
  assert.equal(result.booted, true);
  assert.equal(result.mode, "recharged");
  assert.equal(result.ok, true);
  assert.equal(result.worldId, "world.stub");

  console.log("query boot recharged ok");
}

async function runInjectedLoaderCheck() {
  let loaderCalled = false;

  const result = await bootLumoRechargedFromQuery({
    search: "?recharged=1&level=editor-v2/src/data/testLevelDocument.v1.json&autoplay=1",
    loadLevelDocument() {
      loaderCalled = true;
      return Promise.resolve({ levelDocument: { identity: { id: "loaded.level" } } });
    },
    createAdapter(options = {}) {
      return {
        async prepare() {
          await options.loadLevelDocument?.(options.sourceDescriptor);
          return { ok: true, prepared: true };
        },
        async boot() {
          return { ok: true, booted: true };
        },
        tickSteps() {
          return { ok: true, stepsRun: 4 };
        },
        getBootPayload() {
          return {
            status: "running",
            tick: 5,
            worldId: "loaded.world",
            themeId: "loaded.theme",
            playerStatus: "falling",
            playerX: 16,
            playerY: 8,
          };
        },
      };
    },
  });

  assert.equal(loaderCalled, true);
  assert.equal(result.booted, true);
  assert.equal(result.autoplay, true);
  assert.equal(result.levelSourceType, "url");
  assert.equal(result.worldId, "loaded.world");

  console.log("query boot loaded ok");
}

async function runInvalidSourceCheck() {
  const result = await bootLumoRechargedFromQuery({
    search: "?recharged=1&level=bad://level.json",
    createAdapter() {
      return {
        async prepare() {
          return { ok: false, prepared: false };
        },
        async boot() {
          return { ok: false, booted: false };
        },
        getBootPayload() {
          return { status: "invalid", tick: 0 };
        },
      };
    },
  });

  assert.equal(result.enabled, true);
  assert.equal(result.booted, false);
  assert.equal(result.ok, false);
  assert.equal(result.mode, "recharged");
  assert.equal(result.errors.length > 0, true);

  console.log("query boot invalid handled");
}

async function runLiveValueQueryBootPathChecks() {
  const liveValueFixture = {
    identity: { id: "query-boot-live-values", formatVersion: "1.0.0", themeId: "test", name: "Live values" },
    world: { width: 80, height: 20, tileSize: 24, spawn: { x: 120, y: 120 } },
    layers: {
      tiles: [],
      background: [],
      decor: [],
      audio: [],
      entities: [
        { id: "dark-caster", type: "dark_creature_01", x: 280, y: 120, visible: true, params: { aggroTiles: 12 } },
        { id: "hover-watch", type: "hover_void_01", x: 132, y: 120, visible: true, params: { aggroTiles: 6 } },
      ],
    },
  };

  let adapter = null;
  const result = await bootLumoRechargedFromQuery({
    search: "?recharged=1&autoplay=1&level=memory://query-boot-live-values",
    loadLevelDocument() {
      return Promise.resolve({ levelDocument: liveValueFixture });
    },
    createAdapter(options = {}) {
      adapter = createLumoRechargedBootAdapter(options);
      return adapter;
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.booted, true);
  assert.ok(adapter && typeof adapter.getPlayerSnapshot === "function", "Expected live adapter from query boot path.");

  let sawProjectile = false;
  for (let index = 0; index < 180; index += 1) {
    const tick = adapter.tick();
    assert.equal(tick.ok, true, "Expected query-boot adapter tick to remain healthy.");
    const snapshot = adapter.getPlayerSnapshot();
    if (Array.isArray(snapshot?.darkProjectiles) && snapshot.darkProjectiles.length > 0) {
      sawProjectile = true;
      break;
    }
  }
  assert.equal(sawProjectile, true, "Expected active dark casts to surface in adapter.getPlayerSnapshot().darkProjectiles.");

  const snapshot = adapter.getPlayerSnapshot();
  const hover = Array.isArray(snapshot?.entities) ? snapshot.entities.find((entity) => entity?.id === "hover-watch") : null;
  assert.ok(hover, "Expected hover entity in query-boot live snapshot.");
  assert.equal(typeof hover.awake, "boolean");
  assert.equal(typeof hover.sleepBlend, "number");
  assert.equal(typeof hover.eyeBlend, "number");
  assert.equal(typeof hover._wakeHold, "number");
  assert.equal(typeof hover._isFollowing, "boolean");

  console.log("query boot live values ok");
}



async function runSessionPayloadPriorityCheck() {
  let loadedFromDescriptor = null;
  const sessionStorageRef = {
    getItem(key) {
      if (key !== "lumo.editorPlay.level.v1") return null;
      return JSON.stringify({
        identity: { id: "session-priority", formatVersion: "1.0.0", themeId: "test", name: "Session" },
        world: { width: 40, height: 20, tileSize: 24, spawn: { x: 24, y: 24 } },
        layers: { tiles: [], background: [], decor: [], entities: [] },
      });
    },
  };

  const result = await bootLumoRechargedFromQuery({
    search: "?recharged=1&level=memory://should-not-win",
    sessionStorageRef,
    createAdapter(options = {}) {
      loadedFromDescriptor = options?.sourceDescriptor;
      return {
        async prepare() {
          const loaded = await options.loadLevelDocument?.(options.sourceDescriptor);
          assert.equal(typeof loaded?.levelDocument?.identity?.id, "string");
          assert.equal(loaded.levelDocument.identity.id, "session-priority");
          return { ok: true, prepared: true };
        },
        async boot() {
          return { ok: true, booted: true };
        },
        getBootPayload() {
          return { status: "running", tick: 1, worldId: "session-priority" };
        },
      };
    },
  });

  assert.equal(result.levelSourceType, "editor-play-session");
  assert.equal(result.booted, true);
  assert.deepEqual(loadedFromDescriptor, { source: "editor-play-session" });

  console.log("query boot session payload priority ok");
}
await runLegacyModeCheck();
await runDirectInjectedAdapterCheck();
await runInjectedLoaderCheck();
await runInvalidSourceCheck();
await runSessionPayloadPriorityCheck();
await runLiveValueQueryBootPathChecks();

console.log("lumo-recharged-query-boot-checks: ok");
