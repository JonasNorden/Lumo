import assert from "node:assert/strict";
import { buildRuntimePlayerIntent } from "../../Lumo/editor-v2/src/runtime/buildRuntimePlayerIntent.js";
import { createRuntimeGameSession } from "../../Lumo/editor-v2/src/runtime/createRuntimeGameSession.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixtureLevelPath = resolve(__dirname, "..", "..", "Lumo", "editor-v2", "src", "data", "testLevelDocument.v1.json");

const inputWithAbilities = buildRuntimePlayerIntent({
  left: true,
  jump: true,
  flare: true,
  pulse: false,
  boost: true,
});

assert.equal(inputWithAbilities.moveX, -1, "expected left=true to map to moveX=-1");
assert.equal(inputWithAbilities.jump, true, "expected jump intent to remain true");
assert.equal(inputWithAbilities.flare, true, "expected flare intent to pass through");
assert.equal(inputWithAbilities.pulse, false, "expected pulse intent to pass through");
assert.equal(inputWithAbilities.boost, true, "expected boost intent to pass through");
console.log("recharged runtime intent passthrough ok");

const runtimeSimulationPath = resolve(__dirname, "..", "..", "Lumo", "editor-v2", "src", "runtime", "stepRuntimePlayerSimulation.js");
const runtimeSimulationSource = readFileSync(runtimeSimulationPath, "utf8");

assert.equal(
  runtimeSimulationSource.includes("boost: { supported: true, wired: false }"),
  true,
  "expected runtime player state to include boost placeholder ability",
);
console.log("recharged runtime player boost placeholder ok");

assert.equal(
  runtimeSimulationSource.includes("flare: { supported: true, wired: true"),
  true,
  "expected runtime player state to include real flare wiring",
);
console.log("recharged runtime player flare wired ok");

assert.equal(
  runtimeSimulationSource.includes("pulse: {\n          supported: true,\n          wired: true"),
  true,
  "expected runtime player state to include real pulse wiring",
);
console.log("recharged runtime player pulse wired ok");

function loadFixtureLevelDocument() {
  return JSON.parse(readFileSync(fixtureLevelPath, "utf8"));
}

