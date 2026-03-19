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
    "decorParamKey",
    "decorParamType",
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

function formatParamLabel(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

function renderTextField(prefix, fieldKey, label, value, selectedIndex, className = "") {
  const classes = ["fieldRow", "fieldRowCompact", "selectionInlineField", className].filter(Boolean).join(" ");
  return `
    <label class="${classes}">
      <span class="label">${escapeHtml(label)}</span>
      <input type="text" value="${escapeHtml(value)}" data-${prefix}-field="${escapeHtml(fieldKey)}" data-${prefix}-index="${selectedIndex}" />
    </label>
  `;
}

function renderNumberField(prefix, fieldKey, label, value, selectedIndex, className = "") {
  const classes = ["fieldRow", "fieldRowCompact", "selectionInlineField", "selectionCoordField", className].filter(Boolean).join(" ");
  return `
    <label class="${classes}">
      <span class="label">${escapeHtml(label)}</span>
      <input type="number" step="1" value="${value}" data-${prefix}-field="${escapeHtml(fieldKey)}" data-${prefix}-index="${selectedIndex}" />
    </label>
  `;
}

function renderCheckboxField(prefix, fieldKey, label, value, selectedIndex, className = "") {
  const classes = ["fieldRow", "compactInline", "compactBooleanField", "selectionInlineField", "selectionInlineCheckbox", className].filter(Boolean).join(" ");
  return `
    <label class="${classes}">
      <span class="label">${escapeHtml(label)}</span>
      <input type="checkbox" ${value ? "checked" : ""} data-${prefix}-field="${escapeHtml(fieldKey)}" data-${prefix}-index="${selectedIndex}" />
    </label>
  `;
}

function renderParamField(prefix, paramKey, paramValue, selectedIndex) {
  const inputType = getEntityParamInputType(paramValue);
  const escapedKey = escapeHtml(paramKey);
  const label = escapeHtml(formatParamLabel(paramKey));

  if (inputType === "boolean") {
    return `
      <label class="fieldRow compactInline compactBooleanField selectionInlineField selectionInlineCheckbox selectionParamField selectionParamCheckbox">
        <span class="label">${label}</span>
        <input
          type="checkbox"
          ${paramValue ? "checked" : ""}
          data-${prefix}-param-key="${escapedKey}"
          data-${prefix}-param-type="boolean"
          data-${prefix}-index="${selectedIndex}"
        />
      </label>
    `;
  }

  return `
    <label class="fieldRow fieldRowCompact selectionInlineField selectionParamField">
      <span class="label">${label}</span>
      <input
        type="${inputType === "number" ? "number" : "text"}"
        ${inputType === "number" ? 'step="any"' : ""}
        value="${escapeHtml(paramValue)}"
        data-${prefix}-param-key="${escapedKey}"
        data-${prefix}-param-type="${inputType}"
        data-${prefix}-index="${selectedIndex}"
      />
    </label>
  `;
}

function renderParamFields(prefix, params, selectedIndex) {
  return Object.entries(cloneEntityParams(params))
    .map(([paramKey, paramValue]) => renderParamField(prefix, paramKey, paramValue, selectedIndex))
    .join("");
}

function renderSelectionFields(fieldMarkup) {
  return `
    <div class="selectionInspectorCard compactSelectionCard">
      <div class="selectionEditorFlow">${fieldMarkup}</div>
    </div>
  `;
}

function renderEntityEditor(entity, selectedEntityIndex) {
  const fieldMarkup = [
    renderTextField("entity", "name", "Name", entity.name, selectedEntityIndex, "selectionFieldName"),
    renderTextField("entity", "type", "Type", entity.type, selectedEntityIndex, "selectionFieldType"),
    renderNumberField("entity", "x", "X", entity.x, selectedEntityIndex),
    renderNumberField("entity", "y", "Y", entity.y, selectedEntityIndex),
    renderCheckboxField("entity", "visible", "Visible", entity.visible, selectedEntityIndex, "selectionFieldToggle"),
    renderParamFields("entity", entity?.params, selectedEntityIndex),
  ].join("");

  return renderSelectionFields(fieldMarkup);
}

function renderDecorEditor(decor, selectedDecorIndex) {
  const fieldMarkup = [
    renderTextField("decor", "name", "Name", decor.name, selectedDecorIndex, "selectionFieldName"),
    renderTextField("decor", "type", "Type", decor.type, selectedDecorIndex, "selectionFieldType"),
    renderNumberField("decor", "x", "X", decor.x, selectedDecorIndex),
    renderNumberField("decor", "y", "Y", decor.y, selectedDecorIndex),
    renderCheckboxField("decor", "visible", "Visible", decor.visible, selectedDecorIndex, "selectionFieldToggle"),
    renderTextField("decor", "variant", "Variant", decor.variant, selectedDecorIndex, "selectionFieldVariant selectionParamField"),
    renderParamFields("decor", decor?.params, selectedDecorIndex),
  ].join("");

  return renderSelectionFields(fieldMarkup);
}

function renderMultiSelectionState(kind, count, primaryName) {
  const noun = kind === "decor" ? (count === 1 ? "decor item" : "decor items") : count === 1 ? "entity" : "entities";
  return `
    <div class="selectionInspectorCard compactSelectionCard">
      <div class="selectionEditorPlaceholder">
        <span class="selectionEditorPlaceholderCount">${count} ${noun} selected</span>
        <span class="selectionEditorPlaceholderDetail">Batch editing is not available yet.</span>
        ${primaryName ? `<span class="selectionEditorPlaceholderDetail">Primary: ${escapeHtml(primaryName)}</span>` : ""}
      </div>
    </div>
  `;
}

function renderSelectionEditor(state, emptyMessage) {
  const active = state.document.active;
  const selectedEntityIndices = getSelectedEntityIndices(state.interaction);
  const selectedDecorIndices = getSelectedDecorIndices(state.interaction);
  const selectedEntityIndex = getPrimarySelectedEntityIndex(state.interaction);
  const selectedDecorIndex = getPrimarySelectedDecorIndex(state.interaction);
  const selectedEntity = Number.isInteger(selectedEntityIndex) ? active.entities?.[selectedEntityIndex] : null;
  const selectedDecor = Number.isInteger(selectedDecorIndex) ? active.decor?.[selectedDecorIndex] : null;

  if (selectedEntityIndices.length > 1) {
    return {
      markup: renderMultiSelectionState("entity", selectedEntityIndices.length, selectedEntity?.name || "Entity"),
      isEmpty: false,
    };
  }

  if (selectedDecorIndices.length > 1) {
    return {
      markup: renderMultiSelectionState("decor", selectedDecorIndices.length, selectedDecor?.name || "Decor"),
      isEmpty: false,
    };
  }

  if (selectedEntity) {
    return {
      markup: renderEntityEditor(selectedEntity, selectedEntityIndex),
      isEmpty: false,
    };
  }

  if (selectedDecor) {
    return {
      markup: renderDecorEditor(selectedDecor, selectedDecorIndex),
      isEmpty: false,
    };
  }

  return {
    markup: emptyMessage ? `<div class="selectionEditorEmptyState">${escapeHtml(emptyMessage)}</div>` : "",
    isEmpty: true,
  };
}

function applyParamChange(target, prefix, onUpdate) {
  const paramKey = target.dataset[`${prefix}ParamKey`];
  if (!paramKey) return false;

  const index = Number.parseInt(target.dataset[`${prefix}Index`] || "", 10);
  if (!Number.isInteger(index) || index < 0) return false;

  const paramType = target.dataset[`${prefix}ParamType`];
  if (paramType === "boolean") {
    onUpdate?.(index, "param", { key: paramKey, value: target.checked });
    return true;
  }

  if (paramType === "number") {
    const parsed = Number.parseFloat(target.value);
    const value = Number.isFinite(parsed) ? parsed : 0;
    target.value = String(value);
    onUpdate?.(index, "param", { key: paramKey, value });
    return true;
  }

  onUpdate?.(index, "param", { key: paramKey, value: target.value });
  return true;
}

export function renderSelectionEditorPanel(panel, state, options = {}) {
  const { loadingMessage = "Loading document…", documentError = state.document.error, noDocumentMessage = "No document loaded.", emptyMessage = "" } = options;

  if (state.document.status === "loading") {
    setPanelMarkup(panel, `<div class="value">${escapeHtml(loadingMessage)}</div>`);
    return;
  }

  if (documentError) {
    setPanelMarkup(panel, `<div class="value">${escapeHtml(documentError)}</div>`);
    return;
  }

  if (!state.document.active) {
    setPanelMarkup(panel, `<div class="value">${escapeHtml(noDocumentMessage)}</div>`);
    return;
  }

  const { markup, isEmpty } = renderSelectionEditor(state, emptyMessage);
  setPanelMarkup(panel, markup, isEmpty);
}

export function bindSelectionEditorPanel(panel, store, options = {}) {
  const { onEntityUpdate, onDecorUpdate } = options;

  const handleEntityChange = (target) => {
    if (applyParamChange(target, "entity", onEntityUpdate)) return true;

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
    if (applyParamChange(target, "decor", onDecorUpdate)) return true;

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
