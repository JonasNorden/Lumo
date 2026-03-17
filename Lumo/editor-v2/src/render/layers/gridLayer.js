function parseHexColor(hexColor) {
  const normalized = typeof hexColor === "string" ? hexColor.trim() : "";
  const validHex = /^#([\da-f]{3}|[\da-f]{6})$/i;
  if (!validHex.test(normalized)) return null;

  const expanded =
    normalized.length === 4
      ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
      : normalized;

  const red = Number.parseInt(expanded.slice(1, 3), 16);
  const green = Number.parseInt(expanded.slice(3, 5), 16);
  const blue = Number.parseInt(expanded.slice(5, 7), 16);

  return { red, green, blue };
}

function getGridStrokeColor(viewport) {
  const opacity = Number.isFinite(viewport.gridOpacity) ? Math.max(0, Math.min(1, viewport.gridOpacity)) : 0.25;
  const parsedColor = parseHexColor(viewport.gridColor) ?? { red: 111, green: 133, blue: 175 };

  return `rgba(${parsedColor.red}, ${parsedColor.green}, ${parsedColor.blue}, ${opacity})`;
}

export function renderGrid(ctx, doc, viewport) {
  if (!viewport.gridVisible) return;

  const { width, height, tileSize } = doc.dimensions;
  const cell = tileSize * viewport.zoom;

  ctx.strokeStyle = getGridStrokeColor(viewport);
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += 1) {
    const px = Math.round(viewport.offsetX + x * cell) + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, viewport.offsetY);
    ctx.lineTo(px, viewport.offsetY + height * cell);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += 1) {
    const py = Math.round(viewport.offsetY + y * cell) + 0.5;
    ctx.beginPath();
    ctx.moveTo(viewport.offsetX, py);
    ctx.lineTo(viewport.offsetX + width * cell, py);
    ctx.stroke();
  }
}
