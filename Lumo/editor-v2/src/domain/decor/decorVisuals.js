const DEFAULT_VISUAL_KEY = 'grass';

const DECOR_VISUALS = {
  grass: {
    key: 'grass',
    fill: '#285a2e',
    stroke: '#90d86e',
    accent: '#d8f5a8',
    hitRadius: 8,
    marker: 'grass',
  },
  bush: {
    key: 'bush',
    fill: '#214833',
    stroke: '#77c18d',
    accent: '#c5efb7',
    hitRadius: 8.5,
    marker: 'bush',
  },
  rock: {
    key: 'rock',
    fill: '#394459',
    stroke: '#c5d0ea',
    accent: '#8693ad',
    hitRadius: 8.5,
    marker: 'rock',
  },
  flower: {
    key: 'flower',
    fill: '#4a2242',
    stroke: '#ffb2e6',
    accent: '#ffe27c',
    hitRadius: 7.5,
    marker: 'flower',
  },
  sign: {
    key: 'sign',
    fill: '#4b331c',
    stroke: '#f4d3a3',
    accent: '#ffe6bf',
    hitRadius: 8.5,
    marker: 'sign',
  },
};

const DECOR_TYPE_ALIASES = new Map([
  ['grass', 'grass'],
  ['tuft', 'grass'],
  ['bush', 'bush'],
  ['shrub', 'bush'],
  ['rock', 'rock'],
  ['stone', 'rock'],
  ['flower', 'flower'],
  ['blossom', 'flower'],
  ['sign', 'sign'],
  ['marker', 'sign'],
]);

function normalizeDecorType(type) {
  return String(type || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

export function getDecorVisual(decorType) {
  const normalizedType = normalizeDecorType(decorType);
  const visualKey = DECOR_TYPE_ALIASES.get(normalizedType) || normalizedType || DEFAULT_VISUAL_KEY;
  return DECOR_VISUALS[visualKey] || DECOR_VISUALS[DEFAULT_VISUAL_KEY];
}

export function getDecorHitRadius(decorType) {
  return getDecorVisual(decorType).hitRadius;
}
