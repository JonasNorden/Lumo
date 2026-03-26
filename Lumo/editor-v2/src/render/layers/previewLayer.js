import { resolveBrushSize, snapCellToBrushStep } from "../../domain/tiles/brushSize.js";
import { EDITOR_TOOLS } from "../../domain/tiles/tools.js";
import { getLineCells } from "../../domain/tiles/line.js";
import { getFogVolumeWorldRectFromDragCells } from "../../domain/entities/specialVolumeTypes.js";
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
  renderDecorPlacementPreview(ctx, doc, viewport, interaction, presets?.decor || null);
  renderEntityPlacementPreview(ctx, doc, viewport, interaction, presets?.entity || null);
  renderSoundPlacementPreview(ctx, doc, viewport, interaction, presets?.sound || null);
}

export function renderFogVolumePlacementPreview(ctx, doc, viewport, interaction) {
  const drag = interaction?.volumePlacementDrag;
  if (!drag?.active || drag.type !== "fog_volume") return;
  const tileSize = doc?.dimensions?.tileSize;
  const dragRect = getFogVolumeWorldRectFromDragCells(drag.startCell, drag.endCell, tileSize, drag.thicknessPx);
  if (!dragRect) return;
  const width = Math.max(1, (dragRect.x1 - dragRect.x0) * viewport.zoom);
  const height = Math.max(1, (dragRect.y1 - dragRect.y0) * viewport.zoom);
  const x = viewport.offsetX + dragRect.x0 * viewport.zoom;
  const y = viewport.offsetY + dragRect.y0 * viewport.zoom;

  ctx.save();
  ctx.fillStyle = "rgba(158, 198, 255, 0.20)";
  ctx.strokeStyle = "rgba(195, 223, 255, 0.92)";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([7, 5]);
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, width - 1), Math.max(0, height - 1));
  ctx.setLineDash([]);
  ctx.restore();
}
