function getEntityCenter(entity, tileSize) {
  return {
    x: (entity.x + 0.5) * tileSize,
    y: (entity.y + 0.5) * tileSize,
  };
}

export function findEntityAtCanvasPoint(doc, viewport, pointX, pointY, radius = 9) {
  const entities = doc.entities || [];
  const tileSize = doc.dimensions.tileSize;
  const scaledRadius = radius * viewport.zoom;

  for (let i = entities.length - 1; i >= 0; i -= 1) {
    const entity = entities[i];
    if (!entity.visible) continue;

    const center = getEntityCenter(entity, tileSize);
    const screenX = viewport.offsetX + center.x * viewport.zoom;
    const screenY = viewport.offsetY + center.y * viewport.zoom;
    const dx = pointX - screenX;
    const dy = pointY - screenY;

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
    const radius = isSelected ? 6 : 4;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? "#ffe084" : "#65d9ff";
    ctx.fill();

    ctx.strokeStyle = isSelected ? "#ff9f40" : "#153047";
    ctx.lineWidth = 1.5 / Math.max(0.001, viewport.zoom);
    ctx.stroke();
  }

  ctx.restore();
}
