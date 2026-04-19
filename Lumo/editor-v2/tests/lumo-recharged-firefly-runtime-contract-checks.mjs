import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { stepRuntimePlayerSimulation } from "../src/runtime/stepRuntimePlayerSimulation.js";
import { buildRuntimePlayerStartState } from "../src/runtime/buildRuntimePlayerStartState.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function makeWorldPacket({ decor = [], spawn = { x: 5, y: 5 } } = {}) {
  return {
    spawn,
    world: {
      tileSize: 24,
      width: 64,
      height: 32,
    },
    layers: {
      tiles: [],
      entities: [],
      decor,
    },
  };
}

function makePlayerState(worldPacket, overrides = {}) {
  const start = buildRuntimePlayerStartState(worldPacket);
  const basePosition = {
    x: Number.isFinite(start?.position?.x) ? start.position.x : 120,
    y: Number.isFinite(start?.position?.y) ? start.position.y : 120,
  };
  return {
    ...start,
    position: basePosition,
    velocity: { x: 0, y: 0, ...(start?.velocity || {}) },
    energy: 1,
    flareStash: 1,
    nextFlareId: 1,
    flares: [],
    flareHeldLastTick: false,
    pulse: { active: false, r: 0, alpha: 0, thickness: 3, id: 0, x: 120, y: 120 },
    pulseHeldLastTick: false,
    boostActive: false,
    entities: [],
    darkProjectiles: [],
    nextDarkProjectileId: 1,
    _hoverVoidAttackGlobalCd: 0,
    ...overrides,
  };
}

function makeFireflyEntity(overrides = {}) {
  return {
    id: "firefly-a",
    type: "firefly_01",
    x: 120,
    y: 120,
    size: 24,
    active: true,
    alive: true,
    params: {
      lightRadius: 120,
      lightStrength: 0.8,
      aggroTiles: 6,
      flyRangeX: 5,
      flyRangeYUp: 5,
      flySpeed: 45,
      smooth: 7,
      flyTime: 1.3,
      perchSearchRadius: 6,
      cooldown: 1.0,
      fadeIn: 0.2,
      fadeOut: 0.3,
    },
    ...overrides,
  };
}

function tick(worldPacket, playerState, entities, options = {}) {
  const result = stepRuntimePlayerSimulation(worldPacket, playerState, {
    ...options,
    entities,
    input: options.input ?? {},
    deltaSeconds: options.deltaSeconds ?? 1 / 60,
  });
  assert.equal(result.ok, true, "Expected runtime tick to succeed.");
  const nextPlayer = {
    ...playerState,
    ...result.player,
    entities: result.player.entities,
    darkProjectiles: result.player.darkProjectiles,
  };
  return { result, nextPlayer, entities: result.player.entities };
}

function withFixedRandom(value, fn) {
  const saved = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = saved;
  }
}

function findFirefly(entities, id = "firefly-a") {
  const firefly = entities.find((entity) => entity.id === id);
  assert.ok(firefly, `Expected firefly '${id}' in entity snapshots.`);
  return firefly;
}

function runRestDefaultsCheck() {
  const world = makeWorldPacket();
  const player = makePlayerState(world);
  const { entities } = tick(world, player, [makeFireflyEntity()], { deltaSeconds: 1 / 60 });
  const firefly = findFirefly(entities);
  assert.equal(firefly.mode, "rest", "firefly must start in rest mode.");
  assert.equal(firefly.lightK, 0, "firefly in rest must have lightK=0.");
}

function runTriggerChecks() {
  const worldNear = makeWorldPacket({ spawn: { x: 124, y: 132 } });
  const worldFar = makeWorldPacket({ spawn: { x: 900, y: 900 } });

  const playerNear = makePlayerState(worldNear);
  const playerFar = makePlayerState(worldFar);

  const fromPlayer = tick(worldNear, playerNear, [makeFireflyEntity()], { deltaSeconds: 1 / 60 }).entities;
  assert.equal(findFirefly(fromPlayer).mode, "takeoff", "firefly must trigger from player light.");

  const lantern = {
    id: "lantern-a",
    type: "lantern_01",
    x: 128,
    y: 128,
    size: 24,
    active: true,
    alive: true,
    params: { radius: 180, strength: 0.85 },
  };
  const fromLantern = tick(worldFar, playerFar, [makeFireflyEntity(), lantern], { deltaSeconds: 1 / 60 }).entities;
  assert.equal(findFirefly(fromLantern).mode, "takeoff", "firefly must trigger from lantern light.");

  const flare = {
    id: 10,
    x: 126,
    y: 126,
    vx: 0,
    vy: 0,
    grounded: true,
    settled: true,
    bounceCount: 0,
    ttlTicks: 100,
    lifetimeTicks: 180,
    fadeLastTicks: 40,
    lightRadius: 220,
    radius: 5,
    ageTicks: 30,
  };
  const fromFlare = tick(worldFar, { ...playerFar, flares: [flare] }, [makeFireflyEntity()], { deltaSeconds: 1 / 60 }).entities;
  assert.equal(findFirefly(fromFlare).mode, "takeoff", "firefly must trigger from flare light.");

  const litFirefly = {
    ...makeFireflyEntity({ id: "firefly-lit", x: 124, y: 124 }),
    mode: "fly",
    lightK: 1,
    illuminated: true,
    active: true,
  };
  const restingFirefly = makeFireflyEntity({ id: "firefly-rest", x: 120, y: 120 });
  const fromFireflyOnly = tick(worldFar, playerFar, [litFirefly, restingFirefly], { deltaSeconds: 1 / 60 }).entities;
  assert.equal(findFirefly(fromFireflyOnly, "firefly-rest").mode, "rest", "firefly must ignore other fireflies as trigger lights.");
}

