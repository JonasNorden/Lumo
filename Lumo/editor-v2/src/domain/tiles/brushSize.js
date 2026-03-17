const FALLBACK_BRUSH_SIZE = 1;

export function resolveBrushSize(brushDraft) {
  const rawSize = typeof brushDraft?.size === "string" ? brushDraft.size : "";
  const [widthToken, heightToken] = rawSize.toLowerCase().split("x");
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
  const startX = centerCell.x - Math.floor((brushSize.width - 1) * 0.5);
  const startY = centerCell.y - Math.floor((brushSize.height - 1) * 0.5);

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
