const DEFAULT_TILE_SIZE = 24;
const MIRROR_AREA_MIN_SIZE = 1;
const STONE_AREA_MIN_SIZE = 1;
const DUST_AREA_MIN_SIZE = 1;
const GLOW_AREA_MIN_SIZE = 1;
const SMOKE_AREA_MIN_SIZE = 1;
const WATER_DROP_AREA_MIN_SIZE = 1;
const WATER_DROP_SAFE_FALL_DISTANCE = DEFAULT_TILE_SIZE * 512;
export const MIRROR_SURFACE_DEFAULTS = Object.freeze({
  reflectionHeight: 72,
  reflectionStrength: 0.35,
  distortion: 0.12,
  surfaceStrength: 0.25,
  fade: 0.65,
});

export const STONE_AREA_DEFAULTS = Object.freeze({
  density: 0.35,
  minStoneHeight: 24,
  sizeVariation: 0.45,
  rotationVariation: 0.65,
  clusterStrength: 0.5,
});

export const DUST_AREA_DEFAULTS = Object.freeze({
  density: 0.35,
  sizeVariation: 0.45,
  driftStrength: 0.35,
});

export const GLOW_AREA_DIRECTIONS = Object.freeze(["random", "up", "down", "left", "right"]);
export const SMOKE_AREA_DIRECTIONS = Object.freeze(["random", "up", "down", "left", "right"]);
export const GLOW_AREA_DEFAULTS = Object.freeze({
  density: 0.32,
  sizeVariation: 0.38,
  strength: 0.42,
  direction: "random",
  speed: 0.35,
});

export const SMOKE_AREA_DEFAULTS = Object.freeze({
  density: 0.42,
  size: 0.58,
  strength: 0.46,
  direction: "up",
  speed: 0.28,
});

export const WATER_DROP_AREA_MODES = Object.freeze(["spot", "line"]);
export const WATER_DROP_AREA_DEFAULTS = Object.freeze({
  mode: "spot",
  density: 35,
  speed: 35,
  size: 35,
  length: DEFAULT_TILE_SIZE * 4,
});

function clamp01(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function toNonNegativeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toPositiveNumber(value, fallback = DEFAULT_TILE_SIZE) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clampHumanScale(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, number));
}

export function normalizeSmokeAreaDirection(value) {
  if (value === "up" || value === "down" || value === "left" || value === "right" || value === "random") return value;
  return SMOKE_AREA_DEFAULTS.direction;
}

export function normalizeGlowAreaDirection(value, legacyMotionMode = null) {
  if (value === "up" || value === "down" || value === "left" || value === "right" || value === "random") return value;
  if (legacyMotionMode === "updraft" || value === "updraft") return "up";
  if (legacyMotionMode === "ambient" || value === "ambient") return "random";
  return GLOW_AREA_DEFAULTS.direction;
}

function normalizeStoneHeightRange(area = {}, normalizedAreaHeight = DEFAULT_TILE_SIZE) {
  const heightLimit = Math.max(STONE_AREA_MIN_SIZE, toPositiveNumber(normalizedAreaHeight, DEFAULT_TILE_SIZE));
  const rawMin = toPositiveNumber(area?.minStoneHeight, STONE_AREA_DEFAULTS.minStoneHeight);
  const minStoneHeight = Math.max(1, Math.min(heightLimit, rawMin));
  const rawMax = toPositiveNumber(area?.maxStoneHeight, heightLimit);
  const maxStoneHeight = Math.max(minStoneHeight, Math.min(heightLimit, rawMax));
  return { minStoneHeight, maxStoneHeight };
}

export function getNextAreaId(areas = [], prefix = "mirror_surface") {
  const takenIds = new Set(
    (Array.isArray(areas) ? areas : [])
      .map((area) => area?.id)
      .filter((id) => typeof id === "string" && id.trim()),
  );
  let nextNumber = (Array.isArray(areas) ? areas.length : 0) + 1;
  while (takenIds.has(`${prefix}-${nextNumber}`)) nextNumber += 1;
  return `${prefix}-${nextNumber}`;
}

export function normalizeMirrorSurfaceAreaForEditor(area = {}, index = 0) {
  return {
    id: typeof area?.id === "string" && area.id.trim() ? area.id.trim() : `mirror_surface_${index + 1}`,
    x: toFiniteNumber(area?.x, 0),
    y: toFiniteNumber(area?.y, 0),
    width: Math.max(MIRROR_AREA_MIN_SIZE, toPositiveNumber(area?.width, DEFAULT_TILE_SIZE)),
    height: Math.max(MIRROR_AREA_MIN_SIZE, toPositiveNumber(area?.height, DEFAULT_TILE_SIZE)),
    yOffset: toFiniteNumber(area?.yOffset, 0),
    reflectionHeight: toNonNegativeNumber(area?.reflectionHeight, MIRROR_SURFACE_DEFAULTS.reflectionHeight),
    reflectionStrength: clamp01(area?.reflectionStrength, MIRROR_SURFACE_DEFAULTS.reflectionStrength),
    distortion: clamp01(area?.distortion, MIRROR_SURFACE_DEFAULTS.distortion),
    surfaceStrength: clamp01(area?.surfaceStrength, MIRROR_SURFACE_DEFAULTS.surfaceStrength),
    fade: clamp01(area?.fade, MIRROR_SURFACE_DEFAULTS.fade),
    enabled: area?.enabled !== false,
    visible: area?.visible !== false,
  };
}

export function createMirrorSurfaceAreaFromDrag(doc, startCell, endCell) {
  if (!doc || !startCell || !endCell) return null;
  const tileSize = toPositiveNumber(doc?.dimensions?.tileSize, DEFAULT_TILE_SIZE);
  const minCellX = Math.max(0, Math.min(startCell.x, endCell.x));
  const maxCellX = Math.max(0, Math.max(startCell.x, endCell.x));
  const minCellY = Math.max(0, Math.min(startCell.y, endCell.y));
  const maxCellY = Math.max(0, Math.max(startCell.y, endCell.y));
  const width = Math.max(tileSize, (maxCellX - minCellX + 1) * tileSize);
  const height = Math.max(tileSize, (maxCellY - minCellY + 1) * tileSize);
  return {
    id: getNextAreaId(doc.mirrorSurfaceAreas || [], "mirror_surface"),
    x: minCellX * tileSize,
    y: minCellY * tileSize,
    width,
    height,
    yOffset: 0,
    ...MIRROR_SURFACE_DEFAULTS,
    enabled: true,
    visible: true,
  };
}

export function getMirrorSurfaceAreaBounds(area, index = 0) {
  const normalized = normalizeMirrorSurfaceAreaForEditor(area, index);
  const y = normalized.y + normalized.yOffset;
  return {
    x: normalized.x,
    y,
    width: normalized.width,
    height: normalized.height,
    right: normalized.x + normalized.width,
    bottom: y + normalized.height,
  };
}

export function moveMirrorSurfaceArea(area, deltaX = 0, deltaY = 0) {
  const normalized = normalizeMirrorSurfaceAreaForEditor(area);
  return {
    ...normalized,
    x: Math.max(0, normalized.x + toFiniteNumber(deltaX, 0)),
    y: Math.max(0, normalized.y + toFiniteNumber(deltaY, 0)),
  };
}

export function resizeMirrorSurfaceArea(area, width, height) {
  const normalized = normalizeMirrorSurfaceAreaForEditor(area);
  return {
    ...normalized,
    width: Math.max(MIRROR_AREA_MIN_SIZE, toPositiveNumber(width, normalized.width)),
    height: Math.max(MIRROR_AREA_MIN_SIZE, toPositiveNumber(height, normalized.height)),
  };
}

