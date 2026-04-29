const DEFAULT_BLOOM_PATCH = Object.freeze({
  id: "reactive_bloom_patch_default",
  kind: "reactive_bloom_plant",
  x: (15.3 * 24),
  y: (18.4 * 24),
  stems: 6,
  spread: 96,
  stemHeightMin: 30,
  stemHeightMax: 52,
  bloomRadiusMin: 11,
  bloomRadiusMax: 18,
  reactFar: 222,
  reactMid: 132,
  reactNear: 62,
  stemBaseColor: "#143726",
  stemTopColor: "#8fe0b4",
  petalInnerColor: "#ffd4f2",
  petalOuterColor: "#a05de2",
  seed: 29017,
});

const bloomCacheByPatch = new Map();

function seeded(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + ((b - a) * t); }

function parseColorHex(value, fallback) {
  const source = typeof value === "string" ? value.trim() : "";
  const normalized = /^#[0-9a-fA-F]{6}$/.test(source) ? source : fallback;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function resolveCanvasPoint(mapper, x, y) {
  if (!mapper || typeof mapper.worldToCanvasRect !== "function") return { x, y };
  const rect = mapper.worldToCanvasRect(x, y, 1, 1);
  return { x: rect.x + rect.w * 0.5, y: rect.y + rect.h * 0.5 };
}

function normalizePatch(patch) {
  const source = patch && typeof patch === "object" ? patch : DEFAULT_BLOOM_PATCH;
  return {
    ...DEFAULT_BLOOM_PATCH,
    ...source,
    x: Number.isFinite(source.x) ? Number(source.x) : DEFAULT_BLOOM_PATCH.x,
    y: Number.isFinite(source.y) ? Number(source.y) : DEFAULT_BLOOM_PATCH.y,
    stems: Number.isFinite(source.stems) ? clamp(Math.round(source.stems), 3, 14) : DEFAULT_BLOOM_PATCH.stems,
    spread: Number.isFinite(source.spread) ? clamp(source.spread, 22, 160) : DEFAULT_BLOOM_PATCH.spread,
    stemHeightMin: Number.isFinite(source.stemHeightMin) ? clamp(source.stemHeightMin, 10, 80) : DEFAULT_BLOOM_PATCH.stemHeightMin,
    stemHeightMax: Number.isFinite(source.stemHeightMax) ? clamp(source.stemHeightMax, 12, 96) : DEFAULT_BLOOM_PATCH.stemHeightMax,
    bloomRadiusMin: Number.isFinite(source.bloomRadiusMin) ? clamp(source.bloomRadiusMin, 4, 20) : DEFAULT_BLOOM_PATCH.bloomRadiusMin,
    bloomRadiusMax: Number.isFinite(source.bloomRadiusMax) ? clamp(source.bloomRadiusMax, 5, 24) : DEFAULT_BLOOM_PATCH.bloomRadiusMax,
  };
}

function ensurePatchCache(patch) {
  const key = [patch.id, patch.seed, patch.stems, patch.spread, patch.stemHeightMin, patch.stemHeightMax].join("|");
  const cached = bloomCacheByPatch.get(key);
  if (Array.isArray(cached) && cached.length > 0) return cached;

  const stems = [];
  for (let i = 0; i < patch.stems; i += 1) {
    const u = patch.stems <= 1 ? 0.5 : (i / (patch.stems - 1));
    const xNoise = (seeded(patch.seed + i * 5.17) - 0.5) * 12;
    const lean = (seeded(patch.seed + i * 7.33) - 0.5) * 7;
    stems.push({
      u,
      xNoise,
      lean,
      phase: seeded(patch.seed + i * 2.13) * Math.PI * 2,
      speed: 0.55 + seeded(patch.seed + i * 9.51) * 0.95,
      swayScale: 0.65 + seeded(patch.seed + i * 3.27) * 0.9,
      bloomBias: seeded(patch.seed + i * 11.43),
      thickness: 1.4 + seeded(patch.seed + i * 1.37) * 1.4,
      petalCount: 5 + Math.round(seeded(patch.seed + i * 4.77) * 2),
    });
  }

  bloomCacheByPatch.set(key, stems);
  return stems;
}

function proximityFactor(patch, wx, wy, playerX, playerY) {
  if (!Number.isFinite(playerX) || !Number.isFinite(playerY)) return { near: 0, mid: 0, presenceX: 0 };
  const dx = playerX - wx;
  const dy = (playerY - wy) * 0.58;
  const dist = Math.hypot(dx, dy);

  const farT = 1 - clamp01((dist - patch.reactMid) / Math.max(1, patch.reactFar - patch.reactMid));
  const midT = 1 - clamp01((dist - patch.reactNear) / Math.max(1, patch.reactMid - patch.reactNear));
  const nearT = 1 - clamp01(dist / Math.max(1, patch.reactNear));

  return {
    near: clamp01(nearT),
    mid: clamp01(Math.max(midT, farT * 0.35)),
    presenceX: clamp(dx / Math.max(1, patch.reactFar), -1, 1),
  };
}

