import { resolveLegacyBehaviorByTileId } from "./runtimeTileBehavior.js";

// Recharged level loader v1.
// This module validates and normalizes the new level document shape without
// mutating caller-provided input.

const REQUIRED_LAYER_KEYS = ["tiles", "background", "decor", "entities", "audio"];
const DEFAULT_TILE_SIZE = 24;

/**
 * Loads a level-like value into a normalized Recharged level document shape.
 */
export function loadLevelDocument(data) {
  const errors = [];
  const warnings = [];
  const normalizedInput = normalizeInputDocument(data, errors, warnings);

  // Validate the top-level value first so we can safely read nested properties.
  if (!isPlainObject(normalizedInput)) {
    pushError(errors, "Level document must be a plain object.");
    return buildResult({ level: null, errors, warnings });
  }

  const identity = validateIdentity(normalizedInput.identity, errors);
  const world = validateWorld(normalizedInput.world, errors);
  const layers = normalizeLayers(normalizedInput.layers, errors, warnings);

  if (errors.length > 0) {
    return buildResult({ level: null, errors, warnings });
  }

  // Build a normalized copy while preserving optional sections when present.
  const level = {
    identity,
    meta: isPlainObject(normalizedInput.meta) ? { ...normalizedInput.meta } : null,
    world,
    layers,
    systems: isPlainObject(normalizedInput.systems) ? { ...normalizedInput.systems } : null,
  };

  return buildResult({ level, errors, warnings });
}

function normalizeInputDocument(data, errors, warnings) {
  if (isRechargedDocumentShape(data)) {
    return data;
  }

  if (!isEditorV2DocumentShape(data)) {
    return data;
  }

  pushWarning(warnings, "Loaded Editor V2 level document; converting to Recharged runtime shape.");
  const converted = convertEditorV2ToRecharged(data, warnings);
  if (!isPlainObject(converted)) {
    pushError(errors, "Failed to convert Editor V2 level document into runtime shape.");
    return null;
  }

  return converted;
}

function isRechargedDocumentShape(data) {
  return isPlainObject(data) && isPlainObject(data.identity) && isPlainObject(data.world) && isPlainObject(data.layers);
}

function isEditorV2DocumentShape(data) {
  return isPlainObject(data) && isPlainObject(data.meta) && isPlainObject(data.dimensions) && isPlainObject(data.tiles);
}

function convertEditorV2ToRecharged(editorLevel, warnings) {
  const width = Number.isFinite(editorLevel?.dimensions?.width) ? Math.max(1, Math.round(editorLevel.dimensions.width)) : 1;
  const height = Number.isFinite(editorLevel?.dimensions?.height) ? Math.max(1, Math.round(editorLevel.dimensions.height)) : 1;
  const tileSize = Number.isFinite(editorLevel?.dimensions?.tileSize) && editorLevel.dimensions.tileSize > 0
    ? Math.round(editorLevel.dimensions.tileSize)
    : DEFAULT_TILE_SIZE;

  const spawn = resolveEditorSpawn(editorLevel, tileSize, warnings);

  return {
    identity: {
      id: typeof editorLevel?.meta?.id === "string" ? editorLevel.meta.id : "",
      name: typeof editorLevel?.meta?.name === "string" ? editorLevel.meta.name : "",
      formatVersion: typeof editorLevel?.meta?.version === "string" ? editorLevel.meta.version : "2.0.0",
      themeId: typeof editorLevel?.meta?.themeId === "string" ? editorLevel.meta.themeId : "",
    },
    meta: {
      title: typeof editorLevel?.meta?.name === "string" ? editorLevel.meta.name : "",
      source: "editor-v2",
    },
    world: {
      width,
      height,
      tileSize,
      spawn,
    },
    layers: {
      tiles: convertEditorTiles(editorLevel, width, height, warnings),
      background: convertEditorBackground(editorLevel),
      decor: convertEditorDecor(editorLevel),
      entities: convertEditorEntities(editorLevel),
      audio: convertEditorAudio(editorLevel),
    },
    systems: {
      sourceFormat: "editor-v2",
    },
  };
}

