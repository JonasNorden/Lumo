import assert from "node:assert/strict";

import { stepRuntimePlayerSimulation } from "../../Lumo/editor-v2/src/runtime/stepRuntimePlayerSimulation.js";
import { createLumoRechargedBootAdapter } from "../../Lumo/editor-v2/src/runtime/createLumoRechargedBootAdapter.js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixtureLevelPath = resolve(__dirname, "..", "..", "Lumo", "editor-v2", "src", "data", "testLevelDocument.v1.json");

function buildFlatWorldPacket() {
  const width = 40;
  const height = 16;
  const tileSize = 24;
  return {
    world: { width, height, tileSize },
    layers: {
      tiles: [{ x: 0, y: height - 1, w: width, h: 1, solid: true, coordinateSpace: "grid" }],
      entities: [],
    },
    spawn: { x: 6 * tileSize, y: (height - 2) * tileSize - 1 },
    tileBounds: { maxY: height - 1 },
  };
}

function stepWith(worldPacket, player, entities, input = { moveX: 0, jump: false }) {
  const step = stepRuntimePlayerSimulation(worldPacket, player, { input, entities });
  assert.equal(step.ok, true, "expected runtime step to succeed");
  return step;
}

function getHover(entities, id = "hover-void") {
  const hover = Array.isArray(entities) ? entities.find((entity) => entity?.id === id) : null;
  assert.ok(hover, `expected hover entity '${id}'`);
  return hover;
}

function countTinyAlternatingDeltas(samples, axis = "x", epsilon = 0.06) {
  const deltas = [];
  for (let i = 1; i < samples.length; i += 1) {
    const prev = Number.isFinite(samples[i - 1]?.[axis]) ? samples[i - 1][axis] : 0;
    const next = Number.isFinite(samples[i]?.[axis]) ? samples[i][axis] : 0;
    deltas.push(next - prev);
  }

  let alternatingTinyDeltas = 0;
  for (let i = 1; i < deltas.length; i += 1) {
    const previousDelta = deltas[i - 1];
    const nextDelta = deltas[i];
    const oppositeDirections = Math.sign(previousDelta) !== 0 && Math.sign(nextDelta) !== 0 && Math.sign(previousDelta) !== Math.sign(nextDelta);
    const bothTiny = Math.abs(previousDelta) <= epsilon && Math.abs(nextDelta) <= epsilon;
    if (oppositeDirections && bothTiny) {
      alternatingTinyDeltas += 1;
    }
  }
  return alternatingTinyDeltas;
}

function minPairDistance(entities, ids) {
  const selected = ids.map((id) => getHover(entities, id));
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < selected.length; i += 1) {
    for (let j = i + 1; j < selected.length; j += 1) {
      const a = selected[i];
      const b = selected[j];
      const aw = Number.isFinite(a.w) ? a.w : (Number.isFinite(a.footprintW) ? a.footprintW : (Number.isFinite(a.size) ? a.size : 24));
      const ah = Number.isFinite(a.h) ? a.h : (Number.isFinite(a.footprintH) ? a.footprintH : (Number.isFinite(a.size) ? a.size : 24));
      const bw = Number.isFinite(b.w) ? b.w : (Number.isFinite(b.footprintW) ? b.footprintW : (Number.isFinite(b.size) ? b.size : 24));
      const bh = Number.isFinite(b.h) ? b.h : (Number.isFinite(b.footprintH) ? b.footprintH : (Number.isFinite(b.size) ? b.size : 24));
      const acx = a.x + aw * 0.5;
      const acy = a.y + ah * 0.5;
      const bcx = b.x + bw * 0.5;
      const bcy = b.y + bh * 0.5;
      min = Math.min(min, Math.hypot(bcx - acx, bcy - acy));
    }
  }
  return min;
}

