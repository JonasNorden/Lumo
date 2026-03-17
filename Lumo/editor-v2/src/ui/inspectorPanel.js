function countPaintedTiles(tiles) {
  return tiles.reduce((count, tile) => (tile ? count + 1 : count), 0);
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
  `;
}
