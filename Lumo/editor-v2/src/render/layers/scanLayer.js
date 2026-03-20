import { getScanRange, isScanPlaying } from "../../domain/scan/scanSystem.js";

function getScreenX(viewport, tileSize, worldX) {
  return viewport.offsetX + worldX * tileSize * viewport.zoom;
}

function drawRangeMarker(ctx, viewport, tileSize, x, color, dashed = true) {
  const screenX = getScreenX(viewport, tileSize, x);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  if (dashed) ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(screenX + 0.5, 0);
  ctx.lineTo(screenX + 0.5, ctx.canvas.height);
  ctx.stroke();
  ctx.restore();
  return screenX;
}

export function renderScanOverlay(ctx, doc, viewport, scan) {
  if (!doc || !scan) return;

  const tileSize = doc.dimensions.tileSize;
  const { startX, endX } = getScanRange(scan, doc);
  const hasCustomStart = Number.isFinite(scan.startX);
  const hasCustomEnd = Number.isFinite(scan.endX);

  ctx.save();

  if (hasCustomStart) {
    drawRangeMarker(ctx, viewport, tileSize, startX, "rgba(129, 209, 255, 0.34)");
  }

  if (hasCustomEnd) {
    drawRangeMarker(ctx, viewport, tileSize, endX, "rgba(255, 180, 120, 0.34)");
  }

  const scanScreenX = getScreenX(viewport, tileSize, scan.positionX ?? startX);
  const gradient = ctx.createLinearGradient(scanScreenX, 0, scanScreenX + 14, 0);
  gradient.addColorStop(0, "rgba(136, 232, 255, 0.12)");
  gradient.addColorStop(1, "rgba(136, 232, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(scanScreenX - 5, 0, 14, ctx.canvas.height);

  ctx.strokeStyle = isScanPlaying(scan) ? "rgba(144, 238, 255, 0.95)" : "rgba(144, 238, 255, 0.65)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(scanScreenX + 0.5, 0);
  ctx.lineTo(scanScreenX + 0.5, ctx.canvas.height);
  ctx.stroke();

  ctx.fillStyle = isScanPlaying(scan) ? "rgba(144, 238, 255, 0.95)" : "rgba(144, 238, 255, 0.7)";
  ctx.fillRect(scanScreenX - 3, 8, 7, 7);

  ctx.restore();
}
