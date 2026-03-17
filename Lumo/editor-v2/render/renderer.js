import { drawGrid } from "./gridLayer.js";
import { fitCanvasToDisplaySize } from "./viewport.js";

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");

  function render(state) {
    const { width, height } = fitCanvasToDisplaySize(canvas);

    ctx.fillStyle = "#0e1522";
    ctx.fillRect(0, 0, width, height);

    drawGrid(ctx, state.viewport, state.document.tileSize, width, height);

    ctx.fillStyle = "rgba(216, 222, 234, 0.8)";
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("Workspace (read-only)", 14, 24);
  }

  return { render };
}
