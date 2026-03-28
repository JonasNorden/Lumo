import { resolveBrushSize, snapCellToBrushStep } from "../../domain/tiles/brushSize.js";
import { EDITOR_TOOLS } from "../../domain/tiles/tools.js";
import { getLineCells } from "../../domain/tiles/line.js";
import {
  getFogVolumeWorldRectFromDragCells,
  getWaterVolumeWorldRectFromDragCells,
} from "../../domain/entities/specialVolumeTypes.js";
import { renderDecorPlacementPreview } from "./decorLayer.js";
import { renderEntityPlacementPreview } from "./entityLayer.js";
import { renderSoundPlacementPreview } from "./soundLayer.js";

function isPreviewTool(activeTool) {
  return (
    activeTool === EDITOR_TOOLS.PAINT ||
    activeTool === EDITOR_TOOLS.ERASE ||
    activeTool === EDITOR_TOOLS.RECT ||
    activeTool === EDITOR_TOOLS.LINE
  );
}

function isTileStylePreviewLayer(activeLayer) {
  return activeLayer === "tiles" || activeLayer === "background" || activeLayer == null;
}

function getPreviewStyle(activeTool) {
  if (activeTool === EDITOR_TOOLS.ERASE) {
    return {
      fill: "rgba(255, 107, 107, 0.22)",
      stroke: "rgba(255, 133, 133, 0.65)",
    };
  }

  return {
    fill: "rgba(90, 214, 143, 0.22)",
    stroke: "rgba(129, 235, 174, 0.65)",
  };
}

function getRectBounds(startCell, endCell) {
  return {
    minX: Math.min(startCell.x, endCell.x),
    maxX: Math.max(startCell.x, endCell.x),
    minY: Math.min(startCell.y, endCell.y),
    maxY: Math.max(startCell.y, endCell.y),
  };
}

function getRectPreviewCells(interaction, brushDraft) {
  const brushSize = resolveBrushSize(brushDraft);

  if (interaction.activeTool !== EDITOR_TOOLS.RECT || !interaction.rectDrag?.active || !interaction.rectDrag.startCell || !interaction.hoverCell) {
    return interaction.hoverCell ? [interaction.hoverCell] : [];
  }

  const startCell = interaction.rectDrag.startCell;
  const bounds = getRectBounds(startCell, interaction.hoverCell);
  const cells = [];
  const seenAnchors = new Set();

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const anchor = snapCellToBrushStep({ x, y }, startCell, brushSize);
      const key = `${anchor.x}:${anchor.y}`;
      if (seenAnchors.has(key)) continue;
      seenAnchors.add(key);
      cells.push(anchor);
    }
  }

  return cells;
}

function getLinePreviewCells(interaction, brushDraft) {
  const brushSize = resolveBrushSize(brushDraft);

  if (interaction.activeTool !== EDITOR_TOOLS.LINE || !interaction.lineDrag?.active || !interaction.lineDrag.startCell || !interaction.hoverCell) {
    return interaction.hoverCell ? [interaction.hoverCell] : [];
  }

  const cells = [];
  const startCell = interaction.lineDrag.startCell;
  const lineCells = getLineCells(startCell, interaction.hoverCell);
  const seenAnchors = new Set();

  for (const lineCell of lineCells) {
    const anchor = snapCellToBrushStep(lineCell, startCell, brushSize);
    const key = `${anchor.x}:${anchor.y}`;
    if (seenAnchors.has(key)) continue;
    seenAnchors.add(key);
    cells.push(anchor);
  }

  return cells;
}

function getPreviewAnchors(interaction, brushDraft) {
  if (interaction.activeTool === EDITOR_TOOLS.LINE) {
    return getLinePreviewCells(interaction, brushDraft);
  }
  return getRectPreviewCells(interaction, brushDraft);
}

export function renderBrushPreviewOverlay(ctx, doc, viewport, interaction, brushDraft) {
  if (!isPreviewTool(interaction.activeTool)) return;
  if (!isTileStylePreviewLayer(interaction.activeLayer)) return;
  if (!interaction.hoverCell) return;

  const brushCells = getPreviewAnchors(interaction, brushDraft);
  const brushSize = resolveBrushSize(brushDraft);
  const tileSize = doc.dimensions.tileSize;
  const { width, height } = doc.dimensions;
  const zoomedTileSize = tileSize * viewport.zoom;
  const footprintWidth = Math.max(1, brushSize.width);
  const footprintHeight = Math.max(1, brushSize.height);
  const style = getPreviewStyle(interaction.activeTool);

  for (const cell of brushCells) {
    const minY = cell.y - (footprintHeight - 1);
    if (cell.x < 0 || minY < 0 || cell.x + footprintWidth - 1 >= width || cell.y >= height) continue;

    const px = Math.floor(viewport.offsetX + cell.x * zoomedTileSize);
    const py = Math.floor(viewport.offsetY + minY * zoomedTileSize);
    const widthPx = Math.ceil(zoomedTileSize * footprintWidth);
    const heightPx = Math.ceil(zoomedTileSize * footprintHeight);

    ctx.fillStyle = style.fill;
    ctx.fillRect(px, py, widthPx, heightPx);

    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, widthPx - 1, heightPx - 1);
  }
}

