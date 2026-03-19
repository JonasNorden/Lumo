import {
  BRUSH_BEHAVIOR_OPTIONS,
  BRUSH_SIZE_OPTIONS,
  BRUSH_SPRITE_OPTIONS,
} from "../domain/tiles/brushOptions.js";
import { getBrushDraftSummary } from "../domain/tiles/brushDraft.js";
import { TOOL_OPTIONS, EDITOR_TOOLS, isEditorTool } from "../domain/tiles/tools.js";
import { ENTITY_PRESETS } from "../domain/entities/entityPresets.js";
import { DECOR_PRESETS } from "../domain/decor/decorPresets.js";

const VISIBLE_TOOL_OPTIONS = TOOL_OPTIONS.filter((option) => (
  option.value === EDITOR_TOOLS.INSPECT
  || option.value === EDITOR_TOOLS.PAINT
  || option.value === EDITOR_TOOLS.ERASE
));

const HIDDEN_ENTITY_PRESET_IDS = new Set(["player-spawn", "player-exit", "exit"]);
const PLACEABLE_ENTITY_PRESETS = ENTITY_PRESETS.filter((preset) => !HIDDEN_ENTITY_PRESET_IDS.has(preset.id));

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
      (option) => `<option value="${option.value}" ${option.value === selectedValue ? "selected" : ""}>${option.label}</option>`,
    )
    .join("");
}

