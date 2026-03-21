export function cloneCanonicalDecorSnapshot(decor) {
  if (!decor) return null;
  return {
    ...decor,
    params: decor?.params && typeof decor.params === "object"
      ? JSON.parse(JSON.stringify(decor.params))
      : {},
  };
}

function removeDecorById(decorItems, decorId) {
  const index = decorItems.findIndex((decor) => decor?.id === decorId);
  if (index < 0) return null;
  const [removed] = decorItems.splice(index, 1);
  return removed || null;
}

function insertDecorSnapshot(decorItems, decor, index) {
  const snapshot = cloneCanonicalDecorSnapshot(decor);
  if (!snapshot?.id) return null;

  removeDecorById(decorItems, snapshot.id);
  const insertIndex = Number.isInteger(index)
    ? Math.max(0, Math.min(index, decorItems.length))
    : decorItems.length;
  decorItems.splice(insertIndex, 0, snapshot);
  return snapshot;
}

function getCanonicalDecorActionItems(action) {
  if (action?.type === "update" && Array.isArray(action?.items)) {
    return action.items
      .map((item) => ({
        index: Number.isInteger(item?.index) ? item.index : null,
        previousDecor: cloneCanonicalDecorSnapshot(item?.previousDecor),
        nextDecor: cloneCanonicalDecorSnapshot(item?.nextDecor),
      }))
      .filter((item) => Number.isInteger(item.index) && item.previousDecor?.id && item.nextDecor?.id);
  }

  if (Array.isArray(action?.items)) {
    return action.items
      .map((item) => ({
        index: Number.isInteger(item?.index) ? item.index : null,
        decor: cloneCanonicalDecorSnapshot(item?.decor),
      }))
      .filter((item) => Number.isInteger(item.index) && item.decor?.id);
  }

  if (Number.isInteger(action?.index) && action?.decor?.id) {
    return [{ index: action.index, decor: cloneCanonicalDecorSnapshot(action.decor) }];
  }

  return [];
}

export function applyCanonicalDecorAction(doc, action, direction = "forward") {
  if (!doc || !Array.isArray(doc.decor)) {
    return { changed: false, selectedDecorIds: [], selectedDecorId: null };
  }

  const items = getCanonicalDecorActionItems(action);
  if (!items.length) {
    return { changed: false, selectedDecorIds: [], selectedDecorId: null };
  }

  if (action.type === "create") {
    if (direction === "forward") {
      for (const item of [...items].sort((left, right) => left.index - right.index)) {
        insertDecorSnapshot(doc.decor, item.decor, item.index);
      }
      const selectedDecorIds = items.map((item) => item.decor.id);
      return {
        changed: true,
        selectedDecorIds,
        selectedDecorId: selectedDecorIds.at(-1) ?? null,
      };
    }

    let changed = false;
    for (const item of items) {
      changed = Boolean(removeDecorById(doc.decor, item.decor.id)) || changed;
    }
    return { changed, selectedDecorIds: [], selectedDecorId: null };
  }

  if (action.type === "delete") {
    if (direction === "forward") {
      let changed = false;
      for (const item of items) {
        changed = Boolean(removeDecorById(doc.decor, item.decor.id)) || changed;
      }
      return { changed, selectedDecorIds: [], selectedDecorId: null };
    }

    for (const item of [...items].sort((left, right) => left.index - right.index)) {
      insertDecorSnapshot(doc.decor, item.decor, item.index);
    }
    const selectedDecorIds = items.map((item) => item.decor.id);
    return {
      changed: true,
      selectedDecorIds,
      selectedDecorId: selectedDecorIds.at(-1) ?? null,
    };
  }

  if (action.type === "update") {
    let changed = false;
    const selectedDecorIds = [];

    for (const item of items) {
      const snapshot = direction === "forward" ? item.nextDecor : item.previousDecor;
      const inserted = insertDecorSnapshot(doc.decor, snapshot, item.index);
      if (!inserted) continue;
      changed = true;
      selectedDecorIds.push(inserted.id);
    }

    return {
      changed,
      selectedDecorIds,
      selectedDecorId: selectedDecorIds.at(-1) ?? null,
    };
  }

  return { changed: false, selectedDecorIds: [], selectedDecorId: null };
}

export function createCanonicalDecorHistory() {
  const history = {
    undoStack: [],
    redoStack: [],
  };

  const cloneAction = (action) => ({
    ...action,
    items: getCanonicalDecorActionItems(action),
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
