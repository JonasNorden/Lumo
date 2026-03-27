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
const MIN_FOG_THICKNESS_PX = 1;
const MAX_FOG_THICKNESS_PX = 1024;
const MIN_FOG_WORLD_COORDINATE = -131072;
const MAX_FOG_WORLD_COORDINATE = 131072;

const FOG_PARAM_FIELD_META = Object.freeze({
  "area.x0": Object.freeze({ label: "Start X", min: MIN_FOG_WORLD_COORDINATE, max: MAX_FOG_WORLD_COORDINATE, step: 1 }),
  "area.x1": Object.freeze({ label: "End X", min: MIN_FOG_WORLD_COORDINATE, max: MAX_FOG_WORLD_COORDINATE, step: 1 }),
  "area.y0": Object.freeze({ label: "Baseline Y", min: MIN_FOG_WORLD_COORDINATE, max: MAX_FOG_WORLD_COORDINATE, step: 1 }),
  "area.falloff": Object.freeze({ label: "Falloff", min: 0, max: 512, step: 1 }),
  "look.density": Object.freeze({ label: "Density", min: 0, max: 1, step: 0.01 }),
  "look.lift": Object.freeze({ label: "Lift", min: -256, max: 256, step: 1 }),
  "look.thickness": Object.freeze({ label: "Thickness", min: MIN_FOG_THICKNESS_PX, max: MAX_FOG_THICKNESS_PX, step: 1 }),
  "look.layers": Object.freeze({ label: "Layers", min: 1, max: 96, step: 1 }),
  "look.noise": Object.freeze({ label: "Noise", min: 0, max: 1, step: 0.01 }),
  "look.drift": Object.freeze({ label: "Drift", min: -8, max: 8, step: 0.01 }),
  "look.color": Object.freeze({ label: "Color" }),
  "look.exposure": Object.freeze({ label: "Exposure", min: 0.1, max: 4, step: 0.01 }),
  "smoothing.diffuse": Object.freeze({ label: "Diffuse", min: 0, max: 1, step: 0.01 }),
  "smoothing.relax": Object.freeze({ label: "Relax", min: 0, max: 1, step: 0.01 }),
  "smoothing.visc": Object.freeze({ label: "Viscosity", min: 0, max: 1, step: 0.01 }),
  "interaction.radius": Object.freeze({ label: "Radius", min: 0, max: 1024, step: 1 }),
  "interaction.push": Object.freeze({ label: "Push", min: 0, max: 12, step: 0.1 }),
  "interaction.bulge": Object.freeze({ label: "Bulge", min: 0, max: 12, step: 0.1 }),
  "interaction.gate": Object.freeze({ label: "Gate", min: 0, max: 256, step: 1 }),
  "organic.strength": Object.freeze({ label: "Strength", min: 0, max: 4, step: 0.01 }),
  "organic.scale": Object.freeze({ label: "Scale", min: 0.1, max: 8, step: 0.01 }),
  "organic.speed": Object.freeze({ label: "Speed", min: 0, max: 8, step: 0.01 }),
  "render.blend": Object.freeze({ label: "Blend" }),
  "render.lumoBehindFog": Object.freeze({ label: "Lumo Behind Fog" }),
});

