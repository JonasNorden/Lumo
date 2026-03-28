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
  "water_volume",
  "lava_volume",
  "bubbling_liquid_volume",
]);
const FALLBACK_RUNTIME_CATALOG_DECOR_IDS = new Set([
  "decor_flower_01",
]);

const RUNTIME_BG_FALLBACK_ID = "bg_rock_01";
const RUNTIME_BG_CANONICAL_ID_BY_NORMALIZED = new Map([
  ["bg_void", "bg_void"],
  ["bg_rock_01", "bg_rock_01"],
  ["void_t", "Void_t"],
  ["void_tl", "Void_tl"],
  ["void_tr", "Void_tr"],
  ["void_c", "Void_c"],
  ["root", "root"],
  ["port", "port"],
  ["window_01", "window_01"],
  ["pillar_01", "pillar_01"],
  ["valv", "valv"],
  ["wall_5", "wall_5"],
  ["wall_02", "wall_02"],
]);

const V2_BACKGROUND_ID_TO_RUNTIME_ID = new Map([
  ["bg_stone_wall", "bg_rock_01"],
  ["bg_arch", "wall_02"],
  ["bg_pillar", "pillar_01"],
]);

const RUNTIME_BG_IMAGE_BASENAME_TO_ID = new Map([
  ["bg_void.png", "bg_void"],
  ["bg_rock_01.png", "bg_rock_01"],
  ["void_t.png", "void_t"],
  ["void_tl.png", "void_tl"],
  ["void_tr.png", "void_tr"],
  ["void_c.png", "void_c"],
  ["root.png", "root"],
  ["port.png", "port"],
  ["window_01.png", "window_01"],
  ["pillar_01.png", "pillar_01"],
  ["valv.png", "valv"],
  ["wall_05.png", "wall_5"],
  ["wall_5.png", "wall_5"],
  ["wall_02.png", "wall_02"],
]);

function cloneParams(params) {
  if (!params || typeof params !== "object") return {};
  return structuredClone(params);
}

function buildRuntimeTileVisualOverrides(levelDocument, tileSize) {
  const overrides = {};
  const placements = Array.isArray(levelDocument?.tiles?.placements) ? levelDocument.tiles.placements : [];
  for (const placement of placements) {
    const value = Number.isFinite(Number(placement?.value)) ? (Number(placement.value) | 0) : 0;
    const size = Number.isFinite(Number(placement?.size)) ? (Number(placement.size) | 0) : 1;
    const x = Number.isFinite(Number(placement?.x)) ? (Number(placement.x) | 0) : null;
    const y = Number.isFinite(Number(placement?.y)) ? (Number(placement.y) | 0) : null;
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    if (size <= 0) continue;

    // Runtime parity fix: stone_ct supports 1x1/2x2/3x3 authoring in editor-v2,
    // but runtime catalog metadata is fixed to a legacy 2x2 draw profile.
    // Inject per-anchor draw overrides so runtime uses authored brush size.
    if (value === 15) {
      const clampedSize = Math.max(1, Math.min(3, size));
      overrides[`${x},${y}`] = {
        drawW: clampedSize * tileSize,
        drawH: clampedSize * tileSize,
        drawAnchor: "BL",
      };
    }
  }
  return overrides;
}

function normalizeRuntimeEntityType(type) {
  const normalized = String(type || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "player-spawn") return "start_01";
  if (normalized === "player-exit") return "exit_01";
  if (normalized === "checkpoint") return "checkpoint_01";
  return normalized;
}

function getRuntimeCatalogDecorIdSet() {
  const entries = globalThis?.window?.LUMO_CATALOG_ENTITIES;
  if (!Array.isArray(entries)) return FALLBACK_RUNTIME_CATALOG_DECOR_IDS;
  const ids = new Set();
  for (const entry of entries) {
    const id = String(entry?.id || "").trim().toLowerCase();
    const category = String(entry?.category || "").trim().toLowerCase();
    if (!id || category !== "decor") continue;
    ids.add(id);
  }
  return ids.size ? ids : FALLBACK_RUNTIME_CATALOG_DECOR_IDS;
}

function getBasename(input) {
  const value = String(input || "").trim().toLowerCase();
  if (!value) return "";
  const normalized = value.replace(/\\/g, "/");
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
}

