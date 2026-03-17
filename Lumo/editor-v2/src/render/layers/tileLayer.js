import { TILE_DEFINITIONS } from "../../domain/tiles/tileTypes.js";

export function renderTiles(ctx, doc, viewport) {
  const { width, height, tileSize } = doc.dimensions;
  const cell = tileSize * viewport.zoom;
  const tiles = doc.tiles.base;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = tiles[y * width + x];
      if (!tile) continue;

      const color = TILE_DEFINITIONS[tile]?.color || "#8f9bb4";
      ctx.fillStyle = color;
      ctx.fillRect(
        Math.floor(viewport.offsetX + x * cell) + 1,
        Math.floor(viewport.offsetY + y * cell) + 1,
        Math.ceil(cell - 1),
        Math.ceil(cell - 1)
      );
    }
  }
}
