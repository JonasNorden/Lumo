import { cloneEntityParams } from "../entities/entityParams.js";

const SUPPORTED_BACKGROUND_LAYER_TYPES = new Set(["color", "image", "gradient", "procedural"]);
const DEFAULT_BACKGROUND_LAYER_COLOR = "#1b2436";
const DEFAULT_DECOR_VARIANT = "a";

/**
 * @typedef LevelDocument
 * @property {{id: string, name: string, version: string}} meta
 * @property {{width: number, height: number, tileSize: number}} dimensions
 * @property {{base: number[]}} tiles
 * @property {{layers: {id: string, name: string, type: string, depth: number, visible: boolean, color: string}[]}} backgrounds
 * @property {{id: string, name: string, type: string, x: number, y: number, visible: boolean, variant: string, params: Record<string, string | number | boolean>}[]} decor
 * @property {{id: string, name: string, type: string, x: number, y: number, visible: boolean, params: Record<string, string | number | boolean>}[]} entities
 * @property {{notes?: string}} extra
 */

function clampBackgroundDepth(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function createDefaultBackgroundLayer(index = 0, overrides = {}) {
  const fallbackId = `bg-${index + 1}`;
  const nextId = typeof overrides?.id === "string" && overrides.id.trim() ? overrides.id.trim() : fallbackId;

  return {
    id: nextId,
    name:
      typeof overrides?.name === "string" && overrides.name.trim()
        ? overrides.name.trim()
        : index === 0
          ? "Sky"
          : `Background ${index + 1}`,
    type:
      typeof overrides?.type === "string" && SUPPORTED_BACKGROUND_LAYER_TYPES.has(overrides.type)
        ? overrides.type
        : "color",
    depth: clampBackgroundDepth(overrides?.depth),
    visible: typeof overrides?.visible === "boolean" ? overrides.visible : true,
    color: typeof overrides?.color === "string" && overrides.color ? overrides.color : DEFAULT_BACKGROUND_LAYER_COLOR,
  };
}

function normalizeBackgroundLayer(layer, index) {
  return createDefaultBackgroundLayer(index, layer);
}


function normalizeDecor(decor, index) {
  const fallbackId = `decor-${index + 1}`;
  const nextId = typeof decor?.id === "string" && decor.id.trim() ? decor.id.trim() : fallbackId;
  const nextName = typeof decor?.name === "string" && decor.name.trim() ? decor.name.trim() : `Decor ${index + 1}`;
  const nextType = typeof decor?.type === "string" && decor.type.trim() ? decor.type.trim() : "grass";
  const nextX = Number.isFinite(decor?.x) ? Math.round(decor.x) : 0;
  const nextY = Number.isFinite(decor?.y) ? Math.round(decor.y) : 0;
  const nextVisible = typeof decor?.visible === "boolean" ? decor.visible : true;
  const nextVariant = typeof decor?.variant === "string" && decor.variant.trim() ? decor.variant.trim() : DEFAULT_DECOR_VARIANT;
  const nextParams = cloneEntityParams(decor?.params);

  return {
    id: nextId,
    name: nextName,
    type: nextType,
    x: nextX,
    y: nextY,
    visible: nextVisible,
    variant: nextVariant,
    params: nextParams,
  };
}

function normalizeEntity(entity, index) {
  const fallbackId = `entity-${index + 1}`;
  const nextId = typeof entity?.id === "string" && entity.id.trim() ? entity.id : fallbackId;
  const nextName = typeof entity?.name === "string" && entity.name.trim() ? entity.name : `Entity ${index + 1}`;
  const nextType = typeof entity?.type === "string" && entity.type.trim() ? entity.type : "generic";
  const nextX = Number.isFinite(entity?.x) ? Math.round(entity.x) : 0;
  const nextY = Number.isFinite(entity?.y) ? Math.round(entity.y) : 0;
  const nextVisible = typeof entity?.visible === "boolean" ? entity.visible : true;
  const nextParams = cloneEntityParams(entity?.params);

  return {
    id: nextId,
    name: nextName,
    type: nextType,
    x: nextX,
    y: nextY,
    visible: nextVisible,
    params: nextParams,
  };
}

/**
 * @param {LevelDocument} doc
 * @returns {LevelDocument}
 */
export function validateLevelDocument(doc) {
  if (!doc?.meta?.id || !doc?.meta?.name) {
    throw new Error("Invalid V2 document metadata");
  }

  if (typeof doc.meta.version !== "string" || !doc.meta.version.startsWith("2.")) {
    throw new Error("Invalid V2 document version");
  }

  const { width, height } = doc.dimensions || {};
  const expectedCount = width * height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Invalid V2 document dimensions");
  }

  if (!Array.isArray(doc.tiles?.base) || doc.tiles.base.length !== expectedCount) {
    throw new Error(`Invalid V2 tile payload (expected ${expectedCount} tiles)`);
  }

  if (!doc.tiles.base.every((tile) => Number.isInteger(tile) && tile >= 0)) {
    throw new Error("Invalid V2 tile payload (tiles must be non-negative integers)");
  }

  const rawLayers = doc.backgrounds?.layers;
  const layers = Array.isArray(rawLayers) ? rawLayers : [];
  doc.backgrounds = {
    layers: (layers.length ? layers : [createDefaultBackgroundLayer()])
      .map((layer, index) => normalizeBackgroundLayer(layer, index))
      .sort((left, right) => left.depth - right.depth),
  };

  const rawDecor = Array.isArray(doc.decor) ? doc.decor : [];
  doc.decor = rawDecor.map((decor, index) => normalizeDecor(decor, index));

  const rawEntities = Array.isArray(doc.entities) ? doc.entities : [];
  doc.entities = rawEntities.map((entity, index) => normalizeEntity(entity, index));

  return doc;
}

export function getTileIndex(width, x, y) {
  return y * width + x;
}
