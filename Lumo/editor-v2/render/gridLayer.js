export function drawGrid(ctx, viewport, tileSize, canvasWidth, canvasHeight) {
  const gridSize = tileSize * viewport.zoom;
  const startX = (-viewport.camera.x * viewport.zoom) % gridSize;
  const startY = (-viewport.camera.y * viewport.zoom) % gridSize;

  ctx.strokeStyle = "rgba(116, 145, 191, 0.22)";
  ctx.lineWidth = 1;

  for (let x = startX; x < canvasWidth; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(Math.floor(x) + 0.5, 0);
    ctx.lineTo(Math.floor(x) + 0.5, canvasHeight);
    ctx.stroke();
  }

  for (let y = startY; y < canvasHeight; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, Math.floor(y) + 0.5);
    ctx.lineTo(canvasWidth, Math.floor(y) + 0.5);
    ctx.stroke();
  }
}
