function getDecorId(decor) {
  return typeof decor?.id === "string" && decor.id.trim() ? decor.id : null;
}

function createDecorIndexLookup(decorItems) {
  const lookup = new Map();
  if (!Array.isArray(decorItems)) return lookup;
  decorItems.forEach((decor, index) => {
    const decorId = getDecorId(decor);
    if (decorId) lookup.set(decorId, index);
  });
  return lookup;
}

function getLegacySelectedDecorIndices(interaction) {
  return Array.isArray(interaction?.selectedDecorIndices) ? interaction.selectedDecorIndices.filter(Number.isInteger) : [];
}

function getLegacyPrimarySelectedDecorIndex(interaction) {
  return Number.isInteger(interaction?.selectedDecorIndex) ? interaction.selectedDecorIndex : null;
}

export function getSelectedDecorIds(interaction) {
  return Array.isArray(interaction?.selectedDecorIds)
    ? interaction.selectedDecorIds.filter((decorId) => typeof decorId === "string" && decorId.trim())
    : [];
}

export function getPrimarySelectedDecorId(interaction) {
  const decorId = interaction?.selectedDecorId;
  return typeof decorId === "string" && decorId.trim() ? decorId : null;
}

export function getSelectedDecorIndices(interaction, decorItems = null) {
  const selectedIds = getSelectedDecorIds(interaction);
  if (Array.isArray(decorItems)) {
    if (!selectedIds.length) return [];
    const lookup = createDecorIndexLookup(decorItems);
    return selectedIds.map((decorId) => lookup.get(decorId)).filter(Number.isInteger);
  }
  return getLegacySelectedDecorIndices(interaction);
}

export function getPrimarySelectedDecorIndex(interaction, decorItems = null) {
  const decorId = getPrimarySelectedDecorId(interaction);
  if (Array.isArray(decorItems)) {
    if (!decorId) return null;
    const index = createDecorIndexLookup(decorItems).get(decorId);
    return Number.isInteger(index) ? index : null;
  }
  return getLegacyPrimarySelectedDecorIndex(interaction);
}

function normalizeSelectionRefs(refs, decorItems) {
  const lookup = createDecorIndexLookup(decorItems);
  const uniqueIds = [];
  const uniqueIndices = [];
  const seenIds = new Set();
  const seenIndices = new Set();

  for (const ref of Array.isArray(refs) ? refs : []) {
    let decorId = null;
    let index = null;

    if (typeof ref === "string") {
      decorId = ref.trim() || null;
      index = decorId ? lookup.get(decorId) : null;
    } else if (Number.isInteger(ref) && ref >= 0 && ref < decorItems.length) {
      index = ref;
      decorId = getDecorId(decorItems[ref]);
    }

    if (decorId && !seenIds.has(decorId)) {
      seenIds.add(decorId);
      uniqueIds.push(decorId);
    }
    if (Number.isInteger(index) && !seenIndices.has(index)) {
      seenIndices.add(index);
      uniqueIndices.push(index);
    }
  }

  uniqueIndices.sort((left, right) => left - right);
  return { ids: uniqueIds, indices: uniqueIndices };
}

function resolvePrimaryRef(primaryRef, ids, decorItems) {
  if (typeof primaryRef === "string") {
    const normalizedId = primaryRef.trim() || null;
    return ids.includes(normalizedId) ? normalizedId : ids.at(-1) ?? null;
  }

  if (Number.isInteger(primaryRef) && Array.isArray(decorItems) && primaryRef >= 0 && primaryRef < decorItems.length) {
    const decorId = getDecorId(decorItems[primaryRef]);
    return decorId && ids.includes(decorId) ? decorId : ids.at(-1) ?? null;
  }

  return ids.at(-1) ?? null;
}

function syncDecorSelectionIndices(interaction, decorItems) {
  const indices = getSelectedDecorIndices(interaction, decorItems);
  const primaryIndex = getPrimarySelectedDecorIndex(interaction, decorItems);
  interaction.selectedDecorIndices = indices;
  interaction.selectedDecorIndex = Number.isInteger(primaryIndex) ? primaryIndex : indices.at(-1) ?? null;
}

