import { getBrushCells, resolveBrushSize } from "../../domain/tiles/brushSize.js";
import { EDITOR_TOOLS } from "../../domain/tiles/tools.js";
import { getLineCells } from "../../domain/tiles/line.js";

function isPreviewTool(activeTool) {
  return (
    activeTool === EDITOR_TOOLS.PAINT ||
    activeTool === EDITOR_TOOLS.ERASE ||
    activeTool === EDITOR_TOOLS.RECT ||
    activeTool === EDITOR_TOOLS.LINE
  );
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
    return interaction.hoverCell ? getBrushCells(interaction.hoverCell, brushSize) : [];
  }

  const bounds = getRectBounds(interaction.rectDrag.startCell, interaction.hoverCell);
  const cells = [];

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      cells.push(...getBrushCells({ x, y }, brushSize));
    }
  }

  return cells;
}

function getLinePreviewCells(interaction, brushDraft) {
  const brushSize = resolveBrushSize(brushDraft);

  if (interaction.activeTool !== EDITOR_TOOLS.LINE || !interaction.lineDrag?.active || !interaction.lineDrag.startCell || !interaction.hoverCell) {
    return interaction.hoverCell ? getBrushCells(interaction.hoverCell, brushSize) : [];
  }

  const cells = [];
  const lineCells = getLineCells(interaction.lineDrag.startCell, interaction.hoverCell);

  for (const lineCell of lineCells) {
    cells.push(...getBrushCells(lineCell, brushSize));
  }

  return cells;
}

export function renderBrushPreviewOverlay(ctx, doc, viewport, interaction, brushDraft) {
  if (!isPreviewTool(interaction.activeTool)) return;
  if (!interaction.hoverCell) return;

  const brushCells = interaction.activeTool === EDITOR_TOOLS.LINE
    ? getLinePreviewCells(interaction, brushDraft)
    : getRectPreviewCells(interaction, brushDraft);
  const tileSize = doc.dimensions.tileSize;
  const { width, height } = doc.dimensions;
  const zoomedTileSize = tileSize * viewport.zoom;
  const style = getPreviewStyle(interaction.activeTool);

  for (const cell of brushCells) {
    if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) continue;

    const px = Math.floor(viewport.offsetX + cell.x * zoomedTileSize);
    const py = Math.floor(viewport.offsetY + cell.y * zoomedTileSize);
    const size = Math.ceil(zoomedTileSize);

    ctx.fillStyle = style.fill;
    ctx.fillRect(px, py, size, size);

    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
  }
}
