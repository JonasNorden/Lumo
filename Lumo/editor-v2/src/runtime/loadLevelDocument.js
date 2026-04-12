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

  const spawn = resolveEditorSpawn(editorLevel, warnings);

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

function resolveEditorSpawn(editorLevel, warnings) {
  const entitySpawn = Array.isArray(editorLevel?.entities)
    ? editorLevel.entities.find((entity) => String(entity?.type || "").trim().toLowerCase() === "player-spawn")
    : null;
  if (Number.isFinite(entitySpawn?.x) && Number.isFinite(entitySpawn?.y)) {
    return { x: Math.round(entitySpawn.x), y: Math.round(entitySpawn.y) };
  }

  pushWarning(warnings, "Editor level has no player-spawn entity; defaulting spawn to (1,1).");
  return { x: 1, y: 1 };
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
    result.push({
      tileId,
      x: index % width,
      y: Math.floor(index / width),
      w: 1,
      h: 1,
    });
  }

  const placements = Array.isArray(editorLevel?.tiles?.placements) ? editorLevel.tiles.placements : [];
  for (const placement of placements) {
    const tileId = Number(placement?.value) | 0;
    const x = Number.isFinite(placement?.x) ? Math.round(placement.x) : null;
    const y = Number.isFinite(placement?.y) ? Math.round(placement.y) : null;
    if (!Number.isInteger(x) || !Number.isInteger(y) || tileId <= 0) continue;

    result.push({
      tileId,
      x,
      y,
      w: Number.isFinite(placement?.size) && placement.size > 0 ? Math.round(placement.size) : 1,
      h: Number.isFinite(placement?.size) && placement.size > 0 ? Math.round(placement.size) : 1,
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

function convertEditorEntities(editorLevel) {
  const entities = Array.isArray(editorLevel?.entities) ? editorLevel.entities : [];
  return entities.map((entry, index) => ({
    entityId: typeof entry?.id === "string" ? entry.id : `entity-${index + 1}`,
    entityType: typeof entry?.type === "string" ? entry.type : "generic",
    x: Number.isFinite(entry?.x) ? Math.round(entry.x) : 0,
    y: Number.isFinite(entry?.y) ? Math.round(entry.y) : 0,
    params: isPlainObject(entry?.params) ? { ...entry.params } : {},
  }));
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

    return {
      ...tile,
      w: tile.w == null ? 1 : tile.w,
      h: tile.h == null ? 1 : tile.h,
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

    if (entity.entityType == null) {
      pushError(errors, `layers.entities[${index}].entityType is required.`);
    }
    if (entity.x == null) {
      pushError(errors, `layers.entities[${index}].x is required.`);
    }
    if (entity.y == null) {
      pushError(errors, `layers.entities[${index}].y is required.`);
    }

    return {
      ...entity,
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
