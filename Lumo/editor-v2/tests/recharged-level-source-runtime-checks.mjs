import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createRechargedLevelSourceRuntime } from "../src/runtime/createRechargedLevelSourceRuntime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixtureLevelDocument() {
  const fixturePath = path.resolve(__dirname, "../src/data/testLevelDocument.v1.json");
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function assertRuntimeSummaryShape(summary) {
  assert.equal(typeof summary, "object");
  assert.equal(typeof summary.ok, "boolean");
  assert.equal(typeof summary.sourceResolved, "boolean");
  assert.equal(typeof summary.initialized, "boolean");
  assert.equal(typeof summary.started, "boolean");
  assert.equal(typeof summary.startable, "boolean");
  assert.equal(typeof summary.status, "string");
  assert.equal(typeof summary.tick, "number");
  assert.equal(typeof summary.player, "object");
  assert.equal(typeof summary.world, "object");
}

function assertSourceSummaryShape(summary) {
  assert.equal(typeof summary, "object");
  assert.equal(typeof summary.ok, "boolean");
  assert.equal(typeof summary.sourceResolved, "boolean");
  assert.equal(typeof summary.status, "string");
  assert.equal(typeof summary.worldId, "string");
  assert.equal(typeof summary.themeId, "string");
  assert.equal(typeof summary.width, "number");
  assert.equal(typeof summary.height, "number");
  assert.equal(typeof summary.tileSize, "number");
}

function assertBootPayloadShape(payload) {
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

function runValidLevelDocumentSourceChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const runtime = createRechargedLevelSourceRuntime({
    levelSource: { levelDocument },
  });

  assert.equal(runtime.ok, true);
  assert.equal(runtime.getState().sourceResolved, true);

  const initializeResult = runtime.initialize();
  const startResult = runtime.start();
  const stepsResult = runtime.tickSteps(18);

  assert.equal(initializeResult.ok, true);
  assert.equal(startResult.ok, true);
  assert.equal(stepsResult.ok, true);
  assert.equal(runtime.getSummary().tick, 18);

  console.log("source runtime valid ok");
  console.log("source runtime ticked 18");
}

function runLiveEnergySnapshotExposureChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const runtime = createRechargedLevelSourceRuntime({
    levelSource: { levelDocument },
  });

  runtime.initialize();
  runtime.start();

  const before = runtime.getPlayerSnapshot();
  const boostStep = runtime.tick({ right: true, boost: true });
  const afterBoost = runtime.getPlayerSnapshot();

  assert.equal(boostStep.ok, true);
  assert.equal(typeof before, "object");
  assert.equal(typeof afterBoost, "object");
  assert.equal(Number.isFinite(before.energy), true, "expected live player snapshot energy to be exposed before spend");
  assert.equal(Number.isFinite(afterBoost.energy), true, "expected live player snapshot energy to remain exposed after spend");
  assert.equal(afterBoost.energy <= before.energy, true, "expected boost step to spend or hold energy");
  assert.equal(Object.prototype.hasOwnProperty.call(afterBoost, "lives"), true, "expected player snapshot to carry lives field for HUD mapping");
  assert.equal(Object.prototype.hasOwnProperty.call(afterBoost, "score"), true, "expected player snapshot to carry score field for HUD mapping");

  console.log("source runtime exposes live energy/lives/score snapshots");
}

function runValidDocumentSourceChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const runtime = createRechargedLevelSourceRuntime({
    levelSource: { document: levelDocument },
  });

  assert.equal(runtime.ok, true);
  assert.equal(runtime.getState().sourceResolved, true);
  assertRuntimeSummaryShape(runtime.getSummary());
  assertSourceSummaryShape(runtime.getSourceSummary());
  assertBootPayloadShape(runtime.getBootPayload());
}

function runDirectLevelDocumentChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const runtime = createRechargedLevelSourceRuntime({ levelSource: levelDocument });

  assert.equal(runtime.ok, true);
  assert.equal(runtime.getState().sourceResolved, true);
}

function runPartialSourceChecks() {
  const runtime = createRechargedLevelSourceRuntime({
    levelSource: {
      levelDocument: {
        identity: { id: "partial-source", themeId: "test-theme" },
        world: { width: 64 },
      },
    },
  });

  assert.equal(typeof runtime.initialize(), "object");
  assert.equal(typeof runtime.start(), "object");
  assert.equal(typeof runtime.tick(), "object");
  assert.equal(typeof runtime.stop(), "object");
  assert.equal(typeof runtime.reset(), "object");

  assertRuntimeSummaryShape(runtime.getSummary());
  assertSourceSummaryShape(runtime.getSourceSummary());
  assertBootPayloadShape(runtime.getBootPayload());
}

function runInvalidSourceChecks() {
  const runtime = createRechargedLevelSourceRuntime({ levelSource: null });

  const tickBefore = runtime.getSummary().tick;
  const initializeResult = runtime.initialize();
  const startResult = runtime.start();
  const stopResult = runtime.stop();
  const resetResult = runtime.reset();
  const tickAfter = runtime.getSummary().tick;

  assert.equal(runtime.ok, false);
  assert.equal(runtime.getState().sourceResolved, false);
  assert.equal(runtime.getState().status, "invalid");
  assert.equal(initializeResult.ok, false);
  assert.equal(startResult.ok, false);
  assert.equal(tickAfter, tickBefore);
  assert.equal(typeof stopResult, "object");
  assert.equal(typeof resetResult, "object");

  console.log("source runtime invalid handled");
}

runValidLevelDocumentSourceChecks();
runLiveEnergySnapshotExposureChecks();
runValidDocumentSourceChecks();
runDirectLevelDocumentChecks();
runPartialSourceChecks();
runInvalidSourceChecks();

console.log("recharged-level-source-runtime-checks: ok");
