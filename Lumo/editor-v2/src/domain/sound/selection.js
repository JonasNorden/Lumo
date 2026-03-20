import { getAuthoredSoundSource } from "./sourceReference.js";

export function getSelectedSoundIndices(interaction) {
  return Array.isArray(interaction?.selectedSoundIndices) ? interaction.selectedSoundIndices.filter(Number.isInteger) : [];
}

export function getPrimarySelectedSoundIndex(interaction) {
  const index = interaction?.selectedSoundIndex;
  return Number.isInteger(index) ? index : null;
}

export function syncSelectedSoundIndex(interaction) {
  const selectedIndices = getSelectedSoundIndices(interaction);
  interaction.selectedSoundIndex = selectedIndices.length ? selectedIndices[selectedIndices.length - 1] : null;
}

export function setSoundSelection(interaction, indices, primaryIndex = null) {
  const uniqueIndices = [...new Set((Array.isArray(indices) ? indices : []).filter(Number.isInteger))].sort((left, right) => left - right);
  interaction.selectedSoundIndices = uniqueIndices;
  interaction.selectedSoundIndex = Number.isInteger(primaryIndex) && uniqueIndices.includes(primaryIndex)
    ? primaryIndex
    : uniqueIndices.length
      ? uniqueIndices[uniqueIndices.length - 1]
      : null;
}

export function clearSoundSelection(interaction) {
  interaction.selectedSoundIndices = [];
  interaction.selectedSoundIndex = null;
}

export function isSoundSelected(interaction, index) {
  return getSelectedSoundIndices(interaction).includes(index);
}

export function toggleSoundSelection(interaction, index) {
  if (!Number.isInteger(index)) return;

  const selectedIndices = new Set(getSelectedSoundIndices(interaction));
  if (selectedIndices.has(index)) {
    selectedIndices.delete(index);
  } else {
    selectedIndices.add(index);
  }

  setSoundSelection(interaction, [...selectedIndices], selectedIndices.has(index) ? index : null);
}

export function pruneSoundSelection(interaction, soundCount) {
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
