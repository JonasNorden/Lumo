import { getDecorHitRadius, getDecorVisual } from "../../domain/decor/decorVisuals.js";
import { getSelectedDecorIndices, isDecorSelected } from "../../domain/decor/selection.js";
import { getSpriteImage, isSpriteReady } from "../../domain/assets/imageAssets.js";

function getDecorScreenCenter(decor, tileSize, viewport) {
  return {
    x: viewport.offsetX + (decor.x + 0.5) * tileSize * viewport.zoom,
    y: viewport.offsetY + (decor.y + 0.76) * tileSize * viewport.zoom,
  };
}

function drawDecorFocus(ctx, x, y, radius, { selected = false, hovered = false, preview = false } = {}, scale = 1) {
  if (!selected && !hovered && !preview) return;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y + 1.5 * scale, radius, radius * 0.72, 0, 0, Math.PI * 2);
  ctx.fillStyle = preview
    ? "rgba(255, 214, 138, 0.16)"
    : selected
      ? "rgba(255, 179, 71, 0.18)"
      : "rgba(125, 231, 255, 0.14)";
  ctx.fill();
  ctx.strokeStyle = preview
    ? "rgba(255, 214, 138, 0.88)"
    : selected
      ? "rgba(255, 179, 71, 0.82)"
      : "rgba(125, 231, 255, 0.76)";
  ctx.lineWidth = (preview ? 1.6 : 1.2) * scale;
  if (preview) ctx.setLineDash([3 * scale, 2 * scale]);
  ctx.stroke();
  ctx.restore();
}

