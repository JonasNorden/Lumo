import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createRechargedBootIntegration } from "../src/runtime/createRechargedBootIntegration.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixtureLevelDocument() {
  const fixturePath = path.resolve(__dirname, "../src/data/testLevelDocument.v1.json");
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function assertSummaryShape(summary) {
  assert.equal(typeof summary, "object");
  assert.equal(typeof summary.ok, "boolean");
  assert.equal(typeof summary.initialized, "boolean");
  assert.equal(typeof summary.started, "boolean");
  assert.equal(typeof summary.startable, "boolean");
  assert.equal(typeof summary.status, "string");
  assert.equal(typeof summary.tick, "number");
  assert.equal(typeof summary.player, "object");
  assert.equal(typeof summary.world, "object");
}

function assertPayloadShape(payload) {
  assert.equal(typeof payload, "object");
  assert.equal(typeof payload.ok, "boolean");
  assert.equal(typeof payload.initialized, "boolean");
  assert.equal(typeof payload.started, "boolean");
  assert.equal(typeof payload.startable, "boolean");
  assert.equal(typeof payload.status, "string");
  assert.equal(typeof payload.tick, "number");
  assert.equal(typeof payload.worldId, "string");
  assert.equal(typeof payload.themeId, "string");
  assert.equal(typeof payload.playerStatus, "string");
}

function runValidLevelChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const integration = createRechargedBootIntegration({ levelDocument });

  assert.equal(integration.ok, true);

  const initializeResult = integration.initialize();
  assert.equal(initializeResult.ok, true);
  assert.equal(initializeResult.initialized, true);

  const startResult = integration.start();
  assert.equal(startResult.ok, true);
  assert.equal(startResult.started, true);

  assert.equal(integration.isInitialized(), true);
  assert.equal(integration.isStarted(), true);

  const stepped = integration.tickSteps(20);
  assert.equal(stepped.ok, true);
  assert.equal(stepped.stepsRun, 20);

  const summary = integration.getSummary();
  assert.equal(summary.tick, 20);

  const payload = integration.getBootPayload();
  assertPayloadShape(payload);

  console.log("boot integration valid ok");
  console.log("boot integration ticked 20");
}

function runPartialLevelChecks() {
  const partialLevel = {
    identity: { id: "partial-level", formatVersion: "1.0.0", themeId: "test", name: "Partial" },
    world: {
      width: 128,
      height: 128,
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

  const integration = createRechargedBootIntegration({ levelDocument: partialLevel });

  const initializeResult = integration.initialize();
  const startResult = integration.start();
  const tickResult = integration.tick();
  const stopResult = integration.stop();
  const resetResult = integration.reset();

  assert.equal(typeof initializeResult, "object");
  assert.equal(typeof startResult, "object");
  assert.equal(typeof tickResult, "object");
  assert.equal(typeof stopResult, "object");
  assert.equal(typeof resetResult, "object");

  assertSummaryShape(integration.getSummary());
  assertPayloadShape(integration.getBootPayload());
}

function runInvalidLevelChecks() {
  const integration = createRechargedBootIntegration({ levelDocument: null });

  const beforeTick = integration.getSummary().tick;
  const initializeResult = integration.initialize();
  const startResult = integration.start();
  const tickResult = integration.tick();
  const stopResult = integration.stop();
  const resetResult = integration.reset();
  const afterTick = integration.getSummary().tick;

  assert.equal(integration.ok, false);
  assert.equal(integration.getState().startable, false);
  assert.equal(integration.getState().status, "invalid");
  assert.equal(initializeResult.ok, false);
  assert.equal(startResult.ok, false);
  assert.equal(tickResult.stepped, false);
  assert.equal(afterTick, beforeTick);
  assert.equal(typeof stopResult, "object");
  assert.equal(typeof resetResult, "object");

  console.log("boot integration invalid handled");
}

runValidLevelChecks();
runPartialLevelChecks();
runInvalidLevelChecks();

console.log("recharged-boot-integration-checks: ok");
