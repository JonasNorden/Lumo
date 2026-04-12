import assert from "node:assert/strict";

import { RUNTIME_PLAYER_PHYSICS_BASELINE } from "../src/runtime/runtimePlayerPhysicsBaseline.js";
import { stepRuntimePlayerSimulation } from "../src/runtime/stepRuntimePlayerSimulation.js";

function buildFlatWorldPacket() {
  const width = 20;
  const height = 12;
  const tileSize = 24;
  const tiles = [
    {
      x: 0,
      y: height - 1,
      w: width,
      h: 1,
      solid: true,
      coordinateSpace: "grid",
    },
  ];

  return {
    world: { width, height, tileSize },
    layers: { tiles },
    spawn: { x: 4 * tileSize, y: (height - 2) * tileSize - 1 },
    tileBounds: { maxY: height - 1 },
  };
}

function runBaselineConstantChecks() {
  assert.deepEqual(RUNTIME_PLAYER_PHYSICS_BASELINE, {
    fixedStepMs: 16,
    groundMaxSpeedX: 230,
    groundAccelerationX: 2200,
    groundFrictionX: 2200,
    airMaxSpeedX: 230,
    airAccelerationX: 1400,
    airFrictionX: 250,
    jumpVelocityY: -720,
    gravityUpY: 1450,
    gravityDownY: 2100,
    maxFallSpeedY: 980,
    coyoteTimeSeconds: 0.11,
    jumpBufferSeconds: 0.1,
    jumpCutMultiplier: 0.55,
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
  assert.equal(distance > 40, true, `expected legacy-speed horizontal travel to exceed placeholder baseline, got ${distance}`);
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
  assert.equal(jumpStart.player.velocity.y < -650, true, `expected strong legacy jump impulse, got ${jumpStart.player.velocity.y}`);

  player = jumpStart.player;
  let sawRising = player.rising === true;
  let sawFalling = false;
  let firstFallingTick = null;
  const jumpStartY = jumpStart.player.position.y;
  let apexY = jumpStartY;
  for (let tick = 1; tick <= 50; tick += 1) {
    const holdJump = tick <= 10;
    const step = stepRuntimePlayerSimulation(worldPacket, player, { input: { moveX: 0, jump: holdJump } });
    assert.equal(step.ok, true);
    player = step.player;
    sawRising = sawRising || player.rising === true;
    apexY = Math.min(apexY, player.position.y);

    if (player.falling === true && firstFallingTick === null) {
      firstFallingTick = tick;
    }

    sawFalling = sawFalling || player.falling === true;

    if (player.grounded === true && sawFalling) {
      break;
    }
  }

  const jumpRiseDistance = jumpStartY - apexY;

  assert.equal(sawRising, true, "expected readable rising phase");
  assert.equal(sawFalling, true, "expected readable falling phase");
  assert.equal(firstFallingTick >= 14, true, `expected legacy jump hang-time, got falling at tick ${firstFallingTick}`);
  assert.equal(jumpRiseDistance >= 80, true, `expected legacy jump rise distance, got ${jumpRiseDistance.toFixed(2)}`);
}

function runGroundCollisionChecks() {
  const worldPacket = buildFlatWorldPacket();
  let player = {
    position: { x: 4 * 24, y: 3 * 24 },
    velocity: { x: 0, y: 0 },
    grounded: false,
    falling: true,
    rising: false,
    landed: false,
  };

  let landed = false;
  for (let tick = 0; tick < 120; tick += 1) {
    const step = stepRuntimePlayerSimulation(worldPacket, player, { input: { moveX: 0, jump: false } });
    assert.equal(step.ok, true);
    player = step.player;
    if (player.grounded === true) {
      landed = true;
      break;
    }
  }

  assert.equal(landed, true, "expected falling player to land on solid floor");
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
runGroundCollisionChecks();
runOutOfBoundsRespawnChecks();

console.log("recharged-runtime-player-feel-checks: ok");
