import { createStoneAreaFromDrag, generateStoneAreaLayout, getStoneAreaBounds, moveStoneArea, normalizeStoneAreaForEditor } from "../../domain/worldAreas.js";

function worldToCanvas(viewport, x, y) {
  const zoom = viewport?.zoom || 1;
  return { x: (viewport?.offsetX || 0) + (x * zoom), y: (viewport?.offsetY || 0) + (y * zoom) };
}

function drawStone(ctx, viewport, stone, alpha = 1) {
  const zoom = viewport?.zoom || 1;
  const center = worldToCanvas(viewport, stone.x, stone.y);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(center.x, center.y);
  ctx.rotate(stone.rotation || 0);
  ctx.scale(Math.max(0.5, stone.radiusX * zoom), Math.max(0.5, stone.radiusY * zoom));
  const shade = Math.max(0, Math.min(1, Number.isFinite(stone.shade) ? stone.shade : 0.82));
  const base = Math.round(90 * shade);
  ctx.fillStyle = `rgb(${base + 28}, ${base + 24}, ${base + 18})`;
  ctx.strokeStyle = `rgba(${base + 55}, ${base + 50}, ${base + 42}, 0.72)`;
  ctx.lineWidth = 1 / Math.max(0.5, zoom);
  ctx.beginPath();
  ctx.ellipse(0, 0, 1, 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function renderStoneAreas(ctx, doc, viewport, interaction = null) {
  const areas = Array.isArray(doc?.stoneAreas) ? doc.stoneAreas : [];
  const placementDrag = interaction?.stoneAreaPlacementDrag;
  if (!areas.length && !placementDrag?.active) return;

  const zoom = viewport?.zoom || 1;
  const selectedId = typeof interaction?.selectedStoneAreaId === "string" ? interaction.selectedStoneAreaId : null;
  const selectedIndex = Number.isInteger(interaction?.selectedStoneAreaIndex) ? interaction.selectedStoneAreaIndex : null;
  const dragAreaId = typeof interaction?.stoneAreaDrag?.areaId === "string" ? interaction.stoneAreaDrag.areaId : null;
  const dragDelta = interaction?.stoneAreaDrag?.previewDelta || { x: 0, y: 0 };

  for (let index = 0; index < areas.length; index += 1) {
    const baseArea = normalizeStoneAreaForEditor(areas[index], index);
    const area = dragAreaId && baseArea.id === dragAreaId ? moveStoneArea(baseArea, dragDelta.x, dragDelta.y) : baseArea;
    if (area.visible === false) continue;
    const bounds = getStoneAreaBounds(area, index);
    const topLeft = worldToCanvas(viewport, bounds.x, bounds.y);
    const bottomRight = worldToCanvas(viewport, bounds.right, bounds.bottom);
    const isSelected = (selectedId && selectedId === area.id) || (!selectedId && selectedIndex === index);

    for (const stone of generateStoneAreaLayout(area, index)) drawStone(ctx, viewport, stone, area.enabled ? 0.92 : 0.38);

    ctx.save();
    ctx.globalAlpha = area.enabled ? 1 : 0.48;
    ctx.fillStyle = isSelected ? "rgba(170, 150, 112, 0.16)" : "rgba(170, 150, 112, 0.08)";
    ctx.strokeStyle = isSelected ? "rgba(235, 217, 174, 0.95)" : "rgba(190, 170, 125, 0.62)";
    ctx.lineWidth = Math.max(1, (isSelected ? 2 : 1.25) * zoom);
    ctx.setLineDash(isSelected ? [] : [Math.max(4, 5 * zoom), Math.max(3, 4 * zoom)]);
    ctx.beginPath();
    ctx.roundRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y, Math.max(4, 6 * zoom));
    ctx.fill();
    ctx.stroke();
    const label = "Stone Area";
    ctx.font = `600 ${Math.max(10, Math.round(11 * zoom))}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(48, 39, 28, 0.72)";
    ctx.fillText(label, topLeft.x + Math.max(6, 7 * zoom), topLeft.y + Math.max(15, 16 * zoom));
    ctx.restore();
  }

  if (placementDrag?.active) {
    const preview = createStoneAreaFromDrag(doc, placementDrag.startCell, placementDrag.endCell || placementDrag.startCell);
    if (!preview) return;
    const bounds = getStoneAreaBounds(preview, areas.length);
    const topLeft = worldToCanvas(viewport, bounds.x, bounds.y);
    const bottomRight = worldToCanvas(viewport, bounds.right, bounds.bottom);
    ctx.save();
    ctx.fillStyle = "rgba(170, 150, 112, 0.14)";
    ctx.strokeStyle = "rgba(235, 217, 174, 0.92)";
    ctx.lineWidth = Math.max(1, 1.75 * zoom);
    ctx.setLineDash([Math.max(4, 5 * zoom), Math.max(3, 4 * zoom)]);
    ctx.beginPath();
    ctx.roundRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y, Math.max(4, 6 * zoom));
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export function findStoneAreaAtCanvasPoint(doc, viewport, pointX, pointY, radius = 3) {
  const areas = Array.isArray(doc?.stoneAreas) ? doc.stoneAreas : [];
  if (!areas.length) return -1;
  const zoom = viewport?.zoom || 1;
  const hitPadding = Math.max(2, radius * zoom);
  for (let index = areas.length - 1; index >= 0; index -= 1) {
    const bounds = getStoneAreaBounds(areas[index], index);
    const topLeft = worldToCanvas(viewport, bounds.x, bounds.y);
    const bottomRight = worldToCanvas(viewport, bounds.right, bounds.bottom);
    if (pointX >= Math.min(topLeft.x, bottomRight.x) - hitPadding && pointX <= Math.max(topLeft.x, bottomRight.x) + hitPadding && pointY >= Math.min(topLeft.y, bottomRight.y) - hitPadding && pointY <= Math.max(topLeft.y, bottomRight.y) + hitPadding) return index;
  }
  return -1;
}
