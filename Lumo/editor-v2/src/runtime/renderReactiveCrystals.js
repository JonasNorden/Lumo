import { buildCrystalClusters, clamp, clamp01 } from "../render/shared/proceduralReactiveCrystal.js";

const DEFAULT_CRYSTAL_CLUSTER = Object.freeze({
  id: "reactive_crystal_cluster_default",
  kind: "reactive_crystal",
  x: 19.4 * 24,
  y: 18.6 * 24,
  width: 82,
  clusterCount: 8,
  heightMin: 18,
  heightMax: 54,
  triggerRadius: 76,
  auraSensitivity: 1,
  wakeSpeed: 1,
  settleDelayMs: 900,
  settleSpeed: 1,
  variant: "void_crystal_default",
  seed: 64021
});

const crystalCacheByCluster = new Map();
const crystalStateByCluster = new Map();

function resolveCanvasPoint(mapper, x, y) {
  if (!mapper || typeof mapper.worldToCanvasRect !== "function") return { x, y };
  const r = mapper.worldToCanvasRect(x, y, 1, 1);
  return { x: r.x + r.w * 0.5, y: r.y + r.h * 0.5 };
}

function normalizeCluster(cluster) {
  const s = cluster && typeof cluster === "object" ? cluster : DEFAULT_CRYSTAL_CLUSTER;
  return {
    ...DEFAULT_CRYSTAL_CLUSTER,
    ...s,
    x: Number.isFinite(s.x) ? s.x : DEFAULT_CRYSTAL_CLUSTER.x,
    y: Number.isFinite(s.y) ? s.y : DEFAULT_CRYSTAL_CLUSTER.y
  };
}

function clusterKey(c) {
  return [c.id, c.seed, c.clusterCount, c.width].join("|");
}

/* ✅ FIX + FULL RENDER */
function ensureClusterCache(c) {
  const k = clusterKey(c);
  const v = crystalCacheByCluster.get(k);

  if (v) {
    const cached = Array.isArray(v) ? v : [v];
    crystalCacheByCluster.set(k, cached);
    return { key: k, localClusters: cached };
  }

  const geometry = buildCrystalClusters(c);
  const localClusters = Array.isArray(geometry) ? geometry : [geometry];
  crystalCacheByCluster.set(k, localClusters);

  return { key: k, localClusters };
}

function ensureState(key) {
  if (!crystalStateByCluster.has(key)) {
    crystalStateByCluster.set(key, { wake: 0, hold: 0, lastTimeMs: null });
  }
  return crystalStateByCluster.get(key);
}

export function renderReactiveCrystals(ctx, playerX, playerY, time, options = {}) {
  if (!ctx || typeof ctx.save !== "function") return;

  const mapper = options?.mapper || null;
  const clustersInput = Array.isArray(options?.clusters)
    ? options.clusters
    : [options?.cluster];

  const clusters = clustersInput.map(normalizeCluster).filter(Boolean);
  const timeMs = Number.isFinite(time) ? time : 0;
  const timeSec = timeMs * 0.001;

  for (const cluster of clusters) {
    const { key, localClusters } = ensureClusterCache(cluster);

    for (let i = 0; i < localClusters.length; i++) {
      const crystal = localClusters[i];
      const state = ensureState(`${key}|${i}`);

      const dt = state.lastTimeMs == null ? 1 / 60 : (timeMs - state.lastTimeMs) * 0.001;
      state.lastTimeMs = timeMs;

      const dx = playerX - cluster.x;
      const dy = playerY - cluster.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const wakeTarget = dist < cluster.triggerRadius ? 1 : 0;
      state.wake = clamp(state.wake + (wakeTarget - state.wake) * dt * 4, 0, 1);

      const wake = state.wake;

      /* ✨ GLOW */
      const center = resolveCanvasPoint(mapper, cluster.x, cluster.y);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      const glow = ctx.createRadialGradient(
        center.x,
        center.y,
        0,
        center.x,
        center.y,
        cluster.width
      );

      glow.addColorStop(0, `rgba(116,49,255,${0.2 + 0.3 * wake})`);
      glow.addColorStop(0.4, `rgba(88,231,255,${0.1 + 0.2 * wake})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = glow;
      ctx.fillRect(center.x - 100, center.y - 100, 200, 200);
      ctx.restore();

      /* 💎 SHARDS */
      for (const shard of crystal.shards) {
        const p = resolveCanvasPoint(mapper, shard.x, shard.y);

        ctx.save();
        ctx.globalAlpha = shard.alpha;

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - shard.w * 0.4, p.y - shard.h);
        ctx.lineTo(p.x + shard.w * 0.4, p.y - shard.h);
        ctx.closePath();

        ctx.fillStyle = `rgba(120,80,255,${0.6 + 0.3 * wake})`;
        ctx.fill();

        ctx.restore();
      }

      /* ✨ SPARKS */
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      for (const sp of crystal.sparks) {
        const p = resolveCanvasPoint(mapper, sp.x, sp.y);

        ctx.globalAlpha = 0.4 + 0.4 * wake;
        ctx.beginPath();
        ctx.arc(p.x, p.y, sp.r, 0, Math.PI * 2);
        ctx.fillStyle = "#58e7ff";
        ctx.fill();
      }

      ctx.restore();
    }
  }
}