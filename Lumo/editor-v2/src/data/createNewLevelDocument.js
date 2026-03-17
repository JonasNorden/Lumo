import { validateLevelDocument } from "../domain/level/levelDocument.js";

const DEFAULT_WIDTH = 32;
const DEFAULT_HEIGHT = 18;
const DEFAULT_TILE_SIZE = 24;

export function createNewLevelDocument() {
  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;

  return validateLevelDocument({
    meta: {
      id: "new-level",
      name: "New Level",
      version: "2.0.0",
    },
    dimensions: {
      width,
      height,
      tileSize: DEFAULT_TILE_SIZE,
    },
    tiles: {
      base: new Array(width * height).fill(0),
    },
    extra: {},
  });
}
