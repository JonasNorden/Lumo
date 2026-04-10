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

  assert.equal(rightTick.ok, true);
  assert.equal(rightTick.stepped, true);
  assert.equal(afterRight.x > before.x, true);

  assert.equal(leftTick.ok, true);
  assert.equal(leftTick.stepped, true);
  assert.equal(leftTickTwo.ok, true);
  assert.equal(leftTickTwo.stepped, true);
  assert.equal(afterLeft.x < afterRight.x, true);

  assert.equal(jumpTick.ok, true);
  assert.equal(jumpTick.stepped, true);
  assert.equal(afterJump.y < afterLeft.y, true);
  assert.equal(payloadAfterJump.playerY, afterJump.y);

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

await runValidDirectSourceChecks();
await runTickIntentUpdatesLivePlayerChecks();
await runLoaderDescriptorChecks();
await runPartialSourceChecks();
await runInvalidSourceChecks();

console.log("lumo-recharged-boot-adapter-checks: ok");
