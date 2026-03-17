import { getBrushCells, resolveBrushSize } from "../../domain/tiles/brushSize.js";
import { EDITOR_TOOLS } from "../../domain/tiles/tools.js";

function isPreviewTool(activeTool) {
  return activeTool === EDITOR_TOOLS.PAINT || activeTool === EDITOR_TOOLS.ERASE;
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

export function renderBrushPreviewOverlay(ctx, doc, viewport, interaction, brushDraft) {
  if (!isPreviewTool(interaction.activeTool)) return;
  if (!interaction.hoverCell) return;

  const brushSize = resolveBrushSize(brushDraft);
  const brushCells = getBrushCells(interaction.hoverCell, brushSize);
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
