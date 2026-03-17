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
      hoverCell: null,
      selectedCell: null,
    },
    brush: {
      activeDraft: createDefaultBrushDraft(),
    },
    ui: {
      inspectorOpen: true,
    },
  };
}
