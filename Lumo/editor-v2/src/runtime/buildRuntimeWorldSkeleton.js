// Builds a minimal runtime world shape from an already validated level.
export function buildRuntimeWorldSkeleton(level) {
  // Keep world dimensions explicit so downstream runtime steps are easy to inspect.
  const world = {
    width: level?.world?.width,
    height: level?.world?.height,
    tileSize: level?.world?.tileSize,
  };

  // Keep spawn as-is from validated input; loader already enforces structure.
  const spawn = level?.world?.spawn;

  // Defensive layer fallbacks keep the skeleton stable for partial samples.
  const layers = {
    tiles: Array.isArray(level?.layers?.tiles) ? level.layers.tiles : [],
    background: Array.isArray(level?.layers?.background) ? level.layers.background : [],
    decor: Array.isArray(level?.layers?.decor) ? level.layers.decor : [],
    entities: Array.isArray(level?.layers?.entities) ? level.layers.entities : [],
    audio: Array.isArray(level?.layers?.audio) ? level.layers.audio : [],
  };

  return {
    world,
    spawn,
    layers,
  };
}
