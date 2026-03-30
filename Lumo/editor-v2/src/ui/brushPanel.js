import {
  BRUSH_BEHAVIOR_OPTIONS,
  BRUSH_SIZE_OPTIONS,
  BRUSH_SPRITE_OPTIONS,
} from "../domain/tiles/brushOptions.js";
import { getBrushDraftSummary } from "../domain/tiles/brushDraft.js";
import { TOOL_OPTIONS, EDITOR_TOOLS, isEditorTool } from "../domain/tiles/tools.js";
import { ENTITY_PRESETS } from "../domain/entities/entityPresets.js";
import { DECOR_PRESETS } from "../domain/decor/decorPresets.js";
import { SOUND_PRESETS } from "../domain/sound/soundPresets.js";
import {
  findBrushSpriteOptionByValue,
  getFallbackBrushSizeForSprite,
  getSupportedSizesForBrushSprite,
  isBrushSizeSupportedForSprite,
} from "../domain/tiles/tileSpriteCatalog.js";
import { BACKGROUND_MATERIAL_OPTIONS } from "../domain/background/materialCatalog.js";

const PANEL_LAYERS = {
  TOOLS: "tools",
  TILES: "tiles",
  BACKGROUND: "background",
  ENTITIES: "entities",
  DECOR: "decor",
  SOUND: "sound",
};

const VISIBLE_TOOL_OPTIONS = TOOL_OPTIONS.filter((option) => (
  option.value === EDITOR_TOOLS.INSPECT
  || option.value === EDITOR_TOOLS.PAINT
  || option.value === EDITOR_TOOLS.ERASE
));

const HIDDEN_ENTITY_PRESET_IDS = new Set(["player-spawn", "fog_volume", "water_volume", "lava_volume", "bubbling_liquid_volume", "trigger", "generic"]);
const PLACEABLE_ENTITY_PRESETS = ENTITY_PRESETS.filter((preset) => !HIDDEN_ENTITY_PRESET_IDS.has(preset.id));
const COLLAPSIBLE_PANEL_DEFAULTS = {
  tiles: false,
  background: false,
  decor: false,
  entities: false,
  fogVolumes: false,
  sound: false,
};

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

function renderSection(sectionId, title, isOpen, content, sectionClass = "", headerContent = "") {
  return `
    <section class="panelSection ${sectionClass} ${isOpen ? "" : "isCollapsed"}" aria-label="${title} section">
      <div
        class="sectionHeaderRow"
        role="button"
        tabindex="0"
        data-section-toggle="${sectionId}"
        aria-expanded="${isOpen ? "true" : "false"}"
        aria-label="${title} section ${isOpen ? "collapse" : "expand"}"
      >
        <div class="sectionTitleMeta">
          <span class="sectionTitle">${title}</span>
          ${headerContent ? `<span class="sectionHeaderControls" data-section-header-control>${headerContent}</span>` : ""}
        </div>
        <span class="sectionToggle" aria-hidden="true">
          <span class="sectionChevron">${isOpen ? "▾" : "▸"}</span>
        </span>
      </div>
      <div class="sectionContent">${content}</div>
    </section>
  `;
}

function togglePanelSection(store, sectionId) {
  if (!sectionId || !(sectionId in COLLAPSIBLE_PANEL_DEFAULTS)) return;
  store.setState((draft) => {
    const panelSections = draft.ui.panelSections || (draft.ui.panelSections = {});
    const isOpen = typeof panelSections[sectionId] === "boolean"
      ? panelSections[sectionId]
      : COLLAPSIBLE_PANEL_DEFAULTS[sectionId] !== false;
    panelSections[sectionId] = !isOpen;
  });
}

function isInteractiveHeaderControl(target, sectionToggleTarget) {
  if (!(target instanceof HTMLElement) || !(sectionToggleTarget instanceof HTMLElement)) return false;
  const interactiveAncestor = target.closest("button, select, input, textarea, label, a, summary, [data-section-header-control]");
  return interactiveAncestor instanceof HTMLElement && interactiveAncestor !== sectionToggleTarget && sectionToggleTarget.contains(interactiveAncestor);
}

