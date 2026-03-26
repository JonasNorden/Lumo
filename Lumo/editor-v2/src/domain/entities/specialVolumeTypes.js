import {
  cloneEntityParams,
  getNestedEntityParam,
  mergeEntityParams,
  setNestedEntityParam,
} from "./entityParams.js";
import { getEntityPresetDefaultParams } from "./entityPresets.js";

const DEFAULT_FOG_WIDTH_PX = 288;
const DEFAULT_FOG_THICKNESS_PX = 44;
const MIN_SPECIAL_VOLUME_PREVIEW_HEIGHT_PX = 12;

export const SPECIAL_VOLUME_EDITOR_LAYOUTS = {
  fog_volume: {
    primarySections: [
      {
        key: "volume",
        title: "Volume",
        description: "Direct authoring controls for the authored span and base shape.",
        fields: ["fogWidth", "fogHeight", "area.falloff"],
      },
      {
        key: "look",
        title: "Look",
        description: "Common fog look controls used during placement and tuning.",
        fields: ["look.density", "look.lift", "look.thickness", "look.color", "look.exposure"],
      },
    ],
    advancedSections: [
      { key: "area", title: "Area", fields: ["area.x0", "area.x1", "area.y0"] },
      { key: "smoothing", title: "Smoothing", fields: ["smoothing.diffuse", "smoothing.relax", "smoothing.visc"] },
      { key: "interaction", title: "Interaction", fields: ["interaction.radius", "interaction.push", "interaction.bulge", "interaction.gate"] },
      { key: "organic", title: "Organic", fields: ["organic.strength", "organic.scale", "organic.speed"] },
      { key: "render", title: "Render", fields: ["look.layers", "look.noise", "look.drift", "render.blend", "render.lumoBehindFog"] },
    ],
  },
};

export const FOG_VOLUME_PARAM_SECTIONS = [
  { key: "area", title: "Area", fields: ["x0", "x1", "y0", "falloff"] },
  { key: "look", title: "Look", fields: ["density", "lift", "thickness", "layers", "noise", "drift", "color", "exposure"] },
  { key: "smoothing", title: "Smoothing", fields: ["diffuse", "relax", "visc"] },
  { key: "interaction", title: "Interaction", fields: ["radius", "push", "bulge", "gate"] },
  { key: "organic", title: "Organic", fields: ["strength", "scale", "speed"] },
  { key: "render", title: "Render", fields: ["blend", "lumoBehindFog"] },
];

const SPECIAL_VOLUME_DESCRIPTORS = Object.freeze({
  fog_volume: Object.freeze({
    type: "fog_volume",
    label: "Fog Volume",
    editorLayout: SPECIAL_VOLUME_EDITOR_LAYOUTS.fog_volume,
    paramSections: FOG_VOLUME_PARAM_SECTIONS,
  }),
});

const SPECIAL_VOLUME_ENTITY_TYPES = new Set(Object.keys(SPECIAL_VOLUME_DESCRIPTORS));

