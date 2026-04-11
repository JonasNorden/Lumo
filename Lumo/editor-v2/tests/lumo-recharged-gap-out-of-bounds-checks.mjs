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

  let sawRespawnStatus = false;
  let sawRespawnReset = false;
  let previousY = runner.getState().playerState.position.y;

  for (let tick = 0; tick < 520; tick += 1) {
    const stepResult = runner.step({ input: { right: true, left: false, jump: false } });
    const state = runner.getState();
    const player = state.playerState;

    assert.equal(stepResult.ok, true);
    assert.equal(stepResult.stepped, true);

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
  assert.equal(sawRespawnStatus, true, "gap fall must enter explicit out-of-bounds respawn status");
  assert.equal(sawRespawnReset, true, "gap fall must reset to spawn instead of continuing into deep bottom play state");
  assert.equal(playerAfterRespawn.position.x, levelDocument.world.spawn.x);
  assert.equal(playerAfterRespawn.position.y, levelDocument.world.spawn.y);
}

function runPlayableSupportJumpAndMovementChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const session = createRuntimeGameSession({ levelDocument });

  const startResult = session.start();
  assert.equal(startResult.ok, true, "session should still boot/run in recharged path");

  let settled = session.getPlayerSnapshot();
  for (let tick = 0; tick < 120; tick += 1) {
    if (settled.grounded === true) {
      break;
    }
    session.tick({ left: false, right: false, jump: false });
    settled = session.getPlayerSnapshot();
  }

  assert.equal(settled.grounded, true, "player should still settle grounded on legitimate support");

  const beforeMove = session.getPlayerSnapshot();
  session.tick({ left: false, right: true, jump: false });
  const afterRight = session.getPlayerSnapshot();
  session.tick({ left: true, right: false, jump: false });
  session.tick({ left: true, right: false, jump: false });
  const afterLeft = session.getPlayerSnapshot();

  assert.equal(afterRight.x > beforeMove.x, true, "sideways right movement should remain intact on support");
  assert.equal(afterLeft.x < afterRight.x, true, "sideways left movement should remain intact on support");

  const beforeJump = session.getPlayerSnapshot();
  const jumpTick = session.tick({ left: false, right: false, jump: true });
  const afterJump = session.getPlayerSnapshot();

  assert.equal(jumpTick.ok, true);
  assert.equal(jumpTick.stepped, true);
  assert.equal(afterJump.y < beforeJump.y, true, "jump should still launch upward when grounded on legitimate support");
  assert.equal(afterJump.grounded, false);
}

runGapOutOfBoundsFailPathChecks();
runPlayableSupportJumpAndMovementChecks();

console.log("lumo-recharged-gap-out-of-bounds-checks: ok");