export function updateMirrorSurfaceAreaField(area, field, value) {
  const normalized = normalizeMirrorSurfaceAreaForEditor(area);
  if (field === "enabled" || field === "visible") return { ...normalized, [field]: Boolean(value) };
  if (field === "x" || field === "y") return { ...normalized, [field]: Math.max(0, toFiniteNumber(value, normalized[field])) };
  if (field === "width" || field === "height") return resizeMirrorSurfaceArea(normalized, field === "width" ? value : normalized.width, field === "height" ? value : normalized.height);
  if (field === "yOffset") return { ...normalized, yOffset: toFiniteNumber(value, normalized.yOffset) };
  if (field === "reflectionHeight") return { ...normalized, reflectionHeight: toNonNegativeNumber(value, normalized.reflectionHeight) };
  if (field === "reflectionStrength" || field === "distortion" || field === "surfaceStrength" || field === "fade") {
    return { ...normalized, [field]: clamp01(value, normalized[field]) };
  }
  return normalized;
}

export function deleteMirrorSurfaceAreaById(areas = [], areaId) {
  if (!Array.isArray(areas)) return [];
  const normalizedId = typeof areaId === "string" && areaId.trim() ? areaId.trim() : null;
  return normalizedId ? areas.filter((area) => area?.id !== normalizedId) : areas.slice();
}


export function normalizeDustAreaForEditor(area = {}, index = 0) {
  return {
    id: typeof area?.id === "string" && area.id.trim() ? area.id.trim() : `dust_area_${index + 1}`,
    x: toFiniteNumber(area?.x, 0),
    y: toFiniteNumber(area?.y, 0),
    width: Math.max(DUST_AREA_MIN_SIZE, toPositiveNumber(area?.width, DEFAULT_TILE_SIZE)),
    height: Math.max(DUST_AREA_MIN_SIZE, toPositiveNumber(area?.height, DEFAULT_TILE_SIZE)),
    density: clamp01(area?.density, DUST_AREA_DEFAULTS.density),
    sizeVariation: clamp01(area?.sizeVariation, DUST_AREA_DEFAULTS.sizeVariation),
    driftStrength: clamp01(area?.driftStrength, DUST_AREA_DEFAULTS.driftStrength),
    enabled: area?.enabled !== false,
    visible: area?.visible !== false,
  };
}

export function createDustAreaFromDrag(doc, startCell, endCell) {
  if (!doc || !startCell || !endCell) return null;
  const tileSize = toPositiveNumber(doc?.dimensions?.tileSize, DEFAULT_TILE_SIZE);
  const minCellX = Math.max(0, Math.min(startCell.x, endCell.x));
  const maxCellX = Math.max(0, Math.max(startCell.x, endCell.x));
  const minCellY = Math.max(0, Math.min(startCell.y, endCell.y));
  const maxCellY = Math.max(0, Math.max(startCell.y, endCell.y));
  const width = Math.max(tileSize, (maxCellX - minCellX + 1) * tileSize);
  const height = Math.max(tileSize, (maxCellY - minCellY + 1) * tileSize);
  return {
    id: getNextAreaId(doc.dustAreas || [], "dust_area"),
    x: minCellX * tileSize,
    y: minCellY * tileSize,
    width,
    height,
    ...DUST_AREA_DEFAULTS,
    enabled: true,
    visible: true,
  };
}

export function getDustAreaBounds(area, index = 0) {
  const normalized = normalizeDustAreaForEditor(area, index);
  return {
    x: normalized.x,
    y: normalized.y,
    width: normalized.width,
    height: normalized.height,
    right: normalized.x + normalized.width,
    bottom: normalized.y + normalized.height,
  };
}

export function moveDustArea(area, deltaX = 0, deltaY = 0) {
  const normalized = normalizeDustAreaForEditor(area);
  return {
    ...normalized,
    x: Math.max(0, normalized.x + toFiniteNumber(deltaX, 0)),
    y: Math.max(0, normalized.y + toFiniteNumber(deltaY, 0)),
  };
}

export function resizeDustArea(area, width, height) {
  const normalized = normalizeDustAreaForEditor(area);
  return {
    ...normalized,
    width: Math.max(DUST_AREA_MIN_SIZE, toPositiveNumber(width, normalized.width)),
    height: Math.max(DUST_AREA_MIN_SIZE, toPositiveNumber(height, normalized.height)),
  };
}

export function updateDustAreaField(area, field, value) {
  const normalized = normalizeDustAreaForEditor(area);
  if (field === "enabled" || field === "visible") return { ...normalized, [field]: Boolean(value) };
  if (field === "x" || field === "y") return { ...normalized, [field]: Math.max(0, toFiniteNumber(value, normalized[field])) };
  if (field === "width" || field === "height") return resizeDustArea(normalized, field === "width" ? value : normalized.width, field === "height" ? value : normalized.height);
  if (field === "density" || field === "sizeVariation" || field === "driftStrength") return { ...normalized, [field]: clamp01(value, normalized[field]) };
  return normalized;
}


export function normalizeSmokeAreaForEditor(area = {}, index = 0) {
  return {
    id: typeof area?.id === "string" && area.id.trim() ? area.id.trim() : `smoke_area_${index + 1}`,
    x: toFiniteNumber(area?.x, 0),
    y: toFiniteNumber(area?.y, 0),
    width: Math.max(SMOKE_AREA_MIN_SIZE, toPositiveNumber(area?.width, DEFAULT_TILE_SIZE)),
    height: Math.max(SMOKE_AREA_MIN_SIZE, toPositiveNumber(area?.height, DEFAULT_TILE_SIZE)),
    density: clamp01(area?.density, SMOKE_AREA_DEFAULTS.density),
    size: clamp01(area?.size, SMOKE_AREA_DEFAULTS.size),
    strength: clamp01(area?.strength, SMOKE_AREA_DEFAULTS.strength),
    direction: normalizeSmokeAreaDirection(area?.direction),
    speed: clamp01(area?.speed, SMOKE_AREA_DEFAULTS.speed),
    enabled: area?.enabled !== false,
    visible: area?.visible !== false,
  };
}

export function createSmokeAreaFromDrag(doc, startCell, endCell) {
  if (!doc || !startCell || !endCell) return null;
  const tileSize = toPositiveNumber(doc?.dimensions?.tileSize, DEFAULT_TILE_SIZE);
  const minCellX = Math.max(0, Math.min(startCell.x, endCell.x));
  const maxCellX = Math.max(0, Math.max(startCell.x, endCell.x));
  const minCellY = Math.max(0, Math.min(startCell.y, endCell.y));
  const maxCellY = Math.max(0, Math.max(startCell.y, endCell.y));
  const width = Math.max(tileSize, (maxCellX - minCellX + 1) * tileSize);
  const height = Math.max(tileSize, (maxCellY - minCellY + 1) * tileSize);
  return {
    id: getNextAreaId(doc.smokeAreas || [], "smoke_area"),
    x: minCellX * tileSize,
    y: minCellY * tileSize,
    width,
    height,
    ...SMOKE_AREA_DEFAULTS,
    enabled: true,
    visible: true,
  };
}

export function getSmokeAreaBounds(area, index = 0) {
  const normalized = normalizeSmokeAreaForEditor(area, index);
  return {
    x: normalized.x,
    y: normalized.y,
    width: normalized.width,
    height: normalized.height,
    right: normalized.x + normalized.width,
    bottom: normalized.y + normalized.height,
  };
}

export function moveSmokeArea(area, deltaX = 0, deltaY = 0) {
  const normalized = normalizeSmokeAreaForEditor(area);
  return {
    ...normalized,
    x: Math.max(0, normalized.x + toFiniteNumber(deltaX, 0)),
    y: Math.max(0, normalized.y + toFiniteNumber(deltaY, 0)),
  };
}

export function resizeSmokeArea(area, width, height) {
  const normalized = normalizeSmokeAreaForEditor(area);
  return {
    ...normalized,
    width: Math.max(SMOKE_AREA_MIN_SIZE, toPositiveNumber(width, normalized.width)),
    height: Math.max(SMOKE_AREA_MIN_SIZE, toPositiveNumber(height, normalized.height)),
  };
}

