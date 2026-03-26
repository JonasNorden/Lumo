import { isDecorEditableType } from "../placeables/editableObjectBuckets.js";
import { findEntityPresetByType } from "../entities/entityPresets.js";
const TILE_SIZE = 24;
const DECOR_CATALOG_DENYLIST = new Set([
  "start_01",
  "spawn",
  "player-spawn",
  "exit_01",
  "exit",
  "player-exit",
  "checkpoint_01",
  "checkpoint",
  "lantern_01",
  "lantern",
  "trigger",
  "generic",
  "dark_creature_01",
  "hover_void_01",
]);

const DECOR_CATALOG_DENY_HINTS = [
  "spawn",
  "exit",
  "checkpoint",
  "lantern",
  "trigger",
  "generic",
  "dark creature",
];

const DECOR_PRESET_FALLBACKS = [
  {
    id: "grass",
    type: "grass",
    defaultName: "Grass Tuft",
    defaultVariant: "a",
    variants: ["a"],
    img: "../data/assets/sprites/decor/flower_01.png",
    drawW: 24,
    drawH: 40,
    drawAnchor: "BL",
    drawOffX: 0,
    drawOffY: 0,
    footprint: { w: 1, h: 2 },
  },
  {
    id: "bush",
    type: "bush",
    defaultName: "Bush",
    defaultVariant: "a",
    variants: ["a"],
    img: "../data/assets/sprites/decor/tree_1.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "BL",
    drawOffX: 0,
    drawOffY: 0,
    footprint: { w: 1, h: 1 },
  },
  {
    id: "rock",
    type: "rock",
    defaultName: "Rock",
    defaultVariant: "a",
    variants: ["a"],
    img: "../data/assets/sprites/decor/marble.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "BL",
    drawOffX: 0,
    drawOffY: 0,
    footprint: { w: 1, h: 1 },
  },
  {
    id: "sign",
    type: "sign",
    defaultName: "Sign",
    defaultVariant: "a",
    variants: ["a"],
    img: "../data/assets/sprites/decor/banner_01.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "BL",
    drawOffX: 0,
    drawOffY: 0,
    footprint: { w: 1, h: 1 },
  },
  {
    id: "decor_flower_01",
    type: "decor_flower_01",
    defaultName: "Flower",
    defaultVariant: "a",
    variants: ["a", "b", "c", "d"],
    img: "../data/assets/sprites/decor/flower_01.png",
    drawW: 24,
    drawH: 40,
    drawAnchor: "BL",
    drawOffX: 0,
    drawOffY: 0,
    footprint: { w: 1, h: 2 },
  },
  {
    id: "powercell_01",
    type: "powercell_01",
    defaultName: "Power-cell",
    defaultVariant: "a",
    variants: ["a"],
    img: "../data/assets/sprites/energy/powercell_01.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "BL",
    drawOffX: 0,
    drawOffY: 0,
    footprint: { w: 1, h: 1 },
  },
  {
    id: "apple",
    type: "apple",
    defaultName: "Apple",
    defaultVariant: "a",
    variants: ["a"],
    img: "../data/assets/sprites/decor/apple.png",
    drawW: 24,
    drawH: 48,
    drawAnchor: "BL",
    drawOffX: 0,
    drawOffY: 0,
    footprint: { w: 1, h: 2 },
  },
  {
    id: "boar",
    type: "boar",
    defaultName: "Boar",
    defaultVariant: "a",
    variants: ["a"],
    img: "../data/assets/sprites/decor/boar_01.png",
    drawW: 72,
    drawH: 96,
    drawAnchor: "TL",
    drawOffX: 0,
    drawOffY: 0,
    footprint: { w: 3, h: 4 },
  },
  {
    id: "banner",
    type: "banner",
    defaultName: "Banner",
    defaultVariant: "a",
    variants: ["a"],
    img: "../data/assets/sprites/decor/banner_01.png",
    drawW: 120,
    drawH: 288,
    drawAnchor: "TL",
    drawOffX: 0,
    drawOffY: 0,
    footprint: { w: 5, h: 12 },
  },
];

