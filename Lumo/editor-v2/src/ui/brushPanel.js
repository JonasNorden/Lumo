import {
  BRUSH_BEHAVIOR_OPTIONS,
  BRUSH_SIZE_OPTIONS,
  BRUSH_SPRITE_OPTIONS,
  BRUSH_PALETTE_PRESETS,
} from "../domain/tiles/brushOptions.js";
import { getBrushDraftSummary } from "../domain/tiles/brushDraft.js";
import { TOOL_OPTIONS, isEditorTool } from "../domain/tiles/tools.js";
import { canUndo, canRedo } from "../domain/tiles/history.js";

const WORKSPACE_BACKGROUND_PRESETS = ["#0a0f1d", "#111827", "#1a2336", "#141b2a"];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

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

function renderWorkspaceSettings(state) {
  const { workspaceBackground } = state.ui;

  return `
    <div class="infoGroup compact">
      <div class="value">Canvas visuals</div>
    </div>

    <label class="fieldRow">
      <span class="label">Background</span>
      <input
        type="color"
        value="${workspaceBackground}"
        data-workspace-field="background"
      />
    </label>

    <div class="workspacePresets" role="group" aria-label="Workspace background presets">
      ${WORKSPACE_BACKGROUND_PRESETS.map(
        (preset) => `
          <button
            type="button"
            class="workspacePreset${workspaceBackground === preset ? " isActive" : ""}"
            data-workspace-preset="${preset}"
            title="Set workspace background to ${preset}"
            style="--workspace-preset-color: ${preset};"
          ></button>
        `,
      ).join("")}
    </div>
  `;
}

