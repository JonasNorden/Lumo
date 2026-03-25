import { cloneEntityParams } from "../entities/entityParams.js";
import { getEntityPresetParamsForType } from "../entities/entityPresets.js";
import { isSpecialVolumeEntityType, syncFogVolumeEntityToAnchor } from "../entities/specialVolumeTypes.js";
import { DEFAULT_SOUND_PRESET_ID, getSoundPresetDefaultParams, getSoundPresetForType } from "../sound/soundPresets.js";
import { isEntityLikeEditableType, normalizeEditableObjectType } from "../placeables/editableObjectBuckets.js";
import { getAuthoredSoundSource } from "../sound/sourceReference.js";
import { normalizeSoundType } from "../sound/soundVisuals.js";
import { BACKGROUND_MATERIAL_OPTIONS, DEFAULT_BACKGROUND_MATERIAL_ID, normalizeBackgroundMaterial } from "../background/materialCatalog.js";
import { normalizeSizedPlacements } from "../tiles/sizedPlacements.js";

const SUPPORTED_BACKGROUND_LAYER_TYPES = new Set(["color", "image", "gradient", "procedural"]);
const DEFAULT_BACKGROUND_LAYER_COLOR = "#1b2436";
const DEFAULT_DECOR_VARIANT = "a";

/**
 * @typedef LevelDocument
 * @property {{id: string, name: string, version: string}} meta
 * @property {{width: number, height: number, tileSize: number}} dimensions
 * @property {{base: number[], placements?: {x: number, y: number, size: number, value: number}[]}} tiles
 * @property {{layers: {id: string, name: string, type: string, depth: number, visible: boolean, color: string}[]}} backgrounds
 * @property {{base: (string|null)[], placements?: {x: number, y: number, size: number, materialId: string}[], materials: {id: string, label: string, img: string|null, drawW: number, drawH: number, drawAnchor: "BL", drawOffX: number, drawOffY: number, footprint: {w: number, h: number}, fallbackColor: string, group: string}[]}} background
 * @property {{id: string, name: string, type: string, x: number, y: number, visible: boolean, variant: string, params: Record<string, string | number | boolean>}[]} decor
 * @property {{id: string, name: string, type: string, x: number, y: number, visible: boolean, params: Record<string, string | number | boolean>}[]} entities
 * @property {{id: string, name: string, type: string, x: number, y: number, visible: boolean, source?: string, params: Record<string, string | number | boolean>}[]} sounds
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


function normalizeBackgroundDocument(background, expectedCount) {
  const base = Array.isArray(background?.base)
    ? background.base.slice(0, expectedCount).map((value) => (typeof value === "string" && value.trim() ? value.trim() : null))
    : [];
  while (base.length < expectedCount) base.push(null);

  const authoredMaterials = Array.isArray(background?.materials)
    ? background.materials.map((material, index) => normalizeBackgroundMaterial(material, index))
    : [];

  const fallbackMaterials = authoredMaterials.length
    ? authoredMaterials
    : BACKGROUND_MATERIAL_OPTIONS.map((material, index) => normalizeBackgroundMaterial(material, index));

  const knownMaterialIds = new Set(fallbackMaterials.map((material) => material.id));
  const sanitizedBase = base.map((value) => (value && knownMaterialIds.has(value) ? value : (value ? DEFAULT_BACKGROUND_MATERIAL_ID : null)));

  return {
    base: sanitizedBase,
    placements: normalizeSizedPlacements(background?.placements, "background"),
    materials: fallbackMaterials,
  };
}

function normalizeDecor(decor, index) {
  const fallbackId = `decor-${index + 1}`;
  const nextId = typeof decor?.id === "string" && decor.id.trim() ? decor.id.trim() : fallbackId;
  const nextName = typeof decor?.name === "string" && decor.name.trim() ? decor.name.trim() : `Decor ${index + 1}`;
  const nextType = typeof decor?.type === "string" && decor.type.trim() ? normalizeEditableObjectType(decor.type) : "grass";
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

function normalizeEntity(entity, index, tileSize = 24) {
  const fallbackId = `entity-${index + 1}`;
  const nextId = typeof entity?.id === "string" && entity.id.trim() ? entity.id : fallbackId;
  const nextName = typeof entity?.name === "string" && entity.name.trim() ? entity.name : `Entity ${index + 1}`;
  const nextType = typeof entity?.type === "string" && entity.type.trim() ? normalizeEditableObjectType(entity.type) : "generic";
  const nextX = Number.isFinite(entity?.x) ? Math.round(entity.x) : 0;
  const nextY = Number.isFinite(entity?.y) ? Math.round(entity.y) : 0;
  const nextVisible = typeof entity?.visible === "boolean" ? entity.visible : true;
  const nextParams = getEntityPresetParamsForType(nextType, entity?.params);
  const normalizedEntity = {
    id: nextId,
    name: nextName,
    type: nextType,
    x: nextX,
    y: nextY,
    visible: nextVisible,
    params: nextParams,
  };

  if (isSpecialVolumeEntityType(nextType)) {
    return syncFogVolumeEntityToAnchor(normalizedEntity, tileSize);
  }

  return normalizedEntity;
}

function normalizeSound(sound, index) {
  const fallbackId = `sound-${index + 1}`;
  const preset = getSoundPresetForType(sound?.type);
  const nextType = normalizeSoundType(preset?.type || sound?.type || DEFAULT_SOUND_PRESET_ID);
  const nextId = typeof sound?.id === "string" && sound.id.trim() ? sound.id.trim() : fallbackId;
  const nextName = typeof sound?.name === "string" && sound.name.trim() ? sound.name.trim() : preset?.defaultName || `Sound ${index + 1}`;
  const nextX = Number.isFinite(sound?.x) ? Math.round(sound.x) : 0;
  const nextY = Number.isFinite(sound?.y) ? Math.round(sound.y) : 0;
  const nextVisible = typeof sound?.visible === "boolean" ? sound.visible : true;
  const nextParams = {
    ...getSoundPresetDefaultParams(preset?.id || DEFAULT_SOUND_PRESET_ID),
    ...cloneEntityParams(sound?.params),
  };
  const nextSource = getAuthoredSoundSource(sound);

  return {
    id: nextId,
    name: nextName,
    type: nextType,
    x: nextX,
    y: nextY,
    visible: nextVisible,
    ...(nextSource ? { source: nextSource } : {}),
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

  const tileSize = Number.isInteger(doc.dimensions?.tileSize) && doc.dimensions.tileSize > 0
    ? doc.dimensions.tileSize
    : 24;
  doc.dimensions.tileSize = tileSize;

  if (!Array.isArray(doc.tiles?.base) || doc.tiles.base.length !== expectedCount) {
    throw new Error(`Invalid V2 tile payload (expected ${expectedCount} tiles)`);
  }

  if (!doc.tiles.base.every((tile) => Number.isInteger(tile) && tile >= 0)) {
    throw new Error("Invalid V2 tile payload (tiles must be non-negative integers)");
  }
  doc.tiles.placements = normalizeSizedPlacements(doc.tiles?.placements, "tiles");

  const rawLayers = doc.backgrounds?.layers;
  const layers = Array.isArray(rawLayers) ? rawLayers : [];
  doc.backgrounds = {
    layers: (layers.length ? layers : [createDefaultBackgroundLayer()])
      .map((layer, index) => normalizeBackgroundLayer(layer, index))
      .sort((left, right) => left.depth - right.depth),
  };

  doc.background = normalizeBackgroundDocument(doc.background, expectedCount);

  const rawDecor = Array.isArray(doc.decor) ? doc.decor : [];
  const normalizedDecor = rawDecor.map((decor, index) => normalizeDecor(decor, index));

  const rawEntities = Array.isArray(doc.entities) ? doc.entities : [];
  const normalizedEntities = rawEntities.map((entity, index) => normalizeEntity(entity, index, tileSize));

  const migratedDecorEntities = [];
  doc.decor = normalizedDecor.filter((decor) => {
    if (!isEntityLikeEditableType(decor.type)) return true;

    migratedDecorEntities.push({
      id: decor.id,
      name: decor.name,
      type: normalizeEditableObjectType(decor.type),
      x: decor.x,
      y: decor.y,
      visible: decor.visible,
      params: getEntityPresetParamsForType(decor.type, decor.params),
    });
    return false;
  });

  doc.entities = [...normalizedEntities, ...migratedDecorEntities];

  const rawSounds = Array.isArray(doc.sounds) ? doc.sounds : [];
  doc.sounds = rawSounds.map((sound, index) => normalizeSound(sound, index));

  return doc;
}

export function getTileIndex(width, x, y) {
  return y * width + x;
}
