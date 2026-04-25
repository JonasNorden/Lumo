import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createRuntimeGameSession } from "../../Lumo/editor-v2/src/runtime/createRuntimeGameSession.js";
import { stepRuntimePlayerSimulation } from "../../Lumo/editor-v2/src/runtime/stepRuntimePlayerSimulation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixtureLevelPath = resolve(__dirname, "..", "..", "Lumo", "editor-v2", "src", "data", "testLevelDocument.v1.json");

function loadFixtureLevelDocument() {
  return JSON.parse(readFileSync(fixtureLevelPath, "utf8"));
}

function createLevelWithFlareTargets() {
  const level = loadFixtureLevelDocument();
  const spawnX = Number.isFinite(level?.world?.spawn?.x) ? level.world.spawn.x : 64;
  const spawnY = Number.isFinite(level?.world?.spawn?.y) ? level.world.spawn.y : 256;
  level.layers = level.layers && typeof level.layers === "object" ? level.layers : {};
  level.layers.entities = [
    { id: "dark-1", type: "dark_creature_01", x: spawnX + 18, y: spawnY + 63, params: { hp: 3 } },
    { id: "hover-1", type: "hover_void_01", x: spawnX + 22, y: spawnY + 63, params: { maxHp: 3 } },
    { id: "pickup-1", type: "flare_pickup_01", x: spawnX + 24, y: spawnY + 63, params: { amount: 1 } },
    { id: "decor-1", type: "painting_01", x: spawnX + 26, y: spawnY + 63, params: {} },
    { id: "other-1", type: "lantern_01", x: spawnX + 28, y: spawnY + 63, params: {} },
  ];
  return level;
}

function findEntity(snapshot, id) {
  return snapshot.entities.find((entity) => entity.id === id);
}

function runFlareFadeProjectionChecks() {
  const worldPacket = {
    world: { tileSize: 24, width: 200, height: 60, spawn: { x: 64, y: 64 } },
    layers: { tiles: [], entities: [] },
  };
  let playerState = {
    position: { x: 96, y: 96 },
    velocity: { x: 0, y: 0 },
    energy: 1,
    lives: 4,
    flareStash: 0,
    pulse: { active: false, r: 0, alpha: 0, thickness: 3, id: 0 },
    flares: [{
      id: 1,
      x: 128,
      y: 128,
      vx: 0,
      vy: 0,
      grounded: true,
      settled: true,
      bounceCount: 0,
      ttlTicks: 90,
      ageTicks: 240,
      radius: 5,
      lightRadius: 180,
      alpha: 1,
      renderRadius: 180,
      finalRadius: 180,
      lifetimeTicks: 330,
      fadeLastTicks: 125,
    }],
  };

  const before = playerState.flares[0];
  const stepped = stepRuntimePlayerSimulation(worldPacket, playerState, { inputState: {}, dt: 1 / 60 });
  const after = stepped.player.flares[0];
  assert.equal(!!after, true, "expected stepped flare to stay alive for fade snapshot checks");
  assert.equal(after.alpha < before.alpha, true, "expected flare alpha decreases near end-of-life");
  assert.equal(after.renderRadius < before.renderRadius, true, "expected flare renderRadius decreases during fade");
  assert.equal(after.finalRadius < before.finalRadius, true, "expected flare finalRadius decreases during fade");
  assert.equal(Number.isFinite(after.ttlTicks), true, "expected legacy flare ttlTicks survives runtime flare step");
  assert.equal(Number.isFinite(after.radius), true, "expected legacy flare radius survives runtime flare step");
}

