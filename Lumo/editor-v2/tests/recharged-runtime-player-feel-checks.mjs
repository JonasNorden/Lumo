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
  const expectedFixedStepMs = 1000 / 60;
  assert.equal(Math.abs(RUNTIME_PLAYER_PHYSICS_BASELINE.fixedStepMs - expectedFixedStepMs) < 1e-9, true);

  const { fixedStepMs, ...rest } = RUNTIME_PLAYER_PHYSICS_BASELINE;
  assert.deepEqual(rest, {
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
  assert.equal(distance > 30, true, `expected readable horizontal travel, got ${distance.toFixed(2)}`);
  assert.equal(distance < 70, true, `expected normalized horizontal travel, got ${distance.toFixed(2)}`);
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

function runFallDurationChecks() {
  const worldPacket = buildFlatWorldPacket();
  let player = {
    position: { x: 4 * 24, y: 3 * 24 },
    velocity: { x: 0, y: 0 },
    grounded: false,
    falling: true,
    rising: false,
    landed: false,
  };

  let landingTick = null;
  for (let tick = 1; tick <= 120; tick += 1) {
    const step = stepRuntimePlayerSimulation(worldPacket, player, { input: { moveX: 0, jump: false } });
    assert.equal(step.ok, true);
    player = step.player;

    if (player.grounded === true) {
      landingTick = tick;
      break;
    }
  }

  assert.equal(Number.isInteger(landingTick), true, "expected fall to land on floor");
  assert.equal(landingTick >= 20, true, `expected non-hyper-fast fall duration, got ${landingTick}`);
  assert.equal(landingTick <= 45, true, `expected non-stalled fall duration, got ${landingTick}`);
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

function runBoostTriggerAndVelocityChecks() {
  const worldPacket = buildFlatWorldPacket();
  let noBoostPlayer = {
    position: { x: 4 * 24, y: (10 * 24) - 1 },
    velocity: { x: 0, y: 0 },
    grounded: true,
    falling: false,
    rising: false,
    landed: false,
    energy: 1,
    pulse: { active: false, r: 0, alpha: 0, thickness: 3, id: 0 },
    pulseHeldLastTick: false,
  };
  let boostPlayer = { ...noBoostPlayer, position: { ...noBoostPlayer.position }, velocity: { ...noBoostPlayer.velocity } };

  for (let tick = 0; tick < 12; tick += 1) {
    const noBoostStep = stepRuntimePlayerSimulation(worldPacket, noBoostPlayer, { input: { moveX: 1, jump: false, boost: false } });
    const boostStep = stepRuntimePlayerSimulation(worldPacket, boostPlayer, { input: { moveX: 1, jump: false, boost: true } });
    assert.equal(noBoostStep.ok, true);
    assert.equal(boostStep.ok, true);
    noBoostPlayer = noBoostStep.player;
    boostPlayer = boostStep.player;
  }

  assert.equal(boostPlayer.boostActive, true, "expected boost to activate while space is held and energy is available");
  assert.equal(boostPlayer.velocity.x > noBoostPlayer.velocity.x, true, "expected boosted movement to exceed normal movement speed");
  assert.equal(boostPlayer.energy < noBoostPlayer.energy, true, "expected boost to drain extra energy");
}

function runBoostHoldDurationChecks() {
  const worldPacket = buildFlatWorldPacket();
  let player = {
    position: { x: 4 * 24, y: (10 * 24) - 1 },
    velocity: { x: 0, y: 0 },
    grounded: true,
    falling: false,
    rising: false,
    landed: false,
    energy: 1,
    pulse: { active: false, r: 0, alpha: 0, thickness: 3, id: 0 },
    pulseHeldLastTick: false,
  };

  const holdStep = stepRuntimePlayerSimulation(worldPacket, player, { input: { moveX: 1, jump: false, boost: true } });
  assert.equal(holdStep.ok, true);
  assert.equal(holdStep.player.boostActive, true);
  player = holdStep.player;

  const releaseStep = stepRuntimePlayerSimulation(worldPacket, player, { input: { moveX: 1, jump: false, boost: false } });
  assert.equal(releaseStep.ok, true);
  assert.equal(releaseStep.player.boostActive, false, "expected boost to stop immediately when space is released");
}

function runBoostJumpCompatibilityChecks() {
  const worldPacket = buildFlatWorldPacket();
  const groundedPlayer = {
    position: { x: 4 * 24, y: (10 * 24) - 1 },
    velocity: { x: 0, y: 0 },
    grounded: true,
    falling: false,
    rising: false,
    landed: false,
    energy: 1,
    pulse: { active: false, r: 0, alpha: 0, thickness: 3, id: 0 },
    pulseHeldLastTick: false,
  };

  const jumpBoostStep = stepRuntimePlayerSimulation(worldPacket, groundedPlayer, { input: { moveX: 1, jump: true, boost: true } });
  assert.equal(jumpBoostStep.ok, true);
  assert.equal(jumpBoostStep.player.rising, true, "expected jump to remain functional with boost held");
  assert.equal(jumpBoostStep.player.velocity.y < 0, true, "expected upward jump velocity during boosted jump");

  const airborneBoostStep = stepRuntimePlayerSimulation(worldPacket, {
    ...jumpBoostStep.player,
    grounded: false,
    rising: false,
    falling: true,
  }, { input: { moveX: 1, jump: false, boost: true } });
  assert.equal(airborneBoostStep.ok, true);
  assert.equal(airborneBoostStep.player.boostActive, true, "expected boost to remain available in air when held");
}

function runFlareSpawnChecks() {
  const worldPacket = buildFlatWorldPacket();
  const player = {
    position: { x: 4 * 24, y: (10 * 24) - 1 },
    velocity: { x: 0, y: 0 },
    grounded: true,
    falling: false,
    rising: false,
    landed: false,
    facingX: 1,
    flares: [],
    flareStash: 2,
    energy: 1,
    flareHeldLastTick: false,
    nextFlareId: 1,
  };

  const step = stepRuntimePlayerSimulation(worldPacket, player, { input: { flare: true } });
  assert.equal(step.ok, true);
  assert.equal(Array.isArray(step.player.flares), true);
  assert.equal(step.player.flares.length, 1, "expected flare throw to spawn exactly one flare");
  assert.equal(step.player.flareStash, 1, "expected flare throw to consume one flare from stash");
}

function runFlareThrowSuppressedWhenEmptyChecks() {
  const worldPacket = buildFlatWorldPacket();
  const player = {
    position: { x: 4 * 24, y: (10 * 24) - 1 },
    velocity: { x: 0, y: 0 },
    grounded: true,
    falling: false,
    rising: false,
    landed: false,
    facingX: 1,
    flares: [],
    flareStash: 0,
    energy: 1,
    flareHeldLastTick: false,
    nextFlareId: 1,
  };

  const step = stepRuntimePlayerSimulation(worldPacket, player, { input: { flare: true } });
  assert.equal(step.ok, true);
  assert.equal(step.player.flares.length, 0, "expected empty stash to block flare throw");
  assert.equal(step.player.flareStash, 0, "expected flare stash to remain empty after blocked throw");
}

function runFlarePickupCollectionChecks() {
  const worldPacket = buildFlatWorldPacket();
  const player = {
    position: { x: 4 * 24, y: (10 * 24) - 1 },
    velocity: { x: 0, y: 0 },
    grounded: true,
    falling: false,
    rising: false,
    landed: false,
    facingX: 1,
    flares: [],
    flareStash: 0,
    energy: 1,
    flareHeldLastTick: false,
    nextFlareId: 1,
    entities: [],
  };
  const entities = [{
    id: "pickup-1",
    type: "flare_pickup_01",
    x: player.position.x - 6,
    y: player.position.y - 11,
    size: 12,
    active: true,
    alive: true,
    amount: 1,
  }];

  const pickupStep = stepRuntimePlayerSimulation(worldPacket, player, { input: { flare: false }, entities });
  assert.equal(pickupStep.ok, true);
  assert.equal(pickupStep.player.flareStash, 1, "expected pickup overlap to add one flare to stash");
  const pickupAfter = pickupStep.player.entities.find((entity) => entity.id === "pickup-1");
  assert.equal(pickupAfter?.active, false, "expected collected flare pickup to deactivate");

  const throwStep = stepRuntimePlayerSimulation(worldPacket, pickupStep.player, { input: { flare: true }, entities: pickupStep.player.entities });
  assert.equal(throwStep.ok, true);
  assert.equal(throwStep.player.flares.length, 1, "expected collected flare to be throwable");
  assert.equal(throwStep.player.flareStash, 0, "expected throw to consume collected flare stash");
}

runBaselineConstantChecks();
runHorizontalControlChecks();
runReadableJumpArcChecks();
runFallDurationChecks();
runGroundCollisionChecks();
runOutOfBoundsRespawnChecks();
runBoostTriggerAndVelocityChecks();
runBoostHoldDurationChecks();
runBoostJumpCompatibilityChecks();
runFlareSpawnChecks();
runFlareThrowSuppressedWhenEmptyChecks();
runFlarePickupCollectionChecks();

console.log("recharged-runtime-player-feel-checks: ok");
