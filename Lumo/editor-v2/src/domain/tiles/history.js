import { getTileIndex } from "../level/levelDocument.js";

export function createTileEditEntry(doc, cell, previousValue, nextValue) {
  const index = getTileIndex(doc.dimensions.width, cell.x, cell.y);

  return {
    index,
    cell: {
      x: cell.x,
      y: cell.y,
    },
    previousValue,
    nextValue,
  };
}

function createBatchEntry(label = "tile-drag") {
  return {
    type: "batch",
    label,
    edits: [],
    seenIndices: new Set(),
  };
}

export function startTileEditBatch(history, label) {
  history.activeBatch = createBatchEntry(label);
}

export function pushTileEdit(history, editEntry) {
  const batch = history.activeBatch;
  if (batch) {
    if (batch.seenIndices.has(editEntry.index)) {
      return;
    }
    batch.seenIndices.add(editEntry.index);
    batch.edits.push(editEntry);
    return;
  }

  history.undoStack.push(editEntry);
  history.redoStack.length = 0;
}

export function endTileEditBatch(history) {
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
      doc.tiles.base[edit.index] = edit.previousValue;
    }
    return true;
  }

  if (!entry) return false;
  doc.tiles.base[entry.index] = entry.previousValue;
  return true;
}

function applyRedoEntry(doc, entry) {
  if (entry?.type === "batch") {
    for (const edit of entry.edits) {
      doc.tiles.base[edit.index] = edit.nextValue;
    }
    return true;
  }

  if (!entry) return false;
  doc.tiles.base[entry.index] = entry.nextValue;
  return true;
}

export function undoTileEdit(doc, history) {
  const entry = history.undoStack.pop();
  const changed = applyUndoEntry(doc, entry);
  if (!changed) return false;

  history.redoStack.push(entry);
  return true;
}

export function redoTileEdit(doc, history) {
  const entry = history.redoStack.pop();
  const changed = applyRedoEntry(doc, entry);
  if (!changed) return false;

  history.undoStack.push(entry);
  return true;
}
