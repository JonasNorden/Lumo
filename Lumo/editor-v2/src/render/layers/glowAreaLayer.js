import { createGlowAreaFromDrag, generateGlowAreaLayout, getGlowAreaBounds, moveGlowArea, normalizeGlowAreaForEditor } from "../../domain/worldAreas.js";

function worldToCanvas(viewport, x, y) {
  const zoom = viewport?.zoom || 1;
  return {
    x: (viewport?.offsetX || 0) + (x * zoom),
    y: (viewport?.offsetY || 0) + (y * zoom),
  };
}

function drawGlowPreviewPoint(ctx, viewport, point, alphaScale = 1) {
  const center = worldToCanvas(viewport, point.x, point.y);
  const zoom = viewport?.zoom || 1;
  const radius = Math.max(0.7, point.radius * zoom);
  ctx.save();
  ctx.globalAlpha = Math.max(0.08, Math.min(0.72, point.alphaMax * alphaScale * 4.2));
  ctx.fillStyle = point.color;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * 1.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = Math.max(0.12, Math.min(0.82, point.alphaMax * alphaScale * 5.5));
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function renderGlowAreas(ctx, doc, viewport, interaction = null) {
  const areas = Array.isArray(doc?.glowAreas) ? doc.glowAreas : [];
  const placementDrag = interaction?.glowAreaPlacementDrag;
  if (!areas.length && !placementDrag?.active) return;
  const zoom = viewport?.zoom || 1;
  const selectedId = typeof interaction?.selectedGlowAreaId === "string" ? interaction.selectedGlowAreaId : null;
  const selectedIndex = Number.isInteger(interaction?.selectedGlowAreaIndex) ? interaction.selectedGlowAreaIndex : null;
  const dragAreaId = typeof interaction?.glowAreaDrag?.areaId === "string" ? interaction.glowAreaDrag.areaId : null;
  const dragDelta = interaction?.glowAreaDrag?.previewDelta || { x: 0, y: 0 };

  for (let index = 0; index < areas.length; index += 1) {
    const baseArea = normalizeGlowAreaForEditor(areas[index], index);
    const area = dragAreaId && baseArea.id === dragAreaId ? moveGlowArea(baseArea, dragDelta.x, dragDelta.y) : baseArea;
    if (area.visible === false) continue;
    const bounds = getGlowAreaBounds(area, index);
    const topLeft = worldToCanvas(viewport, bounds.x, bounds.y);
    const bottomRight = worldToCanvas(viewport, bounds.right, bounds.bottom);
    const isSelected = (selectedId && selectedId === area.id) || (!selectedId && selectedIndex === index);

    for (const point of generateGlowAreaLayout(area, index)) drawGlowPreviewPoint(ctx, viewport, point, area.enabled ? 1 : 0.3);

    ctx.save();
    ctx.globalAlpha = area.enabled ? 1 : 0.45;
    ctx.fillStyle = isSelected ? "rgba(121, 190, 224, 0.12)" : "rgba(121, 190, 224, 0.045)";
    ctx.strokeStyle = isSelected ? "rgba(202, 225, 226, 0.92)" : "rgba(145, 194, 214, 0.54)";
    ctx.lineWidth = Math.max(1, (isSelected ? 2 : 1.15) * zoom);
    ctx.setLineDash(isSelected ? [] : [Math.max(4, 5 * zoom), Math.max(3, 4 * zoom)]);
    ctx.beginPath();
    ctx.roundRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y, Math.max(4, 6 * zoom));
    ctx.fill();
    ctx.stroke();
    ctx.font = `600 ${Math.max(10, Math.round(11 * zoom))}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(200, 223, 226, 0.82)";
    ctx.fillText("Glow Area", topLeft.x + Math.max(6, 7 * zoom), topLeft.y + Math.max(15, 16 * zoom));
    ctx.restore();
  }

  if (placementDrag?.active) {
    const preview = createGlowAreaFromDrag(doc, placementDrag.startCell, placementDrag.endCell || placementDrag.startCell);
    if (!preview) return;
    const bounds = getGlowAreaBounds(preview, areas.length);
    const topLeft = worldToCanvas(viewport, bounds.x, bounds.y);
    const bottomRight = worldToCanvas(viewport, bounds.right, bounds.bottom);
    for (const point of generateGlowAreaLayout(preview, areas.length)) drawGlowPreviewPoint(ctx, viewport, point, 0.82);
    ctx.save();
    ctx.fillStyle = "rgba(121, 190, 224, 0.10)";
    ctx.strokeStyle = "rgba(202, 225, 226, 0.9)";
    ctx.lineWidth = Math.max(1, 1.75 * zoom);
    ctx.setLineDash([Math.max(4, 5 * zoom), Math.max(3, 4 * zoom)]);
    ctx.beginPath();
    ctx.roundRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y, Math.max(4, 6 * zoom));
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export function findGlowAreaAtCanvasPoint(doc, viewport, pointX, pointY, radius = 3) {
  const areas = Array.isArray(doc?.glowAreas) ? doc.glowAreas : [];
  if (!areas.length) return -1;
  const zoom = viewport?.zoom || 1;
  const hitPadding = Math.max(2, radius * zoom);
  for (let index = areas.length - 1; index >= 0; index -= 1) {
    const bounds = getGlowAreaBounds(areas[index], index);
    const topLeft = worldToCanvas(viewport, bounds.x, bounds.y);
    const bottomRight = worldToCanvas(viewport, bounds.right, bounds.bottom);
    if (pointX >= Math.min(topLeft.x, bottomRight.x) - hitPadding && pointX <= Math.max(topLeft.x, bottomRight.x) + hitPadding && pointY >= Math.min(topLeft.y, bottomRight.y) - hitPadding && pointY <= Math.max(topLeft.y, bottomRight.y) + hitPadding) return index;
  }
  return -1;
}
