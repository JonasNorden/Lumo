import { buildRuntimeSpawnPoint } from "./buildRuntimeSpawnPoint.js";
import { isRuntimeGridSolid } from "./isRuntimeGridSolid.js";

// Finds the first non-solid cell that has solid support directly below it.
export function findRuntimeLandingCellBelowSpawn(worldPacket) {
  // Normalize spawn coordinates via the existing runtime spawn helper.
  const spawnPoint = buildRuntimeSpawnPoint({
    world: worldPacket?.world,
    spawn: worldPacket?.spawn,
  });
  const hasSpawnObject = worldPacket?.spawn !== null && typeof worldPacket?.spawn === "object";
  const hasFiniteSpawn =
    Number.isFinite(worldPacket?.spawn?.x) &&
    Number.isFinite(worldPacket?.spawn?.y) &&
    Number.isFinite(spawnPoint?.gridX) &&
    Number.isFinite(spawnPoint?.gridY);

  // Keep start shape stable, but report missing spawn as nulls.
  const start = hasSpawnObject && hasFiniteSpawn
    ? { gridX: spawnPoint.gridX, gridY: spawnPoint.gridY }
    : { gridX: null, gridY: null };

  if (!hasSpawnObject || !hasFiniteSpawn) {
    return {
      found: false,
      start,
      landingCell: null,
      supportCell: null,
      scannedRows: 0,
      reason: "missing-spawn",
    };
  }

  const worldHeight = Number.isFinite(worldPacket?.world?.height) ? worldPacket.world.height : 0;
  let scannedRows = 0;

  // Scan downward from spawn row until we leave world bounds.
  for (let gridY = spawnPoint.gridY; gridY < worldHeight; gridY += 1) {
    scannedRows += 1;
    const landingSolid = isRuntimeGridSolid(worldPacket, spawnPoint.gridX, gridY);
    const supportGridY = gridY + 1;
    const supportSolid = isRuntimeGridSolid(worldPacket, spawnPoint.gridX, supportGridY);

    if (!landingSolid && supportSolid) {
      return {
        found: true,
        start,
        landingCell: { gridX: spawnPoint.gridX, gridY },
        supportCell: { gridX: spawnPoint.gridX, gridY: supportGridY },
        scannedRows,
        reason: "landing-cell-found",
      };
    }
  }

  return {
    found: false,
    start,
    landingCell: null,
    supportCell: null,
    scannedRows,
    reason: "no-landing-cell-found",
  };
}
