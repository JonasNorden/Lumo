const ENABLED_VALUES = new Set(["1", "true", "on", "yes", "clean-room", "cleanroom", "entity-only"]);

// Canonical entity runtime note:
// - This module now defines the protected editor-v2 entity runtime used for create/delete/undo/redo.
// - Do not reattach legacy entity mutation, drag, selection, history, or render branches around these helpers.
// - Future entity features must extend this stable-id runtime rather than reviving any disabled legacy path.
export const CANONICAL_ENTITY_RUNTIME_QUERY_PARAM = "cleanRoomEntityMode";
export const CLEAN_ROOM_ENTITY_MODE_QUERY_PARAM = CANONICAL_ENTITY_RUNTIME_QUERY_PARAM;

export function resolveCanonicalEntityRuntime(search = typeof window !== "undefined" ? window.location.search : "") {
  const params = new URLSearchParams(typeof search === "string" ? search : "");
  const rawValue = params.get(CANONICAL_ENTITY_RUNTIME_QUERY_PARAM);
  const normalizedValue = typeof rawValue === "string" ? rawValue.trim().toLowerCase() : "";

  return {
    enabled: ENABLED_VALUES.has(normalizedValue),
    queryParam: CANONICAL_ENTITY_RUNTIME_QUERY_PARAM,
    rawValue: rawValue ?? null,
  };
}

export const resolveCleanRoomEntityMode = resolveCanonicalEntityRuntime;

export function cloneCanonicalEntitySnapshot(entity) {
  if (!entity) return null;
  return {
    ...entity,
    params: entity?.params && typeof entity.params === "object"
      ? JSON.parse(JSON.stringify(entity.params))
      : {},
  };
}

export const cloneCleanRoomEntitySnapshot = cloneCanonicalEntitySnapshot;

function removeEntityById(entities, entityId) {
  const index = entities.findIndex((entity) => entity?.id === entityId);
  if (index < 0) return null;
  const [removed] = entities.splice(index, 1);
  return removed || null;
}

function insertEntitySnapshot(entities, entity, index) {
  const snapshot = cloneCanonicalEntitySnapshot(entity);
  if (!snapshot?.id) return null;

  removeEntityById(entities, snapshot.id);
  const insertIndex = Number.isInteger(index)
    ? Math.max(0, Math.min(index, entities.length))
    : entities.length;
  entities.splice(insertIndex, 0, snapshot);
  return snapshot;
}

export function applyCanonicalEntityAction(doc, action, direction = "forward") {
  if (!doc || !Array.isArray(doc.entities)) {
    return { changed: false, selectedEntityId: null };
  }

  const { entities } = doc;
  const entityId = action?.entity?.id
    || action?.nextEntity?.id
    || action?.previousEntity?.id
    || null;
  if (!entityId) {
    return { changed: false, selectedEntityId: null };
  }

  if (action.type === "create") {
    if (direction === "forward") {
      insertEntitySnapshot(entities, action.entity, action.index);
      return { changed: true, selectedEntityId: entityId };
    }

    const removed = removeEntityById(entities, entityId);
    return { changed: Boolean(removed), selectedEntityId: null };
  }

  if (action.type === "delete") {
    if (direction === "forward") {
      const removed = removeEntityById(entities, entityId);
      return { changed: Boolean(removed), selectedEntityId: null };
    }

    insertEntitySnapshot(entities, action.entity, action.index);
    return { changed: true, selectedEntityId: entityId };
  }

  if (action.type === "update") {
    const snapshot = direction === "forward" ? action.nextEntity : action.previousEntity;
    const updated = insertEntitySnapshot(entities, snapshot, action.index);
    return { changed: Boolean(updated), selectedEntityId: updated?.id || null };
  }

  return { changed: false, selectedEntityId: null };
}

export const applyCleanRoomEntityAction = applyCanonicalEntityAction;

export function createCanonicalEntityHistory() {
  const history = {
    undoStack: [],
    redoStack: [],
  };

  const cloneAction = (action) => ({
    ...action,
    entity: cloneCanonicalEntitySnapshot(action.entity),
    previousEntity: cloneCanonicalEntitySnapshot(action.previousEntity),
    nextEntity: cloneCanonicalEntitySnapshot(action.nextEntity),
  });

  return {
    get undoStack() {
      return history.undoStack;
    },
    get redoStack() {
      return history.redoStack;
    },
    clear() {
      history.undoStack.length = 0;
      history.redoStack.length = 0;
    },
    record(action) {
      history.undoStack.push(cloneAction(action));
      history.redoStack.length = 0;
    },
    canUndo() {
      return history.undoStack.length > 0;
    },
    canRedo() {
      return history.redoStack.length > 0;
    },
    popUndo() {
      return history.undoStack.pop() || null;
    },
    popRedo() {
      return history.redoStack.pop() || null;
    },
    pushUndo(action) {
      history.undoStack.push(cloneAction(action));
    },
    pushRedo(action) {
      history.redoStack.push(cloneAction(action));
    },
  };
}

export const createCleanRoomEntityHistory = createCanonicalEntityHistory;
