function isFiniteRect(tile) {
  return (
    Number.isFinite(tile?.x) &&
    Number.isFinite(tile?.y) &&
    Number.isFinite(tile?.w) &&
    Number.isFinite(tile?.h) &&
    tile.w > 0 &&
    tile.h > 0
  );
}

function isTileSolid(tile) {
  if (typeof tile?.solid === "boolean") {
    return tile.solid;
  }

  return true;
}

function isGridSpaceByContract(worldPacket, tile) {
  const worldWidth = worldPacket?.world?.width;
  const worldHeight = worldPacket?.world?.height;

  if (!Number.isInteger(worldWidth) || !Number.isInteger(worldHeight)) {
    return false;
  }

  // Grid-authored levels keep compact world dimensions (cells), unlike pixel-authored levels.
  if (worldWidth > 256 || worldHeight > 256) {
    return false;
  }

  return (
    Number.isInteger(tile.x) &&
    Number.isInteger(tile.y) &&
    Number.isInteger(tile.w) &&
    Number.isInteger(tile.h) &&
    tile.x >= 0 &&
    tile.y >= 0 &&
    tile.x + tile.w <= worldWidth &&
    tile.y + tile.h <= worldHeight
  );
}

function tileCoversGridPosition(worldPacket, tile, gridX, gridY) {
  const coordinateSpace = tile?.coordinateSpace;

  if (coordinateSpace === "grid" || (coordinateSpace == null && isGridSpaceByContract(worldPacket, tile))) {
    return (
      gridX >= tile.x &&
      gridX < tile.x + tile.w &&
      gridY >= tile.y &&
      gridY < tile.y + tile.h
    );
  }

  const tileSize = worldPacket?.world?.tileSize;
  if (!Number.isFinite(tileSize) || tileSize <= 0) {
    return false;
  }

  const worldX = gridX * tileSize;
  const worldY = gridY * tileSize;
  return (
    worldX >= tile.x &&
    worldX < tile.x + tile.w &&
    worldY >= tile.y &&
    worldY < tile.y + tile.h
  );
}

// Returns the first solid runtime tile covering a grid position in world space.
export function getRuntimeTileAtGrid(worldPacket, gridX, gridY) {
  const tiles = worldPacket?.layers?.tiles;
  if (!Array.isArray(tiles)) {
    return null;
  }

  for (const tile of tiles) {
    if (!isFiniteRect(tile) || !isTileSolid(tile)) {
      continue;
    }

    if (tileCoversGridPosition(worldPacket, tile, gridX, gridY)) {
      return tile;
    }
  }

  return null;
}