function drawDecorFallback(ctx, x, y, scale, visual) {
  ctx.save();
  ctx.fillStyle = "rgba(17, 28, 46, 0.92)";
  ctx.strokeStyle = "rgba(239, 245, 255, 0.74)";
  ctx.lineWidth = 1.4 * scale;
  ctx.beginPath();
  ctx.roundRect(x - 7 * scale, y - 10 * scale, 14 * scale, 14 * scale, 4 * scale);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(239, 245, 255, 0.82)";
  ctx.font = `${Math.max(7, 9 * scale)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((visual.label || "D").slice(0, 1).toUpperCase(), x, y - 3 * scale);
  ctx.restore();
}

function drawDecorSprite(ctx, x, y, viewport, visual, options = {}) {
  const image = getSpriteImage(visual.img);
  if (!isSpriteReady(image)) return false;

  const zoom = viewport.zoom;
  const drawWidth = (visual.drawW || 24) * zoom;
  const drawHeight = (visual.drawH || 24) * zoom;
  const drawX = x - drawWidth / 2;
  const drawY = visual.drawAnchor === "BL"
    ? y - drawHeight + (8 * zoom)
    : y - drawHeight / 2;

  ctx.save();
  ctx.globalAlpha *= options.alpha ?? 1;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, Math.floor(drawX), Math.floor(drawY), Math.round(drawWidth), Math.round(drawHeight));
  ctx.restore();
  return true;
}

function drawDecorMarker(ctx, decor, viewport, tileSize, options = {}) {
  const { x, y } = getDecorScreenCenter(decor, tileSize, viewport);
  const visual = getDecorVisual(decor.type);
  const scale = 1 / Math.max(0.001, viewport.zoom);

  ctx.save();
  ctx.globalAlpha *= options.alpha ?? 1;
  drawDecorFocus(ctx, x, y, Math.max(9, (visual.drawW || 24) * 0.42) * scale, options, scale);
  if (!drawDecorSprite(ctx, x, y, viewport, visual, options)) {
    drawDecorFallback(ctx, x, y, scale, visual);
  }
  ctx.restore();
}

function getScatterBoundsRect(doc, viewport, startCell, endCell) {
  if (!startCell || !endCell) return null;

  const tileSize = doc.dimensions.tileSize * viewport.zoom;
  const minX = Math.min(startCell.x, endCell.x);
  const maxX = Math.max(startCell.x, endCell.x);
  const minY = Math.min(startCell.y, endCell.y);
  const maxY = Math.max(startCell.y, endCell.y);

  return {
    x: viewport.offsetX + minX * tileSize,
    y: viewport.offsetY + minY * tileSize,
    width: (maxX - minX + 1) * tileSize,
    height: (maxY - minY + 1) * tileSize,
  };
}

export function findDecorAtCanvasPoint(doc, viewport, pointX, pointY, radius = 2) {
  const decorItems = doc.decor || [];
  const tileSize = doc.dimensions.tileSize;

  for (let i = decorItems.length - 1; i >= 0; i -= 1) {
    const decor = decorItems[i];
    if (!decor.visible) continue;

    const center = getDecorScreenCenter(decor, tileSize, viewport);
    const hitRadius = (getDecorHitRadius(decor.type) + radius) * viewport.zoom;
    const dx = pointX - center.x;
    const dy = pointY - center.y;

    if (dx * dx + dy * dy <= hitRadius * hitRadius) {
      return i;
    }
  }

  return -1;
}

export function renderDecor(ctx, doc, viewport, interaction) {
  const decorItems = doc.decor || [];
  const tileSize = doc.dimensions.tileSize;
  const draggedSelection = new Set(interaction.decorDrag?.active ? getSelectedDecorIndices(interaction) : []);

  for (let i = 0; i < decorItems.length; i += 1) {
    const decor = decorItems[i];
    if (!decor?.visible) continue;
    if (draggedSelection.has(i)) continue;

    drawDecorMarker(ctx, decor, viewport, tileSize, {
      selected: isDecorSelected(interaction, i),
      hovered: interaction.hoveredDecorIndex === i,
      alpha: draggedSelection.has(i) ? 0.34 : 1,
    });
  }
}

export function renderDecorDragPreview(ctx, doc, viewport, interaction) {
  const decorDrag = interaction.decorDrag;
  if (!decorDrag?.active) return;

  const delta = decorDrag.previewDelta || { x: 0, y: 0 };

  for (const origin of decorDrag.originPositions || []) {
    const decor = doc.decor?.[origin.index];
    if (!decor?.visible) continue;

    const previewDecor = {
      ...decor,
      x: origin.x + delta.x,
      y: origin.y + delta.y,
    };

    drawDecorMarker(ctx, previewDecor, viewport, doc.dimensions.tileSize, {
      selected: true,
      preview: true,
      alpha: 0.92,
    });
  }
}

export function renderDecorPlacementPreview(ctx, doc, viewport, interaction, activePreset) {
  if (interaction.activeTool !== "inspect") return;
  if (interaction.activeLayer !== "decor") return;
  if (interaction.decorScatterMode) return;
  if (!interaction.hoverCell || !activePreset) return;

  const previewDecor = {
    type: activePreset.type,
    x: interaction.hoverCell.x,
    y: interaction.hoverCell.y,
  };

  drawDecorMarker(ctx, previewDecor, viewport, doc.dimensions.tileSize, {
    preview: true,
    alpha: 0.88,
  });
}

export function renderDecorScatterPreview(ctx, doc, viewport, interaction) {
  const scatterDrag = interaction.decorScatterDrag;
  if (!scatterDrag?.active) return;

  const rect = getScatterBoundsRect(doc, viewport, scatterDrag.startCell, scatterDrag.currentCell || scatterDrag.startCell);
  if (!rect) return;

  ctx.save();
  ctx.fillStyle = "rgba(255, 184, 76, 0.16)";
  ctx.strokeStyle = "rgba(255, 196, 110, 0.9)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 6]);
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.setLineDash([]);

  const scatterDensity = Number.isFinite(interaction.decorScatterSettings?.density)
    ? Math.max(0, Math.min(1, interaction.decorScatterSettings.density))
    : 0.3;
  const label = `Scatter · ${Math.round(scatterDensity * 100)}% density`;
  ctx.font = "12px Inter, system-ui, sans-serif";
  const textWidth = ctx.measureText(label).width;
  const badgeX = rect.x + 8;
  const badgeY = rect.y + 8;
  ctx.fillStyle = "rgba(12, 18, 31, 0.88)";
  ctx.fillRect(badgeX, badgeY, textWidth + 14, 22);
  ctx.strokeStyle = "rgba(255, 196, 110, 0.65)";
  ctx.strokeRect(badgeX, badgeY, textWidth + 14, 22);
  ctx.fillStyle = "#f6d69a";
  ctx.fillText(label, badgeX + 7, badgeY + 15);
  ctx.restore();
}
