const DEFAULT_CRYSTAL_CLUSTER = Object.freeze({
  id: "reactive_crystal_cluster_default",
  kind: "reactive_crystal",
  x: 19.4 * 24,
  y: 18.6 * 24,
  width: 82,
  shardCount: 8,
  triggerRadius: 76,
  wakeSpeed: 1,
  settleDelayMs: 900,
  settleSpeed: 1,
  seed: 64021,
  baseColor: "#1a1330",
  glowColor: "#6d5bff",
  coreColor: "#63d3ff",
});

const crystalCacheByCluster = new Map();
const crystalStateByCluster = new Map();

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

function normalizeCluster(cluster) {
  const source = cluster && typeof cluster === "object" ? cluster : DEFAULT_CRYSTAL_CLUSTER;
  return {
    ...DEFAULT_CRYSTAL_CLUSTER,
    ...source,
    id: typeof source.id === "string" && source.id.trim() ? source.id.trim() : DEFAULT_CRYSTAL_CLUSTER.id,
    x: Number.isFinite(source.x) ? Number(source.x) : DEFAULT_CRYSTAL_CLUSTER.x,
    y: Number.isFinite(source.y) ? Number(source.y) : DEFAULT_CRYSTAL_CLUSTER.y,
    width: Number.isFinite(source.width) ? clamp(source.width, 28, 220) : DEFAULT_CRYSTAL_CLUSTER.width,
    shardCount: Number.isFinite(source.shardCount) ? clamp(Math.round(source.shardCount), 3, 20) : DEFAULT_CRYSTAL_CLUSTER.shardCount,
    triggerRadius: Number.isFinite(source.triggerRadius) ? clamp(source.triggerRadius, 20, 240) : DEFAULT_CRYSTAL_CLUSTER.triggerRadius,
    wakeSpeed: Number.isFinite(source.wakeSpeed) ? clamp(source.wakeSpeed, 0.2, 5) : DEFAULT_CRYSTAL_CLUSTER.wakeSpeed,
    settleDelayMs: Number.isFinite(source.settleDelayMs) ? clamp(source.settleDelayMs, 0, 12000) : DEFAULT_CRYSTAL_CLUSTER.settleDelayMs,
    settleSpeed: Number.isFinite(source.settleSpeed) ? clamp(source.settleSpeed, 0.2, 5) : DEFAULT_CRYSTAL_CLUSTER.settleSpeed,
  };
}

function clusterKey(cluster) {
  return [cluster.id, cluster.seed, cluster.shardCount, cluster.width, cluster.kind].join("|");
}

function ensureClusterCache(cluster) {
  const key = clusterKey(cluster);
  const cached = crystalCacheByCluster.get(key);
  if (Array.isArray(cached) && cached.length > 0) return { key, shards: cached };

  const shards = [];
  for (let i = 0; i < cluster.shardCount; i += 1) {
    const u = cluster.shardCount <= 1 ? 0.5 : (i / (cluster.shardCount - 1));
    shards.push({
      u,
      xNoise: (seeded(cluster.seed + i * 4.33) - 0.5) * 10,
      baseHalfWidth: 4 + seeded(cluster.seed + i * 3.17) * 6,
      height: 18 + seeded(cluster.seed + i * 6.43) * 36,
      lean: (seeded(cluster.seed + i * 9.11) - 0.5) * 0.22,
      phase: seeded(cluster.seed + i * 11.09) * Math.PI * 2,
      pulse: 0.7 + seeded(cluster.seed + i * 7.73) * 0.55,
      tier: seeded(cluster.seed + i * 13.91),
    });
  }
  crystalCacheByCluster.set(key, shards);
  return { key, shards };
}

function ensureClusterState(key) {
  const cached = crystalStateByCluster.get(key);
  if (cached) return cached;
  const state = { wake: 0, hold: 0, lastTimeMs: null };
  crystalStateByCluster.set(key, state);
  return state;
}

function auraTouches(cluster, playerX, playerY) {
  if (!Number.isFinite(playerX) || !Number.isFinite(playerY)) return false;
  const dx = playerX - cluster.x;
  const dy = (playerY - cluster.y) * 0.6;
  const auraRadius = Math.max(28, cluster.triggerRadius * 0.9);
  return (dx * dx) + (dy * dy) <= auraRadius * auraRadius;
}

