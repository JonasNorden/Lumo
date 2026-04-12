import { getTileIndex } from "../level/levelDocument.js";

function getPlacementFootprintBounds(anchor, size) {
  return {
    minX: anchor.x,
    maxX: anchor.x + size - 1,
    minY: anchor.y - (size - 1),
    maxY: anchor.y,
  };
}

function containsCell(placement, cell) {
  const bounds = getPlacementFootprintBounds(placement, placement.size);
  return cell.x >= bounds.minX && cell.x <= bounds.maxX && cell.y >= bounds.minY && cell.y <= bounds.maxY;
}

function overlapsBounds(a, b) {
  return !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY);
}

function clonePlacements(placements) {
  return placements.map((placement) => ({ ...placement }));
}

function resetLayerBaseFromPlacements(doc, layer) {
  const { width, height } = doc.dimensions;
  const expectedCount = width * height;
  const isBackgroundLayer = layer === "background";
  const base = new Array(expectedCount).fill(isBackgroundLayer ? null : 0);
  const placements = isBackgroundLayer ? (doc.background.placements || []) : (doc.tiles.placements || []);

  for (const placement of placements) {
    if (!Number.isInteger(placement.x) || !Number.isInteger(placement.y)) continue;
    const bounds = getPlacementFootprintBounds(placement, placement.size);
    if (bounds.minX < 0 || bounds.minY < 0 || bounds.maxX >= width || bounds.maxY >= height) continue;
    const index = getTileIndex(width, placement.x, placement.y);
    base[index] = isBackgroundLayer ? placement.materialId : placement.value;
  }

  if (isBackgroundLayer) {
    doc.background.base = base;
  } else {
    doc.tiles.base = base;
  }
}

export function normalizeSizedPlacements(placements, expectedType) {
  if (!Array.isArray(placements)) return [];
  const normalized = [];
  for (const placement of placements) {
    const size = Number.isInteger(placement?.size) ? Math.max(1, Math.min(3, placement.size)) : 1;
    const x = Number.isInteger(placement?.x) ? placement.x : null;
    const y = Number.isInteger(placement?.y) ? placement.y : null;
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    if (expectedType === "background") {
      const materialId = typeof placement?.materialId === "string" && placement.materialId.trim() ? placement.materialId.trim() : null;
      if (!materialId) continue;
      normalized.push({ x, y, size, materialId });
    } else {
      const value = Number.isInteger(placement?.value) && placement.value >= 0 ? placement.value : null;
      if (value === null) continue;
      const normalizedPlacement = { x, y, size, value };
      if (typeof placement?.behaviorProfileId === "string" && placement.behaviorProfileId.trim()) {
        normalizedPlacement.behaviorProfileId = placement.behaviorProfileId.trim();
      }
      if (typeof placement?.collisionType === "string" && placement.collisionType.trim()) {
        normalizedPlacement.collisionType = placement.collisionType.trim();
      }
      if (typeof placement?.special === "string" && placement.special.trim()) {
        normalizedPlacement.special = placement.special.trim();
      }
      if (placement?.behaviorParams && typeof placement.behaviorParams === "object") {
        normalizedPlacement.behaviorParams = { ...placement.behaviorParams };
      }
      normalized.push(normalizedPlacement);
    }
  }
  return normalized;
}

export function paintSizedPlacement(doc, layer, anchor, size, value) {
  const { width, height } = doc.dimensions;
  const footprint = getPlacementFootprintBounds(anchor, size);
  if (footprint.minX < 0 || footprint.minY < 0 || footprint.maxX >= width || footprint.maxY >= height) return false;
  const isBackgroundLayer = layer === "background";
  const placements = isBackgroundLayer ? doc.background.placements : doc.tiles.placements;
  const currentPlacements = Array.isArray(placements) ? placements : [];
  const nextPlacement = isBackgroundLayer
    ? { x: anchor.x, y: anchor.y, size, materialId: value }
    : { x: anchor.x, y: anchor.y, size, value };

  const serializedBefore = JSON.stringify(currentPlacements);
  const filtered = currentPlacements.filter((placement) => {
    const bounds = getPlacementFootprintBounds(placement, placement.size);
    return !overlapsBounds(bounds, footprint);
  });
  filtered.push(nextPlacement);
  const serializedAfter = JSON.stringify(filtered);
  if (serializedBefore === serializedAfter) return false;

  if (isBackgroundLayer) {
    doc.background.placements = filtered;
  } else {
    doc.tiles.placements = filtered;
  }
  resetLayerBaseFromPlacements(doc, layer);
  return true;
}

export function eraseSizedPlacementAtCell(doc, layer, cell) {
  const isBackgroundLayer = layer === "background";
  const placements = isBackgroundLayer ? doc.background.placements : doc.tiles.placements;
  if (!Array.isArray(placements) || placements.length === 0) return false;

  let removeIndex = -1;
  for (let index = placements.length - 1; index >= 0; index -= 1) {
    if (containsCell(placements[index], cell)) {
      removeIndex = index;
      break;
    }
  }
  if (removeIndex < 0) return false;

  placements.splice(removeIndex, 1);
  resetLayerBaseFromPlacements(doc, layer);
  return true;
}
