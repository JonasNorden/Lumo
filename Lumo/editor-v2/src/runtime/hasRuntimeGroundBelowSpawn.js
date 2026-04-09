import { isRuntimeGridSolid } from "./isRuntimeGridSolid.js";

// Checks solidity one grid cell directly below the provided runtime spawn point.
export function hasRuntimeGroundBelowSpawn(worldPacket, spawnPoint) {
  // Keep defaults deterministic so debug probes stay stable when spawn is missing.
  const spawnGridX = spawnPoint?.gridX;
  const spawnGridY = spawnPoint?.gridY;

  const gridX = Number.isFinite(spawnGridX) ? spawnGridX : 0;
  const gridY = Number.isFinite(spawnGridY) ? spawnGridY + 1 : 1;
  const solidBelow = worldPacket ? isRuntimeGridSolid(worldPacket, gridX, gridY) : false;

  return {
    gridX,
    gridY,
    solidBelow,
  };
}
