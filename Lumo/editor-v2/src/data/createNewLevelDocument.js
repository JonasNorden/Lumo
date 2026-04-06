import { createDefaultBackgroundLayer, validateLevelDocument } from "../domain/level/levelDocument.js";
import { BACKGROUND_MATERIAL_OPTIONS, DEFAULT_BACKGROUND_MATERIAL_ID } from "../domain/background/materialCatalog.js";
import {
  DEFAULT_THEME_ID,
  getThemeById,
  normalizeThemeId,
  resolveThemeBackgroundMaterialId,
} from "../domain/theme/themeCatalog.js";

export const DEFAULT_NEW_LEVEL_WIDTH = 32;
export const DEFAULT_NEW_LEVEL_HEIGHT = 18;
export const DEFAULT_NEW_LEVEL_TILE_SIZE = 24;
export const MIN_LEVEL_DIMENSION = 8;
export const MAX_LEVEL_WIDTH = 1024;
export const MAX_LEVEL_HEIGHT = 64;

function getLevelDimensionMax(axis = "width") {
  return axis === "height" ? MAX_LEVEL_HEIGHT : MAX_LEVEL_WIDTH;
}

export function sanitizeLevelDimension(value, fallback = DEFAULT_NEW_LEVEL_WIDTH, axis = "width") {
  const max = getLevelDimensionMax(axis);
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed)) {
    return Math.max(MIN_LEVEL_DIMENSION, Math.min(max, fallback));
  }

  return Math.max(MIN_LEVEL_DIMENSION, Math.min(max, parsed));
}

export function isValidLevelDimension(value, axis = "width") {
  return Number.isInteger(value) && value >= MIN_LEVEL_DIMENSION && value <= getLevelDimensionMax(axis);
}

export function createNewLevelDocument(options = {}) {
  const width = sanitizeLevelDimension(options.width, DEFAULT_NEW_LEVEL_WIDTH, "width");
  const height = sanitizeLevelDimension(options.height, DEFAULT_NEW_LEVEL_HEIGHT, "height");
  const themeId = normalizeThemeId(options.themeId);
  const theme = getThemeById(themeId);
  const themeDefaultBackgroundMaterialId = resolveThemeBackgroundMaterialId(themeId);

  return validateLevelDocument({
    meta: {
      id: "new-level",
      name: "New Level",
      version: "2.0.0",
      themeId: theme?.id || DEFAULT_THEME_ID,
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
          color: theme.defaultBackgroundLayerColor,
          depth: 0,
        }),
      ],
    },
    background: {
      base: new Array(width * height).fill(null),
      placements: [],
      materials: BACKGROUND_MATERIAL_OPTIONS.map((material) => ({ ...material })),
      defaultMaterialId: themeDefaultBackgroundMaterialId || DEFAULT_BACKGROUND_MATERIAL_ID,
    },
    decor: [],
    entities: [],
    sounds: [],
    extra: {},
  });
}
