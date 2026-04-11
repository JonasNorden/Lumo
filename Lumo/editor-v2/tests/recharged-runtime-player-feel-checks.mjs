import assert from "node:assert/strict";

import { RUNTIME_PLAYER_PHYSICS_BASELINE } from "../src/runtime/runtimePlayerPhysicsBaseline.js";
import { stepRuntimePlayerSimulation } from "../src/runtime/stepRuntimePlayerSimulation.js";

function buildFlatWorldPacket() {
  const width = 20;
  const height = 12;
  const tileSize = 24;
  const tiles = new Array(width * height).fill(0);

  // Build a simple floor on the last row.
  for (let x = 0; x < width; x += 1) {
    tiles[(height - 1) * width + x] = 1;
  }

  return {
    world: { width, height, tileSize },
    layers: { tiles },
    spawn: { x: 4 * tileSize, y: (height - 2) * tileSize - 1 },
    tileBounds: { maxY: height - 1 },
  };
}

function runBaselineConstantChecks() {
  assert.deepEqual(RUNTIME_PLAYER_PHYSICS_BASELINE, {
    groundMaxSpeedX: 1.2,
    groundAccelerationX: 0.2,
    groundFrictionX: 0.25,
    airMaxSpeedX: 1,
    airAccelerationX: 0.16,
    airFrictionX: 0.05,
    jumpVelocityY: -3.2,
    gravityY: 0.18,
    maxFallSpeedY: 1.9,
  });
}

function runHorizontalControlChecks() {
  const worldPacket = buildFlatWorldPacket();
  let player = {
    position: { x: 4 * 24, y: (10 * 24) - 1 },
    velocity: { x: 0, y: 0 },
    grounded: true,
    falling: false,
    rising: false,
    landed: false,
  };

  const startX = player.position.x;
  for (let tick = 0; tick < 20; tick += 1) {
    const step = stepRuntimePlayerSimulation(worldPacket, player, { input: { moveX: 1, jump: false } });
    assert.equal(step.ok, true);
    player = step.player;
  }

  const distance = player.position.x - startX;
  assert.equal(distance <= 24, true, `expected slower baseline horizontal travel, got ${distance}`);
}

function runReadableJumpArcChecks() {
  const worldPacket = buildFlatWorldPacket();
  let player = {
    position: { x: 4 * 24, y: (10 * 24) - 1 },
    velocity: { x: 0, y: 0 },
    grounded: true,
    falling: false,
    rising: false,
    landed: false,
  };

  const jumpStart = stepRuntimePlayerSimulation(worldPacket, player, { input: { moveX: 0, jump: true } });
  assert.equal(jumpStart.ok, true);
  assert.equal(jumpStart.player.rising, true);
  assert.equal(jumpStart.player.velocity.y, RUNTIME_PLAYER_PHYSICS_BASELINE.jumpVelocityY + RUNTIME_PLAYER_PHYSICS_BASELINE.gravityY);

  player = jumpStart.player;
  let sawRising = player.rising === true;
  let sawFalling = false;
  let firstFallingTick = null;
  for (let tick = 1; tick <= 50; tick += 1) {
    const step = stepRuntimePlayerSimulation(worldPacket, player, { input: { moveX: 0, jump: false } });
    assert.equal(step.ok, true);
    player = step.player;
    sawRising = sawRising || player.rising === true;

    if (player.falling === true && firstFallingTick === null) {
      firstFallingTick = tick;
    }

    sawFalling = sawFalling || player.falling === true;

    if (player.grounded === true && sawFalling) {
      break;
    }
  }

  assert.equal(sawRising, true, "expected readable rising phase");
  assert.equal(sawFalling, true, "expected readable falling phase");
  assert.equal(firstFallingTick >= 14, true, `expected slower jump apex, got falling at tick ${firstFallingTick}`);
}

function runOutOfBoundsRespawnChecks() {
  const worldPacket = buildFlatWorldPacket();
  // Disable hard world-bottom clamp so the dedicated out-of-bounds respawn path can trigger.
  worldPacket.world.height = null;
  worldPacket.layers.tiles = [];
  worldPacket.tileBounds = { maxY: 8 };

  const outOfBoundsPlayer = {
    position: { x: 9 * 24, y: 999 },
    velocity: { x: 0, y: 6 },
    grounded: false,
    falling: true,
    rising: false,
    landed: false,
  };

  const step = stepRuntimePlayerSimulation(worldPacket, outOfBoundsPlayer, { input: { moveX: 0, jump: false } });
  assert.equal(step.ok, true);
  assert.equal(step.status, "respawned-out-of-bounds");
  assert.equal(step.player.position.x, worldPacket.spawn.x);
  assert.equal(step.player.position.y, worldPacket.spawn.y);
}

runBaselineConstantChecks();
runHorizontalControlChecks();
runReadableJumpArcChecks();
runOutOfBoundsRespawnChecks();

console.log("recharged-runtime-player-feel-checks: ok");
