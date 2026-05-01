import { buildCrystalClusters, clamp, clamp01, parseColorHex } from "../render/shared/proceduralReactiveCrystal.js";

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
  seed: 64021,
  baseColor: "#1a1330",
  glowColor: "#6d5bff",
  coreColor: "#63d3ff",
  edgeColor: "#6d5bff",
});

const crystalCacheByCluster = new Map();
const crystalStateByCluster = new Map();

function rgba(color, alpha) {
  return `rgba(${color.r},${color.g},${color.b},${alpha})`;
}

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
    width: Number.isFinite(s.width) ? clamp(Number(s.width), 28, 360) : DEFAULT_CRYSTAL_CLUSTER.width,
    clusterCount: Number.isFinite(c) ? clamp(Math.round(c), 3, 24) : DEFAULT_CRYSTAL_CLUSTER.clusterCount,
    heightMin: Number.isFinite(s.heightMin) ? clamp(Number(s.heightMin), 8, 140) : DEFAULT_CRYSTAL_CLUSTER.heightMin,
    heightMax: Number.isFinite(s.heightMax) ? clamp(Number(s.heightMax), 10, 200) : DEFAULT_CRYSTAL_CLUSTER.heightMax,
    triggerRadius: Number.isFinite(s.triggerRadius) ? clamp(Number(s.triggerRadius), 20, 360) : DEFAULT_CRYSTAL_CLUSTER.triggerRadius,
    auraSensitivity: Number.isFinite(s.auraSensitivity) ? clamp(Number(s.auraSensitivity), 0.1, 3) : DEFAULT_CRYSTAL_CLUSTER.auraSensitivity,
    wakeSpeed: Number.isFinite(s.wakeSpeed) ? clamp(Number(s.wakeSpeed), 0.2, 5) : DEFAULT_CRYSTAL_CLUSTER.wakeSpeed,
    settleDelayMs: Number.isFinite(s.settleDelayMs) ? clamp(Number(s.settleDelayMs), 0, 12000) : DEFAULT_CRYSTAL_CLUSTER.settleDelayMs,
    settleSpeed: Number.isFinite(s.settleSpeed) ? clamp(Number(s.settleSpeed), 0.2, 5) : DEFAULT_CRYSTAL_CLUSTER.settleSpeed,
  };
}

function clusterKey(c) {
  return [
    c.id,
    c.seed,
    c.clusterCount,
    c.width,
    c.heightMin,
    c.heightMax,
    c.kind,
    c.variant,
    c.x,
    c.y,
  ].join("|");
}

