import { getSelectedSoundIndices, isSoundSelected } from "../../domain/sound/selection.js";
import { getSoundVisual } from "../../domain/sound/soundVisuals.js";

function isZoneSoundType(soundType) {
  return soundType === "ambientZone" || soundType === "musicZone";
}

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

function drawRoundedRectPath(ctx, rect, radius) {
  const nextRadius = Math.max(0, Math.min(radius, rect.width * 0.5, rect.height * 0.5));
  ctx.beginPath();
  ctx.moveTo(rect.x + nextRadius, rect.y);
  ctx.lineTo(rect.x + rect.width - nextRadius, rect.y);
  ctx.quadraticCurveTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + nextRadius);
  ctx.lineTo(rect.x + rect.width, rect.y + rect.height - nextRadius);
  ctx.quadraticCurveTo(rect.x + rect.width, rect.y + rect.height, rect.x + rect.width - nextRadius, rect.y + rect.height);
  ctx.lineTo(rect.x + nextRadius, rect.y + rect.height);
  ctx.quadraticCurveTo(rect.x, rect.y + rect.height, rect.x, rect.y + rect.height - nextRadius);
  ctx.lineTo(rect.x, rect.y + nextRadius);
  ctx.quadraticCurveTo(rect.x, rect.y, rect.x + nextRadius, rect.y);
  ctx.closePath();
}

