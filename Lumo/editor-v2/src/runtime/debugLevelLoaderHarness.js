import { loadLevelDocument } from "./loadLevelDocument.js";
import { buildRuntimeLevelSummary } from "./buildRuntimeLevelSummary.js";
import { buildRuntimeWorldSkeleton } from "./buildRuntimeWorldSkeleton.js";
import { buildRuntimeTileEntries } from "./buildRuntimeTileEntries.js";
import { buildRuntimeTileBounds } from "./buildRuntimeTileBounds.js";
import { buildRuntimeTileMap } from "./buildRuntimeTileMap.js";
import { buildRuntimeSpawnPoint } from "./buildRuntimeSpawnPoint.js";
import { buildRuntimeWorldPacket } from "./buildRuntimeWorldPacket.js";
import { getRuntimeTileAtGrid } from "./getRuntimeTileAtGrid.js";
import { isRuntimeGridSolid } from "./isRuntimeGridSolid.js";
import { buildRuntimeSpawnNeighborhood } from "./buildRuntimeSpawnNeighborhood.js";
import { hasRuntimeGroundBelowSpawn } from "./hasRuntimeGroundBelowSpawn.js";
import { buildRuntimeSpawnValidation } from "./buildRuntimeSpawnValidation.js";
import { findRuntimeLandingCellBelowSpawn } from "./findRuntimeLandingCellBelowSpawn.js";
import { buildRuntimeSpawnDropSummary } from "./buildRuntimeSpawnDropSummary.js";
import { buildRuntimePlayerStartPlacement } from "./buildRuntimePlayerStartPlacement.js";
import { buildRuntimePlayerSpawnPacket } from "./buildRuntimePlayerSpawnPacket.js";
import { buildRuntimePlayerStartState } from "./buildRuntimePlayerStartState.js";
import { stepRuntimePlayerState } from "./stepRuntimePlayerState.js";
import { simulateRuntimePlayerFall } from "./simulateRuntimePlayerFall.js";
import { buildRuntimePlayerBootstrap } from "./buildRuntimePlayerBootstrap.js";
import { buildRuntimeInitializationPacket } from "./buildRuntimeInitializationPacket.js";
import { buildRuntimeSessionState } from "./buildRuntimeSessionState.js";
import { buildNextRuntimeSessionState } from "./buildNextRuntimeSessionState.js";
import { updateRuntimeSession } from "./updateRuntimeSession.js";
import { createRuntimeRunnerSession } from "./createRuntimeRunnerSession.js";
import { runRuntimeRunnerTicks } from "./runRuntimeRunnerTicks.js";
import { runRuntimeLevelSimulation } from "./runRuntimeLevelSimulation.js";
import { startRuntimeFromLevelDocument } from "./startRuntimeFromLevelDocument.js";
import { startRuntimeFromLevelPath } from "./startRuntimeFromLevelPath.js";
import { createRuntimeStartSummary } from "./createRuntimeStartSummary.js";
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
const validLevelPath = new URL("../data/testLevelDocument.v1.json", import.meta.url).href;
const invalidLevelPath = "./missing-level-document.v1.json";


// Logs the key loader output fields in a consistent, readable format.
function logLoaderResult(label, result) {
  console.log(`\n=== ${label} ===`);
  console.log("ok:", result.ok);
  console.log("errors:", result.errors);
  console.log("warnings:", result.warnings);
  console.log("debug.summary:", result.debug?.summary);
}

