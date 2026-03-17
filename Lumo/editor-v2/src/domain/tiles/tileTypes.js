/**
 * @typedef {0 | 1 | 2 | 3} TileKind
 * Reserved for future tile workflow (behavior/sprite/brush).
 */

/**
 * @typedef TileDefinition
 * @property {TileKind} kind
 * @property {string} label
 * @property {string} color
 */

/** @type {Record<TileKind, TileDefinition>} */
export const TILE_DEFINITIONS = {
  0: { kind: 0, label: "Void", color: "#10182b" },
  1: { kind: 1, label: "Solid", color: "#5cb8ff" },
  2: { kind: 2, label: "Hazard", color: "#ff6d7e" },
  3: { kind: 3, label: "Accent", color: "#90f1b8" },
};
