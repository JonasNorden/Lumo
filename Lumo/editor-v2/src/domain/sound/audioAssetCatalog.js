import { normalizeSoundType } from "./soundVisuals.js";

const FALLBACK_AUDIO_ASSET_PATHS = [
  "data/assets/audio/music/game_play_1.ogg",
  "data/assets/audio/music/game_play_2.ogg",
  "data/assets/audio/music/game_play_3.ogg",
  "data/assets/audio/music/menu_music.ogg",
  "data/assets/audio/music/menu_loop_01.ogg",
  "data/assets/audio/music/menu_loop_02.ogg",
  "data/assets/audio/music/space_loop_short.ogg",
  "data/assets/audio/spot/drip/one_drip.ogg",
  "data/assets/audio/spot/drip/waterdrip.ogg",
  "data/assets/audio/spot/hum/spot_hum_01.ogg",
  "data/assets/audio/spot/machinery/door_close.ogg",
  "data/assets/audio/spot/wind/blowing.ogg",
  "data/assets/audio/spot/wind/wind.ogg",
  "data/assets/audio/events/creatures/alien_presence.ogg",
  "data/assets/audio/events/creatures/firefly_01.ogg",
  "data/assets/audio/events/enemies/common/swoosh_01.ogg",
  "data/assets/audio/events/enemies/common/swoosh_02.ogg",
  "data/assets/audio/events/enemies/common/swoosh_03.ogg",
  "data/assets/audio/events/enemies/common/swoosh_04.ogg",
  "data/assets/audio/events/creatures/scream_of_void.ogg",
  "data/assets/audio/events/creatures/void_creature.ogg",
  "data/assets/audio/ambient/forest/jungle.ogg",
  "data/assets/audio/ambient/futuristic/ambient_hum_01.ogg",
  "data/assets/audio/ambient/futuristic/ambient_hum_02.ogg",
  "data/assets/audio/ambient/futuristic/ambient_hum_03.ogg",
  "data/assets/audio/ambient/futuristic/ambient_hum_04.ogg",
  "data/assets/audio/ambient/futuristic/ambient_hum_05.ogg",
  "data/assets/audio/ambient/futuristic/ambient_hum_06.ogg",
  "data/assets/audio/ambient/futuristic/ambient_hum_07.ogg",
  "data/assets/audio/ambient/futuristic/ambient_hum_08.ogg",
  "data/assets/audio/ambient/rain/rain.ogg",
  "data/assets/audio/ambient/ruin/ambient_girlhumming.ogg",
  "data/assets/audio/ambient/ruin/dark-ambient-horror.ogg",
  "data/assets/audio/ambient/space/empty_space_void.ogg",
  "data/assets/audio/ambient/space/synthetic_space.ogg",
  "data/assets/audio/ambient/void/creepy_bass.ogg",
  "data/assets/audio/ambient/void/dark_ambient.ogg",
  "data/assets/audio/ambient/void/nominal.ogg",
  "data/assets/audio/ambient/void/nominal_monolith.ogg",
  "data/assets/audio/ambient/void/void_pressure_01.ogg",
  "data/assets/audio/ambient/void/void_pressure_02.ogg",
  "data/assets/audio/ambient/void/void_pressure_03.ogg",
  "data/assets/audio/ambient/void/void_rumble.ogg",
  "data/assets/audio/sfx/hit/slap_01.ogg",
  "data/assets/audio/sfx/hurt/hurt_01.ogg",
];

const CATEGORY_LABELS = {
  music: "Music",
  ambient: "Ambient",
  spot: "Spot",
  events: "Events",
  sfx: "SFX",
  other: "Other",
};

const SOUND_TYPE_CATEGORY_ORDER = {
  spot: ["spot", "ambient", "events", "sfx", "music", "other"],
  trigger: ["events", "spot", "sfx", "ambient", "music", "other"],
  ambientZone: ["ambient", "spot", "events", "sfx", "music", "other"],
  musicZone: ["music", "ambient", "spot", "events", "sfx", "other"],
};

const SOUND_TYPE_USAGE_KEYS = ["musicZone", "ambientZone", "spot", "trigger"];

const CATEGORY_DEFAULT_ALLOWED_USAGES = {
  music: ["musicZone"],
  ambient: ["ambientZone"],
  spot: ["spot"],
  events: ["trigger"],
  sfx: ["trigger"],
  other: [],
};

const PATH_ALLOWED_USAGE_OVERRIDES = {
  "data/assets/audio/music/space_loop_short.ogg": ["musicZone", "ambientZone"],
  "data/assets/audio/music/menu_loop_01.ogg": ["musicZone"],
  "data/assets/audio/music/menu_loop_02.ogg": ["musicZone"],
  "data/assets/audio/ambient/futuristic/ambient_hum_01.ogg": ["ambientZone"],
  "data/assets/audio/ambient/futuristic/ambient_hum_02.ogg": ["ambientZone"],
  "data/assets/audio/ambient/futuristic/ambient_hum_03.ogg": ["ambientZone"],
  "data/assets/audio/ambient/futuristic/ambient_hum_04.ogg": ["ambientZone"],
  "data/assets/audio/ambient/futuristic/ambient_hum_05.ogg": ["ambientZone"],
  "data/assets/audio/ambient/futuristic/ambient_hum_06.ogg": ["ambientZone"],
  "data/assets/audio/ambient/futuristic/ambient_hum_07.ogg": ["ambientZone"],
  "data/assets/audio/ambient/futuristic/ambient_hum_08.ogg": ["ambientZone"],
  "data/assets/audio/ambient/ruin/ambient_girlhumming.ogg": ["ambientZone"],
  "data/assets/audio/spot/hum/spot_hum_01.ogg": ["spot", "trigger"],
  "data/assets/audio/events/enemies/common/swoosh_01.ogg": ["trigger", "spot"],
  "data/assets/audio/events/enemies/common/swoosh_02.ogg": ["trigger", "spot"],
  "data/assets/audio/events/enemies/common/swoosh_03.ogg": ["trigger", "spot"],
  "data/assets/audio/events/enemies/common/swoosh_04.ogg": ["trigger", "spot"],
  "data/assets/audio/events/creatures/firefly_01.ogg": ["trigger"],
};

