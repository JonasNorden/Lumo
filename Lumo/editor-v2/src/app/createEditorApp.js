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
import { triggerLevelDocumentDownload } from "../data/exportLevelDocument.js";
import { importLevelDocumentFromFile } from "../data/importLevelDocument.js";
import { createNewLevelDocument } from "../data/createNewLevelDocument.js";
import { resolveTileFromBrushDraft, paintSingleTile } from "../domain/tiles/paintTile.js";
import { resolveBrushSize, getBrushCells } from "../domain/tiles/brushSize.js";
import { eraseSingleTile } from "../domain/tiles/eraseTile.js";
import { EDITOR_TOOLS } from "../domain/tiles/tools.js";
import { getLineCells } from "../domain/tiles/line.js";
import { getFloodFillCells } from "../domain/tiles/floodFill.js";
import {
  createEntityEditEntry,
  createDecorEditEntry,
  createSoundEditEntry,
  createTileEditEntry,
  startTileEditBatch,
  startHistoryBatch,
  pushHistoryEntry,
  pushTileEdit,
  endTileEditBatch,
  undoTileEdit,
  redoTileEdit,
  canUndo,
  canRedo,
} from "../domain/tiles/history.js";
import { createDefaultBackgroundLayer, getTileIndex } from "../domain/level/levelDocument.js";
import { findEntityAtCanvasPoint } from "../render/layers/entityLayer.js";
import { findDecorAtCanvasPoint } from "../render/layers/decorLayer.js";
import { findSoundAtCanvasPoint } from "../render/layers/soundLayer.js";
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
import { DEFAULT_SOUND_PRESET_ID, findSoundPresetById, getSoundPresetDefaultParams, getSoundPresetForType } from "../domain/sound/soundPresets.js";
import { normalizeSoundSourceValue } from "../domain/sound/sourceReference.js";
import { normalizeSoundType } from "../domain/sound/soundVisuals.js";
import { createSoundPreviewController, getSoundPreviewKey } from "../domain/sound/soundPreviewPlayback.js";
import { cloneEntityParams, isSupportedEntityParamValue } from "../domain/entities/entityParams.js";
import {
  applyFogVolumeParamChange,
  createFogVolumeEntityFromWorldRect,
  getFogVolumeRect,
  isFogVolumeEntityType,
  isSpecialVolumeEntityType,
  resizeFogVolumeEntity,
  shiftFogVolumeEntity,
  syncFogVolumeEntityToAnchor,
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
import {
  clearDecorSelection,
  getPrimarySelectedDecorIndex,
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
  toggleEntitySelection,
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

const BATCH_EDITABLE_SOUND_PARAM_KEYS = new Set(["spatial", "volume", "pitch", "loop"]);


function getInspectedCell(state) {
  return state.interaction.selectedCell || state.interaction.hoverCell;
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
  const activeTargetLabel = activeLayer === PANEL_LAYERS.DECOR ? "Decor" : activeLayer === PANEL_LAYERS.ENTITIES ? "Entities" : activeLayer === PANEL_LAYERS.SOUND ? "Sound" : "Tiles";
  const targetSelectionCount =
    activeLayer === PANEL_LAYERS.DECOR
      ? getSelectedDecorIndices(state.interaction).length
      : activeLayer === PANEL_LAYERS.ENTITIES
        ? getSelectedEntityIndices(state.interaction).length
        : activeLayer === PANEL_LAYERS.SOUND
          ? getSelectedSoundIndices(state.interaction).length
          : 0;
  const targetSelectionLabel = activeLayer === PANEL_LAYERS.TILES
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
  TILES: "tiles",
  ENTITIES: "entities",
  DECOR: "decor",
  SOUND: "sound",
};

function getActiveLayer(interaction) {
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderSettingsMenu(state) {
  const active = state.document.active;
  const layers = [...(active?.backgrounds?.layers || [])].sort((left, right) => (left.depth ?? 0) - (right.depth ?? 0));
  const { gridVisible, gridOpacity, gridColor } = state.viewport;
  const darknessPreviewEnabled = Boolean(state.ui.darknessPreviewEnabled);

  return `
    <div class="topBarMenuSection">
      <div class="topBarMenuTitle">Preview</div>
      <label class="fieldRow compactInline">
        <span class="label">Darkness Preview</span>
        <input type="checkbox" data-preview-field="darkness" ${darknessPreviewEnabled ? "checked" : ""} />
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
          <input type="number" min="8" max="256" step="1" value="${active.dimensions.width}" data-export-dimension-field="width" />
        </label>
        <label class="fieldRow fieldRowCompact">
          <span class="label">Height</span>
          <input type="number" min="8" max="256" step="1" value="${active.dimensions.height}" data-export-dimension-field="height" />
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
    suppressNextClick: false,
    hoveringPausedScanHandle: false,
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

    const selectedIndices = getSelectedSoundIndices(state.interaction);
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

  const isShortcutTargetBlocked = (eventTarget) => {
    if (!(eventTarget instanceof Element)) return false;

    return Boolean(eventTarget.closest("input, textarea, select, button, [contenteditable='true'], [contenteditable='']"));
  };

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
      const copyWidth = Math.min(currentWidth, nextWidth);
      const copyHeight = Math.min(currentHeight, nextHeight);

      for (let y = 0; y < copyHeight; y += 1) {
        for (let x = 0; x < copyWidth; x += 1) {
          const sourceIndex = getTileIndex(currentWidth, x, y);
          const targetIndex = getTileIndex(nextWidth, x, y);
          resizedTiles[targetIndex] = doc.tiles.base[sourceIndex];
        }
      }

      doc.dimensions.width = nextWidth;
      doc.dimensions.height = nextHeight;
      doc.tiles.base = resizedTiles;

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

      pruneDecorSelection(draft.interaction, doc.decor?.length || 0);
      if (Number.isInteger(draft.interaction.hoveredDecorIndex) && draft.interaction.hoveredDecorIndex >= (doc.decor?.length || 0)) {
        draft.interaction.hoveredDecorIndex = null;
      }

      pruneEntitySelection(draft.interaction, doc.entities?.length || 0);
      pruneSoundSelection(draft.interaction, doc.sounds?.length || 0);
      if (Number.isInteger(draft.interaction.hoveredSoundIndex) && draft.interaction.hoveredSoundIndex >= (doc.sounds?.length || 0)) {
        draft.interaction.hoveredSoundIndex = null;
      }
      updateEntitySelectionCell(draft);
      updateSoundSelectionCell(draft);
      draft.interaction.hoverCell = null;
      draft.interaction.dragPaint = null;
      draft.interaction.rectDrag = null;
      draft.interaction.lineDrag = null;
      draft.interaction.boxSelection = null;
      clearDecorScatterDrag(draft);
      draft.history.undoStack = [];
      draft.history.redoStack = [];
      draft.history.activeBatch = null;
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
      if (field !== "darkness") return;
      draft.ui.darknessPreviewEnabled = Boolean(value);
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

  const getWorldPointFromCanvasPoint = (viewport, point) => ({
    x: (point.x - viewport.offsetX) / Math.max(0.0001, viewport.zoom),
    y: (point.y - viewport.offsetY) / Math.max(0.0001, viewport.zoom),
  });

  const clampWorldPointToDocument = (doc, point) => {
    const maxX = doc.dimensions.width * doc.dimensions.tileSize;
    const maxY = doc.dimensions.height * doc.dimensions.tileSize;
    return {
      x: Math.max(0, Math.min(maxX, point.x)),
      y: Math.max(0, Math.min(maxY, point.y)),
    };
  };

  const getClampedWorldPointFromCanvasPoint = (doc, viewport, point) =>
    clampWorldPointToDocument(doc, getWorldPointFromCanvasPoint(viewport, point));

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
    if (layer === PANEL_LAYERS.TILES) draft.ui.panelSections.tiles = true;
    if (layer === PANEL_LAYERS.ENTITIES) draft.ui.panelSections.entities = true;
    if (layer === PANEL_LAYERS.DECOR) draft.ui.panelSections.decor = true;
    if (layer === PANEL_LAYERS.SOUND) draft.ui.panelSections.sound = true;
    draft.ui.panelSections.layer = true;
  };

  const setActiveLayer = (draft, layer) => {
    draft.interaction.activeLayer = layer === PANEL_LAYERS.DECOR
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
      ? getSelectedDecorIndices(state.interaction).length
      : activeLayer === PANEL_LAYERS.ENTITIES
        ? getSelectedEntityIndices(state.interaction).length
        : activeLayer === PANEL_LAYERS.SOUND
          ? getSelectedSoundIndices(state.interaction).length
          : 0;
    const activeSelectionLabel = activeLayer === PANEL_LAYERS.DECOR ? "Decor" : activeLayer === PANEL_LAYERS.ENTITIES ? "Entities" : activeLayer === PANEL_LAYERS.SOUND ? "Sound" : "Tiles";
    const statusLabel = state.ui.importStatus || `Layer: ${activeSelectionLabel} · ${selectedCount || 0} selected`;

    topBarStatus.textContent = statusLabel;
    topBarStatus.dataset.target = activeLayer;

    const undoEnabled = canUndo(state.history);
    const redoEnabled = canRedo(state.history);
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

  const applyCanvasTarget = (draft, mode) => {
    const nextMode = mode === "decor" ? "decor" : mode === "sound" ? "sound" : "entity";
    setCanvasSelectionMode(draft, nextMode);
    setActiveLayer(draft, nextMode === "decor" ? PANEL_LAYERS.DECOR : nextMode === "sound" ? PANEL_LAYERS.SOUND : PANEL_LAYERS.ENTITIES);
    draft.interaction.boxSelection = null;
    draft.interaction.entityDrag = null;
    draft.interaction.specialVolumePlacement = null;
    draft.interaction.decorDrag = null;
    draft.interaction.soundDrag = null;
    draft.interaction.scanDrag = null;
    clearDecorScatterDrag(draft);

    if (nextMode === "decor") {
      clearEntitySelection(draft.interaction);
      clearSoundSelection(draft.interaction);
      draft.interaction.hoveredEntityIndex = null;
      draft.interaction.hoveredSoundIndex = null;
      updateDecorSelectionCell(draft);
      if (!getSelectedDecorIndices(draft.interaction).length) {
        draft.interaction.selectedCell = null;
      }
      return;
    }

    if (nextMode === "sound") {
      clearEntitySelection(draft.interaction);
      clearDecorSelection(draft.interaction);
      draft.interaction.hoveredEntityIndex = null;
      draft.interaction.hoveredDecorIndex = null;
      updateSoundSelectionCell(draft);
      if (!getSelectedSoundIndices(draft.interaction).length) {
        draft.interaction.selectedCell = null;
      }
      return;
    }

    clearDecorSelection(draft.interaction);
    clearSoundSelection(draft.interaction);
    draft.interaction.hoveredDecorIndex = null;
    draft.interaction.hoveredSoundIndex = null;
    updateEntitySelectionCell(draft);
    if (!getSelectedEntityIndices(draft.interaction).length) {
      draft.interaction.selectedCell = null;
    }
  };

  const clearSpecialVolumePlacement = (draft) => {
    draft.interaction.specialVolumePlacement = null;
  };

  const clearActiveSelection = (draft, nextMode = getSelectionMode(draft.interaction)) => {
    clearSpecialVolumePlacement(draft);
    if (getActiveLayer(draft.interaction) === PANEL_LAYERS.TILES) {
      clearEntitySelection(draft.interaction);
      clearDecorSelection(draft.interaction);
      clearSoundSelection(draft.interaction);
      draft.interaction.hoveredEntityIndex = null;
      draft.interaction.hoveredDecorIndex = null;
      draft.interaction.hoveredSoundIndex = null;
      draft.interaction.entityDrag = null;
      draft.interaction.decorDrag = null;
      draft.interaction.soundDrag = null;
      return;
    }

    if (nextMode === "decor") {
      clearEntitySelection(draft.interaction);
      clearSoundSelection(draft.interaction);
      draft.interaction.hoveredEntityIndex = null;
      draft.interaction.hoveredSoundIndex = null;
      draft.interaction.entityDrag = null;
      draft.interaction.soundDrag = null;
      return;
    }

    if (nextMode === "sound") {
      clearEntitySelection(draft.interaction);
      clearDecorSelection(draft.interaction);
      draft.interaction.hoveredEntityIndex = null;
      draft.interaction.hoveredDecorIndex = null;
      draft.interaction.entityDrag = null;
      draft.interaction.decorDrag = null;
      return;
    }

    clearDecorSelection(draft.interaction);
    clearSoundSelection(draft.interaction);
    draft.interaction.hoveredDecorIndex = null;
    draft.interaction.hoveredSoundIndex = null;
    draft.interaction.decorDrag = null;
    draft.interaction.soundDrag = null;
  };

  const getDecorScatterSettings = (interaction) => ({
    density: clampScatterDensity(interaction.decorScatterSettings?.density),
    randomness: clampScatterRandomness(interaction.decorScatterSettings?.randomness),
    variantMode: interaction.decorScatterSettings?.variantMode === "random" ? "random" : "fixed",
  });

  const updateDecorSelectionCell = (draft, decorIndex = getPrimarySelectedDecorIndex(draft.interaction)) => {
    const decor = Number.isInteger(decorIndex) ? draft.document.active?.decor?.[decorIndex] : null;
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
      return getEntityPresetForType(normalizedPresetId);
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

    return isSpecialVolumeEntityType(entity.type)
      ? syncFogVolumeEntityToAnchor(entity, doc.dimensions.tileSize)
      : entity;
  };

  const finalizeSpecialVolumePlacement = (draft) => {
    const doc = draft.document.active;
    const placement = draft.interaction.specialVolumePlacement;
    if (!doc || !placement?.active) return null;

    const preset = resolveEntityPlacementPreset(placement.presetId);
    if (!preset || !isSpecialVolumeEntityType(preset.type)) {
      draft.interaction.specialVolumePlacement = null;
      return null;
    }

    const startWorld = placement.startWorld;
    const currentWorld = placement.currentWorld || placement.startWorld;
    const draggedWidth = Math.abs((currentWorld?.x ?? startWorld?.x ?? 0) - (startWorld?.x ?? 0));
    const draggedHeight = Math.abs((currentWorld?.y ?? startWorld?.y ?? 0) - (startWorld?.y ?? 0));
    if (draggedWidth < 1 && draggedHeight < 1) {
      clearSpecialVolumePlacement(draft);
      return null;
    }
    const baseEntity = createEntityDraft(
      doc,
      placement.startCell.x,
      placement.startCell.y,
      placement.presetId,
      (doc.entities?.length || 0) + 1,
    );
    const nextEntity = isFogVolumeEntityType(baseEntity.type)
      ? createFogVolumeEntityFromWorldRect(baseEntity, {
          x0: startWorld.x,
          y0: startWorld.y,
          x1: currentWorld.x,
          y1: currentWorld.y,
        }, doc.dimensions.tileSize)
      : baseEntity;

    doc.entities.push(nextEntity);
    const createdIndex = doc.entities.length - 1;
    pushHistoryEntry(
      draft.history,
      createEntityEditEntry("create", {
        index: createdIndex,
        entity: { ...nextEntity, params: cloneEntityParams(nextEntity.params) },
      }),
    );
    setEntitySelection(draft.interaction, [createdIndex], createdIndex);
    draft.interaction.hoveredEntityIndex = createdIndex;
    draft.interaction.hoveredDecorIndex = null;
    draft.interaction.hoveredSoundIndex = null;
    clearDecorSelection(draft.interaction);
    clearSoundSelection(draft.interaction);
    draft.interaction.entityDrag = null;
    draft.interaction.decorDrag = null;
    draft.interaction.soundDrag = null;
    clearSpecialVolumePlacement(draft);
    setCanvasSelectionMode(draft, "entity");
    updateEntitySelectionCell(draft, createdIndex);
    return createdIndex;
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
    getSelectedDecorIndices(interaction).filter((index) => index >= 0 && index < decorItems.length);

  const getSelectedDecor = (interaction, decorItems) =>
    getDecorSelectionIndices(interaction, decorItems).map((index) => ({ index, decor: decorItems[index] })).filter((entry) => entry.decor);

  const getSoundSelectionIndices = (interaction, sounds) =>
    getSelectedSoundIndices(interaction).filter((index) => index >= 0 && index < sounds.length);

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
      .filter(({ entity }) => entity?.visible)
      .filter(({ entity }) => {
        if (isSpecialVolumeEntityType(entity?.type)) {
          const rect = getFogVolumeRect(entity, tileSize);
          const rectMinX = viewport.offsetX + rect.x0 * viewport.zoom;
          const rectMaxX = viewport.offsetX + rect.x1 * viewport.zoom;
          const rectMinY = viewport.offsetY + rect.top * viewport.zoom;
          const rectMaxY = viewport.offsetY + rect.bottom * viewport.zoom;
          return rectMaxX >= minX && rectMinX <= maxX && rectMaxY >= minY && rectMinY <= maxY;
        }

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
    const entity = Number.isInteger(primaryIndex) ? draft.document.active?.entities?.[primaryIndex] : null;
    draft.interaction.selectedCell = entity ? { x: entity.x, y: entity.y } : null;
  };

  const updateSoundSelectionCell = (draft, primaryIndex = getPrimarySelectedSoundIndex(draft.interaction)) => {
    const sound = Number.isInteger(primaryIndex) ? draft.document.active?.sounds?.[primaryIndex] : null;
    draft.interaction.selectedCell = sound ? { x: sound.x, y: sound.y } : null;
  };

  const pushDecorUpdateHistory = (history, index, previousDecor, nextDecor) => {
    if (!previousDecor || !nextDecor) return;
    pushHistoryEntry(
      history,
      createDecorEditEntry("update", {
        index,
        previousDecor: { ...previousDecor, params: cloneEntityParams(previousDecor.params) },
        nextDecor: { ...nextDecor, params: cloneEntityParams(nextDecor.params) },
      }),
    );
  };

  const pushEntityUpdateHistory = (history, index, previousEntity, nextEntity) => {
    if (!previousEntity || !nextEntity) return;
    pushHistoryEntry(
      history,
      createEntityEditEntry("update", {
        index,
        previousEntity: { ...previousEntity, params: cloneEntityParams(previousEntity.params) },
        nextEntity: { ...nextEntity, params: cloneEntityParams(nextEntity.params) },
      }),
    );
  };


  const pushSoundUpdateHistory = (history, index, previousSound, nextSound) => {
    if (!previousSound || !nextSound) return;
    pushHistoryEntry(
      history,
      createSoundEditEntry("update", {
        index,
        previousSound: { ...previousSound, params: cloneEntityParams(previousSound.params) },
        nextSound: { ...nextSound, params: cloneEntityParams(nextSound.params) },
      }),
    );
  };

  const applySoundFieldUpdate = (sound, field, value) => {
    if (!sound) return null;

    if (field === "param") {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const key = typeof value.key === "string" ? value.key.trim() : "";
      if (!key || !isSupportedEntityParamValue(value.value)) return null;

      const nextParams = { ...cloneEntityParams(sound.params), [key]: value.value };
      if (cloneEntityParams(sound.params)[key] === value.value) return null;
      return { ...sound, params: nextParams };
    }

    if (field === "name" || field === "type" || field === "source") {
      const trimmed = String(value || "").trim();
      const preset = field === "type" ? getSoundPresetForType(trimmed || sound[field]) : null;
      const nextValue = field === "type"
        ? normalizeSoundType(preset?.type || trimmed || sound[field])
        : field === "source"
          ? normalizeSoundSourceValue(value)
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
      const nextVisible = Boolean(value);
      if (sound.visible === nextVisible) return null;
      return { ...sound, visible: nextVisible, params: cloneEntityParams(sound.params) };
    }

    return null;
  };

  const applyBatchSoundUpdate = (draft, indices, field, value) => {
    const doc = draft.document.active;
    if (!doc || !indices.length) return false;

    let changed = false;
    startHistoryBatch(draft.history, "sound-batch-edit");
    for (const index of indices) {
      const sound = doc.sounds?.[index];
      const nextSound = applySoundFieldUpdate(sound, field, value);
      if (!sound || !nextSound) continue;

      doc.sounds.splice(index, 1, nextSound);
      pushSoundUpdateHistory(
        draft.history,
        index,
        { ...sound, params: cloneEntityParams(sound.params) },
        { ...nextSound, params: cloneEntityParams(nextSound.params) },
      );
      changed = true;
    }
    endHistoryBatch(draft.history);
    return changed;
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

    setSoundSelection(draft.interaction, nextSelection, nextSelection.includes(referenceIndex) ? referenceIndex : nextSelection.at(-1) ?? null);
    draft.interaction.hoveredSoundIndex = Number.isInteger(referenceIndex) ? referenceIndex : nextSelection.at(-1) ?? null;
    clearEntitySelection(draft.interaction);
    clearDecorSelection(draft.interaction);
    draft.interaction.hoveredEntityIndex = null;
    draft.interaction.hoveredDecorIndex = null;
    draft.interaction.entityDrag = null;
    draft.interaction.decorDrag = null;
    applyCanvasTarget(draft, "sound");
    updateSoundSelectionCell(draft, getPrimarySelectedSoundIndex(draft.interaction));
    return true;
  };

  const moveDecorSelectionByDelta = (draft, originPositions, delta) => {
    const doc = draft.document.active;
    if (!doc) return false;

    let changed = false;
    startHistoryBatch(draft.history, "decor-move");
    for (const origin of originPositions) {
      const decor = doc.decor?.[origin.index];
      if (!decor) continue;

      const previousDecor = { ...decor };
      const nextDecor = {
        ...decor,
        x: origin.x + delta.x,
        y: origin.y + delta.y,
      };

      if (previousDecor.x === nextDecor.x && previousDecor.y === nextDecor.y) continue;
      doc.decor.splice(origin.index, 1, nextDecor);
      pushDecorUpdateHistory(draft.history, origin.index, previousDecor, nextDecor);
      changed = true;
    }
    endHistoryBatch(draft.history);

    const primaryIndex = getPrimarySelectedDecorIndex(draft.interaction);
    updateDecorSelectionCell(draft, primaryIndex);
    return changed;
  };

  const moveSoundSelectionByDelta = (draft, originPositions, delta) => {
    const doc = draft.document.active;
    if (!doc) return false;

    let changed = false;
    startHistoryBatch(draft.history, "sound-move");
    for (const origin of originPositions) {
      const sound = doc.sounds?.[origin.index];
      if (!sound) continue;

      const previousSound = { ...sound, params: cloneEntityParams(sound.params) };
      const nextSound = {
        ...sound,
        x: origin.x + delta.x,
        y: origin.y + delta.y,
      };

      if (previousSound.x === nextSound.x && previousSound.y === nextSound.y) continue;
      doc.sounds.splice(origin.index, 1, nextSound);
      pushSoundUpdateHistory(draft.history, origin.index, previousSound, nextSound);
      changed = true;
    }
    endHistoryBatch(draft.history);

    updateSoundSelectionCell(draft, getPrimarySelectedSoundIndex(draft.interaction));
    return changed;
  };

  const moveEntitySelectionByDelta = (draft, originPositions, delta) => {
    const doc = draft.document.active;
    if (!doc) return false;

    let changed = false;
    startHistoryBatch(draft.history, "entity-move");
    for (const origin of originPositions) {
      const entity = doc.entities?.[origin.index];
      if (!entity) continue;

      const previousEntity = { ...entity, params: cloneEntityParams(entity.params) };
      const nextEntity = isSpecialVolumeEntityType(entity.type)
        ? shiftFogVolumeEntity(entity, delta.x, delta.y, doc.dimensions.tileSize)
        : {
          ...entity,
          x: origin.x + delta.x,
          y: origin.y + delta.y,
        };

      if (
        previousEntity.x === nextEntity.x
        && previousEntity.y === nextEntity.y
        && JSON.stringify(previousEntity.params || {}) === JSON.stringify(nextEntity.params || {})
      ) continue;
      doc.entities.splice(origin.index, 1, nextEntity);
      pushEntityUpdateHistory(draft.history, origin.index, previousEntity, nextEntity);
      changed = true;
    }
    endHistoryBatch(draft.history);

    updateEntitySelectionCell(draft, getPrimarySelectedEntityIndex(draft.interaction));
    return changed;
  };

  const moveEntityToCell = (draft, index, cell) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const entity = doc.entities?.[index];
    if (!entity || !cell) return false;

    const next = clampEntityPosition(doc, cell.x, cell.y);
    const nextEntity = isSpecialVolumeEntityType(entity.type)
      ? shiftFogVolumeEntity(entity, next.x - entity.x, next.y - entity.y, doc.dimensions.tileSize)
      : { ...entity, x: next.x, y: next.y };
    const changed = entity.x !== nextEntity.x
      || entity.y !== nextEntity.y
      || JSON.stringify(entity.params || {}) !== JSON.stringify(nextEntity.params || {});
    if (changed) {
      const previousEntity = { ...entity, params: cloneEntityParams(entity.params) };
      doc.entities.splice(index, 1, nextEntity);
      pushEntityUpdateHistory(draft.history, index, previousEntity, nextEntity);
    }
    setEntitySelection(draft.interaction, [index], index);
    updateEntitySelectionCell(draft, index);
    return changed;
  };

  const deleteSelectedDecor = (draft) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const selectedEntries = getSelectedDecor(draft.interaction, doc.decor || []);
    if (!selectedEntries.length) return false;

    startHistoryBatch(draft.history, "decor-delete");
    for (const { index, decor } of [...selectedEntries].sort((left, right) => right.index - left.index)) {
      doc.decor.splice(index, 1);
      pushHistoryEntry(
        draft.history,
        createDecorEditEntry("delete", {
          index,
          decor: { ...decor },
        }),
      );
    }
    endHistoryBatch(draft.history);

    clearDecorSelection(draft.interaction);
    const decorCount = doc.decor?.length || 0;
    draft.interaction.hoveredDecorIndex =
      Number.isInteger(draft.interaction.hoveredDecorIndex) && draft.interaction.hoveredDecorIndex >= decorCount
        ? decorCount ? decorCount - 1 : null
        : draft.interaction.hoveredDecorIndex;
    draft.interaction.decorDrag = null;
    draft.interaction.selectedCell = null;
    return true;
  };

  const duplicateSelectedDecor = (draft) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const selectedEntries = getSelectedDecor(draft.interaction, doc.decor || []);
    if (!selectedEntries.length) return false;

    let insertIndex = selectedEntries[selectedEntries.length - 1].index + 1;
    const duplicatedIndices = [];

    startHistoryBatch(draft.history, "decor-duplicate");
    for (const { decor: source } of selectedEntries) {
      const position = clampDecorPosition(doc, source.x + 1, source.y + 1);
      const duplicate = {
        ...source,
        id: getNextStringId(doc.decor, "id", "decor"),
        x: position.x,
        y: position.y,
      };

      doc.decor.splice(insertIndex, 0, duplicate);
      duplicatedIndices.push(insertIndex);
      pushHistoryEntry(
        draft.history,
        createDecorEditEntry("create", {
          index: insertIndex,
          decor: { ...duplicate },
        }),
      );
      insertIndex += 1;
    }
    endHistoryBatch(draft.history);

    const primaryIndex = duplicatedIndices[duplicatedIndices.length - 1] ?? null;
    setDecorSelection(draft.interaction, duplicatedIndices, primaryIndex);
    draft.interaction.hoveredDecorIndex = primaryIndex;
    setCanvasSelectionMode(draft, "decor");
    updateDecorSelectionCell(draft, primaryIndex);
    draft.interaction.decorDrag = null;
    clearEntitySelection(draft.interaction);
    draft.interaction.hoveredEntityIndex = null;
    return true;
  };

  const createDecorAtCell = (draft, cell, presetId = draft.interaction.activeDecorPresetId || DEFAULT_DECOR_PRESET_ID) => {
    const doc = draft.document.active;
    if (!doc || !cell) return null;

    const entityPreset = resolveEntityPlacementPreset(presetId);
    if (entityPreset) {
      return createEntityAtCell(draft, cell, entityPreset.id);
    }

    const decor = createDecorDraft(doc, cell.x, cell.y, presetId, (doc.decor?.length || 0) + 1);
    doc.decor.push(decor);
    const createdIndex = doc.decor.length - 1;
    pushHistoryEntry(
      draft.history,
      createDecorEditEntry("create", {
        index: createdIndex,
        decor: { ...decor },
      }),
    );
    setDecorSelection(draft.interaction, [createdIndex], createdIndex);
    draft.interaction.hoveredDecorIndex = createdIndex;
    draft.interaction.selectedCell = { x: decor.x, y: decor.y };
    clearEntitySelection(draft.interaction);
    draft.interaction.hoveredEntityIndex = null;
    draft.interaction.entityDrag = null;
    setCanvasSelectionMode(draft, "decor");
    return createdIndex;
  };

  const applyDecorScatter = (draft, startCell, endCell, presetId = draft.interaction.activeDecorPresetId || DEFAULT_DECOR_PRESET_ID) => {
    const doc = draft.document.active;
    if (!doc || !startCell || !endCell || !presetId) return 0;

    const settings = getDecorScatterSettings(draft.interaction);
    const scatterDecor = createScatterDecorEntries(doc, startCell, endCell, presetId, settings);
    if (!scatterDecor.length) return 0;

    startHistoryBatch(draft.history, "decor-scatter");
    for (const decor of scatterDecor) {
      const nextIndex = doc.decor.length;
      doc.decor.push(decor);
      pushHistoryEntry(
        draft.history,
        createDecorEditEntry("create", {
          index: nextIndex,
          decor: { ...decor },
        }),
      );
    }
    endHistoryBatch(draft.history);

    const selectedIndex = doc.decor.length - 1;
    setDecorSelection(draft.interaction, [selectedIndex], selectedIndex);
    draft.interaction.hoveredDecorIndex = selectedIndex;
    draft.interaction.selectedCell = { x: doc.decor[selectedIndex].x, y: doc.decor[selectedIndex].y };
    clearEntitySelection(draft.interaction);
    draft.interaction.entityDrag = null;
    draft.interaction.hoveredEntityIndex = null;
    setCanvasSelectionMode(draft, "decor");
    return scatterDecor.length;
  };

  const deleteSelectedSound = (draft) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const selectedEntries = getSelectedSounds(draft.interaction, doc.sounds || []);
    if (!selectedEntries.length) return false;

    startHistoryBatch(draft.history, "sound-delete");
    for (const { index, sound } of [...selectedEntries].sort((left, right) => right.index - left.index)) {
      doc.sounds.splice(index, 1);
      pushHistoryEntry(
        draft.history,
        createSoundEditEntry("delete", {
          index,
          sound: { ...sound, params: cloneEntityParams(sound.params) },
        }),
      );
    }
    endHistoryBatch(draft.history);

    clearSoundSelection(draft.interaction);
    const soundCount = doc.sounds?.length || 0;
    draft.interaction.hoveredSoundIndex =
      Number.isInteger(draft.interaction.hoveredSoundIndex) && draft.interaction.hoveredSoundIndex >= soundCount
        ? soundCount ? soundCount - 1 : null
        : draft.interaction.hoveredSoundIndex;
    draft.interaction.soundDrag = null;
    draft.interaction.selectedCell = null;
    return true;
  };

  const duplicateSelectedSound = (draft) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const selectedEntries = getSelectedSounds(draft.interaction, doc.sounds || []);
    if (!selectedEntries.length) return false;

    let insertIndex = selectedEntries[selectedEntries.length - 1].index + 1;
    const duplicatedIndices = [];

    startHistoryBatch(draft.history, "sound-duplicate");
    for (const { sound: source } of selectedEntries) {
      const position = clampSoundPosition(doc, source.x + 1, source.y + 1);
      const duplicate = {
        ...source,
        id: getNextStringId(doc.sounds, "id", "sound"),
        x: position.x,
        y: position.y,
        params: cloneEntityParams(source.params),
      };

      doc.sounds.splice(insertIndex, 0, duplicate);
      duplicatedIndices.push(insertIndex);
      pushHistoryEntry(
        draft.history,
        createSoundEditEntry("create", {
          index: insertIndex,
          sound: { ...duplicate, params: cloneEntityParams(duplicate.params) },
        }),
      );
      insertIndex += 1;
    }
    endHistoryBatch(draft.history);

    const primaryIndex = duplicatedIndices[duplicatedIndices.length - 1] ?? null;
    setSoundSelection(draft.interaction, duplicatedIndices, primaryIndex);
    draft.interaction.hoveredSoundIndex = primaryIndex;
    setCanvasSelectionMode(draft, "sound");
    updateSoundSelectionCell(draft, primaryIndex);
    draft.interaction.soundDrag = null;
    clearEntitySelection(draft.interaction);
    clearDecorSelection(draft.interaction);
    draft.interaction.hoveredEntityIndex = null;
    draft.interaction.hoveredDecorIndex = null;
    return true;
  };

  const createSoundAtCell = (draft, cell, presetId = draft.interaction.activeSoundPresetId || DEFAULT_SOUND_PRESET_ID) => {
    const doc = draft.document.active;
    if (!doc || !cell) return null;

    const sound = createSoundDraft(doc, cell.x, cell.y, presetId, (doc.sounds?.length || 0) + 1);
    doc.sounds.push(sound);
    const createdIndex = doc.sounds.length - 1;
    pushHistoryEntry(
      draft.history,
      createSoundEditEntry("create", {
        index: createdIndex,
        sound: { ...sound, params: cloneEntityParams(sound.params) },
      }),
    );
    setSoundSelection(draft.interaction, [createdIndex], createdIndex);
    draft.interaction.hoveredSoundIndex = createdIndex;
    draft.interaction.selectedCell = { x: sound.x, y: sound.y };
    clearEntitySelection(draft.interaction);
    clearDecorSelection(draft.interaction);
    draft.interaction.hoveredEntityIndex = null;
    draft.interaction.hoveredDecorIndex = null;
    draft.interaction.entityDrag = null;
    draft.interaction.decorDrag = null;
    setCanvasSelectionMode(draft, "sound");
    return createdIndex;
  };

  const moveSoundToCell = (draft, index, cell) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const sound = doc.sounds?.[index];
    if (!sound || !cell) return false;

    const next = clampSoundPosition(doc, cell.x, cell.y);
    const changed = sound.x !== next.x || sound.y !== next.y;
    if (!changed) {
      setSoundSelection(draft.interaction, [index], index);
      draft.interaction.hoveredSoundIndex = index;
      clearEntitySelection(draft.interaction);
      clearDecorSelection(draft.interaction);
      draft.interaction.hoveredEntityIndex = null;
      draft.interaction.hoveredDecorIndex = null;
      setCanvasSelectionMode(draft, "sound");
      updateSoundSelectionCell(draft, index);
      return false;
    }

    const previousSound = { ...sound, params: cloneEntityParams(sound.params) };
    const nextSound = { ...sound, x: next.x, y: next.y };
    doc.sounds.splice(index, 1, nextSound);
    pushSoundUpdateHistory(draft.history, index, previousSound, nextSound);
    setSoundSelection(draft.interaction, [index], index);
    draft.interaction.hoveredSoundIndex = index;
    clearEntitySelection(draft.interaction);
    clearDecorSelection(draft.interaction);
    draft.interaction.hoveredEntityIndex = null;
    draft.interaction.hoveredDecorIndex = null;
    setCanvasSelectionMode(draft, "sound");
    updateSoundSelectionCell(draft, index);
    return changed;
  };

  const updateSound = (index, field, value) => {
    store.setState((draft) => {
      const doc = draft.document.active;
      if (!doc) return;
      const soundItems = doc.sounds || [];
      const selectedIndices = getSoundSelectionIndices(draft.interaction, soundItems);

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
        deleteSelectedSound(draft);
        return;
      }

      if (field === "duplicate") {
        duplicateSelectedSound(draft);
        return;
      }

      if (field === "select") {
        if (index >= 0 && index < soundItems.length) {
          if (value?.toggle) {
            toggleSoundSelection(draft.interaction, index);
          } else {
            setSoundSelection(draft.interaction, [index], index);
          }
          draft.interaction.hoveredSoundIndex = index;
          clearEntitySelection(draft.interaction);
          clearDecorSelection(draft.interaction);
          draft.interaction.hoveredEntityIndex = null;
          draft.interaction.hoveredDecorIndex = null;
          draft.interaction.entityDrag = null;
          draft.interaction.decorDrag = null;
          applyCanvasTarget(draft, "sound");
          updateSoundSelectionCell(draft, getPrimarySelectedSoundIndex(draft.interaction));
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

      if (index === -1 && selectedIndices.length > 1) {
        const isBatchField = field === "source"
          || (field === "param" && value && typeof value === "object" && BATCH_EDITABLE_SOUND_PARAM_KEYS.has(value.key));
        if (isBatchField) {
          applyBatchSoundUpdate(draft, selectedIndices, field, value);
        }
        return;
      }

      const sound = soundItems[index];
      if (!sound) return;

      if (field === "param" || field === "name" || field === "type" || field === "source" || field === "visible") {
        const nextSound = applySoundFieldUpdate(sound, field, value);
        if (!nextSound) return;
        const previousSound = { ...sound, params: cloneEntityParams(sound.params) };
        doc.sounds.splice(index, 1, nextSound);
        pushSoundUpdateHistory(draft.history, index, previousSound, nextSound);
        return;
      }

      if (field === "x" || field === "y") {
        moveSoundToCell(draft, index, {
          x: field === "x" ? value : sound.x,
          y: field === "y" ? value : sound.y,
        });
      }
    });
  };

  const syncInteractionAfterHistoryChange = (draft) => {
    const doc = draft.document.active;
    if (!doc) return;

    const entityCount = doc.entities?.length || 0;
    pruneEntitySelection(draft.interaction, entityCount);
    if (Number.isInteger(draft.interaction.hoveredEntityIndex) && draft.interaction.hoveredEntityIndex >= entityCount) {
      draft.interaction.hoveredEntityIndex = entityCount ? entityCount - 1 : null;
    }

    const decorCount = doc.decor?.length || 0;
    pruneDecorSelection(draft.interaction, decorCount);
    if (Number.isInteger(draft.interaction.hoveredDecorIndex) && draft.interaction.hoveredDecorIndex >= decorCount) {
      draft.interaction.hoveredDecorIndex = decorCount ? decorCount - 1 : null;
    }

    const soundCount = doc.sounds?.length || 0;
    pruneSoundSelection(draft.interaction, soundCount);
    if (Number.isInteger(draft.interaction.hoveredSoundIndex) && draft.interaction.hoveredSoundIndex >= soundCount) {
      draft.interaction.hoveredSoundIndex = soundCount ? soundCount - 1 : null;
    }

    clearSpecialVolumePlacement(draft);

    if (getSelectedEntityIndices(draft.interaction).length) {
      updateEntitySelectionCell(draft);
    } else if (getSelectedDecorIndices(draft.interaction).length) {
      updateDecorSelectionCell(draft);
    } else if (getSelectedSoundIndices(draft.interaction).length) {
      updateSoundSelectionCell(draft);
    } else if (!getSelectedEntityIndices(draft.interaction).length) {
      draft.interaction.selectedCell = null;
    }
  };

  const moveDecorToCell = (draft, index, cell) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const decor = doc.decor?.[index];
    if (!decor || !cell) return false;

    const next = clampDecorPosition(doc, cell.x, cell.y);
    const changed = decor.x !== next.x || decor.y !== next.y;
    if (!changed) {
      setDecorSelection(draft.interaction, [index], index);
      draft.interaction.hoveredDecorIndex = index;
      clearEntitySelection(draft.interaction);
      draft.interaction.hoveredEntityIndex = null;
      setCanvasSelectionMode(draft, "decor");
      updateDecorSelectionCell(draft, index);
      return false;
    }
    const previousDecor = { ...decor };
    const nextDecor = {
      ...decor,
      x: next.x,
      y: next.y,
    };
    doc.decor.splice(index, 1, nextDecor);
    pushDecorUpdateHistory(draft.history, index, previousDecor, nextDecor);
    setDecorSelection(draft.interaction, [index], index);
    draft.interaction.hoveredDecorIndex = index;
    clearEntitySelection(draft.interaction);
    draft.interaction.hoveredEntityIndex = null;
    setCanvasSelectionMode(draft, "decor");
    updateDecorSelectionCell(draft, index);
    return changed;
  };

  const deleteSelectedEntity = (draft) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const selectedEntries = getSelectedEntities(draft.interaction, doc.entities);
    if (!selectedEntries.length) {
      return false;
    }

    startHistoryBatch(draft.history, "entity-delete");
    for (const { index, entity } of [...selectedEntries].sort((left, right) => right.index - left.index)) {
      doc.entities.splice(index, 1);
      pushHistoryEntry(
        draft.history,
        createEntityEditEntry("delete", {
          index,
          entity: { ...entity, params: cloneEntityParams(entity.params) },
        }),
      );
    }
    endHistoryBatch(draft.history);

    const deletedSet = new Set(selectedEntries.map(({ index }) => index));
    const hoveredIndex = draft.interaction.hoveredEntityIndex;
    clearEntitySelection(draft.interaction);
    draft.interaction.selectedCell = null;
    draft.interaction.entityDrag = null;
    draft.interaction.hoveredEntityIndex =
      Number.isInteger(hoveredIndex)
        ? deletedSet.has(hoveredIndex)
          ? null
          : hoveredIndex - selectedEntries.filter((entry) => entry.index < hoveredIndex).length
        : null;

    return true;
  };

  const duplicateSelectedEntity = (draft) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const selectedEntries = getSelectedEntities(draft.interaction, doc.entities);
    if (!selectedEntries.length) return false;

    let insertIndex = selectedEntries[selectedEntries.length - 1].index + 1;
    const duplicatedIndices = [];

    startHistoryBatch(draft.history, "entity-duplicate");
    for (const { entity: source } of selectedEntries) {
      const offset = clampEntityPosition(doc, source.x + 1, source.y + 1);
      const duplicate = {
        ...source,
        id: getNextStringId(doc.entities, "id", "entity"),
        x: offset.x,
        y: offset.y,
        params: cloneEntityParams(source.params),
      };

      if (typeof source.instanceId === "string" && source.instanceId.trim()) {
        duplicate.instanceId = getNextStringId(doc.entities, "instanceId", "instance");
      }

      doc.entities.splice(insertIndex, 0, duplicate);
      duplicatedIndices.push(insertIndex);
      pushHistoryEntry(
        draft.history,
        createEntityEditEntry("create", {
          index: insertIndex,
          entity: { ...duplicate, params: cloneEntityParams(duplicate.params) },
        }),
      );
      insertIndex += 1;
    }
    endHistoryBatch(draft.history);

    const primaryIndex = duplicatedIndices[duplicatedIndices.length - 1] ?? null;
    setEntitySelection(draft.interaction, duplicatedIndices, primaryIndex);
    draft.interaction.hoveredEntityIndex = primaryIndex;
    updateEntitySelectionCell(draft, primaryIndex);
    draft.interaction.entityDrag = null;

    return true;
  };

  const createEntityAtCell = (draft, cell, presetId = draft.interaction.activeEntityPresetId || DEFAULT_ENTITY_PRESET_ID) => {
    const doc = draft.document.active;
    if (!doc || !cell) return null;

    const decorPreset = resolveDecorPlacementPreset(presetId);
    if (decorPreset && !resolveEntityPlacementPreset(presetId) && presetId !== decorPreset.id) {
      return createDecorAtCell(draft, cell, decorPreset.id);
    }

    const entities = doc.entities;
    const entity = createEntityDraft(doc, cell.x, cell.y, presetId, entities.length + 1);
    entities.push(entity);
    const createdIndex = entities.length - 1;
    pushHistoryEntry(
      draft.history,
      createEntityEditEntry("create", {
        index: createdIndex,
        entity: { ...entity, params: cloneEntityParams(entity.params) },
      }),
    );
    setEntitySelection(draft.interaction, [createdIndex], createdIndex);
    draft.interaction.hoveredEntityIndex = createdIndex;
    draft.interaction.hoveredDecorIndex = null;
    draft.interaction.hoveredSoundIndex = null;
    clearDecorSelection(draft.interaction);
    clearSoundSelection(draft.interaction);
    draft.interaction.decorDrag = null;
    draft.interaction.soundDrag = null;
    setCanvasSelectionMode(draft, "entity");
    updateEntitySelectionCell(draft, createdIndex);
    return createdIndex;
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
        draft.interaction.activeEntityPresetId =
          draft.interaction.activeEntityPresetId === nextPresetId ? null : nextPresetId;
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
        duplicateSelectedEntity(draft);
        return;
      }

      if (field === "select") {
        if (index >= 0 && index < entities.length) {
          const toggleSelection = Boolean(value?.toggle);
          if (toggleSelection) {
            toggleEntitySelection(draft.interaction, index);
          } else {
            setEntitySelection(draft.interaction, [index], index);
          }
          clearDecorSelection(draft.interaction);
          clearSoundSelection(draft.interaction);
          draft.interaction.hoveredDecorIndex = null;
          draft.interaction.hoveredSoundIndex = null;
          draft.interaction.decorDrag = null;
          draft.interaction.soundDrag = null;
          setCanvasSelectionMode(draft, "entity");
          updateEntitySelectionCell(draft);
        }
        return;
      }

      const entity = entities[index];
      if (!entity) return;

      if (field === "param") {
        if (!value || typeof value !== "object" || Array.isArray(value)) return;

        const key = typeof value.key === "string" ? value.key.trim() : "";
        const path = typeof value.path === "string" ? value.path.trim() : "";
        if (!key && !path) return;
        if (!isSupportedEntityParamValue(value.value)) return;

        const previousEntity = { ...entity, params: cloneEntityParams(entity.params) };
        const nextEntity = isSpecialVolumeEntityType(entity.type) && path
          ? applyFogVolumeParamChange(entity, path, value.value, doc.dimensions.tileSize)
          : {
            ...entity,
            params: {
              ...cloneEntityParams(entity.params),
              [key || path]: value.value,
            },
          };
        doc.entities.splice(index, 1, nextEntity);
        pushEntityUpdateHistory(draft.history, index, previousEntity, nextEntity);
        return;
      }

      if (field === "name" || field === "type") {
        const trimmed = String(value || "").trim();
        const nextValue = field === "type"
          ? (normalizeEditableObjectType(trimmed) || entity[field])
          : (trimmed || entity[field]);
        if (entity[field] === nextValue) return;
        const previousEntity = { ...entity, params: cloneEntityParams(entity.params) };
        const nextEntity = {
          ...entity,
          [field]: nextValue,
          params: field === "type"
            ? getEntityPresetParamsForType(nextValue, entity.params)
            : cloneEntityParams(entity.params),
        };
        const normalizedNextEntity = field === "type" && isSpecialVolumeEntityType(nextValue)
          ? syncFogVolumeEntityToAnchor(nextEntity, doc.dimensions.tileSize)
          : nextEntity;
        doc.entities.splice(index, 1, normalizedNextEntity);
        pushEntityUpdateHistory(draft.history, index, previousEntity, normalizedNextEntity);
        return;
      }

      if (field === "visible") {
        const nextVisible = Boolean(value);
        if (entity.visible === nextVisible) return;
        const previousEntity = { ...entity, params: cloneEntityParams(entity.params) };
        const nextEntity = { ...entity, visible: nextVisible };
        doc.entities.splice(index, 1, nextEntity);
        pushEntityUpdateHistory(draft.history, index, previousEntity, nextEntity);
        return;
      }

      if (field === "x" || field === "y") {
        const next = clampEntityPosition(
          doc,
          field === "x" ? value : entity.x,
          field === "y" ? value : entity.y,
        );
        moveEntityToCell(draft, index, next);
        return;
      }

      if ((field === "fogWidth" || field === "fogHeight") && isSpecialVolumeEntityType(entity.type)) {
        const previousEntity = { ...entity, params: cloneEntityParams(entity.params) };
        const nextEntity = resizeFogVolumeEntity(
          entity,
          field === "fogWidth" ? "width" : "height",
          value,
          doc.dimensions.tileSize,
        );
        doc.entities.splice(index, 1, nextEntity);
        pushEntityUpdateHistory(draft.history, index, previousEntity, nextEntity);
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
          if (value?.toggle) {
            toggleDecorSelection(draft.interaction, index);
          } else {
            setDecorSelection(draft.interaction, [index], index);
          }
          draft.interaction.hoveredDecorIndex = index;
          clearEntitySelection(draft.interaction);
          clearSoundSelection(draft.interaction);
          draft.interaction.hoveredEntityIndex = null;
          draft.interaction.hoveredSoundIndex = null;
          draft.interaction.entityDrag = null;
          draft.interaction.soundDrag = null;
          applyCanvasTarget(draft, "decor");
          updateDecorSelectionCell(draft, getPrimarySelectedDecorIndex(draft.interaction));
        }
        return;
      }

      const decor = decorItems[index];
      if (!decor) return;

      if (field === "param") {
        if (!value || typeof value !== "object" || Array.isArray(value)) return;

        const key = typeof value.key === "string" ? value.key.trim() : "";
        if (!key) return;
        if (!isSupportedEntityParamValue(value.value)) return;

        const previousDecor = { ...decor, params: cloneEntityParams(decor.params) };
        const nextDecor = {
          ...decor,
          params: {
            ...cloneEntityParams(decor.params),
            [key]: value.value,
          },
        };
        doc.decor.splice(index, 1, nextDecor);
        pushDecorUpdateHistory(draft.history, index, previousDecor, nextDecor);
        return;
      }

      if (field === 'name' || field === 'type' || field === 'variant') {
        const trimmed = String(value || '').trim();
        const nextValue = trimmed || decor[field];
        if (decor[field] === nextValue) return;
        const previousDecor = { ...decor };
        const nextDecor = { ...decor, [field]: nextValue };
        doc.decor.splice(index, 1, nextDecor);
        pushDecorUpdateHistory(draft.history, index, previousDecor, nextDecor);
        return;
      }

      if (field === 'visible') {
        const nextVisible = Boolean(value);
        if (decor.visible === nextVisible) return;
        const previousDecor = { ...decor };
        const nextDecor = { ...decor, visible: nextVisible };
        doc.decor.splice(index, 1, nextDecor);
        pushDecorUpdateHistory(draft.history, index, previousDecor, nextDecor);
        return;
      }

      if (field === 'x' || field === 'y') {
        moveDecorToCell(draft, index, {
          x: field === 'x' ? value : decor.x,
          y: field === 'y' ? value : decor.y,
        });
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
    renderEditorFrame(ctx, state);
    minimapLayout = renderMinimap(minimapCtx, state);
    renderInspector(inspector, state);
    renderBottomPanel(bottomPanel, state);
    renderBrushPanel(brushPanel, state);
    renderCellHud(cellHud, state);
    renderTopBar(state);
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
      currentHoveredSoundIndex === (nextHoveredSoundIndex >= 0 ? nextHoveredSoundIndex : null)
    ) {
      return;
    }

    store.setState((draft) => {
      draft.interaction.hoverCell = nextHoverCell;
      draft.interaction.hoveredEntityIndex = nextHoveredEntityIndex >= 0 ? nextHoveredEntityIndex : null;
      draft.interaction.hoveredDecorIndex = nextHoveredDecorIndex >= 0 ? nextHoveredDecorIndex : null;
      draft.interaction.hoveredSoundIndex = nextHoveredSoundIndex >= 0 ? nextHoveredSoundIndex : null;
    });
  };

  const clearHoveredCanvasState = () => {
    const state = store.getState();
    interactionState.hoveringPausedScanHandle = false;
    syncCanvasCursor();
    if (!state.interaction.hoverCell && state.interaction.hoveredEntityIndex === null && state.interaction.hoveredDecorIndex === null && state.interaction.hoveredSoundIndex === null) return;

    store.setState((draft) => {
      draft.interaction.hoverCell = null;
      draft.interaction.hoveredEntityIndex = null;
      draft.interaction.hoveredDecorIndex = null;
      draft.interaction.hoveredSoundIndex = null;
    });
  };

  const applyTileToolAtCell = (draft, cell) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const brushSize = resolveBrushSize(draft.brush.activeDraft);
    const brushCells = getBrushCells(cell, brushSize);
    const { width, height } = doc.dimensions;
    let changedAny = false;

    if (
      draft.interaction.activeTool === EDITOR_TOOLS.PAINT ||
      draft.interaction.activeTool === EDITOR_TOOLS.RECT ||
      draft.interaction.activeTool === EDITOR_TOOLS.LINE
    ) {
      const tileValue = resolveTileFromBrushDraft(draft.brush.activeDraft);

      for (const brushCell of brushCells) {
        if (brushCell.x < 0 || brushCell.y < 0 || brushCell.x >= width || brushCell.y >= height) continue;
        const index = getTileIndex(width, brushCell.x, brushCell.y);
        const previousValue = doc.tiles.base[index];
        const changed = paintSingleTile(doc, brushCell, tileValue);
        if (!changed) continue;

        const entry = createTileEditEntry(doc, brushCell, previousValue, tileValue);
        pushTileEdit(draft.history, entry);
        changedAny = true;
      }

      return changedAny;
    }

    if (draft.interaction.activeTool === EDITOR_TOOLS.ERASE) {
      for (const brushCell of brushCells) {
        if (brushCell.x < 0 || brushCell.y < 0 || brushCell.x >= width || brushCell.y >= height) continue;
        const index = getTileIndex(width, brushCell.x, brushCell.y);
        const previousValue = doc.tiles.base[index];
        const changed = eraseSingleTile(doc, brushCell);
        if (!changed) continue;

        const entry = createTileEditEntry(doc, brushCell, previousValue, 0);
        pushTileEdit(draft.history, entry);
        changedAny = true;
      }

      return changedAny;
    }

    return false;
  };

  const applyRectTool = (draft, startCell, endCell) => {
    const bounds = getRectBounds(startCell, endCell);
    let changedAny = false;

    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        if (applyTileToolAtCell(draft, { x, y })) {
          changedAny = true;
        }
      }
    }

    return changedAny;
  };


  const applyFillTool = (draft, startCell) => {
    const doc = draft.document.active;
    if (!doc || !startCell) return false;

    const replacementValue = resolveTileFromBrushDraft(draft.brush.activeDraft);
    const fillCells = getFloodFillCells(doc, startCell, replacementValue);

    if (fillCells.length === 0) return false;

    let changedAny = false;

    for (const cell of fillCells) {
      const index = getTileIndex(doc.dimensions.width, cell.x, cell.y);
      const previousValue = doc.tiles.base[index];
      const changed = paintSingleTile(doc, cell, replacementValue);
      if (!changed) continue;

      const entry = createTileEditEntry(doc, cell, previousValue, replacementValue);
      pushTileEdit(draft.history, entry);
      changedAny = true;
    }

    return changedAny;
  };
  const applyLineTool = (draft, startCell, endCell) => {
    const lineCells = getLineCells(startCell, endCell);
    let changedAny = false;

    for (const cell of lineCells) {
      if (applyTileToolAtCell(draft, cell)) {
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

  const handleInspectCanvasMouseDown = (event, state, cell, point) => {
    const activeLayer = getActiveLayer(state.interaction);
    const selectionMode = getSelectionMode(state.interaction);
    const hitEntityIndex = findEntityAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    const hitDecorIndex = findDecorAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    const hitSoundIndex = findSoundAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    const activeEntityPresetId = state.interaction.activeEntityPresetId;
    const activeDecorPresetId = state.interaction.activeDecorPresetId;
    const activeSoundPresetId = state.interaction.activeSoundPresetId;

    if (activeLayer === PANEL_LAYERS.ENTITIES && activeEntityPresetId && isMomentaryPlacementTrigger(event)) {
      const activeEntityPreset = resolveEntityPlacementPreset(activeEntityPresetId);
      interactionState.suppressNextClick = true;
      event.preventDefault();
      if (activeEntityPreset && isSpecialVolumeEntityType(activeEntityPreset.type)) {
        store.setState((draft) => {
          applyCanvasTarget(draft, "entity");
          draft.interaction.selectedCell = cell;
          draft.interaction.hoverCell = cell;
          draft.interaction.specialVolumePlacement = {
            active: true,
            presetId: activeEntityPresetId,
            type: activeEntityPreset.type,
            startCell: cell,
            startPoint: point,
            currentPoint: point,
            startWorld: getClampedWorldPointFromCanvasPoint(draft.document.active, draft.viewport, point),
            currentWorld: getClampedWorldPointFromCanvasPoint(draft.document.active, draft.viewport, point),
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

      store.setState((draft) => {
        createEntityAtCell(draft, cell, activeEntityPresetId);
        draft.interaction.hoverCell = cell;
      });
      return true;
    }

    if (activeLayer === PANEL_LAYERS.DECOR && activeDecorPresetId && isMomentaryPlacementTrigger(event)) {
      interactionState.suppressNextClick = true;
      event.preventDefault();
      store.setState((draft) => {
        createDecorAtCell(draft, cell, activeDecorPresetId);
        draft.interaction.hoverCell = cell;
      });
      return true;
    }

    if (activeLayer === PANEL_LAYERS.SOUND && activeSoundPresetId && isMomentaryPlacementTrigger(event)) {
      interactionState.suppressNextClick = true;
      event.preventDefault();
      store.setState((draft) => {
        createSoundAtCell(draft, cell, activeSoundPresetId);
        draft.interaction.hoverCell = cell;
      });
      return true;
    }

    if (activeLayer === PANEL_LAYERS.ENTITIES && selectionMode === "entity" && hitEntityIndex >= 0) {
      interactionState.suppressNextClick = true;
      event.preventDefault();
      store.setState((draft) => {
        const entity = draft.document.active?.entities?.[hitEntityIndex];
        applyCanvasTarget(draft, "entity");
        if (event.shiftKey) {
          toggleEntitySelection(draft.interaction, hitEntityIndex);
          updateEntitySelectionCell(draft);
          return;
        }

        const selectedIndices = getSelectedEntityIndices(draft.interaction);
        const dragSelection = selectedIndices.includes(hitEntityIndex) ? selectedIndices : [hitEntityIndex];
        setEntitySelection(draft.interaction, dragSelection, hitEntityIndex);
        draft.interaction.hoveredEntityIndex = hitEntityIndex;
        updateEntitySelectionCell(draft, hitEntityIndex);
        draft.interaction.entityDrag = {
          active: true,
          leadIndex: hitEntityIndex,
          anchorCell: entity ? { x: entity.x, y: entity.y } : cell,
          originPositions: getEntitySelectionIndices(draft.interaction, draft.document.active?.entities || []).map((index) => {
            const selectedEntity = draft.document.active?.entities?.[index];
            return {
              index,
              x: selectedEntity?.x ?? 0,
              y: selectedEntity?.y ?? 0,
            };
          }),
          previewDelta: { x: 0, y: 0 },
        };
      });
      return true;
    }

    if (activeLayer === PANEL_LAYERS.SOUND && selectionMode === "sound" && hitSoundIndex >= 0) {
      interactionState.suppressNextClick = true;
      event.preventDefault();
      store.setState((draft) => {
        const sound = draft.document.active?.sounds?.[hitSoundIndex];
        applyCanvasTarget(draft, "sound");
        draft.interaction.hoveredSoundIndex = hitSoundIndex;
        if (event.shiftKey) {
          toggleSoundSelection(draft.interaction, hitSoundIndex);
          updateSoundSelectionCell(draft);
          draft.interaction.soundDrag = null;
          return;
        }

        const selectedIndices = getSelectedSoundIndices(draft.interaction);
        const dragSelection = selectedIndices.includes(hitSoundIndex) ? selectedIndices : [hitSoundIndex];
        setSoundSelection(draft.interaction, dragSelection, hitSoundIndex);
        updateSoundSelectionCell(draft, hitSoundIndex);
        draft.interaction.soundDrag = {
          active: true,
          leadIndex: hitSoundIndex,
          anchorCell: sound ? { x: sound.x, y: sound.y } : cell,
          originPositions: getSoundSelectionIndices(draft.interaction, draft.document.active?.sounds || []).map((index) => {
            const selectedSound = draft.document.active?.sounds?.[index];
            return {
              index,
              x: selectedSound?.x ?? 0,
              y: selectedSound?.y ?? 0,
            };
          }),
          previewDelta: { x: 0, y: 0 },
        };
      });
      return true;
    }

    if (activeLayer === PANEL_LAYERS.DECOR && selectionMode === "decor" && hitDecorIndex >= 0) {
      interactionState.suppressNextClick = true;
      event.preventDefault();
      store.setState((draft) => {
        const decor = draft.document.active?.decor?.[hitDecorIndex];
        applyCanvasTarget(draft, "decor");
        draft.interaction.hoveredDecorIndex = hitDecorIndex;
        if (event.shiftKey) {
          toggleDecorSelection(draft.interaction, hitDecorIndex);
          updateDecorSelectionCell(draft);
          draft.interaction.decorDrag = null;
          return;
        } else {
          const selectedIndices = getSelectedDecorIndices(draft.interaction);
          const dragSelection = selectedIndices.includes(hitDecorIndex) ? selectedIndices : [hitDecorIndex];
          setDecorSelection(draft.interaction, dragSelection, hitDecorIndex);
        }
        const primaryDecorIndex = getPrimarySelectedDecorIndex(draft.interaction);
        updateDecorSelectionCell(draft, primaryDecorIndex);
        draft.interaction.decorDrag = {
          active: true,
          leadIndex: hitDecorIndex,
          anchorCell: decor ? { x: decor.x, y: decor.y } : cell,
          originPositions: getDecorSelectionIndices(draft.interaction, draft.document.active?.decor || []).map((index) => {
            const selectedDecor = draft.document.active?.decor?.[index];
            return {
              index,
              x: selectedDecor?.x ?? 0,
              y: selectedDecor?.y ?? 0,
            };
          }),
          previewDelta: { x: 0, y: 0 },
        };
      });
      return true;
    }

    if (activeLayer === PANEL_LAYERS.TILES) {
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

    if (state.interaction.specialVolumePlacement?.active) {
      if ((event.buttons & 1) !== 1) {
        store.setState((draft) => {
          clearSpecialVolumePlacement(draft);
        });
        return;
      }

      const point = getCanvasPointFromMouseEvent(canvas, event);
      const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
      const worldPoint = getClampedWorldPointFromCanvasPoint(state.document.active, state.viewport, point);

      store.setState((draft) => {
        const placement = draft.interaction.specialVolumePlacement;
        if (!placement?.active) return;
        placement.currentPoint = point;
        placement.currentWorld = worldPoint;
        draft.interaction.hoverCell = cell || draft.interaction.hoverCell;
      });
      return;
    }

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
        draft.interaction.hoveredEntityIndex = entityDrag.leadIndex;
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
        draft.interaction.hoveredDecorIndex = decorDrag.leadIndex;
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
        draft.interaction.hoveredSoundIndex = soundDrag.leadIndex;
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
      draft.interaction.selectedCell = cell;
      applyTileToolAtCell(draft, cell);
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

    if (state.interaction.specialVolumePlacement?.active) {
      store.setState((draft) => {
        finalizeSpecialVolumePlacement(draft);
      });
      return;
    }

    if (state.interaction.entityDrag?.active) {
      store.setState((draft) => {
        const entityDrag = draft.interaction.entityDrag;
        if (!entityDrag?.active) return;
        moveEntitySelectionByDelta(draft, entityDrag.originPositions, entityDrag.previewDelta || { x: 0, y: 0 });
        draft.interaction.entityDrag = null;
        updateEntitySelectionCell(draft, entityDrag.leadIndex);
      });
      return;
    }

    if (state.interaction.decorDrag?.active) {
      store.setState((draft) => {
        const decorDrag = draft.interaction.decorDrag;
        if (!decorDrag?.active) return;
        moveDecorSelectionByDelta(draft, decorDrag.originPositions, decorDrag.previewDelta || { x: 0, y: 0 });
        draft.interaction.decorDrag = null;
      });
      return;
    }

    if (state.interaction.soundDrag?.active) {
      store.setState((draft) => {
        const soundDrag = draft.interaction.soundDrag;
        if (!soundDrag?.active) return;
        moveSoundSelectionByDelta(draft, soundDrag.originPositions, soundDrag.previewDelta || { x: 0, y: 0 });
        draft.interaction.soundDrag = null;
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
          const baseSelection = boxSelection.additive ? getSelectedDecorIndices(draft.interaction) : [];
          applyCanvasTarget(draft, "decor");
          setDecorSelection(
            draft.interaction,
            boxSelection.additive ? [...baseSelection, ...nextSelection] : nextSelection,
            nextSelection[nextSelection.length - 1] ?? getPrimarySelectedDecorIndex(draft.interaction),
          );
          updateDecorSelectionCell(draft, getPrimarySelectedDecorIndex(draft.interaction));
        } else if (boxSelection.mode === "sound") {
          const baseSelection = boxSelection.additive ? getSelectedSoundIndices(draft.interaction) : [];
          applyCanvasTarget(draft, "sound");
          setSoundSelection(
            draft.interaction,
            boxSelection.additive ? [...baseSelection, ...nextSelection] : nextSelection,
            nextSelection[nextSelection.length - 1] ?? getPrimarySelectedSoundIndex(draft.interaction),
          );
          updateSoundSelectionCell(draft, getPrimarySelectedSoundIndex(draft.interaction));
        } else {
          const baseSelection = boxSelection.additive ? getSelectedEntityIndices(draft.interaction) : [];
          applyCanvasTarget(draft, "entity");
          setEntitySelection(
            draft.interaction,
            boxSelection.additive ? [...baseSelection, ...nextSelection] : nextSelection,
            nextSelection[nextSelection.length - 1] ?? getPrimarySelectedEntityIndex(draft.interaction),
          );
          updateEntitySelectionCell(draft);
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

    const point = getCanvasPointFromMouseEvent(canvas, event);
    const activeLayer = getActiveLayer(state.interaction);
    const selectionMode = getSelectionMode(state.interaction);
    const hitEntityIndex = findEntityAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    if (activeLayer === PANEL_LAYERS.ENTITIES && selectionMode === "entity" && hitEntityIndex >= 0) {
      store.setState((draft) => {
        applyCanvasTarget(draft, "entity");
        if (event.shiftKey) {
          toggleEntitySelection(draft.interaction, hitEntityIndex);
        } else {
          setEntitySelection(draft.interaction, [hitEntityIndex], hitEntityIndex);
        }
        updateEntitySelectionCell(draft, getPrimarySelectedEntityIndex(draft.interaction));
      });
      return;
    }

    const hitDecorIndex = findDecorAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    if (activeLayer === PANEL_LAYERS.DECOR && selectionMode === "decor" && hitDecorIndex >= 0) {
      store.setState((draft) => {
        applyCanvasTarget(draft, "decor");
        if (event.shiftKey) {
          toggleDecorSelection(draft.interaction, hitDecorIndex);
        } else {
          setDecorSelection(draft.interaction, [hitDecorIndex], hitDecorIndex);
        }
        draft.interaction.hoveredDecorIndex = hitDecorIndex;
        updateDecorSelectionCell(draft, getPrimarySelectedDecorIndex(draft.interaction));
      });
      return;
    }

    const hitSoundIndex = findSoundAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    if (activeLayer === PANEL_LAYERS.SOUND && selectionMode === "sound" && hitSoundIndex >= 0) {
      store.setState((draft) => {
        applyCanvasTarget(draft, "sound");
        if (event.shiftKey) {
          toggleSoundSelection(draft.interaction, hitSoundIndex);
        } else {
          setSoundSelection(draft.interaction, [hitSoundIndex], hitSoundIndex);
        }
        draft.interaction.hoveredSoundIndex = hitSoundIndex;
        updateSoundSelectionCell(draft, getPrimarySelectedSoundIndex(draft.interaction));
      });
      return;
    }

    const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    if (!cell) return;

    store.setState((draft) => {
      draft.interaction.selectedCell = cell;
      clearEntitySelection(draft.interaction);
      clearDecorSelection(draft.interaction);
      clearSoundSelection(draft.interaction);
    });
  };


  const resetEditorForDocument = (draft, nextDocument, statusMessage = null) => {
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
    draft.interaction.specialVolumePlacement = null;
    draft.interaction.decorDrag = null;
    draft.interaction.soundDrag = null;
    draft.interaction.scanDrag = null;
    draft.interaction.activeLayer = PANEL_LAYERS.TILES;
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
    draft.interaction.selectedCell = null;
    draft.interaction.hoveredEntityIndex = null;
    draft.interaction.hoveredDecorIndex = null;
    draft.interaction.hoveredSoundIndex = null;
    clearDecorSelection(draft.interaction);
    clearEntitySelection(draft.interaction);
    clearSoundSelection(draft.interaction);
    draft.interaction.hoverCell = null;
    draft.ui.importStatus = statusMessage;
    syncScanWithDocument(draft, { preserveRange: false, preserveLog: false });
  };

  const handleNewLevel = () => {
    const newDocument = createNewLevelDocument();

    store.setState((draft) => {
      resetEditorForDocument(draft, newDocument, "New level created");
    });

    resize();
    draw(store.getState());
  };

  const handleUndo = () => {
    store.setState((draft) => {
      const doc = draft.document.active;
      if (!doc) return;
      const entry = undoTileEdit(doc, draft.history);
      if (historyEntryContainsEntity(entry)) {
        clearEntitySelection(draft.interaction);
        draft.interaction.hoveredEntityIndex = null;
        draft.interaction.entityDrag = null;
      }
      if (historyEntryContainsDecor(entry)) {
        clearDecorSelection(draft.interaction);
        draft.interaction.hoveredDecorIndex = null;
        draft.interaction.decorDrag = null;
      }
      if (historyEntryContainsSound(entry)) {
        clearSoundSelection(draft.interaction);
        draft.interaction.hoveredSoundIndex = null;
        draft.interaction.soundDrag = null;
      }
      syncInteractionAfterHistoryChange(draft);
    });
  };

  const handleRedo = () => {
    store.setState((draft) => {
      const doc = draft.document.active;
      if (!doc) return;
      const entry = redoTileEdit(doc, draft.history);
      if (historyEntryContainsEntity(entry)) {
        clearEntitySelection(draft.interaction);
        draft.interaction.hoveredEntityIndex = null;
        draft.interaction.entityDrag = null;
      }
      if (historyEntryContainsDecor(entry)) {
        clearDecorSelection(draft.interaction);
        draft.interaction.hoveredDecorIndex = null;
        draft.interaction.decorDrag = null;
      }
      if (historyEntryContainsSound(entry)) {
        clearSoundSelection(draft.interaction);
        draft.interaction.hoveredSoundIndex = null;
        draft.interaction.soundDrag = null;
      }
      syncInteractionAfterHistoryChange(draft);
    });
  };

  const handleExportDownload = () => {
    const state = store.getState();
    if (!state.document.active) return;

    triggerLevelDocumentDownload(state.document.active);
    closeTopBarMenu();
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
      draft.interaction.activeTool = tool;
      clearSpecialVolumePlacement(draft);
      if (tool !== EDITOR_TOOLS.INSPECT) {
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

      setActiveLayer(draft, PANEL_LAYERS.TILES);
      clearSpecialVolumePlacement(draft);
      draft.interaction.activeEntityPresetId = null;
      draft.interaction.activeDecorPresetId = null;
      draft.interaction.activeSoundPresetId = null;
      draft.interaction.decorScatterMode = false;
      draft.interaction.boxSelection = null;
      draft.interaction.entityDrag = null;
      draft.interaction.decorDrag = null;
      draft.interaction.soundDrag = null;
      draft.interaction.hoveredEntityIndex = null;
      draft.interaction.hoveredDecorIndex = null;
      draft.interaction.hoveredSoundIndex = null;
      clearDecorScatterDrag(draft);
      clearEntitySelection(draft.interaction);
      clearDecorSelection(draft.interaction);
      clearSoundSelection(draft.interaction);
    });
  };

  const handleGlobalKeyDown = (event) => {
    if (event.code === "Space") {
      if (isShortcutTargetBlocked(event.target)) return;
      event.preventDefault();
      updateSpacePanActive(true);
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
      const hasSelection =
        activeLayer === PANEL_LAYERS.DECOR
          ? getSelectedDecorIndices(state.interaction).length
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
      if (action === "new") handleNewLevel();
      if (action === "import") handleImport();
      if (action === "undo") handleUndo();
      if (action === "redo") handleRedo();
      if (action === "toggle-darkness") updatePreviewSettings("darkness", !store.getState().ui.darknessPreviewEnabled);
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

      const parsed = Number.parseInt(target.value, 10);
      const nextValue = Number.isInteger(parsed) ? Math.max(8, Math.min(256, parsed)) : active.dimensions[exportDimensionField];
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
    if (previewField === "darkness") {
      updatePreviewSettings("darkness", target.checked);
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
    if (store.getState().ui.topBarMenu) {
      closeTopBarMenu();
    }
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
        state.interaction.hoveredDecorIndex = null;
        state.interaction.hoveredSoundIndex = null;
        state.interaction.activeLayer = PANEL_LAYERS.TILES;
        state.interaction.canvasSelectionMode = "entity";
        clearDecorSelection(state.interaction);
        clearSoundSelection(state.interaction);
        state.interaction.selectedCell = null;
        state.interaction.hoverCell = null;
        clearEntitySelection(state.interaction);
        state.interaction.specialVolumePlacement = null;
        state.interaction.boxSelection = null;
        state.interaction.entityDrag = null;
        state.interaction.decorDrag = null;
        state.interaction.soundDrag = null;
        state.interaction.scanDrag = null;
        state.interaction.decorScatterMode = false;
        state.interaction.decorScatterDrag = null;
        state.interaction.activeEntityPresetId = null;
        state.interaction.activeDecorPresetId = null;
        state.interaction.activeSoundPresetId = null;
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

  const unsubscribe = store.subscribe(draw);
  const unsubscribeScanAudio = store.subscribe(syncScanAudioPlayback);
  const unsubscribeSoundPreview = store.subscribe(syncSoundPreviewLifecycle);
  const panelBindingOptions = {
    onEntityUpdate: updateEntity,
    onDecorUpdate: updateDecor,
    onSoundUpdate: updateSound,
  };
  const unbindInspectorPanel = bindInspectorPanel(inspector, store, panelBindingOptions);
  const unbindBottomPanel = bindBottomPanel(bottomPanel, store, panelBindingOptions);
  const unbindBrushPanel = bindBrushPanel(brushPanel, store, {
    onEntityUpdate: updateEntity,
    onDecorUpdate: updateDecor,
    onSoundUpdate: updateSound,
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
  canvas.addEventListener("click", handleCanvasClick);
  minimapCanvas.addEventListener("click", handleMinimapClick);
  window.addEventListener("keydown", handleGlobalKeyDown);
  window.addEventListener("keyup", handleGlobalKeyUp);
  topBar.addEventListener("click", handleTopBarClick);
  topBar.addEventListener("input", handleTopBarInput);
  topBar.addEventListener("change", handleTopBarChange);
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
    canvas.removeEventListener("click", handleCanvasClick);
    minimapCanvas.removeEventListener("click", handleMinimapClick);
    window.removeEventListener("keydown", handleGlobalKeyDown);
    window.removeEventListener("keyup", handleGlobalKeyUp);
    topBar.removeEventListener("click", handleTopBarClick);
    topBar.removeEventListener("input", handleTopBarInput);
    topBar.removeEventListener("change", handleTopBarChange);
    document.removeEventListener("pointerdown", handleDocumentPointerDown);
  };
}
