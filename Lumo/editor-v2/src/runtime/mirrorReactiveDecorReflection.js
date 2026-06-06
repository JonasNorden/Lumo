import { renderReactiveBloomPlants } from "./renderReactiveBloomPlants.js";
import { renderReactiveCrystals } from "./renderReactiveCrystals.js";
import { renderReactiveGrass } from "./renderReactiveGrass.js";

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function areaSurface(area) {
  if (!area || typeof area !== "object") return null;
  const x = finiteOr(area.x, NaN);
  const y = finiteOr(area.y, NaN) + finiteOr(area.yOffset, 0);
  const width = finiteOr(area.width, NaN);
  const height = finiteOr(area.height, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return {
    x,
    y,
    width,
    height,
    reflectionHeight: Math.max(0, finiteOr(area.reflectionHeight, 72)),
    reflectionStrength: clamp01(finiteOr(area.reflectionStrength, 0.35)),
    distortion: clamp01(finiteOr(area.distortion, 0.12)),
    fade: clamp01(finiteOr(area.fade, 0.65)),
  };
}

function grassBounds(patch) {
  if (!patch || typeof patch !== "object") return null;
  const x = finiteOr(patch.x, NaN);
  const y = finiteOr(patch.y, NaN);
  const width = Math.max(0, finiteOr(patch.width, 0));
  const height = Math.max(1, Math.max(finiteOr(patch.heightMin, 12), finiteOr(patch.heightMax, 84)));
  if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0) return null;
  return { x: x - width * 0.5, y: y - height, w: width, h: height };
}

function bloomBounds(patch) {
  if (!patch || typeof patch !== "object") return null;
  const x = finiteOr(patch.x, NaN);
  const y = finiteOr(patch.y, NaN);
  const width = Math.max(0, finiteOr(patch.width, 0));
  const height = Math.max(1, Math.max(finiteOr(patch.heightMin, 30), finiteOr(patch.heightMax, 52)) + finiteOr(patch.bloomRadiusMax, 18));
  if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0) return null;
  return { x: x - width * 0.5 - 20, y: y - height, w: width + 40, h: height };
}

function crystalBounds(patch) {
  if (!patch || typeof patch !== "object") return null;
  const x = finiteOr(patch.x, NaN);
  const y = finiteOr(patch.y, NaN);
  const width = Math.max(0, finiteOr(patch.width, 0));
  const height = Math.max(1, Math.max(finiteOr(patch.heightMin, 18), finiteOr(patch.heightMax, 54)));
  if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0) return null;
  return { x: x - width * 0.7, y: y - height, w: width * 1.4, h: height };
}

function horizontalOverlap(aX, aW, bX, bW, pad = 0) {
  return aX <= bX + bW + pad && aX + aW >= bX - pad;
}

function pushCandidate(candidates, type, patch, bounds, surface) {
  if (!bounds) return;
  const pad = Math.max(8, surface.height * 0.5);
  const distanceToSurface = surface.y - (bounds.y + bounds.h);
  const verticalReach = Math.max(1, surface.reflectionHeight);
  const isNearVertically = surface.reflectionHeight > 0
    && distanceToSurface >= -surface.height
    && distanceToSurface <= verticalReach;

  if (!isNearVertically || !horizontalOverlap(bounds.x, bounds.w, surface.x, surface.width, pad)) return;

  candidates.push({
    type,
    patch,
    worldBounds: bounds,
    distanceToSurface,
    verticalReach,
  });
}

