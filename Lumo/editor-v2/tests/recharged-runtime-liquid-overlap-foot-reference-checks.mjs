import assert from "node:assert/strict";

import { stepRuntimePlayerSimulation } from "../src/runtime/stepRuntimePlayerSimulation.js";

function buildWorldPacket() {
  return {
    world: { width: 20, height: 30, tileSize: 24 },
    layers: { tiles: [] },
    spawn: { x: 96, y: 503 },
    tileBounds: { maxY: 28 },
  };
}

function buildInstantDeathLiquid({ y0 = 504, depth = 24, instantDeath = true } = {}) {
  return {
    id: "liquid-1",
    type: "bubbling_liquid_volume",
    active: true,
    x: 0,
    y: y0,
    params: {
      area: { x0: 0, x1: 240, y0, depth },
      hazard: { instantDeath },
    },
  };
}

function buildBasePlayer() {
  return {
    position: { x: 96, y: 503 },
    velocity: { x: 0, y: 0 },
    grounded: true,
    falling: false,
    rising: false,
    landed: false,
  };
}

const worldPacket = buildWorldPacket();

// Raw y is above the liquid top, but gameplay foot probe (y + 1) is inside.
const footInsideStep = stepRuntimePlayerSimulation(worldPacket, buildBasePlayer(), {
  input: { moveX: 0, jump: false },
  entities: [buildInstantDeathLiquid({ y0: 504, depth: 24, instantDeath: true })],
});
assert.equal(footInsideStep.ok, true);
assert.equal(footInsideStep.player.status, "liquid-death");

const aboveLiquidStep = stepRuntimePlayerSimulation(worldPacket, {
  ...buildBasePlayer(),
  position: { x: 96, y: 470 },
}, {
  input: { moveX: 0, jump: false },
  entities: [buildInstantDeathLiquid({ y0: 504, depth: 24, instantDeath: true })],
});
assert.equal(aboveLiquidStep.ok, true);
assert.notEqual(aboveLiquidStep.player.status, "liquid-death");

const nonHazardStep = stepRuntimePlayerSimulation(worldPacket, buildBasePlayer(), {
  input: { moveX: 0, jump: false },
  entities: [buildInstantDeathLiquid({ y0: 504, depth: 24, instantDeath: false })],
});
assert.equal(nonHazardStep.ok, true);
assert.notEqual(nonHazardStep.player.status, "liquid-death");

const nonLiquidStep = stepRuntimePlayerSimulation(worldPacket, {
  ...buildBasePlayer(),
  position: { x: 96, y: 200 },
  grounded: false,
  falling: true,
}, {
  input: { moveX: 1, jump: false },
  entities: [],
});
assert.equal(nonLiquidStep.ok, true);
assert.equal(nonLiquidStep.player.status !== "liquid-death", true);

console.log("recharged-runtime-liquid-overlap-foot-reference-checks: ok");
