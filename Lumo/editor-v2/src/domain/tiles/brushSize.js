import {
  getFallbackBrushSizeForSprite,
  isBrushSizeSupportedForSprite,
} from "./tileSpriteCatalog.js";

const FALLBACK_BRUSH_SIZE = 1;

export function resolveBrushSize(brushDraft) {
  const fallbackSizeValue = getFallbackBrushSizeForSprite(brushDraft?.sprite);
  const rawSize = typeof brushDraft?.size === "string" ? brushDraft.size : fallbackSizeValue;
  const sizeValue = isBrushSizeSupportedForSprite(rawSize, brushDraft?.sprite)
    ? rawSize
    : fallbackSizeValue;
  const [widthToken, heightToken] = sizeValue.toLowerCase().split("x");
  const width = Number.parseInt(widthToken, 10);
  const height = Number.parseInt(heightToken, 10);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { width: FALLBACK_BRUSH_SIZE, height: FALLBACK_BRUSH_SIZE };
  }

  const normalizedWidth = Math.max(1, width);
  const normalizedHeight = Math.max(1, height);

  return {
    width: normalizedWidth,
    height: normalizedHeight,
  };
}

export function getBrushCells(centerCell, brushSize) {
  const startX = centerCell.x;
  const startY = centerCell.y - (brushSize.height - 1);

  const cells = [];
  for (let offsetY = 0; offsetY < brushSize.height; offsetY += 1) {
    for (let offsetX = 0; offsetX < brushSize.width; offsetX += 1) {
      cells.push({
        x: startX + offsetX,
        y: startY + offsetY,
      });
    }
  }

  return cells;
}

export function snapCellToBrushStep(cell, anchorCell, brushSize) {
  const widthStep = Math.max(1, brushSize?.width || 1);
  const heightStep = Math.max(1, brushSize?.height || 1);
  const originX = Number.isFinite(anchorCell?.x) ? anchorCell.x : 0;
  const originY = Number.isFinite(anchorCell?.y) ? anchorCell.y : 0;
  const deltaX = cell.x - originX;
  const deltaY = cell.y - originY;
  const alignDelta = (delta, step) => (delta >= 0
    ? Math.floor(delta / step) * step
    : Math.ceil(delta / step) * step);

  return {
    x: originX + alignDelta(deltaX, widthStep),
    y: originY + alignDelta(deltaY, heightStep),
  };
}
