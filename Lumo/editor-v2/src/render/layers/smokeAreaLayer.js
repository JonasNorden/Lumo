import { createSmokeAreaFromDrag, generateSmokeAreaLayout, getSmokeAreaBounds, moveSmokeArea, normalizeSmokeAreaForEditor } from "../../domain/worldAreas.js";

function worldToCanvas(viewport, x, y) {
  const zoom = viewport?.zoom || 1;
  return {
    x: (viewport?.offsetX || 0) + (x * zoom),
    y: (viewport?.offsetY || 0) + (y * zoom),
  };
}

function drawSmokePreviewPuff(ctx, viewport, puff, alphaScale = 1) {
  const center = worldToCanvas(viewport, puff.x, puff.y);
  const zoom = viewport?.zoom || 1;
  const radius = Math.max(2.8, (Number(puff.radius) || 12) * zoom);
  const innerRadius = Math.max(1.2, (Number(puff.innerRadius) || radius * 0.48) * zoom);
  const alpha = Math.max(0, Math.min(0.22, (Number(puff.alphaMax) || 0.06) * alphaScale * 1.35));
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const gradient = typeof ctx.createRadialGradient === "function"
    ? ctx.createRadialGradient(center.x, center.y, innerRadius, center.x, center.y, radius)
    : null;
  ctx.globalAlpha *= alpha;
  if (gradient) {
    gradient.addColorStop(0, puff.color || "rgba(156, 154, 158, 1)");
    gradient.addColorStop(0.62, puff.edgeColor || "rgba(140, 142, 150, 1)");
    gradient.addColorStop(1, "rgba(156, 154, 158, 0)");
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = puff.color || "rgba(156, 154, 158, 1)";
  }
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function renderSmokeAreas(ctx, doc, viewport, interaction = null) {
  const areas = Array.isArray(doc?.smokeAreas) ? doc.smokeAreas : [];
  const placementDrag = interaction?.smokeAreaPlacementDrag;
  if (!areas.length && !placementDrag?.active) return;
  const zoom = viewport?.zoom || 1;
  const selectedId = typeof interaction?.selectedSmokeAreaId === "string" ? interaction.selectedSmokeAreaId : null;
  const selectedIndex = Number.isInteger(interaction?.selectedSmokeAreaIndex) ? interaction.selectedSmokeAreaIndex : null;
  const dragAreaId = typeof interaction?.smokeAreaDrag?.areaId === "string" ? interaction.smokeAreaDrag.areaId : null;
  const dragDelta = interaction?.smokeAreaDrag?.previewDelta || { x: 0, y: 0 };

  for (let index = 0; index < areas.length; index += 1) {
    const baseArea = normalizeSmokeAreaForEditor(areas[index], index);
    const area = dragAreaId && baseArea.id === dragAreaId ? moveSmokeArea(baseArea, dragDelta.x, dragDelta.y) : baseArea;
    if (area.visible === false) continue;
    const bounds = getSmokeAreaBounds(area, index);
    const topLeft = worldToCanvas(viewport, bounds.x, bounds.y);
    const bottomRight = worldToCanvas(viewport, bounds.right, bounds.bottom);
    const isSelected = (selectedId && selectedId === area.id) || (!selectedId && selectedIndex === index);

    for (const puff of generateSmokeAreaLayout(area, index)) drawSmokePreviewPuff(ctx, viewport, puff, area.enabled ? 1 : 0.25);

    ctx.save();
    ctx.globalAlpha = area.enabled ? 1 : 0.45;
    ctx.fillStyle = isSelected ? "rgba(169, 177, 188, 0.13)" : "rgba(169, 177, 188, 0.055)";
    ctx.strokeStyle = isSelected ? "rgba(214, 220, 226, 0.9)" : "rgba(169, 177, 188, 0.56)";
    ctx.lineWidth = Math.max(1, (isSelected ? 2 : 1.15) * zoom);
    ctx.setLineDash(isSelected ? [] : [Math.max(4, 5 * zoom), Math.max(3, 4 * zoom)]);
    ctx.beginPath();
    ctx.roundRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y, Math.max(4, 6 * zoom));
    ctx.fill();
    ctx.stroke();
    ctx.font = `600 ${Math.max(10, Math.round(11 * zoom))}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(219, 224, 231, 0.82)";
    ctx.fillText("Smoke Area", topLeft.x + Math.max(6, 7 * zoom), topLeft.y + Math.max(15, 16 * zoom));
    ctx.restore();
  }

  if (placementDrag?.active) {
    const preview = createSmokeAreaFromDrag(doc, placementDrag.startCell, placementDrag.endCell || placementDrag.startCell);
    if (!preview) return;
    const bounds = getSmokeAreaBounds(preview, areas.length);
    const topLeft = worldToCanvas(viewport, bounds.x, bounds.y);
    const bottomRight = worldToCanvas(viewport, bounds.right, bounds.bottom);
    for (const puff of generateSmokeAreaLayout(preview, areas.length)) drawSmokePreviewPuff(ctx, viewport, puff, 0.82);
    ctx.save();
    ctx.fillStyle = "rgba(169, 177, 188, 0.10)";
    ctx.strokeStyle = "rgba(214, 220, 226, 0.9)";
    ctx.lineWidth = Math.max(1, 1.75 * zoom);
    ctx.setLineDash([Math.max(4, 5 * zoom), Math.max(3, 4 * zoom)]);
    ctx.beginPath();
    ctx.roundRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y, Math.max(4, 6 * zoom));
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export function findSmokeAreaAtCanvasPoint(doc, viewport, pointX, pointY, radius = 3) {
  const areas = Array.isArray(doc?.smokeAreas) ? doc.smokeAreas : [];
  if (!areas.length) return -1;
  const zoom = viewport?.zoom || 1;
  const hitPadding = Math.max(2, radius * zoom);
  for (let index = areas.length - 1; index >= 0; index -= 1) {
    const bounds = getSmokeAreaBounds(areas[index], index);
    const topLeft = worldToCanvas(viewport, bounds.x, bounds.y);
    const bottomRight = worldToCanvas(viewport, bounds.right, bounds.bottom);
    if (pointX >= Math.min(topLeft.x, bottomRight.x) - hitPadding && pointX <= Math.max(topLeft.x, bottomRight.x) + hitPadding && pointY >= Math.min(topLeft.y, bottomRight.y) - hitPadding && pointY <= Math.max(topLeft.y, bottomRight.y) + hitPadding) return index;
  }
  return -1;
}