function runHoverVoidFocusedRuntimeChecks() {
  const worldPacket = buildFlatWorldPacket();
  const tileSize = worldPacket.world.tileSize;
  const spawnX = worldPacket.spawn.x;
  const spawnY = worldPacket.spawn.y;

  let player = {
    position: { x: spawnX, y: spawnY },
    velocity: { x: 0, y: 0 },
    grounded: true,
    falling: false,
    rising: false,
    landed: false,
  };

  let entities = [
    {
      id: "hover-void",
      type: "hover_void_01",
      x: spawnX + tileSize * 2,
      y: spawnY - tileSize,
      awake: false,
      sleepBlend: 1,
      eyeBlend: 0,
      _wakeHold: 0,
      _isFollowing: false,
      params: {
        aggroTiles: 3,
        followTiles: 5,
        loseSightTiles: 6,
      },
    },
  ];

  // Wake in aggro range and engage follow.
  let step = stepWith(worldPacket, player, entities);
  player = step.player;
  entities = step.player.entities;
  let hover = getHover(entities);
  assert.equal(hover.awake, true, "hover_void should wake when player enters aggro range");
  assert.equal(hover._isFollowing, true, "hover_void should engage follow in follow range");

  const wakeHoldAfterWake = hover._wakeHold;
  const eyeAfterWake = hover.eyeBlend;
  const sleepAfterWake = hover.sleepBlend;

  // Move player outside immediate aggro radius but still within lose radius.
  player = {
    ...player,
    position: { ...player.position, x: hover.x + tileSize * 5.4 },
    velocity: { x: 0, y: 0 },
  };
  step = stepWith(worldPacket, player, entities);
  player = step.player;
  entities = step.player.entities;
  hover = getHover(entities);
  assert.equal(hover.awake, true, "_wakeHold should retain awake state after leaving immediate aggro range");
  assert.equal(hover._wakeHold > 0, true, "_wakeHold should stay positive while inside lose-sight radius");
  assert.equal(hover._wakeHold >= wakeHoldAfterWake - 0.05, true, "_wakeHold should not collapse immediately when still near player");

  // Force lose-sight failure to disengage following.
  player = {
    ...player,
    position: { ...player.position, x: hover.x + tileSize * 9.5 },
    velocity: { x: 0, y: 0 },
  };
  step = stepWith(worldPacket, player, entities);
  player = step.player;
  entities = step.player.entities;
  hover = getHover(entities);
  assert.equal(hover._isFollowing, false, "hover_void should disengage follow when lose-sight conditions fail");

  // Re-enter follow range, then verify chase movement changes world position over ticks.
  player = {
    ...player,
    position: { ...player.position, x: hover.x + tileSize * 4, y: hover.y + tileSize * 0.2 },
    velocity: { x: 0, y: 0 },
  };
  step = stepWith(worldPacket, player, entities);
  player = step.player;
  entities = step.player.entities;
  hover = getHover(entities);
  assert.equal(hover._isFollowing, true, "hover_void should re-engage follow after player returns to follow range");

  const chaseStartX = hover.x;
  const chaseStartY = hover.y;
  for (let index = 0; index < 24; index += 1) {
    step = stepWith(worldPacket, player, entities);
    player = step.player;
    entities = step.player.entities;
  }
  hover = getHover(entities);
  const chaseDistance = Math.hypot(hover.x - chaseStartX, hover.y - chaseStartY);
  assert.equal(chaseDistance > 0.5, true, `expected chase movement to change hover position over ticks (distance=${chaseDistance.toFixed(2)})`);

  // Returned runtime entities should carry live-updated hover fields.
  assert.equal(typeof hover.awake, "boolean", "awake should be present in returned runtime entity");
  assert.equal(typeof hover.sleepBlend, "number", "sleepBlend should be present in returned runtime entity");
  assert.equal(typeof hover.eyeBlend, "number", "eyeBlend should be present in returned runtime entity");
  assert.equal(typeof hover._wakeHold, "number", "_wakeHold should be present in returned runtime entity");
  assert.equal(typeof hover._isFollowing, "boolean", "_isFollowing should be present in returned runtime entity");
  assert.equal(hover.eyeBlend > eyeAfterWake || hover.sleepBlend !== sleepAfterWake, true, "hover blends should continue updating tick-to-tick");

  // Movement-quality focused checks: verify the tuning pass keeps meaningful momentum.
  player = {
    ...player,
    position: { ...player.position, x: hover.x + tileSize * 4.8, y: hover.y - tileSize * 0.2 },
    velocity: { x: 0, y: 0 },
  };
  step = stepWith(worldPacket, player, entities);
  player = step.player;
  entities = step.player.entities.map((entity) => (entity.id === "hover-void"
    ? {
        ...entity,
        vx: 0,
        vy: 0,
        _targetVX: 0,
        _targetVY: 0,
      }
    : entity));
  hover = getHover(entities);
  assert.equal(hover.awake, true, "hover should remain awake when player is still inside lose-sight range");
  assert.equal(hover._isFollowing, true, "hover should still follow when player is in follow radius");

  const preChasePosition = { x: hover.x, y: hover.y };
  const chaseSamples = [];
  for (let index = 0; index < 24; index += 1) {
    step = stepWith(worldPacket, player, entities);
    player = step.player;
    entities = step.player.entities;
    hover = getHover(entities);
    chaseSamples.push({
      x: hover.x,
      y: hover.y,
      vx: hover.vx,
      vy: hover.vy,
    });
  }

  const chaseEnd = chaseSamples[chaseSamples.length - 1];
  const tunedChaseDistance = Math.hypot(chaseEnd.x - preChasePosition.x, chaseEnd.y - preChasePosition.y);
  // Regression guard: this path used to crawl around ~1-2px/24 ticks when motion state was not persisted.
  assert.equal(
    tunedChaseDistance > 8,
    true,
    `expected materially faster tuned movement over 24 ticks (distance=${tunedChaseDistance.toFixed(3)}px)`,
  );

  const firstSpeed = Math.hypot(chaseSamples[0].vx, chaseSamples[0].vy);
  const finalSpeed = Math.hypot(chaseEnd.vx, chaseEnd.vy);
  assert.equal(
    finalSpeed > firstSpeed + 15,
    true,
    `expected smooth velocity ramp-up across chase ticks (first=${firstSpeed.toFixed(3)}, final=${finalSpeed.toFixed(3)})`,
  );

  // Hold-radius jitter check: tiny alternating deltas should not dominate when hovering near target distance.
  player = {
    ...player,
    position: {
      x: hover.x + tileSize * 3.05,
      y: hover.y - tileSize * 0.45,
    },
    velocity: { x: 0, y: 0 },
  };
  step = stepWith(worldPacket, player, entities);
  player = step.player;
  entities = step.player.entities;
  const holdSamples = [];
  for (let index = 0; index < 48; index += 1) {
    step = stepWith(worldPacket, player, entities);
    player = step.player;
    entities = step.player.entities;
    hover = getHover(entities);
    holdSamples.push({ x: hover.x, y: hover.y, vx: hover.vx, vy: hover.vy });
  }
  const tinyAlternatingX = countTinyAlternatingDeltas(holdSamples, "x", 0.06);
  assert.equal(
    tinyAlternatingX <= 1,
    true,
    `expected hold-radius tuning to suppress tiny alternating crawl jitter (tinyAlternatingX=${tinyAlternatingX})`,
  );

  // V1 lunge/bravery/global-cooldown slice: one hover with braveGroupSize=2 should never start lunge.
  player = {
    ...player,
    energy: 1,
    position: { x: hover.x + tileSize * 1.2, y: hover.y + tileSize * 0.6 },
    velocity: { x: 0, y: 0 },
  };
  entities = [
    {
      id: "hover-brave-gated",
      type: "hover_void_01",
      x: player.position.x - tileSize * 0.45,
      y: player.position.y - tileSize * 0.95,
      awake: true,
      _isFollowing: true,
      sleepBlend: 0,
      eyeBlend: 1,
      braveGroupSize: 2,
      swarmGroupSize: 3,
      attackCooldownMin: 0.3,
      attackCooldownMax: 0.3,
      _attackCd: 0,
      _hoverVoidAttackGlobalCd: 0,
      params: { aggroTiles: 6, followTiles: 7, loseSightTiles: 11 },
    },
  ];
  for (let i = 0; i < 12; i += 1) {
    step = stepWith(worldPacket, player, entities);
    player = step.player;
    entities = step.player.entities;
  }
  hover = getHover(entities, "hover-brave-gated");
  assert.equal(hover._lungeState ?? "idle", "idle", "braveGroupSize gate should block solo hover lunge starts");

  // Two brave hovers: one can lunge, global cooldown blocks immediate simultaneous second lunge.
  player = {
    ...player,
    energy: 1,
    velocity: { x: 0, y: 0 },
    position: { x: spawnX + tileSize * 8, y: spawnY },
  };
  entities = [
    {
      id: "hover-attacker-a",
      type: "hover_void_01",
      x: player.position.x - tileSize * 0.55,
      y: player.position.y - tileSize * 1.0,
      awake: true,
      _isFollowing: true,
      sleepBlend: 0,
      eyeBlend: 1,
      braveGroupSize: 2,
      swarmGroupSize: 2,
      attackCooldownMin: 0.35,
      attackCooldownMax: 0.35,
      attackDamage: 12,
      attackPushback: 180,
      _attackCd: 0,
      params: { aggroTiles: 6, followTiles: 7, loseSightTiles: 11 },
    },
    {
      id: "hover-attacker-b",
      type: "hover_void_01",
      x: player.position.x + tileSize * 0.2,
      y: player.position.y - tileSize * 1.0,
      awake: true,
      _isFollowing: true,
      sleepBlend: 0,
      eyeBlend: 1,
      braveGroupSize: 2,
      swarmGroupSize: 2,
      attackCooldownMin: 0.35,
      attackCooldownMax: 0.35,
      attackDamage: 12,
      attackPushback: 180,
      _attackCd: 0,
      params: { aggroTiles: 6, followTiles: 7, loseSightTiles: 11 },
    },
  ];
  const energyBeforeLunge = player.energy;
  step = stepWith(worldPacket, player, entities);
  player = step.player;
  entities = step.player.entities;
  const attackerA = getHover(entities, "hover-attacker-a");
  const attackerB = getHover(entities, "hover-attacker-b");
  const activeLungeActors = [attackerA, attackerB].filter((entityState) => entityState._lungeState === "out" || entityState._lungeState === "back");
  assert.equal(activeLungeActors.length, 1, "global hover attack cooldown should allow only one immediate lunge actor");
  assert.equal(
    Number.isFinite(player._hoverVoidAttackGlobalCd) && player._hoverVoidAttackGlobalCd > 0,
    true,
    "hover lunge start should set runtime global attack cooldown",
  );

  let sawBackState = false;
  let sawReturnIdle = false;
  let sawLungeHit = false;
  for (let i = 0; i < 80; i += 1) {
    step = stepWith(worldPacket, player, entities);
    player = step.player;
    entities = step.player.entities;
    const a = getHover(entities, "hover-attacker-a");
    const b = getHover(entities, "hover-attacker-b");
    sawBackState = sawBackState || a._lungeState === "back" || b._lungeState === "back";
    sawReturnIdle = sawReturnIdle || (a._lungeState === "idle" && b._lungeState === "idle");
    sawLungeHit = sawLungeHit || a._lungeHitDone === true || b._lungeHitDone === true;
    if (sawBackState && sawReturnIdle && sawLungeHit) {
      break;
    }
  }
  assert.equal(sawBackState, true, "lunge FSM should transition through back state");
  assert.equal(sawReturnIdle, true, "lunge FSM should return to idle after back phase");
  assert.equal(sawLungeHit, true, "at least one lunge should register player collision hit");
  assert.equal(player.energy < energyBeforeLunge, true, "lunge contact should reduce player energy");

  // Runtime lunge-start check at realistic hold fringe: attack gate must allow starts beyond strict 3.5-tile clamp.
  player = {
    ...player,
    energy: 1,
    _hoverVoidAttackGlobalCd: 0,
    velocity: { x: 0, y: 0 },
    position: { x: spawnX + tileSize * 10, y: spawnY },
  };
  entities = [
    { id: "hover-lunge-a", type: "hover_void_01", x: player.position.x - tileSize * 3.8, y: player.position.y - tileSize * 0.2, awake: true, _isFollowing: true, sleepBlend: 0, eyeBlend: 1, _attackCd: 0, params: { aggroTiles: 6, followTiles: 7, loseSightTiles: 11, braveGroupSize: 2, attackCooldownMin: 0.2, attackCooldownMax: 0.2 } },
    { id: "hover-lunge-b", type: "hover_void_01", x: player.position.x - tileSize * 3.75, y: player.position.y - tileSize * 0.95, awake: true, _isFollowing: true, sleepBlend: 0, eyeBlend: 1, _attackCd: 0, params: { aggroTiles: 6, followTiles: 7, loseSightTiles: 11, braveGroupSize: 2, attackCooldownMin: 0.2, attackCooldownMax: 0.2 } },
    { id: "hover-lunge-c", type: "hover_void_01", x: player.position.x - tileSize * 3.9, y: player.position.y - tileSize * 1.4, awake: true, _isFollowing: true, sleepBlend: 0, eyeBlend: 1, _attackCd: 0, params: { aggroTiles: 6, followTiles: 7, loseSightTiles: 11, braveGroupSize: 2, attackCooldownMin: 0.2, attackCooldownMax: 0.2 } },
  ];
  let sawFringeLungeStart = false;
  for (let i = 0; i < 30; i += 1) {
    step = stepWith(worldPacket, player, entities);
    player = step.player;
    entities = step.player.entities;
    for (const id of ["hover-lunge-a", "hover-lunge-b", "hover-lunge-c"]) {
      const attacker = getHover(entities, id);
      if (attacker._lungeState === "out" || attacker._lungeState === "back") sawFringeLungeStart = true;
    }
    if (sawFringeLungeStart) break;
  }
  assert.equal(sawFringeLungeStart, true, "hover should be able to start lunge from realistic hold-fringe spacing");

  // Anti-overlap check: exact same-tile spawn should separate into readable spacing.
  player = {
    ...player,
    energy: 1,
    _hoverVoidAttackGlobalCd: 0,
    velocity: { x: 0, y: 0 },
    position: { x: spawnX + tileSize * 14, y: spawnY },
  };
  entities = [
    { id: "hover-stack-a", type: "hover_void_01", x: player.position.x - tileSize * 1.6, y: player.position.y - tileSize * 0.8, awake: true, _isFollowing: true, sleepBlend: 0, eyeBlend: 1, _attackCd: 999, params: { aggroTiles: 6, followTiles: 7, loseSightTiles: 11 } },
    { id: "hover-stack-b", type: "hover_void_01", x: player.position.x - tileSize * 1.6, y: player.position.y - tileSize * 0.8, awake: true, _isFollowing: true, sleepBlend: 0, eyeBlend: 1, _attackCd: 999, params: { aggroTiles: 6, followTiles: 7, loseSightTiles: 11 } },
    { id: "hover-stack-c", type: "hover_void_01", x: player.position.x - tileSize * 1.6, y: player.position.y - tileSize * 0.8, awake: true, _isFollowing: true, sleepBlend: 0, eyeBlend: 1, _attackCd: 999, params: { aggroTiles: 6, followTiles: 7, loseSightTiles: 11 } },
  ];
  for (let i = 0; i < 40; i += 1) {
    step = stepWith(worldPacket, player, entities);
    player = step.player;
    entities = step.player.entities;
  }
  const postSeparationMinDist = minPairDistance(entities, ["hover-stack-a", "hover-stack-b", "hover-stack-c"]);
  assert.equal(postSeparationMinDist >= tileSize * 0.42, true, `hover stack separation should prevent same-tile collapse (minDist=${postSeparationMinDist.toFixed(2)})`);
}

