import { TILE_DEFINITIONS } from "../domain/tiles/tileTypes.js";
import { getDecorVisual } from "../domain/decor/decorVisuals.js";
import { getEntityVisual } from "../domain/entities/entityVisuals.js";
import { getSoundVisual } from "../domain/sound/soundVisuals.js";

const EMPTY_CELL_COLOR = "rgba(17, 24, 40, 0.45)";
const VIEWPORT_STROKE_COLOR = "#b2c7ff";
const VIEWPORT_FILL_COLOR = "rgba(93, 125, 214, 0.2)";
const FRAME_COLOR = "rgba(55, 75, 118, 0.8)";

export function renderMinimap(ctx, state) {
  const canvas = ctx.canvas;
  const rect = canvas.getBoundingClientRect();
  const viewWidth = rect.width || canvas.width;
  const viewHeight = rect.height || canvas.height;
  const doc = state.document.active;

  ctx.clearRect(0, 0, viewWidth, viewHeight);
  ctx.fillStyle = "#0a0f1d";
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  if (!doc) return null;

  const { width, height, tileSize } = doc.dimensions;
  const contentScale = Math.min(viewWidth / width, viewHeight / height);
  const contentWidth = width * contentScale;
  const contentHeight = height * contentScale;
  const originX = (viewWidth - contentWidth) * 0.5;
  const originY = (viewHeight - contentHeight) * 0.5;
  const tiles = doc.tiles.base;

  for (const decor of doc.decor || []) {
    if (!decor?.visible) continue;
    const visual = getDecorVisual(decor.type);
    ctx.fillStyle = visual.stroke;
    ctx.fillRect(
      Math.floor(originX + decor.x * contentScale),
      Math.floor(originY + decor.y * contentScale),
      Math.max(2, Math.ceil(contentScale)),
      Math.max(2, Math.ceil(contentScale)),
    );
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = tiles[y * width + x];
      ctx.fillStyle = tile ? TILE_DEFINITIONS[tile]?.color || "#8f9bb4" : EMPTY_CELL_COLOR;
      ctx.fillRect(
        Math.floor(originX + x * contentScale),
        Math.floor(originY + y * contentScale),
        Math.ceil(contentScale),
        Math.ceil(contentScale),
      );
    }
  }

  for (const entity of doc.entities || []) {
    if (!entity?.visible) continue;
    const visual = getEntityVisual(entity.type);
    ctx.fillStyle = visual.stroke;
    ctx.fillRect(
      Math.floor(originX + entity.x * contentScale),
      Math.floor(originY + entity.y * contentScale),
      Math.max(2, Math.ceil(contentScale)),
      Math.max(2, Math.ceil(contentScale)),
    );
  }

  for (const sound of doc.sounds || []) {
    if (!sound?.visible) continue;
    const visual = getSoundVisual(sound.type);
    const widthScale = Math.max(1, Math.ceil((Number(sound?.params?.width) || 1) * contentScale));
    const heightScale = Math.max(1, Math.ceil((Number(sound?.params?.height) || 1) * contentScale));
    ctx.fillStyle = visual.stroke;
    if (sound.type === "ambientZone" || sound.type === "musicZone") {
      ctx.fillRect(
        Math.floor(originX + sound.x * contentScale),
        Math.floor(originY + sound.y * contentScale),
        widthScale,
        heightScale,
      );
    } else {
      ctx.fillRect(
        Math.floor(originX + sound.x * contentScale),
        Math.floor(originY + sound.y * contentScale),
        Math.max(2, Math.ceil(contentScale)),
        Math.max(2, Math.ceil(contentScale)),
      );
    }
  }

  ctx.strokeStyle = FRAME_COLOR;
  ctx.strokeRect(Math.floor(originX) + 0.5, Math.floor(originY) + 0.5, Math.round(contentWidth), Math.round(contentHeight));

  const viewportCellSize = tileSize * state.viewport.zoom;
  const viewportWorldX = -state.viewport.offsetX;
  const viewportWorldY = -state.viewport.offsetY;
  const viewportWorldWidth = viewWidth / viewportCellSize;
  const viewportWorldHeight = viewHeight / viewportCellSize;

  const viewportRectX = originX + (viewportWorldX / tileSize) * contentScale;
  const viewportRectY = originY + (viewportWorldY / tileSize) * contentScale;
  const viewportRectWidth = (viewportWorldWidth / tileSize) * contentScale;
  const viewportRectHeight = (viewportWorldHeight / tileSize) * contentScale;

  ctx.fillStyle = VIEWPORT_FILL_COLOR;
  ctx.fillRect(viewportRectX, viewportRectY, viewportRectWidth, viewportRectHeight);
  ctx.strokeStyle = VIEWPORT_STROKE_COLOR;
  ctx.lineWidth = 1;
  ctx.strokeRect(viewportRectX + 0.5, viewportRectY + 0.5, Math.max(0, viewportRectWidth - 1), Math.max(0, viewportRectHeight - 1));

  return {
    originX,
    originY,
    contentScale,
    width,
    height,
    tileSize,
  };
}

export function getWorldPointFromMinimapPoint(layout, pointX, pointY) {
  if (!layout) return null;

  const localX = pointX - layout.originX;
  const localY = pointY - layout.originY;

  if (localX < 0 || localY < 0 || localX > layout.width * layout.contentScale || localY > layout.height * layout.contentScale) {
    return null;
  }

  return {
    x: (localX / layout.contentScale) * layout.tileSize,
    y: (localY / layout.contentScale) * layout.tileSize,
  };
}
