// Builds a compact bounds summary from runtime tile entries.
export function buildRuntimeTileBounds(tileEntries) {
  // Fall back to an empty list when the input is not an array.
  const entries = Array.isArray(tileEntries) ? tileEntries : [];

  // Return safe defaults so callers always receive a predictable shape.
  if (entries.length === 0) {
    return {
      count: 0,
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
    };
  }

  // Seed bounds from the first entry to keep the reduction straightforward.
  const firstEntry = entries[0] ?? {};
  let minX = Number.isFinite(firstEntry.x) ? firstEntry.x : 0;
  let minY = Number.isFinite(firstEntry.y) ? firstEntry.y : 0;
  let maxX = Number.isFinite(firstEntry.x2) ? firstEntry.x2 : 0;
  let maxY = Number.isFinite(firstEntry.y2) ? firstEntry.y2 : 0;

  // Scan remaining entries and update min/max extents.
  for (let index = 1; index < entries.length; index += 1) {
    const entry = entries[index] ?? {};
    const x = Number.isFinite(entry.x) ? entry.x : 0;
    const y = Number.isFinite(entry.y) ? entry.y : 0;
    const x2 = Number.isFinite(entry.x2) ? entry.x2 : 0;
    const y2 = Number.isFinite(entry.y2) ? entry.y2 : 0;

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x2 > maxX) maxX = x2;
    if (y2 > maxY) maxY = y2;
  }

  return {
    count: entries.length,
    minX,
    minY,
    maxX,
    maxY,
  };
}
