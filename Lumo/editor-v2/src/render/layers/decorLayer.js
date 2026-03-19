import { getDecorHitRadius, getDecorVisual } from '../../domain/decor/decorVisuals.js';
import { getSelectedDecorIndices, isDecorSelected } from "../../domain/decor/selection.js";

function getDecorScreenCenter(decor, tileSize, viewport) {
  return {
    x: viewport.offsetX + (decor.x + 0.5) * tileSize * viewport.zoom,
    y: viewport.offsetY + (decor.y + 0.76) * tileSize * viewport.zoom,
  };
}

function drawGrassMarker(ctx, x, y, scale, visual) {
  ctx.save();
  ctx.strokeStyle = visual.stroke;
  ctx.lineWidth = 1.5 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 4.4 * scale, y + 4.2 * scale);
  ctx.quadraticCurveTo(x - 3.4 * scale, y - 1.8 * scale, x - 1.8 * scale, y - 5.2 * scale);
  ctx.moveTo(x, y + 4.8 * scale);
  ctx.quadraticCurveTo(x - 0.2 * scale, y - 0.9 * scale, x + 0.2 * scale, y - 6.4 * scale);
  ctx.moveTo(x + 4.2 * scale, y + 4.2 * scale);
  ctx.quadraticCurveTo(x + 3.2 * scale, y - 1.4 * scale, x + 1.8 * scale, y - 5.3 * scale);
  ctx.stroke();
  ctx.restore();
}

function drawBushMarker(ctx, x, y, scale, visual) {
  ctx.beginPath();
  ctx.arc(x - 3.2 * scale, y + 0.2 * scale, 3.2 * scale, 0, Math.PI * 2);
  ctx.arc(x + 3.1 * scale, y + 0.1 * scale, 3.5 * scale, 0, Math.PI * 2);
  ctx.arc(x, y - 2.5 * scale, 4.2 * scale, 0, Math.PI * 2);
  ctx.fillStyle = visual.fill;
  ctx.fill();
  ctx.strokeStyle = visual.stroke;
  ctx.lineWidth = 1.4 * scale;
  ctx.stroke();
}

function drawRockMarker(ctx, x, y, scale, visual) {
  ctx.beginPath();
  ctx.moveTo(x - 6.2 * scale, y + 4.8 * scale);
  ctx.lineTo(x - 5.1 * scale, y - 1.6 * scale);
  ctx.lineTo(x - 1.4 * scale, y - 5.2 * scale);
  ctx.lineTo(x + 5.8 * scale, y - 3.1 * scale);
  ctx.lineTo(x + 6.6 * scale, y + 4.3 * scale);
  ctx.closePath();
  ctx.fillStyle = visual.fill;
  ctx.fill();
  ctx.strokeStyle = visual.stroke;
  ctx.lineWidth = 1.4 * scale;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - 2.5 * scale, y - 1.4 * scale);
  ctx.lineTo(x + 1.2 * scale, y - 2.7 * scale);
  ctx.lineTo(x + 3.2 * scale, y + 1.2 * scale);
  ctx.strokeStyle = visual.accent;
  ctx.lineWidth = 1 * scale;
  ctx.stroke();
}

function drawFlowerMarker(ctx, x, y, scale, visual) {
  ctx.save();
  ctx.strokeStyle = '#8ad27e';
  ctx.lineWidth = 1.3 * scale;
  ctx.beginPath();
  ctx.moveTo(x, y + 5 * scale);
  ctx.lineTo(x, y - 1.5 * scale);
  ctx.stroke();
  ctx.restore();

  for (let i = 0; i < 4; i += 1) {
    const angle = (Math.PI / 2) * i;
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * 2.8 * scale, y - 3.6 * scale + Math.sin(angle) * 2.8 * scale, 2.4 * scale, 0, Math.PI * 2);
    ctx.fillStyle = visual.stroke;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(x, y - 3.6 * scale, 1.7 * scale, 0, Math.PI * 2);
  ctx.fillStyle = visual.accent;
  ctx.fill();
}

