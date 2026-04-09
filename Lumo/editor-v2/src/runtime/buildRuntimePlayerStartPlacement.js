import { buildRuntimeSpawnValidation } from "./buildRuntimeSpawnValidation.js";
import { buildRuntimeSpawnDropSummary } from "./buildRuntimeSpawnDropSummary.js";
import { buildRuntimeSpawnPoint } from "./buildRuntimeSpawnPoint.js";

// Builds a deterministic debug snapshot of where a runtime player start would be placed.
export function buildRuntimePlayerStartPlacement(worldPacket) {
  // Reuse existing spawn validation/drop helpers so placement status stays aligned.
  const validation = buildRuntimeSpawnValidation(worldPacket);
  const dropSummary = buildRuntimeSpawnDropSummary(worldPacket);
  const spawnPoint = buildRuntimeSpawnPoint({
    world: worldPacket?.world,
    spawn: worldPacket?.spawn,
  });

  const notes = [];
  const errors = [];
  const tileSizeRaw = worldPacket?.world?.tileSize;
  const tileSize = Number.isFinite(tileSizeRaw) && tileSizeRaw > 0 ? tileSizeRaw : null;

  let ok = false;
  let source = "missing-spawn";
  let grid = { x: null, y: null };

  // Fail early when spawn data is missing/invalid.
  if (validation?.checks?.hasSpawn !== true) {
    errors.push("Spawn is missing or invalid.");
    return {
      ok,
      source,
      grid,
      pixel: { x: null, y: null },
      tileSize,
      notes,
      errors,
    };
  }

  // Keep blocked spawn handling explicit before drop-status routing.
  if (validation?.checks?.spawnTileSolid === true) {
    source = "blocked-spawn";
    errors.push("Spawn is blocked by a solid tile.");
    return {
      ok,
      source,
      grid,
      pixel: { x: null, y: null },
      tileSize,
      notes,
      errors,
    };
  }

  // Route placement source deterministically from existing drop summary statuses.
  switch (dropSummary?.status) {
    case "standing-on-landing":
      ok = true;
      source = "spawn-cell";
      grid = { x: dropSummary?.start?.gridX ?? null, y: dropSummary?.start?.gridY ?? null };
      break;
    case "fall-to-landing":
      ok = true;
      source = "landing-cell";
      grid = {
        x: dropSummary?.landingCell?.gridX ?? null,
        y: dropSummary?.landingCell?.gridY ?? null,
      };
      break;
    case "no-landing-found":
      ok = true;
      source = "spawn-cell-no-landing";
      grid = { x: spawnPoint?.gridX ?? null, y: spawnPoint?.gridY ?? null };
      notes.push("No landing cell was found below spawn; using spawn cell for debug placement.");
      break;
    case "grounded-at-spawn":
      ok = true;
      source = "spawn-cell-grounded";
      grid = { x: dropSummary?.start?.gridX ?? null, y: dropSummary?.start?.gridY ?? null };
      break;
    default:
      ok = true;
      source = "spawn-cell";
      grid = { x: spawnPoint?.gridX ?? null, y: spawnPoint?.gridY ?? null };
      break;
  }

  // Convert resolved grid placement to top-left pixel coordinates using world tile size.
  const hasGrid = Number.isFinite(grid.x) && Number.isFinite(grid.y);
  const pixel = hasGrid && Number.isFinite(tileSize)
    ? { x: grid.x * tileSize, y: grid.y * tileSize }
    : { x: null, y: null };

  return {
    ok,
    source,
    grid,
    pixel,
    tileSize,
    notes,
    errors,
  };
}
