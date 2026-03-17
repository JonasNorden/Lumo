import { renderEditorFrame } from "../render/renderer.js";
import { loadLevelDocument } from "../data/loadLevelDocument.js";
import { getCanvasPointFromMouseEvent, getCellFromCanvasPoint } from "../render/viewport.js";
import { renderInspector } from "../ui/inspectorPanel.js";
import { bindBrushPanel, renderBrushPanel } from "../ui/brushPanel.js";
import { resolveTileFromBrushDraft, paintSingleTile } from "../domain/tiles/paintTile.js";
import { EDITOR_TOOLS } from "../domain/tiles/tools.js";

export function createEditorApp({ canvas, inspector, brushPanel, store }) {
  const ctx = canvas.getContext("2d");

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const state = store.getState();
    if (!state.document.active) return;

    const { width, height, tileSize } = state.document.active.dimensions;
    const docWidth = width * tileSize;
    const docHeight = height * tileSize;

    state.viewport.offsetX = Math.max(24, (rect.width - docWidth) * 0.5);
    state.viewport.offsetY = Math.max(24, (rect.height - docHeight) * 0.5);
  };

  const draw = (state) => {
    renderEditorFrame(ctx, state);
    renderInspector(inspector, state);
    renderBrushPanel(brushPanel, state);
  };

  const updateHoveredCell = (event) => {
    const state = store.getState();
    if (!state.document.active) return;

    const point = getCanvasPointFromMouseEvent(canvas, event);
    const nextHoverCell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);

    const current = state.interaction.hoverCell;
    const unchanged =
      current?.x === nextHoverCell?.x &&
      current?.y === nextHoverCell?.y;

    if (unchanged) return;

    store.setState((draft) => {
      draft.interaction.hoverCell = nextHoverCell;
    });
  };

  const clearHoveredCell = () => {
    const state = store.getState();
    if (!state.interaction.hoverCell) return;

    store.setState((draft) => {
      draft.interaction.hoverCell = null;
    });
  };

  const handleCanvasClick = (event) => {
    const state = store.getState();
    if (!state.document.active) return;

    const point = getCanvasPointFromMouseEvent(canvas, event);
    const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    if (!cell) return;

    store.setState((draft) => {
      draft.interaction.selectedCell = cell;

      if (draft.interaction.activeTool !== EDITOR_TOOLS.PAINT) {
        return;
      }

      const tileValue = resolveTileFromBrushDraft(draft.brush.activeDraft);
      paintSingleTile(draft.document.active, cell, tileValue);
    });
  };

  const loadDocument = async () => {
    store.setState((state) => {
      state.document.status = "loading";
      state.document.error = null;
    });

    try {
      const doc = await loadLevelDocument();
      store.setState((state) => {
        state.document.active = doc;
        state.document.status = "ready";
      });
      resize();
      draw(store.getState());
    } catch (error) {
      store.setState((state) => {
        state.document.status = "error";
        state.document.error = error instanceof Error ? error.message : "Unknown document load error";
      });
    }
  };

  const unsubscribe = store.subscribe(draw);
  const unbindBrushPanel = bindBrushPanel(brushPanel, store);
  window.addEventListener("resize", resize);
  canvas.addEventListener("mousemove", updateHoveredCell);
  canvas.addEventListener("mouseleave", clearHoveredCell);
  canvas.addEventListener("click", handleCanvasClick);

  resize();
  draw(store.getState());
  void loadDocument();

  return () => {
    unsubscribe();
    unbindBrushPanel();
    window.removeEventListener("resize", resize);
    canvas.removeEventListener("mousemove", updateHoveredCell);
    canvas.removeEventListener("mouseleave", clearHoveredCell);
    canvas.removeEventListener("click", handleCanvasClick);
  };
}
