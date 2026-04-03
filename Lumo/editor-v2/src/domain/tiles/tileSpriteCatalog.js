function resolveTileScriptCatalog() {
  if (typeof window === "undefined") return [];
  if (Array.isArray(window.LUMO_CATALOG_TILES)) return window.LUMO_CATALOG_TILES;
  if (window.__LUMO_TILE_CATALOG_SCRIPT_STATUS?.loading) {
    throw new Error("Tile catalog script is still loading; editor catalog bootstrap ran too early.");
  }
  return [];
}

const TILE_SCRIPT_CATALOG = resolveTileScriptCatalog();

if (
  typeof window !== "undefined"
  && window.__LUMO_TILE_CATALOG_SCRIPT_STATUS?.exists
  && TILE_SCRIPT_CATALOG.length === 0
) {
  console.warn("[editor-v2] TILE_SCRIPT_CATALOG is empty even though data/catalog_tiles.js was loaded. Check catalog export content.");
}

const DEFAULT_SUPPORTED_TILE_SIZES = [1, 2, 3];

const TILE_RULE_OVERRIDES = {
  15: {
    supportedSizes: [1, 2, 3],
    drawW: 24,
    drawH: 24,
    drawAnchor: "TL",
    footprint: { w: 1, h: 1 },
  },
};

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
  15: {
    id: "stone_ct",
    name: "Stone CT",
    img: "../data/assets/tiles/stone_ct.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "TL",
  },
};

const CORE_BRUSH_CATALOG_ORDER = [
  "soil_c",
  "soil_bl",
  "soil_br",
  "grass_bt",
  "grass_bl",
  "grass_br",
  "ice_00",
  "ice_01",
  "stone_ct",
];

const GUARDED_CORE_TILE_IDS = {
  15: "stone_ct",
};

function normalizeSupportedSizes(rawSupportedSizes) {
  if (!Array.isArray(rawSupportedSizes) || rawSupportedSizes.length === 0) {
    return [...DEFAULT_SUPPORTED_TILE_SIZES];
  }

  const normalized = rawSupportedSizes
    .map((size) => Number.parseInt(size, 10))
    .filter((size) => Number.isInteger(size) && size >= 1 && size <= 3);

  return normalized.length ? [...new Set(normalized)].sort((a, b) => a - b) : [...DEFAULT_SUPPORTED_TILE_SIZES];
}

function normalizeTileEntry(entry) {
  if (!entry || !Number.isInteger(entry.tileId)) return null;

  const tileRules = TILE_RULE_OVERRIDES[entry.tileId] || null;
  return {
    id: entry.id || `tile-${entry.tileId}`,
    tileId: entry.tileId,
    label: entry.name || entry.id || `Tile ${entry.tileId}`,
    img: entry.img ? `../${String(entry.img).replace(/^\.?\//, "")}` : null,
    drawW: Number.isFinite(tileRules?.drawW) ? tileRules.drawW : Number.isFinite(entry.drawW) ? entry.drawW : 24,
    drawH: Number.isFinite(tileRules?.drawH) ? tileRules.drawH : Number.isFinite(entry.drawH) ? entry.drawH : 24,
    drawAnchor: tileRules?.drawAnchor === "BL"
      ? "BL"
      : tileRules?.drawAnchor === "TL"
        ? "TL"
        : entry.drawAnchor === "BL"
          ? "BL"
          : "TL",
    drawOffX: Number.isFinite(entry.drawOffX) ? entry.drawOffX : 0,
    drawOffY: Number.isFinite(entry.drawOffY) ? entry.drawOffY : 0,
    footprint: tileRules?.footprint || entry.footprint || { w: 1, h: 1 },
    supportedSizes: normalizeSupportedSizes(tileRules?.supportedSizes || entry.supportedSizes),
    collisionType: entry.collisionType || null,
    group: entry.group || "Tiles",
  };
}

const CATALOG_TILE_ENTRIES = TILE_SCRIPT_CATALOG
  .map(normalizeTileEntry)
  .filter(Boolean);

function normalizeCatalogIdForCompare(value) {
  return String(value || "").trim().toLowerCase();
}

const TILE_ASSETS = new Map();

