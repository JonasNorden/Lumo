import { BRUSH_SPRITE_OPTIONS } from "../tiles/tileSpriteCatalog.js";
import { DECOR_PRESETS } from "../decor/decorPresets.js";
import { BACKGROUND_MATERIAL_OPTIONS } from "../background/materialCatalog.js";
import { ENTITY_PRESETS } from "../entities/entityPresets.js";
import { SOUND_PRESETS } from "../sound/soundPresets.js";
import { ASSET_REGISTRATION_SCHEMAS, getAssetRegistrationSchema } from "./assetRegistrationSchemas.js";

function samplePresetIds(list, max = 3) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => item?.id || item?.value || item?.type || null)
    .filter((value) => typeof value === "string" && value.trim())
    .slice(0, max);
}

function resolveTileSamples() {
  return BRUSH_SPRITE_OPTIONS.slice(0, 4).map((option) => `${option.label} (${option.tileId})`);
}

export function createAssetAuditCatalog() {
  const categoryRows = [
    {
      id: "tiles",
      sourceFolders: [
        "Lumo/data/assets/tiles",
        "Lumo/data/assets/sprites/bg (void fallback)",
      ],
      registries: [
        "Lumo/data/catalog_tiles.js (window.LUMO_CATALOG_TILES)",
        "Lumo/data/tileset.js (runtime tile semantics by tileId)",
        "Lumo/editor-v2/src/domain/tiles/tileSpriteCatalog.js (editor normalization/overrides)",
      ],
      count: BRUSH_SPRITE_OPTIONS.length,
      samples: resolveTileSamples(),
      metadataReality: [
        "tileId + img are required for editor render and placement mapping.",
        "collisionType/special behavior is still runtime-coupled through tileId mapping.",
        "drawW/drawH/drawAnchor and footprint influence preview/render alignment.",
      ],
      couplingNotes: [
        "Runtime physics reads Lumo.Tileset definitions in data/tileset.js.",
      ],
      editorOnlyNotes: [
        "Brush size support and draw overrides are editor-v2-level normalization concerns.",
      ],
    },
    {
      id: "decor",
      sourceFolders: [
        "Lumo/data/assets/sprites/decor",
        "Lumo/data/assets/sprites/* (several decor sources)",
      ],
      registries: [
        "Lumo/data/catalog_entities.js (window.LUMO_CATALOG_ENTITIES, filtered category=decor)",
        "Lumo/editor-v2/src/domain/decor/decorPresets.js (denylist + normalized preset truth)",
      ],
      count: DECOR_PRESETS.length,
      samples: samplePresetIds(DECOR_PRESETS),
      metadataReality: [
        "type/id/defaultName/img are core preset identity fields.",
        "draw anchor, pixel size, and footprint define placement/render behavior.",
        "variants/defaultVariant support decor variation in editor workflow.",
      ],
      couplingNotes: [
        "Catalog overlap with entity-like ids is filtered to avoid runtime ambiguity.",
      ],
      editorOnlyNotes: [
        "Decor denylist and inferred anchor behavior are editor normalization rules.",
      ],
    },
    {
      id: "background",
      sourceFolders: ["Lumo/data/assets/sprites/bg", "Lumo/data/assets/tiles"],
      registries: [
        "Lumo/editor-v2/src/domain/background/materialCatalog.js (builtin material options)",
        "Level document background.materials (authored materials persisted per level)",
      ],
      count: BACKGROUND_MATERIAL_OPTIONS.length,
      samples: samplePresetIds(BACKGROUND_MATERIAL_OPTIONS),
      metadataReality: [
        "id/label/img and draw dimensions define paintable materials.",
        "fallbackColor is used when texture previews are unavailable.",
        "footprint controls tiled background stamp behavior.",
      ],
      couplingNotes: [
        "Background layer structure is serialized in level documents and consumed by runtime bridge.",
      ],
      editorOnlyNotes: [
        "Current base material catalog is editor-local and intentionally compact.",
      ],
    },
    {
      id: "entities",
      sourceFolders: [
        "Lumo/data/assets/sprites/lumo",
        "Lumo/data/assets/sprites/lights",
        "Lumo/data/assets/sprites/creatures",
        "Lumo/data/assets/sprites/pickups",
      ],
      registries: [
        "Lumo/editor-v2/src/domain/entities/entityPresets.js (ENTITY_PRESETS)",
        "Lumo/editor-v2/src/domain/entities/spawnExitRules.js (placement constraints)",
        "Lumo/editor-v2/src/runtime/v2ToRuntimeLevelObject.js (runtime conversion coupling)",
      ],
      count: ENTITY_PRESETS.length,
      samples: samplePresetIds(ENTITY_PRESETS),
      metadataReality: [
        "type + defaultParams are essential for runtime-compatible behavior.",
        "draw metrics and hitRadius impact editor interaction previews.",
        "special volume types need nested params (area/look/hazard/etc).",
      ],
      couplingNotes: [
        "Entity types are strongly runtime-coupled; unknown types risk runtime incompatibility.",
      ],
      editorOnlyNotes: [
        "Selection/preview affordances are editor concerns layered on top of runtime shape.",
      ],
    },
    {
      id: "sound",
      sourceFolders: ["Lumo/data/assets/audio", "Lumo/data/assets/sprites/sound"],
      registries: [
        "Lumo/editor-v2/src/domain/sound/soundPresets.js (SOUND_PRESETS)",
        "Lumo/data/audio_manifest.js (runtime source inventory)",
      ],
      count: SOUND_PRESETS.length,
      samples: samplePresetIds(SOUND_PRESETS),
      metadataReality: [
        "type/defaultParams define sound placement intent.",
        "source references are validated through sourceReference helpers and manifest data.",
      ],
      couplingNotes: [
        "Runtime/audio playback mapping is coupled via sound source references.",
      ],
      editorOnlyNotes: [
        "Sound is audit-only in this foundation pass.",
      ],
    },
  ];

  return categoryRows.map((row) => {
    const schema = getAssetRegistrationSchema(row.id);
    return {
      ...row,
      schema,
    };
  });
}

export const ASSET_MANAGER_CATEGORIES = createAssetAuditCatalog();

export function getAssetManagerCategory(categoryId) {
  return ASSET_MANAGER_CATEGORIES.find((category) => category.id === categoryId) || null;
}

export function getDefaultAssetManagerCategoryId() {
  return ASSET_MANAGER_CATEGORIES[0]?.id || ASSET_REGISTRATION_SCHEMAS[0]?.id || "tiles";
}
