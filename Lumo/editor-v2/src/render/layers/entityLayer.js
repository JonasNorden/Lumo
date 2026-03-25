import { getEntityHitRadius, getEntityVisual } from "../../domain/entities/entityVisuals.js";
import { getSpriteImage, isSpriteReady } from "../../domain/assets/imageAssets.js";
import { isFogVolumeEntityType } from "../../domain/entities/specialVolumeTypes.js";
import { isObjectPlacementPreviewSuppressed } from "./objectPlacementPreview.js";

function getEntityCenter(entity, tileSize) {
  const visual = getEntityVisual(entity.type);
  const footprintW = Math.max(1, visual.footprintW || visual.drawW || tileSize);
  const footprintH = Math.max(1, visual.footprintH || visual.drawH || tileSize);

  if (visual.drawAnchor === "BL") {
    return {
      x: entity.x * tileSize + (footprintW / 2),
      y: entity.y * tileSize + tileSize - (footprintH / 2),
    };
  }

  return {
    x: (entity.x + 0.5) * tileSize,
    y: (entity.y + 0.5) * tileSize,
  };
}

function getEntityScreenCenter(entity, tileSize, viewport) {
  const center = getEntityCenter(entity, tileSize);
  return {
    x: viewport.offsetX + center.x * viewport.zoom,
    y: viewport.offsetY + center.y * viewport.zoom,
  };
}

function getEntityFootprintRect(entity, tileSize, viewport) {
  const visual = getEntityVisual(entity.type);
  const footprintWidthCells = Math.max(1, Math.ceil((visual.footprintW || visual.drawW || tileSize) / tileSize));
  const footprintHeightCells = Math.max(1, Math.ceil((visual.footprintH || visual.drawH || tileSize) / tileSize));
  const topTileY = visual.drawAnchor === "TL" ? entity.y : entity.y - (footprintHeightCells - 1);
  const zoomedTileSize = tileSize * viewport.zoom;
  return {
    x: viewport.offsetX + entity.x * zoomedTileSize,
    y: viewport.offsetY + topTileY * zoomedTileSize,
    width: footprintWidthCells * zoomedTileSize,
    height: footprintHeightCells * zoomedTileSize,
  };
}

function drawFocusRing(ctx, x, y, radius, fillStyle, strokeStyle, lineWidth, dashed = false) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  if (dashed) ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawEntityFallback(ctx, x, y, radius, label) {
  ctx.save();
  ctx.fillStyle = "rgba(17, 28, 46, 0.94)";
  ctx.strokeStyle = "rgba(239, 245, 255, 0.74)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(x - radius, y - radius, radius * 2, radius * 2, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(239, 245, 255, 0.82)";
  ctx.font = "10px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((label || "E").slice(0, 1).toUpperCase(), x, y);
  ctx.restore();
}

function drawEntitySprite(ctx, x, y, viewport, visual, alpha = 1) {
  const image = getSpriteImage(visual.img);
  if (!isSpriteReady(image)) return false;

  const drawWidth = (visual.drawW || 24) * viewport.zoom;
  const drawHeight = (visual.drawH || 24) * viewport.zoom;
  const drawX = x - drawWidth / 2;
  const drawY = visual.drawAnchor === "BL"
    ? y - drawHeight / 2
    : y - drawHeight / 2;

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, Math.floor(drawX), Math.floor(drawY), Math.round(drawWidth), Math.round(drawHeight));
  ctx.restore();
  return true;
}

function drawEntityMarker(ctx, entity, x, y, viewport, { isSelected, isHovered, alpha = 1, preview = false } = {}) {
  const visual = getEntityVisual(entity.type);
  const zoomScale = 1 / Math.max(0.001, viewport.zoom);
  const focusRadius = Math.max(8.5, Math.max(visual.drawW || 24, visual.drawH || 24) * 0.34) * zoomScale;
  const outlineWidth = (preview ? 2.1 : isSelected ? 2 : isHovered ? 1.7 : 1.3) * zoomScale;

  ctx.save();
  ctx.globalAlpha *= alpha;

  if (isHovered && !preview) {
    drawFocusRing(
      ctx,
      x,
      y,
      focusRadius + 3.5 * zoomScale,
      "rgba(125, 231, 255, 0.14)",
      "rgba(125, 231, 255, 0.52)",
      1.2 * zoomScale,
    );
  }

  if (isSelected || preview) {
    drawFocusRing(
      ctx,
      x,
      y,
      focusRadius + 5.2 * zoomScale,
      preview ? "rgba(255, 179, 71, 0.10)" : "rgba(255, 179, 71, 0.18)",
      preview ? "rgba(255, 214, 138, 0.82)" : "rgba(255, 179, 71, 0.78)",
      outlineWidth,
      preview,
    );
  }

  if (!drawEntitySprite(ctx, x, y, viewport, visual, alpha)) {
    drawEntityFallback(ctx, x, y, 7 * zoomScale, visual.label);
  }

  if (visual.key === "lantern_01") {
    ctx.beginPath();
    ctx.arc(x, y, focusRadius + 2.2 * zoomScale, 0, Math.PI * 2);
    ctx.strokeStyle = preview ? "rgba(255, 223, 141, 0.34)" : "rgba(255, 209, 102, 0.32)";
    ctx.lineWidth = 1.05 * zoomScale;
    ctx.stroke();
  }

  ctx.restore();
}

