import { createWaterDropAreaFromDrag, generateWaterDropAreaLayout, getWaterDropAreaBounds, moveWaterDropArea, normalizeWaterDropAreaForEditor } from "../../domain/worldAreas.js";

function worldToCanvas(viewport, x, y) {
  const zoom = viewport?.zoom || 1;
  return { x: (viewport?.offsetX || 0) + x * zoom, y: (viewport?.offsetY || 0) + y * zoom };
}

function drawDropPreview(ctx, viewport, drop, alphaScale = 1) {
  const point = worldToCanvas(viewport, drop.sourceX, drop.sourceY + Math.min(28, drop.fallDistance * 0.35));
  const zoom = viewport?.zoom || 1;
  const radius = Math.max(1, drop.radius * zoom);
  ctx.save();
  ctx.globalAlpha *= Math.max(0.18, drop.alpha * alphaScale);
  ctx.strokeStyle = "rgba(205, 238, 255, 0.72)";
  ctx.fillStyle = "rgba(177, 222, 246, 0.72)";
  ctx.lineWidth = Math.max(1, radius * 0.65);
  ctx.beginPath();
  ctx.moveTo(point.x, point.y - drop.length * 0.5 * zoom);
  ctx.lineTo(point.x, point.y + drop.length * 0.5 * zoom);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(point.x, point.y + drop.length * 0.45 * zoom, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function renderWaterDropAreas(ctx, doc, viewport, interaction = null) {
  const areas = Array.isArray(doc?.waterDropAreas) ? doc.waterDropAreas : [];
  const placementDrag = interaction?.waterDropAreaPlacementDrag;
  if (!areas.length && !placementDrag?.active) return;
  const zoom = viewport?.zoom || 1;
  const selectedId = typeof interaction?.selectedWaterDropAreaId === "string" ? interaction.selectedWaterDropAreaId : null;
  const selectedIndex = Number.isInteger(interaction?.selectedWaterDropAreaIndex) ? interaction.selectedWaterDropAreaIndex : null;
  const dragAreaId = typeof interaction?.waterDropAreaDrag?.areaId === "string" ? interaction.waterDropAreaDrag.areaId : null;
  const dragDelta = interaction?.waterDropAreaDrag?.previewDelta || { x: 0, y: 0 };
  for (let index = 0; index < areas.length; index += 1) {
    const baseArea = normalizeWaterDropAreaForEditor(areas[index], index);
    const area = dragAreaId && baseArea.id === dragAreaId ? moveWaterDropArea(baseArea, dragDelta.x, dragDelta.y) : baseArea;
    if (area.visible === false) continue;
    const bounds = getWaterDropAreaBounds(area, index);
    const topLeft = worldToCanvas(viewport, bounds.x, bounds.y);
    const bottomRight = worldToCanvas(viewport, bounds.right, bounds.bottom);
    const isSelected = (selectedId && selectedId === area.id) || (!selectedId && selectedIndex === index);
    for (const drop of generateWaterDropAreaLayout(area, index)) drawDropPreview(ctx, viewport, drop, area.enabled ? 1 : 0.25);
    ctx.save();
    ctx.globalAlpha = area.enabled ? 1 : 0.45;
    ctx.strokeStyle = isSelected ? "rgba(205, 238, 255, 0.95)" : "rgba(158, 213, 235, 0.62)";
    ctx.fillStyle = isSelected ? "rgba(120, 190, 225, 0.13)" : "rgba(120, 190, 225, 0.055)";
    ctx.lineWidth = Math.max(1, (isSelected ? 2 : 1.15) * zoom);
    ctx.setLineDash(isSelected ? [] : [Math.max(4, 5 * zoom), Math.max(3, 4 * zoom)]);
    ctx.beginPath();
    ctx.roundRect(topLeft.x, topLeft.y, Math.max(1, bottomRight.x - topLeft.x), bottomRight.y - topLeft.y, Math.max(4, 6 * zoom));
    ctx.fill();
    ctx.stroke();
    ctx.font = `600 ${Math.max(10, Math.round(11 * zoom))}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(218, 242, 255, 0.86)";
    ctx.fillText(`Water Drop · ${area.mode}`, topLeft.x + Math.max(6, 7 * zoom), topLeft.y + Math.max(15, 16 * zoom));
    ctx.restore();
  }
  if (placementDrag?.active) {
    const preview = createWaterDropAreaFromDrag(doc, placementDrag.startCell, placementDrag.endCell || placementDrag.startCell);
    if (!preview) return;
    for (const drop of generateWaterDropAreaLayout(preview, areas.length)) drawDropPreview(ctx, viewport, drop, 0.82);
  }
}

export function findWaterDropAreaAtCanvasPoint(doc, viewport, pointX, pointY, radius = 3) {
  const areas = Array.isArray(doc?.waterDropAreas) ? doc.waterDropAreas : [];
  const zoom = viewport?.zoom || 1;
  const hitPadding = Math.max(2, radius * zoom);
  for (let index = areas.length - 1; index >= 0; index -= 1) {
    const bounds = getWaterDropAreaBounds(areas[index], index);
    const topLeft = worldToCanvas(viewport, bounds.x, bounds.y);
    const bottomRight = worldToCanvas(viewport, bounds.right, bounds.bottom);
    if (pointX >= Math.min(topLeft.x, bottomRight.x) - hitPadding && pointX <= Math.max(topLeft.x, bottomRight.x) + hitPadding && pointY >= Math.min(topLeft.y, bottomRight.y) - hitPadding && pointY <= Math.max(topLeft.y, bottomRight.y) + hitPadding) return index;
  }
  return -1;
}
