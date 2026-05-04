import { TILE_DEFINITIONS } from "../domain/tiles/tileTypes.js";
import { getDecorVisual } from "../domain/decor/decorVisuals.js";
import { getEntityVisual } from "../domain/entities/entityVisuals.js";
import { getSoundVisual } from "../domain/sound/soundVisuals.js";

const EMPTY_CELL_COLOR = "rgba(17, 24, 40, 0.45)";
const VIEWPORT_STROKE_COLOR = "#7fd0ff";
const VIEWPORT_FILL_COLOR = "rgba(64, 190, 255, 0.24)";
const FRAME_COLOR = "rgba(55, 75, 118, 0.8)";

function getEditorViewportSize(minimapCanvas) {
  const editorCanvas = minimapCanvas?.ownerDocument?.getElementById("editorCanvas");
  if (!editorCanvas) return { width: minimapCanvas.width, height: minimapCanvas.height };

  const editorRect = editorCanvas.getBoundingClientRect();
  return {
    width: Math.max(1, editorRect.width || editorCanvas.width || 1),
    height: Math.max(1, editorRect.height || editorCanvas.height || 1),
  };
}

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

  const backgroundCells = doc.background?.base || [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const materialId = backgroundCells[y * width + x];
      if (!materialId) continue;
      ctx.fillStyle = "rgba(62, 76, 108, 0.9)";
      ctx.fillRect(
        Math.floor(originX + x * contentScale),
        Math.floor(originY + y * contentScale),
        Math.max(1, Math.ceil(contentScale)),
        Math.max(1, Math.ceil(contentScale)),
      );
    }
  }

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
    const visual = getEntityVisual(entity.type, entity?.params?.presetId);
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

  const zoom = Math.max(0.0001, Number(state.viewport.zoom) || 1);
  const editorViewport = getEditorViewportSize(canvas);

  const visibleWorldLeft = -state.viewport.offsetX / zoom;
  const visibleWorldTop = -state.viewport.offsetY / zoom;
  const visibleWorldWidth = editorViewport.width / zoom;
  const visibleWorldHeight = editorViewport.height / zoom;

  const worldWidthPx = width * tileSize;
  const worldHeightPx = height * tileSize;
  const minimapScaleX = contentWidth / worldWidthPx;
  const minimapScaleY = contentHeight / worldHeightPx;

  const rawRectX = originX + visibleWorldLeft * minimapScaleX;
  const rawRectY = originY + visibleWorldTop * minimapScaleY;
  const rawRectRight = originX + (visibleWorldLeft + visibleWorldWidth) * minimapScaleX;
  const rawRectBottom = originY + (visibleWorldTop + visibleWorldHeight) * minimapScaleY;

  const boundsLeft = originX;
  const boundsTop = originY;
  const boundsRight = originX + contentWidth;
  const boundsBottom = originY + contentHeight;

  const clampedLeft = Math.max(boundsLeft, Math.min(rawRectX, boundsRight));
  const clampedTop = Math.max(boundsTop, Math.min(rawRectY, boundsBottom));
  const clampedRight = Math.max(boundsLeft, Math.min(rawRectRight, boundsRight));
  const clampedBottom = Math.max(boundsTop, Math.min(rawRectBottom, boundsBottom));

  const viewportRectX = Math.min(clampedLeft, clampedRight);
  const viewportRectY = Math.min(clampedTop, clampedBottom);
  const viewportRectWidth = Math.max(2, Math.abs(clampedRight - clampedLeft));
  const viewportRectHeight = Math.max(2, Math.abs(clampedBottom - clampedTop));

  ctx.fillStyle = VIEWPORT_FILL_COLOR;
  ctx.fillRect(viewportRectX, viewportRectY, viewportRectWidth, viewportRectHeight);
  ctx.strokeStyle = VIEWPORT_STROKE_COLOR;
  ctx.lineWidth = 2;
  ctx.strokeRect(viewportRectX, viewportRectY, viewportRectWidth, viewportRectHeight);

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
