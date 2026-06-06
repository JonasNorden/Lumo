import { createMirrorSurfaceAreaFromDrag, getMirrorSurfaceAreaBounds, normalizeMirrorSurfaceAreaForEditor, moveMirrorSurfaceArea } from "../../domain/worldAreas.js";

function worldToCanvas(viewport, x, y) {
  const zoom = viewport?.zoom || 1;
  return {
    x: (viewport?.offsetX || 0) + (x * zoom),
    y: (viewport?.offsetY || 0) + (y * zoom),
  };
}

export function renderMirrorSurfaceAreas(ctx, doc, viewport, interaction = null) {
  const areas = Array.isArray(doc?.mirrorSurfaceAreas) ? doc.mirrorSurfaceAreas : [];
  if (!areas.length) return;

  const zoom = viewport?.zoom || 1;
  const selectedAreaId = typeof interaction?.selectedMirrorSurfaceAreaId === "string" ? interaction.selectedMirrorSurfaceAreaId : null;
  const selectedAreaIndex = Number.isInteger(interaction?.selectedMirrorSurfaceAreaIndex) ? interaction.selectedMirrorSurfaceAreaIndex : null;
  const labelFontSize = Math.max(10, Math.round(11 * zoom));

  const dragAreaId = typeof interaction?.mirrorSurfaceAreaDrag?.areaId === "string" ? interaction.mirrorSurfaceAreaDrag.areaId : null;
  const dragDelta = interaction?.mirrorSurfaceAreaDrag?.previewDelta || { x: 0, y: 0 };

  for (let index = 0; index < areas.length; index += 1) {
    const baseArea = normalizeMirrorSurfaceAreaForEditor(areas[index], index);
    const area = dragAreaId && baseArea.id === dragAreaId ? moveMirrorSurfaceArea(baseArea, dragDelta.x, dragDelta.y) : baseArea;
    if (area.visible === false) continue;
    const bounds = getMirrorSurfaceAreaBounds(area, index);
    const topLeft = worldToCanvas(viewport, bounds.x, bounds.y);
    const bottomRight = worldToCanvas(viewport, bounds.right, bounds.bottom);
    const width = bottomRight.x - topLeft.x;
    const height = bottomRight.y - topLeft.y;
    const isSelected = (selectedAreaId && selectedAreaId === area.id) || (!selectedAreaId && selectedAreaIndex === index);

    ctx.save();
    ctx.globalAlpha = area.enabled ? 1 : 0.48;
    ctx.fillStyle = isSelected ? "rgba(102, 226, 255, 0.22)" : "rgba(102, 226, 255, 0.13)";
    ctx.strokeStyle = isSelected ? "rgba(194, 247, 255, 0.98)" : "rgba(102, 226, 255, 0.72)";
    ctx.lineWidth = Math.max(1, (isSelected ? 2 : 1.25) * zoom);
    ctx.setLineDash(isSelected ? [] : [Math.max(4, 5 * zoom), Math.max(3, 4 * zoom)]);
    ctx.beginPath();
    ctx.roundRect(topLeft.x, topLeft.y, width, height, Math.max(4, 6 * zoom));
    ctx.fill();
    ctx.stroke();

    const sheenY = topLeft.y + Math.max(3, height * 0.22);
    ctx.setLineDash([]);
    ctx.strokeStyle = isSelected ? "rgba(255, 255, 255, 0.72)" : "rgba(255, 255, 255, 0.44)";
    ctx.lineWidth = Math.max(1, 1 * zoom);
    ctx.beginPath();
    ctx.moveTo(topLeft.x + Math.max(6, 8 * zoom), sheenY);
    ctx.lineTo(bottomRight.x - Math.max(6, 8 * zoom), sheenY);
    ctx.stroke();

    if (isSelected) {
      const handleSize = Math.max(6, 7 * zoom);
      ctx.fillStyle = "rgba(226, 252, 255, 0.96)";
      ctx.strokeStyle = "rgba(9, 47, 57, 0.85)";
      for (const [hx, hy] of [[topLeft.x, topLeft.y], [bottomRight.x, topLeft.y], [topLeft.x, bottomRight.y], [bottomRight.x, bottomRight.y]]) {
        ctx.beginPath();
        ctx.rect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        ctx.fill();
        ctx.stroke();
      }
    }

    const label = "Mirror Surface";
    ctx.font = `600 ${labelFontSize}px Inter, system-ui, sans-serif`;
    const paddingX = Math.max(4, 6 * zoom);
    const paddingY = Math.max(2, 4 * zoom);
    const labelWidth = ctx.measureText(label).width + paddingX * 2;
    const labelHeight = labelFontSize + paddingY * 2;
    const labelX = topLeft.x + Math.max(4, 6 * zoom);
    const labelY = topLeft.y + Math.max(4, 6 * zoom);
    ctx.fillStyle = isSelected ? "rgba(5, 41, 51, 0.78)" : "rgba(5, 31, 41, 0.55)";
    ctx.beginPath();
    ctx.roundRect(labelX, labelY, labelWidth, labelHeight, Math.max(3, 4 * zoom));
    ctx.fill();
    ctx.fillStyle = isSelected ? "rgba(221, 251, 255, 0.98)" : "rgba(185, 244, 255, 0.9)";
    ctx.textBaseline = "top";
    ctx.fillText(label, labelX + paddingX, labelY + paddingY);
    ctx.restore();
  }

  const placementDrag = interaction?.mirrorSurfaceAreaPlacementDrag;
  if (placementDrag?.active) {
    const preview = createMirrorSurfaceAreaFromDrag(doc, placementDrag.startCell, placementDrag.endCell || placementDrag.startCell);
    if (preview) {
      const bounds = getMirrorSurfaceAreaBounds(preview, areas.length);
      const topLeft = worldToCanvas(viewport, bounds.x, bounds.y);
      const bottomRight = worldToCanvas(viewport, bounds.right, bounds.bottom);
      ctx.save();
      ctx.fillStyle = "rgba(102, 226, 255, 0.18)";
      ctx.strokeStyle = "rgba(221, 251, 255, 0.92)";
      ctx.lineWidth = Math.max(1, 1.75 * zoom);
      ctx.setLineDash([Math.max(4, 5 * zoom), Math.max(3, 4 * zoom)]);
      ctx.beginPath();
      ctx.roundRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y, Math.max(4, 6 * zoom));
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

export function findMirrorSurfaceAreaAtCanvasPoint(doc, viewport, pointX, pointY, radius = 3) {
  const areas = Array.isArray(doc?.mirrorSurfaceAreas) ? doc.mirrorSurfaceAreas : [];
  if (!areas.length) return -1;
  const zoom = viewport?.zoom || 1;
  const hitPadding = Math.max(2, radius * zoom);
  for (let index = areas.length - 1; index >= 0; index -= 1) {
    const bounds = getMirrorSurfaceAreaBounds(areas[index], index);
    const topLeft = worldToCanvas(viewport, bounds.x, bounds.y);
    const bottomRight = worldToCanvas(viewport, bounds.right, bounds.bottom);
    const left = Math.min(topLeft.x, bottomRight.x) - hitPadding;
    const right = Math.max(topLeft.x, bottomRight.x) + hitPadding;
    const top = Math.min(topLeft.y, bottomRight.y) - hitPadding;
    const bottom = Math.max(topLeft.y, bottomRight.y) + hitPadding;
    if (pointX >= left && pointX <= right && pointY >= top && pointY <= bottom) return index;
  }
  return -1;
}
