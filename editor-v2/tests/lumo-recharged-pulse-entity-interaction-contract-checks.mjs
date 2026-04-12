import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createRuntimeGameSession } from "../../Lumo/editor-v2/src/runtime/createRuntimeGameSession.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixtureLevelPath = resolve(__dirname, "..", "..", "Lumo", "editor-v2", "src", "data", "testLevelDocument.v1.json");

function loadFixtureLevelDocument() {
  return JSON.parse(readFileSync(fixtureLevelPath, "utf8"));
}

function createLevelWithNearbyEntity() {
  const level = loadFixtureLevelDocument();
  const spawnX = Number.isFinite(level?.world?.spawn?.x) ? level.world.spawn.x : 64;
  const spawnY = Number.isFinite(level?.world?.spawn?.y) ? level.world.spawn.y : 256;
  level.layers = level.layers && typeof level.layers === "object" ? level.layers : {};
  level.layers.entities = [
    {
      id: "pulse-target-1",
      type: "dark_creature_01",
      x: spawnX + 10,
      y: spawnY + 63,
      params: { hp: 2 },
    },
  ];
  return level;
}

function runPulseEntityChecks() {
  const levelDocument = createLevelWithNearbyEntity();
  const session = createRuntimeGameSession({ levelDocument });
  assert.equal(session.start().ok, true, "expected session start");

  const before = session.getPlayerSnapshot();
  assert.equal(Array.isArray(before.entities), true, "expected entities array");
  session.tick({ pulse: false });
  const afterWarmup = session.getPlayerSnapshot();
  assert.equal(afterWarmup.entities.length, 1, "expected one runtime entity");
  const initialEntity = afterWarmup.entities[0];
  assert.equal(initialEntity.hp, 2, "expected baseline hp");

  session.tick({ pulse: true });
  const afterFirstPulse = session.getPlayerSnapshot();
  const afterFirstHitEntity = afterFirstPulse.entities[0];
  assert.equal(afterFirstHitEntity.hp, 1, "expected pulse in range to reduce hp");
  assert.equal(afterFirstHitEntity.state === "hit" || afterFirstHitEntity.state === "idle", true, "expected entity to report hit lifecycle");

  for (let i = 0; i < 6; i += 1) {
    session.tick({ pulse: false });
  }
  const duringSamePulse = session.getPlayerSnapshot();
  assert.equal(duringSamePulse.entities[0].hp, 1, "expected no duplicate hit from same pulse id");

  for (let i = 0; i < 60; i += 1) {
    session.tick({ pulse: false });
    if (session.getPlayerSnapshot().pulse?.active !== true) break;
  }

  session.tick({ pulse: true });
  const afterSecondPulse = session.getPlayerSnapshot();
  assert.equal(afterSecondPulse.entities[0].alive, false, "expected entity to be defeated after hp reaches zero");
  assert.equal(afterSecondPulse.entities[0].active, false, "expected defeated entity to be inactive");

  session.tick({ right: true, boost: true });
  session.tick({ flare: true });
  const regressionSnapshot = session.getPlayerSnapshot();
  assert.equal(Number.isFinite(regressionSnapshot.x), true, "expected movement still valid");
  assert.equal(Array.isArray(regressionSnapshot.flares), true, "expected flare contract still valid");
  assert.equal(typeof regressionSnapshot.pulse?.active, "boolean", "expected pulse contract still valid");

  console.log("recharged pulse entity interaction checks ok");
}

function runNoFallbackEntitiesInNormalModeChecks() {
  const levelDocument = loadFixtureLevelDocument();
  levelDocument.layers = levelDocument.layers && typeof levelDocument.layers === "object" ? levelDocument.layers : {};
  levelDocument.layers.entities = [];

  const session = createRuntimeGameSession({ levelDocument });
  assert.equal(session.start().ok, true, "expected session start");
  session.tick({ pulse: true });
  const snapshot = session.getPlayerSnapshot();
  assert.equal(snapshot.entities.length, 0, "expected no runtime fallback entities in normal mode");
}

function runDebugFallbackEntitiesChecks() {
  const levelDocument = loadFixtureLevelDocument();
  levelDocument.layers = levelDocument.layers && typeof levelDocument.layers === "object" ? levelDocument.layers : {};
  levelDocument.layers.entities = [];

  const session = createRuntimeGameSession({
    levelDocument,
    runtimeConfig: {
      debugEntities: true,
    },
  });
  assert.equal(session.start().ok, true, "expected debug session start");
  session.tick({ pulse: false });
  const snapshot = session.getPlayerSnapshot();
  assert.equal(snapshot.entities.length, 1, "expected debug fallback entity when runtimeConfig.debugEntities is enabled");
}

runPulseEntityChecks();
runNoFallbackEntitiesInNormalModeChecks();
runDebugFallbackEntitiesChecks();
