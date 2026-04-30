import { buildCrystalClusters, clamp, clamp01, lerp, parseColorHex } from "../render/shared/proceduralReactiveCrystal.js";

const DEFAULT_CRYSTAL_CLUSTER = Object.freeze({
  id: "reactive_crystal_cluster_default", kind: "reactive_crystal", x: 19.4 * 24, y: 18.6 * 24, width: 82, clusterCount: 8,
  heightMin: 18, heightMax: 54, triggerRadius: 76, auraSensitivity: 1, wakeSpeed: 1, settleDelayMs: 900, settleSpeed: 1,
  variant: "void_crystal_default", seed: 64021, baseColor: "#1a1330", glowColor: "#6d5bff", coreColor: "#63d3ff", edgeColor: "#6d5bff",
});
const crystalCacheByCluster = new Map();
const crystalStateByCluster = new Map();

const crystalDebugState = { enabled: null, lastLogMs: -Infinity };
function isCrystalDebugEnabled(){
  if (crystalDebugState.enabled !== null) return crystalDebugState.enabled;
  try {
    const value = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("crystalDebug") : null;
    crystalDebugState.enabled = value === "1";
  } catch (_err) {
    crystalDebugState.enabled = false;
  }
  return crystalDebugState.enabled;
}

function resolveCanvasPoint(mapper, x, y) { if (!mapper || typeof mapper.worldToCanvasRect !== "function") return { x, y }; const r = mapper.worldToCanvasRect(x, y, 1, 1); return { x: r.x + r.w * 0.5, y: r.y + r.h * 0.5 }; }
function normalizeCluster(cluster) { const s = cluster && typeof cluster === "object" ? cluster : DEFAULT_CRYSTAL_CLUSTER; const c = Number.isFinite(s.clusterCount) ? s.clusterCount : s.shardCount; return { ...DEFAULT_CRYSTAL_CLUSTER, ...s, id: typeof s.id === "string" && s.id.trim() ? s.id.trim() : DEFAULT_CRYSTAL_CLUSTER.id, x: Number.isFinite(s.x) ? Number(s.x) : DEFAULT_CRYSTAL_CLUSTER.x, y: Number.isFinite(s.y) ? Number(s.y) : DEFAULT_CRYSTAL_CLUSTER.y, width: Number.isFinite(s.width) ? clamp(s.width, 28, 280) : DEFAULT_CRYSTAL_CLUSTER.width, clusterCount: Number.isFinite(c) ? clamp(Math.round(c), 3, 20) : DEFAULT_CRYSTAL_CLUSTER.clusterCount, heightMin: Number.isFinite(s.heightMin) ? clamp(s.heightMin, 8, 120) : DEFAULT_CRYSTAL_CLUSTER.heightMin, heightMax: Number.isFinite(s.heightMax) ? clamp(s.heightMax, 10, 180) : DEFAULT_CRYSTAL_CLUSTER.heightMax, triggerRadius: Number.isFinite(s.triggerRadius) ? clamp(s.triggerRadius, 20, 300) : DEFAULT_CRYSTAL_CLUSTER.triggerRadius, auraSensitivity: Number.isFinite(s.auraSensitivity) ? clamp(s.auraSensitivity, 0.1, 3) : DEFAULT_CRYSTAL_CLUSTER.auraSensitivity, wakeSpeed: Number.isFinite(s.wakeSpeed) ? clamp(s.wakeSpeed, 0.2, 5) : DEFAULT_CRYSTAL_CLUSTER.wakeSpeed, settleDelayMs: Number.isFinite(s.settleDelayMs) ? clamp(s.settleDelayMs, 0, 12000) : DEFAULT_CRYSTAL_CLUSTER.settleDelayMs, settleSpeed: Number.isFinite(s.settleSpeed) ? clamp(s.settleSpeed, 0.2, 5) : DEFAULT_CRYSTAL_CLUSTER.settleSpeed }; }
function clusterKey(c){return [c.id,c.seed,c.clusterCount,c.width,c.heightMin,c.heightMax,c.kind,c.variant].join('|');}
function ensureClusterCache(c){const k=clusterKey(c);const v=crystalCacheByCluster.get(k);if(v)return {key:k,localClusters:v};const localClusters=buildCrystalClusters(c);crystalCacheByCluster.set(k,localClusters);return {key:k,localClusters};}
function ensureState(key){if(!crystalStateByCluster.has(key)) crystalStateByCluster.set(key,{wake:0,hold:0,lastTimeMs:null}); return crystalStateByCluster.get(key);}
function distWake(localCluster, sources, fallbackRadius){let best=0; for(const source of sources){if(!Number.isFinite(source?.x)||!Number.isFinite(source?.y)) continue; const sourceRadius = Number.isFinite(source?.radius) ? Number(source.radius) : fallbackRadius; const radius=Math.max(20, sourceRadius); const strength = Number.isFinite(source?.strength) ? clamp01(source.strength) : 1; const dx=source.x-localCluster.x; const dy=source.y-localCluster.y; const d=Math.sqrt(dx*dx+dy*dy); const wakeStrength=clamp01(1-(d/radius))*strength; best=Math.max(best, wakeStrength);} return best;}

