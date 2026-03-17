function drawCellOverlay(ctx, viewport, tileSize, cell, style) {
  if (!cell) return;

  const size = tileSize * viewport.zoom;
  const px = Math.floor(viewport.offsetX + cell.x * size);
  const py = Math.floor(viewport.offsetY + cell.y * size);

  if (style.fill) {
    ctx.fillStyle = style.fill;
    ctx.fillRect(px, py, Math.ceil(size), Math.ceil(size));
  }

  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.lineWidth;
  ctx.strokeRect(px + 0.5, py + 0.5, Math.ceil(size) - 1, Math.ceil(size) - 1);
}

export function renderSelectionOverlay(ctx, doc, viewport, interaction) {
  const tileSize = doc.dimensions.tileSize;

  drawCellOverlay(ctx, viewport, tileSize, interaction.hoverCell, {
    fill: "rgba(120, 173, 255, 0.10)",
    stroke: "rgba(120, 173, 255, 0.55)",
    lineWidth: 1,
  });

  drawCellOverlay(ctx, viewport, tileSize, interaction.selectedCell, {
    fill: "rgba(255, 211, 107, 0.18)",
    stroke: "rgba(255, 211, 107, 0.95)",
    lineWidth: 2,
  });
}