function readNumber(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function getFogDefaults() {
  return getEntityPresetDefaultParams("fog_volume");
}

export function isSpecialVolumeEntityType(type) {
  return SPECIAL_VOLUME_ENTITY_TYPES.has(String(type || "").trim().toLowerCase());
}

export function getSpecialVolumeType(type) {
  const normalized = String(type || "").trim().toLowerCase();
  return SPECIAL_VOLUME_ENTITY_TYPES.has(normalized) ? normalized : null;
}

export function getSpecialVolumeDescriptor(type) {
  const specialType = getSpecialVolumeType(type);
  return specialType ? SPECIAL_VOLUME_DESCRIPTORS[specialType] : null;
}

export function listSpecialVolumeTypes() {
  return Array.from(SPECIAL_VOLUME_ENTITY_TYPES.values());
}

export function isFogVolumeEntityType(type) {
  return String(type || "").trim().toLowerCase() === "fog_volume";
}

export function getFogVolumeParams(entity) {
  return mergeEntityParams(getFogDefaults(), entity?.params);
}

export function getFogVolumeRect(entity, tileSize) {
  const params = getFogVolumeParams(entity);
  const area = params.area || {};
  const look = params.look || {};
  const anchorX = readNumber(entity?.x, 0) * tileSize;
  const anchorY = (readNumber(entity?.y, 0) + 1) * tileSize;
  const x0 = readNumber(area.x0, anchorX);
  const x1Raw = readNumber(area.x1, x0 + DEFAULT_FOG_WIDTH_PX);
  const y0 = readNumber(area.y0, anchorY);
  const thickness = Math.max(1, readNumber(look.thickness, DEFAULT_FOG_THICKNESS_PX));
  const falloff = Math.max(0, readNumber(area.falloff, 0));
  const minX = Math.min(x0, x1Raw);
  const maxX = Math.max(x0, x1Raw);

  return {
    x0: minX,
    x1: maxX,
    y0,
    thickness,
    falloff,
    width: Math.max(1, maxX - minX),
    height: thickness,
    top: y0 - thickness,
    bottom: y0,
  };
}

export function getFogVolumeAnchorCell(entity, tileSize) {
  const rect = getFogVolumeRect(entity, tileSize);
  return {
    x: Math.max(0, Math.round(rect.x0 / tileSize)),
    y: Math.max(0, Math.round((rect.y0 - tileSize) / tileSize)),
  };
}

export function createFogVolumeEntityFromWorldRect(entity, worldRect, tileSize) {
  const normalized = syncFogVolumeEntityToAnchor(entity, tileSize);
  const minX = Math.min(readNumber(worldRect?.x0, normalized.x * tileSize), readNumber(worldRect?.x1, normalized.x * tileSize + DEFAULT_FOG_WIDTH_PX));
  const maxX = Math.max(readNumber(worldRect?.x0, normalized.x * tileSize), readNumber(worldRect?.x1, normalized.x * tileSize + DEFAULT_FOG_WIDTH_PX));
  const minY = Math.min(readNumber(worldRect?.y0, normalized.y * tileSize), readNumber(worldRect?.y1, (normalized.y + 1) * tileSize));
  const maxY = Math.max(readNumber(worldRect?.y0, normalized.y * tileSize), readNumber(worldRect?.y1, (normalized.y + 1) * tileSize));
  const nextAnchorX = Math.max(0, Math.round(minX / tileSize));
  const nextAnchorY = Math.max(0, Math.round((maxY - tileSize) / tileSize));
  const width = Math.max(tileSize, Math.round(maxX - minX));
  const height = Math.max(MIN_SPECIAL_VOLUME_PREVIEW_HEIGHT_PX, Math.round(maxY - minY));
  const nextEntity = syncFogVolumeEntityToAnchor({
    ...normalized,
    x: nextAnchorX,
    y: nextAnchorY,
  }, tileSize);

  let nextParams = setNestedEntityParam(nextEntity.params, "area.x0", minX);
  nextParams = setNestedEntityParam(nextParams, "area.x1", minX + width);
  nextParams = setNestedEntityParam(nextParams, "area.y0", maxY);
  nextParams = setNestedEntityParam(nextParams, "look.thickness", height);

  return syncFogVolumeEntityToAnchor({
    ...nextEntity,
    x: nextAnchorX,
    y: nextAnchorY,
    params: nextParams,
  }, tileSize);
}

export function getFogVolumeWorldRectFromDragCells(startCell, endCell, tileSize, thicknessPx = null) {
  if (!startCell || !endCell || !Number.isFinite(tileSize) || tileSize <= 0) return null;

  const startX = Math.round(readNumber(startCell.x, 0));
  const startY = Math.round(readNumber(startCell.y, 0));
  const endX = Math.round(readNumber(endCell.x, startX));
  const defaults = getFogDefaults();
  const defaultThickness = readNumber(defaults?.look?.thickness, DEFAULT_FOG_THICKNESS_PX);
  const resolvedThicknessPx = readNumber(thicknessPx, defaultThickness);
  const thicknessTiles = Math.max(1, Math.round(resolvedThicknessPx / tileSize));
  const snappedThicknessPx = thicknessTiles * tileSize;
  const minXCell = Math.min(startX, endX);
  const maxXCell = Math.max(startX, endX);
  const baselineY = (startY + 1) * tileSize;

  return {
    x0: minXCell * tileSize,
    x1: (maxXCell + 1) * tileSize,
    y0: baselineY - snappedThicknessPx,
    y1: baselineY,
  };
}

export function syncFogVolumeEntityToAnchor(entity, tileSize) {
  if (!isFogVolumeEntityType(entity?.type)) {
    return {
      ...entity,
      params: cloneEntityParams(entity?.params),
    };
  }

  const defaults = getFogDefaults();
  const nextParams = mergeEntityParams(defaults, entity?.params);
  const nextX = Number.isFinite(entity?.x)
    ? Math.round(entity.x)
    : getFogVolumeAnchorCell({ ...entity, params: nextParams }, tileSize).x;
  const nextY = Number.isFinite(entity?.y)
    ? Math.round(entity.y)
    : getFogVolumeAnchorCell({ ...entity, params: nextParams }, tileSize).y;
  const anchorPixelX = nextX * tileSize;
  const anchorPixelY = (nextY + 1) * tileSize;
  const currentRect = getFogVolumeRect({ ...entity, x: nextX, y: nextY, params: nextParams }, tileSize);
  const width = Math.max(1, currentRect.width);

  const anchoredParams = setNestedEntityParam(nextParams, "area.x0", anchorPixelX);
  const anchoredParamsWithX1 = setNestedEntityParam(anchoredParams, "area.x1", anchorPixelX + width);
  const anchoredParamsWithY0 = setNestedEntityParam(anchoredParamsWithX1, "area.y0", anchorPixelY);

  return {
    ...entity,
    x: nextX,
    y: nextY,
    params: anchoredParamsWithY0,
  };
}

export function syncSpecialVolumeEntityToAnchor(entity, tileSize) {
  if (!isSpecialVolumeEntityType(entity?.type)) {
    return {
      ...entity,
      params: cloneEntityParams(entity?.params),
    };
  }

  if (isFogVolumeEntityType(entity?.type)) {
    return syncFogVolumeEntityToAnchor(entity, tileSize);
  }

  return {
    ...entity,
    params: cloneEntityParams(entity?.params),
  };
}

export function shiftFogVolumeEntity(entity, deltaX, deltaY, tileSize) {
  if (!isFogVolumeEntityType(entity?.type)) {
    return {
      ...entity,
      x: Math.round(readNumber(entity?.x, 0) + deltaX),
      y: Math.round(readNumber(entity?.y, 0) + deltaY),
      params: cloneEntityParams(entity?.params),
    };
  }

  const normalized = syncFogVolumeEntityToAnchor(entity, tileSize);
  const deltaPxX = Math.round(deltaX) * tileSize;
  const deltaPxY = Math.round(deltaY) * tileSize;
  let nextParams = setNestedEntityParam(normalized.params, "area.x0", readNumber(getNestedEntityParam(normalized.params, "area.x0"), 0) + deltaPxX);
  nextParams = setNestedEntityParam(nextParams, "area.x1", readNumber(getNestedEntityParam(normalized.params, "area.x1"), DEFAULT_FOG_WIDTH_PX) + deltaPxX);
  nextParams = setNestedEntityParam(nextParams, "area.y0", readNumber(getNestedEntityParam(normalized.params, "area.y0"), tileSize) + deltaPxY);

  return {
    ...normalized,
    x: normalized.x + Math.round(deltaX),
    y: normalized.y + Math.round(deltaY),
    params: nextParams,
  };
}

export function resizeFogVolumeEntity(entity, dimension, nextValue, tileSize) {
  const normalized = syncFogVolumeEntityToAnchor(entity, tileSize);
  const rect = getFogVolumeRect(normalized, tileSize);
  if (dimension === "width") {
    return {
      ...normalized,
      params: setNestedEntityParam(normalized.params, "area.x1", rect.x0 + Math.max(tileSize, Math.round(nextValue))),
    };
  }

  if (dimension === "height") {
    return {
      ...normalized,
      params: setNestedEntityParam(normalized.params, "look.thickness", Math.max(1, Math.round(nextValue))),
    };
  }

  return normalized;
}

export function applyFogVolumeParamChange(entity, path, value, tileSize) {
  const normalized = syncFogVolumeEntityToAnchor(entity, tileSize);
  let nextParams = setNestedEntityParam(normalized.params, path, value);

  if (path === "area.x0" || path === "area.y0") {
    const nextAnchor = getFogVolumeAnchorCell({ ...normalized, params: nextParams }, tileSize);
    nextParams = syncFogVolumeEntityToAnchor({ ...normalized, x: nextAnchor.x, y: nextAnchor.y, params: nextParams }, tileSize).params;
    return {
      ...normalized,
      x: nextAnchor.x,
      y: nextAnchor.y,
      params: nextParams,
    };
  }

  if (path === "area.x1") {
    const rect = getFogVolumeRect({ ...normalized, params: nextParams }, tileSize);
    nextParams = setNestedEntityParam(nextParams, "area.x1", rect.x0 + rect.width);
  }

  return {
    ...normalized,
    params: nextParams,
  };
}

export function applySpecialVolumeParamChange(entity, path, value, tileSize) {
  if (!isSpecialVolumeEntityType(entity?.type)) {
    return {
      ...entity,
      params: cloneEntityParams(entity?.params),
    };
  }

  if (isFogVolumeEntityType(entity?.type)) {
    return applyFogVolumeParamChange(entity, path, value, tileSize);
  }

  return {
    ...entity,
    params: cloneEntityParams(entity?.params),
  };
}
