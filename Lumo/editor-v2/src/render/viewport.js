export function getCellFromCanvasPoint(doc, viewport, pointX, pointY) {
  const { width, height, tileSize } = doc.dimensions;
  const cellSize = tileSize * viewport.zoom;

  const localX = pointX - viewport.offsetX;
  const localY = pointY - viewport.offsetY;

  if (localX < 0 || localY < 0) return null;

  const x = Math.floor(localX / cellSize);
  const y = Math.floor(localY / cellSize);

  if (x < 0 || y < 0 || x >= width || y >= height) return null;

  return { x, y };
}

export function getCanvasPointFromMouseEvent(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}