function drawSignMarker(ctx, x, y, scale, visual) {
  ctx.save();
  ctx.strokeStyle = visual.stroke;
  ctx.lineWidth = 1.3 * scale;
  ctx.beginPath();
  ctx.moveTo(x, y + 5.2 * scale);
  ctx.lineTo(x, y - 4.4 * scale);
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.roundRect(x - 5.8 * scale, y - 7.4 * scale, 11.6 * scale, 6.2 * scale, 1.6 * scale);
  ctx.fillStyle = visual.fill;
  ctx.fill();
  ctx.strokeStyle = visual.stroke;
  ctx.lineWidth = 1.2 * scale;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - 2.8 * scale, y - 4.4 * scale);
  ctx.lineTo(x + 2.6 * scale, y - 4.4 * scale);
  ctx.strokeStyle = visual.accent;
  ctx.lineWidth = 1 * scale;
  ctx.stroke();
}

function drawDecorGlyph(ctx, decor, x, y, scale, visual) {
  switch (visual.marker) {
    case 'bush':
      drawBushMarker(ctx, x, y, scale, visual);
      break;
    case 'rock':
      drawRockMarker(ctx, x, y, scale, visual);
      break;
    case 'flower':
      drawFlowerMarker(ctx, x, y, scale, visual);
      break;
    case 'sign':
      drawSignMarker(ctx, x, y, scale, visual);
      break;
    default:
      drawGrassMarker(ctx, x, y, scale, visual);
      break;
  }
}

function drawDecorFocus(ctx, x, y, radius, { selected = false, hovered = false, preview = false } = {}, scale = 1) {
  if (!selected && !hovered && !preview) return;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y + 1.5 * scale, radius, radius * 0.72, 0, 0, Math.PI * 2);
  ctx.fillStyle = preview
    ? 'rgba(255, 214, 138, 0.14)'
    : selected
      ? 'rgba(255, 179, 71, 0.18)'
      : 'rgba(125, 231, 255, 0.12)';
  ctx.fill();
  ctx.strokeStyle = preview
    ? 'rgba(255, 214, 138, 0.85)'
    : selected
      ? 'rgba(255, 179, 71, 0.8)'
      : 'rgba(125, 231, 255, 0.72)';
  ctx.lineWidth = (preview ? 1.6 : 1.2) * scale;
  if (preview) ctx.setLineDash([3 * scale, 2 * scale]);
  ctx.stroke();
  ctx.restore();
}

function drawDecorMarker(ctx, decor, viewport, tileSize, options = {}) {
  const { x, y } = getDecorScreenCenter(decor, tileSize, viewport);
  const visual = getDecorVisual(decor.type);
  const scale = 1 / Math.max(0.001, viewport.zoom);

  ctx.save();
  ctx.globalAlpha *= options.alpha ?? 1;
  drawDecorFocus(ctx, x, y, 9 * scale, options, scale);
  drawDecorGlyph(ctx, decor, x, y, scale, visual);
  ctx.restore();
}

function getScatterBoundsRect(doc, viewport, startCell, endCell) {
  if (!startCell || !endCell) return null;

  const tileSize = doc.dimensions.tileSize * viewport.zoom;
  const minX = Math.min(startCell.x, endCell.x);
  const maxX = Math.max(startCell.x, endCell.x);
  const minY = Math.min(startCell.y, endCell.y);
  const maxY = Math.max(startCell.y, endCell.y);

  return {
    x: viewport.offsetX + minX * tileSize,
    y: viewport.offsetY + minY * tileSize,
    width: (maxX - minX + 1) * tileSize,
    height: (maxY - minY + 1) * tileSize,
  };
}

