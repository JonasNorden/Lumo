const DEFAULT_PATCH = Object.freeze({
  id: "reactive_grass_default",
  kind: "reactive_grass",
  x: 10.5 * 24,
  y: 19 * 24,
  width: 166,
  density: 416,
  heightMin: 12,
  heightMax: 84,
  heightProfile: "organic_wave",
  heightVariation: 1,
  baseColor: "#12391f",
  topColor: "#7fd66b",
  variant: "lush_default",
  seed: 12345,
  windAmp: 13.5,
  reactFar: 176,
  reactMid: 94,
  reactNear: 36,
});

const bladeCacheByPatch = new Map();

const activeGrassGusts = [];
let lastGrassGustTimeSec = null;

function spawnOrganicGrassGust(patch, timeSec) {
  const dir = seeded(patch.seed + timeSec * 3.17) < 0.5 ? -1 : 1;
  const gustSeed = patch.seed + timeSec * 19.91 + activeGrassGusts.length * 7.13;

  activeGrassGusts.push({
    patchId: patch.id,
    dir,
    t: 0,
    life: 2.2 + seeded(gustSeed + 1.1) * 1.8,
    speed: 90 + seeded(gustSeed + 2.2) * 120,
    width: 130 + seeded(gustSeed + 3.3) * 190,
    strength: (0.45 + seeded(gustSeed + 4.4) * 0.75) * dir,
    startX: dir > 0
      ? patch.x - patch.width * 0.5 - 160 - seeded(gustSeed + 5.5) * 130
      : patch.x + patch.width * 0.5 + 160 + seeded(gustSeed + 5.5) * 130,
    wobble: seeded(gustSeed + 6.6) * Math.PI * 2,
  });
}

function updateOrganicGrassGusts(patches, timeSec) {
  const dt = lastGrassGustTimeSec == null ? 1 / 60 : clamp(timeSec - lastGrassGustTimeSec, 0, 0.07);
  lastGrassGustTimeSec = timeSec;

  const chance = 0.012 + 0.006 * Math.sin(timeSec * 0.17);

  for (const patch of patches) {
    if (seeded(patch.seed + Math.floor(timeSec * 60) * 0.37) < chance) {
      spawnOrganicGrassGust(patch, timeSec);
    }
  }

  for (const gust of activeGrassGusts) {
    gust.t += dt;
  }

  for (let i = activeGrassGusts.length - 1; i >= 0; i -= 1) {
    if (activeGrassGusts[i].t > activeGrassGusts[i].life) {
      activeGrassGusts.splice(i, 1);
    }
  }
}

function organicGrassGustAt(patch, bx, bladeIndex, timeSec) {
  let force = 0;

  for (const gust of activeGrassGusts) {
    if (gust.patchId !== patch.id) continue;

    const waveX = gust.startX + gust.dir * gust.speed * gust.t;
    const distance = Math.abs(bx - waveX);
    const local = clamp01(1 - distance / gust.width);

    if (local <= 0) continue;

    const envelope = Math.sin(clamp01(gust.t / gust.life) * Math.PI);
    const micro = 0.72 + 0.38 * Math.sin(timeSec * 1.1 + bladeIndex * 0.27 + gust.wobble);

    force += gust.strength * local * local * envelope * micro;
  }

  return force;
}

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

function parseColorHex(value, fallback) {
  const source = typeof value === "string" ? value.trim() : "";
  const normalized = /^#[0-9a-fA-F]{6}$/.test(source) ? source : fallback;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function organicHeightProfile(profile, u, seedOffset) {
  if (profile !== "organic_wave") {
    const rolled = seeded(seedOffset + (u * 29.73));
    return clamp(0.62 + (rolled - 0.5) * 0.32, 0.18, 1.28);
  }

  const a = Math.sin((u * 1.19 + 0.08) * Math.PI * 2);
  const b = Math.sin((u * 2.97 + 0.33) * Math.PI * 2);
  const c = Math.sin((u * 5.41 + 0.77) * Math.PI * 2);
  const d = Math.sin((u * 8.07 + 0.18) * Math.PI * 2);
  const steppedNoise = seeded(seedOffset + (Math.floor(u * 22) * 13.11) + 7.9) - 0.5;
  return clamp(0.6 + (a * 0.25) + (b * 0.19) + (c * 0.13) + (d * 0.08) + (steppedNoise * 0.24), 0.18, 1.28);
}