export function buildReactiveDecorMirrorReflectionCandidates(mirrorArea, reactiveDecor = {}) {
  const surface = areaSurface(mirrorArea);
  if (!surface) return [];

  const candidates = [];
  for (const patch of Array.isArray(reactiveDecor.grassPatches) ? reactiveDecor.grassPatches : []) {
    if (patch?.kind && patch.kind !== "reactive_grass") continue;
    pushCandidate(candidates, "grass", patch, grassBounds(patch), surface);
  }
  for (const patch of Array.isArray(reactiveDecor.bloomPatches) ? reactiveDecor.bloomPatches : []) {
    if (patch?.kind && patch.kind !== "reactive_bloom") continue;
    pushCandidate(candidates, "bloom", patch, bloomBounds(patch), surface);
  }
  for (const patch of Array.isArray(reactiveDecor.crystalPatches) ? reactiveDecor.crystalPatches : []) {
    if (patch?.kind && patch.kind !== "reactive_crystal") continue;
    pushCandidate(candidates, "crystal", patch, crystalBounds(patch), surface);
  }

  return candidates;
}

function createReflectedMapper(mapper, surfaceCanvasY) {
  return {
    worldToCanvasRect(x, y, w, h) {
      const rect = mapper.worldToCanvasRect(x, y, w, h);
      return {
        ...rect,
        y: surfaceCanvasY + (surfaceCanvasY - (rect.y + rect.h)),
      };
    },
  };
}

export function drawReactiveDecorMirrorReflections(ctx, mapper, mirrorArea, reactiveDecor = {}, options = {}) {
  if (!ctx || typeof ctx.save !== "function" || !mapper || typeof mapper.worldToCanvasRect !== "function") return false;
  const surface = areaSurface(mirrorArea);
  if (!surface || surface.reflectionHeight <= 0 || surface.reflectionStrength <= 0) return false;

  const candidates = buildReactiveDecorMirrorReflectionCandidates(mirrorArea, reactiveDecor);
  if (!candidates.length) return false;

  const clipRect = mapper.worldToCanvasRect(surface.x, surface.y, surface.width, surface.reflectionHeight);
  if (!clipRect || clipRect.w <= 0 || clipRect.h <= 0) return false;

  const surfacePoint = mapper.worldToCanvasRect(surface.x, surface.y, 1, 1);
  const reflectedMapper = createReflectedMapper(mapper, surfacePoint.y);
  const time = Number.isFinite(options.time) ? options.time : 0;
  const playerX = finiteOr(options.playerCenterX, Number.NaN);
  const playerY = finiteOr(options.playerFootY, Number.NaN);
  let drewAny = false;

  ctx.save();
  ctx.beginPath();
  ctx.rect(clipRect.x, clipRect.y, clipRect.w, clipRect.h);
  ctx.clip();

  for (const candidate of candidates) {
    const fadeProgress = clamp01(Math.max(0, candidate.distanceToSurface) / Math.max(1, candidate.verticalReach));
    const fadeByDistance = 1 - (fadeProgress * surface.fade);
    const alpha = surface.reflectionStrength * fadeByDistance * 0.72;
    if (alpha <= 0.003) continue;

    const phase = (time * 0.001) + (surface.x * 0.031) + (candidate.worldBounds.x * 0.017);
    const shimmerOffsetX = surface.distortion > 0
      ? Math.sin(phase + fadeProgress * Math.PI) * surface.distortion * Math.max(1, candidate.worldBounds.w * 0.12)
      : 0;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (shimmerOffsetX) ctx.translate(shimmerOffsetX, 0);

    if (candidate.type === "grass") {
      renderReactiveGrass(ctx, playerX, playerY, time, {
        mapper: reflectedMapper,
        patches: [candidate.patch],
        disableGustUpdate: true,
      });
    } else if (candidate.type === "bloom") {
      renderReactiveBloomPlants(ctx, playerX, playerY, time, {
        mapper: reflectedMapper,
        patches: [candidate.patch],
      });
    } else if (candidate.type === "crystal") {
      renderReactiveCrystals(ctx, playerX, playerY, time, {
        mapper: reflectedMapper,
        clusters: [candidate.patch],
        wakeSources: Array.isArray(options.crystalWakeSources) ? options.crystalWakeSources : [],
      });
    }

    ctx.restore();
    drewAny = true;
  }

  ctx.restore();
  return drewAny;
}
