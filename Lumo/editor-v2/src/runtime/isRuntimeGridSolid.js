import { getRuntimeTileAtGrid } from "./getRuntimeTileAtGrid.js";

// Returns true when a runtime tile exists at the provided grid coordinate.
export function isRuntimeGridSolid(worldPacket, gridX, gridY) {
  // Guard against missing packets so callers can safely probe during debug flows.
  if (!worldPacket) {
    return false;
  }

  const tile = getRuntimeTileAtGrid(worldPacket, gridX, gridY);
  return tile !== null;
}
