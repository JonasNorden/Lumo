import { getTileAssetByTileValue } from "./tileSpriteCatalog.js";

function createTileDefinition(tileValue, fallback) {
  const asset = getTileAssetByTileValue(tileValue);

  return {
    kind: tileValue,
    label: asset?.label || fallback.label,
    color: fallback.color,
    img: asset?.img || null,
  };
}

/** @type {Record<number, {kind: number, label: string, color: string, img?: string | null}>} */
export const TILE_DEFINITIONS = {
  0: createTileDefinition(0, { label: "Void", color: "#10182b" }),
  1: createTileDefinition(1, { label: "Solid", color: "#5cb8ff" }),
  2: createTileDefinition(2, { label: "Platform", color: "#7ba6ff" }),
  3: createTileDefinition(3, { label: "Hazard", color: "#ff6d7e" }),
  4: createTileDefinition(4, { label: "Ice 01", color: "#7cdcff" }),
  5: createTileDefinition(5, { label: "Brake", color: "#8d95a7" }),
  6: createTileDefinition(6, { label: "Grass BT", color: "#5b9f62" }),
  7: createTileDefinition(7, { label: "Grass BL", color: "#5b9f62" }),
  8: createTileDefinition(8, { label: "Grass BR", color: "#5b9f62" }),
  9: createTileDefinition(9, { label: "Soil BC", color: "#8b6646" }),
  10: createTileDefinition(10, { label: "Soil BL", color: "#8b6646" }),
  11: createTileDefinition(11, { label: "Soil BR", color: "#8b6646" }),
  12: createTileDefinition(12, { label: "Soil C", color: "#8b6646" }),
  13: createTileDefinition(13, { label: "Soil CL", color: "#8b6646" }),
  14: createTileDefinition(14, { label: "Soil CR", color: "#8b6646" }),
  15: createTileDefinition(15, { label: "Stone CT", color: "#7082a1" }),
  16: createTileDefinition(16, { label: "Ice 00", color: "#80dfff" }),
};
