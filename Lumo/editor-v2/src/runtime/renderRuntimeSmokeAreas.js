import { generateSmokeAreaLayout, normalizeSmokeAreaDirection, normalizeSmokeAreaForEditor } from "../domain/worldAreas.js";

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

export function getRuntimeSmokePuffDirection(puff) {
  return normalizeSmokeAreaDirection(puff?.direction);
}

export function getRuntimeSmokePuffTravelPhase(puff, timeSeconds = 0) {
  const basePhase = positiveModulo(toFinite(puff?.phase), Math.PI * 2) / (Math.PI * 2);
  const speed = toFinite(puff?.travelSpeed, 0.006);
  return positiveModulo(basePhase + toFinite(timeSeconds) * speed, 1);
}

function getAuthoredSpeedScale(puff) {
  return 0.1 + clamp(toFinite(puff?.authoredSpeed, 0.28), 0, 1) * 0.9;
}

export function getRuntimeSmokePuffOffsetX(puff, timeSeconds = 0) {
  const phase = toFinite(puff?.phase);
  const speed = toFinite(puff?.speed, 0.012);
  const time = toFinite(timeSeconds);
  const direction = getRuntimeSmokePuffDirection(puff);
  const speedScale = getAuthoredSpeedScale(puff);
  if (direction === "left" || direction === "right") {
    const areaX = toFinite(puff?.areaX, toFinite(puff?.x));
    const areaWidth = Math.max(1, toFinite(puff?.areaWidth, 1));
    const travelPhase = getRuntimeSmokePuffTravelPhase(puff, time);
    const targetX = direction === "right" ? areaX + areaWidth * travelPhase : areaX + areaWidth * (1 - travelPhase);
    const wobble = Math.sin(time * speed * 0.73 + phase * 1.41) * Math.min(6, toFinite(puff?.driftX) * 0.42) * speedScale;
    return targetX + wobble - toFinite(puff?.x);
  }
  return (Math.sin(time * speed + phase) * toFinite(puff?.driftX) * 0.42
    + Math.sin(time * speed * 0.37 + phase * 2.13) * toFinite(puff?.driftX) * 0.28) * speedScale;
}

export function getRuntimeSmokePuffOffsetY(puff, timeSeconds = 0) {
  const phase = toFinite(puff?.phase);
  const speed = toFinite(puff?.speed, 0.012);
  const time = toFinite(timeSeconds);
  const direction = getRuntimeSmokePuffDirection(puff);
  const speedScale = getAuthoredSpeedScale(puff);
  if (direction === "up" || direction === "down") {
    const areaY = toFinite(puff?.areaY, toFinite(puff?.y));
    const areaHeight = Math.max(1, toFinite(puff?.areaHeight, 1));
    const travelPhase = getRuntimeSmokePuffTravelPhase(puff, time);
    const targetY = direction === "down" ? areaY + areaHeight * travelPhase : areaY + areaHeight * (1 - travelPhase);
    const wobble = Math.sin(time * speed * 0.68 + phase * 1.31) * Math.min(7, toFinite(puff?.driftY) * 0.35) * speedScale;
    return targetY + wobble - toFinite(puff?.y);
  }
  return (Math.sin(time * speed * 0.83 + phase * 1.67) * toFinite(puff?.driftY) * 0.38
    - Math.sin(time * speed * 0.29 + phase * 0.71) * toFinite(puff?.driftY) * 0.2) * speedScale;
}

export function getRuntimeSmokePuffAlpha(puff, timeSeconds = 0) {
  const minAlpha = clamp(toFinite(puff?.alphaMin, 0.018), 0.006, 0.08);
  const maxAlpha = clamp(toFinite(puff?.alphaMax, 0.08), minAlpha + 0.008, 0.18);
  const breathe = (Math.sin(toFinite(timeSeconds) * toFinite(puff?.alphaSpeed, 0.026) + toFinite(puff?.alphaPhase, toFinite(puff?.phase))) + 1) * 0.5;
  const ambientAlpha = minAlpha + (maxAlpha - minAlpha) * smoothstep01(breathe);
  const direction = getRuntimeSmokePuffDirection(puff);
  if (direction === "random") return ambientAlpha;
  const travelPhase = getRuntimeSmokePuffTravelPhase(puff, timeSeconds);
  const fadeIn = smoothstep01(travelPhase / 0.18);
  const fadeOut = 1 - smoothstep01((travelPhase - 0.78) / 0.22);
  return ambientAlpha * clamp(0.18 + fadeIn * fadeOut * 0.82, 0.18, 1);
}

export function getRuntimeSmokePuffColor(puff) {
  return typeof puff?.color === "string" ? puff.color : "rgba(156, 154, 158, 1)";
}

export function renderRuntimeSmokeAreas(ctx, smokeAreas, cameraState, timeSeconds = 0) {
  if (!ctx || typeof ctx.save !== "function" || !Array.isArray(smokeAreas) || !smokeAreas.length) return 0;
  let rendered = 0;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  for (let areaIndex = 0; areaIndex < smokeAreas.length; areaIndex += 1) {
    const area = normalizeSmokeAreaForEditor(smokeAreas[areaIndex], areaIndex);
    if (!area.enabled || !area.visible || area.density <= 0 || area.strength <= 0 || area.width <= 0 || area.height <= 0) continue;
    for (const puff of generateSmokeAreaLayout(area, areaIndex)) {
      const alpha = getRuntimeSmokePuffAlpha(puff, timeSeconds);
      if (alpha <= 0.004) continue;
      const x = toFinite(puff.x) + getRuntimeSmokePuffOffsetX(puff, timeSeconds) - toFinite(cameraState?.cameraX);
      const y = toFinite(puff.y) + getRuntimeSmokePuffOffsetY(puff, timeSeconds) - toFinite(cameraState?.cameraY);
      const radius = Math.max(2.5, toFinite(puff.radius, 14));
      ctx.save();
      ctx.globalAlpha *= alpha;
      const gradient = typeof ctx.createRadialGradient === "function"
        ? ctx.createRadialGradient(x, y, Math.max(1, toFinite(puff.innerRadius, radius * 0.48)), x, y, radius)
        : null;
      if (gradient) {
        gradient.addColorStop(0, getRuntimeSmokePuffColor(puff));
        gradient.addColorStop(0.62, typeof puff?.edgeColor === "string" ? puff.edgeColor : getRuntimeSmokePuffColor(puff));
        gradient.addColorStop(1, "rgba(156, 154, 158, 0)");
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = getRuntimeSmokePuffColor(puff);
      }
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      rendered += 1;
    }
  }
  ctx.restore();
  return rendered;
}
