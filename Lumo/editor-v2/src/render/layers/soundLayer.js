import { getSelectedSoundIndices, isSoundSelected } from "../../domain/sound/selection.js";
import { getSoundVisual } from "../../domain/sound/soundVisuals.js";

function clampZoneSize(value, fallback = 1) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, parsed);
}

function getSoundRect(sound, tileSize) {
  const width = clampZoneSize(sound?.params?.width, 1) * tileSize;
  const height = clampZoneSize(sound?.params?.height, 1) * tileSize;
  return {
    x: sound.x * tileSize,
    y: sound.y * tileSize,
    width,
    height,
  };
}

function getSoundScreenPoint(sound, tileSize, viewport) {
  return {
    x: viewport.offsetX + (sound.x + 0.5) * tileSize * viewport.zoom,
    y: viewport.offsetY + (sound.y + 0.5) * tileSize * viewport.zoom,
  };
}

function getSoundScreenRect(sound, tileSize, viewport) {
  const rect = getSoundRect(sound, tileSize);
  return {
    x: viewport.offsetX + rect.x * viewport.zoom,
    y: viewport.offsetY + rect.y * viewport.zoom,
    width: rect.width * viewport.zoom,
    height: rect.height * viewport.zoom,
  };
}

function drawFocusFrame(ctx, rect, color, fill, lineWidth, dashed = false) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  if (dashed) ctx.setLineDash([8, 5]);
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, Math.max(0, rect.width - 1), Math.max(0, rect.height - 1));
  ctx.restore();
}

function drawZoneSound(ctx, sound, viewport, tileSize, options = {}) {
  const rect = getSoundScreenRect(sound, tileSize, viewport);
  const visual = getSoundVisual(sound.type);
  const stroke = options.preview ? "#ffd68a" : options.isSelected ? "#ffb347" : options.isHovered ? "#7de7ff" : visual.stroke;
  const fill = options.preview ? "rgba(255, 214, 138, 0.16)" : options.isSelected ? "rgba(255, 179, 71, 0.16)" : visual.fill;
  const outlineWidth = options.preview ? 1.8 : options.isSelected ? 1.8 : 1.25;

  if (options.isHovered && !options.preview) {
    drawFocusFrame(ctx, { x: rect.x - 3, y: rect.y - 3, width: rect.width + 6, height: rect.height + 6 }, "rgba(125, 231, 255, 0.45)", "rgba(125, 231, 255, 0.08)", 1.1);
  }
  if (options.isSelected) {
    drawFocusFrame(ctx, { x: rect.x - 4, y: rect.y - 4, width: rect.width + 8, height: rect.height + 8 }, options.preview ? "rgba(255, 214, 138, 0.72)" : "rgba(255, 179, 71, 0.7)", options.preview ? "rgba(255, 214, 138, 0.10)" : "rgba(255, 179, 71, 0.10)", 1.2, options.preview);
  }

  ctx.save();
  ctx.globalAlpha *= options.alpha ?? 1;
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = outlineWidth;
  if (options.preview) ctx.setLineDash([8, 5]);
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, Math.max(0, rect.width - 1), Math.max(0, rect.height - 1));
  ctx.setLineDash([]);

  ctx.fillStyle = options.preview ? "#ffe1ad" : visual.accent;
  ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.fillText(visual.label, rect.x + 8, rect.y + 16);
  ctx.restore();
}

