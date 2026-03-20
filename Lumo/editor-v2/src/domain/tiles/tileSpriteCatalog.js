const TILE_SCRIPT_CATALOG = typeof window !== "undefined" && Array.isArray(window.LUMO_CATALOG_TILES)
  ? window.LUMO_CATALOG_TILES
  : [];

const TILE_DRAW_OVERRIDES = {
  0: {
    id: "void_1",
    name: "Void",
    img: "../data/assets/sprites/bg/void_c.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "TL",
  },
  1: {
    id: "solid",
    name: "Solid",
    img: "../data/assets/tiles/soil_c.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "TL",
  },
  2: {
    id: "platform",
    name: "Platform",
    img: "../data/assets/tiles/soil_bc.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "TL",
  },
  3: {
    id: "hazard",
    name: "Hazard",
    img: "../data/assets/tiles/lava_01.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "TL",
  },
  4: {
    id: "ice_01",
    name: "Ice 01",
    img: "../data/assets/tiles/ice_01.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "TL",
  },
  5: {
    id: "brake",
    name: "Brake",
    img: "../data/assets/tiles/ice_10.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "TL",
  },
};

function normalizeTileEntry(entry) {
  if (!entry || !Number.isInteger(entry.tileId)) return null;

  return {
    id: entry.id || `tile-${entry.tileId}`,
    tileId: entry.tileId,
    label: entry.name || entry.id || `Tile ${entry.tileId}`,
    img: entry.img ? `../${String(entry.img).replace(/^\.?\//, "")}` : null,
    drawW: Number.isFinite(entry.drawW) ? entry.drawW : 24,
    drawH: Number.isFinite(entry.drawH) ? entry.drawH : 24,
    drawAnchor: entry.drawAnchor === "BL" ? "BL" : "TL",
    drawOffX: Number.isFinite(entry.drawOffX) ? entry.drawOffX : 0,
    drawOffY: Number.isFinite(entry.drawOffY) ? entry.drawOffY : 0,
    footprint: entry.footprint || { w: 1, h: 1 },
    collisionType: entry.collisionType || null,
    group: entry.group || "Tiles",
  };
}

const CATALOG_TILE_ENTRIES = TILE_SCRIPT_CATALOG
  .map(normalizeTileEntry)
  .filter(Boolean);

const TILE_ASSETS = new Map(
  CATALOG_TILE_ENTRIES.map((entry) => [entry.tileId, entry]),
);

for (const [tileId, override] of Object.entries(TILE_DRAW_OVERRIDES)) {
  const numericTileId = Number(tileId);
  if (TILE_ASSETS.has(numericTileId)) continue;
  TILE_ASSETS.set(numericTileId, {
    tileId: numericTileId,
    label: override.name,
    ...override,
    footprint: { w: 1, h: 1 },
    drawOffX: 0,
    drawOffY: 0,
    group: "Core",
  });
}

export const BRUSH_SPRITE_OPTIONS = [
  { value: "soil_c", label: "Soil C", tileId: 12 },
  { value: "soil_bl", label: "Soil BL", tileId: 10 },
  { value: "soil_br", label: "Soil BR", tileId: 11 },
  { value: "grass_bt", label: "Grass BT", tileId: 6 },
  { value: "grass_bl", label: "Grass BL", tileId: 7 },
  { value: "grass_br", label: "Grass BR", tileId: 8 },
  { value: "ice_00", label: "Ice 00", tileId: 16 },
  { value: "ice_01", label: "Ice 01", tileId: 4 },
  { value: "stone_ct", label: "Stone CT", tileId: 15 },
  { value: "lava_01", label: "Lava 01", tileId: 3 },
  { value: "void_1", label: "Void", tileId: 0 },
].map((option) => {
  const tileAsset = TILE_ASSETS.get(option.tileId);
  return {
    ...option,
    img: tileAsset?.img || null,
    drawW: tileAsset?.drawW || 24,
    drawH: tileAsset?.drawH || 24,
    drawAnchor: tileAsset?.drawAnchor || "TL",
  };
});

export function getTileAssetByTileValue(tileValue) {
  return TILE_ASSETS.get(tileValue) || null;
}

export function findBrushSpriteOptionByValue(value) {
  return BRUSH_SPRITE_OPTIONS.find((option) => option.value === value) || null;
}
