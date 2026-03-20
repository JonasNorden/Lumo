import { bindSelectionEditorPanel, renderSelectionEditorPanel } from "./selectionEditorPanel.js";

export function renderBottomPanel(panel, state) {
  renderSelectionEditorPanel(panel, state, {
    noDocumentMessage: "No document loaded.",
    emptyMessage: "No selection",
    soundMode: "full",
  });
}

export function bindBottomPanel(panel, store, options = {}) {
  return bindSelectionEditorPanel(panel, store, options);
}