for (const entry of CATALOG_TILE_ENTRIES) {
  const guardedCatalogId = GUARDED_CORE_TILE_IDS[entry.tileId] || null;
  if (guardedCatalogId && normalizeCatalogIdForCompare(entry.id) !== normalizeCatalogIdForCompare(guardedCatalogId)) {
    continue;
  }
  TILE_ASSETS.set(entry.tileId, entry);
}

for (const [tileId, override] of Object.entries(TILE_DRAW_OVERRIDES)) {
  const numericTileId = Number(tileId);
  if (TILE_ASSETS.has(numericTileId)) continue;
  const tileRules = TILE_RULE_OVERRIDES[numericTileId] || null;
  TILE_ASSETS.set(numericTileId, {
    tileId: numericTileId,
    label: override.name,
    ...override,
    footprint: tileRules?.footprint || { w: 1, h: 1 },
    supportedSizes: normalizeSupportedSizes(tileRules?.supportedSizes),
    drawOffX: 0,
    drawOffY: 0,
    group: "Core",
  });
}

function toBrushSpriteOption(tileAsset) {
  const catalogId = String(tileAsset?.id || "").trim();
  if (!catalogId) return null;
  return {
    id: catalogId,
    value: catalogId,
    label: tileAsset?.label || catalogId,
    tileId: tileAsset?.tileId,
    img: tileAsset?.img || null,
    drawW: tileAsset?.drawW || 24,
    drawH: tileAsset?.drawH || 24,
    drawAnchor: tileAsset?.drawAnchor || "TL",
    drawOffX: Number.isFinite(tileAsset?.drawOffX) ? tileAsset.drawOffX : 0,
    drawOffY: Number.isFinite(tileAsset?.drawOffY) ? tileAsset.drawOffY : 0,
    footprint: tileAsset?.footprint || { w: 1, h: 1 },
    supportedSizes: normalizeSupportedSizes(tileAsset?.supportedSizes),
    collisionType: tileAsset?.collisionType || null,
    group: tileAsset?.group || "Tiles",
  };
}

function getCoreBrushOrderIndex(catalogId) {
  const normalizedCatalogId = normalizeCatalogIdForCompare(catalogId);
  const index = CORE_BRUSH_CATALOG_ORDER.findIndex((value) => value === normalizedCatalogId);
  return index >= 0 ? index : Number.POSITIVE_INFINITY;
}

function buildInitialBrushSpriteOptions() {
  const seenCatalogIds = new Set();
  return CATALOG_TILE_ENTRIES
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const leftOrder = getCoreBrushOrderIndex(left.entry?.id);
      const rightOrder = getCoreBrushOrderIndex(right.entry?.id);
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.index - right.index;
    })
    .map(({ entry }) => toBrushSpriteOption(entry))
    .filter((option) => {
      if (!option || !Number.isInteger(option.tileId)) return false;
      const normalizedCatalogId = normalizeCatalogIdForCompare(option.value);
      if (!normalizedCatalogId || seenCatalogIds.has(normalizedCatalogId)) return false;
      seenCatalogIds.add(normalizedCatalogId);
      return true;
    });
}

export const BRUSH_SPRITE_OPTIONS = buildInitialBrushSpriteOptions();

function findTileEntryByCatalogId(catalogId) {
  const normalizedCatalogId = normalizeCatalogIdForCompare(catalogId);
  return CATALOG_TILE_ENTRIES.find((entry) => normalizeCatalogIdForCompare(entry?.id) === normalizedCatalogId)
    || Array.from(TILE_ASSETS.values()).find((entry) => normalizeCatalogIdForCompare(entry?.id) === normalizedCatalogId)
    || null;
}

for (const coreCatalogId of CORE_BRUSH_CATALOG_ORDER) {
  if (BRUSH_SPRITE_OPTIONS.some((option) => normalizeCatalogIdForCompare(option.value) === coreCatalogId)) continue;
  const fallbackOption = toBrushSpriteOption(findTileEntryByCatalogId(coreCatalogId));
  if (fallbackOption) BRUSH_SPRITE_OPTIONS.push(fallbackOption);
}

const TILE_CATALOG_IDS = new Set(
  CATALOG_TILE_ENTRIES
    .map((entry) => normalizeCatalogIdForCompare(entry?.id))
    .filter((value) => value.length > 0),
);

