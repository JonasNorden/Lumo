import { cloneEntityParams } from "./entityParams.js";

const FOG_DEFAULT_PARAMS = Object.freeze({
  area: { x0: 0, x1: 240, y0: 0, falloff: 120 },
  look: { density: 0.28, lift: 14, thickness: 56, layers: 20, noise: 0.14, drift: 0, color: "#E1EEFF", exposure: 1 },
  smoothing: { diffuse: 0.2, relax: 0.22, visc: 0.9 },
  interaction: { radius: 92, push: 2.2, bulge: 1.2, gate: 70 },
  organic: { strength: 0.35, scale: 1, speed: 0.65 },
  render: { blend: "screen", lumoBehindFog: true },
});

export const SPECIAL_VOLUME_EDITOR_LAYOUTS = Object.freeze({
  fog_volume: "floating",
});

export const FOG_VOLUME_PARAM_SECTIONS = Object.freeze([
  { id: "core", label: "Core fog" },
]);

export function isSpecialVolumeEntityType(type) {
  return isFogVolumeEntityType(type);
}

export function getSpecialVolumeType(type) {
  return isSpecialVolumeEntityType(type) ? "fog_volume" : null;
}

export function getSpecialVolumeDescriptor(type) {
  if (!isFogVolumeEntityType(type)) return null;
  return {
    type: "fog_volume",
    label: "Fog Volume",
    layout: "floating",
  };
}

export function listSpecialVolumeTypes() {
  return ["fog_volume"];
}

export function isFogVolumeEntityType(type) {
  return String(type || "").trim().toLowerCase() === "fog_volume";
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeFogArea(area = {}) {
  const x0 = Math.max(0, Number(area.x0) || 0);
  const x1 = Math.max(x0 + 1, Number(area.x1) || x0 + 1);
  return {
    x0,
    x1,
    y0: Math.max(0, Number(area.y0) || 0),
    falloff: clamp(Number(area.falloff), 10, 520),
  };
}

function normalizeFogParams(rawParams = {}) {
  const area = normalizeFogArea(rawParams.area || {});
  const lookInput = rawParams.look || {};
  const smoothingInput = rawParams.smoothing || {};
  const interactionInput = rawParams.interaction || {};
  const organicInput = rawParams.organic || {};
  const renderInput = rawParams.render || {};

  return {
    area,
    look: {
      density: clamp(Number(lookInput.density), 0.02, 1),
      lift: clamp(Number(lookInput.lift), 0, 120),
      thickness: clamp(Number(lookInput.thickness), 8, 220),
      layers: Math.round(clamp(Number(lookInput.layers), 4, 56)),
      noise: clamp(Number(lookInput.noise), 0, 1),
      drift: clamp(Number(lookInput.drift), -3, 3),
      color: typeof lookInput.color === "string" && lookInput.color.trim() ? lookInput.color.trim() : FOG_DEFAULT_PARAMS.look.color,
      exposure: clamp(Number(lookInput.exposure), 0.1, 2.5),
    },
    smoothing: {
      diffuse: clamp(Number(smoothingInput.diffuse), 0, 1),
      relax: clamp(Number(smoothingInput.relax), 0.02, 1),
      visc: clamp(Number(smoothingInput.visc), 0.35, 0.995),
    },
    interaction: {
      radius: clamp(Number(interactionInput.radius), 10, 240),
      push: clamp(Number(interactionInput.push), 0, 5),
      bulge: clamp(Number(interactionInput.bulge), 0, 4),
      gate: clamp(Number(interactionInput.gate), 0, 260),
    },
    organic: {
      strength: clamp(Number(organicInput.strength), 0, 1),
      scale: clamp(Number(organicInput.scale), 0.5, 2.6),
      speed: clamp(Number(organicInput.speed), 0.1, 3),
    },
    render: {
      blend: typeof renderInput.blend === "string" && renderInput.blend.trim() ? renderInput.blend.trim() : "screen",
      lumoBehindFog: Boolean(renderInput.lumoBehindFog ?? true),
    },
  };
}

function deepMerge(base, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return cloneEntityParams(base);
  const next = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object" && !Array.isArray(base[key])) {
      next[key] = deepMerge(base[key], value);
    } else {
      next[key] = value;
    }
  }
  return next;
}

export function getFogVolumeParams(entity) {
  const merged = deepMerge(FOG_DEFAULT_PARAMS, cloneEntityParams(entity?.params));
  return normalizeFogParams(merged);
}

export function getFogWorkbenchFieldMeta() {
  return {
    controls: [
      "area.length",
      "look.density",
      "look.lift",
      "area.falloff",
      "organic.strength",
      "organic.speed",
      "interaction.gate",
      "interaction.radius",
      "interaction.push",
      "interaction.bulge",
      "look.noise",
      "look.drift",
      "smoothing.relax",
      "smoothing.visc",
    ],
  };
}

export function getFogVolumeRect(entity, tileSize = 24) {
  const params = getFogVolumeParams(entity);
  const width = Math.max(tileSize, params.area.x1 - params.area.x0);
  const fogBodyHeight = Math.max(tileSize * 0.5, params.look.thickness);
  const liftHeight = Math.max(0, params.look.lift);
  const height = Math.max(tileSize, fogBodyHeight + liftHeight);
  return {
    x: params.area.x0,
    y: Math.max(0, params.area.y0 - height),
    width,
    height,
  };
}

