import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createRuntimeGameSession } from "../src/runtime/createRuntimeGameSession.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixtureLevelDocument() {
  const fixturePath = path.resolve(__dirname, "../src/data/testLevelDocument.v1.json");
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function runValidLevelChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const session = createRuntimeGameSession({ levelDocument });

  assert.equal(session.ok, true);

  const startResult = session.start();
  assert.equal(startResult.ok, true);

  const runResult = session.tickSteps(12);
  const summary = session.getSummary();

  assert.equal(runResult.ok, true);
  assert.equal(runResult.stepsRun, 12);
  assert.equal(summary.tick, 12);

  const player = session.getPlayerSnapshot();
  assert.equal(typeof player, "object");
  assert.equal(player.ok, true);

  console.log("session valid ok");
  console.log("session ticked 12");
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

  const session = createRuntimeGameSession({ levelDocument: partialLevel });
  session.start();
  session.tick();

  const summary = session.getSummary();

  assert.equal(typeof summary, "object");
  assert.equal(typeof summary.player, "object");
  assert.equal(typeof summary.world, "object");
  assert.equal(typeof summary.status, "string");
}

function runInvalidLevelChecks() {
  const session = createRuntimeGameSession({ levelDocument: null });

  const before = session.getSummary().tick;
  const runResult = session.tickSteps(5);
  const after = session.getSummary().tick;

  assert.equal(session.ok, false);
  assert.equal(session.getState().status, "invalid");
  assert.equal(runResult.stepsRun, 0);
  assert.equal(after, before);

  console.log("session invalid handled");
}

runValidLevelChecks();
runPartialLevelChecks();
runInvalidLevelChecks();

console.log("runtime-game-session-checks: ok");
