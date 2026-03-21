import { getTileIndex } from "../level/levelDocument.js";
import { recordGlobalHistoryAction } from "../history/globalTimeline.js";
import {
  applyObjectLayerRedoEntry,
  applyObjectLayerUndoEntry,
  createObjectLayerEditEntry,
  isObjectLayerKind,
} from "../placeables/objectLayerHistory.js";

export function createTileEditEntry(doc, cell, previousValue, nextValue) {
  const index = getTileIndex(doc.dimensions.width, cell.x, cell.y);

  return {
    kind: "tile",
    index,
    cell: {
      x: cell.x,
      y: cell.y,
    },
    previousValue,
    nextValue,
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


function getHistoryEntryDomain(entry) {
  if (entry?.type === "batch") {
    const editDomains = [...new Set((entry.edits || []).map((edit) => getHistoryEntryDomain(edit)).filter(Boolean))];
    if (editDomains.length === 1) return editDomains[0];
    return editDomains[0] || "tile";
  }

  if (isObjectLayerKind(entry?.kind)) return entry.kind;
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
    actionType: entry?.mode || entry?.type || entry?.kind || domain,
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
