// Returns the first runtime tile covering a grid position in world space.
export function getRuntimeTileAtGrid(worldPacket, gridX, gridY) {
  const tileSize = worldPacket?.world?.tileSize;
  if (typeof tileSize !== "number" || tileSize <= 0) {
    return null;
  }

  const tiles = worldPacket?.layers?.tiles;
  if (!Array.isArray(tiles)) {
    return null;
  }

  // Convert the grid coordinate into the world coordinate for hit testing.
  const worldX = gridX * tileSize;
  const worldY = gridY * tileSize;

  // Return the first tile whose world-space bounds include this grid position.
  for (const tile of tiles) {
    const tileX = tile?.x;
    const tileY = tile?.y;
    const tileW = tile?.w;
    const tileH = tile?.h;

    if (
      typeof tileX !== "number" ||
      typeof tileY !== "number" ||
      typeof tileW !== "number" ||
      typeof tileH !== "number"
    ) {
      continue;
    }

    if (
      worldX >= tileX &&
      worldX < tileX + tileW &&
      worldY >= tileY &&
      worldY < tileY + tileH
    ) {
      return tile;
    }
  }

  return null;
}