function resolveEditorSpawn(editorLevel, tileSize, warnings) {
  const safeTileSize = Number.isFinite(tileSize) && tileSize > 0 ? Math.round(tileSize) : DEFAULT_TILE_SIZE;
  const worldSpawnGrid = toEditorGridPosition(editorLevel?.world?.spawn);
  const entitySpawn = Array.isArray(editorLevel?.entities)
    ? editorLevel.entities.find((entity) => String(entity?.type || "").trim().toLowerCase() === "player-spawn")
    : null;
  const entitySpawnGrid = toEditorGridPosition(entitySpawn);
  const authoredSpawnGrid = worldSpawnGrid ?? entitySpawnGrid;

  if (authoredSpawnGrid) {
    return {
      x: authoredSpawnGrid.x * safeTileSize,
      y: authoredSpawnGrid.y * safeTileSize,
    };
  }

  pushWarning(warnings, "Editor level is missing player spawn data; defaulting to grid (1,1).");
  return { x: safeTileSize, y: safeTileSize };
}

function toEditorGridPosition(value) {
  if (!isPlainObject(value)) {
    return null;
  }

  const xCandidates = [value.x, value.gridX, value.tileX, value.cellX, value?.position?.x];
  const yCandidates = [value.y, value.gridY, value.tileY, value.cellY, value?.position?.y];
  const x = firstFinite(xCandidates);
  const y = firstFinite(yCandidates);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x: Math.round(x), y: Math.round(y) };
}

function firstFinite(values) {
  for (const value of values) {
    if (Number.isFinite(value)) {
      return Number(value);
    }
  }

  return null;
}

function convertEditorTiles(editorLevel, width, height, warnings) {
  const result = [];
  const base = Array.isArray(editorLevel?.tiles?.base) ? editorLevel.tiles.base : [];
  const expected = width * height;
  if (base.length !== expected) {
    pushWarning(warnings, `Editor tile base count (${base.length}) did not match dimensions (${expected}).`);
  }

  const limit = Math.min(base.length, expected);
  for (let index = 0; index < limit; index += 1) {
    const tileId = Number(base[index]) | 0;
    if (tileId <= 0) continue;
    const behavior = resolveLegacyBehaviorByTileId(tileId);
    result.push({
      tileId,
      x: index % width,
      y: Math.floor(index / width),
      w: 1,
      h: 1,
      solid: behavior.solid,
      oneWay: behavior.oneWay,
      hazard: behavior.hazard,
      maxSpeedMul: behavior.maxSpeedMul,
      groundAccelMul: behavior.groundAccelMul,
      groundFrictionMul: behavior.groundFrictionMul,
      coordinateSpace: "grid",
    });
  }

  const placements = Array.isArray(editorLevel?.tiles?.placements) ? editorLevel.tiles.placements : [];
  for (const placement of placements) {
    const tileId = Number(placement?.value) | 0;
    const x = Number.isFinite(placement?.x) ? Math.round(placement.x) : null;
    const authoredAnchorY = Number.isFinite(placement?.y) ? Math.round(placement.y) : null;
    if (!Number.isInteger(x) || !Number.isInteger(authoredAnchorY) || tileId <= 0) continue;
    const size = Number.isFinite(placement?.size) && placement.size > 0 ? Math.round(placement.size) : 1;
    // Editor V2 stores sized-tile y as the bottom row anchor (BL footprint semantics).
    // Recharged grid collision expects x/y as top-left of the occupied rect, so normalize here.
    const y = authoredAnchorY - (size - 1);

    const behavior = resolveLegacyBehaviorByTileId(tileId);
    result.push({
      tileId,
      x,
      y,
      w: size,
      h: size,
      solid: behavior.solid,
      oneWay: behavior.oneWay,
      hazard: behavior.hazard,
      maxSpeedMul: behavior.maxSpeedMul,
      groundAccelMul: behavior.groundAccelMul,
      groundFrictionMul: behavior.groundFrictionMul,
      behaviorProfileId: typeof placement?.behaviorProfileId === "string" ? placement.behaviorProfileId : undefined,
      behaviorParams: placement?.behaviorParams && typeof placement.behaviorParams === "object" ? { ...placement.behaviorParams } : undefined,
      collisionType: typeof placement?.collisionType === "string" ? placement.collisionType : undefined,
      special: typeof placement?.special === "string" ? placement.special : undefined,
      coordinateSpace: "grid",
    });
  }

  return result;
}

