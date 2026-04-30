import { cloneEntityParams } from "../entities/entityParams.js";
import { findEntityPresetById, getEntityPresetParamsForType } from "../entities/entityPresets.js";
import { isSpecialVolumeEntityType, syncSpecialVolumeEntityToAnchor } from "../entities/specialVolumeTypes.js";
import { DEFAULT_SOUND_PRESET_ID, getSoundPresetDefaultParams, getSoundPresetForType } from "../sound/soundPresets.js";
import { isEntityLikeEditableType, normalizeEditableObjectType } from "../placeables/editableObjectBuckets.js";
import { getAuthoredSoundSource } from "../sound/sourceReference.js";
import { normalizeSoundType } from "../sound/soundVisuals.js";
import { BACKGROUND_MATERIAL_OPTIONS, DEFAULT_BACKGROUND_MATERIAL_ID, normalizeBackgroundMaterial } from "../background/materialCatalog.js";
import { normalizeSizedPlacements } from "../tiles/sizedPlacements.js";
import { normalizeSpawnAndExitEntities } from "../entities/spawnExitRules.js";
import { normalizeThemeId } from "../theme/themeCatalog.js";

const SUPPORTED_BACKGROUND_LAYER_TYPES = new Set(["color", "image", "gradient", "procedural"]);
const DEFAULT_BACKGROUND_LAYER_COLOR = "#1b2436";
const DEFAULT_DECOR_VARIANT = "a";
const FLOWER_DECOR_TYPE = "decor_flower_01";
const DEFAULT_REACTIVE_GRASS_PATCH = Object.freeze({
  kind: "reactive_grass",
  x: 0,
  y: 0,
  width: 166,
  density: 416,
  heightMin: 12,
  heightMax: 84,
  heightProfile: "organic_wave",
  heightVariation: 1,
  baseColor: "#12391f",
  topColor: "#7fd66b",
  variant: "lush_default",
  seed: 12345,
  windAmp: 13.5,
  reactFar: 176,
  reactMid: 94,
  reactNear: 36,
});


const DEFAULT_REACTIVE_CRYSTAL_PATCH = Object.freeze({
  kind: "reactive_crystal",
  x: 0,
  y: 0,
  clusterCount: 12,
  width: 168,
  heightMin: 18,
  heightMax: 92,
  triggerRadius: 132,
  auraSensitivity: 1,
  wakeSpeed: 1,
  settleDelayMs: 520,
  settleSpeed: 1,
  baseColor: "#335c88",
  glowColor: "#83e6ff",
  coreColor: "#d4f8ff",
  edgeColor: "#7d8dff",
  variant: "default",
  seed: 12345,
});

export function getDefaultReactiveCrystalPatch() {
  return { ...DEFAULT_REACTIVE_CRYSTAL_PATCH };
}

const DEFAULT_REACTIVE_BLOOM_PATCH = Object.freeze({
  kind: "reactive_bloom",
  x: 0,
  y: 0,
  clusterCount: 18,
  width: 180,
  heightMin: 22,
  heightMax: 110,
  triggerRadius: 124,
  auraSensitivity: 1,
  openSpeed: 1,
  closeDelayMs: 480,
  closeSpeed: 1,
  stemColor: "#2e6a41",
  petalInnerColor: "#ffd5f4",
  petalOuterColor: "#b37dff",
  coreColor: "#ffe88e",
  variant: "default",
  seed: 12345,
});

function parseFlowerVariant(value) {
  if (Number.isFinite(value)) {
    const parsed = Math.round(value);
    if (parsed >= 1 && parsed <= 4) return parsed;
    return null;
  }

  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (/^[1-4]$/.test(normalized)) return Number.parseInt(normalized, 10);
  if (normalized === "a" || normalized === "default") return 1;
  if (normalized === "b") return 2;
  if (normalized === "c") return 3;
  if (normalized === "d") return 4;
  return null;
}

