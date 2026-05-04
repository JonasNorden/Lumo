import { TILE_DEFINITIONS } from "../domain/tiles/tileTypes.js";
import { getDecorVisual } from "../domain/decor/decorVisuals.js";
import { getEntityVisual } from "../domain/entities/entityVisuals.js";
import { getSoundVisual } from "../domain/sound/soundVisuals.js";

const EMPTY_CELL_COLOR = "rgba(17, 24, 40, 0.45)";
const FRAME_COLOR = "rgba(55, 75, 118, 0.8)";

export function renderMinimap(ctx, state) {
  ctx.save();
  try {
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


    const viewport = state.viewport;
    const zoom = Math.max(0.0001, Number(viewport?.zoom) || 0);
    const editorCanvas = document.getElementById("editorCanvas");
    const canvasWidth = editorCanvas?.clientWidth || editorCanvas?.width || 0;
    const canvasHeight = editorCanvas?.clientHeight || editorCanvas?.height || 0;

    if (zoom > 0 && canvasWidth > 0 && canvasHeight > 0) {
      const visibleWorldLeft = -(Number(viewport?.offsetX) || 0) / zoom;
      const visibleWorldTop = -(Number(viewport?.offsetY) || 0) / zoom;
      const visibleWorldWidth = canvasWidth / zoom;
      const visibleWorldHeight = canvasHeight / zoom;

      const worldPixelWidth = width * tileSize;
      const worldPixelHeight = height * tileSize;

      if (worldPixelWidth > 0 && worldPixelHeight > 0) {
        const contentScaleX = contentWidth / worldPixelWidth;
        const contentScaleY = contentHeight / worldPixelHeight;

        const viewportMiniX = originX + visibleWorldLeft * contentScaleX;
        const viewportMiniY = originY + visibleWorldTop * contentScaleY;
        const viewportMiniW = visibleWorldWidth * contentScaleX;
        const viewportMiniH = visibleWorldHeight * contentScaleY;

        const boundsLeft = originX;
        const boundsTop = originY;
        const boundsRight = originX + contentWidth;
        const boundsBottom = originY + contentHeight;

        const clampedLeft = Math.max(boundsLeft, viewportMiniX);
        const clampedTop = Math.max(boundsTop, viewportMiniY);
        const clampedRight = Math.min(boundsRight, viewportMiniX + viewportMiniW);
        const clampedBottom = Math.min(boundsBottom, viewportMiniY + viewportMiniH);
        const clampedWidth = clampedRight - clampedLeft;
        const clampedHeight = clampedBottom - clampedTop;

        if (clampedWidth > 0 && clampedHeight > 0) {
          ctx.save();
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = "rgba(64, 224, 255, 0.22)";
          ctx.strokeStyle = "rgba(170, 247, 255, 0.98)";
          ctx.lineWidth = 2;
          ctx.fillRect(clampedLeft, clampedTop, clampedWidth, clampedHeight);
          ctx.strokeRect(clampedLeft + 0.5, clampedTop + 0.5, Math.max(0, clampedWidth - 1), Math.max(0, clampedHeight - 1));
          ctx.restore();
        }
      }
    }

    return {
      originX,
      originY,
      contentScale,
      width,
      height,
      tileSize,
    };
  } finally {
    ctx.restore();
  }
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