export function updateSmokeAreaField(area, field, value) {
  const normalized = normalizeSmokeAreaForEditor(area);
  if (field === "enabled" || field === "visible") return { ...normalized, [field]: Boolean(value) };
  if (field === "x" || field === "y") return { ...normalized, [field]: Math.max(0, toFiniteNumber(value, normalized[field])) };
  if (field === "width" || field === "height") return resizeSmokeArea(normalized, field === "width" ? value : normalized.width, field === "height" ? value : normalized.height);
  if (field === "density" || field === "size" || field === "strength" || field === "speed") return { ...normalized, [field]: clamp01(value, normalized[field]) };
  if (field === "direction") return { ...normalized, direction: normalizeSmokeAreaDirection(value) };
  return normalized;
}


export function normalizeWaterDropAreaMode(value) {
  return value === "line" ? "line" : WATER_DROP_AREA_DEFAULTS.mode;
}

export function normalizeWaterDropAreaForEditor(area = {}, index = 0) {
  const mode = normalizeWaterDropAreaMode(area?.mode);
  const length = Math.max(WATER_DROP_AREA_MIN_SIZE, toPositiveNumber(area?.length ?? area?.width, WATER_DROP_AREA_DEFAULTS.length));
  return {
    id: typeof area?.id === "string" && area.id.trim() ? area.id.trim() : `water_drop_area_${index + 1}`,
    x: toFiniteNumber(area?.x, 0),
    y: toFiniteNumber(area?.y, 0),
    mode,
    density: clampHumanScale(area?.density, WATER_DROP_AREA_DEFAULTS.density),
    speed: clampHumanScale(area?.speed, WATER_DROP_AREA_DEFAULTS.speed),
    size: clampHumanScale(area?.size, WATER_DROP_AREA_DEFAULTS.size),
    length: mode === "line" ? length : 0,
    width: mode === "line" ? length : WATER_DROP_AREA_MIN_SIZE,
    height: Math.max(WATER_DROP_AREA_MIN_SIZE, toPositiveNumber(area?.height, DEFAULT_TILE_SIZE * 6)),
    enabled: area?.enabled !== false,
    visible: area?.visible !== false,
  };
}

export function createWaterDropAreaFromDrag(doc, startCell, endCell) {
  if (!doc || !startCell) return null;
  const tileSize = toPositiveNumber(doc?.dimensions?.tileSize, DEFAULT_TILE_SIZE);
  const end = endCell || startCell;
  const minCellX = Math.max(0, Math.min(startCell.x, end.x));
  const maxCellX = Math.max(0, Math.max(startCell.x, end.x));
  const minCellY = Math.max(0, Math.min(startCell.y, end.y));
  const mode = maxCellX > minCellX ? "line" : WATER_DROP_AREA_DEFAULTS.mode;
  const length = Math.max(tileSize, (maxCellX - minCellX + 1) * tileSize);
  return {
    id: getNextAreaId(doc.waterDropAreas || [], "water_drop_area"),
    x: minCellX * tileSize,
    y: minCellY * tileSize,
    mode,
    density: WATER_DROP_AREA_DEFAULTS.density,
    speed: WATER_DROP_AREA_DEFAULTS.speed,
    size: WATER_DROP_AREA_DEFAULTS.size,
    length: mode === "line" ? length : 0,
    width: mode === "line" ? length : WATER_DROP_AREA_MIN_SIZE,
    height: tileSize * 6,
    enabled: true,
    visible: true,
  };
}

export function getWaterDropAreaBounds(area, index = 0) {
  const normalized = normalizeWaterDropAreaForEditor(area, index);
  const width = normalized.mode === "line" ? normalized.length : WATER_DROP_AREA_MIN_SIZE;
  return { x: normalized.x, y: normalized.y, width, height: normalized.height, right: normalized.x + width, bottom: normalized.y + normalized.height };
}

export function moveWaterDropArea(area, deltaX = 0, deltaY = 0) {
  const normalized = normalizeWaterDropAreaForEditor(area);
  return { ...normalized, x: Math.max(0, normalized.x + toFiniteNumber(deltaX, 0)), y: Math.max(0, normalized.y + toFiniteNumber(deltaY, 0)) };
}

export function updateWaterDropAreaField(area, field, value) {
  const normalized = normalizeWaterDropAreaForEditor(area);
  if (field === "enabled" || field === "visible") return { ...normalized, [field]: Boolean(value) };
  if (field === "x" || field === "y") return { ...normalized, [field]: Math.max(0, toFiniteNumber(value, normalized[field])) };
  if (field === "mode") return normalizeWaterDropAreaForEditor({ ...normalized, mode: normalizeWaterDropAreaMode(value) });
  if (field === "length") return normalizeWaterDropAreaForEditor({ ...normalized, length: toPositiveNumber(value, normalized.length) });
  if (field === "density" || field === "speed" || field === "size") return { ...normalized, [field]: clampHumanScale(value, normalized[field]) };
  return normalized;
}

export function getWaterDropAreaSeed(area = {}, index = 0) {
  if (Number.isInteger(area?.seed)) return area.seed >>> 0;
  const normalized = normalizeWaterDropAreaForEditor(area, index);
  return hashStringToUint32(`${normalized.id}|${Math.round(normalized.x)}|${Math.round(normalized.y)}|${normalized.mode}|${Math.round(normalized.length)}|${index}`);
}

export function getWaterDropAreaDropCount(area = {}, index = 0) {
  const normalized = normalizeWaterDropAreaForEditor(area, index);
  if (!normalized.enabled || !normalized.visible || normalized.density <= 0 || normalized.size <= 0) return 0;
  const sourceTiles = normalized.mode === "line" ? Math.max(1, normalized.length / DEFAULT_TILE_SIZE) : 1;
  return Math.max(0, Math.round((2 + sourceTiles * 2.35) * (normalized.density / 100)));
}

const waterDropAreaLayoutCache = new Map();
const waterDropCollisionYCache = new WeakMap();
const EMPTY_WATER_DROP_LAYOUT = Object.freeze([]);

function getWaterDropAreaLayoutCacheKey(area = {}, index = 0) {
  const normalized = normalizeWaterDropAreaForEditor(area, index);
  return [normalized.id, roundTo(normalized.x,100), roundTo(normalized.y,100), normalized.mode, roundTo(normalized.length,100), roundTo(normalized.height,100), roundTo(normalized.density,100), roundTo(normalized.speed,100), roundTo(normalized.size,100), normalized.enabled?1:0, normalized.visible?1:0, Number.isInteger(area?.seed) ? area.seed >>> 0 : "auto"].join("|");
}

export function generateWaterDropAreaLayout(area = {}, index = 0) {
  const normalized = normalizeWaterDropAreaForEditor(area, index);
  const targetCount = getWaterDropAreaDropCount(normalized, index);
  if (targetCount <= 0) return EMPTY_WATER_DROP_LAYOUT;
  const cacheKey = getWaterDropAreaLayoutCacheKey(normalized, index);
  if (waterDropAreaLayoutCache.has(cacheKey)) return waterDropAreaLayoutCache.get(cacheKey);
  const random = mulberry32(getWaterDropAreaSeed(normalized, index));
  const drops = [];
  const fallDistance = Math.max(DEFAULT_TILE_SIZE, normalized.height);
  for (let dropIndex = 0; dropIndex < targetCount; dropIndex += 1) {
    const sourceOffset = normalized.mode === "line" ? random() * normalized.length : 0;
    const radius = 1.15 + (normalized.size / 100) * 2.6 + random() * 0.65;
    const fallSpeed = 18 + (normalized.speed / 100) * 118 + random() * 22;
    drops.push(Object.freeze({
      id: `${normalized.id}-drop-${dropIndex + 1}`,
      sourceX: roundTo(normalized.x + sourceOffset, 100),
      sourceY: roundTo(normalized.y, 100),
      phase: roundTo(random(), 10000),
      fallDistance: roundTo(fallDistance * (0.88 + random() * 0.2), 100),
      fallSpeed: roundTo(fallSpeed, 100),
      radius: roundTo(radius, 100),
      length: roundTo(radius * (2.2 + (normalized.speed / 100) * 2.2), 100),
      alpha: roundTo(0.34 + random() * 0.22, 1000),
      mode: normalized.mode,
    }));
  }
  const frozenDrops = Object.freeze(drops);
  waterDropAreaLayoutCache.set(cacheKey, frozenDrops);
  return frozenDrops;
}