export function renderPlacementPreviewOverlay(ctx, doc, viewport, interaction, presets) {
  renderFogVolumePlacementPreview(ctx, doc, viewport, interaction);
  renderWaterVolumePlacementPreview(ctx, doc, viewport, interaction);
  renderDecorPlacementPreview(ctx, doc, viewport, interaction, presets?.decor || null);
  renderEntityPlacementPreview(ctx, doc, viewport, interaction, presets?.entity || null);
  renderSoundPlacementPreview(ctx, doc, viewport, interaction, presets?.sound || null);
}

export function renderFogVolumePlacementPreview(ctx, doc, viewport, interaction) {
  const drag = interaction?.volumePlacementDrag;
  if (!drag?.active || drag.type !== "fog_volume") return;
  if (!drag.startCell || !drag.endCell) return;

  const fogRect = getFogVolumeWorldRectFromDragCells(
    drag.startCell,
    drag.endCell,
    doc?.dimensions?.tileSize || 24,
    drag.thicknessPx,
  );
  if (!fogRect) return;

  const zoom = viewport?.zoom || 1;
  const screenX = viewport.offsetX + fogRect.x * zoom;
  const screenY = viewport.offsetY + (fogRect.y - fogRect.height) * zoom;
  const screenWidth = fogRect.width * zoom;
  const screenHeight = fogRect.height * zoom;
  const lineWidth = Math.max(1, 1.25 * (1 / Math.max(0.35, zoom)));

  ctx.save();
  ctx.fillStyle = "rgba(186, 215, 255, 0.14)";
  ctx.fillRect(screenX, screenY, screenWidth, screenHeight);

  const glow = ctx.createLinearGradient(screenX, screenY, screenX, screenY + screenHeight);
  glow.addColorStop(0, "rgba(226, 239, 255, 0.18)");
  glow.addColorStop(0.72, "rgba(200, 226, 255, 0.07)");
  glow.addColorStop(1, "rgba(120, 156, 214, 0.02)");
  ctx.fillStyle = glow;
  ctx.fillRect(screenX, screenY, screenWidth, screenHeight);

  ctx.strokeStyle = "rgba(196, 227, 255, 0.9)";
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([Math.max(8, 10 * zoom), Math.max(5, 6 * zoom)]);
  ctx.strokeRect(screenX + lineWidth * 0.5, screenY + lineWidth * 0.5, Math.max(0, screenWidth - lineWidth), Math.max(0, screenHeight - lineWidth));
  ctx.setLineDash([]);

  const baselineY = viewport.offsetY + fogRect.y * zoom;
  ctx.strokeStyle = "rgba(214, 236, 255, 0.6)";
  ctx.lineWidth = Math.max(1, lineWidth * 0.9);
  ctx.beginPath();
  ctx.moveTo(screenX, baselineY + 0.5);
  ctx.lineTo(screenX + screenWidth, baselineY + 0.5);
  ctx.stroke();
  ctx.restore();
}

export function renderWaterVolumePlacementPreview(ctx, doc, viewport, interaction) {
  const drag = interaction?.volumePlacementDrag;
  if (!drag?.active || drag.type !== "water_volume") return;
  if (!drag.startCell || !drag.endCell) return;

  const waterRect = getWaterVolumeWorldRectFromDragCells(
    drag.startCell,
    drag.endCell,
    doc?.dimensions?.tileSize || 24,
    drag.depthPx,
  );
  if (!waterRect) return;
  const zoom = viewport?.zoom || 1;
  const screenX = viewport.offsetX + waterRect.x * zoom;
  const screenY = viewport.offsetY + (waterRect.y - waterRect.height) * zoom;
  const screenWidth = waterRect.width * zoom;
  const screenHeight = waterRect.height * zoom;
  const lineWidth = Math.max(1, 1.25 * (1 / Math.max(0.35, zoom)));

  ctx.save();
  const bodyGradient = ctx.createLinearGradient(screenX, screenY, screenX, screenY + screenHeight);
  bodyGradient.addColorStop(0, "rgba(98, 193, 255, 0.28)");
  bodyGradient.addColorStop(1, "rgba(12, 91, 170, 0.38)");
  ctx.fillStyle = bodyGradient;
  ctx.fillRect(screenX, screenY, screenWidth, screenHeight);
  ctx.strokeStyle = "rgba(152, 228, 255, 0.88)";
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([Math.max(8, 10 * zoom), Math.max(5, 6 * zoom)]);
  ctx.strokeRect(screenX + lineWidth * 0.5, screenY + lineWidth * 0.5, Math.max(0, screenWidth - lineWidth), Math.max(0, screenHeight - lineWidth));
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(screenX, screenY + 0.5);
  ctx.lineTo(screenX + screenWidth, screenY + 0.5);
  ctx.strokeStyle = "rgba(197, 243, 255, 0.94)";
  ctx.lineWidth = Math.max(1, lineWidth);
  ctx.stroke();
  ctx.restore();
}
