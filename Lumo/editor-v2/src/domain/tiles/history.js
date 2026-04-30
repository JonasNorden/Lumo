import { getTileIndex } from "../level/levelDocument.js";
import { recordGlobalHistoryAction } from "../history/globalTimeline.js";
import {
  applyObjectLayerRedoEntry,
  applyObjectLayerUndoEntry,
  createObjectLayerEditEntry,
  isObjectLayerKind,
} from "../placeables/objectLayerHistory.js";

export function createTileEditEntry(doc, cell, previousValue, nextValue, layer = "tiles") {
  const index = getTileIndex(doc.dimensions.width, cell.x, cell.y);

  return {
    kind: layer === "background" ? "background" : "tile",
    index,
    cell: {
      x: cell.x,
      y: cell.y,
    },
    previousValue,
    nextValue,
  };
}

export function createSizedPlacementEditEntry(layer, previousPlacements, nextPlacements, previousBase, nextBase) {
  return {
    kind: layer === "background" ? "background-sized" : "tile-sized",
    previousPlacements,
    nextPlacements,
    previousBase,
    nextBase,
  };
}

export function createDecorEditEntry(mode, payload) {
  return createObjectLayerEditEntry("decor", mode, payload);
}

export function createEntityEditEntry(mode, payload) {
  return createObjectLayerEditEntry("entity", mode, payload);
}

export function createSoundEditEntry(mode, payload) {
  return createObjectLayerEditEntry("sound", mode, payload);
}

function cloneReactiveGrassPatchSnapshot(patch) {
  return patch && typeof patch === "object" ? { ...patch } : null;
}

function cloneReactiveBloomPatchSnapshot(patch) {
  return patch && typeof patch === "object" ? { ...patch } : null;
}
function cloneReactiveCrystalPatchSnapshot(patch) {
  return patch && typeof patch === "object" ? { ...patch } : null;
}

export function createReactiveGrassEditEntry(mode, payload = {}) {
  const normalizedMode = mode === "create" || mode === "delete" || mode === "update" ? mode : "update";
  const objectId = typeof payload.objectId === "string" && payload.objectId.trim() ? payload.objectId.trim() : null;
  const index = Number.isInteger(payload.index) ? payload.index : null;
  const previousSnapshot = cloneReactiveGrassPatchSnapshot(payload.previousSnapshot);
  const nextSnapshot = cloneReactiveGrassPatchSnapshot(payload.nextSnapshot);
  return {
    kind: "reactive-grass",
    mode: normalizedMode,
    objectId,
    index,
    previousSnapshot,
    nextSnapshot,
  };
}

export function createReactiveBloomEditEntry(mode, payload = {}) {
  const normalizedMode = mode === "create" || mode === "delete" || mode === "update" ? mode : "update";
  const objectId = typeof payload.objectId === "string" && payload.objectId.trim() ? payload.objectId.trim() : null;
  const index = Number.isInteger(payload.index) ? payload.index : null;
  const previousSnapshot = cloneReactiveBloomPatchSnapshot(payload.previousSnapshot);
  const nextSnapshot = cloneReactiveBloomPatchSnapshot(payload.nextSnapshot);
  return {
    kind: "reactive-bloom",
    mode: normalizedMode,
    objectId,
    index,
    previousSnapshot,
    nextSnapshot,
  };
}

export function createReactiveCrystalEditEntry(mode, payload = {}) {
  const normalizedMode = mode === "create" || mode === "delete" || mode === "update" ? mode : "update";
  const objectId = typeof payload.objectId === "string" && payload.objectId.trim() ? payload.objectId.trim() : null;
  const index = Number.isInteger(payload.index) ? payload.index : null;
  const previousSnapshot = cloneReactiveCrystalPatchSnapshot(payload.previousSnapshot);
  const nextSnapshot = cloneReactiveCrystalPatchSnapshot(payload.nextSnapshot);
  return {
    kind: "reactive-crystal",
    mode: normalizedMode,
    objectId,
    index,
    previousSnapshot,
    nextSnapshot,
  };
}


function getHistoryEntryDomain(entry) {
  if (entry?.type === "batch") {
    const editDomains = [...new Set((entry.edits || []).map((edit) => getHistoryEntryDomain(edit)).filter(Boolean))];
    if (editDomains.length === 1) return editDomains[0];
    return editDomains[0] || "tile";
  }

  if (isObjectLayerKind(entry?.kind)) return entry.kind;
  if (entry?.kind === "reactive-grass") return "reactive-grass";
  if (entry?.kind === "reactive-bloom") return "reactive-bloom";
  if (entry?.kind === "reactive-crystal") return "reactive-crystal";
  if (entry?.kind === "background") return "background";
  if (entry?.kind === "background-sized") return "background";
  return "tile";
}