export function resolveWaterDropCollisionY(drop, collisionRects = [], options = {}) {
  const x = toFiniteNumber(drop?.sourceX, 0);
  const sourceY = toFiniteNumber(drop?.sourceY, 0);
  const authoredWorldBottomY = toFiniteNumber(options?.worldBottomY ?? options?.worldHeightPx, Number.NaN);
  const fallbackY = Number.isFinite(authoredWorldBottomY) && authoredWorldBottomY > sourceY
    ? authoredWorldBottomY
    : sourceY + WATER_DROP_SAFE_FALL_DISTANCE;
  const cacheKey = [roundTo(x, 100), roundTo(sourceY, 100), roundTo(fallbackY, 100)].join("|");
  let collisionCache = null;
  if (Array.isArray(collisionRects)) {
    collisionCache = waterDropCollisionYCache.get(collisionRects);
    if (!collisionCache) {
      collisionCache = new Map();
      waterDropCollisionYCache.set(collisionRects, collisionCache);
    } else if (collisionCache.has(cacheKey)) {
      return collisionCache.get(cacheKey);
    }
  }
  let bestY = fallbackY;
  for (const rect of Array.isArray(collisionRects) ? collisionRects : []) {
    const rx = toFiniteNumber(rect?.worldX ?? rect?.x, Number.NaN);
    const ry = toFiniteNumber(rect?.worldY ?? rect?.y, Number.NaN);
    const rw = toFiniteNumber(rect?.worldW ?? rect?.w ?? rect?.width, 0);
    const rh = toFiniteNumber(rect?.worldH ?? rect?.h ?? rect?.height, 0);
    if (!Number.isFinite(rx) || !Number.isFinite(ry) || rw <= 0 || rh <= 0) continue;
    if (x >= rx && x <= rx + rw && ry >= sourceY && ry < bestY) bestY = ry;
  }
  const resolvedY = roundTo(bestY, 100);
  if (collisionCache) collisionCache.set(cacheKey, resolvedY);
  return resolvedY;
}

export function normalizeGlowAreaForEditor(area = {}, index = 0) {
  return {
    id: typeof area?.id === "string" && area.id.trim() ? area.id.trim() : `glow_area_${index + 1}`,
    x: toFiniteNumber(area?.x, 0),
    y: toFiniteNumber(area?.y, 0),
    width: Math.max(GLOW_AREA_MIN_SIZE, toPositiveNumber(area?.width, DEFAULT_TILE_SIZE)),
    height: Math.max(GLOW_AREA_MIN_SIZE, toPositiveNumber(area?.height, DEFAULT_TILE_SIZE)),
    density: clamp01(area?.density, GLOW_AREA_DEFAULTS.density),
    sizeVariation: clamp01(area?.sizeVariation, GLOW_AREA_DEFAULTS.sizeVariation),
    strength: clamp01(area?.strength, GLOW_AREA_DEFAULTS.strength),
    direction: normalizeGlowAreaDirection(area?.direction, area?.motionMode),
    speed: clamp01(area?.speed, GLOW_AREA_DEFAULTS.speed),
    enabled: area?.enabled !== false,
    visible: area?.visible !== false,
  };
}

export function createGlowAreaFromDrag(doc, startCell, endCell) {
  if (!doc || !startCell || !endCell) return null;
  const tileSize = toPositiveNumber(doc?.dimensions?.tileSize, DEFAULT_TILE_SIZE);
  const minCellX = Math.max(0, Math.min(startCell.x, endCell.x));
  const maxCellX = Math.max(0, Math.max(startCell.x, endCell.x));
  const minCellY = Math.max(0, Math.min(startCell.y, endCell.y));
  const maxCellY = Math.max(0, Math.max(startCell.y, endCell.y));
  const width = Math.max(tileSize, (maxCellX - minCellX + 1) * tileSize);
  const height = Math.max(tileSize, (maxCellY - minCellY + 1) * tileSize);
  return {
    id: getNextAreaId(doc.glowAreas || [], "glow_area"),
    x: minCellX * tileSize,
    y: minCellY * tileSize,
    width,
    height,
    ...GLOW_AREA_DEFAULTS,
    enabled: true,
    visible: true,
  };
}

export function getGlowAreaBounds(area, index = 0) {
  const normalized = normalizeGlowAreaForEditor(area, index);
  return {
    x: normalized.x,
    y: normalized.y,
    width: normalized.width,
    height: normalized.height,
    right: normalized.x + normalized.width,
    bottom: normalized.y + normalized.height,
  };
}

export function moveGlowArea(area, deltaX = 0, deltaY = 0) {
  const normalized = normalizeGlowAreaForEditor(area);
  return {
    ...normalized,
    x: Math.max(0, normalized.x + toFiniteNumber(deltaX, 0)),
    y: Math.max(0, normalized.y + toFiniteNumber(deltaY, 0)),
  };
}

export function resizeGlowArea(area, width, height) {
  const normalized = normalizeGlowAreaForEditor(area);
  return {
    ...normalized,
    width: Math.max(GLOW_AREA_MIN_SIZE, toPositiveNumber(width, normalized.width)),
    height: Math.max(GLOW_AREA_MIN_SIZE, toPositiveNumber(height, normalized.height)),
  };
}

export function updateGlowAreaField(area, field, value) {
  const normalized = normalizeGlowAreaForEditor(area);
  if (field === "enabled" || field === "visible") return { ...normalized, [field]: Boolean(value) };
  if (field === "x" || field === "y") return { ...normalized, [field]: Math.max(0, toFiniteNumber(value, normalized[field])) };
  if (field === "width" || field === "height") return resizeGlowArea(normalized, field === "width" ? value : normalized.width, field === "height" ? value : normalized.height);
  if (field === "density" || field === "sizeVariation" || field === "strength" || field === "speed") return { ...normalized, [field]: clamp01(value, normalized[field]) };
  if (field === "direction") return { ...normalized, direction: normalizeGlowAreaDirection(value) };
  if (field === "motionMode") return { ...normalized, direction: normalizeGlowAreaDirection(value) };
  return normalized;
}

export function normalizeStoneAreaForEditor(area = {}, index = 0) {
  const height = Math.max(STONE_AREA_MIN_SIZE, toPositiveNumber(area?.height, DEFAULT_TILE_SIZE));
  const stoneHeightRange = normalizeStoneHeightRange(area, height);
  return {
    id: typeof area?.id === "string" && area.id.trim() ? area.id.trim() : `stone_area_${index + 1}`,
    x: toFiniteNumber(area?.x, 0),
    y: toFiniteNumber(area?.y, 0),
    width: Math.max(STONE_AREA_MIN_SIZE, toPositiveNumber(area?.width, DEFAULT_TILE_SIZE)),
    height,
    minStoneHeight: stoneHeightRange.minStoneHeight,
    maxStoneHeight: stoneHeightRange.maxStoneHeight,
    density: clamp01(area?.density, STONE_AREA_DEFAULTS.density),
    sizeVariation: clamp01(area?.sizeVariation, STONE_AREA_DEFAULTS.sizeVariation),
    rotationVariation: clamp01(area?.rotationVariation, STONE_AREA_DEFAULTS.rotationVariation),
    clusterStrength: clamp01(area?.clusterStrength, STONE_AREA_DEFAULTS.clusterStrength),
    enabled: area?.enabled !== false,
    visible: area?.visible !== false,
  };
}