function runFlareEntityChecks() {
  const session = createRuntimeGameSession({ levelDocument: createLevelWithFlareTargets() });
  assert.equal(session.start().ok, true, "expected session start");
  session.tick({});

  session.tick({ flare: true });
  let snapshot = session.getPlayerSnapshot();
  assert.equal(snapshot.flares.length > 0, true, "expected flare spawn");
  const spawnedFlare = snapshot.flares[0];
  assert.equal(spawnedFlare.lightRadius, 180, "expected recharged flare base light radius 180px");
  assert.equal(Number.isFinite(spawnedFlare.alpha), true, "expected flare alpha field");
  assert.equal(Number.isFinite(spawnedFlare.renderRadius), true, "expected flare renderRadius field");
  assert.equal(Number.isFinite(spawnedFlare.finalRadius), true, "expected flare finalRadius field");
  assert.equal(Number.isFinite(spawnedFlare.ttlTicks), true, "expected legacy flare ttlTicks field preserved");
  assert.equal(Number.isFinite(spawnedFlare.radius), true, "expected legacy flare radius field preserved");

  let dark = findEntity(snapshot, "dark-1");
  let hover = findEntity(snapshot, "hover-1");
  let pickup = findEntity(snapshot, "pickup-1");
  let decor = findEntity(snapshot, "decor-1");
  let other = findEntity(snapshot, "other-1");

  assert.equal(dark.illuminated, true, "expected dark creature illuminated by flare");
  assert.equal(hover.illuminated, false, "expected hover void to ignore flare lighting like V1");
  assert.equal(dark.consumesFlare, true, "expected dark creature to consume flare");
  assert.equal(hover.consumesFlare, false, "expected hover void not to consume flare");
  assert.equal(dark.state === "suppressed" || dark.state === "idle", true, "expected dark creature flare response state");
  assert.equal(hover.state, "idle", "expected hover void flare state to remain idle");
  assert.equal(Number.isFinite(dark.lastFlareIdHit) && dark.lastFlareIdHit > 0, true, "expected dark creature flare id tracking");
  assert.equal(hover.lastFlareIdHit, -1, "expected hover void flare id tracking to stay untouched");
  assert.equal(pickup.illuminated, false, "expected pickup to ignore flare entity interaction");
  assert.equal(decor.illuminated, false, "expected decor to ignore flare entity interaction");
  assert.equal(other.illuminated, false, "expected unrelated entity to ignore flare interaction");

  const ttlAfterSpawn = snapshot.flares[0].ttlTicks;
  session.tick({ flare: false });
  snapshot = session.getPlayerSnapshot();
  const ttlAfterConsume = snapshot.flares[0].ttlTicks;
  assert.equal((ttlAfterSpawn - ttlAfterConsume) > 1, true, "expected dark creature flare consume to drain flare over time");

  let sawExposureFade = false;
  let previousExposure = findEntity(snapshot, "dark-1").flareExposure;
  for (let i = 0; i < 140; i += 1) {
    session.tick({});
    const next = findEntity(session.getPlayerSnapshot(), "dark-1");
    if ((next.flareExposure || 0) < (previousExposure || 0)) {
      sawExposureFade = true;
      break;
    }
    previousExposure = next.flareExposure;
  }
  assert.equal(sawExposureFade, true, "expected flare exposure to evolve continuously over flare lifetime");

  runFlareFadeProjectionChecks();

  for (let i = 0; i < 800; i += 1) {
    session.tick({});
    if (session.getPlayerSnapshot().flares.length === 0) {
      break;
    }
  }
  snapshot = session.getPlayerSnapshot();
  dark = findEntity(snapshot, "dark-1");
  hover = findEntity(snapshot, "hover-1");
  assert.equal(snapshot.flares.length, 0, "expected flare to expire");
  assert.equal(hover.illuminated, false, "expected hover void to remain unaffected after flare expiry");

  const darkHpBeforePulse = dark.hp;
  const hoverHpBeforePulse = hover.hp;
  session.tick({ pulse: true });
  snapshot = session.getPlayerSnapshot();
  dark = findEntity(snapshot, "dark-1");
  hover = findEntity(snapshot, "hover-1");
  assert.equal(dark.hp < darkHpBeforePulse, true, "expected pulse behavior regression guard for dark creature");
  assert.equal(hover.hp < hoverHpBeforePulse, true, "expected pulse behavior regression guard for hover void");

  const beforeMove = session.getPlayerSnapshot();
  session.tick({ right: true, jump: true, boost: true });
  snapshot = session.getPlayerSnapshot();
  assert.equal(Number.isFinite(snapshot.x), true, "expected movement contract to remain finite");
  assert.equal(Number.isFinite(snapshot.y), true, "expected jump contract to remain finite");
  assert.equal(snapshot.x !== beforeMove.x || snapshot.y !== beforeMove.y, true, "expected playable movement/jump progression");
}

runFlareEntityChecks();
console.log("recharged flare entity interaction checks ok");
