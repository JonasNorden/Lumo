export function createGlobalHistoryTimelineState() {
  return {
    nextActionId: 1,
    entries: [],
    entryById: new Map(),
    undoStack: [],
    redoStack: [],
    clearRedoTargets: null,
  };
}

function getActionIdValue(actionId) {
  return typeof actionId === "string" && actionId.trim()
    ? actionId
    : null;
}

function updateEntryState(timeline, actionId, state) {
  const entry = timeline?.entryById instanceof Map ? timeline.entryById.get(actionId) || null : null;
  if (!entry) return null;
  entry.state = state;
  return entry;
}

export function clearGlobalHistoryTimeline(timeline) {
  if (!timeline) return;
  timeline.nextActionId = 1;
  timeline.entries.length = 0;
  if (timeline.entryById instanceof Map) {
    timeline.entryById.clear();
  } else {
    timeline.entryById = new Map();
  }
  timeline.undoStack.length = 0;
  timeline.redoStack.length = 0;
}

export function discardGlobalRedoTail(timeline) {
  if (!timeline?.redoStack?.length) return [];

  const discardedActionIds = [...timeline.redoStack];
  if (typeof timeline.clearRedoTargets === "function") {
    timeline.clearRedoTargets(discardedActionIds);
  }

  for (const actionId of discardedActionIds) {
    updateEntryState(timeline, actionId, "discarded");
  }
  timeline.redoStack.length = 0;
  return discardedActionIds;
}

export function recordGlobalHistoryAction(timeline, descriptor = {}) {
  if (!timeline) return null;

  discardGlobalRedoTail(timeline);

  const actionId = `global-action-${timeline.nextActionId}`;
  timeline.nextActionId += 1;

  const entry = {
    actionId,
    domain: descriptor.domain || "tile",
    actionType: descriptor.actionType || null,
    route: descriptor.route ? { ...descriptor.route } : null,
    state: "applied",
  };

  timeline.entries.push(entry);
  if (!(timeline.entryById instanceof Map)) {
    timeline.entryById = new Map();
  }
  timeline.entryById.set(actionId, entry);
  timeline.undoStack.push(actionId);
  return entry;
}

export function canUndoGlobalHistory(timeline) {
  return Boolean(timeline?.undoStack?.length);
}

export function canRedoGlobalHistory(timeline) {
  return Boolean(timeline?.redoStack?.length);
}

export function peekNextGlobalUndoAction(timeline) {
  const actionId = timeline?.undoStack?.at(-1) || null;
  if (!actionId || !(timeline.entryById instanceof Map)) return null;
  return timeline.entryById.get(actionId) || null;
}

export function peekNextGlobalRedoAction(timeline) {
  const actionId = timeline?.redoStack?.at(-1) || null;
  if (!actionId || !(timeline.entryById instanceof Map)) return null;
  return timeline.entryById.get(actionId) || null;
}

export function markGlobalHistoryActionUndone(timeline, actionId) {
  const normalizedActionId = getActionIdValue(actionId);
  if (!timeline || !normalizedActionId) return null;
  if (timeline.undoStack.at(-1) !== normalizedActionId) return null;

  timeline.undoStack.pop();
  timeline.redoStack.push(normalizedActionId);
  return updateEntryState(timeline, normalizedActionId, "undone");
}

export function markGlobalHistoryActionRedone(timeline, actionId) {
  const normalizedActionId = getActionIdValue(actionId);
  if (!timeline || !normalizedActionId) return null;
  if (timeline.redoStack.at(-1) !== normalizedActionId) return null;

  timeline.redoStack.pop();
  timeline.undoStack.push(normalizedActionId);
  return updateEntryState(timeline, normalizedActionId, "applied");
}
