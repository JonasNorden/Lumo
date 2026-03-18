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

function drawCanvasRectOverlay(ctx, rect, style) {
  if (!rect) return;

  const minX = Math.min(rect.startPoint.x, rect.currentPoint.x);
  const maxX = Math.max(rect.startPoint.x, rect.currentPoint.x);
  const minY = Math.min(rect.startPoint.y, rect.currentPoint.y);
  const maxY = Math.max(rect.startPoint.y, rect.currentPoint.y);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  ctx.save();
  ctx.fillStyle = style.fill;
  ctx.fillRect(minX, minY, width, height);
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.lineWidth;
  ctx.setLineDash(style.lineDash || []);
  ctx.strokeRect(minX + 0.5, minY + 0.5, width - 1, height - 1);
  ctx.restore();
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

  if (interaction.entityDrag?.active) {
    const delta = interaction.entityDrag.previewDelta || { x: 0, y: 0 };

    for (const origin of interaction.entityDrag.originPositions || []) {
      drawCellOverlay(ctx, viewport, tileSize, {
        x: origin.x + delta.x,
        y: origin.y + delta.y,
      }, {
        fill: "rgba(255, 214, 138, 0.18)",
        stroke: "rgba(255, 214, 138, 0.86)",
        lineWidth: 1.5,
      });
    }
  }

  drawCanvasRectOverlay(ctx, interaction.boxSelection, {
    fill: "rgba(125, 231, 255, 0.12)",
    stroke: "rgba(125, 231, 255, 0.72)",
    lineWidth: 1.25,
    lineDash: [6, 4],
  });
}
