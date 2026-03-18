export const DECOR_PRESETS = [
  {
    id: 'grass',
    type: 'grass',
    defaultName: 'Grass',
    defaultVariant: 'a',
  },
  {
    id: 'bush',
    type: 'bush',
    defaultName: 'Bush',
    defaultVariant: 'a',
  },
  {
    id: 'rock',
    type: 'rock',
    defaultName: 'Rock',
    defaultVariant: 'a',
  },
  {
    id: 'flower',
    type: 'flower',
    defaultName: 'Flower',
    defaultVariant: 'a',
  },
  {
    id: 'sign',
    type: 'sign',
    defaultName: 'Sign',
    defaultVariant: 'a',
  },
];

export const DEFAULT_DECOR_PRESET_ID = 'grass';

export function findDecorPresetById(presetId) {
  return DECOR_PRESETS.find((preset) => preset.id === presetId) || null;
}
