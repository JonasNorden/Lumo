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
      canvasSelectionMode: "entity",
      activeEntityPresetId: null,
      activeDecorPresetId: null,
      decorScatterMode: false,
      decorScatterSettings: {
        count: 12,
        randomness: 0.6,
        variantMode: "fixed",
      },
      hoverCell: null,
      selectedCell: null,
      hoveredEntityIndex: null,
      hoveredDecorIndex: null,
      selectedEntityIndices: [],
      selectedEntityIndex: null,
      selectedDecorIndices: [],
      selectedDecorIndex: null,
      dragPaint: null,
      rectDrag: null,
      lineDrag: null,
      boxSelection: null,
      entityDrag: null,
      decorDrag: null,
      decorScatterDrag: null,
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
      topBarMenu: null,
      panelSections: {
        tools: true,
        canvasTarget: true,
        brush: true,
        entities: true,
        decor: true,
      },
    },
  };
}
