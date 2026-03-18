import { getEntityHitRadius, getEntityVisual } from "../../domain/entities/entityVisuals.js";

function getEntityCenter(entity, tileSize) {
  return {
    x: (entity.x + 0.5) * tileSize,
    y: (entity.y + 0.5) * tileSize,
  };
}

function getEntityScreenCenter(entity, tileSize, viewport) {
  const center = getEntityCenter(entity, tileSize);
  return {
    x: viewport.offsetX + center.x * viewport.zoom,
    y: viewport.offsetY + center.y * viewport.zoom,
  };
}

function getShapeRadius(isSelected) {
  return isSelected ? 6.5 : 5.5;
}

function drawHex(ctx, x, y, radius) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = ((Math.PI * 2) / 6) * i - Math.PI / 6;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawDiamond(ctx, x, y, radius) {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
}

function drawRoundedSquare(ctx, x, y, radius) {
  const size = radius * 2;
  const corner = Math.max(2, radius * 0.45);
  ctx.beginPath();
  ctx.roundRect(x - radius, y - radius, size, size, corner);
}

function drawShield(ctx, x, y, radius) {
  const top = y - radius;
  const bottom = y + radius * 1.05;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x + radius * 0.78, y - radius * 0.45);
  ctx.lineTo(x + radius * 0.64, y + radius * 0.45);
  ctx.quadraticCurveTo(x, bottom, x - radius * 0.64, y + radius * 0.45);
  ctx.lineTo(x - radius * 0.78, y - radius * 0.45);
  ctx.closePath();
}

function drawEntityShape(ctx, visual, x, y, radius) {
  switch (visual.shape) {
    case "hex":
      drawHex(ctx, x, y, radius);
      break;
    case "diamond":
      drawDiamond(ctx, x, y, radius);
      break;
    case "shield":
      drawShield(ctx, x, y, radius);
      break;
    case "rounded-square":
      drawRoundedSquare(ctx, x, y, radius);
      break;
    default:
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      break;
  }
}

function drawSpawnSymbol(ctx, x, y, color, scale) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4 * scale;
  ctx.beginPath();
  ctx.arc(x, y, 1.4 * scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - 4.4 * scale);
  ctx.lineTo(x, y - 1.8 * scale);
  ctx.moveTo(x + 4.4 * scale, y);
  ctx.lineTo(x + 1.8 * scale, y);
  ctx.moveTo(x, y + 4.4 * scale);
  ctx.lineTo(x, y + 1.8 * scale);
  ctx.moveTo(x - 4.4 * scale, y);
  ctx.lineTo(x - 1.8 * scale, y);
  ctx.stroke();
  ctx.restore();
}

function drawLanternSymbol(ctx, x, y, color, scale) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.3 * scale;
  ctx.beginPath();
  ctx.arc(x, y - 2.9 * scale, 1.8 * scale, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(x - 2.8 * scale, y - 2.4 * scale, 5.6 * scale, 6.3 * scale, 1.4 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 2.1 * scale, y + 4 * scale);
  ctx.lineTo(x + 2.1 * scale, y + 4 * scale);
  ctx.moveTo(x, y - 2.4 * scale);
  ctx.lineTo(x, y + 3.9 * scale);
  ctx.stroke();
  ctx.restore();
}

function drawPlusSymbol(ctx, x, y, color, scale) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = 1.8 * scale;
  ctx.beginPath();
  ctx.moveTo(x, y - 4.2 * scale);
  ctx.lineTo(x, y + 4.2 * scale);
  ctx.moveTo(x - 4.2 * scale, y);
  ctx.lineTo(x + 4.2 * scale, y);
  ctx.stroke();
  ctx.restore();
}

