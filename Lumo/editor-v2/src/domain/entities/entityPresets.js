import { cloneEntityParams } from "./entityParams.js";

export const ENTITY_PRESETS = [
  {
    id: "player-spawn",
    type: "player-spawn",
    defaultName: "Player Spawn",
    defaultParams: {},
  },
  {
    id: "lantern",
    type: "lantern",
    defaultName: "Lantern",
    defaultParams: {
      lightRadius: 6,
      flicker: true,
    },
  },
  {
    id: "trigger",
    type: "trigger",
    defaultName: "Trigger",
    defaultParams: {
      event: "",
      radius: 2,
    },
  },
  {
    id: "checkpoint",
    type: "checkpoint",
    defaultName: "Checkpoint",
    defaultParams: {
      respawnId: "",
    },
  },
  {
    id: "generic",
    type: "generic",
    defaultName: "Generic",
    defaultParams: {},
  },
];

export const DEFAULT_ENTITY_PRESET_ID = "generic";

export function findEntityPresetById(presetId) {
  return ENTITY_PRESETS.find((preset) => preset.id === presetId) || null;
}

export function getEntityPresetDefaultParams(presetId) {
  const preset = findEntityPresetById(presetId);
  return cloneEntityParams(preset?.defaultParams || {});
}