function drawSpotSound(ctx, sound, viewport, tileSize, options = {}) {
  const point = getSoundScreenPoint(sound, tileSize, viewport);
  const visual = getSoundVisual(sound.type);
  const baseRadius = 6;
  const stroke = options.preview ? "#ffd68a" : options.isSelected ? "#ffb347" : options.isHovered ? "#7de7ff" : visual.stroke;
  const fill = options.preview ? "rgba(255, 214, 138, 0.20)" : visual.fill;
  const radiusTiles = clampZoneSize(sound?.params?.radius, 0);
  const spatial = Boolean(sound?.params?.spatial);
  const radiusPx = radiusTiles > 0 ? radiusTiles * tileSize * viewport.zoom : 0;

  ctx.save();
  ctx.globalAlpha *= options.alpha ?? 1;

  if (spatial && radiusPx > 0) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = options.preview ? "rgba(255, 214, 138, 0.06)" : "rgba(101, 214, 255, 0.05)";
    ctx.fill();
    ctx.strokeStyle = options.preview ? "rgba(255, 214, 138, 0.42)" : "rgba(101, 214, 255, 0.30)";
    ctx.lineWidth = 1;
    if (options.preview) ctx.setLineDash([8, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (options.isHovered && !options.preview) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, baseRadius + 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(125, 231, 255, 0.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(125, 231, 255, 0.44)";
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  if (options.isSelected) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, baseRadius + 8, 0, Math.PI * 2);
    ctx.fillStyle = options.preview ? "rgba(255, 214, 138, 0.10)" : "rgba(255, 179, 71, 0.14)";
    ctx.fill();
    ctx.strokeStyle = options.preview ? "rgba(255, 214, 138, 0.75)" : "rgba(255, 179, 71, 0.70)";
    ctx.lineWidth = 1.2;
    if (options.preview) ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.beginPath();
  ctx.arc(point.x, point.y, baseRadius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = options.preview ? 1.8 : 1.6;
  if (options.preview) ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(point.x - 4, point.y);
  ctx.lineTo(point.x + 4, point.y);
  ctx.moveTo(point.x, point.y - 4);
  ctx.lineTo(point.x, point.y + 4);
  ctx.strokeStyle = options.preview ? "#ffe1ad" : visual.accent;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

function drawSoundMarker(ctx, sound, viewport, tileSize, options = {}) {
  if (sound.type === "ambientZone" || sound.type === "musicZone") {
    drawZoneSound(ctx, sound, viewport, tileSize, options);
    return;
  }
  drawSpotSound(ctx, sound, viewport, tileSize, options);
}

export function findSoundAtCanvasPoint(doc, viewport, pointX, pointY, radius = 3) {
  const sounds = doc.sounds || [];
  const tileSize = doc.dimensions.tileSize;

  for (let i = sounds.length - 1; i >= 0; i -= 1) {
    const sound = sounds[i];
    if (!sound?.visible) continue;

    if (sound.type === "ambientZone" || sound.type === "musicZone") {
      const rect = getSoundScreenRect(sound, tileSize, viewport);
      if (
        pointX >= rect.x - radius &&
        pointX <= rect.x + rect.width + radius &&
        pointY >= rect.y - radius &&
        pointY <= rect.y + rect.height + radius
      ) {
        return i;
      }
      continue;
    }

    const point = getSoundScreenPoint(sound, tileSize, viewport);
    const hitRadius = (8 + radius) * viewport.zoom;
    const dx = pointX - point.x;
    const dy = pointY - point.y;
    if (dx * dx + dy * dy <= hitRadius * hitRadius) {
      return i;
    }
  }

  return -1;
}

export function renderSounds(ctx, doc, viewport, interaction) {
  const sounds = doc.sounds || [];
  const tileSize = doc.dimensions.tileSize;
  const draggedSelection = new Set(interaction.soundDrag?.active ? getSelectedSoundIndices(interaction) : []);

  for (let i = 0; i < sounds.length; i += 1) {
    const sound = sounds[i];
    if (!sound?.visible) continue;
    if (draggedSelection.has(i)) continue;

    drawSoundMarker(ctx, sound, viewport, tileSize, {
      isSelected: isSoundSelected(interaction, i),
      isHovered: interaction.hoveredSoundIndex === i,
      alpha: 1,
    });
  }
}

export function renderSoundDragPreview(ctx, doc, viewport, interaction) {
  const soundDrag = interaction.soundDrag;
  if (!soundDrag?.active) return;

  for (const origin of soundDrag.originPositions || []) {
    const sound = doc.sounds?.[origin.index];
    if (!sound?.visible) continue;

    drawSoundMarker(ctx, { ...sound, x: origin.x + (soundDrag.previewDelta?.x || 0), y: origin.y + (soundDrag.previewDelta?.y || 0) }, viewport, doc.dimensions.tileSize, {
      isSelected: true,
      preview: true,
      alpha: 0.92,
    });
  }
}

export function renderSoundPlacementPreview(ctx, doc, viewport, interaction, activePreset) {
  if (interaction.activeTool !== "inspect") return;
  if (!interaction.hoverCell || !activePreset) return;

  drawSoundMarker(ctx, {
    type: activePreset.type,
    x: interaction.hoverCell.x,
    y: interaction.hoverCell.y,
    params: activePreset.defaultParams,
  }, viewport, doc.dimensions.tileSize, {
    preview: true,
    alpha: 0.9,
  });
}
