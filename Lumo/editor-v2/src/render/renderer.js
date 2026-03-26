import { renderGrid } from "./layers/gridLayer.js";
import { renderTiles } from "./layers/tileLayer.js";
import { renderBackground } from "./layers/backgroundLayer.js";
import { renderBrushPreviewOverlay, renderPlacementPreviewOverlay } from "./layers/previewLayer.js";
import { renderEntities } from "./layers/entityLayer.js";
import { renderDecor } from "./layers/decorLayer.js";
import { renderSounds } from "./layers/soundLayer.js";
import { renderProximityOverlays } from "./layers/proximityOverlayLayer.js";
import { renderScanOverlay } from "./layers/scanLayer.js";
import { renderDarknessPreview } from "./darknessPreview.js";
import { findDecorPresetById } from "../domain/decor/decorPresets.js";
import { findEntityPresetById } from "../domain/entities/entityPresets.js";
import { findSoundPresetById } from "../domain/sound/soundPresets.js";

export const WORLD_RENDER_ORDER = Object.freeze(["background", "decor", "tiles", "entities"]);
export const OVERLAY_RENDER_ORDER = Object.freeze(["proximity", "sound", "grid", "scan"]);

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
  renderBackground(worldCtx, doc, state.viewport);
  renderDecor(worldCtx, doc, state.viewport, state.interaction);
  renderTiles(worldCtx, doc, state.viewport);
  renderEntities(worldCtx, doc, state.viewport, state.interaction);

  if (renderTarget) {
    renderDarknessPreview(worldCtx, doc, state.viewport);
    ctx.drawImage(renderTarget.canvas, 0, 0);
  }

  renderProximityOverlays(ctx, doc, state.viewport, state.ui);
  renderSounds(ctx, doc, state.viewport, state.interaction, state.scan);
  renderGrid(ctx, doc, state.viewport);
  renderScanOverlay(ctx, doc, state.viewport, state.scan);
  renderPlacementPreviewOverlay(ctx, doc, state.viewport, state.interaction, {
    decor: findDecorPresetById(state.interaction.activeDecorPresetId) || null,
    entity: findEntityPresetById(state.interaction.activeEntityPresetId) || null,
    sound: findSoundPresetById(state.interaction.activeSoundPresetId) || null,
  });
  renderBrushPreviewOverlay(ctx, doc, state.viewport, state.interaction, state.brush.activeDraft);
}
