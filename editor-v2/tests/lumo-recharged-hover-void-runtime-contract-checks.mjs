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
}

runHoverVoidFocusedRuntimeChecks();
await runHoverVoidLiveSnapshotChainChecks();
console.log("hover void runtime contract checks ok");
