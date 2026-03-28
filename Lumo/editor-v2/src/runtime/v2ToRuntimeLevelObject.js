import { normalizeSoundType } from "../domain/sound/soundVisuals.js";
import { getAuthoredSoundSource } from "../domain/sound/sourceReference.js";

const SUPPORTED_RUNTIME_ENTITY_IDS = new Set([
  "start_01",
  "checkpoint_01",
  "exit_01",
  "lantern_01",
  "powercell_01",
  "flare_pickup_01",
  "firefly_01",
  "dark_creature_01",
  "hover_void_01",
  "decor_flower_01",
  "fog_volume",
]);

const UNSUPPORTED_VOLUME_TYPES = new Set(["water_volume", "lava_volume", "bubbling_liquid_volume"]);

function cloneParams(params) {
  if (!params || typeof params !== "object") return {};
  return structuredClone(params);
}

function normalizeRuntimeEntityType(type) {
  const normalized = String(type || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "player-spawn") return "start_01";
  if (normalized === "player-exit") return "exit_01";
  if (normalized === "checkpoint") return "checkpoint_01";
  return normalized;
}

function mapSoundToRuntimeEntity(sound, tileSize) {
  const soundType = normalizeSoundType(sound?.type);
  const params = cloneParams(sound?.params);
  const soundFile = getAuthoredSoundSource(sound);

  const base = {
    x: Number.isFinite(sound?.x) ? (sound.x | 0) : 0,
    y: Number.isFinite(sound?.y) ? (sound.y | 0) : 0,
    params: {
      ...(soundFile ? { soundFile } : {}),
      volume: Number.isFinite(Number(params.volume)) ? Number(params.volume) : undefined,
      loop: typeof params.loop === "boolean" ? params.loop : undefined,
    },
  };

  if (soundType === "spot") {
    const radiusTiles = Number.isFinite(Number(params.radius)) ? Number(params.radius) : 4;
    return {
      entity: {
        id: "spot_sound",
        ...base,
        params: {
          ...base.params,
          radius: Math.max(0, radiusTiles * tileSize),
          fadeTiles: Number.isFinite(Number(params.fadeDistance)) ? Number(params.fadeDistance) : 2,
        },
      },
      unsupportedReason: null,
    };
  }

  if (soundType === "trigger") {
    return {
      entity: {
        id: "trigger_sound",
        ...base,
        params: {
          ...base.params,
          triggerX: (Number.isFinite(sound?.x) ? Number(sound.x) : 0) * tileSize + (tileSize * 0.5),
          once: typeof params.loop === "boolean" ? !params.loop : true,
        },
      },
      unsupportedReason: null,
    };
  }

  if (soundType === "musicZone") {
    const widthTiles = Number.isFinite(Number(params.width)) ? Number(params.width) : 8;
    return {
      entity: {
        id: "music_zone",
        ...base,
        params: {
          ...base.params,
          xStart: ((Number.isFinite(sound?.x) ? Number(sound.x) : 0) * tileSize),
          xEnd: ((Number.isFinite(sound?.x) ? Number(sound.x) : 0) + Math.max(1, widthTiles)) * tileSize,
          fadeTiles: Number.isFinite(Number(params.fadeDistance)) ? Number(params.fadeDistance) : 2,
        },
      },
      unsupportedReason: null,
    };
  }

  return {
    entity: null,
    unsupportedReason: `sound type '${String(sound?.type || "unknown")}' is not yet bridged to runtime`,
  };
}

export function v2ToRuntimeLevelObject(levelDocument, options = {}) {
  const warnings = [];
  const unsupported = [];

  if (!levelDocument || typeof levelDocument !== "object") {
    throw new Error("v2ToRuntimeLevelObject requires a valid LevelDocument");
  }

  const width = Number(levelDocument?.dimensions?.width) || 0;
  const height = Number(levelDocument?.dimensions?.height) || 0;
  const tileSize = Number(levelDocument?.dimensions?.tileSize) || 24;
  const expectedTileCount = width * height;
  const mainTiles = Array.isArray(levelDocument?.tiles?.base) ? levelDocument.tiles.base.slice(0, expectedTileCount) : [];

  if (mainTiles.length !== expectedTileCount) {
    warnings.push(`Tile grid length mismatch: expected ${expectedTileCount}, received ${mainTiles.length}.`);
  }

  const runtimeLevel = {
    meta: {
      id: String(levelDocument?.meta?.id || ""),
      name: String(levelDocument?.meta?.name || "Untitled Level"),
      tileSize,
      w: width,
      h: height,
      ...(options?.metaOverrides && typeof options.metaOverrides === "object" ? { ...options.metaOverrides } : {}),
    },
    layers: {
      main: mainTiles,
      ents: [],
    },
    editor: {
      bg: Array.isArray(levelDocument?.background?.base)
        ? levelDocument.background.base.slice(0, expectedTileCount)
        : new Array(expectedTileCount).fill(null),
    },
  };

  const entities = Array.isArray(levelDocument.entities) ? levelDocument.entities : [];
  for (const entity of entities) {
    const runtimeId = normalizeRuntimeEntityType(entity?.type);
    const entityType = String(entity?.type || "").trim();

    if (!runtimeId) continue;

    if (UNSUPPORTED_VOLUME_TYPES.has(runtimeId)) {
      unsupported.push(`Entity '${entityType}' is authored but runtime bridge v1 does not support this volume yet.`);
      continue;
    }

    if (!SUPPORTED_RUNTIME_ENTITY_IDS.has(runtimeId)) {
      unsupported.push(`Entity '${entityType}' is not mapped because runtime loader does not support it on the editor-play bridge path.`);
      continue;
    }

    runtimeLevel.layers.ents.push({
      id: runtimeId,
      x: Number.isFinite(entity?.x) ? (entity.x | 0) : 0,
      y: Number.isFinite(entity?.y) ? (entity.y | 0) : 0,
      params: cloneParams(entity?.params),
    });
  }

  const sounds = Array.isArray(levelDocument.sounds) ? levelDocument.sounds : [];
  for (const sound of sounds) {
    const { entity, unsupportedReason } = mapSoundToRuntimeEntity(sound, tileSize);
    if (entity) {
      runtimeLevel.layers.ents.push(entity);
    } else if (unsupportedReason) {
      unsupported.push(`Sound '${String(sound?.name || sound?.id || "unknown")}' omitted: ${unsupportedReason}.`);
    }
  }

  const backgroundLayers = Array.isArray(levelDocument?.backgrounds?.layers) ? levelDocument.backgrounds.layers : [];
  const hasUnsupportedBackgroundLayers = backgroundLayers.length > 1
    || backgroundLayers.some((layer) => String(layer?.type || "color") !== "color");
  if (hasUnsupportedBackgroundLayers) {
    unsupported.push("Background theme/parallax layers are not bridged into runtime in v1; only background.base is mapped to editor.bg.");
  }

  return {
    runtimeLevel,
    warnings,
    unsupported,
  };
}
