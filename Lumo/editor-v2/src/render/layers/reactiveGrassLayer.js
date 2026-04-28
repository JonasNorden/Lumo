const DEFAULT_PATCH_COLORS = Object.freeze({
  base: "#12391f",
  top: "#7fd66b",
});

function withAlpha(color, alpha, fallback) {
  const source = typeof color === "string" ? color.trim() : "";
  const normalized = /^#[0-9a-fA-F]{6}$/.test(source) ? source : fallback;
  const channel = (offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16);
  return `rgba(${channel(1)}, ${channel(3)}, ${channel(5)}, ${alpha})`;
}

function normalizePatch(patch, index) {
  const sourcePatch = patch && typeof patch === "object" ? patch : {};
  const minHeight = Number.isFinite(sourcePatch.heightMin) ? Number(sourcePatch.heightMin) : 12;
  const maxHeight = Number.isFinite(sourcePatch.heightMax) ? Number(sourcePatch.heightMax) : 84;
  return {
    id: typeof sourcePatch.id === "string" && sourcePatch.id.trim() ? sourcePatch.id.trim() : `reactive_grass_patch_${index + 1}`,
    x: Number.isFinite(sourcePatch.x) ? Number(sourcePatch.x) : 0,
    y: Number.isFinite(sourcePatch.y) ? Number(sourcePatch.y) : 0,
    width: Number.isFinite(sourcePatch.width) && sourcePatch.width > 0 ? Number(sourcePatch.width) : 166,
    heightMax: Math.max(1, Math.round(Math.max(minHeight, maxHeight))),
    baseColor: typeof sourcePatch.baseColor === "string" ? sourcePatch.baseColor : DEFAULT_PATCH_COLORS.base,
    topColor: typeof sourcePatch.topColor === "string" ? sourcePatch.topColor : DEFAULT_PATCH_COLORS.top,
  };
}

function getPatchBoundsWorld(patch) {
  const leftWorldX = patch.x - patch.width * 0.5;
  const topWorldY = patch.y - patch.heightMax;
  return {
    leftWorldX,
    topWorldY,
    rightWorldX: leftWorldX + patch.width,
    bottomWorldY: patch.y,
  };
}

function worldToCanvas(viewport, x, y) {
  const zoom = viewport?.zoom || 1;
  const canvasX = (viewport?.offsetX || 0) + (x * zoom);
  const canvasY = (viewport?.offsetY || 0) + (y * zoom);
  return { x: canvasX, y: canvasY };
}

