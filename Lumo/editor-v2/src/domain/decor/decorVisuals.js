import { findDecorPresetByType } from "./decorPresets.js";

const LEGACY_DECOR_ALIASES = new Map([
  ["grass", "decor_flower_01"],
  ["tuft", "decor_flower_01"],
  ["flower", "decor_flower_01"],
  ["decor-flower-01", "decor_flower_01"],
  ["bush", "bush"],
  ["shrub", "bush"],
  ["rock", "rock"],
  ["stone", "rock"],
  ["sign", "sign"],
  ["marker", "sign"],
]);

function normalizeDecorType(type) {
  return String(type || "")
    .trim()
    .toLowerCase();
}

export function getDecorVisual(decorType) {
  const normalizedType = normalizeDecorType(decorType);
  const resolvedType = LEGACY_DECOR_ALIASES.get(normalizedType) || normalizedType;
  const preset = findDecorPresetByType(resolvedType) || findDecorPresetByType("decor_flower_01");
  const drawW = preset?.drawW || 24;
  const drawH = preset?.drawH || 24;

  return {
    key: preset?.id || "decor_flower_01",
    label: preset?.defaultName || "Decor",
    img: preset?.img || null,
    drawW,
    drawH,
    drawAnchor: preset?.drawAnchor || "BL",
    drawOffX: Number.isFinite(preset?.drawOffX) ? preset.drawOffX : 0,
    drawOffY: Number.isFinite(preset?.drawOffY) ? preset.drawOffY : 0,
    footprint: {
      w: Number.isFinite(preset?.footprint?.w) ? Math.max(1, Math.round(preset.footprint.w)) : Math.max(1, Math.ceil(drawW / 24)),
      h: Number.isFinite(preset?.footprint?.h) ? Math.max(1, Math.round(preset.footprint.h)) : Math.max(1, Math.ceil(drawH / 24)),
    },
    sizeTiles: {
      w: Number.isFinite(preset?.sizeTiles?.w) ? Math.max(0.25, preset.sizeTiles.w) : Math.max(0.25, Math.round((drawW / 24) * 100) / 100),
      h: Number.isFinite(preset?.sizeTiles?.h) ? Math.max(0.25, preset.sizeTiles.h) : Math.max(0.25, Math.round((drawH / 24) * 100) / 100),
    },
    hitRadius: Math.max(8, Math.max(drawW, drawH) * 0.38),
  };
}

export function getDecorHitRadius(decorType) {
  return getDecorVisual(decorType).hitRadius;
}
