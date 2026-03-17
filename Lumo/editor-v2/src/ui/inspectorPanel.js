import { TILE_DEFINITIONS } from "../domain/tiles/tileTypes.js";

const MIN_LEVEL_SIZE = 8;
const MAX_LEVEL_SIZE = 256;
const DEFAULT_LEVEL_NAME = "Untitled Level";
const DEFAULT_LEVEL_ID = "untitled-level";
const GRID_OPACITY_DRAGGING_ATTR = "gridOpacityDragging";
const WORKSPACE_BACKGROUND_PRESETS = ["#0a0f1d", "#111827", "#1a2336", "#141b2a"];

function clampLevelSize(value) {
  return Math.max(MIN_LEVEL_SIZE, Math.min(MAX_LEVEL_SIZE, value));
}

function countPaintedTiles(tiles) {
  return tiles.reduce((count, tile) => (tile ? count + 1 : count), 0);
}

function getInspectedCell(state) {
  return state.interaction.selectedCell || state.interaction.hoverCell;
}

function getTileForCell(active, cell) {
  if (!cell) return null;

  const width = active.dimensions.width;
  const tileValue = active.tiles.base[cell.y * width + cell.x];
  const tileDefinition = TILE_DEFINITIONS[tileValue];

  return {
    value: tileValue,
    label: tileDefinition?.label || "Unknown",
  };
}

function captureFocusedMetaInput(panel) {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLInputElement)) return null;
  if (!panel.contains(activeElement)) return null;

  const metaField = activeElement.dataset.metaField;
  const backgroundField = activeElement.dataset.backgroundField;
  const backgroundIndex = activeElement.dataset.backgroundIndex;
  const entityField = activeElement.dataset.entityField;
  const entityIndex = activeElement.dataset.entityIndex;

  const validBackground = backgroundField === "name" && Number.isInteger(Number.parseInt(backgroundIndex || "", 10));
  const validEntity = (entityField === "name" || entityField === "type") && Number.isInteger(Number.parseInt(entityIndex || "", 10));

  if (metaField !== "name" && metaField !== "id" && !validBackground && !validEntity) return null;

  return {
    type: metaField === "name" || metaField === "id" ? "meta" : validBackground ? "background" : "entity",
    field: metaField || backgroundField || entityField,
    index: validBackground
      ? Number.parseInt(backgroundIndex || "", 10)
      : validEntity
        ? Number.parseInt(entityIndex || "", 10)
        : null,
    selectionStart: activeElement.selectionStart,
    selectionEnd: activeElement.selectionEnd,
    selectionDirection: activeElement.selectionDirection,
  };
}

function restoreFocusedMetaInput(panel, snapshot) {
  if (!snapshot) return;

  const replacementInput = snapshot.type === "background"
    ? panel.querySelector(`input[data-background-field="name"][data-background-index="${snapshot.index}"]`)
    : snapshot.type === "entity"
      ? panel.querySelector(`input[data-entity-field="${snapshot.field}"][data-entity-index="${snapshot.index}"]`)
      : panel.querySelector(`input[data-meta-field="${snapshot.field}"]`);
  if (!(replacementInput instanceof HTMLInputElement)) return;

  replacementInput.focus({ preventScroll: true });

  if (snapshot.selectionStart === null || snapshot.selectionEnd === null) return;

  const clampedStart = Math.max(0, Math.min(snapshot.selectionStart, replacementInput.value.length));
  const clampedEnd = Math.max(0, Math.min(snapshot.selectionEnd, replacementInput.value.length));
  replacementInput.setSelectionRange(clampedStart, clampedEnd, snapshot.selectionDirection || "none");
}

function captureInspectorSectionState(panel) {
  const sections = panel.querySelectorAll("details[data-inspector-section]");
  if (!sections.length) return null;

  const snapshot = {};
  for (const section of sections) {
    const key = section.dataset.inspectorSection;
    if (!key) continue;
    snapshot[key] = section.open;
  }
  return snapshot;
}

function restoreInspectorSectionState(panel, snapshot) {
  if (!snapshot) return;
  for (const [key, isOpen] of Object.entries(snapshot)) {
    const section = panel.querySelector(`details[data-inspector-section="${key}"]`);
    if (!section) continue;
    section.open = Boolean(isOpen);
  }
}

function setInspectorMarkup(panel, markup) {
  const focusedMetaSnapshot = captureFocusedMetaInput(panel);
  const sectionSnapshot = captureInspectorSectionState(panel);
  panel.innerHTML = markup;
  restoreInspectorSectionState(panel, sectionSnapshot);
  restoreFocusedMetaInput(panel, focusedMetaSnapshot);
}


