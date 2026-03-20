import { getScanPlaybackState, getScanRange } from "../../domain/scan/scanSystem.js";

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

function getScanVisualState(scan) {
  const playbackState = getScanPlaybackState(scan);
  if (playbackState === "playing") {
    return {
      bandAlpha: 0.18,
      coreColor: "rgba(163, 241, 255, 0.96)",
      accentColor: "rgba(143, 232, 255, 0.86)",
      lineWidth: 2.4,
      headFill: "rgba(163, 241, 255, 0.92)",
      headStroke: "rgba(219, 249, 255, 0.95)",
      dash: [],
      label: "PLAY",
    };
  }
  if (playbackState === "paused") {
    return {
      bandAlpha: 0.12,
      coreColor: "rgba(255, 220, 153, 0.88)",
      accentColor: "rgba(255, 180, 116, 0.82)",
      lineWidth: 2,
      headFill: "rgba(255, 201, 122, 0.92)",
      headStroke: "rgba(255, 237, 210, 0.96)",
      dash: [8, 6],
      label: "PAUSE",
    };
  }
  return {
    bandAlpha: 0.08,
    coreColor: "rgba(137, 193, 214, 0.62)",
    accentColor: "rgba(96, 152, 176, 0.58)",
    lineWidth: 1.6,
    headFill: "rgba(108, 165, 188, 0.74)",
    headStroke: "rgba(216, 242, 255, 0.56)",
    dash: [4, 8],
    label: "IDLE",
  };
}

function drawPlayheadHead(ctx, screenX, visualState) {
  const pillWidth = 28;
  const pillHeight = 14;
  const pillX = screenX - pillWidth * 0.5;
  const pillY = 10;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 7);
  ctx.fillStyle = visualState.headFill;
  ctx.shadowColor = visualState.accentColor;
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = visualState.headStroke;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "rgba(9, 14, 22, 0.88)";
  if (visualState.label === "PAUSE") {
    ctx.fillRect(screenX - 5, pillY + 3, 3, pillHeight - 6);
    ctx.fillRect(screenX + 2, pillY + 3, 3, pillHeight - 6);
  } else if (visualState.label === "PLAY") {
    ctx.beginPath();
    ctx.moveTo(screenX - 3, pillY + 3);
    ctx.lineTo(screenX + 5, pillY + pillHeight * 0.5);
    ctx.lineTo(screenX - 3, pillY + pillHeight - 3);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(screenX, pillY + pillHeight * 0.5, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function renderScanOverlay(ctx, doc, viewport, scan) {
  if (!doc || !scan) return;

  const tileSize = doc.dimensions.tileSize;
  const { startX, endX } = getScanRange(scan, doc);
  const hasCustomStart = Number.isFinite(scan.startX);
  const hasCustomEnd = Number.isFinite(scan.endX);
  const visualState = getScanVisualState(scan);

  ctx.save();

  if (hasCustomStart) {
    drawRangeMarker(ctx, viewport, tileSize, startX, "rgba(129, 209, 255, 0.34)");
  }

  if (hasCustomEnd) {
    drawRangeMarker(ctx, viewport, tileSize, endX, "rgba(255, 180, 120, 0.34)");
  }

  const scanScreenX = getScreenX(viewport, tileSize, scan.positionX ?? startX);
  const bandWidth = visualState.label === "PLAY" ? 24 : 18;
  const gradient = ctx.createLinearGradient(scanScreenX - bandWidth, 0, scanScreenX + bandWidth, 0);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(0.5, visualState.accentColor.replace(/0\.[0-9]+\)$/, `${visualState.bandAlpha})`));
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(scanScreenX - bandWidth, 0, bandWidth * 2, ctx.canvas.height);

  ctx.strokeStyle = visualState.coreColor;
  ctx.lineWidth = visualState.lineWidth;
  ctx.setLineDash(visualState.dash);
  ctx.beginPath();
  ctx.moveTo(scanScreenX + 0.5, 0);
  ctx.lineTo(scanScreenX + 0.5, ctx.canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = visualState.accentColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(scanScreenX - 2.5, 0);
  ctx.lineTo(scanScreenX - 2.5, ctx.canvas.height);
  ctx.moveTo(scanScreenX + 3.5, 0);
  ctx.lineTo(scanScreenX + 3.5, ctx.canvas.height);
  ctx.stroke();

  drawPlayheadHead(ctx, scanScreenX + 0.5, visualState);

  ctx.restore();
}
