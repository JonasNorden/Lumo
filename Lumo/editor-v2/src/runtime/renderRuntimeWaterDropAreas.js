import { generateWaterDropAreaLayout, normalizeWaterDropAreaForEditor, resolveWaterDropCollisionY } from "../domain/worldAreas.js";

function toFinite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export function getRuntimeWaterDropY(drop, timeSeconds = 0, collisionRects = []) {
  const sourceY = toFinite(drop?.sourceY);
  const collisionY = resolveWaterDropCollisionY(drop, collisionRects);
  const travel = Math.max(1, collisionY - sourceY);
  const speed = Math.max(1, toFinite(drop?.fallSpeed, 60));
  const cycleSeconds = Math.max(0.32, travel / speed);
  const phase = positiveModulo(toFinite(drop?.phase) + toFinite(timeSeconds) / cycleSeconds, 1);
  return Math.min(collisionY, sourceY + travel * phase);
}

export function renderRuntimeWaterDropAreas(ctx, waterDropAreas, cameraState, timeSeconds = 0, options = {}) {
  if (!ctx || typeof ctx.save !== "function" || !Array.isArray(waterDropAreas) || !waterDropAreas.length) return 0;
  const collisionRects = Array.isArray(options.collisionRects) ? options.collisionRects : [];
  let rendered = 0;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  for (let areaIndex = 0; areaIndex < waterDropAreas.length; areaIndex += 1) {
    const area = normalizeWaterDropAreaForEditor(waterDropAreas[areaIndex], areaIndex);
    if (!area.enabled || !area.visible || area.density <= 0 || area.size <= 0) continue;
    for (const drop of generateWaterDropAreaLayout(area, areaIndex)) {
      const x = toFinite(drop.sourceX) - toFinite(cameraState?.cameraX);
      const y = getRuntimeWaterDropY(drop, timeSeconds, collisionRects) - toFinite(cameraState?.cameraY);
      const radius = Math.max(1, toFinite(drop.radius, 2));
      const length = Math.max(radius * 1.8, toFinite(drop.length, radius * 3));
      ctx.save();
      ctx.globalAlpha *= Math.max(0.08, Math.min(0.72, toFinite(drop.alpha, 0.42)));
      ctx.strokeStyle = "rgba(205, 238, 255, 0.78)";
      ctx.fillStyle = "rgba(177, 222, 246, 0.82)";
      ctx.lineWidth = Math.max(1, radius * 0.65);
      ctx.beginPath();
      ctx.moveTo(x, y - length * 0.5);
      ctx.lineTo(x, y + length * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y + length * 0.48, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      rendered += 1;
    }
  }
  ctx.restore();
  return rendered;
}
