import { findEntityPresetById, getEntityPresetForType } from "./entityPresets.js";

const ENTITY_VISUALS = {
  "player-spawn": {
    key: "player-spawn",
    label: "Player Spawn",
    stroke: "#8ef3ff",
    hitRadius: 8.5,
  },
  "player-exit": {
    key: "player-exit",
    label: "Exit",
    stroke: "#ffd68e",
    hitRadius: 8.5,
  },
  lantern_01: {
    key: "lantern_01",
    label: "Lantern",
    stroke: "#ffe29a",
    hitRadius: 8,
  },
  firefly_01: {
    key: "firefly_01",
    label: "Firefly",
    stroke: "#e3f7a4",
    hitRadius: 7,
  },
  dark_creature_01: {
    key: "dark_creature_01",
    label: "Dark Creature",
    stroke: "#bda9ff",
    hitRadius: 9,
  },
  hover_void_01: {
    key: "hover_void_01",
    label: "Hover Void",
    stroke: "#cba7ff",
    hitRadius: 8.5,
  },
  trigger: {
    key: "trigger",
    label: "Trigger",
    stroke: "#ffb3ca",
    hitRadius: 8.5,
  },
  checkpoint: {
    key: "checkpoint",
    label: "Checkpoint",
    stroke: "#d7c7ff",
    hitRadius: 8.5,
  },
  fog_volume: {
    key: "fog_volume",
    label: "Fog Volume",
    stroke: "#cbe9ff",
    hitRadius: 10,
    isVolume: true,
  },
  water_volume: {
    key: "water_volume",
    label: "Water Volume",
    stroke: "#76cbff",
    hitRadius: 10,
    isVolume: true,
  },
  lava_volume: {
    key: "lava_volume",
    label: "Lava Volume",
    stroke: "#ff9347",
    hitRadius: 10,
    isVolume: true,
  },
  bubbling_liquid_volume: {
    key: "bubbling_liquid_volume",
    label: "Liquid Acid / Swamp",
    stroke: "#a7e66e",
    hitRadius: 10,
    isVolume: true,
  },
  generic: {
    key: "generic",
    label: "Generic",
    stroke: "#c7d2e3",
    hitRadius: 7.5,
  },
};

const ENTITY_TYPE_ALIASES = new Map([
  ["spawn", "player-spawn"],
  ["player_spawn", "player-spawn"],
  ["player spawn", "player-spawn"],
  ["exit", "player-exit"],
  ["player_exit", "player-exit"],
  ["player exit", "player-exit"],
  ["lantern", "lantern_01"],
]);

function normalizeEntityType(type) {
  return String(type || "")
    .trim()
    .toLowerCase();
}

export function getEntityVisual(entityType, presetId = null) {
  const normalizedType = normalizeEntityType(entityType);
  const visualKey = ENTITY_TYPE_ALIASES.get(normalizedType) || normalizedType || "generic";
  const normalizedPresetId = String(presetId || "").trim().toLowerCase();
  const presetById = normalizedPresetId
    ? findEntityPresetById(normalizedPresetId)
    : findEntityPresetById(visualKey);
  const preset = presetById || getEntityPresetForType(visualKey) || getEntityPresetForType("generic");
  const baseVisual = ENTITY_VISUALS[visualKey] || ENTITY_VISUALS.generic;

  return {
    ...baseVisual,
    img: preset?.img || null,
    drawW: preset?.drawW || 24,
    drawH: preset?.drawH || 24,
    footprintW: preset?.footprintW || preset?.drawW || 24,
    footprintH: preset?.footprintH || preset?.drawH || 24,
    drawAnchor: preset?.drawAnchor || "BL",
    hitRadius: preset?.hitRadius || baseVisual.hitRadius,
    isVolume: baseVisual.isVolume || false,
  };
}

export function getEntityHitRadius(entityType, presetId = null) {
  return getEntityVisual(entityType, presetId).hitRadius;
}
