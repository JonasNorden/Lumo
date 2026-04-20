import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createLumoRechargedBootAdapter } from "../src/runtime/createLumoRechargedBootAdapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixtureLevelDocument() {
  const fixturePath = path.resolve(__dirname, "../src/data/testLevelDocument.v1.json");
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function assertSummaryShape(summary) {
  assert.equal(typeof summary, "object");
  assert.equal(typeof summary.ok, "boolean");
  assert.equal(typeof summary.prepared, "boolean");
  assert.equal(typeof summary.booted, "boolean");
  assert.equal(typeof summary.bootable, "boolean");
  assert.equal(typeof summary.status, "string");
  assert.equal(typeof summary.tick, "number");
  assert.equal(typeof summary.loadMode, "string");
  assert.equal(typeof summary.player, "object");
  assert.equal(typeof summary.world, "object");
}

function assertBootStatusShape(status) {
  assert.equal(typeof status, "object");
  assert.equal(typeof status.ok, "boolean");
  assert.equal(typeof status.prepared, "boolean");
  assert.equal(typeof status.booted, "boolean");
  assert.equal(typeof status.bootable, "boolean");
  assert.equal(typeof status.status, "string");
  assert.equal(typeof status.tick, "number");
  assert.equal(typeof status.loadMode, "string");
  assert.equal(typeof status.worldId, "string");
  assert.equal(typeof status.themeId, "string");
  assert.equal(typeof status.playerStatus, "string");
}

function assertBootPayloadShape(payload) {
  assert.equal(typeof payload, "object");
  assert.equal(typeof payload.ok, "boolean");
  assert.equal(typeof payload.prepared, "boolean");
  assert.equal(typeof payload.booted, "boolean");
  assert.equal(typeof payload.bootable, "boolean");
  assert.equal(typeof payload.status, "string");
  assert.equal(typeof payload.tick, "number");
  assert.equal(typeof payload.loadMode, "string");
  assert.equal(typeof payload.worldId, "string");
  assert.equal(typeof payload.themeId, "string");
  assert.equal(typeof payload.worldWidth, "number");
  assert.equal(typeof payload.worldHeight, "number");
  assert.equal(typeof payload.tileSize, "number");
  assert.equal(typeof payload.playerStatus, "string");
}

async function runValidDirectSourceChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: levelDocument });

  assert.equal(adapter.ok, true);

  const prepareResult = await adapter.prepare();
  const bootResult = await adapter.boot();
  const tickStepsResult = adapter.tickSteps(14);

  assert.equal(prepareResult.ok, true);
  assert.equal(bootResult.ok, true);
  assert.equal(adapter.isPrepared(), true);
  assert.equal(adapter.isBooted(), true);
  assert.equal(tickStepsResult.ok, true);
  assert.equal(adapter.getSummary().tick, 14);

  console.log("boot adapter direct ok");
  console.log("boot adapter ticked 14");
}

async function runTickIntentUpdatesLivePlayerChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: levelDocument });

  await adapter.prepare();
  await adapter.boot();

  const before = adapter.getPlayerSnapshot();
  const rightTick = adapter.tick({ right: true, left: false, jump: false });
  const afterRight = adapter.getPlayerSnapshot();
  const leftTick = adapter.tick({ right: false, left: true, jump: false });
  const leftTickTwo = adapter.tick({ right: false, left: true, jump: false });
  const afterLeft = adapter.getPlayerSnapshot();
  const jumpTick = adapter.tick({ right: false, left: false, jump: true });
  const afterJump = adapter.getPlayerSnapshot();
  const payloadAfterJump = adapter.getBootPayload();
  const boostTick = adapter.tick({ right: true, left: false, jump: false, boost: true });
  const afterBoost = adapter.getPlayerSnapshot();

  assert.equal(rightTick.ok, true);
  assert.equal(rightTick.stepped, true);
  assert.equal(afterRight.x > before.x, true);

  assert.equal(leftTick.ok, true);
  assert.equal(leftTick.stepped, true);
  assert.equal(leftTickTwo.ok, true);
  assert.equal(leftTickTwo.stepped, true);
  assert.equal(afterLeft.x < afterRight.x, true);
  assert.equal(afterRight.facingX, 1, "moving right should publish right-facing snapshot");
  assert.equal(afterLeft.facingX, -1, "moving left should publish left-facing snapshot");

  assert.equal(jumpTick.ok, true);
  assert.equal(jumpTick.stepped, true);
  assert.equal(afterJump.y < afterLeft.y, true);
  assert.equal(payloadAfterJump.playerY, afterJump.y);
  assert.equal(boostTick.ok, true);
  assert.equal(boostTick.stepped, true);
  assert.equal(typeof afterBoost.boostActive, "boolean");
  assert.equal(afterBoost.boostActive, true);
  assert.equal(typeof afterBoost.rising, "boolean");
  assert.equal(typeof afterBoost.facingX, "number");
  assert.equal(Number.isFinite(afterBoost.energy) || afterBoost.energy === null, true);

  console.log("boot adapter tick input updates player snapshot");
}

