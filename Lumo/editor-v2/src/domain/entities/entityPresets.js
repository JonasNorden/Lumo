export const ENTITY_PRESETS = [
  {
    id: "player-spawn",
    type: "player-spawn",
    defaultName: "Player Spawn",
  },
  {
    id: "lantern",
    type: "lantern",
    defaultName: "Lantern",
  },
  {
    id: "trigger",
    type: "trigger",
    defaultName: "Trigger",
  },
  {
    id: "checkpoint",
    type: "checkpoint",
    defaultName: "Checkpoint",
  },
  {
    id: "generic",
    type: "generic",
    defaultName: "Generic",
  },
];

export const DEFAULT_ENTITY_PRESET_ID = "generic";

export function findEntityPresetById(presetId) {
  return ENTITY_PRESETS.find((preset) => preset.id === presetId) || null;
}
