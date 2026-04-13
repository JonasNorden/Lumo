import assert from "node:assert/strict";

import { stepRuntimePlayerSimulation } from "../src/runtime/stepRuntimePlayerSimulation.js";
import { loadLevelDocument } from "../src/runtime/loadLevelDocument.js";

const V1_PLAYER_HITBOX_HEIGHT_PX = 28;

function buildSurfaceWorldPacket(tileId) {
  const width = 14;
  const height = 8;
  const base = new Array(width * height).fill(0);
  const floorY = 5;

  for (let x = 0; x < width; x += 1) {
    base[floorY * width + x] = tileId;
  }

  const loaded = loadLevelDocument({
    meta: { id: `surface-${tileId}`, name: "surface" },
    dimensions: { width, height, tileSize: 24 },
    tiles: { base, placements: [] },
    backgrounds: { layers: [] },
    background: { base: new Array(width * height).fill(null), placements: [], materials: [], defaultMaterialId: "bg_void" },
    decor: [],
    entities: [{ id: "spawn-a", type: "player-spawn", x: 2, y: 4, visible: true, params: {} }],
    sounds: [],
    extra: {},
  });

  assert.equal(loaded.ok, true);
  return {
    world: loaded.level.world,
    layers: loaded.level.layers,
    spawn: loaded.level.world.spawn,
    tileBounds: { maxY: floorY },
  };
}

function runSurfaceFeelChecks() {
  const iceWorld = buildSurfaceWorldPacket(4);
  const brakeWorld = buildSurfaceWorldPacket(5);

  let icePlayer = {
    position: { x: iceWorld.spawn.x, y: (5 * 24) - 1 },
    velocity: { x: 0, y: 0 },
    grounded: true,
    falling: false,
    rising: false,
    landed: false,
  };

  let brakePlayer = {
    position: { x: brakeWorld.spawn.x, y: (5 * 24) - 1 },
    velocity: { x: 0, y: 0 },
    grounded: true,
    falling: false,
    rising: false,
    landed: false,
  };

  for (let tick = 0; tick < 18; tick += 1) {
    icePlayer = stepRuntimePlayerSimulation(iceWorld, icePlayer, { input: { moveX: 1, jump: false } }).player;
    brakePlayer = stepRuntimePlayerSimulation(brakeWorld, brakePlayer, { input: { moveX: 1, jump: false } }).player;
  }

  const iceSpeedBeforeRelease = Math.abs(icePlayer.velocity.x);
  const brakeSpeedBeforeRelease = Math.abs(brakePlayer.velocity.x);
  assert.equal(iceSpeedBeforeRelease > brakeSpeedBeforeRelease, true, "ice should build more speed than brake while moving");

  const iceReleaseX = icePlayer.position.x;
  for (let tick = 0; tick < 6; tick += 1) {
    icePlayer = stepRuntimePlayerSimulation(iceWorld, icePlayer, { input: { moveX: 0, jump: false } }).player;
    brakePlayer = stepRuntimePlayerSimulation(brakeWorld, brakePlayer, { input: { moveX: 0, jump: false } }).player;
  }

  assert.equal(Math.abs(icePlayer.velocity.x) > 10, true, "ice should still slide after releasing input");
  assert.equal(Math.abs(brakePlayer.velocity.x) < 1, true, "brake should stop quickly after releasing input");
  assert.equal(icePlayer.locomotion, "braking-grounded", "ice release should enter grounded brake locomotion state");

  let settleTicks = 0;
  let settleDistancePx = 0;
  let settled = false;
  let settlingPlayer = icePlayer;
  for (let tick = 0; tick < 120; tick += 1) {
    settleTicks = tick + 1;
    settlingPlayer = stepRuntimePlayerSimulation(iceWorld, settlingPlayer, { input: { moveX: 0, jump: false } }).player;
    settleDistancePx = settlingPlayer.position.x - iceReleaseX;
    if (Math.abs(settlingPlayer.velocity.x) <= 0.5) {
      settled = true;
      break;
    }
  }

  assert.equal(settled, true, "ice release should settle to rest");
  assert.equal(settleTicks <= 70, true, `ice should not overslide forever; settle ticks=${settleTicks}`);
  assert.equal(settleDistancePx > 3.5 * 24, true, `ice should still glide noticeably; distance=${settleDistancePx.toFixed(2)}px`);
  assert.equal(settleDistancePx < 6.5 * 24, true, `ice stop distance should stay near V1 short glide; distance=${settleDistancePx.toFixed(2)}px`);
}

