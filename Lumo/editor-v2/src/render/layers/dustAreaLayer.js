import { createDustAreaFromDrag, generateDustAreaLayout, getDustAreaBounds, moveDustArea, normalizeDustAreaForEditor } from "../../domain/worldAreas.js";

function worldToCanvas(viewport, x, y) {
  const zoom = viewport?.zoom || 1;
  return {
    x: (viewport?.offsetX || 0) + (x * zoom),
    y: (viewport?.offsetY || 0) + (y * zoom),
  };
}

function drawDustParticle(ctx, viewport, particle, alphaMultiplier = 1) {
  const zoom = viewport?.zoom || 1;
  const center = worldToCanvas(viewport, particle.x, particle.y);
  const radius = Math.max(0.38, Number(particle.radius) || 0.8) * zoom;
  ctx.save();
  ctx.globalAlpha *= Math.max(0, Math.min(1, (Number(particle.alphaMax) || 0.09) * alphaMultiplier));
  ctx.fillStyle = typeof particle.color === "string" ? particle.color : "rgba(210, 184, 130, 1)";
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function renderDustAreas(ctx, doc, viewport, interaction = null) {
  const areas = Array.isArray(doc?.dustAreas) ? doc.dustAreas : [];
  const placementDrag = interaction?.dustAreaPlacementDrag;
  if (!areas.length && !placementDrag?.active) return;

  const zoom = viewport?.zoom || 1;
  const selectedId = typeof interaction?.selectedDustAreaId === "string" ? interaction.selectedDustAreaId : null;
  const selectedIndex = Number.isInteger(interaction?.selectedDustAreaIndex) ? interaction.selectedDustAreaIndex : null;
  const dragAreaId = typeof interaction?.dustAreaDrag?.areaId === "string" ? interaction.dustAreaDrag.areaId : null;
  const dragDelta = interaction?.dustAreaDrag?.previewDelta || { x: 0, y: 0 };

  for (let index = 0; index < areas.length; index += 1) {
    const baseArea = normalizeDustAreaForEditor(areas[index], index);
    const area = dragAreaId && baseArea.id === dragAreaId ? moveDustArea(baseArea, dragDelta.x, dragDelta.y) : baseArea;
    if (area.visible === false) continue;
    const bounds = getDustAreaBounds(area, index);
    const topLeft = worldToCanvas(viewport, bounds.x, bounds.y);
    const bottomRight = worldToCanvas(viewport, bounds.right, bounds.bottom);
    const isSelected = (selectedId && selectedId === area.id) || (!selectedId && selectedIndex === index);

    for (const particle of generateDustAreaLayout(area, index)) drawDustParticle(ctx, viewport, particle, area.enabled ? 0.9 : 0.28);

    ctx.save();
    ctx.globalAlpha = area.enabled ? 1 : 0.45;
    ctx.fillStyle = isSelected ? "rgba(224, 213, 190, 0.14)" : "rgba(224, 213, 190, 0.06)";
    ctx.strokeStyle = isSelected ? "rgba(238, 226, 204, 0.9)" : "rgba(210, 196, 171, 0.56)";
    ctx.lineWidth = Math.max(1, (isSelected ? 2 : 1.15) * zoom);
    ctx.setLineDash(isSelected ? [] : [Math.max(4, 5 * zoom), Math.max(3, 4 * zoom)]);
    ctx.beginPath();
    ctx.roundRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y, Math.max(4, 6 * zoom));
    ctx.fill();
    ctx.stroke();
    ctx.font = `600 ${Math.max(10, Math.round(11 * zoom))}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(71, 61, 48, 0.72)";
    ctx.fillText("Dust Area", topLeft.x + Math.max(6, 7 * zoom), topLeft.y + Math.max(15, 16 * zoom));
    ctx.restore();
  }

  if (placementDrag?.active) {
    const preview = createDustAreaFromDrag(doc, placementDrag.startCell, placementDrag.endCell || placementDrag.startCell);
    if (!preview) return;
    const bounds = getDustAreaBounds(preview, areas.length);
    const topLeft = worldToCanvas(viewport, bounds.x, bounds.y);
    const bottomRight = worldToCanvas(viewport, bounds.right, bounds.bottom);
    for (const particle of generateDustAreaLayout(preview, areas.length)) drawDustParticle(ctx, viewport, particle, 0.72);
    ctx.save();
    ctx.fillStyle = "rgba(224, 213, 190, 0.12)";
    ctx.strokeStyle = "rgba(238, 226, 204, 0.9)";
    ctx.lineWidth = Math.max(1, 1.75 * zoom);
    ctx.setLineDash([Math.max(4, 5 * zoom), Math.max(3, 4 * zoom)]);
    ctx.beginPath();
    ctx.roundRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y, Math.max(4, 6 * zoom));
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export function findDustAreaAtCanvasPoint(doc, viewport, pointX, pointY, radius = 3) {
  const areas = Array.isArray(doc?.dustAreas) ? doc.dustAreas : [];
  if (!areas.length) return -1;
  const zoom = viewport?.zoom || 1;
  const hitPadding = Math.max(2, radius * zoom);
  for (let index = areas.length - 1; index >= 0; index -= 1) {
    const bounds = getDustAreaBounds(areas[index], index);
    const topLeft = worldToCanvas(viewport, bounds.x, bounds.y);
    const bottomRight = worldToCanvas(viewport, bounds.right, bounds.bottom);
    if (pointX >= Math.min(topLeft.x, bottomRight.x) - hitPadding && pointX <= Math.max(topLeft.x, bottomRight.x) + hitPadding && pointY >= Math.min(topLeft.y, bottomRight.y) - hitPadding && pointY <= Math.max(topLeft.y, bottomRight.y) + hitPadding) return index;
  }
  return -1;
}
