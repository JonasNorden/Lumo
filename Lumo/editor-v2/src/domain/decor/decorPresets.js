const DECOR_PRESET_FALLBACKS = [
  {
    id: "grass",
    type: "grass",
    defaultName: "Grass Tuft",
    defaultVariant: "a",
    variants: ["a"],
    img: "../data/assets/sprites/decor/flower_01.png",
    drawW: 24,
    drawH: 40,
    drawAnchor: "BL",
  },
  {
    id: "bush",
    type: "bush",
    defaultName: "Bush",
    defaultVariant: "a",
    variants: ["a"],
    img: "../data/assets/sprites/decor/tree_1.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "BL",
  },
  {
    id: "rock",
    type: "rock",
    defaultName: "Rock",
    defaultVariant: "a",
    variants: ["a"],
    img: "../data/assets/sprites/decor/marble.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "BL",
  },
  {
    id: "sign",
    type: "sign",
    defaultName: "Sign",
    defaultVariant: "a",
    variants: ["a"],
    img: "../data/assets/sprites/decor/banner_01.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "BL",
  },
  {
    id: "decor_flower_01",
    type: "decor_flower_01",
    defaultName: "Flower",
    defaultVariant: "a",
    variants: ["a", "b", "c", "d"],
    img: "../data/assets/sprites/decor/flower_01.png",
    drawW: 24,
    drawH: 40,
    drawAnchor: "BL",
  },
  {
    id: "powercell_01",
    type: "powercell_01",
    defaultName: "Power-cell",
    defaultVariant: "a",
    variants: ["a"],
    img: "../data/assets/sprites/energy/powercell_01.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "BL",
  },
];

const DECOR_PRESET_BY_ID = new Map(DECOR_PRESET_FALLBACKS.map((preset) => [preset.id, preset]));

export const DECOR_PRESETS = DECOR_PRESET_FALLBACKS;

export const DEFAULT_DECOR_PRESET_ID = "decor_flower_01";

export function findDecorPresetById(presetId) {
  return DECOR_PRESET_BY_ID.get(presetId) || null;
}

export function findDecorPresetByType(type) {
  return DECOR_PRESET_FALLBACKS.find((preset) => preset.type === type) || null;
}