async function runHoverVoidLiveSnapshotChainChecks() {
  const levelDocument = JSON.parse(readFileSync(fixtureLevelPath, "utf8"));
  const spawnX = Number.isFinite(levelDocument?.world?.spawn?.x) ? levelDocument.world.spawn.x : 64;
  const spawnY = Number.isFinite(levelDocument?.world?.spawn?.y) ? levelDocument.world.spawn.y : 256;

  levelDocument.layers = levelDocument.layers && typeof levelDocument.layers === "object" ? levelDocument.layers : {};
  levelDocument.layers.entities = [
    {
      id: "hover-live-chain",
      type: "hover_void_01",
      x: spawnX + 34,
      y: spawnY - 24,
      awake: false,
      sleepBlend: 1,
      eyeBlend: 0,
      _wakeHold: 0,
      _isFollowing: false,
      params: {
        aggroTiles: 6,
        followTiles: 8,
        loseSightTiles: 11,
      },
    },
  ];

  const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: { levelDocument } });
  assert.equal((await adapter.prepare()).ok, true, "expected adapter prepare");
  assert.equal((await adapter.boot()).ok, true, "expected adapter boot");

  adapter.tick({});
  let snapshot = adapter.getPlayerSnapshot();
  let hover = getHover(snapshot.entities, "hover-live-chain");
  assert.equal(typeof hover.awake, "boolean");
  assert.equal(typeof hover.sleepBlend, "number");
  assert.equal(typeof hover.eyeBlend, "number");
  assert.equal(typeof hover._wakeHold, "number");
  assert.equal(typeof hover._isFollowing, "boolean");
  assert.equal(typeof hover._blinkT, "number");
  assert.equal(typeof hover._blinkDur, "number");
  assert.equal(typeof hover._lungeState, "string");
  assert.equal(typeof hover._attackCd, "number");
  assert.equal(typeof snapshot._hoverVoidAttackGlobalCd, "number");

  let sawWake = hover.awake === true;
  let sawFollow = hover._isFollowing === true;
  let sawWakeHoldPositive = hover._wakeHold > 0;
  let sawBlendMotion = false;

  let prevSleep = hover.sleepBlend;
  let prevEye = hover.eyeBlend;
  for (let i = 0; i < 30; i += 1) {
    adapter.tick({});
    snapshot = adapter.getPlayerSnapshot();
    hover = getHover(snapshot.entities, "hover-live-chain");
    sawWake = sawWake || hover.awake === true;
    sawFollow = sawFollow || hover._isFollowing === true;
    sawWakeHoldPositive = sawWakeHoldPositive || hover._wakeHold > 0;
    sawBlendMotion = sawBlendMotion || hover.sleepBlend !== prevSleep || hover.eyeBlend !== prevEye;
    prevSleep = hover.sleepBlend;
    prevEye = hover.eyeBlend;
  }

  assert.equal(sawWake, true, "expected hover awake field to survive/advance through adapter player snapshot chain");
  assert.equal(sawFollow, true, "expected hover _isFollowing field to survive/advance through adapter player snapshot chain");
  assert.equal(sawWakeHoldPositive, true, "expected hover _wakeHold field to survive/advance through adapter player snapshot chain");
  assert.equal(sawBlendMotion, true, "expected hover blend fields to survive/advance through adapter player snapshot chain");
  assert.equal(typeof hover._blinkT, "number", "expected hover blink timer field to survive adapter snapshot chain");
  assert.equal(typeof hover._lungeState, "string", "expected hover lunge state field to survive adapter snapshot chain");
  assert.equal(typeof snapshot._hoverVoidAttackGlobalCd, "number", "expected player global hover attack cooldown field in adapter snapshot");
}

runHoverVoidFocusedRuntimeChecks();
await runHoverVoidLiveSnapshotChainChecks();
console.log("hover void runtime contract checks ok");
