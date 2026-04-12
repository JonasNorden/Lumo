import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");
const lumoHtmlPath = resolve(repoRoot, "Lumo.html");
const html = readFileSync(lumoHtmlPath, "utf8");

function runAnimationResolverChecks() {
  assert.equal(
    html.includes('return movingHorizontally || locomotion === "moving-grounded" ? "run" : "idle";'),
    true,
    "grounded animation should resolve to idle/run from grounded locomotion truth",
  );
  assert.equal(
    html.includes('if (rising || locomotion === "rising" || velocityY < -RECHARGED_PLAYER_VERTICAL_SPEED_EPSILON)'),
    true,
    "jump animation should resolve from rising truth",
  );
  assert.equal(
    html.includes('if (falling || locomotion === "falling" || velocityY > RECHARGED_PLAYER_VERTICAL_SPEED_EPSILON)'),
    true,
    "fall animation should resolve from falling truth",
  );
}

function runFacingSourceChecks() {
  assert.equal(
    html.includes("const snapshotFacingX = Number.isFinite(playerSnapshot?.facingX) ? playerSnapshot.facingX : 0;"),
    true,
    "player render facing should source facingX from snapshot truth",
  );
  assert.equal(
    html.includes("const movementDeltaX = previousCenterX === null ? 0 : playerCenterX - previousCenterX;"),
    false,
    "player render should not derive facing from interpolation movement delta",
  );
}

runAnimationResolverChecks();
runFacingSourceChecks();

console.log("lumo-recharged-player-animation-contract-checks: ok");
