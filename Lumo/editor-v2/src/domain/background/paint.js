import { getTileIndex } from "../level/levelDocument.js";

export function paintBackgroundMaterial(doc, cell, materialId) {
  const { width, height } = doc.dimensions;
  if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) return false;
  const index = getTileIndex(width, cell.x, cell.y);
  if (doc.background.base[index] === materialId) return false;
  doc.background.base[index] = materialId;
  return true;
}

export function eraseBackgroundMaterial(doc, cell) {
  const { width, height } = doc.dimensions;
  if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) return false;
  const index = getTileIndex(width, cell.x, cell.y);
  if (doc.background.base[index] === null) return false;
  doc.background.base[index] = null;
  return true;
}