function normalizeAssetPath(path) {
  return typeof path === "string" ? path.trim().replace(/^\.\//, "") : "";
}

function detectAssetCategory(path) {
  if (path.includes("/music/")) return "music";
  if (path.includes("/ambient/")) return "ambient";
  if (path.includes("/spot/")) return "spot";
  if (path.includes("/events/")) return "events";
  if (path.includes("/sfx/")) return "sfx";
  return "other";
}

function normalizeAllowedUsages(allowedUsages, fallbackCategory) {
  if (!Array.isArray(allowedUsages)) {
    return [...(CATEGORY_DEFAULT_ALLOWED_USAGES[fallbackCategory] || [])];
  }

  const normalized = [];
  const seen = new Set();
  for (const usage of allowedUsages) {
    if (!SOUND_TYPE_USAGE_KEYS.includes(usage) || seen.has(usage)) continue;
    seen.add(usage);
    normalized.push(usage);
  }

  return normalized.length ? normalized : [...(CATEGORY_DEFAULT_ALLOWED_USAGES[fallbackCategory] || [])];
}

function getAllowedUsagesForPath(path, category) {
  const normalizedPath = normalizeAssetPath(path);
  const override = PATH_ALLOWED_USAGE_OVERRIDES[normalizedPath];
  return normalizeAllowedUsages(override, category);
}

function formatAssetLabel(path) {
  const filename = path.split("/").at(-1) || path;
  const stem = filename.replace(/\.[^/.]+$/, "");
  return stem
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatAssetHint(path) {
  const segments = path.split("/");
  const folderSegments = segments.slice(3, -1);
  if (!folderSegments.length) return CATEGORY_LABELS[detectAssetCategory(path)] || "Audio";
  return folderSegments
    .map((segment) => segment.replace(/[_-]+/g, " "))
    .join(" / ");
}

function collectManifestPaths() {
  const manifest = globalThis.window?.LUMO_AUDIO_MANIFEST;
  if (!manifest || typeof manifest !== "object") return [];

  return Object.values(manifest)
    .flatMap((entries) => (Array.isArray(entries) ? entries : []))
    .map(normalizeAssetPath)
    .filter(Boolean);
}

function buildCatalogEntries() {
  const uniquePaths = new Map();

  for (const path of [...collectManifestPaths(), ...FALLBACK_AUDIO_ASSET_PATHS]) {
    const normalizedPath = normalizeAssetPath(path);
    if (!normalizedPath || uniquePaths.has(normalizedPath)) continue;

    const category = detectAssetCategory(normalizedPath);
    uniquePaths.set(normalizedPath, {
      value: normalizedPath,
      label: formatAssetLabel(normalizedPath),
      hint: formatAssetHint(normalizedPath),
      category,
      allowedUsages: getAllowedUsagesForPath(normalizedPath, category),
    });
  }

  return [...uniquePaths.values()].sort((left, right) => {
    if (left.category !== right.category) return left.category.localeCompare(right.category);
    if (left.hint !== right.hint) return left.hint.localeCompare(right.hint);
    return left.label.localeCompare(right.label);
  });
}

const SOUND_ASSET_CATALOG = buildCatalogEntries();

export function getSoundAssetCatalog() {
  return SOUND_ASSET_CATALOG;
}

export function getSoundAssetOptionsForType(soundType) {
  const normalizedSoundType = normalizeSoundType(soundType);
  const categoryOrder = SOUND_TYPE_CATEGORY_ORDER[normalizedSoundType] || SOUND_TYPE_CATEGORY_ORDER.spot;
  const categoryWeight = new Map(categoryOrder.map((category, index) => [category, index]));

  const options = SOUND_TYPE_USAGE_KEYS.includes(normalizedSoundType)
    ? getSoundAssetCatalog().filter(
        (asset) => Array.isArray(asset.allowedUsages) && asset.allowedUsages.includes(normalizedSoundType),
      )
    : getSoundAssetCatalog();

  return [...options].sort((left, right) => {
    const leftWeight = categoryWeight.get(left.category) ?? categoryOrder.length;
    const rightWeight = categoryWeight.get(right.category) ?? categoryOrder.length;
    if (leftWeight !== rightWeight) return leftWeight - rightWeight;
    if (left.category !== right.category) return left.category.localeCompare(right.category);
    if (left.hint !== right.hint) return left.hint.localeCompare(right.hint);
    return left.label.localeCompare(right.label);
  });
}

export function getSoundAssetCategoryLabel(category) {
  return CATEGORY_LABELS[category] || CATEGORY_LABELS.other;
}

export function findSoundAssetByPath(path) {
  const normalizedPath = normalizeAssetPath(path);
  return getSoundAssetCatalog().find((entry) => entry.value === normalizedPath) || null;
}
