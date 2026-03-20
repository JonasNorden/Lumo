import { getPrimarySelectedEntityIndex, getSelectedEntityIndices } from "../domain/entities/selection.js";
import { getPrimarySelectedDecorIndex, getSelectedDecorIndices } from "../domain/decor/selection.js";
import { getPrimarySelectedSoundIndex, getSelectedSoundIndices } from "../domain/sound/selection.js";
import { cloneEntityParams, getEntityParamInputType } from "../domain/entities/entityParams.js";
import { SOUND_PRESETS } from "../domain/sound/soundPresets.js";
import {
  getSoundAssetCatalog,
  findSoundAssetByPath,
  getSoundAssetCategoryLabel,
  getSoundAssetOptionsForType,
} from "../domain/sound/audioAssetCatalog.js";
import { getAuthoredSoundSource } from "../domain/sound/sourceReference.js";

const MIXED_FIELD_VALUE = "__mixed__";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isTextInputElement(value) {
  return typeof HTMLInputElement !== "undefined" && value instanceof HTMLInputElement;
}

function isSelectElement(value) {
  return typeof HTMLSelectElement !== "undefined" && value instanceof HTMLSelectElement;
}

function captureFocusedInput(panel) {
  const activeElement = document.activeElement;
  if (!isTextInputElement(activeElement) && !isSelectElement(activeElement)) return null;
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
    "soundField",
    "soundIndex",
    "soundParamKey",
    "soundParamType",
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
    selectionStart: isTextInputElement(activeElement) ? activeElement.selectionStart : null,
    selectionEnd: isTextInputElement(activeElement) ? activeElement.selectionEnd : null,
    selectionDirection: isTextInputElement(activeElement) ? activeElement.selectionDirection : null,
  };
}

