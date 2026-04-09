// Builds normalized runtime tile entries from a runtime world skeleton.
export function buildRuntimeTileEntries(skeleton) {
  // Keep tile source lookup defensive so partial samples can be inspected safely.
  const tiles = Array.isArray(skeleton?.layers?.tiles) ? skeleton.layers.tiles : [];

  // Map to a fixed runtime shape with explicit bounds for easy debugging.
  return tiles.map((tile) => {
    const tileId = tile?.tileId;
    const x = tile?.x;
    const y = tile?.y;
    const w = tile?.w == null ? 1 : tile.w;
    const h = tile?.h == null ? 1 : tile.h;

    return {
      tileId,
      x,
      y,
      w,
      h,
      x2: x + w,
      y2: y + h,
    };
  });
}