export function createStoneAreaFromDrag(doc, startCell, endCell) {
  if (!doc || !startCell || !endCell) return null;
  const tileSize = toPositiveNumber(doc?.dimensions?.tileSize, DEFAULT_TILE_SIZE);
  const minCellX = Math.max(0, Math.min(startCell.x, endCell.x));
  const maxCellX = Math.max(0, Math.max(startCell.x, endCell.x));
  const minCellY = Math.max(0, Math.min(startCell.y, endCell.y));
  const maxCellY = Math.max(0, Math.max(startCell.y, endCell.y));
  const width = Math.max(tileSize, (maxCellX - minCellX + 1) * tileSize);
  const height = Math.max(tileSize, (maxCellY - minCellY + 1) * tileSize);
  return {
    id: getNextAreaId(doc.stoneAreas || [], "stone_area"),
    x: minCellX * tileSize,
    y: minCellY * tileSize,
    width,
    height,
    ...STONE_AREA_DEFAULTS,
    maxStoneHeight: height,
    enabled: true,
    visible: true,
  };
}

export function getStoneAreaBounds(area, index = 0) {
  const normalized = normalizeStoneAreaForEditor(area, index);
  return {
    x: normalized.x,
    y: normalized.y,
    width: normalized.width,
    height: normalized.height,
    right: normalized.x + normalized.width,
    bottom: normalized.y + normalized.height,
  };
}

export function moveStoneArea(area, deltaX = 0, deltaY = 0) {
  const normalized = normalizeStoneAreaForEditor(area);
  return {
    ...normalized,
    x: Math.max(0, normalized.x + toFiniteNumber(deltaX, 0)),
    y: Math.max(0, normalized.y + toFiniteNumber(deltaY, 0)),
  };
}

export function resizeStoneArea(area, width, height) {
  const normalized = normalizeStoneAreaForEditor(area);
  const nextHeight = Math.max(STONE_AREA_MIN_SIZE, toPositiveNumber(height, normalized.height));
  const rawMaxStoneHeight = Number(area?.maxStoneHeight);
  const hadAuthoredMaxStoneHeight = Number.isFinite(rawMaxStoneHeight) && rawMaxStoneHeight > 0;
  const maxWasFollowingAreaHeight = !hadAuthoredMaxStoneHeight || Math.abs(normalized.maxStoneHeight - normalized.height) < 0.0001;
  const nextMaxStoneHeight = maxWasFollowingAreaHeight
    ? nextHeight
    : Math.min(normalized.maxStoneHeight, nextHeight);
  return normalizeStoneAreaForEditor({
    ...normalized,
    width: Math.max(STONE_AREA_MIN_SIZE, toPositiveNumber(width, normalized.width)),
    height: nextHeight,
    maxStoneHeight: nextMaxStoneHeight,
  });
}

export function updateStoneAreaField(area, field, value) {
  const normalized = normalizeStoneAreaForEditor(area);
  if (field === "enabled" || field === "visible") return { ...normalized, [field]: Boolean(value) };
  if (field === "x" || field === "y") return { ...normalized, [field]: Math.max(0, toFiniteNumber(value, normalized[field])) };
  if (field === "width" || field === "height") return resizeStoneArea(normalized, field === "width" ? value : normalized.width, field === "height" ? value : normalized.height);
  if (field === "minStoneHeight" || field === "maxStoneHeight") return normalizeStoneAreaForEditor({ ...normalized, [field]: toPositiveNumber(value, normalized[field]) });
  if (field === "density" || field === "sizeVariation" || field === "rotationVariation" || field === "clusterStrength") {
    return { ...normalized, [field]: clamp01(value, normalized[field]) };
  }
  return normalized;
}