function convertEditorBackground(editorLevel) {
  const layers = Array.isArray(editorLevel?.backgrounds?.layers) ? editorLevel.backgrounds.layers : [];
  return layers.map((layer, index) => ({
    backgroundId: typeof layer?.id === "string" ? layer.id : `background-${index + 1}`,
    order: Number.isFinite(layer?.depth) ? layer.depth : index,
    type: typeof layer?.type === "string" ? layer.type : "color",
    color: typeof layer?.color === "string" ? layer.color : "#000000",
  }));
}

function convertEditorDecor(editorLevel) {
  const decor = Array.isArray(editorLevel?.decor) ? editorLevel.decor : [];
  return decor.map((entry, index) => ({
    decorId: typeof entry?.id === "string" ? entry.id : `decor-${index + 1}`,
    decorType: typeof entry?.type === "string" ? entry.type : "decor",
    x: Number.isFinite(entry?.x) ? Math.round(entry.x) : 0,
    y: Number.isFinite(entry?.y) ? Math.round(entry.y) : 0,
    order: Number.isFinite(entry?.order) ? entry.order : index,
    params: isPlainObject(entry?.params) ? { ...entry.params } : {},
  }));
}

function resolveEditorEntityPosition(entry, width, height, tileSize, size = DEFAULT_TILE_SIZE, drawAnchor = "BL") {
  const authoredX = Number.isFinite(entry?.x) ? Number(entry.x) : 0;
  const authoredY = Number.isFinite(entry?.y) ? Number(entry.y) : 0;
  const safeTileSize = Number.isFinite(tileSize) && tileSize > 0 ? tileSize : DEFAULT_TILE_SIZE;
  const xLooksGrid = authoredX >= 0 && authoredX <= (Number.isFinite(width) ? width + 1 : 257);
  const yLooksGrid = authoredY >= 0 && authoredY <= (Number.isFinite(height) ? height + 1 : 257);
  const looksGrid = xLooksGrid && yLooksGrid;
  const normalizedSize = Number.isFinite(size) && size > 0 ? Number(size) : safeTileSize;
  const normalizedAnchor = String(drawAnchor || "BL").trim().toUpperCase() === "TL" ? "TL" : "BL";
  const offsetY = normalizedAnchor === "BL" ? safeTileSize - normalizedSize : 0;

  return {
    x: Math.round(looksGrid ? authoredX * safeTileSize : authoredX),
    y: Math.round(looksGrid ? authoredY * safeTileSize + offsetY : authoredY),
  };
}

function resolveEditorEntityType(entry) {
  const authoredType = typeof entry?.type === "string" ? entry.type.trim() : "";
  return authoredType || "generic";
}

