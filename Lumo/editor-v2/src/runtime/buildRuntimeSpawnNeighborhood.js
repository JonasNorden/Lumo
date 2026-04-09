import { isRuntimeGridSolid } from "./isRuntimeGridSolid.js";

const NEIGHBOR_OFFSETS = [
  { dx: -1, dy: -1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: -1, dy: 1 },
  { dx: 0, dy: 1 },
  { dx: 1, dy: 1 },
];

// Builds a fixed 3x3 grid neighborhood around the runtime spawn center.
export function buildRuntimeSpawnNeighborhood(worldPacket, spawnPoint) {
  // Fall back to origin when spawn data is missing so callers always get a safe shape.
  const center = {
    gridX: spawnPoint?.gridX ?? 0,
    gridY: spawnPoint?.gridY ?? 0,
  };

  // Keep this pure: derive each cell directly from center + offset.
  const cells = NEIGHBOR_OFFSETS.map(({ dx, dy }) => {
    const gridX = center.gridX + dx;
    const gridY = center.gridY + dy;

    return {
      dx,
      dy,
      gridX,
      gridY,
      solid: worldPacket ? isRuntimeGridSolid(worldPacket, gridX, gridY) : false,
    };
  });

  return { center, cells };
}
