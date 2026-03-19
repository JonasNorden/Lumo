import { renderEditorFrame } from "../render/renderer.js";
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
  createDecorEditEntry,
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
import { TILE_DEFINITIONS } from "../domain/tiles/tileTypes.js";
import { DEFAULT_ENTITY_PRESET_ID, findEntityPresetById, getEntityPresetDefaultParams } from "../domain/entities/entityPresets.js";
import { DEFAULT_DECOR_PRESET_ID, findDecorPresetById } from "../domain/decor/decorPresets.js";
import { cloneEntityParams, isSupportedEntityParamValue } from "../domain/entities/entityParams.js";
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
  const activeTargetLabel = activeLayer === PANEL_LAYERS.DECOR ? "Decor" : activeLayer === PANEL_LAYERS.ENTITIES ? "Entities" : "Tiles";
  const targetSelectionCount =
    activeLayer === PANEL_LAYERS.DECOR
      ? getSelectedDecorIndices(state.interaction).length
      : activeLayer === PANEL_LAYERS.ENTITIES
        ? getSelectedEntityIndices(state.interaction).length
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

function getScatterTargetCount(value) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.round(value));
}

const PANEL_LAYERS = {
  TILES: "tiles",
  ENTITIES: "entities",
  DECOR: "decor",
};

function getActiveLayer(interaction) {
  if (interaction.activeLayer === PANEL_LAYERS.DECOR) return PANEL_LAYERS.DECOR;
  if (interaction.activeLayer === PANEL_LAYERS.ENTITIES) return PANEL_LAYERS.ENTITIES;
  return PANEL_LAYERS.TILES;
}

function getSelectionMode(interaction) {
  return interaction.canvasSelectionMode === "decor" ? "decor" : "entity";
}

