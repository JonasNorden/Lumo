import { getEntityHitRadius, getEntityVisual } from "../../domain/entities/entityVisuals.js";
import { getSpriteImage, isSpriteReady } from "../../domain/assets/imageAssets.js";
import { getFogVolumeParams, getFogVolumeRect, isFogVolumeEntityType } from "../../domain/entities/specialVolumeTypes.js";
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

    if (isFogVolumeEntityType(entity.type)) {
      const rect = getFogVolumeRect(entity, tileSize);
      const x = viewport.offsetX + rect.x0 * viewport.zoom;
      const y = viewport.offsetY + rect.top * viewport.zoom;
      const width = Math.max(1, rect.width * viewport.zoom);
      const height = Math.max(1, rect.height * viewport.zoom);
      const expandedRadius = Math.max(1, radius * viewport.zoom);
      const minX = x - expandedRadius;
      const maxX = x + width + expandedRadius;
      const minY = y - expandedRadius;
      const maxY = y + height + expandedRadius;
      if (pointX >= minX && pointX <= maxX && pointY >= minY && pointY <= maxY) {
        return i;
      }
      continue;
    }

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
    if (!entity?.visible || !isFogVolumeEntityType(entity.type)) continue;
    const rect = getFogVolumeRect(entity, tileSize);
    const fogParams = getFogVolumeParams(entity);
    const x = viewport.offsetX + rect.x0 * viewport.zoom;
    const y = viewport.offsetY + rect.top * viewport.zoom;
    const width = Math.max(1, rect.width * viewport.zoom);
    const height = Math.max(1, rect.height * viewport.zoom);
    const isSelected = selectedEntityIds.has(entity.id);
    const isHovered = hoveredEntityId === entity.id;
    const density = Math.min(1, Math.max(0, Number(fogParams?.look?.density) || 0));
    const exposure = Math.min(4, Math.max(0.1, Number(fogParams?.look?.exposure) || 1));
    const diffuse = Math.min(1, Math.max(0, Number(fogParams?.smoothing?.diffuse) || 0));
    const relax = Math.min(1, Math.max(0, Number(fogParams?.smoothing?.relax) || 0));
    const push = Math.min(12, Math.max(0, Number(fogParams?.interaction?.push) || 0));
    const bulge = Math.min(12, Math.max(0, Number(fogParams?.interaction?.bulge) || 0));
    const drift = Math.min(8, Math.max(-8, Number(fogParams?.look?.drift) || 0));
    const organicStrength = Math.min(4, Math.max(0, Number(fogParams?.organic?.strength) || 0));
    const organicSpeed = Math.min(8, Math.max(0, Number(fogParams?.organic?.speed) || 0));
    const softnessPx = Math.max(1, Math.round(((diffuse * 0.65) + (relax * 0.35)) * height * 0.5));
    const motionAmplitudePx = Math.max(0, Math.round((Math.abs(drift) * 0.28 + push * 0.18 + bulge * 0.12 + organicStrength * organicSpeed * 0.22) * viewport.zoom));
    const motionInsetPx = Math.max(0, Math.round((push * 0.7 + organicStrength * 1.4) * viewport.zoom));
    const baseAlpha = Math.min(0.9, Math.max(0.06, (0.12 + density * 0.52) * Math.sqrt(exposure)));
    const hoverBoost = isSelected ? 0.1 : isHovered ? 0.06 : 0;

    ctx.save();
    ctx.fillStyle = `rgba(158, 198, 255, ${Math.min(0.98, baseAlpha + hoverBoost)})`;
    ctx.strokeStyle = isSelected
      ? "rgba(255, 214, 138, 0.92)"
      : "rgba(195, 223, 255, 0.88)";
    ctx.lineWidth = isSelected ? 1.4 : 1.1;
    ctx.fillRect(x, y, width, height);
    if (softnessPx > 0) {
      const edgeAlpha = Math.min(0.82, 0.1 + diffuse * 0.36 + relax * 0.2 + organicStrength * 0.06);
      ctx.fillStyle = `rgba(158, 198, 255, ${edgeAlpha})`;
      ctx.fillRect(x, y, width, softnessPx);
      ctx.fillRect(x, y + Math.max(0, height - softnessPx), width, softnessPx);
    }
    if (motionAmplitudePx > 0) {
      const driftOffset = Math.round(drift * 1.2 * viewport.zoom);
      const flowBandHeight = Math.max(1, Math.round(height * 0.35));
      const flowY = y + Math.max(0, Math.round((height - flowBandHeight) / 2) + driftOffset - Math.round(motionAmplitudePx / 2));
      const flowX = x + motionInsetPx;
      const flowW = Math.max(1, width - motionInsetPx * 2);
      const flowH = Math.max(1, flowBandHeight + motionAmplitudePx);
      const flowAlpha = Math.min(0.8, 0.08 + (push + bulge) * 0.012 + organicStrength * 0.06);
      ctx.fillStyle = `rgba(195, 223, 255, ${flowAlpha})`;
      ctx.fillRect(flowX, flowY, flowW, flowH);
    }
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, width - 1), Math.max(0, height - 1));
    ctx.restore();
  }

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