/**
 * @typedef LevelDocument
 * @property {{id: string, name: string, version: string, themeId?: string}} meta
 * @property {{width: number, height: number, tileSize: number}} dimensions
 * @property {{base: number[], placements?: {x: number, y: number, size: number, value: number}[]}} tiles
 * @property {{layers: {id: string, name: string, type: string, depth: number, visible: boolean, color: string}[]}} backgrounds
 * @property {{base: (string|null)[], placements?: {x: number, y: number, size: number, materialId: string}[], materials: {id: string, label: string, img: string|null, drawW: number, drawH: number, drawAnchor: "BL", drawOffX: number, drawOffY: number, footprint: {w: number, h: number}, fallbackColor: string, group: string}[]}} background
 * @property {{id: string, name: string, type: string, x: number, y: number, visible: boolean, variant: string, params: Record<string, string | number | boolean>}[]} decor
 * @property {{id: string, name: string, type: string, x: number, y: number, visible: boolean, params: Record<string, string | number | boolean>}[]} entities
 * @property {{id: string, name: string, type: string, x: number, y: number, visible: boolean, source?: string, params: Record<string, string | number | boolean>}[]} sounds
 * @property {{id: string, kind: string, x: number, y: number, width: number, heightMin: number, heightMax: number, baseColor: string, topColor: string}[]} reactiveGrassPatches
 * @property {{id: string, kind: string, x: number, y: number, clusterCount: number, width: number, heightMin: number, heightMax: number, triggerRadius: number, auraSensitivity: number, wakeSpeed: number, settleDelayMs: number, settleSpeed: number, baseColor: string, glowColor: string, coreColor: string, edgeColor: string, variant: string, seed: number}[]} reactiveCrystalPatches
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
  const rawDefaultMaterialId = typeof background?.defaultMaterialId === "string" ? background.defaultMaterialId.trim() : "";
  const defaultMaterialId = rawDefaultMaterialId && knownMaterialIds.has(rawDefaultMaterialId)
    ? rawDefaultMaterialId
    : DEFAULT_BACKGROUND_MATERIAL_ID;

  return {
    base: sanitizedBase,
    placements: normalizeSizedPlacements(background?.placements, "background"),
    materials: fallbackMaterials,
    defaultMaterialId,
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
  const nextFlipX = decor?.flipX === true;
  const nextParams = cloneEntityParams(decor?.params);
  if (nextType === FLOWER_DECOR_TYPE) {
    const parsedFlowerVariant = parseFlowerVariant(nextParams.variant) ?? parseFlowerVariant(nextVariant) ?? 1;
    nextParams.variant = parsedFlowerVariant;
  }

  return {
    id: nextId,
    name: nextName,
    type: nextType,
    x: nextX,
    y: nextY,
    visible: nextVisible,
    variant: nextVariant,
    flipX: nextFlipX,
    params: nextParams,
  };
}

function normalizeEntity(entity, index, tileSize = 24) {
  const fallbackId = `entity-${index + 1}`;
  const nextId = typeof entity?.id === "string" && entity.id.trim() ? entity.id : fallbackId;
  const authoredPresetId = typeof entity?.params?.presetId === "string" && entity.params.presetId.trim()
    ? entity.params.presetId.trim()
    : "";
  const authoredPreset = authoredPresetId ? findEntityPresetById(authoredPresetId) : null;
  const fallbackType = typeof entity?.type === "string" && entity.type.trim()
    ? normalizeEditableObjectType(entity.type)
    : "generic";
  const nextType = authoredPreset?.type || fallbackType;
  const nextName = typeof entity?.name === "string" && entity.name.trim()
    ? entity.name
    : authoredPreset?.defaultName || `Entity ${index + 1}`;
  const nextX = Number.isFinite(entity?.x) ? Math.round(entity.x) : 0;
  const nextY = Number.isFinite(entity?.y) ? Math.round(entity.y) : 0;
  const nextVisible = typeof entity?.visible === "boolean" ? entity.visible : true;
  const presetParamsId = authoredPreset?.id || nextType;
  const nextParams = getEntityPresetParamsForType(presetParamsId, entity?.params);
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
    return syncSpecialVolumeEntityToAnchor(normalizedEntity, tileSize);
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

function normalizeReactiveGrassPatch(patch, index) {
  const sourcePatch = patch && typeof patch === "object" ? patch : {};
  const rawHeightMin = Number.isFinite(sourcePatch.heightMin)
    ? Number(sourcePatch.heightMin)
    : DEFAULT_REACTIVE_GRASS_PATCH.heightMin;
  const rawHeightMax = Number.isFinite(sourcePatch.heightMax)
    ? Number(sourcePatch.heightMax)
    : DEFAULT_REACTIVE_GRASS_PATCH.heightMax;
  const safeHeightMin = Math.max(1, Math.round(Math.min(rawHeightMin, rawHeightMax)));
  const safeHeightMax = Math.max(safeHeightMin, Math.round(Math.max(rawHeightMin, rawHeightMax)));

  return {
    ...sourcePatch,
    id: typeof sourcePatch.id === "string" && sourcePatch.id.trim()
      ? sourcePatch.id.trim()
      : `reactive_grass_patch_${index + 1}`,
    kind: typeof sourcePatch.kind === "string" && sourcePatch.kind.trim()
      ? sourcePatch.kind.trim()
      : DEFAULT_REACTIVE_GRASS_PATCH.kind,
    x: Number.isFinite(sourcePatch.x) ? Number(sourcePatch.x) : DEFAULT_REACTIVE_GRASS_PATCH.x,
    y: Number.isFinite(sourcePatch.y) ? Number(sourcePatch.y) : DEFAULT_REACTIVE_GRASS_PATCH.y,
    width: Number.isFinite(sourcePatch.width) && sourcePatch.width > 0
      ? Number(sourcePatch.width)
      : DEFAULT_REACTIVE_GRASS_PATCH.width,
    density: Number.isFinite(sourcePatch.density) && sourcePatch.density > 0
      ? Math.max(8, Math.round(sourcePatch.density))
      : DEFAULT_REACTIVE_GRASS_PATCH.density,
    heightMin: safeHeightMin,
    heightMax: safeHeightMax,
    heightProfile: typeof sourcePatch.heightProfile === "string" && sourcePatch.heightProfile.trim()
      ? sourcePatch.heightProfile.trim()
      : DEFAULT_REACTIVE_GRASS_PATCH.heightProfile,
    heightVariation: Number.isFinite(sourcePatch.heightVariation)
      ? Math.max(0, Math.min(1, Number(sourcePatch.heightVariation)))
      : DEFAULT_REACTIVE_GRASS_PATCH.heightVariation,
    baseColor: typeof sourcePatch.baseColor === "string" && sourcePatch.baseColor.trim()
      ? sourcePatch.baseColor.trim()
      : DEFAULT_REACTIVE_GRASS_PATCH.baseColor,
    topColor: typeof sourcePatch.topColor === "string" && sourcePatch.topColor.trim()
      ? sourcePatch.topColor.trim()
      : DEFAULT_REACTIVE_GRASS_PATCH.topColor,
    seed: Number.isFinite(sourcePatch.seed) ? Number(sourcePatch.seed) : DEFAULT_REACTIVE_GRASS_PATCH.seed,
    windAmp: Number.isFinite(sourcePatch.windAmp) ? Number(sourcePatch.windAmp) : DEFAULT_REACTIVE_GRASS_PATCH.windAmp,
    reactFar: Number.isFinite(sourcePatch.reactFar) ? Number(sourcePatch.reactFar) : DEFAULT_REACTIVE_GRASS_PATCH.reactFar,
    reactMid: Number.isFinite(sourcePatch.reactMid) ? Number(sourcePatch.reactMid) : DEFAULT_REACTIVE_GRASS_PATCH.reactMid,
    reactNear: Number.isFinite(sourcePatch.reactNear) ? Number(sourcePatch.reactNear) : DEFAULT_REACTIVE_GRASS_PATCH.reactNear,
  };
}

function normalizeReactiveCrystalPatch(patch, index) {
  const sourcePatch = patch && typeof patch === "object" ? patch : {};
  const rawHeightMin = Number.isFinite(sourcePatch.heightMin) ? Number(sourcePatch.heightMin) : DEFAULT_REACTIVE_CRYSTAL_PATCH.heightMin;
  const rawHeightMax = Number.isFinite(sourcePatch.heightMax) ? Number(sourcePatch.heightMax) : DEFAULT_REACTIVE_CRYSTAL_PATCH.heightMax;
  const safeHeightMin = Math.max(1, Math.round(Math.min(rawHeightMin, rawHeightMax)));
  const safeHeightMax = Math.max(safeHeightMin, Math.round(Math.max(rawHeightMin, rawHeightMax)));
  return {
    ...sourcePatch,
    id: typeof sourcePatch.id === "string" && sourcePatch.id.trim() ? sourcePatch.id.trim() : `reactive_crystal_patch_${index + 1}`,
    kind: typeof sourcePatch.kind === "string" && sourcePatch.kind.trim() ? sourcePatch.kind.trim() : DEFAULT_REACTIVE_CRYSTAL_PATCH.kind,
    x: Number.isFinite(sourcePatch.x) ? Number(sourcePatch.x) : DEFAULT_REACTIVE_CRYSTAL_PATCH.x,
    y: Number.isFinite(sourcePatch.y) ? Number(sourcePatch.y) : DEFAULT_REACTIVE_CRYSTAL_PATCH.y,
    clusterCount: Number.isFinite(sourcePatch.clusterCount) ? Math.max(1, Math.round(sourcePatch.clusterCount)) : DEFAULT_REACTIVE_CRYSTAL_PATCH.clusterCount,
    width: Number.isFinite(sourcePatch.width) && sourcePatch.width > 0 ? Number(sourcePatch.width) : DEFAULT_REACTIVE_CRYSTAL_PATCH.width,
    heightMin: safeHeightMin,
    heightMax: safeHeightMax,
    triggerRadius: Number.isFinite(sourcePatch.triggerRadius) && sourcePatch.triggerRadius >= 0 ? Number(sourcePatch.triggerRadius) : DEFAULT_REACTIVE_CRYSTAL_PATCH.triggerRadius,
    auraSensitivity: Number.isFinite(sourcePatch.auraSensitivity) ? Number(sourcePatch.auraSensitivity) : DEFAULT_REACTIVE_CRYSTAL_PATCH.auraSensitivity,
    wakeSpeed: Number.isFinite(sourcePatch.wakeSpeed) ? Number(sourcePatch.wakeSpeed) : DEFAULT_REACTIVE_CRYSTAL_PATCH.wakeSpeed,
    settleDelayMs: Number.isFinite(sourcePatch.settleDelayMs) && sourcePatch.settleDelayMs >= 0 ? Math.round(sourcePatch.settleDelayMs) : DEFAULT_REACTIVE_CRYSTAL_PATCH.settleDelayMs,
    settleSpeed: Number.isFinite(sourcePatch.settleSpeed) ? Number(sourcePatch.settleSpeed) : DEFAULT_REACTIVE_CRYSTAL_PATCH.settleSpeed,
    baseColor: typeof sourcePatch.baseColor === "string" && sourcePatch.baseColor.trim() ? sourcePatch.baseColor.trim() : DEFAULT_REACTIVE_CRYSTAL_PATCH.baseColor,
    glowColor: typeof sourcePatch.glowColor === "string" && sourcePatch.glowColor.trim() ? sourcePatch.glowColor.trim() : DEFAULT_REACTIVE_CRYSTAL_PATCH.glowColor,
    coreColor: typeof sourcePatch.coreColor === "string" && sourcePatch.coreColor.trim() ? sourcePatch.coreColor.trim() : DEFAULT_REACTIVE_CRYSTAL_PATCH.coreColor,
    edgeColor: typeof sourcePatch.edgeColor === "string" && sourcePatch.edgeColor.trim() ? sourcePatch.edgeColor.trim() : DEFAULT_REACTIVE_CRYSTAL_PATCH.edgeColor,
    variant: typeof sourcePatch.variant === "string" && sourcePatch.variant.trim() ? sourcePatch.variant.trim() : DEFAULT_REACTIVE_CRYSTAL_PATCH.variant,
    seed: Number.isFinite(sourcePatch.seed) ? Math.round(sourcePatch.seed) : DEFAULT_REACTIVE_CRYSTAL_PATCH.seed,
  };
}

function normalizeReactiveBloomPatch(patch, index) {
  const sourcePatch = patch && typeof patch === "object" ? patch : {};
  const rawHeightMin = Number.isFinite(sourcePatch.heightMin) ? Number(sourcePatch.heightMin) : DEFAULT_REACTIVE_BLOOM_PATCH.heightMin;
  const rawHeightMax = Number.isFinite(sourcePatch.heightMax) ? Number(sourcePatch.heightMax) : DEFAULT_REACTIVE_BLOOM_PATCH.heightMax;
  const safeHeightMin = Math.max(1, Math.round(Math.min(rawHeightMin, rawHeightMax)));
  const safeHeightMax = Math.max(safeHeightMin, Math.round(Math.max(rawHeightMin, rawHeightMax)));
  return {
    ...sourcePatch,
    id: typeof sourcePatch.id === "string" && sourcePatch.id.trim() ? sourcePatch.id.trim() : `reactive_bloom_patch_${index + 1}`,
    kind: typeof sourcePatch.kind === "string" && sourcePatch.kind.trim() ? sourcePatch.kind.trim() : DEFAULT_REACTIVE_BLOOM_PATCH.kind,
    x: Number.isFinite(sourcePatch.x) ? Number(sourcePatch.x) : DEFAULT_REACTIVE_BLOOM_PATCH.x,
    y: Number.isFinite(sourcePatch.y) ? Number(sourcePatch.y) : DEFAULT_REACTIVE_BLOOM_PATCH.y,
    clusterCount: Number.isFinite(sourcePatch.clusterCount) ? Math.max(1, Math.round(sourcePatch.clusterCount)) : DEFAULT_REACTIVE_BLOOM_PATCH.clusterCount,
    width: Number.isFinite(sourcePatch.width) && sourcePatch.width > 0 ? Number(sourcePatch.width) : DEFAULT_REACTIVE_BLOOM_PATCH.width,
    heightMin: safeHeightMin,
    heightMax: safeHeightMax,
    triggerRadius: Number.isFinite(sourcePatch.triggerRadius) && sourcePatch.triggerRadius >= 0 ? Number(sourcePatch.triggerRadius) : DEFAULT_REACTIVE_BLOOM_PATCH.triggerRadius,
    auraSensitivity: Number.isFinite(sourcePatch.auraSensitivity) ? Number(sourcePatch.auraSensitivity) : DEFAULT_REACTIVE_BLOOM_PATCH.auraSensitivity,
    openSpeed: Number.isFinite(sourcePatch.openSpeed) ? Number(sourcePatch.openSpeed) : DEFAULT_REACTIVE_BLOOM_PATCH.openSpeed,
    closeDelayMs: Number.isFinite(sourcePatch.closeDelayMs) && sourcePatch.closeDelayMs >= 0 ? Math.round(sourcePatch.closeDelayMs) : DEFAULT_REACTIVE_BLOOM_PATCH.closeDelayMs,
    closeSpeed: Number.isFinite(sourcePatch.closeSpeed) ? Number(sourcePatch.closeSpeed) : DEFAULT_REACTIVE_BLOOM_PATCH.closeSpeed,
    stemColor: typeof sourcePatch.stemColor === "string" && sourcePatch.stemColor.trim() ? sourcePatch.stemColor.trim() : DEFAULT_REACTIVE_BLOOM_PATCH.stemColor,
    petalInnerColor: typeof sourcePatch.petalInnerColor === "string" && sourcePatch.petalInnerColor.trim() ? sourcePatch.petalInnerColor.trim() : DEFAULT_REACTIVE_BLOOM_PATCH.petalInnerColor,
    petalOuterColor: typeof sourcePatch.petalOuterColor === "string" && sourcePatch.petalOuterColor.trim() ? sourcePatch.petalOuterColor.trim() : DEFAULT_REACTIVE_BLOOM_PATCH.petalOuterColor,
    coreColor: typeof sourcePatch.coreColor === "string" && sourcePatch.coreColor.trim() ? sourcePatch.coreColor.trim() : DEFAULT_REACTIVE_BLOOM_PATCH.coreColor,
    variant: typeof sourcePatch.variant === "string" && sourcePatch.variant.trim() ? sourcePatch.variant.trim() : DEFAULT_REACTIVE_BLOOM_PATCH.variant,
    seed: Number.isFinite(sourcePatch.seed) ? Math.round(sourcePatch.seed) : DEFAULT_REACTIVE_BLOOM_PATCH.seed,
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
  doc.meta.themeId = normalizeThemeId(doc.meta.themeId);

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

  doc.entities = normalizeSpawnAndExitEntities(doc, [...normalizedEntities, ...migratedDecorEntities]);

  const rawSounds = Array.isArray(doc.sounds) ? doc.sounds : [];
  doc.sounds = rawSounds.map((sound, index) => normalizeSound(sound, index));
  const rawReactiveGrassPatches = Array.isArray(doc.reactiveGrassPatches) ? doc.reactiveGrassPatches : [];
  doc.reactiveGrassPatches = rawReactiveGrassPatches.map((patch, index) => normalizeReactiveGrassPatch(patch, index));
  const rawReactiveBloomPatches = Array.isArray(doc.reactiveBloomPatches) ? doc.reactiveBloomPatches : [];
  doc.reactiveBloomPatches = rawReactiveBloomPatches.map((patch, index) => normalizeReactiveBloomPatch(patch, index));
  const rawReactiveCrystalPatches = Array.isArray(doc.reactiveCrystalPatches) ? doc.reactiveCrystalPatches : [];
  doc.reactiveCrystalPatches = rawReactiveCrystalPatches.map((patch, index) => normalizeReactiveCrystalPatch(patch, index));

  return doc;
}

export function getTileIndex(width, x, y) {
  return y * width + x;
}