function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderBackgroundSettings(active) {
  const layers = active.backgrounds?.layers || [];

  return `
    <div class="infoGroup">
      <div class="label">Backgrounds</div>
      <div class="value">${layers.length} layer${layers.length === 1 ? "" : "s"}</div>
    </div>

    <button type="button" class="toolButton" data-background-action="add">Add background layer</button>

    <div class="backgroundLayerList">
      ${layers
        .map(
          (layer, index) => `
            <div class="backgroundLayerRow">
              <label class="fieldRow">
                <span class="label">Name</span>
                <input type="text" value="${escapeHtml(layer.name)}" data-background-field="name" data-background-index="${index}" />
              </label>
              <div class="backgroundLayerControls">
                <label class="fieldRow compactInline">
                  <span class="label">Visible</span>
                  <input type="checkbox" data-background-field="visible" data-background-index="${index}" ${layer.visible ? "checked" : ""} />
                </label>
                <label class="fieldRow compactInline">
                  <span class="label">Color</span>
                  <input type="color" value="${layer.color}" data-background-field="color" data-background-index="${index}" />
                </label>
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}


function renderEntitiesSettings(active, state) {
  const entities = active.entities || [];
  const selectedEntityIndex = state.interaction.selectedEntityIndex;
  const selected = Number.isInteger(selectedEntityIndex) ? entities[selectedEntityIndex] : null;

  return `
    <div class="infoGroup">
      <div class="label">Entities</div>
      <div class="value">${entities.length} total</div>
    </div>

    <button type="button" class="toolButton" data-entity-action="add">Add entity</button>

    <div class="entityList" role="listbox" aria-label="Entities">
      ${entities
        .map((entity, index) => `
          <button
            type="button"
            class="entityListItem ${selectedEntityIndex === index ? "isSelected" : ""}"
            data-entity-action="select"
            data-entity-index="${index}"
          >
            <span>${escapeHtml(entity.name)}</span>
            <span class="mutedValue">${escapeHtml(entity.type)}</span>
          </button>
        `)
        .join("")}
    </div>

    ${selected
      ? `
      <div class="entityEditor">
        <label class="fieldRow">
          <span class="label">Name</span>
          <input type="text" value="${escapeHtml(selected.name)}" data-entity-field="name" data-entity-index="${selectedEntityIndex}" />
        </label>

        <label class="fieldRow">
          <span class="label">Type</span>
          <input type="text" value="${escapeHtml(selected.type)}" data-entity-field="type" data-entity-index="${selectedEntityIndex}" />
        </label>

        <label class="fieldRow compactInline">
          <span class="label">Visible</span>
          <input type="checkbox" ${selected.visible ? "checked" : ""} data-entity-field="visible" data-entity-index="${selectedEntityIndex}" />
        </label>

        <div class="entityPositionGrid">
          <label class="fieldRow">
            <span class="label">X</span>
            <input type="number" step="1" value="${selected.x}" data-entity-field="x" data-entity-index="${selectedEntityIndex}" />
          </label>
          <label class="fieldRow">
            <span class="label">Y</span>
            <input type="number" step="1" value="${selected.y}" data-entity-field="y" data-entity-index="${selectedEntityIndex}" />
          </label>
        </div>
      </div>
      `
      : '<div class="mutedValue">Select an entity to edit it.</div>'}
  `;
}

function renderInspectorSection(title, key, content, open = false) {
  return `
    <details class="inspectorSection" data-inspector-section="${key}" ${open ? "open" : ""}>
      <summary>${title}</summary>
      <div class="inspectorSectionBody">
        ${content}
      </div>
    </details>
  `;
}

function renderGridSettings(state) {
  const { gridVisible, gridOpacity, gridColor } = state.viewport;

  return `
    <div class="infoGroup">
      <div class="label">Grid</div>
      <div class="value">Settings</div>
    </div>

    <label class="fieldRow">
      <span class="label">Visible</span>
      <input
        type="checkbox"
        data-grid-field="visible"
        ${gridVisible ? "checked" : ""}
      />
    </label>

    <label class="fieldRow">
      <span class="label">Opacity</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value="${gridOpacity}"
        data-grid-field="opacity"
      />
    </label>

    <label class="fieldRow">
      <span class="label">Color</span>
      <input
        type="color"
        value="${gridColor}"
        data-grid-field="color"
      />
    </label>
  `;
}

function renderWorkspaceSettings(state) {
  const { workspaceBackground } = state.ui;

  return `
    <div class="infoGroup">
      <div class="label">Workspace</div>
      <div class="value">Canvas</div>
    </div>

    <label class="fieldRow">
      <span class="label">Background color</span>
      <input
        type="color"
        value="${workspaceBackground}"
        data-workspace-field="background"
      />
    </label>

    <div class="workspacePresets" role="group" aria-label="Workspace background presets">
      ${WORKSPACE_BACKGROUND_PRESETS.map(
        (preset) => `
          <button
            type="button"
            class="workspacePreset${workspaceBackground === preset ? " isActive" : ""}"
            data-workspace-preset="${preset}"
            title="Set workspace background to ${preset}"
            style="--workspace-preset-color: ${preset};"
          ></button>
        `,
      ).join("")}
    </div>
  `;
}

