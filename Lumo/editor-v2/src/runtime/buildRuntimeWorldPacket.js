// Safe defaults keep packet shape stable when upstream runtime parts are missing.
const DEFAULT_IDENTITY = { id: "", name: "", formatVersion: "", themeId: "" };
const DEFAULT_META = { title: "", author: "", difficulty: "", tags: [] };
const DEFAULT_WORLD = { width: 0, height: 0, tileSize: 0 };
const DEFAULT_SPAWN = { x: 0, y: 0 };
const DEFAULT_LAYERS = { tiles: [], background: [], bg: [], decor: [], entities: [], audio: [] };
const DEFAULT_TILE_BOUNDS = { count: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
const DEFAULT_TILE_MAP = { count: 0, keys: [], byKey: {} };

function cloneBgLayer(bg) {
  if (Array.isArray(bg)) {
    return [...bg];
  }

  if (bg && typeof bg === "object" && Array.isArray(bg.data)) {
    return {
      ...bg,
      data: [...bg.data],
    };
  }

  return [...DEFAULT_LAYERS.bg];
}

// Builds a single runtime world packet from already computed runtime pieces.
export function buildRuntimeWorldPacket(parts) {
  const skeleton = parts?.skeleton ?? {};

  // Copy with defensive fallbacks so this helper has no side effects.
  const identity = {
    id: skeleton?.identity?.id ?? DEFAULT_IDENTITY.id,
    name: skeleton?.identity?.name ?? DEFAULT_IDENTITY.name,
    formatVersion: skeleton?.identity?.formatVersion ?? DEFAULT_IDENTITY.formatVersion,
    themeId: skeleton?.identity?.themeId ?? DEFAULT_IDENTITY.themeId,
  };
  const meta = {
    title: skeleton?.meta?.title ?? DEFAULT_META.title,
    author: skeleton?.meta?.author ?? DEFAULT_META.author,
    difficulty: skeleton?.meta?.difficulty ?? DEFAULT_META.difficulty,
    tags: Array.isArray(skeleton?.meta?.tags) ? [...skeleton.meta.tags] : [...DEFAULT_META.tags],
  };
  const world = {
    width: skeleton?.world?.width ?? DEFAULT_WORLD.width,
    height: skeleton?.world?.height ?? DEFAULT_WORLD.height,
    tileSize: skeleton?.world?.tileSize ?? DEFAULT_WORLD.tileSize,
  };
  const spawn = {
    x: skeleton?.spawn?.x ?? DEFAULT_SPAWN.x,
    y: skeleton?.spawn?.y ?? DEFAULT_SPAWN.y,
  };
  const layers = {
    tiles: Array.isArray(skeleton?.layers?.tiles)
      ? [...skeleton.layers.tiles]
      : [...DEFAULT_LAYERS.tiles],
    background: Array.isArray(skeleton?.layers?.background)
      ? [...skeleton.layers.background]
      : [...DEFAULT_LAYERS.background],
    // Preserve bg object/array payload through packetization without collapsing object form.
    bg: cloneBgLayer(skeleton?.layers?.bg),
    decor: Array.isArray(skeleton?.layers?.decor)
      ? [...skeleton.layers.decor]
      : [...DEFAULT_LAYERS.decor],
    entities: Array.isArray(skeleton?.layers?.entities)
      ? [...skeleton.layers.entities]
      : [...DEFAULT_LAYERS.entities],
    audio: Array.isArray(skeleton?.layers?.audio)
      ? [...skeleton.layers.audio]
      : [...DEFAULT_LAYERS.audio],
  };

  // Keep tileBounds/tileMap sourced directly from runtime part outputs.
  const tileBounds = {
    count: parts?.tileBounds?.count ?? DEFAULT_TILE_BOUNDS.count,
    minX: parts?.tileBounds?.minX ?? DEFAULT_TILE_BOUNDS.minX,
    minY: parts?.tileBounds?.minY ?? DEFAULT_TILE_BOUNDS.minY,
    maxX: parts?.tileBounds?.maxX ?? DEFAULT_TILE_BOUNDS.maxX,
    maxY: parts?.tileBounds?.maxY ?? DEFAULT_TILE_BOUNDS.maxY,
  };
  const tileMap = {
    count: parts?.tileMap?.count ?? DEFAULT_TILE_MAP.count,
    keys: Array.isArray(parts?.tileMap?.keys) ? [...parts.tileMap.keys] : [...DEFAULT_TILE_MAP.keys],
    byKey:
      parts?.tileMap?.byKey && typeof parts.tileMap.byKey === "object"
        ? { ...parts.tileMap.byKey }
        : { ...DEFAULT_TILE_MAP.byKey },
  };

  return {
    identity,
    meta,
    world,
    spawn,
    layers,
    tileBounds,
    tileMap,
  };
}
