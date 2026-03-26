const ENTITY_LIKE_EDITABLE_TYPES = new Set([
  "firefly_01",
  "lantern_01",
  "dark_creature_01",
  "hover_void_01",
  "fog_volume",
]);

const SPECIAL_VOLUME_TYPES = new Set(["fog_volume"]);

const EDITABLE_TYPE_ALIASES = new Map([
  ["lantern", "lantern_01"],
  ["spawn", "player-spawn"],
  ["player_spawn", "player-spawn"],
  ["player spawn", "player-spawn"],
  ["exit", "player-exit"],
  ["player_exit", "player-exit"],
  ["player exit", "player-exit"],
]);

export function normalizeEditableObjectType(type) {
  const normalizedType = String(type || "").trim().toLowerCase();
  return EDITABLE_TYPE_ALIASES.get(normalizedType) || normalizedType;
}

export function isEntityLikeEditableType(type) {
  return ENTITY_LIKE_EDITABLE_TYPES.has(normalizeEditableObjectType(type));
}

export function isDeferredSpecialVolumeType(type) {
  return false;
}

export function isSpecialVolumeEditableType(type) {
  return SPECIAL_VOLUME_TYPES.has(normalizeEditableObjectType(type));
}

export function isDecorEditableType(type) {
  const normalizedType = normalizeEditableObjectType(type);
  return Boolean(normalizedType)
    && !ENTITY_LIKE_EDITABLE_TYPES.has(normalizedType)
    && !SPECIAL_VOLUME_TYPES.has(normalizedType);
}