function normalizePatch(patch, index, options) {
  const seedBase = Number.isFinite(patch?.seed) ? patch.seed : (DEFAULT_PATCH.seed + index * 1009);
  return {
    id: typeof patch?.id === "string" && patch.id.trim() ? patch.id.trim() : `reactive_grass_patch_${index + 1}`,
    kind: "reactive_grass",
    x: Number.isFinite(patch?.x) ? Number(patch.x) : (Number.isFinite(options?.patchCenterX) ? Number(options.patchCenterX) : DEFAULT_PATCH.x),
    y: Number.isFinite(patch?.y) ? Number(patch.y) : (Number.isFinite(options?.patchBaseY) ? Number(options.patchBaseY) : DEFAULT_PATCH.y),
    width: Number.isFinite(patch?.width) && patch.width > 0 ? Number(patch.width) : DEFAULT_PATCH.width,
    density: Number.isFinite(patch?.density) && patch.density > 0 ? Math.max(8, Math.round(patch.density)) : DEFAULT_PATCH.density,
    heightMin: Number.isFinite(patch?.heightMin) ? Number(patch.heightMin) : DEFAULT_PATCH.heightMin,
    heightMax: Number.isFinite(patch?.heightMax) ? Number(patch.heightMax) : DEFAULT_PATCH.heightMax,
    heightProfile: typeof patch?.heightProfile === "string" ? patch.heightProfile.trim().toLowerCase() : DEFAULT_PATCH.heightProfile,
    heightVariation: Number.isFinite(patch?.heightVariation) ? clamp01(Number(patch.heightVariation)) : DEFAULT_PATCH.heightVariation,
    baseColor: typeof patch?.baseColor === "string" ? patch.baseColor : DEFAULT_PATCH.baseColor,
    topColor: typeof patch?.topColor === "string" ? patch.topColor : DEFAULT_PATCH.topColor,
    seed: seedBase,
    windAmp: Number.isFinite(patch?.windAmp) ? Number(patch.windAmp) : DEFAULT_PATCH.windAmp,
    reactFar: Number.isFinite(patch?.reactFar) ? Number(patch.reactFar) : DEFAULT_PATCH.reactFar,
    reactMid: Number.isFinite(patch?.reactMid) ? Number(patch.reactMid) : DEFAULT_PATCH.reactMid,
    reactNear: Number.isFinite(patch?.reactNear) ? Number(patch.reactNear) : DEFAULT_PATCH.reactNear,
  };
}

function buildPatchCacheKey(patch) {
  return [
    patch.id,
    patch.seed,
    patch.width,
    patch.density,
    patch.heightMin,
    patch.heightMax,
    patch.heightProfile,
    patch.heightVariation,
  ].join("|");
}

function ensureBladesForPatch(patch) {
  const cacheKey = buildPatchCacheKey(patch);
  const cached = bladeCacheByPatch.get(cacheKey);
  if (Array.isArray(cached) && cached.length > 0) {
    return cached;
  }

  const blades = [];
  const lane = patch.width / patch.density;
  for (let index = 0; index < patch.density; index += 1) {
    const u = (index + 0.5) / patch.density;
    const jitter = (seeded(patch.seed + index * 13.17) - 0.5) * lane * 1.45;
    const phase = seeded(patch.seed + index * 7.61) * Math.PI * 2;
    const profile = organicHeightProfile(patch.heightProfile, u, patch.seed * 0.00137);
    const profileBase = clamp01((profile - 0.18) / (1.28 - 0.18));
    const profiled = clamp01(lerp(0.5, profileBase, patch.heightVariation));
    const localHeightNoise = 0.48 + seeded(patch.seed + index * 2.93 + 9.3) * 0.85;
    blades.push({
      u,
      jitter,
      heightMix: clamp01(profiled * localHeightNoise),
      thickness: 0.5 + seeded(patch.seed + index * 1.37) * 0.8,
      swayScale: 0.62 + seeded(patch.seed + index * 4.79) * 1.28,
      phase,
      speed: 0.58 + seeded(patch.seed + index * 5.11) * 1.45,
      tint: 0.62 + seeded(patch.seed + index * 8.03) * 0.36,
      waveOffset: seeded(patch.seed + index * 6.67) * Math.PI * 2,
      waveScale: 0.75 + seeded(patch.seed + index * 12.73) * 0.88,
      layer: seeded(patch.seed + index * 15.19),
      lean: (seeded(patch.seed + index * 3.41) - 0.5) * 3.2,
    });
  }

  bladeCacheByPatch.set(cacheKey, blades);
  return blades;
}

