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
import { findBrushSpriteOptionByValue } from "../domain/tiles/tileSpriteCatalog.js";

const PANEL_LAYERS = {
  TOOLS: "tools",
  TILES: "tiles",
  ENTITIES: "entities",
  DECOR: "decor",
  SOUND: "sound",
  SCAN: "scan",
};

const VISIBLE_TOOL_OPTIONS = TOOL_OPTIONS.filter((option) => (
  option.value === EDITOR_TOOLS.INSPECT
  || option.value === EDITOR_TOOLS.PAINT
  || option.value === EDITOR_TOOLS.ERASE
));

const HIDDEN_ENTITY_PRESET_IDS = new Set(["player-spawn", "player-exit", "exit", "fog_volume"]);
const PLACEABLE_ENTITY_PRESETS = ENTITY_PRESETS.filter((preset) => !HIDDEN_ENTITY_PRESET_IDS.has(preset.id));
const COLLAPSIBLE_PANEL_DEFAULTS = {
  tiles: true,
  decor: true,
  entities: true,
  sound: true,
  scan: true,
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
      <div class="sectionHeaderRow">
        <button
          class="sectionToggle"
          type="button"
          data-section-toggle="${sectionId}"
          aria-expanded="${isOpen ? "true" : "false"}"
        >
          <span class="sectionTitleRow">
            <span class="sectionTitle">${title}</span>
            <span class="sectionChevron" aria-hidden="true">${isOpen ? "▾" : "▸"}</span>
          </span>
        </button>
        ${headerContent ? `<div class="sectionTitleMeta">${headerContent}</div>` : ""}
      </div>
      <div class="sectionContent">${content}</div>
    </section>
  `;
}

function renderInlineSection(title, content) {
  return `
    <section class="panelSection panelSectionInline" aria-label="${title} section">
      <div class="sectionTitle sectionTitleInline">${title}</div>
      <div class="sectionContent">${content}</div>
    </section>
  `;
}

function renderLayerSection(state) {
  const activeLayer = state.interaction.activeLayer || PANEL_LAYERS.TILES;

  return `
    <div class="toolSwitch layerSwitch" role="group" aria-label="Active layer">
      <button class="toolButton ${activeLayer === PANEL_LAYERS.TILES ? "isActive" : ""}" type="button" data-layer="tiles">Tiles</button>
      <button class="toolButton ${activeLayer === PANEL_LAYERS.ENTITIES ? "isActive" : ""}" type="button" data-layer="entities">Entities</button>
      <button class="toolButton ${activeLayer === PANEL_LAYERS.DECOR ? "isActive" : ""}" type="button" data-layer="decor">Decor</button>
      <button class="toolButton ${activeLayer === PANEL_LAYERS.SOUND ? "isActive" : ""}" type="button" data-layer="sound">Sound</button>
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

function renderPlacementBlock(label, hint = "", className = "") {
  return `
    <div class="statusCard ${className}">
      <span class="statusCardLabel">Placement</span>
      <span class="statusCardValue">${escapeHtml(label)}</span>
      ${hint ? `<span class="statusCardMeta">${escapeHtml(hint)}</span>` : ""}
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
    </div>
  `;
}

function renderSoundSettings(state) {
  const activePresetId = state.interaction.activeSoundPresetId;
  const activePreset = SOUND_PRESETS.find((preset) => preset.id === activePresetId) || null;
  const placementLabel = activePreset ? `Placing: ${activePreset.defaultName}` : "No placement";
  const placementHint = activePreset ? "Alt/Option + Click places" : "Select a preset to arm placement";

  return `
    ${renderSelectorField("Select Sound", "sound-preset-select", SOUND_PRESETS, activePresetId, "No sound selected")}
    ${renderPlacementBlock(placementLabel, placementHint)}
    <div class="compactActionRow compactActionRowSingle">
      <button type="button" class="toolButton isSecondary" data-sound-action="clear-preset" ${activePreset ? "" : "disabled"}>Clear</button>
    </div>
  `;
}

function formatScanValue(value, fallback = "Auto") {
  return Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, "") : fallback;
}

function formatAudioEvaluationLabel(soundState) {
  if (!soundState) return "";
  const phaseLabel = soundState.phase && soundState.phase !== "inactive" ? ` · ${soundState.phase}` : "";
  const intensityLabel = Number.isFinite(soundState.normalizedIntensity)
    ? ` · lvl ${soundState.normalizedIntensity.toFixed(2).replace(/\.00$/, "")}`
    : "";
  return `${soundState.soundName}${phaseLabel}${intensityLabel}`;
}

function renderScanDebugEvent(entry, index) {
  return `<div class="scanDebugItem"><span class="scanDebugIndex">${escapeHtml(String(index + 1))}</span><div class="scanDebugBody"><span class="scanDebugTitle">${escapeHtml(entry.soundName || entry.soundId || "Sound")}</span><span class="scanDebugMeta"><span class="scanDebugBadge">${escapeHtml(entry.transitionKind || entry.intersectionType || entry.soundType || "event")}</span><span>${escapeHtml(entry.phase || "inactive")}</span><span>x ${escapeHtml(String(entry.atX || "0"))}</span></span></div></div>`;
}

