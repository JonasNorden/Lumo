import { bindSelectionEditorPanel, renderSelectionEditorPanel } from "./selectionEditorPanel.js";

export function renderInspector(panel, state) {
  renderSelectionEditorPanel(panel, state, {
    hideEntityTypes: ["fog_volume"],
    soundMode: "summary",
  });
}

export function bindInspectorPanel(panel, store, options = {}) {
  return bindSelectionEditorPanel(panel, store, options);
}