function createBackgroundRuntimeMaterialResolver(levelDocument) {
  const authoredMaterials = Array.isArray(levelDocument?.background?.materials)
    ? levelDocument.background.materials
    : [];

  const runtimeIdByMaterialId = new Map();
  for (const material of authoredMaterials) {
    const materialId = String(material?.id || "").trim();
    if (!materialId) continue;
    const normalizedMaterialId = materialId.toLowerCase();

    if (RUNTIME_BG_CANONICAL_ID_BY_NORMALIZED.has(normalizedMaterialId)) {
      runtimeIdByMaterialId.set(materialId, RUNTIME_BG_CANONICAL_ID_BY_NORMALIZED.get(normalizedMaterialId));
      continue;
    }

    const mappedKnownId = V2_BACKGROUND_ID_TO_RUNTIME_ID.get(normalizedMaterialId);
    if (mappedKnownId) {
      runtimeIdByMaterialId.set(materialId, mappedKnownId);
      continue;
    }

    const basename = getBasename(material?.img);
    const mappedByImage = RUNTIME_BG_IMAGE_BASENAME_TO_ID.get(basename);
    if (mappedByImage) {
      runtimeIdByMaterialId.set(materialId, mappedByImage);
    }
  }

  return (materialId) => {
    const normalized = String(materialId || "").trim();
    if (!normalized) return null;

    const directNormalized = normalized.toLowerCase();
    if (RUNTIME_BG_CANONICAL_ID_BY_NORMALIZED.has(directNormalized)) {
      return RUNTIME_BG_CANONICAL_ID_BY_NORMALIZED.get(directNormalized);
    }

    const knownV2Id = V2_BACKGROUND_ID_TO_RUNTIME_ID.get(directNormalized);
    if (knownV2Id) return knownV2Id;

    if (runtimeIdByMaterialId.has(normalized)) return runtimeIdByMaterialId.get(normalized);

    const byBaseName = RUNTIME_BG_IMAGE_BASENAME_TO_ID.get(getBasename(normalized));
    if (byBaseName) return byBaseName;

    return RUNTIME_BG_FALLBACK_ID;
  };
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

  const runtimeCatalogDecorIds = getRuntimeCatalogDecorIdSet();
  const isRuntimeSupportedId = (runtimeId) => {
    const normalizedId = String(runtimeId || "").trim().toLowerCase();
    if (!normalizedId) return false;
    if (SUPPORTED_RUNTIME_ENTITY_IDS.has(normalizedId)) return true;
    return runtimeCatalogDecorIds.has(normalizedId);
  };

  if (!levelDocument || typeof levelDocument !== "object") {
    throw new Error("v2ToRuntimeLevelObject requires a valid LevelDocument");
  }

  const width = Number(levelDocument?.dimensions?.width) || 0;
  const height = Number(levelDocument?.dimensions?.height) || 0;
  const tileSize = Number(levelDocument?.dimensions?.tileSize) || 24;
  const expectedTileCount = width * height;
  const mainTiles = Array.isArray(levelDocument?.tiles?.base) ? levelDocument.tiles.base.slice(0, expectedTileCount) : [];
  const resolveRuntimeBackgroundMaterial = createBackgroundRuntimeMaterialResolver(levelDocument);
  const authoredBackgroundBase = Array.isArray(levelDocument?.background?.base)
    ? levelDocument.background.base.slice(0, expectedTileCount)
    : [];
  let unknownBackgroundMaterialCount = 0;
  const runtimeBackgroundBase = authoredBackgroundBase.map((materialId) => {
    if (typeof materialId !== "string" || !materialId.trim()) return null;
    const resolved = resolveRuntimeBackgroundMaterial(materialId);
    if (resolved === RUNTIME_BG_FALLBACK_ID && String(materialId || "").trim().toLowerCase() !== RUNTIME_BG_FALLBACK_ID) {
      unknownBackgroundMaterialCount += 1;
    }
    return resolved;
  });
  while (runtimeBackgroundBase.length < expectedTileCount) runtimeBackgroundBase.push(null);

  if (mainTiles.length !== expectedTileCount) {
    warnings.push(`Tile grid length mismatch: expected ${expectedTileCount}, received ${mainTiles.length}.`);
  }
  if (unknownBackgroundMaterialCount > 0) {
    warnings.push(`Background paint remapped ${unknownBackgroundMaterialCount} cell(s) to '${RUNTIME_BG_FALLBACK_ID}' for runtime compatibility.`);
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
      bg: runtimeBackgroundBase,
      tileVisualOverrides: buildRuntimeTileVisualOverrides(levelDocument, tileSize),
      ents: [],
    },
    editor: {
      bg: runtimeBackgroundBase.slice(0),
    },
  };

  const entities = Array.isArray(levelDocument.entities) ? levelDocument.entities : [];
  for (const entity of entities) {
    const runtimeId = normalizeRuntimeEntityType(entity?.type);
    const authoredEntityId = String(entity?.id || "").trim();
    const entityType = String(entity?.type || "").trim();

    if (!runtimeId) {
      unsupported.push(`Entity '${authoredEntityId || "(missing-id)"}' omitted: missing/invalid type '${entityType || "(missing-type)"}'.`);
      continue;
    }

    if (!isRuntimeSupportedId(runtimeId)) {
      unsupported.push(`Entity '${authoredEntityId || "(missing-id)"}' (${entityType || runtimeId}) is not mapped because runtime loader does not support it on the editor-play bridge path.`);
      continue;
    }

    runtimeLevel.layers.ents.push({
      id: runtimeId,
      x: Number.isFinite(entity?.x) ? (entity.x | 0) : 0,
      y: Number.isFinite(entity?.y) ? (entity.y | 0) : 0,
      params: cloneParams(entity?.params),
    });
  }

  const decorItems = Array.isArray(levelDocument.decor) ? levelDocument.decor : [];
  for (const decor of decorItems) {
    const decorId = String(decor?.id || "").trim();
    const decorType = String(decor?.type || "").trim();
    const runtimeId = normalizeRuntimeEntityType(decorType);
    const visible = decor?.visible !== false;

    if (!visible) continue;
    if (!runtimeId) {
      unsupported.push(`Decor '${decorId || "(missing-id)"}' omitted: missing/invalid type '${decorType || "(missing-type)"}'.`);
      continue;
    }
    if (!isRuntimeSupportedId(runtimeId)) {
      unsupported.push(`Decor '${decorId || "(missing-id)"}' (${decorType || runtimeId}) is not mapped because runtime loader does not support it on the editor-play bridge path.`);
      continue;
    }

    runtimeLevel.layers.ents.push({
      id: runtimeId,
      x: Number.isFinite(decor?.x) ? (decor.x | 0) : 0,
      y: Number.isFinite(decor?.y) ? (decor.y | 0) : 0,
      params: {
        ...cloneParams(decor?.params),
        ...(typeof decor?.variant === "string" && decor.variant.trim()
          ? { variant: decor.variant.trim() }
          : {}),
      },
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
