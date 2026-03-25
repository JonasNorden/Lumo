import { getDecorHitRadius, getDecorVisual } from "../../domain/decor/decorVisuals.js";

import { getSpriteImage, isSpriteReady } from "../../domain/assets/imageAssets.js";
import { isObjectPlacementPreviewSuppressed } from "./objectPlacementPreview.js";

function getDecorScreenCenter(decor, tileSize, viewport) {
  return {
    x: viewport.offsetX + (decor.x + 0.5) * tileSize * viewport.zoom,
    y: viewport.offsetY + (decor.y + 0.76) * tileSize * viewport.zoom,
  };
}

export function getDecorDrawMetrics(decor, tileSize, viewport, visual) {
  const zoom = viewport.zoom;
  const scaledTile = tileSize * zoom;
  const drawWidth = (visual.drawW || 24) * zoom;
  const drawHeight = (visual.drawH || 24) * zoom;
  const drawOffX = (visual.drawOffX || 0) * zoom;
  const drawOffY = (visual.drawOffY || 0) * zoom;
  const tileLeft = viewport.offsetX + decor.x * scaledTile;
  const tileTop = viewport.offsetY + decor.y * scaledTile;
  const center = getDecorScreenCenter(decor, tileSize, viewport);
  const footprintW = Math.max(1, Number.isFinite(visual.footprint?.w) ? Math.round(visual.footprint.w) : Math.ceil((visual.drawW || 24) / 24));
  const footprintH = Math.max(1, Number.isFinite(visual.footprint?.h) ? Math.round(visual.footprint.h) : Math.ceil((visual.drawH || 24) / 24));

  const drawX = visual.drawAnchor === "TL"
    ? tileLeft + drawOffX
    : center.x - drawWidth / 2 + drawOffX;
  const drawY = visual.drawAnchor === "TL"
    ? tileTop + drawOffY
    : center.y - drawHeight + (8 * zoom) + drawOffY;

  return {
    drawX,
    drawY,
    drawWidth,
    drawHeight,
    focusX: visual.drawAnchor === "TL" ? drawX + drawWidth / 2 : center.x,
    focusY: visual.drawAnchor === "TL" ? drawY + drawHeight / 2 : center.y,
    focusRadius: Math.max(9, Math.max(drawWidth, drawHeight, footprintW * scaledTile, footprintH * scaledTile) * 0.32),
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

function drawDecorSprite(ctx, metrics, viewport, visual, options = {}) {
  const image = getSpriteImage(visual.img);
  if (!isSpriteReady(image)) return false;
  const { drawX, drawY, drawWidth, drawHeight } = metrics;

  ctx.save();
  ctx.globalAlpha *= options.alpha ?? 1;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, Math.floor(drawX), Math.floor(drawY), Math.round(drawWidth), Math.round(drawHeight));
  ctx.restore();
  return true;
}

function drawDecorMarker(ctx, decor, viewport, tileSize, options = {}) {
  const visual = getDecorVisual(decor.type);
  const metrics = getDecorDrawMetrics(decor, tileSize, viewport, visual);
  const scale = 1 / Math.max(0.001, viewport.zoom);

  ctx.save();
  ctx.globalAlpha *= options.alpha ?? 1;
  drawDecorFocus(ctx, metrics.focusX, metrics.focusY, metrics.focusRadius * scale, options, scale);
  if (!drawDecorSprite(ctx, metrics, viewport, visual, options)) {
    drawDecorFallback(ctx, metrics.focusX, metrics.focusY, scale, visual);
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

    const visual = getDecorVisual(decor.type);
    const metrics = getDecorDrawMetrics(decor, tileSize, viewport, visual);
    const hitPadding = Math.max(2, radius * viewport.zoom);
    const withinBounds = pointX >= (metrics.drawX - hitPadding)
      && pointX <= (metrics.drawX + metrics.drawWidth + hitPadding)
      && pointY >= (metrics.drawY - hitPadding)
      && pointY <= (metrics.drawY + metrics.drawHeight + hitPadding);
    if (withinBounds) {
      return i;
    }

    const hitRadius = (getDecorHitRadius(decor.type) + radius) * viewport.zoom;
    const dx = pointX - metrics.focusX;
    const dy = pointY - metrics.focusY;
    if (dx * dx + dy * dy <= hitRadius * hitRadius) {
      return i;
    }
  }

  return -1;
}

export function renderDecor(ctx, doc, viewport, interaction) {
  const decorItems = doc.decor || [];
  const tileSize = doc.dimensions.tileSize;
  // CANONICAL DECOR RUNTIME: authored decor rendering/highlighting resolves through stable ids only.
  // Do not fall back to stale selection indices or legacy drag-driven preview suppression.
  const selectedDecorIds = new Set(
    Array.isArray(interaction.selectedDecorIds)
      ? interaction.selectedDecorIds.filter((decorId) => typeof decorId === "string" && decorId.trim())
      : [],
  );
  const hoveredDecorId = typeof interaction.hoveredDecorId === "string" && interaction.hoveredDecorId.trim()
    ? interaction.hoveredDecorId
    : null;

  const dragPreviewDelta = interaction.decorDrag?.active
    ? interaction.decorDrag.previewDelta || { x: 0, y: 0 }
    : null;
  const draggedDecorOrigins = interaction.decorDrag?.active
    ? new Map(
        (interaction.decorDrag.originPositions || [])
          .filter((origin) => typeof origin?.decorId === "string" && origin.decorId.trim())
          .map((origin) => [origin.decorId, origin]),
      )
    : null;

  for (let i = 0; i < decorItems.length; i += 1) {
    const decor = decorItems[i];
    if (!decor?.visible) continue;

    const dragOrigin = draggedDecorOrigins?.get(decor.id) || null;
    const renderDecorItem = dragOrigin
      ? {
          ...decor,
          x: dragOrigin.x + dragPreviewDelta.x,
          y: dragOrigin.y + dragPreviewDelta.y,
        }
      : decor;

    drawDecorMarker(ctx, renderDecorItem, viewport, tileSize, {
      selected: selectedDecorIds.has(decor.id),
      hovered: hoveredDecorId === decor.id,
      alpha: 1,
    });
  }
}

export function renderDecorDragPreview(ctx, doc, viewport, interaction) {
  const decorDrag = interaction.decorDrag;
  if (!decorDrag?.active) return;

  const delta = decorDrag.previewDelta || { x: 0, y: 0 };

  for (const origin of decorDrag.originPositions || []) {
    const decor = (doc.decor || []).find((candidate) => candidate?.id === origin.decorId);
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
  if (isObjectPlacementPreviewSuppressed(interaction)) return;
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