function historyEntryContainsDecor(entry) {
  if (!entry) return false;
  if (entry.kind === "decor") return true;
  if (entry.type === "batch") {
    return entry.edits?.some((edit) => historyEntryContainsDecor(edit)) ?? false;
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

  return `
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
  };
  const toolShortcutMap = {
    v: EDITOR_TOOLS.INSPECT,
    b: EDITOR_TOOLS.PAINT,
    e: EDITOR_TOOLS.ERASE,
    r: EDITOR_TOOLS.RECT,
    l: EDITOR_TOOLS.LINE,
    f: EDITOR_TOOLS.FILL,
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
    canvas.style.cursor = isPanGestureActive() ? PAN_ACTIVE_CURSOR : isSpacePanModifierActive() ? PAN_CURSOR : "";
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

      pruneDecorSelection(draft.interaction, doc.decor?.length || 0);
      if (Number.isInteger(draft.interaction.hoveredDecorIndex) && draft.interaction.hoveredDecorIndex >= (doc.decor?.length || 0)) {
        draft.interaction.hoveredDecorIndex = null;
      }

      pruneEntitySelection(draft.interaction, doc.entities?.length || 0);
      updateEntitySelectionCell(draft);
      draft.interaction.hoverCell = null;
      draft.interaction.dragPaint = null;
      draft.interaction.rectDrag = null;
      draft.interaction.lineDrag = null;
      draft.interaction.boxSelection = null;
      clearDecorScatterDrag(draft);
      draft.history.undoStack = [];
      draft.history.redoStack = [];
      draft.history.activeBatch = null;
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
    draft.interaction.canvasSelectionMode = mode === "decor" ? "decor" : "entity";
  };

  const openLayerSection = (draft, layer) => {
    if (!draft.ui.panelSections) return;
    if (layer === PANEL_LAYERS.TILES) draft.ui.panelSections.tiles = true;
    if (layer === PANEL_LAYERS.ENTITIES) draft.ui.panelSections.entities = true;
    if (layer === PANEL_LAYERS.DECOR) draft.ui.panelSections.decor = true;
    draft.ui.panelSections.layer = true;
  };

  const setActiveLayer = (draft, layer) => {
    draft.interaction.activeLayer = layer === PANEL_LAYERS.DECOR
      ? PANEL_LAYERS.DECOR
      : layer === PANEL_LAYERS.ENTITIES
        ? PANEL_LAYERS.ENTITIES
        : PANEL_LAYERS.TILES;
    openLayerSection(draft, draft.interaction.activeLayer);
  };

  const renderTopBar = (state) => {
    const activeLayer = getActiveLayer(state.interaction);
    const selectedCount = activeLayer === PANEL_LAYERS.DECOR
      ? getSelectedDecorIndices(state.interaction).length
      : activeLayer === PANEL_LAYERS.ENTITIES
        ? getSelectedEntityIndices(state.interaction).length
        : 0;
    const activeSelectionLabel = activeLayer === PANEL_LAYERS.DECOR ? "Decor" : activeLayer === PANEL_LAYERS.ENTITIES ? "Entities" : "Tiles";
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
      if (action === "export") button.disabled = !exportEnabled;
    });

    topBarSettingsMenu.innerHTML = renderSettingsMenu(state);
    topBarHelpMenu.innerHTML = renderHelpMenu();

    const activeMenu = state.ui.topBarMenu;
    topBar.querySelectorAll("[data-topbar-menu-toggle]").forEach((toggle) => {
      if (!(toggle instanceof HTMLButtonElement)) return;
      const isOpen = toggle.dataset.topbarMenuToggle === activeMenu;
      toggle.classList.toggle("isActive", isOpen);
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    topBarSettingsMenu.classList.toggle("isOpen", activeMenu === "settings");
    topBarHelpMenu.classList.toggle("isOpen", activeMenu === "help");
  };

  const applyCanvasTarget = (draft, mode) => {
    const nextMode = mode === "decor" ? "decor" : "entity";
    setCanvasSelectionMode(draft, nextMode);
    setActiveLayer(draft, nextMode === "decor" ? PANEL_LAYERS.DECOR : PANEL_LAYERS.ENTITIES);
    draft.interaction.boxSelection = null;
    draft.interaction.entityDrag = null;
    draft.interaction.decorDrag = null;
    clearDecorScatterDrag(draft);

    if (nextMode === "decor") {
      clearEntitySelection(draft.interaction);
      draft.interaction.hoveredEntityIndex = null;
      updateDecorSelectionCell(draft);
      if (!getSelectedDecorIndices(draft.interaction).length) {
        draft.interaction.selectedCell = null;
      }
      return;
    }

    clearDecorSelection(draft.interaction);
    draft.interaction.hoveredDecorIndex = null;
    updateEntitySelectionCell(draft);
    if (!getSelectedEntityIndices(draft.interaction).length) {
      draft.interaction.selectedCell = null;
    }
  };

  const clearActiveSelection = (draft, nextMode = getSelectionMode(draft.interaction)) => {
    if (getActiveLayer(draft.interaction) === PANEL_LAYERS.TILES) {
      clearEntitySelection(draft.interaction);
      clearDecorSelection(draft.interaction);
      draft.interaction.hoveredEntityIndex = null;
      draft.interaction.hoveredDecorIndex = null;
      draft.interaction.entityDrag = null;
      draft.interaction.decorDrag = null;
      return;
    }

    if (nextMode === "decor") {
      clearEntitySelection(draft.interaction);
      draft.interaction.hoveredEntityIndex = null;
      draft.interaction.entityDrag = null;
      return;
    }

    clearDecorSelection(draft.interaction);
    draft.interaction.hoveredDecorIndex = null;
    draft.interaction.decorDrag = null;
  };

  const getDecorScatterSettings = (interaction) => ({
    count: getScatterTargetCount(interaction.decorScatterSettings?.count || 1),
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

  const createDecorDraft = (
    doc,
    x,
    y,
    presetId = DEFAULT_DECOR_PRESET_ID,
    nextNumber = (doc.decor?.length || 0) + 1,
    options = {},
  ) => {
    const placement = clampDecorPosition(doc, x, y);
    const preset = findDecorPresetById(presetId) || findDecorPresetById(DEFAULT_DECOR_PRESET_ID);

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
    const placementCount = Math.min(getScatterTargetCount(settings.count), cellCapacity);
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
    const preset = findEntityPresetById(presetId) || findEntityPresetById(DEFAULT_ENTITY_PRESET_ID);

    return {
      id: `entity-${nextNumber}`,
      name: preset?.defaultName || "Generic",
      type: preset?.type || "generic",
      x: placement.x,
      y: placement.y,
      visible: true,
      params: getEntityPresetDefaultParams(preset?.id || DEFAULT_ENTITY_PRESET_ID),
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

  const updateEntitySelectionCell = (draft, primaryIndex = draft.interaction.selectedEntityIndex) => {
    const entity = Number.isInteger(primaryIndex) ? draft.document.active?.entities?.[primaryIndex] : null;
    draft.interaction.selectedCell = entity ? { x: entity.x, y: entity.y } : null;
  };

  const pushDecorUpdateHistory = (history, index, previousDecor, nextDecor) => {
    if (!previousDecor || !nextDecor) return;
    pushHistoryEntry(
      history,
      createDecorEditEntry("update", {
        index,
        previousDecor: { ...previousDecor },
        nextDecor: { ...nextDecor },
      }),
    );
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

  const moveEntityToCell = (draft, index, cell) => {
    const doc = draft.document.active;
    if (!doc) return false;

    const entity = doc.entities?.[index];
    if (!entity || !cell) return false;

    const next = clampEntityPosition(doc, cell.x, cell.y);
    const changed = entity.x !== next.x || entity.y !== next.y;
    entity.x = next.x;
    entity.y = next.y;
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

  const syncInteractionAfterHistoryChange = (draft) => {
    const doc = draft.document.active;
    if (!doc) return;

    const decorCount = doc.decor?.length || 0;
    pruneDecorSelection(draft.interaction, decorCount);
    if (Number.isInteger(draft.interaction.hoveredDecorIndex) && draft.interaction.hoveredDecorIndex >= decorCount) {
      draft.interaction.hoveredDecorIndex = decorCount ? decorCount - 1 : null;
    }
    if (getSelectedDecorIndices(draft.interaction).length) {
      updateDecorSelectionCell(draft);
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

    const selectedIndices = getEntitySelectionIndices(draft.interaction, doc.entities);
    if (!selectedIndices.length) {
      return false;
    }

    const deletedSet = new Set(selectedIndices);
    doc.entities = doc.entities.filter((_, index) => !deletedSet.has(index));

    const hoveredIndex = draft.interaction.hoveredEntityIndex;
    clearEntitySelection(draft.interaction);
    draft.interaction.selectedCell = null;
    draft.interaction.entityDrag = null;
    draft.interaction.hoveredEntityIndex =
      Number.isInteger(hoveredIndex)
        ? deletedSet.has(hoveredIndex)
          ? null
          : hoveredIndex - selectedIndices.filter((index) => index < hoveredIndex).length
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
      insertIndex += 1;
    }

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

    const entities = doc.entities;
    const entity = createEntityDraft(doc, cell.x, cell.y, presetId, entities.length + 1);
    entities.push(entity);
    const createdIndex = entities.length - 1;
    setEntitySelection(draft.interaction, [createdIndex], createdIndex);
    draft.interaction.hoveredEntityIndex = createdIndex;
    draft.interaction.hoveredDecorIndex = null;
    clearDecorSelection(draft.interaction);
    draft.interaction.decorDrag = null;
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
          draft.interaction.hoveredDecorIndex = null;
          draft.interaction.decorDrag = null;
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
        if (!key) return;
        if (!isSupportedEntityParamValue(value.value)) return;

        entity.params = cloneEntityParams(entity.params);
        entity.params[key] = value.value;
        return;
      }

      if (field === "name" || field === "type") {
        const trimmed = String(value || "").trim();
        entity[field] = trimmed || entity[field];
        return;
      }

      if (field === "visible") {
        entity.visible = Boolean(value);
        return;
      }

      if (field === "x" || field === "y") {
        const next = clampEntityPosition(
          doc,
          field === "x" ? value : entity.x,
          field === "y" ? value : entity.y,
        );
        entity.x = next.x;
        entity.y = next.y;
        setEntitySelection(draft.interaction, [index], index);
        updateEntitySelectionCell(draft, index);
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
        draft.interaction.activeDecorPresetId =
          draft.interaction.activeDecorPresetId === nextPresetId ? null : nextPresetId;
        draft.interaction.activeEntityPresetId = null;
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
        if (settingField === "count") {
          draft.interaction.decorScatterSettings.count = getScatterTargetCount(value.value);
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
          draft.interaction.hoveredEntityIndex = null;
          draft.interaction.entityDrag = null;
          applyCanvasTarget(draft, "decor");
          updateDecorSelectionCell(draft, getPrimarySelectedDecorIndex(draft.interaction));
        }
        return;
      }

      const decor = decorItems[index];
      if (!decor) return;

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

  const draw = (state) => {
    renderEditorFrame(ctx, state);
    minimapLayout = renderMinimap(minimapCtx, state);
    renderInspector(inspector, state);
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
    const nextHoverCell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    const nextHoveredEntityIndex = findEntityAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    const nextHoveredDecorIndex = findDecorAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    const currentCell = state.interaction.hoverCell;
    const currentHoveredEntityIndex = state.interaction.hoveredEntityIndex;
    const currentHoveredDecorIndex = state.interaction.hoveredDecorIndex;
    const cellUnchanged = currentCell?.x === nextHoverCell?.x && currentCell?.y === nextHoverCell?.y;

    if (
      cellUnchanged &&
      currentHoveredEntityIndex === (nextHoveredEntityIndex >= 0 ? nextHoveredEntityIndex : null) &&
      currentHoveredDecorIndex === (nextHoveredDecorIndex >= 0 ? nextHoveredDecorIndex : null)
    ) {
      return;
    }

    store.setState((draft) => {
      draft.interaction.hoverCell = nextHoverCell;
      draft.interaction.hoveredEntityIndex = nextHoveredEntityIndex >= 0 ? nextHoveredEntityIndex : null;
      draft.interaction.hoveredDecorIndex = nextHoveredDecorIndex >= 0 ? nextHoveredDecorIndex : null;
    });
  };

  const clearHoveredCanvasState = () => {
    const state = store.getState();
    if (!state.interaction.hoverCell && state.interaction.hoveredEntityIndex === null && state.interaction.hoveredDecorIndex === null) return;

    store.setState((draft) => {
      draft.interaction.hoverCell = null;
      draft.interaction.hoveredEntityIndex = null;
      draft.interaction.hoveredDecorIndex = null;
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

  const isDecorScatterReady = (interaction) =>
    getActiveLayer(interaction) === PANEL_LAYERS.DECOR &&
    interaction.activeTool === EDITOR_TOOLS.INSPECT &&
    interaction.decorScatterMode &&
    Boolean(interaction.activeDecorPresetId);

  const handleInspectCanvasMouseDown = (event, state, cell, point) => {
    const activeLayer = getActiveLayer(state.interaction);
    const selectionMode = getSelectionMode(state.interaction);
    const hitEntityIndex = findEntityAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    const hitDecorIndex = findDecorAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    const activeEntityPresetId = state.interaction.activeEntityPresetId;
    const activeDecorPresetId = state.interaction.activeDecorPresetId;

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

    if (activeLayer === PANEL_LAYERS.ENTITIES && activeEntityPresetId) {
      interactionState.suppressNextClick = true;
      event.preventDefault();
      store.setState((draft) => {
        createEntityAtCell(draft, cell, activeEntityPresetId);
        draft.interaction.hoverCell = cell;
      });
      return true;
    }

    if (activeLayer === PANEL_LAYERS.DECOR && activeDecorPresetId) {
      interactionState.suppressNextClick = true;
      event.preventDefault();
      store.setState((draft) => {
        createDecorAtCell(draft, cell, activeDecorPresetId);
        draft.interaction.hoverCell = cell;
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
    const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    if (!cell) return;

    const activeTool = state.interaction.activeTool;
    if (isDecorScatterReady(state.interaction)) {
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
        draft.interaction.decorDrag = null;
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

    updateHoveredCanvasState(event);

    const state = store.getState();
    if (!state.document.active) return;

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

    if (state.interaction.entityDrag?.active) {
      store.setState((draft) => {
        const entityDrag = draft.interaction.entityDrag;
        const doc = draft.document.active;
        if (!entityDrag || !doc) return;

        const delta = entityDrag.previewDelta || { x: 0, y: 0 };
        for (const origin of entityDrag.originPositions) {
          const entity = doc.entities?.[origin.index];
          if (!entity) continue;
          entity.x = origin.x + delta.x;
          entity.y = origin.y + delta.y;
        }

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

    const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    if (!cell) return;

    store.setState((draft) => {
      draft.interaction.selectedCell = cell;
      clearEntitySelection(draft.interaction);
      clearDecorSelection(draft.interaction);
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
    draft.interaction.decorDrag = null;
    draft.interaction.activeLayer = PANEL_LAYERS.TILES;
    draft.interaction.canvasSelectionMode = "entity";
    draft.interaction.decorScatterMode = false;
    draft.interaction.decorScatterSettings = {
      count: 12,
      randomness: 0.6,
      variantMode: "fixed",
    };
    draft.interaction.decorScatterDrag = null;
    draft.interaction.activeEntityPresetId = null;
    draft.interaction.activeDecorPresetId = null;
    draft.interaction.selectedCell = null;
    draft.interaction.hoveredEntityIndex = null;
    draft.interaction.hoveredDecorIndex = null;
    clearDecorSelection(draft.interaction);
    clearEntitySelection(draft.interaction);
    draft.interaction.hoverCell = null;
    draft.ui.importStatus = statusMessage;
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
      if (historyEntryContainsDecor(entry)) {
        clearDecorSelection(draft.interaction);
        draft.interaction.hoveredDecorIndex = null;
        draft.interaction.decorDrag = null;
      }
      syncInteractionAfterHistoryChange(draft);
    });
  };

  const handleRedo = () => {
    store.setState((draft) => {
      const doc = draft.document.active;
      if (!doc) return;
      const entry = redoTileEdit(doc, draft.history);
      if (historyEntryContainsDecor(entry)) {
        clearDecorSelection(draft.interaction);
        draft.interaction.hoveredDecorIndex = null;
        draft.interaction.decorDrag = null;
      }
      syncInteractionAfterHistoryChange(draft);
    });
  };

  const handleExport = () => {
    const state = store.getState();
    if (!state.document.active) return;

    triggerLevelDocumentDownload(state.document.active);
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

      if (layer === PANEL_LAYERS.ENTITIES) {
        applyCanvasTarget(draft, "entity");
        return;
      }

      setActiveLayer(draft, PANEL_LAYERS.TILES);
      draft.interaction.activeEntityPresetId = null;
      draft.interaction.activeDecorPresetId = null;
      draft.interaction.decorScatterMode = false;
      draft.interaction.boxSelection = null;
      draft.interaction.entityDrag = null;
      draft.interaction.decorDrag = null;
      draft.interaction.hoveredEntityIndex = null;
      draft.interaction.hoveredDecorIndex = null;
      clearDecorScatterDrag(draft);
      clearEntitySelection(draft.interaction);
      clearDecorSelection(draft.interaction);
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
      if (menuName === "settings" || menuName === "help") {
        toggleTopBarMenu(menuName);
      }
      return;
    }

    const actionButton = target.closest("[data-topbar-action]");
    if (actionButton instanceof HTMLButtonElement) {
      const action = actionButton.dataset.topbarAction;
      if (action === "new") handleNewLevel();
      if (action === "import") handleImport();
      if (action === "export") handleExport();
      if (action === "undo") handleUndo();
      if (action === "redo") handleRedo();
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

  const handleTopBarChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

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
        state.interaction.activeLayer = PANEL_LAYERS.TILES;
        state.interaction.canvasSelectionMode = "entity";
        clearDecorSelection(state.interaction);
        state.interaction.selectedCell = null;
        state.interaction.hoverCell = null;
        clearEntitySelection(state.interaction);
        state.interaction.boxSelection = null;
        state.interaction.entityDrag = null;
        state.interaction.decorDrag = null;
        state.interaction.decorScatterMode = false;
        state.interaction.decorScatterDrag = null;
        state.interaction.activeEntityPresetId = null;
        state.interaction.activeDecorPresetId = null;
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
  const unbindInspectorPanel = bindInspectorPanel(inspector, store, {
    onResize: resizeDocument,
    onMetaUpdate: updateDocumentMeta,
    onGridUpdate: updateGridSettings,
    onEntityUpdate: updateEntity,
    onDecorUpdate: updateDecor,
  });
  const unbindBrushPanel = bindBrushPanel(brushPanel, store, {
    onEntityUpdate: updateEntity,
    onDecorUpdate: updateDecor,
    onCanvasTargetChange: setActiveCanvasTarget,
    onLayerChange: setActiveLayerFromPanel,
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
  topBar.addEventListener("change", handleTopBarChange);
  document.addEventListener("pointerdown", handleDocumentPointerDown);

  resize();
  draw(store.getState());
  void loadDocument();

  return () => {
    unsubscribe();
    unbindInspectorPanel();
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
    topBar.removeEventListener("change", handleTopBarChange);
    document.removeEventListener("pointerdown", handleDocumentPointerDown);
  };
}
