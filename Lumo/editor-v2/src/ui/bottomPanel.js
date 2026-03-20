import {
  bindSelectionEditorPanel,
  getSelectionEditorPanelContent,
  renderSelectionEditorPanel,
} from "./selectionEditorPanel.js";
import { bindScanControls, renderScanControls } from "./scanControls.js";

const SELECTION_PANEL_OPTIONS = {
  noDocumentMessage: "No document loaded.",
  emptyMessage: "No selection",
  soundMode: "full",
  hideEntityTypes: ["fog_volume"],
};

function createBottomPanelMarkup(state) {
  const { markup, isEmpty } = getSelectionEditorPanelContent(state, SELECTION_PANEL_OPTIONS);
  return `
    <div class="bottomPanelLayout">
      <aside class="bottomPanelScanPane" data-bottom-panel-scan>
        ${renderScanControls(state, { compact: true })}
      </aside>
      <div class="bottomPanelEditorPane ${isEmpty ? "isEmpty" : ""}" data-bottom-panel-editor>
        ${markup}
      </div>
    </div>
  `;
}

export function renderBottomPanel(panel, state) {
  if (typeof HTMLElement === "undefined" || typeof panel.querySelector !== "function") {
    panel.innerHTML = createBottomPanelMarkup(state);
    panel.classList?.toggle?.("isEmpty", false);
    return;
  }

  panel.innerHTML = `
    <div class="bottomPanelLayout">
      <aside class="bottomPanelScanPane" data-bottom-panel-scan></aside>
      <div class="bottomPanelEditorPane" data-bottom-panel-editor></div>
    </div>
  `;
  panel.classList?.toggle?.("isEmpty", false);

  const scanPane = panel.querySelector("[data-bottom-panel-scan]");
  const editorPane = panel.querySelector("[data-bottom-panel-editor]");
  if (!(scanPane instanceof HTMLElement) || !(editorPane instanceof HTMLElement)) return;

  scanPane.innerHTML = renderScanControls(state, { compact: true });
  renderSelectionEditorPanel(editorPane, state, SELECTION_PANEL_OPTIONS);
}

export function bindBottomPanel(panel, store, options = {}) {
  const unbindSelectionPanel = bindSelectionEditorPanel(panel, store, options);
  const unbindScanControls = bindScanControls(panel, options);

  return () => {
    unbindSelectionPanel?.();
    unbindScanControls?.();
  };
}
