import { getEntityHitRadius, getEntityVisual } from "../../domain/entities/entityVisuals.js";
import { getSelectedEntityIndices, isEntitySelected } from "../../domain/entities/selection.js";
import { getSpriteImage, isSpriteReady } from "../../domain/assets/imageAssets.js";
import { getFogVolumeRect, isFogVolumeEntityType, isSpecialVolumeEntityType } from "../../domain/entities/specialVolumeTypes.js";

function getEntityCenter(entity, tileSize) {
  if (isFogVolumeEntityType(entity?.type)) {
    const rect = getFogVolumeRect(entity, tileSize);
    return {
      x: rect.x0 + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

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

function getFogVolumeScreenRect(entity, tileSize, viewport) {
  const rect = getFogVolumeRect(entity, tileSize);
  return {
    x: viewport.offsetX + rect.x0 * viewport.zoom,
    y: viewport.offsetY + rect.top * viewport.zoom,
    width: Math.max(1, rect.width * viewport.zoom),
    height: Math.max(1, rect.height * viewport.zoom),
    falloff: rect.falloff * viewport.zoom,
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

function drawFogVolumeMarker(ctx, entity, tileSize, viewport, { isSelected, isHovered, alpha = 1, preview = false } = {}) {
  const rect = getFogVolumeScreenRect(entity, tileSize, viewport);
  const params = entity?.params || {};
  const density = Number.isFinite(Number(params?.look?.density)) ? Number(params.look.density) : 0.14;
  const falloff = Math.max(0, rect.falloff);
  const fillAlpha = Math.max(0.08, Math.min(0.3, density * (preview ? 1.2 : 1.45)));
  const strokeAlpha = preview ? 0.85 : isSelected ? 0.92 : isHovered ? 0.78 : 0.56;
  const lineWidth = Math.max(1, (preview ? 2 : isSelected ? 2 : 1.25) * viewport.zoom ** 0 * 1);
  const bandHeight = Math.max(6, Math.min(rect.height * 0.4, 18 * viewport.zoom));

  ctx.save();
  ctx.globalAlpha *= alpha;

  const fillGradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
  fillGradient.addColorStop(0, `rgba(225, 238, 255, ${Math.min(0.36, fillAlpha + 0.07)})`);
  fillGradient.addColorStop(1, `rgba(157, 204, 255, ${fillAlpha})`);
  ctx.fillStyle = fillGradient;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  if (falloff > 0) {
    const leftFade = ctx.createLinearGradient(rect.x, 0, rect.x + Math.min(rect.width * 0.5, falloff), 0);
    leftFade.addColorStop(0, "rgba(225, 238, 255, 0)");
    leftFade.addColorStop(1, `rgba(225, 238, 255, ${Math.min(0.16, fillAlpha)})`);
    ctx.fillStyle = leftFade;
    ctx.fillRect(rect.x, rect.y, Math.min(rect.width * 0.5, falloff), rect.height);

    const rightWidth = Math.min(rect.width * 0.5, falloff);
    const rightFade = ctx.createLinearGradient(rect.x + rect.width, 0, rect.x + rect.width - rightWidth, 0);
    rightFade.addColorStop(0, "rgba(225, 238, 255, 0)");
    rightFade.addColorStop(1, `rgba(225, 238, 255, ${Math.min(0.16, fillAlpha)})`);
    ctx.fillStyle = rightFade;
    ctx.fillRect(rect.x + rect.width - rightWidth, rect.y, rightWidth, rect.height);
  }

  ctx.fillStyle = `rgba(235, 245, 255, ${Math.min(0.34, fillAlpha + 0.08)})`;
  ctx.fillRect(rect.x, rect.y, rect.width, bandHeight);

  if (isHovered || isSelected || preview) {
    ctx.fillStyle = preview
      ? "rgba(255, 214, 138, 0.10)"
      : isSelected
        ? "rgba(255, 214, 138, 0.16)"
        : "rgba(125, 231, 255, 0.10)";
    ctx.fillRect(rect.x - 2, rect.y - 2, rect.width + 4, rect.height + 4);
  }

  ctx.strokeStyle = preview
    ? `rgba(255, 214, 138, ${strokeAlpha})`
    : isSelected
      ? `rgba(255, 190, 92, ${strokeAlpha})`
      : `rgba(173, 223, 255, ${strokeAlpha})`;
  ctx.lineWidth = lineWidth;
  if (preview) ctx.setLineDash([8, 4]);
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, Math.max(1, rect.width - 1), Math.max(1, rect.height - 1));
  ctx.setLineDash([]);

  ctx.strokeStyle = preview ? "rgba(255, 226, 168, 0.75)" : "rgba(225, 238, 255, 0.42)";
  ctx.lineWidth = Math.max(1, lineWidth * 0.75);
  ctx.beginPath();
  ctx.moveTo(rect.x + 0.5, rect.y + bandHeight);
  ctx.lineTo(rect.x + rect.width - 0.5, rect.y + bandHeight);
  ctx.stroke();

  ctx.fillStyle = preview ? "rgba(255, 234, 196, 0.92)" : "rgba(225, 238, 255, 0.72)";
  ctx.font = `${Math.max(10, 11 * viewport.zoom)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Fog", rect.x + 6, rect.y + 4);
  ctx.restore();
}

export function findEntityAtCanvasPoint(doc, viewport, pointX, pointY, radius = 3) {
  const entities = doc.entities || [];
  const tileSize = doc.dimensions.tileSize;

  for (let i = entities.length - 1; i >= 0; i -= 1) {
    const entity = entities[i];
    if (!entity.visible) continue;

    if (isSpecialVolumeEntityType(entity.type)) {
      const rect = getFogVolumeScreenRect(entity, tileSize, viewport);
      const margin = radius * viewport.zoom;
      const insideX = pointX >= rect.x - margin && pointX <= rect.x + rect.width + margin;
      const insideY = pointY >= rect.y - margin && pointY <= rect.y + rect.height + margin;
      if (insideX && insideY) {
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
  const draggedSelection = new Set(interaction.entityDrag?.active ? getSelectedEntityIndices(interaction) : []);

  for (let i = 0; i < entities.length; i += 1) {
    const entity = entities[i];
    if (!entity.visible) continue;
    if (draggedSelection.has(i)) continue;

    if (isSpecialVolumeEntityType(entity.type)) {
      drawFogVolumeMarker(ctx, entity, tileSize, viewport, {
        isSelected: isEntitySelected(interaction, i),
        isHovered: interaction.hoveredEntityIndex === i,
        alpha: 1,
      });
      continue;
    }

    const { x, y } = getEntityScreenCenter(entity, tileSize, viewport);
    drawEntityMarker(ctx, entity, x, y, viewport, {
      isSelected: isEntitySelected(interaction, i),
      isHovered: interaction.hoveredEntityIndex === i,
      alpha: 1,
    });
  }
}

export function renderEntityDragPreview(ctx, doc, viewport, interaction) {
  const entityDrag = interaction.entityDrag;
  if (!entityDrag?.active) return;

  const tileSize = doc.dimensions.tileSize;
  const delta = entityDrag.previewDelta || { x: 0, y: 0 };

  for (const origin of entityDrag.originPositions || []) {
    const entity = doc.entities?.[origin.index];
    if (!entity?.visible) continue;

    const previewEntity = { ...entity, x: origin.x + delta.x, y: origin.y + delta.y };
    if (isSpecialVolumeEntityType(previewEntity.type)) {
      drawFogVolumeMarker(ctx, previewEntity, tileSize, viewport, {
        isSelected: true,
        preview: true,
      });
      continue;
    }

    const { x, y } = getEntityScreenCenter(previewEntity, tileSize, viewport);
    drawEntityMarker(ctx, previewEntity, x, y, viewport, {
      isSelected: true,
      preview: true,
    });
  }
}

export function renderEntityPlacementPreview(ctx, doc, viewport, interaction, activePreset) {
  if (interaction.activeTool !== "inspect") return;
  if (interaction.activeLayer !== "entities") return;
  if (!interaction.hoverCell || !activePreset) return;

  const previewEntity = {
    type: activePreset.type,
    x: interaction.hoverCell.x,
    y: interaction.hoverCell.y,
    params: activePreset.defaultParams || {},
  };

  if (isSpecialVolumeEntityType(previewEntity.type)) {
    drawFogVolumeMarker(ctx, previewEntity, doc.dimensions.tileSize, viewport, {
      isSelected: true,
      preview: true,
      alpha: 0.9,
    });
    return;
  }

  const { x, y } = getEntityScreenCenter(previewEntity, doc.dimensions.tileSize, viewport);
  drawEntityMarker(ctx, previewEntity, x, y, viewport, {
    isSelected: true,
    preview: true,
    alpha: 0.9,
  });
}