export function getFogVolumeAnchorCell(entity) {
  return {
    x: Math.max(0, Math.round(Number(entity?.x) || 0)),
    y: Math.max(0, Math.round(Number(entity?.y) || 0)),
  };
}

export function createFogVolumeEntityFromWorldRect(entity, worldRect, tileSize = 24) {
  const width = Math.max(tileSize, Number(worldRect?.width) || tileSize);
  const thickness = Math.max(tileSize * 0.5, Math.min(220, Number(worldRect?.height) || 56));
  const x = Math.max(0, Number(worldRect?.x) || 0);
  const y = Math.max(0, Number(worldRect?.y) || 0);
  const params = getFogVolumeParams({
    type: "fog_volume",
    params: {
      ...cloneEntityParams(entity?.params),
      area: {
        ...(entity?.params?.area || {}),
        x0: x,
        x1: x + width,
        y0: y,
      },
      look: {
        ...(entity?.params?.look || {}),
        thickness,
        lift: Number(entity?.params?.look?.lift) || 14,
      },
    },
  });

  return {
    ...entity,
    type: "fog_volume",
    x: Math.round(x / tileSize),
    y: Math.round(y / tileSize),
    params,
  };
}

export function getFogVolumeWorldRectFromDragCells(startCell, endCell, tileSize = 24, fallbackThicknessPx = null) {
  if (!startCell || !endCell) return null;
  const minX = Math.min(startCell.x, endCell.x);
  const maxX = Math.max(startCell.x, endCell.x);
  const topCellY = Math.min(startCell.y, endCell.y);
  const bottomCellY = Math.max(startCell.y, endCell.y);
  const width = (maxX - minX + 1) * tileSize;
  const dragHeight = (bottomCellY - topCellY + 1) * tileSize;
  const resolvedFallbackThickness = Number.isFinite(Number(fallbackThicknessPx)) && Number(fallbackThicknessPx) > 0
    ? Number(fallbackThicknessPx)
    : null;
  const height = dragHeight > tileSize
    ? dragHeight
    : (resolvedFallbackThickness || dragHeight);

  return {
    x: minX * tileSize,
    y: (bottomCellY + 1) * tileSize,
    width,
    height,
  };
}

export function shiftFogVolumeEntity(entity, deltaX = 0, deltaY = 0, tileSize = 24) {
  const params = getFogVolumeParams(entity);
  const dx = (Number(deltaX) || 0) * tileSize;
  const dy = (Number(deltaY) || 0) * tileSize;

  return {
    ...entity,
    x: (Number(entity?.x) || 0) + (Number(deltaX) || 0),
    y: (Number(entity?.y) || 0) + (Number(deltaY) || 0),
    params: {
      ...params,
      area: {
        ...params.area,
        x0: Math.max(0, params.area.x0 + dx),
        x1: Math.max(1, params.area.x1 + dx),
        y0: Math.max(0, params.area.y0 + dy),
      },
    },
  };
}

export function syncFogVolumeEntityToAnchor(entity, tileSize = 24) {
  const params = getFogVolumeParams(entity);
  const width = Math.max(tileSize, params.area.x1 - params.area.x0);
  const x0 = Math.max(0, Math.round((Number(entity?.x) || 0) * tileSize));
  const y0 = Math.max(0, Math.round((Number(entity?.y) || 0) * tileSize));
  return {
    ...entity,
    params: {
      ...params,
      area: {
        ...params.area,
        x0,
        x1: x0 + width,
        y0,
      },
    },
  };
}

export function syncSpecialVolumeEntityToAnchor(entity, tileSize = 24) {
  if (isFogVolumeEntityType(entity?.type)) return syncFogVolumeEntityToAnchor(entity, tileSize);
  return {
    ...entity,
    params: cloneEntityParams(entity?.params),
  };
}

function setAtPath(root, path, value) {
  const keys = String(path || "").split(".").filter(Boolean);
  if (!keys.length) return root;
  const next = cloneEntityParams(root);
  let cursor = next;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (!cursor[key] || typeof cursor[key] !== "object" || Array.isArray(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
  return next;
}

export function applySpecialVolumeParamChange(entity, path, value) {
  if (!isFogVolumeEntityType(entity?.type)) {
    return {
      ...entity,
      params: cloneEntityParams(entity?.params),
    };
  }

  const current = getFogVolumeParams(entity);
  if (path === "area.length") {
    const span = Math.max(24, Number(value) || 24);
    const x0 = Math.max(0, Number(current.area.x0) || 0);
    const patchedArea = {
      ...current.area,
      x0,
      x1: x0 + span,
    };
    return {
      ...entity,
      params: getFogVolumeParams({ type: "fog_volume", params: { ...current, area: patchedArea } }),
    };
  }
  const patched = setAtPath(current, path, value);
  return {
    ...entity,
    params: getFogVolumeParams({ type: "fog_volume", params: patched }),
  };
}
