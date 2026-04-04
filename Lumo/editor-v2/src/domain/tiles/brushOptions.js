import { BRUSH_SPRITE_OPTIONS } from "./tileSpriteCatalog.js";
export { BRUSH_SPRITE_OPTIONS };

const TILE_BEHAVIOR_GROUP_DEFINITIONS = [
  { value: "all", label: "All", profileIds: [] },
  { value: "solid", label: "Solid", profileIds: ["tile.solid.default"] },
  { value: "ice", label: "Ice", profileIds: ["tile.solid.ice"] },
  { value: "brake", label: "Brake", profileIds: ["tile.solid.brake"] },
  { value: "sticky", label: "Sticky", profileIds: ["tile.solid.sticky"] },
  { value: "rapid", label: "Rapid", profileIds: ["tile.solid.rapid"] },
  { value: "one-way", label: "One-way", profileIds: ["tile.one-way.default"] },
  { value: "hazard", label: "Hazard", profileIds: ["tile.hazard.default"] },
];

const TILE_ID_TO_BEHAVIOR_GROUP = new Map([
  [2, "one-way"],
  [3, "hazard"],
  [4, "ice"],
  [5, "brake"],
]);

const PROFILE_ID_TO_BEHAVIOR_GROUP = new Map(
  TILE_BEHAVIOR_GROUP_DEFINITIONS.flatMap((definition) =>
    definition.profileIds.map((profileId) => [profileId, definition.value])),
);

export const BRUSH_BEHAVIOR_OPTIONS = TILE_BEHAVIOR_GROUP_DEFINITIONS.map((definition) => ({
  value: definition.value,
  label: definition.label,
}));

export function getBehaviorGroupIdForSpriteOption(spriteOption) {
  const profileId = String(spriteOption?.behaviorProfileId || "").trim();
  if (profileId && PROFILE_ID_TO_BEHAVIOR_GROUP.has(profileId)) {
    return PROFILE_ID_TO_BEHAVIOR_GROUP.get(profileId);
  }

  if (Number.isInteger(spriteOption?.tileId) && TILE_ID_TO_BEHAVIOR_GROUP.has(spriteOption.tileId)) {
    return TILE_ID_TO_BEHAVIOR_GROUP.get(spriteOption.tileId);
  }

  return "solid";
}

export function getBrushSpriteOptionsForBehavior(behaviorId) {
  const normalizedBehaviorId = String(behaviorId || "").trim();
  const resolvedBehaviorId = BRUSH_BEHAVIOR_OPTIONS.some((option) => option.value === normalizedBehaviorId)
    ? normalizedBehaviorId
    : BRUSH_BEHAVIOR_OPTIONS[0].value;

  if (resolvedBehaviorId === "all") return BRUSH_SPRITE_OPTIONS;

  return BRUSH_SPRITE_OPTIONS.filter((option) => getBehaviorGroupIdForSpriteOption(option) === resolvedBehaviorId);
}

export const BRUSH_SIZE_OPTIONS = [
  { value: "1x1", label: "1×1" },
  { value: "2x2", label: "2×2" },
  { value: "3x3", label: "3×3" },
];

export const BRUSH_PALETTE_PRESETS = [
  {
    id: "empty",
    label: "Empty",
    color: "#141a29",
    brush: { behavior: "solid", size: "1x1", sprite: "soil_c" },
  },
  {
    id: "solid",
    label: "Solid",
    color: "#637aa8",
    brush: { behavior: "solid", size: "1x1", sprite: "soil_c" },
  },
  {
    id: "ice",
    label: "Ice",
    color: "#7fb7d9",
    brush: { behavior: "ice", size: "1x1", sprite: "ice_01" },
  },
  {
    id: "hazard",
    label: "Hazard",
    color: "#bf4d4d",
    brush: { behavior: "hazard", size: "1x1", sprite: "stone_ct" },
  },
];
