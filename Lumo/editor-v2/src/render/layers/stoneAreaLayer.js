import { createStoneAreaFromDrag, generateStoneAreaLayout, getStoneAreaBounds, getStoneVisualGeometry, moveStoneArea, normalizeStoneAreaForEditor } from "../../domain/worldAreas.js";

function worldToCanvas(viewport, x, y) {
  const zoom = viewport?.zoom || 1;
  return { x: (viewport?.offsetX || 0) + (x * zoom), y: (viewport?.offsetY || 0) + (y * zoom) };
}

function tracePolygon(ctx, points) {
  if (!Array.isArray(points) || points.length === 0) return false;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  return true;
}

function getStoneTonePalette(stone) {
  const shade = Math.max(0, Math.min(1, Number.isFinite(stone.shade) ? stone.shade : 0.82));
  const warmth = Math.round(10 + shade * 10);
  const base = Math.round(86 * shade);
  return [
    `rgb(${base + 78 + warmth}, ${base + 70 + warmth}, ${base + 58})`,
    `rgb(${base + 50 + warmth}, ${base + 45 + warmth}, ${base + 36})`,
    `rgb(${base + 28 + warmth}, ${base + 26 + warmth}, ${base + 23})`,
    `rgb(${base + 12 + warmth}, ${base + 11 + warmth}, ${base + 12})`,
  ];
}

function drawStone(ctx, viewport, stone, alpha = 1) {
  const zoom = viewport?.zoom || 1;
  const center = worldToCanvas(viewport, stone.x, stone.y);
  const radiusX = Math.max(0.5, stone.radiusX * zoom);
  const radiusY = Math.max(0.5, stone.radiusY * zoom);
  const visual = stone.visual || getStoneVisualGeometry(stone);
  const tones = getStoneTonePalette(stone);

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(center.x, center.y);

  ctx.save();
  ctx.rotate(stone.rotation || 0);
  ctx.scale(radiusX, radiusY);
  ctx.fillStyle = "rgba(18, 15, 12, 0.16)";
  ctx.beginPath();
  ctx.ellipse(0.06, 0.72, 0.78, 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.rotate(stone.rotation || 0);
  ctx.scale(radiusX, radiusY);
  if (tracePolygon(ctx, visual.points)) {
    ctx.fillStyle = tones[2];
    ctx.fill();
  }
  ctx.save();
  if (tracePolygon(ctx, visual.points)) ctx.clip();
  for (const facet of visual.facets) {
    if (!tracePolygon(ctx, facet.points)) continue;
    ctx.fillStyle = tones[Math.max(0, Math.min(tones.length - 1, facet.tone || 0))];
    ctx.fill();
  }
  ctx.restore();
  if (tracePolygon(ctx, visual.points)) {
    ctx.strokeStyle = "rgba(45, 37, 29, 0.28)";
    ctx.lineWidth = Math.max(0.035, 1.1 / Math.max(radiusX, radiusY));
    ctx.stroke();
  }
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
