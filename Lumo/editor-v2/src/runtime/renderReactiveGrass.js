const PATCH = Object.freeze({
  centerXRatio: 0.5,
  baseYRatio: 0.78,
  width: 220,
  bladeCount: 76,
  minHeight: 18,
  maxHeight: 42,
  windAmp: 6.5,
  reactFar: 150,
  reactMid: 90,
  reactNear: 42,
});

const bladeCache = [];

function seeded(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function lerp(a, b, t) {
  return a + ((b - a) * t);
}

function ensureBlades() {
  if (bladeCache.length > 0) {
    return bladeCache;
  }

  for (let index = 0; index < PATCH.bladeCount; index += 1) {
    const u = (index + 0.5) / PATCH.bladeCount;
    const jitter = (seeded(index * 13.17) - 0.5) * (PATCH.width / PATCH.bladeCount) * 0.75;
    const phase = seeded(index * 7.61) * Math.PI * 2;
    bladeCache.push({
      u,
      jitter,
      heightMix: Math.pow(seeded(index * 2.93 + 9.3), 0.72),
      thickness: 0.35 + seeded(index * 1.37) * 0.35,
      swayScale: 0.65 + seeded(index * 4.79) * 0.75,
      phase,
      speed: 0.6 + seeded(index * 5.11) * 0.95,
      tint: 0.7 + seeded(index * 8.03) * 0.3,
    });
  }

  return bladeCache;
}

function resolveReaction(bx, by, playerX, playerY) {
  if (!Number.isFinite(playerX) || !Number.isFinite(playerY)) {
    return { bend: 0, avoid: 0 };
  }

  const dx = playerX - bx;
  const dy = playerY - by;
  const distance = Math.hypot(dx, dy * 0.55);

  if (distance >= PATCH.reactFar) {
    return { bend: 0, avoid: 0 };
  }

  if (distance <= PATCH.reactNear) {
    const avoid = clamp01(1 - (distance / PATCH.reactNear));
    return { bend: 0, avoid };
  }

  if (distance <= PATCH.reactMid) {
    const t = clamp01(1 - ((distance - PATCH.reactNear) / (PATCH.reactMid - PATCH.reactNear)));
    return { bend: (Math.sign(dx || 1) * t), avoid: 0 };
  }

  const t = clamp01(1 - ((distance - PATCH.reactMid) / (PATCH.reactFar - PATCH.reactMid)));
  return { bend: Math.sign(dx || 1) * (t * 0.55), avoid: 0 };
}

export function renderReactiveGrass(ctx, playerX, playerY, time) {
  if (!ctx || typeof ctx.save !== "function" || !ctx.canvas) {
    return;
  }

  const canvasWidth = Number.isFinite(ctx.canvas.width) ? ctx.canvas.width : 0;
  const canvasHeight = Number.isFinite(ctx.canvas.height) ? ctx.canvas.height : 0;
  if (canvasWidth <= 0 || canvasHeight <= 0) {
    return;
  }

  const blades = ensureBlades();
  const patchCenterX = canvasWidth * PATCH.centerXRatio;
  const patchBaseY = canvasHeight * PATCH.baseYRatio;
  const left = patchCenterX - (PATCH.width * 0.5);
  const timeSec = Number.isFinite(time) ? time * 0.001 : 0;

  ctx.save();
  ctx.lineCap = "round";

  for (let index = 0; index < blades.length; index += 1) {
    const blade = blades[index];
    const bx = left + (blade.u * PATCH.width) + blade.jitter;
    const height = lerp(PATCH.minHeight, PATCH.maxHeight, blade.heightMix);

    const wave = Math.sin((timeSec * blade.speed) + blade.phase);
    const wave2 = Math.sin((timeSec * 2.2) + blade.phase * 0.43);
    const windBend = (wave * 0.72 + wave2 * 0.28) * PATCH.windAmp * blade.swayScale;

    const reaction = resolveReaction(bx, patchBaseY, playerX, playerY);
    const midBend = reaction.bend * 12;
    const nearStraighten = reaction.avoid * 0.78;
    const topX = bx + (windBend + midBend) * (1 - nearStraighten);
    const topY = patchBaseY - (height * (1 - (reaction.avoid * 0.22)));

    const alpha = 0.35 + (Math.abs(windBend) * 0.01) + (Math.abs(reaction.bend) * 0.08) + (reaction.avoid * 0.1);
    const gradient = ctx.createLinearGradient(bx, patchBaseY, topX, topY);
    gradient.addColorStop(0, `rgba(24, 56, 31, ${Math.min(1, alpha * 0.9)})`);
    gradient.addColorStop(1, `rgba(${Math.round(132 * blade.tint)}, ${Math.round(210 * blade.tint)}, ${Math.round(132 + blade.tint * 40)}, ${Math.min(1, alpha + 0.12)})`);

    ctx.strokeStyle = gradient;
    ctx.lineWidth = blade.thickness;
    ctx.beginPath();
    ctx.moveTo(bx, patchBaseY);
    ctx.bezierCurveTo(
      bx + (topX - bx) * 0.18,
      patchBaseY - (height * 0.28),
      bx + (topX - bx) * 0.55,
      patchBaseY - (height * 0.72),
      topX,
      topY,
    );
    ctx.stroke();
  }

  ctx.restore();
}
