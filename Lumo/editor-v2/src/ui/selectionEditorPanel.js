import { getPrimarySelectedEntityIndex, getSelectedEntityIndices } from "../domain/entities/selection.js";
import { getPrimarySelectedDecorId, getPrimarySelectedDecorIndex, getSelectedDecorIndices } from "../domain/decor/selection.js";
import { getDecorVisual } from "../domain/decor/decorVisuals.js";
import { getPrimarySelectedSoundId, getPrimarySelectedSoundIndex, getSelectedSoundIndices } from "../domain/sound/selection.js";
import { cloneEntityParams, getEntityParamInputType } from "../domain/entities/entityParams.js";
import { BRUSH_SPRITE_OPTIONS, findBrushSpriteOptionByValue } from "../domain/tiles/tileSpriteCatalog.js";
import { SOUND_PRESETS } from "../domain/sound/soundPresets.js";
import {
  findSoundAssetByPath,
  getSoundAssetCategoryLabel,
  getSoundAssetOptionsForType,
} from "../domain/sound/audioAssetCatalog.js";
import { getAuthoredSoundSource } from "../domain/sound/sourceReference.js";
import { getThemeDefaultAmbientAssetPath, rankSoundAssetOptionsForTheme } from "../domain/theme/themeProfiles.js";
import { stopNativeInputKeyboardPropagation } from "./nativeInputGuards.js";

const MIXED_FIELD_VALUE = "__mixed__";
const FLOWER_DECOR_TYPE = "decor_flower_01";

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

function isTextAreaElement(value) {
  return typeof HTMLTextAreaElement !== "undefined" && value instanceof HTMLTextAreaElement;
}

function isSelectElement(value) {
  return typeof HTMLSelectElement !== "undefined" && value instanceof HTMLSelectElement;
}

function isKeyboardIsolatedInput(value) {
  return isTextInputElement(value) || isTextAreaElement(value) || isSelectElement(value);
}

function isDraftableInput(value) {
  return isTextInputElement(value) && value.type !== "checkbox" && value.type !== "radio";
}

function getInputDraftStore(panel) {
  if (!(panel instanceof HTMLElement)) {
    return new Map();
  }

  if (!(panel.__selectionInputDrafts instanceof Map)) {
    panel.__selectionInputDrafts = new Map();
  }

  return panel.__selectionInputDrafts;
}

function buildTrackedDataset(target) {
  if (!isKeyboardIsolatedInput(target)) return null;

  const datasetKeys = [
    "entityField",
    "entityId",
    "entityIndex",
    "entityParamKey",
    "entityParamPath",
    "entityParamType",
    "decorField",
    "decorId",
    "decorIndex",
    "decorParamKey",
    "decorParamPath",
    "decorParamType",
    "soundField",
    "soundId",
    "soundIndex",
    "soundParamKey",
    "soundParamPath",
    "soundParamType",
  ];

  const dataset = {};
  let hasDataset = false;
  for (const key of datasetKeys) {
    const value = target.dataset[key];
    if (typeof value === "string") {
      dataset[key] = value;
      hasDataset = true;
    }
  }

  return hasDataset ? dataset : null;
}

function serializeTrackedDataset(dataset) {
  return Object.entries(dataset)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");
}

function buildDatasetSelector(dataset) {
  return Object.entries(dataset)
    .map(([key, value]) => `[data-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}="${CSS.escape(value)}"]`)
    .join("");
}

function captureFocusedInput(panel) {
  const activeElement = document.activeElement;
  if (!isKeyboardIsolatedInput(activeElement)) return null;
  if (!panel.contains(activeElement)) return null;
  const dataset = buildTrackedDataset(activeElement);
  if (!dataset) return null;

  return {
    dataset,
    selectionStart: isTextInputElement(activeElement) ? activeElement.selectionStart : null,
    selectionEnd: isTextInputElement(activeElement) ? activeElement.selectionEnd : null,
    selectionDirection: isTextInputElement(activeElement) ? activeElement.selectionDirection : null,
  };
}

