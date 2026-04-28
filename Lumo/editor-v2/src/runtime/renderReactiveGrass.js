const PATCH = Object.freeze({
  centerXRatio: 0.58,
  baseYRatio: 0.69,
  width: 300,
  bladeCount: 224,
  minHeight: 20,
  maxHeight: 58,
  windAmp: 9.6,
  reactFar: 170,
  reactMid: 98,
  reactNear: 44,
});

const bladeCache = [];

function seeded(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + ((b - a) * t);
}

function organicHeightProfile(u) {
  const a = Math.sin((u * 1.41 + 0.08) * Math.PI * 2);
  const b = Math.sin((u * 2.57 + 0.33) * Math.PI * 2);
  const c = Math.sin((u * 4.61 + 0.77) * Math.PI * 2);
  const steppedNoise = seeded((Math.floor(u * 16) * 13.11) + 7.9) - 0.5;
  return clamp(0.68 + (a * 0.2) + (b * 0.14) + (c * 0.08) + (steppedNoise * 0.16), 0.48, 1.18);
}

function ensureBlades() {
  if (bladeCache.length > 0) {
    return bladeCache;
  }

  const lane = PATCH.width / PATCH.bladeCount;
  for (let index = 0; index < PATCH.bladeCount; index += 1) {
    const u = (index + 0.5) / PATCH.bladeCount;
    const jitter = (seeded(index * 13.17) - 0.5) * lane * 1.05;
    const phase = seeded(index * 7.61) * Math.PI * 2;
    const profile = organicHeightProfile(u);
    const localHeightNoise = 0.78 + seeded(index * 2.93 + 9.3) * 0.44;
    bladeCache.push({
      u,
      jitter,
      heightMix: clamp01(profile * localHeightNoise),
      thickness: 0.4 + seeded(index * 1.37) * 0.45,
      swayScale: 0.7 + seeded(index * 4.79) * 1,
      phase,
      speed: 0.66 + seeded(index * 5.11) * 1.2,
      tint: 0.7 + seeded(index * 8.03) * 0.33,
      waveOffset: seeded(index * 6.67) * Math.PI * 2,
      waveScale: 0.85 + seeded(index * 12.73) * 0.75,
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
  return { bend: Math.sign(dx || 1) * (t * 0.58), avoid: 0 };
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
  const safeTime = Number.isFinite(time) ? time : 0;
  const timeSec = safeTime * 0.001;

  ctx.save();
  ctx.lineCap = "round";

  for (let index = 0; index < blades.length; index += 1) {
    const blade = blades[index];
    const bx = left + (blade.u * PATCH.width) + blade.jitter;
    const height = lerp(PATCH.minHeight, PATCH.maxHeight, blade.heightMix);

    const travelA = (timeSec * (1.55 * blade.speed)) - (blade.u * 10.2) + blade.waveOffset;
    const travelB = (timeSec * (2.2 * blade.waveScale)) + (blade.u * 14.6) + blade.phase * 0.47;
    const travelC = (timeSec * 0.95) - (blade.u * 7.3) + blade.phase;
    const waveA = Math.sin(travelA);
    const waveB = Math.sin(travelB);
    const waveC = Math.sin(travelC);
    const waveEnvelope = 0.62 + (Math.sin((timeSec * 0.42) + blade.phase * 0.35) * 0.2);
    const windBend = (waveA * 0.56 + waveB * 0.29 + waveC * 0.15) * PATCH.windAmp * blade.swayScale * waveEnvelope;

    const reaction = resolveReaction(bx, patchBaseY, playerX, playerY);
    const midBend = reaction.bend * 14;
    const nearStraighten = reaction.avoid * 0.8;
    const topX = bx + (windBend + midBend) * (1 - nearStraighten);
    const topY = patchBaseY - (height * (1 - (reaction.avoid * 0.2)));

    const alpha = 0.36 + (Math.abs(windBend) * 0.01) + (Math.abs(reaction.bend) * 0.08) + (reaction.avoid * 0.1);
    const gradient = ctx.createLinearGradient(bx, patchBaseY, topX, topY);
    gradient.addColorStop(0, `rgba(22, 52, 29, ${Math.min(1, alpha * 0.92)})`);
    gradient.addColorStop(1, `rgba(${Math.round(130 * blade.tint)}, ${Math.round(220 * blade.tint)}, ${Math.round(136 + blade.tint * 44)}, ${Math.min(1, alpha + 0.13)})`);

    ctx.strokeStyle = gradient;
    ctx.lineWidth = blade.thickness;
    ctx.beginPath();
    ctx.moveTo(bx, patchBaseY);
    ctx.bezierCurveTo(
      bx + (topX - bx) * 0.16,
      patchBaseY - (height * 0.26),
      bx + (topX - bx) * 0.58,
      patchBaseY - (height * 0.74),
      topX,
      topY,
    );
    ctx.stroke();
  }

  ctx.restore();
}