async function runLoaderDescriptorChecks() {
  const levelDocument = loadFixtureLevelDocument();
  let loaderCalls = 0;

  async function loadLevelDocument(sourceDescriptor) {
    loaderCalls += 1;
    assert.equal(sourceDescriptor.path, "/levels/fixture.v1.json");
    return { levelDocument };
  }

  const adapter = createLumoRechargedBootAdapter({
    sourceDescriptor: { path: "/levels/fixture.v1.json" },
    loadLevelDocument,
  });

  const prepareResult = await adapter.prepare();
  const bootResult = await adapter.boot();

  assert.equal(loaderCalls, 1);
  assert.equal(prepareResult.ok, true);
  assert.equal(bootResult.ok, true);
  assertBootStatusShape(adapter.getBootStatus());
  assertBootPayloadShape(adapter.getBootPayload());

  console.log("boot adapter loaded ok");
}

async function runPartialSourceChecks() {
  const adapter = createLumoRechargedBootAdapter({
    sourceDescriptor: {
      levelDocument: {
        identity: { id: "partial", themeId: "test-theme" },
        world: { width: 64 },
      },
    },
  });

  await adapter.prepare();
  await adapter.boot();
  adapter.tick();
  adapter.stop();
  adapter.reset();

  assertSummaryShape(adapter.getSummary());
  assertBootStatusShape(adapter.getBootStatus());
  assertBootPayloadShape(adapter.getBootPayload());
}

async function runInvalidSourceChecks() {
  const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: null });

  const tickBefore = adapter.getSummary().tick;
  const prepareResult = await adapter.prepare();
  const bootResult = await adapter.boot();
  const tickResult = adapter.tick();
  const stopResult = adapter.stop();
  const resetResult = adapter.reset();
  const tickAfter = adapter.getSummary().tick;

  assert.equal(adapter.ok, false);
  assert.equal(prepareResult.ok, false);
  assert.equal(bootResult.ok, false);
  assert.equal(tickResult.ok, false);
  assert.equal(adapter.getSummary().bootable, false);
  assert.equal(adapter.getSummary().status, "invalid");
  assert.equal(tickAfter, tickBefore);
  assert.equal(typeof stopResult.ok, "boolean");
  assert.equal(typeof resetResult.ok, "boolean");

  console.log("boot adapter invalid handled");
}

async function runBottomBoundaryOutOfBoundsRespawnChecks() {
  const bottomBoundaryLevel = {
    identity: { id: "bottom-boundary-level", formatVersion: "1.0.0", themeId: "test", name: "Bottom Boundary" },
    world: {
      width: 8,
      height: 4,
      tileSize: 32,
      spawn: { x: 32, y: 16 },
    },
    layers: {
      tiles: [],
      background: [],
      decor: [],
      entities: [],
      audio: [],
    },
  };

  const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: bottomBoundaryLevel });
  await adapter.prepare();
  await adapter.boot();

  let sawRespawnReset = false;
  let previousY = adapter.getPlayerSnapshot().y;

  for (let index = 0; index < 80; index += 1) {
    const tickResult = adapter.tick({ left: false, right: false, jump: false });
    const snapshot = adapter.getPlayerSnapshot();
    assert.equal(tickResult.ok, true);
    assert.equal(tickResult.stepped, true);
    if (snapshot.y < previousY) {
      sawRespawnReset = true;
      break;
    }
    previousY = snapshot.y;
  }

  const respawned = adapter.getPlayerSnapshot();
  assert.equal(sawRespawnReset, true, "adapter runtime should reset after bottom out-of-bounds fall");
  assert.equal(respawned.x, bottomBoundaryLevel.world.spawn.x);
  assert.equal(respawned.y, bottomBoundaryLevel.world.spawn.y);
  assert.equal(respawned.grounded, false);
  assert.equal(respawned.falling, true);

  console.log("boot adapter bottom boundary out-of-bounds respawn ok");
}

