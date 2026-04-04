const FALLBACK_AUDIO_ASSET_PATHS = [
  "data/assets/audio/music/game_play_1.ogg",
  "data/assets/audio/music/game_play_2.ogg",
  "data/assets/audio/music/game_play_3.ogg",
  "data/assets/audio/music/menu_music.ogg",
  "data/assets/audio/music/space_loop_short.wav",
  "data/assets/audio/spot/drip/one_drip.wav",
  "data/assets/audio/spot/drip/waterdrip.ogg",
  "data/assets/audio/spot/machinery/door_close.wav",
  "data/assets/audio/spot/wind/blowing.wav",
  "data/assets/audio/spot/wind/wind.wav",
  "data/assets/audio/events/creatures/alien_presence.ogg",
  "data/assets/audio/events/creatures/scream_of_void.mp3",
  "data/assets/audio/events/creatures/void_creature.mp3",
  "data/assets/audio/ambient/forest/jungle.ogg",
  "data/assets/audio/ambient/rain/rain.wav",
  "data/assets/audio/ambient/ruin/dark-ambient-horror.ogg",
  "data/assets/audio/ambient/space/empty_space_void.mp3",
  "data/assets/audio/ambient/space/synthetic_space.ogg",
  "data/assets/audio/ambient/void/creepy_bass.ogg",
  "data/assets/audio/ambient/void/dark_ambient.ogg",
  "data/assets/audio/ambient/void/nominal.wav",
  "data/assets/audio/ambient/void/nominal_monolith.wav",
  "data/assets/audio/ambient/void/void_pressure_01.ogg",
  "data/assets/audio/ambient/void/void_pressure_02.wav",
  "data/assets/audio/ambient/void/void_pressure_03.ogg",
  "data/assets/audio/ambient/void/void_rumble.ogg",
  "data/assets/audio/sfx/hit/slap_01.wav",
  "data/assets/audio/sfx/hurt/hurt_01.wav",
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

    uniquePaths.set(normalizedPath, {
      value: normalizedPath,
      label: formatAssetLabel(normalizedPath),
      hint: formatAssetHint(normalizedPath),
      category: detectAssetCategory(normalizedPath),
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
  const catalog = getSoundAssetCatalog();
  const categoryOrder = SOUND_TYPE_CATEGORY_ORDER[soundType] || SOUND_TYPE_CATEGORY_ORDER.spot;
  const categoryWeight = new Map(categoryOrder.map((category, index) => [category, index]));

  return [...catalog].sort((left, right) => {
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