function annotateHistoryEntry(entry, actionRecord) {
  if (!entry || !actionRecord?.actionId) return entry;
  entry.globalActionId = actionRecord.actionId;
  return entry;
}

function recordHistoryTimelineEntry(history, entry) {
  if (!history?.globalTimeline || !entry) return null;
  const domain = getHistoryEntryDomain(entry);
  return recordGlobalHistoryAction(history.globalTimeline, {
    domain,
    actionType: entry?.kind === "reactive-crystal" && entry?.mode === "create"
      ? "reactive-crystal-create"
      : entry?.mode || entry?.type || entry?.kind || domain,
    route: {
      lane: "document-history",
      domain,
    },
  });
}

function createBatchEntry(label = "tile-drag") {
  return {
    type: "batch",
    label,
    edits: [],
    seenKeys: new Set(),
  };
}

export function startHistoryBatch(history, label) {
  history.activeBatch = createBatchEntry(label);
}

export function pushHistoryEntry(history, editEntry, dedupeKey = null) {
  const batch = history.activeBatch;
  if (batch) {
    if (dedupeKey && batch.seenKeys.has(dedupeKey)) {
      return;
    }
    if (dedupeKey) {
      batch.seenKeys.add(dedupeKey);
    }
    batch.edits.push(editEntry);
    return;
  }

  const actionRecord = recordHistoryTimelineEntry(history, editEntry);
  annotateHistoryEntry(editEntry, actionRecord);
  history.undoStack.push(editEntry);
  history.redoStack.length = 0;
}

export function endHistoryBatch(history) {
  const batch = history.activeBatch;
  history.activeBatch = null;
  if (!batch || batch.edits.length === 0) {
    return false;
  }

  const entry = {
    type: "batch",
    label: batch.label,
    edits: batch.edits,
  };
  const actionRecord = recordHistoryTimelineEntry(history, entry);
  annotateHistoryEntry(entry, actionRecord);
  history.undoStack.push(entry);
  history.redoStack.length = 0;
  return true;
}

export function startTileEditBatch(history, label) {
  startHistoryBatch(history, label);
}

export function pushTileEdit(history, editEntry) {
  pushHistoryEntry(history, editEntry, `tile:${editEntry.index}`);
}

export function endTileEditBatch(history) {
  return endHistoryBatch(history);
}

export function canUndo(history) {
  return history.undoStack.length > 0;
}

export function canRedo(history) {
  return history.redoStack.length > 0;
}

