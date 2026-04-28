const PATCH = Object.freeze({
  worldCenterX: 10.5 * 24,
  worldBaseY: 19 * 24,
  width: 166,
  bladeCount: 416,
  minHeight: 12,
  maxHeight: 84,
  windAmp: 13.5,
  reactFar: 176,
  reactMid: 94,
  reactNear: 36,
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

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - (2 * t));
}

function organicHeightProfile(u) {
  const a = Math.sin((u * 1.19 + 0.08) * Math.PI * 2);
  const b = Math.sin((u * 2.97 + 0.33) * Math.PI * 2);
  const c = Math.sin((u * 5.41 + 0.77) * Math.PI * 2);
  const d = Math.sin((u * 8.07 + 0.18) * Math.PI * 2);
  const steppedNoise = seeded((Math.floor(u * 22) * 13.11) + 7.9) - 0.5;
  return clamp(0.6 + (a * 0.25) + (b * 0.19) + (c * 0.13) + (d * 0.08) + (steppedNoise * 0.24), 0.18, 1.28);
}

function ensureBlades() {
  if (bladeCache.length > 0) {
    return bladeCache;
  }

  const lane = PATCH.width / PATCH.bladeCount;
  for (let index = 0; index < PATCH.bladeCount; index += 1) {
    const u = (index + 0.5) / PATCH.bladeCount;
    const jitter = (seeded(index * 13.17) - 0.5) * lane * 1.45;
    const phase = seeded(index * 7.61) * Math.PI * 2;
    const profile = organicHeightProfile(u);
    const localHeightNoise = 0.48 + seeded(index * 2.93 + 9.3) * 0.85;
    bladeCache.push({
      u,
      jitter,
      heightMix: clamp01(profile * localHeightNoise),
      thickness: 0.5 + seeded(index * 1.37) * 0.8,
      swayScale: 0.62 + seeded(index * 4.79) * 1.28,
      phase,
      speed: 0.58 + seeded(index * 5.11) * 1.45,
      tint: 0.62 + seeded(index * 8.03) * 0.36,
      waveOffset: seeded(index * 6.67) * Math.PI * 2,
      waveScale: 0.75 + seeded(index * 12.73) * 0.88,
      layer: seeded(index * 15.19),
      lean: (seeded(index * 3.41) - 0.5) * 3.2,
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
  const distance = Math.hypot(dx, dy * 0.52);

  if (distance >= PATCH.reactFar) {
    return { bend: 0, avoid: 0 };
  }

  if (distance <= PATCH.reactNear) {
    const avoid = clamp01(1 - (distance / PATCH.reactNear));
    return { bend: 0, avoid };
  }

  if (distance <= PATCH.reactMid) {
    const t = clamp01(1 - ((distance - PATCH.reactNear) / (PATCH.reactMid - PATCH.reactNear)));
    return { bend: (Math.sign(dx || 1) * t * 1.18), avoid: 0 };
  }

  const t = clamp01(1 - ((distance - PATCH.reactMid) / (PATCH.reactFar - PATCH.reactMid)));
  return { bend: Math.sign(dx || 1) * (t * 0.64), avoid: 0 };
}

function resolveCanvasPoint(mapper, x, y) {
  if (!mapper || typeof mapper.worldToCanvasRect !== "function") {
    return { x, y };
  }
  const rect = mapper.worldToCanvasRect(x, y, 1, 1);
  return {
    x: rect.x + (rect.w * 0.5),
    y: rect.y + (rect.h * 0.5),
  };
}

export function renderReactiveGrass(ctx, playerX, playerY, time, options = {}) {
  if (!ctx || typeof ctx.save !== "function" || !ctx.canvas) {
    return;
  }

  const mapper = options && typeof options === "object" ? options.mapper : null;
  const patchCenterX = Number.isFinite(options?.patchCenterX) ? options.patchCenterX : PATCH.worldCenterX;
  const patchBaseY = Number.isFinite(options?.patchBaseY) ? options.patchBaseY : PATCH.worldBaseY;
  const safeTime = Number.isFinite(time) ? time : 0;
  const timeSec = safeTime * 0.001;
  const blades = ensureBlades();
  const left = patchCenterX - (PATCH.width * 0.5);

  ctx.save();
  ctx.lineCap = "round";

  for (let pass = 0; pass < 2; pass += 1) {
    for (let index = 0; index < blades.length; index += 1) {
      const blade = blades[index];
      const layerOffset = pass === 0 ? -2.4 : 0;
      const bx = left + (blade.u * PATCH.width) + blade.jitter + blade.lean + (blade.layer - 0.5) * 2.6;
      const by = patchBaseY + layerOffset;
      const heightMix = clamp01((blade.heightMix * 0.78) + (blade.layer * 0.22));
      const height = lerp(PATCH.minHeight, PATCH.maxHeight, heightMix);

      const travelA = (timeSec * (1.63 * blade.speed)) - (blade.u * 11.6) + blade.waveOffset;
      const travelB = (timeSec * (2.28 * blade.waveScale)) + (blade.u * 16.1) + blade.phase * 0.47;
      const travelC = (timeSec * 0.86) - (blade.u * 8.4) + blade.phase;
      const waveA = Math.sin(travelA);
      const waveB = Math.sin(travelB);
      const waveC = Math.sin(travelC);
      const waveEnvelope = 0.7 + (Math.sin((timeSec * 0.37) + blade.phase * 0.35) * 0.24);

      const gustSignalA = Math.sin((timeSec * 0.079) + 0.91);
      const gustSignalB = Math.sin((timeSec * 0.121) + 1.73);
      const gustSignalC = Math.sin((timeSec * 0.051) + blade.phase * 0.45 + 0.27);
      const gustSignal = (gustSignalA * 0.44) + (gustSignalB * 0.37) + (gustSignalC * 0.19);
      const gustRaw = smoothstep(0.46, 0.92, gustSignal);
      const gustEnvelope = gustRaw * (1 - smoothstep(0.84, 1.0, gustRaw));
      const gustTravel = Math.sin((timeSec * 3.22) - (blade.u * 22.7) + blade.waveOffset + blade.phase * 0.58);
      const gustBend = gustTravel * PATCH.windAmp * 0.95 * blade.swayScale * blade.waveScale * gustEnvelope;

      const windBend = ((waveA * 0.54 + waveB * 0.31 + waveC * 0.15) * PATCH.windAmp * blade.swayScale * waveEnvelope) + gustBend;

      const reaction = resolveReaction(bx, by, playerX, playerY);
      const midBend = reaction.bend * 18;
      const nearStraighten = reaction.avoid * 0.82;
      const topXWorld = bx + (windBend + midBend) * (1 - nearStraighten);
      const topYWorld = by - (height * (1 - (reaction.avoid * 0.24)));

      const basePt = resolveCanvasPoint(mapper, bx, by);
      const topPt = resolveCanvasPoint(mapper, topXWorld, topYWorld);

      const alpha = (pass === 0 ? 0.26 : 0.42) + (Math.abs(windBend) * 0.007) + (Math.abs(reaction.bend) * 0.09) + (reaction.avoid * 0.1);
      const gradient = ctx.createLinearGradient(basePt.x, basePt.y, topPt.x, topPt.y);
      gradient.addColorStop(0, `rgba(18, 46, 25, ${Math.min(1, alpha * 0.88)})`);
      gradient.addColorStop(1, `rgba(${Math.round(120 * blade.tint)}, ${Math.round(212 * blade.tint)}, ${Math.round(128 + blade.tint * 56)}, ${Math.min(1, alpha + 0.16)})`);

      ctx.strokeStyle = gradient;
      ctx.lineWidth = blade.thickness * (pass === 0 ? 0.82 : 1);
      ctx.beginPath();
      ctx.moveTo(basePt.x, basePt.y);
      ctx.bezierCurveTo(
        basePt.x + (topPt.x - basePt.x) * 0.15,
        basePt.y - (Math.abs(basePt.y - topPt.y) * 0.26),
        basePt.x + (topPt.x - basePt.x) * 0.58,
        basePt.y - (Math.abs(basePt.y - topPt.y) * 0.74),
        topPt.x,
        topPt.y,
      );
      ctx.stroke();
    }
  }

  ctx.restore();
}
