import { createDefaultBackgroundLayer, validateLevelDocument } from "../domain/level/levelDocument.js";
import { BACKGROUND_MATERIAL_OPTIONS, DEFAULT_BACKGROUND_MATERIAL_ID } from "../domain/background/materialCatalog.js";

export const DEFAULT_NEW_LEVEL_WIDTH = 32;
export const DEFAULT_NEW_LEVEL_HEIGHT = 18;
export const DEFAULT_NEW_LEVEL_TILE_SIZE = 24;
export const MIN_LEVEL_DIMENSION = 8;
export const MAX_LEVEL_DIMENSION = 1024;

export function sanitizeLevelDimension(value, fallback = DEFAULT_NEW_LEVEL_WIDTH) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed)) {
    return Math.max(MIN_LEVEL_DIMENSION, Math.min(MAX_LEVEL_DIMENSION, fallback));
  }

  return Math.max(MIN_LEVEL_DIMENSION, Math.min(MAX_LEVEL_DIMENSION, parsed));
}

export function isValidLevelDimension(value) {
  return Number.isInteger(value) && value >= MIN_LEVEL_DIMENSION && value <= MAX_LEVEL_DIMENSION;
}

export function createNewLevelDocument(options = {}) {
  const width = sanitizeLevelDimension(options.width, DEFAULT_NEW_LEVEL_WIDTH);
  const height = sanitizeLevelDimension(options.height, DEFAULT_NEW_LEVEL_HEIGHT);

  return validateLevelDocument({
    meta: {
      id: "new-level",
      name: "New Level",
      version: "2.0.0",
    },
    dimensions: {
      width,
      height,
      tileSize: DEFAULT_NEW_LEVEL_TILE_SIZE,
    },
    tiles: {
      base: new Array(width * height).fill(0),
      placements: [],
    },
    backgrounds: {
      layers: [
        createDefaultBackgroundLayer(0, {
          id: "sky",
          name: "Sky",
          color: "#1a1f2b",
          depth: 0,
        }),
      ],
    },
    background: {
      base: new Array(width * height).fill(null),
      placements: [],
      materials: BACKGROUND_MATERIAL_OPTIONS.map((material) => ({ ...material })),
      defaultMaterialId: DEFAULT_BACKGROUND_MATERIAL_ID,
    },
    decor: [],
    entities: [],
    sounds: [],
    extra: {},
  });
}