function applyUndoEntry(doc, entry) {
  if (entry?.type === "batch") {
    for (let i = entry.edits.length - 1; i >= 0; i -= 1) {
      const edit = entry.edits[i];
      applyUndoEntry(doc, edit);
    }
    return true;
  }

  if (!entry) return false;

  if (isObjectLayerKind(entry.kind)) {
    return applyObjectLayerUndoEntry(doc, entry);
  }
  if (entry.kind === "reactive-grass") {
    if (!Array.isArray(doc.reactiveGrassPatches)) doc.reactiveGrassPatches = [];
    const patches = doc.reactiveGrassPatches;
    const targetId = typeof entry.objectId === "string" && entry.objectId.trim() ? entry.objectId.trim() : null;
    const authoredIndex = Number.isInteger(entry.index) ? Math.max(0, Math.min(patches.length, entry.index)) : patches.length;
    const existingIndex = targetId ? patches.findIndex((patch) => patch?.id === targetId) : -1;

    if (entry.mode === "create") {
      if (existingIndex >= 0) patches.splice(existingIndex, 1);
      return true;
    }

    if (entry.mode === "delete") {
      if (!entry.previousSnapshot) return false;
      const snapshot = cloneReactiveGrassPatchSnapshot(entry.previousSnapshot);
      if (existingIndex >= 0) patches[existingIndex] = snapshot;
      else patches.splice(authoredIndex, 0, snapshot);
      return true;
    }

    if (!entry.previousSnapshot) return false;
    const snapshot = cloneReactiveGrassPatchSnapshot(entry.previousSnapshot);
    if (existingIndex >= 0) patches[existingIndex] = snapshot;
    else patches.splice(authoredIndex, 0, snapshot);
    return true;
  }
  if (entry.kind === "reactive-bloom") {
    if (!Array.isArray(doc.reactiveBloomPatches)) doc.reactiveBloomPatches = [];
    const patches = doc.reactiveBloomPatches;
    const targetId = typeof entry.objectId === "string" && entry.objectId.trim() ? entry.objectId.trim() : null;
    const authoredIndex = Number.isInteger(entry.index) ? Math.max(0, Math.min(patches.length, entry.index)) : patches.length;
    const existingIndex = targetId ? patches.findIndex((patch) => patch?.id === targetId) : -1;
    if (entry.mode === "create") {
      if (existingIndex >= 0) patches.splice(existingIndex, 1);
      return true;
    }
    if (entry.mode === "delete") {
      if (!entry.previousSnapshot) return false;
      const snapshot = cloneReactiveBloomPatchSnapshot(entry.previousSnapshot);
      if (existingIndex >= 0) patches[existingIndex] = snapshot;
      else patches.splice(authoredIndex, 0, snapshot);
      return true;
    }
    if (!entry.previousSnapshot) return false;
    const snapshot = cloneReactiveBloomPatchSnapshot(entry.previousSnapshot);
    if (existingIndex >= 0) patches[existingIndex] = snapshot;
    else patches.splice(authoredIndex, 0, snapshot);
    return true;
  }
  if (entry.kind === "reactive-crystal") {
    if (!Array.isArray(doc.reactiveCrystalPatches)) doc.reactiveCrystalPatches = [];
    const patches = doc.reactiveCrystalPatches;
    const targetId = typeof entry.objectId === "string" && entry.objectId.trim() ? entry.objectId.trim() : null;
    const authoredIndex = Number.isInteger(entry.index) ? Math.max(0, Math.min(patches.length, entry.index)) : patches.length;
    const existingIndex = targetId ? patches.findIndex((patch) => patch?.id === targetId) : -1;
    if (entry.mode === "create") {
      if (existingIndex >= 0) patches.splice(existingIndex, 1);
      return true;
    }
    if (entry.mode === "delete") {
      if (!entry.previousSnapshot) return false;
      const snapshot = cloneReactiveCrystalPatchSnapshot(entry.previousSnapshot);
      if (existingIndex >= 0) patches[existingIndex] = snapshot;
      else patches.splice(authoredIndex, 0, snapshot);
      return true;
    }
    if (!entry.previousSnapshot) return false;
    const snapshot = cloneReactiveCrystalPatchSnapshot(entry.previousSnapshot);
    if (existingIndex >= 0) patches[existingIndex] = snapshot;
    else patches.splice(authoredIndex, 0, snapshot);
    return true;
  }

  if (entry.kind === "background") {
    doc.background.base[entry.index] = entry.previousValue ?? null;
    return true;
  }
  if (entry.kind === "background-sized") {
    doc.background.placements = Array.isArray(entry.previousPlacements) ? entry.previousPlacements.map((placement) => ({ ...placement })) : [];
    doc.background.base = Array.isArray(entry.previousBase) ? entry.previousBase.slice() : doc.background.base;
    return true;
  }
  if (entry.kind === "tile-sized") {
    doc.tiles.placements = Array.isArray(entry.previousPlacements) ? entry.previousPlacements.map((placement) => ({ ...placement })) : [];
    doc.tiles.base = Array.isArray(entry.previousBase) ? entry.previousBase.slice() : doc.tiles.base;
    return true;
  }

  doc.tiles.base[entry.index] = entry.previousValue;
  return true;
}

