import { getBackgroundMaterialById } from "../background/materialCatalog.js";

const THEME_CATALOG = [
  {
    id: "ruins",
    label: "Ruins",
    description: "These Walls Keep a Dark Secret — abandoned structures filled with history.",
    defaultBackgroundLayerColor: "#1a1f2b",
    defaultBackgroundMaterialId: "stone_block_ct",
    editorProfile: {
      tile: {
        preferredCatalogIds: ["stone_ct", "grass_bt", "grass_bl", "grass_br"],
        preferredGroups: ["tiles", "core"],
        keywordHints: ["stone", "ruin", "moss", "grass"],
      },
      background: {
        preferredMaterialIds: ["stone_block_ct", "bg_stone_wall_cc"],
        keywordHints: ["stone", "wall", "ruin"],
      },
      audio: {
        preferredAmbientAssetPaths: [
          "data/assets/audio/ambient/ruin/ambient_girlhumming.ogg",
          "data/assets/audio/ambient/ruin/dark-ambient-horror.ogg",
        ],
        preferredCategories: ["ambient", "spot"],
        preferredPathKeywords: ["ambient/ruin", "hum", "drip"],
        preferredHintKeywords: ["ruin", "ambient"],
        defaultAmbientAssetPath: "data/assets/audio/ambient/ruin/ambient_girlhumming.ogg",
      },
    },
  },
  {
    id: "cave",
    label: "Cave",
    description: "Pressure of the Void — darkness, depth, and survival through light.",
    defaultBackgroundLayerColor: "#141821",
    defaultBackgroundMaterialId: "bg_stone_wall_cc",
    editorProfile: {
      tile: {
        preferredCatalogIds: ["stone_ct", "ice_01", "ice_00"],
        preferredGroups: ["tiles", "core"],
        preferredBehaviorProfileIds: ["tile.solid.ice"],
        keywordHints: ["stone", "cave", "ice", "rock"],
      },
      background: {
        preferredMaterialIds: ["bg_stone_wall_cc", "stone_block_ct"],
        keywordHints: ["stone", "wall", "cave"],
      },
      audio: {
        preferredAmbientAssetPaths: [
          "data/assets/audio/spot/drip/waterdrip.ogg",
          "data/assets/audio/spot/drip/one_drip.wav",
        ],
        preferredCategories: ["ambient", "spot"],
        preferredPathKeywords: ["drip", "cave", "ambient"],
        preferredHintKeywords: ["drip", "water"],
        defaultAmbientAssetPath: "data/assets/audio/spot/drip/waterdrip.ogg",
      },
    },
  },
  {
    id: "forest",
    label: "Jungle",
    description: "Beauty is Just a Facade — lush, alive, and deceptively dangerous.",
    defaultBackgroundLayerColor: "#1b2d27",
    editorProfile: {
      tile: {
        preferredCatalogIds: ["grass_bt", "grass_bl", "grass_br", "soil_c"],
        preferredGroups: ["tiles", "core"],
        keywordHints: ["forest", "grass", "soil", "moss"],
      },
      background: {
        preferredMaterialIds: ["stone_block_ct"],
        keywordHints: ["stone", "block", "natural"],
      },
      audio: {
        preferredAmbientAssetPaths: ["data/assets/audio/ambient/forest/jungle.ogg"],
        preferredCategories: ["ambient", "spot"],
        preferredPathKeywords: ["forest", "jungle", "wind", "rain"],
        preferredHintKeywords: ["forest", "jungle", "wind"],
        defaultAmbientAssetPath: "data/assets/audio/ambient/forest/jungle.ogg",
      },
    },
  },
  {
    id: "futuristic",
    label: "Sci-Fi",
    description: "The Abandoned Spaceship — broken systems, metal, and fading technology.",
    defaultBackgroundLayerColor: "#101a30",
    defaultBackgroundMaterialId: "bg_stone_block_c_vinjett",
    editorProfile: {
      tile: {
        preferredCatalogIds: ["stone_ct", "ice_01"],
        preferredGroups: ["tiles", "core"],
        preferredBehaviorProfileIds: ["tile.solid.default", "tile.solid.ice"],
        keywordHints: ["futur", "synthetic", "clean", "ice"],
      },
      background: {
        preferredMaterialIds: ["bg_stone_block_c_vinjett", "stone_block_ct"],
        keywordHints: ["vinjett", "block", "synthetic"],
      },
      audio: {
        preferredAmbientAssetPaths: [
          "data/assets/audio/ambient/futuristic/ambient_hum_01.ogg",
          "data/assets/audio/ambient/futuristic/ambient_hum_02.ogg",
          "data/assets/audio/ambient/futuristic/ambient_hum_03.ogg",
        ],
        preferredCategories: ["ambient", "music"],
        preferredPathKeywords: ["futuristic", "hum", "space"],
        preferredHintKeywords: ["futuristic", "hum"],
        defaultAmbientAssetPath: "data/assets/audio/ambient/futuristic/ambient_hum_01.ogg",
      },
    },
  },
  {
    id: "void",
    label: "Touch the Void",
    description: "Even the Air Feels Heavy — psychological tension and unseen presence.",
    defaultBackgroundLayerColor: "#080a12",
    editorProfile: {
      tile: {
        preferredCatalogIds: ["void_1", "stone_ct"],
        preferredGroups: ["core", "tiles"],
        keywordHints: ["void", "dark", "stone"],
      },
      background: {
        preferredMaterialIds: ["bg_stone_block_c_vinjett", "bg_stone_wall_cc"],
        keywordHints: ["void", "dark", "vinjett"],
      },
      audio: {
        preferredAmbientAssetPaths: [
          "data/assets/audio/ambient/void/void_pressure_01.ogg",
          "data/assets/audio/ambient/void/dark_ambient.ogg",
          "data/assets/audio/ambient/space/empty_space_void.ogg",
        ],
        preferredCategories: ["ambient", "music"],
        preferredPathKeywords: ["void", "space", "dark", "pressure"],
        preferredHintKeywords: ["void", "space", "ambient"],
        defaultAmbientAssetPath: "data/assets/audio/ambient/void/void_pressure_01.ogg",
      },
    },
  },
];

const themeCatalogById = new Map(THEME_CATALOG.map((theme) => [theme.id, Object.freeze({ ...theme })]));

export const DEFAULT_THEME_ID = "ruins";

export function getThemeCatalog() {
  return THEME_CATALOG.map((theme) => themeCatalogById.get(theme.id));
}

export function getThemeById(themeId) {
  const normalizedThemeId = normalizeThemeId(themeId);
  return themeCatalogById.get(normalizedThemeId) || themeCatalogById.get(DEFAULT_THEME_ID);
}

export function normalizeThemeId(themeId) {
  const candidate = typeof themeId === "string" ? themeId.trim().toLowerCase() : "";
  return themeCatalogById.has(candidate) ? candidate : DEFAULT_THEME_ID;
}

export function resolveThemeBackgroundMaterialId(themeId) {
  const theme = getThemeById(themeId);
  const materialId = typeof theme?.defaultBackgroundMaterialId === "string" ? theme.defaultBackgroundMaterialId.trim() : "";
  if (!materialId) return null;
  return getBackgroundMaterialById(materialId) ? materialId : null;
}