for (const option of BRUSH_SPRITE_OPTIONS) {
  const catalogId = normalizeCatalogIdForCompare(option?.id || option?.value);
  if (catalogId) TILE_CATALOG_IDS.add(catalogId);
}

export function isTileCatalogIdTaken(catalogId) {
  const normalized = normalizeCatalogIdForCompare(catalogId);
  return normalized.length > 0 && TILE_CATALOG_IDS.has(normalized);
}

export function registerTileSpriteOption(entry) {
  if (!entry || !Number.isInteger(entry.tileId)) {
    return { ok: false, reason: "invalid-tile-id" };
  }

  const catalogId = String(entry.catalogId || entry.id || entry.value || "").trim();
  if (!catalogId) {
    return { ok: false, reason: "missing-catalog-id" };
  }
  if (isTileCatalogIdTaken(catalogId)) {
    return { ok: false, reason: "duplicate-catalog-id" };
  }

  const normalizedOption = {
    id: catalogId,
    value: catalogId,
    label: entry.label || catalogId,
    tileId: entry.tileId,
    img: entry.img || null,
    drawW: Number.isFinite(entry.drawW) ? entry.drawW : 24,
    drawH: Number.isFinite(entry.drawH) ? entry.drawH : 24,
    drawAnchor: entry.drawAnchor === "BL" ? "BL" : "TL",
    drawOffX: Number.isFinite(entry.drawOffX) ? entry.drawOffX : 0,
    drawOffY: Number.isFinite(entry.drawOffY) ? entry.drawOffY : 0,
    footprint: entry.footprint || { w: 1, h: 1 },
    supportedSizes: normalizeSupportedSizes(entry.supportedSizes),
    collisionType: entry.collisionType || null,
    group: entry.group || "Custom",
  };

  BRUSH_SPRITE_OPTIONS.push(normalizedOption);
  TILE_CATALOG_IDS.add(catalogId.toLowerCase());

  const guardedCatalogId = GUARDED_CORE_TILE_IDS[normalizedOption.tileId] || null;
  if (!guardedCatalogId || normalizeCatalogIdForCompare(normalizedOption.id) === normalizeCatalogIdForCompare(guardedCatalogId)) {
    TILE_ASSETS.set(normalizedOption.tileId, {
      tileId: normalizedOption.tileId,
      id: normalizedOption.id,
      label: normalizedOption.label,
      img: normalizedOption.img,
      drawW: normalizedOption.drawW,
      drawH: normalizedOption.drawH,
      drawAnchor: normalizedOption.drawAnchor,
      drawOffX: normalizedOption.drawOffX,
      drawOffY: normalizedOption.drawOffY,
      footprint: normalizedOption.footprint,
      supportedSizes: normalizedOption.supportedSizes,
      collisionType: normalizedOption.collisionType,
      group: normalizedOption.group,
    });
  }

  return { ok: true, option: normalizedOption };
}

export function getTileAssetByTileValue(tileValue) {
  return TILE_ASSETS.get(tileValue) || null;
}

export function findBrushSpriteOptionByValue(value) {
  return BRUSH_SPRITE_OPTIONS.find((option) => option.value === value) || null;
}

function parseBrushSizeValue(sizeValue) {
  if (typeof sizeValue !== "string") return null;
  const [widthToken, heightToken] = sizeValue.toLowerCase().split("x");
  const width = Number.parseInt(widthToken, 10);
  const height = Number.parseInt(heightToken, 10);
  if (!Number.isInteger(width) || width !== height || width < 1 || width > 3) return null;
  return width;
}

export function getSupportedSizesForBrushSprite(spriteValue) {
  const sprite = findBrushSpriteOptionByValue(spriteValue);
  return normalizeSupportedSizes(sprite?.supportedSizes);
}

export function getFallbackBrushSizeForSprite(spriteValue) {
  const supportedSizes = getSupportedSizesForBrushSprite(spriteValue);
  const fallbackSize = supportedSizes.includes(1) ? 1 : supportedSizes[0] || 1;
  return `${fallbackSize}x${fallbackSize}`;
}

export function isBrushSizeSupportedForSprite(sizeValue, spriteValue) {
  const size = parseBrushSizeValue(sizeValue);
  if (!Number.isInteger(size)) return false;
  return getSupportedSizesForBrushSprite(spriteValue).includes(size);
}
