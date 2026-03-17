import {
  BRUSH_BEHAVIOR_OPTIONS,
  BRUSH_SIZE_OPTIONS,
  BRUSH_SPRITE_OPTIONS,
  BRUSH_PALETTE_PRESETS,
} from "../domain/tiles/brushOptions.js";
import { getBrushDraftSummary } from "../domain/tiles/brushDraft.js";
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

function renderSection(sectionId, title, isOpen, content, sectionClass = "") {
  return `
    <section class="panelSection ${sectionClass} ${isOpen ? "" : "isCollapsed"}" aria-label="${title} section">
      <button
        class="sectionToggle"
        type="button"
        data-section-toggle="${sectionId}"
        aria-expanded="${isOpen ? "true" : "false"}"
      >
        <span class="sectionTitle">${title}</span>
        <span class="sectionChevron" aria-hidden="true">${isOpen ? "▾" : "▸"}</span>
      </button>
      <div class="sectionContent">${content}</div>
    </section>
  `;
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
  const importStatus = state.ui.importStatus;
  const activePalettePresetId = getActivePalettePresetId(brushDraft);
  const panelSections = {
    tools: true,
    file: false,
    palette: true,
    brush: true,
    shortcuts: false,
    ...state.ui.panelSections,
  };

  panel.innerHTML = `
    ${renderSection(
      "tools",
      "Tools",
      panelSections.tools,
      `
        <div class="toolSwitch" role="group" aria-label="Editor tool">
          ${TOOL_OPTIONS.map((option) => renderToolButton(option, state.interaction.activeTool)).join("")}
        </div>

        <div class="statusRow">
          <span class="label">Active</span>
          <span class="value">${getToolLabel(state.interaction.activeTool)}</span>
        </div>
      `,
    )}

    ${renderSection(
      "file",
      "File",
      panelSections.file,
      `
        <div class="historyActions" role="group" aria-label="History controls">
          <button class="toolButton isSecondary" type="button" data-history-action="undo" ${undoEnabled ? "" : "disabled"}>Undo</button>
          <button class="toolButton isSecondary" type="button" data-history-action="redo" ${redoEnabled ? "" : "disabled"}>Redo</button>
        </div>

        <div class="historyActions historyActionsSingle" role="group" aria-label="Document actions">
          <button class="toolButton isSecondary" type="button" data-document-action="new-level">New</button>
        </div>

        <div class="historyActions" role="group" aria-label="Document export controls">
          <button class="toolButton isSecondary" type="button" data-export-action="level-json" ${canExport ? "" : "disabled"}>Export</button>
          <button class="toolButton isSecondary" type="button" data-import-action="level-json">Import</button>
        </div>

        ${importStatus ? `<div class="infoGroup compact"><div class="value mutedValue">${importStatus}</div></div>` : ""}
      `,
    )}

    ${renderSection(
      "palette",
      "Palette",
      panelSections.palette,
      `
        <div class="hintText">Quick presets</div>
        <div class="paletteGroup" role="group" aria-label="Tile palette quick select">
          <div class="paletteList">
            ${BRUSH_PALETTE_PRESETS.map((preset) => renderPaletteItem(preset, activePalettePresetId)).join("")}
          </div>
        </div>
      `,
    )}

    ${renderSection(
      "brush",
      "Brush",
      panelSections.brush,
      `
        <div class="hintText">Fine tuning</div>
        <label class="fieldRow">
          <span class="label">Mode</span>
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

        <label class="fieldRow fieldRowCompact">
          <span class="label">Sprite</span>
          <select data-brush-field="sprite">
            ${renderOptions(BRUSH_SPRITE_OPTIONS, brushDraft.sprite)}
          </select>
        </label>

        <div class="statusRow">
          <span class="label">Current</span>
          <span class="value">${summary}</span>
        </div>
      `,
    )}

    ${renderSection(
      "shortcuts",
      "Shortcuts",
      panelSections.shortcuts,
      `
        <div class="shortcutHelp" aria-label="Keyboard shortcuts">
          <span><kbd>V</kbd> Inspect</span>
          <span><kbd>B</kbd> Paint</span>
          <span><kbd>E</kbd> Erase</span>
          <span><kbd>R</kbd> Rect</span>
          <span><kbd>L</kbd> Line</span>
          <span><kbd>F</kbd> Fill</span>
          <span><kbd>Ctrl/⌘+Z</kbd> Undo</span>
          <span><kbd>Ctrl/⌘+Shift+Z</kbd> Redo</span>
        </div>
      `,
      "panelSectionMicro",
    )}
  `;
}

export function bindBrushPanel(panel, store, options = {}) {
  const { onUndo, onRedo, onExport, onImport, onNew } = options;
  let activeHoveredSection = null;

  const collapseHoveredSection = (sectionElement) => {
    if (!(sectionElement instanceof HTMLElement)) return;
    sectionElement.classList.remove("isHoverExpanded");
    if (activeHoveredSection === sectionElement) {
      activeHoveredSection = null;
    }
  };

  const openOnHover = (sectionElement) => {
    if (!(sectionElement instanceof HTMLElement)) return;
    if (!sectionElement.classList.contains("isCollapsed")) return;

    if (activeHoveredSection && activeHoveredSection !== sectionElement) {
      collapseHoveredSection(activeHoveredSection);
    }

    sectionElement.classList.add("isHoverExpanded");
    activeHoveredSection = sectionElement;
  };

  const closeOnHoverExit = (sectionElement) => {
    if (!(sectionElement instanceof HTMLElement)) return;
    if (!sectionElement.classList.contains("isHoverExpanded")) return;

    collapseHoveredSection(sectionElement);
  };

  const onMouseOver = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const sectionElement = target.closest(".panelSection");
    if (!(sectionElement instanceof HTMLElement)) return;

    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && sectionElement.contains(relatedTarget)) {
      return;
    }

    openOnHover(sectionElement);
  };

  const onMouseOut = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const sectionElement = target.closest(".panelSection");
    if (!(sectionElement instanceof HTMLElement)) return;

    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && sectionElement.contains(relatedTarget)) {
      return;
    }

    closeOnHoverExit(sectionElement);
  };

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

    const sectionToggle = target.closest("[data-section-toggle]");
    if (sectionToggle instanceof HTMLButtonElement) {
      const sectionId = sectionToggle.dataset.sectionToggle;
      if (!sectionId) return;

      store.setState((draft) => {
        if (!draft.ui.panelSections || !(sectionId in draft.ui.panelSections)) return;
        draft.ui.panelSections[sectionId] = !draft.ui.panelSections[sectionId];
      });
      return;
    }

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
  panel.addEventListener("mouseover", onMouseOver);
  panel.addEventListener("mouseout", onMouseOut);

  return () => {
    panel.removeEventListener("change", onChange);
    panel.removeEventListener("click", onClick);
    panel.removeEventListener("mouseover", onMouseOver);
    panel.removeEventListener("mouseout", onMouseOut);

    collapseHoveredSection(activeHoveredSection);
  };
}
