import { renderEditorFrame } from "../render/renderer.js";
import { getScanScreenX, isPausedScanPlayheadHit } from "../render/layers/scanLayer.js";
import { loadLevelDocument } from "../data/loadLevelDocument.js";
import {
  clampViewportZoom,
  getCanvasPointFromMouseEvent,
  getCellFromCanvasPoint,
  getZoomMultiplierFromWheelDelta,
  panViewportByDelta,
  zoomViewportAroundPoint,
} from "../render/viewport.js";
import { getWorldPointFromMinimapPoint, renderMinimap } from "../render/minimap.js";
import { renderInspector, bindInspectorPanel } from "../ui/inspectorPanel.js";
import { renderBottomPanel, bindBottomPanel } from "../ui/bottomPanel.js";
import { bindBrushPanel, renderBrushPanel } from "../ui/brushPanel.js";
import { stopNativeInputKeyboardPropagation, isNativeTextEditingEventTarget, hasNativeTextEditingFocus } from "../ui/nativeInputGuards.js";
import {
  getSpecialVolumeWorkbenchLauncherContent,
  getSpecialVolumeWorkbenchModalContent,
  resolveSelectedSpecialVolume,
} from "../ui/specialVolumeWorkbench.js";
import { getVolumePreviewEnvironmentMetrics } from "../ui/volumePreviewEnvironment.js";
import { triggerLevelDocumentDownload } from "../data/exportLevelDocument.js";
import { importLevelDocumentFromFile } from "../data/importLevelDocument.js";
import {
  createNewLevelDocument,
  DEFAULT_NEW_LEVEL_HEIGHT,
  DEFAULT_NEW_LEVEL_WIDTH,
  isValidLevelDimension,
  MAX_LEVEL_HEIGHT,
  MAX_LEVEL_WIDTH,
  MIN_LEVEL_DIMENSION,
  sanitizeLevelDimension,
} from "../data/createNewLevelDocument.js";
import { resolveTileFromBrushDraft } from "../domain/tiles/paintTile.js";
import { resolveBrushSize, getBrushCells, snapCellToBrushStep } from "../domain/tiles/brushSize.js";
import { eraseSingleTile } from "../domain/tiles/eraseTile.js";
import { eraseSizedPlacementAtCell, paintSizedPlacement } from "../domain/tiles/sizedPlacements.js";
import { EDITOR_TOOLS } from "../domain/tiles/tools.js";
import { getLineCells } from "../domain/tiles/line.js";
import { getFloodFillCells } from "../domain/tiles/floodFill.js";
import {
  createEntityEditEntry,
  createDecorEditEntry,
  createSizedPlacementEditEntry,
  createTileEditEntry,
  startTileEditBatch,
  pushHistoryEntry,
  pushTileEdit,
  endTileEditBatch,
  undoTileEdit,
  redoTileEdit,
  canUndo,
  canRedo,
} from "../domain/tiles/history.js";
import { createDefaultBackgroundLayer, getTileIndex } from "../domain/level/levelDocument.js";
import { DEFAULT_BACKGROUND_MATERIAL_ID } from "../domain/background/materialCatalog.js";
import { eraseBackgroundMaterial } from "../domain/background/paint.js";
import { getBackgroundFloodFillCells } from "../domain/background/floodFill.js";
import { findEntityAtCanvasPoint } from "../render/layers/entityLayer.js";
import { findDecorAtCanvasPoint } from "../render/layers/decorLayer.js";
import { findSoundAtCanvasPoint, getSoundPlacementPreviewDiagnostic } from "../render/layers/soundLayer.js";
import { TILE_DEFINITIONS } from "../domain/tiles/tileTypes.js";
import {
  DEFAULT_ENTITY_PRESET_ID,
  findEntityPresetById,
  findEntityPresetByType,
  getEntityPresetDefaultParams,
  getEntityPresetForType,
  getEntityPresetParamsForType,
} from "../domain/entities/entityPresets.js";
import { DEFAULT_DECOR_PRESET_ID, findDecorPresetById, findDecorPresetByType } from "../domain/decor/decorPresets.js";
import { isEntityLikeEditableType, normalizeEditableObjectType } from "../domain/placeables/editableObjectBuckets.js";
import {
  captureIdObjectInteractionSnapshot,
  reconcileIdObjectInteraction,
} from "../domain/placeables/objectInteractionReconciliation.js";
import { captureObjectLayerAnchor, getObjectLayerId } from "../domain/placeables/objectLayerHistory.js";
import { DEFAULT_SOUND_PRESET_ID, findSoundPresetById, getSoundPresetDefaultParams, getSoundPresetForType } from "../domain/sound/soundPresets.js";
import { normalizeSoundSourceValue } from "../domain/sound/sourceReference.js";
import {
  canRedoGlobalHistory,
  canUndoGlobalHistory,
  clearGlobalHistoryTimeline,
  markGlobalHistoryActionRedone,
  markGlobalHistoryActionUndone,
  peekNextGlobalRedoAction,
  peekNextGlobalUndoAction,
  recordGlobalHistoryAction,
} from "../domain/history/globalTimeline.js";
import { normalizeSoundType } from "../domain/sound/soundVisuals.js";
import { createSoundPreviewController, getSoundPreviewKey } from "../domain/sound/soundPreviewPlayback.js";
import { cloneEntityParams, isSupportedEntityParamValue } from "../domain/entities/entityParams.js";
import {
  applySpecialVolumeParamChange,
  createBubblingLiquidVolumeEntityFromWorldRect,
  createFogVolumeEntityFromWorldRect,
  createLavaVolumeEntityFromWorldRect,
  createWaterVolumeEntityFromWorldRect,
  getBubblingLiquidVolumeParams,
  getBubblingLiquidVolumeWorldRectFromDragCells,
  getFogVolumeParams,
  getFogVolumeWorldRectFromDragCells,
  getLavaVolumeParams,
  getLavaVolumeWorldRectFromDragCells,
  getSpecialVolumeType,
  getWaterVolumeParams,
  getWaterVolumeWorldRectFromDragCells,
  isBubblingLiquidVolumeEntityType,
  isFogVolumeEntityType,
  isLavaVolumeEntityType,
  isWaterVolumeEntityType,
  isSpecialVolumeEntityType,
  shiftBubblingLiquidVolumeEntity,
  shiftFogVolumeEntity,
  shiftLavaVolumeEntity,
  shiftWaterVolumeEntity,
  syncSpecialVolumeEntityToAnchor,
} from "../domain/entities/specialVolumeTypes.js";
import {
  finishScanPlaybackState,
  getScanActivity,
  getScanPlaybackState,
  getScanRange,
  isScanPlaying,
  pauseScanPlaybackState,
  sanitizeOptionalScanCoordinate,
  setPausedScanPosition,
  startScanPlaybackState,
  stopScanPlaybackState,
  syncScanPlaybackState,
} from "../domain/scan/scanSystem.js";
import { createScanAudioPlaybackController } from "../domain/scan/scanAudioPlayback.js";
import { v2ToRuntimeLevelObject } from "../runtime/v2ToRuntimeLevelObject.js";
import { launchEditorPlayRuntime } from "../runtime/editorPlaySessionBridge.js";
import {
  clearDecorSelection,
  getPrimarySelectedDecorId,
  getPrimarySelectedDecorIndex,
  getSelectedDecorIds,
  getSelectedDecorIndices,
  pruneDecorSelection,
  setDecorSelection,
  toggleDecorSelection,
} from "../domain/decor/selection.js";
import {
  clearEntitySelection,
  getPrimarySelectedEntityIndex,
  getSelectedEntityIndices,
  pruneEntitySelection,
  setEntitySelection,
} from "../domain/entities/selection.js";
import {
  clearSoundSelection,
  findMatchingSoundIndices,
  getPrimarySelectedSoundIndex,
  getSelectedSoundIndices,
  pruneSoundSelection,
  setSoundSelection,
  toggleSoundSelection,
} from "../domain/sound/selection.js";
import {
  applyCanonicalEntityAction,
  cloneCanonicalEntitySnapshot,
  createCanonicalEntityHistory,
} from "./cleanRoomEntityMode.js";
import {
  applyCanonicalDecorAction,
  cloneCanonicalDecorSnapshot,
  createCanonicalDecorHistory,
} from "./cleanRoomDecorMode.js";
import {
  applyCanonicalSoundAction,
  cloneCanonicalSoundSnapshot,
  createCanonicalSoundHistory,
} from "./cleanRoomSoundMode.js";
import {
  canCreateEntityType,
  canDeleteEntity,
  isExitEntityType,
  isSpawnEntityType,
} from "../domain/entities/spawnExitRules.js";

const BATCH_EDITABLE_SOUND_PARAM_KEYS = new Set(["spatial", "volume", "pitch", "loop"]);
const SOUND_DEBUG_MAX_EVENTS = 18;
const ARROW_PAN_STEP_PX = 20;
const ARROW_PAN_SHIFT_MULTIPLIER = 2;
const FOG_DEFAULTS_STORAGE_KEY = "lumo.editor-v2.fog-defaults";


function getInspectedCell(state) {
  return state.interaction.selectedCell || state.interaction.hoverCell;
}

function getSelectedPlayFromHereCell(state) {
  const doc = state?.document?.active;
  const selectedCell = state?.interaction?.selectedCell;
  if (!doc || !selectedCell) return null;

  const x = Number(selectedCell.x);
  const y = Number(selectedCell.y);
  const width = Number(doc?.dimensions?.width);
  const height = Number(doc?.dimensions?.height);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }

  const cellX = x | 0;
  const cellY = y | 0;
  if (cellX < 0 || cellY < 0 || cellX >= width || cellY >= height) {
    return null;
  }

  return { x: cellX, y: cellY };
}

function getTileForCell(active, cell) {
  if (!active || !cell) return null;

  const width = active.dimensions.width;
  const tileValue = active.tiles.base[cell.y * width + cell.x];
  const tileDefinition = TILE_DEFINITIONS[tileValue];

  return {
    value: tileValue,
    label: tileDefinition?.label || "Unknown",
  };
}

function renderCellHud(cellHud, state) {
  const active = state.document.active;
  if (!active) {
    cellHud.textContent = "";
    cellHud.classList.remove("isVisible");
    return;
  }

  const inspectedCell = getInspectedCell(state);
  const activeLayer = getActiveLayer(state.interaction);
  const activeTargetLabel = activeLayer === PANEL_LAYERS.BACKGROUND ? "Background" : activeLayer === PANEL_LAYERS.DECOR ? "Decor" : activeLayer === PANEL_LAYERS.ENTITIES ? "Entities" : activeLayer === PANEL_LAYERS.SOUND ? "Sound" : "Tiles";
  const targetSelectionCount =
    activeLayer === PANEL_LAYERS.DECOR
      ? getSelectedDecorIndices(state.interaction, state.document.active?.decor || []).length
      : activeLayer === PANEL_LAYERS.ENTITIES
        ? getSelectedEntityIndices(state.interaction).length
        : activeLayer === PANEL_LAYERS.SOUND
          ? getSelectedSoundIndices(state.interaction).length
          : 0;
  const targetSelectionLabel = activeLayer === PANEL_LAYERS.TILES || activeLayer === PANEL_LAYERS.BACKGROUND
    ? "Tile editing"
    : targetSelectionCount > 0
      ? `${targetSelectionCount} selected`
      : "No selection";
  if (!inspectedCell) {
    cellHud.innerHTML = `
      <span class="cellHudBadge">Active target</span>
      <span>${activeTargetLabel}</span>
      <span>${targetSelectionLabel}</span>
    `;
    cellHud.classList.add("isVisible");
    return;
  }

  const tileInfo = getTileForCell(active, inspectedCell);
  const sourceLabel = state.interaction.selectedCell ? "Selected" : "Hover";
  const tileLabel = tileInfo ? `${tileInfo.label} (${tileInfo.value})` : "Unknown";

  cellHud.innerHTML = `
    <span class="cellHudBadge">Active target</span>
    <span>${activeTargetLabel}</span>
    <span>${targetSelectionLabel}</span>
    <span class="cellHudBadge">${sourceLabel}</span>
    <span>X ${inspectedCell.x}</span>
    <span>Y ${inspectedCell.y}</span>
    <span>Tile ${tileLabel}</span>
  `;
  cellHud.classList.add("isVisible");
}

function getRectBounds(startCell, endCell) {
  return {
    minX: Math.min(startCell.x, endCell.x),
    maxX: Math.max(startCell.x, endCell.x),
    minY: Math.min(startCell.y, endCell.y),
    maxY: Math.max(startCell.y, endCell.y),
  };
}

function clampScatterRandomness(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function clampScatterDensity(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function getScatterTargetCount(cellCapacity, density) {
  const normalizedDensity = clampScatterDensity(density);
  if (cellCapacity <= 0 || normalizedDensity <= 0) return 0;
  return Math.max(1, Math.min(cellCapacity, Math.round(cellCapacity * normalizedDensity)));
}

function clampScanSpeed(value, fallback = 6) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0.25, parsed);
}

function formatScanEventSummary(event) {
  if (!event) return null;
  const transitionLabel = event.transitionKind === "ended"
    ? "ended"
    : event.transitionKind === "triggered"
      ? "triggered"
      : "started";
  const phaseLabel = event.phase && event.phase !== "inactive" ? ` · ${event.phase}` : "";
  return `${event.soundName} · ${transitionLabel}${phaseLabel} · x ${event.atX}`;
}

const PANEL_LAYERS = {
  BACKGROUND: "background",
  TILES: "tiles",
  ENTITIES: "entities",
  DECOR: "decor",
  SOUND: "sound",
};

function getActiveLayer(interaction) {
  if (interaction.activeLayer === PANEL_LAYERS.BACKGROUND) return PANEL_LAYERS.BACKGROUND;
  if (interaction.activeLayer === PANEL_LAYERS.DECOR) return PANEL_LAYERS.DECOR;
  if (interaction.activeLayer === PANEL_LAYERS.ENTITIES) return PANEL_LAYERS.ENTITIES;
  if (interaction.activeLayer === PANEL_LAYERS.SOUND) return PANEL_LAYERS.SOUND;
  return PANEL_LAYERS.TILES;
}

function getSelectionMode(interaction) {
  if (interaction.canvasSelectionMode === "decor") return "decor";
  if (interaction.canvasSelectionMode === "sound") return "sound";
  return "entity";
}

function formatSoundDebugCell(cell) {
  return cell ? `${cell.x},${cell.y}` : "null";
}

function formatSoundDebugList(values) {
  if (!Array.isArray(values) || !values.length) return "[]";
  return `[${values.map((value) => value ?? "null").join(", ")}]`;
}

function summarizeSoundDebugDrag(soundDrag) {
  if (!soundDrag) return "null";
  return soundDrag.active
    ? `active lead=${soundDrag.leadSoundId || "null"} Δ${formatSoundDebugCell(soundDrag.previewDelta || { x: 0, y: 0 })}`
    : "inactive";
}

function summarizeAuthoredSounds(sounds) {
  const authoredSounds = Array.isArray(sounds) ? sounds : [];
  return {
    count: authoredSounds.length,
    ids: authoredSounds.map((sound) => sound?.id || "∅"),
    types: authoredSounds.map((sound) => sound?.type || "∅"),
    positions: authoredSounds.map((sound) => `${sound?.id || "∅"}@${sound?.x ?? "?"},${sound?.y ?? "?"}`),
  };
}

function getSoundPreviewDebugState(state) {
  const activePreset = findSoundPresetById(state.interaction.activeSoundPresetId);
  const previewDiagnostic = getSoundPlacementPreviewDiagnostic(state.interaction, activePreset);
  const activeLayer = getActiveLayer(state.interaction);
  const reason = `${previewDiagnostic.reason} · activeLayer=${activeLayer}`;
  return {
    activePresetType: activePreset?.type || null,
    eligible: previewDiagnostic.eligible,
    reason,
  };
}

function createSoundDebugSnapshot(state) {
  const interaction = state?.interaction || {};
  const authoredSoundSummary = summarizeAuthoredSounds(state?.document?.active?.sounds || []);
  const preview = getSoundPreviewDebugState(state);

  return {
    activeLayer: getActiveLayer(interaction),
    activeSoundPresetId: interaction.activeSoundPresetId ?? null,
    selectedSoundId: interaction.selectedSoundId ?? null,
    selectedSoundIds: [...(interaction.selectedSoundIds || [])],
    selectedSoundIndex: interaction.selectedSoundIndex ?? null,
    selectedSoundIndices: [...(interaction.selectedSoundIndices || [])],
    hoveredSoundId: interaction.hoveredSoundId ?? null,
    hoveredSoundIndex: interaction.hoveredSoundIndex ?? null,
    hoverCell: interaction.hoverCell ? { ...interaction.hoverCell } : null,
    selectedCell: interaction.selectedCell ? { ...interaction.selectedCell } : null,
    soundDrag: interaction.soundDrag
      ? {
          active: Boolean(interaction.soundDrag.active),
          leadSoundId: interaction.soundDrag.leadSoundId ?? null,
          previewDelta: interaction.soundDrag.previewDelta ? { ...interaction.soundDrag.previewDelta } : null,
        }
      : null,
    objectPlacementPreviewSuppressed: Boolean(interaction.objectPlacementPreviewSuppressed),
    preview,
    authoredSounds: authoredSoundSummary,
  };
}

function formatSoundDebugSnapshot(snapshot) {
  return [
    `layer=${snapshot.activeLayer}`,
    `preset=${snapshot.activeSoundPresetId || "null"}`,
    `selIds=${formatSoundDebugList(snapshot.selectedSoundIds)}`,
    `selIdx=${formatSoundDebugList(snapshot.selectedSoundIndices)}`,
    `hoverId=${snapshot.hoveredSoundId || "null"}`,
    `hoverIdx=${snapshot.hoveredSoundIndex ?? "null"}`,
    `hoverCell=${formatSoundDebugCell(snapshot.hoverCell)}`,
    `selectedCell=${formatSoundDebugCell(snapshot.selectedCell)}`,
    `drag=${summarizeSoundDebugDrag(snapshot.soundDrag)}`,
    `suppressed=${snapshot.objectPlacementPreviewSuppressed ? "yes" : "no"}`,
    `preview=${snapshot.preview.eligible ? "yes" : "no"} (${snapshot.preview.reason})`,
    `sounds=${snapshot.authoredSounds.count}:${formatSoundDebugList(snapshot.authoredSounds.ids)}`,
  ].join(" | ");
}

function getSoundDebugSelectionSignature(snapshot) {
  return JSON.stringify({
    selectedSoundId: snapshot.selectedSoundId,
    selectedSoundIds: snapshot.selectedSoundIds,
    selectedSoundIndex: snapshot.selectedSoundIndex,
    selectedSoundIndices: snapshot.selectedSoundIndices,
    selectedCell: snapshot.selectedCell,
  });
}

function getSoundDebugPreviewSignature(snapshot) {
  return JSON.stringify({
    eligible: snapshot.preview.eligible,
    reason: snapshot.preview.reason,
    activeSoundPresetId: snapshot.activeSoundPresetId,
    hoverCell: snapshot.hoverCell,
    suppressed: snapshot.objectPlacementPreviewSuppressed,
  });
}

function historyEntryContainsDecor(entry) {
  if (!entry) return false;
  if (entry.kind === "decor") return true;
  if (entry.type === "batch") {
    return entry.edits?.some((edit) => historyEntryContainsDecor(edit)) ?? false;
  }
  return false;
}

function historyEntryContainsEntity(entry) {
  if (!entry) return false;
  if (entry.kind === "entity") return true;
  if (entry.type === "batch") {
    return entry.edits?.some((edit) => historyEntryContainsEntity(edit)) ?? false;
  }
  return false;
}

function historyEntryContainsSound(entry) {
  if (!entry) return false;
  if (entry.kind === "sound") return true;
  if (entry.type === "batch") {
    return entry.edits?.some((edit) => historyEntryContainsSound(edit)) ?? false;
  }
  return false;
}

function historyEntryContainsObjectLayer(entry) {
  return historyEntryContainsEntity(entry) || historyEntryContainsDecor(entry) || historyEntryContainsSound(entry);
}

function collectHistoryEntries(entry, callback) {
  if (!entry || typeof callback !== "function") return;
  if (entry.type === "batch") {
    for (const edit of entry.edits || []) {
      collectHistoryEntries(edit, callback);
    }
    return;
  }
  callback(entry);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readFogDefaultsFromStorage() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(FOG_DEFAULTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return getFogVolumeParams({ type: "fog_volume", params: parsed });
  } catch {
    return null;
  }
}

function writeFogDefaultsToStorage(params) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(FOG_DEFAULTS_STORAGE_KEY, JSON.stringify(getFogVolumeParams({ type: "fog_volume", params })));
  } catch {
    // Storage write failures should not block authoring.
  }
}

