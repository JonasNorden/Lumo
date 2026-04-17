import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createLumoRechargedBootAdapter } from "../../Lumo/editor-v2/src/runtime/createLumoRechargedBootAdapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixtureLevelPath = resolve(__dirname, "..", "..", "Lumo", "editor-v2", "src", "data", "testLevelDocument.v1.json");

function loadFixtureLevelDocument() {
  return JSON.parse(readFileSync(fixtureLevelPath, "utf8"));
}

async function runLiveDarkSnapshotChainChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const spawnX = Number.isFinite(levelDocument?.world?.spawn?.x) ? levelDocument.world.spawn.x : 64;
  const spawnY = Number.isFinite(levelDocument?.world?.spawn?.y) ? levelDocument.world.spawn.y : 256;

  levelDocument.layers = levelDocument.layers && typeof levelDocument.layers === "object" ? levelDocument.layers : {};
  levelDocument.layers.entities = [
    {
      id: "dark-live-chain",
      type: "dark_creature_01",
      x: spawnX + 32,
      y: spawnY - 24,
      params: {
        hp: 3,
        aggroTiles: 10,
        castCooldown: 0,
        castChargeTime: 0.08,
        targetJitterPx: 0,
      },
    },
    {
      id: "hover-live-chain",
      type: "hover_void_01",
      x: spawnX + 28,
      y: spawnY - 20,
      awake: true,
      sleepBlend: 0.35,
      eyeBlend: 0.7,
      _wakeHold: 1.25,
      _isFollowing: true,
      params: {
        wakeRadius: 240,
        loseRadius: 260,
        followRadius: 220,
      },
    },
  ];

  const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: { levelDocument } });
  assert.equal((await adapter.prepare()).ok, true, "expected adapter prepare");
  assert.equal((await adapter.boot()).ok, true, "expected adapter boot");

  adapter.tick({});
  adapter.tick({});

  let snapshot = adapter.getPlayerSnapshot();
  let dark = snapshot.entities.find((entity) => entity.id === "dark-live-chain");
  let hover = snapshot.entities.find((entity) => entity.id === "hover-live-chain");

  assert.ok(dark, "expected dark creature in adapter snapshot");
  assert.ok(hover, "expected hover void in adapter snapshot");

  assert.equal(Number.isFinite(dark._castCd) || dark._castCd === null, true, "expected raw _castCd field in adapter snapshot");
  assert.equal(Number.isFinite(dark._castChargeT) || dark._castChargeT === null, true, "expected raw _castChargeT field in adapter snapshot");
  assert.equal(Number.isFinite(dark._castTargetX) || dark._castTargetX === null, true, "expected raw _castTargetX field in adapter snapshot");
  assert.equal(Number.isFinite(dark._castTargetY) || dark._castTargetY === null, true, "expected raw _castTargetY field in adapter snapshot");

  assert.equal(hover.awake, true, "expected raw hover awake field in adapter snapshot");
  assert.equal(hover.sleepBlend, 0.35, "expected raw hover sleepBlend field in adapter snapshot");
  assert.equal(hover.eyeBlend, 0.7, "expected raw hover eyeBlend field in adapter snapshot");
  assert.equal(hover._wakeHold, 1.25, "expected raw hover _wakeHold field in adapter snapshot");
  assert.equal(hover._isFollowing, true, "expected raw hover _isFollowing field in adapter snapshot");

  let sawProjectile = Array.isArray(snapshot.darkProjectiles) && snapshot.darkProjectiles.length > 0;
  for (let i = 0; i < 80 && sawProjectile !== true; i += 1) {
    adapter.tick({});
    snapshot = adapter.getPlayerSnapshot();
    sawProjectile = Array.isArray(snapshot.darkProjectiles) && snapshot.darkProjectiles.length > 0;
  }

  assert.equal(sawProjectile, true, "expected darkProjectiles list to survive through live adapter snapshot chain");

  console.log("live dark snapshot chain adapter checks ok");
}

await runLiveDarkSnapshotChainChecks();