function applyRedoEntry(doc, entry) {
  if (entry?.type === "batch") {
    for (const edit of entry.edits) {
      applyRedoEntry(doc, edit);
    }
    return true;
  }

  if (!entry) return false;

  if (isObjectLayerKind(entry.kind)) {
    return applyObjectLayerRedoEntry(doc, entry);
  }
  if (entry.kind === "reactive-grass") {
    if (!Array.isArray(doc.reactiveGrassPatches)) doc.reactiveGrassPatches = [];
    const patches = doc.reactiveGrassPatches;
    const targetId = typeof entry.objectId === "string" && entry.objectId.trim() ? entry.objectId.trim() : null;
    const authoredIndex = Number.isInteger(entry.index) ? Math.max(0, Math.min(patches.length, entry.index)) : patches.length;
    const existingIndex = targetId ? patches.findIndex((patch) => patch?.id === targetId) : -1;

    if (entry.mode === "delete") {
      if (existingIndex >= 0) patches.splice(existingIndex, 1);
      return true;
    }

    if (entry.mode === "create") {
      if (!entry.nextSnapshot) return false;
      const snapshot = cloneReactiveGrassPatchSnapshot(entry.nextSnapshot);
      if (existingIndex >= 0) patches[existingIndex] = snapshot;
      else patches.splice(authoredIndex, 0, snapshot);
      return true;
    }

    if (!entry.nextSnapshot) return false;
    const snapshot = cloneReactiveGrassPatchSnapshot(entry.nextSnapshot);
    if (existingIndex >= 0) patches[existingIndex] = snapshot;
    else patches.splice(authoredIndex, 0, snapshot);
    return true;
  }
  if (entry.kind === "reactive-bloom") {
    if (!Array.isArray(doc.reactiveBloomPatches)) doc.reactiveBloomPatches = [];
    const patches = doc.reactiveBloomPatches;
    const targetId = typeof entry.objectId === "string" && entry.objectId.trim() ? entry.objectId.trim() : null;
    const authoredIndex = Number.isInteger(entry.index) ? Math.max(0, Math.min(patches.length, entry.index)) : patches.length;
    const existingIndex = targetId ? patches.findIndex((patch) => patch?.id === targetId) : -1;
    if (entry.mode === "delete") {
      if (existingIndex >= 0) patches.splice(existingIndex, 1);
      return true;
    }
    if (entry.mode === "create") {
      if (!entry.nextSnapshot) return false;
      const snapshot = cloneReactiveBloomPatchSnapshot(entry.nextSnapshot);
      if (existingIndex >= 0) patches[existingIndex] = snapshot;
      else patches.splice(authoredIndex, 0, snapshot);
      return true;
    }
    if (!entry.nextSnapshot) return false;
    const snapshot = cloneReactiveBloomPatchSnapshot(entry.nextSnapshot);
    if (existingIndex >= 0) patches[existingIndex] = snapshot;
    else patches.splice(authoredIndex, 0, snapshot);
    return true;
  }
  if (entry.kind === "reactive-crystal") {
    if (!Array.isArray(doc.reactiveCrystalPatches)) doc.reactiveCrystalPatches = [];
    const patches = doc.reactiveCrystalPatches;
    const targetId = typeof entry.objectId === "string" && entry.objectId.trim() ? entry.objectId.trim() : null;
    const authoredIndex = Number.isInteger(entry.index) ? Math.max(0, Math.min(patches.length, entry.index)) : patches.length;
    const existingIndex = targetId ? patches.findIndex((patch) => patch?.id === targetId) : -1;
    if (entry.mode === "delete") {
      if (existingIndex >= 0) patches.splice(existingIndex, 1);
      return true;
    }
    if (entry.mode === "create") {
      if (!entry.nextSnapshot) return false;
      const snapshot = cloneReactiveCrystalPatchSnapshot(entry.nextSnapshot);
      if (existingIndex >= 0) patches[existingIndex] = snapshot;
      else patches.splice(authoredIndex, 0, snapshot);
      return true;
    }
    if (!entry.nextSnapshot) return false;
    const snapshot = cloneReactiveCrystalPatchSnapshot(entry.nextSnapshot);
    if (existingIndex >= 0) patches[existingIndex] = snapshot;
    else patches.splice(authoredIndex, 0, snapshot);
    return true;
  }

  if (entry.kind === "background") {
    doc.background.base[entry.index] = entry.nextValue ?? null;
    return true;
  }
  if (entry.kind === "background-sized") {
    doc.background.placements = Array.isArray(entry.nextPlacements) ? entry.nextPlacements.map((placement) => ({ ...placement })) : [];
    doc.background.base = Array.isArray(entry.nextBase) ? entry.nextBase.slice() : doc.background.base;
    return true;
  }
  if (entry.kind === "tile-sized") {
    doc.tiles.placements = Array.isArray(entry.nextPlacements) ? entry.nextPlacements.map((placement) => ({ ...placement })) : [];
    doc.tiles.base = Array.isArray(entry.nextBase) ? entry.nextBase.slice() : doc.tiles.base;
    return true;
  }

  doc.tiles.base[entry.index] = entry.nextValue;
  return true;
}

export function undoTileEdit(doc, history) {
  const entry = history.undoStack.pop();
  const changed = applyUndoEntry(doc, entry);
  if (!changed) return null;

  history.redoStack.push(entry);
  return entry;
}

export function redoTileEdit(doc, history) {
  const entry = history.redoStack.pop();
  const changed = applyRedoEntry(doc, entry);
  if (!changed) return null;

  history.undoStack.push(entry);
  return entry;
}