async function runOutOfBoundsRespawnChecks() {
  const tallWorldLevel = {
    identity: { id: "tall-world-level", formatVersion: "1.0.0", themeId: "test", name: "Tall World" },
    world: {
      width: 32,
      height: 360,
      tileSize: 32,
      spawn: { x: 64, y: 16 },
    },
    layers: {
      tiles: [],
      background: [],
      decor: [],
      entities: [],
      audio: [],
    },
  };

  const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: tallWorldLevel });
  await adapter.prepare();
  await adapter.boot();
  let sawRespawnReset = false;
  let maxObservedY = Number.NEGATIVE_INFINITY;
  let previousY = adapter.getPlayerSnapshot().y;

  for (let index = 0; index < 180; index += 1) {
    const tickResult = adapter.tick({ left: false, right: false, jump: false });
    const player = adapter.getPlayerSnapshot();
    assert.equal(tickResult.ok, true);
    assert.equal(tickResult.stepped, true);
    maxObservedY = Math.max(maxObservedY, player.y);
    if (player.y < previousY) {
      sawRespawnReset = true;
    }
    previousY = player.y;
  }

  const player = adapter.getPlayerSnapshot();
  assert.equal(sawRespawnReset, true, "adapter runtime should expose out-of-bounds respawn resets");
  assert.equal(maxObservedY <= 160, true, "adapter snapshot should not drift into deep-world runaway");
  assert.equal(player.x, tallWorldLevel.world.spawn.x);
  assert.equal(player.grounded, false);
  assert.equal(player.falling, true);

  console.log("boot adapter out-of-bounds respawn ok");
}

async function runLiquidDeathRuntimeChecks() {
  const liquidTypes = ["water_volume", "lava_volume", "bubbling_liquid_volume"];
  for (const liquidType of liquidTypes) {
    const liquidLevel = {
      identity: { id: `liquid-death-${liquidType}`, formatVersion: "1.0.0", themeId: "test", name: `Liquid ${liquidType}` },
      world: {
        width: 12,
        height: 18,
        tileSize: 24,
        spawn: { x: 4, y: 1 },
      },
      layers: {
        tiles: [],
        background: [],
        decor: [],
        entities: [
          {
            id: `${liquidType}-pit`,
            type: liquidType,
            x: 0,
            y: 18,
            active: true,
            params: { footprintW: 2000, footprintH: 2000 },
          },
        ],
        audio: [],
      },
    };

    const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: liquidLevel });
    await adapter.prepare();
    await adapter.boot();

    let sawLiquidDeath = false;
    let sawRespawnPending = false;
    let sawLiquidFade = false;
    let sawLiquidYIncrease = false;
    let previousLiquidY = null;
    let previousLiquidAlpha = null;
    let sawRespawned = false;
    let sawBottomRespawnBypass = false;

    for (let index = 0; index < 360; index += 1) {
      const tickResult = adapter.tick({ left: false, right: false, jump: false });
      const player = adapter.getPlayerSnapshot();
      assert.equal(tickResult.ok, true);
      assert.equal(tickResult.stepped, true);
      if (player?.status === "liquid-death") {
        sawLiquidDeath = true;
        sawBottomRespawnBypass = sawBottomRespawnBypass || player?.respawnPending !== true;
        if (Number.isFinite(previousLiquidY) && Number.isFinite(player?.y) && player.y > previousLiquidY) {
          sawLiquidYIncrease = true;
        }
        if (Number.isFinite(previousLiquidAlpha) && Number.isFinite(player?.renderAlpha) && player.renderAlpha < previousLiquidAlpha) {
          sawLiquidFade = true;
        }
        previousLiquidY = Number.isFinite(player?.y) ? player.y : previousLiquidY;
        previousLiquidAlpha = Number.isFinite(player?.renderAlpha) ? player.renderAlpha : previousLiquidAlpha;
      }
      if (player?.status === "respawn-pending") {
        sawRespawnPending = true;
      }
      if (player?.status === "respawned-out-of-bounds") {
        sawRespawned = true;
        break;
      }
    }

    assert.equal(sawLiquidDeath, true, `player should enter liquid death state for ${liquidType}`);
    assert.equal(sawLiquidYIncrease, true, `liquid death should force sinking movement for ${liquidType}`);
    assert.equal(sawLiquidFade, true, `liquid death should fade player render alpha for ${liquidType}`);
    assert.equal(sawBottomRespawnBypass, true, `liquid death should occur before generic bottom respawn for ${liquidType}`);
    assert.equal(sawRespawnPending, true, `liquid death should transition into respawn countdown for ${liquidType}`);
    assert.equal(sawRespawned, true, `liquid death should complete through respawn resolution flow for ${liquidType}`);
    assert.equal(adapter.getPlayerSnapshot()?.status !== "game-over", true, "liquid death in positive-life flow must not force game over");
  }

  console.log("boot adapter liquid death runtime ok");
}

await runValidDirectSourceChecks();
await runTickIntentUpdatesLivePlayerChecks();
await runLoaderDescriptorChecks();
await runPartialSourceChecks();
await runInvalidSourceChecks();
await runBottomBoundaryOutOfBoundsRespawnChecks();
await runOutOfBoundsRespawnChecks();
await runLiquidDeathRuntimeChecks();

console.log("lumo-recharged-boot-adapter-checks: ok");
