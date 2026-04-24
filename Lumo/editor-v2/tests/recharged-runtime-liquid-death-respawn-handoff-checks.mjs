import assert from "node:assert/strict";

import { stepRuntimePlayerSimulation } from "../src/runtime/stepRuntimePlayerSimulation.js";

function buildWorldPacket() {
  return {
    world: { width: 20, height: null, tileSize: 24 },
    layers: { tiles: [] },
    spawn: { x: 96, y: 503 },
    tileBounds: { maxY: 18 },
  };
}

function buildInstantDeathLiquid() {
  return {
    id: "liquid-1",
    type: "bubbling_liquid_volume",
    active: true,
    x: 0,
    y: 504,
    params: {
      area: { x0: 0, x1: 240, y0: 504, depth: 96 },
      hazard: { instantDeath: true },
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
    lives: 4,
  };
}

function advanceUntilRespawnPending({ worldPacket, entities, maxTicks = 180 } = {}) {
  let player = buildBasePlayer();
  let firstPendingStep = null;
  let firstPendingTick = -1;

  for (let tick = 0; tick < maxTicks; tick += 1) {
    const step = stepRuntimePlayerSimulation(worldPacket, player, {
      input: { moveX: 0, jump: false },
      entities,
    });
    assert.equal(step.ok, true);
    player = step.player;

    if (player.status === "respawn-pending") {
      firstPendingStep = step;
      firstPendingTick = tick;
      break;
    }
  }

  assert.notEqual(firstPendingStep, null, "liquid death should eventually hand off into respawn-pending state");
  return { player, firstPendingStep, firstPendingTick };
}

{
  const worldPacket = buildWorldPacket();
  const entities = [buildInstantDeathLiquid()];
  const { player: pendingPlayer, firstPendingStep } = advanceUntilRespawnPending({ worldPacket, entities });

  // 1) Completed liquid death must start countdown exactly once on the liquid-owned path.
  assert.equal(firstPendingStep.player.respawnCountdown?.active, true, "liquid death handoff must activate respawn countdown");
  assert.equal(firstPendingStep.player.respawnCountdown?.countdown, 3, "liquid death handoff must expose full 3-second countdown");
  assert.equal(firstPendingStep.player.lives, 3, "liquid death handoff must decrement lives immediately");
  assert.equal(String(firstPendingStep.player.respawnCountdown?.source || "").startsWith("liquid-"), true, "liquid death handoff must own respawn source");

  // 2) During handoff/countdown, liquid death must not retrigger.
  let player = pendingPlayer;
  for (let i = 0; i < 12; i += 1) {
    const step = stepRuntimePlayerSimulation(worldPacket, player, {
      input: { moveX: 0, jump: false },
      entities,
    });
    assert.equal(step.ok, true);
    assert.equal(step.player.status, "respawn-pending", "countdown ticks should stay in respawn-pending instead of retriggering liquid-death");
    assert.equal(step.player.respawnCountdown?.active, true, "countdown should stay active during pending ticks");
    assert.equal(step.player.status !== "liquid-death", true, "liquid-death must not retrigger during pending handoff/countdown");

    // 3) Bottom/out-of-bounds must not steal ownership after liquid completion.
    assert.equal(String(step.player.respawnCountdown?.source || "").startsWith("liquid-"), true, "pending countdown source must remain liquid-owned");

    // 4) Player must not resume ordinary falling while pending countdown owns state.
    assert.equal(step.player.falling, false, "pending countdown should freeze ordinary falling");
    player = step.player;
  }
}

{
  // 5) Non-liquid out-of-bounds respawn flow must remain intact.
  const worldPacket = buildWorldPacket();
  let player = {
    ...buildBasePlayer(),
    position: { x: 96, y: 503 },
    grounded: false,
    falling: true,
    velocity: { x: 0, y: 1200 },
    lives: 4,
  };

  let pendingStep = null;
  for (let tick = 0; tick < 32; tick += 1) {
    const step = stepRuntimePlayerSimulation(worldPacket, player, {
      input: { moveX: 0, jump: false },
      entities: [],
    });
    assert.equal(step.ok, true);
    player = step.player;
    if (step.player.status === "respawn-pending") {
      pendingStep = step;
      break;
    }
  }

  assert.notEqual(pendingStep, null, "non-liquid out-of-bounds should still enter pending respawn");
  assert.equal(pendingStep.player.respawnCountdown?.active, true, "non-liquid out-of-bounds should still activate countdown");
  assert.equal(pendingStep.player.respawnCountdown?.source, "authored-spawn", "non-liquid out-of-bounds should keep authored-spawn source");
  assert.equal(pendingStep.player.lives, 3, "non-liquid out-of-bounds should still decrement one life");
  const expectedMaxFallDistance = (worldPacket.world.tileSize || 24) * 2;
  assert.ok(
    pendingStep.debug?.vertical?.fallTracking?.fallDistance >= expectedMaxFallDistance,
    "non-liquid out-of-bounds should trigger once tracked death-fall distance reaches about 2 tiles",
  );
}

{
  // 6) Normal in-bounds movement should not arm death-fall tracking.
  const worldPacket = buildWorldPacket();
  const step = stepRuntimePlayerSimulation(worldPacket, {
    ...buildBasePlayer(),
    position: { x: 96, y: 200 },
    grounded: false,
    rising: true,
    falling: false,
    velocity: { x: 0, y: -220 },
  }, {
    input: { moveX: 0, jump: false },
    entities: [],
  });
  assert.equal(step.ok, true);
  assert.equal(step.player.status === "respawn-pending", false, "normal in-bounds jumps should not trigger respawn");
  assert.equal(step.debug?.vertical?.fallTracking?.active === true, false, "normal in-bounds jumps should not start hazard fall tracking");
}

{
  // 7) Authored lower hazard volume top must win over deepest support-derived bottoms.
  const tileSize = 24;
  const worldPacket = {
    world: { width: 40, height: null, tileSize },
    layers: {
      tiles: [
        { x: 0, y: 2, w: 10, h: 1, coordinateSpace: "grid" },
        { x: 0, y: 2000, w: 1, h: 1, coordinateSpace: "world" },
      ],
    },
    spawn: { x: 96, y: 70 },
    tileBounds: { maxY: 2000 },
  };
  let player = {
    ...buildBasePlayer(),
    position: { x: 96, y: 118 },
    grounded: false,
    falling: true,
    velocity: { x: 0, y: 400 },
  };
  const entities = [{
    id: "hazard-volume-top",
    type: "bubbling_liquid_volume",
    active: true,
    x: 0,
    y: 120,
    params: {
      area: { x0: 0, x1: 240, y0: 120, depth: 300 },
      hazard: { instantDeath: true },
    },
  }];

  let armedStep = null;
  for (let tick = 0; tick < 20; tick += 1) {
    const step = stepRuntimePlayerSimulation(worldPacket, player, {
      input: { moveX: 0, jump: false },
      entities,
    });
    assert.equal(step.ok, true);
    if (step.debug?.vertical?.fallTracking?.active === true) {
      armedStep = step;
      break;
    }
    player = step.player;
  }

  assert.notEqual(armedStep, null, "hazard fall tracking should arm near volume top, not at deepest support/world bottom");
  assert.equal(armedStep.debug?.vertical?.fallTracking?.deathPlaneSource, "authored-hazard-volume-top", "death plane should prefer authored hazard volume top");
  assert.equal(armedStep.debug?.vertical?.fallTracking?.deathPlaneY, 120, "deathPlaneY should match authored volume top");
  assert.equal(armedStep.debug?.vertical?.fallTracking?.effectiveDeathPlaneY, 132, "effectiveDeathPlaneY should include +0.5 tile arm offset");
  assert.equal(armedStep.debug?.vertical?.fallTracking?.supportBottomY, null, "authored volume priority should not require support-bottom fallback");
}

console.log("recharged-runtime-liquid-death-respawn-handoff-checks: ok");
