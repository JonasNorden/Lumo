import { buildRuntimeSpawnPoint } from "./buildRuntimeSpawnPoint.js";
import { hasRuntimeGroundBelowSpawn } from "./hasRuntimeGroundBelowSpawn.js";
import { isRuntimeGridSolid } from "./isRuntimeGridSolid.js";

// Builds a focused, defensive spawn validation snapshot from one runtime world packet.
export function buildRuntimeSpawnValidation(worldPacket) {
  // Normalize the packet spawn into grid coordinates so checks stay consistent.
  const runtimeSpawnPoint = buildRuntimeSpawnPoint({
    world: worldPacket?.world,
    spawn: worldPacket?.spawn,
  });

  // Keep hasSpawn strict: packet must carry spawn data and produce numeric grid coordinates.
  const hasSpawn =
    worldPacket?.spawn !== null &&
    typeof worldPacket?.spawn === "object" &&
    Number.isFinite(runtimeSpawnPoint.gridX) &&
    Number.isFinite(runtimeSpawnPoint.gridY);

  // Validate spawn grid bounds using runtime world dimensions.
  const worldWidth = worldPacket?.world?.width;
  const worldHeight = worldPacket?.world?.height;
  const hasWorldBounds = Number.isFinite(worldWidth) && Number.isFinite(worldHeight);
  const spawnInsideWorld =
    hasSpawn &&
    hasWorldBounds &&
    runtimeSpawnPoint.gridX >= 0 &&
    runtimeSpawnPoint.gridY >= 0 &&
    runtimeSpawnPoint.gridX < worldWidth &&
    runtimeSpawnPoint.gridY < worldHeight;

  // Probe the spawn tile and the tile directly below with existing runtime helpers.
  const spawnTileSolid = hasSpawn
    ? isRuntimeGridSolid(worldPacket, runtimeSpawnPoint.gridX, runtimeSpawnPoint.gridY)
    : false;
  const groundBelowSpawn = hasSpawn
    ? hasRuntimeGroundBelowSpawn(worldPacket, runtimeSpawnPoint).solidBelow
    : false;

  const warnings = [];
  const errors = [];

  // Keep warning/error messages short and debug-friendly for harness output.
  if (!groundBelowSpawn) {
    warnings.push("Spawn has no solid ground directly below.");
  }
  if (!hasSpawn) {
    errors.push("Spawn is missing or invalid.");
  }
  if (!spawnInsideWorld) {
    errors.push("Spawn is outside world bounds.");
  }
  if (spawnTileSolid) {
    errors.push("Spawn is inside a solid tile.");
  }

  return {
    ok: hasSpawn && spawnInsideWorld && !spawnTileSolid,
    checks: {
      hasSpawn,
      spawnInsideWorld,
      spawnTileSolid,
      groundBelowSpawn,
    },
    warnings,
    errors,
  };
}