function renderBackgroundSettings(active) {
  const layers = active.backgrounds?.layers || [];

  return `
    <div class="infoGroup compact">
      <div class="value">${layers.length} layer${layers.length === 1 ? "" : "s"}</div>
    </div>

    <button type="button" class="toolButton isSecondary" data-background-action="add">Add layer</button>

    <div class="backgroundLayerList">
      ${layers
        .map(
          (layer, index) => `
            <div class="backgroundLayerRow">
              <label class="fieldRow">
                <span class="label">Name</span>
                <input type="text" value="${escapeHtml(layer.name)}" data-background-field="name" data-background-index="${index}" />
              </label>
              <div class="backgroundLayerControls">
                <label class="fieldRow compactInline">
                  <span class="label">Visible</span>
                  <input type="checkbox" data-background-field="visible" data-background-index="${index}" ${layer.visible ? "checked" : ""} />
                </label>
                <label class="fieldRow compactInline">
                  <span class="label">Color</span>
                  <input type="color" value="${layer.color}" data-background-field="color" data-background-index="${index}" />
                </label>
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderEntitiesSettings(active, state) {
  const entities = active.entities || [];
  const selectedEntityIndex = state.interaction.selectedEntityIndex;
  const selected = Number.isInteger(selectedEntityIndex) ? entities[selectedEntityIndex] : null;

  return `
    <div class="infoGroup compact">
      <div class="value">${entities.length} total</div>
    </div>

    <button type="button" class="toolButton isSecondary" data-entity-action="add">Add entity</button>

    <div class="entityList" role="listbox" aria-label="Entities">
      ${entities
        .map(
          (entity, index) => `
            <button
              type="button"
              class="entityListItem ${index === selectedEntityIndex ? "isSelected" : ""}"
              data-entity-action="select"
              data-entity-index="${index}"
            >
              <span class="entityListName">${escapeHtml(entity.name || `Entity ${index + 1}`)}</span>
              <span class="entityListType">${escapeHtml(entity.type || "unknown")}</span>
            </button>
          `,
        )
        .join("")}
    </div>

    ${selected
      ? `
      <div class="entityEditor">
        <label class="fieldRow">
          <span class="label">Name</span>
          <input type="text" value="${escapeHtml(selected.name)}" data-entity-field="name" data-entity-index="${selectedEntityIndex}" />
        </label>

        <label class="fieldRow">
          <span class="label">Type</span>
          <input type="text" value="${escapeHtml(selected.type)}" data-entity-field="type" data-entity-index="${selectedEntityIndex}" />
        </label>

        <label class="fieldRow compactInline">
          <span class="label">Visible</span>
          <input type="checkbox" ${selected.visible ? "checked" : ""} data-entity-field="visible" data-entity-index="${selectedEntityIndex}" />
        </label>

        <div class="entityPositionGrid">
          <label class="fieldRow">
            <span class="label">X</span>
            <input type="number" step="1" value="${selected.x}" data-entity-field="x" data-entity-index="${selectedEntityIndex}" />
          </label>
          <label class="fieldRow">
            <span class="label">Y</span>
            <input type="number" step="1" value="${selected.y}" data-entity-field="y" data-entity-index="${selectedEntityIndex}" />
          </label>
        </div>
      </div>
      `
      : '<div class="mutedValue">Select an entity to edit it.</div>'}
  `;
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
    workspace: true,
    backgrounds: true,
    entities: true,
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

    ${state.document.active ? renderSection("workspace", "Workspace", panelSections.workspace, renderWorkspaceSettings(state)) : ""}

    ${state.document.active
      ? renderSection("backgrounds", "Backgrounds", panelSections.backgrounds, renderBackgroundSettings(state.document.active))
      : ""}

    ${state.document.active
      ? renderSection("entities", "Entities", panelSections.entities, renderEntitiesSettings(state.document.active, state))
      : ""}

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
  const { onUndo, onRedo, onExport, onImport, onNew, onWorkspaceUpdate, onBackgroundUpdate, onEntityUpdate } = options;
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

    if (target instanceof HTMLSelectElement) {
      const field = target.dataset.brushField;
      if (!field) return;

      store.setState((draft) => {
        draft.brush.activeDraft[field] = target.value;
      });
      return;
    }

    if (!(target instanceof HTMLInputElement)) return;

    const workspaceField = target.dataset.workspaceField;
    if (workspaceField === "background") {
      onWorkspaceUpdate?.("background", target.value);
      return;
    }

    const backgroundField = target.dataset.backgroundField;
    if (backgroundField === "name" || backgroundField === "visible" || backgroundField === "color") {
      const index = Number.parseInt(target.dataset.backgroundIndex || "", 10);
      if (!Number.isInteger(index) || index < 0) return;
      onBackgroundUpdate?.(index, backgroundField, backgroundField === "visible" ? target.checked : target.value);
      return;
    }

    const entityField = target.dataset.entityField;
    if (entityField !== "name" && entityField !== "type" && entityField !== "visible" && entityField !== "x" && entityField !== "y") return;

    const index = Number.parseInt(target.dataset.entityIndex || "", 10);
    if (!Number.isInteger(index) || index < 0) return;

    if (entityField === "visible") {
      onEntityUpdate?.(index, "visible", target.checked);
      return;
    }

    if (entityField === "x" || entityField === "y") {
      const parsed = Number.parseInt(target.value, 10);
      const value = Number.isInteger(parsed) ? parsed : 0;
      target.value = String(value);
      onEntityUpdate?.(index, entityField, value);
      return;
    }

    onEntityUpdate?.(index, entityField, target.value);
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

    const workspacePresetButton = target.closest("[data-workspace-preset]");
    if (workspacePresetButton instanceof HTMLButtonElement) {
      const preset = workspacePresetButton.dataset.workspacePreset;
      if (preset) {
        onWorkspaceUpdate?.("background", preset);
      }
      return;
    }

    const backgroundActionButton = target.closest("[data-background-action]");
    if (backgroundActionButton instanceof HTMLButtonElement) {
      const action = backgroundActionButton.dataset.backgroundAction;
      if (action === "add") {
        onBackgroundUpdate?.(-1, "add", null);
      }
      return;
    }

    const entityActionButton = target.closest("[data-entity-action]");
    if (entityActionButton instanceof HTMLButtonElement) {
      const action = entityActionButton.dataset.entityAction;
      if (action === "add") {
        onEntityUpdate?.(-1, "add", null);
      }
      if (action === "select") {
        const index = Number.parseInt(entityActionButton.dataset.entityIndex || "", 10);
        if (Number.isInteger(index) && index >= 0) {
          onEntityUpdate?.(index, "select", null);
        }
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
