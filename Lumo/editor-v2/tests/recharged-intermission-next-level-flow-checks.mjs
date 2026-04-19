import assert from "node:assert/strict";

import {
  RECHARGED_BROWSER_LEVEL_SEQUENCE,
  resolveNextRechargedLevelPath,
  loadNextRechargedLevelFromIntermission,
} from "../src/runtime/rechargedIntermissionNextLevelFlow.js";

const firstLevel = RECHARGED_BROWSER_LEVEL_SEQUENCE[0];
const secondLevel = RECHARGED_BROWSER_LEVEL_SEQUENCE[1];

assert.equal(typeof firstLevel, "string", "Expected deterministic first Recharged level.");
assert.equal(typeof secondLevel, "string", "Expected deterministic second Recharged level.");

const nextResolved = resolveNextRechargedLevelPath(firstLevel);
assert.equal(nextResolved, secondLevel, "Expected Enter flow to resolve the deterministic next Recharged level.");

const fromAbsoluteUrl = resolveNextRechargedLevelPath(`http://localhost/${firstLevel}?autoplay=1`);
assert.equal(fromAbsoluteUrl, secondLevel, "Expected resolver to normalize absolute query level paths.");

const noNextAtEnd = resolveNextRechargedLevelPath(secondLevel);
assert.equal(noNextAtEnd, null, "Expected final sequence level to have no next-level resolution.");

const unresolvedTransition = await loadNextRechargedLevelFromIntermission({
  currentLevelPath: "editor-v2/src/data/missing-level.json",
  bootFromQuery() {
    throw new Error("Should not attempt boot when next level cannot resolve.");
  },
});
assert.equal(unresolvedTransition.ok, false, "Expected unresolved transition to fail safely.");
assert.equal(unresolvedTransition.reason, "next-level-unresolved", "Expected unresolved transition reason.");

let capturedSearch = "";
const successfulTransition = await loadNextRechargedLevelFromIntermission({
  currentLevelPath: firstLevel,
  async bootFromQuery(options = {}) {
    capturedSearch = typeof options?.search === "string" ? options.search : "";
    return {
      enabled: true,
      booted: true,
      levelPath: secondLevel,
      gameState: "playing",
    };
  },
});
assert.equal(successfulTransition.ok, true, "Expected Enter flow to boot into next Recharged level when available.");
assert.equal(successfulTransition.nextLevelPath, secondLevel, "Expected transition payload to carry resolved next level path.");
assert.equal(capturedSearch.includes(`level=${encodeURIComponent(secondLevel)}`), true, "Expected transition to request boot from resolved level path.");

const failedBootTransition = await loadNextRechargedLevelFromIntermission({
  currentLevelPath: firstLevel,
  async bootFromQuery() {
    return {
      enabled: true,
      booted: false,
      errors: ["missing level"],
    };
  },
});
assert.equal(failedBootTransition.ok, false, "Expected failed boot to stay safely in intermission.");
assert.equal(failedBootTransition.reason, "next-level-boot-failed", "Expected failed boot reason to be explicit.");

console.log("recharged-intermission-next-level-flow-checks: ok");
