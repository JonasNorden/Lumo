import { findDecorPresetByType } from "../domain/decor/decorPresets.js";
import { findEntityPresetByType } from "../domain/entities/entityPresets.js";

const ENTITY_LIGHT_SOURCES = {
  lantern: {
    radiusTiles: 6,
    anchorY: 0.42,
    glow: "255, 220, 148",
    core: "255, 244, 201",
  },
  checkpoint: {
    radiusTiles: 4.5,
    anchorY: 0.42,
    glow: "164, 212, 255",
    core: "224, 242, 255",
  },
};

const DECOR_LIGHT_SOURCES = {
  lantern_01: {
    radiusTiles: 5.25,
    anchorY: 0.42,
    glow: "255, 214, 138",
    core: "255, 244, 201",
  },
  firefly_01: {
    radiusTiles: 2.1,
    anchorY: 0.36,
    glow: "184, 255, 154",
    core: "240, 255, 216",
  },
  powercell_01: {
    radiusTiles: 3.8,
    anchorY: 0.46,
    glow: "116, 214, 255",
    core: "220, 247, 255",
  },
};

function clampLightRadius(value, fallback) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1.5, parsed);
}

function createLightSource(x, y, radiusTiles, glow, core) {
  return {
    x,
    y,
    radiusTiles,
    glow,
    core,
  };
}

function getEntityLightSource(entity, tileSize) {
  const preset = ENTITY_LIGHT_SOURCES[entity?.type];
  if (!preset) return null;

  const entityPreset = findEntityPresetByType(entity.type);
  const drawHeightTiles = (entityPreset?.drawH || 24) / tileSize;
  const originX = (entity.x + 0.5) * tileSize;
  const originY = (entity.y + Math.max(0.16, preset.anchorY)) * tileSize;

  return createLightSource(
    originX,
    originY - Math.max(0, drawHeightTiles - 1) * tileSize * 0.2,
    clampLightRadius(entity?.params?.lightRadius, preset.radiusTiles),
    preset.glow,
    preset.core,
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
    preset.radiusTiles,
    preset.glow,
    preset.core,
  );
}

export function renderDarknessPreview(ctx, doc, viewport) {
  if (!doc) return;

  const { tileSize } = doc.dimensions;
  const { width, height } = ctx.canvas;
  const worldLights = [];

  for (const entity of doc.entities || []) {
    if (!entity?.visible) continue;
    const light = getEntityLightSource(entity, tileSize);
    if (light) worldLights.push(light);
  }

  for (const decor of doc.decor || []) {
    if (!decor?.visible) continue;
    const light = getDecorLightSource(decor, tileSize);
    if (light) worldLights.push(light);
  }

  ctx.save();

  const darknessGradient = ctx.createLinearGradient(0, 0, 0, height);
  darknessGradient.addColorStop(0, "rgba(12, 18, 34, 0.58)");
  darknessGradient.addColorStop(0.45, "rgba(7, 12, 24, 0.72)");
  darknessGradient.addColorStop(1, "rgba(3, 6, 14, 0.82)");
  ctx.fillStyle = darknessGradient;
  ctx.fillRect(0, 0, width, height);

  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.42,
    Math.min(width, height) * 0.14,
    width * 0.5,
    height * 0.42,
    Math.max(width, height) * 0.82,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(0.58, "rgba(2, 5, 12, 0.2)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.48)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "screen";

  for (const light of worldLights) {
    const lightX = viewport.offsetX + light.x * viewport.zoom;
    const lightY = viewport.offsetY + light.y * viewport.zoom;
    const outerRadius = Math.max(tileSize * viewport.zoom * 1.6, light.radiusTiles * tileSize * viewport.zoom);
    const innerRadius = outerRadius * 0.18;

    const halo = ctx.createRadialGradient(lightX, lightY, innerRadius, lightX, lightY, outerRadius);
    halo.addColorStop(0, `rgba(${light.core}, 0.52)`);
    halo.addColorStop(0.22, `rgba(${light.glow}, 0.34)`);
    halo.addColorStop(0.7, `rgba(${light.glow}, 0.12)`);
    halo.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(lightX, lightY, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    const core = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, outerRadius * 0.28);
    core.addColorStop(0, `rgba(${light.core}, 0.34)`);
    core.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(lightX, lightY, outerRadius * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
