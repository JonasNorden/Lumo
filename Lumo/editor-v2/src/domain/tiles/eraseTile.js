import { getTileIndex } from "../level/levelDocument.js";

export const EMPTY_TILE_VALUE = 0;

export function eraseSingleTile(doc, cell) {
  const { width, height } = doc.dimensions;
  if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) {
    return false;
  }

  const index = getTileIndex(width, cell.x, cell.y);
  if (doc.tiles.base[index] === EMPTY_TILE_VALUE) {
    return false;
  }

  doc.tiles.base[index] = EMPTY_TILE_VALUE;
  return true;
}