export const SPECIAL_VOLUME_EDITOR_LAYOUTS = {
  fog_volume: {
    primarySections: [
      {
        key: "look",
        title: "Look",
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

function clampNumber(value, min, max, fallback) {
  const resolved = readNumber(value, fallback);
  return Math.min(max, Math.max(min, resolved));
}

function clampFogParamValue(path, value, fallbackValue = value) {
  const meta = FOG_PARAM_FIELD_META[path];
  if (!meta) return value;
  if (meta.min == null || meta.max == null) return value;
  return clampNumber(value, meta.min, meta.max, fallbackValue);
}

function clampHexColor(value, fallback) {
  const text = String(value ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(text) || /^#[0-9a-f]{3}$/i.test(text)) return text.toUpperCase();
  return fallback;
}

function normalizeFogParams(params, defaults) {
  const merged = mergeEntityParams(defaults, params);
  const areaX0 = clampFogParamValue("area.x0", getNestedEntityParam(merged, "area.x0"), defaults?.area?.x0 ?? 0);
  const areaX1Raw = clampFogParamValue("area.x1", getNestedEntityParam(merged, "area.x1"), defaults?.area?.x1 ?? DEFAULT_FOG_WIDTH_PX);
  const areaY0 = clampFogParamValue("area.y0", getNestedEntityParam(merged, "area.y0"), defaults?.area?.y0 ?? 24);
  const areaFalloff = clampFogParamValue("area.falloff", getNestedEntityParam(merged, "area.falloff"), defaults?.area?.falloff ?? 0);
  const lookDensity = clampFogParamValue("look.density", getNestedEntityParam(merged, "look.density"), defaults?.look?.density ?? 0.14);
  const lookLift = clampFogParamValue("look.lift", getNestedEntityParam(merged, "look.lift"), defaults?.look?.lift ?? 8);
  const lookThickness = clampFogParamValue("look.thickness", getNestedEntityParam(merged, "look.thickness"), defaults?.look?.thickness ?? DEFAULT_FOG_THICKNESS_PX);
  const lookLayers = Math.round(clampFogParamValue("look.layers", getNestedEntityParam(merged, "look.layers"), defaults?.look?.layers ?? 28));
  const lookNoise = clampFogParamValue("look.noise", getNestedEntityParam(merged, "look.noise"), defaults?.look?.noise ?? 0);
  const lookDrift = clampFogParamValue("look.drift", getNestedEntityParam(merged, "look.drift"), defaults?.look?.drift ?? 0);
  const lookExposure = clampFogParamValue("look.exposure", getNestedEntityParam(merged, "look.exposure"), defaults?.look?.exposure ?? 1);
  const lookColor = clampHexColor(getNestedEntityParam(merged, "look.color"), defaults?.look?.color ?? "#E1EEFF");
  const smoothingDiffuse = clampFogParamValue("smoothing.diffuse", getNestedEntityParam(merged, "smoothing.diffuse"), defaults?.smoothing?.diffuse ?? 0.24);
  const smoothingRelax = clampFogParamValue("smoothing.relax", getNestedEntityParam(merged, "smoothing.relax"), defaults?.smoothing?.relax ?? 0.24);
  const smoothingVisc = clampFogParamValue("smoothing.visc", getNestedEntityParam(merged, "smoothing.visc"), defaults?.smoothing?.visc ?? 0.94);
  const interactionRadius = clampFogParamValue("interaction.radius", getNestedEntityParam(merged, "interaction.radius"), defaults?.interaction?.radius ?? 92);
  const interactionPush = clampFogParamValue("interaction.push", getNestedEntityParam(merged, "interaction.push"), defaults?.interaction?.push ?? 2.4);
  const interactionBulge = clampFogParamValue("interaction.bulge", getNestedEntityParam(merged, "interaction.bulge"), defaults?.interaction?.bulge ?? 2.2);
  const interactionGate = clampFogParamValue("interaction.gate", getNestedEntityParam(merged, "interaction.gate"), defaults?.interaction?.gate ?? 70);
  const organicStrength = clampFogParamValue("organic.strength", getNestedEntityParam(merged, "organic.strength"), defaults?.organic?.strength ?? 0);
  const organicScale = clampFogParamValue("organic.scale", getNestedEntityParam(merged, "organic.scale"), defaults?.organic?.scale ?? 1);
  const organicSpeed = clampFogParamValue("organic.speed", getNestedEntityParam(merged, "organic.speed"), defaults?.organic?.speed ?? 1);
  const renderBlend = String(getNestedEntityParam(merged, "render.blend") || defaults?.render?.blend || "screen");
  const renderLumoBehindFog = Boolean(getNestedEntityParam(merged, "render.lumoBehindFog"));

  const minArea = Math.min(areaX0, areaX1Raw);
  const maxArea = Math.max(areaX0, areaX1Raw);
  const areaX1 = Math.max(minArea + 1, maxArea);

  let nextParams = setNestedEntityParam(merged, "area.x0", minArea);
  nextParams = setNestedEntityParam(nextParams, "area.x1", areaX1);
  nextParams = setNestedEntityParam(nextParams, "area.y0", areaY0);
  nextParams = setNestedEntityParam(nextParams, "area.falloff", areaFalloff);
  nextParams = setNestedEntityParam(nextParams, "look.density", lookDensity);
  nextParams = setNestedEntityParam(nextParams, "look.lift", lookLift);
  nextParams = setNestedEntityParam(nextParams, "look.thickness", lookThickness);
  nextParams = setNestedEntityParam(nextParams, "look.layers", lookLayers);
  nextParams = setNestedEntityParam(nextParams, "look.noise", lookNoise);
  nextParams = setNestedEntityParam(nextParams, "look.drift", lookDrift);
  nextParams = setNestedEntityParam(nextParams, "look.color", lookColor);
  nextParams = setNestedEntityParam(nextParams, "look.exposure", lookExposure);
  nextParams = setNestedEntityParam(nextParams, "smoothing.diffuse", smoothingDiffuse);
  nextParams = setNestedEntityParam(nextParams, "smoothing.relax", smoothingRelax);
  nextParams = setNestedEntityParam(nextParams, "smoothing.visc", smoothingVisc);
  nextParams = setNestedEntityParam(nextParams, "interaction.radius", interactionRadius);
  nextParams = setNestedEntityParam(nextParams, "interaction.push", interactionPush);
  nextParams = setNestedEntityParam(nextParams, "interaction.bulge", interactionBulge);
  nextParams = setNestedEntityParam(nextParams, "interaction.gate", interactionGate);
  nextParams = setNestedEntityParam(nextParams, "organic.strength", organicStrength);
  nextParams = setNestedEntityParam(nextParams, "organic.scale", organicScale);
  nextParams = setNestedEntityParam(nextParams, "organic.speed", organicSpeed);
  nextParams = setNestedEntityParam(nextParams, "render.blend", renderBlend);
  nextParams = setNestedEntityParam(nextParams, "render.lumoBehindFog", renderLumoBehindFog);
  return nextParams;
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
  const defaults = getFogDefaults();
  return normalizeFogParams(entity?.params, defaults);
}

export function getFogWorkbenchFieldMeta(path) {
  return FOG_PARAM_FIELD_META[path] || null;
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
  const thickness = Math.max(MIN_FOG_THICKNESS_PX, readNumber(look.thickness, DEFAULT_FOG_THICKNESS_PX));
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
  nextParams = normalizeFogParams(nextParams, getFogDefaults());

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
