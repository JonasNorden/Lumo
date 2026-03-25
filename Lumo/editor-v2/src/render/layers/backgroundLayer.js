import { getSpriteImage, isSpriteReady } from "../../domain/assets/imageAssets.js";
import { getBackgroundMaterialById } from "../../domain/background/materialCatalog.js";

function drawBackgroundPlaceholder(ctx, material, screenX, screenY, cellSize, zoom) {
  const drawWidth = (Number.isFinite(material?.drawW) ? material.drawW : 24) * zoom;
  const drawHeight = (Number.isFinite(material?.drawH) ? material.drawH : 24) * zoom;
  const drawOffX = (Number.isFinite(material?.drawOffX) ? material.drawOffX : 0) * zoom;
  const drawOffY = (Number.isFinite(material?.drawOffY) ? material.drawOffY : 0) * zoom;
  const drawX = Math.floor(screenX + drawOffX);
  const drawY = Math.floor(screenY + cellSize - drawHeight + drawOffY);

  ctx.fillStyle = material?.fallbackColor || "#44546f";
  ctx.fillRect(drawX, drawY, Math.round(drawWidth), Math.round(drawHeight));
  ctx.strokeStyle = "rgba(8, 12, 18, 0.45)";
  ctx.strokeRect(drawX + 0.5, drawY + 0.5, Math.max(1, Math.round(drawWidth) - 1), Math.max(1, Math.round(drawHeight) - 1));
}

function drawBackgroundMaterial(ctx, material, screenX, screenY, cellSize, zoom) {
  if (!material) return;
  const drawWidth = (Number.isFinite(material.drawW) ? material.drawW : 24) * zoom;
  const drawHeight = (Number.isFinite(material.drawH) ? material.drawH : 24) * zoom;
  const drawOffX = (Number.isFinite(material.drawOffX) ? material.drawOffX : 0) * zoom;
  const drawOffY = (Number.isFinite(material.drawOffY) ? material.drawOffY : 0) * zoom;
  const drawX = screenX + drawOffX;
  const drawY = screenY + cellSize - drawHeight + drawOffY;

  const image = material?.img ? getSpriteImage(material.img) : null;
  if (!isSpriteReady(image)) {
    drawBackgroundPlaceholder(ctx, material, screenX, screenY, cellSize, zoom);
    return;
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, Math.floor(drawX), Math.floor(drawY), Math.round(drawWidth), Math.round(drawHeight));
}

export function renderBackground(ctx, doc, viewport) {
  const { width, height, tileSize } = doc.dimensions;
  const base = doc.background?.base;
  if (!Array.isArray(base)) return;

  const cell = tileSize * viewport.zoom;
  const authoredMaterials = doc.background?.materials || [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const materialId = base[y * width + x];
      if (!materialId) continue;
      const material = getBackgroundMaterialById(materialId, authoredMaterials) || {
        id: materialId,
        label: materialId,
        drawW: 24,
        drawH: 24,
        drawAnchor: "BL",
        drawOffX: 0,
        drawOffY: 0,
        fallbackColor: "#5f6c82",
      };
      const screenX = viewport.offsetX + x * cell;
      const screenY = viewport.offsetY + y * cell;
      drawBackgroundMaterial(ctx, material, screenX, screenY, cell, viewport.zoom);
    }
  }
}
