import { getAuthoredSoundSource } from "./sourceReference.js";

function getSoundId(sound) {
  return typeof sound?.id === "string" && sound.id.trim() ? sound.id : null;
}

function createSoundIndexLookup(sounds) {
  const lookup = new Map();
  if (!Array.isArray(sounds)) return lookup;
  sounds.forEach((sound, index) => {
    const soundId = getSoundId(sound);
    if (soundId) lookup.set(soundId, index);
  });
  return lookup;
}

function getLegacySelectedSoundIndices(interaction) {
  return Array.isArray(interaction?.selectedSoundIndices) ? interaction.selectedSoundIndices.filter(Number.isInteger) : [];
}

function getLegacyPrimarySelectedSoundIndex(interaction) {
  const index = interaction?.selectedSoundIndex;
  return Number.isInteger(index) ? index : null;
}

export function getSelectedSoundIds(interaction) {
  return Array.isArray(interaction?.selectedSoundIds)
    ? interaction.selectedSoundIds.filter((soundId) => typeof soundId === "string" && soundId.trim())
    : [];
}

export function getPrimarySelectedSoundId(interaction) {
  const soundId = interaction?.selectedSoundId;
  return typeof soundId === "string" && soundId.trim() ? soundId : null;
}

export function getSelectedSoundIndices(interaction, sounds = null) {
  const selectedIds = getSelectedSoundIds(interaction);
  if (Array.isArray(sounds)) {
    if (!selectedIds.length) return [];
    const lookup = createSoundIndexLookup(sounds);
    return selectedIds.map((soundId) => lookup.get(soundId)).filter(Number.isInteger);
  }
  return getLegacySelectedSoundIndices(interaction);
}

export function getPrimarySelectedSoundIndex(interaction, sounds = null) {
  const soundId = getPrimarySelectedSoundId(interaction);
  if (Array.isArray(sounds)) {
    if (!soundId) return null;
    const index = createSoundIndexLookup(sounds).get(soundId);
    return Number.isInteger(index) ? index : null;
  }
  return getLegacyPrimarySelectedSoundIndex(interaction);
}

function normalizeSelectionRefs(refs, sounds) {
  const lookup = createSoundIndexLookup(sounds);
  const uniqueIds = [];
  const seenIds = new Set();
  const uniqueIndices = [];
  const seenIndices = new Set();

  for (const ref of Array.isArray(refs) ? refs : []) {
    let soundId = null;
    let index = null;

    if (typeof ref === "string") {
      soundId = ref.trim() || null;
      index = soundId ? lookup.get(soundId) : null;
    } else if (Number.isInteger(ref) && Array.isArray(sounds) && ref >= 0 && ref < sounds.length) {
      index = ref;
      soundId = getSoundId(sounds[ref]);
    }

    if (soundId && !seenIds.has(soundId)) {
      seenIds.add(soundId);
      uniqueIds.push(soundId);
    }
    if (Number.isInteger(index) && !seenIndices.has(index)) {
      seenIndices.add(index);
      uniqueIndices.push(index);
    }
  }

  uniqueIndices.sort((left, right) => left - right);
  return { ids: uniqueIds, indices: uniqueIndices };
}

function resolvePrimaryRef(primaryRef, ids, indices, sounds) {
  if (typeof primaryRef === "string") {
    const normalizedId = primaryRef.trim() || null;
    return ids.includes(normalizedId) ? normalizedId : ids.at(-1) ?? null;
  }

  if (Number.isInteger(primaryRef) && Array.isArray(sounds) && primaryRef >= 0 && primaryRef < sounds.length) {
    const soundId = getSoundId(sounds[primaryRef]);
    return soundId && ids.includes(soundId) ? soundId : ids.at(-1) ?? null;
  }

  return ids.at(-1) ?? null;
}

function syncSoundSelectionIndices(interaction, sounds) {
  const indices = getSelectedSoundIndices(interaction, sounds);
  const primaryIndex = getPrimarySelectedSoundIndex(interaction, sounds);
  interaction.selectedSoundIndices = indices;
  interaction.selectedSoundIndex = Number.isInteger(primaryIndex) ? primaryIndex : indices.at(-1) ?? null;
}

export function syncSelectedSoundIndex(interaction, sounds = null) {
  if (Array.isArray(sounds)) {
    syncSoundSelectionIndices(interaction, sounds);
    interaction.selectedSoundId = getPrimarySelectedSoundId(interaction) ?? getSelectedSoundIds(interaction).at(-1) ?? null;
    return;
  }

  const selectedIndices = getLegacySelectedSoundIndices(interaction);
  interaction.selectedSoundIndex = selectedIndices.length ? selectedIndices[selectedIndices.length - 1] : null;
}

