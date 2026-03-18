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
  createTileEditEntry,
  startTileEditBatch,
  pushTileEdit,
  endTileEditBatch,
  undoTileEdit,
  redoTileEdit,
} from "../domain/tiles/history.js";
import { getTileIndex } from "../domain/level/levelDocument.js";
import { findEntityAtCanvasPoint } from "../render/layers/entityLayer.js";
import { TILE_DEFINITIONS } from "../domain/tiles/tileTypes.js";
import { DEFAULT_ENTITY_PRESET_ID, findEntityPresetById, getEntityPresetDefaultParams } from "../domain/entities/entityPresets.js";
import { cloneEntityParams, isSupportedEntityParamValue } from "../domain/entities/entityParams.js";
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
  if (!inspectedCell) {
    cellHud.textContent = "";
    cellHud.classList.remove("isVisible");
    return;
  }

  const tileInfo = getTileForCell(active, inspectedCell);
  const sourceLabel = state.interaction.selectedCell ? "Selected" : "Hover";
  const tileLabel = tileInfo ? `${tileInfo.label} (${tileInfo.value})` : "Unknown";

  cellHud.innerHTML = `
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

export function createEditorApp({ canvas, minimapCanvas, inspector, brushPanel, cellHud, store }) {
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

      for (const entity of doc.entities || []) {
        entity.x = Math.max(0, Math.min(nextWidth - 1, entity.x));
        entity.y = Math.max(0, Math.min(nextHeight - 1, entity.y));
      }

      pruneEntitySelection(draft.interaction, doc.entities?.length || 0);
      updateEntitySelectionCell(draft);
      draft.interaction.hoverCell = null;
      draft.interaction.dragPaint = null;
      draft.interaction.rectDrag = null;
      draft.interaction.lineDrag = null;
      draft.interaction.boxSelection = null;
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
        layers.push({
          id: `bg-${nextNumber}`,
          name: `Background ${nextNumber}`,
          visible: true,
          color: "#1b2436",
        });
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
      }
    });
  };

  const clampEntityPosition = (doc, x, y) => ({
    x: Math.max(0, Math.min(doc.dimensions.width - 1, Math.round(x))),
    y: Math.max(0, Math.min(doc.dimensions.height - 1, Math.round(y))),
  });

  const getNextEntityStringId = (entities, field, fallbackPrefix) => {
    const takenIds = new Set(
      entities
        .map((entity) => entity?.[field])
        .filter((value) => typeof value === "string" && value.trim()),
    );
    const prefix = typeof fallbackPrefix === "string" && fallbackPrefix.trim() ? fallbackPrefix.trim() : field;
    let nextNumber = entities.length + 1;

    while (takenIds.has(`${prefix}-${nextNumber}`)) {
      nextNumber += 1;
    }

    return `${prefix}-${nextNumber}`;
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

  const updateEntitySelectionCell = (draft, primaryIndex = draft.interaction.selectedEntityIndex) => {
    const entity = Number.isInteger(primaryIndex) ? draft.document.active?.entities?.[primaryIndex] : null;
    draft.interaction.selectedCell = entity ? { x: entity.x, y: entity.y } : null;
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
        id: getNextEntityStringId(doc.entities, "id", "entity"),
        x: offset.x,
        y: offset.y,
        params: cloneEntityParams(source.params),
      };

      if (typeof source.instanceId === "string" && source.instanceId.trim()) {
        duplicate.instanceId = getNextEntityStringId(doc.entities, "instanceId", "instance");
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
        draft.interaction.activeTool = EDITOR_TOOLS.INSPECT;
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

  const draw = (state) => {
    renderEditorFrame(ctx, state);
    minimapLayout = renderMinimap(minimapCtx, state);
    renderInspector(inspector, state);
    renderBrushPanel(brushPanel, state);
    renderCellHud(cellHud, state);
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
    const currentCell = state.interaction.hoverCell;
    const currentHoveredEntityIndex = state.interaction.hoveredEntityIndex;
    const cellUnchanged = currentCell?.x === nextHoverCell?.x && currentCell?.y === nextHoverCell?.y;

    if (cellUnchanged && currentHoveredEntityIndex === (nextHoveredEntityIndex >= 0 ? nextHoveredEntityIndex : null)) {
      return;
    }

    store.setState((draft) => {
      draft.interaction.hoverCell = nextHoverCell;
      draft.interaction.hoveredEntityIndex = nextHoveredEntityIndex >= 0 ? nextHoveredEntityIndex : null;
    });
  };

  const clearHoveredCanvasState = () => {
    const state = store.getState();
    if (!state.interaction.hoverCell && state.interaction.hoveredEntityIndex === null) return;

    store.setState((draft) => {
      draft.interaction.hoverCell = null;
      draft.interaction.hoveredEntityIndex = null;
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

  const handleInspectCanvasMouseDown = (event, state, cell, point) => {
    const hitEntityIndex = findEntityAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    const activePresetId = state.interaction.activeEntityPresetId;

    if (hitEntityIndex >= 0) {
      interactionState.suppressNextClick = true;
      event.preventDefault();
      store.setState((draft) => {
        const entity = draft.document.active?.entities?.[hitEntityIndex];
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

    if (activePresetId) {
      interactionState.suppressNextClick = true;
      event.preventDefault();
      store.setState((draft) => {
        createEntityAtCell(draft, cell, activePresetId);
        draft.interaction.hoverCell = cell;
      });
      return true;
    }

    interactionState.suppressNextClick = true;
    event.preventDefault();
    store.setState((draft) => {
      draft.interaction.selectedCell = cell;
      draft.interaction.boxSelection = {
        active: true,
        additive: event.shiftKey,
        startPoint: point,
        currentPoint: point,
      };
      if (!event.shiftKey) {
        clearEntitySelection(draft.interaction);
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

    if (state.interaction.boxSelection?.active) {
      const boxSelection = state.interaction.boxSelection;
      const nextSelection = getEntityIndicesInCanvasRect(
        state.document.active,
        state.viewport,
        boxSelection.startPoint,
        boxSelection.currentPoint,
      );

      store.setState((draft) => {
        const baseSelection = boxSelection.additive ? getSelectedEntityIndices(draft.interaction) : [];
        setEntitySelection(
          draft.interaction,
          boxSelection.additive ? [...baseSelection, ...nextSelection] : nextSelection,
          nextSelection[nextSelection.length - 1] ?? getPrimarySelectedEntityIndex(draft.interaction),
        );
        draft.interaction.boxSelection = null;
        updateEntitySelectionCell(draft);
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
    const hitEntityIndex = findEntityAtCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    if (hitEntityIndex >= 0) {
      store.setState((draft) => {
        if (event.shiftKey) {
          toggleEntitySelection(draft.interaction, hitEntityIndex);
        } else {
          setEntitySelection(draft.interaction, [hitEntityIndex], hitEntityIndex);
        }
        updateEntitySelectionCell(draft, getPrimarySelectedEntityIndex(draft.interaction));
      });
      return;
    }

    const cell = getCellFromCanvasPoint(state.document.active, state.viewport, point.x, point.y);
    if (!cell) return;

    store.setState((draft) => {
      draft.interaction.selectedCell = cell;
      clearEntitySelection(draft.interaction);
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
    draft.interaction.activeEntityPresetId = null;
    draft.interaction.selectedCell = null;
    draft.interaction.hoveredEntityIndex = null;
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
      undoTileEdit(doc, draft.history);
    });
  };

  const handleRedo = () => {
    store.setState((draft) => {
      const doc = draft.document.active;
      if (!doc) return;
      redoTileEdit(doc, draft.history);
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
          duplicated = duplicateSelectedEntity(draft);
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
      if (!getSelectedEntityIndices(state.interaction).length) return;

      event.preventDefault();
      store.setState((draft) => {
        deleteSelectedEntity(draft);
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
        clearEntitySelection(state.interaction);
        state.interaction.boxSelection = null;
        state.interaction.entityDrag = null;
        state.interaction.activeEntityPresetId = null;
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
    onWorkspaceUpdate: updateWorkspaceSettings,
    onBackgroundUpdate: updateBackgroundLayer,
    onEntityUpdate: updateEntity,
  });
  const unbindBrushPanel = bindBrushPanel(brushPanel, store, {
    onUndo: handleUndo,
    onRedo: handleRedo,
    onExport: handleExport,
    onImport: handleImport,
    onNew: handleNewLevel,
    onWorkspaceUpdate: updateWorkspaceSettings,
    onBackgroundUpdate: updateBackgroundLayer,
    onEntityUpdate: updateEntity,
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
  };
}
