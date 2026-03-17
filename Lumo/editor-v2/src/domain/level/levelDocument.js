/**
 * @typedef LevelDocument
 * @property {{id: string, name: string, version: string}} meta
 * @property {{width: number, height: number, tileSize: number}} dimensions
 * @property {{base: number[]}} tiles
 * @property {{layers: {id: string, name: string, visible: boolean, color: string}[]}} backgrounds
 * @property {{notes?: string}} extra
 */

function normalizeBackgroundLayer(layer, index) {
  const fallbackId = `bg-${index + 1}`;
  const nextId = typeof layer?.id === "string" && layer.id.trim() ? layer.id : fallbackId;
  const nextName = typeof layer?.name === "string" && layer.name.trim() ? layer.name : `Background ${index + 1}`;
  const nextVisible = typeof layer?.visible === "boolean" ? layer.visible : true;
  const nextColor = typeof layer?.color === "string" && layer.color ? layer.color : "#1b2436";

  return {
    id: nextId,
    name: nextName,
    visible: nextVisible,
    color: nextColor,
  };
}

/**
 * @param {LevelDocument} doc
 * @returns {LevelDocument}
 */
export function validateLevelDocument(doc) {
  if (!doc?.meta?.id || !doc?.meta?.name) {
    throw new Error("Invalid V2 document metadata");
  }

  if (typeof doc.meta.version !== "string" || !doc.meta.version.startsWith("2.")) {
    throw new Error("Invalid V2 document version");
  }

  const { width, height } = doc.dimensions || {};
  const expectedCount = width * height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Invalid V2 document dimensions");
  }

  if (!Array.isArray(doc.tiles?.base) || doc.tiles.base.length !== expectedCount) {
    throw new Error(`Invalid V2 tile payload (expected ${expectedCount} tiles)`);
  }

  if (!doc.tiles.base.every((tile) => Number.isInteger(tile) && tile >= 0)) {
    throw new Error("Invalid V2 tile payload (tiles must be non-negative integers)");
  }

  const rawLayers = doc.backgrounds?.layers;
  const layers = Array.isArray(rawLayers) ? rawLayers : [];
  doc.backgrounds = {
    layers: layers.map((layer, index) => normalizeBackgroundLayer(layer, index)),
  };

  return doc;
}

export function getTileIndex(width, x, y) {
  return y * width + x;
}
