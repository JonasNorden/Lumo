import { cloneEntityParams } from "../entities/entityParams.js";

const SOUND_TYPE_TO_PRESET_ID = new Map([
  ["spot", "spot"],
  ["trigger", "trigger"],
  ["ambient", "ambient-zone"],
  ["ambientzone", "ambient-zone"],
  ["ambient_zone", "ambient-zone"],
  ["ambient zone", "ambient-zone"],
  ["music", "music-zone"],
  ["musiczone", "music-zone"],
  ["music_zone", "music-zone"],
  ["music zone", "music-zone"],
]);

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
    id: "trigger",
    type: "trigger",
    defaultName: "Trigger Sound",
    defaultParams: {
      volume: 1,
      pitch: 1,
      radius: 3,
      loop: false,
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
      loop: true,
      spatial: false,
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
      pitch: 1,
      loop: true,
      spatial: false,
      width: 8,
      height: 5,
    },
  },
];

export const DEFAULT_SOUND_PRESET_ID = "spot";

export function findSoundPresetById(presetId) {
  return SOUND_PRESETS.find((preset) => preset.id === presetId) || null;
}

export function getSoundPresetIdForType(soundType) {
  const normalized = String(soundType || DEFAULT_SOUND_PRESET_ID).trim().toLowerCase();
  return SOUND_TYPE_TO_PRESET_ID.get(normalized) || DEFAULT_SOUND_PRESET_ID;
}

export function getSoundPresetForType(soundType) {
  return findSoundPresetById(getSoundPresetIdForType(soundType));
}

export function getSoundPresetDefaultParams(presetId) {
  const preset = findSoundPresetById(presetId);
  return cloneEntityParams(preset?.defaultParams || {});
}
