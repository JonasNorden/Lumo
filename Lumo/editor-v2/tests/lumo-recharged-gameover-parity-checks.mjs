import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createRuntimeRunner } from "../src/runtime/createRuntimeRunner.js";
import { stepRuntimePlayerSimulation } from "../src/runtime/stepRuntimePlayerSimulation.js";
import { createLumoRechargedBootAdapter } from "../src/runtime/createLumoRechargedBootAdapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function loadFixtureLevelDocument() {
  const fixturePath = path.resolve(__dirname, "../src/data/testLevelDocument.v1.json");
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function runOutOfBoundsLifeGateChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const runner = createRuntimeRunner({ levelDocument });
  assert.equal(runner.start().ok, true, "runner should start for game-over checks");

  const runnerState = runner.getState();
  const worldPacket = runnerState.world;
  const oneLifeResult = stepRuntimePlayerSimulation(worldPacket, {
    ...runnerState.playerState,
    lives: 1,
    position: { x: 0, y: 99999 },
    velocity: { x: 0, y: 0 },
  }, { entities: runnerState.entities });

  assert.equal(oneLifeResult.ok, true, "simulation should resolve last-life death tick");
  assert.equal(oneLifeResult.player.lives, 0, "last life must be consumed on death");
  assert.equal(oneLifeResult.player.gameState, "gameover", "lives reaching zero should immediately set gameState=gameover");
  assert.equal(oneLifeResult.player.status, "game-over", "lives reaching zero should enter stable game-over status");
  assert.equal(oneLifeResult.player.respawnCountdown.active, false, "no respawn countdown should start when lives reach zero");
  assert.equal(oneLifeResult.status, "game-over", "step result status should surface game-over");

  const twoLifeResult = stepRuntimePlayerSimulation(worldPacket, {
    ...runnerState.playerState,
    lives: 2,
    position: { x: 0, y: 99999 },
    velocity: { x: 0, y: 0 },
  }, { entities: runnerState.entities });

  assert.equal(twoLifeResult.ok, true, "simulation should resolve positive-life death tick");
  assert.equal(twoLifeResult.player.lives, 1, "positive-life death should consume one life");
  assert.equal(twoLifeResult.player.status, "respawn-pending", "positive-life death should still enter respawn pending");
  assert.equal(twoLifeResult.player.respawnCountdown.active, true, "positive-life death should keep three-second respawn countdown");
}

async function runAdapterGameOverPayloadAndFreezeChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const adapter = createLumoRechargedBootAdapter({
    sourceDescriptor: { levelDocument },
  });

  assert.equal((await adapter.prepare()).ok, true, "adapter prepare should succeed");
  assert.equal((await adapter.boot()).ok, true, "adapter boot should succeed");

  let sawRespawnPositiveLife = false;
  let sawGameOver = false;

  for (let tick = 0; tick < 4000; tick += 1) {
    adapter.tick({ moveX: 1, jump: false });
    const player = adapter.getPlayerSnapshot();

    if (player?.respawnPending === true && player?.lives > 0) {
      sawRespawnPositiveLife = true;
    }

    if (player?.gameState === "gameover") {
      sawGameOver = true;
      break;
    }
  }

  assert.equal(sawRespawnPositiveLife, true, "respawn flow must still work while lives remain above zero");
  assert.equal(sawGameOver, true, "adapter runtime should eventually reach gameover on final life loss");

  const payloadAtGameOver = adapter.getBootPayload();
  assert.equal(payloadAtGameOver.gameState, "gameover", "boot payload should expose gameover state");
  assert.equal(payloadAtGameOver.respawnPending, false, "boot payload should clear respawn pending at gameover");
  assert.equal(payloadAtGameOver.statusText, "Game Over", "boot payload should expose game-over status text");

  const frozenBefore = adapter.getPlayerSnapshot();
  for (let tick = 0; tick < 40; tick += 1) {
    adapter.tick({ moveX: tick % 2 === 0 ? 1 : -1, jump: true, continuePressed: true });
  }
  const frozenAfter = adapter.getPlayerSnapshot();

  assert.equal(frozenAfter.gameState, "gameover", "gameover state should stay stable after additional ticks");
  assert.equal(frozenAfter.locomotion, "game-over", "gameover locomotion marker should remain stable");
  assert.equal(frozenAfter.respawnPending, false, "respawn should remain disabled in gameover state");
  assert.equal(frozenAfter.x, frozenBefore.x, "player x position should stay frozen during gameover");
  assert.equal(frozenAfter.y, frozenBefore.y, "player y position should stay frozen during gameover");
}

function runLiveOverlayContractChecks() {
  const lumoHtmlPath = path.resolve(repoRoot, "Lumo.html");
  const lumoHtml = fs.readFileSync(lumoHtmlPath, "utf8");

  assert.equal(
    lumoHtml.includes("function drawRechargedGameOverOverlay"),
    true,
    "Lumo.html should define dedicated Recharged game-over overlay renderer.",
  );
  assert.equal(
    lumoHtml.includes('if (hudSnapshot?.gameState !== "gameover")'),
    true,
    "game-over overlay renderer should be gated by gameState===gameover.",
  );
  assert.equal(
    lumoHtml.includes("data/assets/ui/gameover.png"),
    true,
    "game-over overlay should use existing V1 gameover image asset.",
  );
}

runOutOfBoundsLifeGateChecks();
await runAdapterGameOverPayloadAndFreezeChecks();
runLiveOverlayContractChecks();

console.log("lumo-recharged-gameover-parity-checks: ok");