export function findEntityAtCanvasPoint(doc, viewport, pointX, pointY, radius = 3) {
  const entities = doc.entities || [];
  const tileSize = doc.dimensions.tileSize;

  for (let i = entities.length - 1; i >= 0; i -= 1) {
    const entity = entities[i];
    if (!entity.visible) continue;

    if (isFogVolumeEntityType(entity.type)) continue;

    const center = getEntityScreenCenter(entity, tileSize, viewport);
    const hitRadius = (getEntityHitRadius(entity.type) + radius) * viewport.zoom;
    const dx = pointX - center.x;
    const dy = pointY - center.y;

    if (dx * dx + dy * dy <= hitRadius * hitRadius) {
      return i;
    }
  }

  return -1;
}

export function renderEntities(ctx, doc, viewport, interaction) {
  const entities = doc.entities || [];
  const tileSize = doc.dimensions.tileSize;
  // CANONICAL ENTITY RUNTIME: render authored entities directly from stable entity ids only.
  // Do not fall back to legacy index-based entity selection/hover state in editor-v2.
  const selectedEntityIds = new Set(
    Array.isArray(interaction.selectedEntityIds)
      ? interaction.selectedEntityIds.filter((entityId) => typeof entityId === "string" && entityId.trim())
      : [],
  );
  const hoveredEntityId = typeof interaction.hoveredEntityId === "string" && interaction.hoveredEntityId.trim()
    ? interaction.hoveredEntityId
    : null;
  const dragPreviewDelta = interaction.entityDrag?.active
    ? interaction.entityDrag.previewDelta || { x: 0, y: 0 }
    : null;
  const draggedEntityOrigins = interaction.entityDrag?.active
    ? new Map(
        (interaction.entityDrag.originPositions || [])
          .filter((origin) => typeof origin?.entityId === "string" && origin.entityId.trim())
          .map((origin) => [origin.entityId, origin]),
      )
    : null;

  for (let i = 0; i < entities.length; i += 1) {
    const entity = entities[i];
    if (!entity.visible) continue;

    if (isFogVolumeEntityType(entity.type)) continue;

    const dragOrigin = draggedEntityOrigins?.get(entity.id) || null;
    const renderEntity = dragOrigin
      ? {
          ...entity,
          x: dragOrigin.x + dragPreviewDelta.x,
          y: dragOrigin.y + dragPreviewDelta.y,
        }
      : entity;
    const { x, y } = getEntityScreenCenter(renderEntity, tileSize, viewport);
    drawEntityMarker(ctx, entity, x, y, viewport, {
      isSelected: selectedEntityIds.has(entity.id),
      isHovered: hoveredEntityId === entity.id,
      alpha: 1,
    });
  }
}

export function renderEntityDragPreview(ctx, doc, viewport, interaction) {
  void ctx;
  void doc;
  void viewport;
  void interaction;
  // CANONICAL ENTITY RUNTIME: legacy entity drag preview rendering stays fully bypassed.
}

export function renderEntityPlacementPreview(ctx, doc, viewport, interaction, activePreset) {
  if (interaction.activeTool !== "inspect") return;
  if (interaction.activeLayer !== "entities") return;
  if (isObjectPlacementPreviewSuppressed(interaction)) return;
  if (!interaction.hoverCell) return;

  const presetType = typeof activePreset?.type === "string" && activePreset.type.trim()
    ? activePreset.type
    : "generic";
  if (isFogVolumeEntityType(presetType)) return;
  const previewEntity = {
    type: presetType,
    x: interaction.hoverCell.x,
    y: interaction.hoverCell.y,
  };
  const footprintRect = getEntityFootprintRect(previewEntity, doc.dimensions.tileSize, viewport);
  const frameInset = 0.5;

  ctx.save();
  ctx.fillStyle = "rgba(255, 214, 138, 0.12)";
  ctx.fillRect(footprintRect.x, footprintRect.y, footprintRect.width, footprintRect.height);
  ctx.strokeStyle = "rgba(255, 214, 138, 0.56)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    footprintRect.x + frameInset,
    footprintRect.y + frameInset,
    Math.max(0, footprintRect.width - 1),
    Math.max(0, footprintRect.height - 1),
  );
  ctx.restore();

  const { x, y } = getEntityScreenCenter(previewEntity, doc.dimensions.tileSize, viewport);
  drawEntityMarker(ctx, previewEntity, x, y, viewport, {
    preview: true,
    alpha: 0.9,
  });
}