function renderScanSettings(state) {
  const scan = state.scan || {};
  const docWidth = Number(state.document.active?.dimensions?.width) || 0;
  const startLabel = Number.isFinite(scan.startX) ? scan.startX : 0;
  const endLabel = Number.isFinite(scan.endX) ? scan.endX : docWidth;
  const speed = Number.isFinite(scan.speed) ? scan.speed : 6;
  const playbackState = scan.playbackState || (scan.isPlaying ? "playing" : "idle");
  const isPlaying = playbackState === "playing";
  const isPaused = playbackState === "paused";
  const audioEvaluation = scan.audioEvaluation || {};
  const activeSounds = Array.isArray(audioEvaluation.activeSounds) ? audioEvaluation.activeSounds : [];
  const startedSounds = Array.isArray(audioEvaluation.startedSounds) ? audioEvaluation.startedSounds : [];
  const endedSounds = Array.isArray(audioEvaluation.endedSounds) ? audioEvaluation.endedSounds : [];
  const activeCount = Array.isArray(scan.activeSoundIds) ? scan.activeSoundIds.length : activeSounds.length;
  const lastEventSummary = scan.lastEventSummary || "No audio transitions yet";
  const eventLog = Array.isArray(scan.eventLog) ? scan.eventLog.slice(0, 4) : [];
  const activePreview = activeSounds.slice(0, 3).map(formatAudioEvaluationLabel);
  const statusLabel = isPlaying ? "Running" : isPaused ? "Paused" : "Stopped";
  const statusToneClass = isPlaying ? "isRunning" : isPaused ? "isPaused" : "isIdle";

  return `
    <div class="compactFieldGrid scanFieldGrid">
      <label class="fieldRow fieldRowCompact">
        <span class="label">Start X</span>
        <input type="number" min="0" max="${docWidth}" step="0.25" value="${Number.isFinite(scan.startX) ? scan.startX : ""}" placeholder="0" data-scan-field="startX" />
      </label>

      <label class="fieldRow fieldRowCompact">
        <span class="label">End X</span>
        <input type="number" min="0" max="${docWidth}" step="0.25" value="${Number.isFinite(scan.endX) ? scan.endX : ""}" placeholder="${docWidth}" data-scan-field="endX" />
      </label>

      <label class="fieldRow fieldRowCompact scanFieldGridFull">
        <span class="label">Speed</span>
        <input type="number" min="0.25" step="0.25" value="${speed}" data-scan-field="speed" />
      </label>
    </div>

    <div class="compactActionRow compactActionRowTriple">
      <button type="button" class="toolButton ${isPlaying ? "isActive" : ""}" data-scan-action="play">${isPaused ? "Resume" : "Play"}</button>
      <button type="button" class="toolButton isSecondary ${isPaused ? "isActive" : ""}" data-scan-action="pause" ${isPlaying ? "" : "disabled"}>Pause</button>
      <button type="button" class="toolButton isSecondary" data-scan-action="stop" ${(isPlaying || isPaused) ? "" : "disabled"}>Stop</button>
    </div>

    <div class="statusCard scanMonitorCard">
      <div class="scanMonitorHeader">
        <span class="statusCardLabel">Scan Monitor</span>
        <span class="scanStatePill ${statusToneClass}">${statusLabel}</span>
      </div>
      <span class="statusCardMeta">Preserves current play / pause / stop workflow and sound-layer scan authoring context.</span>
      <div class="scanMonitorMetrics">
        <div class="scanMetricCard">
          <span class="scanMetricLabel">Range</span>
          <span class="scanMetricValue">${escapeHtml(String(startLabel))} → ${escapeHtml(String(endLabel))}</span>
        </div>
        <div class="scanMetricCard">
          <span class="scanMetricLabel">Position</span>
          <span class="scanMetricValue">${escapeHtml(formatScanValue(scan.positionX, "0"))}</span>
        </div>
        <div class="scanMetricCard">
          <span class="scanMetricLabel">Speed</span>
          <span class="scanMetricValue">${escapeHtml(formatScanValue(speed, "6"))}x</span>
        </div>
        <div class="scanMetricCard">
          <span class="scanMetricLabel">Active Sounds</span>
          <span class="scanMetricValue">${escapeHtml(String(activeCount))}</span>
        </div>
        <div class="scanMetricCard">
          <span class="scanMetricLabel">Started</span>
          <span class="scanMetricValue">${escapeHtml(String(startedSounds.length))}</span>
        </div>
        <div class="scanMetricCard">
          <span class="scanMetricLabel">Ended</span>
          <span class="scanMetricValue">${escapeHtml(String(endedSounds.length))}</span>
        </div>
      </div>
      <div class="scanMonitorSummary">
        <span class="scanMonitorSummaryLabel">Latest event</span>
        <span class="scanMonitorSummaryValue">${escapeHtml(lastEventSummary)}</span>
      </div>
      <div class="scanMonitorSummary">
        <span class="scanMonitorSummaryLabel">Active detail</span>
        <span class="scanMonitorSummaryValue">${activePreview.length ? escapeHtml(activePreview.join(" • ")) : "No active sounds at the current scan position"}</span>
      </div>
    </div>

    <div class="compactSubsection">
      <div class="compactSubsectionHeader scanDebugHeader">
        <div>
          <span class="label">Event Feed</span>
          <span class="scanDebugCaption">Recent started / ended / triggered audio transitions</span>
        </div>
        <button type="button" class="toolButton isSecondary compactToggleButton" data-scan-action="clear-log" ${eventLog.length ? "" : "disabled"}>Clear</button>
      </div>
      <div class="scanDebugList">
        ${eventLog.length
          ? eventLog.map(renderScanDebugEvent).join("")
          : '<div class="scanDebugEmpty">Waiting for scan audio transitions.</div>'}
      </div>
    </div>
  `;
}

