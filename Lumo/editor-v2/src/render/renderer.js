import { renderGrid } from "./layers/gridLayer.js";
import { renderTiles } from "./layers/tileLayer.js";
import { renderBackgroundLayers } from "./layers/backgroundLayer.js";
import { renderSelectionOverlay } from "./layers/selectionLayer.js";
import { renderBrushPreviewOverlay } from "./layers/previewLayer.js";
import { renderEntities, renderEntityDragPreview, renderEntityPlacementPreview } from "./layers/entityLayer.js";
import { renderDecor, renderDecorPlacementPreview } from "./layers/decorLayer.js";
import { renderSounds, renderSoundDragPreview, renderSoundPlacementPreview } from "./layers/soundLayer.js";
import { renderScanOverlay } from "./layers/scanLayer.js";
import { findDecorPresetById } from "../domain/decor/decorPresets.js";
import { findEntityPresetById } from "../domain/entities/entityPresets.js";
import { findSoundPresetById } from "../domain/sound/soundPresets.js";
import { renderDarknessPreview } from "./darknessPreview.js";

export const WORLD_RENDER_ORDER = Object.freeze(["decor", "tiles", "entities"]);
export const OVERLAY_RENDER_ORDER = Object.freeze(["sound", "grid", "scan"]);

let darknessRenderTarget = null;

function ensureDarknessRenderTarget(width, height) {
  if (typeof document === "undefined") return null;
  if (!darknessRenderTarget) {
    const canvas = document.createElement("canvas");
    const targetCtx = canvas.getContext("2d");
    if (!targetCtx) return null;
    darknessRenderTarget = { canvas, ctx: targetCtx };
  }

  if (darknessRenderTarget.canvas.width !== width) darknessRenderTarget.canvas.width = width;
  if (darknessRenderTarget.canvas.height !== height) darknessRenderTarget.canvas.height = height;

  return darknessRenderTarget;
}

export function renderEditorFrame(ctx, state) {
  const canvas = ctx.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const previewPassesEnabled = false;

  ctx.fillStyle = state.ui.workspaceBackground || "#0a0f1d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const doc = state.document.active;
  if (!doc) return;

  const darknessPreviewEnabled = Boolean(state.ui.darknessPreviewEnabled);
  const renderTarget = darknessPreviewEnabled ? ensureDarknessRenderTarget(canvas.width, canvas.height) : null;
  const worldCtx = renderTarget?.ctx || ctx;

  worldCtx.clearRect(0, 0, canvas.width, canvas.height);
  worldCtx.fillStyle = state.ui.workspaceBackground || "#0a0f1d";
  worldCtx.fillRect(0, 0, canvas.width, canvas.height);
  renderBackgroundLayers(worldCtx, doc, state.viewport);
  renderDecor(worldCtx, doc, state.viewport, state.interaction);
  renderTiles(worldCtx, doc, state.viewport);
  renderEntities(worldCtx, doc, state.viewport, state.interaction);

  if (renderTarget) {
    renderDarknessPreview(worldCtx, doc, state.viewport);
    ctx.drawImage(renderTarget.canvas, 0, 0);
  }

  renderSounds(ctx, doc, state.viewport, state.interaction, state.scan);
  renderGrid(ctx, doc, state.viewport);
  renderScanOverlay(ctx, doc, state.viewport, state.scan);
  if (previewPassesEnabled) {
    renderSoundDragPreview(ctx, doc, state.viewport, state.interaction);
    renderEntityDragPreview(ctx, doc, state.viewport, state.interaction);
    renderBrushPreviewOverlay(ctx, doc, state.viewport, state.interaction, state.brush.activeDraft);
    renderDecorPlacementPreview(ctx, doc, state.viewport, state.interaction, findDecorPresetById(state.interaction.activeDecorPresetId));
    renderEntityPlacementPreview(ctx, doc, state.viewport, state.interaction, findEntityPresetById(state.interaction.activeEntityPresetId));
    renderSoundPlacementPreview(ctx, doc, state.viewport, state.interaction, findSoundPresetById(state.interaction.activeSoundPresetId));
    renderSelectionOverlay(ctx, doc, state.viewport, state.interaction);
  }
}
