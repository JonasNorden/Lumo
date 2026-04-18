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

function createSessionWithEntities(entities) {
  const levelDocument = loadFixtureLevelDocument();
  levelDocument.layers = levelDocument.layers && typeof levelDocument.layers === "object" ? levelDocument.layers : {};
  levelDocument.layers.entities = entities;
  const session = createRuntimeGameSession({ levelDocument });
  assert.equal(session.start().ok, true, "expected session start");
  return { session, levelDocument };
}

function runPulseDissolveChecks() {
  const level = loadFixtureLevelDocument();
  const spawnX = Number.isFinite(level?.world?.spawn?.x) ? level.world.spawn.x : 64;
  const spawnY = Number.isFinite(level?.world?.spawn?.y) ? level.world.spawn.y : 256;
  const { session } = createSessionWithEntities([
    { id: "dark-pulse", type: "dark_creature_01", x: spawnX + 8, y: spawnY - 24, params: { hp: 1 } },
  ]);

  session.tick({});
  session.tick({ pulse: true });
  const pulseHitSnapshot = session.getPlayerSnapshot();
  const dark = pulseHitSnapshot.entities[0];
  assert.equal(dark.dying, true, "expected pulse kill to start dissolve instead of instant removal");
  assert.equal(dark.active, true, "expected dissolving dark creature to remain active during dissolve");

  let dissolved = false;
  for (let i = 0; i < 120; i += 1) {
    session.tick({ pulse: false });
    const next = session.getPlayerSnapshot().entities[0];
    if (next && next.active !== true) {
      dissolved = true;
      break;
    }
  }
  assert.equal(dissolved, true, "expected dark creature to deactivate after dissolve duration");
}

function runCastChargeProjectileChecks() {
  const level = loadFixtureLevelDocument();
  const spawnX = Number.isFinite(level?.world?.spawn?.x) ? level.world.spawn.x : 64;
  const spawnY = Number.isFinite(level?.world?.spawn?.y) ? level.world.spawn.y : 256;
  const { session } = createSessionWithEntities([
    {
      id: "dark-caster",
      type: "dark_creature_01",
      x: spawnX + 32,
      y: spawnY - 24,
      params: {
        hp: 3,
        aggroTiles: 10,
        castCooldown: 0,
        castChargeTime: 0.08,
        targetJitterPx: 0,
        spellSpeedX: 190,
        spellGravity: 760,
      },
    },
  ]);

  session.tick({});
  session.tick({});
  const chargeSnapshot = session.getPlayerSnapshot();
  const chargingCreature = chargeSnapshot.entities[0];
  assert.equal(chargingCreature.castChargeT > 0, true, "expected cast charge to start when player is in aggro range");

  let spawnedProjectile = false;
  for (let i = 0; i < 40; i += 1) {
    session.tick({});
    const snapshot = session.getPlayerSnapshot();
    if (Array.isArray(snapshot.darkProjectiles) && snapshot.darkProjectiles.length > 0) {
      spawnedProjectile = true;
      break;
    }
  }
  assert.equal(spawnedProjectile, true, "expected charged cast to spawn a dark spell projectile");
}

function runSameTickProjectileSurvivalChecks() {
  const level = loadFixtureLevelDocument();
  const spawnX = Number.isFinite(level?.world?.spawn?.x) ? level.world.spawn.x : 64;
  const spawnY = Number.isFinite(level?.world?.spawn?.y) ? level.world.spawn.y : 256;
  const { session } = createSessionWithEntities([
    {
      id: "dark-same-tick",
      type: "dark_creature_01",
      x: spawnX + 40,
      y: spawnY - 24,
      params: {
        hp: 3,
        aggroTiles: 12,
        castCooldown: 0,
        castChargeTime: 0.05,
        targetJitterPx: 0,
        spellSpeedX: 180,
        spellGravity: 760,
      },
    },
  ]);

  session.tick({});

  let firstSpawnedProjectile = null;
  for (let i = 0; i < 40 && !firstSpawnedProjectile; i += 1) {
    session.tick({});
    const snapshot = session.getPlayerSnapshot();
    if (Array.isArray(snapshot.darkProjectiles) && snapshot.darkProjectiles.length > 0) {
      firstSpawnedProjectile = snapshot.darkProjectiles[0];
    }
  }

  assert.ok(firstSpawnedProjectile, "expected dark creature to spawn at least one projectile");
  assert.equal(firstSpawnedProjectile.age, 0, "expected freshly spawned projectile age to be 0 on spawn tick");

  const spawnedProjectileId = firstSpawnedProjectile.id;
  session.tick({});
  const oneTickLaterSnapshot = session.getPlayerSnapshot();
  const oneTickLaterProjectile = oneTickLaterSnapshot.darkProjectiles.find((projectile) => projectile.id === spawnedProjectileId);

  assert.ok(oneTickLaterProjectile, "expected spawned projectile to survive into next tick");
  assert.equal(oneTickLaterProjectile.age > 0, true, "expected spawned projectile to start aging after surviving spawn tick");
}

function runBodyContactDamageChecks() {
  const level = loadFixtureLevelDocument();
  const spawnX = Number.isFinite(level?.world?.spawn?.x) ? level.world.spawn.x : 64;
  const spawnY = Number.isFinite(level?.world?.spawn?.y) ? level.world.spawn.y : 256;
  const { session } = createSessionWithEntities([
    {
      id: "dark-contact",
      type: "dark_creature_01",
      x: spawnX - 2,
      y: spawnY - 24,
      params: {
        hp: 3,
        aggroTiles: 0,
        bodyEnergyLoss: 20,
        bodyKnockbackX: 160,
        bodyKnockbackY: -140,
        hitCooldown: 0.6,
      },
    },
  ]);

  const before = session.getPlayerSnapshot();
  session.tick({});
  session.tick({});
  const after = session.getPlayerSnapshot();
  assert.equal(after.energy < before.energy, true, "expected body contact to reduce player energy");
  assert.equal(Math.abs(after.velocity.x) > 0, true, "expected body contact knockback on x");
  assert.equal(after.velocity.y < 0, true, "expected body contact knockback on y");
}

function runSafeDelayStateChecks() {
  const level = loadFixtureLevelDocument();
  const spawnX = Number.isFinite(level?.world?.spawn?.x) ? level.world.spawn.x : 64;
  const spawnY = Number.isFinite(level?.world?.spawn?.y) ? level.world.spawn.y : 256;
  const { session } = createSessionWithEntities([
    {
      id: "dark-safe",
      type: "dark_creature_01",
      x: spawnX + 90,
      y: spawnY - 24,
      isDarkActive: false,
      _dangerT: 0.1,
      params: { hp: 3, safeDelay: 0.1, aggroTiles: 0 },
    },
  ]);

  session.tick({});
  session.tick({});
  const graceSnapshot = session.getPlayerSnapshot();
  assert.equal(graceSnapshot.entities[0].isDarkActive, false, "expected safeDelay grace to keep dark-active disabled");

  for (let i = 0; i < 12; i += 1) {
    session.tick({});
  }
  const activeSnapshot = session.getPlayerSnapshot();
  assert.equal(activeSnapshot.entities[0].isDarkActive, true, "expected dark-active to return after safeDelay expires");
}

runPulseDissolveChecks();
runCastChargeProjectileChecks();
runSameTickProjectileSurvivalChecks();
runBodyContactDamageChecks();
runSafeDelayStateChecks();
console.log("recharged dark creature runtime checks ok");
