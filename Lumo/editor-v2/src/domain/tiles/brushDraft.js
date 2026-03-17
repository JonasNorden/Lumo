import {
  BRUSH_BEHAVIOR_OPTIONS,
  BRUSH_SIZE_OPTIONS,
  BRUSH_SPRITE_OPTIONS,
} from "./brushOptions.js";

const DEFAULT_BRUSH_ID = "default-brush";

function hasOption(options, value) {
  return options.some((option) => option.value === value);
}

function getOptionLabel(options, value, fallback = "Unknown") {
  return options.find((option) => option.value === value)?.label || fallback;
}

export function createDefaultBrushDraft() {
  return {
    id: DEFAULT_BRUSH_ID,
    label: "Primary Brush",
    behavior: BRUSH_BEHAVIOR_OPTIONS[0].value,
    size: BRUSH_SIZE_OPTIONS[0].value,
    sprite: BRUSH_SPRITE_OPTIONS[0].value,
  };
}

export function isBrushDraftValid(brushDraft) {
  return (
    hasOption(BRUSH_BEHAVIOR_OPTIONS, brushDraft.behavior) &&
    hasOption(BRUSH_SIZE_OPTIONS, brushDraft.size) &&
    hasOption(BRUSH_SPRITE_OPTIONS, brushDraft.sprite)
  );
}

export function getBrushDraftSummary(brushDraft) {
  const behaviorLabel = getOptionLabel(BRUSH_BEHAVIOR_OPTIONS, brushDraft.behavior);
  const sizeLabel = getOptionLabel(BRUSH_SIZE_OPTIONS, brushDraft.size);
  const spriteLabel = getOptionLabel(BRUSH_SPRITE_OPTIONS, brushDraft.sprite);

  return `${behaviorLabel} · ${sizeLabel} · ${spriteLabel}`;
}