export function renderReactiveCrystals(ctx, playerX, playerY, time, options = {}) {
  if (!ctx || typeof ctx.save !== "function" || !ctx.canvas) return;
  const mapper = options && typeof options === "object" ? options.mapper : null;
  const clustersInput = Array.isArray(options?.clusters) ? options.clusters : [options?.cluster];
  const clusters = clustersInput.map((cluster) => normalizeCluster(cluster)).filter(Boolean); if (!clusters.length) clusters.push(normalizeCluster(DEFAULT_CRYSTAL_CLUSTER));
  const extraSources = Array.isArray(options?.wakeSources) ? options.wakeSources : [];
  const baseSources = [{ x: playerX, y: playerY, radius: 180, strength: 1 }, ...extraSources];
  const timeMs = Number.isFinite(time) ? time : 0; const timeSec = timeMs * 0.001;
  ctx.save();
  const debugEnabled = isCrystalDebugEnabled();
  const debugSummaries = [];
  for (const cluster of clusters) {
    const { key, localClusters } = ensureClusterCache(cluster);
    const baseColor = parseColorHex(cluster.baseColor, DEFAULT_CRYSTAL_CLUSTER.baseColor);
    const glowColor = parseColorHex(cluster.glowColor, DEFAULT_CRYSTAL_CLUSTER.glowColor);
    const coreColor = parseColorHex(cluster.coreColor, DEFAULT_CRYSTAL_CLUSTER.coreColor);
    const edgeColor = parseColorHex(cluster.edgeColor, DEFAULT_CRYSTAL_CLUSTER.edgeColor);
    for (let i=0;i<localClusters.length;i+=1){
      const local = localClusters[i]; const state = ensureState(`${key}|${i}`);
      const rawDt = state.lastTimeMs == null ? (1 / 60) : (timeMs - state.lastTimeMs) * 0.001; const dt = clamp(Number.isFinite(rawDt) ? rawDt : (1/60),0,0.07); state.lastTimeMs=timeMs;
      const localWake = distWake(local, baseSources, cluster.triggerRadius * (0.9 + (cluster.auraSensitivity - 1) * 0.2));
      if (localWake > 0.02) { state.hold = cluster.settleDelayMs * 0.001; state.wake = clamp01(state.wake + (dt / Math.max(0.01, 1.05 / (cluster.wakeSpeed * cluster.auraSensitivity))) * localWake); }
      else if (state.hold > 0) state.hold = Math.max(0, state.hold - dt); else state.wake = clamp01(state.wake - (dt / Math.max(0.01, 1.25 / cluster.settleSpeed)));
      const wakeEase = state.wake * state.wake * (3 - 2 * state.wake);
      const idlePulse = 0.5 + Math.sin(timeSec * 1.6 + cluster.seed * 0.0019 + local.phase) * 0.5;
      const glowLevel = lerp(0.12, 0.92, clamp01(idlePulse * 0.25 + wakeEase * 0.95));
      const basePt = resolveCanvasPoint(mapper, local.x, local.y);
      const groundGlow = ctx.createRadialGradient(basePt.x, basePt.y, 1, basePt.x, basePt.y, local.baseRadius * (3.2 + wakeEase));
      groundGlow.addColorStop(0, `rgba(${glowColor.r},${glowColor.g},${glowColor.b},${0.12 + glowLevel * 0.18})`); groundGlow.addColorStop(1, `rgba(${glowColor.r},${glowColor.g},${glowColor.b},0)`);
      ctx.fillStyle = groundGlow; ctx.beginPath(); ctx.arc(basePt.x, basePt.y, local.baseRadius * (3.2 + wakeEase), 0, Math.PI * 2); ctx.fill();
      for (const shard of local.shards){ const pulse=Math.sin(timeSec*1.2+shard.phase)*0.06; const h=shard.height*(1+wakeEase*0.12+pulse); const lx=local.x+shard.sideJitter; const lean=shard.lean+wakeEase*0.08; const left=resolveCanvasPoint(mapper,lx-shard.halfW,local.y); const right=resolveCanvasPoint(mapper,lx+shard.halfW,local.y); const tip=resolveCanvasPoint(mapper,lx+lean*h,local.y-h);
        const g=ctx.createLinearGradient(left.x,left.y,tip.x,tip.y); g.addColorStop(0,`rgba(${baseColor.r},${baseColor.g},${baseColor.b},${0.52+glowLevel*0.2})`); g.addColorStop(0.7,`rgba(${glowColor.r},${glowColor.g},${glowColor.b},${0.24+glowLevel*0.2})`); g.addColorStop(1,`rgba(${baseColor.r},${baseColor.g},${baseColor.b},${0.84})`);
        ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(left.x,left.y); ctx.lineTo(tip.x,tip.y); ctx.lineTo(right.x,right.y); ctx.lineTo((left.x+right.x)*0.5,left.y-shard.halfW*0.22); ctx.closePath(); ctx.fill();
        ctx.strokeStyle=`rgba(${edgeColor.r},${edgeColor.g},${edgeColor.b},${0.18+glowLevel*0.35})`; ctx.lineWidth=1.1; ctx.stroke();
        const core=resolveCanvasPoint(mapper,lx+lean*h*0.35,local.y-h*0.5); ctx.fillStyle=`rgba(${coreColor.r},${coreColor.g},${coreColor.b},${0.18+glowLevel*0.24})`; ctx.beginPath(); ctx.arc(core.x,core.y,Math.max(1.3,1.6+shard.facet*1.6),0,Math.PI*2); ctx.fill();
      }
    }
    if (debugEnabled) {
      const samples = localClusters.slice(0, 3).map((local, i) => {
        const state = ensureState(`${key}|${i}`);
        return { x: Number(local.x.toFixed(1)), y: Number(local.y.toFixed(1)), wake: Number(state.wake.toFixed(3)) };
      });
      debugSummaries.push({ id: cluster.id, generated: localClusters.length, configuredCount: cluster.clusterCount, width: cluster.width, triggerRadius: cluster.triggerRadius, samples });
    }
  }
  if (debugEnabled && (timeMs - crystalDebugState.lastLogMs) > 320) {
    crystalDebugState.lastLogMs = timeMs;
    const wakeSample = baseSources.slice(0, 3).map((s) => ({ x: Number.isFinite(s?.x) ? Number(s.x.toFixed(1)) : null, y: Number.isFinite(s?.y) ? Number(s.y.toFixed(1)) : null, radius: Number.isFinite(s?.radius) ? Number(s.radius.toFixed(1)) : null, strength: Number.isFinite(s?.strength) ? Number(s.strength.toFixed(2)) : 1 }));
    console.info("[reactive-crystal-debug]", { patches: debugSummaries.length, clusters: debugSummaries, wakeSourceCount: baseSources.length, wakeSources: wakeSample });
  }
  ctx.restore();
}