function parseEntityParamInputValue(target) {
  const paramType = target?.dataset?.entityParamType;
  if (paramType === "boolean") {
    return Boolean(target.checked);
  }
  if (paramType === "number") {
    const parsed = Number.parseFloat(target.value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return target.value;
}

function parseEntityParamInputValueForLiveInput(target) {
  const paramType = target?.dataset?.entityParamType;
  if (paramType !== "number") return parseEntityParamInputValue(target);
  const trimmed = String(target.value ?? "").trim();
  if (!trimmed || trimmed === "-" || trimmed === "." || trimmed === "-.") return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function getNewLevelSizeValidationMessage(widthValue, heightValue) {
  const parsedWidth = Number.parseInt(String(widthValue), 10);
  const parsedHeight = Number.parseInt(String(heightValue), 10);

  if (!Number.isInteger(parsedWidth) || !Number.isInteger(parsedHeight)) {
    return `Use whole numbers: width ${MIN_LEVEL_DIMENSION}-${MAX_LEVEL_WIDTH}, height ${MIN_LEVEL_DIMENSION}-${MAX_LEVEL_HEIGHT}.`;
  }

  if (!isValidLevelDimension(parsedWidth, "width") || !isValidLevelDimension(parsedHeight, "height")) {
    return `Width must be ${MIN_LEVEL_DIMENSION}-${MAX_LEVEL_WIDTH} and height must be ${MIN_LEVEL_DIMENSION}-${MAX_LEVEL_HEIGHT}.`;
  }

  return null;
}

function renderNewLevelSizePopover(state) {
  const newLevelSize = state.ui.newLevelSize;
  if (!newLevelSize?.isOpen) return "";

  const widthValue = newLevelSize.width ?? String(DEFAULT_NEW_LEVEL_WIDTH);
  const heightValue = newLevelSize.height ?? String(DEFAULT_NEW_LEVEL_HEIGHT);
  const validationMessage = newLevelSize.error || getNewLevelSizeValidationMessage(widthValue, heightValue);
  const isValid = !validationMessage;

  return `
    <form class="newLevelPopover panelSection" data-new-level-popover>
      <div class="newLevelPopoverHeader">
        <span class="newLevelPopoverTitle">New level size</span>
        <button type="button" class="topBarIconButton newLevelPopoverClose" data-new-level-action="cancel" aria-label="Cancel">×</button>
      </div>
      <div class="newLevelPopoverFields compactFieldGrid">
        <label class="fieldRow fieldRowCompact">
          <span class="label">Width</span>
          <input
            type="text"
            min="${MIN_LEVEL_DIMENSION}"
            max="${MAX_LEVEL_WIDTH}"
            step="1"
            inputmode="numeric"
            value="${escapeHtml(widthValue)}"
            data-new-level-field="width"
          />
        </label>
        <label class="fieldRow fieldRowCompact">
          <span class="label">Height</span>
          <input
            type="text"
            min="${MIN_LEVEL_DIMENSION}"
            max="${MAX_LEVEL_HEIGHT}"
            step="1"
            inputmode="numeric"
            value="${escapeHtml(heightValue)}"
            data-new-level-field="height"
          />
        </label>
      </div>
      <div class="newLevelPopoverError">${validationMessage ? escapeHtml(validationMessage) : "&nbsp;"}</div>
      <div class="newLevelPopoverActions">
        <button type="button" class="toolButton isSecondary" data-new-level-action="cancel">Cancel</button>
        <button type="submit" class="toolButton" data-new-level-action="confirm" ${isValid ? "" : "disabled"}>Create</button>
      </div>
    </form>
  `;
}

function renderSettingsMenu(state) {
  const active = state.document.active;
  const layers = [...(active?.backgrounds?.layers || [])].sort((left, right) => (left.depth ?? 0) - (right.depth ?? 0));
  const { gridVisible, gridOpacity, gridColor } = state.viewport;
  const darknessPreviewEnabled = Boolean(state.ui.darknessPreviewEnabled);
  const proximityOverlaysEnabled = state.ui.proximityOverlaysEnabled !== false;

  return `
    <div class="topBarMenuSection">
      <div class="topBarMenuTitle">Preview</div>
      <label class="fieldRow compactInline">
        <span class="label">Darkness Preview</span>
        <input type="checkbox" data-preview-field="darkness" ${darknessPreviewEnabled ? "checked" : ""} />
      </label>
      <label class="fieldRow compactInline">
        <span class="label">Proximity Overlays</span>
        <input type="checkbox" data-preview-field="proximity-overlays" ${proximityOverlaysEnabled ? "checked" : ""} />
      </label>
      <div class="fieldMeta">Darkens the level view while keeping editing overlays readable.</div>
    </div>

    <div class="topBarMenuSection">
      <div class="topBarMenuTitle">Grid</div>
      <div class="compactFieldGrid topBarCompactFields">
        <label class="fieldRow compactInline">
          <span class="label">Visible</span>
          <input type="checkbox" data-grid-field="visible" ${gridVisible ? "checked" : ""} />
        </label>
        <label class="fieldRow fieldRowCompact">
          <span class="label">Opacity</span>
          <div class="rangeField">
            <input type="range" min="0" max="1" step="0.01" value="${gridOpacity}" data-grid-field="opacity" />
            <span class="rangeValue">${Math.round(gridOpacity * 100)}%</span>
          </div>
        </label>
        <label class="fieldRow fieldRowCompact topBarCompactFieldFull">
          <span class="label">Color</span>
          <input type="color" value="${gridColor}" data-grid-field="color" />
        </label>
      </div>
    </div>

    <div class="topBarMenuSection">
      <div class="topBarMenuTitle">Workspace</div>
      <label class="fieldRow fieldRowCompact">
        <span class="label">Background</span>
        <input type="color" value="${state.ui.workspaceBackground}" data-workspace-field="background" />
      </label>
    </div>

    <div class="topBarMenuSection">
      <div class="topBarMenuTitle">Background Layers</div>
      <div class="topBarMenuMeta">${layers.length} layer${layers.length === 1 ? "" : "s"}</div>
      <div class="compactActionRow compactActionRowSingle topBarMenuActionRow">
        <button type="button" class="toolButton isSecondary" data-background-action="add">Add layer</button>
      </div>
      <div class="topBarLayerList">
        ${layers.map((layer, index) => `
          <div class="topBarLayerRow">
            <div class="topBarLayerHeader">
              <span class="badge">${escapeHtml(layer.name || `Layer ${index + 1}`)}</span>
              <button
                type="button"
                class="toolButton isSecondary topBarLayerRemoveButton"
                data-background-action="remove"
                data-background-index="${index}"
                ${layers.length <= 1 ? "disabled" : ""}
              >
                Remove
              </button>
            </div>
            <div class="compactFieldGrid topBarLayerFields">
              <label class="fieldRow fieldRowCompact">
                <span class="label">Name</span>
                <input type="text" value="${escapeHtml(layer.name)}" data-background-field="name" data-background-index="${index}" />
              </label>
              <label class="fieldRow fieldRowCompact">
                <span class="label">Color</span>
                <input type="color" value="${layer.color}" data-background-field="color" data-background-index="${index}" />
              </label>
              <label class="fieldRow compactInline">
                <span class="label">Visible</span>
                <input type="checkbox" ${layer.visible ? "checked" : ""} data-background-field="visible" data-background-index="${index}" />
              </label>
              <label class="fieldRow fieldRowCompact">
                <span class="label">Depth</span>
                <div class="rangeField">
                  <input type="range" min="0" max="1" step="0.01" value="${Number(layer.depth || 0).toFixed(2)}" data-background-field="depth" data-background-index="${index}" />
                  <span class="rangeValue">${Number(layer.depth || 0).toFixed(2)}</span>
                </div>
              </label>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderExportMenu(state) {
  const active = state.document.active;

  if (!active) {
    return `
      <div class="topBarMenuSection">
        <div class="topBarMenuTitle">Export</div>
        <div class="mutedValue">Load or create a level before exporting.</div>
      </div>
    `;
  }

  return `
    <div class="topBarMenuSection">
      <div class="topBarMenuTitle">Export Level</div>
      <div class="topBarMenuMeta">Adjust metadata before downloading the JSON export.</div>
      <div class="compactFieldGrid topBarCompactFields">
        <label class="fieldRow fieldRowCompact topBarCompactFieldFull">
          <span class="label">Name</span>
          <input type="text" value="${escapeHtml(active.meta.name)}" data-export-meta-field="name" />
        </label>
        <label class="fieldRow fieldRowCompact topBarCompactFieldFull">
          <span class="label">ID</span>
          <input type="text" value="${escapeHtml(active.meta.id)}" data-export-meta-field="id" />
        </label>
        <label class="fieldRow fieldRowCompact">
          <span class="label">Width</span>
          <input type="number" min="${MIN_LEVEL_DIMENSION}" max="${MAX_LEVEL_WIDTH}" step="1" value="${active.dimensions.width}" data-export-dimension-field="width" />
        </label>
        <label class="fieldRow fieldRowCompact">
          <span class="label">Height</span>
          <input type="number" min="${MIN_LEVEL_DIMENSION}" max="${MAX_LEVEL_HEIGHT}" step="1" value="${active.dimensions.height}" data-export-dimension-field="height" />
        </label>
      </div>
      <div class="compactActionRow compactActionRowSingle topBarMenuActionRow">
        <button type="button" class="toolButton" data-export-action="download">Download JSON</button>
      </div>
    </div>
  `;
}

function renderHelpMenu() {
  return `
    <div class="topBarMenuSection">
      <div class="topBarMenuTitle">Shortcuts</div>
      <div class="topBarShortcutGrid">
        <span><kbd>V</kbd> Inspect</span>
        <span><kbd>B</kbd> Paint</span>
        <span><kbd>E</kbd> Erase</span>
        <span><kbd>R</kbd> Rect</span>
        <span><kbd>L</kbd> Line</span>
        <span><kbd>F</kbd> Fill</span>
        <span><kbd>Ctrl/⌘+Z</kbd> Undo</span>
        <span><kbd>Ctrl/⌘+Shift+Z</kbd> Redo</span>
        <span><kbd>Delete</kbd>/<kbd>Backspace</kbd> Delete selection</span>
        <span><kbd>Ctrl/⌘+D</kbd> Duplicate selection</span>
      </div>
    </div>
  `;
}

export function createEditorApp({
  canvas,
  minimapCanvas,
  floatingPanelHost,
  inspector,
  brushPanel,
  cellHud,
  topBar,
  topBarStatus,
  topBarExportMenu,
  topBarSettingsMenu,
  topBarHelpMenu,
  bottomPanel,
  store,
}) {
  const ctx = canvas.getContext("2d");
  const minimapCtx = minimapCanvas.getContext("2d");
  const PAN_CURSOR = "grab";
  const PAN_ACTIVE_CURSOR = "grabbing";
  let minimapLayout = null;
  const interactionState = {
    panDrag: null,
    arrowPan: {
      rafId: 0,
      activeKeys: new Set(),
      speedMultiplier: 1,
    },
    suppressNextClick: false,
    hoveringPausedScanHandle: false,
    lastCanvasPointer: {
      clientX: null,
      clientY: null,
      inside: false,
    },
  };
  let fogStepperSession = null;
  const fogPreviewMotion = {
    rafId: 0,
    startedAtMs: 0,
    surface: null,
    canvas: null,
    ctx: null,
    lumoSprite: null,
    field: null,
    vel: null,
    sampleCount: 0,
    bandStartX: 0,
    bandEndX: 0,
    worldWidth: 620,
    worldHeight: 188,
    lumoX: 0,
    lumoDirection: 1,
    lastDirection: 1,
    lastLumoX: null,
    durationMs: 9600,
    distancePerSecond: 140,
    lastElapsedMs: undefined,
  };
  const waterPreviewMotion = {
    rafId: 0,
    startedAtMs: 0,
    surface: null,
    canvas: null,
    ctx: null,
    lumoSprite: null,
    worldWidth: 620,
    worldHeight: 188,
    bandStartX: 0,
    bandEndX: 0,
    durationMs: 9600,
    lumoX: 0,
    lumoDirection: 1,
  };
  const lavaPreviewMotion = {
    rafId: 0,
    startedAtMs: 0,
    surface: null,
    canvas: null,
    ctx: null,
    lumoSprite: null,
    worldWidth: 620,
    worldHeight: 188,
    bandStartX: 0,
    bandEndX: 0,
    durationMs: 9600,
    lumoX: 0,
    lumoDirection: 1,
  };
  const bubblingLiquidPreviewMotion = {
    rafId: 0,
    startedAtMs: 0,
    surface: null,
    canvas: null,
    ctx: null,
    lumoSprite: null,
    worldWidth: 620,
    worldHeight: 188,
    bandStartX: 0,
    bandEndX: 0,
    durationMs: 9600,
  };
  const fogPreviewTileSprites = new Map();
  const ensureFogPreviewTileSprite = (key, src) => {
    if (!key || !src) return null;
    const cached = fogPreviewTileSprites.get(key);
    if (cached) return cached;
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    image.addEventListener("load", () => {
      if (fogPreviewMotion.surface?.isConnected) {
        drawFogPreviewCanvas(fogPreviewMotion.lastElapsedMs ?? 0);
      }
      if (waterPreviewMotion.surface?.isConnected) {
        drawWaterPreviewCanvas(0);
      }
      if (lavaPreviewMotion.surface?.isConnected) {
        drawLavaPreviewCanvas(0);
      }
      if (bubblingLiquidPreviewMotion.surface?.isConnected) {
        drawBubblingLiquidPreviewCanvas(0);
      }
    });
    fogPreviewTileSprites.set(key, image);
    return image;
  };
  const toolShortcutMap = {
    v: EDITOR_TOOLS.INSPECT,
    b: EDITOR_TOOLS.PAINT,
    e: EDITOR_TOOLS.ERASE,
    r: EDITOR_TOOLS.RECT,
    l: EDITOR_TOOLS.LINE,
    f: EDITOR_TOOLS.FILL,
  };
  let scanAnimationFrame = 0;
  let scanPlaybackToken = 0;
  const scanAudioPlayback = createScanAudioPlaybackController();
  const soundPreviewPlayback = createSoundPreviewController();
  const soundDebugState = {
    events: [],
    sequence: 0,
    lastSelectionSignature: null,
    lastSelectionSnapshot: null,
    lastPreviewSignature: null,
    lastPreviewSnapshot: null,
  };

  // Canonical entity/decor/sound runtime guardrail: stable-id lanes are the only supported object runtime in editor-v2.
  // Do not reintroduce legacy object interaction, mutation, drag, history, or render branches here.
  const canonicalEntityHistory = createCanonicalEntityHistory();
  const canonicalDecorHistory = createCanonicalDecorHistory();
  const canonicalSoundHistory = createCanonicalSoundHistory();
  const globalHistoryTimeline = store.getState().history.globalTimeline;

  globalHistoryTimeline.clearRedoTargets = () => {
    store.getState().history.redoStack.length = 0;
    canonicalEntityHistory.redoStack.length = 0;
    canonicalDecorHistory.redoStack.length = 0;
    canonicalSoundHistory.redoStack.length = 0;
  };

  const appendSoundDebugEvent = (title, details, beforeSnapshot = null, afterSnapshot = null) => {
    soundDebugState.sequence += 1;
    soundDebugState.events.unshift({
      id: soundDebugState.sequence,
      title,
      details,
      beforeSnapshot: beforeSnapshot ? formatSoundDebugSnapshot(beforeSnapshot) : null,
      afterSnapshot: afterSnapshot ? formatSoundDebugSnapshot(afterSnapshot) : null,
    });
    soundDebugState.events = soundDebugState.events.slice(0, SOUND_DEBUG_MAX_EVENTS);
  };


  const setSoundPreviewState = (draft, updates = {}) => {
    draft.soundPreview = {
      playbackState: "idle",
      soundIndex: null,
      soundId: null,
      source: null,
      error: null,
      ...draft.soundPreview,
      ...updates,
    };
  };

  const clearSoundPreviewState = (draft, error = null) => {
    setSoundPreviewState(draft, {
      playbackState: "idle",
      soundIndex: null,
      soundId: null,
      source: null,
      error,
    });
  };

  const stopSoundPreview = (error = null) => {
    soundPreviewPlayback.stop();
    store.setState((draft) => {
      clearSoundPreviewState(draft, error);
    });
  };

  const syncSoundPreviewLifecycle = (state) => {
    const previewState = state?.soundPreview;
    if (!previewState || previewState.playbackState !== "playing") return;

    const selectedIndices = getSelectedSoundIndices(state.interaction, state?.document?.active?.sounds || []);
    if (state?.scan?.playbackState !== "idle") {
      stopSoundPreview("Preview is unavailable while scan playback is active.");
      return;
    }

    if (selectedIndices.length !== 1 || selectedIndices[0] !== previewState.soundIndex) {
      stopSoundPreview();
      return;
    }

    const sound = state?.document?.active?.sounds?.[previewState.soundIndex];
    const previewKey = getSoundPreviewKey(sound, previewState.soundIndex);
    if (!sound || previewKey !== soundPreviewPlayback.getActiveKey() || previewKey === null) {
      stopSoundPreview();
    }
  };

  const syncScanAudioPlayback = (state) => {
    scanAudioPlayback.sync({
      doc: state?.document?.active || null,
      scan: state?.scan || null,
    });
  };

  const cancelScheduledScanFrame = () => {
    if (!scanAnimationFrame) return;
    window.cancelAnimationFrame(scanAnimationFrame);
    scanAnimationFrame = 0;
  };

  const invalidateScanPlayback = () => {
    scanPlaybackToken += 1;
    cancelScheduledScanFrame();
  };

  const syncScanWithDocument = (draft, options = {}) => {
    const { preserveRange = true, preserveLog = false } = options;
    const doc = draft.document.active;
    if (!doc) return;

    invalidateScanPlayback();
    const width = Number(doc.dimensions?.width) || 0;
    draft.scan.startX = preserveRange ? sanitizeOptionalScanCoordinate(draft.scan.startX, width) : null;
    draft.scan.endX = preserveRange ? sanitizeOptionalScanCoordinate(draft.scan.endX, width) : null;
    syncScanPlaybackState(draft.scan, doc, { preserveLog });
  };

  const stopScanPlayback = (draft, preserveLog = true) => {
    if (!draft.document.active) return;
    invalidateScanPlayback();
    stopScanPlaybackState(draft.scan, draft.viewport, draft.document.active, { preserveLog });
  };

  const pauseScanPlayback = (draft) => {
    if (!draft.document.active) return;
    invalidateScanPlayback();
    applyCanvasTarget(draft, "sound");
    pauseScanPlaybackState(draft.scan);
  };

  const startScanPlayback = (draft) => {
    if (!draft.document.active) return;
    invalidateScanPlayback();
    applyCanvasTarget(draft, "sound");
    startScanPlaybackState(draft.scan, draft.viewport, draft.document.active);
    applyScanEvaluation(draft, draft.scan.positionX, draft.scan.positionX);
  };

  const applyScanEvaluation = (draft, previousX, nextX, options = {}) => {
    const { appendLog = false } = options;
    const doc = draft.document.active;
    if (!doc) return null;

    const activity = getScanActivity(doc, previousX, nextX);
    draft.scan.positionX = nextX;
    draft.scan.activeSoundIds = activity.activeSoundIds;
    draft.scan.audioEvaluation = activity.audioEvaluation;

    const triggeredEvents = activity.triggeredEvents;
    if (appendLog && triggeredEvents.length) {
      draft.scan.eventLog = [...triggeredEvents.slice().reverse(), ...(draft.scan.eventLog || [])].slice(0, 8);
      draft.scan.lastEventSummary = formatScanEventSummary(triggeredEvents[triggeredEvents.length - 1]);
    }

    return activity;
  };

  const scheduleScanFrame = (playbackToken = scanPlaybackToken) => {
    if (scanAnimationFrame) return;
    scanAnimationFrame = window.requestAnimationFrame((timestamp) => {
      scanAnimationFrame = 0;
      if (playbackToken !== scanPlaybackToken) return;
      const state = store.getState();
      const doc = state.document.active;
      if (!doc || !isScanPlaying(state.scan)) return;

      let triggeredEvents = [];
      let shouldContinue = false;
      store.setState((draft) => {
        const activeDoc = draft.document.active;
        if (playbackToken !== scanPlaybackToken || !activeDoc || !isScanPlaying(draft.scan)) return;

        const { startX, endX } = getScanRange(draft.scan, activeDoc);
        const previousX = Number.isFinite(draft.scan.positionX) ? draft.scan.positionX : startX;
        const previousFrameTime = draft.scan.lastFrameTime ?? timestamp;
        const deltaSeconds = Math.max(0, Math.min(0.1, (timestamp - previousFrameTime) / 1000));
        const speed = clampScanSpeed(draft.scan.speed);
        const nextX = Math.min(endX, previousX + speed * deltaSeconds);
        const activity = applyScanEvaluation(draft, previousX, nextX, { appendLog: true });
        triggeredEvents = activity?.triggeredEvents || [];

        draft.scan.speed = speed;
        draft.scan.lastFrameTime = timestamp;

        const rect = canvas.getBoundingClientRect();
        const targetOffsetX = rect.width * 0.5 - nextX * activeDoc.dimensions.tileSize * draft.viewport.zoom;
        const deltaX = targetOffsetX - draft.viewport.offsetX;
        const followAlpha = deltaSeconds > 0 ? Math.min(1, deltaSeconds * 8) : 0.2;
        panViewportByDelta(draft.viewport, deltaX * followAlpha, 0);

        if (nextX >= endX) {
          finishScanPlaybackState(draft.scan);
        }

        shouldContinue = isScanPlaying(draft.scan);
      });

      if (playbackToken !== scanPlaybackToken) return;
      for (const event of triggeredEvents) {
        console.info(`[scan] ${event.soundName} (${event.soundType}) ${event.intersectionType} at x ${event.atX}`);
      }

      if (shouldContinue) {
        scheduleScanFrame(playbackToken);
      }
    });
  };

  const isShortcutTargetBlocked = (eventTarget) => isNativeTextEditingEventTarget(eventTarget);

  const hasBlockedShortcutFocus = () => hasNativeTextEditingFocus(document);

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const minimapRect = minimapCanvas.getBoundingClientRect();
    minimapCanvas.width = Math.max(1, Math.floor(minimapRect.width * dpr));
    minimapCanvas.height = Math.max(1, Math.floor(minimapRect.height * dpr));
    minimapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const state = store.getState();
    if (!state.document.active) return;

    const { width, height, tileSize } = state.document.active.dimensions;
    const docWidth = width * tileSize;
    const docHeight = height * tileSize;

    state.viewport.offsetX = Math.max(24, (rect.width - docWidth) * 0.5);
    state.viewport.offsetY = Math.max(24, (rect.height - docHeight) * 0.5);
  };

  const isPanGestureActive = () => Boolean(interactionState.panDrag?.active);

  const isSpacePanModifierActive = () => store.getState().interaction.spacePanActive;

  const syncCanvasCursor = () => {
    const state = store.getState();
    const scanCursor =
      state.interaction.scanDrag?.active
        ? "ew-resize"
        : interactionState.hoveringPausedScanHandle
          ? "grab"
          : "";
    canvas.style.cursor = isPanGestureActive() ? PAN_ACTIVE_CURSOR : isSpacePanModifierActive() ? PAN_CURSOR : scanCursor;
  };

  const updateSpacePanActive = (active) => {
    const state = store.getState();
    if (state.interaction.spacePanActive === active) return;

    store.setState((draft) => {
      draft.interaction.spacePanActive = active;
    });
    syncCanvasCursor();
  };

  const startPanDrag = (event, trigger) => {
    event.preventDefault();
    interactionState.panDrag = {
      active: true,
      trigger,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
    };
    syncCanvasCursor();
  };

  const handleCanvasWheel = (event) => {
    const state = store.getState();
    if (!state.document.active) return;

    event.preventDefault();

    const point = getCanvasPointFromMouseEvent(canvas, event);
    const zoomMultiplier = getZoomMultiplierFromWheelDelta(event.deltaY);
    const nextZoom = clampViewportZoom(state.viewport.zoom * zoomMultiplier);

    if (nextZoom === state.viewport.zoom) return;

    store.setState((draft) => {
      zoomViewportAroundPoint(draft.viewport, point, nextZoom);
    });
  };

  const panFromMouseMove = (event) => {
    const panDrag = interactionState.panDrag;
    if (!panDrag?.active) return false;

    const deltaX = event.clientX - panDrag.lastClientX;
    const deltaY = event.clientY - panDrag.lastClientY;

    if (deltaX !== 0 || deltaY !== 0) {
      interactionState.suppressNextClick = true;

      store.setState((draft) => {
        panViewportByDelta(draft.viewport, deltaX, deltaY);
      });
    }

    panDrag.lastClientX = event.clientX;
    panDrag.lastClientY = event.clientY;
    return true;
  };

  const stopPanDrag = () => {
    if (!interactionState.panDrag?.active) return;

    interactionState.panDrag = null;
    syncCanvasCursor();
  };

  const getArrowPanDelta = (activeKeys, speedMultiplier = 1) => {
    const keys = activeKeys instanceof Set ? activeKeys : new Set(activeKeys || []);
    if (!keys.size) return null;

    let deltaX = 0;
    let deltaY = 0;
    if (keys.has("ArrowLeft")) deltaX += ARROW_PAN_STEP_PX;
    if (keys.has("ArrowRight")) deltaX -= ARROW_PAN_STEP_PX;
    if (keys.has("ArrowUp")) deltaY += ARROW_PAN_STEP_PX;
    if (keys.has("ArrowDown")) deltaY -= ARROW_PAN_STEP_PX;
    if (deltaX === 0 && deltaY === 0) return null;

    const multiplier = Number.isFinite(speedMultiplier) ? Math.max(1, speedMultiplier) : 1;
    return {
      x: deltaX * multiplier,
      y: deltaY * multiplier,
    };
  };

  const applyArrowKeyPan = () => {
    const arrowPanDelta = getArrowPanDelta(interactionState.arrowPan.activeKeys, interactionState.arrowPan.speedMultiplier);
    if (!arrowPanDelta) return false;
    store.setState((draft) => {
      panViewportByDelta(draft.viewport, arrowPanDelta.x, arrowPanDelta.y);
    });
    return true;
  };

  const stopArrowPanLoop = () => {
    if (interactionState.arrowPan.rafId) {
      window.cancelAnimationFrame(interactionState.arrowPan.rafId);
      interactionState.arrowPan.rafId = 0;
    }
  };

  const scheduleArrowPanLoop = () => {
    if (interactionState.arrowPan.rafId || !interactionState.arrowPan.activeKeys.size) return;
    interactionState.arrowPan.rafId = window.requestAnimationFrame(() => {
      interactionState.arrowPan.rafId = 0;
      if (!interactionState.arrowPan.activeKeys.size) return;
      applyArrowKeyPan();
      scheduleArrowPanLoop();
    });
  };

  const syncPausedScanHover = (state, point) => {
    const nextHovering = Boolean(
      point &&
      state.document.active &&
      isPausedScanPlayheadHit(state.document.active, state.viewport, state.scan, point.x, point.y) &&
      !state.interaction.scanDrag?.active &&
      !isPanGestureActive(),
    );
    if (interactionState.hoveringPausedScanHandle === nextHovering) return;
    interactionState.hoveringPausedScanHandle = nextHovering;
    syncCanvasCursor();
  };

  const keepScanPlayheadVisible = (draft, positionX) => {
    const doc = draft.document.active;
    if (!doc) return;

    const rect = canvas.getBoundingClientRect();
    const scanScreenX = getScanScreenX(draft.viewport, doc.dimensions.tileSize, positionX);
    const edgePadding = Math.max(72, Math.min(rect.width * 0.2, 180));
    if (scanScreenX < edgePadding) {
      panViewportByDelta(draft.viewport, edgePadding - scanScreenX, 0);
      return;
    }
    if (scanScreenX > rect.width - edgePadding) {
      panViewportByDelta(draft.viewport, (rect.width - edgePadding) - scanScreenX, 0);
    }
  };

  const updatePausedScanDrag = (event, state) => {
    if (!state.interaction.scanDrag?.active || !state.document.active) return false;
    if ((event.buttons & 1) !== 1) return false;

    const point = getCanvasPointFromMouseEvent(canvas, event);
    const doc = state.document.active;
    const safeZoom = Math.max(0.0001, state.viewport.zoom);
    const nextPositionX = (point.x - state.viewport.offsetX) / (doc.dimensions.tileSize * safeZoom);
    interactionState.suppressNextClick = true;
    store.setState((draft) => {
      if (!draft.interaction.scanDrag?.active || !draft.document.active) return;
      if (!setPausedScanPosition(draft.scan, draft.document.active, nextPositionX)) return;
      applyScanEvaluation(draft, state.scan.positionX, draft.scan.positionX);
      keepScanPlayheadVisible(draft, draft.scan.positionX);
      draft.interaction.scanDrag.lastClientX = event.clientX;
      draft.interaction.scanDrag.lastClientY = event.clientY;
    });
    return true;
  };



  const resizeDocument = (nextWidth, nextHeight) => {
    store.setState((draft) => {
      const doc = draft.document.active;
      if (!doc) return;

      const currentWidth = doc.dimensions.width;
      const currentHeight = doc.dimensions.height;

      if (currentWidth === nextWidth && currentHeight === nextHeight) return;

      const resizedTiles = new Array(nextWidth * nextHeight).fill(0);
      const resizedBackground = new Array(nextWidth * nextHeight).fill(null);
      const copyWidth = Math.min(currentWidth, nextWidth);
      const copyHeight = Math.min(currentHeight, nextHeight);

      for (let y = 0; y < copyHeight; y += 1) {
        for (let x = 0; x < copyWidth; x += 1) {
          const sourceIndex = getTileIndex(currentWidth, x, y);
          const targetIndex = getTileIndex(nextWidth, x, y);
          resizedTiles[targetIndex] = doc.tiles.base[sourceIndex];
          resizedBackground[targetIndex] = doc.background?.base?.[sourceIndex] ?? null;
        }
      }

      doc.dimensions.width = nextWidth;
      doc.dimensions.height = nextHeight;
      doc.tiles.base = resizedTiles;
      doc.background.base = resizedBackground;
      doc.tiles.placements = (doc.tiles.placements || []).filter((placement) => {
        const size = Number.isInteger(placement?.size) ? Math.max(1, placement.size) : 1;
        return placement.x >= 0 && placement.y >= 0 && placement.x + size - 1 < nextWidth && placement.y - (size - 1) >= 0 && placement.y < nextHeight;
      });
      doc.background.placements = (doc.background.placements || []).filter((placement) => {
        const size = Number.isInteger(placement?.size) ? Math.max(1, placement.size) : 1;
        return placement.x >= 0 && placement.y >= 0 && placement.x + size - 1 < nextWidth && placement.y - (size - 1) >= 0 && placement.y < nextHeight;
      });

      for (const decor of doc.decor || []) {
        decor.x = Math.max(0, Math.min(nextWidth - 1, decor.x));
        decor.y = Math.max(0, Math.min(nextHeight - 1, decor.y));
      }

      for (const entity of doc.entities || []) {
        entity.x = Math.max(0, Math.min(nextWidth - 1, entity.x));
        entity.y = Math.max(0, Math.min(nextHeight - 1, entity.y));
      }

      for (const sound of doc.sounds || []) {
        sound.x = Math.max(0, Math.min(nextWidth - 1, sound.x));
        sound.y = Math.max(0, Math.min(nextHeight - 1, sound.y));
      }

      pruneDecorSelection(draft.interaction, doc.decor || []);
      if (draft.interaction.hoveredDecorId && getDecorIndexById(doc.decor || [], draft.interaction.hoveredDecorId) === null) {
        setHoveredDecor(draft, null);
      } else if (Number.isInteger(draft.interaction.hoveredDecorIndex) && draft.interaction.hoveredDecorIndex >= (doc.decor?.length || 0)) {
        setHoveredDecor(draft, null);
      }

      pruneEntitySelection(draft.interaction, doc.entities?.length || 0);
      reconcileEntitySelectionState(draft, {
        clearHover: true,
        clearHoverCell: true,
        clearDrag: true,
      });
      reconcileSoundInteractionState(draft);
      draft.interaction.hoverCell = null;
      draft.interaction.dragPaint = null;
      draft.interaction.rectDrag = null;
      draft.interaction.lineDrag = null;
      draft.interaction.boxSelection = null;
      clearDecorScatterDrag(draft);
      draft.history.undoStack = [];
      draft.history.redoStack = [];
      draft.history.activeBatch = null;
      clearGlobalHistoryTimeline(draft.history.globalTimeline);
      syncScanWithDocument(draft, { preserveRange: true, preserveLog: false });
    });

    resize();
    draw(store.getState());
  };

  const updateDocumentMeta = (field, value) => {
    store.setState((draft) => {
      const doc = draft.document.active;
      if (!doc) return;
      if (field !== "name" && field !== "id") return;

      doc.meta[field] = value;
    });
  };


  const updateGridSettings = (field, value) => {
    store.setState((draft) => {
      if (field === "visible") {
        draft.viewport.gridVisible = Boolean(value);
        return;
      }

      if (field === "opacity") {
        const nextOpacity = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : draft.viewport.gridOpacity;
        draft.viewport.gridOpacity = nextOpacity;
        return;
      }

      if (field === "color" && typeof value === "string") {
        draft.viewport.gridColor = value;
      }
    });
  };

  const updateWorkspaceSettings = (field, value) => {
    store.setState((draft) => {
      if (field !== "background" || typeof value !== "string") return;
      draft.ui.workspaceBackground = value;
    });
  };

  const updatePreviewSettings = (field, value) => {
    store.setState((draft) => {
      if (field === "darkness") {
        draft.ui.darknessPreviewEnabled = Boolean(value);
        return;
      }

      if (field === "proximity-overlays") {
        draft.ui.proximityOverlaysEnabled = Boolean(value);
      }
    });
  };

  const updateBackgroundLayer = (index, field, value) => {
    store.setState((draft) => {
      const layers = draft.document.active?.backgrounds?.layers;
      if (!layers) return;

      if (field === "add") {
        const nextNumber = layers.length + 1;
        layers.push(
          createDefaultBackgroundLayer(layers.length, {
            id: `bg-${nextNumber}`,
            name: `Layer ${nextNumber}`,
            depth: Math.min(1, Number((layers.length * 0.15).toFixed(2))),
            color: nextNumber % 2 === 0 ? "#243047" : "#1b2436",
          }),
        );
        layers.sort((left, right) => left.depth - right.depth);
        return;
      }

      if (field === "remove") {
        if (layers.length <= 1 || index < 0 || index >= layers.length) return;
        layers.splice(index, 1);
        return;
      }

      const layer = layers[index];
      if (!layer) return;

      if (field === "visible") {
        layer.visible = Boolean(value);
        return;
      }

      if (field === "name") {
        const nextName = String(value || "").trim();
        layer.name = nextName || layer.name;
        return;
      }

      if (field === "color" && typeof value === "string") {
        layer.color = value;
        return;
      }

      if (field === "depth") {
        const nextDepth = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : layer.depth;
        layer.depth = Number(nextDepth.toFixed(2));
        layers.sort((left, right) => left.depth - right.depth);
      }
    });
  };

  const clampEntityPosition = (doc, x, y) => ({
    x: Math.max(0, Math.min(doc.dimensions.width - 1, Math.round(x))),
    y: Math.max(0, Math.min(doc.dimensions.height - 1, Math.round(y))),
  });

  const clampDecorPosition = (doc, x, y) => ({
    x: Math.max(0, Math.min(doc.dimensions.width - 1, Math.round(x))),
    y: Math.max(0, Math.min(doc.dimensions.height - 1, Math.round(y))),
  });

  const clampSoundPosition = (doc, x, y) => ({
    x: Math.max(0, Math.min(doc.dimensions.width - 1, Math.round(x))),
    y: Math.max(0, Math.min(doc.dimensions.height - 1, Math.round(y))),
  });

  const getSoundIndexById = (sounds, soundId) => {
    if (!Array.isArray(sounds) || typeof soundId !== "string" || !soundId.trim()) return null;
    const index = sounds.findIndex((sound) => sound?.id === soundId);
    return index >= 0 ? index : null;
  };

  const getObjectIndicesByIds = (items, ids = []) => {
    const lookup = new Map();
    (Array.isArray(items) ? items : []).forEach((item, index) => {
      const itemId = getObjectLayerId(item);
      if (itemId) lookup.set(itemId, index);
    });

    const resolvedIds = [];
    const resolvedIndices = [];
    const seenIds = new Set();
    for (const itemId of Array.isArray(ids) ? ids : []) {
      if (typeof itemId !== "string" || !itemId.trim() || seenIds.has(itemId) || !lookup.has(itemId)) continue;
      seenIds.add(itemId);
      resolvedIds.push(itemId);
      resolvedIndices.push(lookup.get(itemId));
    }

    return { ids: resolvedIds, indices: resolvedIndices };
  };

  const setEntitySelectionByIds = (draft, ids = [], primaryId = null) => {
    const entities = draft.document.active?.entities || [];
    const resolved = getObjectIndicesByIds(entities, ids);
    const nextPrimaryId = resolved.ids.includes(primaryId) ? primaryId : resolved.ids.at(-1) ?? null;
    const primaryIndex = nextPrimaryId ? resolved.indices[resolved.ids.indexOf(nextPrimaryId)] ?? null : null;
    setEntitySelection(draft.interaction, resolved.indices, primaryIndex);
    draft.interaction.selectedEntityIds = resolved.ids;
    draft.interaction.selectedEntityId = nextPrimaryId;
  };

  const getEntityIdAtIndex = (entities, index) =>
    Number.isInteger(index) && index >= 0 && index < entities.length
      ? getObjectLayerId(entities[index])
      : null;

  const getEntityIndexById = (entities, entityId) => {
    if (!Array.isArray(entities) || typeof entityId !== "string" || !entityId.trim()) return null;
    const index = entities.findIndex((entity) => entity?.id === entityId);
    return index >= 0 ? index : null;
  };

  const getDecorIdAtIndex = (decorItems, index) =>
    Number.isInteger(index) && index >= 0 && index < decorItems.length
      ? getObjectLayerId(decorItems[index])
      : null;

  const getDecorIndexById = (decorItems, decorId) => {
    if (!Array.isArray(decorItems) || typeof decorId !== "string" || !decorId.trim()) return null;
    const index = decorItems.findIndex((decor) => decor?.id === decorId);
    return index >= 0 ? index : null;
  };

  const cloneEntitySnapshot = (entity) =>
    entity
      ? { ...entity, params: cloneEntityParams(entity.params) }
      : null;


  const clearCleanRoomEntityHistory = () => {
    canonicalEntityHistory.clear();
  };

  const clearCleanRoomDecorHistory = () => {
    canonicalDecorHistory.clear();
  };

  const clearCleanRoomSoundHistory = () => {
    canonicalSoundHistory.clear();
  };

  const clearCleanRoomObjectRuntimeHistory = () => {
    clearCleanRoomEntityHistory();
    clearCleanRoomDecorHistory();
    clearCleanRoomSoundHistory();
    clearGlobalHistoryTimeline(globalHistoryTimeline);
  };

  const recordCleanRoomObjectAction = (lane, action) => {
    const actionRecord = recordGlobalHistoryAction(globalHistoryTimeline, {
      domain: lane,
      actionType: action?.type || null,
      route: {
        lane: `${lane}-canonical`,
        domain: lane,
      },
    });
    const actionWithTimeline = actionRecord?.actionId
      ? { ...action, globalActionId: actionRecord.actionId }
      : action;

    if (lane === "entity") {
      canonicalEntityHistory.record(actionWithTimeline);
      return;
    }

    if (lane === "decor") {
      canonicalDecorHistory.record(actionWithTimeline);
      return;
    }

    if (lane === "sound") {
      canonicalSoundHistory.record(actionWithTimeline);
    }
  };

  const syncCleanRoomEntitySelection = (draft, selectedEntityId = null) => {
    const entities = draft.document.active?.entities || [];
    const selectedEntity = typeof selectedEntityId === "string" && selectedEntityId.trim()
      ? entities.find((entity) => entity?.id === selectedEntityId) || null
      : null;
    const selectingSpecialVolume = Boolean(selectedEntity && isSpecialVolumeEntityType(selectedEntity.type));
    if (selectingSpecialVolume) {
      resumeObjectPlacementPreviews(draft, "special volume selection");
      setCanvasSelectionMode(draft, "entity");
      setActiveLayer(draft, PANEL_LAYERS.ENTITIES);
      draft.interaction.boxSelection = null;
      draft.interaction.entityDrag = null;
      draft.interaction.decorDrag = null;
      draft.interaction.soundDrag = null;
      draft.interaction.scanDrag = null;
      draft.interaction.volumePlacementDrag = null;
      clearDecorScatterDrag(draft);
    } else {
      applyCanvasTarget(draft, "entity");
      draft.interaction.entityDrag = null;
      draft.interaction.hoveredEntityIndex = null;
      draft.interaction.hoveredEntityId = null;
    }

    if (typeof selectedEntityId === "string" && selectedEntityId.trim()) {
      if (draft.ui.specialVolumeWorkbench.openEntityId && draft.ui.specialVolumeWorkbench.openEntityId !== selectedEntityId) {
        draft.ui.specialVolumeWorkbench.openEntityId = null;
      }
      selectEntitiesByIds(draft, [selectedEntityId], selectedEntityId, {
        clearHover: true,
        clearHoverCell: true,
        clearDrag: true,
        preserveCanvasTarget: selectingSpecialVolume,
      });
      return;
    }

    setEntitySelectionByIds(draft, [], null);
    draft.ui.specialVolumeWorkbench.openEntityId = null;
    draft.interaction.selectedCell = null;
    draft.interaction.hoverCell = null;
  };

  const applyCleanRoomEntityHistoryAction = (draft, action, direction) => {
    // Canonical entity history intentionally bypasses the shared legacy object-layer reconciliation path.
    // Keep entity undo/redo/delete/create pinned to entity ids here so legacy entity indexing never re-enters.
    const doc = draft.document.active;
    if (!doc || !action) return false;

    const result = applyCanonicalEntityAction(doc, action, direction);
    if (!result.changed) return false;

    syncCleanRoomEntitySelection(draft, result.selectedEntityId);
    clearDecorSelection(draft.interaction);
    clearSoundSelection(draft.interaction);
    draft.interaction.hoveredDecorIndex = null;
    draft.interaction.hoveredDecorId = null;
    clearHoveredSound(draft.interaction);
    draft.interaction.decorDrag = null;
    draft.interaction.soundDrag = null;
    return true;
  };

  const createCleanRoomEntityAtCell = (draft, cell, presetId = draft.interaction.activeEntityPresetId || DEFAULT_ENTITY_PRESET_ID) => {
    // New entity features must build on this canonical create path; do not route authored entities back through
    // the disabled legacy object-layer creation helpers.
    const doc = draft.document.active;
    if (!doc || !cell) return null;

    const decorPreset = resolveDecorPlacementPreset(presetId);
    if (decorPreset && !resolveEntityPlacementPreset(presetId) && presetId !== decorPreset.id) {
      return createDecorAtCell(draft, cell, decorPreset.id);
    }

    const entityPreset = resolveEntityPlacementPreset(presetId);
    if (!entityPreset) return null;
    if (!canCreateEntityType(doc.entities || [], entityPreset.type)) {
      const existingIndex = (doc.entities || []).findIndex((entity) => isSpawnEntityType(entity?.type));
      return existingIndex >= 0 ? existingIndex : null;
    }

    const nextNumber = (doc.entities?.length || 0) + 1;
    const entity = createEntityDraft(doc, cell.x, cell.y, entityPreset.id, nextNumber);
    entity.id = getNextStringId(doc.entities || [], "id", "entity");
    const createIndex = doc.entities.length;
    const action = {
      type: "create",
      index: createIndex,
      entity: cloneCanonicalEntitySnapshot(entity),
    };

    const changed = applyCleanRoomEntityHistoryAction(draft, action, "forward");
    if (!changed) return null;

    recordCleanRoomObjectAction("entity", action);
    return getEntityIndexById(doc.entities, entity.id);
  };

  const createFogVolumeAtWorldRect = (draft, worldRect) => {
    const doc = draft.document.active;
    if (!doc || !worldRect) return null;

    const nextNumber = (doc.entities?.length || 0) + 1;
    const fogPreset = findEntityPresetById("fog_volume");
    if (!fogPreset) return null;

    const seededEntity = createEntityDraft(doc, 0, 0, fogPreset.id, nextNumber);
    const entity = createFogVolumeEntityFromWorldRect(seededEntity, worldRect, doc.dimensions.tileSize);
    entity.id = getNextStringId(doc.entities || [], "id", "entity");
    const createIndex = doc.entities.length;
    const action = {
      type: "create",
      index: createIndex,
      entity: cloneCanonicalEntitySnapshot(entity),
    };

    const changed = applyCleanRoomEntityHistoryAction(draft, action, "forward");
    if (!changed) return null;

    recordCleanRoomObjectAction("entity", action);
    return getEntityIndexById(doc.entities, entity.id);
  };

  const createWaterVolumeAtWorldRect = (draft, worldRect) => {
    const doc = draft.document.active;
    if (!doc || !worldRect) return null;

    const nextNumber = (doc.entities?.length || 0) + 1;
    const waterPreset = findEntityPresetById("water_volume");
    if (!waterPreset) return null;

    const seededEntity = createEntityDraft(doc, 0, 0, waterPreset.id, nextNumber);
    const entity = createWaterVolumeEntityFromWorldRect(seededEntity, worldRect, doc.dimensions.tileSize);
    entity.id = getNextStringId(doc.entities || [], "id", "entity");
    const createIndex = doc.entities.length;
    const action = {
      type: "create",
      index: createIndex,
      entity: cloneCanonicalEntitySnapshot(entity),
    };

    const changed = applyCleanRoomEntityHistoryAction(draft, action, "forward");
    if (!changed) return null;

    recordCleanRoomObjectAction("entity", action);
    return getEntityIndexById(doc.entities, entity.id);
  };

  const createLavaVolumeAtWorldRect = (draft, worldRect) => {
    const doc = draft.document.active;
    if (!doc || !worldRect) return null;

    const nextNumber = (doc.entities?.length || 0) + 1;
    const lavaPreset = findEntityPresetById("lava_volume");
    if (!lavaPreset) return null;

    const seededEntity = createEntityDraft(doc, 0, 0, lavaPreset.id, nextNumber);
    const entity = createLavaVolumeEntityFromWorldRect(seededEntity, worldRect, doc.dimensions.tileSize);
    entity.id = getNextStringId(doc.entities || [], "id", "entity");
    const createIndex = doc.entities.length;
    const action = {
      type: "create",
      index: createIndex,
      entity: cloneCanonicalEntitySnapshot(entity),
    };

    const changed = applyCleanRoomEntityHistoryAction(draft, action, "forward");
    if (!changed) return null;

    recordCleanRoomObjectAction("entity", action);
    return getEntityIndexById(doc.entities, entity.id);
  };

  const createBubblingLiquidVolumeAtWorldRect = (draft, worldRect) => {
    const doc = draft.document.active;
    if (!doc || !worldRect) return null;

    const nextNumber = (doc.entities?.length || 0) + 1;
    const preset = findEntityPresetById("bubbling_liquid_volume");
    if (!preset) return null;

    const seededEntity = createEntityDraft(doc, 0, 0, preset.id, nextNumber);
    const entity = createBubblingLiquidVolumeEntityFromWorldRect(seededEntity, worldRect, doc.dimensions.tileSize);
    entity.id = getNextStringId(doc.entities || [], "id", "entity");
    const createIndex = doc.entities.length;
    const action = {
      type: "create",
      index: createIndex,
      entity: cloneCanonicalEntitySnapshot(entity),
    };
    const changed = applyCleanRoomEntityHistoryAction(draft, action, "forward");
    if (!changed) return null;
    recordCleanRoomObjectAction("entity", action);
    return getEntityIndexById(doc.entities, entity.id);
  };

  const deleteSelectedEntityCleanRoom = (draft) => {
    // Canonical entity deletion is stable-id only. Do not restore legacy entity delete or shared selection code here.
    const doc = draft.document.active;
    if (!doc) return false;

    const entityId = typeof draft.interaction.selectedEntityId === "string" && draft.interaction.selectedEntityId.trim()
      ? draft.interaction.selectedEntityId
      : null;
    if (!entityId) return false;

    const deleteIndex = getEntityIndexById(doc.entities, entityId);
    const entity = Number.isInteger(deleteIndex) ? doc.entities?.[deleteIndex] : null;
    if (!entity) return false;
    if (!canDeleteEntity(doc.entities, entity.id)) return false;

    const action = {
      type: "delete",
      index: deleteIndex,
      entity: cloneCanonicalEntitySnapshot(entity),
    };

    const changed = applyCleanRoomEntityHistoryAction(draft, action, "forward");
    if (!changed) return false;

    recordCleanRoomObjectAction("entity", action);
    return true;
  };

  const handleCleanRoomEntityUndo = (draft) => {
    const action = canonicalEntityHistory.popUndo();
    if (!action) return false;
    const changed = applyCleanRoomEntityHistoryAction(draft, action, "backward");
    if (!changed) return false;
    canonicalEntityHistory.pushRedo(action);
    return true;
  };

  const handleCleanRoomEntityRedo = (draft) => {
    const action = canonicalEntityHistory.popRedo();
    if (!action) return false;
    const changed = applyCleanRoomEntityHistoryAction(draft, action, "forward");
    if (!changed) return false;
    canonicalEntityHistory.pushUndo(action);
    return true;
  };

  const getEntityIdsFromSelection = (interaction, entities) => {
    const selectedIds = Array.isArray(interaction.selectedEntityIds)
      ? interaction.selectedEntityIds.filter((entityId) => typeof entityId === "string" && entityId.trim())
      : [];
    if (selectedIds.length) {
      return selectedIds;
    }

    return getSelectedEntityIndices(interaction)
      .map((index) => getEntityIdAtIndex(entities, index))
      .filter(Boolean);
  };

  const reconcileEntitySelectionState = (draft, options = {}) => {
    const entities = draft.document.active?.entities || [];
    const selectionIds = Array.isArray(options.selectedIds)
      ? options.selectedIds
      : getEntityIdsFromSelection(draft.interaction, entities);
    const fallbackPrimaryId = getEntityIdAtIndex(entities, draft.interaction.selectedEntityIndex);
    const primaryId = typeof options.primaryId === "string"
      ? options.primaryId
      : draft.interaction.selectedEntityId || fallbackPrimaryId;

    setEntitySelectionByIds(draft, selectionIds, primaryId);

    const selectedEntity = draft.interaction.selectedEntityId
      ? entities.find((entity) => entity?.id === draft.interaction.selectedEntityId) || null
      : null;
    draft.interaction.selectedCell = selectedEntity ? { x: selectedEntity.x, y: selectedEntity.y } : null;

    if (options.clearHoverCell ?? true) {
      draft.interaction.hoverCell = null;
    }

    if (options.clearHover ?? true) {
      draft.interaction.hoveredEntityIndex = null;
      draft.interaction.hoveredEntityId = null;
    } else {
      const hoveredId = typeof options.hoveredEntityId === "string"
        ? options.hoveredEntityId
        : draft.interaction.hoveredEntityId || getEntityIdAtIndex(entities, draft.interaction.hoveredEntityIndex);
      const hoveredIndex = hoveredId ? entities.findIndex((entity) => entity?.id === hoveredId) : -1;
      draft.interaction.hoveredEntityIndex = hoveredIndex >= 0 ? hoveredIndex : null;
      draft.interaction.hoveredEntityId = hoveredIndex >= 0 ? hoveredId : null;
    }

    if (options.clearDrag ?? true) {
      draft.interaction.entityDrag = null;
    }
  };

  const selectEntitiesByIds = (draft, ids = [], primaryId = null, options = {}) => {
    if (!options.preserveCanvasTarget) {
      applyCanvasTarget(draft, "entity");
    }
    reconcileEntitySelectionState(draft, {
      selectedIds: ids,
      primaryId,
      clearHover: options.clearHover ?? true,
      clearHoverCell: options.clearHoverCell ?? true,
      hoveredEntityId: options.hoveredEntityId ?? null,
      clearDrag: options.clearDrag ?? true,
    });
  };

  const clearEntityMutationTransientState = (draft, reason = "entity mutation") => {
    draft.interaction.hoveredEntityIndex = null;
    draft.interaction.hoveredEntityId = null;
    draft.interaction.entityDrag = null;
    draft.interaction.boxSelection = null;
    draft.interaction.hoverCell = null;
    draft.interaction.selectedCell = null;
    suppressObjectPlacementPreviews(draft, reason);
  };

  const finalizeEntityMutationState = (draft, selection = {}, reason = "entity mutation") => {
    clearEntityMutationTransientState(draft, reason);
    setEntitySelectionByIds(draft, selection.entityIds || [], selection.entityPrimaryId ?? null);
    updateEntitySelectionCell(draft);
    reconcileCanvasHoverState(draft, reason);
  };

  const setDecorSelectionByIds = (draft, ids = [], primaryId = null) => {
    const decorItems = draft.document.active?.decor || [];
    const resolved = getObjectIndicesByIds(decorItems, ids);
    const nextPrimaryId = resolved.ids.includes(primaryId) ? primaryId : resolved.ids.at(-1) ?? null;
    setDecorSelection(draft.interaction, resolved.ids, nextPrimaryId, decorItems);
    draft.interaction.selectedDecorIds = resolved.ids;
    draft.interaction.selectedDecorId = nextPrimaryId;
  };

  const selectDecorByIds = (draft, ids = [], primaryId = null, options = {}) => {
    applyCanvasTarget(draft, "decor");
    setDecorSelectionByIds(draft, ids, primaryId);
    setHoveredDecor(draft, options.clearHover === false ? options.hoveredDecorId ?? null : null);
    draft.interaction.decorDrag = null;
    draft.interaction.decorScatterDrag = null;
    updateDecorSelectionCell(draft);
    if (!draft.interaction.selectedDecorIds?.length) {
      draft.interaction.selectedCell = null;
      if (options.clearHoverCell ?? true) {
        draft.interaction.hoverCell = null;
      }
    }
  };

  const setHoveredDecor = (draft, decorRef = null) => {
    const decorItems = draft.document.active?.decor || [];
    const index = typeof decorRef === "string"
      ? getDecorIndexById(decorItems, decorRef)
      : Number.isInteger(decorRef)
        ? decorRef
        : null;
    const decor = Number.isInteger(index) && index >= 0 && index < decorItems.length ? decorItems[index] : null;
    draft.interaction.hoveredDecorIndex = decor ? index : null;
    draft.interaction.hoveredDecorId = decor?.id || null;
  };

  const clearObjectLayerTransientInteractionState = (draft, reason = "object mutation") => {
    draft.interaction.hoverCell = null;
    draft.interaction.boxSelection = null;
    draft.interaction.entityDrag = null;
    draft.interaction.decorDrag = null;
    draft.interaction.soundDrag = null;
    draft.interaction.decorScatterDrag = null;
    draft.interaction.hoveredEntityIndex = null;
    draft.interaction.hoveredEntityId = null;
    draft.interaction.hoveredDecorIndex = null;
    draft.interaction.hoveredDecorId = null;
    clearHoveredSound(draft.interaction);
    clearSoundPreviewState(draft);
    soundPreviewPlayback.stop();
    suppressObjectPlacementPreviews(draft, reason);
  };

  const captureDecorInteractionSnapshot = (draft) =>
    captureIdObjectInteractionSnapshot({
      selectedIds: draft.interaction.selectedDecorIds,
      primarySelectedId: draft.interaction.selectedDecorId,
      hoveredId: draft.interaction.hoveredDecorId,
      drag: draft.interaction.decorDrag,
    });

  const reconcileDecorInteractionState = (draft, snapshot = null, options = {}) => {
    const decorItems = draft.document.active?.decor || [];
    const reconciled = reconcileIdObjectInteraction(decorItems, snapshot || captureDecorInteractionSnapshot(draft), options);
    setDecorSelection(draft.interaction, reconciled.selectedIds, reconciled.primarySelectedId, decorItems);
    setHoveredDecor(draft, reconciled.hoveredId);
    draft.interaction.decorDrag = reconciled.drag
      ? {
        active: true,
        leadDecorId: reconciled.drag.leadSoundId,
        anchorCell: reconciled.drag.anchorCell,
        previewDelta: reconciled.drag.previewDelta,
        originPositions: (reconciled.drag.originPositions || []).map((origin) => ({
          decorId: origin.soundId,
          x: origin.x,
          y: origin.y,
        })),
      }
      : null;
    updateDecorSelectionCell(draft, getPrimarySelectedDecorIndex(draft.interaction, decorItems));
  };

  const syncCleanRoomDecorSelection = (draft, selectedDecorId = null) => {
    applyCanvasTarget(draft, "decor");
    draft.interaction.decorDrag = null;
    draft.interaction.decorScatterDrag = null;
    draft.interaction.hoveredDecorIndex = null;
    draft.interaction.hoveredDecorId = null;

    if (typeof selectedDecorId === "string" && selectedDecorId.trim()) {
      selectDecorByIds(draft, [selectedDecorId], selectedDecorId, {
        clearHover: true,
        clearHoverCell: true,
      });
      return;
    }

    setDecorSelectionByIds(draft, [], null);
    draft.interaction.selectedCell = null;
    draft.interaction.hoverCell = null;
  };

  const applyCleanRoomDecorHistoryAction = (draft, action, direction) => {
    const doc = draft.document.active;
    if (!doc || !action) return false;

    const result = applyCanonicalDecorAction(doc, action, direction);
    if (!result.changed) return false;

    syncCleanRoomDecorSelection(draft, result.selectedDecorId);
    clearEntitySelection(draft.interaction);
    clearSoundSelection(draft.interaction);
    draft.interaction.hoveredEntityIndex = null;
    draft.interaction.hoveredEntityId = null;
    clearHoveredSound(draft.interaction);
    draft.interaction.entityDrag = null;
    draft.interaction.soundDrag = null;
    return true;
  };

  const applyObjectLayerMutationSelection = (draft, selection = {}) => {
    setEntitySelectionByIds(draft, selection.entityIds || [], selection.entityPrimaryId ?? null);
    setDecorSelectionByIds(draft, selection.decorIds || [], selection.decorPrimaryId ?? null);
    setSoundSelectionByIds(draft, selection.soundIds || [], selection.soundPrimaryId ?? null);

    if (draft.interaction.selectedEntityIds?.length) {
      reconcileEntitySelectionState(draft, {
        clearHover: true,
        clearHoverCell: true,
        clearDrag: true,
      });
      return;
    }
    if (draft.interaction.selectedDecorIds?.length) {
      reconcileDecorInteractionState(draft, null, {
        clearHover: true,
        clearDrag: true,
      });
      return;
    }
    if (draft.interaction.selectedSoundIds?.length) {
      updateSoundSelectionCell(draft);
      return;
    }
    draft.interaction.selectedCell = null;
  };

  const reconcileObjectLayerMutationState = (draft, selection = {}, reason = "object mutation") => {
    clearObjectLayerTransientInteractionState(draft, reason);
    applyObjectLayerMutationSelection(draft, selection);
  };

  const clearHoveredSound = (interaction) => {
    interaction.hoveredSoundIndex = null;
    interaction.hoveredSoundId = null;
  };

  const setHoveredSound = (draft, soundRef) => {
    const sounds = draft.document.active?.sounds || [];
    const index = typeof soundRef === "string" ? getSoundIndexById(sounds, soundRef) : Number.isInteger(soundRef) ? soundRef : null;
    const sound = Number.isInteger(index) && index >= 0 && index < sounds.length ? sounds[index] : null;
    draft.interaction.hoveredSoundIndex = sound ? index : null;
    draft.interaction.hoveredSoundId = sound?.id || null;
  };

  const setSoundSelectionByIds = (draft, ids = [], primaryId = null) => {
    const sounds = draft.document.active?.sounds || [];
    const resolved = getObjectIndicesByIds(sounds, ids);
    const nextPrimaryId = resolved.ids.includes(primaryId) ? primaryId : resolved.ids.at(-1) ?? null;
    setSoundSelection(draft.interaction, resolved.ids, nextPrimaryId, sounds);
    draft.interaction.selectedSoundIds = resolved.ids;
    draft.interaction.selectedSoundId = nextPrimaryId;
  };

  const selectSoundByIds = (draft, ids = [], primaryId = null, options = {}) => {
    applyCanvasTarget(draft, "sound");
    setSoundSelectionByIds(draft, ids, primaryId);
    setHoveredSound(draft, options.clearHover === false ? options.hoveredSoundId ?? null : null);
    draft.interaction.soundDrag = null;
    updateSoundSelectionCell(draft, getPrimarySelectedSoundIndex(draft.interaction, draft.document.active?.sounds || []));
    if (!draft.interaction.selectedSoundIds?.length) {
      draft.interaction.selectedCell = null;
      if (options.clearHoverCell ?? true) {
        draft.interaction.hoverCell = null;
      }
    }
  };

  const syncCleanRoomSoundSelection = (draft, selectedSoundIds = [], selectedSoundId = null) => {
    applyCanvasTarget(draft, "sound");
    draft.interaction.soundDrag = null;
    clearHoveredSound(draft.interaction);

    if (Array.isArray(selectedSoundIds) && selectedSoundIds.length) {
      selectSoundByIds(draft, selectedSoundIds, selectedSoundId, {
        clearHover: true,
        clearHoverCell: true,
      });
      return;
    }

    setSoundSelectionByIds(draft, [], null);
    draft.interaction.selectedCell = null;
    draft.interaction.hoverCell = null;
  };

  const applyCleanRoomSoundHistoryAction = (draft, action, direction) => {
    const doc = draft.document.active;
    if (!doc || !action) return false;

    const result = applyCanonicalSoundAction(doc, action, direction);
    if (!result.changed) return false;

    syncCleanRoomSoundSelection(draft, result.selectedSoundIds, result.selectedSoundId);
    clearEntitySelection(draft.interaction);
    clearDecorSelection(draft.interaction);
    draft.interaction.hoveredEntityIndex = null;
    draft.interaction.hoveredEntityId = null;
    draft.interaction.hoveredDecorIndex = null;
    draft.interaction.hoveredDecorId = null;
    draft.interaction.entityDrag = null;
    draft.interaction.decorDrag = null;
    draft.interaction.decorScatterDrag = null;
    clearSoundPreviewState(draft);
    soundPreviewPlayback.stop();
    return true;
  };

  const handleCleanRoomSoundUndo = (draft) => {
    const action = canonicalSoundHistory.popUndo();
    if (!action) return false;
    const changed = applyCleanRoomSoundHistoryAction(draft, action, "backward");
    if (!changed) return false;
    canonicalSoundHistory.pushRedo(action);
    return true;
  };

  const handleCleanRoomSoundRedo = (draft) => {
    const action = canonicalSoundHistory.popRedo();
    if (!action) return false;
    const changed = applyCleanRoomSoundHistoryAction(draft, action, "forward");
    if (!changed) return false;
    canonicalSoundHistory.pushUndo(action);
    return true;
  };

  const captureSoundInteractionSnapshot = (draft) =>
    captureIdObjectInteractionSnapshot({
      selectedIds: draft.interaction.selectedSoundIds,
      primarySelectedId: draft.interaction.selectedSoundId,
      hoveredId: draft.interaction.hoveredSoundId,
      drag: draft.interaction.soundDrag,
    });

  const suppressObjectPlacementPreviews = (draft, reason = "unspecified") => {
    const beforeSnapshot = createSoundDebugSnapshot(draft);
    draft.interaction.objectPlacementPreviewSuppressed = true;
    const afterSnapshot = createSoundDebugSnapshot(draft);
    if (beforeSnapshot.objectPlacementPreviewSuppressed !== afterSnapshot.objectPlacementPreviewSuppressed) {
      appendSoundDebugEvent("object placement preview suppression", reason, beforeSnapshot, afterSnapshot);
    }
  };

  const resumeObjectPlacementPreviews = (draft, reason = "unspecified") => {
    const beforeSnapshot = createSoundDebugSnapshot(draft);
    draft.interaction.objectPlacementPreviewSuppressed = false;
    const afterSnapshot = createSoundDebugSnapshot(draft);
    if (beforeSnapshot.objectPlacementPreviewSuppressed !== afterSnapshot.objectPlacementPreviewSuppressed) {
      appendSoundDebugEvent("object placement preview unsuppressed", reason, beforeSnapshot, afterSnapshot);
    }
  };

  const reconcileSoundInteractionState = (draft, snapshot = null, options = {}) => {
    const sounds = draft.document.active?.sounds || [];
    const reconciled = reconcileIdObjectInteraction(sounds, snapshot || captureSoundInteractionSnapshot(draft), options);
    setSoundSelection(draft.interaction, reconciled.selectedIds, reconciled.primarySelectedId, sounds);
    draft.interaction.hoveredSoundIndex = reconciled.hoveredIndex;
    draft.interaction.hoveredSoundId = reconciled.hoveredId;
    draft.interaction.soundDrag = reconciled.drag;

    const previewSoundId = typeof draft.soundPreview?.soundId === "string" && draft.soundPreview.soundId.trim()
      ? draft.soundPreview.soundId
      : null;
    if (previewSoundId) {
      const previewIndex = getSoundIndexById(sounds, previewSoundId);
      if (Number.isInteger(previewIndex)) {
        draft.soundPreview.soundIndex = previewIndex;
      } else {
        clearSoundPreviewState(draft);
        soundPreviewPlayback.stop();
      }
    } else if (Number.isInteger(draft.soundPreview?.soundIndex)) {
      clearSoundPreviewState(draft);
      soundPreviewPlayback.stop();
    }

    updateSoundSelectionCell(draft);
  };

  const trackCanvasPointerEvent = (event, inside = true) => {
    interactionState.lastCanvasPointer = {
      clientX: Number.isFinite(event?.clientX) ? event.clientX : null,
      clientY: Number.isFinite(event?.clientY) ? event.clientY : null,
      inside,
    };
  };

  const clearTrackedCanvasPointer = () => {
    interactionState.lastCanvasPointer = {
      clientX: null,
      clientY: null,
      inside: false,
    };
  };

  const getTrackedCanvasPoint = () => {
    const pointer = interactionState.lastCanvasPointer;
    if (!pointer?.inside || !Number.isFinite(pointer.clientX) || !Number.isFinite(pointer.clientY)) return null;

    const rect = canvas.getBoundingClientRect();
    const point = {
      x: pointer.clientX - rect.left,
      y: pointer.clientY - rect.top,
    };
    const isInsideCanvas =
      point.x >= 0 &&
      point.y >= 0 &&
      point.x <= rect.width &&
      point.y <= rect.height;
    return isInsideCanvas ? point : null;
  };

  const reconcileCanvasHoverState = (draft, reason = "reconcile") => {
    const doc = draft.document.active;
    if (!doc) return;
    const beforeSnapshot = createSoundDebugSnapshot(draft);

    const point = getTrackedCanvasPoint();
    syncPausedScanHover(draft, point);
    if (!point) {
      draft.interaction.hoverCell = null;
      draft.interaction.hoveredEntityIndex = null;
      draft.interaction.hoveredEntityId = null;
      setHoveredDecor(draft, null);
      clearHoveredSound(draft.interaction);
      const afterSnapshot = createSoundDebugSnapshot(draft);
      if (formatSoundDebugSnapshot(beforeSnapshot) !== formatSoundDebugSnapshot(afterSnapshot)) {
        appendSoundDebugEvent("hover recompute", `${reason} · pointer outside canvas`, beforeSnapshot, afterSnapshot);
      }
      return;
    }

    draft.interaction.hoverCell = getCellFromCanvasPoint(doc, draft.viewport, point.x, point.y);
    const hoveredEntityIndex = findEntityAtCanvasPoint(doc, draft.viewport, point.x, point.y);
    const hoveredDecorIndex = findDecorAtCanvasPoint(doc, draft.viewport, point.x, point.y);
    const hoveredSoundIndex = findSoundAtCanvasPoint(doc, draft.viewport, point.x, point.y);
    draft.interaction.hoveredEntityIndex = hoveredEntityIndex >= 0 ? hoveredEntityIndex : null;
    draft.interaction.hoveredEntityId = hoveredEntityIndex >= 0 ? getEntityIdAtIndex(doc.entities || [], hoveredEntityIndex) : null;
    setHoveredDecor(draft, hoveredDecorIndex >= 0 ? hoveredDecorIndex : null);
    setHoveredSound(draft, hoveredSoundIndex >= 0 ? hoveredSoundIndex : null);
    const afterSnapshot = createSoundDebugSnapshot(draft);
    if (formatSoundDebugSnapshot(beforeSnapshot) !== formatSoundDebugSnapshot(afterSnapshot)) {
      appendSoundDebugEvent("hover recompute", `${reason} · hover targets refreshed`, beforeSnapshot, afterSnapshot);
    }
  };

  const getObjectHistorySelection = (entry, direction) => {
    const shouldSelect = (mode) => {
      if (mode === "update") return true;
      if (direction === "undo") return mode === "delete";
      return mode === "create";
    };

    const collectSelectedIds = (kind) => {
      const ids = [];
      collectHistoryEntries(entry, (edit) => {
        if (edit?.kind !== kind || !shouldSelect(edit.mode)) return;
        const objectId = edit.objectId
          || edit.entity?.id
          || edit.decor?.id
          || edit.sound?.id
          || edit.previousEntity?.id
          || edit.nextEntity?.id
          || edit.previousDecor?.id
          || edit.nextDecor?.id
          || edit.previousSound?.id
          || edit.nextSound?.id
          || null;
        if (typeof objectId === "string" && objectId.trim()) {
          ids.push(objectId);
        }
      });
      return [...new Set(ids)];
    };

    const entityIds = collectSelectedIds("entity");
    const decorIds = collectSelectedIds("decor");
    const soundIds = collectSelectedIds("sound");
    return {
      entityIds,
      entityPrimaryId: entityIds.at(-1) ?? null,
      decorIds,
      decorPrimaryId: decorIds.at(-1) ?? null,
      soundIds,
      soundPrimaryId: soundIds.at(-1) ?? null,
    };
  };

  const applyHistoryObjectMutationState = (draft, entry, direction) => {
    if (!historyEntryContainsObjectLayer(entry)) return;
    if (historyEntryContainsEntity(entry) && !historyEntryContainsDecor(entry) && !historyEntryContainsSound(entry)) {
      finalizeEntityMutationState(draft, getObjectHistorySelection(entry, direction), `entity history ${direction}`);
      return;
    }
    reconcileObjectLayerMutationState(draft, getObjectHistorySelection(entry, direction), `history ${direction}`);
  };

  const isTopBarInputElement = (value) =>
    typeof HTMLInputElement !== "undefined" && value instanceof HTMLInputElement;

  const captureFocusedTopBarField = () => {
    const activeElement = document.activeElement;
    if (!isTopBarInputElement(activeElement)) return null;
    if (!topBar.contains(activeElement)) return null;

    const datasetKeys = [
      "exportMetaField",
      "exportDimensionField",
      "workspaceField",
      "backgroundField",
      "backgroundIndex",
      "gridField",
      "previewField",
    ];
    const dataset = {};
    let hasDataset = false;

    for (const key of datasetKeys) {
      const value = activeElement.dataset[key];
      if (typeof value !== "string") continue;
      dataset[key] = value;
      hasDataset = true;
    }

    if (!hasDataset) return null;

    return {
      dataset,
      selectionStart: activeElement.selectionStart,
      selectionEnd: activeElement.selectionEnd,
      selectionDirection: activeElement.selectionDirection,
    };
  };

  const restoreFocusedTopBarField = (snapshot) => {
    if (!snapshot) return;

    const selector = Object.entries(snapshot.dataset)
      .map(([key, value]) => `[data-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}="${CSS.escape(value)}"]`)
      .join("");
    if (!selector) return;

    const replacementInput = topBar.querySelector(selector);
    if (!isTopBarInputElement(replacementInput)) return;

    replacementInput.focus({ preventScroll: true });
    if (snapshot.selectionStart === null || snapshot.selectionEnd === null) return;

    const clampedStart = Math.max(0, Math.min(snapshot.selectionStart, replacementInput.value.length));
    const clampedEnd = Math.max(0, Math.min(snapshot.selectionEnd, replacementInput.value.length));
    replacementInput.setSelectionRange(clampedStart, clampedEnd, snapshot.selectionDirection || "none");
  };

  const getNextStringId = (items, field, fallbackPrefix) => {
    const takenIds = new Set(
      items
        .map((item) => item?.[field])
        .filter((value) => typeof value === "string" && value.trim()),
    );
    const prefix = typeof fallbackPrefix === "string" && fallbackPrefix.trim() ? fallbackPrefix.trim() : field;
    let nextNumber = items.length + 1;

    while (takenIds.has(`${prefix}-${nextNumber}`)) {
      nextNumber += 1;
    }

    return `${prefix}-${nextNumber}`;
  };

  const clearDecorScatterDrag = (draft) => {
    draft.interaction.decorScatterDrag = null;
  };

  const setCanvasSelectionMode = (draft, mode) => {
    draft.interaction.canvasSelectionMode = mode === "decor" ? "decor" : mode === "sound" ? "sound" : "entity";
  };

  const openLayerSection = (draft, layer) => {
    if (!draft.ui.panelSections) return;
    if (layer === PANEL_LAYERS.BACKGROUND) draft.ui.panelSections.background = true;
    if (layer === PANEL_LAYERS.TILES) draft.ui.panelSections.tiles = true;
    if (layer === PANEL_LAYERS.ENTITIES) draft.ui.panelSections.entities = true;
    if (layer === PANEL_LAYERS.DECOR) draft.ui.panelSections.decor = true;
    if (layer === PANEL_LAYERS.SOUND) draft.ui.panelSections.sound = true;
  };

  const setActiveLayer = (draft, layer) => {
    draft.interaction.activeLayer = layer === PANEL_LAYERS.BACKGROUND
      ? PANEL_LAYERS.BACKGROUND
      : layer === PANEL_LAYERS.DECOR
      ? PANEL_LAYERS.DECOR
      : layer === PANEL_LAYERS.ENTITIES
        ? PANEL_LAYERS.ENTITIES
        : layer === PANEL_LAYERS.SOUND
          ? PANEL_LAYERS.SOUND
          : PANEL_LAYERS.TILES;
    openLayerSection(draft, draft.interaction.activeLayer);
  };

  const renderTopBar = (state) => {
    const focusedTopBarField = captureFocusedTopBarField();
    const activeLayer = getActiveLayer(state.interaction);
    const selectedCount = activeLayer === PANEL_LAYERS.DECOR
      ? getSelectedDecorIndices(state.interaction, state.document.active?.decor || []).length
      : activeLayer === PANEL_LAYERS.ENTITIES
        ? getSelectedEntityIndices(state.interaction).length
        : activeLayer === PANEL_LAYERS.SOUND
          ? getSelectedSoundIndices(state.interaction).length
          : 0;
    const activeSelectionLabel = activeLayer === PANEL_LAYERS.BACKGROUND ? "Background" : activeLayer === PANEL_LAYERS.DECOR ? "Decor" : activeLayer === PANEL_LAYERS.ENTITIES ? "Entities" : activeLayer === PANEL_LAYERS.SOUND ? "Sound" : "Tiles";
    const statusLabel = state.ui.importStatus || `Layer: ${activeSelectionLabel} · ${selectedCount || 0} selected`;

    topBarStatus.textContent = statusLabel;
    topBarStatus.dataset.target = activeLayer;

    const undoEnabled = canUndoGlobalHistory(globalHistoryTimeline) || canUndo(state.history);
    const redoEnabled = canRedoGlobalHistory(globalHistoryTimeline) || canRedo(state.history);
    const exportEnabled = Boolean(state.document.active);

    const actionButtons = topBar.querySelectorAll("[data-topbar-action]");
    actionButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const action = button.dataset.topbarAction;
      if (action === "undo") button.disabled = !undoEnabled;
      if (action === "redo") button.disabled = !redoEnabled;
      if (action === "toggle-darkness") {
        const enabled = Boolean(state.ui.darknessPreviewEnabled);
        button.classList.toggle("isActive", enabled);
        button.setAttribute("aria-pressed", enabled ? "true" : "false");
      }
      if (action === "toggle-proximity-overlays") {
        const enabled = state.ui.proximityOverlaysEnabled !== false;
        button.classList.toggle("isActive", enabled);
        button.setAttribute("aria-pressed", enabled ? "true" : "false");
      }
    });

    const exportToggle = topBar.querySelector(`[data-topbar-menu-toggle="export"]`);
    if (exportToggle instanceof HTMLButtonElement) {
      exportToggle.disabled = !exportEnabled;
    }

    topBarExportMenu.innerHTML = renderExportMenu(state);
    topBarSettingsMenu.innerHTML = renderSettingsMenu(state);
    topBarHelpMenu.innerHTML = renderHelpMenu();
    restoreFocusedTopBarField(focusedTopBarField);

    const activeMenu = state.ui.topBarMenu;
    topBar.querySelectorAll("[data-topbar-menu-toggle]").forEach((toggle) => {
      if (!(toggle instanceof HTMLButtonElement)) return;
      const isOpen = toggle.dataset.topbarMenuToggle === activeMenu;
      toggle.classList.toggle("isActive", isOpen);
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    topBarExportMenu.classList.toggle("isOpen", activeMenu === "export");
    topBarSettingsMenu.classList.toggle("isOpen", activeMenu === "settings");
    topBarHelpMenu.classList.toggle("isOpen", activeMenu === "help");
  };

  const renderFloatingPanels = (state) => {
    const focusedField = document.activeElement instanceof HTMLInputElement
      ? document.activeElement.dataset.newLevelField || document.activeElement.dataset.entityParamPath || null
      : null;
    const focusedScope = document.activeElement instanceof HTMLInputElement
      ? (document.activeElement.dataset.newLevelField ? "new-level" : document.activeElement.dataset.entityParamPath ? "fog-workbench" : null)
      : null;
    const selectionStart = focusedField && typeof document.activeElement.selectionStart === "number"
      ? document.activeElement.selectionStart
      : null;
    const selectionEnd = focusedField && typeof document.activeElement.selectionEnd === "number"
      ? document.activeElement.selectionEnd
      : null;
    const selectionDirection = focusedField && typeof document.activeElement.selectionDirection === "string"
      ? document.activeElement.selectionDirection
      : "none";

    const fogWorkbenchModal = getSpecialVolumeWorkbenchModalContent(state);
    const fogWorkbenchLauncher = getSpecialVolumeWorkbenchLauncherContent(state);
    floatingPanelHost.innerHTML = `${renderNewLevelSizePopover(state)}${fogWorkbenchLauncher}${fogWorkbenchModal?.markup || ""}`;
    floatingPanelHost.classList.toggle("hasSpecialVolumeWorkbench", Boolean(fogWorkbenchModal));
    syncFogPreviewMotionLoop();
    syncWaterPreviewMotionLoop();
    syncLavaPreviewMotionLoop();
    syncBubblingLiquidPreviewMotionLoop();

    if (!focusedField) return;
    const nextField = focusedScope === "new-level" && state.ui.newLevelSize?.isOpen
      ? floatingPanelHost.querySelector(`[data-new-level-field="${focusedField}"]`)
      : focusedScope === "fog-workbench" && fogWorkbenchModal
        ? Array.from(floatingPanelHost.querySelectorAll("[data-entity-param-path]"))
          .find((input) => input instanceof HTMLInputElement && input.dataset.entityParamPath === focusedField) || null
        : null;
    if (nextField instanceof HTMLInputElement) {
      nextField.focus({ preventScroll: true });
      if (typeof selectionStart === "number" && typeof selectionEnd === "number") {
        nextField.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
      }
    }
  };

  const stopFogPreviewMotionLoop = () => {
    if (fogPreviewMotion.rafId) {
      globalThis.cancelAnimationFrame(fogPreviewMotion.rafId);
      fogPreviewMotion.rafId = 0;
    }
    fogPreviewMotion.surface = null;
    fogPreviewMotion.canvas = null;
    fogPreviewMotion.ctx = null;
    fogPreviewMotion.lumoSprite = null;
    fogPreviewMotion.field = null;
    fogPreviewMotion.vel = null;
    fogPreviewMotion.sampleCount = 0;
    fogPreviewMotion.lastElapsedMs = undefined;
    fogPreviewMotion.lastLumoX = null;
    fogPreviewMotion.lastDirection = 1;
  };

  const clampFogPreview = (value, min, max) => {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  };

  const smoothFogPreview01 = (value) => {
    const x = clampFogPreview(value, 0, 1);
    return x * x * (3 - (2 * x));
  };

  const normalizeBubblingLiquidDensityPreview = (rawValue, fallback) => {
    const numeric = Number.parseFloat(rawValue || "");
    const resolved = Number.isFinite(numeric) ? numeric : fallback;
    if (!Number.isFinite(resolved)) return 0;
    if (resolved <= 1) return clampFogPreview(resolved * 100, 0, 100);
    return clampFogPreview(resolved, 0, 100);
  };

  const sampleSmookeNoise = (x) => {
    const xi = Math.floor(x);
    const xf = x - xi;
    const hash = (n) => {
      const nn = (n << 13) ^ n;
      return 1 - ((((nn * ((nn * nn * 15731) + 789221)) + 1376312589) & 0x7fffffff) / 1073741824);
    };
    const a = hash(xi);
    const b = hash(xi + 1);
    const u = xf * xf * (3 - (2 * xf));
    return (a * (1 - u)) + (b * u);
  };

  const smookeOrganicMaskAtU = (u, elapsedSeconds, strength, scale, speed) => {
    if (strength <= 0.0001) return 1;
    const x = u * 620;
    const t = elapsedSeconds;
    const p = (x * 0.004 * scale) + (t * (0.10 * speed));
    const n1 = sampleSmookeNoise(p);
    const n2 = sampleSmookeNoise((p * 1.7) + 12.3);
    const n3 = sampleSmookeNoise((p * 0.65) - 7.1);
    const mix = ((n1 * 0.55) + (n2 * 0.30) + (n3 * 0.15)) * 0.5 + 0.5;
    const m = 0.75 + (mix * 0.55);
    return 1 + ((m - 1) * strength);
  };

  const fogPreviewPatrolAtElapsed = (elapsedMs, traverseDurationMs = 9600) => {
    const duration = Number.isFinite(Number(traverseDurationMs)) && Number(traverseDurationMs) > 1200 ? Number(traverseDurationMs) : 9600;
    const halfDuration = duration * 0.5;
    const normalized = ((Math.max(0, Number(elapsedMs) || 0) % duration) + duration) % duration;
    const forward = normalized <= halfDuration;
    const pct = forward
      ? (normalized / halfDuration)
      : 1 - ((normalized - halfDuration) / halfDuration);
    return {
      u: clampFogPreview(pct, 0, 1),
      facing: forward ? 1 : -1,
    };
  };

  const drawFogPreviewCanvas = (elapsedMs) => {
    if (!fogPreviewMotion.surface || !fogPreviewMotion.ctx || !(fogPreviewMotion.field instanceof Float32Array)) return;
    const surfaceDataset = fogPreviewMotion.surface.dataset;
    const ctx2d = fogPreviewMotion.ctx;
    const width = fogPreviewMotion.worldWidth;
    const height = fogPreviewMotion.worldHeight;
    const {
      tileSize,
      floorTopY: floorTop,
      laneStartX,
      laneEndX,
    } = getVolumePreviewEnvironmentMetrics(width, height);
    const terrainTop = Math.max(24, Math.round(height * 0.36));
    const leftBlockInnerX = Math.max(0, laneStartX - tileSize);
    const rightBlockOuterX = Math.min(width, laneEndX + tileSize);

    const soilTile = ensureFogPreviewTileSprite("soil", "../data/assets/tiles/soil_c.png");
    const grassTile = ensureFogPreviewTileSprite("grass", "../data/assets/tiles/grass_bt.png");
    const stoneTile = ensureFogPreviewTileSprite("stone", "../data/assets/tiles/stone_ct.png");

    const density = Number.parseFloat(surfaceDataset.fogSmookeDensity || "") || 0.25;
    const noiseAmount = Number.parseFloat(surfaceDataset.fogSmookeNoise || "") || 0;
    const organicStrength = Number.parseFloat(surfaceDataset.fogSmookeOrganicStrength || "") || 0;
    const organicScale = Number.parseFloat(surfaceDataset.fogSmookeOrganicScale || "") || 1;
    const organicSpeed = Number.parseFloat(surfaceDataset.fogSmookeOrganicSpeed || "") || 1;
    const falloffPx = Number.parseFloat(surfaceDataset.fogPreviewFalloff || "") || 120;
    const thicknessPx = Number.parseFloat(surfaceDataset.fogThickness || "") || 44;
    const liftPx = Number.parseFloat(surfaceDataset.fogLift || "") || 0;

    const topBase = floorTop - liftPx;
    const bottom = floorTop;
    const pxPerCell = (fogPreviewMotion.bandEndX - fogPreviewMotion.bandStartX) / Math.max(1, fogPreviewMotion.sampleCount - 1);
    const falloff = Math.max(10, falloffPx);
    const elapsedSeconds = elapsedMs * 0.001;

    ctx2d.clearRect(0, 0, width, height);
    ctx2d.fillStyle = "#050912";
    ctx2d.fillRect(0, 0, width, height);

    ctx2d.fillStyle = "rgba(8, 14, 26, 0.72)";
    ctx2d.fillRect(0, 0, width, floorTop);

    const drawTiledRect = (image, fallback, x, y, w, h) => {
      if (w <= 0 || h <= 0) return;
      if (image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0) {
        for (let yy = y; yy < y + h; yy += tileSize) {
          for (let xx = x; xx < x + w; xx += tileSize) {
            const drawW = Math.min(tileSize, (x + w) - xx);
            const drawH = Math.min(tileSize, (y + h) - yy);
            ctx2d.drawImage(image, 0, 0, drawW, drawH, xx, yy, drawW, drawH);
          }
        }
        return;
      }
      ctx2d.fillStyle = fallback;
      ctx2d.fillRect(x, y, w, h);
    };

    drawTiledRect(stoneTile, "#6a655e", 0, floorTop, width, tileSize);
    drawTiledRect(soilTile, "#5b3a26", 0, terrainTop, leftBlockInnerX, Math.max(0, floorTop - terrainTop));
    drawTiledRect(soilTile, "#5b3a26", rightBlockOuterX, terrainTop, Math.max(0, width - rightBlockOuterX), Math.max(0, floorTop - terrainTop));
    drawTiledRect(grassTile, "#8ca86f", 0, terrainTop - tileSize, leftBlockInnerX, tileSize);
    drawTiledRect(grassTile, "#8ca86f", rightBlockOuterX, terrainTop - tileSize, Math.max(0, width - rightBlockOuterX), tileSize);
    drawTiledRect(stoneTile, "#66615a", leftBlockInnerX, terrainTop, tileSize, Math.max(0, floorTop - terrainTop));
    drawTiledRect(stoneTile, "#66615a", laneEndX, terrainTop, tileSize, Math.max(0, floorTop - terrainTop));

    ctx2d.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx2d.fillRect(leftBlockInnerX, terrainTop, 1, Math.max(0, floorTop - terrainTop));
    ctx2d.fillRect(laneEndX + tileSize - 1, terrainTop, 1, Math.max(0, floorTop - terrainTop));

    ctx2d.save();
    ctx2d.beginPath();
    ctx2d.rect(laneStartX, 0, laneEndX - laneStartX, floorTop);
    ctx2d.clip();
    ctx2d.globalCompositeOperation = "screen";
    ctx2d.globalAlpha = 0.82;

    const layers = 24;
    for (let li = 0; li < layers; li += 1) {
      const a = li / Math.max(1, layers - 1);
      const yBase = bottom - (a * thicknessPx);
      const sliceAlpha = 1 - a;
      const alphaBase = (density * 0.18) * (0.22 + (sliceAlpha * 0.98));
      if (alphaBase < 0.001) continue;
      ctx2d.beginPath();
      for (let index = 0; index < fogPreviewMotion.sampleCount; index += 1) {
        const x = laneStartX + (index * pxPerCell);
        const dOpen = laneEndX - x;
        const edgeMask = smoothFogPreview01(clampFogPreview(dOpen / falloff, 0, 1));
        let yy = bottom;
        if (edgeMask > 0.0005) {
          const topWeight = smoothFogPreview01(clampFogPreview((0.55 - a) / 0.55, 0, 1));
          const org = smookeOrganicMaskAtU((x - laneStartX) / Math.max(1, laneEndX - laneStartX), elapsedSeconds, organicStrength, organicScale, organicSpeed)
            * (0.70 + (0.30 * topWeight));
          const dev = fogPreviewMotion.field[index];
          const bulge = Math.max(0, dev);
          const suction = Math.max(0, -dev);
          const n = sampleSmookeNoise((index * 0.22) + (elapsedSeconds * (0.95 + (a * 0.85))));
          const wave = noiseAmount * (((n * 0.5) + 0.5) - 0.5) * (10 + ((1 - a) * 18));
          const yyBaseRaw = yBase + wave - (bulge * (10 + ((1 - a) * 30))) + (suction * (8 + ((1 - a) * 20)));
          const yyOrg = bottom - ((bottom - yyBaseRaw) * org);
          const yyBase = Math.min(yyOrg, floorTop - 1);
          yy = bottom - ((bottom - yyBase) * edgeMask);
        }
        if (index === 0) ctx2d.moveTo(x, yy);
        else ctx2d.lineTo(x, yy);
      }
      ctx2d.lineTo(laneEndX, bottom);
      ctx2d.lineTo(laneStartX, bottom);
      ctx2d.closePath();
      ctx2d.fillStyle = `rgba(225,238,255,${alphaBase})`;
      ctx2d.fill();
    }

    ctx2d.globalAlpha *= 0.55;
    ctx2d.strokeStyle = `rgba(210,228,255,${Math.min(0.30, density * 0.35)})`;
    ctx2d.lineWidth = 18;
    ctx2d.lineJoin = "round";
    ctx2d.beginPath();
    for (let index = 0; index < fogPreviewMotion.sampleCount; index += 1) {
      const x = laneStartX + (index * pxPerCell);
      const dOpen = laneEndX - x;
      const edgeMask = smoothFogPreview01(clampFogPreview(dOpen / falloff, 0, 1));
      let yy = bottom;
      if (edgeMask > 0.0005) {
        const org = smookeOrganicMaskAtU((x - laneStartX) / Math.max(1, laneEndX - laneStartX), elapsedSeconds, organicStrength, organicScale, organicSpeed);
        const dev = fogPreviewMotion.field[index];
        const bulge = Math.max(0, dev);
        const suction = Math.max(0, -dev);
        const n = sampleSmookeNoise((index * 0.22) + (elapsedSeconds * 1.05));
        const wave = noiseAmount * (((n * 0.5) + 0.5) - 0.5) * 10;
        const yyBaseRaw = topBase + wave - (bulge * 22) + (suction * 18);
        const yyOrg = bottom - ((bottom - yyBaseRaw) * org);
        const yyBase = Math.min(yyOrg, floorTop - 1);
        yy = bottom - ((bottom - yyBase) * edgeMask);
      }
      if (index === 0) ctx2d.moveTo(x, yy);
      else ctx2d.lineTo(x, yy);
    }
    ctx2d.stroke();
    ctx2d.restore();

    const lumoW = 24;
    const lumoH = 36;
    const lumoX = fogPreviewMotion.lumoX;
    if (fogPreviewMotion.lumoSprite instanceof HTMLImageElement && fogPreviewMotion.lumoSprite.complete && fogPreviewMotion.lumoSprite.naturalWidth > 0) {
      ctx2d.save();
      ctx2d.translate(lumoX, floorTop - 1);
      ctx2d.scale(fogPreviewMotion.lumoDirection, 1);
      ctx2d.drawImage(fogPreviewMotion.lumoSprite, -12, -24, 24, 24);
      ctx2d.restore();
    } else {
      ctx2d.save();
      ctx2d.fillStyle = "rgba(17, 20, 30, 0.28)";
      ctx2d.beginPath();
      ctx2d.ellipse(lumoX, floorTop + 2, lumoW * 0.28, lumoW * 0.12, 0, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.fillStyle = "rgba(223, 214, 200, 0.95)";
      ctx2d.fillRect(lumoX - 10, floorTop - 18, 20, 18);
      ctx2d.fillStyle = "rgba(252, 214, 103, 0.9)";
      ctx2d.fillRect(lumoX - 8, floorTop - 28, 16, 10);
      ctx2d.restore();
    }
  };

  const stepFogPreviewMotion = (timestampMs) => {
    if (!fogPreviewMotion.surface?.isConnected || !fogPreviewMotion.canvas?.isConnected || !(fogPreviewMotion.field instanceof Float32Array) || !(fogPreviewMotion.vel instanceof Float32Array)) {
      stopFogPreviewMotionLoop();
      return;
    }
    if (!fogPreviewMotion.startedAtMs) fogPreviewMotion.startedAtMs = timestampMs;
    const elapsedMs = timestampMs - fogPreviewMotion.startedAtMs;
    const patrol = fogPreviewPatrolAtElapsed(elapsedMs, fogPreviewMotion.durationMs);
    fogPreviewMotion.lumoX = fogPreviewMotion.bandStartX + ((fogPreviewMotion.bandEndX - fogPreviewMotion.bandStartX) * patrol.u);
    {
      const density = Number.parseFloat(fogPreviewMotion.surface.dataset.fogSmookeDensity || "") || 0.25;
      const drift = Number.parseFloat(fogPreviewMotion.surface.dataset.fogSmookeDrift || "") || 0;
      const diffuse = Number.parseFloat(fogPreviewMotion.surface.dataset.fogSmookeDiffuse || "") || 0.2;
      const relax = Number.parseFloat(fogPreviewMotion.surface.dataset.fogSmookeRelax || "") || 0.22;
      const visc = Number.parseFloat(fogPreviewMotion.surface.dataset.fogSmookeVisc || "") || 0.9;
      const gate = Number.parseFloat(fogPreviewMotion.surface.dataset.fogSmookeGate || "") || 70;
      const radiusPx = Number.parseFloat(fogPreviewMotion.surface.dataset.fogSmookeRadius || "") || 92;
      const push = Number.parseFloat(fogPreviewMotion.surface.dataset.fogSmookePush || "") || 2.2;
      const wakeStrength = clampFogPreview(Number.parseFloat(fogPreviewMotion.surface.dataset.fogSmookeWake || "") || 1, 0, 3);
      const bulge = Number.parseFloat(fogPreviewMotion.surface.dataset.fogSmookeBulge || "") || 1.2;
      const lumoU = patrol.u;
      const sampleCount = fogPreviewMotion.sampleCount;
      const field = fogPreviewMotion.field;
      const vel = fogPreviewMotion.vel;
      const dt = Math.min(0.05, fogPreviewMotion.lastElapsedMs === undefined ? (1 / 60) : Math.max(0.001, (elapsedMs - fogPreviewMotion.lastElapsedMs) / 1000));
      fogPreviewMotion.lastElapsedMs = elapsedMs;
      const viscClamped = clampFogPreview(visc, 0.35, 0.995);
      const viscFrameDamping = Math.pow(viscClamped, dt * 60);
      const settleDrag = (1 - viscClamped) * 1.35 * dt * 60;

      for (let index = 1; index < sampleCount - 1; index += 1) {
        const laplacian = field[index - 1] - (2 * field[index]) + field[index + 1];
        vel[index] += laplacian * diffuse * 120 * dt;
      }

      for (let index = 0; index < sampleCount; index += 1) {
        vel[index] += (0 - field[index]) * relax * 120 * dt;
        vel[index] *= viscFrameDamping;
        field[index] += vel[index] * dt;
        field[index] *= Math.max(0, 1 - settleDrag);
        field[index] = clampFogPreview(field[index], -2.2, 2.2);
      }

      const lastLumoX = Number.isFinite(fogPreviewMotion.lastLumoX) ? fogPreviewMotion.lastLumoX : fogPreviewMotion.lumoX;
      const lumoVx = (fogPreviewMotion.lumoX - lastLumoX) / Math.max(0.001, dt);
      const absLumoSpeedPxPerSecond = Math.abs(lumoVx);
      const movementDir = Math.sign(lumoVx) || fogPreviewMotion.lastDirection || patrol.facing || 1;
      fogPreviewMotion.lastDirection = movementDir;
      fogPreviewMotion.lumoDirection = movementDir;
      fogPreviewMotion.lastLumoX = fogPreviewMotion.lumoX;

      if (drift > 0.001) {
        const shift = drift * 0.85 * dt;
        if (Math.abs(shift) > 0.00001) {
          const shifted = new Float32Array(sampleCount);
          for (let index = 0; index < sampleCount; index += 1) {
            const src = index - shift;
            const i0 = Math.floor(src);
            const f = src - i0;
            const a = field[Math.max(0, Math.min(sampleCount - 1, i0))];
            const b = field[Math.max(0, Math.min(sampleCount - 1, i0 + 1))];
            shifted[index] = (a * (1 - f)) + (b * f);
          }
          field.set(shifted);
        }
      }

      if (absLumoSpeedPxPerSecond > gate && density > 0.01) {
        const centerIndex = clampFogPreview(Math.round(lumoU * (sampleCount - 1)), 0, sampleCount - 1);
        const radCells = Math.max(3, Math.floor(radiusPx / Math.max(1, ((fogPreviewMotion.bandEndX - fogPreviewMotion.bandStartX) / Math.max(2, sampleCount - 1)))));
        const dir = movementDir;
        const amp = Math.min(2.6, absLumoSpeedPxPerSecond / 210);
        const aheadOffset = Math.max(2, Math.floor(radCells * 0.35));
        const bulgeCenter = centerIndex + (dir * aheadOffset);
        const behindOffset = Math.max(1, Math.floor(radCells * 0.15));
        const clearCenter = centerIndex - (dir * behindOffset);

        for (let k = -radCells; k <= radCells; k += 1) {
          const i = bulgeCenter + k;
          if (i < 0 || i >= sampleCount) continue;
          const u = (k / radCells) * dir;
          const frontMask = smoothFogPreview01(u + 0.05);
          const q = 1 - (Math.abs(k) / radCells);
          const w = q * q;
          const ridge = bulge * amp * w * (0.18 + (0.82 * frontMask));
          field[i] += ridge * 0.32;
        }
        for (let k = -radCells; k <= radCells; k += 1) {
          const i = clearCenter + k;
          if (i < 0 || i >= sampleCount) continue;
          const u = (k / radCells) * dir;
          const backMask = smoothFogPreview01((-u) + 0.10);
          const q = 1 - (Math.abs(k) / radCells);
          const w = q * q;
          const wake = push * wakeStrength * amp * w * (0.25 + (0.75 * backMask));
          field[i] -= wake * 0.46;
          vel[i] += dir * wake * 0.0022;
        }
      }

    }
    drawFogPreviewCanvas(elapsedMs);
    fogPreviewMotion.rafId = globalThis.requestAnimationFrame(stepFogPreviewMotion);
  };

  const syncFogPreviewMotionLoop = () => {
    const surface = floatingPanelHost.querySelector("[data-fog-preview-surface]");
    const canvasEl = floatingPanelHost.querySelector("[data-fog-preview-canvas]");
    if (!(surface instanceof HTMLElement) || !(canvasEl instanceof HTMLCanvasElement)) {
      stopFogPreviewMotionLoop();
      return;
    }
    const ctx2d = canvasEl.getContext("2d");
    if (!ctx2d) {
      stopFogPreviewMotionLoop();
      return;
    }

    const durationMs = Number.parseFloat(surface.dataset.fogPreviewTraverseMs || "");
    if (fogPreviewMotion.surface === surface && fogPreviewMotion.canvas === canvasEl && fogPreviewMotion.rafId) {
      fogPreviewMotion.durationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 9600;
      return;
    }

    stopFogPreviewMotionLoop();
    fogPreviewMotion.surface = surface;
    fogPreviewMotion.canvas = canvasEl;
    fogPreviewMotion.ctx = ctx2d;
    fogPreviewMotion.worldWidth = canvasEl.width;
    fogPreviewMotion.worldHeight = canvasEl.height;
    const envMetrics = getVolumePreviewEnvironmentMetrics(fogPreviewMotion.worldWidth, fogPreviewMotion.worldHeight);
    fogPreviewMotion.bandStartX = envMetrics.laneStartX;
    fogPreviewMotion.bandEndX = envMetrics.laneEndX;
    fogPreviewMotion.sampleCount = Math.max(260, Math.floor((fogPreviewMotion.bandEndX - fogPreviewMotion.bandStartX) / 1.4));
    fogPreviewMotion.field = new Float32Array(fogPreviewMotion.sampleCount);
    fogPreviewMotion.vel = new Float32Array(fogPreviewMotion.sampleCount);
    fogPreviewMotion.durationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 9600;
    fogPreviewMotion.startedAtMs = 0;
    fogPreviewMotion.lumoX = (fogPreviewMotion.bandStartX + fogPreviewMotion.bandEndX) * 0.5;
    fogPreviewMotion.lumoDirection = 1;
    fogPreviewMotion.lastDirection = 1;
    fogPreviewMotion.lastLumoX = null;
    fogPreviewMotion.distancePerSecond = ((fogPreviewMotion.bandEndX - fogPreviewMotion.bandStartX) * 2) / Math.max(1, fogPreviewMotion.durationMs * 0.001);
    fogPreviewMotion.lastElapsedMs = undefined;

    const lumoSpriteSrc = typeof surface.dataset.fogPreviewLumoSprite === "string" ? surface.dataset.fogPreviewLumoSprite.trim() : "";
    if (lumoSpriteSrc) {
      const sprite = new Image();
      sprite.decoding = "async";
      sprite.src = lumoSpriteSrc;
      fogPreviewMotion.lumoSprite = sprite;
    } else {
      fogPreviewMotion.lumoSprite = null;
    }

    drawFogPreviewCanvas(0);
    fogPreviewMotion.rafId = globalThis.requestAnimationFrame(stepFogPreviewMotion);
  };

  const stopWaterPreviewMotionLoop = () => {
    if (waterPreviewMotion.rafId) {
      globalThis.cancelAnimationFrame(waterPreviewMotion.rafId);
      waterPreviewMotion.rafId = 0;
    }
    waterPreviewMotion.surface = null;
    waterPreviewMotion.canvas = null;
    waterPreviewMotion.ctx = null;
    waterPreviewMotion.lumoSprite = null;
  };

  const drawWaterPreviewCanvas = (elapsedMs) => {
    if (!waterPreviewMotion.surface || !waterPreviewMotion.ctx) return;
    const surfaceDataset = waterPreviewMotion.surface.dataset;
    const ctx2d = waterPreviewMotion.ctx;
    const width = waterPreviewMotion.worldWidth;
    const height = waterPreviewMotion.worldHeight;
    const { tileSize, floorTopY: floorTop, laneStartX, laneEndX } = getVolumePreviewEnvironmentMetrics(width, height);
    const terrainTop = Math.max(24, Math.round(height * 0.36));
    const leftBlockInnerX = Math.max(0, laneStartX - tileSize);
    const rightBlockOuterX = Math.min(width, laneEndX + tileSize);
    const soilTile = ensureFogPreviewTileSprite("soil", "../data/assets/tiles/soil_c.png");
    const grassTile = ensureFogPreviewTileSprite("grass", "../data/assets/tiles/grass_bt.png");
    const stoneTile = ensureFogPreviewTileSprite("stone", "../data/assets/tiles/stone_ct.png");
    const drawTiledRect = (image, fallback, x, y, w, h) => {
      if (w <= 0 || h <= 0) return;
      if (image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0) {
        for (let yy = y; yy < y + h; yy += tileSize) {
          for (let xx = x; xx < x + w; xx += tileSize) {
            const drawW = Math.min(tileSize, (x + w) - xx);
            const drawH = Math.min(tileSize, (y + h) - yy);
            ctx2d.drawImage(image, 0, 0, drawW, drawH, xx, yy, drawW, drawH);
          }
        }
      } else {
        ctx2d.fillStyle = fallback;
        ctx2d.fillRect(x, y, w, h);
      }
    };
    ctx2d.clearRect(0, 0, width, height);
    ctx2d.fillStyle = "#050912";
    ctx2d.fillRect(0, 0, width, height);
    ctx2d.fillStyle = "rgba(8, 14, 26, 0.72)";
    ctx2d.fillRect(0, 0, width, floorTop);
    drawTiledRect(stoneTile, "#6a655e", 0, floorTop, width, tileSize);
    drawTiledRect(soilTile, "#5b3a26", 0, terrainTop, leftBlockInnerX, Math.max(0, floorTop - terrainTop));
    drawTiledRect(soilTile, "#5b3a26", rightBlockOuterX, terrainTop, Math.max(0, width - rightBlockOuterX), Math.max(0, floorTop - terrainTop));
    drawTiledRect(grassTile, "#8ca86f", 0, terrainTop - tileSize, leftBlockInnerX, tileSize);
    drawTiledRect(grassTile, "#8ca86f", rightBlockOuterX, terrainTop - tileSize, Math.max(0, width - rightBlockOuterX), tileSize);
    drawTiledRect(stoneTile, "#66615a", leftBlockInnerX, terrainTop, tileSize, Math.max(0, floorTop - terrainTop));
    drawTiledRect(stoneTile, "#66615a", laneEndX, terrainTop, tileSize, Math.max(0, floorTop - terrainTop));

    const depth = clampFogPreview(Number.parseFloat(surfaceDataset.waterDepth || "") || 96, 24, 164);
    const waveAmount = clampFogPreview(Number.parseFloat(surfaceDataset.waterWaveAmount || "") || 0.35, 0, 1);
    const waveSpeed = clampFogPreview(Number.parseFloat(surfaceDataset.waterWaveSpeed || "") || 0.9, 0.1, 3);
    const topColor = surfaceDataset.waterTopColor || "#4EB8F2";
    const bottomColor = surfaceDataset.waterBottomColor || "#0A4B93";
    const waterTopBase = floorTop - depth;
    const elapsedSec = elapsedMs * 0.001;

    const surfaceSamples = [];
    for (let x = laneStartX; x <= laneEndX; x += 2) {
      const wave = Math.sin((x * 0.028) + (elapsedSec * 1.6 * waveSpeed)) * (2.4 * waveAmount)
        + Math.sin((x * 0.056) + (elapsedSec * 0.86 * waveSpeed) + 1.2) * (1.5 * waveAmount);
      surfaceSamples.push({ x, y: waterTopBase + wave });
    }
    const firstSurfaceSample = surfaceSamples[0];
    const lastSurfaceSample = surfaceSamples[surfaceSamples.length - 1];
    const surfaceCrestY = surfaceSamples.reduce((minY, sample) => Math.min(minY, sample.y), Number.POSITIVE_INFINITY);

    ctx2d.save();
    ctx2d.beginPath();
    ctx2d.rect(laneStartX, waterTopBase - 10, laneEndX - laneStartX, floorTop - waterTopBase + 10);
    ctx2d.clip();

    const bodyGradient = ctx2d.createLinearGradient(0, surfaceCrestY, 0, floorTop);
    bodyGradient.addColorStop(0, topColor);
    bodyGradient.addColorStop(1, bottomColor);
    ctx2d.fillStyle = bodyGradient;
    ctx2d.beginPath();
    ctx2d.moveTo(firstSurfaceSample.x, firstSurfaceSample.y);
    for (let i = 1; i < surfaceSamples.length; i += 1) {
      const sample = surfaceSamples[i];
      ctx2d.lineTo(sample.x, sample.y);
    }
    ctx2d.lineTo(lastSurfaceSample.x, floorTop);
    ctx2d.lineTo(firstSurfaceSample.x, floorTop);
    ctx2d.closePath();
    ctx2d.fill();

    for (let band = 0; band < 6; band += 1) {
      const yRatio = (band + 1) / 7;
      const yBase = waterTopBase + (depth * yRatio);
      ctx2d.beginPath();
      for (let x = laneStartX; x <= laneEndX; x += 5) {
        const nx = ((x - laneStartX) * 0.018) + (elapsedSec * (0.25 + (band * 0.06) * waveSpeed));
        const n = sampleSmookeNoise(nx) * 0.6 + sampleSmookeNoise(nx * 1.83 + 14.1) * 0.4;
        const y = yBase + (n * (2.8 + (waveAmount * 3.5 * (1 - yRatio))));
        if (x === laneStartX) ctx2d.moveTo(x, y);
        else ctx2d.lineTo(x, y);
      }
      ctx2d.strokeStyle = `rgba(179, 226, 255, ${0.05 + ((1 - yRatio) * 0.06)})`;
      ctx2d.lineWidth = 1;
      ctx2d.stroke();
    }

    const seamBlendDepthPx = 4;
    const seamGradient = ctx2d.createLinearGradient(0, surfaceCrestY, 0, surfaceCrestY + seamBlendDepthPx);
    seamGradient.addColorStop(0, "rgba(78, 184, 242, 0.24)");
    seamGradient.addColorStop(1, "rgba(78, 184, 242, 0)");
    ctx2d.fillStyle = seamGradient;
    ctx2d.beginPath();
    ctx2d.moveTo(firstSurfaceSample.x, firstSurfaceSample.y);
    for (let i = 1; i < surfaceSamples.length; i += 1) {
      const sample = surfaceSamples[i];
      ctx2d.lineTo(sample.x, sample.y);
    }
    ctx2d.lineTo(lastSurfaceSample.x, lastSurfaceSample.y + seamBlendDepthPx);
    ctx2d.lineTo(firstSurfaceSample.x, firstSurfaceSample.y + seamBlendDepthPx);
    ctx2d.closePath();
    ctx2d.fill();

    ctx2d.beginPath();
    for (let i = 0; i < surfaceSamples.length; i += 1) {
      const sample = surfaceSamples[i];
      if (i === 0) ctx2d.moveTo(sample.x, sample.y);
      else ctx2d.lineTo(sample.x, sample.y);
    }
    ctx2d.strokeStyle = "rgba(208, 244, 255, 0.95)";
    ctx2d.lineWidth = 1.6;
    ctx2d.stroke();
    ctx2d.restore();

    const lumoX = waterPreviewMotion.lumoX;
    if (waterPreviewMotion.lumoSprite instanceof HTMLImageElement && waterPreviewMotion.lumoSprite.complete && waterPreviewMotion.lumoSprite.naturalWidth > 0) {
      ctx2d.save();
      ctx2d.translate(lumoX, floorTop - 1);
      ctx2d.scale(waterPreviewMotion.lumoDirection, 1);
      ctx2d.drawImage(waterPreviewMotion.lumoSprite, -12, -24, 24, 24);
      ctx2d.restore();
    }
  };

  const stepWaterPreviewMotion = (timestampMs) => {
    if (!waterPreviewMotion.surface?.isConnected || !waterPreviewMotion.canvas?.isConnected || !waterPreviewMotion.ctx) {
      stopWaterPreviewMotionLoop();
      return;
    }
    if (!waterPreviewMotion.startedAtMs) waterPreviewMotion.startedAtMs = timestampMs;
    const elapsedMs = timestampMs - waterPreviewMotion.startedAtMs;
    const patrol = fogPreviewPatrolAtElapsed(elapsedMs, waterPreviewMotion.durationMs);
    waterPreviewMotion.lumoX = waterPreviewMotion.bandStartX + ((waterPreviewMotion.bandEndX - waterPreviewMotion.bandStartX) * patrol.u);
    waterPreviewMotion.lumoDirection = patrol.facing;
    drawWaterPreviewCanvas(elapsedMs);
    waterPreviewMotion.rafId = globalThis.requestAnimationFrame(stepWaterPreviewMotion);
  };

  const syncWaterPreviewMotionLoop = () => {
    const surface = floatingPanelHost.querySelector("[data-water-preview-surface]");
    const canvasEl = floatingPanelHost.querySelector("[data-water-preview-canvas]");
    if (!(surface instanceof HTMLElement) || !(canvasEl instanceof HTMLCanvasElement)) {
      stopWaterPreviewMotionLoop();
      return;
    }
    const ctx2d = canvasEl.getContext("2d");
    if (!ctx2d) {
      stopWaterPreviewMotionLoop();
      return;
    }
    const durationMs = Number.parseFloat(surface.dataset.waterPreviewTraverseMs || "");
    if (waterPreviewMotion.surface === surface && waterPreviewMotion.canvas === canvasEl && waterPreviewMotion.rafId) {
      waterPreviewMotion.durationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 9600;
      return;
    }
    stopWaterPreviewMotionLoop();
    waterPreviewMotion.surface = surface;
    waterPreviewMotion.canvas = canvasEl;
    waterPreviewMotion.ctx = ctx2d;
    waterPreviewMotion.worldWidth = canvasEl.width;
    waterPreviewMotion.worldHeight = canvasEl.height;
    const envMetrics = getVolumePreviewEnvironmentMetrics(waterPreviewMotion.worldWidth, waterPreviewMotion.worldHeight);
    waterPreviewMotion.bandStartX = envMetrics.laneStartX;
    waterPreviewMotion.bandEndX = envMetrics.laneEndX;
    waterPreviewMotion.durationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 9600;
    waterPreviewMotion.startedAtMs = 0;
    waterPreviewMotion.lumoX = (waterPreviewMotion.bandStartX + waterPreviewMotion.bandEndX) * 0.5;
    waterPreviewMotion.lumoDirection = 1;
    const lumoSpriteSrc = typeof surface.dataset.waterPreviewLumoSprite === "string" ? surface.dataset.waterPreviewLumoSprite.trim() : "";
    if (lumoSpriteSrc) {
      const sprite = new Image();
      sprite.decoding = "async";
      sprite.src = lumoSpriteSrc;
      waterPreviewMotion.lumoSprite = sprite;
    } else {
      waterPreviewMotion.lumoSprite = null;
    }
    drawWaterPreviewCanvas(0);
    waterPreviewMotion.rafId = globalThis.requestAnimationFrame(stepWaterPreviewMotion);
  };

  const stopLavaPreviewMotionLoop = () => {
    if (lavaPreviewMotion.rafId) {
      globalThis.cancelAnimationFrame(lavaPreviewMotion.rafId);
      lavaPreviewMotion.rafId = 0;
    }
    lavaPreviewMotion.surface = null;
    lavaPreviewMotion.canvas = null;
    lavaPreviewMotion.ctx = null;
    lavaPreviewMotion.lumoSprite = null;
  };

  const drawLavaPreviewCanvas = (elapsedMs) => {
    if (!lavaPreviewMotion.surface || !lavaPreviewMotion.ctx) return;
    const surfaceDataset = lavaPreviewMotion.surface.dataset;
    const ctx2d = lavaPreviewMotion.ctx;
    const width = lavaPreviewMotion.worldWidth;
    const height = lavaPreviewMotion.worldHeight;
    const { tileSize, floorTopY: floorTop, laneStartX, laneEndX } = getVolumePreviewEnvironmentMetrics(width, height);
    const terrainTop = Math.max(24, Math.round(height * 0.36));
    const leftBlockInnerX = Math.max(0, laneStartX - tileSize);
    const rightBlockOuterX = Math.min(width, laneEndX + tileSize);
    const soilTile = ensureFogPreviewTileSprite("soil", "../data/assets/tiles/soil_c.png");
    const grassTile = ensureFogPreviewTileSprite("grass", "../data/assets/tiles/grass_bt.png");
    const stoneTile = ensureFogPreviewTileSprite("stone", "../data/assets/tiles/stone_ct.png");
    const drawTiledRect = (image, fallback, x, y, w, h) => {
      if (w <= 0 || h <= 0) return;
      if (image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0) {
        for (let yy = y; yy < y + h; yy += tileSize) {
          for (let xx = x; xx < x + w; xx += tileSize) {
            const drawW = Math.min(tileSize, (x + w) - xx);
            const drawH = Math.min(tileSize, (y + h) - yy);
            ctx2d.drawImage(image, 0, 0, drawW, drawH, xx, yy, drawW, drawH);
          }
        }
      } else {
        ctx2d.fillStyle = fallback;
        ctx2d.fillRect(x, y, w, h);
      }
    };

    ctx2d.clearRect(0, 0, width, height);
    ctx2d.fillStyle = "#050912";
    ctx2d.fillRect(0, 0, width, height);
    ctx2d.fillStyle = "rgba(8, 14, 26, 0.72)";
    ctx2d.fillRect(0, 0, width, floorTop);
    drawTiledRect(stoneTile, "#6a655e", 0, floorTop, width, tileSize);
    drawTiledRect(soilTile, "#5b3a26", 0, terrainTop, leftBlockInnerX, Math.max(0, floorTop - terrainTop));
    drawTiledRect(soilTile, "#5b3a26", rightBlockOuterX, terrainTop, Math.max(0, width - rightBlockOuterX), Math.max(0, floorTop - terrainTop));
    drawTiledRect(grassTile, "#8ca86f", 0, terrainTop - tileSize, leftBlockInnerX, tileSize);
    drawTiledRect(grassTile, "#8ca86f", rightBlockOuterX, terrainTop - tileSize, Math.max(0, width - rightBlockOuterX), tileSize);
    drawTiledRect(stoneTile, "#66615a", leftBlockInnerX, terrainTop, tileSize, Math.max(0, floorTop - terrainTop));
    drawTiledRect(stoneTile, "#66615a", laneEndX, terrainTop, tileSize, Math.max(0, floorTop - terrainTop));

    const depth = clampFogPreview(Number.parseFloat(surfaceDataset.lavaDepth || "") || 88, 24, 164);
    const flowSpeed = clampFogPreview(Number.parseFloat(surfaceDataset.lavaFlowSpeed || "") || 0.55, 0.1, 1.4);
    const temperature = clampFogPreview(Number.parseFloat(surfaceDataset.lavaTemperature || "") || 0.72, 0.2, 1);
    const crustAmount = clampFogPreview(Number.parseFloat(surfaceDataset.lavaCrustAmount || "") || 45, 0, 100);
    const crustDensity = crustAmount / 100;
    const lavaTopBase = floorTop - depth;
    const elapsedSec = elapsedMs * 0.001;
    const glowBoost = 0.55 + (temperature * 0.65);

    const surfaceSamples = [];
    for (let x = laneStartX; x <= laneEndX; x += 2) {
      const bulge = Math.sin((x * 0.018) + (elapsedSec * 0.2 * flowSpeed)) * (2.6 + (temperature * 1.2));
      const sag = Math.sin((x * 0.033) + (elapsedSec * 0.11 * flowSpeed) + 1.2) * 1.7;
      const denseWarp = sampleSmookeNoise((x * 0.009) + (elapsedSec * 0.12 * flowSpeed)) * 2.4;
      surfaceSamples.push({ x, y: lavaTopBase + bulge + sag + denseWarp });
    }
    const sampleSurfaceYAtX = (targetX) => {
      if (!surfaceSamples.length) return lavaTopBase;
      if (targetX <= surfaceSamples[0].x) return surfaceSamples[0].y;
      for (let i = 1; i < surfaceSamples.length; i += 1) {
        const left = surfaceSamples[i - 1];
        const right = surfaceSamples[i];
        if (targetX <= right.x) {
          const span = Math.max(0.0001, right.x - left.x);
          const t = (targetX - left.x) / span;
          return left.y + ((right.y - left.y) * t);
        }
      }
      return surfaceSamples[surfaceSamples.length - 1].y;
    };
    const firstSurfaceSample = surfaceSamples[0];
    const lastSurfaceSample = surfaceSamples[surfaceSamples.length - 1];
    const surfaceCrestY = surfaceSamples.reduce((minY, sample) => Math.min(minY, sample.y), Number.POSITIVE_INFINITY);
    const surfaceTroughY = surfaceSamples.reduce((maxY, sample) => Math.max(maxY, sample.y), Number.NEGATIVE_INFINITY);
    const laneWidth = Math.max(1, laneEndX - laneStartX);

    ctx2d.save();
    ctx2d.beginPath();
    ctx2d.rect(laneStartX, lavaTopBase - 30, laneEndX - laneStartX, floorTop - lavaTopBase + 34);
    ctx2d.clip();

    const bodyGradient = ctx2d.createLinearGradient(0, surfaceCrestY, 0, floorTop);
    bodyGradient.addColorStop(0, `rgba(255, ${Math.round(137 + (temperature * 38))}, ${Math.round(34 + (temperature * 20))}, 1)`);
    bodyGradient.addColorStop(0.62, "rgba(207, 71, 10, 1)");
    bodyGradient.addColorStop(1, "rgba(17, 7, 3, 1)");
    ctx2d.fillStyle = bodyGradient;
    ctx2d.beginPath();
    ctx2d.moveTo(firstSurfaceSample.x, firstSurfaceSample.y);
    for (let i = 1; i < surfaceSamples.length; i += 1) {
      ctx2d.lineTo(surfaceSamples[i].x, surfaceSamples[i].y);
    }
    ctx2d.lineTo(lastSurfaceSample.x, floorTop);
    ctx2d.lineTo(firstSurfaceSample.x, floorTop);
    ctx2d.lineTo(firstSurfaceSample.x, firstSurfaceSample.y);
    ctx2d.closePath();
    ctx2d.fill();

    for (let band = 0; band < 8; band += 1) {
      const yRatio = (band + 1) / 9;
      const yBase = lavaTopBase + (depth * yRatio);
      ctx2d.beginPath();
      for (let x = laneStartX; x <= laneEndX; x += 4) {
        const nx = ((x - laneStartX) * 0.014) + (elapsedSec * (0.18 + (band * 0.036)) * flowSpeed);
        const swirl = sampleSmookeNoise(nx) * 0.58 + sampleSmookeNoise((nx * 1.67) + 27.8) * 0.42;
        const y = yBase + (swirl * (2.1 + ((1 - yRatio) * 3.8)));
        if (x === laneStartX) ctx2d.moveTo(x, y);
        else ctx2d.lineTo(x, y);
      }
      const alpha = 0.03 + ((1 - yRatio) * 0.05 * glowBoost);
      ctx2d.strokeStyle = `rgba(255, ${Math.round(140 + (temperature * 70))}, ${Math.round(24 + (temperature * 28))}, ${alpha})`;
      ctx2d.lineWidth = 1.15;
      ctx2d.stroke();
    }

    const crustFragmentCount = Math.max(10, Math.round((laneWidth * 0.12) + (crustDensity * laneWidth * 0.62)));
    for (let patch = 0; patch < crustFragmentCount; patch += 1) {
      const seed = (patch * 12.73) + 3.1;
      const u = sampleSmookeNoise(seed + 1.4);
      const drift = (sampleSmookeNoise(seed + (elapsedSec * 0.05 * flowSpeed)) - 0.5) * (6 + (crustDensity * 7.5));
      const px = laneStartX + (u * laneWidth) + drift;
      const topBias = Math.pow(sampleSmookeNoise(seed + 4.8), 0.62);
      const py = lavaTopBase + (depth * (0.08 + (topBias * 0.84))) + ((sampleSmookeNoise(seed + (elapsedSec * 0.08 * flowSpeed) + 8.1) - 0.5) * 11);
      const fragmentWidth = 2 + (sampleSmookeNoise(seed + 10.3) * 4.4) + (crustDensity * 1.1);
      const fragmentHeight = 1.1 + (sampleSmookeNoise(seed + 14.7) * 2.9) + (crustDensity * 0.7);
      const points = 6 + (patch % 3);
      const phase = elapsedSec * (0.09 + ((patch % 4) * 0.018)) * flowSpeed;
      const alphaPulse = 0.1 + (sampleSmookeNoise(seed + phase + 20.4) * (0.21 + (crustDensity * 0.26)));
      const colorBlend = sampleSmookeNoise(seed + 26.3);
      const red = Math.round(14 + (colorBlend * 34));
      const green = Math.round(8 + (colorBlend * 16));
      const blue = Math.round(5 + (colorBlend * 9));
      ctx2d.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alphaPulse})`;
      ctx2d.beginPath();
      for (let i = 0; i < points; i += 1) {
        const angle = (Math.PI * 2 * i) / points;
        const jag = 0.72 + (sampleSmookeNoise(seed + (i * 2.7) + (phase * 0.7)) * 0.66);
        const radialX = fragmentWidth * jag;
        const radialY = fragmentHeight * (0.82 + (sampleSmookeNoise(seed + 35.2 + i) * 0.7));
        const x = px + (Math.cos(angle) * radialX) + (Math.sin(phase + i) * 1.2);
        const y = py + (Math.sin(angle) * radialY) + (Math.cos(phase + (i * 0.6)) * 0.8);
        if (i === 0) ctx2d.moveTo(x, y);
        else ctx2d.lineTo(x, y);
      }
      ctx2d.closePath();
      ctx2d.fill();
    }

    ctx2d.beginPath();
    for (let i = 0; i < surfaceSamples.length; i += 1) {
      const sample = surfaceSamples[i];
      if (i === 0) ctx2d.moveTo(sample.x, sample.y);
      else ctx2d.lineTo(sample.x, sample.y);
    }
    ctx2d.strokeStyle = `rgba(255, ${Math.round(195 + (temperature * 45))}, ${Math.round(95 + (temperature * 55))}, 0.96)`;
    ctx2d.lineWidth = 1.55;
    ctx2d.stroke();
    ctx2d.restore();

    const distortionHeight = 42 + (temperature * 34);
    const heatEnvelopeTop = Math.max(0, surfaceCrestY - distortionHeight - 12);
    const heatEnvelopeBottom = Math.ceil(surfaceTroughY + 2);

    ctx2d.save();
    ctx2d.beginPath();
    ctx2d.rect(laneStartX, heatEnvelopeTop, laneEndX - laneStartX, heatEnvelopeBottom - heatEnvelopeTop);
    ctx2d.moveTo(firstSurfaceSample.x, firstSurfaceSample.y);
    for (let i = 1; i < surfaceSamples.length; i += 1) {
      ctx2d.lineTo(surfaceSamples[i].x, surfaceSamples[i].y);
    }
    ctx2d.lineTo(lastSurfaceSample.x, floorTop + 6);
    ctx2d.lineTo(firstSurfaceSample.x, floorTop + 6);
    ctx2d.closePath();
    ctx2d.clip("evenodd");
    const heatGlow = ctx2d.createLinearGradient(0, heatEnvelopeTop, 0, heatEnvelopeBottom);
    heatGlow.addColorStop(0, "rgba(255, 177, 86, 0)");
    heatGlow.addColorStop(0.5, `rgba(255, ${Math.round(171 + (temperature * 54))}, ${Math.round(70 + (temperature * 38))}, ${0.045 + (temperature * 0.06)})`);
    heatGlow.addColorStop(1, `rgba(255, ${Math.round(204 + (temperature * 38))}, ${Math.round(96 + (temperature * 35))}, ${0.08 + (temperature * 0.1)})`);
    ctx2d.fillStyle = heatGlow;
    ctx2d.fillRect(laneStartX, heatEnvelopeTop, laneEndX - laneStartX, heatEnvelopeBottom - heatEnvelopeTop);

    const distortionBands = Math.max(34, Math.round((laneWidth / 12) + (temperature * 16)));
    ctx2d.globalCompositeOperation = "screen";
    for (let band = 0; band < distortionBands; band += 1) {
      const seed = (band * 17.19) + 1.3;
      const centerU = sampleSmookeNoise(seed + 0.5);
      const baseX = laneStartX + (centerU * laneWidth);
      const widthPx = 0.8 + (sampleSmookeNoise(seed + 4.3) * 1.9);
      const speed = 0.24 + (sampleSmookeNoise(seed + 8.2) * 0.54);
      const phase = (elapsedSec * speed * flowSpeed) + (seed * 0.19);
      const sway = (sampleSmookeNoise(seed + phase + 11.7) - 0.5) * (3.4 + (temperature * 5.2));
      const alpha = 0.018 + (sampleSmookeNoise(seed + 15.4) * (0.03 + (temperature * 0.02)));
      const segments = 12;
      ctx2d.beginPath();
      for (let i = 0; i <= segments; i += 1) {
        const t = i / segments;
        const wavering = (sampleSmookeNoise(seed + (t * 9.4) + phase) - 0.5) * (1.8 + (t * 5.2));
        const worldX = baseX + sway + wavering;
        const surfaceY = sampleSurfaceYAtX(worldX);
        const climb = t * distortionHeight * (0.52 + (sampleSmookeNoise(seed + (t * 5.9) + 24.7) * 0.5));
        const y = Math.max(heatEnvelopeTop, surfaceY - climb);
        if (i === 0) ctx2d.moveTo(worldX, y);
        else ctx2d.lineTo(worldX, y);
      }
      const grad = ctx2d.createLinearGradient(0, heatEnvelopeTop, 0, heatEnvelopeBottom);
      grad.addColorStop(0, "rgba(255, 220, 170, 0)");
      grad.addColorStop(0.7, `rgba(255, ${Math.round(182 + (temperature * 30))}, ${Math.round(106 + (temperature * 32))}, ${alpha})`);
      grad.addColorStop(1, "rgba(255, 236, 188, 0)");
      ctx2d.strokeStyle = grad;
      ctx2d.lineWidth = widthPx;
      ctx2d.lineCap = "round";
      ctx2d.lineJoin = "round";
      ctx2d.stroke();
    }
    ctx2d.globalCompositeOperation = "source-over";
    const shimmerColumns = Math.max(18, Math.round((laneWidth / 18) + (temperature * 10)));
    for (let column = 0; column < shimmerColumns; column += 1) {
      const seed = 88.3 + (column * 9.17);
      const centerX = laneStartX + (sampleSmookeNoise(seed) * laneWidth);
      const halfWidth = 2.2 + (sampleSmookeNoise(seed + 1.8) * 5.1);
      const phase = elapsedSec * ((0.26 + (sampleSmookeNoise(seed + 2.4) * 0.45)) * flowSpeed) + seed;
      const alpha = 0.014 + (sampleSmookeNoise(seed + 6.8) * (0.018 + (temperature * 0.012)));
      const topLift = distortionHeight * (0.46 + (sampleSmookeNoise(seed + 4.1) * 0.54));
      const colTop = Math.max(heatEnvelopeTop, surfaceCrestY - topLift);
      const grad = ctx2d.createLinearGradient(0, colTop, 0, heatEnvelopeBottom);
      grad.addColorStop(0, "rgba(255, 255, 255, 0)");
      grad.addColorStop(0.4, `rgba(255, 244, 208, ${alpha})`);
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx2d.fillStyle = grad;
      ctx2d.beginPath();
      for (let i = 0; i <= 10; i += 1) {
        const t = i / 10;
        const y = heatEnvelopeBottom - ((heatEnvelopeBottom - colTop) * t);
        const spread = (1 - t) * halfWidth;
        const offset = Math.sin((t * 8.2) + phase) * (0.9 + (t * 2.2));
        const x = centerX + offset + spread;
        if (i === 0) ctx2d.moveTo(x, y);
        else ctx2d.lineTo(x, y);
      }
      for (let i = 10; i >= 0; i -= 1) {
        const t = i / 10;
        const y = heatEnvelopeBottom - ((heatEnvelopeBottom - colTop) * t);
        const spread = (1 - t) * halfWidth;
        const offset = Math.sin((t * 8.2) + phase) * (0.9 + (t * 2.2));
        const x = centerX + offset - spread;
        ctx2d.lineTo(x, y);
      }
      ctx2d.closePath();
      ctx2d.fill();
    }
    ctx2d.restore();
  };

  const stepLavaPreviewMotion = (timestampMs) => {
    if (!lavaPreviewMotion.surface?.isConnected || !lavaPreviewMotion.canvas?.isConnected || !lavaPreviewMotion.ctx) {
      stopLavaPreviewMotionLoop();
      return;
    }
    if (!lavaPreviewMotion.startedAtMs) lavaPreviewMotion.startedAtMs = timestampMs;
    const elapsedMs = timestampMs - lavaPreviewMotion.startedAtMs;
    drawLavaPreviewCanvas(elapsedMs);
    lavaPreviewMotion.rafId = globalThis.requestAnimationFrame(stepLavaPreviewMotion);
  };

  const syncLavaPreviewMotionLoop = () => {
    const surface = floatingPanelHost.querySelector("[data-lava-preview-surface]");
    const canvasEl = floatingPanelHost.querySelector("[data-lava-preview-canvas]");
    if (!(surface instanceof HTMLElement) || !(canvasEl instanceof HTMLCanvasElement)) {
      stopLavaPreviewMotionLoop();
      return;
    }
    const ctx2d = canvasEl.getContext("2d");
    if (!ctx2d) {
      stopLavaPreviewMotionLoop();
      return;
    }
    const durationMs = Number.parseFloat(surface.dataset.lavaPreviewTraverseMs || "");
    if (lavaPreviewMotion.surface === surface && lavaPreviewMotion.canvas === canvasEl && lavaPreviewMotion.rafId) {
      lavaPreviewMotion.durationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 9600;
      return;
    }
    stopLavaPreviewMotionLoop();
    lavaPreviewMotion.surface = surface;
    lavaPreviewMotion.canvas = canvasEl;
    lavaPreviewMotion.ctx = ctx2d;
    lavaPreviewMotion.worldWidth = canvasEl.width;
    lavaPreviewMotion.worldHeight = canvasEl.height;
    const envMetrics = getVolumePreviewEnvironmentMetrics(lavaPreviewMotion.worldWidth, lavaPreviewMotion.worldHeight);
    lavaPreviewMotion.bandStartX = envMetrics.laneStartX;
    lavaPreviewMotion.bandEndX = envMetrics.laneEndX;
    lavaPreviewMotion.durationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 9600;
    lavaPreviewMotion.startedAtMs = 0;
    lavaPreviewMotion.lumoX = 0;
    lavaPreviewMotion.lumoDirection = 1;
    lavaPreviewMotion.lumoSprite = null;
    drawLavaPreviewCanvas(0);
    lavaPreviewMotion.rafId = globalThis.requestAnimationFrame(stepLavaPreviewMotion);
  };

  const stopBubblingLiquidPreviewMotionLoop = () => {
    if (bubblingLiquidPreviewMotion.rafId) {
      globalThis.cancelAnimationFrame(bubblingLiquidPreviewMotion.rafId);
      bubblingLiquidPreviewMotion.rafId = 0;
    }
    bubblingLiquidPreviewMotion.surface = null;
    bubblingLiquidPreviewMotion.canvas = null;
    bubblingLiquidPreviewMotion.ctx = null;
  };

  const drawBubblingLiquidPreviewCanvas = (elapsedMs) => {
    if (!bubblingLiquidPreviewMotion.surface || !bubblingLiquidPreviewMotion.ctx) return;
    const surfaceDataset = bubblingLiquidPreviewMotion.surface.dataset;
    const ctx2d = bubblingLiquidPreviewMotion.ctx;
    const width = bubblingLiquidPreviewMotion.worldWidth;
    const height = bubblingLiquidPreviewMotion.worldHeight;
    const { tileSize, floorTopY: floorTop, laneStartX, laneEndX } = getVolumePreviewEnvironmentMetrics(width, height);
    const terrainTop = Math.max(24, Math.round(height * 0.36));
    const leftBlockInnerX = Math.max(0, laneStartX - tileSize);
    const rightBlockOuterX = Math.min(width, laneEndX + tileSize);
    const soilTile = ensureFogPreviewTileSprite("soil", "../data/assets/tiles/soil_c.png");
    const grassTile = ensureFogPreviewTileSprite("grass", "../data/assets/tiles/grass_bt.png");
    const stoneTile = ensureFogPreviewTileSprite("stone", "../data/assets/tiles/stone_ct.png");
    const drawTiledRect = (image, fallback, x, y, w, h) => {
      if (w <= 0 || h <= 0) return;
      if (image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0) {
        for (let yy = y; yy < y + h; yy += tileSize) {
          for (let xx = x; xx < x + w; xx += tileSize) {
            const drawW = Math.min(tileSize, (x + w) - xx);
            const drawH = Math.min(tileSize, (y + h) - yy);
            ctx2d.drawImage(image, 0, 0, drawW, drawH, xx, yy, drawW, drawH);
          }
        }
      } else {
        ctx2d.fillStyle = fallback;
        ctx2d.fillRect(x, y, w, h);
      }
    };
    ctx2d.clearRect(0, 0, width, height);
    ctx2d.fillStyle = "#050912";
    ctx2d.fillRect(0, 0, width, height);
    ctx2d.fillStyle = "rgba(8, 14, 26, 0.72)";
    ctx2d.fillRect(0, 0, width, floorTop);
    drawTiledRect(stoneTile, "#6a655e", 0, floorTop, width, tileSize);
    drawTiledRect(soilTile, "#5b3a26", 0, terrainTop, leftBlockInnerX, Math.max(0, floorTop - terrainTop));
    drawTiledRect(soilTile, "#5b3a26", rightBlockOuterX, terrainTop, Math.max(0, width - rightBlockOuterX), Math.max(0, floorTop - terrainTop));
    drawTiledRect(grassTile, "#8ca86f", 0, terrainTop - tileSize, leftBlockInnerX, tileSize);
    drawTiledRect(grassTile, "#8ca86f", rightBlockOuterX, terrainTop - tileSize, Math.max(0, width - rightBlockOuterX), tileSize);
    drawTiledRect(stoneTile, "#66615a", leftBlockInnerX, terrainTop, tileSize, Math.max(0, floorTop - terrainTop));
    drawTiledRect(stoneTile, "#66615a", laneEndX, terrainTop, tileSize, Math.max(0, floorTop - terrainTop));

    const depth = clampFogPreview(Number.parseFloat(surfaceDataset.bubblingLiquidDepth || "") || 92, 24, 164);
    const surfaceActivity = clampFogPreview(Number.parseFloat(surfaceDataset.bubblingLiquidSurfaceActivity || "") || 0.45, 0, 1);
    const bubbleAmount = normalizeBubblingLiquidDensityPreview(surfaceDataset.bubblingLiquidBubbleAmount, 58);
    const fumeAmount = normalizeBubblingLiquidDensityPreview(surfaceDataset.bubblingLiquidFumeAmount, 40);
    const bubbleIntensity = bubbleAmount * 0.01;
    const fumeIntensity = fumeAmount * 0.01;
    const topColor = surfaceDataset.bubblingLiquidTopColor || "#7FD12E";
    const bottomColor = surfaceDataset.bubblingLiquidBottomColor || "#2F5E1C";
    const liquidTopBase = floorTop - depth;
    const elapsedSec = elapsedMs * 0.001;
    const laneWidth = Math.max(1, laneEndX - laneStartX);

    const surfaceSamples = [];
    for (let x = laneStartX; x <= laneEndX; x += 2) {
      const subtle = Math.sin((x * 0.024) + (elapsedSec * 0.42)) * (0.7 + (surfaceActivity * 0.9));
      const bubbling = sampleSmookeNoise((x * 0.021) + (elapsedSec * (0.55 + (surfaceActivity * 0.65)))) * (0.65 + (surfaceActivity * 1.4));
      surfaceSamples.push({ x, y: liquidTopBase + subtle + bubbling });
    }
    const firstSurfaceSample = surfaceSamples[0];
    const lastSurfaceSample = surfaceSamples[surfaceSamples.length - 1];
    const surfaceCrestY = surfaceSamples.reduce((minY, sample) => Math.min(minY, sample.y), Number.POSITIVE_INFINITY);

    ctx2d.save();
    ctx2d.beginPath();
    ctx2d.rect(laneStartX, liquidTopBase - 14, laneEndX - laneStartX, floorTop - liquidTopBase + 16);
    ctx2d.clip();

    const bodyGradient = ctx2d.createLinearGradient(0, surfaceCrestY, 0, floorTop);
    bodyGradient.addColorStop(0, topColor);
    bodyGradient.addColorStop(1, bottomColor);
    ctx2d.fillStyle = bodyGradient;
    ctx2d.beginPath();
    ctx2d.moveTo(firstSurfaceSample.x, firstSurfaceSample.y);
    for (let i = 1; i < surfaceSamples.length; i += 1) ctx2d.lineTo(surfaceSamples[i].x, surfaceSamples[i].y);
    ctx2d.lineTo(lastSurfaceSample.x, floorTop);
    ctx2d.lineTo(firstSurfaceSample.x, floorTop);
    ctx2d.closePath();
    ctx2d.fill();

    const sampleSurfaceYAtX = (x) => {
      if (!surfaceSamples.length) return liquidTopBase;
      const relative = clampFogPreview((x - laneStartX) / Math.max(1, laneWidth), 0, 1);
      const scaled = relative * (surfaceSamples.length - 1);
      const leftIndex = Math.floor(scaled);
      const rightIndex = Math.min(surfaceSamples.length - 1, leftIndex + 1);
      const blend = scaled - leftIndex;
      const left = surfaceSamples[leftIndex]?.y ?? liquidTopBase;
      const right = surfaceSamples[rightIndex]?.y ?? left;
      return left + ((right - left) * blend);
    };

    const bubbleCount = Math.max(4, Math.round((laneWidth * 0.012) + (Math.pow(bubbleIntensity, 1.05) * laneWidth * 0.22)));
    const popEvents = [];
    for (let i = 0; i < bubbleCount; i += 1) {
      const seed = 12.6 + (i * 9.2);
      const baseU = sampleSmookeNoise(seed + 1.3) * 0.98 + 0.01;
      const phaseOffset = sampleSmookeNoise(seed + 3.1);
      const lateralSway = (sampleSmookeNoise(seed + (elapsedSec * (0.18 + (surfaceActivity * 0.14)))) - 0.5) * (0.01 + (bubbleIntensity * 0.008));
      const px = laneStartX + (((baseU + lateralSway + 1) % 1) * laneWidth);
      const startDepthRatio = 0.35 + (sampleSmookeNoise(seed + 4.6) * 0.62);
      const speed = (0.05 + (sampleSmookeNoise(seed + 2.5) * 0.05) + (surfaceActivity * 0.05) + (bubbleIntensity * 0.03));
      const cycle = ((elapsedSec * speed) + phaseOffset) % 1;
      const risePhase = 0.78;
      const interactionPhase = 0.14;
      const popPhase = 1 - risePhase - interactionPhase;
      const bubbleRadius = 1 + (sampleSmookeNoise(seed + 7.2) * (1.4 + (bubbleIntensity * 1.3)));
      const surfaceY = sampleSurfaceYAtX(px);
      let py = floorTop - (depth * startDepthRatio);
      let bubbleAlpha = 0.12 + (bubbleIntensity * 0.08);
      let rimAlpha = 0.2 + (bubbleIntensity * 0.22);
      let radius = bubbleRadius;

      if (cycle <= risePhase) {
        const riseProgress = smoothFogPreview01(cycle / risePhase);
        py = floorTop - (depth * startDepthRatio * riseProgress);
      } else if (cycle <= risePhase + interactionPhase) {
        const interactionProgress = (cycle - risePhase) / interactionPhase;
        py = surfaceY - (0.4 + (interactionProgress * (1.4 + (surfaceActivity * 2.2))));
        radius = bubbleRadius * (1 + (interactionProgress * 0.28));
        bubbleAlpha += interactionProgress * 0.1;
        rimAlpha += interactionProgress * 0.22;
      } else {
        const popProgress = (cycle - risePhase - interactionPhase) / Math.max(0.001, popPhase);
        const easedPop = smoothFogPreview01(popProgress);
        py = surfaceY - (1.8 + (easedPop * (2 + (surfaceActivity * 1.6))));
        radius = bubbleRadius * (1 - (easedPop * 0.78));
        bubbleAlpha *= (1 - easedPop);
        rimAlpha *= (1 - easedPop);
        popEvents.push({
          px,
          py: surfaceY - 0.5,
          ringRadius: (0.8 + (bubbleRadius * 0.9)) + (easedPop * (3.2 + (surfaceActivity * 2.8))),
          ringAlpha: (0.26 + (surfaceActivity * 0.16)) * (1 - easedPop),
          capRadius: Math.max(0.35, bubbleRadius * (1 - (easedPop * 0.5))),
          capAlpha: (0.34 - (easedPop * 0.28)) * (0.8 + (surfaceActivity * 0.5)),
        });
      }

      if (radius <= 0.35 || bubbleAlpha <= 0.01) continue;
      ctx2d.beginPath();
      ctx2d.arc(px, py, radius, 0, Math.PI * 2);
      ctx2d.fillStyle = `rgba(220, 255, 214, ${bubbleAlpha})`;
      ctx2d.fill();
      ctx2d.strokeStyle = `rgba(230, 255, 224, ${rimAlpha})`;
      ctx2d.lineWidth = py <= surfaceY + 1 ? 1.05 : 0.75;
      ctx2d.stroke();
    }
    ctx2d.restore();

    ctx2d.beginPath();
    for (let i = 0; i < surfaceSamples.length; i += 1) {
      const sample = surfaceSamples[i];
      if (i === 0) ctx2d.moveTo(sample.x, sample.y);
      else ctx2d.lineTo(sample.x, sample.y);
    }
    ctx2d.strokeStyle = "rgba(233, 255, 201, 0.94)";
    ctx2d.lineWidth = 1.4;
    ctx2d.stroke();

    for (let i = 0; i < popEvents.length; i += 1) {
      const pop = popEvents[i];
      if (pop.ringAlpha > 0.01) {
        ctx2d.beginPath();
        ctx2d.arc(pop.px, pop.py, pop.ringRadius, 0, Math.PI * 2);
        ctx2d.strokeStyle = `rgba(239, 255, 228, ${pop.ringAlpha})`;
        ctx2d.lineWidth = 0.95;
        ctx2d.stroke();
      }
      if (pop.capAlpha > 0.01) {
        ctx2d.beginPath();
        ctx2d.arc(pop.px, pop.py - 0.6, pop.capRadius, 0, Math.PI * 2);
        ctx2d.fillStyle = `rgba(244, 255, 236, ${pop.capAlpha})`;
        ctx2d.fill();
      }
    }

    if (fumeAmount > 0.01) {
      const plumeCount = Math.max(4, Math.round((laneWidth * 0.008) + (Math.pow(fumeIntensity, 1.05) * 42)));
      for (let i = 0; i < plumeCount; i += 1) {
        const seed = 90.1 + (i * 7.7);
        const px = laneStartX + (sampleSmookeNoise(seed) * laneWidth);
        const puffHeight = 10 + (fumeIntensity * 34) + (sampleSmookeNoise(seed + 1.4) * (14 + (fumeIntensity * 18)));
        const drift = (sampleSmookeNoise(seed + (elapsedSec * 0.26)) - 0.5) * (3 + (fumeIntensity * 14));
        const alpha = 0.035 + (sampleSmookeNoise(seed + 5.8) * (0.06 + (fumeIntensity * 0.2)));
        const grad = ctx2d.createLinearGradient(0, liquidTopBase - puffHeight, 0, liquidTopBase + 4);
        grad.addColorStop(0, "rgba(206, 227, 181, 0)");
        grad.addColorStop(1, `rgba(206, 227, 181, ${alpha})`);
        ctx2d.strokeStyle = grad;
        ctx2d.lineWidth = 1 + (sampleSmookeNoise(seed + 9.1) * 1.9);
        ctx2d.beginPath();
        ctx2d.moveTo(px, liquidTopBase + 2);
        ctx2d.quadraticCurveTo(px + drift, liquidTopBase - (puffHeight * 0.45), px + (drift * 0.6), liquidTopBase - puffHeight);
        ctx2d.stroke();
      }
    }
  };

  const stepBubblingLiquidPreviewMotion = (timestampMs) => {
    if (!bubblingLiquidPreviewMotion.surface?.isConnected || !bubblingLiquidPreviewMotion.canvas?.isConnected || !bubblingLiquidPreviewMotion.ctx) {
      stopBubblingLiquidPreviewMotionLoop();
      return;
    }
    if (!bubblingLiquidPreviewMotion.startedAtMs) bubblingLiquidPreviewMotion.startedAtMs = timestampMs;
    const elapsedMs = timestampMs - bubblingLiquidPreviewMotion.startedAtMs;
    drawBubblingLiquidPreviewCanvas(elapsedMs);
    bubblingLiquidPreviewMotion.rafId = globalThis.requestAnimationFrame(stepBubblingLiquidPreviewMotion);
  };

  const syncBubblingLiquidPreviewMotionLoop = () => {
    const surface = floatingPanelHost.querySelector("[data-bubbling-liquid-preview-surface]");
    const canvasEl = floatingPanelHost.querySelector("[data-bubbling-liquid-preview-canvas]");
    if (!(surface instanceof HTMLElement) || !(canvasEl instanceof HTMLCanvasElement)) {
      stopBubblingLiquidPreviewMotionLoop();
      return;
    }
    const ctx2d = canvasEl.getContext("2d");
    if (!ctx2d) {
      stopBubblingLiquidPreviewMotionLoop();
      return;
    }
    const durationMs = Number.parseFloat(surface.dataset.bubblingLiquidPreviewTraverseMs || "");
    if (bubblingLiquidPreviewMotion.surface === surface && bubblingLiquidPreviewMotion.canvas === canvasEl && bubblingLiquidPreviewMotion.rafId) {
      bubblingLiquidPreviewMotion.durationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 9600;
      return;
    }
    stopBubblingLiquidPreviewMotionLoop();
    bubblingLiquidPreviewMotion.surface = surface;
    bubblingLiquidPreviewMotion.canvas = canvasEl;
    bubblingLiquidPreviewMotion.ctx = ctx2d;
    bubblingLiquidPreviewMotion.worldWidth = canvasEl.width;
    bubblingLiquidPreviewMotion.worldHeight = canvasEl.height;
    const envMetrics = getVolumePreviewEnvironmentMetrics(bubblingLiquidPreviewMotion.worldWidth, bubblingLiquidPreviewMotion.worldHeight);
    bubblingLiquidPreviewMotion.bandStartX = envMetrics.laneStartX;
    bubblingLiquidPreviewMotion.bandEndX = envMetrics.laneEndX;
    bubblingLiquidPreviewMotion.durationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 9600;
    bubblingLiquidPreviewMotion.startedAtMs = 0;
    drawBubblingLiquidPreviewCanvas(0);
    bubblingLiquidPreviewMotion.rafId = globalThis.requestAnimationFrame(stepBubblingLiquidPreviewMotion);
  };

  const applyCanvasTarget = (draft, mode) => {
    const nextMode = mode === "decor" ? "decor" : mode === "sound" ? "sound" : "entity";
    resumeObjectPlacementPreviews(draft, `canvas target ${nextMode}`);
    setCanvasSelectionMode(draft, nextMode);
    setActiveLayer(draft, nextMode === "decor" ? PANEL_LAYERS.DECOR : nextMode === "sound" ? PANEL_LAYERS.SOUND : PANEL_LAYERS.ENTITIES);
    draft.interaction.boxSelection = null;
    draft.interaction.entityDrag = null;
    draft.interaction.decorDrag = null;
    draft.interaction.soundDrag = null;
    draft.interaction.scanDrag = null;
    draft.interaction.volumePlacementDrag = null;
    clearDecorScatterDrag(draft);

    if (nextMode === "decor") {
      clearEntitySelection(draft.interaction);
      clearSoundSelection(draft.interaction);
      draft.interaction.hoveredEntityIndex = null;
      clearHoveredSound(draft.interaction);
      updateDecorSelectionCell(draft);
      if (!getSelectedDecorIndices(draft.interaction, draft.document.active?.decor || []).length) {
        draft.interaction.selectedCell = null;
      }
      return;
    }

    if (nextMode === "sound") {
      clearEntitySelection(draft.interaction);
      clearDecorSelection(draft.interaction);
      draft.interaction.hoveredEntityIndex = null;
      setHoveredDecor(draft, null);
      reconcileSoundInteractionState(draft);
      if (!getSelectedSoundIndices(draft.interaction, draft.document.active?.sounds || []).length) {
        draft.interaction.selectedCell = null;
      }
      return;
    }

    clearDecorSelection(draft.interaction);
    clearSoundSelection(draft.interaction);
    setHoveredDecor(draft, null);
    clearHoveredSound(draft.interaction);
    updateEntitySelectionCell(draft);
    if (!getSelectedEntityIndices(draft.interaction).length) {
      draft.interaction.selectedCell = null;
    }
  };

  const clearActiveSelection = (draft, nextMode = getSelectionMode(draft.interaction)) => {
    if (getActiveLayer(draft.interaction) === PANEL_LAYERS.TILES) {
      clearEntitySelection(draft.interaction);
      clearDecorSelection(draft.interaction);
      clearSoundSelection(draft.interaction);
      draft.interaction.hoveredEntityIndex = null;
      setHoveredDecor(draft, null);
      clearHoveredSound(draft.interaction);
      draft.interaction.entityDrag = null;
      draft.interaction.decorDrag = null;
      draft.interaction.soundDrag = null;
      return;
    }

    if (nextMode === "decor") {
      clearEntitySelection(draft.interaction);
      clearSoundSelection(draft.interaction);
      draft.interaction.hoveredEntityIndex = null;
      clearHoveredSound(draft.interaction);
      draft.interaction.entityDrag = null;
      draft.interaction.soundDrag = null;
      return;
    }

    if (nextMode === "sound") {
      clearEntitySelection(draft.interaction);
      clearDecorSelection(draft.interaction);
      draft.interaction.hoveredEntityIndex = null;
      setHoveredDecor(draft, null);
      clearHoveredSound(draft.interaction);
      draft.interaction.entityDrag = null;
      draft.interaction.decorDrag = null;
      return;
    }

    clearDecorSelection(draft.interaction);
    clearSoundSelection(draft.interaction);
    setHoveredDecor(draft, null);
    clearHoveredSound(draft.interaction);
    draft.interaction.decorDrag = null;
    draft.interaction.soundDrag = null;
  };

  const getDecorScatterSettings = (interaction) => ({
    density: clampScatterDensity(interaction.decorScatterSettings?.density),
    randomness: clampScatterRandomness(interaction.decorScatterSettings?.randomness),
    variantMode: interaction.decorScatterSettings?.variantMode === "random" ? "random" : "fixed",
  });

  const updateDecorSelectionCell = (draft, decorIndex = getPrimarySelectedDecorIndex(draft.interaction, draft.document.active?.decor || [])) => {
    const decorItems = draft.document.active?.decor || [];
    const decor = getPrimarySelectedDecorId(draft.interaction)
      ? decorItems.find((candidate) => candidate?.id === draft.interaction.selectedDecorId) || null
      : Number.isInteger(decorIndex)
        ? decorItems[decorIndex] || null
        : null;
    draft.interaction.selectedCell = decor ? { x: decor.x, y: decor.y } : null;
  };

  const resolveDecorVariant = (preset, variantMode = "fixed") => {
    const variants = Array.isArray(preset?.variants) && preset.variants.length ? preset.variants : [preset?.defaultVariant || "a"];
    if (variantMode === "random" && variants.length > 1) {
      return variants[Math.floor(Math.random() * variants.length)] || preset?.defaultVariant || "a";
    }
    return preset?.defaultVariant || variants[0] || "a";
  };


  const resolveEntityPlacementPreset = (presetId) => {
    const normalizedPresetId = normalizeEditableObjectType(presetId);
    const entityPreset = findEntityPresetById(normalizedPresetId)
      || findEntityPresetByType(normalizedPresetId);

    if (entityPreset) return entityPreset;

    const decorPreset = findDecorPresetById(normalizedPresetId) || findDecorPresetByType(normalizedPresetId);
    if (decorPreset && isEntityLikeEditableType(decorPreset.type)) {
      return getEntityPresetForType(decorPreset.type);
    }

    if (isEntityLikeEditableType(normalizedPresetId)) {
      const entityLikePreset = getEntityPresetForType(normalizedPresetId);
      return entityLikePreset || null;
    }

    return null;
  };

  const resolveDecorPlacementPreset = (presetId) => {
    const normalizedPresetId = normalizeEditableObjectType(presetId);
    if (isEntityLikeEditableType(normalizedPresetId)) return null;
    return findDecorPresetById(normalizedPresetId)
      || findDecorPresetByType(normalizedPresetId)
      || findDecorPresetById(DEFAULT_DECOR_PRESET_ID);
  };

  const createDecorDraft = (
    doc,
    x,
    y,
    presetId = DEFAULT_DECOR_PRESET_ID,
    nextNumber = (doc.decor?.length || 0) + 1,
    options = {},
  ) => {
    const placement = clampDecorPosition(doc, x, y);
    const preset = resolveDecorPlacementPreset(presetId);

    return {
      id: options.id || `decor-${nextNumber}`,
      name: preset?.defaultName || 'Decor',
      type: preset?.type || 'grass',
      x: placement.x,
      y: placement.y,
      visible: true,
      variant: options.variant || resolveDecorVariant(preset, options.variantMode),
    };
  };

  const createScatterDecorEntries = (doc, startCell, endCell, presetId, settings) => {
    if (!doc || !startCell || !endCell) return [];

    const bounds = getRectBounds(startCell, endCell);
    const areaWidth = bounds.maxX - bounds.minX + 1;
    const areaHeight = bounds.maxY - bounds.minY + 1;
    const cellCapacity = areaWidth * areaHeight;
    const placementCount = getScatterTargetCount(cellCapacity, settings.density);
    if (placementCount <= 0) return [];

    const randomness = clampScatterRandomness(settings.randomness);
    const aspect = areaWidth / Math.max(1, areaHeight);
    const approxColumns = Math.max(1, Math.round(Math.sqrt(placementCount * aspect)));
    const columns = Math.min(areaWidth, approxColumns);
    const rows = Math.max(1, Math.ceil(placementCount / columns));
    const stepX = areaWidth / columns;
    const stepY = areaHeight / rows;
    const usedCells = new Set((doc.decor || []).map((decor) => `${decor.x}:${decor.y}`));
    const usedIds = new Set((doc.decor || []).map((decor) => decor?.id).filter((id) => typeof id === "string" && id.trim()));
    const entries = [];
    let nextIdNumber = (doc.decor?.length || 0) + 1;

    const reserveNearestFreeCell = (candidateX, candidateY) => {
      const clamped = clampDecorPosition(doc, candidateX, candidateY);
      const directKey = `${clamped.x}:${clamped.y}`;
      if (!usedCells.has(directKey)) {
        usedCells.add(directKey);
        return clamped;
      }

      const maxRadius = Math.max(areaWidth, areaHeight);
      for (let radius = 1; radius <= maxRadius; radius += 1) {
        for (let y = Math.max(bounds.minY, clamped.y - radius); y <= Math.min(bounds.maxY, clamped.y + radius); y += 1) {
          for (let x = Math.max(bounds.minX, clamped.x - radius); x <= Math.min(bounds.maxX, clamped.x + radius); x += 1) {
            const key = `${x}:${y}`;
            if (usedCells.has(key)) continue;
            usedCells.add(key);
            return { x, y };
          }
        }
      }

      return null;
    };

    for (let index = 0; index < placementCount; index += 1) {
      const column = columns === 1 ? 0 : index % columns;
      const row = Math.floor(index / columns);
      const baseX = bounds.minX + Math.min(areaWidth - 1, (column + 0.5) * stepX - 0.5);
      const baseY = bounds.minY + Math.min(areaHeight - 1, (row + 0.5) * stepY - 0.5);
      const jitterX = (Math.random() - 0.5) * stepX * randomness;
      const jitterY = (Math.random() - 0.5) * stepY * randomness;
      const placement = reserveNearestFreeCell(baseX + jitterX, baseY + jitterY);
      if (!placement) continue;

      let nextId = `decor-${nextIdNumber}`;
      while (usedIds.has(nextId)) {
        nextIdNumber += 1;
        nextId = `decor-${nextIdNumber}`;
      }
      usedIds.add(nextId);

      const decor = createDecorDraft(doc, placement.x, placement.y, presetId, nextIdNumber, {
        id: nextId,
        variantMode: settings.variantMode,
      });
      entries.push(decor);
      nextIdNumber += 1;
    }

    return entries;
  };

  const createEntityDraft = (doc, x, y, presetId = DEFAULT_ENTITY_PRESET_ID, nextNumber = (doc.entities?.length || 0) + 1) => {
    const placement = clampEntityPosition(doc, x, y);
    const preset = resolveEntityPlacementPreset(presetId) || findEntityPresetById(DEFAULT_ENTITY_PRESET_ID);

    const entity = {
      id: `entity-${nextNumber}`,
      name: preset?.defaultName || "Generic",
      type: preset?.type || "generic",
      x: placement.x,
      y: placement.y,
      visible: true,
      params: getEntityPresetParamsForType(preset?.type || DEFAULT_ENTITY_PRESET_ID, getEntityPresetDefaultParams(preset?.id || DEFAULT_ENTITY_PRESET_ID)),
    };

    if (isFogVolumeEntityType(entity.type)) {
      const fogDefaults = store.getState()?.ui?.specialVolumeWorkbench?.fogDefaults;
      if (fogDefaults && typeof fogDefaults === "object") {
        entity.params = getFogVolumeParams({ ...entity, params: fogDefaults });
      }
    }
    if (isWaterVolumeEntityType(entity.type)) {
      entity.params = getWaterVolumeParams(entity);
    }
    if (isLavaVolumeEntityType(entity.type)) {
      entity.params = getLavaVolumeParams(entity);
    }
    if (isBubblingLiquidVolumeEntityType(entity.type)) {
      entity.params = getBubblingLiquidVolumeParams(entity);
    }

    return isSpecialVolumeEntityType(entity.type)
      ? syncSpecialVolumeEntityToAnchor(entity, doc.dimensions.tileSize)
      : entity;
  };

  const createSoundDraft = (doc, x, y, presetId = DEFAULT_SOUND_PRESET_ID, nextNumber = (doc.sounds?.length || 0) + 1) => {
    const placement = clampSoundPosition(doc, x, y);
    const preset = findSoundPresetById(presetId) || findSoundPresetById(DEFAULT_SOUND_PRESET_ID);

    return {
      id: `sound-${nextNumber}`,
      name: preset?.defaultName || "Sound",
      type: preset?.type || "spot",
      x: placement.x,
      y: placement.y,
      visible: true,
      params: getSoundPresetDefaultParams(preset?.id || DEFAULT_SOUND_PRESET_ID),
    };
  };

  const getEntitySelectionIndices = (interaction, entities) =>
    getSelectedEntityIndices(interaction).filter((index) => index >= 0 && index < entities.length);

  const getSelectedEntities = (interaction, entities) =>
    getEntitySelectionIndices(interaction, entities).map((index) => ({ index, entity: entities[index] })).filter((entry) => entry.entity);

  const getDecorSelectionIndices = (interaction, decorItems) =>
    getSelectedDecorIndices(interaction, decorItems).filter((index) => index >= 0 && index < decorItems.length);

  const getSelectedDecor = (interaction, decorItems) =>
    getDecorSelectionIndices(interaction, decorItems).map((index) => ({ index, decor: decorItems[index] })).filter((entry) => entry.decor);

  const getSoundSelectionIndices = (interaction, sounds) =>
    getSelectedSoundIndices(interaction, sounds).filter((index) => index >= 0 && index < sounds.length);

  const getSelectedSounds = (interaction, sounds) =>
    getSoundSelectionIndices(interaction, sounds).map((index) => ({ index, sound: sounds[index] })).filter((entry) => entry.sound);

  const getClampedGroupDragDelta = (doc, originPositions, deltaX, deltaY) => {
    let minDeltaX = -Infinity;
    let maxDeltaX = Infinity;
    let minDeltaY = -Infinity;
    let maxDeltaY = Infinity;

    for (const origin of originPositions) {
      minDeltaX = Math.max(minDeltaX, -origin.x);
      maxDeltaX = Math.min(maxDeltaX, doc.dimensions.width - 1 - origin.x);
      minDeltaY = Math.max(minDeltaY, -origin.y);
      maxDeltaY = Math.min(maxDeltaY, doc.dimensions.height - 1 - origin.y);
    }

    return {
      x: Math.max(minDeltaX, Math.min(maxDeltaX, deltaX)),
      y: Math.max(minDeltaY, Math.min(maxDeltaY, deltaY)),
    };
  };

  const getEntityIndicesInCanvasRect = (doc, viewport, startPoint, endPoint) => {
    if (!startPoint || !endPoint) return [];

    const minX = Math.min(startPoint.x, endPoint.x);
    const maxX = Math.max(startPoint.x, endPoint.x);
    const minY = Math.min(startPoint.y, endPoint.y);
    const maxY = Math.max(startPoint.y, endPoint.y);
    const tileSize = doc.dimensions.tileSize;

    return (doc.entities || [])
      .map((entity, index) => ({ entity, index }))
      .filter(({ entity }) => entity?.visible && !isSpecialVolumeEntityType(entity?.type))
      .filter(({ entity }) => {
        const centerX = viewport.offsetX + (entity.x + 0.5) * tileSize * viewport.zoom;
        const centerY = viewport.offsetY + (entity.y + 0.5) * tileSize * viewport.zoom;
        return centerX >= minX && centerX <= maxX && centerY >= minY && centerY <= maxY;
      })
      .map(({ index }) => index);
  };

  const getDecorIndicesInCanvasRect = (doc, viewport, startPoint, endPoint) => {
    if (!startPoint || !endPoint) return [];

    const minX = Math.min(startPoint.x, endPoint.x);
    const maxX = Math.max(startPoint.x, endPoint.x);
    const minY = Math.min(startPoint.y, endPoint.y);
    const maxY = Math.max(startPoint.y, endPoint.y);
    const tileSize = doc.dimensions.tileSize;

    return (doc.decor || [])
      .map((decor, index) => ({ decor, index }))
      .filter(({ decor }) => decor?.visible)
      .filter(({ decor }) => {
        const centerX = viewport.offsetX + (decor.x + 0.5) * tileSize * viewport.zoom;
        const centerY = viewport.offsetY + (decor.y + 0.76) * tileSize * viewport.zoom;
        return centerX >= minX && centerX <= maxX && centerY >= minY && centerY <= maxY;
      })
      .map(({ index }) => index);
  };

  const getSoundIndicesInCanvasRect = (doc, viewport, startPoint, endPoint) => {
    if (!startPoint || !endPoint) return [];

    const minX = Math.min(startPoint.x, endPoint.x);
    const maxX = Math.max(startPoint.x, endPoint.x);
    const minY = Math.min(startPoint.y, endPoint.y);
    const maxY = Math.max(startPoint.y, endPoint.y);
    const tileSize = doc.dimensions.tileSize;

    return (doc.sounds || [])
      .map((sound, index) => ({ sound, index }))
      .filter(({ sound }) => sound?.visible)
      .filter(({ sound }) => {
        const width = Math.max(1, Number(sound?.params?.width) || 1);
        const height = Math.max(1, Number(sound?.params?.height) || 1);
        const rectX = viewport.offsetX + sound.x * tileSize * viewport.zoom;
        const rectY = viewport.offsetY + sound.y * tileSize * viewport.zoom;
        const rectWidth = (sound.type === "ambientZone" || sound.type === "musicZone" ? width : 1) * tileSize * viewport.zoom;
        const rectHeight = (sound.type === "ambientZone" || sound.type === "musicZone" ? height : 1) * tileSize * viewport.zoom;
        return rectX <= maxX && rectX + rectWidth >= minX && rectY <= maxY && rectY + rectHeight >= minY;
      })
      .map(({ index }) => index);
  };

  const updateEntitySelectionCell = (draft, primaryIndex = draft.interaction.selectedEntityIndex) => {
    const entities = draft.document.active?.entities || [];
    const entity = typeof draft.interaction.selectedEntityId === "string" && draft.interaction.selectedEntityId.trim()
      ? entities.find((candidate) => candidate?.id === draft.interaction.selectedEntityId) || null
      : Number.isInteger(primaryIndex)
        ? entities[primaryIndex] || null
        : null;
    draft.interaction.selectedCell = entity ? { x: entity.x, y: entity.y } : null;
  };

  const updateSoundSelectionCell = (draft, primaryIndex = getPrimarySelectedSoundIndex(draft.interaction, draft.document.active?.sounds || [])) => {
    const sounds = draft.document.active?.sounds || [];
    const sound = typeof draft.interaction.selectedSoundId === "string" && draft.interaction.selectedSoundId.trim()
      ? sounds.find((candidate) => candidate?.id === draft.interaction.selectedSoundId) || null
      : Number.isInteger(primaryIndex)
        ? sounds[primaryIndex] || null
        : null;
    draft.interaction.selectedCell = sound ? { x: sound.x, y: sound.y } : null;
  };


  const pushEntityUpdateHistory = (history, index, previousEntity, nextEntity) => {
    if (!previousEntity || !nextEntity) return;
    pushHistoryEntry(
      history,
      createEntityEditEntry("update", {
        index,
        anchor: captureObjectLayerAnchor([previousEntity], 0),
        previousEntity: { ...previousEntity, params: cloneEntityParams(previousEntity.params) },
        nextEntity: { ...nextEntity, params: cloneEntityParams(nextEntity.params) },
      }),
    );
  };

  const unwrapCanonicalMutationValue = (rawValue) => {
    if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) && rawValue.__canonicalMutation === true) {
      return {
        itemId: typeof rawValue.itemId === "string" && rawValue.itemId.trim() ? rawValue.itemId.trim() : null,
        value: rawValue.value,
      };
    }

    return {
      itemId: null,
      value: rawValue,
    };
  };

  const unwrapCanonicalParamMutationValue = (rawValue) => {
    if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) return null;
    return {
      ...rawValue,
      itemId: typeof rawValue.itemId === "string" && rawValue.itemId.trim() ? rawValue.itemId.trim() : null,
    };
  };

  const applyEntityFieldUpdate = (doc, entity, field, rawValue) => {
    if (!doc || !entity) return null;
    const tileSize = doc.dimensions?.tileSize || 24;
    const specialVolumeType = isSpecialVolumeEntityType(entity.type);

    if (field === "param") {
      const value = unwrapCanonicalParamMutationValue(rawValue);
      const key = typeof value?.key === "string" ? value.key.trim() : "";
      const path = typeof value?.path === "string" ? value.path.trim() : "";
      if (!key && !path) return null;
      if (!isSupportedEntityParamValue(value.value)) return null;

      if (specialVolumeType && path) {
        const nextEntity = applySpecialVolumeParamChange(entity, path, value.value, tileSize);
        return JSON.stringify(nextEntity.params) === JSON.stringify(entity.params) ? null : nextEntity;
      }

      const currentParams = cloneEntityParams(entity.params);
      if (currentParams[key] === value.value) return null;
      return { ...entity, params: { ...currentParams, [key]: value.value } };
    }

    const { value } = unwrapCanonicalMutationValue(rawValue);

    if (field === "name" || field === "type") {
      const trimmed = String(value || "").trim();
      const nextValue = trimmed || entity[field];
      if (entity[field] === nextValue) return null;

      if (field === "type") {
        const preset = resolveEntityPlacementPreset(nextValue);
        return {
          ...entity,
          type: preset?.type || nextValue,
          params: {
            ...getEntityPresetDefaultParams(preset?.id || DEFAULT_ENTITY_PRESET_ID),
            ...cloneEntityParams(entity.params),
          },
        };
      }

      return { ...entity, name: nextValue, params: cloneEntityParams(entity.params) };
    }

    if (field === "visible") {
      const nextVisible = Boolean(value);
      if (entity.visible === nextVisible) return null;
      return { ...entity, visible: nextVisible, params: cloneEntityParams(entity.params) };
    }

    if (field === "x" || field === "y") {
      const parsed = Number.parseInt(String(value), 10);
      if (!Number.isInteger(parsed)) return null;
      const nextPosition = clampEntityPosition(
        doc,
        field === "x" ? parsed : entity.x,
        field === "y" ? parsed : entity.y,
      );
      if (entity.x === nextPosition.x && entity.y === nextPosition.y) return null;
      const positionedEntity = { ...entity, x: nextPosition.x, y: nextPosition.y, params: cloneEntityParams(entity.params) };
      return specialVolumeType
        ? syncSpecialVolumeEntityToAnchor(positionedEntity, tileSize)
        : positionedEntity;
    }

    return null;
  };

  const applySoundFieldUpdate = (doc, sound, field, value) => {
    if (!doc || !sound) return null;

    if (field === "param") {
      const paramValue = unwrapCanonicalParamMutationValue(value);
      const key = typeof paramValue?.key === "string" ? paramValue.key.trim() : "";
      if (!key || !isSupportedEntityParamValue(paramValue?.value)) return null;

      const nextParams = { ...cloneEntityParams(sound.params), [key]: paramValue.value };
      if (cloneEntityParams(sound.params)[key] === paramValue.value) return null;
      return { ...sound, params: nextParams };
    }

    const normalizedValue = unwrapCanonicalMutationValue(value).value;

    if (field === "name" || field === "type" || field === "source") {
      const trimmed = String(normalizedValue || "").trim();
      const preset = field === "type" ? getSoundPresetForType(trimmed || sound[field]) : null;
      const nextValue = field === "type"
        ? normalizeSoundType(preset?.type || trimmed || sound[field])
        : field === "source"
          ? normalizeSoundSourceValue(normalizedValue)
          : trimmed || sound[field];
      const previousValue = field === "source" ? sound.source || null : sound[field];
      if (previousValue === nextValue) return null;

      return {
        ...sound,
        ...(field === "source"
          ? nextValue
            ? { source: nextValue }
            : { source: undefined }
          : { [field]: nextValue }),
        params: field === "type"
          ? { ...getSoundPresetDefaultParams(preset?.id || DEFAULT_SOUND_PRESET_ID), ...cloneEntityParams(sound.params) }
          : cloneEntityParams(sound.params),
      };
    }

    if (field === "visible") {
      const nextVisible = Boolean(normalizedValue);
      if (sound.visible === nextVisible) return null;
      return { ...sound, visible: nextVisible, params: cloneEntityParams(sound.params) };
    }

    if (field === "x" || field === "y") {
      const parsed = Number.parseInt(String(normalizedValue), 10);
      if (!Number.isInteger(parsed)) return null;
      const nextPosition = clampSoundPosition(
        doc,
        field === "x" ? parsed : sound.x,
        field === "y" ? parsed : sound.y,
      );
      if (sound.x === nextPosition.x && sound.y === nextPosition.y) return null;
      return {
        ...sound,
        x: nextPosition.x,
        y: nextPosition.y,
        params: cloneEntityParams(sound.params),
      };
    }

    return null;
  };

  const applyCanonicalEntityUpdate = (draft, action) => {
    const changed = applyCleanRoomEntityHistoryAction(draft, action, "forward");
    if (!changed) return false;
    recordCleanRoomObjectAction("entity", action);
    return true;
  };

  const applyCanonicalDecorUpdate = (draft, action) => {
    const changed = applyCleanRoomDecorHistoryAction(draft, action, "forward");
    if (!changed) return false;
    recordCleanRoomObjectAction("decor", action);
    return true;
  };

  const applyCanonicalSoundUpdate = (draft, action) => {
    const changed = applyCleanRoomSoundHistoryAction(draft, action, "forward");
    if (!changed) return false;
    recordCleanRoomObjectAction("sound", action);
    return true;
  };

  const applyBatchSoundUpdate = (draft, indices, field, value) => {
    const doc = draft.document.active;
    if (!doc || !indices.length) return false;

    const items = [];
    for (const index of indices) {
      const sound = doc.sounds?.[index];
      const nextSound = applySoundFieldUpdate(doc, sound, field, value);
      if (!sound || !nextSound) continue;
      items.push({
        index,
        previousSound: { ...sound, params: cloneEntityParams(sound.params) },
        nextSound: { ...nextSound, params: cloneEntityParams(nextSound.params) },
      });
    }
    if (!items.length) return false;

    return applyCanonicalSoundUpdate(draft, {
      type: "update",
      items,
    });
  };

  const selectRelatedSounds = (draft, referenceIndex, mode) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const options = mode === "same-source"
      ? { matchType: false, matchSource: true }
      : mode === "same-type-source"
        ? { matchType: true, matchSource: true }
        : { matchType: true, matchSource: false };
    const nextSelection = findMatchingSoundIndices(doc.sounds || [], referenceIndex, options);
    if (!nextSelection.length) return false;

    setSoundSelection(draft.interaction, nextSelection, nextSelection.includes(referenceIndex) ? referenceIndex : nextSelection.at(-1) ?? null, doc.sounds || []);
    setHoveredSound(draft, Number.isInteger(referenceIndex) ? referenceIndex : nextSelection.at(-1) ?? null);
    clearEntitySelection(draft.interaction);
    clearDecorSelection(draft.interaction);
    draft.interaction.hoveredEntityIndex = null;
    draft.interaction.hoveredDecorId = null;
    draft.interaction.hoveredDecorIndex = null;
    draft.interaction.entityDrag = null;
    draft.interaction.decorDrag = null;
    applyCanvasTarget(draft, "sound");
    updateSoundSelectionCell(draft, getPrimarySelectedSoundIndex(draft.interaction, doc.sounds || []));
    return true;
  };

  const moveDecorSelectionByDelta = (draft, originPositions, delta) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const items = [];
    for (const origin of Array.isArray(originPositions) ? originPositions : []) {
      const index = getDecorIndexById(doc.decor || [], origin.decorId);
      const decor = Number.isInteger(index) ? doc.decor?.[index] : null;
      if (!decor) continue;

      const nextPosition = clampDecorPosition(doc, origin.x + delta.x, origin.y + delta.y);
      if (decor.x === nextPosition.x && decor.y === nextPosition.y) continue;

      items.push({
        index,
        previousDecor: cloneCanonicalDecorSnapshot(decor),
        nextDecor: cloneCanonicalDecorSnapshot({
          ...decor,
          x: nextPosition.x,
          y: nextPosition.y,
        }),
      });
    }

    if (!items.length) return false;

    return applyCanonicalDecorUpdate(draft, {
      type: "update",
      items,
    });
  };

  const moveSoundSelectionByDelta = (draft, originPositions, delta) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const items = [];
    for (const origin of Array.isArray(originPositions) ? originPositions : []) {
      const soundId = typeof origin?.soundId === "string" && origin.soundId.trim() ? origin.soundId : null;
      if (!soundId) continue;

      const index = getSoundIndexById(doc.sounds || [], soundId);
      const sound = Number.isInteger(index) ? doc.sounds?.[index] : null;
      if (!sound) continue;

      const nextPosition = clampSoundPosition(doc, origin.x + delta.x, origin.y + delta.y);
      if (sound.x === nextPosition.x && sound.y === nextPosition.y) continue;

      items.push({
        index,
        previousSound: cloneCanonicalSoundSnapshot(sound),
        nextSound: cloneCanonicalSoundSnapshot({
          ...sound,
          x: nextPosition.x,
          y: nextPosition.y,
        }),
      });
    }

    if (!items.length) return false;

    return applyCanonicalSoundUpdate(draft, {
      type: "update",
      items,
    });
  };


  const beginCleanRoomSoundDrag = (draft, soundId, anchorCell) => {
    const doc = draft.document.active;
    if (!doc || !anchorCell || typeof soundId !== "string" || !soundId.trim()) return false;

    const selectedSoundIds = Array.isArray(draft.interaction.selectedSoundIds)
      ? draft.interaction.selectedSoundIds.filter((selectedId) => typeof selectedId === "string" && selectedId.trim())
      : [];
    if (selectedSoundIds.length !== 1 || draft.interaction.selectedSoundId !== soundId) return false;

    const soundIndex = getSoundIndexById(doc.sounds || [], soundId);
    const sound = Number.isInteger(soundIndex) ? doc.sounds?.[soundIndex] : null;
    if (!sound?.visible) return false;

    draft.interaction.soundDrag = {
      active: true,
      leadSoundId: soundId,
      anchorCell: { x: anchorCell.x, y: anchorCell.y },
      previewDelta: { x: 0, y: 0 },
      originPositions: [
        {
          soundId,
          x: sound.x,
          y: sound.y,
        },
      ],
    };
    draft.interaction.hoverCell = anchorCell;
    setHoveredSound(draft, soundId);
    draft.interaction.selectedCell = { x: sound.x, y: sound.y };
    return true;
  };

  const commitCleanRoomSoundDrag = (draft, soundDrag) => {
    const doc = draft.document.active;
    if (!doc || !soundDrag?.active) return false;

    const leadSoundId = typeof soundDrag.leadSoundId === "string" && soundDrag.leadSoundId.trim()
      ? soundDrag.leadSoundId
      : typeof soundDrag.originPositions?.[0]?.soundId === "string" && soundDrag.originPositions[0].soundId.trim()
        ? soundDrag.originPositions[0].soundId
        : null;
    const origin = soundDrag.originPositions?.find((item) => item?.soundId === leadSoundId) || null;
    if (!leadSoundId || !origin) return false;

    return moveSoundSelectionByDelta(draft, [origin], soundDrag.previewDelta || { x: 0, y: 0 });
  };

  const deleteSelectedDecorCleanRoom = (draft) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const selectedEntries = getSelectedDecor(draft.interaction, doc.decor || []);
    if (!selectedEntries.length) return false;

    const action = {
      type: "delete",
      items: selectedEntries.map(({ index, decor }) => ({
        index,
        decor: cloneCanonicalDecorSnapshot(decor),
      })),
    };

    const changed = applyCleanRoomDecorHistoryAction(draft, action, "forward");
    if (!changed) return false;

    recordCleanRoomObjectAction("decor", action);
    return true;
  };

  const deleteSelectedDecor = (draft) => {
    return deleteSelectedDecorCleanRoom(draft);
  };

  const duplicateSelectedDecor = (draft) => {
    void draft;
    // CANONICAL DECOR RUNTIME ONLY: duplicate stays off until a stable-id clean-room create path replaces the legacy branch.
    return false;
  };

  const createCleanRoomDecorAtCell = (draft, cell, presetId = draft.interaction.activeDecorPresetId || DEFAULT_DECOR_PRESET_ID) => {
    const doc = draft.document.active;
    if (!doc || !cell) return null;

    const entityPreset = resolveEntityPlacementPreset(presetId);
    if (entityPreset) {
      return createEntityAtCell(draft, cell, entityPreset.id);
    }

    const createIndex = doc.decor.length;
    const decor = createDecorDraft(doc, cell.x, cell.y, presetId, (doc.decor?.length || 0) + 1, {
      id: getNextStringId(doc.decor || [], "id", "decor"),
    });
    const action = {
      type: "create",
      items: [
        {
          index: createIndex,
          decor: cloneCanonicalDecorSnapshot(decor),
        },
      ],
    };

    const changed = applyCleanRoomDecorHistoryAction(draft, action, "forward");
    if (!changed) return null;

    recordCleanRoomObjectAction("decor", action);
    return getDecorIndexById(doc.decor, decor.id);
  };

  const applyDecorScatter = (draft, startCell, endCell, presetId = draft.interaction.activeDecorPresetId || DEFAULT_DECOR_PRESET_ID) => {
    const doc = draft.document.active;
    if (!doc || !startCell || !endCell || !presetId) return 0;

    const settings = getDecorScatterSettings(draft.interaction);
    const scatterDecor = createScatterDecorEntries(doc, startCell, endCell, presetId, settings);
    if (!scatterDecor.length) return 0;

    const startIndex = doc.decor.length;
    const action = {
      type: "create",
      items: scatterDecor.map((decor, offset) => ({
        index: startIndex + offset,
        decor: cloneCanonicalDecorSnapshot(decor),
      })),
    };

    const changed = applyCleanRoomDecorHistoryAction(draft, action, "forward");
    if (!changed) return 0;

    recordCleanRoomObjectAction("decor", action);
    return scatterDecor.length;
  };

  const deleteSelectedSoundCleanRoom = (draft) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const selectedEntries = getSelectedSounds(draft.interaction, doc.sounds || []);
    if (!selectedEntries.length) return false;
    const action = {
      type: "delete",
      items: selectedEntries.map(({ index, sound }) => ({
        index,
        sound: cloneCanonicalSoundSnapshot(sound),
      })),
    };

    const changed = applyCleanRoomSoundHistoryAction(draft, action, "forward");
    if (!changed) return false;

    recordCleanRoomObjectAction("sound", action);
    return true;
  };

  const deleteSelectedSound = (draft) => {
    return deleteSelectedSoundCleanRoom(draft);
  };

  const duplicateSelectedSound = (draft) => {
    void draft;
    // CANONICAL SOUND RUNTIME ONLY: duplicate stays disabled until a stable-id clean-room duplication lane exists.
    return false;
  };

  const createCleanRoomSoundAtCell = (draft, cell, presetId = draft.interaction.activeSoundPresetId || DEFAULT_SOUND_PRESET_ID) => {
    const doc = draft.document.active;
    if (!doc || !cell) return null;

    const sound = createSoundDraft(doc, cell.x, cell.y, presetId, (doc.sounds?.length || 0) + 1);
    sound.id = getNextStringId(doc.sounds || [], "id", "sound");
    const createIndex = doc.sounds.length;
    const action = {
      type: "create",
      items: [
        {
          index: createIndex,
          sound: cloneCanonicalSoundSnapshot(sound),
        },
      ],
    };

    const changed = applyCleanRoomSoundHistoryAction(draft, action, "forward");
    if (!changed) return null;

    recordCleanRoomObjectAction("sound", action);
    return getSoundIndexById(doc.sounds, sound.id);
  };

  const updateSound = (index, field, value) => {
    store.setState((draft) => {
      const doc = draft.document.active;
      if (!doc) return;
      const soundItems = doc.sounds || [];

      if (field === "preset") {
        const nextPresetId = typeof value === "string" ? value : null;
        draft.interaction.activeSoundPresetId = draft.interaction.activeSoundPresetId === nextPresetId ? null : nextPresetId;
        draft.interaction.activeEntityPresetId = null;
        draft.interaction.activeDecorPresetId = null;
        draft.interaction.activeTool = EDITOR_TOOLS.INSPECT;
        applyCanvasTarget(draft, "sound");
        return;
      }

      if (field === "clear-preset") {
        draft.interaction.activeSoundPresetId = null;
        return;
      }

      if (field === "delete") {
        deleteSelectedSoundCleanRoom(draft);
        return;
      }

      if (field === "duplicate") {
        duplicateSelectedSound(draft);
        return;
      }

      if (field === "select") {
        if (index >= 0 && index < soundItems.length) {
          const soundId = soundItems[index]?.id || null;
          if (!soundId) return;
          if (value?.toggle) {
            toggleSoundSelection(draft.interaction, soundId, soundItems);
            setHoveredSound(draft, soundId);
            updateSoundSelectionCell(draft, getPrimarySelectedSoundIndex(draft.interaction, soundItems));
          } else {
            selectSoundByIds(draft, [soundId], soundId, {
              clearHover: false,
              hoveredSoundId: soundId,
            });
          }
          clearEntitySelection(draft.interaction);
          clearDecorSelection(draft.interaction);
          draft.interaction.hoveredEntityIndex = null;
          draft.interaction.hoveredDecorId = null;
          draft.interaction.hoveredDecorIndex = null;
          draft.interaction.entityDrag = null;
          draft.interaction.decorDrag = null;
        }
        return;
      }

      if (field === "smart-select") {
        if (index >= 0 && index < soundItems.length) {
          selectRelatedSounds(draft, index, value);
        }
        return;
      }

      if (field === "preview-play") {
        if (draft.scan.playbackState !== "idle") {
          soundPreviewPlayback.stop();
          clearSoundPreviewState(draft, "Preview is unavailable while scan playback is active.");
          return;
        }

        const sound = soundItems[index];
        if (!sound) {
          clearSoundPreviewState(draft, "Select a sound source to preview.");
          return;
        }

        const playbackResult = soundPreviewPlayback.play({
          sound,
          soundIndex: index,
          onEnded: () => {
            store.setState((nextDraft) => {
              if (nextDraft.soundPreview.soundIndex !== index) return;
              clearSoundPreviewState(nextDraft);
            });
          },
          onError: () => {
            store.setState((nextDraft) => {
              if (nextDraft.soundPreview.soundIndex !== index) return;
              clearSoundPreviewState(nextDraft, "Preview failed to load.");
            });
          },
        });

        if (!playbackResult.ok) {
          clearSoundPreviewState(
            draft,
            playbackResult.reason === "missing-source"
              ? "Assign a source asset to preview it."
              : "Preview is unavailable in this browser.",
          );
          return;
        }

        setSoundPreviewState(draft, {
          playbackState: "playing",
          soundIndex: index,
          soundId: sound.id || null,
          source: playbackResult.source,
          error: null,
        });
        return;
      }

      if (field === "preview-stop") {
        clearSoundPreviewState(draft);
        soundPreviewPlayback.stop();
        return;
      }

      if (
        field === "param"
        || field === "name"
        || field === "type"
        || field === "source"
        || field === "visible"
        || field === "x"
        || field === "y"
      ) {
        if (index === -1) {
          const selectedIds = Array.isArray(draft.interaction.selectedSoundIds)
            ? draft.interaction.selectedSoundIds.filter((itemId) => typeof itemId === "string" && itemId.trim())
            : [];
          const indices = selectedIds
            .map((itemId) => getSoundIndexById(soundItems, itemId))
            .filter((itemIndex) => Number.isInteger(itemIndex) && itemIndex >= 0);
          applyBatchSoundUpdate(draft, indices, field, value);
          return;
        }

        const mutationItemId = unwrapCanonicalMutationValue(value).itemId
          || unwrapCanonicalParamMutationValue(value)?.itemId
          || draft.interaction.selectedSoundId
          || soundItems[index]?.id
          || null;
        const resolvedIndex = mutationItemId ? getSoundIndexById(soundItems, mutationItemId) : index;
        const sound = Number.isInteger(resolvedIndex) ? soundItems[resolvedIndex] : null;
        const nextSound = applySoundFieldUpdate(doc, sound, field, value);
        if (!sound || !nextSound) return;

        applyCanonicalSoundUpdate(draft, {
          type: "update",
          items: [
            {
              index: resolvedIndex,
              previousSound: { ...sound, params: cloneEntityParams(sound.params) },
              nextSound: { ...nextSound, params: cloneEntityParams(nextSound.params) },
            },
          ],
        });
        return;
      }
    });
  };


  const beginCleanRoomDecorDrag = (draft, decorId, anchorCell) => {
    const doc = draft.document.active;
    if (!doc || !anchorCell || typeof decorId !== "string" || !decorId.trim()) return false;

    const selectedDecorIds = Array.isArray(draft.interaction.selectedDecorIds)
      ? draft.interaction.selectedDecorIds.filter((selectedId) => typeof selectedId === "string" && selectedId.trim())
      : [];
    if (selectedDecorIds.length !== 1 || draft.interaction.selectedDecorId !== decorId) return false;

    const decorIndex = getDecorIndexById(doc.decor || [], decorId);
    const decor = Number.isInteger(decorIndex) ? doc.decor?.[decorIndex] : null;
    if (!decor?.visible) return false;

    draft.interaction.decorDrag = {
      active: true,
      leadDecorId: decorId,
      anchorCell: { x: anchorCell.x, y: anchorCell.y },
      previewDelta: { x: 0, y: 0 },
      originPositions: [
        {
          decorId,
          x: decor.x,
          y: decor.y,
        },
      ],
    };
    draft.interaction.hoverCell = anchorCell;
    setHoveredDecor(draft, decorId);
    draft.interaction.selectedCell = { x: decor.x, y: decor.y };
    return true;
  };

  const commitCleanRoomDecorDrag = (draft, decorDrag) => {
    const doc = draft.document.active;
    if (!doc || !decorDrag?.active) return false;

    const leadDecorId = typeof decorDrag.leadDecorId === "string" && decorDrag.leadDecorId.trim()
      ? decorDrag.leadDecorId
      : typeof decorDrag.originPositions?.[0]?.decorId === "string" && decorDrag.originPositions[0].decorId.trim()
        ? decorDrag.originPositions[0].decorId
        : null;
    const origin = decorDrag.originPositions?.find((item) => item?.decorId === leadDecorId) || null;
    if (!leadDecorId || !origin) return false;

    return moveDecorSelectionByDelta(draft, [origin], decorDrag.previewDelta || { x: 0, y: 0 });
  };

  const deleteSelectedEntity = (draft) => {
    // CANONICAL ENTITY RUNTIME ONLY: entity delete/history stays on the stable-id runtime.
    return deleteSelectedEntityCleanRoom(draft);
  };

  const duplicateSelectedEntity = (draft) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const entityId = typeof draft.interaction.selectedEntityId === "string" && draft.interaction.selectedEntityId.trim()
      ? draft.interaction.selectedEntityId
      : null;
    if (!entityId) return false;

    const sourceIndex = getEntityIndexById(doc.entities, entityId);
    const sourceEntity = Number.isInteger(sourceIndex) ? doc.entities?.[sourceIndex] : null;
    if (!sourceEntity || isSpawnEntityType(sourceEntity.type) || !isExitEntityType(sourceEntity.type)) {
      return false;
    }

    const nextNumber = (doc.entities?.length || 0) + 1;
    const duplicated = createEntityDraft(doc, sourceEntity.x + 1, sourceEntity.y, sourceEntity.type, nextNumber);
    duplicated.name = sourceEntity.name;
    duplicated.visible = sourceEntity.visible;
    duplicated.params = cloneEntityParams(sourceEntity.params);
    duplicated.id = getNextStringId(doc.entities || [], "id", "entity");

    const action = {
      type: "create",
      index: doc.entities.length,
      entity: cloneCanonicalEntitySnapshot(duplicated),
    };
    const changed = applyCleanRoomEntityHistoryAction(draft, action, "forward");
    if (!changed) return false;
    recordCleanRoomObjectAction("entity", action);
    return true;
  };

  const createEntityAtCell = (draft, cell, presetId = draft.interaction.activeEntityPresetId || DEFAULT_ENTITY_PRESET_ID) => {
    // CANONICAL ENTITY RUNTIME ONLY: entity create/history is routed through the stable-id runtime above.
    return createCleanRoomEntityAtCell(draft, cell, presetId);
  };

  const createDecorAtCell = (draft, cell, presetId = draft.interaction.activeDecorPresetId || DEFAULT_DECOR_PRESET_ID) => {
    // CANONICAL DECOR RUNTIME ONLY: live decor placement must stay on the stable-id clean-room create/history lane.
    return createCleanRoomDecorAtCell(draft, cell, presetId);
  };

  const updateEntity = (index, field, value) => {
    store.setState((draft) => {
      const doc = draft.document.active;
      if (!doc) return;
      const entities = doc.entities;

      if (field === "add") {
        createEntityAtCell(draft, { x: 0, y: 0 });
        return;
      }

      if (field === "preset") {
        const nextPresetId = typeof value === "string" ? value : null;
        const entityPreset = resolveEntityPlacementPreset(nextPresetId);
        draft.interaction.activeEntityPresetId = entityPreset
          ? (draft.interaction.activeEntityPresetId === entityPreset.id ? null : entityPreset.id)
          : null;
        draft.interaction.activeDecorPresetId = null;
        draft.interaction.activeSoundPresetId = null;
        draft.interaction.activeTool = EDITOR_TOOLS.INSPECT;
        applyCanvasTarget(draft, "entity");
        return;
      }

      if (field === "clear-preset") {
        draft.interaction.activeEntityPresetId = null;
        return;
      }

      if (field === "delete") {
        deleteSelectedEntity(draft);
        return;
      }

      if (field === "duplicate") {
        // CANONICAL ENTITY RUNTIME ONLY: duplicate depended on the disabled legacy entity mutation/history engine.
        duplicateSelectedEntity(draft);
        return;
      }

      if (field === "select") {
        if (index >= 0 && index < entities.length) {
          const entityId = entities[index]?.id || null;
          if (!entityId) return;
          const toggleSelection = Boolean(value?.toggle);
          if (toggleSelection) {
            const selectedIds = getEntityIdsFromSelection(draft.interaction, entities);
            const nextSelectedIds = selectedIds.includes(entityId)
              ? selectedIds.filter((selectedId) => selectedId !== entityId)
              : [...selectedIds, entityId];
            selectEntitiesByIds(draft, nextSelectedIds, nextSelectedIds.at(-1) ?? null, {
              clearHover: true,
              clearHoverCell: true,
              clearDrag: true,
            });
          } else {
            selectEntitiesByIds(draft, [entityId], entityId, {
              clearHover: true,
              clearHoverCell: true,
              clearDrag: true,
            });
          }
        }
        return;
      }

      if (
        field === "param"
        || field === "name"
        || field === "type"
        || field === "visible"
        || field === "x"
        || field === "y"
      ) {
        const mutationItemId = unwrapCanonicalMutationValue(value).itemId
          || unwrapCanonicalParamMutationValue(value)?.itemId
          || draft.interaction.selectedEntityId
          || entities[index]?.id
          || null;
        const resolvedIndex = mutationItemId ? getEntityIndexById(entities, mutationItemId) : index;
        const entity = Number.isInteger(resolvedIndex) ? entities[resolvedIndex] : null;
        const nextEntity = applyEntityFieldUpdate(doc, entity, field, value);
        if (!entity || !nextEntity) return;

        applyCanonicalEntityUpdate(draft, {
          type: "update",
          index: resolvedIndex,
          previousEntity: { ...entity, params: cloneEntityParams(entity.params) },
          nextEntity: { ...nextEntity, params: cloneEntityParams(nextEntity.params) },
        });
      }
      return;

    });
  };

  const updateVolume = (index, field, value) => {
    void index;
    void value;
    store.setState((draft) => {
      if (field === "arm-fog" || field === "arm-water" || field === "arm-lava" || field === "arm-bubbling-liquid") {
        const targetType = field === "arm-water"
          ? "water_volume"
          : field === "arm-lava"
            ? "lava_volume"
            : field === "arm-bubbling-liquid"
              ? "bubbling_liquid_volume"
            : "fog_volume";
        const entityPreset = resolveEntityPlacementPreset(targetType);
        if (!entityPreset || !isSpecialVolumeEntityType(entityPreset.type)) return;
        const shouldArm = draft.interaction.activeEntityPresetId !== entityPreset.id;
        draft.interaction.activeEntityPresetId = shouldArm ? entityPreset.id : null;
        draft.interaction.activeDecorPresetId = null;
        draft.interaction.activeSoundPresetId = null;
        draft.interaction.activeTool = EDITOR_TOOLS.INSPECT;
        draft.interaction.volumePlacementDrag = null;
        setCanvasSelectionMode(draft, "entity");
        setActiveLayer(draft, PANEL_LAYERS.ENTITIES);
        clearDecorSelection(draft.interaction);
        clearSoundSelection(draft.interaction);
        if (!shouldArm) {
          draft.ui.specialVolumeWorkbench.openEntityId = null;
        }
        return;
      }

      if (field === "open-fog-workbench") {
        const selectedEntityId = draft.interaction.selectedEntityId;
        if (!selectedEntityId) return;
        const selectedEntity = draft.document.active?.entities?.find((entry) => entry?.id === selectedEntityId);
        if (!isSpecialVolumeEntityType(selectedEntity?.type)) return;
        draft.ui.specialVolumeWorkbench.openEntityId = selectedEntityId;
        draft.ui.specialVolumeWorkbench.activeType = getSpecialVolumeType(selectedEntity?.type);
        setCanvasSelectionMode(draft, "entity");
        setActiveLayer(draft, PANEL_LAYERS.ENTITIES);
        return;
      }

      if (field === "preset") {
        const nextPresetId = typeof value === "string" ? value : null;
        const entityPreset = resolveEntityPlacementPreset(nextPresetId);
        if (!entityPreset || !isSpecialVolumeEntityType(entityPreset.type)) {
          draft.interaction.activeEntityPresetId = null;
          return;
        }
        draft.interaction.activeEntityPresetId = draft.interaction.activeEntityPresetId === entityPreset.id ? null : entityPreset.id;
        draft.interaction.activeDecorPresetId = null;
        draft.interaction.activeSoundPresetId = null;
        draft.interaction.activeTool = EDITOR_TOOLS.INSPECT;
        draft.interaction.volumePlacementDrag = null;
        setCanvasSelectionMode(draft, "entity");
        setActiveLayer(draft, PANEL_LAYERS.ENTITIES);
        clearDecorSelection(draft.interaction);
        clearSoundSelection(draft.interaction);
        return;
      }

      if (field === "clear-preset") {
        draft.interaction.activeEntityPresetId = null;
        draft.interaction.volumePlacementDrag = null;
      }
    });
  };

  const updateDecor = (index, field, value) => {
    store.setState((draft) => {
      const doc = draft.document.active;
      if (!doc) return;
      const decorItems = doc.decor || [];

      if (field === 'preset') {
        const nextPresetId = typeof value === 'string' ? value : null;
        const entityPreset = resolveEntityPlacementPreset(nextPresetId);
        if (entityPreset) {
          draft.interaction.activeEntityPresetId =
            draft.interaction.activeEntityPresetId === entityPreset.id ? null : entityPreset.id;
          draft.interaction.activeDecorPresetId = null;
          draft.interaction.activeSoundPresetId = null;
          draft.interaction.activeTool = EDITOR_TOOLS.INSPECT;
          applyCanvasTarget(draft, "entity");
          clearDecorScatterDrag(draft);
          return;
        }

        draft.interaction.activeDecorPresetId =
          draft.interaction.activeDecorPresetId === nextPresetId ? null : nextPresetId;
        draft.interaction.activeEntityPresetId = null;
        draft.interaction.activeSoundPresetId = null;
        draft.interaction.activeTool = EDITOR_TOOLS.INSPECT;
        applyCanvasTarget(draft, "decor");
        clearDecorScatterDrag(draft);
        return;
      }

      if (field === 'clear-preset') {
        draft.interaction.activeDecorPresetId = null;
        draft.interaction.decorScatterMode = false;
        clearDecorScatterDrag(draft);
        return;
      }

      if (field === "toggle-scatter") {
        draft.interaction.decorScatterMode = !draft.interaction.decorScatterMode;
        draft.interaction.activeTool = EDITOR_TOOLS.INSPECT;
        if (!draft.interaction.decorScatterMode) {
          clearDecorScatterDrag(draft);
        }
        return;
      }

      if (field === "scatter-setting") {
        if (!value || typeof value !== "object" || Array.isArray(value)) return;

        const settingField = value.field;
        if (settingField === "density") {
          draft.interaction.decorScatterSettings.density = clampScatterDensity(value.value);
          return;
        }

        if (settingField === "randomness") {
          draft.interaction.decorScatterSettings.randomness = clampScatterRandomness(value.value);
          return;
        }

        if (settingField === "variantMode") {
          draft.interaction.decorScatterSettings.variantMode = value.value === "random" ? "random" : "fixed";
        }
        return;
      }

      if (field === 'delete') {
        deleteSelectedDecor(draft);
        return;
      }

      if (field === 'duplicate') {
        duplicateSelectedDecor(draft);
        return;
      }

      if (field === 'select') {
        if (index >= 0 && index < decorItems.length) {
          const decorId = decorItems[index]?.id || null;
          if (!decorId) return;
          const selectedDecorIds = getSelectedDecorIds(draft.interaction);
          const nextSelectedDecorIds = value?.toggle
            ? (selectedDecorIds.includes(decorId)
              ? selectedDecorIds.filter((selectedId) => selectedId !== decorId)
              : [...selectedDecorIds, decorId])
            : [decorId];
          selectDecorByIds(draft, nextSelectedDecorIds, nextSelectedDecorIds.at(-1) ?? null, {
            clearHover: true,
            clearHoverCell: true,
          });
        }
        return;
      }

      const decor = decorItems[index];
      if (!decor) return;

      if (field === "param") {
        const mutation = unwrapCanonicalParamMutationValue(value);
        const paramKey = typeof mutation?.key === "string" ? mutation.key.trim() : "";
        const isFlower = String(decor?.type || "").trim().toLowerCase() === "decor_flower_01";
        const parsedVariant = Number.parseInt(String(mutation?.value ?? ""), 10);
        if (!isFlower || paramKey !== "variant" || !Number.isInteger(parsedVariant)) return;

        const clampedVariant = Math.max(1, Math.min(4, parsedVariant));
        const previousDecor = cloneCanonicalDecorSnapshot(decor);
        const nextDecor = cloneCanonicalDecorSnapshot({
          ...decor,
          params: {
            ...cloneEntityParams(decor.params),
            variant: clampedVariant,
          },
        });
        if (previousDecor?.params?.variant === nextDecor?.params?.variant) return;

        applyCanonicalDecorUpdate(draft, {
          type: "update",
          items: [{ index, previousDecor, nextDecor }],
        });
        return;
      }

      if (field === "param" || field === 'name' || field === 'type' || field === 'variant' || field === 'visible' || field === 'x' || field === 'y') {
        // CANONICAL DECOR RUNTIME ONLY: the old inspect mutation lane stays disabled until a stable-id clean-room edit path replaces it.
        return;
      }
    });
  };

  const updateScanControl = (field, rawValue) => {
    store.setState((draft) => {
      const doc = draft.document.active;
      if (!doc) return;

      if (field === "play") {
        startScanPlayback(draft);
        return;
      }

      if (field === "pause") {
        pauseScanPlayback(draft);
        return;
      }

      if (field === "stop") {
        stopScanPlayback(draft, true);
        return;
      }

      if (field === "clear-log") {
        draft.scan.eventLog = [];
        draft.scan.lastEventSummary = null;
        return;
      }

      if (field === "speed") {
        draft.scan.speed = clampScanSpeed(rawValue, draft.scan.speed);
        return;
      }

      if (field === "startX" || field === "endX") {
        const width = Number(doc.dimensions?.width) || 0;
        draft.scan[field] = rawValue === "" ? null : sanitizeOptionalScanCoordinate(rawValue, width);
        const { startX, endX } = getScanRange(draft.scan, doc);
        if (draft.scan.positionX < startX || draft.scan.positionX > endX || getScanPlaybackState(draft.scan) === "idle") {
          draft.scan.positionX = startX;
        }
        applyScanEvaluation(draft, draft.scan.positionX, draft.scan.positionX);
        draft.scan.lastFrameTime = null;
        if (getScanPlaybackState(draft.scan) === "idle") {
          draft.scan.viewportSnapshot = null;
        }
      }
    });

    if (field === "play" && isScanPlaying(store.getState().scan)) {
      scheduleScanFrame(scanPlaybackToken);
    }
  };

  const draw = (state) => {
    const soundSnapshot = createSoundDebugSnapshot(state);
    const nextSelectionSignature = getSoundDebugSelectionSignature(soundSnapshot);
    if (soundDebugState.lastSelectionSignature !== null && soundDebugState.lastSelectionSignature !== nextSelectionSignature) {
      appendSoundDebugEvent("sound selection change", "selection fields changed", soundDebugState.lastSelectionSnapshot, soundSnapshot);
    }
    soundDebugState.lastSelectionSignature = nextSelectionSignature;
    soundDebugState.lastSelectionSnapshot = soundSnapshot;

    const nextPreviewSignature = getSoundDebugPreviewSignature(soundSnapshot);
    if (soundDebugState.lastPreviewSignature !== null && soundDebugState.lastPreviewSignature !== nextPreviewSignature) {
      appendSoundDebugEvent(
        "placement preview render decision",
        soundSnapshot.preview.eligible
          ? `shown · ${soundSnapshot.preview.reason}`
          : `suppressed · ${soundSnapshot.preview.reason}`,
        soundDebugState.lastPreviewSnapshot,
        soundSnapshot,
      );
    }
    soundDebugState.lastPreviewSignature = nextPreviewSignature;
    soundDebugState.lastPreviewSnapshot = soundSnapshot;

    renderEditorFrame(ctx, state);
    minimapLayout = renderMinimap(minimapCtx, state);
    renderInspector(inspector, state);
    renderBottomPanel(bottomPanel, state);
    renderBrushPanel(brushPanel, state);
    renderCellHud(cellHud, state);
    renderTopBar(state);
    renderFloatingPanels(state);
    bottomPanel.dataset.selectionTarget = getActiveLayer(state.interaction);
  };

  const handleMinimapClick = (event) => {
    const state = store.getState();
    const doc = state.document.active;
    if (!doc || !minimapLayout) return;

    const point = getCanvasPointFromMouseEvent(minimapCanvas, event);
    const worldPoint = getWorldPointFromMinimapPoint(minimapLayout, point.x, point.y);
    if (!worldPoint) return;

    const canvasRect = canvas.getBoundingClientRect();

    store.setState((draft) => {
      draft.viewport.offsetX = canvasRect.width * 0.5 - worldPoint.x * draft.viewport.zoom;
      draft.viewport.offsetY = canvasRect.height * 0.5 - worldPoint.y * draft.viewport.zoom;
    });
  };

  const updateHoveredCanvasState = (event) => {
    const state = store.getState();
    if (!state.document.active) return;
    const beforeSnapshot = createSoundDebugSnapshot(state);

    trackCanvasPointerEvent(event);
    const point = getCanvasPointFromMouseEvent(canvas, event);
    syncPausedScanHover(state, point);
    const nextHoverCell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    const nextHoveredEntityIndex = findEntityAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    const nextHoveredDecorIndex = findDecorAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    const nextHoveredSoundIndex = findSoundAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    const currentCell = state.interaction.hoverCell;
    const currentHoveredEntityIndex = state.interaction.hoveredEntityIndex;
    const currentHoveredDecorIndex = state.interaction.hoveredDecorIndex;
    const currentHoveredSoundIndex = state.interaction.hoveredSoundIndex;
    const cellUnchanged = currentCell?.x === nextHoverCell?.x && currentCell?.y === nextHoverCell?.y;

    if (
      cellUnchanged &&
      currentHoveredEntityIndex === (nextHoveredEntityIndex >= 0 ? nextHoveredEntityIndex : null) &&
      currentHoveredDecorIndex === (nextHoveredDecorIndex >= 0 ? nextHoveredDecorIndex : null) &&
      currentHoveredSoundIndex === (nextHoveredSoundIndex >= 0 ? nextHoveredSoundIndex : null) &&
      !state.interaction.objectPlacementPreviewSuppressed
    ) {
      appendSoundDebugEvent(
        "canvas mousemove",
        `point=${Math.round(point.x)},${Math.round(point.y)} no hover change`,
        beforeSnapshot,
        beforeSnapshot,
      );
      return;
    }

    store.setState((draft) => {
      draft.interaction.hoverCell = nextHoverCell;
      draft.interaction.hoveredEntityIndex = nextHoveredEntityIndex >= 0 ? nextHoveredEntityIndex : null;
      draft.interaction.hoveredEntityId = nextHoveredEntityIndex >= 0
        ? getEntityIdAtIndex(draft.document.active?.entities || [], nextHoveredEntityIndex)
        : null;
      setHoveredDecor(draft, nextHoveredDecorIndex >= 0 ? nextHoveredDecorIndex : null);
      setHoveredSound(draft, nextHoveredSoundIndex >= 0 ? nextHoveredSoundIndex : null);
      resumeObjectPlacementPreviews(draft, "canvas mousemove");
      appendSoundDebugEvent(
        "canvas mousemove",
        `point=${Math.round(point.x)},${Math.round(point.y)} cell=${formatSoundDebugCell(nextHoverCell)}`,
        beforeSnapshot,
        createSoundDebugSnapshot(draft),
      );
    });
  };

  const clearHoveredCanvasState = () => {
    const state = store.getState();
    clearTrackedCanvasPointer();
    interactionState.hoveringPausedScanHandle = false;
    syncCanvasCursor();
    if (!state.interaction.hoverCell && state.interaction.hoveredEntityIndex === null && state.interaction.hoveredDecorIndex === null && state.interaction.hoveredSoundIndex === null) return;

    store.setState((draft) => {
      draft.interaction.hoverCell = null;
      draft.interaction.hoveredEntityIndex = null;
      draft.interaction.hoveredEntityId = null;
      setHoveredDecor(draft, null);
      clearHoveredSound(draft.interaction);
      resumeObjectPlacementPreviews(draft);
    });
  };

  const applyTileToolAtCell = (draft, cell) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const brushSize = resolveBrushSize(draft.brush.activeDraft);
    const brushScale = Math.max(1, brushSize.width, brushSize.height);
    const { width, height } = doc.dimensions;
    const activeLayer = getActiveLayer(draft.interaction);
    const isBackgroundLayer = activeLayer === PANEL_LAYERS.BACKGROUND;
    const nextBackgroundMaterialId = draft.interaction.activeBackgroundMaterialId || DEFAULT_BACKGROUND_MATERIAL_ID;

    if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) return false;

    if (
      draft.interaction.activeTool === EDITOR_TOOLS.PAINT ||
      draft.interaction.activeTool === EDITOR_TOOLS.FILL ||
      draft.interaction.activeTool === EDITOR_TOOLS.RECT ||
      draft.interaction.activeTool === EDITOR_TOOLS.LINE
    ) {
      const tileValue = resolveTileFromBrushDraft(draft.brush.activeDraft);
      if (isBackgroundLayer) {
        const previousPlacements = (doc.background.placements || []).map((placement) => ({ ...placement }));
        const previousBase = doc.background.base.slice();
        const changed = paintSizedPlacement(doc, "background", cell, brushScale, nextBackgroundMaterialId);
        if (!changed) return false;
        const entry = createSizedPlacementEditEntry(
          "background",
          previousPlacements,
          (doc.background.placements || []).map((placement) => ({ ...placement })),
          previousBase,
          doc.background.base.slice(),
        );
        pushHistoryEntry(draft.history, entry);
        return true;
      }

      const previousPlacements = (doc.tiles.placements || []).map((placement) => ({ ...placement }));
      const previousBase = doc.tiles.base.slice();
      const changed = paintSizedPlacement(doc, "tiles", cell, brushScale, tileValue);
      if (!changed) return false;
      const entry = createSizedPlacementEditEntry(
        "tiles",
        previousPlacements,
        (doc.tiles.placements || []).map((placement) => ({ ...placement })),
        previousBase,
        doc.tiles.base.slice(),
      );
      pushHistoryEntry(draft.history, entry);
      return true;
    }

    if (draft.interaction.activeTool === EDITOR_TOOLS.ERASE) {
      if (isBackgroundLayer) {
        const previousPlacements = (doc.background.placements || []).map((placement) => ({ ...placement }));
        const previousBase = doc.background.base.slice();
        const sizedChanged = eraseSizedPlacementAtCell(doc, "background", cell);
        if (sizedChanged) {
          const entry = createSizedPlacementEditEntry(
            "background",
            previousPlacements,
            (doc.background.placements || []).map((placement) => ({ ...placement })),
            previousBase,
            doc.background.base.slice(),
          );
          pushHistoryEntry(draft.history, entry);
          return true;
        }

        const index = getTileIndex(width, cell.x, cell.y);
        const previousValue = doc.background.base[index] ?? null;
        const changed = eraseBackgroundMaterial(doc, cell);
        if (!changed) return false;
        const entry = createTileEditEntry(doc, cell, previousValue, null, "background");
        pushTileEdit(draft.history, entry);
        return true;
      }

      const previousPlacements = (doc.tiles.placements || []).map((placement) => ({ ...placement }));
      const previousBase = doc.tiles.base.slice();
      const sizedChanged = eraseSizedPlacementAtCell(doc, "tiles", cell);
      if (sizedChanged) {
        const entry = createSizedPlacementEditEntry(
          "tiles",
          previousPlacements,
          (doc.tiles.placements || []).map((placement) => ({ ...placement })),
          previousBase,
          doc.tiles.base.slice(),
        );
        pushHistoryEntry(draft.history, entry);
        return true;
      }

      const index = getTileIndex(width, cell.x, cell.y);
      const previousValue = doc.tiles.base[index];
      const changed = eraseSingleTile(doc, cell);
      if (!changed) return false;
      const entry = createTileEditEntry(doc, cell, previousValue, 0);
      pushTileEdit(draft.history, entry);
      return true;
    }

    return false;
  };

  const getSteppedRectAnchors = (startCell, endCell, brushSize) => {
    const minX = Math.min(startCell.x, endCell.x);
    const maxX = Math.max(startCell.x, endCell.x);
    const minY = Math.min(startCell.y, endCell.y);
    const maxY = Math.max(startCell.y, endCell.y);
    const anchors = [];
    const seenAnchors = new Set();

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const anchor = snapCellToBrushStep({ x, y }, startCell, brushSize);
        const key = `${anchor.x}:${anchor.y}`;
        if (seenAnchors.has(key)) continue;
        seenAnchors.add(key);
        anchors.push(anchor);
      }
    }

    return anchors;
  };

  const applyRectTool = (draft, startCell, endCell) => {
    const brushSize = resolveBrushSize(draft.brush.activeDraft);
    let changedAny = false;

    const anchors = getSteppedRectAnchors(startCell, endCell, brushSize);
    for (const anchor of anchors) {
      if (applyTileToolAtCell(draft, anchor)) {
        changedAny = true;
      }
    }

    return changedAny;
  };


  const applyFillTool = (draft, startCell) => {
    const doc = draft.document.active;
    if (!doc || !startCell) return false;

    const activeLayer = getActiveLayer(draft.interaction);
    const isBackgroundLayer = activeLayer === PANEL_LAYERS.BACKGROUND;
    const replacementValue = isBackgroundLayer
      ? (draft.interaction.activeBackgroundMaterialId || DEFAULT_BACKGROUND_MATERIAL_ID)
      : resolveTileFromBrushDraft(draft.brush.activeDraft);
    const fillCells = isBackgroundLayer
      ? getBackgroundFloodFillCells(doc, startCell, replacementValue)
      : getFloodFillCells(doc, startCell, replacementValue);

    if (fillCells.length === 0) return false;

    let changedAny = false;

    const brushSize = resolveBrushSize(draft.brush.activeDraft);
    const fillCellKeys = new Set(fillCells.map((cell) => `${cell.x}:${cell.y}`));
    const footprintAnchorByCell = new Map();
    for (const cell of fillCells) {
      const anchor = snapCellToBrushStep(cell, startCell, brushSize);
      const key = `${anchor.x}:${anchor.y}`;
      if (!footprintAnchorByCell.has(key)) {
        footprintAnchorByCell.set(key, anchor);
      }
    }

    for (const anchor of footprintAnchorByCell.values()) {
      const footprintCells = getBrushCells(anchor, brushSize);
      if (!footprintCells.every((cell) => fillCellKeys.has(`${cell.x}:${cell.y}`))) continue;
      if (applyTileToolAtCell(draft, anchor)) {
        changedAny = true;
      }
    }

    return changedAny;
  };
  const applyLineTool = (draft, startCell, endCell) => {
    const lineCells = getLineCells(startCell, endCell);
    const brushSize = resolveBrushSize(draft.brush.activeDraft);
    let changedAny = false;
    const seenAnchors = new Set();

    for (const cell of lineCells) {
      const anchor = snapCellToBrushStep(cell, startCell, brushSize);
      const key = `${anchor.x}:${anchor.y}`;
      if (seenAnchors.has(key)) continue;
      seenAnchors.add(key);
      if (applyTileToolAtCell(draft, anchor)) {
        changedAny = true;
      }
    }

    return changedAny;
  };

  const isMomentaryPlacementTrigger = (event) => event.altKey;

  const isDecorScatterReady = (interaction, event) =>
    isMomentaryPlacementTrigger(event) &&
    getActiveLayer(interaction) === PANEL_LAYERS.DECOR &&
    interaction.activeTool === EDITOR_TOOLS.INSPECT &&
    interaction.decorScatterMode &&
    Boolean(interaction.activeDecorPresetId);

  const handleCleanRoomEntitySelectionHit = (draft, entityId) => {
    syncCleanRoomEntitySelection(draft, entityId);
  };

  const beginCleanRoomEntityDrag = (draft, entityId, anchorCell) => {
    const doc = draft.document.active;
    if (!doc || !anchorCell || typeof entityId !== "string" || !entityId.trim()) return false;

    const selectedEntityIds = Array.isArray(draft.interaction.selectedEntityIds)
      ? draft.interaction.selectedEntityIds.filter((selectedId) => typeof selectedId === "string" && selectedId.trim())
      : [];
    if (selectedEntityIds.length !== 1 || draft.interaction.selectedEntityId !== entityId) return false;

    const entityIndex = getEntityIndexById(doc.entities || [], entityId);
    const entity = Number.isInteger(entityIndex) ? doc.entities?.[entityIndex] : null;
    if (!entity) return false;
    draft.interaction.entityDrag = {
      active: true,
      leadEntityId: entityId,
      anchorCell: { x: anchorCell.x, y: anchorCell.y },
      previewDelta: { x: 0, y: 0 },
      originPositions: [
        {
          entityId,
          x: entity.x,
          y: entity.y,
        },
      ],
    };
    draft.interaction.hoveredEntityIndex = entityIndex;
    draft.interaction.hoveredEntityId = entityId;
    draft.interaction.hoverCell = anchorCell;
    draft.interaction.selectedCell = { x: entity.x, y: entity.y };
    return true;
  };

  const commitCleanRoomEntityDrag = (draft, entityDrag) => {
    const doc = draft.document.active;
    if (!doc || !entityDrag?.active) return false;

    const leadEntityId = typeof entityDrag.leadEntityId === "string" && entityDrag.leadEntityId.trim()
      ? entityDrag.leadEntityId
      : typeof entityDrag.originPositions?.[0]?.entityId === "string" && entityDrag.originPositions[0].entityId.trim()
        ? entityDrag.originPositions[0].entityId
        : null;
    const origin = entityDrag.originPositions?.find((item) => item?.entityId === leadEntityId) || null;
    if (!leadEntityId || !origin) return false;

    const index = getEntityIndexById(doc.entities || [], leadEntityId);
    const entity = Number.isInteger(index) ? doc.entities?.[index] : null;
    if (!entity) return false;

    const delta = entityDrag.previewDelta || { x: 0, y: 0 };
    const nextPosition = clampEntityPosition(doc, origin.x + delta.x, origin.y + delta.y);
    const nextEntity = isFogVolumeEntityType(entity.type)
      ? shiftFogVolumeEntity(
        entity,
        nextPosition.x - origin.x,
        nextPosition.y - origin.y,
        doc.dimensions.tileSize,
      )
      : isWaterVolumeEntityType(entity.type)
        ? shiftWaterVolumeEntity(
          entity,
          nextPosition.x - origin.x,
          nextPosition.y - origin.y,
          doc.dimensions.tileSize,
        )
        : isLavaVolumeEntityType(entity.type)
          ? shiftLavaVolumeEntity(
            entity,
            nextPosition.x - origin.x,
            nextPosition.y - origin.y,
            doc.dimensions.tileSize,
          )
          : isBubblingLiquidVolumeEntityType(entity.type)
            ? shiftBubblingLiquidVolumeEntity(
              entity,
              nextPosition.x - origin.x,
              nextPosition.y - origin.y,
              doc.dimensions.tileSize,
            )
        : {
          ...entity,
          x: nextPosition.x,
          y: nextPosition.y,
          params: cloneEntityParams(entity.params),
        };
    if (JSON.stringify(nextEntity) === JSON.stringify(entity)) return false;

    return applyCanonicalEntityUpdate(draft, {
      type: "update",
      index,
      previousEntity: cloneCanonicalEntitySnapshot(entity),
      nextEntity: cloneCanonicalEntitySnapshot(nextEntity),
    });
  };

  const handleCleanRoomEntityInspectMouseDown = (event, state, cell, point) => {
    const activeLayer = getActiveLayer(state.interaction);
    if (activeLayer !== PANEL_LAYERS.ENTITIES) return false;

    const activeEntityPresetId = state.interaction.activeEntityPresetId;
    if (isSpecialVolumeEntityType(activeEntityPresetId) && isMomentaryPlacementTrigger(event)) return false;
    if (activeEntityPresetId && !isSpecialVolumeEntityType(activeEntityPresetId) && isMomentaryPlacementTrigger(event)) {
      interactionState.suppressNextClick = true;
      event.preventDefault();
      store.setState((draft) => {
        resumeObjectPlacementPreviews(draft, "canonical entity placement");
        createCleanRoomEntityAtCell(draft, cell, activeEntityPresetId);
        draft.interaction.hoverCell = cell;
      });
      return true;
    }

    interactionState.suppressNextClick = true;
    event.preventDefault();
    const hitEntityIndex = findEntityAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    store.setState((draft) => {
      const entityId = hitEntityIndex >= 0 ? draft.document.active?.entities?.[hitEntityIndex]?.id || null : null;
      const hitEntity = hitEntityIndex >= 0 ? draft.document.active?.entities?.[hitEntityIndex] : null;
      if (event.detail >= 2 && entityId && isSpecialVolumeEntityType(hitEntity?.type)) {
        handleCleanRoomEntitySelectionHit(draft, entityId);
        draft.ui.specialVolumeWorkbench.openEntityId = entityId;
        draft.ui.specialVolumeWorkbench.activeType = getSpecialVolumeType(hitEntity?.type);
        return;
      }
      draft.interaction.selectedCell = cell;
      if (!event.shiftKey && entityId && draft.interaction.selectedEntityId === entityId) {
        beginCleanRoomEntityDrag(draft, entityId, cell);
        return;
      }
      handleCleanRoomEntitySelectionHit(draft, entityId);
    });
    return true;
  };

  const handleInspectCanvasMouseDown = (event, state, cell, point) => {
    if (handleCleanRoomEntityInspectMouseDown(event, state, cell, point)) {
      return true;
    }

    const activeLayer = getActiveLayer(state.interaction);
    const selectionMode = getSelectionMode(state.interaction);
    const hitEntityIndex = findEntityAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    const hitDecorIndex = findDecorAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    const hitSoundIndex = findSoundAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    const activeEntityPresetId = state.interaction.activeEntityPresetId;
    const activeDecorPresetId = state.interaction.activeDecorPresetId;
    const activeSoundPresetId = state.interaction.activeSoundPresetId;

    if (activeLayer === PANEL_LAYERS.ENTITIES && activeEntityPresetId && isMomentaryPlacementTrigger(event)) {
      if (isSpecialVolumeEntityType(activeEntityPresetId)) {
        interactionState.suppressNextClick = true;
        event.preventDefault();
        store.setState((draft) => {
          draft.interaction.hoverCell = cell;
          draft.interaction.selectedCell = cell;
          draft.interaction.volumePlacementDrag = {
            active: true,
            type: activeEntityPresetId,
            startCell: { ...cell },
            endCell: { ...cell },
            thicknessPx: null,
            depthPx: null,
          };
          clearEntitySelection(draft.interaction);
          clearDecorSelection(draft.interaction);
          clearSoundSelection(draft.interaction);
          draft.interaction.entityDrag = null;
          draft.interaction.decorDrag = null;
          draft.interaction.soundDrag = null;
        });
        return true;
      }

      interactionState.suppressNextClick = true;
      event.preventDefault();
      store.setState((draft) => {
        resumeObjectPlacementPreviews(draft, "entity placement");
        createEntityAtCell(draft, cell, activeEntityPresetId);
        draft.interaction.hoverCell = cell;
      });
      return true;
    }

    if (activeLayer === PANEL_LAYERS.DECOR && activeDecorPresetId && isMomentaryPlacementTrigger(event)) {
      interactionState.suppressNextClick = true;
      event.preventDefault();
      store.setState((draft) => {
        resumeObjectPlacementPreviews(draft, "decor placement");
        createDecorAtCell(draft, cell, activeDecorPresetId);
        draft.interaction.hoverCell = cell;
      });
      return true;
    }

    if (activeLayer === PANEL_LAYERS.SOUND && activeSoundPresetId && isMomentaryPlacementTrigger(event)) {
      interactionState.suppressNextClick = true;
      event.preventDefault();
      store.setState((draft) => {
        resumeObjectPlacementPreviews(draft);
        createCleanRoomSoundAtCell(draft, cell, activeSoundPresetId);
        draft.interaction.hoverCell = cell;
      });
      return true;
    }

    // CANONICAL ENTITY RUNTIME ONLY: entity click/select must never drop back into the disabled legacy inspect path.
    if (false && activeLayer === PANEL_LAYERS.ENTITIES && selectionMode === "entity" && hitEntityIndex >= 0) {
      interactionState.suppressNextClick = true;
      event.preventDefault();
      store.setState((draft) => {
        const entityId = draft.document.active?.entities?.[hitEntityIndex]?.id || null;
        if (!entityId) return;
        /*
if (event.shiftKey) {
          toggleEntitySelection(draft.interaction, hitEntityIndex);
        }
        */
        if (event.shiftKey) {
          const selectedIds = getEntityIdsFromSelection(draft.interaction, draft.document.active?.entities || []);
          const nextSelectedIds = selectedIds.includes(entityId)
            ? selectedIds.filter((selectedId) => selectedId !== entityId)
            : [...selectedIds, entityId];
          selectEntitiesByIds(draft, nextSelectedIds, nextSelectedIds.at(-1) ?? null, {
            clearHover: true,
            clearHoverCell: true,
            clearDrag: true,
          });
          return;
        }

        selectEntitiesByIds(draft, [entityId], entityId, {
          clearHover: true,
          clearHoverCell: true,
          clearDrag: true,
        });
      });
      return true;
    }

    if (activeLayer === PANEL_LAYERS.SOUND && selectionMode === "sound" && hitSoundIndex >= 0) {
      interactionState.suppressNextClick = true;
      event.preventDefault();
      store.setState((draft) => {
        const soundItems = draft.document.active?.sounds || [];
        const soundId = soundItems[hitSoundIndex]?.id || null;
        if (!soundId) return;
        applyCanvasTarget(draft, "sound");
        setHoveredSound(draft, soundId);
        if (event.shiftKey) {
          toggleSoundSelection(draft.interaction, soundId, soundItems);
          updateSoundSelectionCell(draft, getPrimarySelectedSoundIndex(draft.interaction, soundItems));
          draft.interaction.soundDrag = null;
          return;
        }

        if (draft.interaction.selectedSoundId === soundId) {
          beginCleanRoomSoundDrag(draft, soundId, cell);
          return;
        }

        selectSoundByIds(draft, [soundId], soundId, {
          clearHover: false,
          hoveredSoundId: soundId,
          clearHoverCell: false,
        });
      });
      return true;
    }

    if (activeLayer === PANEL_LAYERS.DECOR && selectionMode === "decor" && hitDecorIndex >= 0) {
      interactionState.suppressNextClick = true;
      event.preventDefault();
      store.setState((draft) => {
        const decorItems = draft.document.active?.decor || [];
        const decorId = decorItems[hitDecorIndex]?.id || null;
        if (!decorId) return;
        if (!event.shiftKey && draft.interaction.selectedDecorId === decorId) {
          beginCleanRoomDecorDrag(draft, decorId, cell);
          return;
        }

        const selectedDecorIds = getSelectedDecorIds(draft.interaction);
        const nextSelectedDecorIds = event.shiftKey
          ? (selectedDecorIds.includes(decorId)
            ? selectedDecorIds.filter((selectedId) => selectedId !== decorId)
            : [...selectedDecorIds, decorId])
          : [decorId];
        selectDecorByIds(draft, nextSelectedDecorIds, nextSelectedDecorIds.at(-1) ?? null, {
          clearHover: true,
          clearHoverCell: true,
        });
      });
      return true;
    }

    if (activeLayer === PANEL_LAYERS.TILES || activeLayer === PANEL_LAYERS.BACKGROUND) {
      return false;
    }

    interactionState.suppressNextClick = true;
    event.preventDefault();
    store.setState((draft) => {
      const selectionMode = getSelectionMode(draft.interaction);
      draft.interaction.selectedCell = cell;
      draft.interaction.boxSelection = {
        active: true,
        additive: event.shiftKey,
        mode: selectionMode,
        startPoint: point,
        currentPoint: point,
      };
      clearActiveSelection(draft, selectionMode);
      if (!event.shiftKey && selectionMode === "entity") {
        clearEntitySelection(draft.interaction);
      }
      if (!event.shiftKey && selectionMode === "decor") {
        clearDecorSelection(draft.interaction);
      }
      if (!event.shiftKey && selectionMode === "sound") {
        clearSoundSelection(draft.interaction);
      }
    });
    return true;
  };

  const handleCanvasMouseDown = (event) => {
    if (event.button === 1) {
      startPanDrag(event, "middle");
      return;
    }

    if (event.button !== 0) return;

    if (isSpacePanModifierActive()) {
      startPanDrag(event, "space");
      return;
    }

    const state = store.getState();
    if (!state.document.active) return;

    trackCanvasPointerEvent(event);
    const point = getCanvasPointFromMouseEvent(canvas, event);
    if (isPausedScanPlayheadHit(state.document.active, state.viewport, state.scan, point.x, point.y)) {
      event.preventDefault();
      interactionState.suppressNextClick = true;
      interactionState.hoveringPausedScanHandle = false;
      store.setState((draft) => {
        applyCanvasTarget(draft, "sound");
        draft.interaction.scanDrag = {
          active: true,
          lastClientX: event.clientX,
          lastClientY: event.clientY,
        };
      });
      syncCanvasCursor();
      return;
    }
    const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    if (!cell) return;

    const activeTool = state.interaction.activeTool;
    if (isDecorScatterReady(state.interaction, event)) {
      event.preventDefault();
      interactionState.suppressNextClick = true;
      store.setState((draft) => {
        draft.interaction.selectedCell = cell;
        draft.interaction.hoverCell = cell;
        draft.interaction.decorScatterDrag = {
          active: true,
          startCell: cell,
          currentCell: cell,
          startPoint: point,
          currentPoint: point,
        };
        clearEntitySelection(draft.interaction);
        clearDecorSelection(draft.interaction);
        clearSoundSelection(draft.interaction);
        draft.interaction.decorDrag = null;
        draft.interaction.soundDrag = null;
        applyCanvasTarget(draft, "decor");
      });
      return;
    }

    if (activeTool === EDITOR_TOOLS.INSPECT && handleInspectCanvasMouseDown(event, state, cell, point)) {
      return;
    }

    if (activeTool === EDITOR_TOOLS.RECT) {
      event.preventDefault();
      store.setState((draft) => {
        draft.interaction.selectedCell = cell;
        draft.interaction.hoverCell = cell;
        draft.interaction.rectDrag = {
          active: true,
          startCell: cell,
        };
      });
      return;
    }

    if (activeTool === EDITOR_TOOLS.LINE) {
      event.preventDefault();
      store.setState((draft) => {
        draft.interaction.selectedCell = cell;
        draft.interaction.hoverCell = cell;
        draft.interaction.lineDrag = {
          active: true,
          startCell: cell,
        };
      });
      return;
    }

    if (activeTool === EDITOR_TOOLS.FILL) {
      event.preventDefault();
      store.setState((draft) => {
        draft.interaction.selectedCell = cell;
        startTileEditBatch(draft.history, "fill-click");
        applyFillTool(draft, cell);
        endTileEditBatch(draft.history);
      });
      return;
    }

    const drawableTool = activeTool === EDITOR_TOOLS.PAINT || activeTool === EDITOR_TOOLS.ERASE;
    if (!drawableTool) return;

    event.preventDefault();

    store.setState((draft) => {
      draft.interaction.selectedCell = cell;
      draft.interaction.dragPaint = {
        active: true,
        startCell: cell,
        lastAppliedCell: cell,
      };
      startTileEditBatch(draft.history, `${draft.interaction.activeTool}-drag`);
      applyTileToolAtCell(draft, cell);
    });
  };

  const handleCanvasMouseMove = (event) => {
    if (panFromMouseMove(event)) {
      clearHoveredCanvasState();
      return;
    }

    const state = store.getState();
    if (!state.document.active) return;

    if (updatePausedScanDrag(event, state)) {
      updateHoveredCanvasState(event);
      return;
    }

    updateHoveredCanvasState(event);


    if (state.interaction.entityDrag?.active) {
      if ((event.buttons & 1) !== 1) return;

      const point = getCanvasPointFromMouseEvent(canvas, event);
      const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
      if (!cell) return;

      store.setState((draft) => {
        const entityDrag = draft.interaction.entityDrag;
        if (!entityDrag?.active) return;
        const requestedDeltaX = cell.x - entityDrag.anchorCell.x;
        const requestedDeltaY = cell.y - entityDrag.anchorCell.y;
        entityDrag.previewDelta = getClampedGroupDragDelta(
          draft.document.active,
          entityDrag.originPositions,
          requestedDeltaX,
          requestedDeltaY,
        );
        draft.interaction.hoverCell = cell;
        draft.interaction.hoveredEntityIndex = getEntityIndexById(
          draft.document.active?.entities || [],
          entityDrag.leadEntityId ?? entityDrag.originPositions?.[0]?.entityId ?? null,
        );
        draft.interaction.hoveredEntityId = entityDrag.leadEntityId ?? entityDrag.originPositions?.[0]?.entityId ?? null;
      });
      return;
    }

    if (state.interaction.volumePlacementDrag?.active) {
      if ((event.buttons & 1) !== 1) return;
      const point = getCanvasPointFromMouseEvent(canvas, event);
      const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
      if (!cell) return;
      store.setState((draft) => {
        const volumePlacementDrag = draft.interaction.volumePlacementDrag;
        if (!volumePlacementDrag?.active) return;
        volumePlacementDrag.endCell = { ...cell };
        draft.interaction.hoverCell = cell;
        draft.interaction.selectedCell = cell;
      });
      return;
    }

    if (state.interaction.decorDrag?.active) {
      if ((event.buttons & 1) !== 1) return;

      const point = getCanvasPointFromMouseEvent(canvas, event);
      const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
      if (!cell) return;

      store.setState((draft) => {
        const decorDrag = draft.interaction.decorDrag;
        if (!decorDrag?.active) return;
        const requestedDeltaX = cell.x - decorDrag.anchorCell.x;
        const requestedDeltaY = cell.y - decorDrag.anchorCell.y;
        decorDrag.previewDelta = getClampedGroupDragDelta(
          draft.document.active,
          decorDrag.originPositions,
          requestedDeltaX,
          requestedDeltaY,
        );
        draft.interaction.hoverCell = cell;
        const leadOrigin = decorDrag.originPositions?.find((origin) => origin?.decorId === decorDrag.leadDecorId)
          || decorDrag.originPositions?.[0]
          || null;
        draft.interaction.selectedCell = leadOrigin
          ? {
            x: leadOrigin.x + decorDrag.previewDelta.x,
            y: leadOrigin.y + decorDrag.previewDelta.y,
          }
          : draft.interaction.selectedCell;
        setHoveredDecor(draft, decorDrag.leadDecorId);
      });
      return;
    }

    if (state.interaction.soundDrag?.active) {
      if ((event.buttons & 1) !== 1) return;

      const point = getCanvasPointFromMouseEvent(canvas, event);
      const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
      if (!cell) return;

      store.setState((draft) => {
        const soundDrag = draft.interaction.soundDrag;
        if (!soundDrag?.active) return;
        const requestedDeltaX = cell.x - soundDrag.anchorCell.x;
        const requestedDeltaY = cell.y - soundDrag.anchorCell.y;
        soundDrag.previewDelta = getClampedGroupDragDelta(
          draft.document.active,
          soundDrag.originPositions,
          requestedDeltaX,
          requestedDeltaY,
        );
        draft.interaction.hoverCell = cell;
        const leadOrigin = soundDrag.originPositions?.find((origin) => origin?.soundId === soundDrag.leadSoundId)
          || soundDrag.originPositions?.[0]
          || null;
        draft.interaction.selectedCell = leadOrigin
          ? {
            x: leadOrigin.x + soundDrag.previewDelta.x,
            y: leadOrigin.y + soundDrag.previewDelta.y,
          }
          : draft.interaction.selectedCell;
        setHoveredSound(draft, soundDrag.leadSoundId);
      });
      return;
    }

    if (state.interaction.decorScatterDrag?.active) {
      if ((event.buttons & 1) !== 1) return;

      const point = getCanvasPointFromMouseEvent(canvas, event);
      const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
      if (!cell) return;

      store.setState((draft) => {
        const scatterDrag = draft.interaction.decorScatterDrag;
        if (!scatterDrag?.active) return;
        scatterDrag.currentCell = cell;
        scatterDrag.currentPoint = point;
        draft.interaction.hoverCell = cell;
      });
      return;
    }

    if (state.interaction.boxSelection?.active) {
      if ((event.buttons & 1) !== 1) return;

      const point = getCanvasPointFromMouseEvent(canvas, event);
      const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);

      store.setState((draft) => {
        if (!draft.interaction.boxSelection) return;
        draft.interaction.boxSelection.currentPoint = point;
        draft.interaction.hoverCell = cell;
      });
      return;
    }

    if (state.interaction.activeTool === EDITOR_TOOLS.RECT) {
      if (!state.interaction.rectDrag?.active) return;
      if ((event.buttons & 1) !== 1) return;

      const point = getCanvasPointFromMouseEvent(canvas, event);
      const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
      if (!cell) return;

      store.setState((draft) => {
        draft.interaction.selectedCell = cell;
        draft.interaction.hoverCell = cell;
      });
      return;
    }

    if (state.interaction.activeTool === EDITOR_TOOLS.LINE) {
      if (!state.interaction.lineDrag?.active) return;
      if ((event.buttons & 1) !== 1) return;

      const point = getCanvasPointFromMouseEvent(canvas, event);
      const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
      if (!cell) return;

      store.setState((draft) => {
        draft.interaction.selectedCell = cell;
        draft.interaction.hoverCell = cell;
      });
      return;
    }

    const dragActive = state.interaction.dragPaint?.active;
    const drawableTool =
      state.interaction.activeTool === EDITOR_TOOLS.PAINT ||
      state.interaction.activeTool === EDITOR_TOOLS.ERASE;

    if (!dragActive || !drawableTool || (event.buttons & 1) !== 1) {
      return;
    }

    const point = getCanvasPointFromMouseEvent(canvas, event);
    const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    if (!cell) return;

    store.setState((draft) => {
      const dragPaint = draft.interaction.dragPaint;
      if (!dragPaint?.active) return;
      const brushSize = resolveBrushSize(draft.brush.activeDraft);
      const startCell = dragPaint.startCell || cell;
      const nextCell = snapCellToBrushStep(cell, startCell, brushSize);
      if (dragPaint.lastAppliedCell?.x === nextCell.x && dragPaint.lastAppliedCell?.y === nextCell.y) {
        draft.interaction.selectedCell = cell;
        return;
      }
      draft.interaction.selectedCell = cell;
      applyTileToolAtCell(draft, nextCell);
      dragPaint.lastAppliedCell = nextCell;
    });
  };

  const stopCanvasInteraction = () => {
    stopPanDrag();

    const state = store.getState();

    if (state.interaction.scanDrag?.active) {
      store.setState((draft) => {
        draft.interaction.scanDrag = null;
      });
      syncCanvasCursor();
      return;
    }


    if (state.interaction.entityDrag?.active) {
      store.setState((draft) => {
        const entityDrag = draft.interaction.entityDrag;
        if (!entityDrag?.active) return;
        commitCleanRoomEntityDrag(draft, entityDrag);
        draft.interaction.entityDrag = null;
        updateEntitySelectionCell(draft);
      });
      return;
    }

    if (state.interaction.volumePlacementDrag?.active) {
      store.setState((draft) => {
        const volumePlacementDrag = draft.interaction.volumePlacementDrag;
        if (!volumePlacementDrag?.active) return;
        if (volumePlacementDrag.type === "fog_volume") {
          const entitiesPanelWasOpen = draft.ui.panelSections?.entities === true;
          const fogRect = getFogVolumeWorldRectFromDragCells(
            volumePlacementDrag.startCell,
            volumePlacementDrag.endCell,
            draft.document.active?.dimensions?.tileSize,
            volumePlacementDrag.thicknessPx,
          );
          if (fogRect) {
            const createdIndex = createFogVolumeAtWorldRect(draft, fogRect);
            if (createdIndex != null) {
              setCanvasSelectionMode(draft, "entity");
              setActiveLayer(draft, PANEL_LAYERS.ENTITIES);
              if (!entitiesPanelWasOpen && draft.ui.panelSections) {
                draft.ui.panelSections.entities = false;
              }
            }
          }
        }
        if (volumePlacementDrag.type === "water_volume") {
          const entitiesPanelWasOpen = draft.ui.panelSections?.entities === true;
          const waterRect = getWaterVolumeWorldRectFromDragCells(
            volumePlacementDrag.startCell,
            volumePlacementDrag.endCell,
            draft.document.active?.dimensions?.tileSize,
            volumePlacementDrag.depthPx,
          );
          if (waterRect) {
            const createdIndex = createWaterVolumeAtWorldRect(draft, waterRect);
            if (createdIndex != null) {
              setCanvasSelectionMode(draft, "entity");
              setActiveLayer(draft, PANEL_LAYERS.ENTITIES);
              if (!entitiesPanelWasOpen && draft.ui.panelSections) {
                draft.ui.panelSections.entities = false;
              }
            }
          }
        }
        if (volumePlacementDrag.type === "lava_volume") {
          const entitiesPanelWasOpen = draft.ui.panelSections?.entities === true;
          const lavaRect = getLavaVolumeWorldRectFromDragCells(
            volumePlacementDrag.startCell,
            volumePlacementDrag.endCell,
            draft.document.active?.dimensions?.tileSize,
            volumePlacementDrag.depthPx,
          );
          if (lavaRect) {
            const createdIndex = createLavaVolumeAtWorldRect(draft, lavaRect);
            if (createdIndex != null) {
              setCanvasSelectionMode(draft, "entity");
              setActiveLayer(draft, PANEL_LAYERS.ENTITIES);
              if (!entitiesPanelWasOpen && draft.ui.panelSections) {
                draft.ui.panelSections.entities = false;
              }
            }
          }
        }
        if (volumePlacementDrag.type === "bubbling_liquid_volume") {
          const entitiesPanelWasOpen = draft.ui.panelSections?.entities === true;
          const liquidRect = getBubblingLiquidVolumeWorldRectFromDragCells(
            volumePlacementDrag.startCell,
            volumePlacementDrag.endCell,
            draft.document.active?.dimensions?.tileSize,
            volumePlacementDrag.depthPx,
          );
          if (liquidRect) {
            const createdIndex = createBubblingLiquidVolumeAtWorldRect(draft, liquidRect);
            if (createdIndex != null) {
              setCanvasSelectionMode(draft, "entity");
              setActiveLayer(draft, PANEL_LAYERS.ENTITIES);
              if (!entitiesPanelWasOpen && draft.ui.panelSections) {
                draft.ui.panelSections.entities = false;
              }
            }
          }
        }
        draft.interaction.volumePlacementDrag = null;
      });
      return;
    }

    if (state.interaction.decorDrag?.active) {
      store.setState((draft) => {
        const decorDrag = draft.interaction.decorDrag;
        if (!decorDrag?.active) return;
        commitCleanRoomDecorDrag(draft, decorDrag);
        draft.interaction.decorDrag = null;
        updateDecorSelectionCell(draft);
      });
      return;
    }

    if (state.interaction.soundDrag?.active) {
      store.setState((draft) => {
        const soundDrag = draft.interaction.soundDrag;
        if (!soundDrag?.active) return;
        commitCleanRoomSoundDrag(draft, soundDrag);
        draft.interaction.soundDrag = null;
        updateSoundSelectionCell(draft);
      });
      return;
    }

    if (state.interaction.decorScatterDrag?.active) {
      store.setState((draft) => {
        const scatterDrag = draft.interaction.decorScatterDrag;
        if (!scatterDrag?.active) return;

        applyDecorScatter(
          draft,
          scatterDrag.startCell,
          scatterDrag.currentCell || scatterDrag.startCell,
          draft.interaction.activeDecorPresetId,
        );
        clearDecorScatterDrag(draft);
      });
      return;
    }

    if (state.interaction.boxSelection?.active) {
      const boxSelection = state.interaction.boxSelection;
      const nextSelection = boxSelection.mode === "decor"
        ? getDecorIndicesInCanvasRect(
            state.document.active,
            state.viewport,
            boxSelection.startPoint,
            boxSelection.currentPoint,
          )
        : boxSelection.mode === "sound"
          ? getSoundIndicesInCanvasRect(
              state.document.active,
              state.viewport,
              boxSelection.startPoint,
              boxSelection.currentPoint,
            )
          : getEntityIndicesInCanvasRect(
              state.document.active,
              state.viewport,
              boxSelection.startPoint,
              boxSelection.currentPoint,
            );

      store.setState((draft) => {
        if (boxSelection.mode === "decor") {
          const decorItems = draft.document.active?.decor || [];
          const baseSelectionIds = boxSelection.additive ? getSelectedDecorIds(draft.interaction) : [];
          const nextSelectionIds = nextSelection.map((index) => decorItems[index]?.id).filter(Boolean);
          const mergedSelectionIds = boxSelection.additive
            ? [...baseSelectionIds, ...nextSelectionIds]
            : nextSelectionIds;
          selectDecorByIds(draft, mergedSelectionIds, mergedSelectionIds.at(-1) ?? null, {
            clearHover: true,
            clearHoverCell: true,
          });
        } else if (boxSelection.mode === "sound") {
          const soundItems = draft.document.active?.sounds || [];
          const baseSelection = boxSelection.additive ? getSelectedSoundIndices(draft.interaction, soundItems) : [];
          applyCanvasTarget(draft, "sound");
          setSoundSelection(
            draft.interaction,
            boxSelection.additive ? [...baseSelection, ...nextSelection] : nextSelection,
            nextSelection[nextSelection.length - 1] ?? getPrimarySelectedSoundIndex(draft.interaction, soundItems),
            soundItems,
          );
          updateSoundSelectionCell(draft, getPrimarySelectedSoundIndex(draft.interaction, soundItems));
        } else {
          const entities = draft.document.active?.entities || [];
          const baseSelectionIds = boxSelection.additive ? getEntityIdsFromSelection(draft.interaction, entities) : [];
          const nextSelectionIds = nextSelection
            .map((index) => entities[index]?.id)
            .filter(Boolean);
          const mergedSelectionIds = boxSelection.additive
            ? [...baseSelectionIds, ...nextSelectionIds]
            : nextSelectionIds;
          selectEntitiesByIds(draft, mergedSelectionIds, mergedSelectionIds.at(-1) ?? null, {
            clearHover: true,
            clearHoverCell: true,
            clearDrag: true,
          });
        }
        draft.interaction.boxSelection = null;
      });
      return;
    }

    if (state.interaction.rectDrag?.active) {
      const startCell = state.interaction.rectDrag.startCell;
      const endCell = state.interaction.hoverCell;

      store.setState((draft) => {
        if (startCell && endCell) {
          startTileEditBatch(draft.history, "rect-drag");
          applyRectTool(draft, startCell, endCell);
          endTileEditBatch(draft.history);
        }

        draft.interaction.rectDrag = null;
      });
      return;
    }

    if (state.interaction.lineDrag?.active) {
      const startCell = state.interaction.lineDrag.startCell;
      const endCell = state.interaction.hoverCell;

      store.setState((draft) => {
        if (startCell && endCell) {
          startTileEditBatch(draft.history, "line-drag");
          applyLineTool(draft, startCell, endCell);
          endTileEditBatch(draft.history);
        }

        draft.interaction.lineDrag = null;
      });
      return;
    }

    if (!state.interaction.dragPaint?.active) return;

    store.setState((draft) => {
      draft.interaction.dragPaint = null;
      endTileEditBatch(draft.history);
    });
  };

  const handleCanvasClick = (event) => {
    if (interactionState.suppressNextClick) {
      interactionState.suppressNextClick = false;
      event.preventDefault();
      return;
    }

    const state = store.getState();
    if (!state.document.active) return;
    if (state.interaction.activeTool !== EDITOR_TOOLS.INSPECT) return;
    if (getActiveLayer(state.interaction) === PANEL_LAYERS.ENTITIES) {
      event.preventDefault();
      return;
    }

    const point = getCanvasPointFromMouseEvent(canvas, event);
    const activeLayer = getActiveLayer(state.interaction);
    const selectionMode = getSelectionMode(state.interaction);
    const hitEntityIndex = findEntityAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    if (activeLayer === PANEL_LAYERS.ENTITIES && selectionMode === "entity" && hitEntityIndex >= 0) {
      store.setState((draft) => {
        const entityId = draft.document.active?.entities?.[hitEntityIndex]?.id || null;
        if (!entityId) return;
        if (event.shiftKey) {
          const selectedIds = getEntityIdsFromSelection(draft.interaction, draft.document.active?.entities || []);
          const nextSelectedIds = selectedIds.includes(entityId)
            ? selectedIds.filter((selectedId) => selectedId !== entityId)
            : [...selectedIds, entityId];
          selectEntitiesByIds(draft, nextSelectedIds, nextSelectedIds.at(-1) ?? null, {
            clearHover: true,
            clearHoverCell: true,
            clearDrag: true,
          });
        } else {
          selectEntitiesByIds(draft, [entityId], entityId, {
            clearHover: true,
            clearHoverCell: true,
            clearDrag: true,
          });
        }
      });
      return;
    }

    const hitDecorIndex = findDecorAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    if (activeLayer === PANEL_LAYERS.DECOR && selectionMode === "decor" && hitDecorIndex >= 0) {
      store.setState((draft) => {
        const decorItems = draft.document.active?.decor || [];
        const decorId = decorItems[hitDecorIndex]?.id || null;
        if (!decorId) return;
        const selectedDecorIds = getSelectedDecorIds(draft.interaction);
        const nextSelectedDecorIds = event.shiftKey
          ? (selectedDecorIds.includes(decorId)
            ? selectedDecorIds.filter((selectedId) => selectedId !== decorId)
            : [...selectedDecorIds, decorId])
          : [decorId];
        selectDecorByIds(draft, nextSelectedDecorIds, nextSelectedDecorIds.at(-1) ?? null, {
          clearHover: true,
          clearHoverCell: true,
        });
      });
      return;
    }

    const hitSoundIndex = findSoundAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    if (activeLayer === PANEL_LAYERS.SOUND && selectionMode === "sound" && hitSoundIndex >= 0) {
      store.setState((draft) => {
        const soundItems = draft.document.active?.sounds || [];
        applyCanvasTarget(draft, "sound");
        if (event.shiftKey) {
          toggleSoundSelection(draft.interaction, hitSoundIndex, soundItems);
        } else {
          setSoundSelection(draft.interaction, [hitSoundIndex], hitSoundIndex, soundItems);
        }
        setHoveredSound(draft, hitSoundIndex);
        updateSoundSelectionCell(draft, getPrimarySelectedSoundIndex(draft.interaction, soundItems));
      });
      return;
    }

    const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    if (!cell) return;

    store.setState((draft) => {
      draft.interaction.selectedCell = cell;
      clearEntitySelection(draft.interaction);
      draft.interaction.hoveredEntityId = null;
      clearDecorSelection(draft.interaction);
      clearSoundSelection(draft.interaction);
    });
  };


  const resetEditorForDocument = (draft, nextDocument, statusMessage = null) => {
    clearCleanRoomObjectRuntimeHistory();
    draft.document.active = nextDocument;
    draft.document.status = "ready";
    draft.document.error = null;
    draft.history.undoStack = [];
    draft.history.redoStack = [];
    draft.history.activeBatch = null;
    draft.interaction.dragPaint = null;
    draft.interaction.rectDrag = null;
    draft.interaction.lineDrag = null;
    draft.interaction.boxSelection = null;
    draft.interaction.entityDrag = null;
    draft.interaction.decorDrag = null;
    draft.interaction.soundDrag = null;
    draft.interaction.scanDrag = null;
    draft.interaction.volumePlacementDrag = null;
    draft.interaction.activeLayer = PANEL_LAYERS.TILES;
    draft.interaction.activeBackgroundMaterialId = nextDocument?.background?.materials?.[0]?.id || DEFAULT_BACKGROUND_MATERIAL_ID;
    draft.interaction.canvasSelectionMode = "entity";
    draft.interaction.decorScatterMode = false;
    draft.interaction.decorScatterSettings = {
      density: 0.3,
      randomness: 0.6,
      variantMode: "fixed",
    };
    draft.interaction.decorScatterDrag = null;
    draft.interaction.activeEntityPresetId = null;
    draft.interaction.activeDecorPresetId = null;
    draft.interaction.activeSoundPresetId = null;
    draft.interaction.objectPlacementPreviewSuppressed = false;
    draft.interaction.selectedCell = null;
    draft.interaction.hoveredEntityIndex = null;
    draft.interaction.hoveredEntityId = null;
    draft.interaction.hoveredDecorIndex = null;
    draft.interaction.hoveredDecorId = null;
    clearHoveredSound(draft.interaction);
    clearDecorSelection(draft.interaction);
    clearEntitySelection(draft.interaction);
    clearSoundSelection(draft.interaction);
    draft.interaction.hoverCell = null;
    draft.ui.importStatus = statusMessage;
    draft.ui.newLevelSize = {
      isOpen: false,
      width: String(nextDocument?.dimensions?.width || DEFAULT_NEW_LEVEL_WIDTH),
      height: String(nextDocument?.dimensions?.height || DEFAULT_NEW_LEVEL_HEIGHT),
      error: null,
    };
    syncScanWithDocument(draft, { preserveRange: false, preserveLog: false });
  };

  const openNewLevelSizeFlow = () => {
    const active = store.getState().document.active;
    store.setState((draft) => {
      draft.ui.topBarMenu = null;
      draft.ui.newLevelSize.isOpen = true;
      draft.ui.newLevelSize.width = String(active?.dimensions?.width || DEFAULT_NEW_LEVEL_WIDTH);
      draft.ui.newLevelSize.height = String(active?.dimensions?.height || DEFAULT_NEW_LEVEL_HEIGHT);
      draft.ui.newLevelSize.error = null;
    });
    requestAnimationFrame(() => {
      const firstField = floatingPanelHost.querySelector('[data-new-level-field="width"]');
      if (firstField instanceof HTMLInputElement) {
        firstField.focus({ preventScroll: true });
        firstField.select();
      }
    });
  };

  const closeNewLevelSizeFlow = () => {
    store.setState((draft) => {
      draft.ui.newLevelSize.isOpen = false;
      draft.ui.newLevelSize.error = null;
    });
  };

  const updateNewLevelSizeField = (field, rawValue, options = {}) => {
    if (field !== "width" && field !== "height") return false;
    const { commit = false } = options;
    store.setState((draft) => {
      draft.ui.newLevelSize[field] = commit
        ? String(sanitizeLevelDimension(rawValue, field === "width" ? DEFAULT_NEW_LEVEL_WIDTH : DEFAULT_NEW_LEVEL_HEIGHT, field))
        : rawValue;
      draft.ui.newLevelSize.error = null;
    });
    return true;
  };

  const confirmNewLevelSizeFlow = () => {
    const newLevelSize = store.getState().ui.newLevelSize;
    const validationMessage = getNewLevelSizeValidationMessage(newLevelSize.width, newLevelSize.height);
    if (validationMessage) {
      store.setState((draft) => {
        draft.ui.newLevelSize.error = validationMessage;
      });
      return false;
    }

    const newDocument = createNewLevelDocument({
      width: newLevelSize.width,
      height: newLevelSize.height,
    });

    store.setState((draft) => {
      resetEditorForDocument(draft, newDocument, "New level created");
    });

    resize();
    draw(store.getState());
    return true;
  };

  const handleUndo = () => {
    const beforeSnapshot = createSoundDebugSnapshot(store.getState());
    store.setState((draft) => {
      const doc = draft.document.active;
      if (!doc) return;

      const timelineEntry = peekNextGlobalUndoAction(globalHistoryTimeline);
      if (!timelineEntry) {
        const entry = undoTileEdit(doc, draft.history);
        applyHistoryObjectMutationState(draft, entry, "undo");
        appendSoundDebugEvent("Undo handled", historyEntryContainsObjectLayer(entry) ? "history entry touched object layer" : "history entry touched non-object data", beforeSnapshot, createSoundDebugSnapshot(draft));
        return;
      }

      if (timelineEntry.route?.lane === "entity-canonical") {
        const action = canonicalEntityHistory.undoStack.at(-1) || null;
        if (action?.globalActionId === timelineEntry.actionId && handleCleanRoomEntityUndo(draft)) {
          markGlobalHistoryActionUndone(globalHistoryTimeline, timelineEntry.actionId);
          appendSoundDebugEvent("Undo handled", "canonical entity history", beforeSnapshot, createSoundDebugSnapshot(draft));
          return;
        }
      }

      if (timelineEntry.route?.lane === "decor-canonical") {
        const action = canonicalDecorHistory.undoStack.at(-1) || null;
        if (action?.globalActionId === timelineEntry.actionId) {
          const poppedAction = canonicalDecorHistory.popUndo();
          if (poppedAction && applyCleanRoomDecorHistoryAction(draft, poppedAction, "backward")) {
            canonicalDecorHistory.pushRedo(poppedAction);
            markGlobalHistoryActionUndone(globalHistoryTimeline, timelineEntry.actionId);
            appendSoundDebugEvent("Undo handled", "canonical decor history", beforeSnapshot, createSoundDebugSnapshot(draft));
            return;
          }
          if (poppedAction) canonicalDecorHistory.pushUndo(poppedAction);
        }
      }

      if (timelineEntry.route?.lane === "sound-canonical") {
        const action = canonicalSoundHistory.undoStack.at(-1) || null;
        if (action?.globalActionId === timelineEntry.actionId && handleCleanRoomSoundUndo(draft)) {
          markGlobalHistoryActionUndone(globalHistoryTimeline, timelineEntry.actionId);
          appendSoundDebugEvent("Undo handled", "canonical sound history", beforeSnapshot, createSoundDebugSnapshot(draft));
          return;
        }
      }

      const entry = draft.history.undoStack.at(-1) || null;
      if (entry?.globalActionId === timelineEntry.actionId) {
        const undoneEntry = undoTileEdit(doc, draft.history);
        applyHistoryObjectMutationState(draft, undoneEntry, "undo");
        markGlobalHistoryActionUndone(globalHistoryTimeline, timelineEntry.actionId);
        appendSoundDebugEvent("Undo handled", historyEntryContainsObjectLayer(undoneEntry) ? "history entry touched object layer" : "history entry touched non-object data", beforeSnapshot, createSoundDebugSnapshot(draft));
      }
    });
  };

  const handleRedo = () => {
    const beforeSnapshot = createSoundDebugSnapshot(store.getState());
    store.setState((draft) => {
      const doc = draft.document.active;
      if (!doc) return;

      const timelineEntry = peekNextGlobalRedoAction(globalHistoryTimeline);
      if (!timelineEntry) {
        const entry = redoTileEdit(doc, draft.history);
        applyHistoryObjectMutationState(draft, entry, "redo");
        appendSoundDebugEvent("Redo handled", historyEntryContainsObjectLayer(entry) ? "history entry touched object layer" : "history entry touched non-object data", beforeSnapshot, createSoundDebugSnapshot(draft));
        return;
      }

      if (timelineEntry.route?.lane === "entity-canonical") {
        const action = canonicalEntityHistory.redoStack.at(-1) || null;
        if (action?.globalActionId === timelineEntry.actionId && handleCleanRoomEntityRedo(draft)) {
          markGlobalHistoryActionRedone(globalHistoryTimeline, timelineEntry.actionId);
          appendSoundDebugEvent("Redo handled", "canonical entity history", beforeSnapshot, createSoundDebugSnapshot(draft));
          return;
        }
      }

      if (timelineEntry.route?.lane === "decor-canonical") {
        const action = canonicalDecorHistory.redoStack.at(-1) || null;
        if (action?.globalActionId === timelineEntry.actionId) {
          const poppedAction = canonicalDecorHistory.popRedo();
          if (poppedAction && applyCleanRoomDecorHistoryAction(draft, poppedAction, "forward")) {
            canonicalDecorHistory.pushUndo(poppedAction);
            markGlobalHistoryActionRedone(globalHistoryTimeline, timelineEntry.actionId);
            appendSoundDebugEvent("Redo handled", "canonical decor history", beforeSnapshot, createSoundDebugSnapshot(draft));
            return;
          }
          if (poppedAction) canonicalDecorHistory.pushRedo(poppedAction);
        }
      }

      if (timelineEntry.route?.lane === "sound-canonical") {
        const action = canonicalSoundHistory.redoStack.at(-1) || null;
        if (action?.globalActionId === timelineEntry.actionId && handleCleanRoomSoundRedo(draft)) {
          markGlobalHistoryActionRedone(globalHistoryTimeline, timelineEntry.actionId);
          appendSoundDebugEvent("Redo handled", "canonical sound history", beforeSnapshot, createSoundDebugSnapshot(draft));
          return;
        }
      }

      const entry = draft.history.redoStack.at(-1) || null;
      if (entry?.globalActionId === timelineEntry.actionId) {
        const redoneEntry = redoTileEdit(doc, draft.history);
        applyHistoryObjectMutationState(draft, redoneEntry, "redo");
        markGlobalHistoryActionRedone(globalHistoryTimeline, timelineEntry.actionId);
        appendSoundDebugEvent("Redo handled", historyEntryContainsObjectLayer(redoneEntry) ? "history entry touched object layer" : "history entry touched non-object data", beforeSnapshot, createSoundDebugSnapshot(draft));
      }
    });
  };

  const handleExportDownload = () => {
    const state = store.getState();
    if (!state.document.active) return;

    triggerLevelDocumentDownload(state.document.active);
    closeTopBarMenu();
  };

  const getAuthoredSpawnCell = (doc) => {
    if (!doc || !Array.isArray(doc.entities)) return null;
    const spawn = doc.entities.find((entity) => String(entity?.type || "").trim().toLowerCase() === "player-spawn");
    if (!spawn) return null;
    const x = Number(spawn.x);
    const y = Number(spawn.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: x | 0, y: y | 0 };
  };

  const handlePlayFromHereLaunch = () => {
    const state = store.getState();
    const doc = state.document.active;
    if (!doc) return;

    const selectedPfhCell = getSelectedPlayFromHereCell(state);
    const spawnOverride = selectedPfhCell || getAuthoredSpawnCell(doc);

    let bridgeResult = null;
    try {
      bridgeResult = v2ToRuntimeLevelObject(doc);
      launchEditorPlayRuntime({
        runtimeLevel: bridgeResult.runtimeLevel,
        spawnOverride,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown bridge failure.";
      store.setState((draft) => {
        draft.ui.importStatus = `Play launch failed: ${message}`;
      });
      return;
    }

    const unsupportedCount = bridgeResult.unsupported.length;
    const warningsCount = bridgeResult.warnings.length;
    const diagnostics = [];
    if (unsupportedCount) diagnostics.push(`${unsupportedCount} unsupported`);
    if (warningsCount) diagnostics.push(`${warningsCount} warning${warningsCount === 1 ? "" : "s"}`);
    const liquidOmissionDiagnostics = bridgeResult.unsupported
      .filter((entry) => /unsupported liquid volume/i.test(String(entry)))
      .slice(0, 2);
    const liquidSuffix = liquidOmissionDiagnostics.length
      ? ` Omitted liquid volumes: ${liquidOmissionDiagnostics.join(" ")}`
      : "";

    store.setState((draft) => {
      const spawnSourceLabel = selectedPfhCell
        ? `selected cell (${selectedPfhCell.x}, ${selectedPfhCell.y})`
        : "authored/default spawn";
      draft.ui.importStatus = diagnostics.length
        ? `Play From Here launched (${spawnSourceLabel}). Bridge diagnostics: ${diagnostics.join(", ")}.${liquidSuffix}`
        : `Play From Here launched from ${spawnSourceLabel}.`;
    });
  };

  const handleImport = () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json,application/json";

    fileInput.addEventListener(
      "change",
      async () => {
        const file = fileInput.files?.[0];
        if (!file) return;

        try {
          const { document: importedDocument, fileName } = await importLevelDocumentFromFile(file);

          store.setState((draft) => {
            resetEditorForDocument(draft, importedDocument, `Loaded ${fileName}`);
          });

          resize();
          draw(store.getState());
        } catch {
          store.setState((draft) => {
            draft.ui.importStatus = "Import failed";
          });
        }
      },
      { once: true },
    );

    fileInput.click();
  };

  const setActiveTool = (tool) => {
    store.setState((draft) => {
      resumeObjectPlacementPreviews(draft, `tool ${tool}`);
      draft.interaction.activeTool = tool;
      draft.interaction.entityDrag = null;
      draft.interaction.decorDrag = null;
      draft.interaction.soundDrag = null;
      draft.interaction.volumePlacementDrag = null;
      draft.interaction.boxSelection = null;
      clearDecorScatterDrag(draft);
      if (tool !== EDITOR_TOOLS.INSPECT && ![PANEL_LAYERS.TILES, PANEL_LAYERS.BACKGROUND].includes(getActiveLayer(draft.interaction))) {
        setActiveLayer(draft, PANEL_LAYERS.TILES);
      }
    });
  };

  const setActiveCanvasTarget = (mode) => {
    store.setState((draft) => {
      applyCanvasTarget(draft, mode);
    });
  };

  const setActiveLayerFromPanel = (layer) => {
    store.setState((draft) => {
      if (layer === PANEL_LAYERS.DECOR) {
        applyCanvasTarget(draft, "decor");
        return;
      }

      if (layer === PANEL_LAYERS.SOUND) {
        applyCanvasTarget(draft, "sound");
        return;
      }

      if (layer === PANEL_LAYERS.ENTITIES) {
        applyCanvasTarget(draft, "entity");
        return;
      }

      resumeObjectPlacementPreviews(draft, `panel layer ${layer}`);
      setActiveLayer(draft, layer === PANEL_LAYERS.BACKGROUND ? PANEL_LAYERS.BACKGROUND : PANEL_LAYERS.TILES);
      draft.interaction.activeEntityPresetId = null;
      draft.interaction.activeDecorPresetId = null;
      draft.interaction.activeSoundPresetId = null;
      draft.interaction.decorScatterMode = false;
      draft.interaction.boxSelection = null;
      draft.interaction.entityDrag = null;
      draft.interaction.decorDrag = null;
      draft.interaction.soundDrag = null;
      draft.interaction.volumePlacementDrag = null;
      draft.interaction.hoveredEntityIndex = null;
      draft.interaction.hoveredDecorIndex = null;
      draft.interaction.hoveredDecorId = null;
      clearHoveredSound(draft.interaction);
      clearDecorScatterDrag(draft);
      clearEntitySelection(draft.interaction);
      clearDecorSelection(draft.interaction);
      clearSoundSelection(draft.interaction);
    });
  };

  const handleGlobalKeyDown = (event) => {
    if (hasBlockedShortcutFocus()) {
      return;
    }

    if (store.getState().ui.newLevelSize?.isOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeNewLevelSizeFlow();
        return;
      }
    }

    if (event.key === "Escape") {
      const selection = resolveSelectedSpecialVolume(store.getState());
      if (selection && isSpecialVolumeEntityType(selection.entity?.type)) {
        event.preventDefault();
        store.setState((draft) => {
          draft.ui.specialVolumeWorkbench.openEntityId = null;
          clearEntitySelection(draft.interaction);
          draft.interaction.selectedEntityId = null;
          draft.interaction.selectedEntityIds = [];
        });
        return;
      }
    }

    if (event.code === "Space") {
      if (isShortcutTargetBlocked(event.target)) return;
      event.preventDefault();
      updateSpacePanActive(true);
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
      if (isShortcutTargetBlocked(event.target)) return;
      event.preventDefault();
      interactionState.arrowPan.activeKeys.add(event.key);
      interactionState.arrowPan.speedMultiplier = event.shiftKey ? ARROW_PAN_SHIFT_MULTIPLIER : 1;
      applyArrowKeyPan();
      scheduleArrowPanLoop();
      return;
    }

    if (event.repeat) return;
    if (isShortcutTargetBlocked(event.target)) return;

    const isHistoryShortcut = event.metaKey || event.ctrlKey;
    if (isHistoryShortcut) {
      const key = event.key.toLowerCase();
      if (key === "d") {
        let duplicated = false;
        store.setState((draft) => {
          const activeLayer = getActiveLayer(draft.interaction);
          duplicated = activeLayer === PANEL_LAYERS.DECOR
            ? duplicateSelectedDecor(draft)
            : activeLayer === PANEL_LAYERS.SOUND
              ? duplicateSelectedSound(draft)
              : activeLayer === PANEL_LAYERS.ENTITIES
                ? duplicateSelectedEntity(draft)
                : false;
        });
        if (duplicated) {
          event.preventDefault();
        }
        return;
      }

      if (key !== "z") return;

      event.preventDefault();
      if (event.shiftKey) {
        handleRedo();
        return;
      }

      handleUndo();
      return;
    }

    if ((event.key === "Delete" || event.key === "Backspace")) {
      const state = store.getState();
      const activeLayer = getActiveLayer(state.interaction);
      const beforeSnapshot = createSoundDebugSnapshot(state);
      const hasSelection =
        activeLayer === PANEL_LAYERS.DECOR
      ? getSelectedDecorIndices(state.interaction, state.document.active?.decor || []).length
          : activeLayer === PANEL_LAYERS.SOUND
            ? getSelectedSoundIndices(state.interaction).length
            : activeLayer === PANEL_LAYERS.ENTITIES
              ? getSelectedEntityIndices(state.interaction).length
              : 0;
      if (!hasSelection) return;

      event.preventDefault();
      store.setState((draft) => {
        const activeLayer = getActiveLayer(draft.interaction);
        if (activeLayer === PANEL_LAYERS.DECOR) {
          deleteSelectedDecor(draft);
          return;
        }
        if (activeLayer === PANEL_LAYERS.SOUND) {
          deleteSelectedSound(draft);
          appendSoundDebugEvent("Delete key handled", `key=${event.key} on sound layer`, beforeSnapshot, createSoundDebugSnapshot(draft));
          return;
        }
        if (activeLayer === PANEL_LAYERS.ENTITIES) {
          deleteSelectedEntity(draft);
        }
      });
      return;
    }

    if (event.altKey || event.shiftKey) return;

    const nextTool = toolShortcutMap[event.key.toLowerCase()];
    if (!nextTool) return;

    event.preventDefault();
    setActiveTool(nextTool);
  };

  const handleGlobalKeyUp = (event) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
      interactionState.arrowPan.activeKeys.delete(event.key);
      interactionState.arrowPan.speedMultiplier = event.shiftKey ? ARROW_PAN_SHIFT_MULTIPLIER : 1;
      if (!interactionState.arrowPan.activeKeys.size) {
        stopArrowPanLoop();
      }
      return;
    }

    if (event.key === "Shift") {
      interactionState.arrowPan.speedMultiplier = 1;
      return;
    }

    if (event.code !== "Space") return;
    updateSpacePanActive(false);

    if (interactionState.panDrag?.trigger === "space") {
      stopPanDrag();
    }
  };

  const toggleTopBarMenu = (menuName) => {
    store.setState((draft) => {
      draft.ui.topBarMenu = draft.ui.topBarMenu === menuName ? null : menuName;
    });
  };

  const closeTopBarMenu = () => {
    store.setState((draft) => {
      draft.ui.topBarMenu = null;
    });
  };

  const handleFloatingPanelClick = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const fogActionButton = target.closest("[data-fog-workbench-action]");
    if (fogActionButton instanceof HTMLButtonElement) {
      if (fogActionButton.dataset.fogWorkbenchAction === "open") {
        const selection = resolveSelectedSpecialVolume(store.getState());
        if (!selection || !isSpecialVolumeEntityType(selection.entity?.type)) return;
        store.setState((draft) => {
          draft.ui.specialVolumeWorkbench.openEntityId = selection.entity.id;
          draft.ui.specialVolumeWorkbench.activeType = selection.type;
        });
        return;
      }
      if (fogActionButton.dataset.fogWorkbenchAction === "done") {
        store.setState((draft) => {
          draft.ui.specialVolumeWorkbench.openEntityId = null;
          clearEntitySelection(draft.interaction);
          draft.interaction.selectedEntityId = null;
          draft.interaction.selectedEntityIds = [];
        });
        return;
      }
      if (fogActionButton.dataset.fogWorkbenchAction === "save-defaults") {
        const state = store.getState();
        const selection = resolveSelectedSpecialVolume(state);
        if (!selection || !isFogVolumeEntityType(selection.entity?.type)) return;
        const nextDefaults = getFogVolumeParams(selection.entity);
        store.setState((draft) => {
          draft.ui.specialVolumeWorkbench.activeType = "fog_volume";
          draft.ui.specialVolumeWorkbench.fogDefaults = nextDefaults;
          draft.ui.importStatus = "Saved Fog defaults for future placements.";
        });
        writeFogDefaultsToStorage(nextDefaults);
      }
      return;
    }

    const actionButton = target.closest("[data-new-level-action]");
    if (!(actionButton instanceof HTMLButtonElement)) return;

    const action = actionButton.dataset.newLevelAction;
    if (action === "cancel") {
      closeNewLevelSizeFlow();
      return;
    }

    if (action === "confirm") {
      confirmNewLevelSizeFlow();
    }
  };

  const handleFloatingPanelInput = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const paramPath = typeof target.dataset.entityParamPath === "string" ? target.dataset.entityParamPath.trim() : "";
    if (paramPath) {
      event.stopPropagation();
      return;
    }
    const field = target.dataset.newLevelField;
    updateNewLevelSizeField(field, target.value, { commit: false });
  };

  const handleFloatingPanelChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const paramPath = typeof target.dataset.entityParamPath === "string" ? target.dataset.entityParamPath.trim() : "";
    if (paramPath) {
      const index = Number.parseInt(target.dataset.entityIndex || "", 10);
      if (!Number.isInteger(index) || index < 0) return;
      updateEntity(index, "param", {
        __canonicalMutation: true,
        itemId: target.dataset.entityId || null,
        key: paramPath,
        path: paramPath,
        value: parseEntityParamInputValue(target),
      });
      return;
    }
    const field = target.dataset.newLevelField;
    updateNewLevelSizeField(field, target.value, { commit: true });
  };

  const stopFogStepperSession = () => {
    if (!fogStepperSession) return;
    globalThis.clearTimeout(fogStepperSession.repeatTimeoutId);
    fogStepperSession = null;
  };

  const resolveFogStepperInput = (inputRef) => {
    if (!inputRef || typeof inputRef.path !== "string") return null;
    const escapeSelectorValue = (value) => String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
    const liveInput = floatingPanelHost.querySelector(
      `input[data-entity-param-type="number"][data-entity-index="${escapeSelectorValue(inputRef.index)}"][data-entity-param-path="${escapeSelectorValue(inputRef.path)}"]`,
    );
    if (liveInput instanceof HTMLInputElement) return liveInput;
    if (inputRef.fallbackInput instanceof HTMLInputElement) return inputRef.fallbackInput;
    return null;
  };

  const nudgeFogNumberInput = (inputRef, direction, options = null) => {
    const input = resolveFogStepperInput(inputRef);
    if (!(input instanceof HTMLInputElement)) return;
    const baseStep = Number.parseFloat(input.dataset.fogNumberStep || input.step || "1");
    const step = Number.isFinite(baseStep) && baseStep > 0 ? baseStep : 1;
    const multiplier = options?.useLargeStep ? 4 : 1;
    const min = Number.parseFloat(input.dataset.fogNumberMin || input.min || "");
    const max = Number.parseFloat(input.dataset.fogNumberMax || input.max || "");
    const current = Number.parseFloat(input.value);
    let nextValue = (Number.isFinite(current) ? current : 0) + (direction * step * multiplier);
    if (Number.isFinite(min)) nextValue = Math.max(min, nextValue);
    if (Number.isFinite(max)) nextValue = Math.min(max, nextValue);
    const precision = step >= 1 ? 0 : Math.min(4, Math.max(0, String(step).split(".")[1]?.length || 0));
    input.value = precision > 0 ? nextValue.toFixed(precision) : String(Math.round(nextValue));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.focus({ preventScroll: true });
  };

  const startFogStepperSession = (button, direction, event) => {
    const root = button.closest("[data-fog-number-field]");
    const input = root?.querySelector('input[data-entity-param-type="number"]');
    if (!(input instanceof HTMLInputElement)) return;
    const index = Number.parseInt(input.dataset.entityIndex || "", 10);
    const path = typeof input.dataset.entityParamPath === "string" ? input.dataset.entityParamPath.trim() : "";
    if (!Number.isInteger(index) || !path) return;
    stopFogStepperSession();
    const useLargeStep = Boolean(event?.shiftKey);
    const inputRef = { index, path, fallbackInput: input };
    nudgeFogNumberInput(inputRef, direction, { useLargeStep });
    const repeat = () => {
      if (!fogStepperSession) return;
      nudgeFogNumberInput(inputRef, direction, { useLargeStep });
      fogStepperSession.repeatTimeoutId = globalThis.setTimeout(repeat, 78);
    };
    fogStepperSession = {
      repeatTimeoutId: globalThis.setTimeout(repeat, 165),
    };
  };

  const handleFloatingPanelPointerDown = (event) => {
    if (event.pointerType === "mouse") return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const stepButton = target.closest("[data-fog-step-direction]");
    if (!(stepButton instanceof HTMLButtonElement)) return;
    if (event.button !== 0 || event.isPrimary === false) return;
    const direction = Number.parseInt(stepButton.dataset.fogStepDirection || "", 10);
    if (direction !== -1 && direction !== 1) return;
    event.preventDefault();
    event.stopPropagation();
    startFogStepperSession(stepButton, direction, event);
  };

  const handleFloatingPanelMouseDown = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const stepButton = target.closest("[data-fog-step-direction]");
    if (!(stepButton instanceof HTMLButtonElement)) return;
    if (event.button !== 0) return;
    const direction = Number.parseInt(stepButton.dataset.fogStepDirection || "", 10);
    if (direction !== -1 && direction !== 1) return;
    event.preventDefault();
    event.stopPropagation();
    startFogStepperSession(stepButton, direction, event);
  };

  const handleFloatingPanelKeyDown = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    stopNativeInputKeyboardPropagation(event);
    if (!target.dataset.entityParamPath) return;
    if (event.key === "Enter") {
      event.preventDefault();
      target.dispatchEvent(new Event("change", { bubbles: true }));
      target.blur();
    }
  };

  const handleFloatingPanelSubmit = (event) => {
    event.preventDefault();
    confirmNewLevelSizeFlow();
  };

  const handleTopBarClick = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const toggleButton = target.closest("[data-topbar-menu-toggle]");
    if (toggleButton instanceof HTMLButtonElement) {
      const menuName = toggleButton.dataset.topbarMenuToggle;
      if (menuName === "export" || menuName === "settings" || menuName === "help") {
        toggleTopBarMenu(menuName);
      }
      return;
    }

    const actionButton = target.closest("[data-topbar-action]");
    if (actionButton instanceof HTMLButtonElement) {
      const action = actionButton.dataset.topbarAction;
      if (action === "new") openNewLevelSizeFlow();
      if (action === "import") handleImport();
      if (action === "play-from-here") handlePlayFromHereLaunch();
      if (action === "undo") handleUndo();
      if (action === "redo") handleRedo();
      if (action === "toggle-darkness") updatePreviewSettings("darkness", !store.getState().ui.darknessPreviewEnabled);
      if (action === "toggle-proximity-overlays") {
        updatePreviewSettings("proximity-overlays", store.getState().ui.proximityOverlaysEnabled === false);
      }
      return;
    }

    const exportActionButton = target.closest("[data-export-action]");
    if (exportActionButton instanceof HTMLButtonElement) {
      if (exportActionButton.dataset.exportAction === "download") {
        handleExportDownload();
      }
      return;
    }

    const workspacePresetButton = target.closest("[data-workspace-preset]");
    if (workspacePresetButton instanceof HTMLButtonElement) {
      const preset = workspacePresetButton.dataset.workspacePreset;
      if (preset) {
        updateWorkspaceSettings("background", preset);
      }
      return;
    }

    const backgroundActionButton = target.closest("[data-background-action]");
    if (backgroundActionButton instanceof HTMLButtonElement) {
      const action = backgroundActionButton.dataset.backgroundAction;
      if (action === "add") {
        updateBackgroundLayer(-1, "add", null);
      }
      if (action === "remove") {
        const index = Number.parseInt(backgroundActionButton.dataset.backgroundIndex || "", 10);
        if (Number.isInteger(index) && index >= 0) {
          updateBackgroundLayer(index, "remove", null);
        }
      }
    }
  };

  const handleTopBarFieldInput = (target, options = {}) => {
    const { commit = true } = options;
    const exportMetaField = target.dataset.exportMetaField;
    if (exportMetaField === "name" || exportMetaField === "id") {
      const nextValue = commit
        ? target.value.trim() || (exportMetaField === "name" ? "Untitled Level" : "untitled-level")
        : target.value;
      if (commit) {
        target.value = nextValue;
      }
      updateDocumentMeta(exportMetaField, nextValue);
      return true;
    }

    const exportDimensionField = target.dataset.exportDimensionField;
    if (exportDimensionField === "width" || exportDimensionField === "height") {
      const state = store.getState();
      const active = state.document.active;
      if (!active) return true;

      const nextValue = target.value.trim()
        ? sanitizeLevelDimension(target.value, active.dimensions[exportDimensionField], exportDimensionField)
        : active.dimensions[exportDimensionField];
      target.value = String(nextValue);
      const nextWidth = exportDimensionField === "width" ? nextValue : active.dimensions.width;
      const nextHeight = exportDimensionField === "height" ? nextValue : active.dimensions.height;
      resizeDocument(nextWidth, nextHeight);
      return true;
    }

    const gridField = target.dataset.gridField;
    if (gridField === "visible" || gridField === "opacity" || gridField === "color") {
      const value = gridField === "visible"
        ? target.checked
        : gridField === "opacity"
          ? Number.parseFloat(target.value)
          : target.value;
      updateGridSettings(gridField, value);
      return true;
    }

    const previewField = target.dataset.previewField;
    if (previewField === "darkness" || previewField === "proximity-overlays") {
      updatePreviewSettings(previewField, target.checked);
      return true;
    }

    return false;
  };

  const handleTopBarInput = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    handleTopBarFieldInput(target, { commit: false });
  };

  const handleTopBarChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (handleTopBarFieldInput(target, { commit: true })) return;

    const workspaceField = target.dataset.workspaceField;
    if (workspaceField === "background") {
      updateWorkspaceSettings("background", target.value);
      return;
    }

    const backgroundField = target.dataset.backgroundField;
    if (backgroundField === "name" || backgroundField === "visible" || backgroundField === "color" || backgroundField === "depth") {
      const index = Number.parseInt(target.dataset.backgroundIndex || "", 10);
      if (!Number.isInteger(index) || index < 0) return;
      const value = backgroundField === "visible"
        ? target.checked
        : backgroundField === "depth"
          ? Number.parseFloat(target.value)
          : target.value;
      updateBackgroundLayer(index, backgroundField, value);
    }
  };

  const handleDocumentPointerDown = (event) => {
    if (!(event.target instanceof Element)) return;
    if (topBar.contains(event.target)) return;
    if (floatingPanelHost.contains(event.target)) return;
    if (store.getState().ui.topBarMenu) {
      closeTopBarMenu();
    }
    if (store.getState().ui.newLevelSize?.isOpen) {
      closeNewLevelSizeFlow();
    }
    stopFogStepperSession();
  };

  const loadDocument = async () => {
    store.setState((state) => {
      state.document.status = "loading";
      state.document.error = null;
    });

    try {
      const doc = await loadLevelDocument();
      store.setState((state) => {
        state.document.active = doc;
        state.document.status = "ready";
        state.interaction.hoveredEntityIndex = null;
        state.interaction.hoveredEntityId = null;
        state.interaction.hoveredDecorIndex = null;
        state.interaction.hoveredDecorId = null;
        clearHoveredSound(state.interaction);
        state.interaction.activeLayer = PANEL_LAYERS.TILES;
        state.interaction.activeBackgroundMaterialId = state.document.active?.background?.materials?.[0]?.id || DEFAULT_BACKGROUND_MATERIAL_ID;
        state.interaction.canvasSelectionMode = "entity";
        clearDecorSelection(state.interaction);
        clearSoundSelection(state.interaction);
        state.interaction.selectedCell = null;
        state.interaction.hoverCell = null;
        clearEntitySelection(state.interaction);
        state.interaction.boxSelection = null;
        state.interaction.entityDrag = null;
        state.interaction.decorDrag = null;
        state.interaction.soundDrag = null;
        state.interaction.scanDrag = null;
        state.interaction.volumePlacementDrag = null;
        state.interaction.decorScatterMode = false;
        state.interaction.decorScatterDrag = null;
        state.interaction.activeEntityPresetId = null;
        state.interaction.activeDecorPresetId = null;
        state.interaction.activeSoundPresetId = null;
        state.interaction.objectPlacementPreviewSuppressed = false;
        state.ui.newLevelSize = {
          isOpen: false,
          width: String(doc?.dimensions?.width || DEFAULT_NEW_LEVEL_WIDTH),
          height: String(doc?.dimensions?.height || DEFAULT_NEW_LEVEL_HEIGHT),
          error: null,
        };
        syncScanWithDocument(state, { preserveRange: false, preserveLog: false });
      });
      resize();
      draw(store.getState());
    } catch (error) {
      store.setState((state) => {
        state.document.status = "error";
        state.document.error = error instanceof Error ? error.message : "Unknown document load error";
      });
    }
  };

  const hydratedFogDefaults = readFogDefaultsFromStorage();
  if (hydratedFogDefaults) {
    store.setState((draft) => {
      draft.ui.specialVolumeWorkbench.mode = "floating";
      draft.ui.specialVolumeWorkbench.fogDefaults = hydratedFogDefaults;
    });
  }

  const unsubscribe = store.subscribe(draw);
  const unsubscribeScanAudio = store.subscribe(syncScanAudioPlayback);
  const unsubscribeSoundPreview = store.subscribe(syncSoundPreviewLifecycle);
  const panelBindingOptions = {
    onEntityUpdate: updateEntity,
    onDecorUpdate: updateDecor,
    onSoundUpdate: updateSound,
    onScanUpdate: updateScanControl,
  };
  const unbindInspectorPanel = bindInspectorPanel(inspector, store, panelBindingOptions);
  const unbindBottomPanel = bindBottomPanel(bottomPanel, store, panelBindingOptions);
  const unbindBrushPanel = bindBrushPanel(brushPanel, store, {
    onEntityUpdate: updateEntity,
    onDecorUpdate: updateDecor,
    onSoundUpdate: updateSound,
    onVolumeUpdate: updateVolume,
    onCanvasTargetChange: setActiveCanvasTarget,
    onLayerChange: setActiveLayerFromPanel,
    onScanUpdate: updateScanControl,
  });
  window.addEventListener("resize", resize);
  canvas.addEventListener("mousemove", handleCanvasMouseMove);
  canvas.addEventListener("mouseleave", clearHoveredCanvasState);
  canvas.addEventListener("mousedown", handleCanvasMouseDown);
  canvas.addEventListener("wheel", handleCanvasWheel, { passive: false });
  window.addEventListener("mouseup", stopCanvasInteraction);
  window.addEventListener("mouseup", stopFogStepperSession);
  window.addEventListener("pointerup", stopFogStepperSession);
  window.addEventListener("pointercancel", stopFogStepperSession);
  window.addEventListener("blur", stopFogStepperSession);
  window.addEventListener("blur", stopFogPreviewMotionLoop);
  window.addEventListener("blur", stopWaterPreviewMotionLoop);
  window.addEventListener("blur", stopLavaPreviewMotionLoop);
  window.addEventListener("blur", stopBubblingLiquidPreviewMotionLoop);
  canvas.addEventListener("click", handleCanvasClick);
  minimapCanvas.addEventListener("click", handleMinimapClick);
  window.addEventListener("keydown", handleGlobalKeyDown);
  window.addEventListener("keyup", handleGlobalKeyUp);
  topBar.addEventListener("click", handleTopBarClick);
  topBar.addEventListener("input", handleTopBarInput);
  topBar.addEventListener("change", handleTopBarChange);
  floatingPanelHost.addEventListener("click", handleFloatingPanelClick);
  floatingPanelHost.addEventListener("input", handleFloatingPanelInput);
  floatingPanelHost.addEventListener("change", handleFloatingPanelChange);
  floatingPanelHost.addEventListener("pointerdown", handleFloatingPanelPointerDown);
  floatingPanelHost.addEventListener("mousedown", handleFloatingPanelMouseDown);
  floatingPanelHost.addEventListener("keydown", handleFloatingPanelKeyDown, true);
  floatingPanelHost.addEventListener("submit", handleFloatingPanelSubmit);
  document.addEventListener("pointerdown", handleDocumentPointerDown);

  resize();
  draw(store.getState());
  syncScanAudioPlayback(store.getState());
  void loadDocument();

  return () => {
    invalidateScanPlayback();
    scanAudioPlayback.destroy();
    soundPreviewPlayback.destroy();
    unsubscribe();
    unsubscribeScanAudio();
    unsubscribeSoundPreview();
    unbindInspectorPanel();
    unbindBottomPanel();
    unbindBrushPanel();
    window.removeEventListener("resize", resize);
    canvas.removeEventListener("mousemove", handleCanvasMouseMove);
    canvas.removeEventListener("mouseleave", clearHoveredCanvasState);
    canvas.removeEventListener("mousedown", handleCanvasMouseDown);
    canvas.removeEventListener("wheel", handleCanvasWheel);
    window.removeEventListener("mouseup", stopCanvasInteraction);
    window.removeEventListener("mouseup", stopFogStepperSession);
    window.removeEventListener("pointerup", stopFogStepperSession);
    window.removeEventListener("pointercancel", stopFogStepperSession);
    window.removeEventListener("blur", stopFogStepperSession);
    window.removeEventListener("blur", stopFogPreviewMotionLoop);
    window.removeEventListener("blur", stopWaterPreviewMotionLoop);
    window.removeEventListener("blur", stopLavaPreviewMotionLoop);
    window.removeEventListener("blur", stopBubblingLiquidPreviewMotionLoop);
    canvas.removeEventListener("click", handleCanvasClick);
    minimapCanvas.removeEventListener("click", handleMinimapClick);
    window.removeEventListener("keydown", handleGlobalKeyDown);
    window.removeEventListener("keyup", handleGlobalKeyUp);
    topBar.removeEventListener("click", handleTopBarClick);
    topBar.removeEventListener("input", handleTopBarInput);
    topBar.removeEventListener("change", handleTopBarChange);
    floatingPanelHost.removeEventListener("click", handleFloatingPanelClick);
    floatingPanelHost.removeEventListener("input", handleFloatingPanelInput);
    floatingPanelHost.removeEventListener("change", handleFloatingPanelChange);
    floatingPanelHost.removeEventListener("pointerdown", handleFloatingPanelPointerDown);
    floatingPanelHost.removeEventListener("mousedown", handleFloatingPanelMouseDown);
    floatingPanelHost.removeEventListener("keydown", handleFloatingPanelKeyDown, true);
    floatingPanelHost.removeEventListener("submit", handleFloatingPanelSubmit);
    document.removeEventListener("pointerdown", handleDocumentPointerDown);
    stopArrowPanLoop();
    stopFogPreviewMotionLoop();
    stopWaterPreviewMotionLoop();
    stopLavaPreviewMotionLoop();
    stopBubblingLiquidPreviewMotionLoop();
  };
}
