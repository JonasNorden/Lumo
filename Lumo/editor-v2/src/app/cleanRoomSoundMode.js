export function cloneCanonicalSoundSnapshot(sound) {
  if (!sound) return null;
  return {
    ...sound,
    params: sound?.params && typeof sound.params === "object"
      ? JSON.parse(JSON.stringify(sound.params))
      : {},
  };
}

function removeSoundById(sounds, soundId) {
  const index = sounds.findIndex((sound) => sound?.id === soundId);
  if (index < 0) return null;
  const [removed] = sounds.splice(index, 1);
  return removed || null;
}

function insertSoundSnapshot(sounds, sound, index) {
  const snapshot = cloneCanonicalSoundSnapshot(sound);
  if (!snapshot?.id) return null;

  removeSoundById(sounds, snapshot.id);
  const insertIndex = Number.isInteger(index)
    ? Math.max(0, Math.min(index, sounds.length))
    : sounds.length;
  sounds.splice(insertIndex, 0, snapshot);
  return snapshot;
}

function getCanonicalSoundActionItems(action) {
  if (Array.isArray(action?.items)) {
    return action.items
      .map((item) => ({
        index: Number.isInteger(item?.index) ? item.index : null,
        sound: cloneCanonicalSoundSnapshot(item?.sound),
      }))
      .filter((item) => Number.isInteger(item.index) && item.sound?.id);
  }

  if (Number.isInteger(action?.index) && action?.sound?.id) {
    return [{ index: action.index, sound: cloneCanonicalSoundSnapshot(action.sound) }];
  }

  return [];
}

export function applyCanonicalSoundAction(doc, action, direction = "forward") {
  if (!doc || !Array.isArray(doc.sounds)) {
    return { changed: false, selectedSoundIds: [], selectedSoundId: null };
  }

  const items = getCanonicalSoundActionItems(action);
  if (!items.length) {
    return { changed: false, selectedSoundIds: [], selectedSoundId: null };
  }

  if (action.type === "create") {
    if (direction === "forward") {
      for (const item of [...items].sort((left, right) => left.index - right.index)) {
        insertSoundSnapshot(doc.sounds, item.sound, item.index);
      }
      const selectedSoundIds = items.map((item) => item.sound.id);
      return {
        changed: true,
        selectedSoundIds,
        selectedSoundId: selectedSoundIds.at(-1) ?? null,
      };
    }

    let changed = false;
    for (const item of items) {
      changed = Boolean(removeSoundById(doc.sounds, item.sound.id)) || changed;
    }
    return { changed, selectedSoundIds: [], selectedSoundId: null };
  }

  if (action.type === "delete") {
    if (direction === "forward") {
      let changed = false;
      for (const item of items) {
        changed = Boolean(removeSoundById(doc.sounds, item.sound.id)) || changed;
      }
      return { changed, selectedSoundIds: [], selectedSoundId: null };
    }

    for (const item of [...items].sort((left, right) => left.index - right.index)) {
      insertSoundSnapshot(doc.sounds, item.sound, item.index);
    }
    const selectedSoundIds = items.map((item) => item.sound.id);
    return {
      changed: true,
      selectedSoundIds,
      selectedSoundId: selectedSoundIds.at(-1) ?? null,
    };
  }

  return { changed: false, selectedSoundIds: [], selectedSoundId: null };
}

export function createCanonicalSoundHistory() {
  const history = {
    undoStack: [],
    redoStack: [],
  };

  const cloneAction = (action) => ({
    ...action,
    items: getCanonicalSoundActionItems(action),
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
