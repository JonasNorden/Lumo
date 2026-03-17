/**
 * @typedef LevelDocument
 * @property {{id: string, name: string, version: string}} meta
 * @property {{width: number, height: number, tileSize: number}} dimensions
 * @property {{base: number[]}} tiles
 * @property {{notes?: string}} extra
 */

/**
 * @param {LevelDocument} doc
 * @returns {LevelDocument}
 */
export function validateLevelDocument(doc) {
  if (!doc?.meta?.id || !doc?.meta?.name) {
    throw new Error("Invalid V2 document metadata");
  }

  const { width, height } = doc.dimensions || {};
  const expectedCount = width * height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Invalid V2 document dimensions");
  }

  if (!Array.isArray(doc.tiles?.base) || doc.tiles.base.length !== expectedCount) {
    throw new Error(`Invalid V2 tile payload (expected ${expectedCount} tiles)`);
  }

  return doc;
}

export function getTileIndex(width, x, y) {
  return y * width + x;
}