function runFlareSpawnAndMovementChecks() {
  const session = createRuntimeGameSession({ levelDocument: loadFixtureLevelDocument() });
  assert.equal(session.start().ok, true, "expected flare session start");

  const noFlareBefore = session.getPlayerSnapshot();
  assert.equal(Array.isArray(noFlareBefore.flares), true);
  assert.equal(noFlareBefore.flares.length, 0, "expected no flare before pressing S");

  const firstPress = session.tick({ left: false, right: true, jump: false, flare: true });
  assert.equal(firstPress.ok, true);
  assert.equal(firstPress.stepped, true);

  const afterSpawn = session.getPlayerSnapshot();
  assert.equal(afterSpawn.flares.length, 1, "expected flare spawn on first S press");
  const spawned = afterSpawn.flares[0];
  assert.equal(spawned.x > noFlareBefore.x, true, "expected flare spawn ahead of player facing");
  assert.equal(spawned.y < noFlareBefore.y, true, "expected flare to spawn slightly above player");
  assert.equal(Number.isFinite(spawned.id), true, "expected flare id");
  assert.equal(Number.isFinite(spawned.x), true, "expected flare x");
  assert.equal(Number.isFinite(spawned.y), true, "expected flare y");
  assert.equal(Number.isFinite(spawned.vx), true, "expected flare vx to be finite");
  assert.equal(Number.isFinite(spawned.vy), true, "expected flare vy to be finite");
  assert.equal(spawned.vy < 0, true, "expected flare to start with upward impulse");

  session.tick({ left: false, right: true, jump: false, flare: true });
  const whileHeld = session.getPlayerSnapshot();
  assert.equal(whileHeld.flares.length, 1, "expected hold to not spam flare");
  assert.equal(whileHeld.flares[0].id, spawned.id, "expected same flare instance while key held");
  assert.equal(whileHeld.flares[0].x > spawned.x, true, "expected flare x to move while held");
  assert.equal(whileHeld.flares[0].y !== spawned.y, true, "expected flare y to move while held");

  session.tick({ left: false, right: false, jump: false, flare: false });
  session.tick({ left: false, right: false, jump: false, flare: true });
  const secondPress = session.getPlayerSnapshot();
  assert.equal(secondPress.flares.length >= 2, true, "expected second flare after key release + press");

  const movedFlare = secondPress.flares[0];
  assert.equal(movedFlare.x > spawned.x, true, "expected flare to move forward each tick");
  assert.equal(movedFlare.id, spawned.id, "expected original flare to persist across multiple ticks");

  const trackedFlareId = spawned.id;
  const sampledPositions = [];
  const sampledHeights = [];
  let survivedAtLeastTenTicks = false;
  for (let index = 0; index < 8; index += 1) {
    session.tick({ left: false, right: false, jump: false, flare: false });
    const snapshot = session.getPlayerSnapshot();
    const trackedFlare = snapshot.flares.find((flare) => flare.id === trackedFlareId);
    if (!trackedFlare) {
      break;
    }
    sampledPositions.push(trackedFlare.x);
    sampledHeights.push(trackedFlare.y);
  }

  assert.equal(sampledPositions.length >= 3, true, "expected spawned flare to exist across multiple ticks");
  for (let index = 1; index < sampledPositions.length; index += 1) {
    assert.equal(
      sampledPositions[index] > sampledPositions[index - 1],
      true,
      "expected flare x position to increase while flare remains active",
    );
  }
  const yRange = Math.max(...sampledHeights) - Math.min(...sampledHeights);
  assert.equal(yRange > 0, true, "expected flare arc to move across y-axis");

  for (let index = 0; index < 10; index += 1) {
    session.tick({ flare: false });
  }
  const afterTenTicks = session.getPlayerSnapshot();
  survivedAtLeastTenTicks = afterTenTicks.flares.some((flare) => flare.id === trackedFlareId);
  assert.equal(survivedAtLeastTenTicks, true, "expected spawned flare to survive at least 10 ticks");

  console.log("recharged runtime flare spawn and movement ok");
}

function runFlarePhysicsBounceSettleAndLifetimeChecks() {
  const physicsSession = createRuntimeGameSession({ levelDocument: loadFixtureLevelDocument() });
  assert.equal(physicsSession.start().ok, true);
  physicsSession.tick({ flare: true });
  physicsSession.tick({ flare: false });

  const initial = physicsSession.getPlayerSnapshot().flares[0];
  assert.equal(Number.isFinite(initial.ttlTicks), true, "expected flare to expose ttlTicks");
  assert.equal(initial.ttlTicks >= 600 && initial.ttlTicks <= 900, true, "expected long flare ttl range");

  let trackedFlare = null;
  let hitGround = false;
  let bouncedAtLeastOnce = false;
  let settled = false;
  let settledTick = null;

  for (let index = 0; index < 300; index += 1) {
    physicsSession.tick({ flare: false });
    const snapshot = physicsSession.getPlayerSnapshot();
    trackedFlare = snapshot.flares.find((flare) => flare.id === initial.id) || null;
    if (!trackedFlare) {
      break;
    }

    if (trackedFlare.bounceCount > 0) {
      hitGround = true;
      bouncedAtLeastOnce = true;
    }
    if (trackedFlare.settled === true) {
      settled = true;
      settledTick = index;
      break;
    }
  }

  assert.equal(hitGround, true, "expected flare to hit ground");
  assert.equal(bouncedAtLeastOnce, true, "expected flare to bounce at least once");
  assert.equal(settled, true, "expected flare to eventually settle");
  assert.equal(trackedFlare.grounded, true, "expected settled flare to be grounded");
  assert.equal(settledTick !== null && settledTick < 280, true, "expected settling before ttl expires");

  const lifetimeSession = createRuntimeGameSession({ levelDocument: loadFixtureLevelDocument() });
  assert.equal(lifetimeSession.start().ok, true);
  lifetimeSession.tick({ flare: true });
  lifetimeSession.tick({ flare: false });
  const lifetimeId = lifetimeSession.getPlayerSnapshot().flares[0].id;

  let flareAtTick600 = null;
  for (let index = 0; index < 600; index += 1) {
    lifetimeSession.tick({ flare: false });
    const snapshot = lifetimeSession.getPlayerSnapshot();
    flareAtTick600 = snapshot.flares.find((flare) => flare.id === lifetimeId) || null;
  }
  assert.equal(flareAtTick600 !== null, true, "expected flare to persist across long lifetime window");

  let removedAfterTtl = false;
  for (let index = 0; index < 320; index += 1) {
    lifetimeSession.tick({ flare: false });
    const snapshot = lifetimeSession.getPlayerSnapshot();
    const activeFlare = snapshot.flares.find((flare) => flare.id === lifetimeId);
    if (!activeFlare) {
      removedAfterTtl = true;
      break;
    }
  }
  assert.equal(removedAfterTtl, true, "expected flare removal after ttl");

  console.log("recharged runtime flare arc bounce settle lifetime ok");
}

