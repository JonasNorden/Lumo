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

function captureFocusedScanField(scanPane) {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLInputElement)) return null;
  if (!scanPane.contains(activeElement)) return null;
  const scanField = typeof activeElement.dataset.scanField === "string" ? activeElement.dataset.scanField : "";
  if (!scanField) return null;
  return {
    scanField,
    selectionStart: typeof activeElement.selectionStart === "number" ? activeElement.selectionStart : null,
    selectionEnd: typeof activeElement.selectionEnd === "number" ? activeElement.selectionEnd : null,
    selectionDirection: typeof activeElement.selectionDirection === "string" ? activeElement.selectionDirection : "none",
  };
}

function restoreFocusedScanField(scanPane, snapshot) {
  if (!snapshot) return;
  const field = scanPane.querySelector(`input[data-scan-field="${CSS.escape(snapshot.scanField)}"]`);
  if (!(field instanceof HTMLInputElement)) return;
  field.focus({ preventScroll: true });
  if (snapshot.selectionStart === null || snapshot.selectionEnd === null) return;
  const start = Math.max(0, Math.min(snapshot.selectionStart, field.value.length));
  const end = Math.max(0, Math.min(snapshot.selectionEnd, field.value.length));
  field.setSelectionRange(start, end, snapshot.selectionDirection || "none");
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
  const focusedScanFieldSnapshot = captureFocusedScanField(scanPane);
  scanPane.innerHTML = renderScanControls(state, { compact: true });
  restoreFocusedScanField(scanPane, focusedScanFieldSnapshot);

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
