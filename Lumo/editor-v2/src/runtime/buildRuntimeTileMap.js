// Builds a simple runtime tile map keyed by tile bounds.
export function buildRuntimeTileMap(tileEntries) {
  const safeTileEntries = Array.isArray(tileEntries) ? tileEntries : [];
  const keys = safeTileEntries.map(({ x, y, w, h }) => `${x},${y},${w},${h}`);

  // Keep direct lookup object for fast debugging and read access by key.
  const byKey = {};
  keys.forEach((key, index) => {
    byKey[key] = safeTileEntries[index];
  });

  return {
    count: safeTileEntries.length,
    keys,
    byKey,
  };
}
