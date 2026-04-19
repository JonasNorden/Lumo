import assert from "node:assert/strict";

import { createLumoRechargedBootAdapter } from "../src/runtime/createLumoRechargedBootAdapter.js";

async function runRespawnCountdownPayloadPropagationChecks() {
  const tallWorldLevel = {
    identity: { id: "respawn-payload-level", formatVersion: "1.0.0", themeId: "test", name: "Respawn Payload" },
    world: {
      width: 32,
      height: 360,
      tileSize: 32,
      spawn: { x: 64, y: 16 },
    },
    layers: {
      tiles: [],
      background: [],
      decor: [],
      entities: [],
      audio: [],
    },
  };

  const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: tallWorldLevel });
  await adapter.prepare();
  await adapter.boot();

  let sawPending = false;
  let previousCount = Number.POSITIVE_INFINITY;
  let countdownDecreased = false;
  let matchedPayloadValues = false;
  let sawCountdownClear = false;

  for (let index = 0; index < 420; index += 1) {
    adapter.tick({ left: false, right: true, jump: false });
    const player = adapter.getPlayerSnapshot();
    const payload = adapter.getBootPayload();

    assert.equal(typeof player.respawnPending, "boolean", "player snapshot should always expose respawnPending");
    assert.equal(typeof player.respawnCount, "number", "player snapshot should always expose respawnCount");
    assert.equal(typeof payload.respawnPending, "boolean", "payload should always expose respawnPending");
    assert.equal(typeof payload.respawnCount, "number", "payload should always expose respawnCount");

    if (player.respawnPending === true) {
      sawPending = true;
      assert.equal(payload.respawnPending, true, "payload should expose active respawnPending while pending");
      if (Number.isFinite(previousCount) && player.respawnCount < previousCount) {
        countdownDecreased = true;
      }
      previousCount = player.respawnCount;
      if (payload.respawnPending === player.respawnPending && payload.respawnCount === player.respawnCount) {
        matchedPayloadValues = true;
      }
    } else if (sawPending) {
      assert.equal(payload.respawnPending, false, "payload respawnPending should clear after respawn completes");
      assert.equal(payload.respawnCount, 0, "payload respawnCount should clear after respawn completes");
      assert.equal(player.respawnCount, 0, "player respawnCount should clear after respawn completes");
      sawCountdownClear = true;
      break;
    }
  }

  assert.equal(sawPending, true, "expected to observe pending respawn state");
  assert.equal(countdownDecreased, true, "expected pending respawn countdown to decrease over time");
  assert.equal(matchedPayloadValues, true, "expected payload respawn fields to match player snapshot values");
  assert.equal(sawCountdownClear, true, "expected countdown fields to clear after respawn");

  console.log("lumo recharged respawn payload propagation checks: ok");
}

await runRespawnCountdownPayloadPropagationChecks();
