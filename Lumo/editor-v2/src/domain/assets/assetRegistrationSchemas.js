export const ASSET_REGISTRATION_SCHEMAS = [
  {
    id: "tiles",
    label: "Tiles",
    summary: "Grid tile assets mapped to numeric tileId values for paint and runtime collision.",
    requiredFields: [
      { key: "id", label: "Catalog id", type: "string", required: true },
      { key: "name", label: "Display name", type: "string", required: true },
      { key: "tileId", label: "Tile numeric id", type: "integer", required: true },
      { key: "img", label: "Sprite path", type: "asset-path", required: true },
      { key: "collisionType", label: "Collision type", type: "enum", required: false },
      { key: "drawAnchor", label: "Draw anchor", type: "enum", required: false },
      { key: "drawW", label: "Draw width px", type: "integer", required: false },
      { key: "drawH", label: "Draw height px", type: "integer", required: false },
      { key: "footprint", label: "Footprint cells", type: "object", required: false },
      { key: "supportedSizes", label: "Brush size support", type: "integer[]", required: false },
    ],
    notes: [
      "Runtime solidity/hazard semantics are still coupled through data/tileset.js by tileId.",
      "Editor visual draw metadata comes primarily from data/catalog_tiles.js.",
    ],
  },
  {
    id: "decor",
    label: "Decor",
    summary: "Editor placeable decor presets normalized from catalog entities and local fallback presets.",
    requiredFields: [
      { key: "id", label: "Preset id", type: "string", required: true },
      { key: "type", label: "Decor type", type: "string", required: true },
      { key: "defaultName", label: "Display name", type: "string", required: true },
      { key: "img", label: "Sprite path", type: "asset-path", required: true },
      { key: "drawAnchor", label: "Draw anchor", type: "enum", required: true },
      { key: "drawW", label: "Draw width px", type: "integer", required: true },
      { key: "drawH", label: "Draw height px", type: "integer", required: true },
      { key: "footprint", label: "Footprint cells", type: "object", required: true },
      { key: "variants", label: "Variants", type: "string[]", required: false },
    ],
    notes: [
      "Decor currently piggybacks on window.LUMO_CATALOG_ENTITIES entries with category=decor and multiple deny filters.",
      "Certain ids and hints are intentionally excluded to avoid entity/special-volume overlap.",
    ],
  },
  {
    id: "background",
    label: "Background",
    summary: "Background paint materials used by editor-v2 paint layer and serialized level docs.",
    requiredFields: [
      { key: "id", label: "Material id", type: "string", required: true },
      { key: "label", label: "Material label", type: "string", required: true },
      { key: "img", label: "Sprite path", type: "asset-path", required: true },
      { key: "drawW", label: "Draw width px", type: "integer", required: true },
      { key: "drawH", label: "Draw height px", type: "integer", required: true },
      { key: "fallbackColor", label: "Fallback color", type: "color", required: true },
      { key: "footprint", label: "Footprint cells", type: "object", required: true },
    ],
    notes: [
      "Current default catalog is local to editor-v2 (builtin constants).",
      "Authored materials are stored in the level document under background.materials.",
    ],
  },
  {
    id: "entities",
    label: "Entities",
    summary: "Entity presets are explicit code-defined templates with runtime behavior coupling by type and params.",
    requiredFields: [
      { key: "id", label: "Preset id", type: "string", required: true },
      { key: "type", label: "Entity type", type: "string", required: true },
      { key: "defaultName", label: "Display name", type: "string", required: true },
      { key: "defaultParams", label: "Default params", type: "object", required: true },
      { key: "img", label: "Sprite path", type: "asset-path|null", required: false },
      { key: "drawAnchor", label: "Draw anchor", type: "enum", required: true },
      { key: "drawW", label: "Draw width px", type: "integer", required: true },
      { key: "drawH", label: "Draw height px", type: "integer", required: true },
      { key: "hitRadius", label: "Hit radius", type: "number", required: false },
    ],
    notes: [
      "Special volume entities (fog/water/lava/bubbling) include nested required param shapes.",
      "Spawn/exit rules and runtime conversion impose additional type constraints beyond visual metadata.",
    ],
  },
  {
    id: "sound",
    label: "Sound (optional in this pass)",
    summary: "Sound presets for editor placement and scanning previews.",
    requiredFields: [
      { key: "id", label: "Preset id", type: "string", required: true },
      { key: "type", label: "Sound type", type: "string", required: true },
      { key: "defaultName", label: "Display name", type: "string", required: true },
      { key: "defaultParams", label: "Default params", type: "object", required: true },
    ],
    notes: [
      "Sound is included as audit context but registration workflow is deferred.",
    ],
  },
];

const SCHEMA_BY_ID = new Map(ASSET_REGISTRATION_SCHEMAS.map((schema) => [schema.id, schema]));

export function getAssetRegistrationSchema(categoryId) {
  if (typeof categoryId !== "string") return null;
  return SCHEMA_BY_ID.get(categoryId) || null;
}
