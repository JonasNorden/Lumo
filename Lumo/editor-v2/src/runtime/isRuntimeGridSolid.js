import { getRuntimeTileAtGrid } from "./getRuntimeTileAtGrid.js";
import { isRuntimeTileBlocking, resolveRuntimeTileBehavior } from "./runtimeTileBehavior.js";

// Returns true when a runtime tile blocks movement at the provided grid coordinate.
export function isRuntimeGridSolid(worldPacket, gridX, gridY, options = {}) {
  if (!worldPacket) {
    return false;
  }

  const tile = getRuntimeTileAtGrid(worldPacket, gridX, gridY);
  if (!tile) {
    return false;
  }

  const behavior = resolveRuntimeTileBehavior(tile);
  return isRuntimeTileBlocking(behavior, { includeOneWay: options?.includeOneWay === true });
}