function runOneWayAndHazardCollisionChecks() {
  const worldPacket = {
    world: { width: 10, height: 8, tileSize: 24 },
    layers: {
      tiles: [
        { tileId: 2, x: 4, y: 5, w: 1, h: 1, coordinateSpace: "grid" },
        { tileId: 3, x: 7, y: 5, w: 1, h: 1, coordinateSpace: "grid" },
      ],
    },
    spawn: { x: 4 * 24, y: 2 * 24 },
    tileBounds: { maxY: 6 },
  };

  const fallingOnOneWay = stepRuntimePlayerSimulation(worldPacket, {
    position: { x: 4 * 24, y: (5 * 24) - 2 },
    velocity: { x: 0, y: 220 },
    grounded: false,
    falling: true,
    rising: false,
    landed: false,
  }, { input: { moveX: 0, jump: false }, bounds: { fallRespawnMarginTiles: 999 } });

  assert.equal(fallingOnOneWay.player.grounded, true, "one-way should catch descending player");

  const jumpingThroughOneWay = stepRuntimePlayerSimulation(worldPacket, {
    position: { x: 4 * 24, y: (5 * 24) + 6 },
    velocity: { x: 0, y: -180 },
    grounded: false,
    falling: false,
    rising: true,
    landed: false,
  }, { input: { moveX: 0, jump: false } });

  assert.equal(jumpingThroughOneWay.player.grounded, false, "one-way should not block upward movement");

  const hazardFall = stepRuntimePlayerSimulation(worldPacket, {
    position: { x: 7 * 24, y: (5 * 24) - 6 },
    velocity: { x: 0, y: 180 },
    grounded: false,
    falling: true,
    rising: false,
    landed: false,
  }, { input: { moveX: 0, jump: false } });

  assert.equal(hazardFall.player.grounded, false, "hazard tiles should not block as solid ground");

  const solidCeilingWorldPacket = {
    world: { width: 10, height: 8, tileSize: 24 },
    layers: {
      tiles: [{ tileId: 1, x: 4, y: 3, w: 1, h: 1, coordinateSpace: "grid" }],
    },
    spawn: { x: 4 * 24, y: 5 * 24 },
    tileBounds: { maxY: 7 },
  };

  let jumpIntoSolidCeilingPlayer = {
    position: { x: 4 * 24, y: (4 * 24) + 4 },
    velocity: { x: 0, y: -600 },
    grounded: false,
    falling: false,
    rising: true,
    landed: false,
  };
  let sawSolidCeilingHit = false;
  for (let tick = 0; tick < 10; tick += 1) {
    const step = stepRuntimePlayerSimulation(solidCeilingWorldPacket, jumpIntoSolidCeilingPlayer, { input: { moveX: 0, jump: false } });
    jumpIntoSolidCeilingPlayer = step.player;
    if (step.player.status === "hit-ceiling") {
      sawSolidCeilingHit = true;
      const topY = step.player.position.y - V1_PLAYER_HITBOX_HEIGHT_PX;
      assert.equal(topY >= (3 * 24) + 24, true, "solid ceiling should clamp using V1 head/top hitbox (not foot-origin probe)");
      break;
    }
  }
  assert.equal(sawSolidCeilingHit, true, "jumping into a full solid ceiling should report head-hit collision");

  const oneWayCeilingWorldPacket = {
    world: { width: 10, height: 8, tileSize: 24 },
    layers: {
      tiles: [{ tileId: 2, x: 4, y: 3, w: 1, h: 1, coordinateSpace: "grid" }],
    },
    spawn: { x: 4 * 24, y: 5 * 24 },
    tileBounds: { maxY: 7 },
  };

  let jumpIntoOneWayFromBelowPlayer = {
    position: { x: 4 * 24, y: (4 * 24) + 4 },
    velocity: { x: 0, y: -600 },
    grounded: false,
    falling: false,
    rising: true,
    landed: false,
  };
  let oneWayMinY = jumpIntoOneWayFromBelowPlayer.position.y;
  for (let tick = 0; tick < 10; tick += 1) {
    jumpIntoOneWayFromBelowPlayer = stepRuntimePlayerSimulation(oneWayCeilingWorldPacket, jumpIntoOneWayFromBelowPlayer, { input: { moveX: 0, jump: false } }).player;
    oneWayMinY = Math.min(oneWayMinY, jumpIntoOneWayFromBelowPlayer.position.y);
  }

  assert.equal(oneWayMinY < (3 * 24) + 24, true, "one-way from below should allow upward travel");
}

function runBehaviorProfileSemanticParityChecks() {
  const worldPacket = {
    world: { width: 12, height: 10, tileSize: 24 },
    layers: {
      tiles: [
        // Intentionally conflicting legacy booleans reproduce the previous regression.
        { tileId: 1, x: 4, y: 5, w: 1, h: 1, solid: true, oneWay: false, hazard: false, behaviorProfileId: "tile.one-way.default", collisionType: "oneWay", coordinateSpace: "grid" },
        { tileId: 1, x: 8, y: 5, w: 1, h: 1, solid: true, oneWay: false, hazard: false, behaviorProfileId: "tile.hazard.default", collisionType: "hazard", coordinateSpace: "grid" },
      ],
    },
    spawn: { x: 4 * 24, y: 2 * 24 },
    tileBounds: { maxY: 8 },
  };

  const oneWayLanding = stepRuntimePlayerSimulation(worldPacket, {
    position: { x: 4 * 24, y: (5 * 24) - 2 },
    velocity: { x: 0, y: 220 },
    grounded: false,
    falling: true,
    rising: false,
    landed: false,
  }, { input: { moveX: 0, jump: false }, bounds: { fallRespawnMarginTiles: 999 } });
  assert.equal(oneWayLanding.player.grounded, true, "profile-authored one-way should still catch descending player");

  const oneWayFromBelow = stepRuntimePlayerSimulation(worldPacket, {
    position: { x: 4 * 24, y: (5 * 24) + 8 },
    velocity: { x: 0, y: -220 },
    grounded: false,
    falling: false,
    rising: true,
    landed: false,
  }, { input: { moveX: 0, jump: false }, bounds: { fallRespawnMarginTiles: 999 } });
  assert.equal(oneWayFromBelow.player.grounded, false, "profile-authored one-way must not become full solid when moving upward");

  const hazardDrop = stepRuntimePlayerSimulation(worldPacket, {
    position: { x: 8 * 24, y: (5 * 24) - 4 },
    velocity: { x: 0, y: 180 },
    grounded: false,
    falling: true,
    rising: false,
    landed: false,
  }, { input: { moveX: 0, jump: false }, bounds: { fallRespawnMarginTiles: 999 } });
  assert.equal(hazardDrop.player.grounded, false, "profile-authored hazard must remain non-blocking even if legacy flags say solid");
}

runSurfaceFeelChecks();
runOneWayAndHazardCollisionChecks();
runBehaviorProfileSemanticParityChecks();

console.log("recharged-runtime-tile-surface-behavior-checks: ok");
