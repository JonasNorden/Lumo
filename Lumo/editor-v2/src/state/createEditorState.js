import { createDefaultBrushDraft } from "../domain/tiles/brushDraft.js";

export function createEditorState() {
  return {
    session: {
      mode: "read-only",
    },
    document: {
      status: "idle",
      error: null,
      active: null,
    },
    viewport: {
      zoom: 1,
      offsetX: 48,
      offsetY: 48,
    },
    interaction: {
      activeTool: "inspect",
      hoverCell: null,
      selectedCell: null,
      dragPaint: null,
      rectDrag: null,
      lineDrag: null,
    },
    brush: {
      activeDraft: createDefaultBrushDraft(),
    },
    history: {
      undoStack: [],
      redoStack: [],
      activeBatch: null,
    },
    ui: {
      inspectorOpen: true,
    },
  };
}
