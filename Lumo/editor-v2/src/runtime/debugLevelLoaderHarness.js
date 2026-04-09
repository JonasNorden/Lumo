import { loadLevelDocument } from "./loadLevelDocument.js";
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

  logLoaderResult("Valid file sample (testLevelDocument.v1.json)", validResult);
  logLoaderResult("Invalid sample (missing world.spawn)", invalidResult);

  return {
    validResult,
    invalidResult,
  };
}

// Invoke automatically so importing/running this file prints output immediately.
runDebugLevelLoaderHarness();
