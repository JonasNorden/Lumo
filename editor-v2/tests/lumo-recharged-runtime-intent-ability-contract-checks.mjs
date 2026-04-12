import assert from "node:assert/strict";
import { buildRuntimePlayerIntent } from "../../Lumo/editor-v2/src/runtime/buildRuntimePlayerIntent.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const inputWithAbilities = buildRuntimePlayerIntent({
  left: true,
  jump: true,
  flare: true,
  pulse: false,
  boost: true,
});

assert.equal(inputWithAbilities.moveX, -1, "expected left=true to map to moveX=-1");
assert.equal(inputWithAbilities.jump, true, "expected jump intent to remain true");
assert.equal(inputWithAbilities.flare, true, "expected flare intent to pass through");
assert.equal(inputWithAbilities.pulse, false, "expected pulse intent to pass through");
assert.equal(inputWithAbilities.boost, true, "expected boost intent to pass through");
console.log("recharged runtime intent passthrough ok");

const runtimeSimulationPath = resolve(__dirname, "..", "..", "Lumo", "editor-v2", "src", "runtime", "stepRuntimePlayerSimulation.js");
const runtimeSimulationSource = readFileSync(runtimeSimulationPath, "utf8");

assert.equal(
  runtimeSimulationSource.includes("boost: { supported: true, wired: false }"),
  true,
  "expected runtime player state to include boost placeholder ability",
);
console.log("recharged runtime player boost placeholder ok");
