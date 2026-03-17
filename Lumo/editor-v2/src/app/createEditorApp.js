import { renderEditorFrame } from "../render/renderer.js";
import { loadLevelDocument } from "../data/loadLevelDocument.js";
import { getCanvasPointFromMouseEvent, getCellFromCanvasPoint } from "../render/viewport.js";
import { renderInspector } from "../ui/inspectorPanel.js";
import { bindBrushPanel, renderBrushPanel } from "../ui/brushPanel.js";
import { resolveTileFromBrushDraft, paintSingleTile } from "../domain/tiles/paintTile.js";
import { resolveBrushSize, getBrushCells } from "../domain/tiles/brushSize.js";
import { eraseSingleTile } from "../domain/tiles/eraseTile.js";
import { EDITOR_TOOLS } from "../domain/tiles/tools.js";
import { getLineCells } from "../domain/tiles/line.js";
import {
  createTileEditEntry,
  startTileEditBatch,
  pushTileEdit,
  endTileEditBatch,
  undoTileEdit,
  redoTileEdit,
} from "../domain/tiles/history.js";
import { getTileIndex } from "../domain/level/levelDocument.js";

function getRectBounds(startCell, endCell) {
  return {
    minX: Math.min(startCell.x, endCell.x),
    maxX: Math.max(startCell.x, endCell.x),
    minY: Math.min(startCell.y, endCell.y),
    maxY: Math.max(startCell.y, endCell.y),
  };
}

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

  const applyTileToolAtCell = (draft, cell) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const brushSize = resolveBrushSize(draft.brush.activeDraft);
    const brushCells = getBrushCells(cell, brushSize);
    const { width, height } = doc.dimensions;
    let changedAny = false;

    if (
      draft.interaction.activeTool === EDITOR_TOOLS.PAINT ||
      draft.interaction.activeTool === EDITOR_TOOLS.RECT ||
      draft.interaction.activeTool === EDITOR_TOOLS.LINE
    ) {
      const tileValue = resolveTileFromBrushDraft(draft.brush.activeDraft);

      for (const brushCell of brushCells) {
        if (brushCell.x < 0 || brushCell.y < 0 || brushCell.x >= width || brushCell.y >= height) continue;
        const index = getTileIndex(width, brushCell.x, brushCell.y);
        const previousValue = doc.tiles.base[index];
        const changed = paintSingleTile(doc, brushCell, tileValue);
        if (!changed) continue;

        const entry = createTileEditEntry(doc, brushCell, previousValue, tileValue);
        pushTileEdit(draft.history, entry);
        changedAny = true;
      }

      return changedAny;
    }

    if (draft.interaction.activeTool === EDITOR_TOOLS.ERASE) {
      for (const brushCell of brushCells) {
        if (brushCell.x < 0 || brushCell.y < 0 || brushCell.x >= width || brushCell.y >= height) continue;
        const index = getTileIndex(width, brushCell.x, brushCell.y);
        const previousValue = doc.tiles.base[index];
        const changed = eraseSingleTile(doc, brushCell);
        if (!changed) continue;

        const entry = createTileEditEntry(doc, brushCell, previousValue, 0);
        pushTileEdit(draft.history, entry);
        changedAny = true;
      }

      return changedAny;
    }

    return false;
  };

  const applyRectTool = (draft, startCell, endCell) => {
    const bounds = getRectBounds(startCell, endCell);
    let changedAny = false;

    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        if (applyTileToolAtCell(draft, { x, y })) {
          changedAny = true;
        }
      }
    }

    return changedAny;
  };

  const applyLineTool = (draft, startCell, endCell) => {
    const lineCells = getLineCells(startCell, endCell);
    let changedAny = false;

    for (const cell of lineCells) {
      if (applyTileToolAtCell(draft, cell)) {
        changedAny = true;
      }
    }

    return changedAny;
  };

  const handleCanvasMouseDown = (event) => {
    if (event.button !== 0) return;

    const state = store.getState();
    if (!state.document.active) return;

    const point = getCanvasPointFromMouseEvent(canvas, event);
    const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    if (!cell) return;

    const activeTool = state.interaction.activeTool;

    if (activeTool === EDITOR_TOOLS.RECT) {
      event.preventDefault();
      store.setState((draft) => {
        draft.interaction.selectedCell = cell;
        draft.interaction.hoverCell = cell;
        draft.interaction.rectDrag = {
          active: true,
          startCell: cell,
        };
      });
      return;
    }

    if (activeTool === EDITOR_TOOLS.LINE) {
      event.preventDefault();
      store.setState((draft) => {
        draft.interaction.selectedCell = cell;
        draft.interaction.hoverCell = cell;
        draft.interaction.lineDrag = {
          active: true,
          startCell: cell,
        };
      });
      return;
    }

    const drawableTool = activeTool === EDITOR_TOOLS.PAINT || activeTool === EDITOR_TOOLS.ERASE;
    if (!drawableTool) return;

    event.preventDefault();

    store.setState((draft) => {
      draft.interaction.selectedCell = cell;
      draft.interaction.dragPaint = {
        active: true,
      };
      startTileEditBatch(draft.history, `${draft.interaction.activeTool}-drag`);
      applyTileToolAtCell(draft, cell);
    });
  };

  const handleCanvasMouseMove = (event) => {
    updateHoveredCell(event);

    const state = store.getState();
    if (!state.document.active) return;

    if (state.interaction.activeTool === EDITOR_TOOLS.RECT) {
      if (!state.interaction.rectDrag?.active) return;
      if ((event.buttons & 1) !== 1) return;

      const point = getCanvasPointFromMouseEvent(canvas, event);
      const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
      if (!cell) return;

      store.setState((draft) => {
        draft.interaction.selectedCell = cell;
        draft.interaction.hoverCell = cell;
      });
      return;
    }

    if (state.interaction.activeTool === EDITOR_TOOLS.LINE) {
      if (!state.interaction.lineDrag?.active) return;
      if ((event.buttons & 1) !== 1) return;

      const point = getCanvasPointFromMouseEvent(canvas, event);
      const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
      if (!cell) return;

      store.setState((draft) => {
        draft.interaction.selectedCell = cell;
        draft.interaction.hoverCell = cell;
      });
      return;
    }

    const dragActive = state.interaction.dragPaint?.active;
    const drawableTool =
      state.interaction.activeTool === EDITOR_TOOLS.PAINT ||
      state.interaction.activeTool === EDITOR_TOOLS.ERASE;

    if (!dragActive || !drawableTool || (event.buttons & 1) !== 1) {
      return;
    }

    const point = getCanvasPointFromMouseEvent(canvas, event);
    const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    if (!cell) return;

    store.setState((draft) => {
      draft.interaction.selectedCell = cell;
      applyTileToolAtCell(draft, cell);
    });
  };

  const stopDragPaint = () => {
    const state = store.getState();

    if (state.interaction.rectDrag?.active) {
      const startCell = state.interaction.rectDrag.startCell;
      const endCell = state.interaction.hoverCell;

      store.setState((draft) => {
        if (startCell && endCell) {
          startTileEditBatch(draft.history, "rect-drag");
          applyRectTool(draft, startCell, endCell);
          endTileEditBatch(draft.history);
        }

        draft.interaction.rectDrag = null;
      });
      return;
    }

    if (state.interaction.lineDrag?.active) {
      const startCell = state.interaction.lineDrag.startCell;
      const endCell = state.interaction.hoverCell;

      store.setState((draft) => {
        if (startCell && endCell) {
          startTileEditBatch(draft.history, "line-drag");
          applyLineTool(draft, startCell, endCell);
          endTileEditBatch(draft.history);
        }

        draft.interaction.lineDrag = null;
      });
      return;
    }

    if (!state.interaction.dragPaint?.active) return;

    store.setState((draft) => {
      draft.interaction.dragPaint = null;
      endTileEditBatch(draft.history);
    });
  };

  const handleCanvasClick = (event) => {
    const state = store.getState();
    if (!state.document.active) return;
    if (state.interaction.activeTool !== EDITOR_TOOLS.INSPECT) return;

    const point = getCanvasPointFromMouseEvent(canvas, event);
    const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    if (!cell) return;

    store.setState((draft) => {
      draft.interaction.selectedCell = cell;
    });
  };

  const handleUndo = () => {
    store.setState((draft) => {
      const doc = draft.document.active;
      if (!doc) return;
      undoTileEdit(doc, draft.history);
    });
  };

  const handleRedo = () => {
    store.setState((draft) => {
      const doc = draft.document.active;
      if (!doc) return;
      redoTileEdit(doc, draft.history);
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
  const unbindBrushPanel = bindBrushPanel(brushPanel, store, {
    onUndo: handleUndo,
    onRedo: handleRedo,
  });
  window.addEventListener("resize", resize);
  canvas.addEventListener("mousemove", handleCanvasMouseMove);
  canvas.addEventListener("mouseleave", clearHoveredCell);
  canvas.addEventListener("mousedown", handleCanvasMouseDown);
  window.addEventListener("mouseup", stopDragPaint);
  canvas.addEventListener("click", handleCanvasClick);

  resize();
  draw(store.getState());
  void loadDocument();

  return () => {
    unsubscribe();
    unbindBrushPanel();
    window.removeEventListener("resize", resize);
    canvas.removeEventListener("mousemove", handleCanvasMouseMove);
    canvas.removeEventListener("mouseleave", clearHoveredCell);
    canvas.removeEventListener("mousedown", handleCanvasMouseDown);
    window.removeEventListener("mouseup", stopDragPaint);
    canvas.removeEventListener("click", handleCanvasClick);
  };
}
