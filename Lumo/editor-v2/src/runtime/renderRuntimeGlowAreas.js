import { generateGlowAreaLayout, normalizeGlowAreaForEditor } from "../domain/worldAreas.js";

function toFinite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getRuntimeGlowPointOffsetX(point, timeSeconds = 0) {
  const phase = toFinite(point?.phase);
  const speed = toFinite(point?.speed, 0.02);
  return Math.sin(toFinite(timeSeconds) * speed + phase) * toFinite(point?.driftX);
}

export function getRuntimeGlowPointOffsetY(point, timeSeconds = 0) {
  const phase = toFinite(point?.phase);
  const speed = toFinite(point?.speed, 0.02);
  const float = Math.sin(toFinite(timeSeconds) * (speed * 0.71) + phase * 1.53) * toFinite(point?.driftY);
  const slowRise = Math.sin(toFinite(timeSeconds) * (speed * 0.39) + phase * 0.67) * toFinite(point?.rise, 0.25);
  return float - slowRise;
}

export function getRuntimeGlowPointAlpha(point, timeSeconds = 0) {
  const minAlpha = clamp(toFinite(point?.alphaMin, 0.05), 0.01, 0.24);
  const maxAlpha = clamp(toFinite(point?.alphaMax, 0.22), minAlpha + 0.018, 0.42);
  const alphaSpeed = toFinite(point?.alphaSpeed, 0.03);
  const alphaPhase = toFinite(point?.alphaPhase, toFinite(point?.phase));
  const breathe = (Math.sin(toFinite(timeSeconds) * alphaSpeed + alphaPhase) + 1) * 0.5;
  return minAlpha + (maxAlpha - minAlpha) * (breathe * breathe * (3 - 2 * breathe));
}

export function getRuntimeGlowPointColor(point) {
  return typeof point?.color === "string" ? point.color : "rgba(255, 151, 54, 1)";
}

export function getRuntimeGlowPointAuraColor(point) {
  return typeof point?.auraColor === "string" ? point.auraColor : getRuntimeGlowPointColor(point);
}

export function getRuntimeGlowPointCoreColor(point) {
  return typeof point?.coreColor === "string" ? point.coreColor : "rgba(255, 234, 150, 1)";
}

export function renderRuntimeGlowAreas(ctx, glowAreas, cameraState, timeSeconds = 0) {
  if (!ctx || typeof ctx.save !== "function" || !Array.isArray(glowAreas) || !glowAreas.length) return 0;
  let rendered = 0;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let areaIndex = 0; areaIndex < glowAreas.length; areaIndex += 1) {
    const area = normalizeGlowAreaForEditor(glowAreas[areaIndex], areaIndex);
    if (!area.enabled || !area.visible || area.density <= 0 || area.strength <= 0 || area.width <= 0 || area.height <= 0) continue;
    for (const point of generateGlowAreaLayout(area, areaIndex)) {
      const alpha = getRuntimeGlowPointAlpha(point, timeSeconds);
      const x = toFinite(point.x) + getRuntimeGlowPointOffsetX(point, timeSeconds) - toFinite(cameraState?.cameraX);
      const y = toFinite(point.y) + getRuntimeGlowPointOffsetY(point, timeSeconds) - toFinite(cameraState?.cameraY);
      const radius = Math.max(0.45, toFinite(point.radius, 1));
      const auraRadius = Math.max(radius * 2.4, toFinite(point.auraRadius, radius * 3.1));
      const coreRadius = Math.max(0.35, toFinite(point.coreRadius, radius * 0.46));
      if (alpha <= 0.008) continue;
      ctx.save();
      ctx.globalAlpha *= alpha * 0.52;
      ctx.fillStyle = getRuntimeGlowPointAuraColor(point);
      ctx.beginPath();
      ctx.arc(x, y, auraRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha *= 1.65;
      ctx.fillStyle = getRuntimeGlowPointColor(point);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha *= 1.2;
      ctx.fillStyle = getRuntimeGlowPointCoreColor(point);
      ctx.beginPath();
      ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      rendered += 1;
    }
  }
  ctx.restore();
  return rendered;
}