export function renderReactiveBloomPlants(ctx, playerX, playerY, time, options = {}) {
  if (!ctx || typeof ctx.save !== "function" || !ctx.canvas) return;

  const mapper = options && typeof options === "object" ? options.mapper : null;
  const patch = normalizePatch(options?.patch);
  const stems = ensurePatchCache(patch);
  const timeSec = (Number.isFinite(time) ? time : 0) * 0.001;

  const stemBaseColor = parseColorHex(patch.stemBaseColor, DEFAULT_BLOOM_PATCH.stemBaseColor);
  const stemTopColor = parseColorHex(patch.stemTopColor, DEFAULT_BLOOM_PATCH.stemTopColor);
  const petalInnerColor = parseColorHex(patch.petalInnerColor, DEFAULT_BLOOM_PATCH.petalInnerColor);
  const petalOuterColor = parseColorHex(patch.petalOuterColor, DEFAULT_BLOOM_PATCH.petalOuterColor);

  ctx.save();
  ctx.lineCap = "round";

  for (const stem of stems) {
    const wx = patch.x - patch.spread * 0.5 + stem.u * patch.spread + stem.xNoise;
    const wy = patch.y;
    const prox = proximityFactor(patch, wx, wy, playerX, playerY);

    const breathe = Math.sin((timeSec * (0.7 + stem.speed * 0.3)) + stem.phase);
    const idleOpen = 0.27 + (breathe * 0.08);
    const reactiveOpen = (prox.mid * 0.44) + (prox.near * 0.56);
    const bloomOpen = clamp01(idleOpen + reactiveOpen + (stem.bloomBias - 0.5) * 0.05);

    const height = lerp(patch.stemHeightMin, patch.stemHeightMax, stem.bloomBias);
    const sway = Math.sin((timeSec * (1.02 + stem.speed * 0.8)) + stem.phase) * stem.swayScale * 2.3;
    const turn = prox.presenceX * (1.8 + prox.mid * 3.6 + prox.near * 6.4);

    const basePt = resolveCanvasPoint(mapper, wx, wy);
    const tipWorldX = wx + stem.lean + sway + turn;
    const tipWorldY = wy - (height * (1 - prox.near * 0.08));
    const tipPt = resolveCanvasPoint(mapper, tipWorldX, tipWorldY);

    const stemGradient = ctx.createLinearGradient(basePt.x, basePt.y, tipPt.x, tipPt.y);
    stemGradient.addColorStop(0, `rgba(${stemBaseColor.r},${stemBaseColor.g},${stemBaseColor.b},0.62)`);
    stemGradient.addColorStop(1, `rgba(${stemTopColor.r},${stemTopColor.g},${stemTopColor.b},0.75)`);
    ctx.strokeStyle = stemGradient;
    ctx.lineWidth = stem.thickness;
    ctx.beginPath();
    ctx.moveTo(basePt.x, basePt.y);
    ctx.quadraticCurveTo((basePt.x + tipPt.x) * 0.5 + sway * 0.55, (basePt.y + tipPt.y) * 0.45, tipPt.x, tipPt.y);
    ctx.stroke();

    const bloomRadius = lerp(patch.bloomRadiusMin, patch.bloomRadiusMax, 0.45 + stem.bloomBias * 0.55);
    const petalCount = stem.petalCount;
    const openAngle = lerp(0.11, 1.18, bloomOpen);
    const openTilt = lerp(0.78, 1.04, bloomOpen);

    for (let p = 0; p < petalCount; p += 1) {
      const petalT = p / petalCount;
      const baseAngle = (petalT * Math.PI * 2) + stem.phase * 0.12;
      const jitter = (seeded(patch.seed + p * 17.1 + stem.u * 91.7) - 0.5) * 0.28;
      const petalAngle = baseAngle + jitter;
      const petalLen = bloomRadius * (0.85 + seeded(patch.seed + p * 3.7 + stem.u * 13.5) * 0.45);
      const spread = openAngle * (0.64 + seeded(patch.seed + p * 7.4 + stem.u * 41.4) * 0.48);
      const widthScale = 0.36 + bloomOpen * 0.26;

      const ctrlX = tipPt.x + Math.cos(petalAngle) * petalLen * spread;
      const ctrlY = tipPt.y + Math.sin(petalAngle) * petalLen * spread * openTilt;
      const edgeX = tipPt.x + Math.cos(petalAngle) * petalLen;
      const edgeY = tipPt.y + Math.sin(petalAngle) * petalLen * (0.92 + bloomOpen * 0.12);

      const petalGradient = ctx.createLinearGradient(tipPt.x, tipPt.y, edgeX, edgeY);
      petalGradient.addColorStop(0, `rgba(${petalInnerColor.r},${petalInnerColor.g},${petalInnerColor.b},0.78)`);
      petalGradient.addColorStop(1, `rgba(${petalOuterColor.r},${petalOuterColor.g},${petalOuterColor.b},0.62)`);

      ctx.fillStyle = petalGradient;
      ctx.beginPath();
      ctx.moveTo(tipPt.x, tipPt.y);
      ctx.quadraticCurveTo(ctrlX, ctrlY, edgeX, edgeY);
      ctx.quadraticCurveTo(
        ctrlX + Math.cos(petalAngle + Math.PI * 0.5) * (petalLen * widthScale),
        ctrlY + Math.sin(petalAngle + Math.PI * 0.5) * (petalLen * (widthScale * 0.8)),
        tipPt.x,
        tipPt.y,
      );
      ctx.fill();
    }

    const coreR = 1.8 + bloomOpen * 2.25;
    const coreGradient = ctx.createRadialGradient(tipPt.x, tipPt.y, 0, tipPt.x, tipPt.y, coreR * 2.2);
    coreGradient.addColorStop(0, "rgba(255, 228, 168, 0.9)");
    coreGradient.addColorStop(1, "rgba(255, 228, 168, 0)");
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(tipPt.x, tipPt.y, coreR * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
