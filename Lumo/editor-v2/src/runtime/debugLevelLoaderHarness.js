import { loadLevelDocument } from "./loadLevelDocument.js";
import { buildRuntimeLevelSummary } from "./buildRuntimeLevelSummary.js";
import testLevelDocument from "../../../../editor-v2/src/data/testLevelDocument.v1.json" with { type: "json" };

// Invalid Recharged sample level used to verify validation errors.
const invalidSampleLevel = {
  identity: {
    id: "debug-invalid-001",
    name: "Debug Harness - Invalid",
    formatVersion: 1,
    themeId: "forest",
  },
  world: {
    width: 20,
    height: 12,
    tileSize: 16,
    // Missing required world.spawn on purpose.
  },
  layers: {
    tiles: [{ tileId: "stone", x: 1, y: 1 }],
    background: [],
    decor: [],
    entities: [],
    audio: [],
  },
};

// Logs the key loader output fields in a consistent, readable format.
function logLoaderResult(label, result) {
  console.log(`\n=== ${label} ===`);
  console.log("ok:", result.ok);
  console.log("errors:", result.errors);
  console.log("warnings:", result.warnings);
  console.log("debug.summary:", result.debug?.summary);
}

// Runs both debug scenarios: one valid document file and one invalid inline sample.
export function runDebugLevelLoaderHarness() {
  const validResult = loadLevelDocument(testLevelDocument);
  const invalidResult = loadLevelDocument(invalidSampleLevel);
  // Keep this summary log simple; it now includes tile/background/decor/entity previews.
  const validSummary = validResult.ok ? buildRuntimeLevelSummary(validResult.level) : null;

  logLoaderResult("Valid file sample (testLevelDocument.v1.json)", validResult);
  if (validSummary) {
    console.log("\n=== Runtime level summary (valid sample) ===");
    console.log(validSummary);
  }
  logLoaderResult("Invalid sample (missing world.spawn)", invalidResult);

  return {
    validResult,
    validSummary,
    invalidResult,
  };
}

// Invoke automatically so importing/running this file prints output immediately.
runDebugLevelLoaderHarness();
