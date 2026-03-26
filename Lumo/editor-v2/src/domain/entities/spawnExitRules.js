import { cloneEntityParams } from "./entityParams.js";
import { getEntityPresetParamsForType } from "./entityPresets.js";
import { normalizeEditableObjectType } from "../placeables/editableObjectBuckets.js";

export const SPAWN_ENTITY_TYPE = "player-spawn";
export const EXIT_ENTITY_TYPE = "player-exit";

export function isSpawnEntityType(type) {
  return normalizeEditableObjectType(type) === SPAWN_ENTITY_TYPE;
}

export function isExitEntityType(type) {
  return normalizeEditableObjectType(type) === EXIT_ENTITY_TYPE;
}

function getDefaultSpawnCell(doc) {
  const width = Math.max(1, Number(doc?.dimensions?.width) || 1);
  const height = Math.max(1, Number(doc?.dimensions?.height) || 1);
  return {
    x: Math.min(width - 1, 1),
    y: Math.max(0, height - 2),
  };
}

function getDefaultExitCell(doc) {
  const width = Math.max(1, Number(doc?.dimensions?.width) || 1);
  const height = Math.max(1, Number(doc?.dimensions?.height) || 1);
  return {
    x: Math.max(0, width - 2),
    y: Math.max(0, height - 2),
  };
}

function getUniqueEntityId(entities, baseId) {
  const usedIds = new Set((entities || []).map((entity) => entity?.id).filter(Boolean));
  let nextId = baseId;
  let suffix = 2;
  while (usedIds.has(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }
  return nextId;
}

function createSpecialEntity(doc, entities, type) {
  const cell = isSpawnEntityType(type) ? getDefaultSpawnCell(doc) : getDefaultExitCell(doc);
  const id = getUniqueEntityId(entities, isSpawnEntityType(type) ? "entity-spawn" : "entity-exit");

  return {
    id,
    name: isSpawnEntityType(type) ? "Player Spawn" : "Exit",
    type,
    x: cell.x,
    y: cell.y,
    visible: true,
    params: getEntityPresetParamsForType(type, {}),
  };
}

export function normalizeSpawnAndExitEntities(doc, entities) {
  const source = Array.isArray(entities) ? entities : [];
  const normalized = [];
  let spawn = null;
  const exits = [];

  for (const entity of source) {
    if (!entity) continue;
    if (isSpawnEntityType(entity.type)) {
      if (!spawn) {
        spawn = {
          ...entity,
          type: SPAWN_ENTITY_TYPE,
          params: cloneEntityParams(entity.params),
        };
      }
      continue;
    }

    if (isExitEntityType(entity.type)) {
      exits.push({
        ...entity,
        type: EXIT_ENTITY_TYPE,
        params: cloneEntityParams(entity.params),
      });
      continue;
    }

    normalized.push(entity);
  }

  const nextEntities = [...normalized];
  if (!spawn) {
    spawn = createSpecialEntity(doc, nextEntities, SPAWN_ENTITY_TYPE);
  }
  nextEntities.push(spawn);

  if (!exits.length) {
    exits.push(createSpecialEntity(doc, nextEntities, EXIT_ENTITY_TYPE));
  }
  nextEntities.push(...exits);

  return nextEntities;
}

export function canCreateEntityType(entities, type) {
  if (!isSpawnEntityType(type)) return true;
  return !entities.some((entity) => isSpawnEntityType(entity?.type));
}

export function canDeleteEntity(entities, entityId) {
  const entity = (entities || []).find((candidate) => candidate?.id === entityId) || null;
  if (!entity) return false;
  if (isSpawnEntityType(entity.type)) return false;
  if (!isExitEntityType(entity.type)) return true;

  const exitCount = (entities || []).filter((candidate) => isExitEntityType(candidate?.type)).length;
  return exitCount > 1;
}