function renderCellInfo(active, state) {
  const inspectedCell = getInspectedCell(state);
  if (!inspectedCell) {
    return `
      <div class="infoGroup">
        <div class="label">Cell</div>
        <div class="value">No cell selected.</div>
      </div>
    `;
  }

  const tileInfo = getTileForCell(active, inspectedCell);
  const sourceLabel = state.interaction.selectedCell ? "Selected" : "Hover";

  return `
    <div class="infoGroup">
      <div class="label">Cell</div>
      <div class="value">${sourceLabel}</div>
    </div>

    <div class="infoGroup">
      <div class="label">X</div>
      <div class="value">${inspectedCell.x}</div>
    </div>

    <div class="infoGroup">
      <div class="label">Y</div>
      <div class="value">${inspectedCell.y}</div>
    </div>

    <div class="infoGroup">
      <div class="label">Tile</div>
      <div class="value">${tileInfo.label} (${tileInfo.value})</div>
    </div>
  `;
}

export function renderInspector(panel, state) {
  const active = state.document.active;

  if (state.document.status === "loading") {
    setInspectorMarkup(panel, `<div class="value">Loading document…</div>`);
    return;
  }

  if (state.document.error) {
    setInspectorMarkup(panel, `<div class="value">${state.document.error}</div>`);
    return;
  }

  if (!active) {
    setInspectorMarkup(panel, `<div class="value">No document loaded.</div>`);
    return;
  }

  if (panel.dataset[GRID_OPACITY_DRAGGING_ATTR] === "true") {
    return;
  }

  const tileCount = active.dimensions.width * active.dimensions.height;
  const paintedCount = countPaintedTiles(active.tiles.base);

  setInspectorMarkup(panel, `
    ${renderInspectorSection("Level", "level", `
    <label class="fieldRow">
      <span class="label">Name</span>
      <input
        type="text"
        value="${active.meta.name}"
        data-meta-field="name"
      />
    </label>

    <label class="fieldRow">
      <span class="label">ID</span>
      <input
        type="text"
        value="${active.meta.id}"
        data-meta-field="id"
      />
    </label>

    <label class="fieldRow">
      <span class="label">Version</span>
      <input
        type="text"
        value="${active.meta.version}"
        readonly
      />
    </label>

    <div class="infoGroup">
      <div class="label">Size</div>
      <div class="value">${active.dimensions.width} × ${active.dimensions.height}</div>
    </div>

    <label class="fieldRow">
      <span class="label">Width</span>
      <input
        type="number"
        min="${MIN_LEVEL_SIZE}"
        max="${MAX_LEVEL_SIZE}"
        step="1"
        value="${active.dimensions.width}"
        data-dimension-field="width"
      />
    </label>

    <label class="fieldRow">
      <span class="label">Height</span>
      <input
        type="number"
        min="${MIN_LEVEL_SIZE}"
        max="${MAX_LEVEL_SIZE}"
        step="1"
        value="${active.dimensions.height}"
        data-dimension-field="height"
      />
    </label>

    <div class="infoGroup">
      <div class="label">Tiles</div>
      <div class="value">${paintedCount} / ${tileCount}</div>
    </div>

    <div class="infoGroup">
      <div class="label">Session</div>
      <div class="badge">${state.session.mode}</div>
    </div>
    `, true)}

    ${renderInspectorSection("Grid", "grid", renderGridSettings(state), false)}

    ${renderInspectorSection("Cell", "cell", renderCellInfo(active, state), false)}
  `);
}

