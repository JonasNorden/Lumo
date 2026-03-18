const DEFAULT_VISUAL_KEY = "generic";

const ENTITY_VISUALS = {
  "player-spawn": {
    key: "player-spawn",
    label: "Player Spawn",
    baseColor: "#6ee7ff",
    fill: "#16324d",
    stroke: "#8ef3ff",
    symbol: "spawn",
    shape: "hex",
    hitRadius: 8.5,
  },
  lantern: {
    key: "lantern",
    label: "Lantern",
    baseColor: "#ffd166",
    fill: "#4a3410",
    stroke: "#ffe29a",
    symbol: "lantern",
    shape: "circle",
    hitRadius: 8,
  },
  trigger: {
    key: "trigger",
    label: "Trigger",
    baseColor: "#ff7aa2",
    fill: "#4a1830",
    stroke: "#ffb3ca",
    symbol: "plus",
    shape: "diamond",
    hitRadius: 8.5,
  },
  checkpoint: {
    key: "checkpoint",
    label: "Checkpoint",
    baseColor: "#a78bfa",
    fill: "#251c4d",
    stroke: "#d7c7ff",
    symbol: "flag",
    shape: "shield",
    hitRadius: 8.5,
  },
  generic: {
    key: "generic",
    label: "Generic",
    baseColor: "#8ea0b8",
    fill: "#1d2636",
    stroke: "#c7d2e3",
    symbol: "dot",
    shape: "rounded-square",
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
  const visualKey = ENTITY_TYPE_ALIASES.get(normalizedType) || normalizedType || DEFAULT_VISUAL_KEY;
  return ENTITY_VISUALS[visualKey] || ENTITY_VISUALS[DEFAULT_VISUAL_KEY];
}

export function getEntityHitRadius(entityType) {
  return getEntityVisual(entityType).hitRadius;
}
