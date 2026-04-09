// Builds a small, debug-friendly runtime summary from a validated Recharged level.
export function buildRuntimeLevelSummary(level) {
  const safeLevel = isPlainObject(level) ? level : {};
  const world = isPlainObject(safeLevel.world) ? safeLevel.world : {};
  const layers = isPlainObject(safeLevel.layers) ? safeLevel.layers : {};
  const tilePreview = buildTilePreview(layers.tiles);
  const backgroundPreview = buildBackgroundPreview(layers.background);

  // Keep all collection counts defensive so malformed debug input is still readable.
  const counts = {
    tiles: countArrayEntries(layers.tiles),
    background: countArrayEntries(layers.background),
    decor: countArrayEntries(layers.decor),
    entities: countArrayEntries(layers.entities),
    audio: countArrayEntries(layers.audio),
  };

  return {
    world: {
      width: world.width,
      height: world.height,
      tileSize: world.tileSize,
    },
    spawn: isPlainObject(world.spawn) ? { ...world.spawn } : null,
    counts,
    themeId: safeLevel.identity?.themeId,
    formatVersion: safeLevel.identity?.formatVersion,
    tilePreview,
    backgroundPreview,
  };
}

// Treat only real arrays as layer collections.
function countArrayEntries(value) {
  return Array.isArray(value) ? value.length : 0;
}

// Builds a tiny text-friendly tile sample for quick runtime debug checks.
function buildTilePreview(tilesLayer) {
  if (!Array.isArray(tilesLayer)) {
    return [];
  }

  return tilesLayer.slice(0, 5).map((tile) => ({
    tileId: tile?.tileId,
    x: tile?.x,
    y: tile?.y,
    w: tile?.w,
    h: tile?.h,
  }));
}

// Builds a tiny text-friendly background sample for quick parallax debug checks.
function buildBackgroundPreview(backgroundLayer) {
  if (!Array.isArray(backgroundLayer)) {
    return [];
  }

  return backgroundLayer.slice(0, 5).map((backgroundLayerEntry) => ({
    backgroundId: backgroundLayerEntry?.backgroundId,
    order: backgroundLayerEntry?.order,
    parallax: backgroundLayerEntry?.parallax,
  }));
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
