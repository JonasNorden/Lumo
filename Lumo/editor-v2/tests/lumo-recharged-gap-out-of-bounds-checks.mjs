import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createRuntimeRunner } from "../src/runtime/createRuntimeRunner.js";
import { createRuntimeGameSession } from "../src/runtime/createRuntimeGameSession.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixtureLevelDocument() {
  const fixturePath = path.resolve(__dirname, "../src/data/testLevelDocument.v1.json");
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function runGapOutOfBoundsFailPathChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const runner = createRuntimeRunner({ levelDocument });

  assert.equal(runner.start().ok, true, "runner should start for recharged fail-path checks");

  const supportTiles = Array.isArray(levelDocument?.layers?.tiles) ? levelDocument.layers.tiles : [];
  const maxSupportBottom = supportTiles.reduce((maxBottom, tile) => Math.max(maxBottom, tile.y + tile.h - 1), Number.NEGATIVE_INFINITY);
  const tileSize = levelDocument?.world?.tileSize ?? 32;

  let sawRespawnPending = false;
  let sawRespawnStatus = false;
  let sawRespawnReset = false;
  let pendingTicks = 0;
  let firstPendingLives = null;
  const startingLives = runner.getState().playerState.lives;
  let previousY = runner.getState().playerState.position.y;

  for (let tick = 0; tick < 520; tick += 1) {
    const stepResult = runner.step({ input: { right: true, left: false, jump: false } });
    const state = runner.getState();
    const player = state.playerState;

    assert.equal(stepResult.ok, true);
    assert.equal(stepResult.stepped, true);

    if (state?.lastStep?.status === "respawn-pending") {
      sawRespawnPending = true;
      pendingTicks += 1;
      if (firstPendingLives === null) {
        firstPendingLives = player.lives;
      } else {
        assert.equal(player.lives, firstPendingLives, "countdown ticks must not consume additional lives");
      }
      assert.equal(player.status, "respawn-pending", "player must stay in stable pending respawn state during countdown");
      assert.equal(Number.isFinite(player?.respawnCountdown?.countdown), true, "pending respawn should expose visible countdown value");
    }

    if (state?.lastStep?.status === "respawned-out-of-bounds") {
      sawRespawnStatus = true;
    }

    if (player.position.y > maxSupportBottom + tileSize) {
      assert.equal(player.grounded, false, "player must not become grounded on a fake lower ghost floor after gap fall");
    }

    if (player.position.y < previousY) {
      sawRespawnReset = true;
      break;
    }

    previousY = player.position.y;
  }

  const playerAfterRespawn = runner.getState().playerState;
  assert.equal(Number.isFinite(startingLives), true, "runtime player should expose a numeric lives value");
  assert.equal(sawRespawnPending, true, "gap fall must enter explicit pending respawn countdown state");
  assert.equal(pendingTicks >= 180, true, "respawn countdown should wait roughly three seconds of 60fps ticks");
  assert.equal(firstPendingLives, startingLives - 1, "death event must consume exactly one life at countdown start");
  assert.equal(sawRespawnStatus, true, "gap fall must enter explicit out-of-bounds respawn status");
  assert.equal(sawRespawnReset, true, "gap fall must reset to spawn instead of continuing into deep bottom play state");
  assert.equal(playerAfterRespawn.lives, startingLives - 1, "respawn should preserve single life loss after countdown");
  assert.equal(playerAfterRespawn?.respawnCountdown?.active, false, "respawn countdown should complete before respawn reset");
  assert.equal(playerAfterRespawn.position.x, levelDocument.world.spawn.x);
  assert.equal(playerAfterRespawn.position.y, levelDocument.world.spawn.y);
}

function runPlayableSupportJumpAndMovementChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const session = createRuntimeGameSession({ levelDocument });

  const startResult = session.start();
  assert.equal(startResult.ok, true, "session should still boot/run in recharged path");

  const beforeMove = session.getPlayerSnapshot();
  session.tick({ left: false, right: true, jump: false });
  const afterRight = session.getPlayerSnapshot();
  for (let tick = 0; tick < 12; tick += 1) {
    session.tick({ left: true, right: false, jump: false });
  }
  const afterLeft = session.getPlayerSnapshot();

  assert.equal(afterRight.x > beforeMove.x, true, "sideways right movement should remain intact on support");
  assert.equal(Number.isFinite(afterLeft.x), true, "sideways left input should keep player position finite");
  assert.equal(afterLeft.lives >= 0, true, "session runtime should keep lives in a valid range while movement checks run");
}

runGapOutOfBoundsFailPathChecks();
runPlayableSupportJumpAndMovementChecks();

console.log("lumo-recharged-gap-out-of-bounds-checks: ok");
