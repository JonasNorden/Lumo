export function isObjectPlacementPreviewSuppressed(interaction) {
  return Boolean(
    interaction?.objectPlacementPreviewSuppressed
    || interaction?.soundPlacementPreviewSuppressed,
  );
}
