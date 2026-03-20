import { findEntityPresetByType } from "./entityPresets.js";

const ENTITY_VISUALS = {
  "player-spawn": {
    key: "player-spawn",
    label: "Player Spawn",
    stroke: "#8ef3ff",
    hitRadius: 8.5,
  },
  lantern: {
    key: "lantern",
    label: "Lantern",
    stroke: "#ffe29a",
    hitRadius: 8,
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
  ["lantern", "lantern"],
  ["trigger", "trigger"],
  ["checkpoint", "checkpoint"],
  ["generic", "generic"],
]);

function normalizeEntityType(type) {
  return String(type || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

export function getEntityVisual(entityType) {
  const normalizedType = normalizeEntityType(entityType);
  const visualKey = ENTITY_TYPE_ALIASES.get(normalizedType) || normalizedType || "generic";
  const preset = findEntityPresetByType(visualKey) || findEntityPresetByType("generic");
  const baseVisual = ENTITY_VISUALS[visualKey] || ENTITY_VISUALS.generic;

  return {
    ...baseVisual,
    img: preset?.img || null,
    drawW: preset?.drawW || 24,
    drawH: preset?.drawH || 24,
    drawAnchor: preset?.drawAnchor || "BL",
  };
}

export function getEntityHitRadius(entityType) {
  return getEntityVisual(entityType).hitRadius;
}