export function findDecorAtCanvasPoint(doc, viewport, pointX, pointY, radius = 2) {
  const decorItems = doc.decor || [];
  const tileSize = doc.dimensions.tileSize;

  for (let i = decorItems.length - 1; i >= 0; i -= 1) {
    const decor = decorItems[i];
    if (!decor.visible) continue;

    const center = getDecorScreenCenter(decor, tileSize, viewport);
    const hitRadius = (getDecorHitRadius(decor.type) + radius) * viewport.zoom;
    const dx = pointX - center.x;
    const dy = pointY - center.y;

    if (dx * dx + dy * dy <= hitRadius * hitRadius) {
      return i;
    }
  }

  return -1;
}

export function renderDecor(ctx, doc, viewport, interaction) {
  const decorItems = doc.decor || [];
  const tileSize = doc.dimensions.tileSize;
  const draggedSelection = new Set(interaction.decorDrag?.active ? getSelectedDecorIndices(interaction) : []);

  for (let i = 0; i < decorItems.length; i += 1) {
    const decor = decorItems[i];
    if (!decor?.visible) continue;
    if (draggedSelection.has(i)) continue;

    drawDecorMarker(ctx, decor, viewport, tileSize, {
      selected: isDecorSelected(interaction, i),
      hovered: interaction.hoveredDecorIndex === i,
      alpha: draggedSelection.has(i) ? 0.34 : 1,
    });
  }
}

export function renderDecorDragPreview(ctx, doc, viewport, interaction) {
  const decorDrag = interaction.decorDrag;
  if (!decorDrag?.active) return;

  const delta = decorDrag.previewDelta || { x: 0, y: 0 };

  for (const origin of decorDrag.originPositions || []) {
    const decor = doc.decor?.[origin.index];
    if (!decor?.visible) continue;

    const previewDecor = {
      ...decor,
      x: origin.x + delta.x,
      y: origin.y + delta.y,
    };

    drawDecorMarker(ctx, previewDecor, viewport, doc.dimensions.tileSize, {
      selected: true,
      preview: true,
      alpha: 0.92,
    });
  }
}

export function renderDecorPlacementPreview(ctx, doc, viewport, interaction, activePreset) {
  if (interaction.activeTool !== "inspect") return;
  if (interaction.decorScatterMode) return;
  if (!interaction.hoverCell || !activePreset) return;

  const previewDecor = {
    type: activePreset.type,
    x: interaction.hoverCell.x,
    y: interaction.hoverCell.y,
  };

  drawDecorMarker(ctx, previewDecor, viewport, doc.dimensions.tileSize, {
    preview: true,
    alpha: 0.88,
  });
}

export function renderDecorScatterPreview(ctx, doc, viewport, interaction) {
  const scatterDrag = interaction.decorScatterDrag;
  if (!scatterDrag?.active) return;

  const rect = getScatterBoundsRect(doc, viewport, scatterDrag.startCell, scatterDrag.currentCell || scatterDrag.startCell);
  if (!rect) return;

  ctx.save();
  ctx.fillStyle = 'rgba(255, 184, 76, 0.16)';
  ctx.strokeStyle = 'rgba(255, 196, 110, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 6]);
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.setLineDash([]);

  const scatterDensity = Number.isFinite(interaction.decorScatterSettings?.density)
    ? Math.max(0, Math.min(1, interaction.decorScatterSettings.density))
    : 0.3;
  const label = `Scatter · ${Math.round(scatterDensity * 100)}% density`;
  ctx.font = '12px Inter, system-ui, sans-serif';
  const textWidth = ctx.measureText(label).width;
  const badgeX = rect.x + 8;
  const badgeY = rect.y + 8;
  ctx.fillStyle = 'rgba(12, 18, 31, 0.88)';
  ctx.fillRect(badgeX, badgeY, textWidth + 14, 22);
  ctx.strokeStyle = 'rgba(255, 196, 110, 0.65)';
  ctx.strokeRect(badgeX, badgeY, textWidth + 14, 22);
  ctx.fillStyle = '#f6d69a';
  ctx.fillText(label, badgeX + 7, badgeY + 15);
  ctx.restore();
}
