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

  return {
    key: preset?.id || "decor_flower_01",
    label: preset?.defaultName || "Decor",
    img: preset?.img || null,
    drawW: preset?.drawW || 24,
    drawH: preset?.drawH || 24,
    drawAnchor: preset?.drawAnchor || "BL",
    hitRadius: Math.max(8, ((preset?.drawW || 24) / 2) * 0.7),
  };
}

export function getDecorHitRadius(decorType) {
  return getDecorVisual(decorType).hitRadius;
}