function drawFlagSymbol(ctx, x, y, color, scale) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo(x - 2.2 * scale, y + 4.4 * scale);
  ctx.lineTo(x - 2.2 * scale, y - 4.4 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 1.8 * scale, y - 4 * scale);
  ctx.lineTo(x + 3.7 * scale, y - 2.6 * scale);
  ctx.lineTo(x - 1.8 * scale, y - 0.9 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDotSymbol(ctx, x, y, color, scale) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 1.8 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEntitySymbol(ctx, visual, x, y, scale) {
  switch (visual.symbol) {
    case "spawn":
      drawSpawnSymbol(ctx, x, y, visual.stroke, scale);
      break;
    case "lantern":
      drawLanternSymbol(ctx, x, y, visual.stroke, scale);
      break;
    case "plus":
      drawPlusSymbol(ctx, x, y, visual.stroke, scale);
      break;
    case "flag":
      drawFlagSymbol(ctx, x, y, visual.stroke, scale);
      break;
    default:
      drawDotSymbol(ctx, x, y, visual.stroke, scale);
      break;
  }
}

function drawFocusRing(ctx, x, y, radius, fillStyle, strokeStyle, lineWidth) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

export function findEntityAtCanvasPoint(doc, viewport, pointX, pointY, radius = 3) {
  const entities = doc.entities || [];
  const tileSize = doc.dimensions.tileSize;

  for (let i = entities.length - 1; i >= 0; i -= 1) {
    const entity = entities[i];
    if (!entity.visible) continue;

    const center = getEntityScreenCenter(entity, tileSize, viewport);
    const hitRadius = (getEntityHitRadius(entity.type) + radius) * viewport.zoom;
    const dx = pointX - center.x;
    const dy = pointY - center.y;

    if (dx * dx + dy * dy <= hitRadius * hitRadius) {
      return i;
    }
  }

  return -1;
}

export function renderEntities(ctx, doc, viewport, interaction) {
  const entities = doc.entities || [];
  const tileSize = doc.dimensions.tileSize;
  const zoomScale = 1 / Math.max(0.001, viewport.zoom);

  ctx.save();
  ctx.translate(viewport.offsetX, viewport.offsetY);
  ctx.scale(viewport.zoom, viewport.zoom);

  for (let i = 0; i < entities.length; i += 1) {
    const entity = entities[i];
    if (!entity.visible) continue;

    const { x, y } = getEntityCenter(entity, tileSize);
    const isSelected = interaction.selectedEntityIndex === i;
    const isHovered = interaction.hoveredEntityIndex === i;
    const visual = getEntityVisual(entity.type);
    const shapeRadius = getShapeRadius(isSelected);
    const outlineWidth = (isSelected ? 2.2 : isHovered ? 1.8 : 1.5) * zoomScale;
    const focusWidth = (isSelected ? 1.4 : 1.1) * zoomScale;

    if (isHovered) {
      drawFocusRing(
        ctx,
        x,
        y,
        shapeRadius + 4.2,
        "rgba(125, 231, 255, 0.14)",
        "rgba(125, 231, 255, 0.48)",
        focusWidth,
      );
    }

    if (isSelected) {
      drawFocusRing(
        ctx,
        x,
        y,
        shapeRadius + 5.8,
        "rgba(255, 179, 71, 0.20)",
        "rgba(255, 179, 71, 0.72)",
        focusWidth,
      );
    }

    drawEntityShape(ctx, visual, x, y, shapeRadius);
    ctx.fillStyle = visual.fill;
    ctx.fill();
    ctx.strokeStyle = isSelected ? "#ffb347" : isHovered ? "#7de7ff" : visual.stroke;
    ctx.lineWidth = outlineWidth;
    ctx.stroke();

    if (visual.key === "lantern") {
      ctx.beginPath();
      ctx.arc(x, y, shapeRadius + 2.6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 209, 102, 0.32)";
      ctx.lineWidth = 1.1 * zoomScale;
      ctx.stroke();
    }

    drawEntitySymbol(ctx, visual, x, y, zoomScale);
  }

  ctx.restore();
}
