const SOUND_OVERLAY_STYLE = Object.freeze({
  stroke: "rgba(97, 191, 255, 0.78)",
  fill: "rgba(97, 191, 255, 0.12)",
  dash: [7, 5],
});

const AGGRO_OVERLAY_STYLE = Object.freeze({
  stroke: "rgba(255, 107, 107, 0.82)",
  fill: "rgba(255, 107, 107, 0.12)",
  dash: [8, 6],
});

const TRIGGER_OVERLAY_STYLE = Object.freeze({
  stroke: "rgba(255, 214, 102, 0.9)",
  fill: "rgba(255, 214, 102, 0.13)",
  dash: [4, 4],
});

function parsePositiveNumber(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function resolveSoundZoneRect(sound, tileSize, viewport) {
  const widthTiles = parsePositiveNumber(sound?.params?.width);
  const heightTiles = parsePositiveNumber(sound?.params?.height);
  if (!widthTiles || !heightTiles) return null;

  return {
    x: viewport.offsetX + sound.x * tileSize * viewport.zoom,
    y: viewport.offsetY + sound.y * tileSize * viewport.zoom,
    width: widthTiles * tileSize * viewport.zoom,
    height: heightTiles * tileSize * viewport.zoom,
  };
}

function resolveSoundPoint(sound, tileSize, viewport) {
  return {
    x: viewport.offsetX + (sound.x + 0.5) * tileSize * viewport.zoom,
    y: viewport.offsetY + (sound.y + 0.5) * tileSize * viewport.zoom,
  };
}

function resolveSoundRadiusPx(sound, tileSize, viewport) {
  const radiusTiles = parsePositiveNumber(sound?.params?.radius);
  if (!radiusTiles) return null;
  return radiusTiles * tileSize * viewport.zoom;
}

function drawDashedCircle(ctx, center, radius, style) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 1.15;
  ctx.setLineDash(style.dash);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawDashedRect(ctx, rect, style) {
  ctx.save();
  ctx.fillStyle = style.fill;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 1.1;
  ctx.setLineDash(style.dash);
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, Math.max(0, rect.width - 1), Math.max(0, rect.height - 1));
  ctx.setLineDash([]);
  ctx.restore();
}

function resolveEntityScreenCenter(entity, tileSize, viewport) {
  return {
    x: viewport.offsetX + (entity.x + 0.5) * tileSize * viewport.zoom,
    y: viewport.offsetY + (entity.y + 0.5) * tileSize * viewport.zoom,
  };
}

function resolveEntityOverlayFromParams(entity, tileSize) {
  const entityType = String(entity?.type || "").toLowerCase();
  if (entityType === "fog_volume" || entityType === "water_volume") return null;
  const params = entity?.params;
  if (!params || typeof params !== "object") return null;

  const aggroTiles = parsePositiveNumber(params.aggroTiles ?? params.followTiles ?? params.loseSightTiles);
  if (aggroTiles) {
    return {
      type: "aggro",
      radiusPx: aggroTiles * tileSize,
    };
  }

  const aggroRadius = parsePositiveNumber(params.aggroRadius);
  if (aggroRadius) {
    return {
      type: "aggro",
      radiusPx: aggroRadius,
    };
  }

  const triggerDistance = parsePositiveNumber(params.triggerDistance ?? params.triggerRadius ?? params.triggerTiles);
  if (triggerDistance) {
    return {
      type: "trigger",
      radiusPx: triggerDistance * tileSize,
    };
  }

  const interactionRadius = parsePositiveNumber(params.interaction?.radius ?? params.interactionRadius);
  if (interactionRadius) {
    return {
      type: "trigger",
      radiusPx: interactionRadius,
    };
  }

  if (entity.type === "trigger") {
    const triggerRadiusTiles = parsePositiveNumber(params.radius);
    if (triggerRadiusTiles) {
      return {
        type: "trigger",
        radiusPx: triggerRadiusTiles * tileSize,
      };
    }
  }

  return null;
}

function renderSoundOverlays(ctx, doc, viewport) {
  const sounds = doc?.sounds || [];
  const tileSize = doc?.dimensions?.tileSize;
  if (!Number.isFinite(tileSize) || tileSize <= 0) return;

  for (const sound of sounds) {
    if (!sound?.visible) continue;

    if (sound.type === "ambientZone" || sound.type === "musicZone") {
      const zoneRect = resolveSoundZoneRect(sound, tileSize, viewport);
      if (!zoneRect) continue;
      drawDashedRect(ctx, zoneRect, SOUND_OVERLAY_STYLE);
      continue;
    }

    const radiusPx = resolveSoundRadiusPx(sound, tileSize, viewport);
    if (!radiusPx) continue;
    const center = resolveSoundPoint(sound, tileSize, viewport);
    drawDashedCircle(ctx, center, radiusPx, SOUND_OVERLAY_STYLE);
  }
}

function renderEntityOverlays(ctx, doc, viewport) {
  const entities = doc?.entities || [];
  const tileSize = doc?.dimensions?.tileSize;
  if (!Number.isFinite(tileSize) || tileSize <= 0) return;

  for (const entity of entities) {
    if (!entity?.visible) continue;

    const overlay = resolveEntityOverlayFromParams(entity, tileSize);
    if (!overlay?.radiusPx) continue;

    const style = overlay.type === "aggro" ? AGGRO_OVERLAY_STYLE : TRIGGER_OVERLAY_STYLE;
    const center = resolveEntityScreenCenter(entity, tileSize, viewport);
    drawDashedCircle(ctx, center, overlay.radiusPx * viewport.zoom, style);
  }
}

export function renderProximityOverlays(ctx, doc, viewport, ui = {}) {
  if (!ui.proximityOverlaysEnabled) return;
  if (!doc) return;
  renderSoundOverlays(ctx, doc, viewport);
  renderEntityOverlays(ctx, doc, viewport);
}
