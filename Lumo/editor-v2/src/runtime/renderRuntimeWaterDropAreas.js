import { generateWaterDropAreaLayout, normalizeWaterDropAreaForEditor, resolveWaterDropCollisionY } from "../domain/worldAreas.js";

const DEFAULT_IMPACT_POOL_LIMIT = 144;
const WATER_DROP_IMPACT_MIN_LIFETIME = 0.8;
const WATER_DROP_IMPACT_MAX_LIFETIME = 1.15;

function toFinite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, toFinite(value, 0)));
}

function getCycleMotion(drop, timeSeconds = 0, collisionRects = [], options = {}) {
  const sourceY = toFinite(drop?.sourceY);
  const collisionY = resolveWaterDropCollisionY(drop, collisionRects, options);
  const travel = Math.max(1, collisionY - sourceY);
  const speed = Math.max(1, toFinite(drop?.fallSpeed, 60));
  const cycleSeconds = Math.max(0.32, travel / speed);
  const unwrappedPhase = toFinite(drop?.phase) + toFinite(timeSeconds) / cycleSeconds;
  const phase = positiveModulo(unwrappedPhase, 1);
  return {
    sourceY,
    collisionY,
    travel,
    cycleSeconds,
    phase,
    cycleIndex: Math.floor(unwrappedPhase),
    y: Math.min(collisionY, sourceY + travel * phase),
  };
}

function getDropImpactKey(area, areaIndex, drop, dropIndex) {
  return typeof drop?.id === "string" && drop.id
    ? drop.id
    : `${area?.id || `water_drop_area_${areaIndex + 1}`}:drop:${dropIndex}`;
}

function getImpactRadiusBase(drop, area) {
  const radius = Math.max(1, toFinite(drop?.radius, 2));
  const areaSizeScale = clamp01(toFinite(area?.size, 35) / 100);
  const radiusScale = clamp01((radius - 1) / 4);
  return 16 + (areaSizeScale * 7) + (radiusScale * 5);
}

function getImpactVerticalRadiusBase(drop, area) {
  const radius = Math.max(1, toFinite(drop?.radius, 2));
  const areaSizeScale = clamp01(toFinite(area?.size, 35) / 100);
  const radiusScale = clamp01((radius - 1) / 4);
  return 3 + (areaSizeScale * 1.5) + (radiusScale * 1.5);
}

function getImpactLifetime(drop, area) {
  const areaSizeScale = clamp01(toFinite(area?.size, 35) / 100);
  const radiusScale = clamp01((toFinite(drop?.radius, 2) - 1) / 4);
  return WATER_DROP_IMPACT_MIN_LIFETIME + (WATER_DROP_IMPACT_MAX_LIFETIME - WATER_DROP_IMPACT_MIN_LIFETIME) * (areaSizeScale * 0.65 + radiusScale * 0.35);
}

export function createRuntimeWaterDropImpactPool(maxEvents = DEFAULT_IMPACT_POOL_LIMIT) {
  return {
    maxEvents: Math.max(1, Math.floor(toFinite(maxEvents, DEFAULT_IMPACT_POOL_LIMIT))),
    cursor: 0,
    events: [],
    lastCycles: new Map(),
  };
}

export function updateRuntimeWaterDropImpactPool(pool, waterDropAreas, timeSeconds = 0, options = {}) {
  if (!pool || !Array.isArray(waterDropAreas) || waterDropAreas.length === 0) return pool?.events || [];
  if (!Array.isArray(pool.events)) pool.events = [];
  if (!(pool.lastCycles instanceof Map)) pool.lastCycles = new Map();
  pool.maxEvents = Math.max(1, Math.floor(toFinite(pool.maxEvents, DEFAULT_IMPACT_POOL_LIMIT)));
  const collisionRects = Array.isArray(options.collisionRects) ? options.collisionRects : [];
  const collisionOptions = { worldBottomY: toFinite(options.worldBottomY ?? options.worldHeightPx, Number.NaN) };
  const liveKeys = new Set();
  for (let areaIndex = 0; areaIndex < waterDropAreas.length; areaIndex += 1) {
    const area = normalizeWaterDropAreaForEditor(waterDropAreas[areaIndex], areaIndex);
    if (!area.enabled || !area.visible || area.density <= 0 || area.size <= 0) continue;
    const drops = generateWaterDropAreaLayout(area, areaIndex);
    for (let dropIndex = 0; dropIndex < drops.length; dropIndex += 1) {
      const drop = drops[dropIndex];
      const key = getDropImpactKey(area, areaIndex, drop, dropIndex);
      liveKeys.add(key);
      const motion = getCycleMotion(drop, timeSeconds, collisionRects, collisionOptions);
      const previousCycle = pool.lastCycles.get(key);
      if (Number.isInteger(previousCycle) && motion.cycleIndex > previousCycle) {
        const slotIndex = pool.events.length < pool.maxEvents ? pool.events.length : pool.cursor % pool.maxEvents;
        pool.events[slotIndex] = {
          active: true,
          key,
          x: toFinite(drop.sourceX),
          y: motion.collisionY,
          impactY: motion.collisionY,
          bornAt: toFinite(timeSeconds),
          lifetime: getImpactLifetime(drop, area),
          radiusBase: getImpactRadiusBase(drop, area),
          radiusYBase: getImpactVerticalRadiusBase(drop, area),
          alpha: Math.max(0.35, Math.min(0.45, toFinite(drop.alpha, 0.36) * 0.95)),
        };
        pool.cursor = (slotIndex + 1) % pool.maxEvents;
      }
      pool.lastCycles.set(key, motion.cycleIndex);
    }
  }
  for (const key of Array.from(pool.lastCycles.keys())) {
    if (!liveKeys.has(key)) pool.lastCycles.delete(key);
  }
  for (const event of pool.events) {
    if (!event) continue;
    if (toFinite(timeSeconds) - toFinite(event.bornAt) >= toFinite(event.lifetime, WATER_DROP_IMPACT_MAX_LIFETIME)) event.active = false;
  }
  return pool.events;
}

