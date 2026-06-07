import { generateDustAreaLayout, normalizeDustAreaForEditor } from "../domain/worldAreas.js";

function toFinite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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
      const phase = toFinite(particle.phase);
      const speed = toFinite(particle.speed, 0.08);
      const t = timeSeconds * speed + phase;
      const driftX = Math.sin(t) * toFinite(particle.driftX);
      const driftY = Math.cos(t * 0.73 + phase * 0.37) * toFinite(particle.driftY);
      const breathe = 0.72 + (Math.sin(t * 0.41 + phase) + 1) * 0.14;
      const x = toFinite(particle.x) + driftX - toFinite(cameraState?.cameraX);
      const y = toFinite(particle.y) + driftY - toFinite(cameraState?.cameraY);
      const radius = Math.max(0.45, toFinite(particle.radius, 1));
      const alpha = Math.max(0, Math.min(0.22, toFinite(particle.alpha, 0.14) * breathe));
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.shadowColor = "rgba(224, 213, 190, 0.28)";
      ctx.shadowBlur = radius * 2.8;
      ctx.fillStyle = "rgba(224, 213, 190, 0.55)";
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
