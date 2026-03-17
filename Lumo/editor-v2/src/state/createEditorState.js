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
      gridVisible: true,
      gridOpacity: 0.25,
      gridColor: "#6f85af",
    },
    interaction: {
      activeTool: "inspect",
      hoverCell: null,
      selectedCell: null,
      selectedEntityIndex: null,
      dragPaint: null,
      rectDrag: null,
      lineDrag: null,
      spacePanActive: false,
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
      importStatus: null,
      workspaceBackground: "#0a0f1d",
      panelSections: {
        tools: true,
        palette: true,
        brush: true,
        entities: true,
        backgrounds: true,
        workspace: true,
        file: false,
        shortcuts: false,
      },
    },
  };
}