function restoreFocusedInput(panel, snapshot) {
  if (!snapshot) return;

  const selector = Object.entries(snapshot.dataset)
    .map(([key, value]) => `[data-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}="${CSS.escape(value)}"]`)
    .join("");

  if (!selector) return;

  const replacementInput = panel.querySelector(selector);
  if (!isTextInputElement(replacementInput) && !isSelectElement(replacementInput)) return;

  replacementInput.focus({ preventScroll: true });

  if (!isTextInputElement(replacementInput)) return;
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

function renderSelectField(prefix, fieldKey, label, value, selectedIndex, options, className = "") {
  const classes = ["fieldRow", "fieldRowCompact", "selectionInlineField", className].filter(Boolean).join(" ");
  return `
    <label class="${classes}">
      <span class="label">${escapeHtml(label)}</span>
      <select data-${prefix}-field="${escapeHtml(fieldKey)}" data-${prefix}-index="${selectedIndex}">
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
          .join("")}
      </select>
    </label>
  `;
}

function renderMixedSelectField(prefix, fieldKey, label, value, selectedIndex, options, className = "", mixedLabel = "Mixed") {
  const normalizedOptions = value === MIXED_FIELD_VALUE
    ? [{ value: MIXED_FIELD_VALUE, label: mixedLabel, disabled: true }, ...options]
    : options;
  const classes = ["fieldRow", "fieldRowCompact", "selectionInlineField", className].filter(Boolean).join(" ");
  return `
    <label class="${classes}">
      <span class="label">${escapeHtml(label)}</span>
      <select data-${prefix}-field="${escapeHtml(fieldKey)}" data-${prefix}-index="${selectedIndex}">
        ${normalizedOptions
          .map((option) => `
            <option
              value="${escapeHtml(option.value)}"
              ${option.value === value ? "selected" : ""}
              ${option.disabled ? "disabled" : ""}
            >
              ${escapeHtml(option.label)}
            </option>
          `)
          .join("")}
      </select>
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

function resolveSharedValue(values) {
  if (!values.length) return MIXED_FIELD_VALUE;
  const [firstValue, ...remainingValues] = values;
  return remainingValues.every((value) => value === firstValue) ? firstValue : MIXED_FIELD_VALUE;
}

function renderSelectionFields(fieldMarkup) {
  return `
    <div class="selectionInspectorCard compactSelectionCard">
      <div class="selectionEditorFlow">${fieldMarkup}</div>
    </div>
  `;
}

function renderSmartSelectPill(selectedSoundIndex, mode, label, className = "") {
  return `
    <button
      type="button"
      class="selectionActionPill ${escapeHtml(className)}"
      data-sound-action="smart-select"
      data-sound-selection-mode="${escapeHtml(mode)}"
      data-sound-index="${selectedSoundIndex}"
    >
      ${escapeHtml(label)}
    </button>
  `;
}

function renderFieldActions(actions, className = "") {
  if (!actions.length) return "";

  return `
    <span class="selectionFieldActions ${escapeHtml(className)}">
      ${actions.join("")}
    </span>
  `;
}

function renderReadOnlyField(label, value, className = "") {
  const classes = ["fieldRow", "fieldRowCompact", "selectionInlineField", "selectionReadOnlyField", className].filter(Boolean).join(" ");
  return `
    <div class="${classes}">
      <span class="label">${escapeHtml(label)}</span>
      <span class="selectionValueChip">${escapeHtml(value)}</span>
    </div>
  `;
}

function renderSoundSmartSelectActions(selectedSoundIndex) {
  return renderFieldActions([
    renderSmartSelectPill(selectedSoundIndex, "same-type", "same type"),
    renderSmartSelectPill(selectedSoundIndex, "same-source", "same source"),
    renderSmartSelectPill(selectedSoundIndex, "same-type-source", "type + source"),
  ], "selectionSoundSmartActions");
}

function renderSoundTypeField(sound, selectedSoundIndex) {
  const soundTypeOptions = SOUND_PRESETS.map((preset) => ({ value: preset.type, label: preset.defaultName }));
  return `
    <div class="selectionInlineCluster selectionSoundTypeCluster">
      ${renderSelectField("sound", "type", "Type", sound.type, selectedSoundIndex, soundTypeOptions, "selectionFieldType")}
    </div>
  `;
}

function renderSoundPreviewControls(sound, selectedSoundIndex, previewState, scanState) {
  const authoredSource = getAuthoredSoundSource(sound) || "";
  const isPreviewingSelectedSound = previewState?.playbackState === "playing" && previewState?.soundIndex === selectedSoundIndex;
  const hasPreviewError = Boolean(previewState?.error) && previewState?.soundIndex === selectedSoundIndex;
  const scanIsActive = (scanState?.playbackState || "idle") !== "idle";
  const statusLabel = scanIsActive
    ? "Scan active"
    : isPreviewingSelectedSound
      ? "Previewing"
      : hasPreviewError
        ? previewState.error
        : authoredSource
          ? "Ready"
          : "No source";
  const statusTone = scanIsActive ? "warning" : isPreviewingSelectedSound ? "active" : hasPreviewError ? "error" : "idle";

  return `
    <span class="selectionFieldActions selectionSoundPreviewActions">
      <button
        type="button"
        class="selectionActionPill ${isPreviewingSelectedSound ? "isActive" : ""}"
        data-sound-action="preview-play"
        data-sound-index="${selectedSoundIndex}"
        ${!authoredSource || scanIsActive ? "disabled" : ""}
      >
        Play
      </button>
      <button
        type="button"
        class="selectionActionPill"
        data-sound-action="preview-stop"
        data-sound-index="${selectedSoundIndex}"
        ${isPreviewingSelectedSound ? "" : "disabled"}
      >
        Stop
      </button>
      <span class="selectionStatusPill is-${escapeHtml(statusTone)}">${escapeHtml(statusLabel)}</span>
    </span>
  `;
}

function renderSoundSourceField(sound, selectedSoundIndex, previewState, scanState) {
  const authoredSource = getAuthoredSoundSource(sound) || "";
  const selectedAsset = findSoundAssetByPath(authoredSource);
  const assetOptions = getSoundAssetOptionsForType(sound?.type);

  const fieldMarkup = !assetOptions.length
    ? renderTextField("sound", "source", "Source", authoredSource, selectedSoundIndex, "selectionFieldVariant selectionParamField selectionSourceField")
    : (() => {
      const optionMarkup = [];

      optionMarkup.push(`<option value="" ${!authoredSource ? "selected" : ""}>Unassigned</option>`);

      const seenCategories = new Set();
      for (const asset of assetOptions) {
        if (!seenCategories.has(asset.category)) {
          if (seenCategories.size > 0) optionMarkup.push("</optgroup>");
          optionMarkup.push(`<optgroup label="${escapeHtml(getSoundAssetCategoryLabel(asset.category))}">`);
          seenCategories.add(asset.category);
        }

        const optionLabel = asset.hint && asset.hint !== getSoundAssetCategoryLabel(asset.category)
          ? `${asset.label} · ${asset.hint}`
          : asset.label;
        optionMarkup.push(`<option value="${escapeHtml(asset.value)}" ${asset.value === authoredSource ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`);
      }
      if (seenCategories.size > 0) optionMarkup.push("</optgroup>");

      if (authoredSource && !selectedAsset) {
        optionMarkup.push(`<option value="${escapeHtml(authoredSource)}" selected>Custom source · ${escapeHtml(authoredSource)}</option>`);
      }

      return `
        <label class="fieldRow fieldRowCompact selectionInlineField selectionSourceField selectionSourcePickerField">
          <span class="label">Source</span>
          <select data-sound-field="source" data-sound-index="${selectedSoundIndex}">
            ${optionMarkup.join("")}
          </select>
        </label>
      `;
    })();

  return `
    <div class="selectionInlineCluster selectionSoundSourceCluster">
      ${fieldMarkup}
      ${renderSoundPreviewControls(sound, selectedSoundIndex, previewState, scanState)}
      ${renderSoundSmartSelectActions(selectedSoundIndex)}
    </div>
  `;
}

function getBatchSoundAssetOptions(selectedSounds) {
  const selectedTypes = new Set(selectedSounds.map((sound) => sound?.type).filter(Boolean));
  const assetOptions = selectedTypes.size > 1
    ? getSoundAssetCatalog()
    : getSoundAssetOptionsForType(selectedSounds[0]?.type);
  const seen = new Set();

  return assetOptions.filter((option) => {
    if (!option?.value || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function renderBatchSoundTypeSummary(selectedSounds, selectedSoundIndex) {
  const sharedType = resolveSharedValue(selectedSounds.map((sound) => sound?.type || ""));
  const typeLabel = sharedType === MIXED_FIELD_VALUE ? "Mixed" : sharedType || "Unassigned";

  return `
    <div class="selectionInlineCluster selectionSoundTypeCluster">
      ${renderReadOnlyField("Type", typeLabel, "selectionFieldType")}
    </div>
  `;
}

function renderBatchSoundSourceField(selectedSounds, selectedSoundIndex) {
  const sharedSource = resolveSharedValue(selectedSounds.map((sound) => getAuthoredSoundSource(sound) || ""));
  const selectedAsset = sharedSource && sharedSource !== MIXED_FIELD_VALUE ? findSoundAssetByPath(sharedSource) : null;
  const assetOptions = getBatchSoundAssetOptions(selectedSounds);

  const fieldMarkup = !assetOptions.length
    ? `
      <label class="fieldRow fieldRowCompact selectionInlineField selectionParamField selectionSourceField">
        <span class="label">Source</span>
        <input
          type="text"
          value="${sharedSource === MIXED_FIELD_VALUE ? "" : escapeHtml(sharedSource)}"
          placeholder="${sharedSource === MIXED_FIELD_VALUE ? "Mixed source" : ""}"
          data-sound-field="source"
          data-sound-index="-1"
        />
      </label>
    `
    : (() => {
      const optionMarkup = [];
      if (sharedSource === MIXED_FIELD_VALUE) {
        optionMarkup.push(`<option value="${MIXED_FIELD_VALUE}" selected disabled>Mixed source</option>`);
      } else {
        optionMarkup.push(`<option value="" ${!sharedSource ? "selected" : ""}>Unassigned</option>`);
      }

      const seenCategories = new Set();
      for (const asset of assetOptions) {
        if (!seenCategories.has(asset.category)) {
          if (seenCategories.size > 0) optionMarkup.push("</optgroup>");
          optionMarkup.push(`<optgroup label="${escapeHtml(getSoundAssetCategoryLabel(asset.category))}">`);
          seenCategories.add(asset.category);
        }

        const optionLabel = asset.hint && asset.hint !== getSoundAssetCategoryLabel(asset.category)
          ? `${asset.label} · ${asset.hint}`
          : asset.label;
        optionMarkup.push(`<option value="${escapeHtml(asset.value)}" ${asset.value === sharedSource ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`);
      }
      if (seenCategories.size > 0) optionMarkup.push("</optgroup>");

      if (sharedSource && sharedSource !== MIXED_FIELD_VALUE && !selectedAsset) {
        optionMarkup.push(`<option value="${escapeHtml(sharedSource)}" selected>Custom source · ${escapeHtml(sharedSource)}</option>`);
      }

      return `
        <label class="fieldRow fieldRowCompact selectionInlineField selectionSourceField selectionSourcePickerField">
          <span class="label">Source</span>
          <select data-sound-field="source" data-sound-index="-1">
            ${optionMarkup.join("")}
          </select>
        </label>
      `;
    })();

  return `
    <div class="selectionInlineCluster selectionSoundSourceCluster">
      ${fieldMarkup}
      ${renderSoundSmartSelectActions(selectedSoundIndex)}
    </div>
  `;
}

function renderBatchSoundParamField(paramKey, label, inputType, value, options = {}) {
  if (inputType === "boolean-select") {
    return renderMixedSelectField(
      "sound",
      `param:${paramKey}`,
      label,
      value === MIXED_FIELD_VALUE ? MIXED_FIELD_VALUE : String(Boolean(value)),
      -1,
      [
        { value: "true", label: "On" },
        { value: "false", label: "Off" },
      ],
      "selectionParamField",
      `Mixed ${label.toLowerCase()}`,
    ).replace(`data-sound-field="param:${escapeHtml(paramKey)}"`, `data-sound-param-key="${escapeHtml(paramKey)}" data-sound-param-type="boolean"`);
  }

  return `
    <label class="fieldRow fieldRowCompact selectionInlineField selectionParamField">
      <span class="label">${escapeHtml(label)}</span>
      <input
        type="number"
        step="any"
        value="${value === MIXED_FIELD_VALUE ? "" : escapeHtml(value)}"
        placeholder="${value === MIXED_FIELD_VALUE ? `Mixed ${label.toLowerCase()}` : ""}"
        data-sound-param-key="${escapeHtml(paramKey)}"
        data-sound-param-type="number"
        data-sound-index="-1"
      />
    </label>
  `;
}

function renderBatchSoundEditor(selectedSounds, selectedSoundIndex) {
  const sharedSpatial = resolveSharedValue(selectedSounds.map((sound) => Boolean(sound?.params?.spatial)));
  const sharedVolume = resolveSharedValue(selectedSounds.map((sound) => sound?.params?.volume ?? 0));
  const sharedPitch = resolveSharedValue(selectedSounds.map((sound) => sound?.params?.pitch ?? 1));
  const sharedLoop = resolveSharedValue(selectedSounds.map((sound) => Boolean(sound?.params?.loop)));

  return renderSelectionFields([
    renderBatchSoundTypeSummary(selectedSounds, selectedSoundIndex),
    renderBatchSoundSourceField(selectedSounds, selectedSoundIndex),
    renderBatchSoundParamField("spatial", "Spatial", "boolean-select", sharedSpatial),
    renderBatchSoundParamField("volume", "Volume", "number", sharedVolume),
    renderBatchSoundParamField("pitch", "Pitch", "number", sharedPitch),
    renderBatchSoundParamField("loop", "Loop", "boolean-select", sharedLoop),
  ].join(""));
}

function renderEntityEditor(entity, selectedEntityIndex) {
  return renderSelectionFields([
    renderTextField("entity", "name", "Name", entity.name, selectedEntityIndex, "selectionFieldName"),
    renderTextField("entity", "type", "Type", entity.type, selectedEntityIndex, "selectionFieldType"),
    renderNumberField("entity", "x", "X", entity.x, selectedEntityIndex),
    renderNumberField("entity", "y", "Y", entity.y, selectedEntityIndex),
    renderCheckboxField("entity", "visible", "Visible", entity.visible, selectedEntityIndex, "selectionFieldToggle"),
    renderParamFields("entity", entity?.params, selectedEntityIndex),
  ].join(""));
}

function renderDecorEditor(decor, selectedDecorIndex) {
  return renderSelectionFields([
    renderTextField("decor", "name", "Name", decor.name, selectedDecorIndex, "selectionFieldName"),
    renderTextField("decor", "type", "Type", decor.type, selectedDecorIndex, "selectionFieldType"),
    renderNumberField("decor", "x", "X", decor.x, selectedDecorIndex),
    renderNumberField("decor", "y", "Y", decor.y, selectedDecorIndex),
    renderCheckboxField("decor", "visible", "Visible", decor.visible, selectedDecorIndex, "selectionFieldToggle"),
    renderTextField("decor", "variant", "Variant", decor.variant, selectedDecorIndex, "selectionFieldVariant selectionParamField"),
    renderParamFields("decor", decor?.params, selectedDecorIndex),
  ].join(""));
}

function renderSoundEditor(sound, selectedSoundIndex, previewState, scanState) {
  return renderSelectionFields([
    renderTextField("sound", "name", "Name", sound.name, selectedSoundIndex, "selectionFieldName"),
    renderSoundTypeField(sound, selectedSoundIndex),
    renderSoundSourceField(sound, selectedSoundIndex, previewState, scanState),
    renderNumberField("sound", "x", "X", sound.x, selectedSoundIndex),
    renderNumberField("sound", "y", "Y", sound.y, selectedSoundIndex),
    renderCheckboxField("sound", "visible", "Visible", sound.visible, selectedSoundIndex, "selectionFieldToggle"),
    renderParamFields("sound", sound?.params, selectedSoundIndex),
  ].join(""));
}

function renderMultiSelectionState(kind, count, primaryName) {
  const noun = kind === "decor"
    ? (count === 1 ? "decor item" : "decor items")
    : kind === "sound"
      ? (count === 1 ? "sound object" : "sound objects")
      : count === 1
        ? "entity"
        : "entities";

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

function renderSelectionEditor(state, emptyMessage, options = {}) {
  const { soundMode = "full" } = options;
  const active = state.document.active;
  const selectedEntityIndices = getSelectedEntityIndices(state.interaction);
  const selectedDecorIndices = getSelectedDecorIndices(state.interaction);
  const selectedSoundIndices = getSelectedSoundIndices(state.interaction);
  const selectedEntityIndex = getPrimarySelectedEntityIndex(state.interaction);
  const selectedDecorIndex = getPrimarySelectedDecorIndex(state.interaction);
  const selectedSoundIndex = getPrimarySelectedSoundIndex(state.interaction);
  const selectedEntity = Number.isInteger(selectedEntityIndex) ? active.entities?.[selectedEntityIndex] : null;
  const selectedDecor = Number.isInteger(selectedDecorIndex) ? active.decor?.[selectedDecorIndex] : null;
  const selectedSound = Number.isInteger(selectedSoundIndex) ? active.sounds?.[selectedSoundIndex] : null;
  const selectedSounds = selectedSoundIndices
    .map((index) => active.sounds?.[index] || null)
    .filter(Boolean);

  if (selectedEntityIndices.length > 1) {
    return { markup: renderMultiSelectionState("entity", selectedEntityIndices.length, selectedEntity?.name || "Entity"), isEmpty: false };
  }

  if (selectedDecorIndices.length > 1) {
    return { markup: renderMultiSelectionState("decor", selectedDecorIndices.length, selectedDecor?.name || "Decor"), isEmpty: false };
  }

  if (selectedSoundIndices.length > 1) {
    if (soundMode === "summary") {
      return { markup: "", isEmpty: true };
    }
    return { markup: renderBatchSoundEditor(selectedSounds, selectedSoundIndex), isEmpty: false };
  }

  if (selectedEntity) {
    return { markup: renderEntityEditor(selectedEntity, selectedEntityIndex), isEmpty: false };
  }

  if (selectedDecor) {
    return { markup: renderDecorEditor(selectedDecor, selectedDecorIndex), isEmpty: false };
  }

  if (selectedSound) {
    if (soundMode === "summary") {
      return { markup: "", isEmpty: true };
    }
    return { markup: renderSoundEditor(selectedSound, selectedSoundIndex, state.soundPreview, state.scan), isEmpty: false };
  }

  return {
    markup: emptyMessage ? `<div class="selectionEditorEmptyState">${escapeHtml(emptyMessage)}</div>` : "",
    isEmpty: true,
  };
}

function applyParamChange(target, prefix, onUpdate, options = {}) {
  const paramKey = target.dataset[`${prefix}ParamKey`];
  if (!paramKey) return false;

  const index = Number.parseInt(target.dataset[`${prefix}Index`] || "", 10);
  const allowBatchSelection = Boolean(options.allowBatchSelection);
  if (!Number.isInteger(index) || (index < 0 && (!allowBatchSelection || index !== -1))) return false;

  const paramType = target.dataset[`${prefix}ParamType`];
  if (paramType === "boolean") {
    const nextValue = isTextInputElement(target) && target.type === "checkbox"
      ? target.checked
      : target.value === "true";
    if (!isTextInputElement(target) && !isSelectElement(target)) return false;
    if (isSelectElement(target) && target.value === MIXED_FIELD_VALUE) return true;
    onUpdate?.(index, "param", { key: paramKey, value: nextValue });
    return true;
  }

  if (paramType === "number") {
    if (typeof target.value === "string" && !target.value.trim()) return true;
    const parsed = Number.parseFloat(target.value);
    if (!Number.isFinite(parsed)) return true;
    const value = parsed;
    onUpdate?.(index, "param", { key: paramKey, value });
    return true;
  }

  onUpdate?.(index, "param", { key: paramKey, value: target.value });
  return true;
}

export function renderSelectionEditorPanel(panel, state, options = {}) {
  const {
    loadingMessage = "Loading document…",
    documentError = state.document.error,
    noDocumentMessage = "No document loaded.",
    emptyMessage = "",
  } = options;

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

  const { markup, isEmpty } = renderSelectionEditor(state, emptyMessage, options);
  setPanelMarkup(panel, markup, isEmpty);
}

export function bindSelectionEditorPanel(panel, store, options = {}) {
  const { onEntityUpdate, onDecorUpdate, onSoundUpdate } = options;

  const handleChange = (target, prefix, allowedFields, onUpdate, changeOptions = {}) => {
    if (applyParamChange(target, prefix, onUpdate, changeOptions)) return true;

    const field = target.dataset[`${prefix}Field`];
    if (!allowedFields.includes(field)) return false;

    const index = Number.parseInt(target.dataset[`${prefix}Index`] || "", 10);
    const allowBatchSelection = Boolean(changeOptions.allowBatchSelection);
    if (!Number.isInteger(index) || (index < 0 && (!allowBatchSelection || index !== -1))) return false;
    if (isSelectElement(target) && target.value === MIXED_FIELD_VALUE) return true;

    if (field === "visible") {
      onUpdate?.(index, "visible", target.checked);
      return true;
    }

    if (field === "x" || field === "y") {
      const parsed = Number.parseInt(target.value, 10);
      const value = Number.isInteger(parsed) ? parsed : 0;
      target.value = String(value);
      onUpdate?.(index, field, value);
      return true;
    }

    onUpdate?.(index, field, target.value);
    return true;
  };

  const onChange = (event) => {
    const target = event.target;
    if (!isTextInputElement(target) && !isSelectElement(target)) return;

    if (handleChange(target, "entity", ["name", "type", "visible", "x", "y"], onEntityUpdate)) return;
    if (handleChange(target, "decor", ["name", "type", "variant", "visible", "x", "y"], onDecorUpdate)) return;
    handleChange(target, "sound", ["name", "type", "source", "visible", "x", "y"], onSoundUpdate, { allowBatchSelection: true });
  };

  const onInput = (event) => {
    const target = event.target;
    if (!isTextInputElement(target) && !isSelectElement(target)) return;

    if (handleChange(target, "entity", ["name", "type", "visible", "x", "y"], onEntityUpdate)) return;
    if (handleChange(target, "decor", ["name", "type", "variant", "visible", "x", "y"], onDecorUpdate)) return;
    handleChange(target, "sound", ["name", "type", "source", "visible", "x", "y"], onSoundUpdate, { allowBatchSelection: true });
  };

  const onClick = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const soundActionButton = target.closest("[data-sound-action]");
    if (!(soundActionButton instanceof HTMLButtonElement)) return;

    const action = soundActionButton.dataset.soundAction;
    const index = Number.parseInt(soundActionButton.dataset.soundIndex || "", 10);
    if (action === "smart-select" && Number.isInteger(index) && index >= 0) {
      onSoundUpdate?.(index, "smart-select", soundActionButton.dataset.soundSelectionMode || null);
      return;
    }
    if ((action === "preview-play" || action === "preview-stop") && Number.isInteger(index) && index >= 0) {
      onSoundUpdate?.(index, action, null);
    }
  };

  panel.addEventListener("change", onChange);
  panel.addEventListener("input", onInput);
  panel.addEventListener("click", onClick);

  return () => {
    panel.removeEventListener("change", onChange);
    panel.removeEventListener("input", onInput);
    panel.removeEventListener("click", onClick);
  };
}