function convertEditorEntities(editorLevel) {
  const entities = Array.isArray(editorLevel?.entities) ? editorLevel.entities : [];
  const width = Number.isFinite(editorLevel?.dimensions?.width) ? Math.max(1, Math.round(editorLevel.dimensions.width)) : 1;
  const height = Number.isFinite(editorLevel?.dimensions?.height) ? Math.max(1, Math.round(editorLevel.dimensions.height)) : 1;
  const tileSize = Number.isFinite(editorLevel?.dimensions?.tileSize) && editorLevel.dimensions.tileSize > 0
    ? Math.round(editorLevel.dimensions.tileSize)
    : DEFAULT_TILE_SIZE;

  return entities.map((entry, index) => {
    const params = isPlainObject(entry?.params) ? { ...entry.params } : {};
    const type = resolveEditorEntityType(entry);
    const size = Number.isFinite(entry?.size) && entry.size > 0
      ? Number(entry.size)
      : Number.isFinite(params?.drawW) && params.drawW > 0
        ? Number(params.drawW)
        : 24;
    const drawAnchor = String(params?.drawAnchor || "BL").trim().toUpperCase() === "TL" ? "TL" : "BL";
    const position = resolveEditorEntityPosition(entry, width, height, tileSize, size, drawAnchor);
    const maxHp = Number.isFinite(entry?.maxHp) && entry.maxHp > 0
      ? Math.floor(entry.maxHp)
      : Number.isFinite(params?.maxHp) && params.maxHp > 0
        ? Math.floor(params.maxHp)
        : Number.isFinite(params?.hp) && params.hp > 0
          ? Math.floor(params.hp)
          : 1;
    const hp = Number.isFinite(entry?.hp) && entry.hp >= 0
      ? Math.floor(entry.hp)
      : Number.isFinite(params?.hp) && params.hp >= 0
        ? Math.floor(params.hp)
        : maxHp;

    return {
      entityId: typeof entry?.id === "string" ? entry.id : `entity-${index + 1}`,
      entityType: type,
      id: typeof entry?.id === "string" ? entry.id : `entity-${index + 1}`,
      type,
      x: position.x,
      y: position.y,
      size,
      drawAnchor,
      hp,
      maxHp,
      alive: entry?.alive !== false && hp > 0,
      active: entry?.active !== false && hp > 0,
      state: typeof entry?.state === "string" ? entry.state : "idle",
      lastPulseIdHit: Number.isFinite(entry?.lastPulseIdHit) ? Math.floor(entry.lastPulseIdHit) : -1,
      hitFlashTicks: Number.isFinite(entry?.hitFlashTicks) ? Math.max(0, Math.floor(entry.hitFlashTicks)) : 0,
      params,
    };
  });
}

function convertEditorAudio(editorLevel) {
  const sounds = Array.isArray(editorLevel?.sounds) ? editorLevel.sounds : [];
  return sounds.map((entry, index) => ({
    audioId: typeof entry?.id === "string" ? entry.id : `audio-${index + 1}`,
    audioType: typeof entry?.type === "string" ? entry.type : "ambient",
    x: Number.isFinite(entry?.x) ? Math.round(entry.x) : 0,
    y: Number.isFinite(entry?.y) ? Math.round(entry.y) : 0,
    params: isPlainObject(entry?.params) ? { ...entry.params } : {},
  }));
}

// Validates required identity fields and returns a normalized identity object.
export function validateIdentity(identityInput, errors) {
  if (!isPlainObject(identityInput)) {
    pushError(errors, "Missing required section: identity.");
    return null;
  }

  const requiredFields = ["id", "name", "formatVersion", "themeId"];
  for (const field of requiredFields) {
    if (identityInput[field] == null) {
      pushError(errors, `identity.${field} is required.`);
    }
  }

  return {
    id: identityInput.id,
    name: identityInput.name,
    formatVersion: identityInput.formatVersion,
    themeId: identityInput.themeId,
  };
}

