import { getTileIndex } from "../level/levelDocument.js";

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
  return {
    kind: "decor",
    mode,
    ...payload,
  };
}

function cloneDecorEntry(decor) {
  return decor ? { ...decor } : decor;
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

  history.undoStack.push(editEntry);
  history.redoStack.length = 0;
}

export function endHistoryBatch(history) {
  const batch = history.activeBatch;
  history.activeBatch = null;
  if (!batch || batch.edits.length === 0) {
    return false;
  }

  history.undoStack.push({
    type: "batch",
    label: batch.label,
    edits: batch.edits,
  });
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

  if (entry.kind === "decor") {
    if (!Array.isArray(doc.decor)) {
      doc.decor = [];
    }

    if (entry.mode === "create") {
      doc.decor.splice(entry.index, 1);
      return true;
    }

    if (entry.mode === "delete") {
      doc.decor.splice(entry.index, 0, cloneDecorEntry(entry.decor));
      return true;
    }

    if (entry.mode === "update") {
      if (entry.index < 0 || entry.index >= doc.decor.length) return false;
      doc.decor.splice(entry.index, 1, cloneDecorEntry(entry.previousDecor));
      return true;
    }

    return false;
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

  if (entry.kind === "decor") {
    if (!Array.isArray(doc.decor)) {
      doc.decor = [];
    }

    if (entry.mode === "create") {
      doc.decor.splice(entry.index, 0, cloneDecorEntry(entry.decor));
      return true;
    }

    if (entry.mode === "delete") {
      doc.decor.splice(entry.index, 1);
      return true;
    }

    if (entry.mode === "update") {
      if (entry.index < 0 || entry.index >= doc.decor.length) return false;
      doc.decor.splice(entry.index, 1, cloneDecorEntry(entry.nextDecor));
      return true;
    }

    return false;
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