// Runs three debug scenarios: valid file, partial-valid inline sample, and invalid inline sample.
export async function runDebugLevelLoaderHarness() {
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
  // Build a fixed spawn neighborhood for quick collision probes around spawn.
  const validSpawnNeighborhood = buildRuntimeSpawnNeighborhood(validWorldPacket, validSpawnPoint);
  const partialValidSpawnNeighborhood = buildRuntimeSpawnNeighborhood(
    partialValidWorldPacket,
    partialValidSpawnPoint,
  );
  // Probe exactly one cell below spawn to verify basic runtime ground detection shape.
  const validGroundBelowSpawn = hasRuntimeGroundBelowSpawn(validWorldPacket, validSpawnPoint);
  const partialValidGroundBelowSpawn = hasRuntimeGroundBelowSpawn(
    partialValidWorldPacket,
    partialValidSpawnPoint,
  );
  // Run a dedicated spawn validation snapshot for each existing harness scenario.
  const validSpawnValidation = buildRuntimeSpawnValidation(validWorldPacket);
  const partialValidSpawnValidation = buildRuntimeSpawnValidation(partialValidWorldPacket);
  const invalidSpawnValidation = buildRuntimeSpawnValidation(null);
  // Scan downward from spawn to find the first supported empty landing cell.
  const validLandingCellBelowSpawn = findRuntimeLandingCellBelowSpawn(validWorldPacket);
  const partialLandingCellBelowSpawn = findRuntimeLandingCellBelowSpawn(partialValidWorldPacket);
  const invalidLandingCellBelowSpawn = findRuntimeLandingCellBelowSpawn(null);
  // Build a combined spawn viability + landing summary for each scenario.
  const validSpawnDropSummary = buildRuntimeSpawnDropSummary(validWorldPacket);
  const partialSpawnDropSummary = buildRuntimeSpawnDropSummary(partialValidWorldPacket);
  const invalidSpawnDropSummary = buildRuntimeSpawnDropSummary(null);
  // Build debug-first player start placement from each scenario's runtime packet.
  const validPlayerStartPlacement = buildRuntimePlayerStartPlacement(validWorldPacket);
  const partialPlayerStartPlacement = buildRuntimePlayerStartPlacement(partialValidWorldPacket);
  const invalidPlayerStartPlacement = buildRuntimePlayerStartPlacement(null);
  // Build the first compact runtime-ready player spawn packet for each scenario.
  const validPlayerSpawnPacket = buildRuntimePlayerSpawnPacket(validWorldPacket);
  const partialPlayerSpawnPacket = buildRuntimePlayerSpawnPacket(partialValidWorldPacket);
  const invalidPlayerSpawnPacket = buildRuntimePlayerSpawnPacket(null);
  // Build gameplay-facing runtime player start state from authored spawn + validation.
  const validPlayerStartState = buildRuntimePlayerStartState(validWorldPacket);
  const partialPlayerStartState = buildRuntimePlayerStartState(partialValidWorldPacket);
  const invalidPlayerStartState = buildRuntimePlayerStartState(null);
  // Advance each sample by one tiny runtime gravity tick.
  const validPlayerStepState = stepRuntimePlayerState(validWorldPacket, validPlayerStartState);
  const partialPlayerStepState = stepRuntimePlayerState(
    partialValidWorldPacket,
    partialPlayerStartState,
  );
  const invalidPlayerStepState = stepRuntimePlayerState(null, invalidPlayerStartState);
  // Simulate repeated tiny gravity ticks until ground contact or safe max-step stop.
  const validPlayerFallSimulation = simulateRuntimePlayerFall(
    validWorldPacket,
    validPlayerStartState,
  );
  const partialPlayerFallSimulation = simulateRuntimePlayerFall(
    partialValidWorldPacket,
    partialPlayerStartState,
  );
  const invalidPlayerFallSimulation = simulateRuntimePlayerFall(null, invalidPlayerStartState);
  // Build one compact startup bootstrap result for each scenario.
  const validPlayerBootstrap = buildRuntimePlayerBootstrap(validWorldPacket);
  const partialPlayerBootstrap = buildRuntimePlayerBootstrap(partialValidWorldPacket);
  const invalidPlayerBootstrap = buildRuntimePlayerBootstrap(null);
  // Build the first compact runtime initialization packet from world + player bootstrap.
  const validRuntimeInitializationPacket = buildRuntimeInitializationPacket(validWorldPacket);
  const partialRuntimeInitializationPacket = buildRuntimeInitializationPacket(partialValidWorldPacket);
  const invalidRuntimeInitializationPacket = buildRuntimeInitializationPacket(null);
  // Build a compact gameplay-facing runtime session/state object from each init packet.
  const validRuntimeSessionState = buildRuntimeSessionState(validRuntimeInitializationPacket);
  const partialRuntimeSessionState = buildRuntimeSessionState(partialRuntimeInitializationPacket);
  const invalidRuntimeSessionState = buildRuntimeSessionState(invalidRuntimeInitializationPacket);
  // Advance one session tick from each sample to validate the new session update chain.
  const validNextRuntimeSessionState = buildNextRuntimeSessionState(validRuntimeSessionState);
  const partialNextRuntimeSessionState = buildNextRuntimeSessionState(partialRuntimeSessionState);
  const invalidNextRuntimeSessionState = buildNextRuntimeSessionState(invalidRuntimeSessionState);
  // Run a compact multi-step session simulation for each sample.
  const validRuntimeSessionUpdate = updateRuntimeSession(validRuntimeSessionState, {
    steps: 5,
    stopOnGrounded: true,
  });
  const partialRuntimeSessionUpdate = updateRuntimeSession(partialRuntimeSessionState, { steps: 5 });
  const invalidRuntimeSessionUpdate = updateRuntimeSession(invalidRuntimeSessionState, { steps: 3 });

  // Build the first top-level runtime runner session chain from loaded level documents.
  const validRuntimeRunnerSession = createRuntimeRunnerSession(validResult.level);
  const partialRuntimeRunnerSession = createRuntimeRunnerSession(partialValidResult.level);
  const invalidRuntimeRunnerSession = createRuntimeRunnerSession(invalidResult.level);
  // Run compact runtime runner tick batches from the prepared runner sessions.
  const validRuntimeRunnerTicks = runRuntimeRunnerTicks(validRuntimeRunnerSession.session, {
    steps: 5,
    stopOnGrounded: true,
  });
  const partialRuntimeRunnerTicks = runRuntimeRunnerTicks(partialRuntimeRunnerSession.session, {
    steps: 4,
  });
  const invalidRuntimeRunnerTicks = runRuntimeRunnerTicks(invalidRuntimeRunnerSession.session, {
    steps: 3,
  });
  // Run first end-to-end level simulation wrapper: level -> session -> N ticks.
  const validRuntimeLevelSimulation = runRuntimeLevelSimulation(validResult.level, {
    steps: 5,
    stopOnGrounded: true,
  });
  const partialRuntimeLevelSimulation = runRuntimeLevelSimulation(partialValidResult.level, {
    steps: 4,
  });
  const invalidRuntimeLevelSimulation = runRuntimeLevelSimulation(invalidResult.level, {
    steps: 3,
  });

  // Start runtime directly from loaded level documents (steps=0 should not tick).
  const validRuntimeStartFromDocument = startRuntimeFromLevelDocument(validResult.level, {
    steps: 0,
  });
  const partialRuntimeStartFromDocument = startRuntimeFromLevelDocument(partialValidResult.level, {
    steps: 4,
  });
  const invalidRuntimeStartFromDocument = startRuntimeFromLevelDocument(invalidResult.level, {
    steps: 2,
  });
  // Start runtime from filesystem path and a clearly invalid path.
  const validRuntimeStartFromPath = await startRuntimeFromLevelPath(validLevelPath, {
    steps: 3,
    stopOnGrounded: true,
  });
  const invalidRuntimeStartFromPath = await startRuntimeFromLevelPath(invalidLevelPath, {
    steps: 3,
  });
  // Build compact top-level start summaries for easy harness verification.
  const validRuntimeStartSummaryFromDocument = createRuntimeStartSummary(validRuntimeStartFromDocument);
  const validRuntimeStartSummaryFromPath = createRuntimeStartSummary(validRuntimeStartFromPath);
  const partialRuntimeStartSummaryFromDocument = createRuntimeStartSummary(
    partialRuntimeStartFromDocument,
  );
  const invalidRuntimeStartSummaryFromDocument = createRuntimeStartSummary(
    invalidRuntimeStartFromDocument,
  );
  const invalidRuntimeStartSummaryFromPath = createRuntimeStartSummary(invalidRuntimeStartFromPath);

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
  console.log("\n=== Runtime spawn neighborhood (valid sample) ===");
  console.dir(validSpawnNeighborhood, { depth: null });
  console.log("\n=== Runtime ground below spawn (valid sample) ===");
  console.log(validGroundBelowSpawn);
  console.log("\n=== SPAWN VALIDATION ===");
  console.log("(valid sample)");
  console.dir(validSpawnValidation, { depth: null });
  console.log("\n=== LANDING CELL BELOW SPAWN ===");
  console.log("(valid sample)");
  console.dir(validLandingCellBelowSpawn, { depth: null });
  console.log("\n=== SPAWN DROP SUMMARY ===");
  console.log("(valid sample)");
  console.dir(validSpawnDropSummary, { depth: null });
  console.log("\n=== PLAYER START PLACEMENT ===");
  console.log("(valid sample)");
  console.dir(validPlayerStartPlacement, { depth: null });
  console.log("\n=== PLAYER SPAWN PACKET ===");
  console.log("(valid sample)");
  console.dir(validPlayerSpawnPacket, { depth: null });
  console.log("\n=== PLAYER START STATE ===");
  console.log("(valid sample)");
  console.dir(validPlayerStartState, { depth: null });
  console.log("\n=== PLAYER STEP STATE ===");
  console.log("(valid sample)");
  console.dir(validPlayerStepState, { depth: null });
  console.log("\n=== PLAYER FALL SIMULATION ===");
  console.log("(valid sample)");
  console.dir(validPlayerFallSimulation, { depth: null });
  console.log("\n=== PLAYER BOOTSTRAP ===");
  console.log("(valid sample)");
  console.dir(validPlayerBootstrap, { depth: null });
  console.log("\n=== RUNTIME INITIALIZATION PACKET ===");
  console.log("(valid sample)");
  console.dir(validRuntimeInitializationPacket, { depth: null });
  console.log("\n=== RUNTIME SESSION STATE ===");
  console.log("(valid sample)");
  console.dir(validRuntimeSessionState, { depth: null });
  console.log("\n=== RUNTIME NEXT SESSION STATE ===");
  console.log("(valid sample)");
  console.dir(validNextRuntimeSessionState, { depth: null });
  console.log("\n=== RUNTIME SESSION UPDATE ===");
  console.log("(valid sample)");
  console.dir(validRuntimeSessionUpdate, { depth: null });
  console.log("\n=== RUNTIME RUNNER SESSION ===");
  console.log("(valid sample)");
  console.dir(validRuntimeRunnerSession, { depth: null });
  console.log("\n=== RUNTIME RUNNER TICKS ===");
  console.log("(valid sample)");
  console.dir(validRuntimeRunnerTicks, { depth: null });
  console.log("\n=== RUNTIME LEVEL SIMULATION ===");
  console.log("(valid sample)");
  console.dir(validRuntimeLevelSimulation, { depth: null });
  console.log("\n=== RUNTIME START FROM DOCUMENT ===");
  console.log("(valid sample)");
  console.dir(validRuntimeStartFromDocument, { depth: null });
  console.log("\n=== RUNTIME START FROM PATH ===");
  console.log("(valid sample)");
  console.dir(validRuntimeStartFromPath, { depth: null });
  console.log("\n=== RUNTIME START SUMMARY ===");
  console.log("(valid sample)");
  console.dir(
    {
      fromDocument: validRuntimeStartSummaryFromDocument,
      fromPath: validRuntimeStartSummaryFromPath,
    },
    { depth: null },
  );
  // Run a few fixed grid lookups for easy runtime tile hit-test inspection.
  console.log("\n=== Runtime tile lookup (valid sample) ===");
  const validLookupTests = [
    { grid: [0, 10], tile: getRuntimeTileAtGrid(validWorldPacket, 0, 10) },
    { grid: [7, 10], tile: getRuntimeTileAtGrid(validWorldPacket, 7, 10) },
    { grid: [7, 7], tile: getRuntimeTileAtGrid(validWorldPacket, 7, 7) },
  ];
  console.dir(validLookupTests, { depth: null });
  // Keep solidity checks separate so true/false behavior stays easy to read.
  console.log("\n=== Runtime grid solidity (valid sample) ===");
  const validSolidityTests = [
    { grid: [0, 10], solid: isRuntimeGridSolid(validWorldPacket, 0, 10) },
    { grid: [7, 10], solid: isRuntimeGridSolid(validWorldPacket, 7, 10) },
    { grid: [7, 7], solid: isRuntimeGridSolid(validWorldPacket, 7, 7) },
    { grid: [10, 7], solid: isRuntimeGridSolid(validWorldPacket, 10, 7) },
  ];
  console.dir(validSolidityTests, { depth: null });

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
  console.log("\n=== Runtime spawn neighborhood (partial valid sample) ===");
  console.dir(partialValidSpawnNeighborhood, { depth: null });
  console.log("\n=== Runtime ground below spawn (partial valid sample) ===");
  console.log(partialValidGroundBelowSpawn);
  console.log("\n=== SPAWN VALIDATION ===");
  console.log("(partial valid sample)");
  console.dir(partialValidSpawnValidation, { depth: null });
  console.log("\n=== LANDING CELL BELOW SPAWN ===");
  console.log("(partial valid sample)");
  console.dir(partialLandingCellBelowSpawn, { depth: null });
  console.log("\n=== SPAWN DROP SUMMARY ===");
  console.log("(partial valid sample)");
  console.dir(partialSpawnDropSummary, { depth: null });
  console.log("\n=== PLAYER START PLACEMENT ===");
  console.log("(partial valid sample)");
  console.dir(partialPlayerStartPlacement, { depth: null });
  console.log("\n=== PLAYER SPAWN PACKET ===");
  console.log("(partial valid sample)");
  console.dir(partialPlayerSpawnPacket, { depth: null });
  console.log("\n=== PLAYER START STATE ===");
  console.log("(partial valid sample)");
  console.dir(partialPlayerStartState, { depth: null });
  console.log("\n=== PLAYER STEP STATE ===");
  console.log("(partial valid sample)");
  console.dir(partialPlayerStepState, { depth: null });
  console.log("\n=== PLAYER FALL SIMULATION ===");
  console.log("(partial valid sample)");
  console.dir(partialPlayerFallSimulation, { depth: null });
  console.log("\n=== PLAYER BOOTSTRAP ===");
  console.log("(partial valid sample)");
  console.dir(partialPlayerBootstrap, { depth: null });
  console.log("\n=== RUNTIME INITIALIZATION PACKET ===");
  console.log("(partial valid sample)");
  console.dir(partialRuntimeInitializationPacket, { depth: null });
  console.log("\n=== RUNTIME SESSION STATE ===");
  console.log("(partial valid sample)");
  console.dir(partialRuntimeSessionState, { depth: null });
  console.log("\n=== RUNTIME NEXT SESSION STATE ===");
  console.log("(partial valid sample)");
  console.dir(partialNextRuntimeSessionState, { depth: null });
  console.log("\n=== RUNTIME SESSION UPDATE ===");
  console.log("(partial valid sample)");
  console.dir(partialRuntimeSessionUpdate, { depth: null });
  console.log("\n=== RUNTIME RUNNER SESSION ===");
  console.log("(partial valid sample)");
  console.dir(partialRuntimeRunnerSession, { depth: null });
  console.log("\n=== RUNTIME RUNNER TICKS ===");
  console.log("(partial valid sample)");
  console.dir(partialRuntimeRunnerTicks, { depth: null });
  console.log("\n=== RUNTIME LEVEL SIMULATION ===");
  console.log("(partial valid sample)");
  console.dir(partialRuntimeLevelSimulation, { depth: null });
  console.log("\n=== RUNTIME START FROM DOCUMENT ===");
  console.log("(partial valid sample)");
  console.dir(partialRuntimeStartFromDocument, { depth: null });
  console.log("\n=== RUNTIME START SUMMARY ===");
  console.log("(partial valid sample)");
  console.dir(partialRuntimeStartSummaryFromDocument, { depth: null });
  // Keep one sparse-sample lookup so missing tiles remain easy to verify.
  console.log("\n=== Runtime tile lookup (partial valid sample) ===");
  const partialLookupTests = [
    { grid: [0, 0], tile: getRuntimeTileAtGrid(partialValidWorldPacket, 0, 0) },
  ];
  console.dir(partialLookupTests, { depth: null });
  // Run one solidity probe against sparse data to verify false behavior.
  console.log("\n=== Runtime grid solidity (partial valid sample) ===");
  const partialSolidityTests = [
    { grid: [0, 0], solid: isRuntimeGridSolid(partialValidWorldPacket, 0, 0) },
  ];
  console.dir(partialSolidityTests, { depth: null });

  logLoaderResult("Invalid sample (missing world.spawn)", invalidResult);
  console.log("\n=== SPAWN VALIDATION ===");
  console.log("(invalid sample)");
  console.dir(invalidSpawnValidation, { depth: null });
  console.log("\n=== LANDING CELL BELOW SPAWN ===");
  console.log("(invalid sample)");
  console.dir(invalidLandingCellBelowSpawn, { depth: null });
  console.log("\n=== SPAWN DROP SUMMARY ===");
  console.log("(invalid sample)");
  console.dir(invalidSpawnDropSummary, { depth: null });
  console.log("\n=== PLAYER START PLACEMENT ===");
  console.log("(invalid sample)");
  console.dir(invalidPlayerStartPlacement, { depth: null });
  console.log("\n=== PLAYER SPAWN PACKET ===");
  console.log("(invalid sample)");
  console.dir(invalidPlayerSpawnPacket, { depth: null });
  console.log("\n=== PLAYER START STATE ===");
  console.log("(invalid sample)");
  console.dir(invalidPlayerStartState, { depth: null });
  console.log("\n=== PLAYER STEP STATE ===");
  console.log("(invalid sample)");
  console.dir(invalidPlayerStepState, { depth: null });
  console.log("\n=== PLAYER FALL SIMULATION ===");
  console.log("(invalid sample)");
  console.dir(invalidPlayerFallSimulation, { depth: null });
  console.log("\n=== PLAYER BOOTSTRAP ===");
  console.log("(invalid sample)");
  console.dir(invalidPlayerBootstrap, { depth: null });
  console.log("\n=== RUNTIME INITIALIZATION PACKET ===");
  console.log("(invalid sample)");
  console.dir(invalidRuntimeInitializationPacket, { depth: null });
  console.log("\n=== RUNTIME SESSION STATE ===");
  console.log("(invalid sample)");
  console.dir(invalidRuntimeSessionState, { depth: null });
  console.log("\n=== RUNTIME NEXT SESSION STATE ===");
  console.log("(invalid sample)");
  console.dir(invalidNextRuntimeSessionState, { depth: null });
  console.log("\n=== RUNTIME SESSION UPDATE ===");
  console.log("(invalid sample)");
  console.dir(invalidRuntimeSessionUpdate, { depth: null });

  console.log("\n=== RUNTIME RUNNER SESSION ===");
  console.log("(invalid sample)");
  console.dir(invalidRuntimeRunnerSession, { depth: null });
  console.log("\n=== RUNTIME RUNNER TICKS ===");
  console.log("(invalid sample)");
  console.dir(invalidRuntimeRunnerTicks, { depth: null });
  console.log("\n=== RUNTIME LEVEL SIMULATION ===");
  console.log("(invalid sample)");
  console.dir(invalidRuntimeLevelSimulation, { depth: null });
  console.log("\n=== RUNTIME START FROM DOCUMENT ===");
  console.log("(invalid sample)");
  console.dir(invalidRuntimeStartFromDocument, { depth: null });
  console.log("\n=== RUNTIME START FROM PATH ===");
  console.log("(invalid sample)");
  console.dir(invalidRuntimeStartFromPath, { depth: null });
  console.log("\n=== RUNTIME START SUMMARY ===");
  console.log("(invalid sample)");
  console.dir(
    {
      fromDocument: invalidRuntimeStartSummaryFromDocument,
      fromPath: invalidRuntimeStartSummaryFromPath,
    },
    { depth: null },
  );

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
    validSpawnNeighborhood,
    partialValidSpawnNeighborhood,
    validGroundBelowSpawn,
    partialValidGroundBelowSpawn,
    validSpawnValidation,
    partialValidSpawnValidation,
    invalidSpawnValidation,
    validLandingCellBelowSpawn,
    partialLandingCellBelowSpawn,
    invalidLandingCellBelowSpawn,
    validSpawnDropSummary,
    partialSpawnDropSummary,
    invalidSpawnDropSummary,
    validPlayerStartPlacement,
    partialPlayerStartPlacement,
    invalidPlayerStartPlacement,
    validPlayerSpawnPacket,
    partialPlayerSpawnPacket,
    invalidPlayerSpawnPacket,
    validPlayerStartState,
    partialPlayerStartState,
    invalidPlayerStartState,
    validPlayerStepState,
    partialPlayerStepState,
    invalidPlayerStepState,
    validPlayerFallSimulation,
    partialPlayerFallSimulation,
    invalidPlayerFallSimulation,
    validPlayerBootstrap,
    partialPlayerBootstrap,
    invalidPlayerBootstrap,
    validRuntimeInitializationPacket,
    partialRuntimeInitializationPacket,
    invalidRuntimeInitializationPacket,
    validRuntimeSessionState,
    partialRuntimeSessionState,
    invalidRuntimeSessionState,
    validNextRuntimeSessionState,
    partialNextRuntimeSessionState,
    invalidNextRuntimeSessionState,
    validRuntimeSessionUpdate,
    partialRuntimeSessionUpdate,
    invalidRuntimeSessionUpdate,
    validRuntimeRunnerSession,
    partialRuntimeRunnerSession,
    invalidRuntimeRunnerSession,
    validRuntimeRunnerTicks,
    partialRuntimeRunnerTicks,
    invalidRuntimeRunnerTicks,
    validRuntimeLevelSimulation,
    partialRuntimeLevelSimulation,
    invalidRuntimeLevelSimulation,
    validRuntimeStartFromDocument,
    partialRuntimeStartFromDocument,
    invalidRuntimeStartFromDocument,
    validRuntimeStartFromPath,
    invalidRuntimeStartFromPath,
    validRuntimeStartSummaryFromDocument,
    validRuntimeStartSummaryFromPath,
    partialRuntimeStartSummaryFromDocument,
    invalidRuntimeStartSummaryFromDocument,
    invalidRuntimeStartSummaryFromPath,
    invalidResult,
  };
}

// Invoke automatically so importing/running this file prints output immediately.
await runDebugLevelLoaderHarness();
