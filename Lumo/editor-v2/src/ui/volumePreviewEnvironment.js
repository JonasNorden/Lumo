export const VOLUME_PREVIEW_ENVIRONMENT = "stone-lane-v1";
export const VOLUME_PREVIEW_TILE_SIZE_PX = 24;
export const VOLUME_PREVIEW_GROUND_BASELINE_PX = 14;
export const VOLUME_PREVIEW_LANE_START_RATIO = 0.14;
export const VOLUME_PREVIEW_LANE_END_RATIO = 0.86;

export function getVolumePreviewEnvironmentMetrics(worldWidth, worldHeight) {
  const tileSize = VOLUME_PREVIEW_TILE_SIZE_PX;
  const groundY = worldHeight - VOLUME_PREVIEW_GROUND_BASELINE_PX;
  const floorTopY = groundY - tileSize;
  const laneStartX = Math.round(worldWidth * VOLUME_PREVIEW_LANE_START_RATIO);
  const laneEndX = Math.round(worldWidth * VOLUME_PREVIEW_LANE_END_RATIO);
  return {
    tileSize,
    groundY,
    floorTopY,
    laneStartX,
    laneEndX,
  };
}
