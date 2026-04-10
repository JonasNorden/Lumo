import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createRuntimeRunner } from "../src/runtime/createRuntimeRunner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixtureLevelDocument() {
  const fixturePath = path.resolve(__dirname, "../src/data/testLevelDocument.v1.json");
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function runValidLevelChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const runner = createRuntimeRunner({ levelDocument });
  const startY = runner.getSummary().player.y;

  assert.equal(runner.ok, true);

  runner.start();
  const stepResult = runner.runSteps(10, { jump: true, moveX: 1 });
  const summary = runner.getSummary();

  assert.equal(stepResult.ok, true);
  assert.equal(summary.ok, true);
  assert.equal(summary.tick, 10);
  assert.equal(
    summary.player.y !== startY || summary.player.falling === true || summary.player.locomotion === "airborne-moving",
    true,
  );

  console.log("runner valid ok");
  console.log("runner stepped 10 ticks");
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

  const runner = createRuntimeRunner({ levelDocument: partialLevel });
  runner.start();
  const result = runner.runSteps(3);

  assert.equal(typeof runner.ok, "boolean");
  assert.equal(typeof result.stepsRun, "number");
  assert.equal(result.stepsRun >= 0, true);
}

function runInvalidLevelChecks() {
  const runner = createRuntimeRunner({ levelDocument: null });
  const before = runner.getSummary().tick;

  assert.equal(runner.ok, false);

  runner.start();
  runner.step();
  const after = runner.getSummary().tick;

  assert.equal(after, before);
  console.log("runner invalid handled");
}

runValidLevelChecks();
runPartialLevelChecks();
runInvalidLevelChecks();

console.log("runtime-runner-checks: ok");
