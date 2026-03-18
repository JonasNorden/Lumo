import { renderGrid } from "./layers/gridLayer.js";
import { renderTiles } from "./layers/tileLayer.js";
import { renderBackgroundLayers } from "./layers/backgroundLayer.js";
import { renderSelectionOverlay } from "./layers/selectionLayer.js";
import { renderBrushPreviewOverlay } from "./layers/previewLayer.js";
import { renderEntities, renderEntityDragPreview } from "./layers/entityLayer.js";

export function renderEditorFrame(ctx, state) {
  const canvas = ctx.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = state.ui.workspaceBackground || "#0a0f1d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const doc = state.document.active;
  if (!doc) return;

  renderBackgroundLayers(ctx, doc, state.viewport);
  renderTiles(ctx, doc, state.viewport);
  renderGrid(ctx, doc, state.viewport);
  renderEntities(ctx, doc, state.viewport, state.interaction);
  renderEntityDragPreview(ctx, doc, state.viewport, state.interaction);
  renderBrushPreviewOverlay(ctx, doc, state.viewport, state.interaction, state.brush.activeDraft);
  renderSelectionOverlay(ctx, doc, state.viewport, state.interaction);
}