runFlareSpawnAndMovementChecks();
runFlarePhysicsBounceSettleAndLifetimeChecks();

function runPulseLegacySemanticsChecks() {
  const pulseSession = createRuntimeGameSession({ levelDocument: loadFixtureLevelDocument() });
  assert.equal(pulseSession.start().ok, true, "expected pulse session start");

  const beforePulse = pulseSession.getPlayerSnapshot();
  assert.equal(beforePulse.pulse?.active === true, false, "expected pulse inactive before D");

  const firstPress = pulseSession.tick({ pulse: true });
  assert.equal(firstPress.ok, true);
  assert.equal(firstPress.stepped, true);

  const afterFirstPress = pulseSession.getPlayerSnapshot();
  assert.equal(afterFirstPress.pulse?.active, true, "expected pulse active on D tap");
  assert.equal(afterFirstPress.pulse?.id >= 1, true, "expected pulse id to increment on D tap");
  assert.equal(afterFirstPress.energy < beforePulse.energy, true, "expected pulse to consume energy");
  assert.equal(afterFirstPress.pulse?.r > 8, true, "expected pulse radius to expand immediately after start");
  assert.equal(afterFirstPress.pulse?.alpha < 0.9, true, "expected pulse alpha to start fading immediately");

  const heldPulseId = afterFirstPress.pulse.id;
  pulseSession.tick({ pulse: true });
  const whileHeld = pulseSession.getPlayerSnapshot();
  assert.equal(whileHeld.pulse?.id, heldPulseId, "expected pulse hold to not retrigger new id");

  pulseSession.tick({ pulse: false });
  pulseSession.tick({ pulse: true });
  const secondTap = pulseSession.getPlayerSnapshot();
  assert.equal(secondTap.pulse?.id > heldPulseId, true, "expected release + press to retrigger pulse");

  let pulseEndedTick = null;
  let previousRadius = secondTap.pulse.r;
  for (let index = 0; index < 90; index += 1) {
    pulseSession.tick({ pulse: false });
    const snapshot = pulseSession.getPlayerSnapshot();
    if (snapshot.pulse?.active !== true) {
      pulseEndedTick = index + 1;
      break;
    }
    assert.equal(snapshot.pulse.r > previousRadius, true, "expected pulse radius to keep expanding while active");
    previousRadius = snapshot.pulse.r;
  }
  assert.equal(pulseEndedTick !== null, true, "expected pulse to expire after a short legacy window");
  assert.equal(pulseEndedTick >= 35 && pulseEndedTick <= 55, true, "expected pulse duration to match legacy alpha fade window");

  console.log("recharged runtime pulse tap duration fade window ok");
}

runPulseLegacySemanticsChecks();
