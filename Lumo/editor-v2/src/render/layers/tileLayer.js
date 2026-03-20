import { TILE_DEFINITIONS } from "../../domain/tiles/tileTypes.js";
import { getSpriteImage, isSpriteReady } from "../../domain/assets/imageAssets.js";
import { getTileAssetByTileValue } from "../../domain/tiles/tileSpriteCatalog.js";

function drawTileSprite(ctx, asset, screenX, screenY, cellSize, zoom) {
  if (!asset?.img) return false;

  const image = getSpriteImage(asset.img);
  if (!isSpriteReady(image)) return false;

  const drawWidth = (Number.isFinite(asset.drawW) ? asset.drawW : 24) * zoom;
  const drawHeight = (Number.isFinite(asset.drawH) ? asset.drawH : 24) * zoom;
  const drawOffX = (Number.isFinite(asset.drawOffX) ? asset.drawOffX : 0) * zoom;
  const drawOffY = (Number.isFinite(asset.drawOffY) ? asset.drawOffY : 0) * zoom;
  const drawX = screenX + drawOffX;
  const drawY = asset.drawAnchor === "BL"
    ? screenY + cellSize - drawHeight + drawOffY
    : screenY + drawOffY;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, Math.floor(drawX), Math.floor(drawY), Math.round(drawWidth), Math.round(drawHeight));
  return true;
}

export function renderTiles(ctx, doc, viewport) {
  const { width, height, tileSize } = doc.dimensions;
  const cell = tileSize * viewport.zoom;
  const tiles = doc.tiles.base;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = tiles[y * width + x];
      if (!tile) continue;

      const screenX = viewport.offsetX + x * cell;
      const screenY = viewport.offsetY + y * cell;
      const tileAsset = getTileAssetByTileValue(tile);
      if (drawTileSprite(ctx, tileAsset, screenX, screenY, cell, viewport.zoom)) {
        continue;
      }

      const color = TILE_DEFINITIONS[tile]?.color || "#8f9bb4";
      ctx.fillStyle = color;
      ctx.fillRect(
        Math.floor(screenX) + 1,
        Math.floor(screenY) + 1,
        Math.ceil(cell - 1),
        Math.ceil(cell - 1)
      );
    }
  }
}
