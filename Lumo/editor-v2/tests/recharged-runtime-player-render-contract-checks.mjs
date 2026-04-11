import assert from "node:assert/strict";

import { RUNTIME_PLAYER_RENDER_COLORS } from "../src/runtime/drawRuntimeBridgeView.js";

function runNeutralPlayerColorChecks() {
  assert.deepEqual(RUNTIME_PLAYER_RENDER_COLORS, {
    body: "#60a5fa",
    eyes: "#e2e8f0",
  });

  assert.equal(RUNTIME_PLAYER_RENDER_COLORS.body === "#22c55e", false, "player body should not switch to legacy grounded green state");
}

runNeutralPlayerColorChecks();

console.log("recharged-runtime-player-render-contract-checks: ok");
