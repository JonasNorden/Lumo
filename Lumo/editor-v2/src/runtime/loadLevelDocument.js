// Recharged level loader v1.
// This module validates and normalizes the new level document shape without
// mutating caller-provided input.

const REQUIRED_LAYER_KEYS = ["tiles", "background", "decor", "entities", "audio"];

/**
 * Loads a level-like value into a normalized Recharged level document shape.
 */
export function loadLevelDocument(data) {
  const errors = [];
  const warnings = [];

  // Validate the top-level value first so we can safely read nested properties.
  if (!isPlainObject(data)) {
    pushError(errors, "Level document must be a plain object.");
    return buildResult({ level: null, errors, warnings });
  }

  const identity = validateIdentity(data.identity, errors);
  const world = validateWorld(data.world, errors);
  const layers = normalizeLayers(data.layers, errors, warnings);

  if (errors.length > 0) {
    return buildResult({ level: null, errors, warnings });
  }

  // Build a normalized copy while preserving optional sections when present.
  const level = {
    identity,
    meta: isPlainObject(data.meta) ? { ...data.meta } : null,
    world,
    layers,
    systems: isPlainObject(data.systems) ? { ...data.systems } : null,
  };

  return buildResult({ level, errors, warnings });
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
