import { isSpecialVolumeEntityType, listSpecialVolumeTypes } from "../entities/specialVolumeTypes.js";

const ENTITY_LIKE_EDITABLE_TYPES = new Set([
  "player-spawn",
  "player-exit",
  "firefly_01",
  "lantern_01",
  "dark_creature_01",
  "hover_void_01",
]);

const EDITABLE_TYPE_ALIASES = new Map([
  ["movingplatform", "movingPlatform"],
  ["moving_platform", "movingPlatform"],
  ["moving platform", "movingPlatform"],
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
  return isSpecialVolumeEntityType(type);
}

export function isDecorEditableType(type) {
  const normalizedType = normalizeEditableObjectType(type);
  const specialVolumeTypes = listSpecialVolumeTypes();
  return Boolean(normalizedType)
    && !ENTITY_LIKE_EDITABLE_TYPES.has(normalizedType)
    && !specialVolumeTypes.includes(normalizedType);
}
