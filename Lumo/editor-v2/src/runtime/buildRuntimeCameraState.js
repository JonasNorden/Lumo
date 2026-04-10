function toFiniteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

// Builds a compact follow-camera/viewport offset model for runtime bridge canvas rendering.
export function buildRuntimeCameraState(input = {}) {
  const worldWidthPx = toFiniteOrNull(input?.worldWidthPx);
  const worldHeightPx = toFiniteOrNull(input?.worldHeightPx);
  const viewportWidthPx = toFiniteOrNull(input?.viewportWidthPx);
  const viewportHeightPx = toFiniteOrNull(input?.viewportHeightPx);
  const fallbackX = toFiniteOrNull(input?.fallbackX) ?? 0;
  const fallbackY = toFiniteOrNull(input?.fallbackY) ?? 0;

  if (
    worldWidthPx === null ||
    worldHeightPx === null ||
    viewportWidthPx === null ||
    viewportHeightPx === null ||
    viewportWidthPx <= 0 ||
    viewportHeightPx <= 0
  ) {
    return {
      ok: false,
      cameraX: 0,
      cameraY: 0,
      targetX: fallbackX,
      targetY: fallbackY,
      warnings: ["buildRuntimeCameraState requires finite world/viewport pixel dimensions."],
    };
  }

  const targetX = toFiniteOrNull(input?.targetX) ?? fallbackX;
  const targetY = toFiniteOrNull(input?.targetY) ?? fallbackY;
  const maxX = Math.max(0, worldWidthPx - viewportWidthPx);
  const maxY = Math.max(0, worldHeightPx - viewportHeightPx);
  const rawCameraX = targetX - viewportWidthPx * 0.5;
  const rawCameraY = targetY - viewportHeightPx * 0.62;

  return {
    ok: true,
    cameraX: clamp(rawCameraX, 0, maxX),
    cameraY: clamp(rawCameraY, 0, maxY),
    targetX,
    targetY,
    warnings: [],
  };
}
