import { findDecorPresetByType } from "../domain/decor/decorPresets.js";
import { findEntityPresetByType } from "../domain/entities/entityPresets.js";

const RUNTIME_DARKNESS_ALPHA = 0.93;
const DEFAULT_PLAYER_PREVIEW_ENERGY = 0.72;
const PLAYER_LIGHT_MIN_RADIUS = 80;
const PLAYER_LIGHT_MAX_RADIUS = 320;
const PLAYER_LIGHT_STRENGTH = 0.6;
const PLAYER_LIGHT_ANCHOR_Y = 0.42;
const PLAYER_DOWNLIGHT_SCALE = 0.78;

const ENTITY_LIGHT_SOURCES = {
  lantern: {
    radiusPx: 170,
    strength: 0.85,
    anchorY: 0.42,
  },
};

const DECOR_LIGHT_SOURCES = {
  lantern_01: {
    radiusPx: 170,
    strength: 0.85,
    anchorY: 0.42,
  },
};

let darknessLayerTarget = null;

function ensureDarknessLayerTarget(width, height) {
  if (typeof document === "undefined") return null;
  if (!darknessLayerTarget) {
    const canvas = document.createElement("canvas");
    const layerCtx = canvas.getContext("2d");
    if (!layerCtx) return null;
    darknessLayerTarget = { canvas, ctx: layerCtx };
  }

  if (darknessLayerTarget.canvas.width !== width) darknessLayerTarget.canvas.width = width;
  if (darknessLayerTarget.canvas.height !== height) darknessLayerTarget.canvas.height = height;

  return darknessLayerTarget;
}

function clampRuntimeRadius(value, fallback) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0) return fallback;
  return parsed;
}

function createLightSource(x, y, radiusPx, strength, kind, options = {}) {
  return {
    x,
    y,
    radiusPx,
    strength,
    kind,
    ...options,
  };
}

function getEntityLightSource(entity, tileSize) {
  const preset = ENTITY_LIGHT_SOURCES[entity?.type];
  if (!preset) return null;

  const entityPreset = findEntityPresetByType(entity.type);
  const drawHeightTiles = (entityPreset?.drawH || 24) / tileSize;
  const originX = (entity.x + 0.5) * tileSize;
  const originY = (entity.y + Math.max(0.16, preset.anchorY)) * tileSize;

  const authoredRadius = clampRuntimeRadius(entity?.params?.lightRadius, preset.radiusPx);
  const radiusPx = authoredRadius <= 32 ? authoredRadius * tileSize : authoredRadius;
  const strength = clampRuntimeRadius(entity?.params?.strength, preset.strength);

  return createLightSource(
    originX,
    originY - Math.max(0, drawHeightTiles - 1) * tileSize * 0.2,
    radiusPx,
    strength,
    "lantern",
  );
}

function getDecorLightSource(decor, tileSize) {
  const preset = DECOR_LIGHT_SOURCES[decor?.type];
  if (!preset) return null;

  const decorPreset = findDecorPresetByType(decor.type);
  const drawHeightTiles = (decorPreset?.drawH || 24) / tileSize;
  const originX = (decor.x + 0.5) * tileSize;
  const originY = (decor.y + preset.anchorY) * tileSize;

  return createLightSource(
    originX,
    originY - Math.max(0, drawHeightTiles - 1) * tileSize * 0.18,
    preset.radiusPx,
    preset.strength,
    "lantern",
  );
}

export function getPreviewPlayerLight(doc) {
  if (!doc) return null;
  const { tileSize } = doc.dimensions;
  const visibleEntities = Array.isArray(doc.entities) ? doc.entities.filter((entity) => entity?.visible !== false) : [];
  const spawn =
    visibleEntities.find((entity) => entity?.type === "player-spawn")
    || visibleEntities[0]
    || null;

  const fallbackX = Math.max(0.5, (doc.dimensions?.width || 1) * 0.25);
  const fallbackY = Math.max(0.5, (doc.dimensions?.height || 1) * 0.6);
  const originTileX = (spawn?.x ?? fallbackX) + 0.5;
  const originTileY = (spawn?.y ?? fallbackY) + PLAYER_LIGHT_ANCHOR_Y;
  const energy = DEFAULT_PLAYER_PREVIEW_ENERGY;
  const radiusPx = PLAYER_LIGHT_MIN_RADIUS + (PLAYER_LIGHT_MAX_RADIUS - PLAYER_LIGHT_MIN_RADIUS) * energy;

  return createLightSource(originTileX * tileSize, originTileY * tileSize, radiusPx, PLAYER_LIGHT_STRENGTH, "player", { energy });
}

export function collectDarknessPreviewLights(doc) {
  if (!doc) return [];

  const { tileSize } = doc.dimensions;
  const lights = [];
  const playerLight = getPreviewPlayerLight(doc);
  if (playerLight) lights.push(playerLight);

  for (const entity of doc.entities || []) {
    if (!entity?.visible) continue;
    const light = getEntityLightSource(entity, tileSize);
    if (light) lights.push(light);
  }

  for (const decor of doc.decor || []) {
    if (!decor?.visible) continue;
    const light = getDecorLightSource(decor, tileSize);
    if (light) lights.push(light);
  }

  return lights;
}

function punchCircularLight(ctx, x, y, radius, strength) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(0, 0, 0, ${Math.min(1, strength).toFixed(3)})`);
  gradient.addColorStop(0.55, `rgba(0, 0, 0, ${(strength * 0.85).toFixed(3)})`);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function punchPlayerLight(ctx, x, y, radius, strength) {
  ctx.save();
  ctx.translate(x, y - radius * 0.08);
  ctx.scale(1, PLAYER_DOWNLIGHT_SCALE);
  punchCircularLight(ctx, 0, 0, radius, strength);
  ctx.restore();

  const upperBiasRadius = radius * 0.74;
  const upperBiasStrength = Math.min(1, strength * 0.42);
  punchCircularLight(ctx, x, y - radius * 0.18, upperBiasRadius, upperBiasStrength);
}

export function renderDarknessPreview(ctx, doc, viewport) {
  if (!doc) return;

  const target = ensureDarknessLayerTarget(ctx.canvas.width, ctx.canvas.height);
  const darknessCtx = target?.ctx || ctx;
  const layerCanvas = target?.canvas || ctx.canvas;
  const previewLights = collectDarknessPreviewLights(doc);

  darknessCtx.save();
  darknessCtx.setTransform(1, 0, 0, 1, 0, 0);
  darknessCtx.globalCompositeOperation = "source-over";
  darknessCtx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
  darknessCtx.fillStyle = `rgba(0, 0, 0, ${RUNTIME_DARKNESS_ALPHA})`;
  darknessCtx.fillRect(0, 0, layerCanvas.width, layerCanvas.height);
  darknessCtx.globalCompositeOperation = "destination-out";

  for (const light of previewLights) {
    const lightX = viewport.offsetX + light.x * viewport.zoom;
    const lightY = viewport.offsetY + light.y * viewport.zoom;
    const radius = Math.max(36, light.radiusPx * viewport.zoom);

    if (light.kind === "player") {
      punchPlayerLight(darknessCtx, lightX, lightY, radius, light.strength);
      continue;
    }

    punchCircularLight(darknessCtx, lightX, lightY, radius, light.strength);
  }

  darknessCtx.restore();

  if (target) {
    ctx.drawImage(target.canvas, 0, 0);
  }
}
