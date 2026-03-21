export function getSelectedEntityIndices(interaction) {
  return Array.isArray(interaction.selectedEntityIndices) ? interaction.selectedEntityIndices : [];
}

export function getPrimarySelectedEntityIndex(interaction) {
  const selectedIndices = getSelectedEntityIndices(interaction);
  if (Number.isInteger(interaction.selectedEntityIndex) && selectedIndices.includes(interaction.selectedEntityIndex)) {
    return interaction.selectedEntityIndex;
  }

  return selectedIndices.length ? selectedIndices[selectedIndices.length - 1] : null;
}

export function syncSelectedEntityIndex(interaction) {
  interaction.selectedEntityIndex = getPrimarySelectedEntityIndex(interaction);
  return interaction.selectedEntityIndex;
}

export function setEntitySelection(interaction, indices, primaryIndex = null) {
  const nextSelection = [...new Set(indices.filter((index) => Number.isInteger(index) && index >= 0))];
  interaction.selectedEntityIndices = nextSelection;
  interaction.selectedEntityIndex =
    Number.isInteger(primaryIndex) && nextSelection.includes(primaryIndex)
      ? primaryIndex
      : nextSelection.length
        ? nextSelection[nextSelection.length - 1]
        : null;
  interaction.selectedEntityIds = [];
  interaction.selectedEntityId = null;
}

export function clearEntitySelection(interaction) {
  interaction.selectedEntityIndices = [];
  interaction.selectedEntityIndex = null;
  interaction.selectedEntityIds = [];
  interaction.selectedEntityId = null;
}

export function isEntitySelected(interaction, index) {
  return getSelectedEntityIndices(interaction).includes(index);
}

export function toggleEntitySelection(interaction, index) {
  if (!Number.isInteger(index) || index < 0) return false;

  const selectedIndices = getSelectedEntityIndices(interaction);
  if (selectedIndices.includes(index)) {
    setEntitySelection(
      interaction,
      selectedIndices.filter((selectedIndex) => selectedIndex !== index),
      interaction.selectedEntityIndex === index ? null : interaction.selectedEntityIndex,
    );
    return false;
  }

  setEntitySelection(interaction, [...selectedIndices, index], index);
  return true;
}

export function pruneEntitySelection(interaction, entityCount) {
  const selectedIndices = getSelectedEntityIndices(interaction).filter((index) => index < entityCount);
  setEntitySelection(interaction, selectedIndices, interaction.selectedEntityIndex);
}