export function renderReactiveCrystals(ctx, playerX, playerY, time, options = {}) {
  if (!ctx || typeof ctx.save !== "function" || !ctx.canvas) return;

  const mapper = options && typeof options === "object" ? options.mapper : null;
  const clustersInput = Array.isArray(options?.clusters) ? options.clusters : [options?.cluster];
  const clusters = clustersInput.map((cluster) => normalizeCluster(cluster)).filter(Boolean);
  if (!clusters.length) clusters.push(normalizeCluster(DEFAULT_CRYSTAL_CLUSTER));

  const timeMs = Number.isFinite(time) ? time : 0;
  const timeSec = timeMs * 0.001;

  ctx.save();
  for (const cluster of clusters) {
    const { key, shards } = ensureClusterCache(cluster);
    const state = ensureClusterState(key);
    const rawDt = state.lastTimeMs == null ? (1 / 60) : (timeMs - state.lastTimeMs) * 0.001;
    const dt = clamp(Number.isFinite(rawDt) ? rawDt : (1 / 60), 0, 0.07);
    state.lastTimeMs = timeMs;

    if (auraTouches(cluster, playerX, playerY)) {
      state.hold = cluster.settleDelayMs * 0.001;
      state.wake = clamp01(state.wake + (dt / Math.max(0.01, 1.05 / cluster.wakeSpeed)));
    } else if (state.hold > 0) {
      state.hold = Math.max(0, state.hold - dt);
    } else {
      state.wake = clamp01(state.wake - (dt / Math.max(0.01, 1.25 / cluster.settleSpeed)));
    }

    const wakeEase = state.wake * state.wake * (3 - 2 * state.wake);
    const idlePulse = 0.5 + Math.sin(timeSec * 1.6 + cluster.seed * 0.0019) * 0.5;
    const glowLevel = lerp(0.18, 0.88, clamp01((idlePulse * 0.35) + wakeEase * 0.75));

    const baseColor = parseColorHex(cluster.baseColor, DEFAULT_CRYSTAL_CLUSTER.baseColor);
    const glowColor = parseColorHex(cluster.glowColor, DEFAULT_CRYSTAL_CLUSTER.glowColor);
    const coreColor = parseColorHex(cluster.coreColor, DEFAULT_CRYSTAL_CLUSTER.coreColor);

    for (let i = 0; i < shards.length; i += 1) {
      const shard = shards[i];
      const wx = cluster.x - cluster.width * 0.5 + shard.u * cluster.width + shard.xNoise;
      const wy = cluster.y;
      const pulse = Math.sin((timeSec * shard.pulse) + shard.phase);
      const tierWeight = 0.72 + shard.tier * 0.38;
      const expand = wakeEase * (1.8 + shard.tier * 3.8);
      const lean = shard.lean + (wakeEase * 0.12 * (shard.u - 0.5));
      const height = shard.height * (1 + wakeEase * 0.08) * (0.96 + pulse * 0.035);
      const halfW = (shard.baseHalfWidth + expand) * (0.9 + shard.tier * 0.3);

      const basePt = resolveCanvasPoint(mapper, wx, wy);
      const tipPt = resolveCanvasPoint(mapper, wx + lean * height, wy - height);
      const leftPt = resolveCanvasPoint(mapper, wx - halfW, wy);
      const rightPt = resolveCanvasPoint(mapper, wx + halfW, wy);

      const shardGradient = ctx.createLinearGradient(basePt.x, basePt.y, tipPt.x, tipPt.y);
      shardGradient.addColorStop(0, `rgba(${baseColor.r},${baseColor.g},${baseColor.b},${0.46 + glowLevel * 0.24})`);
      shardGradient.addColorStop(1, `rgba(${glowColor.r},${glowColor.g},${glowColor.b},${0.24 + glowLevel * 0.44})`);

      ctx.fillStyle = shardGradient;
      ctx.beginPath();
      ctx.moveTo(leftPt.x, leftPt.y);
      ctx.lineTo(tipPt.x, tipPt.y);
      ctx.lineTo(rightPt.x, rightPt.y);
      ctx.closePath();
      ctx.fill();

      const corePulse = 0.3 + glowLevel * 0.7 + pulse * 0.08;
      const coreRadius = Math.max(1.2, (1.6 + shard.tier * 1.9) * (0.7 + wakeEase * 0.55));
      const coreCenter = resolveCanvasPoint(mapper, wx + lean * height * 0.42, wy - height * 0.54);
      const coreGlow = ctx.createRadialGradient(coreCenter.x, coreCenter.y, 0, coreCenter.x, coreCenter.y, coreRadius * 3.6);
      coreGlow.addColorStop(0, `rgba(${coreColor.r},${coreColor.g},${coreColor.b},${0.55 * corePulse})`);
      coreGlow.addColorStop(1, `rgba(${coreColor.r},${coreColor.g},${coreColor.b},0)`);
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(coreCenter.x, coreCenter.y, coreRadius * 3.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(${coreColor.r},${coreColor.g},${coreColor.b},${0.42 + glowLevel * 0.34})`;
      ctx.beginPath();
      ctx.arc(coreCenter.x, coreCenter.y, coreRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(${glowColor.r},${glowColor.g},${glowColor.b},${0.18 + glowLevel * 0.26})`;
      ctx.lineWidth = Math.max(0.8, 1 + tierWeight * 0.4);
      ctx.beginPath();
      ctx.moveTo(leftPt.x, leftPt.y);
      ctx.lineTo(tipPt.x, tipPt.y);
      ctx.lineTo(rightPt.x, rightPt.y);
      ctx.stroke();
    }
  }

  ctx.restore();
}