function resolveReaction(patch, bx, by, playerX, playerY) {
  if (!Number.isFinite(playerX) || !Number.isFinite(playerY)) {
    return { bend: 0, avoid: 0 };
  }

  const dx = playerX - bx;
  const dy = playerY - by;
  const distance = Math.hypot(dx, dy * 0.52);

  if (distance >= patch.reactFar) {
    return { bend: 0, avoid: 0 };
  }

  if (distance <= patch.reactNear) {
    const avoid = clamp01(1 - (distance / patch.reactNear));
    return { bend: 0, avoid };
  }

  if (distance <= patch.reactMid) {
    const t = clamp01(1 - ((distance - patch.reactNear) / (patch.reactMid - patch.reactNear)));
    return { bend: (Math.sign(dx || 1) * t * 1.18), avoid: 0 };
  }

  const t = clamp01(1 - ((distance - patch.reactMid) / (patch.reactFar - patch.reactMid)));
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
  const safeTime = Number.isFinite(time) ? time : 0;
  const timeSec = safeTime * 0.001;
  const authoredPatches = Array.isArray(options?.patches)
    ? options.patches.filter((patch) => patch && typeof patch === "object")
    : [];
  const normalizedPatches = (authoredPatches.length > 0 ? authoredPatches : [DEFAULT_PATCH])
    .map((patch, index) => normalizePatch(patch, index, options));

  updateOrganicGrassGusts(normalizedPatches, timeSec);

  ctx.save();
  ctx.lineCap = "round";

  for (const patch of normalizedPatches) {
    const minHeight = Math.max(1, Math.min(patch.heightMin, patch.heightMax));
    const maxHeight = Math.max(minHeight + 1, Math.max(patch.heightMin, patch.heightMax));
    const left = patch.x - (patch.width * 0.5);
    const blades = ensureBladesForPatch({ ...patch, heightMin: minHeight, heightMax: maxHeight });
    const baseColor = parseColorHex(patch.baseColor, DEFAULT_PATCH.baseColor);
    const topColor = parseColorHex(patch.topColor, DEFAULT_PATCH.topColor);

    for (let pass = 0; pass < 2; pass += 1) {
      for (let index = 0; index < blades.length; index += 1) {
        const blade = blades[index];
        const layerOffset = pass === 0 ? -2.4 : 0;
        const bx = left + (blade.u * patch.width) + blade.jitter + blade.lean + (blade.layer - 0.5) * 2.6;
        const by = patch.y + layerOffset;
        const heightMix = clamp01((blade.heightMix * 0.78) + (blade.layer * 0.22));
        const height = lerp(minHeight, maxHeight, heightMix);

        const idleSpeed = 0.68 * lerp(0.72, 1.34, seeded(index * 4.1 + patch.seed));
        const idleScale = lerp(0.55, 1.35, seeded(index * 1.91 + patch.seed));
        const idleA = Math.sin(timeSec * idleSpeed + blade.phase) * patch.windAmp * 0.34 * idleScale;
        const idleB = Math.sin(timeSec * idleSpeed * 0.47 + blade.waveOffset + blade.u * 5.2) * patch.windAmp * 0.16;
        const idleC = Math.sin(timeSec * idleSpeed * 1.31 + blade.phase * 0.42 + blade.u * 9.7) * patch.windAmp * 0.08;

        const gustBend = organicGrassGustAt(patch, bx, index, timeSec) * 24;

        const windBend = idleA + idleB + idleC + gustBend;
        const reaction = resolveReaction(patch, bx, by, playerX, playerY);
        const midBend = reaction.bend * 18;
        const nearStraighten = reaction.avoid * 0.82;
        const topXWorld = bx + (windBend + midBend) * (1 - nearStraighten);
        const topYWorld = by - (height * (1 - (reaction.avoid * 0.24)));

        const basePt = resolveCanvasPoint(mapper, bx, by);
        const topPt = resolveCanvasPoint(mapper, topXWorld, topYWorld);

        const alpha = (pass === 0 ? 0.26 : 0.42) + (Math.abs(windBend) * 0.007) + (Math.abs(reaction.bend) * 0.09) + (reaction.avoid * 0.1);
        const gradient = ctx.createLinearGradient(basePt.x, basePt.y, topPt.x, topPt.y);
        gradient.addColorStop(
          0,
          `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${Math.min(1, alpha * 0.88)})`,
        );
        gradient.addColorStop(
          1,
          `rgba(${Math.round(topColor.r * blade.tint)}, ${Math.round(topColor.g * blade.tint)}, ${Math.round(topColor.b * blade.tint)}, ${Math.min(1, alpha + 0.16)})`,
        );

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
  }

  ctx.restore();
}
