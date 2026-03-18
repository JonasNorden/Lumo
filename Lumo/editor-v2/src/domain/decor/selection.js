export function getSelectedDecorIndices(interaction) {
  return Array.isArray(interaction.selectedDecorIndices) ? interaction.selectedDecorIndices : [];
}

export function getPrimarySelectedDecorIndex(interaction) {
  const selectedIndices = getSelectedDecorIndices(interaction);
  if (Number.isInteger(interaction.selectedDecorIndex) && selectedIndices.includes(interaction.selectedDecorIndex)) {
    return interaction.selectedDecorIndex;
  }

  return selectedIndices.length ? selectedIndices[selectedIndices.length - 1] : null;
}

export function syncSelectedDecorIndex(interaction) {
  interaction.selectedDecorIndex = getPrimarySelectedDecorIndex(interaction);
  return interaction.selectedDecorIndex;
}

export function setDecorSelection(interaction, indices, primaryIndex = null) {
  const nextSelection = [...new Set(indices.filter((index) => Number.isInteger(index) && index >= 0))];
  interaction.selectedDecorIndices = nextSelection;
  interaction.selectedDecorIndex =
    Number.isInteger(primaryIndex) && nextSelection.includes(primaryIndex)
      ? primaryIndex
      : nextSelection.length
        ? nextSelection[nextSelection.length - 1]
        : null;
}

export function clearDecorSelection(interaction) {
  interaction.selectedDecorIndices = [];
  interaction.selectedDecorIndex = null;
}

export function isDecorSelected(interaction, index) {
  return getSelectedDecorIndices(interaction).includes(index);
}

export function toggleDecorSelection(interaction, index) {
  if (!Number.isInteger(index) || index < 0) return false;

  const selectedIndices = getSelectedDecorIndices(interaction);
  if (selectedIndices.includes(index)) {
    setDecorSelection(
      interaction,
      selectedIndices.filter((selectedIndex) => selectedIndex !== index),
      interaction.selectedDecorIndex === index ? null : interaction.selectedDecorIndex,
    );
    return false;
  }

  setDecorSelection(interaction, [...selectedIndices, index], index);
  return true;
}

export function pruneDecorSelection(interaction, decorCount) {
  const selectedIndices = getSelectedDecorIndices(interaction).filter((index) => index < decorCount);
  setDecorSelection(interaction, selectedIndices, interaction.selectedDecorIndex);
}
