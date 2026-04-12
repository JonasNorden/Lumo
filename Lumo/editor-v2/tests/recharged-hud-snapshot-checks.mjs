import assert from "node:assert/strict";

import { buildRechargedHudSnapshot } from "../src/runtime/buildRechargedHudSnapshot.js";

function runAdapterSnapshotReadChecks() {
  const payload = {
    adapter: {
      getPlayerSnapshot() {
        return {
          flareStash: 6.7,
          energy: 0.625,
          lives: 3,
          score: 1245.9,
        };
      },
    },
  };

  const snapshot = buildRechargedHudSnapshot(payload);

  assert.equal(snapshot.flareStash, 6);
  assert.equal(snapshot.energy, 0.625);
  assert.equal(snapshot.lives, 3);
  assert.equal(snapshot.score, 1245);
  console.log("recharged hud snapshot adapter read ok");
}

function runFallbackSnapshotReadChecks() {
  const snapshot = buildRechargedHudSnapshot({}, {
    currentPlayerSnapshot: {
      flareStash: 2,
      energy: 0.5,
    },
  });

  assert.equal(snapshot.flareStash, 2);
  assert.equal(snapshot.energy, 0.5);
  assert.equal(snapshot.lives, null);
  assert.equal(snapshot.score, null);
  console.log("recharged hud snapshot fallback read ok");
}

runAdapterSnapshotReadChecks();
runFallbackSnapshotReadChecks();

