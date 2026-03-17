import {
  BRUSH_BEHAVIOR_OPTIONS,
  BRUSH_SIZE_OPTIONS,
  BRUSH_SPRITE_OPTIONS,
  BRUSH_PALETTE_PRESETS,
} from "../domain/tiles/brushOptions.js";
import {
  getBrushDraftSummary,
  isBrushDraftValid,
} from "../domain/tiles/brushDraft.js";
import { TOOL_OPTIONS, isEditorTool } from "../domain/tiles/tools.js";
import { canUndo, canRedo } from "../domain/tiles/history.js";

function renderOptions(options, selectedValue) {
  return options
    .map(
      (option) =>
        `<option value="${option.value}" ${option.value === selectedValue ? "selected" : ""}>${option.label}</option>`,
    )
    .join("");
}

function renderToolButton(option, activeTool) {
  const isActive = option.value === activeTool;

  return `<button class="toolButton ${isActive ? "isActive" : ""}" type="button" data-tool="${option.value}">${option.label}</button>`;
}

function renderPaletteItem(preset, activePresetId) {
  const isActive = preset.id === activePresetId;
  return `
    <button
      class="paletteItem ${isActive ? "isActive" : ""}"
      type="button"
      data-palette-item="${preset.id}"
      aria-pressed="${isActive ? "true" : "false"}"
    >
      <span class="paletteSwatch" style="--palette-color: ${preset.color}"></span>
      <span class="paletteLabel">${preset.label}</span>
    </button>
  `;
}

function getToolLabel(toolValue) {
  return TOOL_OPTIONS.find((option) => option.value === toolValue)?.label ?? "Inspect";
}

function getActivePalettePresetId(brushDraft) {
  return (
    BRUSH_PALETTE_PRESETS.find(
      (preset) =>
        preset.brush.behavior === brushDraft.behavior &&
        preset.brush.size === brushDraft.size &&
        preset.brush.sprite === brushDraft.sprite,
    )?.id ?? null
  );
}

export function renderBrushPanel(panel, state) {
  const undoEnabled = canUndo(state.history);
  const redoEnabled = canRedo(state.history);
  const canExport = Boolean(state.document.active);
  const brushDraft = state.brush.activeDraft;
  const summary = getBrushDraftSummary(brushDraft);
  const valid = isBrushDraftValid(brushDraft);
  const importStatus = state.ui.importStatus;
  const activePalettePresetId = getActivePalettePresetId(brushDraft);

  panel.innerHTML = `
    <div class="panelHeader">
      <span class="panelTitle">Brush</span>
      <span class="badge ${valid ? "" : "badgeWarn"}">${valid ? "ready" : "invalid"}</span>
    </div>

    <div class="toolSwitch" role="group" aria-label="Editor tool">
      ${TOOL_OPTIONS.map((option) => renderToolButton(option, state.interaction.activeTool)).join("")}
    </div>

    <div class="historyActions" role="group" aria-label="History controls">
      <button class="toolButton" type="button" data-history-action="undo" ${undoEnabled ? "" : "disabled"}>Undo</button>
      <button class="toolButton" type="button" data-history-action="redo" ${redoEnabled ? "" : "disabled"}>Redo</button>
    </div>

    <div class="historyActions" role="group" aria-label="Document actions">
      <button class="toolButton" type="button" data-document-action="new-level">New Level</button>
    </div>

    <div class="historyActions" role="group" aria-label="Document export controls">
      <button class="toolButton" type="button" data-export-action="level-json" ${canExport ? "" : "disabled"}>Export</button>
      <button class="toolButton" type="button" data-import-action="level-json">Import</button>
    </div>

    ${importStatus ? `<div class="infoGroup compact"><div class="value">${importStatus}</div></div>` : ""}

    <div class="paletteGroup" role="group" aria-label="Tile palette quick select">
      <div class="label">Palette</div>
      <div class="paletteList">
        ${BRUSH_PALETTE_PRESETS.map((preset) => renderPaletteItem(preset, activePalettePresetId)).join("")}
      </div>
    </div>

    <label class="fieldRow">
      <span class="label">Behavior</span>
      <select data-brush-field="behavior">
        ${renderOptions(BRUSH_BEHAVIOR_OPTIONS, brushDraft.behavior)}
      </select>
    </label>

    <label class="fieldRow">
      <span class="label">Size</span>
      <select data-brush-field="size">
        ${renderOptions(BRUSH_SIZE_OPTIONS, brushDraft.size)}
      </select>
    </label>

    <label class="fieldRow">
      <span class="label">Sprite</span>
      <select data-brush-field="sprite">
        ${renderOptions(BRUSH_SPRITE_OPTIONS, brushDraft.sprite)}
      </select>
    </label>

    <div class="infoGroup compact">
      <div class="label">Current</div>
      <div class="value">${summary}</div>
    </div>

    <div class="infoGroup compact">
      <div class="label">Tool</div>
      <div class="value">${getToolLabel(state.interaction.activeTool)}</div>
    </div>

    <div class="shortcutHelp" aria-label="Keyboard shortcuts">
      <span>V Inspect</span>
      <span>B Paint</span>
      <span>E Erase</span>
      <span>R Rect</span>
      <span>L Line</span>
      <span>F Fill</span>
      <span>⌘/Ctrl+Z Undo</span>
      <span>⌘/Ctrl+Shift+Z Redo</span>
    </div>
  `;
}