export function setSoundSelection(interaction, refs, primaryRef = null, sounds = null) {
  if (Array.isArray(sounds)) {
    const { ids, indices } = normalizeSelectionRefs(refs, sounds);
    interaction.selectedSoundIds = ids;
    interaction.selectedSoundId = resolvePrimaryRef(primaryRef, ids, indices, sounds);
    syncSoundSelectionIndices(interaction, sounds);
    return;
  }

  const uniqueIndices = [...new Set((Array.isArray(refs) ? refs : []).filter(Number.isInteger))].sort((left, right) => left - right);
  interaction.selectedSoundIndices = uniqueIndices;
  interaction.selectedSoundIndex = Number.isInteger(primaryRef) && uniqueIndices.includes(primaryRef)
    ? primaryRef
    : uniqueIndices.length
      ? uniqueIndices[uniqueIndices.length - 1]
      : null;
}

export function clearSoundSelection(interaction) {
  interaction.selectedSoundIndices = [];
  interaction.selectedSoundIndex = null;
  interaction.selectedSoundIds = [];
  interaction.selectedSoundId = null;
}

export function isSoundSelected(interaction, ref, sounds = null) {
  if (typeof ref === "string") {
    return getSelectedSoundIds(interaction).includes(ref);
  }

  if (Number.isInteger(ref) && Array.isArray(sounds) && ref >= 0 && ref < sounds.length) {
    const soundId = getSoundId(sounds[ref]);
    return soundId ? getSelectedSoundIds(interaction).includes(soundId) : getSelectedSoundIndices(interaction, sounds).includes(ref);
  }

  return getSelectedSoundIndices(interaction, sounds).includes(ref);
}

export function toggleSoundSelection(interaction, ref, sounds = null) {
  if (typeof ref !== "string" && !Number.isInteger(ref)) return;

  if (Array.isArray(sounds)) {
    const targetId = typeof ref === "string"
      ? ref.trim() || null
      : ref >= 0 && ref < sounds.length
        ? getSoundId(sounds[ref])
        : null;
    if (!targetId) return;

    const selectedIds = new Set(getSelectedSoundIds(interaction));
    if (selectedIds.has(targetId)) {
      selectedIds.delete(targetId);
    } else {
      selectedIds.add(targetId);
    }

    setSoundSelection(interaction, [...selectedIds], selectedIds.has(targetId) ? targetId : null, sounds);
    return;
  }

  const selectedIndices = new Set(getSelectedSoundIndices(interaction));
  if (selectedIndices.has(ref)) {
    selectedIndices.delete(ref);
  } else {
    selectedIndices.add(ref);
  }

  setSoundSelection(interaction, [...selectedIndices], selectedIndices.has(ref) ? ref : null);
}

export function pruneSoundSelection(interaction, soundsOrCount) {
  if (Array.isArray(soundsOrCount)) {
    const sounds = soundsOrCount;
    const lookup = createSoundIndexLookup(sounds);
    const selectedIds = getSelectedSoundIds(interaction).filter((soundId) => lookup.has(soundId));
    const primaryId = getPrimarySelectedSoundId(interaction);
    interaction.selectedSoundIds = selectedIds;
    interaction.selectedSoundId = primaryId && lookup.has(primaryId) ? primaryId : selectedIds.at(-1) ?? null;
    syncSoundSelectionIndices(interaction, sounds);
    return;
  }

  const soundCount = soundsOrCount;
  const selectedIndices = getSelectedSoundIndices(interaction).filter((index) => index < soundCount);
  const primaryIndex = getPrimarySelectedSoundIndex(interaction);
  setSoundSelection(interaction, selectedIndices, primaryIndex !== null && primaryIndex < soundCount ? primaryIndex : null);
}

export function findMatchingSoundIndices(sounds, referenceIndex, options = {}) {
  if (!Array.isArray(sounds) || !Number.isInteger(referenceIndex) || referenceIndex < 0 || referenceIndex >= sounds.length) {
    return [];
  }

  const referenceSound = sounds[referenceIndex];
  if (!referenceSound) return [];

  const matchType = options.matchType !== false;
  const matchSource = Boolean(options.matchSource);
  const referenceSource = getAuthoredSoundSource(referenceSound) || null;

  return sounds
    .map((sound, index) => ({ sound, index }))
    .filter(({ sound }) => Boolean(sound))
    .filter(({ sound }) => {
      if (matchType && sound.type !== referenceSound.type) return false;
      if (matchSource && (getAuthoredSoundSource(sound) || null) !== referenceSource) return false;
      return true;
    })
    .map(({ index }) => index);
}
