function getItemId(item) {
  return typeof item?.id === "string" && item.id.trim() ? item.id : null;
}

function createIndexLookup(items) {
  const lookup = new Map();
  if (!Array.isArray(items)) return lookup;

  items.forEach((item, index) => {
    const itemId = getItemId(item);
    if (itemId) lookup.set(itemId, index);
  });

  return lookup;
}

function normalizeIds(ids, lookup) {
  const uniqueIds = [];
  const seenIds = new Set();

  for (const itemId of Array.isArray(ids) ? ids : []) {
    if (typeof itemId !== "string" || !itemId.trim() || !lookup.has(itemId) || seenIds.has(itemId)) continue;
    seenIds.add(itemId);
    uniqueIds.push(itemId);
  }

  return uniqueIds;
}

function normalizePoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return { x: point.x, y: point.y };
}

function createGenericDragSnapshot(originPositions, leadId, anchorCell, previewDelta) {
  const normalizedOrigins = [];
  const seenIds = new Set();

  for (const origin of Array.isArray(originPositions) ? originPositions : []) {
    if (typeof origin?.itemId !== "string" || !origin.itemId.trim() || seenIds.has(origin.itemId)) continue;
    seenIds.add(origin.itemId);
    normalizedOrigins.push({
      itemId: origin.itemId,
      x: Number.isFinite(origin.x) ? origin.x : 0,
      y: Number.isFinite(origin.y) ? origin.y : 0,
    });
  }

  if (!normalizedOrigins.length) return null;

  return {
    active: true,
    leadId: typeof leadId === "string" && leadId.trim() ? leadId : normalizedOrigins[0].itemId,
    anchorCell: normalizePoint(anchorCell),
    previewDelta: normalizePoint(previewDelta) || { x: 0, y: 0 },
    originPositions: normalizedOrigins,
  };
}

export function getObjectIndexById(items, itemId) {
  if (typeof itemId !== "string" || !itemId.trim()) return null;
  const index = createIndexLookup(items).get(itemId);
  return Number.isInteger(index) ? index : null;
}

export function captureIndexedObjectInteractionSnapshot(items, options = {}) {
  const selectedIds = (Array.isArray(options.selectedIndices) ? options.selectedIndices : [])
    .map((index) => (Number.isInteger(index) ? getItemId(items?.[index]) : null))
    .filter(Boolean);
  const primarySelectedId = Number.isInteger(options.primarySelectedIndex)
    ? getItemId(items?.[options.primarySelectedIndex])
    : selectedIds.at(-1) ?? null;
  const hoveredId = Number.isInteger(options.hoveredIndex) ? getItemId(items?.[options.hoveredIndex]) : null;
  const drag = options.drag?.active
    ? createGenericDragSnapshot(
      (options.drag.originPositions || []).map((origin) => ({
        itemId: Number.isInteger(origin?.index) ? getItemId(items?.[origin.index]) : null,
        x: origin?.x,
        y: origin?.y,
      })),
      Number.isInteger(options.drag.leadIndex) ? getItemId(items?.[options.drag.leadIndex]) : null,
      options.drag.anchorCell,
      options.drag.previewDelta,
    )
    : null;

  return {
    selectedIds: [...new Set(selectedIds)],
    primarySelectedId,
    hoveredId,
    drag,
  };
}

