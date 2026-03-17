import { getTileIndex } from "../level/levelDocument.js";

const BRUSH_BEHAVIOR_TO_TILE = {
  solid: 1,
  hazard: 2,
  accent: 3,
};

const BRUSH_SPRITE_TO_TILE = {
  void_1: 0,
};

export function resolveTileFromBrushDraft(brushDraft) {
  if (BRUSH_SPRITE_TO_TILE[brushDraft.sprite] !== undefined) {
    return BRUSH_SPRITE_TO_TILE[brushDraft.sprite];
  }

  return BRUSH_BEHAVIOR_TO_TILE[brushDraft.behavior] ?? 1;
}

export function paintSingleTile(doc, cell, tileValue) {
  const { width, height } = doc.dimensions;
  if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) {
    return false;
  }

  const index = getTileIndex(width, cell.x, cell.y);
  if (doc.tiles.base[index] === tileValue) {
    return false;
  }

  doc.tiles.base[index] = tileValue;
  return true;
}
