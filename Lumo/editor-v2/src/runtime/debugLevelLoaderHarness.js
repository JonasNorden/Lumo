import { loadLevelDocument } from "./loadLevelDocument.js";
import { buildRuntimeLevelSummary } from "./buildRuntimeLevelSummary.js";
import { buildRuntimeWorldSkeleton } from "./buildRuntimeWorldSkeleton.js";
import { buildRuntimeTileEntries } from "./buildRuntimeTileEntries.js";
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

// Partially valid Recharged sample level for runtime missing-list checks.
const partialValidSampleLevel = {
  identity: {
    id: "debug-partial-001",
    name: "Debug Harness - Partial Valid",
    formatVersion: 1,
    themeId: "forest",
  },
  world: {
    width: 20,
    height: 12,
    tileSize: 16,
    spawn: { x: 2, y: 2 },
  },
  // Keep layers intentionally sparse so runtime summary can expose missing requirements.
  layers: {},
};

// Logs the key loader output fields in a consistent, readable format.
function logLoaderResult(label, result) {
  console.log(`\n=== ${label} ===`);
  console.log("ok:", result.ok);
  console.log("errors:", result.errors);
  console.log("warnings:", result.warnings);
  console.log("debug.summary:", result.debug?.summary);
}

// Runs three debug scenarios: valid file, partial-valid inline sample, and invalid inline sample.
export function runDebugLevelLoaderHarness() {
  const validResult = loadLevelDocument(testLevelDocument);
  const partialValidResult = loadLevelDocument(partialValidSampleLevel);
  const invalidResult = loadLevelDocument(invalidSampleLevel);
  // Keep these summary logs simple; they include previews, readiness, and missing requirements.
  const validSummary = validResult.ok ? buildRuntimeLevelSummary(validResult.level) : null;
  const partialValidSummary = partialValidResult.ok
    ? buildRuntimeLevelSummary(partialValidResult.level)
    : null;
  const validSkeleton = validResult.ok ? buildRuntimeWorldSkeleton(validResult.level) : null;
  const partialValidSkeleton = partialValidResult.ok
    ? buildRuntimeWorldSkeleton(partialValidResult.level)
    : null;
  const validTileEntries = validSkeleton ? buildRuntimeTileEntries(validSkeleton) : null;
  const partialValidTileEntries = partialValidSkeleton
    ? buildRuntimeTileEntries(partialValidSkeleton)
    : null;

  logLoaderResult("Valid file sample (testLevelDocument.v1.json)", validResult);
  if (validSummary) {
    console.log("\n=== Runtime level summary (valid sample) ===");
    console.log(validSummary);
  }
  if (validSkeleton) {
    console.log("\n=== Runtime world skeleton (valid sample) ===");
    console.dir(validSkeleton, { depth: null });
  }
  if (validTileEntries) {
    console.log("\n=== Runtime tile entries (valid sample) ===");
    console.dir(validTileEntries, { depth: null });
  }

  logLoaderResult("Partial valid sample (world + spawn, sparse layers)", partialValidResult);
  if (partialValidSummary) {
    console.log("\n=== Runtime level summary (partial valid sample) ===");
    console.log(partialValidSummary);
  }
  if (partialValidSkeleton) {
    console.log("\n=== Runtime world skeleton (partial valid sample) ===");
    console.dir(partialValidSkeleton, { depth: null });
  }
  if (partialValidTileEntries) {
    console.log("\n=== Runtime tile entries (partial valid sample) ===");
    console.dir(partialValidTileEntries, { depth: null });
  }

  logLoaderResult("Invalid sample (missing world.spawn)", invalidResult);

  return {
    validResult,
    validSummary,
    partialValidResult,
    partialValidSummary,
    validSkeleton,
    partialValidSkeleton,
    validTileEntries,
    partialValidTileEntries,
    invalidResult,
  };
}

// Invoke automatically so importing/running this file prints output immediately.
runDebugLevelLoaderHarness();
