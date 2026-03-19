import { getPrimarySelectedEntityIndex, getSelectedEntityIndices } from "../domain/entities/selection.js";
import { getPrimarySelectedDecorIndex, getSelectedDecorIndices } from "../domain/decor/selection.js";
import { cloneEntityParams, getEntityParamInputType } from "../domain/entities/entityParams.js";

const MIN_LEVEL_SIZE = 8;
const MAX_LEVEL_SIZE = 256;
const DEFAULT_LEVEL_NAME = "Untitled Level";
const DEFAULT_LEVEL_ID = "untitled-level";
const GRID_OPACITY_DRAGGING_ATTR = "gridOpacityDragging";

function clampLevelSize(value) {
  return Math.max(MIN_LEVEL_SIZE, Math.min(MAX_LEVEL_SIZE, value));
}

function countPaintedTiles(tiles) {
  return tiles.reduce((count, tile) => (tile ? count + 1 : count), 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function captureFocusedInput(panel) {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLInputElement)) return null;
  if (!panel.contains(activeElement)) return null;

  const datasetKeys = [
    "metaField",
    "dimensionField",
    "gridField",
    "entityField",
    "entityIndex",
    "entityParamKey",
    "entityParamType",
    "decorField",
    "decorIndex",
  ];

  const dataset = {};
  let hasDataset = false;
  for (const key of datasetKeys) {
    const value = activeElement.dataset[key];
    if (typeof value === "string") {
      dataset[key] = value;
      hasDataset = true;
    }
  }

  if (!hasDataset) return null;

  return {
    dataset,
    selectionStart: activeElement.selectionStart,
    selectionEnd: activeElement.selectionEnd,
    selectionDirection: activeElement.selectionDirection,
  };
}

function restoreFocusedInput(panel, snapshot) {
  if (!snapshot) return;

  const selector = Object.entries(snapshot.dataset)
    .map(([key, value]) => `[data-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}="${CSS.escape(value)}"]`)
    .join("");

  if (!selector) return;

  const replacementInput = panel.querySelector(selector);
  if (!(replacementInput instanceof HTMLInputElement)) return;

  replacementInput.focus({ preventScroll: true });

  if (snapshot.selectionStart === null || snapshot.selectionEnd === null) return;

  const clampedStart = Math.max(0, Math.min(snapshot.selectionStart, replacementInput.value.length));
  const clampedEnd = Math.max(0, Math.min(snapshot.selectionEnd, replacementInput.value.length));
  replacementInput.setSelectionRange(clampedStart, clampedEnd, snapshot.selectionDirection || "none");
}

function captureInspectorSectionState(panel) {
  const sections = panel.querySelectorAll("details[data-inspector-section]");
  if (!sections.length) return null;

  const snapshot = {};
  for (const section of sections) {
    const key = section.dataset.inspectorSection;
    if (!key) continue;
    snapshot[key] = section.open;
  }
  return snapshot;
}

function restoreInspectorSectionState(panel, snapshot) {
  if (!snapshot) return;
  for (const [key, isOpen] of Object.entries(snapshot)) {
    const section = panel.querySelector(`details[data-inspector-section="${key}"]`);
    if (!section) continue;
    section.open = Boolean(isOpen);
  }
}

function setInspectorMarkup(panel, markup) {
  const focusedInputSnapshot = captureFocusedInput(panel);
  const sectionSnapshot = captureInspectorSectionState(panel);
  panel.innerHTML = markup;
  restoreInspectorSectionState(panel, sectionSnapshot);
  restoreFocusedInput(panel, focusedInputSnapshot);
}

function renderInspectorSection(title, key, content, open = false) {
  return `
    <details class="inspectorSection" data-inspector-section="${key}" ${open ? "open" : ""}>
      <summary>${title}</summary>
      <div class="inspectorSectionBody">
        ${content}
      </div>
    </details>
  `;
}

function renderGridSettings(state) {
  const { gridVisible, gridOpacity, gridColor } = state.viewport;

  return `
    <div class="inspectorGroupGrid">
      <label class="fieldRow compactInline">
        <span class="label">Visible</span>
        <input
          type="checkbox"
          data-grid-field="visible"
          ${gridVisible ? "checked" : ""}
        />
      </label>

      <label class="fieldRow fieldRowCompact">
        <span class="label">Opacity</span>
        <div class="rangeField">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value="${gridOpacity}"
            data-grid-field="opacity"
          />
          <span class="rangeValue">${Math.round(gridOpacity * 100)}%</span>
        </div>
      </label>

      <label class="fieldRow fieldRowCompact">
        <span class="label">Color</span>
        <input
          type="color"
          value="${gridColor}"
          data-grid-field="color"
        />
      </label>
    </div>
  `;
}

