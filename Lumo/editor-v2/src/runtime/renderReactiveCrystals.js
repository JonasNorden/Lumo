import { buildCrystalClusters, clamp, clamp01, parseColorHex } from "../render/shared/proceduralReactiveCrystal.js";

const DEFAULT_CRYSTAL_CLUSTER = Object.freeze({
  id: "reactive_crystal_cluster_default", kind: "reactive_crystal", x: 19.4 * 24, y: 18.6 * 24, width: 82, clusterCount: 8,
  heightMin: 18, heightMax: 54, triggerRadius: 76, auraSensitivity: 1, wakeSpeed: 1, settleDelayMs: 900, settleSpeed: 1,
  variant: "void_crystal_default", seed: 64021, baseColor: "#1a1330", glowColor: "#6d5bff", coreColor: "#63d3ff", edgeColor: "#6d5bff",
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
  const c = Number.isFinite(s.clusterCount) ? s.clusterCount : s.shardCount;
  return {
    ...DEFAULT_CRYSTAL_CLUSTER,
    ...s,
    id: typeof s.id === "string" && s.id.trim() ? s.id.trim() : DEFAULT_CRYSTAL_CLUSTER.id,
    x: Number.isFinite(s.x) ? Number(s.x) : DEFAULT_CRYSTAL_CLUSTER.x,
    y: Number.isFinite(s.y) ? Number(s.y) : DEFAULT_CRYSTAL_CLUSTER.y,
    width: Number.isFinite(s.width) ? clamp(s.width, 28, 280) : DEFAULT_CRYSTAL_CLUSTER.width,
    clusterCount: Number.isFinite(c) ? clamp(Math.round(c), 3, 20) : DEFAULT_CRYSTAL_CLUSTER.clusterCount,
    heightMin: Number.isFinite(s.heightMin) ? clamp(s.heightMin, 8, 120) : DEFAULT_CRYSTAL_CLUSTER.heightMin,
    heightMax: Number.isFinite(s.heightMax) ? clamp(s.heightMax, 10, 180) : DEFAULT_CRYSTAL_CLUSTER.heightMax,
    triggerRadius: Number.isFinite(s.triggerRadius) ? clamp(s.triggerRadius, 20, 300) : DEFAULT_CRYSTAL_CLUSTER.triggerRadius,
    auraSensitivity: Number.isFinite(s.auraSensitivity) ? clamp(s.auraSensitivity, 0.1, 3) : DEFAULT_CRYSTAL_CLUSTER.auraSensitivity,
    wakeSpeed: Number.isFinite(s.wakeSpeed) ? clamp(s.wakeSpeed, 0.2, 5) : DEFAULT_CRYSTAL_CLUSTER.wakeSpeed,
    settleDelayMs: Number.isFinite(s.settleDelayMs) ? clamp(s.settleDelayMs, 0, 12000) : DEFAULT_CRYSTAL_CLUSTER.settleDelayMs,
    settleSpeed: Number.isFinite(s.settleSpeed) ? clamp(s.settleSpeed, 0.2, 5) : DEFAULT_CRYSTAL_CLUSTER.settleSpeed
  };
}

function clusterKey(c){
  return [c.id,c.seed,c.clusterCount,c.width,c.heightMin,c.heightMax,c.kind,c.variant].join('|');
}

/* ✅ FIXAD VERSION */
function ensureClusterCache(c){
  const k = clusterKey(c);
  const v = crystalCacheByCluster.get(k);

  if (v) {
    const cachedClusters = Array.isArray(v) ? v : [v];
    crystalCacheByCluster.set(k, cachedClusters);
    return { key: k, localClusters: cachedClusters };
  }

  const geometry = buildCrystalClusters(c);
  const localClusters = Array.isArray(geometry) ? geometry : [geometry];
  crystalCacheByCluster.set(k, localClusters);

  return { key: k, localClusters };
}

function ensureState(key){
  if(!crystalStateByCluster.has(key)) {
    crystalStateByCluster.set(key,{wake:0,hold:0,lastTimeMs:null});
  }
  return crystalStateByCluster.get(key);
}

function distWake(localCluster, sources, fallbackRadius){
  let best=0;
  for(const source of sources){
    if(!Number.isFinite(source?.x)||!Number.isFinite(source?.y)) continue;
    const sourceRadius = Number.isFinite(source?.radius) ? Number(source.radius) : fallbackRadius;
    const radius=Math.max(20, sourceRadius);
    const strength = Number.isFinite(source?.strength) ? clamp01(source.strength) : 1;
    const dx=source.x-localCluster.x;
    const dy=source.y-localCluster.y;
    const d=Math.sqrt(dx*dx+dy*dy);
    const wakeStrength=clamp01(1-(d/radius))*strength;
    best=Math.max(best, wakeStrength);
  }
  return best;
}

/* resten av filen är IDENTISK */
export function renderReactiveCrystals(ctx, playerX, playerY, time, options = {}) {
  if (!ctx || typeof ctx.save !== "function" || !ctx.canvas) return;

  const mapper = options?.mapper || null;
  const clustersInput = Array.isArray(options?.clusters) ? options.clusters : [options?.cluster];
  const clusters = clustersInput.map(normalizeCluster).filter(Boolean);

  if (!clusters.length) clusters.push(normalizeCluster(DEFAULT_CRYSTAL_CLUSTER));

  const extraSources = Array.isArray(options?.wakeSources) ? options.wakeSources : [];
  const baseSources = [{ x: playerX, y: playerY, radius: 180, strength: 1 }, ...extraSources];

  const timeMs = Number.isFinite(time) ? time : 0;
  const timeSec = timeMs * 0.001;

  for (const cluster of clusters) {
    const { key, localClusters } = ensureClusterCache(cluster);

    for (let i = 0; i < localClusters.length; i++) {
      const crystal = localClusters[i];
      const state = ensureState(`${key}|${i}`);

      const rawDt = state.lastTimeMs == null ? (1/60) : (timeMs - state.lastTimeMs) * 0.001;
      const dt = clamp(Number.isFinite(rawDt) ? rawDt : (1/60), 0, 0.07);

      state.lastTimeMs = timeMs;

      const localWake = distWake({ x: cluster.x, y: cluster.y }, baseSources, cluster.triggerRadius);

      if (localWake > 0.02) {
        state.hold = cluster.settleDelayMs * 0.001;
        state.wake = clamp01(state.wake + dt * cluster.wakeSpeed * localWake * 1.8);
      } else if (state.hold > 0) {
        state.hold = Math.max(0, state.hold - dt);
      } else {
        state.wake = clamp01(state.wake - dt * cluster.settleSpeed * 0.8);
      }

      const wake = state.wake * state.wake * (3 - 2 * state.wake);

      const center = resolveCanvasPoint(mapper, cluster.x, cluster.y);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      const g = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, cluster.width * 0.9);
      g.addColorStop(0, `rgba(116,49,255,${0.16 + 0.25 * wake})`);
      g.addColorStop(0.38, `rgba(88,231,255,${0.05 + 0.12 * wake})`);
      g.addColorStop(1, 'rgba(116,49,255,0)');

      ctx.fillStyle = g;
      ctx.fillRect(center.x - cluster.width * 0.9, center.y - cluster.heightMax * 0.45, cluster.width * 1.8, cluster.heightMax * 0.7);
      ctx.restore();
    }
  }
}