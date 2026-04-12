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

  session.tick({ left: false, right: true, jump: false, flare: true });
  const whileHeld = session.getPlayerSnapshot();
  assert.equal(whileHeld.flares.length, 1, "expected hold to not spam flare");

  session.tick({ left: false, right: false, jump: false, flare: false });
  session.tick({ left: false, right: false, jump: false, flare: true });
  const secondPress = session.getPlayerSnapshot();
  assert.equal(secondPress.flares.length >= 2, true, "expected second flare after key release + press");

  const movedFlare = secondPress.flares[0];
  assert.equal(movedFlare.x > spawned.x, true, "expected flare to move forward each tick");

  console.log("recharged runtime flare spawn and movement ok");
}

function runFlareLifetimeCleanupChecks() {
  const session = createRuntimeGameSession({ levelDocument: loadFixtureLevelDocument() });
  assert.equal(session.start().ok, true);
  session.tick({ flare: true });
  session.tick({ flare: false });

  let sawActiveFlare = false;
  for (let index = 0; index < 90; index += 1) {
    session.tick({ flare: false });
    const snapshot = session.getPlayerSnapshot();
    if (snapshot.flares.length > 0) {
      sawActiveFlare = true;
    }
    if (sawActiveFlare && snapshot.flares.length === 0) {
      console.log("recharged runtime flare lifetime cleanup ok");
      return;
    }
  }

  assert.fail("expected flare to cleanup after lifetime");
}

function runFlareCollisionCleanupChecks() {
  const level = loadFixtureLevelDocument();
  level.layers.tiles.push({
    tileId: "ground_stone",
    x: 112,
    y: 280,
    w: 32,
    h: 64,
  });
  const session = createRuntimeGameSession({
    levelDocument: level,
  });
  assert.equal(session.start().ok, true);

  session.tick({ right: true, flare: true });
  session.tick({ flare: false });

  let collidedCleanup = false;
  for (let index = 0; index < 40; index += 1) {
    session.tick({ flare: false });
    const snapshot = session.getPlayerSnapshot();
    if (snapshot.flares.length === 0) {
      collidedCleanup = true;
      break;
    }
    const flare = snapshot.flares[0];
    assert.equal(flare.x < 156, true, "expected flare to not tunnel through blocker");
  }

  assert.equal(collidedCleanup, true, "expected flare collision cleanup");
  console.log("recharged runtime flare collision cleanup ok");
}

runFlareSpawnAndMovementChecks();
runFlareLifetimeCleanupChecks();
runFlareCollisionCleanupChecks();
