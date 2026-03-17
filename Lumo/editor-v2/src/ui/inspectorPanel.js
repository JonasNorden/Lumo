import { TILE_DEFINITIONS } from "../domain/tiles/tileTypes.js";

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
    <div class="infoGroup">
      <div class="label">Level</div>
      <div class="value">${active.meta.name}</div>
    </div>

    <div class="infoGroup">
      <div class="label">Size</div>
      <div class="value">${active.dimensions.width} × ${active.dimensions.height}</div>
    </div>

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
