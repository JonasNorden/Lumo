import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createRechargedGameRuntime } from "../src/runtime/createRechargedGameRuntime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixtureLevelDocument() {
  const fixturePath = path.resolve(__dirname, "../src/data/testLevelDocument.v1.json");
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function runValidLevelChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const runtime = createRechargedGameRuntime({ levelDocument });

  assert.equal(runtime.ok, true);

  const bootResult = runtime.boot();
  assert.equal(bootResult.ok, true);
  assert.equal(runtime.isBooted(), true);

  const stepResult = runtime.tickSteps(15);
  assert.equal(stepResult.ok, true);
  assert.equal(stepResult.stepsRun, 15);

  const summary = runtime.getSummary();
  assert.equal(summary.tick, 15);

  const bootSummary = runtime.getBootSummary();
  assert.equal(typeof bootSummary, "object");
  assert.equal(typeof bootSummary.worldId, "string");
  assert.equal(typeof bootSummary.themeId, "string");

  console.log("runtime valid boot ok");
  console.log("runtime ticked 15");
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

  const runtime = createRechargedGameRuntime({ levelDocument: partialLevel });
  const bootResult = runtime.boot();
  const tickResult = runtime.tick();
  const summary = runtime.getSummary();
  const bootSummary = runtime.getBootSummary();

  assert.equal(typeof runtime.ok, "boolean");
  assert.equal(typeof bootResult, "object");
  assert.equal(typeof tickResult, "object");
  assert.equal(typeof summary, "object");
  assert.equal(typeof summary.player, "object");
  assert.equal(typeof summary.world, "object");
  assert.equal(typeof bootSummary, "object");
  assert.equal(typeof runtime.getState(), "object");
}

function runInvalidLevelChecks() {
  const runtime = createRechargedGameRuntime({ levelDocument: null });

  const bootResult = runtime.boot();
  const beforeTick = runtime.getSummary().tick;
  const tickResult = runtime.tick();
  const tickStepsResult = runtime.tickSteps(5);
  const shutdownResult = runtime.shutdown();
  const resetResult = runtime.reset();
  const afterTick = runtime.getSummary().tick;

  assert.equal(runtime.ok, false);
  assert.equal(runtime.getState().bootable, false);
  assert.equal(runtime.getState().status, "invalid");
  assert.equal(bootResult.ok, false);
  assert.equal(tickResult.stepped, false);
  assert.equal(tickStepsResult.stepsRun, 0);
  assert.equal(afterTick, beforeTick);
  assert.equal(typeof shutdownResult, "object");
  assert.equal(typeof resetResult, "object");

  console.log("runtime invalid handled");
}

runValidLevelChecks();
runPartialLevelChecks();
runInvalidLevelChecks();

console.log("recharged-game-runtime-checks: ok");