function renderInlineSection(title, content, sectionClass = "") {
  const classes = ["panelSection", sectionClass, "panelSectionInline"].filter(Boolean).join(" ");
  return `
    <section class="${classes}" aria-label="${title} section">
      <div class="sectionTitle sectionTitleInline">${title}</div>
      <div class="sectionContent">${content}</div>
    </section>
  `;
}

function renderLayerSection(state) {
  const activeLayer = state.interaction.activeLayer || PANEL_LAYERS.TILES;

  return `
    <div class="toolSwitch layerSwitch" role="group" aria-label="Active layer">
      <button class="toolButton ${activeLayer === PANEL_LAYERS.BACKGROUND ? "isActive" : ""}" type="button" data-layer="background">BG</button>
      <button class="toolButton ${activeLayer === PANEL_LAYERS.TILES ? "isActive" : ""}" type="button" data-layer="tiles">Tiles</button>
      <button class="toolButton ${activeLayer === PANEL_LAYERS.ENTITIES ? "isActive" : ""}" type="button" data-layer="entities">Entities</button>
      <button class="toolButton ${activeLayer === PANEL_LAYERS.DECOR ? "isActive" : ""}" type="button" data-layer="decor">Decor</button>
      <button class="toolButton ${activeLayer === PANEL_LAYERS.SOUND ? "isActive" : ""}" type="button" data-layer="sound">Sound</button>
    </div>
  `;
}