export function reconcileIndexedObjectInteraction(items, snapshot = {}, options = {}) {
  const lookup = createIndexLookup(items);
  const selectedIds = options.clearSelection ? [] : normalizeIds(options.selectedIds ?? snapshot.selectedIds, lookup);
  const primarySelectedId = selectedIds.includes(options.primarySelectedId ?? snapshot.primarySelectedId)
    ? (options.primarySelectedId ?? snapshot.primarySelectedId)
    : selectedIds.at(-1) ?? null;
  const hoveredId = options.clearHover
    ? null
    : typeof (options.hoveredId ?? snapshot.hoveredId) === "string" && lookup.has(options.hoveredId ?? snapshot.hoveredId)
      ? (options.hoveredId ?? snapshot.hoveredId)
      : null;

  const dragSnapshot = options.clearDrag ? null : options.drag ?? snapshot.drag;
  const dragOrigins = (dragSnapshot?.originPositions || [])
    .filter((origin) => typeof origin?.itemId === "string" && lookup.has(origin.itemId))
    .map((origin) => ({
      index: lookup.get(origin.itemId),
      x: Number.isFinite(origin.x) ? origin.x : 0,
      y: Number.isFinite(origin.y) ? origin.y : 0,
    }))
    .filter((origin) => Number.isInteger(origin.index));
  const dragLeadId = typeof dragSnapshot?.leadId === "string" && lookup.has(dragSnapshot.leadId)
    ? dragSnapshot.leadId
    : selectedIds[0] ?? null;
  const dragLeadIndex = Number.isInteger(getObjectIndexById(items, dragLeadId)) ? getObjectIndexById(items, dragLeadId) : null;
  const drag = dragSnapshot?.active && dragOrigins.length && Number.isInteger(dragLeadIndex)
    ? {
      active: true,
      leadIndex: dragLeadIndex,
      anchorCell: normalizePoint(dragSnapshot.anchorCell),
      previewDelta: normalizePoint(dragSnapshot.previewDelta) || { x: 0, y: 0 },
      originPositions: dragOrigins,
    }
    : null;

  return {
    selectedIds,
    primarySelectedId,
    selectedIndices: selectedIds.map((itemId) => lookup.get(itemId)).filter(Number.isInteger),
    primarySelectedIndex: getObjectIndexById(items, primarySelectedId),
    hoveredId,
    hoveredIndex: getObjectIndexById(items, hoveredId),
    drag,
  };
}

export function captureIdObjectInteractionSnapshot(options = {}) {
  const selectedIds = [...new Set((Array.isArray(options.selectedIds) ? options.selectedIds : []).filter((itemId) => typeof itemId === "string" && itemId.trim()))];
  const drag = options.drag?.active
    ? createGenericDragSnapshot(
      (options.drag.originPositions || []).map((origin) => ({
        itemId: origin?.soundId ?? origin?.itemId ?? null,
        x: origin?.x,
        y: origin?.y,
      })),
      options.drag.leadSoundId ?? options.drag.leadId ?? null,
      options.drag.anchorCell,
      options.drag.previewDelta,
    )
    : null;

  return {
    selectedIds,
    primarySelectedId: typeof options.primarySelectedId === "string" && options.primarySelectedId.trim()
      ? options.primarySelectedId
      : selectedIds.at(-1) ?? null,
    hoveredId: typeof options.hoveredId === "string" && options.hoveredId.trim() ? options.hoveredId : null,
    drag,
  };
}

export function reconcileIdObjectInteraction(items, snapshot = {}, options = {}) {
  const lookup = createIndexLookup(items);
  const selectedIds = options.clearSelection ? [] : normalizeIds(options.selectedIds ?? snapshot.selectedIds, lookup);
  const primarySelectedId = selectedIds.includes(options.primarySelectedId ?? snapshot.primarySelectedId)
    ? (options.primarySelectedId ?? snapshot.primarySelectedId)
    : selectedIds.at(-1) ?? null;
  const hoveredId = options.clearHover
    ? null
    : typeof (options.hoveredId ?? snapshot.hoveredId) === "string" && lookup.has(options.hoveredId ?? snapshot.hoveredId)
      ? (options.hoveredId ?? snapshot.hoveredId)
      : null;

  const dragSnapshot = options.clearDrag ? null : options.drag ?? snapshot.drag;
  const dragOrigins = (dragSnapshot?.originPositions || [])
    .filter((origin) => typeof origin?.itemId === "string" && lookup.has(origin.itemId))
    .map((origin) => ({
      soundId: origin.itemId,
      x: Number.isFinite(origin.x) ? origin.x : 0,
      y: Number.isFinite(origin.y) ? origin.y : 0,
    }));
  const dragLeadId = typeof dragSnapshot?.leadId === "string" && lookup.has(dragSnapshot.leadId)
    ? dragSnapshot.leadId
    : selectedIds[0] ?? null;
  const drag = dragSnapshot?.active && dragOrigins.length && dragLeadId
    ? {
      active: true,
      leadSoundId: dragLeadId,
      anchorCell: normalizePoint(dragSnapshot.anchorCell),
      previewDelta: normalizePoint(dragSnapshot.previewDelta) || { x: 0, y: 0 },
      originPositions: dragOrigins,
    }
    : null;

  return {
    selectedIds,
    primarySelectedId,
    selectedIndices: selectedIds.map((itemId) => lookup.get(itemId)).filter(Number.isInteger),
    primarySelectedIndex: getObjectIndexById(items, primarySelectedId),
    hoveredId,
    hoveredIndex: getObjectIndexById(items, hoveredId),
    drag,
  };
}
