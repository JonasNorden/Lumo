const DEFAULT_TILE_SIZE = 24;
const MIRROR_AREA_MIN_SIZE = 1;

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
  return normalized;
}

export function deleteMirrorSurfaceAreaById(areas = [], areaId) {
  if (!Array.isArray(areas)) return [];
  const normalizedId = typeof areaId === "string" && areaId.trim() ? areaId.trim() : null;
  return normalizedId ? areas.filter((area) => area?.id !== normalizedId) : areas.slice();
}