function resolveCatalogDecorType(entry = {}) {
  const explicitType = typeof entry?.type === "string" && entry.type.trim() ? entry.type.trim() : null;
  if (explicitType) return explicitType;
  return typeof entry?.id === "string" && entry.id.trim() ? entry.id.trim() : "";
}

function hasCatalogDecorDenyHint(entry = {}) {
  const hintSource = [
    entry?.id,
    entry?.type,
    entry?.name,
    entry?.group,
  ]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .toLowerCase();
  return DECOR_CATALOG_DENY_HINTS.some((hint) => hintSource.includes(hint));
}

function isCatalogDecorEntryAllowed(entry = {}) {
  if (String(entry?.category || "").trim().toLowerCase() !== "decor") return false;
  const resolvedType = resolveCatalogDecorType(entry);
  const normalizedType = String(resolvedType || "").trim().toLowerCase();
  if (!normalizedType || !isDecorEditableType(normalizedType)) return false;
  if (findEntityPresetByType(normalizedType)) return false;
  if (DECOR_CATALOG_DENYLIST.has(normalizedType)) return false;
  if (hasCatalogDecorDenyHint(entry)) return false;
  if (entry?.behaviorProfileId || entry?.visualProfileId || entry?.paramMode) return false;
  if (Array.isArray(entry?.shownParams) && entry.shownParams.length) return false;
  return true;
}

export function collectDecorCatalogPresets(catalogEntries = []) {
  if (!Array.isArray(catalogEntries)) return [];
  return catalogEntries
    .filter((entry) => isCatalogDecorEntryAllowed(entry))
    .map((entry) => ({
      ...entry,
      type: resolveCatalogDecorType(entry),
    }));
}

const DECOR_SCRIPT_CATALOG = typeof window !== "undefined" && Array.isArray(window.LUMO_CATALOG_ENTITIES)
  ? collectDecorCatalogPresets(window.LUMO_CATALOG_ENTITIES)
  : [];

function normalizeAnchor(anchor) {
  return String(anchor || "").trim().toUpperCase() === "TL" ? "TL" : "BL";
}

const DECOR_ANCHOR_OVERRIDE_BY_ID = new Map([
  ["apple", "BL"],
  ["boar", "TL"],
  ["banner", "TL"],
  ["painting_01", "TL"],
  ["painting_02", "TL"],
  ["painting_03", "TL"],
  ["painting_04", "TL"],
  ["painting_05", "TL"],
  ["painting_06", "TL"],
]);

const DECOR_ANCHOR_ATTACHED_HINTS = [
  "banner",
  "painting",
  "wall",
  "ceiling",
  "hanging",
  "hang",
  "mounted",
  "mount",
  "sign",
];

function resolveDecorAnchor(raw, normalized = {}) {
  const idKey = typeof normalized.id === "string" ? normalized.id.trim().toLowerCase() : "";
  const explicitOverride = DECOR_ANCHOR_OVERRIDE_BY_ID.get(idKey);
  if (explicitOverride) return explicitOverride;

  const explicitAnchor = raw?.drawAnchor ?? raw?.anchor;
  if (typeof explicitAnchor === "string" && explicitAnchor.trim()) {
    return normalizeAnchor(explicitAnchor);
  }

  const hintSource = [
    normalized.type,
    normalized.defaultName,
    raw?.name,
    raw?.group,
    raw?.img,
  ]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .toLowerCase();
  if (DECOR_ANCHOR_ATTACHED_HINTS.some((hint) => hintSource.includes(hint))) {
    return "TL";
  }

  return "BL";
}

function normalizePixels(value, fallback = TILE_SIZE) {
  return Number.isFinite(value) ? Math.max(1, Math.round(value)) : fallback;
}

