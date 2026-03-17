export function renderBackgroundLayers(ctx, doc, viewport) {
  const layers = doc.backgrounds?.layers || [];
  if (!layers.length) return;

  const { width, height, tileSize } = doc.dimensions;
  const cell = tileSize * viewport.zoom;
  const drawWidth = Math.ceil(width * cell);
  const drawHeight = Math.ceil(height * cell);
  const drawX = Math.floor(viewport.offsetX);
  const drawY = Math.floor(viewport.offsetY);

  for (const layer of layers) {
    if (!layer?.visible) continue;
    ctx.fillStyle = layer.color || "#1b2436";
    ctx.fillRect(drawX, drawY, drawWidth, drawHeight);
  }
}