function drawZoneSound(ctx, sound, viewport, tileSize, options = {}) {
  const rect = getSoundScreenRect(sound, tileSize, viewport);
  const visual = getSoundVisual(sound.type);
  const stroke = options.preview ? "#ffd68a" : options.isSelected ? "#ffb347" : options.isHovered ? "#7de7ff" : visual.stroke;
  const fill = options.preview ? "rgba(255, 214, 138, 0.16)" : options.isSelected ? "rgba(255, 179, 71, 0.16)" : options.isScanActive ? visual.fill.replace('0.16', '0.22') : visual.fill;
  const outlineWidth = options.preview ? 1.8 : options.isSelected ? 1.8 : options.isScanActive ? 1.5 : 1.25;
  const isAmbientZone = sound.type === "ambientZone";
  const cornerRadius = isAmbientZone ? 14 : 10;

  if (options.isHovered && !options.preview) {
    drawFocusFrame(ctx, { x: rect.x - 3, y: rect.y - 3, width: rect.width + 6, height: rect.height + 6 }, "rgba(125, 231, 255, 0.45)", "rgba(125, 231, 255, 0.08)", 1.1);
  }
  if (options.isSelected) {
    drawFocusFrame(ctx, { x: rect.x - 4, y: rect.y - 4, width: rect.width + 8, height: rect.height + 8 }, options.preview ? "rgba(255, 214, 138, 0.72)" : "rgba(255, 179, 71, 0.7)", options.preview ? "rgba(255, 214, 138, 0.10)" : "rgba(255, 179, 71, 0.10)", 1.2, options.preview);
  }
  if (options.isScanActive && !options.preview) {
    drawFocusFrame(ctx, { x: rect.x - 5, y: rect.y - 5, width: rect.width + 10, height: rect.height + 10 }, visual.stroke, "rgba(12, 20, 35, 0.08)", 1.25, false);
  }

  ctx.save();
  ctx.globalAlpha *= options.alpha ?? 1;
  drawRoundedRectPath(ctx, rect, cornerRadius);

  if (isAmbientZone) {
    const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
    gradient.addColorStop(0, options.preview ? "rgba(255, 214, 138, 0.12)" : options.isScanActive ? "rgba(126, 240, 199, 0.30)" : "rgba(126, 240, 199, 0.24)");
    gradient.addColorStop(1, options.preview ? "rgba(255, 214, 138, 0.05)" : options.isScanActive ? "rgba(126, 240, 199, 0.14)" : "rgba(126, 240, 199, 0.10)");
    ctx.fillStyle = gradient;
    ctx.fill();

    const bandCount = Math.max(2, Math.min(4, Math.floor(rect.height / 24)));
    ctx.strokeStyle = options.preview ? "rgba(255, 225, 173, 0.55)" : "rgba(223, 255, 245, 0.42)";
    ctx.lineWidth = 1;
    for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
      const ratio = (bandIndex + 1) / (bandCount + 1);
      const bandY = rect.y + rect.height * ratio;
      ctx.beginPath();
      ctx.moveTo(rect.x + 12, bandY);
      ctx.bezierCurveTo(
        rect.x + rect.width * 0.28,
        bandY - 6,
        rect.x + rect.width * 0.72,
        bandY + 6,
        rect.x + rect.width - 12,
        bandY,
      );
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = options.preview ? "rgba(255, 225, 173, 0.34)" : "rgba(243, 231, 255, 0.22)";
    ctx.lineWidth = 1;
    const stripeSpacing = 14;
    ctx.beginPath();
    for (let stripeX = rect.x - rect.height; stripeX < rect.x + rect.width; stripeX += stripeSpacing) {
      ctx.moveTo(stripeX, rect.y + rect.height);
      ctx.lineTo(stripeX + rect.height, rect.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  if (options.isScanActive && !options.preview) {
    ctx.save();
    ctx.strokeStyle = visual.accent;
    ctx.lineWidth = 1;
    ctx.setLineDash(isAmbientZone ? [10, 6] : [6, 5]);
    drawRoundedRectPath(ctx, { x: rect.x + 4, y: rect.y + 4, width: Math.max(0, rect.width - 8), height: Math.max(0, rect.height - 8) }, Math.max(4, cornerRadius - 4));
    ctx.stroke();
    ctx.restore();
  }

  ctx.strokeStyle = stroke;
  ctx.lineWidth = outlineWidth;
  if (options.preview) ctx.setLineDash([8, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = options.preview ? "#ffe1ad" : visual.accent;
  ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.fillText(visual.label, rect.x + 8, rect.y + 16);

  if (options.isScanActive && !options.preview) {
    const badgeWidth = Math.min(rect.width - 12, 58);
    if (badgeWidth > 18) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(rect.x + 8, rect.y + Math.max(22, rect.height - 22), badgeWidth, 14, 7);
      ctx.fillStyle = "rgba(10, 16, 26, 0.72)";
      ctx.fill();
      ctx.strokeStyle = visual.stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = visual.accent;
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.fillText("Active", rect.x + 16, rect.y + Math.max(32, rect.height - 12));
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawSpotSound(ctx, sound, viewport, tileSize, options = {}) {
  const point = getSoundScreenPoint(sound, tileSize, viewport);
  const visual = getSoundVisual(sound.type);
  const baseRadius = options.isScanActive && !options.preview ? 6.75 : 6;
  const isTrigger = sound.type === "trigger";
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
    if (isTrigger) {
      ctx.moveTo(point.x, point.y - (baseRadius + 8));
      ctx.lineTo(point.x + (baseRadius + 8), point.y);
      ctx.lineTo(point.x, point.y + (baseRadius + 8));
      ctx.lineTo(point.x - (baseRadius + 8), point.y);
      ctx.closePath();
    } else {
      ctx.arc(point.x, point.y, baseRadius + 6, 0, Math.PI * 2);
    }
    ctx.fillStyle = "rgba(125, 231, 255, 0.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(125, 231, 255, 0.44)";
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  if (options.isScanActive && !options.preview) {
    ctx.beginPath();
    if (isTrigger) {
      ctx.moveTo(point.x, point.y - (baseRadius + 11));
      ctx.lineTo(point.x + (baseRadius + 11), point.y);
      ctx.lineTo(point.x, point.y + (baseRadius + 11));
      ctx.lineTo(point.x - (baseRadius + 11), point.y);
      ctx.closePath();
    } else {
      ctx.arc(point.x, point.y, baseRadius + 9, 0, Math.PI * 2);
    }
    ctx.fillStyle = visual.fill.replace('0.20', '0.16').replace('0.18', '0.16');
    ctx.fill();
    ctx.strokeStyle = visual.stroke;
    ctx.lineWidth = 1.35;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(point.x, point.y, baseRadius + 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(10, 16, 26, 0.42)";
    ctx.fill();
    ctx.strokeStyle = visual.accent;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (options.isSelected) {
    ctx.beginPath();
    if (isTrigger) {
      ctx.moveTo(point.x, point.y - (baseRadius + 10));
      ctx.lineTo(point.x + (baseRadius + 10), point.y);
      ctx.lineTo(point.x, point.y + (baseRadius + 10));
      ctx.lineTo(point.x - (baseRadius + 10), point.y);
      ctx.closePath();
    } else {
      ctx.arc(point.x, point.y, baseRadius + 8, 0, Math.PI * 2);
    }
    ctx.fillStyle = options.preview ? "rgba(255, 214, 138, 0.10)" : "rgba(255, 179, 71, 0.14)";
    ctx.fill();
    ctx.strokeStyle = options.preview ? "rgba(255, 214, 138, 0.75)" : "rgba(255, 179, 71, 0.70)";
    ctx.lineWidth = 1.2;
    if (options.preview) ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.beginPath();
  if (isTrigger) {
    ctx.moveTo(point.x, point.y - baseRadius);
    ctx.lineTo(point.x + baseRadius, point.y);
    ctx.lineTo(point.x, point.y + baseRadius);
    ctx.lineTo(point.x - baseRadius, point.y);
    ctx.closePath();
  } else {
    ctx.arc(point.x, point.y, baseRadius, 0, Math.PI * 2);
  }
  if (options.isScanActive && !options.preview) {
    ctx.shadowColor = visual.stroke;
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = options.preview ? 1.8 : 1.6;
  if (options.preview) ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  if (isTrigger) {
    ctx.moveTo(point.x - 3.5, point.y + 3.5);
    ctx.lineTo(point.x + 3.5, point.y - 3.5);
    ctx.moveTo(point.x - 3.5, point.y - 1);
    ctx.lineTo(point.x + 1, point.y - 5.5);
  } else {
    ctx.moveTo(point.x - 4, point.y);
    ctx.lineTo(point.x + 4, point.y);
    ctx.moveTo(point.x, point.y - 4);
    ctx.lineTo(point.x, point.y + 4);
  }
  ctx.strokeStyle = options.preview ? "#ffe1ad" : visual.accent;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

function drawSoundMarker(ctx, sound, viewport, tileSize, options = {}) {
  if (isZoneSoundType(sound.type)) {
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

    if (isZoneSoundType(sound.type)) {
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

export function renderSounds(ctx, doc, viewport, interaction, scan = null) {
  const sounds = doc.sounds || [];
  const tileSize = doc.dimensions.tileSize;
  const draggedSelection = new Set(interaction.soundDrag?.active ? getSelectedSoundIndices(interaction) : []);
  const activeScanIds = new Set(scan?.activeSoundIds || []);

  for (let i = 0; i < sounds.length; i += 1) {
    const sound = sounds[i];
    if (!sound?.visible) continue;
    if (draggedSelection.has(i)) continue;

    drawSoundMarker(ctx, sound, viewport, tileSize, {
      isSelected: isSoundSelected(interaction, i),
      isHovered: interaction.hoveredSoundIndex === i,
      alpha: 1,
      isScanActive: activeScanIds.has(sound.id),
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
