import { cloneEntityParams } from "../entities/entityParams.js";

export const SOUND_PRESETS = [
  {
    id: "spot",
    type: "spot",
    defaultName: "Spot Sound",
    defaultParams: {
      volume: 1,
      pitch: 1,
      radius: 4,
      spatial: true,
    },
  },
  {
    id: "ambient-zone",
    type: "ambientZone",
    defaultName: "Ambient Zone",
    defaultParams: {
      volume: 0.75,
      pitch: 1,
      width: 6,
      height: 4,
    },
  },
  {
    id: "music-zone",
    type: "musicZone",
    defaultName: "Music Zone",
    defaultParams: {
      volume: 0.85,
      width: 8,
      height: 5,
    },
  },
];

export const DEFAULT_SOUND_PRESET_ID = "spot";

export function findSoundPresetById(presetId) {
  return SOUND_PRESETS.find((preset) => preset.id === presetId) || null;
}

export function getSoundPresetDefaultParams(presetId) {
  const preset = findSoundPresetById(presetId);
  return cloneEntityParams(preset?.defaultParams || {});
}