export function syncSelectedDecorIndex(interaction, decorItems = null) {
  if (Array.isArray(decorItems)) {
    syncDecorSelectionIndices(interaction, decorItems);
    interaction.selectedDecorId = getPrimarySelectedDecorId(interaction) ?? getSelectedDecorIds(interaction).at(-1) ?? null;
    return interaction.selectedDecorIndex;
  }

  interaction.selectedDecorIndex = getPrimarySelectedDecorIndex(interaction);
  return interaction.selectedDecorIndex;
}

export function setDecorSelection(interaction, refs, primaryRef = null, decorItems = null) {
  if (Array.isArray(decorItems)) {
    const { ids } = normalizeSelectionRefs(refs, decorItems);
    interaction.selectedDecorIds = ids;
    interaction.selectedDecorId = resolvePrimaryRef(primaryRef, ids, decorItems);
    syncDecorSelectionIndices(interaction, decorItems);
    return;
  }

  const nextSelection = [...new Set((Array.isArray(refs) ? refs : []).filter((index) => Number.isInteger(index) && index >= 0))];
  interaction.selectedDecorIndices = nextSelection;
  interaction.selectedDecorIndex =
    Number.isInteger(primaryRef) && nextSelection.includes(primaryRef)
      ? primaryRef
      : nextSelection.length
        ? nextSelection[nextSelection.length - 1]
        : null;
  interaction.selectedDecorIds = [];
  interaction.selectedDecorId = null;
}

export function clearDecorSelection(interaction) {
  interaction.selectedDecorIndices = [];
  interaction.selectedDecorIndex = null;
  interaction.selectedDecorIds = [];
  interaction.selectedDecorId = null;
}

export function isDecorSelected(interaction, ref, decorItems = null) {
  if (typeof ref === "string") {
    return getSelectedDecorIds(interaction).includes(ref);
  }

  if (Number.isInteger(ref) && Array.isArray(decorItems) && ref >= 0 && ref < decorItems.length) {
    const decorId = getDecorId(decorItems[ref]);
    return decorId ? getSelectedDecorIds(interaction).includes(decorId) : getSelectedDecorIndices(interaction, decorItems).includes(ref);
  }

  return getSelectedDecorIndices(interaction, decorItems).includes(ref);
}

export function toggleDecorSelection(interaction, ref, decorItems = null) {
  if (typeof ref !== "string" && !Number.isInteger(ref)) return false;

  if (Array.isArray(decorItems)) {
    const targetId = typeof ref === "string"
      ? ref.trim() || null
      : ref >= 0 && ref < decorItems.length
        ? getDecorId(decorItems[ref])
        : null;
    if (!targetId) return false;

    const selectedIds = new Set(getSelectedDecorIds(interaction));
    if (selectedIds.has(targetId)) {
      selectedIds.delete(targetId);
      setDecorSelection(interaction, [...selectedIds], null, decorItems);
      return false;
    }

    selectedIds.add(targetId);
    setDecorSelection(interaction, [...selectedIds], targetId, decorItems);
    return true;
  }

  if (!Number.isInteger(ref) || ref < 0) return false;

  const selectedIndices = getLegacySelectedDecorIndices(interaction);
  if (selectedIndices.includes(ref)) {
    setDecorSelection(
      interaction,
      selectedIndices.filter((selectedIndex) => selectedIndex !== ref),
      interaction.selectedDecorIndex === ref ? null : interaction.selectedDecorIndex,
    );
    return false;
  }

  setDecorSelection(interaction, [...selectedIndices, ref], ref);
  return true;
}

export function pruneDecorSelection(interaction, decorItemsOrCount) {
  if (Array.isArray(decorItemsOrCount)) {
    const decorItems = decorItemsOrCount;
    const lookup = createDecorIndexLookup(decorItems);
    const selectedIds = getSelectedDecorIds(interaction).filter((decorId) => lookup.has(decorId));
    const primaryId = getPrimarySelectedDecorId(interaction);
    interaction.selectedDecorIds = selectedIds;
    interaction.selectedDecorId = primaryId && lookup.has(primaryId) ? primaryId : selectedIds.at(-1) ?? null;
    syncDecorSelectionIndices(interaction, decorItems);
    return;
  }

  const decorCount = decorItemsOrCount;
  const selectedIndices = getLegacySelectedDecorIndices(interaction).filter((index) => index < decorCount);
  const primaryIndex = getLegacyPrimarySelectedDecorIndex(interaction);
  setDecorSelection(interaction, selectedIndices, primaryIndex !== null && primaryIndex < decorCount ? primaryIndex : null);
}