function ensureClusterCache(c) {
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

function ensureState(key) {
  if (!crystalStateByCluster.has(key)) {
    crystalStateByCluster.set(key, { wake: 0, hold: 0, lastTimeMs: null });
  }
  return crystalStateByCluster.get(key);
}

function distWake(localCluster, sources, fallbackRadius) {
  let best = 0;

  for (const source of sources) {
    if (!Number.isFinite(source?.x) || !Number.isFinite(source?.y)) continue;

    const sourceRadius = Number.isFinite(source?.radius) ? Number(source.radius) : fallbackRadius;
    const radius = Math.max(20, sourceRadius);
    const strength = Number.isFinite(source?.strength) ? clamp01(source.strength) : 1;

    const dx = source.x - localCluster.x;
    const dy = source.y - localCluster.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    const wakeStrength = clamp01(1 - d / radius) * strength;
    best = Math.max(best, wakeStrength);
  }

  return best;
}

function drawShard(ctx, mapper, shard, timeSec, wake, colors) {
  const pulse = 1 + Math.sin(timeSec * 1.4 + shard.x * 0.07) * 0.015 * wake;
  const x = shard.x;
  const y = shard.y;
  const w = shard.w * pulse;
  const h = shard.h * pulse;
  const topX = x + shard.lean;

  const p0 = resolveCanvasPoint(mapper, x - w * 0.55, y);
  const p1 = resolveCanvasPoint(mapper, x - w * 0.42 + shard.jag, y - h * 0.58);
  const p2 = resolveCanvasPoint(mapper, topX, y - h);
  const p3 = resolveCanvasPoint(mapper, x + w * 0.46 - shard.jag * 0.4, y - h * 0.52);
  const p4 = resolveCanvasPoint(mapper, x + w * 0.55, y);
  const base = resolveCanvasPoint(mapper, x, y);

  ctx.save();
  ctx.globalAlpha = shard.alpha;

  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p4.x, p4.y);
  ctx.closePath();

  const grad = ctx.createLinearGradient(base.x, base.y, p2.x, p2.y);
  grad.addColorStop(0, rgba(colors.base, 0.95));
  grad.addColorStop(0.42, rgba(colors.glow, 0.88));
  grad.addColorStop(0.75, rgba(colors.edge, 0.72));
  grad.addColorStop(1, "rgba(218,185,255,.85)");

  ctx.fillStyle = grad;
  ctx.shadowColor = rgba(colors.glow, 0.25 + 0.35 * wake);
  ctx.shadowBlur = 10 + 18 * wake;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(218,190,255,.55)";
  ctx.stroke();

  ctx.globalAlpha = 0.23 + 0.16 * wake;
  ctx.fillStyle = rgba(colors.core, 0.75);
  ctx.beginPath();
  ctx.moveTo(p2.x, p2.y);
  ctx.lineTo(base.x, resolveCanvasPoint(mapper, 0, y - h * 0.45).y);
  ctx.lineTo(resolveCanvasPoint(mapper, x + w * 0.35, y).x, p4.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "rgba(10,5,40,.8)";
  ctx.beginPath();
  ctx.moveTo(p2.x, p2.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p0.x, p0.y);
  ctx.lineTo(base.x, resolveCanvasPoint(mapper, 0, y - h * 0.45).y);
  ctx.closePath();
  ctx.fill();

  if (shard.core) {
    const cp = resolveCanvasPoint(mapper, x, y - h * 0.35);
    const ep = resolveCanvasPoint(mapper, x, y - h * 0.28);
    const cg = ctx.createRadialGradient(cp.x, cp.y, 0, cp.x, cp.y, Math.max(w, h) * 0.38);

    cg.addColorStop(0, rgba(colors.core, 0.32 + 0.35 * wake));
    cg.addColorStop(0.35, rgba(colors.core, 0.13 + 0.2 * wake));
    cg.addColorStop(1, rgba(colors.core, 0));

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 1;
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(ep.x, ep.y, w * 0.55, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function renderReactiveCrystals(ctx, playerX, playerY, time, options = {}) {
  if (!ctx || typeof ctx.save !== "function" || !ctx.canvas) return;

  const mapper = options && typeof options === "object" ? options.mapper : null;
  const clustersInput = Array.isArray(options?.clusters) ? options.clusters : [options?.cluster];
  const clusters = clustersInput.map((cluster) => normalizeCluster(cluster)).filter(Boolean);

  if (!clusters.length) {
    clusters.push(normalizeCluster(DEFAULT_CRYSTAL_CLUSTER));
  }

  const extraSources = Array.isArray(options?.wakeSources) ? options.wakeSources : [];
  const baseSources = [{ x: playerX, y: playerY, radius: 180, strength: 1 }, ...extraSources];

  const timeMs = Number.isFinite(time) ? time : 0;
  const timeSec = timeMs * 0.001;

  for (const cluster of clusters) {
    const { key, localClusters } = ensureClusterCache(cluster);

    const colors = {
      base: parseColorHex(cluster.baseColor, "#1a1330"),
      glow: parseColorHex(cluster.glowColor, "#6d5bff"),
      core: parseColorHex(cluster.coreColor, "#63d3ff"),
      edge: parseColorHex(cluster.edgeColor, "#6a4cff"),
    };

    for (let i = 0; i < localClusters.length; i += 1) {
      const crystal = localClusters[i];
      const state = ensureState(`${key}|${i}`);

      const rawDt = state.lastTimeMs == null ? 1 / 60 : (timeMs - state.lastTimeMs) * 0.001;
      const dt = clamp(Number.isFinite(rawDt) ? rawDt : 1 / 60, 0, 0.07);
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
      ctx.globalCompositeOperation = "lighter";

      const glow = ctx.createRadialGradient(
        center.x,
        center.y,
        0,
        center.x,
        center.y,
        Math.max(20, cluster.width * 0.9)
      );

glow.addColorStop(0, rgba(colors.glow, 0));
glow.addColorStop(0.25, rgba(colors.core, 0));
glow.addColorStop(0.6, rgba(colors.glow, 0));
glow.addColorStop(1, rgba(colors.glow, 0));

      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(
        center.x,
        center.y - cluster.heightMax * 0.1,
cluster.width * 1.4,
cluster.heightMax * 0.85,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();

      for (const chip of crystal.chips || []) {
        const pt = resolveCanvasPoint(mapper, chip.x, chip.y);

        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(chip.a);
        ctx.fillStyle = rgba(colors.glow, 0.55);
        ctx.fillRect(-chip.w / 2, -chip.h / 2, chip.w, chip.h);
        ctx.restore();
      }

      for (const shard of crystal.shards || []) {
        drawShard(ctx, mapper, shard, timeSec, wake, colors);
      }

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      for (const sp of crystal.sparks || []) {
        const blink = 0.25 + 0.75 * Math.max(0, Math.sin(timeSec * 1.7 + sp.phase));
        const pt = resolveCanvasPoint(mapper, sp.x, sp.y + Math.sin(timeSec + sp.phase) * 2);

        ctx.globalAlpha = blink * (0.25 + 0.55 * wake);
        ctx.fillStyle = sp.phase % 2 > 1 ? "#d99cff" : "#58e7ff";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, sp.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}