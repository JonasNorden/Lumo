import { getBackgroundMaterialById } from "../background/materialCatalog.js";

const THEME_CATALOG = [
  {
    id: "ruins",
    label: "Ruins",
    description: "Weathered stone and dusk tones for abandoned structures.",
    defaultBackgroundLayerColor: "#1a1f2b",
    defaultBackgroundMaterialId: "stone_block_ct",
  },
  {
    id: "cave",
    label: "Cave",
    description: "Low-light cavern mood with cool rock palettes.",
    defaultBackgroundLayerColor: "#141821",
    defaultBackgroundMaterialId: "bg_stone_wall_cc",
  },
  {
    id: "forest",
    label: "Forest",
    description: "Mossy, natural ambience with softened sky contrast.",
    defaultBackgroundLayerColor: "#1b2d27",
  },
  {
    id: "futuristic",
    label: "Futuristic",
    description: "Clean synthetic atmosphere with neon-adjacent contrast.",
    defaultBackgroundLayerColor: "#101a30",
    defaultBackgroundMaterialId: "bg_stone_block_c_vinjett",
  },
  {
    id: "void",
    label: "Void",
    description: "Minimal near-black backdrop for sparse compositions.",
    defaultBackgroundLayerColor: "#080a12",
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