export function bindBrushPanel(panel, store, options = {}) {
  const { onUndo, onRedo, onExport, onImport, onNew } = options;
  const onChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;

    const field = target.dataset.brushField;
    if (!field) return;

    store.setState((draft) => {
      draft.brush.activeDraft[field] = target.value;
    });
  };

  const onClick = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const historyButton = target.closest("[data-history-action]");
    if (historyButton instanceof HTMLButtonElement) {
      const action = historyButton.dataset.historyAction;
      if (action === "undo") {
        onUndo?.();
      }
      if (action === "redo") {
        onRedo?.();
      }
      return;
    }


    const documentButton = target.closest("[data-document-action]");
    if (documentButton instanceof HTMLButtonElement) {
      const action = documentButton.dataset.documentAction;
      if (action === "new-level") {
        onNew?.();
      }
      return;
    }

    const exportButton = target.closest("[data-export-action]");
    if (exportButton instanceof HTMLButtonElement) {
      const action = exportButton.dataset.exportAction;
      if (action === "level-json") {
        onExport?.();
      }
      return;
    }

    const importButton = target.closest("[data-import-action]");
    if (importButton instanceof HTMLButtonElement) {
      const action = importButton.dataset.importAction;
      if (action === "level-json") {
        onImport?.();
      }
      return;
    }

    const paletteButton = target.closest("[data-palette-item]");
    if (paletteButton instanceof HTMLButtonElement) {
      const paletteItemId = paletteButton.dataset.paletteItem;
      const preset = BRUSH_PALETTE_PRESETS.find((item) => item.id === paletteItemId);
      if (!preset) return;

      store.setState((draft) => {
        draft.brush.activeDraft.behavior = preset.brush.behavior;
        draft.brush.activeDraft.size = preset.brush.size;
        draft.brush.activeDraft.sprite = preset.brush.sprite;
      });
      return;
    }

    const button = target.closest("[data-tool]");
    if (!(button instanceof HTMLButtonElement)) return;

    const nextTool = button.dataset.tool;
    if (!isEditorTool(nextTool)) return;

    store.setState((draft) => {
      draft.interaction.activeTool = nextTool;
    });
  };

  panel.addEventListener("change", onChange);
  panel.addEventListener("click", onClick);

  return () => {
    panel.removeEventListener("change", onChange);
    panel.removeEventListener("click", onClick);
  };
}
