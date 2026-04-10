import assert from "node:assert/strict";

import { bootLumoRechargedFromQuery } from "../src/runtime/bootLumoRechargedFromQuery.js";

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

await runLegacyModeCheck();
await runDirectInjectedAdapterCheck();
await runInjectedLoaderCheck();
await runInvalidSourceCheck();

console.log("lumo-recharged-query-boot-checks: ok");
