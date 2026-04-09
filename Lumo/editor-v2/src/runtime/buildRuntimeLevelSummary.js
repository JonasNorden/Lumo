// Builds a small, debug-friendly runtime summary from a validated Recharged level.
export function buildRuntimeLevelSummary(level) {
  const safeLevel = isPlainObject(level) ? level : {};
  const world = isPlainObject(safeLevel.world) ? safeLevel.world : {};
  const layers = isPlainObject(safeLevel.layers) ? safeLevel.layers : {};
  const tilePreview = buildTilePreview(layers.tiles);
  const backgroundPreview = buildBackgroundPreview(layers.background);
  const decorPreview = buildDecorPreview(layers.decor);
  const entityPreview = buildEntityPreview(layers.entities);
  const audioPreview = buildAudioPreview(layers.audio);

  // Keep all collection counts defensive so malformed debug input is still readable.
  const counts = {
    tiles: countArrayEntries(layers.tiles),
    background: countArrayEntries(layers.background),
    decor: countArrayEntries(layers.decor),
    entities: countArrayEntries(layers.entities),
    audio: countArrayEntries(layers.audio),
  };

  const summary = {
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
    decorPreview,
    entityPreview,
    audioPreview,
  };

  // Readiness is derived from summary data only, so debug output stays consistent and defensive.
  summary.readiness = {
    hasWorld: hasWorldData(summary.world),
    hasSpawn: isPlainObject(summary.spawn),
    hasTiles: hasLayerEntries(summary.counts.tiles),
    hasBackground: hasLayerEntries(summary.counts.background),
    hasDecor: hasLayerEntries(summary.counts.decor),
    hasEntities: hasLayerEntries(summary.counts.entities),
    hasAudio: hasLayerEntries(summary.counts.audio),
  };

  return summary;
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

// Builds a tiny text-friendly decor sample for quick placement/order debug checks.
function buildDecorPreview(decorLayer) {
  if (!Array.isArray(decorLayer)) {
    return [];
  }

  return decorLayer.slice(0, 5).map((decorLayerEntry) => ({
    decorId: decorLayerEntry?.decorId,
    x: decorLayerEntry?.x,
    y: decorLayerEntry?.y,
    order: decorLayerEntry?.order,
  }));
}

// Builds a tiny text-friendly entity sample for quick placement/type debug checks.
function buildEntityPreview(entitiesLayer) {
  if (!Array.isArray(entitiesLayer)) {
    return [];
  }

  return entitiesLayer.slice(0, 5).map((entityLayerEntry) => ({
    entityType: entityLayerEntry?.entityType,
    x: entityLayerEntry?.x,
    y: entityLayerEntry?.y,
  }));
}

// Builds a tiny text-friendly audio sample for quick placement/type debug checks.
function buildAudioPreview(audioLayer) {
  if (!Array.isArray(audioLayer)) {
    return [];
  }

  return audioLayer.slice(0, 5).map((audioLayerEntry) => ({
    audioId: audioLayerEntry?.audioId,
    audioType: audioLayerEntry?.audioType,
    x: audioLayerEntry?.x,
    y: audioLayerEntry?.y,
  }));
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Keeps readiness checks strict enough for quick debug confidence in core world data.
function hasWorldData(worldSummary) {
  if (!isPlainObject(worldSummary)) {
    return false;
  }

  return (
    Number.isFinite(worldSummary.width) &&
    Number.isFinite(worldSummary.height) &&
    Number.isFinite(worldSummary.tileSize)
  );
}

// Ensures readiness booleans stay resilient if count fields are missing or malformed.
function hasLayerEntries(count) {
  return Number.isInteger(count) && count > 0;
}
