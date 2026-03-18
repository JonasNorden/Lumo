export const DECOR_PRESETS = [
  {
    id: 'grass',
    type: 'grass',
    defaultName: 'Grass',
    defaultVariant: 'a',
    variants: ['a'],
  },
  {
    id: 'bush',
    type: 'bush',
    defaultName: 'Bush',
    defaultVariant: 'a',
    variants: ['a'],
  },
  {
    id: 'rock',
    type: 'rock',
    defaultName: 'Rock',
    defaultVariant: 'a',
    variants: ['a'],
  },
  {
    id: 'flower',
    type: 'flower',
    defaultName: 'Flower',
    defaultVariant: 'a',
    variants: ['a'],
  },
  {
    id: 'sign',
    type: 'sign',
    defaultName: 'Sign',
    defaultVariant: 'a',
    variants: ['a'],
  },
];

export const DEFAULT_DECOR_PRESET_ID = 'grass';

export function findDecorPresetById(presetId) {
  return DECOR_PRESETS.find((preset) => preset.id === presetId) || null;
}
