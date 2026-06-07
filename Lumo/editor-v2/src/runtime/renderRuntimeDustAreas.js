import { generateDustAreaLayout, normalizeDustAreaForEditor } from "../domain/worldAreas.js";

function toFinite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getRuntimeDustParticleOffsetX(particle, timeSeconds = 0) {
  const phase = toFinite(particle?.phase);
  const speed = toFinite(particle?.speed, 0.08);
  return Math.sin(toFinite(timeSeconds) * speed + phase) * toFinite(particle?.driftX);
}

export function getRuntimeDustParticleOffsetY(particle, timeSeconds = 0) {
  const phase = toFinite(particle?.phase);
  const speed = toFinite(particle?.speed, 0.08);
  return Math.sin(toFinite(timeSeconds) * (speed * 0.77) + phase * 1.37) * toFinite(particle?.driftY);
}

export function getRuntimeDustParticleAlpha(particle, timeSeconds = 0) {
  const minAlpha = clamp(toFinite(particle?.alphaMin, 0.02), 0.008, 0.09);
  const maxAlpha = clamp(toFinite(particle?.alphaMax, 0.11), minAlpha + 0.01, 0.18);
  const alphaSpeed = toFinite(particle?.alphaSpeed, 0.09);
  const alphaPhase = toFinite(particle?.alphaPhase, toFinite(particle?.phase));
  const breathe = (Math.sin(toFinite(timeSeconds) * alphaSpeed + alphaPhase) + 1) * 0.5;
  return minAlpha + (maxAlpha - minAlpha) * (breathe * breathe * (3 - 2 * breathe));
}

export function getRuntimeDustParticleColor(particle) {
  return typeof particle?.color === "string" ? particle.color : "rgba(210, 184, 130, 1)";
}

export function renderRuntimeDustAreas(ctx, dustAreas, cameraState, timeSeconds = 0) {
  if (!ctx || typeof ctx.save !== "function" || !Array.isArray(dustAreas) || !dustAreas.length) return 0;
  let rendered = 0;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  for (let areaIndex = 0; areaIndex < dustAreas.length; areaIndex += 1) {
    const area = normalizeDustAreaForEditor(dustAreas[areaIndex], areaIndex);
    if (!area.enabled || !area.visible || area.density <= 0 || area.width <= 0 || area.height <= 0) continue;
    for (const particle of generateDustAreaLayout(area, areaIndex)) {
      const alpha = getRuntimeDustParticleAlpha(particle, timeSeconds);
      const x = toFinite(particle.x) + getRuntimeDustParticleOffsetX(particle, timeSeconds) - toFinite(cameraState?.cameraX);
      const y = toFinite(particle.y) + getRuntimeDustParticleOffsetY(particle, timeSeconds) - toFinite(cameraState?.cameraY);
      const radius = Math.max(0.32, toFinite(particle.radius, 0.8));
      if (alpha <= 0.006) continue;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.fillStyle = getRuntimeDustParticleColor(particle);
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