function hashStringToUint32(value) {
  const text = String(value || "stone_area");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


function roundTo(value, precision = 100) {
  return Math.round(value * precision) / precision;
}


export function getDustAreaSeed(area = {}, index = 0) {
  if (Number.isInteger(area?.seed)) return area.seed >>> 0;
  const normalized = normalizeDustAreaForEditor(area, index);
  return hashStringToUint32(`${normalized.id}|${Math.round(normalized.x)}|${Math.round(normalized.y)}|${Math.round(normalized.width)}|${Math.round(normalized.height)}`);
}

export function getDustAreaParticleCount(area = {}, index = 0) {
  const normalized = normalizeDustAreaForEditor(area, index);
  if (!normalized.enabled || !normalized.visible || normalized.density <= 0 || normalized.width <= 0 || normalized.height <= 0) return 0;
  const areaTiles = (normalized.width * normalized.height) / (DEFAULT_TILE_SIZE * DEFAULT_TILE_SIZE);
  return Math.max(0, Math.round(areaTiles * normalized.density * 2.4));
}

const dustAreaLayoutCache = new Map();
const EMPTY_DUST_LAYOUT = Object.freeze([]);

function getDustAreaLayoutCacheKey(area = {}, index = 0) {
  const normalized = normalizeDustAreaForEditor(area, index);
  return [
    normalized.id,
    roundTo(normalized.x, 100),
    roundTo(normalized.y, 100),
    roundTo(normalized.width, 100),
    roundTo(normalized.height, 100),
    roundTo(normalized.density, 1000),
    roundTo(normalized.sizeVariation, 1000),
    roundTo(normalized.driftStrength, 1000),
    normalized.enabled ? 1 : 0,
    normalized.visible ? 1 : 0,
    Number.isInteger(area?.seed) ? area.seed >>> 0 : "auto",
  ].join("|");
}

export function generateDustAreaLayout(area = {}, index = 0) {
  const normalized = normalizeDustAreaForEditor(area, index);
  const targetCount = getDustAreaParticleCount(normalized, index);
  if (targetCount <= 0) return EMPTY_DUST_LAYOUT;
  const cacheKey = getDustAreaLayoutCacheKey(normalized, index);
  if (dustAreaLayoutCache.has(cacheKey)) return dustAreaLayoutCache.get(cacheKey);

  const random = mulberry32(getDustAreaSeed(normalized, index));
  const particles = [];
  for (let particleIndex = 0; particleIndex < targetCount; particleIndex += 1) {
    const sizeVariation = normalized.sizeVariation;
    const radius = 0.38 + random() * (0.46 + sizeVariation * 0.92);
    const speed = 0.035 + random() * 0.095;
    const alphaMin = 0.018 + random() * 0.022;
    const alphaMax = alphaMin + 0.045 + random() * 0.07;
    const warmth = 0.45 + random() * 0.55;
    const red = Math.round(190 + warmth * 28);
    const green = Math.round(164 + warmth * 30);
    const blue = Math.round(118 + warmth * 16);
    particles.push(Object.freeze({
      id: `${normalized.id}-dust-${particleIndex + 1}`,
      x: roundTo(normalized.x + random() * normalized.width, 100),
      y: roundTo(normalized.y + random() * normalized.height, 100),
      radius: roundTo(radius, 100),
      driftX: roundTo((1.5 + random() * 6.5) * normalized.driftStrength, 100),
      driftY: roundTo((1.1 + random() * 5.4) * normalized.driftStrength, 100),
      speed: roundTo(speed, 1000),
      phase: roundTo(random() * Math.PI * 2, 1000),
      alphaSpeed: roundTo(0.055 + random() * 0.115, 1000),
      alphaPhase: roundTo(random() * Math.PI * 2, 1000),
      alphaMin: roundTo(alphaMin, 1000),
      alphaMax: roundTo(alphaMax, 1000),
      warmth: roundTo(warmth, 1000),
      color: `rgba(${red}, ${green}, ${blue}, 1)`,
    }));
  }
  const frozenParticles = Object.freeze(particles);
  dustAreaLayoutCache.set(cacheKey, frozenParticles);
  return frozenParticles;
}


export function getSmokeAreaSeed(area = {}, index = 0) {
  if (Number.isInteger(area?.seed)) return area.seed >>> 0;
  const normalized = normalizeSmokeAreaForEditor(area, index);
  return hashStringToUint32(`${normalized.id}|${Math.round(normalized.x)}|${Math.round(normalized.y)}|${Math.round(normalized.width)}|${Math.round(normalized.height)}`);
}

export function getSmokeAreaPuffCount(area = {}, index = 0) {
  const normalized = normalizeSmokeAreaForEditor(area, index);
  if (!normalized.enabled || !normalized.visible || normalized.density <= 0 || normalized.strength <= 0 || normalized.width <= 0 || normalized.height <= 0) return 0;
  const areaTiles = (normalized.width * normalized.height) / (DEFAULT_TILE_SIZE * DEFAULT_TILE_SIZE);
  return Math.max(0, Math.round(areaTiles * normalized.density * 0.72));
}

const smokeAreaLayoutCache = new Map();
const EMPTY_SMOKE_LAYOUT = Object.freeze([]);

function getSmokeAreaLayoutCacheKey(area = {}, index = 0) {
  const normalized = normalizeSmokeAreaForEditor(area, index);
  return [
    normalized.id,
    roundTo(normalized.x, 100),
    roundTo(normalized.y, 100),
    roundTo(normalized.width, 100),
    roundTo(normalized.height, 100),
    roundTo(normalized.density, 1000),
    roundTo(normalized.size, 1000),
    roundTo(normalized.strength, 1000),
    normalized.direction,
    roundTo(normalized.speed, 1000),
    normalized.enabled ? 1 : 0,
    normalized.visible ? 1 : 0,
    Number.isInteger(area?.seed) ? area.seed >>> 0 : "auto",
  ].join("|");
}

export function generateSmokeAreaLayout(area = {}, index = 0) {
  const normalized = normalizeSmokeAreaForEditor(area, index);
  const targetCount = getSmokeAreaPuffCount(normalized, index);
  if (targetCount <= 0) return EMPTY_SMOKE_LAYOUT;
  const cacheKey = getSmokeAreaLayoutCacheKey(normalized, index);
  if (smokeAreaLayoutCache.has(cacheKey)) return smokeAreaLayoutCache.get(cacheKey);

  const random = mulberry32(getSmokeAreaSeed(normalized, index));
  const puffs = [];
  const minSpan = Math.max(1, Math.min(normalized.width, normalized.height));
  const sizeBase = 8 + normalized.size * 28;
  for (let puffIndex = 0; puffIndex < targetCount; puffIndex += 1) {
    const radius = Math.min(minSpan * 0.78, sizeBase * (0.72 + random() * 0.86));
    const warmth = random();
    const red = Math.round(150 + warmth * 12);
    const green = Math.round(153 + warmth * 10);
    const blue = Math.round(158 + random() * 16);
    const baseAlpha = (0.028 + random() * 0.035) * (0.42 + normalized.strength * 0.8);
    puffs.push(Object.freeze({
      id: `${normalized.id}-smoke-${puffIndex + 1}`,
      x: roundTo(normalized.x + random() * normalized.width, 100),
      y: roundTo(normalized.y + random() * normalized.height, 100),
      radius: roundTo(radius, 100),
      innerRadius: roundTo(radius * (0.46 + random() * 0.14), 100),
      driftX: roundTo((2.2 + random() * 7.8) * (0.35 + normalized.size * 0.65), 100),
      driftY: roundTo((2.4 + random() * 8.6) * (0.35 + normalized.size * 0.65), 100),
      travelSpeed: roundTo(0.0015 + normalized.speed * (0.0065 + random() * 0.010), 10000),
      speed: roundTo(0.006 + normalized.speed * (0.012 + random() * 0.018), 1000),
      phase: roundTo(random() * Math.PI * 2, 1000),
      alphaSpeed: roundTo(0.018 + random() * 0.032, 1000),
      alphaPhase: roundTo(random() * Math.PI * 2, 1000),
      alphaMin: roundTo(Math.max(0.012, baseAlpha * 0.72), 1000),
      alphaMax: roundTo(Math.min(0.16, baseAlpha + normalized.strength * (0.045 + random() * 0.028)), 1000),
      areaX: roundTo(normalized.x, 100),
      areaY: roundTo(normalized.y, 100),
      areaWidth: roundTo(normalized.width, 100),
      areaHeight: roundTo(normalized.height, 100),
      direction: normalized.direction,
      authoredSpeed: roundTo(normalized.speed, 1000),
      color: `rgba(${red}, ${green}, ${blue}, 1)`,
      edgeColor: `rgba(${Math.max(120, red - 18)}, ${Math.max(122, green - 16)}, ${Math.min(178, blue + 8)}, 1)`,
    }));
  }
  const frozenPuffs = Object.freeze(puffs);
  smokeAreaLayoutCache.set(cacheKey, frozenPuffs);
  return frozenPuffs;
}


export function getGlowAreaSeed(area = {}, index = 0) {
  if (Number.isInteger(area?.seed)) return area.seed >>> 0;
  const normalized = normalizeGlowAreaForEditor(area, index);
  return hashStringToUint32(`${normalized.id}|${Math.round(normalized.x)}|${Math.round(normalized.y)}|${Math.round(normalized.width)}|${Math.round(normalized.height)}`);
}

export function getGlowAreaPointCount(area = {}, index = 0) {
  const normalized = normalizeGlowAreaForEditor(area, index);
  if (!normalized.enabled || !normalized.visible || normalized.density <= 0 || normalized.strength <= 0 || normalized.width <= 0 || normalized.height <= 0) return 0;
  const areaTiles = (normalized.width * normalized.height) / (DEFAULT_TILE_SIZE * DEFAULT_TILE_SIZE);
  return Math.max(0, Math.round(areaTiles * normalized.density * 1.85));
}

const glowAreaLayoutCache = new Map();
const EMPTY_GLOW_LAYOUT = Object.freeze([]);
const GLOW_PALETTE = Object.freeze([
  Object.freeze({ name: "ember_orange", red: 255, green: 151, blue: 54 }),
  Object.freeze({ name: "warm_gold", red: 255, green: 203, blue: 103 }),
  Object.freeze({ name: "deep_ember", red: 229, green: 91, blue: 34 }),
  Object.freeze({ name: "pale_gold", red: 255, green: 226, blue: 151 }),
  Object.freeze({ name: "ember_orange", red: 255, green: 151, blue: 54 }),
  Object.freeze({ name: "warm_gold", red: 255, green: 203, blue: 103 }),
]);

function getGlowAreaLayoutCacheKey(area = {}, index = 0) {
  const normalized = normalizeGlowAreaForEditor(area, index);
  return [
    normalized.id,
    roundTo(normalized.x, 100),
    roundTo(normalized.y, 100),
    roundTo(normalized.width, 100),
    roundTo(normalized.height, 100),
    roundTo(normalized.density, 1000),
    roundTo(normalized.sizeVariation, 1000),
    roundTo(normalized.strength, 1000),
    normalized.direction,
    roundTo(normalized.speed, 1000),
    normalized.enabled ? 1 : 0,
    normalized.visible ? 1 : 0,
    Number.isInteger(area?.seed) ? area.seed >>> 0 : "auto",
  ].join("|");
}

export function generateGlowAreaLayout(area = {}, index = 0) {
  const normalized = normalizeGlowAreaForEditor(area, index);
  const targetCount = getGlowAreaPointCount(normalized, index);
  if (targetCount <= 0) return EMPTY_GLOW_LAYOUT;
  const cacheKey = getGlowAreaLayoutCacheKey(normalized, index);
  if (glowAreaLayoutCache.has(cacheKey)) return glowAreaLayoutCache.get(cacheKey);

  const random = mulberry32(getGlowAreaSeed(normalized, index));
  const points = [];
  for (let pointIndex = 0; pointIndex < targetCount; pointIndex += 1) {
    const sizeVariation = normalized.sizeVariation;
    const palette = GLOW_PALETTE[Math.floor(random() * GLOW_PALETTE.length)] || GLOW_PALETTE[0];
    const tint = 0.92 + random() * 0.12;
    const radius = 0.85 + random() * (0.55 + sizeVariation * 1.15);
    const strengthAlpha = 0.42 + normalized.strength * 0.95;
    const baseAlpha = (0.105 + random() * 0.07) * strengthAlpha;
    const alphaMax = baseAlpha + (0.095 + random() * 0.09) * normalized.strength;
    const red = Math.max(180, Math.min(255, Math.round(palette.red * tint)));
    const green = Math.max(82, Math.min(236, Math.round(palette.green * tint)));
    const blue = Math.max(26, Math.min(168, Math.round(palette.blue * tint)));
    points.push(Object.freeze({
      id: `${normalized.id}-glow-${pointIndex + 1}`,
      x: roundTo(normalized.x + random() * normalized.width, 100),
      y: roundTo(normalized.y + random() * normalized.height, 100),
      radius: roundTo(radius, 100),
      auraRadius: roundTo(radius * (2.8 + random() * 0.95), 100),
      coreRadius: roundTo(Math.max(0.42, radius * (0.42 + random() * 0.16)), 100),
      driftX: roundTo((0.42 + random() * 1.85) * (0.45 + sizeVariation * 0.55), 100),
      driftY: roundTo((0.7 + random() * 1.9) * (0.5 + sizeVariation * 0.6), 100),
      rise: roundTo(0.12 + random() * 0.42, 100),
      travelSpeed: roundTo(0.002 + normalized.speed * (0.018 + random() * 0.026), 1000),
      speed: roundTo((0.006 + normalized.speed * (0.018 + random() * 0.036)), 1000),
      phase: roundTo(random() * Math.PI * 2, 1000),
      alphaSpeed: roundTo(0.022 + random() * 0.044, 1000),
      alphaPhase: roundTo(random() * Math.PI * 2, 1000),
      alphaMin: roundTo(Math.max(0.045, baseAlpha), 1000),
      alphaMax: roundTo(Math.min(0.38, Math.max(baseAlpha + 0.055, alphaMax)), 1000),
      areaX: roundTo(normalized.x, 100),
      areaY: roundTo(normalized.y, 100),
      areaWidth: roundTo(normalized.width, 100),
      areaHeight: roundTo(normalized.height, 100),
      direction: normalized.direction,
      authoredSpeed: roundTo(normalized.speed, 1000),
      color: `rgba(${red}, ${green}, ${blue}, 1)`,
      auraColor: `rgba(${red}, ${green}, ${blue}, 1)`,
      coreColor: `rgba(255, ${Math.min(245, green + 30)}, ${Math.min(190, blue + 64)}, 1)`,
      palette: palette.name,
    }));
  }
  const frozenPoints = Object.freeze(points);
  glowAreaLayoutCache.set(cacheKey, frozenPoints);
  return frozenPoints;
}

const stoneVisualGeometryCache = new Map();

function getStoneVisualGeometryCacheKey(stone = {}) {
  return [
    stone.id || "stone",
    roundTo(Number(stone.radiusX) || 0, 100),
    roundTo(Number(stone.radiusY) || 0, 100),
    roundTo(Number(stone.rotation) || 0, 1000),
    roundTo(Number(stone.shade) || 0, 1000),
  ].join("|");
}

function createStoneVisualGeometry(stone = {}) {
  const random = mulberry32(hashStringToUint32(getStoneVisualGeometryCacheKey(stone)));
  const upperPointCount = 5 + Math.floor(random() * 3);
  const leftBaseX = roundTo(-0.86 - random() * 0.1, 1000);
  const rightBaseX = roundTo(0.86 + random() * 0.1, 1000);
  const points = [{ x: leftBaseX, y: 1 }];
  for (let pointIndex = 0; pointIndex < upperPointCount; pointIndex += 1) {
    const t = upperPointCount === 1 ? 0.5 : pointIndex / (upperPointCount - 1);
    const arc = Math.sin(t * Math.PI);
    const shoulder = Math.sin(t * Math.PI * 0.72);
    const x = leftBaseX + (rightBaseX - leftBaseX) * t + (random() - 0.5) * (0.08 + arc * 0.1);
    const y = 0.76 - (arc * (1.48 + random() * 0.18)) - (shoulder * 0.1) + (random() - 0.5) * 0.12;
    points.push({
      x: roundTo(Math.max(leftBaseX + 0.04, Math.min(rightBaseX - 0.04, x)), 1000),
      y: roundTo(Math.max(-0.94, Math.min(0.82, y)), 1000),
    });
  }
  points.push({ x: rightBaseX, y: 1 });

  const p = (targetIndex) => points[Math.max(0, Math.min(points.length - 1, targetIndex))];
  const topIndex = 1 + Math.floor((upperPointCount - 1) * (0.42 + random() * 0.18));
  const leftShoulder = p(1 + Math.floor(upperPointCount * 0.22));
  const top = p(topIndex);
  const rightShoulder = p(1 + Math.ceil(upperPointCount * 0.72));
  const rightWall = p(points.length - 2);
  const leftWall = p(1);
  const center = { x: roundTo((random() - 0.5) * 0.08, 1000), y: roundTo(0.02 + (random() - 0.5) * 0.1, 1000) };
  const lowerKnee = { x: roundTo(0.08 + (random() - 0.5) * 0.18, 1000), y: roundTo(0.52 + random() * 0.14, 1000) };
  const leftKnee = { x: roundTo(-0.42 + (random() - 0.5) * 0.16, 1000), y: roundTo(0.34 + random() * 0.16, 1000) };
  const rightKnee = { x: roundTo(0.5 + (random() - 0.5) * 0.14, 1000), y: roundTo(0.24 + random() * 0.18, 1000) };

  const facets = [
    { tone: 0, points: [leftWall, leftShoulder, top, center, leftKnee] },
    { tone: 1, points: [{ x: leftBaseX, y: 1 }, leftWall, leftKnee, lowerKnee, { x: roundTo(leftBaseX + 0.24, 1000), y: 1 }] },
    { tone: 2, points: [top, rightShoulder, rightKnee, lowerKnee, center] },
    { tone: 3, points: [rightKnee, rightWall, { x: rightBaseX, y: 1 }, { x: roundTo(leftBaseX + 0.24, 1000), y: 1 }, lowerKnee] },
    { tone: 1, points: [leftKnee, center, lowerKnee] },
  ];
  const topHighlight = [
    { x: roundTo(leftShoulder.x * 0.78 + top.x * 0.22, 1000), y: roundTo(leftShoulder.y * 0.78 + top.y * 0.22 + 0.06, 1000) },
    { x: roundTo(top.x * 0.82 + rightShoulder.x * 0.18, 1000), y: roundTo(top.y * 0.82 + rightShoulder.y * 0.18 + 0.06, 1000) },
    { x: roundTo(top.x * 0.56 + rightShoulder.x * 0.44, 1000), y: roundTo(top.y * 0.56 + rightShoulder.y * 0.44 + 0.16, 1000) },
    { x: roundTo(leftShoulder.x * 0.48 + top.x * 0.52, 1000), y: roundTo(leftShoulder.y * 0.48 + top.y * 0.52 + 0.17, 1000) },
  ];

  return Object.freeze({
    kind: "stonelab-grounded-faceted-polygon",
    bottomY: 1,
    baselineY: 1,
    points: Object.freeze(points.map((point) => Object.freeze(point))),
    facets: Object.freeze(facets.map((facet) => Object.freeze({ ...facet, points: Object.freeze(facet.points.map((point) => Object.freeze({ x: point.x, y: point.y }))) }))),
    topHighlight: Object.freeze(topHighlight.map((point) => Object.freeze(point))),
  });
}

export function getStoneVisualGeometry(stone = {}) {
  const cacheKey = getStoneVisualGeometryCacheKey(stone);
  if (!stoneVisualGeometryCache.has(cacheKey)) stoneVisualGeometryCache.set(cacheKey, createStoneVisualGeometry(stone));
  return stoneVisualGeometryCache.get(cacheKey);
}


export function getStoneVisualContactOffsetY(stone = {}) {
  const visual = stone.visual || getStoneVisualGeometry(stone);
  const radiusY = Math.max(0, Number(stone.radiusY) || 0);
  const points = Array.isArray(visual?.points) ? visual.points : [];
  const bottomY = points.reduce((maxY, point) => Math.max(maxY, Number(point?.y) || 0), Number.isFinite(visual?.bottomY) ? visual.bottomY : 1);
  return bottomY * radiusY;
}

export function getStoneVisualWorldBottomY(stone = {}) {
  const centerY = Number.isFinite(stone.y) ? stone.y : 0;
  return centerY + getStoneVisualContactOffsetY(stone);
}

function getStoneVisualHeightRange(stone = {}) {
  const visual = stone.visual || getStoneVisualGeometry(stone);
  const points = Array.isArray(visual?.points) ? visual.points : [];
  const bottomY = points.reduce((maxY, point) => Math.max(maxY, Number(point?.y) || 0), Number.isFinite(visual?.bottomY) ? visual.bottomY : 1);
  const topY = points.reduce((minY, point) => Math.min(minY, Number(point?.y) || 0), bottomY);
  return Math.max(0, bottomY - topY);
}

export function getStoneVisualWorldTopY(stone = {}) {
  const visual = stone.visual || getStoneVisualGeometry(stone);
  const points = Array.isArray(visual?.points) ? visual.points : [];
  const topY = points.reduce((minY, point) => Math.min(minY, Number(point?.y) || 0), Number.isFinite(visual?.baselineY) ? visual.baselineY : 0);
  const centerY = Number.isFinite(stone.y) ? stone.y : 0;
  const radiusY = Math.max(0, Number(stone.radiusY) || 0);
  return centerY + (topY * radiusY);
}

function resolveStoneAreaVisualSize(area, random, baseTile, stoneIndex = 0, targetCount = 1) {
  const sizeVariation = Math.max(0, Math.min(1, Number.isFinite(area?.sizeVariation) ? area.sizeVariation : STONE_AREA_DEFAULTS.sizeVariation));
  const minVisualHeight = Math.max(1, Math.min(area.maxStoneHeight, Number(area?.minStoneHeight) || STONE_AREA_DEFAULTS.minStoneHeight));
  const maxVisualHeight = Math.max(minVisualHeight, Math.min(Number(area?.height) || minVisualHeight, Number(area?.maxStoneHeight) || minVisualHeight));
  const sequenceRoll = targetCount > 1 ? stoneIndex / (targetCount - 1) : 0.5;
  const randomRoll = random();
  const coverageRoll = sizeVariation >= 0.75 ? Math.max(randomRoll, sequenceRoll) : (randomRoll * 0.7) + (sequenceRoll * 0.3);
  const heightFactor = (0.52 * (1 - sizeVariation)) + (coverageRoll * sizeVariation);
  const targetVisualHeight = minVisualHeight + ((maxVisualHeight - minVisualHeight) * heightFactor);
  const radiusY = targetVisualHeight / 1.94;
  const radiusX = radiusY * (1.32 + random() * 0.56);
  return { radiusX, radiusY, targetVisualHeight };
}

export function getStoneAreaSeed(area = {}, index = 0) {
  if (Number.isInteger(area?.seed)) return area.seed >>> 0;
  const normalized = normalizeStoneAreaForEditor(area, index);
  return hashStringToUint32(`${normalized.id}|${Math.round(normalized.x)}|${Math.round(normalized.y)}|${Math.round(normalized.width)}|${Math.round(normalized.height)}`);
}

export function generateStoneAreaLayout(area = {}, index = 0) {
  const normalized = normalizeStoneAreaForEditor(area, index);
  if (!normalized.enabled || !normalized.visible || normalized.density <= 0 || normalized.width <= 0 || normalized.height <= 0) return [];
  const areaPixels = normalized.width * normalized.height;
  const targetCount = Math.max(0, Math.round((areaPixels / (DEFAULT_TILE_SIZE * DEFAULT_TILE_SIZE)) * normalized.density * 3.2));
  if (targetCount <= 0) return [];

  const random = mulberry32(getStoneAreaSeed(normalized, index));
  const clusterCount = Math.max(1, Math.round(1 + normalized.clusterStrength * Math.sqrt(targetCount)));
  const clusters = Array.from({ length: clusterCount }, () => ({
    x: normalized.x + random() * normalized.width,
    y: normalized.y + random() * normalized.height,
    radius: Math.max(DEFAULT_TILE_SIZE * 0.45, (0.2 + random() * 0.55) * Math.min(normalized.width, normalized.height)),
  }));

  const stones = [];
  let guard = targetCount * 12;
  while (stones.length < targetCount && guard > 0) {
    guard -= 1;
    const cluster = clusters[Math.floor(random() * clusters.length)] || clusters[0];
    const useCluster = random() < normalized.clusterStrength;
    const angle = random() * Math.PI * 2;
    const distance = Math.pow(random(), 1.7) * cluster.radius;
    const rawX = useCluster ? cluster.x + Math.cos(angle) * distance : normalized.x + random() * normalized.width;
    const rawY = useCluster ? cluster.y + Math.sin(angle) * distance : normalized.y + random() * normalized.height;
    if (rawX < normalized.x || rawX > normalized.x + normalized.width || rawY < normalized.y || rawY > normalized.y + normalized.height) continue;
    const visualSize = resolveStoneAreaVisualSize(normalized, random, DEFAULT_TILE_SIZE, stones.length, targetCount);
    let radiusX = Math.round(visualSize.radiusX * 100) / 100;
    let radiusY = Math.round(visualSize.radiusY * 100) / 100;
    const stone = {
      id: `${normalized.id}-stone-${stones.length + 1}`,
      x: Math.round(rawX * 100) / 100,
      y: 0,
      radiusX,
      radiusY,
      rotation: Math.round(((random() - 0.5) * Math.PI * normalized.rotationVariation) * 1000) / 1000,
      shade: Math.round((0.72 + random() * 0.24) * 1000) / 1000,
    };
    stone.visual = getStoneVisualGeometry(stone);
    const visualRange = getStoneVisualHeightRange(stone);
    const currentVisualHeight = Math.max(1, visualRange * radiusY);
    const requestedVisualHeight = Math.min(normalized.maxStoneHeight, Math.max(normalized.minStoneHeight, visualSize.targetVisualHeight));
    if (Math.abs(currentVisualHeight - requestedVisualHeight) > 0.01) {
      const scale = requestedVisualHeight / currentVisualHeight;
      radiusX = Math.round(radiusX * scale * 100) / 100;
      radiusY = Math.round(radiusY * scale * 100) / 100;
      stone.radiusX = radiusX;
      stone.radiusY = radiusY;
      stone.visual = getStoneVisualGeometry(stone);
    }
    const fittedVisualRange = getStoneVisualHeightRange(stone);
    const finalMaxVisualHeight = Math.min(normalized.height, normalized.maxStoneHeight);
    if (fittedVisualRange * radiusY > finalMaxVisualHeight) {
      const scale = finalMaxVisualHeight / Math.max(1, fittedVisualRange * radiusY);
      radiusX = Math.round(radiusX * scale * 100) / 100;
      radiusY = Math.round(radiusY * scale * 100) / 100;
      stone.radiusX = radiusX;
      stone.radiusY = radiusY;
      stone.visual = getStoneVisualGeometry(stone);
      const refittedVisualRange = getStoneVisualHeightRange(stone);
      if (refittedVisualRange * radiusY > finalMaxVisualHeight) {
        const refitScale = finalMaxVisualHeight / Math.max(1, refittedVisualRange * radiusY);
        radiusX = Math.round(radiusX * refitScale * 100) / 100;
        radiusY = Math.round(radiusY * refitScale * 100) / 100;
        stone.radiusX = radiusX;
        stone.radiusY = radiusY;
        stone.visual = getStoneVisualGeometry(stone);
      }
    }
    const contactOffsetY = getStoneVisualContactOffsetY(stone);
    const baselineY = normalized.y + normalized.height;
    stone.y = Math.round((baselineY - contactOffsetY) * 100) / 100;
    stones.push(stone);
  }
  return stones;
}
