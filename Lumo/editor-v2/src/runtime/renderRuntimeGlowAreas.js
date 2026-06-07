import { generateGlowAreaLayout, normalizeGlowAreaDirection, normalizeGlowAreaForEditor } from "../domain/worldAreas.js";

function toFinite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep01(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export function getRuntimeGlowPointDirection(point) {
  return normalizeGlowAreaDirection(point?.direction, point?.motionMode);
}

export function getRuntimeGlowPointMotionMode(point) {
  return getRuntimeGlowPointDirection(point) === "up" ? "updraft" : "ambient";
}

export function getRuntimeGlowPointTravelPhase(point, timeSeconds = 0) {
  const basePhase = positiveModulo(toFinite(point?.phase), Math.PI * 2) / (Math.PI * 2);
  const speed = toFinite(point?.travelSpeed, 0.014);
  return positiveModulo(basePhase + toFinite(timeSeconds) * speed, 1);
}

export function getRuntimeGlowPointUpdraftPhase(point, timeSeconds = 0) {
  return getRuntimeGlowPointTravelPhase(point, timeSeconds);
}

function getAuthoredSpeedScale(point) {
  return 0.12 + clamp(toFinite(point?.authoredSpeed, 0.35), 0, 1) * 0.88;
}

export function getRuntimeGlowPointOffsetX(point, timeSeconds = 0) {
  const phase = toFinite(point?.phase);
  const speed = toFinite(point?.speed, 0.02);
  const time = toFinite(timeSeconds);
  const driftX = toFinite(point?.driftX);
  const direction = getRuntimeGlowPointDirection(point);
  const speedScale = getAuthoredSpeedScale(point);
  if (direction === "up" || direction === "down") {
    return Math.sin(time * (speed * 1.55) + phase) * driftX * 0.55 * speedScale
      + Math.sin(time * (speed * 0.61) + phase * 2.17) * driftX * 0.22 * speedScale;
  }
  if (direction === "left" || direction === "right") {
    const areaX = toFinite(point?.areaX, toFinite(point?.x));
    const areaWidth = Math.max(1, toFinite(point?.areaWidth, 1));
    const phase01 = getRuntimeGlowPointTravelPhase(point, time);
    const targetX = direction === "right" ? areaX + areaWidth * phase01 : areaX + areaWidth * (1 - phase01);
    const wobble = Math.sin(time * (speed * 0.67) + phase * 1.29) * Math.min(2.4, driftX * 0.34) * speedScale;
    return targetX + wobble - toFinite(point?.x);
  }
  return (Math.sin(time * speed + phase) * driftX
    + Math.sin(time * (speed * 0.43) + phase * 2.31) * driftX * 0.34) * speedScale;
}

export function getRuntimeGlowPointOffsetY(point, timeSeconds = 0) {
  const phase = toFinite(point?.phase);
  const speed = toFinite(point?.speed, 0.02);
  const time = toFinite(timeSeconds);
  const direction = getRuntimeGlowPointDirection(point);
  const speedScale = getAuthoredSpeedScale(point);
  if (direction === "up" || direction === "down") {
    const areaY = toFinite(point?.areaY, toFinite(point?.y));
    const areaHeight = Math.max(1, toFinite(point?.areaHeight, 1));
    const phase01 = getRuntimeGlowPointTravelPhase(point, time);
    const targetY = direction === "down" ? areaY + areaHeight * phase01 : areaY + areaHeight * (1 - phase01);
    const verticalWobble = Math.sin(time * (speed * 0.73) + phase * 1.43) * Math.min(2.2, toFinite(point?.driftY, 1.2) * 0.38) * speedScale;
    return targetY + verticalWobble - toFinite(point?.y);
  }
  if (direction === "left" || direction === "right") {
    return Math.sin(time * (speed * 0.82) + phase * 1.53) * toFinite(point?.driftY) * 0.58 * speedScale
      + Math.sin(time * (speed * 0.31) + phase * 0.67) * toFinite(point?.rise, 0.25) * 1.15 * speedScale;
  }
  const float = Math.sin(time * (speed * 0.71) + phase * 1.53) * toFinite(point?.driftY);
  const irregular = Math.sin(time * (speed * 0.29) + phase * 0.67) * toFinite(point?.rise, 0.25) * 1.9;
  return (float - irregular) * speedScale;
}

export function getRuntimeGlowPointAlpha(point, timeSeconds = 0) {
  const minAlpha = clamp(toFinite(point?.alphaMin, 0.05), 0.01, 0.24);
  const maxAlpha = clamp(toFinite(point?.alphaMax, 0.22), minAlpha + 0.018, 0.42);
  const alphaSpeed = toFinite(point?.alphaSpeed, 0.03);
  const alphaPhase = toFinite(point?.alphaPhase, toFinite(point?.phase));
  const breathe = (Math.sin(toFinite(timeSeconds) * alphaSpeed + alphaPhase) + 1) * 0.5;
  const ambientAlpha = minAlpha + (maxAlpha - minAlpha) * smoothstep01(breathe);
  const direction = getRuntimeGlowPointDirection(point);
  if (direction === "random") return ambientAlpha;
  const phase01 = getRuntimeGlowPointTravelPhase(point, timeSeconds);
  const fadeIn = smoothstep01(phase01 / 0.14);
  const fadeOut = 1 - smoothstep01((phase01 - 0.8) / 0.2);
  return ambientAlpha * clamp(0.12 + fadeIn * fadeOut * 0.88, 0.12, 1);
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
