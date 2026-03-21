import { getSelectedSoundIds, isSoundSelected } from "../../domain/sound/selection.js";
import { getSoundVisual } from "../../domain/sound/soundVisuals.js";

const SOUND_STATE_LOOKUP_CACHE = new WeakMap();

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

function withAlpha(color, alpha) {
  if (typeof color !== "string") return color;
  if (color.startsWith("#")) {
    const normalized = color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;
    const hex = normalized.slice(1);
    if (hex.length === 6) {
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  const rgbaMatch = color.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgbaMatch) return color;
  const [r = "255", g = "255", b = "255"] = rgbaMatch[1].split(",").map((part) => part.trim());
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function fillRoundedRect(ctx, rect, radius, fillStyle) {
  ctx.save();
  drawRoundedRectPath(ctx, rect, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function getSoundStateLookup(scan) {
  const soundStates = Array.isArray(scan?.audioEvaluation?.soundStates) ? scan.audioEvaluation.soundStates : null;
  if (!soundStates) return null;
  let lookup = SOUND_STATE_LOOKUP_CACHE.get(soundStates);
  if (!lookup) {
    lookup = new Map();
    for (const soundState of soundStates) {
      if (soundState?.soundId) lookup.set(soundState.soundId, soundState);
    }
    SOUND_STATE_LOOKUP_CACHE.set(soundStates, lookup);
  }
  return lookup;
}

function getSoundEvaluation(scan, soundId) {
  if (!soundId) return null;
  return getSoundStateLookup(scan)?.get(soundId) || null;
}

function getSoundPresence(options = {}) {
  const evaluation = options.soundEvaluation;
  const intensity = clamp01(evaluation?.normalizedIntensity ?? (options.isScanActive ? 1 : 0));
  const phase = evaluation?.phase || (options.isScanActive ? "active" : "inactive");
  return {
    evaluation,
    intensity,
    phase,
    isTriggered: phase === "triggered",
    isSustain: phase === "sustain",
    isFadeIn: phase === "fadeIn",
    isFadeOut: phase === "fadeOut",
  };
}

function drawZoneSound(ctx, sound, viewport, tileSize, scan, options = {}) {
  const rect = getSoundScreenRect(sound, tileSize, viewport);
  const visual = getSoundVisual(sound.type);
  const stroke = options.preview ? "#ffd68a" : options.isSelected ? "#ffb347" : options.isHovered ? "#7de7ff" : visual.stroke;
  options.soundEvaluation = options.soundEvaluation || getSoundEvaluation(scan, sound.id);
  const presence = getSoundPresence(options);
  const intensity = presence.intensity;
  const fill = options.preview ? "rgba(255, 214, 138, 0.16)" : options.isSelected ? "rgba(255, 179, 71, 0.16)" : options.isScanActive ? visual.fill.replace('0.16', '0.22') : visual.fill;
  const outlineWidth = options.preview ? 1.8 : options.isSelected ? 1.8 : options.isScanActive ? 1.5 : 1.25;
  const isAmbientZone = sound.type === "ambientZone";
  const isMusicZone = sound.type === "musicZone";
  const cornerRadius = isAmbientZone ? 14 : 10;
  const fadeDistanceTiles = Math.max(0, Number(sound?.params?.fadeDistance) || 0);
  const fadeDistancePx = Math.min(rect.width * 0.48, fadeDistanceTiles * tileSize * viewport.zoom);
  const scanPositionX = Number.isFinite(presence.evaluation?.positionX) ? presence.evaluation.positionX : Number.isFinite(scan?.positionX) ? scan.positionX : sound.x;

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
    const ambientLift = options.preview ? 0 : intensity * 0.035;
    const ambientFlow = options.preview ? 0 : ((scanPositionX - sound.x) % 1 + 1) % 1;
    const ambientDrift = rect.height * ambientFlow * 0.08;
    const ambientGradient = ctx.createLinearGradient(rect.x, rect.y - ambientDrift, rect.x, rect.y + rect.height);
    ambientGradient.addColorStop(0, options.preview ? "rgba(255, 214, 138, 0.12)" : `rgba(126, 240, 199, ${0.15 + ambientLift})`);
    ambientGradient.addColorStop(0.45, options.preview ? "rgba(255, 214, 138, 0.08)" : `rgba(84, 193, 165, ${0.1 + ambientLift * 0.65})`);
    ambientGradient.addColorStop(1, options.preview ? "rgba(255, 214, 138, 0.04)" : `rgba(126, 240, 199, ${0.06 + ambientLift * 0.4})`);
    ctx.fillStyle = ambientGradient;
    ctx.fill();

    const hazeInset = 8;
    const shimmerOffset = options.preview ? 0 : (ambientFlow - 0.5) * Math.min(rect.height * 0.05, 5);
    drawRoundedRectPath(ctx, { x: rect.x + hazeInset, y: rect.y + hazeInset + shimmerOffset, width: Math.max(0, rect.width - hazeInset * 2), height: Math.max(0, rect.height - hazeInset * 2) }, Math.max(6, cornerRadius - hazeInset));
    ctx.fillStyle = options.preview ? "rgba(255, 225, 173, 0.04)" : `rgba(223, 255, 245, ${0.035 + intensity * 0.025})`;
    ctx.fill();

    const bandCount = Math.max(2, Math.min(4, Math.floor(rect.height / 28)));
    ctx.strokeStyle = options.preview ? "rgba(255, 225, 173, 0.48)" : "rgba(223, 255, 245, 0.18)";
    ctx.lineWidth = 1;
    for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
      const ratio = (bandIndex + 1) / (bandCount + 1);
      const bandY = rect.y + rect.height * ratio + shimmerOffset * (0.2 + ratio * 0.15);
      const amplitude = 2.2 + (bandIndex % 2) * 1 + intensity * 0.7;
      ctx.beginPath();
      ctx.moveTo(rect.x + 14, bandY);
      ctx.bezierCurveTo(
        rect.x + rect.width * 0.3,
        bandY - amplitude,
        rect.x + rect.width * 0.7,
        bandY + amplitude,
        rect.x + rect.width - 14,
        bandY,
      );
      ctx.stroke();
    }
  } else if (isMusicZone) {
    const musicEnergy = options.preview ? 0 : intensity * 0.6;
    const energyBand = options.preview ? 0.5 : ((scanPositionX - sound.x) % 1 + 1) % 1;
    const bandCenterX = rect.x + rect.width * energyBand;
    const baseGradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
    baseGradient.addColorStop(0, options.preview ? "rgba(255, 214, 138, 0.14)" : `rgba(200, 157, 255, ${0.16 + musicEnergy * 0.08})`);
    baseGradient.addColorStop(1, options.preview ? "rgba(255, 214, 138, 0.08)" : `rgba(123, 87, 173, ${0.12 + musicEnergy * 0.06})`);
    ctx.fillStyle = baseGradient;
    ctx.fill();

    const innerRect = { x: rect.x + 1.5, y: rect.y + 1.5, width: Math.max(0, rect.width - 3), height: Math.max(0, rect.height - 3) };
    const sustainRect = {
      x: innerRect.x + fadeDistancePx,
      y: innerRect.y,
      width: Math.max(0, innerRect.width - fadeDistancePx * 2),
      height: innerRect.height,
    };
    if (fadeDistancePx > 0) {
      const fadeEdgeAlpha = 0.065 + musicEnergy * 0.05;
      fillRoundedRect(ctx, { x: innerRect.x, y: innerRect.y, width: fadeDistancePx, height: innerRect.height }, Math.max(0, cornerRadius - 2), options.preview ? "rgba(255, 225, 173, 0.06)" : `rgba(243, 231, 255, ${fadeEdgeAlpha})`);
      fillRoundedRect(ctx, { x: innerRect.x + innerRect.width - fadeDistancePx, y: innerRect.y, width: fadeDistancePx, height: innerRect.height }, Math.max(0, cornerRadius - 2), options.preview ? "rgba(255, 225, 173, 0.06)" : `rgba(243, 231, 255, ${fadeEdgeAlpha})`);
    }
    if (sustainRect.width > 6) {
      const sustainAlpha = presence.isSustain ? 0.085 + musicEnergy * 0.07 : 0.06 + musicEnergy * 0.035;
      fillRoundedRect(ctx, sustainRect, Math.max(0, cornerRadius - 3), options.preview ? "rgba(255, 225, 173, 0.04)" : `rgba(243, 231, 255, ${sustainAlpha})`);
    }

    if (!options.preview && musicEnergy > 0.01) {
      const bandHalfWidth = Math.max(18, rect.width * (presence.isSustain ? 0.12 : 0.085));
      const energyGradient = ctx.createLinearGradient(bandCenterX - bandHalfWidth, rect.y, bandCenterX + bandHalfWidth, rect.y);
      energyGradient.addColorStop(0, "rgba(243, 231, 255, 0)");
      energyGradient.addColorStop(0.5, `rgba(243, 231, 255, ${0.055 + musicEnergy * (presence.isSustain ? 0.11 : 0.06)})`);
      energyGradient.addColorStop(1, "rgba(243, 231, 255, 0)");
      ctx.save();
      drawRoundedRectPath(ctx, innerRect, Math.max(0, cornerRadius - 2));
      ctx.fillStyle = energyGradient;
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = options.preview ? "rgba(255, 225, 173, 0.34)" : "rgba(243, 231, 255, 0.18)";
    ctx.lineWidth = 1;
    const stripeSpacing = 16;
    ctx.beginPath();
    for (let stripeX = rect.x - rect.height; stripeX < rect.x + rect.width; stripeX += stripeSpacing) {
      ctx.moveTo(stripeX, rect.y + rect.height);
      ctx.lineTo(stripeX + rect.height, rect.y);
    }
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = options.preview ? "rgba(255, 225, 173, 0.55)" : withAlpha(visual.accent, options.isScanActive ? 0.4 + musicEnergy * 0.28 : 0.4);
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 5]);
    if (fadeDistancePx > 0) {
      for (const boundaryX of [rect.x + fadeDistancePx, rect.x + rect.width - fadeDistancePx]) {
        ctx.beginPath();
        ctx.moveTo(boundaryX, rect.y + 4);
        ctx.lineTo(boundaryX, rect.y + rect.height - 4);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.restore();

    const cueY = rect.y + rect.height * 0.5;
    ctx.save();
    ctx.strokeStyle = options.preview ? "rgba(255, 225, 173, 0.42)" : "rgba(243, 231, 255, 0.34)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(rect.x + 10, cueY);
    ctx.lineTo(rect.x + Math.min(rect.width - 10, 18), cueY);
    ctx.moveTo(rect.x + rect.width - Math.min(rect.width - 10, 18), cueY);
    ctx.lineTo(rect.x + rect.width - 10, cueY);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.fillStyle = fill;
    ctx.fill();
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

function drawSpotSound(ctx, sound, viewport, tileSize, scan, options = {}) {
  const point = getSoundScreenPoint(sound, tileSize, viewport);
  const visual = getSoundVisual(sound.type);
  options.soundEvaluation = options.soundEvaluation || getSoundEvaluation(scan, sound.id);
  const presence = getSoundPresence(options);
  const intensity = presence.intensity;
  const pulseScale = options.preview ? 0 : intensity;
  const baseRadius = sound.type === "trigger" ? (options.isScanActive && !options.preview ? 7.5 : 6.75) : options.isScanActive && !options.preview ? 7 : 6;
  const isTrigger = sound.type === "trigger";
  const stroke = options.preview ? "#ffd68a" : options.isSelected ? "#ffb347" : options.isHovered ? "#7de7ff" : visual.stroke;
  const fill = options.preview ? "rgba(255, 214, 138, 0.20)" : visual.fill;
  const radiusTiles = clampZoneSize(sound?.params?.radius, 0);
  const spatial = Boolean(sound?.params?.spatial);
  const radiusPx = radiusTiles > 0 ? radiusTiles * tileSize * viewport.zoom : 0;
  const responsiveRadius = baseRadius + (!isTrigger && !options.preview ? pulseScale * 1.25 : 0);
  const outerAuraRadius = Math.max(responsiveRadius + 2, responsiveRadius * (1.42 + pulseScale * 0.16));

  ctx.save();
  ctx.globalAlpha *= options.alpha ?? 1;

  if (spatial && radiusPx > 0) {
    if (isTrigger) {
      const directionalWidth = Math.max(radiusPx, 24);
      const directionalGradient = ctx.createLinearGradient(point.x, point.y, point.x + directionalWidth, point.y);
      directionalGradient.addColorStop(0, options.preview ? "rgba(255, 214, 138, 0.12)" : options.isScanActive ? "rgba(255, 179, 107, 0.18)" : "rgba(255, 179, 107, 0.12)");
      directionalGradient.addColorStop(1, "rgba(255, 179, 107, 0.00)");
      ctx.beginPath();
      ctx.moveTo(point.x, point.y - Math.max(12, baseRadius + 4));
      ctx.lineTo(point.x + directionalWidth, point.y);
      ctx.lineTo(point.x, point.y + Math.max(12, baseRadius + 4));
      ctx.closePath();
      ctx.fillStyle = directionalGradient;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(point.x + 0.5, point.y - (radiusPx + 6));
      ctx.lineTo(point.x + 0.5, point.y + (radiusPx + 6));
      ctx.strokeStyle = options.preview ? "rgba(255, 214, 138, 0.46)" : withAlpha(visual.stroke, options.isScanActive ? 0.55 : 0.34);
      ctx.lineWidth = 1;
      if (options.preview) ctx.setLineDash([8, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const outerGradient = ctx.createRadialGradient(point.x, point.y, Math.max(2, responsiveRadius * 0.65), point.x, point.y, radiusPx);
      outerGradient.addColorStop(0, options.preview ? "rgba(255, 214, 138, 0.12)" : `rgba(101, 214, 255, ${0.12 + pulseScale * 0.08})`);
      outerGradient.addColorStop(0.55, options.preview ? "rgba(255, 214, 138, 0.06)" : `rgba(101, 214, 255, ${0.05 + pulseScale * 0.03})`);
      outerGradient.addColorStop(1, "rgba(101, 214, 255, 0)");
      ctx.beginPath();
      ctx.arc(point.x, point.y, radiusPx, 0, Math.PI * 2);
      ctx.fillStyle = outerGradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(point.x, point.y, radiusPx, 0, Math.PI * 2);
      ctx.strokeStyle = options.preview ? "rgba(255, 214, 138, 0.42)" : withAlpha(visual.stroke, options.isScanActive ? 0.42 : 0.26);
      ctx.lineWidth = 1;
      if (options.preview) ctx.setLineDash([8, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (radiusPx > baseRadius * 2.8) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, radiusPx * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = withAlpha(visual.accent, options.isScanActive ? 0.14 + pulseScale * 0.16 : 0.14);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
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
      ctx.arc(point.x, point.y, responsiveRadius + 6, 0, Math.PI * 2);
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
      ctx.arc(point.x, point.y, outerAuraRadius + 2, 0, Math.PI * 2);
    }
    ctx.fillStyle = visual.fill.replace('0.20', '0.16').replace('0.18', '0.16');
    ctx.fill();
    ctx.strokeStyle = visual.stroke;
    ctx.lineWidth = 1.35;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(point.x, point.y, responsiveRadius + 3.5, 0, Math.PI * 2);
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
      ctx.arc(point.x, point.y, responsiveRadius + 8, 0, Math.PI * 2);
    }
    ctx.fillStyle = options.preview ? "rgba(255, 214, 138, 0.10)" : "rgba(255, 179, 71, 0.14)";
    ctx.fill();
    ctx.strokeStyle = options.preview ? "rgba(255, 214, 138, 0.75)" : "rgba(255, 179, 71, 0.70)";
    ctx.lineWidth = 1.2;
    if (options.preview) ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (isTrigger) {
    const lineTop = point.y - Math.max(radiusPx, 22);
    const lineBottom = point.y + Math.max(radiusPx, 22);
    ctx.beginPath();
    ctx.moveTo(point.x + 0.5, lineTop);
    ctx.lineTo(point.x + 0.5, lineBottom);
    ctx.strokeStyle = withAlpha(stroke, options.isScanActive && !options.preview ? 0.9 : 0.72);
    ctx.lineWidth = options.preview ? 1.6 : 1.3;
    if (options.preview) ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(point.x - baseRadius * 0.9, point.y);
    ctx.lineTo(point.x + baseRadius * 0.95, point.y - baseRadius * 0.95);
    ctx.lineTo(point.x + baseRadius * 0.95, point.y + baseRadius * 0.95);
    ctx.closePath();
    if (options.isScanActive && !options.preview) {
      ctx.shadowColor = visual.stroke;
      ctx.shadowBlur = 10 + (presence.isTriggered ? 12 : 0);
    }
    ctx.fillStyle = presence.isTriggered && !options.preview ? "rgba(255, 179, 107, 0.30)" : fill;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = options.preview ? 1.8 : 1.6;
    if (options.preview) ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(point.x - baseRadius * 0.7, point.y, presence.isTriggered && !options.preview ? 2.8 : 2.1, 0, Math.PI * 2);
    ctx.fillStyle = options.preview ? "#ffe1ad" : visual.accent;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(point.x - 1.5, point.y);
    ctx.lineTo(point.x + baseRadius * 0.45, point.y);
    ctx.strokeStyle = options.preview ? "#ffe1ad" : visual.accent;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  } else {
    const coreGradient = ctx.createRadialGradient(point.x - 1, point.y - 1, 1, point.x, point.y, responsiveRadius);
    coreGradient.addColorStop(0, options.preview ? "rgba(255, 248, 227, 0.95)" : withAlpha(visual.accent, options.isScanActive ? 0.88 + pulseScale * 0.07 : 0.88));
    coreGradient.addColorStop(0.35, options.preview ? "rgba(255, 214, 138, 0.42)" : withAlpha(visual.stroke, options.isScanActive ? 0.42 + pulseScale * 0.2 : 0.42));
    coreGradient.addColorStop(1, fill);
    ctx.beginPath();
    ctx.arc(point.x, point.y, responsiveRadius, 0, Math.PI * 2);
    if (options.isScanActive && !options.preview) {
      ctx.shadowColor = visual.stroke;
      ctx.shadowBlur = 12 + pulseScale * 8;
    }
    ctx.fillStyle = coreGradient;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = options.preview ? 1.8 : 1.6;
    if (options.preview) ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(2.2, responsiveRadius * 0.34), 0, Math.PI * 2);
    ctx.fillStyle = options.preview ? "rgba(255, 248, 227, 0.94)" : withAlpha(visual.accent, options.isScanActive ? 0.84 + pulseScale * 0.1 : 0.84);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(point.x, point.y, outerAuraRadius, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha(visual.accent, options.isScanActive && !options.preview ? 0.18 + pulseScale * 0.16 : 0.18);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawSoundMarker(ctx, sound, viewport, tileSize, scan, options = {}) {
  if (isZoneSoundType(sound.type)) {
    drawZoneSound(ctx, sound, viewport, tileSize, scan, options);
    return;
  }
  drawSpotSound(ctx, sound, viewport, tileSize, scan, options);
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
  const draggedSelection = new Set(
    interaction.soundDrag?.active
      ? getSelectedSoundIds(interaction).length
        ? getSelectedSoundIds(interaction)
        : (interaction.selectedSoundIndices || []).map((index) => sounds[index]?.id).filter(Boolean)
      : [],
  );
  const activeScanIds = new Set(scan?.activeSoundIds || []);
  getSoundStateLookup(scan);

  for (let i = 0; i < sounds.length; i += 1) {
    const sound = sounds[i];
    if (!sound?.visible) continue;
    if (draggedSelection.has(sound.id)) continue;

    drawSoundMarker(ctx, sound, viewport, tileSize, scan, {
      isSelected: isSoundSelected(interaction, sound.id, sounds),
      isHovered: interaction.hoveredSoundId ? interaction.hoveredSoundId === sound.id : interaction.hoveredSoundIndex === i,
      alpha: 1,
      isScanActive: activeScanIds.has(sound.id),
    });
  }
}

export function renderSoundDragPreview(ctx, doc, viewport, interaction) {
  const soundDrag = interaction.soundDrag;
  if (!soundDrag?.active) return;
  const soundsById = new Map((doc.sounds || []).filter((sound) => sound?.id).map((sound) => [sound.id, sound]));

  for (const origin of soundDrag.originPositions || []) {
    const sound = soundsById.get(origin.soundId);
    if (!sound?.visible) continue;

    drawSoundMarker(ctx, { ...sound, x: origin.x + (soundDrag.previewDelta?.x || 0), y: origin.y + (soundDrag.previewDelta?.y || 0) }, viewport, doc.dimensions.tileSize, null, {
      isSelected: true,
      preview: true,
      alpha: 0.92,
    });
  }
}

export function renderSoundPlacementPreview(ctx, doc, viewport, interaction, activePreset) {
  if (interaction.activeTool !== "inspect") return;
  if (interaction.soundPlacementPreviewSuppressed) return;
  if (!interaction.hoverCell || !activePreset) return;

  drawSoundMarker(ctx, {
    type: activePreset.type,
    x: interaction.hoverCell.x,
    y: interaction.hoverCell.y,
    params: activePreset.defaultParams,
  }, viewport, doc.dimensions.tileSize, null, {
    preview: true,
    alpha: 0.9,
  });
}
