import { loadLevelDocument } from "./loadLevelDocument.js";

// Valid Recharged sample level used to verify the happy path.
const validSampleLevel = {
  identity: {
    id: "debug-valid-001",
    name: "Debug Harness - Valid",
    formatVersion: 1,
    themeId: "forest",
  },
  world: {
    width: 20,
    height: 12,
    tileSize: 16,
    spawn: { x: 2, y: 3 },
  },
  layers: {
    tiles: [{ tileId: "grass", x: 0, y: 0 }],
    background: [{ backgroundId: "sky", order: 0 }],
    decor: [{ decorId: "bush", x: 4, y: 2 }],
    entities: [{ entityType: "slime", x: 6, y: 5, params: { hp: 3 } }],
    audio: [{ audioId: "wind", audioType: "ambient", x: 0, y: 0 }],
  },
  meta: {
    createdBy: "debug-harness",
  },
};

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

// Runs both debug scenarios: one valid sample and one invalid sample.
export function runDebugLevelLoaderHarness() {
  const validResult = loadLevelDocument(validSampleLevel);
  const invalidResult = loadLevelDocument(invalidSampleLevel);

  logLoaderResult("Valid sample", validResult);
  logLoaderResult("Invalid sample (missing world.spawn)", invalidResult);

  return {
    validResult,
    invalidResult,
  };
}

// Invoke automatically so importing/running this file prints output immediately.
runDebugLevelLoaderHarness();