export function bindInspectorPanel(panel, store, options = {}) {
  const { onResize, onMetaUpdate, onGridUpdate, onWorkspaceUpdate, onBackgroundUpdate, onEntityUpdate } = options;

  const sanitizeMetaValue = (field, value) => {
    const trimmed = value.trim();
    if (trimmed) return trimmed;

    if (field === "name") return DEFAULT_LEVEL_NAME;
    if (field === "id") return DEFAULT_LEVEL_ID;

    return trimmed;
  };

  const handleMetaChange = (target) => {
    const metaField = target.dataset.metaField;
    if (metaField !== "name" && metaField !== "id") return false;

    const state = store.getState();
    const active = state.document.active;
    if (!active) return false;

    const nextValue = sanitizeMetaValue(metaField, target.value);
    target.value = nextValue;

    if (active.meta[metaField] === nextValue) return true;

    onMetaUpdate?.(metaField, nextValue);
    return true;
  };

  const handleGridChange = (target) => {
    const gridField = target.dataset.gridField;
    if (gridField !== "visible" && gridField !== "opacity" && gridField !== "color") return false;

    const state = store.getState();
    const viewport = state.viewport;

    if (gridField === "visible") {
      const nextValue = target.checked;
      if (viewport.gridVisible === nextValue) return true;
      onGridUpdate?.("visible", nextValue);
      return true;
    }

    if (gridField === "opacity") {
      const parsed = Number.parseFloat(target.value);
      const nextValue = Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : viewport.gridOpacity;
      target.value = String(nextValue);
      if (viewport.gridOpacity === nextValue) return true;
      onGridUpdate?.("opacity", nextValue);
      return true;
    }

    const nextColor = target.value;
    if (viewport.gridColor === nextColor) return true;
    onGridUpdate?.("color", nextColor);
    return true;
  };

  const handleWorkspaceChange = (target) => {
    const workspaceField = target.dataset.workspaceField;
    if (workspaceField !== "background") return false;

    const nextColor = target.value;
    const currentColor = store.getState().ui.workspaceBackground;
    if (currentColor === nextColor) return true;

    onWorkspaceUpdate?.("background", nextColor);
    return true;
  };
  const handleBackgroundChange = (target) => {
    const backgroundField = target.dataset.backgroundField;
    if (backgroundField !== "name" && backgroundField !== "visible" && backgroundField !== "color") return false;

    const index = Number.parseInt(target.dataset.backgroundIndex || "", 10);
    if (!Number.isInteger(index) || index < 0) return false;

    if (backgroundField === "visible") {
      onBackgroundUpdate?.(index, "visible", target.checked);
      return true;
    }

    const value = backgroundField === "name" ? target.value : target.value;
    onBackgroundUpdate?.(index, backgroundField, value);
    return true;
  };


  const handleEntityChange = (target) => {
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

  const onChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (handleMetaChange(target)) return;
    if (handleGridChange(target)) return;
    if (handleWorkspaceChange(target)) return;
    if (handleBackgroundChange(target)) return;
    if (handleEntityChange(target)) return;

    const dimensionField = target.dataset.dimensionField;
    if (dimensionField !== "width" && dimensionField !== "height") return;

    const state = store.getState();
    const active = state.document.active;
    if (!active) return;

    const nextValue = clampLevelSize(Number.parseInt(target.value, 10));
    if (!Number.isInteger(nextValue)) {
      target.value = String(active.dimensions[dimensionField]);
      return;
    }

    const nextWidth = dimensionField === "width" ? nextValue : active.dimensions.width;
    const nextHeight = dimensionField === "height" ? nextValue : active.dimensions.height;

    target.value = String(nextValue);
    onResize?.(nextWidth, nextHeight);
  };

  const onInput = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (handleMetaChange(target)) return;
    if (handleGridChange(target)) return;
    if (handleWorkspaceChange(target)) return;
    if (handleBackgroundChange(target)) return;
    handleEntityChange(target);
  };

  const onClick = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const preset = target.dataset.workspacePreset;
    if (preset) {
      onWorkspaceUpdate?.("background", preset);
      return;
    }

    const backgroundAction = target.dataset.backgroundAction;
    if (backgroundAction === "add") {
      onBackgroundUpdate?.(-1, "add", null);
      return;
    }

    const entityAction = target.dataset.entityAction;
    if (entityAction === "add") {
      onEntityUpdate?.(-1, "add", null);
      return;
    }

    if (entityAction === "select") {
      const index = Number.parseInt(target.dataset.entityIndex || "", 10);
      if (Number.isInteger(index) && index >= 0) {
        onEntityUpdate?.(index, "select", null);
      }
    }
  };

  const onPointerDown = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.gridField !== "opacity") return;

    panel.dataset[GRID_OPACITY_DRAGGING_ATTR] = "true";
  };

  const stopOpacityDrag = () => {
    if (panel.dataset[GRID_OPACITY_DRAGGING_ATTR] !== "true") return;

    delete panel.dataset[GRID_OPACITY_DRAGGING_ATTR];
    renderInspector(panel, store.getState());
  };

  panel.addEventListener("change", onChange);
  panel.addEventListener("input", onInput);
  panel.addEventListener("click", onClick);
  panel.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", stopOpacityDrag);
  window.addEventListener("pointercancel", stopOpacityDrag);

  return () => {
    panel.removeEventListener("change", onChange);
    panel.removeEventListener("input", onInput);
    panel.removeEventListener("click", onClick);
    panel.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", stopOpacityDrag);
    window.removeEventListener("pointercancel", stopOpacityDrag);
  };
}
