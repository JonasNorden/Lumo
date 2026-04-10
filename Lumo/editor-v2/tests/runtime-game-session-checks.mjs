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

function runInputIntentMovementChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const session = createRuntimeGameSession({ levelDocument });

  assert.equal(session.start().ok, true);

  const before = session.getPlayerSnapshot();
  const rightTick = session.tick({ right: true, left: false, jump: false });
  const afterRight = session.getPlayerSnapshot();
  const leftTick = session.tick({ right: false, left: true, jump: false });
  const leftTickTwo = session.tick({ right: false, left: true, jump: false });
  const afterLeft = session.getPlayerSnapshot();
  const jumpTick = session.tick({ right: false, left: false, jump: true });
  const afterJump = session.getPlayerSnapshot();
  const idleTick = session.tick({ right: false, left: false, jump: false });
  const afterIdle = session.getPlayerSnapshot();

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
  assert.equal(afterJump.grounded, false);
  assert.equal(afterJump.falling, false);
  assert.equal(afterJump.locomotion.includes("rising") || afterJump.locomotion.includes("airborne"), true);

  assert.equal(idleTick.ok, true);
  assert.equal(idleTick.stepped, true);
  assert.equal(typeof afterIdle.locomotion, "string");
  assert.equal(afterIdle.y <= afterJump.y, true);

  const resetSession = createRuntimeGameSession({ levelDocument });
  assert.equal(resetSession.start().ok, true);
  const stableBefore = resetSession.getPlayerSnapshot();
  const stableTick = resetSession.tick({ left: false, right: false, jump: false });
  const stableAfter = resetSession.getPlayerSnapshot();

  assert.equal(stableTick.ok, true);
  assert.equal(stableAfter.grounded, true);
  assert.equal(stableAfter.falling, false);
  assert.equal(stableAfter.locomotion, "idle-grounded");
  assert.equal(stableAfter.y, stableBefore.y);

  console.log("session input intent movement ok");
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

function runBottomBoundaryLandingJumpChecks() {
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

  const session = createRuntimeGameSession({ levelDocument: bottomBoundaryLevel });
  assert.equal(session.start().ok, true);

  const fallToBottom = session.tickSteps(200);
  const landedSnapshot = session.getPlayerSnapshot();

  assert.equal(fallToBottom.ok, true);
  assert.equal(landedSnapshot.y, bottomBoundaryLevel.world.height * bottomBoundaryLevel.world.tileSize - 1);
  assert.equal(landedSnapshot.grounded, true);
  assert.equal(landedSnapshot.falling, false);

  const jumpTick = session.tick({ left: false, right: false, jump: true });
  const jumpSnapshot = session.getPlayerSnapshot();
  const postJumpAirTick = session.tick({ left: false, right: false, jump: false });
  const postJumpAirSnapshot = session.getPlayerSnapshot();

  assert.equal(jumpTick.ok, true);
  assert.equal(jumpTick.stepped, true);
  assert.equal(jumpSnapshot.y < landedSnapshot.y, true);
  assert.equal(jumpSnapshot.grounded, false);
  assert.equal(jumpSnapshot.falling, false);
  assert.equal(postJumpAirTick.ok, true);
  assert.equal(postJumpAirTick.stepped, true);
  assert.equal(postJumpAirSnapshot.y < jumpSnapshot.y, true, "post-jump tick should continue moving upward before apex");
  assert.equal(postJumpAirSnapshot.grounded, false);

  console.log("session bottom boundary landing + jump ok");
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
runInputIntentMovementChecks();
runPartialLevelChecks();
runBottomBoundaryLandingJumpChecks();
runInvalidLevelChecks();

console.log("runtime-game-session-checks: ok");