// Validates required world fields and returns a normalized world object.
export function validateWorld(worldInput, errors) {
  if (!isPlainObject(worldInput)) {
    pushError(errors, "Missing required section: world.");
    return null;
  }

  const requiredFields = ["width", "height", "tileSize"];
  for (const field of requiredFields) {
    if (worldInput[field] == null) {
      pushError(errors, `world.${field} is required.`);
    }
  }

  if (!isPlainObject(worldInput.spawn)) {
    pushError(errors, "world.spawn is required.");
  } else {
    if (worldInput.spawn.x == null) {
      pushError(errors, "world.spawn.x is required.");
    }
    if (worldInput.spawn.y == null) {
      pushError(errors, "world.spawn.y is required.");
    }
  }

  return {
    width: worldInput.width,
    height: worldInput.height,
    tileSize: worldInput.tileSize,
    spawn: isPlainObject(worldInput.spawn)
      ? { x: worldInput.spawn.x, y: worldInput.spawn.y }
      : { x: undefined, y: undefined },
  };
}

// Ensures all expected layer arrays exist, then normalizes each collection.
export function normalizeLayers(layersInput, errors, warnings) {
  if (!isPlainObject(layersInput)) {
    pushError(errors, "Missing required section: layers.");
    return createEmptyLayers();
  }

  const levelLayers = {};
  for (const key of REQUIRED_LAYER_KEYS) {
    const value = layersInput[key];
    if (value == null) {
      levelLayers[key] = [];
      pushWarning(warnings, `layers.${key} missing; defaulted to empty array.`);
      continue;
    }

    if (!Array.isArray(value)) {
      pushError(errors, `layers.${key} must be an array.`);
      levelLayers[key] = [];
      continue;
    }

    levelLayers[key] = value;
  }

  return {
    tiles: normalizeTiles(levelLayers.tiles, errors),
    background: normalizeBackground(levelLayers.background, errors),
    decor: normalizeDecor(levelLayers.decor, errors, warnings),
    entities: normalizeEntities(levelLayers.entities, errors),
    audio: normalizeAudio(levelLayers.audio, errors),
  };
}

// Normalizes tile entries and applies size defaults.
export function normalizeTiles(tilesInput, errors) {
  return tilesInput.map((tile, index) => {
    if (!isPlainObject(tile)) {
      pushError(errors, `layers.tiles[${index}] must be an object.`);
      return { tileId: undefined, x: undefined, y: undefined, w: 1, h: 1 };
    }

    if (tile.tileId == null) {
      pushError(errors, `layers.tiles[${index}].tileId is required.`);
    }
    if (tile.x == null) {
      pushError(errors, `layers.tiles[${index}].x is required.`);
    }
    if (tile.y == null) {
      pushError(errors, `layers.tiles[${index}].y is required.`);
    }

    const legacyBehavior = resolveLegacyBehaviorByTileId(tile?.tileId);
    const normalizedSolid = typeof tile.solid === "boolean" ? tile.solid : legacyBehavior.solid;

    return {
      ...tile,
      w: tile.w == null ? 1 : tile.w,
      h: tile.h == null ? 1 : tile.h,
      solid: normalizedSolid,
      oneWay: typeof tile.oneWay === "boolean" ? tile.oneWay : legacyBehavior.oneWay,
      hazard: typeof tile.hazard === "boolean" ? tile.hazard : legacyBehavior.hazard,
      maxSpeedMul: Number.isFinite(tile?.maxSpeedMul) ? tile.maxSpeedMul : legacyBehavior.maxSpeedMul,
      groundAccelMul: Number.isFinite(tile?.groundAccelMul) ? tile.groundAccelMul : legacyBehavior.groundAccelMul,
      groundFrictionMul: Number.isFinite(tile?.groundFrictionMul) ? tile.groundFrictionMul : legacyBehavior.groundFrictionMul,
      coordinateSpace: typeof tile.coordinateSpace === "string" ? tile.coordinateSpace : "world",
    };
  });
}

// Normalizes background layer references.
export function normalizeBackground(backgroundInput, errors) {
  return backgroundInput.map((background, index) => {
    if (!isPlainObject(background)) {
      pushError(errors, `layers.background[${index}] must be an object.`);
      return { backgroundId: undefined, order: undefined };
    }

    if (background.backgroundId == null) {
      pushError(errors, `layers.background[${index}].backgroundId is required.`);
    }
    if (background.order == null) {
      pushError(errors, `layers.background[${index}].order is required.`);
    }

    return { ...background };
  });
}

