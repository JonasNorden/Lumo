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
  minStoneHeight: 24,
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
