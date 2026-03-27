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
  hideEntityTypes: [],
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

function ensureBottomPanelLayout(panel) {
  let scanPane = panel.querySelector("[data-bottom-panel-scan]");
  let editorPane = panel.querySelector("[data-bottom-panel-editor]");

  if (scanPane instanceof HTMLElement && editorPane instanceof HTMLElement) {
    return { scanPane, editorPane };
  }

  panel.innerHTML = `
    <div class="bottomPanelLayout">
      <aside class="bottomPanelScanPane" data-bottom-panel-scan></aside>
      <div class="bottomPanelEditorPane" data-bottom-panel-editor></div>
    </div>
  `;

  scanPane = panel.querySelector("[data-bottom-panel-scan]");
  editorPane = panel.querySelector("[data-bottom-panel-editor]");
  if (!(scanPane instanceof HTMLElement) || !(editorPane instanceof HTMLElement)) {
    return null;
  }

  return { scanPane, editorPane };
}

export function renderBottomPanel(panel, state) {
  if (typeof HTMLElement === "undefined" || typeof panel.querySelector !== "function") {
    panel.innerHTML = createBottomPanelMarkup(state);
    panel.classList?.toggle?.("isEmpty", false);
    return;
  }

  const layout = ensureBottomPanelLayout(panel);
  if (!layout) return;

  panel.classList?.toggle?.("isEmpty", false);
  const { scanPane, editorPane } = layout;
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
