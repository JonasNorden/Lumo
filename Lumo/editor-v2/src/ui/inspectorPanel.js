import { TILE_DEFINITIONS } from "../domain/tiles/tileTypes.js";

const MIN_LEVEL_SIZE = 8;
const MAX_LEVEL_SIZE = 256;
const DEFAULT_LEVEL_NAME = "Untitled Level";
const DEFAULT_LEVEL_ID = "untitled-level";

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
    panel.innerHTML = `<div class="value">Loading document…</div>`;
    return;
  }

  if (state.document.error) {
    panel.innerHTML = `<div class="value">${state.document.error}</div>`;
    return;
  }

  if (!active) {
    panel.innerHTML = `<div class="value">No document loaded.</div>`;
    return;
  }

  const tileCount = active.dimensions.width * active.dimensions.height;
  const paintedCount = countPaintedTiles(active.tiles.base);

  panel.innerHTML = `
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

    ${renderCellInfo(active, state)}
  `;
}

export function bindInspectorPanel(panel, store, options = {}) {
  const { onResize, onMetaUpdate } = options;

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

  const onChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (handleMetaChange(target)) return;

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

    handleMetaChange(target);
  };

  panel.addEventListener("change", onChange);
  panel.addEventListener("input", onInput);

  return () => {
    panel.removeEventListener("change", onChange);
    panel.removeEventListener("input", onInput);
  };
}
