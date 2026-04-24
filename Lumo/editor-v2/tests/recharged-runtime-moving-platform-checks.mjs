import assert from "node:assert/strict";

import { stepRuntimePlayerSimulation } from "../src/runtime/stepRuntimePlayerSimulation.js";

function buildWorldPacket() {
  return {
    world: { width: 20, height: 12, tileSize: 24 },
    layers: { tiles: [], entities: [] },
    spawn: { x: 96, y: 96 },
    tileBounds: { maxY: 11 },
  };
}

function buildMovingPlatform(overrides = {}) {
  return {
    id: "mp-1",
    type: "movingPlatform",
    x: 96,
    y: 120,
    params: {
      widthTiles: 2,
      heightTiles: 1,
      direction: "right",
      distanceTiles: 3,
      speed: 70,
      loop: "pingpong",
      oneWay: true,
      carryPlayer: true,
      spriteTileId: "platform_steel_01",
    },
    ...overrides,
  };
}

function runMovementStateDerivationCheck() {
  const worldPacket = buildWorldPacket();
  const player = {
    position: { x: 96, y: 96 },
    velocity: { x: 0, y: 0 },
    grounded: false,
    falling: true,
    rising: false,
    landed: false,
  };
  const result = stepRuntimePlayerSimulation(worldPacket, player, {
    input: { moveX: 0, jump: false },
    entities: [buildMovingPlatform()],
    physics: { deltaSeconds: 1 / 60 },
    bounds: { fallRespawnMarginTiles: 999 },
  });

  const platform = result.player.entities.find((entity) => entity.id === "mp-1");
  assert.ok(platform, "moving platform should survive runtime normalization");
  assert.equal(platform.originX, 96, "originX should initialize from authored x");
  assert.equal(platform.originY, 120, "originY should initialize from authored y");
  assert.equal(platform.endX, 96 + (3 * 24), "endX should derive from direction + distanceTiles");
  assert.equal(platform.endY, 120, "endY should preserve horizontal lane for right-moving platform");
  assert.equal(platform.loop, "pingpong", "loop should retain authored pingpong mode");
}

function runPingPongAndLoopProgressionChecks() {
  const worldPacket = buildWorldPacket();
  const basePlayer = {
    position: { x: 96, y: 96 },
    velocity: { x: 0, y: 0 },
    grounded: false,
    falling: true,
    rising: false,
    landed: false,
  };

  const oneTilePingPong = buildMovingPlatform({
    params: {
      widthTiles: 2,
      heightTiles: 1,
      direction: "right",
      distanceTiles: 1,
      speed: 24,
      loop: "pingpong",
      oneWay: true,
      carryPlayer: true,
    },
  });

  const first = stepRuntimePlayerSimulation(worldPacket, basePlayer, {
    input: {},
    entities: [oneTilePingPong],
    physics: { deltaSeconds: 1 },
    bounds: { fallRespawnMarginTiles: 999 },
  });
  const firstPlatform = first.player.entities.find((entity) => entity.id === "mp-1");
  assert.equal(Math.round(firstPlatform.x), 120, "pingpong should reach endpoint after one second at 24 px/s over 24px path");

  const second = stepRuntimePlayerSimulation(worldPacket, first.player, {
    input: {},
    entities: first.player.entities,
    physics: { deltaSeconds: 1 },
    bounds: { fallRespawnMarginTiles: 999 },
  });
  const secondPlatform = second.player.entities.find((entity) => entity.id === "mp-1");
  assert.equal(Math.round(secondPlatform.x), 96, "pingpong should reverse back to origin on second second");

  const loopPlatform = buildMovingPlatform({
    params: {
      widthTiles: 2,
      heightTiles: 1,
      direction: "right",
      distanceTiles: 1,
      speed: 96,
      loop: "loop",
      oneWay: true,
      carryPlayer: true,
    },
  });
  const loopStep = stepRuntimePlayerSimulation(worldPacket, basePlayer, {
    input: {},
    entities: [loopPlatform],
    physics: { deltaSeconds: 1 },
    bounds: { fallRespawnMarginTiles: 999 },
  });
  const loopEntity = loopStep.player.entities.find((entity) => entity.id === "mp-1");
  assert.equal(Math.round(loopEntity.x), 96, "loop mode should wrap back to origin after crossing endpoint");
}

function runOneWayLandingAndPassThroughChecks() {
  const worldPacket = buildWorldPacket();
  const platform = buildMovingPlatform({
    params: {
      widthTiles: 2,
      heightTiles: 1,
      direction: "right",
      distanceTiles: 3,
      speed: 0,
      loop: "pingpong",
      oneWay: true,
      carryPlayer: true,
    },
  });

  const falling = stepRuntimePlayerSimulation(worldPacket, {
    position: { x: 108, y: 118 },
    velocity: { x: 0, y: 220 },
    grounded: false,
    falling: true,
    rising: false,
    landed: false,
  }, {
    input: { moveX: 0, jump: false },
    entities: [platform],
    bounds: { fallRespawnMarginTiles: 999 },
  });

  assert.equal(falling.player.grounded, true, "falling player should land on top of moving platform one-way surface");
  assert.equal(falling.player.position.y, 119, "landing should snap player feet to platform top - 1px");

  const jumpingUp = stepRuntimePlayerSimulation(worldPacket, {
    position: { x: 108, y: 136 },
    velocity: { x: 0, y: -220 },
    grounded: false,
    falling: false,
    rising: true,
    landed: false,
  }, {
    input: { moveX: 0, jump: false },
    entities: [platform],
    bounds: { fallRespawnMarginTiles: 999 },
  });

  assert.equal(jumpingUp.player.grounded, false, "moving platform one-way should allow passing upward from below");
}

