export const BRUSH_BEHAVIOR_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "hazard", label: "Hazard" },
  { value: "accent", label: "Accent" },
];

export const BRUSH_SIZE_OPTIONS = [
  { value: "1x1", label: "1×1" },
  { value: "2x2", label: "2×2" },
  { value: "3x3", label: "3×3" },
];

export const BRUSH_SPRITE_OPTIONS = [
  { value: "soil_a", label: "Soil A" },
  { value: "grass_100", label: "Grass 100" },
  { value: "void_1", label: "Void 1" },
];

export const BRUSH_PALETTE_PRESETS = [
  {
    id: "empty",
    label: "Empty",
    color: "#141a29",
    brush: { behavior: "solid", size: "1x1", sprite: "void_1" },
  },
  {
    id: "solid",
    label: "Solid",
    color: "#637aa8",
    brush: { behavior: "solid", size: "1x1", sprite: "soil_a" },
  },
  {
    id: "hazard",
    label: "Hazard",
    color: "#bf4d4d",
    brush: { behavior: "hazard", size: "1x1", sprite: "grass_100" },
  },
  {
    id: "accent",
    label: "Accent",
    color: "#59a578",
    brush: { behavior: "accent", size: "1x1", sprite: "soil_a" },
  },
];