function renderToolButton(option, activeTool) {
  const isActive = option.value === activeTool;
  return `<button class="toolButton ${isActive ? "isActive" : ""}" type="button" data-tool="${option.value}">${option.label}</button>`;
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

function getToolLabel(toolValue) {
  return TOOL_OPTIONS.find((option) => option.value === toolValue)?.label ?? "Inspect";
}

function getCanvasSelectionModeLabel(mode) {
  return mode === "decor" ? "Decor" : "Entities";
}

function renderCanvasTargetSection(state) {
  return `
    <div class="toolSwitch toolSwitchCompact" role="group" aria-label="Canvas selection target">
      <button
        class="toolButton ${state.interaction.canvasSelectionMode === "entity" ? "isActive" : ""}"
        type="button"
        data-selection-mode="entity"
      >
        Entities
      </button>
      <button
        class="toolButton ${state.interaction.canvasSelectionMode === "decor" ? "isActive" : ""}"
        type="button"
        data-selection-mode="decor"
      >
        Decor
      </button>
    </div>

    <div class="statusRow compactStatusRow">
      <span class="label">Current</span>
      <span class="value">${getCanvasSelectionModeLabel(state.interaction.canvasSelectionMode)}</span>
    </div>
  `;
}

function renderSelectorField(label, dataField, options, selectedValue, placeholderLabel) {
  return `
    <label class="fieldRow fieldRowCompact">
      <span class="label">${label}</span>
      <select data-${dataField}>
        <option value="">${placeholderLabel}</option>
        ${options
          .map(
            (option) => `<option value="${option.id}" ${option.id === selectedValue ? "selected" : ""}>${escapeHtml(option.defaultName)}</option>`,
          )
          .join("")}
      </select>
    </label>
  `;
}

function renderDecorSettings(state) {
  const activePresetId = state.interaction.activeDecorPresetId;
  const activePreset = DECOR_PRESETS.find((preset) => preset.id === activePresetId) || null;
  const scatterSettings = state.interaction.decorScatterSettings || {};
  const scatterCount = Number.isFinite(scatterSettings.count) ? Math.max(1, Math.round(scatterSettings.count)) : 12;
  const scatterRandomness = Number.isFinite(scatterSettings.randomness)
    ? Math.max(0, Math.min(1, scatterSettings.randomness))
    : 0.6;
  const scatterVariantMode = scatterSettings.variantMode === "random" ? "random" : "fixed";
  const scatterModeActive = Boolean(state.interaction.decorScatterMode);
  const placementLabel = activePreset ? `Placing: ${activePreset.defaultName}` : "No placement";
  const scatterStatus = !activePreset
    ? "Select Decor first"
    : scatterModeActive
      ? `Scatter ${scatterCount} · ${Math.round(scatterRandomness * 100)}%`
      : "Single placement";

  return `
    ${renderSelectorField("Select Decor", "decor-preset-select", DECOR_PRESETS, activePresetId, "No decor selected")}

    <div class="statusRow compactStatusRow">
      <span class="label">Placement</span>
      <span class="value">${escapeHtml(placementLabel)}</span>
    </div>

    <div class="compactActionRow compactActionRowSingle">
      <button type="button" class="toolButton isSecondary" data-decor-action="clear-preset" ${activePreset ? "" : "disabled"}>Clear</button>
    </div>

    <div class="compactSubsection">
      <div class="compactSubsectionHeader">
        <span class="label">Scatter</span>
        <button
          type="button"
          class="toolButton isSecondary compactToggleButton ${scatterModeActive ? "isActive" : ""}"
          data-decor-action="toggle-scatter"
          aria-pressed="${scatterModeActive ? "true" : "false"}"
        >
          ${scatterModeActive ? "On" : "Off"}
        </button>
      </div>

      <div class="compactFieldGrid decorScatterCompactGrid">
        <label class="fieldRow fieldRowCompact">
          <span class="label">Density</span>
          <input type="number" min="1" max="512" step="1" value="${scatterCount}" data-decor-setting="count" />
        </label>

        <label class="fieldRow fieldRowCompact">
          <span class="label">Spread</span>
          <div class="rangeField">
            <input type="range" min="0" max="100" step="1" value="${Math.round(scatterRandomness * 100)}" data-decor-setting="randomness" />
            <span class="rangeValue">${Math.round(scatterRandomness * 100)}%</span>
          </div>
        </label>

        <label class="fieldRow fieldRowCompact">
          <span class="label">Variant</span>
          <select data-decor-setting="variantMode">
            <option value="fixed" ${scatterVariantMode === "fixed" ? "selected" : ""}>Fixed</option>
            <option value="random" ${scatterVariantMode === "random" ? "selected" : ""}>Random</option>
          </select>
        </label>
      </div>

      <div class="statusRow compactStatusRow">
        <span class="label">Mode</span>
        <span class="value">${escapeHtml(scatterStatus)}</span>
      </div>
    </div>
  `;
}

function renderEntitiesSettings(state) {
  const activePresetId = state.interaction.activeEntityPresetId;
  const activePreset = ENTITY_PRESETS.find((preset) => preset.id === activePresetId) || null;
  const placementLabel = activePreset ? `Placing: ${activePreset.defaultName}` : "No placement";

  return `
    ${renderSelectorField("Select Entity", "entity-preset-select", PLACEABLE_ENTITY_PRESETS, activePresetId, "No entity selected")}

    <div class="statusRow compactStatusRow">
      <span class="label">Placement</span>
      <span class="value">${escapeHtml(placementLabel)}</span>
    </div>

    <div class="compactActionRow compactActionRowSingle">
      <button type="button" class="toolButton isSecondary" data-entity-action="clear-preset" ${activePreset ? "" : "disabled"}>Clear</button>
    </div>
  `;
}

export function renderBrushPanel(panel, state) {
  const brushDraft = state.brush.activeDraft;
  const summary = getBrushDraftSummary(brushDraft);
  const panelSections = {
    tools: true,
    canvasTarget: true,
    brush: true,
    decor: true,
    entities: true,
    ...state.ui.panelSections,
  };

  panel.innerHTML = `
    ${renderSection(
      "tools",
      "Tools",
      panelSections.tools,
      `
        <div class="toolSwitch toolSwitchCompact" role="group" aria-label="Editor tool">
          ${VISIBLE_TOOL_OPTIONS.map((option) => renderToolButton(option, state.interaction.activeTool)).join("")}
        </div>

        <div class="statusRow compactStatusRow">
          <span class="label">Active</span>
          <span class="value">${getToolLabel(state.interaction.activeTool)}</span>
        </div>
      `,
    )}

    ${renderSection(
      "canvasTarget",
      "Canvas Target",
      panelSections.canvasTarget,
      renderCanvasTargetSection(state),
    )}

    ${renderSection(
      "brush",
      "Brush",
      panelSections.brush,
      `
        <label class="fieldRow fieldRowCompact">
          <span class="label">Mode</span>
          <select data-brush-field="behavior">
            ${renderOptions(BRUSH_BEHAVIOR_OPTIONS, brushDraft.behavior)}
          </select>
        </label>

        <label class="fieldRow fieldRowCompact">
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

        <div class="statusRow compactStatusRow">
          <span class="label">Current</span>
          <span class="value">${summary}</span>
        </div>
      `,
    )}

    ${state.document.active
      ? renderSection("decor", "Decor", panelSections.decor, renderDecorSettings(state))
      : ""}

    ${state.document.active
      ? renderSection("entities", "Entities", panelSections.entities, renderEntitiesSettings(state))
      : ""}
  `;
}

export function bindBrushPanel(panel, store, options = {}) {
  const { onEntityUpdate, onDecorUpdate, onCanvasTargetChange } = options;

  const onChange = (event) => {
    const target = event.target;

    if (target instanceof HTMLSelectElement) {
      const decorSetting = target.dataset.decorSetting;
      if (decorSetting === "variantMode") {
        onDecorUpdate?.(-1, "scatter-setting", { field: "variantMode", value: target.value });
        return;
      }

      const decorPresetId = target.dataset.decorPresetSelect;
      if (typeof decorPresetId === "string") {
        if (target.value) {
          onDecorUpdate?.(-1, "preset", target.value);
        } else {
          onDecorUpdate?.(-1, "clear-preset", null);
        }
        return;
      }

      const entityPresetId = target.dataset.entityPresetSelect;
      if (typeof entityPresetId === "string") {
        if (target.value) {
          onEntityUpdate?.(-1, "preset", target.value);
        } else {
          onEntityUpdate?.(-1, "clear-preset", null);
        }
        return;
      }

      const field = target.dataset.brushField;
      if (!field) return;

      store.setState((draft) => {
        draft.brush.activeDraft[field] = target.value;
      });
      return;
    }

    if (!(target instanceof HTMLInputElement)) return;

    const decorSetting = target.dataset.decorSetting;
    if (decorSetting === "count" || decorSetting === "randomness") {
      if (decorSetting === "count") {
        const parsed = Number.parseInt(target.value, 10);
        const value = Number.isInteger(parsed) ? Math.max(1, parsed) : 1;
        target.value = String(value);
        onDecorUpdate?.(-1, "scatter-setting", { field: "count", value });
        return;
      }

      const sliderValue = Number.parseFloat(target.value);
      const value = Number.isFinite(sliderValue) ? Math.max(0, Math.min(1, sliderValue / 100)) : 0;
      onDecorUpdate?.(-1, "scatter-setting", { field: "randomness", value });
      return;
    }
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

    const decorActionButton = target.closest("[data-decor-action]");
    if (decorActionButton instanceof HTMLButtonElement) {
      const action = decorActionButton.dataset.decorAction;
      if (action === "clear-preset") {
        onDecorUpdate?.(-1, "clear-preset", null);
      }
      if (action === "toggle-scatter") {
        onDecorUpdate?.(-1, "toggle-scatter", null);
      }
      return;
    }

    const entityActionButton = target.closest("[data-entity-action]");
    if (entityActionButton instanceof HTMLButtonElement) {
      const action = entityActionButton.dataset.entityAction;
      if (action === "clear-preset") {
        onEntityUpdate?.(-1, "clear-preset", null);
      }
      return;
    }

    const selectionModeButton = target.closest("[data-selection-mode]");
    if (selectionModeButton instanceof HTMLButtonElement) {
      const nextMode = selectionModeButton.dataset.selectionMode;
      if (nextMode !== "entity" && nextMode !== "decor") return;
      onCanvasTargetChange?.(nextMode);
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