// Normalizes decor entries and applies order default when missing.
export function normalizeDecor(decorInput, errors, warnings) {
  return decorInput.map((decor, index) => {
    if (!isPlainObject(decor)) {
      pushError(errors, `layers.decor[${index}] must be an object.`);
      return { decorId: undefined, x: undefined, y: undefined, order: 0 };
    }

    if (decor.decorId == null) {
      pushError(errors, `layers.decor[${index}].decorId is required.`);
    }
    if (decor.x == null) {
      pushError(errors, `layers.decor[${index}].x is required.`);
    }
    if (decor.y == null) {
      pushError(errors, `layers.decor[${index}].y is required.`);
    }

    const normalizedOrder = decor.order == null ? 0 : decor.order;
    if (decor.order == null) {
      pushWarning(warnings, `layers.decor[${index}].order missing; defaulted to 0.`);
    }

    return {
      ...decor,
      order: normalizedOrder,
    };
  });
}

// Normalizes entity entries and applies params default.
export function normalizeEntities(entitiesInput, errors) {
  return entitiesInput.map((entity, index) => {
    if (!isPlainObject(entity)) {
      pushError(errors, `layers.entities[${index}] must be an object.`);
      return { entityType: undefined, x: undefined, y: undefined, params: {} };
    }

    if (entity.entityType == null && entity.type == null) {
      pushError(errors, `layers.entities[${index}].entityType or layers.entities[${index}].type is required.`);
    }
    if (entity.x == null) {
      pushError(errors, `layers.entities[${index}].x is required.`);
    }
    if (entity.y == null) {
      pushError(errors, `layers.entities[${index}].y is required.`);
    }

    const normalizedType = typeof entity.type === "string"
      ? entity.type
      : (typeof entity.entityType === "string" ? entity.entityType : undefined);

    return {
      ...entity,
      type: normalizedType,
      entityType: typeof entity.entityType === "string" ? entity.entityType : normalizedType,
      params: isPlainObject(entity.params) ? { ...entity.params } : {},
    };
  });
}

// Normalizes audio entries and applies params default.
export function normalizeAudio(audioInput, errors) {
  return audioInput.map((audio, index) => {
    if (!isPlainObject(audio)) {
      pushError(errors, `layers.audio[${index}] must be an object.`);
      return {
        audioId: undefined,
        audioType: undefined,
        x: undefined,
        y: undefined,
        params: {},
      };
    }

    if (audio.audioId == null) {
      pushError(errors, `layers.audio[${index}].audioId is required.`);
    }
    if (audio.audioType == null) {
      pushError(errors, `layers.audio[${index}].audioType is required.`);
    }
    if (audio.x == null) {
      pushError(errors, `layers.audio[${index}].x is required.`);
    }
    if (audio.y == null) {
      pushError(errors, `layers.audio[${index}].y is required.`);
    }

    return {
      ...audio,
      params: isPlainObject(audio.params) ? { ...audio.params } : {},
    };
  });
}

// Error helper to keep messages consistent.
export function pushError(errors, message) {
  errors.push(message);
}

// Warning helper to keep messages consistent.
export function pushWarning(warnings, message) {
  warnings.push(message);
}

// Checks for plain object shape and excludes arrays/null.
export function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createEmptyLayers() {
  return {
    tiles: [],
    background: [],
    decor: [],
    entities: [],
    audio: [],
  };
}

function buildResult({ level, errors, warnings }) {
  const summarySource = level?.layers ?? createEmptyLayers();

  return {
    ok: errors.length === 0,
    level,
    errors,
    warnings,
    debug: {
      summary: {
        tiles: summarySource.tiles.length,
        backgroundLayers: summarySource.background.length,
        decor: summarySource.decor.length,
        entities: summarySource.entities.length,
        audio: summarySource.audio.length,
      },
    },
  };
}
