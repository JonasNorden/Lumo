const DEFAULT_CRYSTAL_PATCH = Object.freeze({
  id: "reactive_crystal_patch_default",
  kind: "reactive_crystal",
  x: 19.4 * 24,
  y: 18.6 * 24,
  clusterCount: 8,
  width: 82,
  heightMin: 18,
  heightMax: 54,
  baseColor: "#1a1330",
  glowColor: "#6d5bff",
  coreColor: "#63d3ff",
  edgeColor: "#d5c4ff",
  variant: "void_crystal_default",
  seed: 64021,
});

const crystalCacheByPatch = new Map();

function seeded(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

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

function normalizePatch(patch, index) {
  const source = patch && typeof patch === "object" ? patch : DEFAULT_CRYSTAL_PATCH;
  const clusterCount = Number.isFinite(source.clusterCount)
    ? clamp(Math.round(source.clusterCount), 1, 24)
    : (Number.isFinite(source.shardCount) ? clamp(Math.round(source.shardCount), 1, 24) : DEFAULT_CRYSTAL_PATCH.clusterCount);
  const heightMin = Number.isFinite(source.heightMin) ? clamp(source.heightMin, 8, 160) : DEFAULT_CRYSTAL_PATCH.heightMin;
  const heightMaxRaw = Number.isFinite(source.heightMax) ? clamp(source.heightMax, 10, 180) : DEFAULT_CRYSTAL_PATCH.heightMax;
  const heightMax = Math.max(heightMin + 2, heightMaxRaw);

  return {
    ...DEFAULT_CRYSTAL_PATCH,
    ...source,
    id: typeof source.id === "string" && source.id.trim() ? source.id.trim() : `reactive_crystal_patch_${index + 1}`,
    kind: typeof source.kind === "string" && source.kind.trim() ? source.kind.trim() : DEFAULT_CRYSTAL_PATCH.kind,
    x: Number.isFinite(source.x) ? Number(source.x) : DEFAULT_CRYSTAL_PATCH.x,
    y: Number.isFinite(source.y) ? Number(source.y) : DEFAULT_CRYSTAL_PATCH.y,
    width: Number.isFinite(source.width) ? clamp(source.width, 24, 280) : DEFAULT_CRYSTAL_PATCH.width,
    clusterCount,
    heightMin,
    heightMax,
    seed: Number.isFinite(source.seed) ? Number(source.seed) : (DEFAULT_CRYSTAL_PATCH.seed + index * 997),
  };
}

function patchKey(patch) {
  return [patch.id, patch.seed, patch.clusterCount, patch.width, patch.heightMin, patch.heightMax, patch.variant].join("|");
}

function ensurePatchShards(patch) {
  const key = patchKey(patch);
  const cached = crystalCacheByPatch.get(key);
  if (Array.isArray(cached) && cached.length > 0) return cached;

  const shards = [];
  for (let i = 0; i < patch.clusterCount; i += 1) {
    const u = patch.clusterCount <= 1 ? 0.5 : (i / (patch.clusterCount - 1));
    const xNoise = (seeded(patch.seed + i * 3.17) - 0.5) * Math.min(16, patch.width * 0.2);
    const hMix = 0.45 + seeded(patch.seed + i * 6.41) * 0.55;
    shards.push({
      u,
      xNoise,
      phase: seeded(patch.seed + i * 8.77) * Math.PI * 2,
      lean: (seeded(patch.seed + i * 2.39) - 0.5) * 7,
      heightMix: hMix,
      width: 6 + seeded(patch.seed + i * 4.23) * 7,
      shimmer: 0.45 + seeded(patch.seed + i * 5.61) * 0.55,
    });
  }

  crystalCacheByPatch.set(key, shards);
  return shards;
}

export function renderReactiveCrystals(ctx, playerX, playerY, time, options = {}) {
  if (!ctx || typeof ctx.save !== "function" || !ctx.canvas) return;

  const mapper = options && typeof options === "object" ? options.mapper : null;
  const patchesInput = Array.isArray(options?.patches) ? options.patches : [options?.patch];
  const patches = patchesInput.map((patch, index) => normalizePatch(patch, index)).filter(Boolean);
  if (!patches.length) patches.push(normalizePatch(DEFAULT_CRYSTAL_PATCH, 0));

  const timeSec = (Number.isFinite(time) ? time : 0) * 0.001;

  for (const patch of patches) {
    const baseColor = parseColorHex(patch.baseColor, DEFAULT_CRYSTAL_PATCH.baseColor);
    const glowColor = parseColorHex(patch.glowColor, DEFAULT_CRYSTAL_PATCH.glowColor);
    const coreColor = parseColorHex(patch.coreColor, DEFAULT_CRYSTAL_PATCH.coreColor);
    const edgeColor = parseColorHex(patch.edgeColor, DEFAULT_CRYSTAL_PATCH.edgeColor);
    const shards = ensurePatchShards(patch);

    const center = resolveCanvasPoint(mapper, patch.x, patch.y - patch.heightMax * 0.3);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const aura = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, patch.width * 0.95);
    aura.addColorStop(0, `rgba(${glowColor.r},${glowColor.g},${glowColor.b},0.28)`);
    aura.addColorStop(0.55, `rgba(${coreColor.r},${coreColor.g},${coreColor.b},0.12)`);
    aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = aura;
    ctx.fillRect(center.x - patch.width, center.y - patch.heightMax * 0.8, patch.width * 2, patch.heightMax * 1.4);
    ctx.restore();

    const left = patch.x - patch.width * 0.5;
    for (const shard of shards) {
      const h = patch.heightMin + ((patch.heightMax - patch.heightMin) * shard.heightMix);
      const pulse = 1 + Math.sin(timeSec * 1.8 + shard.phase) * 0.03 * shard.shimmer;
      const w = shard.width * pulse;
      const baseX = left + shard.u * patch.width + shard.xNoise;
      const baseY = patch.y;

      const p0 = resolveCanvasPoint(mapper, baseX - w * 0.5, baseY);
      const p1 = resolveCanvasPoint(mapper, baseX - w * 0.24, baseY - h * 0.54);
      const p2 = resolveCanvasPoint(mapper, baseX + shard.lean, baseY - h);
      const p3 = resolveCanvasPoint(mapper, baseX + w * 0.32, baseY - h * 0.52);
      const p4 = resolveCanvasPoint(mapper, baseX + w * 0.5, baseY);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();

      const grad = ctx.createLinearGradient(p0.x, p0.y, p2.x, p2.y);
      grad.addColorStop(0, `rgba(${baseColor.r},${baseColor.g},${baseColor.b},0.92)`);
      grad.addColorStop(0.62, `rgba(${glowColor.r},${glowColor.g},${glowColor.b},0.78)`);
      grad.addColorStop(1, `rgba(${edgeColor.r},${edgeColor.g},${edgeColor.b},0.92)`);
      ctx.fillStyle = grad;
      ctx.shadowColor = `rgba(${glowColor.r},${glowColor.g},${glowColor.b},0.35)`;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(${edgeColor.r},${edgeColor.g},${edgeColor.b},0.65)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      const coreY = baseY - h * 0.34;
      const corePoint = resolveCanvasPoint(mapper, baseX, coreY);
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(${coreColor.r},${coreColor.g},${coreColor.b},0.24)`;
      ctx.beginPath();
      ctx.ellipse(corePoint.x, corePoint.y, w * 0.32, h * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