function normalizeTiles(value) {
  if (!Number.isFinite(value)) return null;
  return Math.max(0.25, Math.round(value * 100) / 100);
}

function normalizeImagePath(path) {
  if (typeof path !== "string" || !path.trim()) return null;
  return `../${path.replace(/^\.?(\/)+/, "")}`;
}

function normalizeDecorPresetShape(raw, index = 0) {
  if (!raw) return null;

  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `decor_${index + 1}`;
  const type = typeof raw.type === "string" && raw.type.trim() ? raw.type.trim() : id;
  const defaultName = typeof raw.defaultName === "string" && raw.defaultName.trim()
    ? raw.defaultName.trim()
    : typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim()
      : `Decor ${index + 1}`;
  const drawW = normalizePixels(raw.drawW ?? raw.w, TILE_SIZE);
  const drawH = normalizePixels(raw.drawH ?? raw.h, TILE_SIZE);
  const footprintW = normalizePixels(raw.footprint?.w, Math.max(1, Math.ceil(drawW / TILE_SIZE)));
  const footprintH = normalizePixels(raw.footprint?.h, Math.max(1, Math.ceil(drawH / TILE_SIZE)));
  const anchor = resolveDecorAnchor(raw, { id, type, defaultName });

  return {
    id,
    type,
    defaultName,
    defaultVariant: typeof raw.defaultVariant === "string" && raw.defaultVariant.trim() ? raw.defaultVariant.trim() : "a",
    variants: Array.isArray(raw.variants) && raw.variants.length
      ? raw.variants.filter((variant) => typeof variant === "string" && variant.trim()).map((variant) => variant.trim())
      : ["a"],
    img: normalizeImagePath(raw.img),
    drawW,
    drawH,
    drawAnchor: anchor,
    drawOffX: Number.isFinite(raw.drawOffX ?? raw.offsetX) ? Math.round(raw.drawOffX ?? raw.offsetX) : 0,
    drawOffY: Number.isFinite(raw.drawOffY ?? raw.offsetY) ? Math.round(raw.drawOffY ?? raw.offsetY) : 0,
    footprint: { w: footprintW, h: footprintH },
    sizeTiles: {
      w: normalizeTiles(raw.sizeTiles?.w) ?? normalizeTiles(drawW / TILE_SIZE) ?? 1,
      h: normalizeTiles(raw.sizeTiles?.h) ?? normalizeTiles(drawH / TILE_SIZE) ?? 1,
    },
    group: typeof raw.group === "string" && raw.group.trim() ? raw.group.trim() : "Decor",
  };
}

const normalizedFallbackPresets = DECOR_PRESET_FALLBACKS
  .map((preset, index) => normalizeDecorPresetShape(preset, index))
  .filter(Boolean);
const normalizedCatalogPresets = DECOR_SCRIPT_CATALOG
  .map((preset, index) => normalizeDecorPresetShape(preset, index))
  .filter(Boolean);

const DECOR_PRESET_BY_ID = new Map(normalizedFallbackPresets.map((preset) => [preset.id, preset]));
for (const catalogPreset of normalizedCatalogPresets) {
  DECOR_PRESET_BY_ID.set(catalogPreset.id, {
    ...DECOR_PRESET_BY_ID.get(catalogPreset.id),
    ...catalogPreset,
  });
}

export const DECOR_PRESETS = [...DECOR_PRESET_BY_ID.values()];

export const DEFAULT_DECOR_PRESET_ID = DECOR_PRESET_BY_ID.has("decor_flower_01")
  ? "decor_flower_01"
  : DECOR_PRESETS[0]?.id || "decor_placeholder";

export function findDecorPresetById(presetId) {
  return DECOR_PRESET_BY_ID.get(presetId) || null;
}

export function findDecorPresetByType(type) {
  return DECOR_PRESETS.find((preset) => preset.type === type) || null;
}
