// Builds a minimal runtime spawn point from a runtime world skeleton.
export function buildRuntimeSpawnPoint(skeleton) {
  const rawX = skeleton?.spawn?.x;
  const rawY = skeleton?.spawn?.y;
  const rawTileSize = skeleton?.world?.tileSize;

  const x = Number.isFinite(rawX) ? rawX : 0;
  const y = Number.isFinite(rawY) ? rawY : 0;
  const tileSize = Number.isFinite(rawTileSize) && rawTileSize > 0 ? rawTileSize : 0;

  // Keep grid coords stable even if tileSize is missing/invalid.
  const gridX = tileSize > 0 ? Math.floor(x / tileSize) : 0;
  const gridY = tileSize > 0 ? Math.floor(y / tileSize) : 0;

  return {
    x,
    y,
    tileSize,
    gridX,
    gridY,
  };
}
