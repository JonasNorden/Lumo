import { getPrimarySelectedEntityIndex, getSelectedEntityIndices } from "../domain/entities/selection.js";
import { getPrimarySelectedDecorIndex, getSelectedDecorIndices } from "../domain/decor/selection.js";
import { cloneEntityParams, getEntityParamInputType } from "../domain/entities/entityParams.js";

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

function setPanelMarkup(panel, markup, isEmpty = false) {
  const focusedInputSnapshot = captureFocusedInput(panel);
  panel.innerHTML = markup;
  panel.classList.toggle("isEmpty", isEmpty);
  restoreFocusedInput(panel, focusedInputSnapshot);
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

function renderSelectionEditor(state) {
  const active = state.document.active;
  const selectedEntityIndices = getSelectedEntityIndices(state.interaction);
  const selectedDecorIndices = getSelectedDecorIndices(state.interaction);
  const selectedEntityIndex = getPrimarySelectedEntityIndex(state.interaction);
  const selectedDecorIndex = getPrimarySelectedDecorIndex(state.interaction);
  const selectedEntity = Number.isInteger(selectedEntityIndex) ? active.entities?.[selectedEntityIndex] : null;
  const selectedDecor = Number.isInteger(selectedDecorIndex) ? active.decor?.[selectedDecorIndex] : null;

  if (selectedEntityIndices.length > 1) {
    return `
      <div class="selectionInspectorCard">
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
      </div>
    `;
  }

  if (selectedDecorIndices.length > 1) {
    return `
      <div class="selectionInspectorCard">
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
      </div>
    `;
  }

  if (selectedEntity) return renderEntityEditor(selectedEntity, selectedEntityIndex);
  if (selectedDecor) return renderDecorEditor(selectedDecor, selectedDecorIndex);

  return "";
}

export function renderInspector(panel, state) {
  if (state.document.status === "loading") {
    setPanelMarkup(panel, `<div class="value">Loading document…</div>`);
    return;
  }

  if (state.document.error) {
    setPanelMarkup(panel, `<div class="value">${state.document.error}</div>`);
    return;
  }

  if (!state.document.active) {
    setPanelMarkup(panel, `<div class="value">No document loaded.</div>`);
    return;
  }

  const markup = renderSelectionEditor(state);
  setPanelMarkup(panel, markup, !markup);
}

export function bindInspectorPanel(panel, store, options = {}) {
  const { onEntityUpdate, onDecorUpdate } = options;

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

    if (handleEntityChange(target)) return;
    handleDecorChange(target);
  };

  const onInput = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (handleEntityChange(target)) return;
    handleDecorChange(target);
  };

  panel.addEventListener("change", onChange);
  panel.addEventListener("input", onInput);

  return () => {
    panel.removeEventListener("change", onChange);
    panel.removeEventListener("input", onInput);
  };
}
