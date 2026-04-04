import { getTileIndex } from "../level/levelDocument.js";
import { findBrushSpriteOptionByValue } from "./tileSpriteCatalog.js";

const BRUSH_BEHAVIOR_TO_TILE = {
  solid: 1,
  "one-way": 2,
  hazard: 3,
  ice: 4,
  brake: 5,
  sticky: 1,
  rapid: 1,
};

export function resolveTileFromBrushDraft(brushDraft) {
  const spriteOption = findBrushSpriteOptionByValue(brushDraft.sprite);
  if (spriteOption && Number.isInteger(spriteOption.tileId)) {
    return spriteOption.tileId;
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