export function renderReactiveGrassPatches(ctx, doc, viewport, interaction = null) {
  const patches = Array.isArray(doc?.reactiveGrassPatches) ? doc.reactiveGrassPatches : [];
  if (!patches.length) return;

  const zoom = viewport?.zoom || 1;
  const labelFontSize = Math.max(10, Math.round(11 * zoom));
  const selectedPatchId = typeof interaction?.selectedReactiveGrassPatchId === "string"
    ? interaction.selectedReactiveGrassPatchId
    : null;
  const selectedPatchIndex = Number.isInteger(interaction?.selectedReactiveGrassPatchIndex)
    ? interaction.selectedReactiveGrassPatchIndex
    : null;

  for (let index = 0; index < patches.length; index += 1) {
    const patch = normalizePatch(patches[index], index);
    const worldBounds = getPatchBoundsWorld(patch);
    const isSelected = (selectedPatchId && selectedPatchId === patch.id) || (selectedPatchId === null && selectedPatchIndex === index);

    const topLeft = worldToCanvas(viewport, worldBounds.leftWorldX, worldBounds.topWorldY);
    const bottomRight = worldToCanvas(viewport, worldBounds.rightWorldX, worldBounds.bottomWorldY);
    const width = bottomRight.x - topLeft.x;
    const height = bottomRight.y - topLeft.y;

    const bodyGradient = ctx.createLinearGradient(topLeft.x, topLeft.y, topLeft.x, bottomRight.y);
    bodyGradient.addColorStop(0, withAlpha(patch.topColor, 0.34, DEFAULT_PATCH_COLORS.top));
    bodyGradient.addColorStop(1, withAlpha(patch.baseColor, 0.2, DEFAULT_PATCH_COLORS.base));

    ctx.save();
    ctx.fillStyle = bodyGradient;
    ctx.strokeStyle = isSelected
      ? "rgba(255, 223, 145, 0.98)"
      : withAlpha(patch.topColor, 0.76, DEFAULT_PATCH_COLORS.top);
    ctx.lineWidth = Math.max(1, (isSelected ? 1.9 : 1.25) * zoom);
    ctx.setLineDash(isSelected ? [] : [Math.max(3, 4 * zoom), Math.max(2, 3 * zoom)]);

    ctx.beginPath();
    ctx.roundRect(topLeft.x, topLeft.y, width, height, Math.max(4, 6 * zoom));
    ctx.fill();
    ctx.stroke();

    if (isSelected) {
      ctx.beginPath();
      ctx.roundRect(
        topLeft.x - Math.max(1, 2 * zoom),
        topLeft.y - Math.max(1, 2 * zoom),
        width + Math.max(2, 4 * zoom),
        height + Math.max(2, 4 * zoom),
        Math.max(4, 7 * zoom),
      );
      ctx.strokeStyle = "rgba(255, 247, 201, 0.72)";
      ctx.lineWidth = Math.max(1, 1.15 * zoom);
      ctx.stroke();
    }
    ctx.restore();

    const label = "Reactive Grass";
    ctx.save();
    ctx.font = `600 ${labelFontSize}px Inter, system-ui, sans-serif`;
    const labelPaddingX = Math.max(4, 6 * zoom);
    const labelPaddingY = Math.max(2, 4 * zoom);
    const labelWidth = ctx.measureText(label).width + labelPaddingX * 2;
    const labelHeight = labelFontSize + labelPaddingY * 2;
    const labelX = topLeft.x + Math.max(4, 6 * zoom);
    const labelY = topLeft.y + Math.max(4, 6 * zoom);

    ctx.fillStyle = isSelected ? "rgba(40, 30, 6, 0.74)" : "rgba(8, 17, 11, 0.55)";
    ctx.beginPath();
    ctx.roundRect(labelX, labelY, labelWidth, labelHeight, Math.max(3, 4 * zoom));
    ctx.fill();

    ctx.fillStyle = isSelected ? "rgba(255, 236, 169, 0.96)" : "rgba(201, 255, 175, 0.92)";
    ctx.textBaseline = "top";
    ctx.fillText(label, labelX + labelPaddingX, labelY + labelPaddingY);
    ctx.restore();
  }
}

export function findReactiveGrassPatchAtCanvasPoint(doc, viewport, pointX, pointY, radius = 2) {
  const patches = Array.isArray(doc?.reactiveGrassPatches) ? doc.reactiveGrassPatches : [];
  if (!patches.length) return -1;

  const zoom = viewport?.zoom || 1;
  const hitPadding = Math.max(2, radius * zoom);

  for (let index = patches.length - 1; index >= 0; index -= 1) {
    const patch = normalizePatch(patches[index], index);
    const worldBounds = getPatchBoundsWorld(patch);
    const topLeft = worldToCanvas(viewport, worldBounds.leftWorldX, worldBounds.topWorldY);
    const bottomRight = worldToCanvas(viewport, worldBounds.rightWorldX, worldBounds.bottomWorldY);
    const left = Math.min(topLeft.x, bottomRight.x) - hitPadding;
    const right = Math.max(topLeft.x, bottomRight.x) + hitPadding;
    const top = Math.min(topLeft.y, bottomRight.y) - hitPadding;
    const bottom = Math.max(topLeft.y, bottomRight.y) + hitPadding;
    if (pointX >= left && pointX <= right && pointY >= top && pointY <= bottom) {
      return index;
    }
  }

  return -1;
}