export function getActiveRuntimeWaterDropImpactEvents(pool, timeSeconds = 0) {
  if (!pool || !Array.isArray(pool.events)) return [];
  const now = toFinite(timeSeconds);
  return pool.events.filter((event) => event?.active && now - toFinite(event.bornAt) < toFinite(event.lifetime, WATER_DROP_IMPACT_MAX_LIFETIME));
}

export function getRuntimeWaterDropY(drop, timeSeconds = 0, collisionRects = [], options = {}) {
  return getCycleMotion(drop, timeSeconds, collisionRects, options).y;
}

export function drawRuntimeWaterDropImpactRing(ctx, event, cameraState, timeSeconds = 0, alphaScale = 1) {
  if (!ctx || !event?.active) return false;
  const age = toFinite(timeSeconds) - toFinite(event.bornAt);
  const lifetime = Math.max(0.01, toFinite(event.lifetime, WATER_DROP_IMPACT_MAX_LIFETIME));
  if (age < 0 || age >= lifetime) return false;
  const progress = clamp01(age / lifetime);
  const eased = 1 - ((1 - progress) * (1 - progress));
  const x = toFinite(event.x) - toFinite(cameraState?.cameraX);
  const y = toFinite(event.y) - toFinite(cameraState?.cameraY);
  const radiusBase = Math.max(16, toFinite(event.radiusBase, 22));
  const radiusYBase = Math.max(3, toFinite(event.radiusYBase, 4));
  const radiusX = radiusBase * eased;
  const radiusY = radiusYBase * eased;
  const alpha = Math.max(0, 1 - progress) * toFinite(event.alpha, 0.42) * toFinite(alphaScale, 1);
  if (alpha <= 0.003 || radiusX <= 0.01 || radiusY <= 0.01) return false;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = "rgba(120, 215, 255, 0.9)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  return true;
}

export function renderRuntimeWaterDropAreas(ctx, waterDropAreas, cameraState, timeSeconds = 0, options = {}) {
  if (!ctx || typeof ctx.save !== "function" || !Array.isArray(waterDropAreas) || !waterDropAreas.length) return 0;
  const collisionRects = Array.isArray(options.collisionRects) ? options.collisionRects : [];
  const collisionOptions = { worldBottomY: toFinite(options.worldBottomY ?? options.worldHeightPx, Number.NaN) };
  const impactPool = options.impactPool || null;
  if (impactPool) updateRuntimeWaterDropImpactPool(impactPool, waterDropAreas, timeSeconds, options);
  let rendered = 0;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  for (let areaIndex = 0; areaIndex < waterDropAreas.length; areaIndex += 1) {
    const area = normalizeWaterDropAreaForEditor(waterDropAreas[areaIndex], areaIndex);
    if (!area.enabled || !area.visible || area.density <= 0 || area.size <= 0) continue;
    for (const drop of generateWaterDropAreaLayout(area, areaIndex)) {
      const x = toFinite(drop.sourceX) - toFinite(cameraState?.cameraX);
      const y = getRuntimeWaterDropY(drop, timeSeconds, collisionRects, collisionOptions) - toFinite(cameraState?.cameraY);
      const radius = Math.max(1, toFinite(drop.radius, 2));
      const length = Math.max(radius * 1.8, toFinite(drop.length, radius * 3));
      ctx.save();
      ctx.globalAlpha *= Math.max(0.08, Math.min(0.72, toFinite(drop.alpha, 0.42)));
      ctx.strokeStyle = "rgba(205, 238, 255, 0.78)";
      ctx.fillStyle = "rgba(177, 222, 246, 0.82)";
      ctx.lineWidth = Math.max(1, radius * 0.65);
      ctx.beginPath();
      ctx.moveTo(x, y - length);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y - radius * 0.35, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      rendered += 1;
    }
  }
  if (impactPool) {
    for (const event of getActiveRuntimeWaterDropImpactEvents(impactPool, timeSeconds)) {
      if (drawRuntimeWaterDropImpactRing(ctx, event, cameraState, timeSeconds)) rendered += 1;
    }
  }
  ctx.restore();
  return rendered;
}
