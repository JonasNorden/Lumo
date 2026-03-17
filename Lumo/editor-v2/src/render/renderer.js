import { renderGrid } from "./layers/gridLayer.js";
import { renderTiles } from "./layers/tileLayer.js";

export function renderEditorFrame(ctx, state) {
  const canvas = ctx.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#0a0f1d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const doc = state.document.active;
  if (!doc) return;

  renderTiles(ctx, doc, state.viewport);
  renderGrid(ctx, doc, state.viewport);
}
