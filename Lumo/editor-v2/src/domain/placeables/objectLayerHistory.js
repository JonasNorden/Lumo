import { cloneEntityParams } from "../entities/entityParams.js";

const OBJECT_LAYER_BUCKETS = {
  entity: "entities",
  decor: "decor",
  sound: "sounds",
};

function getObjectSnapshotKey(kind) {
  return kind === "entity" ? "entity" : kind === "decor" ? "decor" : "sound";
}

function getPreviousSnapshotKey(kind) {
  return kind === "entity" ? "previousEntity" : kind === "decor" ? "previousDecor" : "previousSound";
}

function getNextSnapshotKey(kind) {
  return kind === "entity" ? "nextEntity" : kind === "decor" ? "nextDecor" : "nextSound";
}

export function isObjectLayerKind(kind) {
  return kind === "entity" || kind === "decor" || kind === "sound";
}

export function getObjectLayerBucketName(kind) {
  return OBJECT_LAYER_BUCKETS[kind] || null;
}

export function getObjectLayerId(item) {
  return typeof item?.id === "string" && item.id.trim() ? item.id : null;
}

export function cloneObjectLayerItem(item) {
  return item ? { ...item, params: cloneEntityParams(item.params) } : item;
}

export function captureObjectLayerAnchor(items, index) {
  if (!Array.isArray(items)) {
    return {
      index: Number.isInteger(index) ? Math.max(0, index) : 0,
      afterId: null,
      beforeId: null,
    };
  }

  return {
    index: Number.isInteger(index) ? Math.max(0, Math.min(index, items.length)) : items.length,
    afterId: Number.isInteger(index) ? getObjectLayerId(items[index - 1]) : getObjectLayerId(items.at(-1)),
    beforeId: Number.isInteger(index) ? getObjectLayerId(items[index + 1]) : null,
  };
}

function getEntryObjectSnapshot(kind, mode, payload) {
  if (mode === "update") {
    return {
      previousSnapshot: cloneObjectLayerItem(payload[getPreviousSnapshotKey(kind)]),
      nextSnapshot: cloneObjectLayerItem(payload[getNextSnapshotKey(kind)]),
    };
  }

  return {
    snapshot: cloneObjectLayerItem(payload[getObjectSnapshotKey(kind)] || payload.object),
  };
}

export function createObjectLayerEditEntry(kind, mode, payload = {}) {
  if (!isObjectLayerKind(kind)) {
    throw new Error(`Unsupported object layer kind: ${kind}`);
  }

  const anchor = payload.anchor || captureObjectLayerAnchor(payload.items, payload.index);
  const objectKeys = getEntryObjectSnapshot(kind, mode, payload);
  const objectId = mode === "update"
    ? getObjectLayerId(objectKeys.nextSnapshot) || getObjectLayerId(objectKeys.previousSnapshot)
    : getObjectLayerId(objectKeys.snapshot);

  return {
    kind,
    mode,
    objectLayer: kind,
    objectId,
    anchor,
    index: Number.isInteger(payload.index) ? payload.index : anchor.index,
    ...objectKeys,
    ...(mode === "update"
      ? {
        [getPreviousSnapshotKey(kind)]: objectKeys.previousSnapshot,
        [getNextSnapshotKey(kind)]: objectKeys.nextSnapshot,
      }
      : {
        [getObjectSnapshotKey(kind)]: objectKeys.snapshot,
      }),
  };
}

function findObjectIndexById(items, objectId) {
  if (!Array.isArray(items) || typeof objectId !== "string" || !objectId.trim()) return -1;
  return items.findIndex((item) => getObjectLayerId(item) === objectId);
}

function resolveInsertIndex(items, anchor = {}) {
  if (!Array.isArray(items)) return 0;

  const afterIndex = findObjectIndexById(items, anchor.afterId);
  if (afterIndex >= 0) return afterIndex + 1;

  const beforeIndex = findObjectIndexById(items, anchor.beforeId);
  if (beforeIndex >= 0) return beforeIndex;

  if (Number.isInteger(anchor.index)) {
    return Math.max(0, Math.min(anchor.index, items.length));
  }

  return items.length;
}

function ensureObjectBucket(doc, kind) {
  const bucketName = getObjectLayerBucketName(kind);
  if (!bucketName) return null;
  if (!Array.isArray(doc[bucketName])) {
    doc[bucketName] = [];
  }
  return doc[bucketName];
}

function upsertObjectById(items, snapshot, anchor) {
  const objectId = getObjectLayerId(snapshot);
  if (!objectId) return false;

  const existingIndex = findObjectIndexById(items, objectId);
  if (existingIndex >= 0) {
    items.splice(existingIndex, 1, cloneObjectLayerItem(snapshot));
    return true;
  }

  const insertIndex = resolveInsertIndex(items, anchor);
  items.splice(insertIndex, 0, cloneObjectLayerItem(snapshot));
  return true;
}

function removeObjectById(items, objectId, fallbackIndex = null) {
  const existingIndex = findObjectIndexById(items, objectId);
  if (existingIndex >= 0) {
    items.splice(existingIndex, 1);
    return true;
  }

  if (Number.isInteger(fallbackIndex) && fallbackIndex >= 0 && fallbackIndex < items.length) {
    items.splice(fallbackIndex, 1);
    return true;
  }

  return false;
}

function applyObjectLayerEntry(doc, entry, direction) {
  const items = ensureObjectBucket(doc, entry.kind);
  if (!items) return false;

  if (entry.mode === "update") {
    const snapshot = direction === "undo" ? entry.previousSnapshot : entry.nextSnapshot;
    return upsertObjectById(items, snapshot, entry.anchor);
  }

  if (entry.mode === "create") {
    if (direction === "undo") {
      return removeObjectById(items, entry.objectId, entry.index);
    }
    return upsertObjectById(items, entry.snapshot, entry.anchor);
  }

  if (entry.mode === "delete") {
    if (direction === "undo") {
      return upsertObjectById(items, entry.snapshot, entry.anchor);
    }
    return removeObjectById(items, entry.objectId, entry.index);
  }

  return false;
}

export function applyObjectLayerUndoEntry(doc, entry) {
  return applyObjectLayerEntry(doc, entry, "undo");
}

export function applyObjectLayerRedoEntry(doc, entry) {
  return applyObjectLayerEntry(doc, entry, "redo");
}
