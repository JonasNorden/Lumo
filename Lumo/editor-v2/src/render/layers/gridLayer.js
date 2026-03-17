export function renderGrid(ctx, doc, viewport) {
  const { width, height, tileSize } = doc.dimensions;
  const cell = tileSize * viewport.zoom;

  ctx.strokeStyle = "rgba(111, 133, 175, 0.23)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += 1) {
    const px = Math.round(viewport.offsetX + x * cell) + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, viewport.offsetY);
    ctx.lineTo(px, viewport.offsetY + height * cell);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += 1) {
    const py = Math.round(viewport.offsetY + y * cell) + 0.5;
    ctx.beginPath();
    ctx.moveTo(viewport.offsetX, py);
    ctx.lineTo(viewport.offsetX + width * cell, py);
    ctx.stroke();
  }
}