function formatEntityParamLabel(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

function renderEntityParamField(paramKey, paramValue, selectedEntityIndex) {
  const inputType = getEntityParamInputType(paramValue);
  const escapedKey = escapeHtml(paramKey);
  const label = escapeHtml(formatEntityParamLabel(paramKey));

  if (inputType === "boolean") {
    return `
      <label class="fieldRow compactInline entityParamBooleanRow">
        <span class="label">${label}</span>
        <input
          type="checkbox"
          ${paramValue ? "checked" : ""}
          data-entity-param-key="${escapedKey}"
          data-entity-param-type="boolean"
          data-entity-index="${selectedEntityIndex}"
        />
      </label>
    `;
  }

  return `
    <label class="fieldRow fieldRowCompact">
      <span class="label">${label}</span>
      <input
        type="${inputType === "number" ? "number" : "text"}"
        ${inputType === "number" ? 'step="any"' : ""}
        value="${escapeHtml(paramValue)}"
        data-entity-param-key="${escapedKey}"
        data-entity-param-type="${inputType}"
        data-entity-index="${selectedEntityIndex}"
      />
    </label>
  `;
}

function renderEntityEditor(entity, selectedEntityIndex) {
  const params = cloneEntityParams(entity?.params);
  const entries = Object.entries(params);

  return `
    <div class="selectionInspectorCard">
      <div class="selectionInspectorHeader">
        <div>
          <div class="label">Selected Entity</div>
          <div class="value">${escapeHtml(entity.name || "Unnamed Entity")}</div>
        </div>
        <div class="badge">${escapeHtml(entity.type || "unknown")}</div>
      </div>

      <label class="fieldRow fieldRowCompact">
        <span class="label">Name</span>
        <input type="text" value="${escapeHtml(entity.name)}" data-entity-field="name" data-entity-index="${selectedEntityIndex}" />
      </label>

      <label class="fieldRow fieldRowCompact">
        <span class="label">Type</span>
        <input type="text" value="${escapeHtml(entity.type)}" data-entity-field="type" data-entity-index="${selectedEntityIndex}" />
      </label>

      <label class="fieldRow compactInline">
        <span class="label">Visible</span>
        <input type="checkbox" ${entity.visible ? "checked" : ""} data-entity-field="visible" data-entity-index="${selectedEntityIndex}" />
      </label>

      <div class="entityPositionGrid">
        <label class="fieldRow fieldRowCompact">
          <span class="label">X</span>
          <input type="number" step="1" value="${entity.x}" data-entity-field="x" data-entity-index="${selectedEntityIndex}" />
        </label>
        <label class="fieldRow fieldRowCompact">
          <span class="label">Y</span>
          <input type="number" step="1" value="${entity.y}" data-entity-field="y" data-entity-index="${selectedEntityIndex}" />
        </label>
      </div>

      <div class="entityParamsSection">
        <div class="label">Params</div>
        ${entries.length
          ? `<div class="entityParamsGrid">${entries
              .map(([paramKey, paramValue]) => renderEntityParamField(paramKey, paramValue, selectedEntityIndex))
              .join("")}</div>`
          : '<div class="mutedValue">No parameters for this entity.</div>'}
      </div>
    </div>
  `;
}

function renderDecorEditor(decor, selectedDecorIndex) {
  return `
    <div class="selectionInspectorCard">
      <div class="selectionInspectorHeader">
        <div>
          <div class="label">Selected Decor</div>
          <div class="value">${escapeHtml(decor.name || `Decor ${selectedDecorIndex + 1}`)}</div>
        </div>
        <div class="badge">${escapeHtml(decor.type || "unknown")}</div>
      </div>

      <label class="fieldRow fieldRowCompact">
        <span class="label">Name</span>
        <input type="text" value="${escapeHtml(decor.name)}" data-decor-field="name" data-decor-index="${selectedDecorIndex}" />
      </label>

      <label class="fieldRow fieldRowCompact">
        <span class="label">Type</span>
        <input type="text" value="${escapeHtml(decor.type)}" data-decor-field="type" data-decor-index="${selectedDecorIndex}" />
      </label>

      <label class="fieldRow fieldRowCompact">
        <span class="label">Variant</span>
        <input type="text" value="${escapeHtml(decor.variant)}" data-decor-field="variant" data-decor-index="${selectedDecorIndex}" />
      </label>

      <label class="fieldRow compactInline">
        <span class="label">Visible</span>
        <input type="checkbox" ${decor.visible ? "checked" : ""} data-decor-field="visible" data-decor-index="${selectedDecorIndex}" />
      </label>

      <div class="entityPositionGrid">
        <label class="fieldRow fieldRowCompact">
          <span class="label">X</span>
          <input type="number" step="1" value="${decor.x}" data-decor-field="x" data-decor-index="${selectedDecorIndex}" />
        </label>
        <label class="fieldRow fieldRowCompact">
          <span class="label">Y</span>
          <input type="number" step="1" value="${decor.y}" data-decor-field="y" data-decor-index="${selectedDecorIndex}" />
        </label>
      </div>
    </div>
  `;
}

function renderSelectionSummary(state) {
  const active = state.document.active;
  const selectedEntityIndices = getSelectedEntityIndices(state.interaction);
  const selectedDecorIndices = getSelectedDecorIndices(state.interaction);
  const selectedEntityIndex = getPrimarySelectedEntityIndex(state.interaction);
  const selectedDecorIndex = getPrimarySelectedDecorIndex(state.interaction);
  const selectedEntity = Number.isInteger(selectedEntityIndex) ? active.entities?.[selectedEntityIndex] : null;
  const selectedDecor = Number.isInteger(selectedDecorIndex) ? active.decor?.[selectedDecorIndex] : null;

  if (selectedEntityIndices.length > 1) {
    return `
      <div class="selectionSummaryGrid">
        <div class="infoGroup compact">
          <div class="label">Selection</div>
          <div class="value">${selectedEntityIndices.length} entities</div>
        </div>
        <div class="infoGroup compact">
          <div class="label">Primary</div>
          <div class="value">${escapeHtml(selectedEntity?.name || "Entity")}</div>
        </div>
      </div>
      <div class="mutedValue">Multi-select is active. Drag, duplicate, and delete continue to work from canvas and shortcuts.</div>
    `;
  }

  if (selectedDecorIndices.length > 1) {
    return `
      <div class="selectionSummaryGrid">
        <div class="infoGroup compact">
          <div class="label">Selection</div>
          <div class="value">${selectedDecorIndices.length} decor items</div>
        </div>
        <div class="infoGroup compact">
          <div class="label">Primary</div>
          <div class="value">${escapeHtml(selectedDecor?.name || "Decor")}</div>
        </div>
      </div>
      <div class="mutedValue">Multi-select is active. Drag, duplicate, and delete continue to work from canvas and shortcuts.</div>
    `;
  }

  if (selectedEntity) {
    return renderEntityEditor(selectedEntity, selectedEntityIndex);
  }

  if (selectedDecor) {
    return renderDecorEditor(selectedDecor, selectedDecorIndex);
  }

  return `
    <div class="selectionSummaryGrid">
      <div class="infoGroup compact">
        <div class="label">Selected</div>
        <div class="value">Nothing selected</div>
      </div>
      <div class="infoGroup compact">
        <div class="label">Canvas Target</div>
        <div class="value">${state.interaction.canvasSelectionMode === "decor" ? "Decor" : "Entities"}</div>
      </div>
    </div>
    <div class="mutedValue">Inspect objects from canvas to edit them here.</div>
  `;
}

function renderLevelSection(state) {
  const active = state.document.active;
  const tileCount = active.dimensions.width * active.dimensions.height;
  const paintedCount = countPaintedTiles(active.tiles.base);
  const backgroundLayerCount = active.backgrounds?.layers?.length || 0;

  return `
    <div class="selectionSummaryGrid selectionSummaryGridDouble">
      <div class="infoGroup compact">
        <div class="label">Name</div>
        <div class="value">${escapeHtml(active.meta.name)}</div>
      </div>
      <div class="infoGroup compact">
        <div class="label">ID</div>
        <div class="value">${escapeHtml(active.meta.id)}</div>
      </div>
    </div>

    <label class="fieldRow fieldRowCompact">
      <span class="label">Name</span>
      <input type="text" value="${escapeHtml(active.meta.name)}" data-meta-field="name" />
    </label>

    <label class="fieldRow fieldRowCompact">
      <span class="label">ID</span>
      <input type="text" value="${escapeHtml(active.meta.id)}" data-meta-field="id" />
    </label>

    <div class="selectionSummaryGrid selectionSummaryGridDouble">
      <div class="infoGroup compact">
        <div class="label">Tiles</div>
        <div class="value">${paintedCount} / ${tileCount}</div>
      </div>
      <div class="infoGroup compact">
        <div class="label">Backgrounds</div>
        <div class="value">${backgroundLayerCount}</div>
      </div>
      <div class="infoGroup compact">
        <div class="label">Entities</div>
        <div class="value">${active.entities?.length || 0}</div>
      </div>
      <div class="infoGroup compact">
        <div class="label">Decor</div>
        <div class="value">${active.decor?.length || 0}</div>
      </div>
    </div>

    <div class="entityPositionGrid">
      <label class="fieldRow fieldRowCompact">
        <span class="label">Width</span>
        <input
          type="number"
          min="${MIN_LEVEL_SIZE}"
          max="${MAX_LEVEL_SIZE}"
          step="1"
          value="${active.dimensions.width}"
          data-dimension-field="width"
        />
      </label>

      <label class="fieldRow fieldRowCompact">
        <span class="label">Height</span>
        <input
          type="number"
          min="${MIN_LEVEL_SIZE}"
          max="${MAX_LEVEL_SIZE}"
          step="1"
          value="${active.dimensions.height}"
          data-dimension-field="height"
        />
      </label>
    </div>

    <div class="infoGroup compact">
      <div class="label">Session</div>
      <div class="badge">${state.session.mode}</div>
    </div>
  `;
}

export function renderInspector(panel, state) {
  const active = state.document.active;

  if (state.document.status === "loading") {
    setInspectorMarkup(panel, `<div class="value">Loading document…</div>`);
    return;
  }

  if (state.document.error) {
    setInspectorMarkup(panel, `<div class="value">${state.document.error}</div>`);
    return;
  }

  if (!active) {
    setInspectorMarkup(panel, `<div class="value">No document loaded.</div>`);
    return;
  }

  if (panel.dataset[GRID_OPACITY_DRAGGING_ATTR] === "true") {
    return;
  }

  setInspectorMarkup(panel, `
    ${renderInspectorSection("Inspect", "inspect", renderSelectionSummary(state), true)}
    ${renderInspectorSection("Level", "level", renderLevelSection(state), true)}
    ${renderInspectorSection("Grid", "grid", renderGridSettings(state), false)}
  `);
}

export function bindInspectorPanel(panel, store, options = {}) {
  const { onResize, onMetaUpdate, onGridUpdate, onEntityUpdate, onDecorUpdate } = options;

  const sanitizeMetaValue = (field, value) => {
    const trimmed = value.trim();
    if (trimmed) return trimmed;

    if (field === "name") return DEFAULT_LEVEL_NAME;
    if (field === "id") return DEFAULT_LEVEL_ID;

    return trimmed;
  };

  const handleMetaChange = (target) => {
    const metaField = target.dataset.metaField;
    if (metaField !== "name" && metaField !== "id") return false;

    const state = store.getState();
    const active = state.document.active;
    if (!active) return false;

    const nextValue = sanitizeMetaValue(metaField, target.value);
    target.value = nextValue;

    if (active.meta[metaField] === nextValue) return true;

    onMetaUpdate?.(metaField, nextValue);
    return true;
  };

  const handleGridChange = (target) => {
    const gridField = target.dataset.gridField;
    if (gridField !== "visible" && gridField !== "opacity" && gridField !== "color") return false;

    const state = store.getState();
    const viewport = state.viewport;

    if (gridField === "visible") {
      const nextValue = target.checked;
      if (viewport.gridVisible === nextValue) return true;
      onGridUpdate?.("visible", nextValue);
      return true;
    }

    if (gridField === "opacity") {
      const parsed = Number.parseFloat(target.value);
      const nextValue = Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : viewport.gridOpacity;
      target.value = String(nextValue);
      if (viewport.gridOpacity === nextValue) return true;
      onGridUpdate?.("opacity", nextValue);
      return true;
    }

    const nextColor = target.value;
    if (viewport.gridColor === nextColor) return true;
    onGridUpdate?.("color", nextColor);
    return true;
  };

  const handleEntityChange = (target) => {
    const entityParamKey = target.dataset.entityParamKey;
    if (entityParamKey) {
      const index = Number.parseInt(target.dataset.entityIndex || "", 10);
      if (!Number.isInteger(index) || index < 0) return false;

      const paramType = target.dataset.entityParamType;
      if (paramType === "boolean") {
        onEntityUpdate?.(index, "param", { key: entityParamKey, value: target.checked });
        return true;
      }

      if (paramType === "number") {
        const parsed = Number.parseFloat(target.value);
        const value = Number.isFinite(parsed) ? parsed : 0;
        target.value = String(value);
        onEntityUpdate?.(index, "param", { key: entityParamKey, value });
        return true;
      }

      onEntityUpdate?.(index, "param", { key: entityParamKey, value: target.value });
      return true;
    }

    const entityField = target.dataset.entityField;
    if (entityField !== "name" && entityField !== "type" && entityField !== "visible" && entityField !== "x" && entityField !== "y") return false;

    const index = Number.parseInt(target.dataset.entityIndex || "", 10);
    if (!Number.isInteger(index) || index < 0) return false;

    if (entityField === "visible") {
      onEntityUpdate?.(index, "visible", target.checked);
      return true;
    }

    if (entityField === "x" || entityField === "y") {
      const parsed = Number.parseInt(target.value, 10);
      const value = Number.isInteger(parsed) ? parsed : 0;
      target.value = String(value);
      onEntityUpdate?.(index, entityField, value);
      return true;
    }

    onEntityUpdate?.(index, entityField, target.value);
    return true;
  };

  const handleDecorChange = (target) => {
    const decorField = target.dataset.decorField;
    if (decorField !== "name" && decorField !== "type" && decorField !== "variant" && decorField !== "visible" && decorField !== "x" && decorField !== "y") return false;

    const index = Number.parseInt(target.dataset.decorIndex || "", 10);
    if (!Number.isInteger(index) || index < 0) return false;

    if (decorField === "visible") {
      onDecorUpdate?.(index, "visible", target.checked);
      return true;
    }

    if (decorField === "x" || decorField === "y") {
      const parsed = Number.parseInt(target.value, 10);
      const value = Number.isInteger(parsed) ? parsed : 0;
      target.value = String(value);
      onDecorUpdate?.(index, decorField, value);
      return true;
    }

    onDecorUpdate?.(index, decorField, target.value);
    return true;
  };

  const onChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (handleMetaChange(target)) return;
    if (handleGridChange(target)) return;
    if (handleEntityChange(target)) return;
    if (handleDecorChange(target)) return;

    const dimensionField = target.dataset.dimensionField;
    if (dimensionField !== "width" && dimensionField !== "height") return;

    const state = store.getState();
    const active = state.document.active;
    if (!active) return;

    const nextValue = clampLevelSize(Number.parseInt(target.value, 10));
    if (!Number.isInteger(nextValue)) {
      target.value = String(active.dimensions[dimensionField]);
      return;
    }

    const nextWidth = dimensionField === "width" ? nextValue : active.dimensions.width;
    const nextHeight = dimensionField === "height" ? nextValue : active.dimensions.height;

    target.value = String(nextValue);
    onResize?.(nextWidth, nextHeight);
  };

  const onInput = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (handleMetaChange(target)) return;
    if (handleGridChange(target)) return;
    if (handleEntityChange(target)) return;
    handleDecorChange(target);
  };

  const onPointerDown = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.gridField !== "opacity") return;

    panel.dataset[GRID_OPACITY_DRAGGING_ATTR] = "true";
  };

  const stopOpacityDrag = () => {
    if (panel.dataset[GRID_OPACITY_DRAGGING_ATTR] !== "true") return;

    delete panel.dataset[GRID_OPACITY_DRAGGING_ATTR];
    renderInspector(panel, store.getState());
  };

  panel.addEventListener("change", onChange);
  panel.addEventListener("input", onInput);
  panel.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", stopOpacityDrag);
  window.addEventListener("pointercancel", stopOpacityDrag);

  return () => {
    panel.removeEventListener("change", onChange);
    panel.removeEventListener("input", onInput);
    panel.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", stopOpacityDrag);
    window.removeEventListener("pointercancel", stopOpacityDrag);
  };
}
