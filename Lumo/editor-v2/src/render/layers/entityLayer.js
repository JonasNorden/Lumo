function getEntityCenter(entity, tileSize) {
  return {
    x: (entity.x + 0.5) * tileSize,
    y: (entity.y + 0.5) * tileSize,
  };
}

function getEntityScreenCenter(entity, tileSize, viewport) {
  const center = getEntityCenter(entity, tileSize);
  return {
    x: viewport.offsetX + center.x * viewport.zoom,
    y: viewport.offsetY + center.y * viewport.zoom,
  };
}

export function findEntityAtCanvasPoint(doc, viewport, pointX, pointY, radius = 9) {
  const entities = doc.entities || [];
  const tileSize = doc.dimensions.tileSize;
  const scaledRadius = radius * viewport.zoom;

  for (let i = entities.length - 1; i >= 0; i -= 1) {
    const entity = entities[i];
    if (!entity.visible) continue;

    const center = getEntityScreenCenter(entity, tileSize, viewport);
    const dx = pointX - center.x;
    const dy = pointY - center.y;

    if (dx * dx + dy * dy <= scaledRadius * scaledRadius) {
      return i;
    }
  }

  return -1;
}

export function renderEntities(ctx, doc, viewport, interaction) {
  const entities = doc.entities || [];
  const tileSize = doc.dimensions.tileSize;

  ctx.save();
  ctx.translate(viewport.offsetX, viewport.offsetY);
  ctx.scale(viewport.zoom, viewport.zoom);

  for (let i = 0; i < entities.length; i += 1) {
    const entity = entities[i];
    if (!entity.visible) continue;

    const { x, y } = getEntityCenter(entity, tileSize);
    const isSelected = interaction.selectedEntityIndex === i;
    const isHovered = interaction.hoveredEntityIndex === i;
    const markerRadius = isSelected ? 6 : 5;
    const outlineWidth = (isSelected ? 2 : 1.5) / Math.max(0.001, viewport.zoom);

    if (isSelected || isHovered) {
      ctx.beginPath();
      ctx.arc(x, y, markerRadius + (isSelected ? 4.5 : 3.5), 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "rgba(255, 176, 64, 0.28)" : "rgba(101, 217, 255, 0.20)";
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(x, y, markerRadius, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? "#ffe084" : isHovered ? "#b6f1ff" : "#65d9ff";
    ctx.fill();

    ctx.strokeStyle = isSelected ? "#ff9f40" : isHovered ? "#7de7ff" : "#153047";
    ctx.lineWidth = outlineWidth;
    ctx.stroke();

    if (isSelected || isHovered) {
      ctx.beginPath();
      ctx.moveTo(x, y - markerRadius - 6);
      ctx.lineTo(x, y - markerRadius - 12);
      ctx.strokeStyle = isSelected ? "rgba(255, 176, 64, 0.95)" : "rgba(125, 231, 255, 0.95)";
      ctx.lineWidth = 1.5 / Math.max(0.001, viewport.zoom);
      ctx.stroke();
    }
  }

  ctx.restore();
}