function runCarryAndDebugChecks() {
  const worldPacket = buildWorldPacket();
  const carriedStart = {
    position: { x: 108, y: 119 },
    velocity: { x: 0, y: 0 },
    grounded: true,
    falling: false,
    rising: false,
    landed: false,
    onPlatformId: "mp-1",
  };

  const step = stepRuntimePlayerSimulation(worldPacket, carriedStart, {
    input: { moveX: 0, jump: false },
    entities: [buildMovingPlatform({ params: { widthTiles: 2, heightTiles: 1, direction: "right", distanceTiles: 3, speed: 70, loop: "pingpong", oneWay: true, carryPlayer: true } })],
    physics: { deltaSeconds: 1 / 60 },
    bounds: { fallRespawnMarginTiles: 999 },
  });

  const platform = step.player.entities.find((entity) => entity.id === "mp-1");
  assert.ok(platform.dx > 0, "platform should move forward and expose dx runtime delta");
  assert.equal(step.player.position.x > carriedStart.position.x, true, "standing player should be carried by platform delta");
  assert.equal(step.player.onPlatformId, "mp-1", "player should remain attached to platform id while standing");

  const platformDebug = step.debug?.finalized?.movingPlatforms;
  assert.equal(platformDebug?.count, 1, "debug payload should include moving platform count");
  assert.equal(platformDebug?.platforms?.[0]?.x, platform.x, "debug platform x should match live entity x");
  assert.equal(typeof platformDebug?.platforms?.[0]?.snapAppliedThisFrame, "boolean", "debug should expose per-frame landing snap state");
  assert.equal(Number.isFinite(platformDebug?.platforms?.[0]?.playerCarryDx), true, "debug should expose carry dx");
  assert.equal(Number.isFinite(platformDebug?.platforms?.[0]?.playerCarryDy), true, "debug should expose carry dy");
}

function runStableRideJitterRegressionCheck() {
  const worldPacket = buildWorldPacket();
  let player = {
    position: { x: 108, y: 119 },
    velocity: { x: 0, y: 0 },
    grounded: true,
    falling: false,
    rising: false,
    landed: false,
    onPlatformId: "mp-1",
  };
  let entities = [buildMovingPlatform({ params: { widthTiles: 2, heightTiles: 1, direction: "right", distanceTiles: 3, speed: 70, loop: "pingpong", oneWay: true, carryPlayer: true } })];

  let minFeetDelta = Number.POSITIVE_INFINITY;
  let maxFeetDelta = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < 300; index += 1) {
    const step = stepRuntimePlayerSimulation(worldPacket, player, {
      input: { moveX: 0, jump: false },
      entities,
      physics: { deltaSeconds: 1 / 60 },
      bounds: { fallRespawnMarginTiles: 999 },
    });
    player = step.player;
    entities = step.player.entities;
    const platform = entities.find((entity) => entity.id === "mp-1");
    assert.ok(platform, "moving platform should remain present throughout ride test");
    const feetY = (Number.isFinite(player.position?.y) ? player.position.y : 0) + 1;
    const delta = feetY - platform.y;
    minFeetDelta = Math.min(minFeetDelta, delta);
    maxFeetDelta = Math.max(maxFeetDelta, delta);
  }

  assert.equal(player.onPlatformId, "mp-1", "player should stay attached while idle-riding platform");
  assert.ok((maxFeetDelta - minFeetDelta) <= 0.05, "feet-to-platform delta should stay nearly constant while riding");
}

function runPingPongTurnContactRegressionCheck() {
  const worldPacket = buildWorldPacket();
  let player = {
    position: { x: 108, y: 119 },
    velocity: { x: 0, y: 0 },
    grounded: true,
    falling: false,
    rising: false,
    landed: false,
    onPlatformId: "mp-1",
  };
  let entities = [buildMovingPlatform({
    params: { widthTiles: 2, heightTiles: 1, direction: "right", distanceTiles: 1, speed: 120, loop: "pingpong", oneWay: true, carryPlayer: true },
  })];

  let sawDirectionFlip = false;
  for (let index = 0; index < 180; index += 1) {
    const step = stepRuntimePlayerSimulation(worldPacket, player, {
      input: { moveX: 0, jump: false },
      entities,
      physics: { deltaSeconds: 1 / 60 },
      bounds: { fallRespawnMarginTiles: 999 },
    });
    player = step.player;
    entities = step.player.entities;
    const platform = entities.find((entity) => entity.id === "mp-1");
    assert.ok(platform, "moving platform should remain present during pingpong turn test");
    if (platform._moveDirection === -1) {
      sawDirectionFlip = true;
    }
    assert.equal(player.onPlatformId, "mp-1", "player should keep contact over pingpong turns");
  }

  assert.equal(sawDirectionFlip, true, "test should cross at least one pingpong direction reversal");
}

runMovementStateDerivationCheck();
runPingPongAndLoopProgressionChecks();
runOneWayLandingAndPassThroughChecks();
runCarryAndDebugChecks();
runStableRideJitterRegressionCheck();
runPingPongTurnContactRegressionCheck();

console.log("recharged-runtime-moving-platform-checks: ok");