function renderSelectorField(label, dataField, options, selectedValue, placeholderLabel, className = "", visibleLabel = true) {
  const classes = ["fieldRow", "fieldRowCompact", className].filter(Boolean).join(" ");
  return `
    <label class="${classes}">
      ${visibleLabel ? `<span class="label">${label}</span>` : ""}
      <select data-${dataField} aria-label="${escapeHtml(label)}">
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

function renderAssetThumb(option, className = "assetThumb") {
  if (!option?.img) {
    return `<span class="${className} isFallback" aria-hidden="true">${escapeHtml((option?.defaultName || option?.label || "?").slice(0, 1))}</span>`;
  }
  return `<span class="${className}" aria-hidden="true"><img src="${escapeHtml(option.img)}" alt="" loading="lazy" decoding="async" /></span>`;
}

function renderAssetPicker(groupLabel, buttonDataKey, options, activeValue, emptyLabel, pickerClass = "") {
  if (!options.length) {
    return `<div class="assetPickerEmpty">${escapeHtml(emptyLabel)}</div>`;
  }

  return `
    <div class="assetPicker ${pickerClass}" role="group" aria-label="${escapeHtml(groupLabel)}">
      ${options.map((option) => {
        const isActive = option.id === activeValue || option.value === activeValue;
        const itemValue = option.id || option.value;
        const detail = option.group || option.type || option.value || "";
        return `
          <button
            type="button"
            class="assetPickerItem ${isActive ? "isActive" : ""}"
            data-${buttonDataKey}="${escapeHtml(itemValue)}"
            aria-pressed="${isActive ? "true" : "false"}"
            title="${escapeHtml(option.defaultName || option.label || itemValue)}"
          >
            ${renderAssetThumb(option)}
            <span class="assetPickerMeta">
              <span class="assetPickerLabel">${escapeHtml(option.defaultName || option.label || itemValue)}</span>
              <span class="assetPickerDetail">${escapeHtml(detail)}</span>
            </span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderTileField(label, field, options, selectedValue) {
  return `
    <label class="fieldRow fieldRowCompact tileControlField">
      <select data-brush-field="${field}" aria-label="${escapeHtml(label)}">
        ${renderOptions(options, selectedValue)}
      </select>
    </label>
  `;
}

function getTileSizeOptionsForSprite(spriteValue) {
  const supportedSizes = getSupportedSizesForBrushSprite(spriteValue);
  return BRUSH_SIZE_OPTIONS.filter((option) => {
    const parsed = Number.parseInt(String(option.value).split("x")[0], 10);
    return Number.isInteger(parsed) && supportedSizes.includes(parsed);
  });
}

function renderTileSelectionSummary(activeTileSprite) {
  if (!activeTileSprite) return "";

  return `
    <div class="statusCard assetSelectionCard assetSelectionCardCompact">
      <div class="assetSelectionRow assetSelectionRowCompact">
        ${renderAssetThumb(activeTileSprite, "assetThumb assetThumbSelected")}
        <div class="assetSelectionMeta">
          <span class="statusCardValue">${escapeHtml(activeTileSprite.label)}</span>
          <span class="statusCardMeta">ID ${escapeHtml(String(activeTileSprite.tileId))} · ${escapeHtml(activeTileSprite.drawW)}×${escapeHtml(activeTileSprite.drawH)}</span>
        </div>
      </div>
    </div>
  `;
}


function renderBackgroundSettings(state) {
  const activeMaterialId = state.interaction.activeBackgroundMaterialId;
  const activeMaterial = BACKGROUND_MATERIAL_OPTIONS.find((material) => material.id === activeMaterialId) || null;
  const status = activeMaterial
    ? `${activeMaterial.label} · ${activeMaterial.drawW}×${activeMaterial.drawH} · BL anchor`
    : "Select a background material";

  return `
    ${renderAssetPicker("Background materials", "background-material-button", BACKGROUND_MATERIAL_OPTIONS, activeMaterialId, "No background material selected", "assetPickerCompact")}
    <div class="statusRow compactStatusRow tilesCurrentRow">
      <span class="label">Current</span>
      <span class="value">${escapeHtml(status)}</span>
    </div>
  `;
}

function renderEntitiesSettings(state) {
  const activePresetId = state.interaction.activeEntityPresetId;
  const activePreset = ENTITY_PRESETS.find((preset) => preset.id === activePresetId) || null;
  const placementStatus = activePreset ? `${activePreset.defaultName} · Alt/Option + Click` : "Select an entity preset";

  return `
    ${renderAssetPicker("Entity presets", "entity-preset-button", PLACEABLE_ENTITY_PRESETS, activePresetId, "No entity selected")}
    <div class="compactActionRow compactActionRowSingle">
      <button type="button" class="toolButton isSecondary" data-entity-action="clear-preset" ${activePreset ? "" : "disabled"}>Clear</button>
    </div>
    <div class="statusRow compactStatusRow entityPlacementStatusRow">
      <span class="value">${escapeHtml(placementStatus)}</span>
    </div>
  `;
}

function renderFogVolumeSettings(state) {
  const fogArmed = state?.interaction?.activeLayer === PANEL_LAYERS.ENTITIES
    && state?.interaction?.activeEntityPresetId === "fog_volume";
  const waterArmed = state?.interaction?.activeLayer === PANEL_LAYERS.ENTITIES
    && state?.interaction?.activeEntityPresetId === "water_volume";
  const lavaArmed = state?.interaction?.activeLayer === PANEL_LAYERS.ENTITIES
    && state?.interaction?.activeEntityPresetId === "lava_volume";
  const bubblingLiquidArmed = state?.interaction?.activeLayer === PANEL_LAYERS.ENTITIES
    && state?.interaction?.activeEntityPresetId === "bubbling_liquid_volume";
  return `
    <div class="statusRow compactStatusRow">
      <span class="label">Fog Volume</span>
    </div>
    <div class="compactActionRow compactActionRowSingle">
      <button
        type="button"
        class="toolButton ${fogArmed ? "isActive" : ""}"
        data-volume-action="arm-fog"
      >${fogArmed ? "Fog placement armed" : "Create Fog Volume"}</button>
    </div>
    <div class="statusRow compactStatusRow">
      <span class="label">Water Volume</span>
    </div>
    <div class="compactActionRow compactActionRowSingle">
      <button
        type="button"
        class="toolButton ${waterArmed ? "isActive" : ""}"
        data-volume-action="arm-water"
      >${waterArmed ? "Water placement armed" : "Create Water Volume"}</button>
    </div>
    <div class="statusRow compactStatusRow">
      <span class="label">Lava Volume</span>
    </div>
    <div class="compactActionRow compactActionRowSingle">
      <button
        type="button"
        class="toolButton ${lavaArmed ? "isActive" : ""}"
        data-volume-action="arm-lava"
      >${lavaArmed ? "Lava placement armed" : "Create Lava Volume"}</button>
    </div>
    <div class="statusRow compactStatusRow">
      <span class="label">Liquid Acid / Swamp</span>
    </div>
    <div class="compactActionRow compactActionRowSingle">
      <button
        type="button"
        class="toolButton ${bubblingLiquidArmed ? "isActive" : ""}"
        data-volume-action="arm-bubbling-liquid"
      >${bubblingLiquidArmed ? "Liquid Acid / Swamp placement armed" : "Create Liquid Acid / Swamp"}</button>
    </div>
  `;
}

function renderDecorSettings(state) {
  const activePresetId = state.interaction.activeDecorPresetId;
  const activePreset = DECOR_PRESETS.find((preset) => preset.id === activePresetId) || null;
  const scatterSettings = state.interaction.decorScatterSettings || {};
  const scatterDensity = Number.isFinite(scatterSettings.density) ? Math.max(0, Math.min(1, scatterSettings.density)) : 0.3;
  const scatterRandomness = Number.isFinite(scatterSettings.randomness) ? Math.max(0, Math.min(1, scatterSettings.randomness)) : 0.6;
  const scatterVariantMode = scatterSettings.variantMode === "random" ? "random" : "fixed";
  const scatterModeActive = Boolean(state.interaction.decorScatterMode);
  const scatterStatus = !activePreset
    ? "Select a decor preset"
    : scatterModeActive
      ? `${activePreset.defaultName} · Alt/Option + Drag · ${Math.round(scatterDensity * 100)}% density · ${Math.round(scatterRandomness * 100)}% randomness`
      : `${activePreset.defaultName} · Alt/Option + Click`;
  const decorMeta = activePreset
    ? `Size ${activePreset.sizeTiles?.w || 1}×${activePreset.sizeTiles?.h || 1}t · Footprint ${activePreset.footprint?.w || 1}×${activePreset.footprint?.h || 1}t · ${activePreset.drawAnchor || "BL"} anchor`
    : "Decor asset metadata appears here";

  return `
    ${renderAssetPicker("Decor presets", "decor-preset-button", DECOR_PRESETS, activePresetId, "No decor selected", "assetPickerDecorCompact")}
    <div class="compactActionRow compactActionRowSingle">
      <button type="button" class="toolButton isSecondary" data-decor-action="clear-preset" ${activePreset ? "" : "disabled"}>Clear</button>
    </div>

    <div class="compactSubsection">
      <div class="compactSubsectionHeader decorScatterHeader">
        <span class="label">Scatter</span>
        <div class="decorScatterHeaderControls">
          <label class="fieldRow fieldRowCompact decorScatterVariantField">
            <select data-decor-setting="variantMode" aria-label="Scatter variant mode">
              <option value="fixed" ${scatterVariantMode === "fixed" ? "selected" : ""}>Fixed</option>
              <option value="random" ${scatterVariantMode === "random" ? "selected" : ""}>Random</option>
            </select>
          </label>
          <button
            type="button"
            class="toolButton isSecondary compactToggleButton ${scatterModeActive ? "isActive" : ""}"
            data-decor-action="toggle-scatter"
            aria-pressed="${scatterModeActive ? "true" : "false"}"
          >
            ${scatterModeActive ? "On" : "Off"}
          </button>
        </div>
      </div>

      <div class="compactFieldGrid decorScatterCompactGrid">
        <label class="fieldRow fieldRowCompact decorScatterSliderRow decorScatterSliderRowFull">
          <span class="label">Density</span>
          <div class="rangeField rangeFieldCompact">
            <input type="range" min="0" max="100" step="1" value="${Math.round(scatterDensity * 100)}" data-decor-setting="density" />
            <span class="rangeValue">${Math.round(scatterDensity * 100)}%</span>
          </div>
        </label>

        <label class="fieldRow fieldRowCompact decorScatterSliderRow decorScatterSliderRowFull">
          <span class="label">Randomness</span>
          <div class="rangeField rangeFieldCompact">
            <input type="range" min="0" max="100" step="1" value="${Math.round(scatterRandomness * 100)}" data-decor-setting="randomness" />
            <span class="rangeValue">${Math.round(scatterRandomness * 100)}%</span>
          </div>
        </label>
      </div>

      <div class="statusRow compactStatusRow decorScatterStatusRow">
        <span class="value">${escapeHtml(scatterStatus)}</span>
      </div>
      <div class="statusRow compactStatusRow decorScatterStatusRow">
        <span class="value">${escapeHtml(decorMeta)}</span>
      </div>
    </div>
  `;
}

function renderSoundSection(activePresetId, isOpen) {
  const activePreset = SOUND_PRESETS.find((preset) => preset.id === activePresetId) || null;

  return renderSection("sound", "SOUND", isOpen, "", "soundSection", `
    <div class="soundPanelControls" aria-label="Sound controls">
      ${renderSelectorField("Select Sound", "sound-preset-select", SOUND_PRESETS, activePresetId, "No sound selected", "soundHeaderSelectField", false)}
      <button type="button" class="toolButton isSecondary soundClearButton" data-sound-action="clear-preset" ${activePreset ? "" : "disabled"}>Clear</button>
    </div>
  `);
}

export function renderBrushPanel(panel, state) {
  const brushDraft = state.brush.activeDraft;
  const visibleSizeOptions = getTileSizeOptionsForSprite(brushDraft.sprite);
  const selectedSize = isBrushSizeSupportedForSprite(brushDraft.size, brushDraft.sprite)
    ? brushDraft.size
    : getFallbackBrushSizeForSprite(brushDraft.sprite);
  const summary = getBrushDraftSummary(brushDraft);
  const activeTileSprite = findBrushSpriteOptionByValue(brushDraft.sprite);
  const panelSections = {
    ...COLLAPSIBLE_PANEL_DEFAULTS,
    ...state.ui.panelSections,
  };

  panel.innerHTML = `
    ${renderInlineSection("TOOLS", `
      <div class="toolSwitch toolSwitchCompact" role="group" aria-label="Editor tool">
        ${VISIBLE_TOOL_OPTIONS.map((option) => renderToolButton(option, state.interaction.activeTool)).join("")}
      </div>
    `)}

    ${renderInlineSection("LAYER", renderLayerSection(state))}

    ${renderSection("tiles", "TILES", panelSections.tiles, `
      <div class="tilesPanelSpriteHeader">
        <span class="label">Sprite</span>
        <span class="fieldMeta">Select a tile to paint</span>
      </div>

      ${renderAssetPicker("Tile sprites", "brush-sprite-button", BRUSH_SPRITE_OPTIONS, brushDraft.sprite, "No tile sprite selected", "assetPickerCompact")}

      <div class="statusRow compactStatusRow tilesCurrentRow">
        <span class="label">Current</span>
        <span class="value">${summary}</span>
      </div>
      ${renderTileSelectionSummary(activeTileSprite)}
    `, "tilesSection", `
        <span class="tilesPanelControls" aria-label="Tile brush controls">
        ${renderTileField("Mode", "behavior", BRUSH_BEHAVIOR_OPTIONS, brushDraft.behavior)}
        ${renderTileField("Size", "size", visibleSizeOptions, selectedSize)}
      </span>
    `)}

    ${state.document.active ? renderSection("background", "BACKGROUND", panelSections.background, renderBackgroundSettings(state)) : ""}
    ${state.document.active ? renderSection("decor", "DECOR", panelSections.decor, renderDecorSettings(state)) : ""}
    ${state.document.active ? renderSection("entities", "ENTITIES", panelSections.entities, renderEntitiesSettings(state)) : ""}
    ${state.document.active ? renderSection("fogVolumes", "SPECIAL VOLUMES", panelSections.fogVolumes, renderFogVolumeSettings(state)) : ""}
    ${state.document.active ? renderSoundSection(state.interaction.activeSoundPresetId, panelSections.sound) : ""}
  `;
}

export function bindBrushPanel(panel, store, options = {}) {
  const { onEntityUpdate, onDecorUpdate, onSoundUpdate, onVolumeUpdate, onCanvasTargetChange, onLayerChange } = options;

  const onChange = (event) => {
    const target = event.target;

    if (target instanceof HTMLSelectElement) {
      const decorSetting = target.dataset.decorSetting;
      if (decorSetting === "variantMode") {
        onLayerChange?.(PANEL_LAYERS.DECOR);
        onDecorUpdate?.(-1, "scatter-setting", { field: "variantMode", value: target.value });
        return;
      }

      if (typeof target.dataset.decorPresetSelect === "string") {
        onLayerChange?.(PANEL_LAYERS.DECOR);
        onDecorUpdate?.(-1, target.value ? "preset" : "clear-preset", target.value || null);
        return;
      }

      if (typeof target.dataset.entityPresetSelect === "string") {
        onLayerChange?.(PANEL_LAYERS.ENTITIES);
        onEntityUpdate?.(-1, target.value ? "preset" : "clear-preset", target.value || null);
        return;
      }

      if (typeof target.dataset.soundPresetSelect === "string") {
        onLayerChange?.(PANEL_LAYERS.SOUND);
        onSoundUpdate?.(-1, target.value ? "preset" : "clear-preset", target.value || null);
        return;
      }

      const field = target.dataset.brushField;
      if (!field) return;

      store.setState((draft) => {
        const nextLayer = draft.interaction.activeLayer === PANEL_LAYERS.BACKGROUND ? PANEL_LAYERS.BACKGROUND : PANEL_LAYERS.TILES;
        draft.interaction.activeLayer = nextLayer;
        draft.ui.panelSections[nextLayer] = true;
        if (field === "size" && !isBrushSizeSupportedForSprite(target.value, draft.brush.activeDraft.sprite)) {
          draft.brush.activeDraft.size = getFallbackBrushSizeForSprite(draft.brush.activeDraft.sprite);
          return;
        }
        draft.brush.activeDraft[field] = target.value;
      });
      return;
    }

    if (!(target instanceof HTMLInputElement)) return;

    const decorSetting = target.dataset.decorSetting;
    if (decorSetting === "density" || decorSetting === "randomness") {
      onLayerChange?.(PANEL_LAYERS.DECOR);
      const sliderValue = Number.parseFloat(target.value);
      const value = Number.isFinite(sliderValue) ? Math.max(0, Math.min(1, sliderValue / 100)) : 0;
      onDecorUpdate?.(-1, "scatter-setting", { field: decorSetting, value });
      return;
    }

  };

  const onClick = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const sectionToggleButton = target.closest("[data-section-toggle]");
    if (sectionToggleButton instanceof HTMLElement) {
      if (isInteractiveHeaderControl(target, sectionToggleButton)) return;
      const sectionId = sectionToggleButton.dataset.sectionToggle;
      togglePanelSection(store, sectionId);
      return;
    }

    const decorActionButton = target.closest("[data-decor-action]");
    if (decorActionButton instanceof HTMLButtonElement) {
      const action = decorActionButton.dataset.decorAction;
      onLayerChange?.(PANEL_LAYERS.DECOR);
      if (action === "clear-preset") onDecorUpdate?.(-1, "clear-preset", null);
      if (action === "toggle-scatter") onDecorUpdate?.(-1, "toggle-scatter", null);
      return;
    }

    const entityActionButton = target.closest("[data-entity-action]");
    if (entityActionButton instanceof HTMLButtonElement) {
      onLayerChange?.(PANEL_LAYERS.ENTITIES);
      if (entityActionButton.dataset.entityAction === "clear-preset") onEntityUpdate?.(-1, "clear-preset", null);
      return;
    }

    const soundActionButton = target.closest("[data-sound-action]");
    if (soundActionButton instanceof HTMLButtonElement) {
      onLayerChange?.(PANEL_LAYERS.SOUND);
      if (soundActionButton.dataset.soundAction === "clear-preset") onSoundUpdate?.(-1, "clear-preset", null);
      return;
    }

    const volumeActionButton = target.closest("[data-volume-action]");
    if (volumeActionButton instanceof HTMLButtonElement) {
      onVolumeUpdate?.(-1, volumeActionButton.dataset.volumeAction || "", null);
      return;
    }

    const decorPresetButton = target.closest("[data-decor-preset-button]");
    if (decorPresetButton instanceof HTMLButtonElement) {
      onLayerChange?.(PANEL_LAYERS.DECOR);
      onDecorUpdate?.(-1, "preset", decorPresetButton.dataset.decorPresetButton || null);
      return;
    }

    const entityPresetButton = target.closest("[data-entity-preset-button]");
    if (entityPresetButton instanceof HTMLButtonElement) {
      onLayerChange?.(PANEL_LAYERS.ENTITIES);
      onEntityUpdate?.(-1, "preset", entityPresetButton.dataset.entityPresetButton || null);
      return;
    }


    const brushSpriteButton = target.closest("[data-brush-sprite-button]");
    if (brushSpriteButton instanceof HTMLButtonElement) {
      const nextSprite = brushSpriteButton.dataset.brushSpriteButton;
      if (!nextSprite) return;
      store.setState((draft) => {
        const nextLayer = draft.interaction.activeLayer === PANEL_LAYERS.BACKGROUND ? PANEL_LAYERS.BACKGROUND : PANEL_LAYERS.TILES;
        draft.interaction.activeLayer = nextLayer;
        draft.ui.panelSections[nextLayer] = true;
        draft.brush.activeDraft.sprite = nextSprite;
        if (!isBrushSizeSupportedForSprite(draft.brush.activeDraft.size, nextSprite)) {
          draft.brush.activeDraft.size = getFallbackBrushSizeForSprite(nextSprite);
        }
      });
      return;
    }


    const backgroundMaterialButton = target.closest("[data-background-material-button]");
    if (backgroundMaterialButton instanceof HTMLButtonElement) {
      const materialId = backgroundMaterialButton.dataset.backgroundMaterialButton;
      if (!materialId) return;
      store.setState((draft) => {
        draft.interaction.activeLayer = PANEL_LAYERS.BACKGROUND;
        draft.ui.panelSections.background = true;
        draft.interaction.activeBackgroundMaterialId = materialId;
      });
      return;
    }

    const layerButton = target.closest("[data-layer]");
    if (layerButton instanceof HTMLButtonElement) {
      const nextLayer = layerButton.dataset.layer;
      if (![PANEL_LAYERS.BACKGROUND, PANEL_LAYERS.TILES, PANEL_LAYERS.ENTITIES, PANEL_LAYERS.DECOR, PANEL_LAYERS.SOUND].includes(nextLayer)) return;
      onLayerChange?.(nextLayer);
      if (nextLayer === PANEL_LAYERS.DECOR || nextLayer === PANEL_LAYERS.SOUND || nextLayer === PANEL_LAYERS.ENTITIES) {
        onCanvasTargetChange?.(nextLayer === PANEL_LAYERS.DECOR ? "decor" : nextLayer === PANEL_LAYERS.SOUND ? "sound" : "entity");
      }
      return;
    }

    const button = target.closest("[data-tool]");
    if (!(button instanceof HTMLButtonElement)) return;

    const nextTool = button.dataset.tool;
    if (!isEditorTool(nextTool)) return;

    store.setState((draft) => {
      if (nextTool !== EDITOR_TOOLS.INSPECT) {
        const nextLayer = draft.interaction.activeLayer === PANEL_LAYERS.BACKGROUND ? PANEL_LAYERS.BACKGROUND : PANEL_LAYERS.TILES;
        draft.interaction.activeLayer = nextLayer;
        draft.ui.panelSections[nextLayer] = true;
      }
      draft.interaction.activeTool = nextTool;
    });
  };

  const onKeyDown = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const sectionToggleButton = target.closest("[data-section-toggle]");
    if (!(sectionToggleButton instanceof HTMLElement) || sectionToggleButton !== target) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    const sectionId = sectionToggleButton.dataset.sectionToggle;
    togglePanelSection(store, sectionId);
  };

  panel.addEventListener("change", onChange);
  panel.addEventListener("click", onClick);
  panel.addEventListener("keydown", onKeyDown);

  return () => {
    panel.removeEventListener("change", onChange);
    panel.removeEventListener("click", onClick);
    panel.removeEventListener("keydown", onKeyDown);
  };
}
