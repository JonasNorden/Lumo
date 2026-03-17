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

export function clampViewportZoom(value, minZoom = 0.35, maxZoom = 4) {
  return Math.max(minZoom, Math.min(maxZoom, value));
}

export function getZoomMultiplierFromWheelDelta(deltaY) {
  return Math.exp(-deltaY * 0.0015);
}

export function zoomViewportAroundPoint(viewport, point, nextZoom) {
  const safeCurrentZoom = Math.max(0.0001, viewport.zoom);
  const worldX = (point.x - viewport.offsetX) / safeCurrentZoom;
  const worldY = (point.y - viewport.offsetY) / safeCurrentZoom;

  viewport.zoom = nextZoom;
  viewport.offsetX = point.x - worldX * nextZoom;
  viewport.offsetY = point.y - worldY * nextZoom;
}

export function panViewportByDelta(viewport, deltaX, deltaY) {
  viewport.offsetX += deltaX;
  viewport.offsetY += deltaY;
}
