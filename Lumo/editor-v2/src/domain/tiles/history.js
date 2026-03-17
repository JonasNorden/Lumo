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

export function pushTileEdit(history, editEntry) {
  history.undoStack.push(editEntry);
  history.redoStack.length = 0;
}

export function canUndo(history) {
  return history.undoStack.length > 0;
}

export function canRedo(history) {
  return history.redoStack.length > 0;
}

export function undoTileEdit(doc, history) {
  const entry = history.undoStack.pop();
  if (!entry) return false;

  doc.tiles.base[entry.index] = entry.previousValue;
  history.redoStack.push(entry);
  return true;
}

export function redoTileEdit(doc, history) {
  const entry = history.redoStack.pop();
  if (!entry) return false;

  doc.tiles.base[entry.index] = entry.nextValue;
  history.undoStack.push(entry);
  return true;
}
