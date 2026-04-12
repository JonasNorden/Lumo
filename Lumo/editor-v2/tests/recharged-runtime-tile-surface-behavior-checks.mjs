import assert from "node:assert/strict";

import { stepRuntimePlayerSimulation } from "../src/runtime/stepRuntimePlayerSimulation.js";
import { loadLevelDocument } from "../src/runtime/loadLevelDocument.js";

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

  for (let tick = 0; tick < 6; tick += 1) {
    icePlayer = stepRuntimePlayerSimulation(iceWorld, icePlayer, { input: { moveX: 0, jump: false } }).player;
    brakePlayer = stepRuntimePlayerSimulation(brakeWorld, brakePlayer, { input: { moveX: 0, jump: false } }).player;
  }

  assert.equal(Math.abs(icePlayer.velocity.x) > 10, true, "ice should still slide after releasing input");
  assert.equal(Math.abs(brakePlayer.velocity.x) < 1, true, "brake should stop quickly after releasing input");
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
}

runSurfaceFeelChecks();
runOneWayAndHazardCollisionChecks();

console.log("recharged-runtime-tile-surface-behavior-checks: ok");
