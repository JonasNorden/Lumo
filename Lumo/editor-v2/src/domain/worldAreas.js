const DEFAULT_TILE_SIZE = 24;
const MIRROR_AREA_MIN_SIZE = 1;
const STONE_AREA_MIN_SIZE = 1;
export const MIRROR_SURFACE_DEFAULTS = Object.freeze({
  reflectionHeight: 72,
  reflectionStrength: 0.35,
  distortion: 0.12,
  surfaceStrength: 0.25,
  fade: 0.65,
});

export const STONE_AREA_DEFAULTS = Object.freeze({
  density: 0.35,
  sizeVariation: 0.45,
  rotationVariation: 0.65,
  clusterStrength: 0.5,
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


export function normalizeStoneAreaForEditor(area = {}, index = 0) {
  return {
    id: typeof area?.id === "string" && area.id.trim() ? area.id.trim() : `stone_area_${index + 1}`,
    x: toFiniteNumber(area?.x, 0),
    y: toFiniteNumber(area?.y, 0),
    width: Math.max(STONE_AREA_MIN_SIZE, toPositiveNumber(area?.width, DEFAULT_TILE_SIZE)),
    height: Math.max(STONE_AREA_MIN_SIZE, toPositiveNumber(area?.height, DEFAULT_TILE_SIZE)),
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
  return {
    id: getNextAreaId(doc.stoneAreas || [], "stone_area"),
    x: minCellX * tileSize,
    y: minCellY * tileSize,
    width: Math.max(tileSize, (maxCellX - minCellX + 1) * tileSize),
    height: Math.max(tileSize, (maxCellY - minCellY + 1) * tileSize),
    ...STONE_AREA_DEFAULTS,
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
  return {
    ...normalized,
    width: Math.max(STONE_AREA_MIN_SIZE, toPositiveNumber(width, normalized.width)),
    height: Math.max(STONE_AREA_MIN_SIZE, toPositiveNumber(height, normalized.height)),
  };
}

export function updateStoneAreaField(area, field, value) {
  const normalized = normalizeStoneAreaForEditor(area);
  if (field === "enabled" || field === "visible") return { ...normalized, [field]: Boolean(value) };
  if (field === "x" || field === "y") return { ...normalized, [field]: Math.max(0, toFiniteNumber(value, normalized[field])) };
  if (field === "width" || field === "height") return resizeStoneArea(normalized, field === "width" ? value : normalized.width, field === "height" ? value : normalized.height);
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
  const pointCount = 7 + Math.floor(random() * 3);
  const points = [];
  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    const angle = (-Math.PI * 0.92) + (pointIndex / pointCount) * Math.PI * 2 + (random() - 0.5) * 0.16;
    const leftBias = Math.cos(angle) < -0.25 ? 0.08 : 0;
    const topBias = Math.sin(angle) < -0.35 ? 0.06 : 0;
    const bottomFlatten = Math.sin(angle) > 0.45 ? 0.14 : 0;
    const radius = 0.82 + random() * 0.22 + leftBias + topBias - bottomFlatten;
    const x = roundTo(Math.cos(angle) * radius, 1000);
    const y = roundTo(Math.sin(angle) * Math.min(0.96, radius + bottomFlatten * 0.45), 1000);
    points.push({ x, y });
  }
  points.sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));

  const findClosestIndex = (targetX, targetY) => {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < points.length; i += 1) {
      const dx = points[i].x - targetX;
      const dy = points[i].y - targetY;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    return bestIndex;
  };
  const p = (targetX, targetY) => points[findClosestIndex(targetX, targetY)];
  const center = { x: roundTo((random() - 0.5) * 0.08, 1000), y: roundTo(-0.02 + (random() - 0.5) * 0.08, 1000) };
  const upperKnee = { x: roundTo(-0.08 + (random() - 0.5) * 0.16, 1000), y: roundTo(-0.42 + (random() - 0.5) * 0.12, 1000) };
  const lowerKnee = { x: roundTo(0.08 + (random() - 0.5) * 0.14, 1000), y: roundTo(0.34 + (random() - 0.5) * 0.12, 1000) };

  const facets = [
    { tone: 0, points: [p(-0.82, -0.42), p(-0.2, -0.9), p(0.36, -0.72), upperKnee, center] },
    { tone: 1, points: [p(-0.96, 0), p(-0.82, -0.42), center, lowerKnee, p(-0.38, 0.72)] },
    { tone: 2, points: [upperKnee, p(0.36, -0.72), p(0.88, -0.12), p(0.72, 0.42), lowerKnee, center] },
    { tone: 3, points: [p(-0.38, 0.72), lowerKnee, p(0.72, 0.42), p(0.18, 0.86), p(-0.72, 0.48)] },
  ];

  return Object.freeze({
    kind: "stylized-faceted-polygon",
    points: Object.freeze(points.map((point) => Object.freeze(point))),
    facets: Object.freeze(facets.map((facet) => Object.freeze({ ...facet, points: Object.freeze(facet.points.map((point) => Object.freeze({ x: point.x, y: point.y }))) }))),
  });
}

export function getStoneVisualGeometry(stone = {}) {
  const cacheKey = getStoneVisualGeometryCacheKey(stone);
  if (!stoneVisualGeometryCache.has(cacheKey)) stoneVisualGeometryCache.set(cacheKey, createStoneVisualGeometry(stone));
  return stoneVisualGeometryCache.get(cacheKey);
}


export function getStoneVisualContactOffsetY(stone = {}) {
  const visual = stone.visual || getStoneVisualGeometry(stone);
  const radiusX = Math.max(0, Number(stone.radiusX) || 0);
  const radiusY = Math.max(0, Number(stone.radiusY) || 0);
  const rotation = Number.isFinite(stone.rotation) ? stone.rotation : 0;
  const sin = Math.sin(rotation);
  const cos = Math.cos(rotation);
  let maxY = 0;
  const points = Array.isArray(visual?.points) ? visual.points : [];
  for (const point of points) {
    const localX = (Number(point?.x) || 0) * radiusX;
    const localY = (Number(point?.y) || 0) * radiusY;
    maxY = Math.max(maxY, (localX * sin) + (localY * cos));
  }
  return maxY;
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
    const baseSize = 8 + random() * 8;
    const size = baseSize * (1 - normalized.sizeVariation * 0.45 + random() * normalized.sizeVariation * 0.9);
    const radiusX = Math.round(size * (0.75 + random() * 0.5) * 100) / 100;
    const radiusY = Math.round(size * (0.45 + random() * 0.35) * 100) / 100;
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
    const contactOffsetY = getStoneVisualContactOffsetY(stone);
    const baselineY = normalized.y + normalized.height;
    const groundedJitter = Math.min(1.2, Math.max(0, radiusY * 0.08)) * random();
    stone.y = Math.round((baselineY - contactOffsetY - groundedJitter) * 100) / 100;
    stones.push(stone);
  }
  return stones;
}
