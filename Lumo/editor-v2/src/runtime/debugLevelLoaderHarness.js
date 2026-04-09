import { loadLevelDocument } from "./loadLevelDocument.js";
import { buildRuntimeLevelSummary } from "./buildRuntimeLevelSummary.js";
import { buildRuntimeWorldSkeleton } from "./buildRuntimeWorldSkeleton.js";
import { buildRuntimeTileEntries } from "./buildRuntimeTileEntries.js";
import { buildRuntimeTileBounds } from "./buildRuntimeTileBounds.js";
import { buildRuntimeTileMap } from "./buildRuntimeTileMap.js";
import { buildRuntimeSpawnPoint } from "./buildRuntimeSpawnPoint.js";
import { buildRuntimeWorldPacket } from "./buildRuntimeWorldPacket.js";
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
  const validTileBounds = validTileEntries
    ? buildRuntimeTileBounds(validTileEntries)
    : buildRuntimeTileBounds([]);
  const partialValidTileBounds = partialValidTileEntries
    ? buildRuntimeTileBounds(partialValidTileEntries)
    : buildRuntimeTileBounds([]);
  // Build runtime tile maps directly from entries to verify world-build shape.
  const validTileMap = buildRuntimeTileMap(validTileEntries);
  const partialValidTileMap = buildRuntimeTileMap(partialValidTileEntries);
  // Build runtime spawn points from skeleton data for simple runtime positioning checks.
  const validSpawnPoint = buildRuntimeSpawnPoint(validSkeleton);
  const partialValidSpawnPoint = buildRuntimeSpawnPoint(partialValidSkeleton);
  // Build one packet from already computed runtime parts for quick world-pipeline inspection.
  const validWorldPacket = buildRuntimeWorldPacket({
    skeleton: validSkeleton,
    tileBounds: validTileBounds,
    tileMap: validTileMap,
  });
  const partialValidWorldPacket = buildRuntimeWorldPacket({
    skeleton: partialValidSkeleton,
    tileBounds: partialValidTileBounds,
    tileMap: partialValidTileMap,
  });

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
  console.log("\n=== Runtime tile bounds (valid sample) ===");
  console.log(validTileBounds);
  console.log("\n=== Runtime tile map (valid sample) ===");
  console.dir(validTileMap, { depth: null });
  console.log("\n=== Runtime spawn point (valid sample) ===");
  console.log(validSpawnPoint);
  console.log("\n=== Runtime world packet (valid sample) ===");
  console.dir(validWorldPacket, { depth: null });

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
  console.log("\n=== Runtime tile bounds (partial valid sample) ===");
  console.log(partialValidTileBounds);
  console.log("\n=== Runtime tile map (partial valid sample) ===");
  console.dir(partialValidTileMap, { depth: null });
  console.log("\n=== Runtime spawn point (partial valid sample) ===");
  console.log(partialValidSpawnPoint);
  console.log("\n=== Runtime world packet (partial valid sample) ===");
  console.dir(partialValidWorldPacket, { depth: null });

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
    validTileBounds,
    partialValidTileBounds,
    validTileMap,
    partialValidTileMap,
    validSpawnPoint,
    partialValidSpawnPoint,
    validWorldPacket,
    partialValidWorldPacket,
    invalidResult,
  };
}

// Invoke automatically so importing/running this file prints output immediately.
runDebugLevelLoaderHarness();