function runModeProgressionAndLightChecks() {
  const world = makeWorldPacket({
    spawn: { x: 124, y: 132 },
    decor: [{ id: "perch", x: 6, y: 6, drawW: 24, drawH: 24 }],
  });
  let player = makePlayerState(world);
  let entities = [makeFireflyEntity()];

  const observed = new Set();
  let sawRuntimeLightWhileLit = false;
  let sawTailPoints = false;

  withFixedRandom(0.5, () => {
    for (let stepIndex = 0; stepIndex < 600; stepIndex += 1) {
      const tickResult = tick(world, player, entities, { deltaSeconds: 1 / 60 });
      player = tickResult.nextPlayer;
      entities = tickResult.entities;
      const firefly = findFirefly(entities);
      observed.add(firefly.mode);
      if (Array.isArray(firefly._tail) && firefly._tail.length > 0) {
        sawTailPoints = true;
      }
      const lights = Array.isArray(player.runtimeLights) ? player.runtimeLights : [];
      if (firefly.lightK > 0.01) {
        assert.equal(lights.some((light) => light?.entityId === firefly.id && light.radius > 0 && light.strength > 0), true, "lit firefly must contribute runtime light.");
        sawRuntimeLightWhileLit = true;
      }
      if (stepIndex === 1) {
        player = { ...player, position: { x: 900, y: 900 } };
      }
    }
  });

  assert.equal(observed.has("takeoff"), true, "firefly progression should include takeoff.");
  assert.equal(observed.has("fly"), true, "firefly progression should include fly.");
  assert.equal(observed.has("landing"), true, "firefly progression should include landing.");
  assert.equal(observed.has("landed"), true, "firefly progression should include landed.");
  assert.equal(observed.has("rest"), true, "firefly progression should return to rest.");
  assert.equal(sawRuntimeLightWhileLit, true, "firefly runtime light should appear in lit modes.");
  assert.equal(sawTailPoints, true, "firefly fly mode should produce runtime tail points.");

  const finalFirefly = findFirefly(entities);
  const finalLights = Array.isArray(player.runtimeLights) ? player.runtimeLights : [];
  if (finalFirefly.mode === "rest") {
    assert.equal(finalFirefly.lightK, 0, "rested firefly must return to lightK=0.");
    assert.equal(finalLights.some((light) => light?.entityId === finalFirefly.id), false, "rested firefly should not emit runtime light.");
  }
}

function runLivePathReaderAndRenderInputsCheck() {
  const html = fs.readFileSync(path.resolve(repoRoot, "Lumo.html"), "utf8");
  assert.equal(html.includes("lightK: Number.isFinite(entity?.lightK) ? entity.lightK : 0,"), true, "Lumo.html must read firefly lightK from runtime snapshots.");
  assert.equal(html.includes("_tail: Array.isArray(entity?._tail)"), true, "Lumo.html must read firefly runtime tail from snapshots.");
  assert.equal(html.includes("const kGlow = Number.isFinite(entity?.lightK)"), true, "Lumo.html firefly visual should be driven by runtime lightK.");
  assert.equal(html.includes("const dir = Number.isFinite(entity?.dir) && entity.dir < 0 ? -1 : 1;"), true, "Lumo.html firefly visual should face from runtime dir.");
  assert.equal(html.includes("createFireflyAudioBridge"), true, "Lumo.html should construct the active Recharged firefly audio bridge.");
  assert.equal(html.includes("syncRechargedFireflyAudio(payload, state);"), true, "Lumo.html should tick firefly audio from live Recharged payloads each frame.");
  assert.equal(html.includes("FIREFLY_AUDIO_PATH"), true, "Lumo.html should use the canonical firefly asset path binding.");
}

function run() {
  runRestDefaultsCheck();
  runTriggerChecks();
  runModeProgressionAndLightChecks();
  runLivePathReaderAndRenderInputsCheck();
  console.log("lumo-recharged-firefly-runtime-contract-checks: ok");
}

run();