export function renderBrushPanel(panel, state) {
  const brushDraft = state.brush.activeDraft;
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
        ${renderTileField("Size", "size", BRUSH_SIZE_OPTIONS, brushDraft.size)}
      </span>
    `)}

    ${state.document.active ? renderSection("decor", "DECOR", panelSections.decor, renderDecorSettings(state)) : ""}
    ${state.document.active ? renderSection("entities", "ENTITIES", panelSections.entities, renderEntitiesSettings(state)) : ""}
    ${state.document.active ? renderSection("sound", "SOUND", panelSections.sound, renderSoundSettings(state)) : ""}
    ${state.document.active ? renderSection("scan", "SCAN", panelSections.scan, renderScanSettings(state)) : ""}
  `;
}

export function bindBrushPanel(panel, store, options = {}) {
  const { onEntityUpdate, onDecorUpdate, onSoundUpdate, onCanvasTargetChange, onLayerChange, onScanUpdate } = options;

  const triggerScanAction = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    const scanActionButton = target.closest("[data-scan-action]");
    if (!(scanActionButton instanceof HTMLButtonElement)) return false;

    const action = scanActionButton.dataset.scanAction;
    if (!action || scanActionButton.disabled) return true;

    onScanUpdate?.(action, null);
    return true;
  };

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
        draft.interaction.activeLayer = PANEL_LAYERS.TILES;
        draft.ui.panelSections.tiles = true;
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

    const scanField = target.dataset.scanField;
    if (scanField === "startX" || scanField === "endX" || scanField === "speed") {
      onScanUpdate?.(scanField, target.value);
    }
  };

  const onClick = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const sectionToggleButton = target.closest("[data-section-toggle]");
    if (sectionToggleButton instanceof HTMLButtonElement) {
      const sectionId = sectionToggleButton.dataset.sectionToggle;
      if (!sectionId) return;
      store.setState((draft) => {
        const panelSections = draft.ui.panelSections || (draft.ui.panelSections = {});
        const isOpen = typeof panelSections[sectionId] === "boolean"
          ? panelSections[sectionId]
          : COLLAPSIBLE_PANEL_DEFAULTS[sectionId] !== false;
        panelSections[sectionId] = !isOpen;
      });
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
        draft.interaction.activeLayer = PANEL_LAYERS.TILES;
        draft.ui.panelSections.tiles = true;
        draft.brush.activeDraft.sprite = nextSprite;
      });
      return;
    }

    if (event.detail === 0 && triggerScanAction(target)) {
      return;
    }

    const layerButton = target.closest("[data-layer]");
    if (layerButton instanceof HTMLButtonElement) {
      const nextLayer = layerButton.dataset.layer;
      if (![PANEL_LAYERS.TILES, PANEL_LAYERS.ENTITIES, PANEL_LAYERS.DECOR, PANEL_LAYERS.SOUND].includes(nextLayer)) return;
      onLayerChange?.(nextLayer);
      if (nextLayer !== PANEL_LAYERS.TILES) {
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
        draft.interaction.activeLayer = PANEL_LAYERS.TILES;
        draft.ui.panelSections.tiles = true;
      }
      draft.interaction.activeTool = nextTool;
    });
  };

  const onPointerDown = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!triggerScanAction(target)) return;

    event.preventDefault();
  };

  panel.addEventListener("change", onChange);
  panel.addEventListener("pointerdown", onPointerDown);
  panel.addEventListener("click", onClick);

  return () => {
    panel.removeEventListener("change", onChange);
    panel.removeEventListener("pointerdown", onPointerDown);
    panel.removeEventListener("click", onClick);
  };
}