function restoreFocusedInput(panel, snapshot) {
  if (!snapshot) return;
  const selector = buildDatasetSelector(snapshot.dataset);
  if (!selector) return;

  const replacementInput = panel.querySelector(selector);
  if (!isKeyboardIsolatedInput(replacementInput)) return;

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

function renderObjectDatasetAttr(prefix, itemId = null) {
  return itemId ? `data-${prefix}-id="${escapeHtml(itemId)}"` : "";
}

function renderTextField(prefix, fieldKey, label, value, selectedIndex, className = "", itemId = null) {
  const classes = ["fieldRow", "fieldRowCompact", "selectionInlineField", className].filter(Boolean).join(" ");
  return `
    <label class="${classes}">
      <span class="label">${escapeHtml(label)}</span>
      <input type="text" value="${escapeHtml(value)}" data-${prefix}-field="${escapeHtml(fieldKey)}" data-${prefix}-index="${selectedIndex}" ${renderObjectDatasetAttr(prefix, itemId)} />
    </label>
  `;
}

function renderSelectField(prefix, fieldKey, label, value, selectedIndex, options, className = "", itemId = null) {
  const classes = ["fieldRow", "fieldRowCompact", "selectionInlineField", className].filter(Boolean).join(" ");
  return `
    <label class="${classes}">
      <span class="label">${escapeHtml(label)}</span>
      <select data-${prefix}-field="${escapeHtml(fieldKey)}" data-${prefix}-index="${selectedIndex}" ${renderObjectDatasetAttr(prefix, itemId)}>
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
          .join("")}
      </select>
    </label>
  `;
}

function renderMixedSelectField(prefix, fieldKey, label, value, selectedIndex, options, className = "", mixedLabel = "Mixed", itemId = null) {
  const normalizedOptions = value === MIXED_FIELD_VALUE
    ? [{ value: MIXED_FIELD_VALUE, label: mixedLabel, disabled: true }, ...options]
    : options;
  const classes = ["fieldRow", "fieldRowCompact", "selectionInlineField", className].filter(Boolean).join(" ");
  return `
    <label class="${classes}">
      <span class="label">${escapeHtml(label)}</span>
      <select data-${prefix}-field="${escapeHtml(fieldKey)}" data-${prefix}-index="${selectedIndex}" ${renderObjectDatasetAttr(prefix, itemId)}>
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

function renderNumberField(prefix, fieldKey, label, value, selectedIndex, className = "", itemId = null) {
  const classes = ["fieldRow", "fieldRowCompact", "selectionInlineField", "selectionCoordField", className].filter(Boolean).join(" ");
  return `
    <label class="${classes}">
      <span class="label">${escapeHtml(label)}</span>
      <input type="number" step="1" value="${value}" data-${prefix}-field="${escapeHtml(fieldKey)}" data-${prefix}-index="${selectedIndex}" ${renderObjectDatasetAttr(prefix, itemId)} />
    </label>
  `;
}

function formatNumericDisplay(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "";
  if (Math.abs(numericValue) >= 1000 || Number.isInteger(numericValue)) return String(Math.round(numericValue * 1000) / 1000).replace(/\.0+$/, "");
  return numericValue.toFixed(3).replace(/\.?0+$/, "");
}

function renderCheckboxField(prefix, fieldKey, label, value, selectedIndex, className = "", itemId = null) {
  const classes = ["fieldRow", "compactInline", "compactBooleanField", "selectionInlineField", "selectionInlineCheckbox", className].filter(Boolean).join(" ");
  return `
    <label class="${classes}">
      <span class="label">${escapeHtml(label)}</span>
      <input type="checkbox" ${value ? "checked" : ""} data-${prefix}-field="${escapeHtml(fieldKey)}" data-${prefix}-index="${selectedIndex}" ${renderObjectDatasetAttr(prefix, itemId)} />
    </label>
  `;
}

function renderParamField(prefix, paramKey, paramValue, selectedIndex, itemId = null) {
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
          ${renderObjectDatasetAttr(prefix, itemId)}
        />
      </label>
    `;
  }

  if (inputType === "json") {
    return `
      <label class="fieldRow fieldRowCompact selectionInlineField selectionParamField selectionJsonParamField">
        <span class="label">${label}</span>
        <input
          type="text"
          value="${escapeHtml(JSON.stringify(paramValue))}"
          data-${prefix}-param-key="${escapedKey}"
          data-${prefix}-param-type="json"
          data-${prefix}-index="${selectedIndex}"
          ${renderObjectDatasetAttr(prefix, itemId)}
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
        ${renderObjectDatasetAttr(prefix, itemId)}
      />
    </label>
  `;
}

function isMovingPlatformEntityType(type) {
  return String(type || "").trim().toLowerCase() === "movingplatform";
}

function buildMovingPlatformVisualOptions(selectedValue) {
  const fallbackOption = { value: "", label: "Default platform visual", img: null };
  // Moving platforms should offer gameplay tile visuals (not decor/audio/entity assets).
  // Prefer platform-compatible collision tiles first, then include the full tile visual catalog as a safe fallback.
  const preferredOptions = BRUSH_SPRITE_OPTIONS.filter((option) => option?.collisionType === "solid");
  const catalogOptions = (preferredOptions.length > 0 ? preferredOptions : BRUSH_SPRITE_OPTIONS)
    .map((option) => ({
      value: String(option?.value || "").trim(),
      label: option?.group ? `${option.label} · ${option.group}` : option?.label || option?.value || "Unnamed tile",
      img: option?.img || null,
    }))
    .filter((option) => option.value);

  const normalizedSelectedValue = String(selectedValue || "").trim();
  const hasSelectedCatalogOption = normalizedSelectedValue.length > 0
    && catalogOptions.some((option) => option.value === normalizedSelectedValue);
  if (normalizedSelectedValue.length > 0 && !hasSelectedCatalogOption) {
    catalogOptions.unshift({
      value: normalizedSelectedValue,
      label: `Custom tile id · ${normalizedSelectedValue}`,
      img: null,
    });
  }

  return [fallbackOption, ...catalogOptions];
}

function renderMovingPlatformSpriteTileField(prefix, paramKey, paramValue, selectedIndex, itemId = null) {
  const options = buildMovingPlatformVisualOptions(paramValue);
  const selectedOption = options.find((option) => option.value === paramValue) || options[0];
  const selectedSwatchSrc = selectedOption?.value
    ? findBrushSpriteOptionByValue(selectedOption.value)?.img || selectedOption?.img || null
    : null;

  return `
    <div class="selectionTilePickerField">
      <label class="fieldRow fieldRowCompact selectionInlineField selectionParamField selectionTilePickerSelect">
        <span class="label">${escapeHtml(formatParamLabel(paramKey))}</span>
        <select
          data-${prefix}-param-key="${escapeHtml(paramKey)}"
          data-${prefix}-param-type="text"
          data-${prefix}-index="${selectedIndex}"
          ${renderObjectDatasetAttr(prefix, itemId)}
        >
          ${options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === paramValue ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
      ${selectedSwatchSrc
        ? `<span class="selectionTileSwatch"><img src="${escapeHtml(selectedSwatchSrc)}" alt="${escapeHtml(selectedOption?.label || "Selected tile")}" /><span>${escapeHtml(selectedOption?.label || "")}</span></span>`
        : ""}
    </div>
  `;
}

function renderParamFields(prefix, params, selectedIndex, itemId = null, options = {}) {
  const { objectType = "" } = options;
  return Object.entries(cloneEntityParams(params))
    .map(([paramKey, paramValue]) => {
      if (prefix === "entity" && isMovingPlatformEntityType(objectType) && paramKey === "spriteTileId") {
        // Moving platforms expose tile visuals as a picker so designers do not need to memorize raw tile IDs.
        return renderMovingPlatformSpriteTileField(prefix, paramKey, String(paramValue || ""), selectedIndex, itemId);
      }
      return renderParamField(prefix, paramKey, paramValue, selectedIndex, itemId);
    })
    .join("");
}

function isLoopSupportedSoundType(soundType) {
  const normalizedType = String(soundType || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  return normalizedType === "trigger" || normalizedType === "ambientzone" || normalizedType === "musiczone";
}

function resolveFlowerVariantParamValue(decor) {
  const paramVariant = decor?.params?.variant;
  const normalizedParamVariant = Number.parseInt(String(paramVariant ?? "").trim(), 10);
  if (Number.isInteger(normalizedParamVariant) && normalizedParamVariant >= 1 && normalizedParamVariant <= 4) {
    return String(normalizedParamVariant);
  }

  const normalizedLegacyVariant = String(decor?.variant || "").trim().toLowerCase();
  if (normalizedLegacyVariant === "b") return "2";
  if (normalizedLegacyVariant === "c") return "3";
  if (normalizedLegacyVariant === "d") return "4";
  return "1";
}

function renderFlowerVariantParamField(decor, selectedDecorIndex) {
  const selectedVariant = resolveFlowerVariantParamValue(decor);
  return `
    <label class="fieldRow compactInline selectionInlineField selectionParamField">
      <span class="label">Variant</span>
      <select
        data-decor-param-key="variant"
        data-decor-param-type="number"
        data-decor-index="${selectedDecorIndex}"
        ${renderObjectDatasetAttr("decor", decor?.id || null)}
      >
        <option value="1" ${selectedVariant === "1" ? "selected" : ""}>1</option>
        <option value="2" ${selectedVariant === "2" ? "selected" : ""}>2</option>
        <option value="3" ${selectedVariant === "3" ? "selected" : ""}>3</option>
        <option value="4" ${selectedVariant === "4" ? "selected" : ""}>4</option>
      </select>
    </label>
  `;
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
      ${renderSelectField("sound", "type", "Type", sound.type, selectedSoundIndex, soundTypeOptions, "selectionFieldType", sound?.id || null)}
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

function renderSoundSourceField(sound, selectedSoundIndex, previewState, scanState, themeId) {
  const authoredSource = getAuthoredSoundSource(sound) || "";
  const selectedAsset = findSoundAssetByPath(authoredSource);
  const assetOptions = rankSoundAssetOptionsForTheme(getSoundAssetOptionsForType(sound?.type), themeId, sound?.type);
  const hasAuthoredOption = assetOptions.some((asset) => asset.value === authoredSource);
  const recommendedAmbientPath = sound?.type === "ambientZone" ? getThemeDefaultAmbientAssetPath(themeId) : null;
  const recommendedAmbientAsset = recommendedAmbientPath ? findSoundAssetByPath(recommendedAmbientPath) : null;
  const unassignedLabel = recommendedAmbientAsset
    ? `Recommended · ${recommendedAmbientAsset.label}`
    : recommendedAmbientPath
      ? `Recommended · ${recommendedAmbientPath.split("/").at(-1) || recommendedAmbientPath}`
      : "Unassigned";

  const fieldMarkup = !assetOptions.length
    ? renderTextField("sound", "source", "Source", authoredSource, selectedSoundIndex, "selectionFieldVariant selectionParamField selectionSourceField", sound?.id || null)
    : (() => {
      const optionMarkup = [];

      optionMarkup.push(`<option value="" ${!authoredSource ? "selected" : ""}>${escapeHtml(unassignedLabel)}</option>`);

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

      if (authoredSource && (!selectedAsset || !hasAuthoredOption)) {
        optionMarkup.push(`<option value="${escapeHtml(authoredSource)}" selected>Custom source · ${escapeHtml(authoredSource)}</option>`);
      }

      return `
        <label class="fieldRow fieldRowCompact selectionInlineField selectionSourceField selectionSourcePickerField">
          <span class="label">Source</span>
          <select data-sound-field="source" data-sound-index="${selectedSoundIndex}" ${renderObjectDatasetAttr("sound", sound?.id || null)}>
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

function getBatchSoundAssetOptions(selectedSounds, themeId) {
  const selectedTypes = new Set(selectedSounds.map((sound) => sound?.type).filter(Boolean));
  const assetOptions = selectedTypes.size > 1
    ? [...selectedTypes].flatMap((soundType) => getSoundAssetOptionsForType(soundType))
    : rankSoundAssetOptionsForTheme(getSoundAssetOptionsForType(selectedSounds[0]?.type), themeId, selectedSounds[0]?.type);
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

function renderBatchSoundSourceField(selectedSounds, selectedSoundIndex, themeId) {
  const sharedSource = resolveSharedValue(selectedSounds.map((sound) => getAuthoredSoundSource(sound) || ""));
  const selectedAsset = sharedSource && sharedSource !== MIXED_FIELD_VALUE ? findSoundAssetByPath(sharedSource) : null;
  const assetOptions = getBatchSoundAssetOptions(selectedSounds, themeId);
  const hasSharedOption = sharedSource && sharedSource !== MIXED_FIELD_VALUE
    ? assetOptions.some((asset) => asset.value === sharedSource)
    : false;

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

      if (sharedSource && sharedSource !== MIXED_FIELD_VALUE && (!selectedAsset || !hasSharedOption)) {
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

function renderBatchSoundEditor(selectedSounds, selectedSoundIndex, themeId) {
  const sharedSpatial = resolveSharedValue(selectedSounds.map((sound) => Boolean(sound?.params?.spatial)));
  const sharedVolume = resolveSharedValue(selectedSounds.map((sound) => sound?.params?.volume ?? 0));
  const sharedPitch = resolveSharedValue(selectedSounds.map((sound) => sound?.params?.pitch ?? 1));
  const sharedLoop = resolveSharedValue(selectedSounds.map((sound) => Boolean(sound?.params?.loop)));
  const showLoopField = selectedSounds.some((sound) => isLoopSupportedSoundType(sound?.type));

  return renderSelectionFields([
    renderBatchSoundTypeSummary(selectedSounds, selectedSoundIndex),
    renderBatchSoundSourceField(selectedSounds, selectedSoundIndex, themeId),
    renderBatchSoundParamField("spatial", "Spatial", "boolean-select", sharedSpatial),
    renderBatchSoundParamField("volume", "Volume", "number", sharedVolume),
    renderBatchSoundParamField("pitch", "Pitch", "number", sharedPitch),
    // Spot Sound does not expose loop because it already plays continuously while the player is within range.
    showLoopField ? renderBatchSoundParamField("loop", "Loop", "boolean-select", sharedLoop) : "",
  ].join(""));
}

function renderEntityEditor(entity, selectedEntityIndex) {
  return renderSelectionFields([
    renderTextField("entity", "name", "Name", entity.name, selectedEntityIndex, "selectionFieldName", entity?.id || null),
    renderTextField("entity", "type", "Type", entity.type, selectedEntityIndex, "selectionFieldType", entity?.id || null),
    renderNumberField("entity", "x", "X", entity.x, selectedEntityIndex, "", entity?.id || null),
    renderNumberField("entity", "y", "Y", entity.y, selectedEntityIndex, "", entity?.id || null),
    renderCheckboxField("entity", "visible", "Visible", entity.visible, selectedEntityIndex, "selectionFieldToggle", entity?.id || null),
    renderParamFields("entity", entity?.params, selectedEntityIndex, entity?.id || null, { objectType: entity?.type }),
  ].join(""));
}

function renderDecorEditor(decor, selectedDecorIndex) {
  const decorVisual = getDecorVisual(decor?.type);
  const sizeTiles = decorVisual?.sizeTiles
    ? `${decorVisual.sizeTiles.w}×${decorVisual.sizeTiles.h}t`
    : "n/a";
  const footprint = decorVisual?.footprint
    ? `${decorVisual.footprint.w}×${decorVisual.footprint.h}t`
    : "n/a";
  const drawSize = `${decorVisual?.drawW || 24}×${decorVisual?.drawH || 24}px`;
  const anchor = decorVisual?.drawAnchor || "BL";

  const isFlower = String(decor?.type || "").trim().toLowerCase() === FLOWER_DECOR_TYPE;
  const decorParams = cloneEntityParams(decor?.params);
  if (isFlower && Object.prototype.hasOwnProperty.call(decorParams, "variant")) {
    delete decorParams.variant;
  }

  return renderSelectionFields([
    `<div class="statusCard assetSelectionCard assetSelectionCardCompact">
      <div class="assetSelectionMeta">
        <span class="statusCardMeta">Size ${escapeHtml(sizeTiles)} · Footprint ${escapeHtml(footprint)} · Draw ${escapeHtml(drawSize)} · ${escapeHtml(anchor)} anchor</span>
      </div>
    </div>`,
    renderTextField("decor", "name", "Name", decor.name, selectedDecorIndex, "selectionFieldName", decor?.id || null),
    renderTextField("decor", "type", "Type", decor.type, selectedDecorIndex, "selectionFieldType", decor?.id || null),
    renderNumberField("decor", "x", "X", decor.x, selectedDecorIndex, "", decor?.id || null),
    renderNumberField("decor", "y", "Y", decor.y, selectedDecorIndex, "", decor?.id || null),
    renderCheckboxField("decor", "visible", "Visible", decor.visible, selectedDecorIndex, "selectionFieldToggle", decor?.id || null),
    renderCheckboxField("decor", "flipX", "Flip X", Boolean(decor?.flipX), selectedDecorIndex, "selectionFieldToggle", decor?.id || null),
    isFlower
      ? renderFlowerVariantParamField(decor, selectedDecorIndex)
      : renderTextField("decor", "variant", "Variant", decor.variant, selectedDecorIndex, "selectionFieldVariant selectionParamField", decor?.id || null),
    renderParamFields("decor", decorParams, selectedDecorIndex, decor?.id || null),
  ].join(""));
}

function renderSoundEditor(sound, selectedSoundIndex, previewState, scanState, themeId) {
  const soundParams = cloneEntityParams(sound?.params);
  // Spot Sound does not expose loop because it already plays continuously while the player is within range.
  if (!isLoopSupportedSoundType(sound?.type) && Object.prototype.hasOwnProperty.call(soundParams, "loop")) {
    delete soundParams.loop;
  }

  return renderSelectionFields([
    renderTextField("sound", "name", "Name", sound.name, selectedSoundIndex, "selectionFieldName", sound?.id || null),
    renderSoundTypeField(sound, selectedSoundIndex),
    renderSoundSourceField(sound, selectedSoundIndex, previewState, scanState, themeId),
    renderNumberField("sound", "x", "X", sound.x, selectedSoundIndex, "", sound?.id || null),
    renderNumberField("sound", "y", "Y", sound.y, selectedSoundIndex, "", sound?.id || null),
    renderCheckboxField("sound", "visible", "Visible", sound.visible, selectedSoundIndex, "selectionFieldToggle", sound?.id || null),
    renderParamFields("sound", soundParams, selectedSoundIndex, sound?.id || null),
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
        <span class="selectionEditorPlaceholderDetail">Batch editing is unavailable for this selection.</span>
        ${primaryName ? `<span class="selectionEditorPlaceholderDetail">Primary: ${escapeHtml(primaryName)}</span>` : ""}
      </div>
    </div>
  `;
}

function formatReadOnlyValue(value) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "—";
    }
  }
  return String(value);
}

function renderReadOnlyField(label, value) {
  return `
    <label class="fieldRow fieldRowCompact selectionInlineField isReadOnly">
      <span class="label">${escapeHtml(label)}</span>
      <output class="value">${escapeHtml(formatReadOnlyValue(value))}</output>
    </label>
  `;
}

function renderReactiveGrassPatchInspector(patch) {
  return renderSelectionFields([
    `<div class="statusCard assetSelectionCard assetSelectionCardCompact">
      <div class="assetSelectionMeta">
        <span class="statusCardMeta">Reactive Grass Patch · Read-only authored data</span>
      </div>
    </div>`,
    renderReadOnlyField("id", patch?.id),
    renderReadOnlyField("kind", patch?.kind),
    renderReadOnlyField("x", patch?.x),
    renderReadOnlyField("y", patch?.y),
    renderReadOnlyField("width", patch?.width),
    renderReadOnlyField("density", patch?.density),
    renderReadOnlyField("heightMin", patch?.heightMin),
    renderReadOnlyField("heightMax", patch?.heightMax),
    renderReadOnlyField("heightProfile", patch?.heightProfile),
    renderReadOnlyField("heightVariation", patch?.heightVariation),
    renderReadOnlyField("baseColor", patch?.baseColor),
    renderReadOnlyField("topColor", patch?.topColor),
    renderReadOnlyField("variant", patch?.variant),
    renderReadOnlyField("seed", patch?.seed),
  ].join(""));
}

function renderSelectionEditor(state, emptyMessage, options = {}) {
  const { soundMode = "full", hideEntityTypes = [] } = options;
  const active = state.document.active;
  const selectedEntityIndices = getSelectedEntityIndices(state.interaction);
  const selectedDecorIndices = getSelectedDecorIndices(state.interaction);
  const selectedSoundIndices = getSelectedSoundIndices(state.interaction);
  const selectedEntityIndex = getPrimarySelectedEntityIndex(state.interaction);
  const selectedDecorIndex = getPrimarySelectedDecorIndex(state.interaction);
  const selectedSoundIndex = getPrimarySelectedSoundIndex(state.interaction);
  const selectedEntityId = typeof state.interaction.selectedEntityId === "string" && state.interaction.selectedEntityId.trim()
    ? state.interaction.selectedEntityId
    : null;
  // CANONICAL ENTITY RUNTIME: resolve the bottom-panel entity editor from the live selected id first.
  // Do not trust stale entity indices when the authored entity order changes.
  const resolvedSelectedEntityIndex = selectedEntityId
    ? active.entities?.findIndex((entity) => entity?.id === selectedEntityId)
    : selectedEntityIndex;
  const selectedEntity = Number.isInteger(resolvedSelectedEntityIndex) && resolvedSelectedEntityIndex >= 0
    ? active.entities?.[resolvedSelectedEntityIndex]
    : null;
  const selectedDecorId = typeof getPrimarySelectedDecorId(state.interaction) === "string"
    ? getPrimarySelectedDecorId(state.interaction)
    : null;
  const resolvedSelectedDecorIndex = selectedDecorId
    ? active.decor?.findIndex((decor) => decor?.id === selectedDecorId)
    : selectedDecorIndex;
  const selectedDecor = Number.isInteger(resolvedSelectedDecorIndex) && resolvedSelectedDecorIndex >= 0
    ? active.decor?.[resolvedSelectedDecorIndex]
    : null;
  const selectedSoundId = typeof getPrimarySelectedSoundId(state.interaction) === "string"
    ? getPrimarySelectedSoundId(state.interaction)
    : null;
  const resolvedSelectedSoundIndex = selectedSoundId
    ? active.sounds?.findIndex((sound) => sound?.id === selectedSoundId)
    : selectedSoundIndex;
  const selectedSound = Number.isInteger(resolvedSelectedSoundIndex) && resolvedSelectedSoundIndex >= 0
    ? active.sounds?.[resolvedSelectedSoundIndex]
    : null;
  const selectedSounds = selectedSoundIndices
    .map((index) => active.sounds?.[index] || null)
    .filter(Boolean);
  const themeId = active?.meta?.themeId;
  const selectedReactiveGrassPatchId = typeof state?.interaction?.selectedReactiveGrassPatchId === "string" && state.interaction.selectedReactiveGrassPatchId.trim()
    ? state.interaction.selectedReactiveGrassPatchId.trim()
    : null;
  const selectedReactiveGrassPatchIndex = Number.isInteger(state?.interaction?.selectedReactiveGrassPatchIndex)
    ? state.interaction.selectedReactiveGrassPatchIndex
    : null;
  const selectedReactiveGrassPatch = selectedReactiveGrassPatchId
    ? (active.reactiveGrassPatches || []).find((patch) => patch?.id === selectedReactiveGrassPatchId) || null
    : Number.isInteger(selectedReactiveGrassPatchIndex) && selectedReactiveGrassPatchIndex >= 0
      ? active.reactiveGrassPatches?.[selectedReactiveGrassPatchIndex] || null
      : null;

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
    return { markup: renderBatchSoundEditor(selectedSounds, resolvedSelectedSoundIndex, themeId), isEmpty: false };
  }

  if (selectedReactiveGrassPatch) {
    return { markup: renderReactiveGrassPatchInspector(selectedReactiveGrassPatch), isEmpty: false };
  }

  if (selectedEntity) {
    if (hideEntityTypes.includes(String(selectedEntity.type || "").trim().toLowerCase())) {
      return { markup: "", isEmpty: true };
    }
    return { markup: renderEntityEditor(selectedEntity, resolvedSelectedEntityIndex), isEmpty: false };
  }

  if (selectedDecor) {
    return { markup: renderDecorEditor(selectedDecor, resolvedSelectedDecorIndex), isEmpty: false };
  }

  if (selectedSound) {
    if (soundMode === "summary") {
      return { markup: "", isEmpty: true };
    }
    return { markup: renderSoundEditor(selectedSound, resolvedSelectedSoundIndex, state.soundPreview, state.scan, themeId), isEmpty: false };
  }

  return {
    markup: emptyMessage ? `<div class="selectionEditorEmptyState">${escapeHtml(emptyMessage)}</div>` : "",
    isEmpty: true,
  };
}

function applyParamChange(target, prefix, onUpdate, options = {}) {
  const paramKey = target.dataset[`${prefix}ParamKey`];
  const paramPath = target.dataset[`${prefix}ParamPath`];
  if (!paramKey && !paramPath) return false;

  const index = Number.parseInt(target.dataset[`${prefix}Index`] || "", 10);
  const allowBatchSelection = Boolean(options.allowBatchSelection);
  if (!Number.isInteger(index) || (index < 0 && (!allowBatchSelection || index !== -1))) return false;
  const itemId = typeof target.dataset[`${prefix}Id`] === "string" && target.dataset[`${prefix}Id`].trim()
    ? target.dataset[`${prefix}Id`].trim()
    : null;

  const paramType = target.dataset[`${prefix}ParamType`];
  if (paramType === "boolean") {
    const nextValue = isTextInputElement(target) && target.type === "checkbox"
      ? target.checked
      : target.value === "true";
    if (!isTextInputElement(target) && !isSelectElement(target)) return false;
    if (isSelectElement(target) && target.value === MIXED_FIELD_VALUE) return true;
    onUpdate?.(index, "param", { __canonicalMutation: true, itemId, key: paramKey, path: paramPath, value: nextValue });
    return true;
  }

  if (paramType === "number") {
    if (typeof target.value === "string" && !target.value.trim()) return true;
    const parsed = Number.parseFloat(target.value);
    if (!Number.isFinite(parsed)) return true;
    const value = parsed;
    onUpdate?.(index, "param", { __canonicalMutation: true, itemId, key: paramKey, path: paramPath, value });
    return true;
  }

  if (paramType === "json") {
    if (typeof target.value !== "string" || !target.value.trim()) return true;
    try {
      const parsed = JSON.parse(target.value);
      onUpdate?.(index, "param", { __canonicalMutation: true, itemId, key: paramKey, path: paramPath, value: parsed });
    } catch {
      return true;
    }
    return true;
  }

  onUpdate?.(index, "param", { __canonicalMutation: true, itemId, key: paramKey, path: paramPath, value: target.value });
  return true;
}

export function getSelectionEditorPanelContent(state, options = {}) {
  const {
    loadingMessage = "Loading document…",
    documentError = state.document.error,
    noDocumentMessage = "No document loaded.",
    emptyMessage = "",
  } = options;

  if (state.document.status === "loading") {
    return { markup: `<div class="value">${escapeHtml(loadingMessage)}</div>`, isEmpty: false };
  }

  if (documentError) {
    return { markup: `<div class="value">${escapeHtml(documentError)}</div>`, isEmpty: false };
  }

  if (!state.document.active) {
    return { markup: `<div class="value">${escapeHtml(noDocumentMessage)}</div>`, isEmpty: false };
  }

  return renderSelectionEditor(state, emptyMessage, options);
}

export function renderSelectionEditorPanel(panel, state, options = {}) {
  const activeElement = document.activeElement;
  if (panel.contains(activeElement) && getInputDraftStore(panel).size > 0) {
    return;
  }

  const { markup, isEmpty } = getSelectionEditorPanelContent(state, options);
  setPanelMarkup(panel, markup, isEmpty);
}

export function bindSelectionEditorPanel(panel, store, options = {}) {
  const { onEntityUpdate, onDecorUpdate, onSoundUpdate } = options;
  let numberStepperSession = null;
  const getEditorPane = () => panel.querySelector("[data-bottom-panel-editor]");

  const updateInputDraft = (target) => {
    if (!isDraftableInput(target)) return;
    const editorPane = getEditorPane();
    if (!(editorPane instanceof HTMLElement) || !editorPane.contains(target)) return;

    const dataset = buildTrackedDataset(target);
    if (!dataset) return;

    const draftStore = getInputDraftStore(editorPane);
    draftStore.set(serializeTrackedDataset(dataset), true);
  };

  const clearInputDraft = (target) => {
    if (!isDraftableInput(target)) return;
    const editorPane = getEditorPane();
    if (!(editorPane instanceof HTMLElement)) return;

    const dataset = buildTrackedDataset(target);
    if (!dataset) return;

    getInputDraftStore(editorPane).delete(serializeTrackedDataset(dataset));
  };

  const commitDeferredNumberInput = (target) => {
    if (!isTextInputElement(target) || target.dataset.numberCommit !== "deferred") return false;
    const changeEvent = new Event("change", { bubbles: true });
    target.dispatchEvent(changeEvent);
    return true;
  };

  const handleChange = (target, prefix, allowedFields, onUpdate, changeOptions = {}) => {
    if (applyParamChange(target, prefix, onUpdate, changeOptions)) return true;

    const field = target.dataset[`${prefix}Field`];
    if (!allowedFields.includes(field)) return false;

    const index = Number.parseInt(target.dataset[`${prefix}Index`] || "", 10);
    const allowBatchSelection = Boolean(changeOptions.allowBatchSelection);
    if (!Number.isInteger(index) || (index < 0 && (!allowBatchSelection || index !== -1))) return false;
    if (isSelectElement(target) && target.value === MIXED_FIELD_VALUE) return true;
    const itemId = typeof target.dataset[`${prefix}Id`] === "string" && target.dataset[`${prefix}Id`].trim()
      ? target.dataset[`${prefix}Id`].trim()
      : null;
    const wrapMutationValue = (nextValue) => ({
      __canonicalMutation: true,
      itemId,
      value: nextValue,
    });

    if (field === "visible" || field === "flipX") {
      onUpdate?.(index, field, wrapMutationValue(target.checked));
      return true;
    }

    if (field === "x" || field === "y") {
      const parsed = Number.parseInt(target.value, 10);
      if (!Number.isInteger(parsed)) return true;
      const value = parsed;
      onUpdate?.(index, field, wrapMutationValue(value));
      return true;
    }

    onUpdate?.(index, field, wrapMutationValue(target.value));
    return true;
  };

  const onChange = (event) => {
    const target = event.target;
    if (!isTextInputElement(target) && !isSelectElement(target)) return;

    if (handleChange(target, "entity", ["name", "type", "visible", "x", "y"], onEntityUpdate)) {
      clearInputDraft(target);
      return;
    }
    if (handleChange(target, "decor", ["name", "type", "variant", "visible", "flipX", "x", "y"], onDecorUpdate)) {
      clearInputDraft(target);
      return;
    }
    handleChange(target, "sound", ["name", "type", "source", "visible", "x", "y"], onSoundUpdate, { allowBatchSelection: true });
    clearInputDraft(target);
  };

  const onInput = (event) => {
    const target = event.target;
    if (!isTextInputElement(target) && !isSelectElement(target)) return;
    if (isTextInputElement(target) && target.dataset.liveParam === "true") {
      const changeEvent = new Event("change", { bubbles: true });
      target.dispatchEvent(changeEvent);
    }
    if (isTextInputElement(target) && target.dataset.numberCommit === "deferred") return;
    if (!isDraftableInput(target)) return;
    updateInputDraft(target);
  };

  const nudgeDeferredNumberInput = (button, direction, event = null) => {
    const container = button.closest("[data-deferred-number]");
    const input = container?.querySelector('input[data-number-commit="deferred"]');
    if (!isTextInputElement(input)) return;

    const baseStep = Number.parseFloat(input.dataset.numberStep || "1");
    const largeStep = Number.parseFloat(input.dataset.numberLargeStep || String(baseStep * 4));
    const precision = input.dataset.numberPrecision === "int" ? "int" : "float";
    const step = event?.shiftKey ? largeStep : baseStep;
    const currentValue = Number.parseFloat(input.value);
    const safeValue = Number.isFinite(currentValue) ? currentValue : 0;
    const nextValue = precision === "int"
      ? Math.round(safeValue + direction * step)
      : Math.round((safeValue + direction * step) * 1000) / 1000;

    input.value = formatNumericDisplay(nextValue);
    commitDeferredNumberInput(input);
    input.focus({ preventScroll: true });
    input.select();
  };

  const clearNumberStepperSession = () => {
    if (!numberStepperSession) return;
    globalThis.clearTimeout(numberStepperSession.timeoutId);
    globalThis.clearInterval(numberStepperSession.intervalId);
    numberStepperSession = null;
  };

  const startNumberStepperSession = (button, direction, event) => {
    clearNumberStepperSession();
    nudgeDeferredNumberInput(button, direction, event);
    numberStepperSession = {
      timeoutId: globalThis.setTimeout(() => {
        numberStepperSession.intervalId = globalThis.setInterval(() => {
          nudgeDeferredNumberInput(button, direction, event);
        }, 90);
      }, 260),
      intervalId: null,
    };
  };

  const onKeyDown = (event) => {
    const target = event.target;
    if (!isTextInputElement(target)) return;
    if (target.dataset.numberCommit !== "deferred") return;

    if (event.key === "Enter") {
      event.preventDefault();
      commitDeferredNumberInput(target);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      target.blur();
    }
  };

  const onFocusOut = (event) => {
    const target = event.target;
    if (!isDraftableInput(target)) return;
    clearInputDraft(target);
  };

  const onClick = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const stepperButton = target.closest(".selectionStepperButton");
    if (stepperButton instanceof HTMLButtonElement) {
      event.preventDefault();
      return;
    }

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

  const onPointerDown = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const stepperButton = target.closest(".selectionStepperButton");
    if (!(stepperButton instanceof HTMLButtonElement)) return;
    const direction = Number.parseInt(stepperButton.dataset.stepDirection || "", 10);
    if (direction !== -1 && direction !== 1) return;
    event.preventDefault();
    startNumberStepperSession(stepperButton, direction, event);
  };

  panel.addEventListener("change", onChange);
  panel.addEventListener("input", onInput);
  panel.addEventListener("keydown", onKeyDown);
  panel.addEventListener("keydown", stopNativeInputKeyboardPropagation, true);
  panel.addEventListener("keyup", stopNativeInputKeyboardPropagation, true);
  panel.addEventListener("keypress", stopNativeInputKeyboardPropagation, true);
  panel.addEventListener("focusout", onFocusOut);
  panel.addEventListener("click", onClick);
  panel.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("pointerup", clearNumberStepperSession);
  document.addEventListener("pointercancel", clearNumberStepperSession);

  return () => {
    clearNumberStepperSession();
    panel.removeEventListener("change", onChange);
    panel.removeEventListener("input", onInput);
    panel.removeEventListener("keydown", onKeyDown);
    panel.removeEventListener("keydown", stopNativeInputKeyboardPropagation, true);
    panel.removeEventListener("keyup", stopNativeInputKeyboardPropagation, true);
    panel.removeEventListener("keypress", stopNativeInputKeyboardPropagation, true);
    panel.removeEventListener("focusout", onFocusOut);
    panel.removeEventListener("click", onClick);
    panel.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("pointerup", clearNumberStepperSession);
    document.removeEventListener("pointercancel", clearNumberStepperSession);
  };
}
