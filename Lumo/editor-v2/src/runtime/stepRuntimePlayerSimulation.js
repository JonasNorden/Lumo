import { buildRuntimePlayerIntent } from "./buildRuntimePlayerIntent.js";
import { buildRuntimePlayerLocomotionState } from "./buildRuntimePlayerLocomotionState.js";
import { stepRuntimePlayerVelocityX } from "./stepRuntimePlayerVelocityX.js";
import { stepRuntimePlayerHorizontalState } from "./stepRuntimePlayerHorizontalState.js";
import { buildRuntimePlayerJumpState } from "./buildRuntimePlayerJumpState.js";
import { stepRuntimePlayerVerticalState } from "./stepRuntimePlayerVerticalState.js";
import { buildRuntimePlayerStartState } from "./buildRuntimePlayerStartState.js";
import { isRuntimeGridSolid } from "./isRuntimeGridSolid.js";
import { resolveRuntimeDeltaSeconds } from "./runtimeLegacyPlayerPhysics.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

function resolveFinalLocomotion(finalPlayerState, moveX = 0) {
  const normalizedMoveX = Number.isFinite(moveX) ? Math.max(-1, Math.min(1, Math.trunc(moveX))) : 0;

  if (finalPlayerState?.landed === true) {
    return "landing";
  }

  if (finalPlayerState?.rising === true) {
    return "rising";
  }

  if (finalPlayerState?.falling === true && normalizedMoveX === 0) {
    return "falling";
  }

  if (finalPlayerState?.grounded === true) {
    return normalizedMoveX === 0 ? "idle-grounded" : "moving-grounded";
  }

  return normalizedMoveX === 0 ? "airborne-neutral" : "airborne-moving";
}

const DEFAULT_FLARE_SPEED_PX_PER_SECOND = 360;
const DEFAULT_FLARE_UPWARD_IMPULSE_PX_PER_SECOND = 420;
const DEFAULT_FLARE_LIFETIME_TICKS = 12 * 60;
const DEFAULT_FLARE_RADIUS_PX = 5;
const DEFAULT_FLARE_LIGHT_RADIUS_PX = 220;
const DEFAULT_FLARE_FADE_LAST_TICKS = 3 * 60;
const DEFAULT_FLARE_THROW_ENERGY_COST = 0.11;
const DEFAULT_PLAYER_FLARE_STASH = 1;
const DEFAULT_FLARE_SPAWN_OFFSET_PX = 10;
const DEFAULT_FLARE_SPAWN_HEIGHT_OFFSET_PX = 8;
const DEFAULT_FLARE_GRAVITY_PX_PER_SECOND = 980;
const DEFAULT_FLARE_BOUNCE_ENERGY = 0.4;
const DEFAULT_FLARE_BOUNCE_FRICTION = 0.85;
const DEFAULT_FLARE_MAX_BOUNCES = 2;
const DEFAULT_FLARE_SETTLE_SPEED_PX_PER_SECOND = 24;
const FLARE_MAX_ACTIVE = 8;
const DEFAULT_PULSE_ENERGY_COST = 0.08;
const DEFAULT_PULSE_START_RADIUS_PX = 8;
const DEFAULT_PULSE_START_ALPHA = 0.9;
const DEFAULT_PULSE_START_THICKNESS = 3;
const DEFAULT_PULSE_RADIUS_GROWTH_PX_PER_SECOND = 620;
const DEFAULT_PULSE_ALPHA_FADE_PER_SECOND = 1.25;
const DEFAULT_BOOST_MULTIPLIER = 1.55;
const DEFAULT_BOOST_MIN_ENERGY = 0.04;
const DEFAULT_MOVE_ENERGY_DRAIN_PER_SECOND = 0.06;
const DEFAULT_BOOST_ENERGY_DRAIN_PER_SECOND = 0.18;
const DEFAULT_LANTERN_CHARGE_RATE_PER_SECOND = 0.12;
const DEFAULT_LANTERN_RADIUS_PX = 170;
const DEFAULT_LANTERN_STRENGTH = 0.85;
const DEFAULT_POWERCELL_FILL_DURATION_SECONDS = 1.6;
const ENTITY_HIT_FLASH_TICKS = 6;
const ENTITY_DARK_CREATURE_PULSE_SCALE = 0.55;
const ENTITY_HOVER_VOID_PULSE_SCALE = 0.6;
const ENTITY_DARK_CREATURE_FLARE_CONSUME_BURN_MUL = 7.5;
const PULSE_TARGET_TYPES = new Set(["dark_creature", "hover_void"]);

function resolvePulseTargetType(entityType) {
  if (typeof entityType !== "string") {
    return "";
  }
  const trimmedType = entityType.trim().toLowerCase();
  if (trimmedType.length === 0) {
    return "";
  }
  if (trimmedType.startsWith("dark_creature")) {
    return "dark_creature";
  }
  if (trimmedType.startsWith("hover_void")) {
    return "hover_void";
  }
  return "";
}

function normalizeRuntimeEntity(sourceEntity, index, tileSize, worldWidth, worldHeight) {
  const source = sourceEntity && typeof sourceEntity === "object" ? sourceEntity : {};
  const typeRaw = typeof source.type === "string"
    ? source.type.trim()
    : (typeof source.entityType === "string" ? source.entityType.trim() : "");
  const type = typeRaw.length > 0 ? typeRaw : "dummy";
  const params = source?.params && typeof source.params === "object" ? source.params : {};
  const worldWidthPx = Number.isFinite(worldWidth) && Number.isFinite(tileSize) ? worldWidth * tileSize : null;
  const worldHeightPx = Number.isFinite(worldHeight) && Number.isFinite(tileSize) ? worldHeight * tileSize : null;
  const authoredX = Number.isFinite(source.x) ? source.x : 0;
  const authoredY = Number.isFinite(source.y) ? source.y : 0;
  const worldDimensionsLookTileBased = Number.isFinite(worldWidth) && Number.isFinite(worldHeight) && worldWidth <= 256 && worldHeight <= 256;
  const looksTileBased = (
    worldDimensionsLookTileBased
    && Number.isFinite(tileSize)
    && tileSize > 0
    && Number.isFinite(worldWidthPx)
    && Number.isFinite(worldHeightPx)
    && authoredX >= 0
    && authoredY >= 0
    && authoredX <= worldWidth + 1
    && authoredY <= worldHeight + 1
  );
  const x = looksTileBased ? authoredX * tileSize : authoredX;
  const y = looksTileBased ? authoredY * tileSize : authoredY;
  const size = Number.isFinite(source?.size) && source.size > 0
    ? source.size
    : Number.isFinite(params?.drawW) && params.drawW > 0
      ? params.drawW
      : 24;
  const drawAnchor = String(source?.drawAnchor || params?.drawAnchor || "BL").trim().toUpperCase() === "TL" ? "TL" : "BL";
  const maxHp = Number.isFinite(source?.maxHp) && source.maxHp > 0
    ? Math.floor(source.maxHp)
    : type === "dark_creature_01"
      ? (Number.isFinite(params?.hp) && params.hp > 0 ? Math.floor(params.hp) : 3)
      : type === "hover_void_01"
        ? (Number.isFinite(params?.maxHp) && params.maxHp > 0 ? Math.floor(params.maxHp) : 3)
        : (Number.isFinite(params?.hp) && params.hp > 0 ? Math.floor(params.hp) : 1);
  const hp = Number.isFinite(source?.hp) && source.hp >= 0 ? Math.floor(source.hp) : maxHp;

  return {
    id: typeof source.id === "string" && source.id.length > 0 ? source.id : `runtime-entity-${index + 1}`,
    type,
    x,
    y: looksTileBased && drawAnchor === "BL" ? y + (tileSize - size) : y,
    size,
    drawAnchor,
    hp,
    maxHp,
    alive: source.alive !== false && hp > 0,
    active: source.active !== false && hp > 0,
    state: typeof source.state === "string" ? source.state : "idle",
    lastPulseIdHit: Number.isFinite(source?.lastPulseIdHit) ? Math.floor(source.lastPulseIdHit) : -1,
    hitFlashTicks: Number.isFinite(source?.hitFlashTicks) ? Math.max(0, Math.floor(source.hitFlashTicks)) : 0,
    illuminated: source?.illuminated === true,
    flareExposure: Number.isFinite(source?.flareExposure) ? Math.max(0, source.flareExposure) : 0,
    lastFlareIdHit: Number.isFinite(source?.lastFlareIdHit) ? Math.floor(source.lastFlareIdHit) : -1,
    consumesFlare: source?.consumesFlare === true,
    amount: Number.isFinite(source?.amount) ? Math.max(1, Math.floor(source.amount)) : 1,
    params: params && typeof params === "object" ? { ...params } : {},
  };
}

function isFlarePickupEntityType(entityType) {
  if (typeof entityType !== "string") {
    return false;
  }
  const normalizedType = entityType.trim().toLowerCase();
  return normalizedType === "flare_pickup_01" || normalizedType === "flarepickup" || normalizedType === "flairpickup";
}

function isPowerCellEntityType(entityType) {
  if (typeof entityType !== "string") {
    return false;
  }
  const normalizedType = entityType.trim().toLowerCase();
  return normalizedType === "powercell_01" || normalizedType === "powercell" || normalizedType === "power_cell";
}

function isLanternEntityType(entityType) {
  if (typeof entityType !== "string") {
    return false;
  }
  const normalizedType = entityType.trim().toLowerCase();
  return normalizedType === "lantern_01" || normalizedType === "lantern";
}

function buildPlayerPickupBounds(playerState, tileSize) {
  const width = Number.isFinite(tileSize) && tileSize > 0 ? tileSize : 24;
  const height = Number.isFinite(tileSize) && tileSize > 0 ? tileSize : 24;
  const footX = Number.isFinite(playerState?.position?.x) ? playerState.position.x : 0;
  const footY = Number.isFinite(playerState?.position?.y) ? playerState.position.y : 0;
  return {
    x: footX - width * 0.5,
    y: footY + 1 - height,
    w: width,
    h: height,
  };
}

function resolvePlayerFlareStash(playerState) {
  if (Number.isFinite(playerState?.flareStash)) {
    return Math.max(0, Math.floor(playerState.flareStash));
  }
  return DEFAULT_PLAYER_FLARE_STASH;
}

function isAabbOverlap(a, b) {
  if (!a || !b) {
    return false;
  }
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function stepPickupCollection(worldPacket, playerState, sourceEntities) {
  if (!Array.isArray(sourceEntities) || sourceEntities.length === 0) {
    return {
      entities: [],
      flareStash: resolvePlayerFlareStash(playerState),
      flareCollectedCount: 0,
      flareCollectedIds: [],
      powerCellCollectedCount: 0,
      powerCellFill: playerState?.powerCellFill ?? playerState?.__pcFill ?? null,
    };
  }

  const tileSize = Number.isFinite(worldPacket?.world?.tileSize) && worldPacket.world.tileSize > 0 ? worldPacket.world.tileSize : 24;
  const playerBounds = buildPlayerPickupBounds(playerState, tileSize);
  let flareStash = resolvePlayerFlareStash(playerState);
  let flareCollectedCount = 0;
  const flareCollectedIds = [];
  let powerCellCollectedCount = 0;
  let powerCellFill = playerState?.powerCellFill ?? playerState?.__pcFill ?? null;

  const entities = sourceEntities.map((entity) => {
    const next = { ...entity };
    if (next.active !== true || (!isFlarePickupEntityType(next.type) && !isPowerCellEntityType(next.type))) {
      return next;
    }

    const size = Number.isFinite(next?.size) && next.size > 0 ? next.size : Math.max(12, tileSize * 0.5);
    const entityBounds = {
      x: Number.isFinite(next?.x) ? next.x : 0,
      y: Number.isFinite(next?.y) ? next.y : 0,
      w: size,
      h: size,
    };
    if (!isAabbOverlap(playerBounds, entityBounds)) {
      return next;
    }

    next.active = false;
    next.alive = false;
    next.state = "collected";
    if (isFlarePickupEntityType(next.type)) {
      const pickupAmount = Number.isFinite(next?.amount)
        ? next.amount
        : (Number.isFinite(next?.params?.amount) ? next.params.amount : 1);
      flareStash += Math.max(1, Math.floor(pickupAmount));
      flareCollectedCount += 1;
      if (typeof next.id === "string" && next.id.length > 0) {
        flareCollectedIds.push(next.id);
      }
      return next;
    }
    // Power-cell starts the same V1 timed ease-out refill instead of instant full.
    powerCellFill = { t: 0, dur: DEFAULT_POWERCELL_FILL_DURATION_SECONDS, from: null };
    powerCellCollectedCount += 1;
    return next;
  });

  return {
    entities,
    flareStash,
    flareCollectedCount,
    flareCollectedIds,
    powerCellCollectedCount,
    powerCellFill,
  };
}

function stepPowerCellRecharge(playerState, currentEnergy, options = {}) {
  const dt = resolveRuntimeDeltaSeconds(options);
  const sourceFill = playerState?.powerCellFill ?? playerState?.__pcFill;
  if (!sourceFill || typeof sourceFill !== "object") {
    return { energy: currentEnergy, powerCellFill: null };
  }

  const duration = Number.isFinite(sourceFill?.dur) && sourceFill.dur > 0
    ? sourceFill.dur
    : DEFAULT_POWERCELL_FILL_DURATION_SECONDS;
  const nextElapsed = (Number.isFinite(sourceFill?.t) ? sourceFill.t : 0) + dt;
  const progress = Math.max(0, Math.min(1, nextElapsed / duration));
  const easeOut = 1 - Math.pow(1 - progress, 3);
  const fromEnergy = Number.isFinite(sourceFill?.from)
    ? sourceFill.from
    : (Number.isFinite(currentEnergy) ? currentEnergy : 0);
  const nextEnergy = Math.max(0, Math.min(1, fromEnergy + (1 - fromEnergy) * easeOut));
  if (progress >= 1) {
    return { energy: 1, powerCellFill: null };
  }

  return {
    energy: nextEnergy,
    powerCellFill: { ...sourceFill, t: nextElapsed, dur: duration, from: fromEnergy },
  };
}

function stepLanternAuraRecharge(playerState, sourceEntities, currentEnergy, options = {}) {
  if (!Array.isArray(sourceEntities) || sourceEntities.length === 0) {
    return currentEnergy;
  }
  const dt = resolveRuntimeDeltaSeconds(options);
  const tileSize = Number.isFinite(options?.tileSize) && options.tileSize > 0
    ? options.tileSize
    : (Number.isFinite(options?.world?.tileSize) && options.world.tileSize > 0 ? options.world.tileSize : 24);
  const playerBounds = buildPlayerPickupBounds(playerState, tileSize);
  const playerCenterX = playerBounds.x + playerBounds.w * 0.5;
  const playerCenterY = playerBounds.y + playerBounds.h * 0.5;
  let chargedEnergy = currentEnergy;

  // Lantern aura recharge matches V1: continuous charge while standing inside radius.
  for (const entity of sourceEntities) {
    if (entity?.active !== true || !isLanternEntityType(entity?.type)) {
      continue;
    }
    const center = getEntityCenter(entity);
    const radius = Number.isFinite(entity?.params?.radius) && entity.params.radius > 0
      ? entity.params.radius
      : DEFAULT_LANTERN_RADIUS_PX;
    const strength = Number.isFinite(entity?.params?.strength) && entity.params.strength > 0
      ? entity.params.strength
      : DEFAULT_LANTERN_STRENGTH;
    const distance = Math.hypot(playerCenterX - center.x, playerCenterY - center.y);
    if (distance > radius) {
      continue;
    }
    chargedEnergy += strength * DEFAULT_LANTERN_CHARGE_RATE_PER_SECOND * dt;
  }

  return Math.max(0, Math.min(1, chargedEnergy));
}

function getEntityCenter(entity) {
  const size = Number.isFinite(entity?.size) && entity.size > 0 ? entity.size : 24;
  const x = Number.isFinite(entity?.x) ? entity.x : 0;
  const y = Number.isFinite(entity?.y) ? entity.y : 0;
  return {
    x: x + size * 0.5,
    y: y + size * 0.5,
  };
}

function normalizeRuntimeEntities(sourceEntities, worldPacket, playerState) {
  const tileSize = worldPacket?.world?.tileSize;
  const worldWidth = worldPacket?.world?.width;
  const worldHeight = worldPacket?.world?.height;
  if (Array.isArray(sourceEntities) && sourceEntities.length > 0) {
    return sourceEntities.map((entity, index) => normalizeRuntimeEntity(entity, index, tileSize, worldWidth, worldHeight));
  }

  const layerEntities = Array.isArray(worldPacket?.layers?.entities) ? worldPacket.layers.entities : [];
  const authoredEntities = layerEntities
    .filter((entity) => entity && typeof entity === "object")
    .map((entity, index) => normalizeRuntimeEntity(entity, index, tileSize, worldWidth, worldHeight));
  if (authoredEntities.length > 0) {
    return authoredEntities;
  }

  return [];
}

function isDebugEntityFallbackEnabled(options = {}) {
  if (options?.runtimeConfig?.debugEntities === true || options?.debugEntities === true) {
    return true;
  }

  try {
    const search = globalThis?.location?.search;
    if (typeof search === "string" && search.length > 0) {
      const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
      return params.get("debugEntities") === "1";
    }
  } catch (_error) {
    // Query parsing is best-effort only and should never break runtime simulation.
  }

  return false;
}

function resolveDebugFallbackEntities(worldPacket, playerState) {
  const tileSize = worldPacket?.world?.tileSize;
  const worldWidth = worldPacket?.world?.width;
  const worldHeight = worldPacket?.world?.height;
  const playerX = Number.isFinite(playerState?.position?.x) ? playerState.position.x : 0;
  const playerY = Number.isFinite(playerState?.position?.y) ? playerState.position.y : 0;
  return [normalizeRuntimeEntity({
    id: "runtime-dummy-1",
    type: "dummy",
    x: playerX + 48,
    y: playerY,
    hp: 1,
    maxHp: 1,
  }, 0, tileSize, worldWidth, worldHeight)];
}

function stepPulseEntityInteractions(worldPacket, playerState, pulse, sourceEntities, runtimeOptions = {}) {
  const normalizedEntities = normalizeRuntimeEntities(sourceEntities, worldPacket, playerState);
  const entities = normalizedEntities.length > 0
    ? normalizedEntities
    : isDebugEntityFallbackEnabled(runtimeOptions) ? resolveDebugFallbackEntities(worldPacket, playerState) : [];
  if (!Array.isArray(entities) || entities.length === 0) {
    return { entities: [], hits: [] };
  }

  const tileSize = Number.isFinite(worldPacket?.world?.tileSize) && worldPacket.world.tileSize > 0 ? worldPacket.world.tileSize : 24;
  const pulseCenterX = Number.isFinite(pulse?.x) ? pulse.x + tileSize * 0.5 : null;
  const pulseCenterY = Number.isFinite(pulse?.y) ? pulse.y + tileSize * 0.5 : null;
  const pulseActive = pulse?.active === true && Number.isFinite(pulse?.r) && pulse.r > 0;
  const pulseId = Number.isFinite(pulse?.id) ? Math.floor(pulse.id) : 0;
  const hits = [];

  const nextEntities = entities.map((entity) => {
    const next = { ...entity };
    const pulseTargetType = resolvePulseTargetType(next.type);
    const isPulseTarget = PULSE_TARGET_TYPES.has(pulseTargetType);
    if (next.alive !== true || next.active !== true) {
      next.state = "inactive";
      return next;
    }

    if (!isPulseTarget) {
      return next;
    }

    if (next.hitFlashTicks > 0) {
      next.hitFlashTicks -= 1;
    }

    if (!pulseActive || pulseId <= 0 || pulseId === next.lastPulseIdHit || !Number.isFinite(pulseCenterX) || !Number.isFinite(pulseCenterY)) {
      if (next.state !== "hit") {
        next.state = "idle";
      }
      return next;
    }

    const center = getEntityCenter(next);
    const dx = pulseCenterX - center.x;
    const dy = pulseCenterY - center.y;
    const dist = Math.hypot(dx, dy);
    const pulseScale = pulseTargetType === "hover_void" ? ENTITY_HOVER_VOID_PULSE_SCALE : ENTITY_DARK_CREATURE_PULSE_SCALE;
    const threshold = pulse.r + Math.max(1, next.size) * pulseScale;
    if (dist > threshold) {
      if (next.state !== "hit") {
        next.state = "idle";
      }
      return next;
    }

    next.lastPulseIdHit = pulseId;
    next.hp = Math.max(0, next.hp - 1);
    next.hitFlashTicks = ENTITY_HIT_FLASH_TICKS;
    next.state = next.hp <= 0 ? "defeated" : "hit";
    if (next.hp <= 0) {
      next.alive = false;
      next.active = false;
    }
    hits.push({ id: next.id, type: next.type, pulseId });
    return next;
  });

  return { entities: nextEntities, hits };
}

function buildFlareLightSnapshot(flare) {
  if (!flare || !Number.isFinite(flare.x) || !Number.isFinite(flare.y)) {
    return null;
  }
  const lightRadiusBase = Number.isFinite(flare?.lightRadius) && flare.lightRadius > 0 ? flare.lightRadius : DEFAULT_FLARE_LIGHT_RADIUS_PX;
  const ttlTicks = Number.isFinite(flare?.ttlTicks) ? flare.ttlTicks : 0;
  const lifetimeTicks = Number.isFinite(flare?.lifetimeTicks) && flare.lifetimeTicks > 0 ? flare.lifetimeTicks : DEFAULT_FLARE_LIFETIME_TICKS;
  const ageTicks = Number.isFinite(flare?.ageTicks) && flare.ageTicks >= 0 ? flare.ageTicks : Math.max(0, lifetimeTicks - ttlTicks);
  const fadeLastTicks = Number.isFinite(flare?.fadeLastTicks) && flare.fadeLastTicks > 0 ? flare.fadeLastTicks : DEFAULT_FLARE_FADE_LAST_TICKS;
  let lightScale = 1;
  if (fadeLastTicks > 0) {
    const fadeStartTick = Math.max(0, lifetimeTicks - fadeLastTicks);
    if (ageTicks > fadeStartTick) {
      const fadeProgress = Math.max(0, Math.min(1, (ageTicks - fadeStartTick) / fadeLastTicks));
      lightScale = Math.max(0, 1 - fadeProgress);
    }
  }
  return {
    id: Number.isFinite(flare?.id) ? Math.floor(flare.id) : -1,
    x: flare.x,
    y: flare.y,
    lightRadius: lightRadiusBase * lightScale,
  };
}

function stepFlareEntityInteractions(sourceEntities, flares) {
  if (!Array.isArray(sourceEntities) || sourceEntities.length === 0) {
    return { entities: [], flareAffects: [] };
  }

  const flareLights = Array.isArray(flares)
    ? flares.map((flare) => buildFlareLightSnapshot(flare)).filter((flare) => flare && flare.lightRadius > 0)
    : [];
  const flareAffects = [];
  const entities = sourceEntities.map((entity) => {
    const next = { ...entity };
    const targetType = resolvePulseTargetType(next.type);
    if (next.alive !== true || next.active !== true || targetType !== "dark_creature") {
      next.illuminated = false;
      next.flareExposure = 0;
      next.consumesFlare = false;
      return next;
    }

    let illuminated = false;
    let maxExposure = 0;
    let closestFlareId = -1;
    let closestDist = Infinity;
    const entityCenter = getEntityCenter(next);
    for (const flare of flareLights) {
      const dist = Math.hypot((flare.x - entityCenter.x), (flare.y - entityCenter.y));
      if (dist > flare.lightRadius) {
        continue;
      }
      illuminated = true;
      maxExposure = Math.max(maxExposure, 1 - (dist / Math.max(1, flare.lightRadius)));
      if (dist < closestDist) {
        closestDist = dist;
        closestFlareId = flare.id;
      }
    }

    next.illuminated = illuminated;
    next.flareExposure = illuminated ? maxExposure : 0;
    next.consumesFlare = illuminated;
    if (illuminated && closestFlareId > 0) {
      next.lastFlareIdHit = closestFlareId;
      flareAffects.push({ entityId: next.id, entityType: next.type, flareId: closestFlareId });
    }
    if (next.state === "idle" && illuminated) {
      next.state = "suppressed";
    } else if (next.state === "suppressed" && !illuminated) {
      next.state = "idle";
    }
    return next;
  });

  return { entities, flareAffects };
}

function resolvePlayerFacingX(playerState, intentMoveX = 0) {
  if (intentMoveX > 0) {
    return 1;
  }
  if (intentMoveX < 0) {
    return -1;
  }

  const previousFacingX = Number.isFinite(playerState?.facingX) ? Math.sign(playerState.facingX) : 0;
  if (previousFacingX > 0) {
    return 1;
  }
  if (previousFacingX < 0) {
    return -1;
  }

  const previousVelocityX = Number.isFinite(playerState?.velocity?.x) ? playerState.velocity.x : 0;
  if (previousVelocityX > 0) {
    return 1;
  }
  if (previousVelocityX < 0) {
    return -1;
  }

  return 1;
}

function normalizePulseState(playerState) {
  const pulse = playerState?.pulse;
  return {
    active: pulse?.active === true,
    r: Number.isFinite(pulse?.r) ? pulse.r : 0,
    alpha: Number.isFinite(pulse?.alpha) ? pulse.alpha : 0,
    thickness: Number.isFinite(pulse?.thickness) ? pulse.thickness : DEFAULT_PULSE_START_THICKNESS,
    id: Number.isFinite(pulse?.id) ? Math.max(0, Math.floor(pulse.id)) : 0,
    heldLastTick: playerState?.pulseHeldLastTick === true,
  };
}

function stepPulse(playerState, intent, options = {}) {
  const dt = resolveRuntimeDeltaSeconds(options);
  const pulse = normalizePulseState(playerState);
  const pressedThisTick = intent?.pulse === true && pulse.heldLastTick !== true;
  const previousEnergy = Number.isFinite(playerState?.energy) ? playerState.energy : 1;
  const canStartPulse = pressedThisTick && previousEnergy > DEFAULT_PULSE_ENERGY_COST;

  let nextPulseId = pulse.id;
  let nextEnergy = previousEnergy;
  if (canStartPulse) {
    nextPulseId += 1;
    nextEnergy = Math.max(0, previousEnergy - DEFAULT_PULSE_ENERGY_COST);
    pulse.active = true;
    pulse.r = DEFAULT_PULSE_START_RADIUS_PX;
    pulse.alpha = DEFAULT_PULSE_START_ALPHA;
    pulse.thickness = DEFAULT_PULSE_START_THICKNESS;
    pulse.id = nextPulseId;
  }

  if (pulse.active) {
    pulse.r += DEFAULT_PULSE_RADIUS_GROWTH_PX_PER_SECOND * dt;
    pulse.alpha -= DEFAULT_PULSE_ALPHA_FADE_PER_SECOND * dt;
    pulse.thickness = 2 + Math.max(0, pulse.alpha) * 3;
    if (pulse.alpha <= 0) {
      pulse.active = false;
    }
  }

  const pulseX = Number.isFinite(playerState?.position?.x) ? playerState.position.x : null;
  const pulseY = Number.isFinite(playerState?.position?.y) ? playerState.position.y : null;

  return {
    pulse: {
      active: pulse.active,
      r: pulse.r,
      alpha: pulse.alpha,
      thickness: pulse.thickness,
      id: pulse.id,
      x: pulseX,
      y: pulseY,
    },
    pulseHeldLastTick: intent?.pulse === true,
    pulseStarted: canStartPulse,
    pulseSuppressedByEnergy: pressedThisTick && !canStartPulse,
    energy: nextEnergy,
  };
}

function buildFlareProjectile(playerState, facingX, flareId) {
  const playerX = Number.isFinite(playerState?.position?.x) ? playerState.position.x : 0;
  const playerY = Number.isFinite(playerState?.position?.y) ? playerState.position.y : 0;
  const directionX = facingX < 0 ? -1 : 1;

  return {
    id: Number.isFinite(flareId) ? flareId : 1,
    x: playerX + directionX * DEFAULT_FLARE_SPAWN_OFFSET_PX,
    y: playerY - DEFAULT_FLARE_SPAWN_HEIGHT_OFFSET_PX,
    vx: directionX * DEFAULT_FLARE_SPEED_PX_PER_SECOND,
    vy: -DEFAULT_FLARE_UPWARD_IMPULSE_PX_PER_SECOND,
    grounded: false,
    settled: false,
    bounceCount: 0,
    ttlTicks: DEFAULT_FLARE_LIFETIME_TICKS,
    ttl: DEFAULT_FLARE_LIFETIME_TICKS * (1 / 60),
    ageTicks: 0,
    radius: DEFAULT_FLARE_RADIUS_PX,
    lightRadius: DEFAULT_FLARE_LIGHT_RADIUS_PX,
    lifetimeTicks: DEFAULT_FLARE_LIFETIME_TICKS,
    fadeLastTicks: DEFAULT_FLARE_FADE_LAST_TICKS,
    collided: false,
    expired: false,
  };
}

function normalizeExistingFlares(playerState) {
  if (!Array.isArray(playerState?.flares)) {
    return [];
  }

  return playerState.flares
    .map((flare, index) => ({
      id: Number.isFinite(flare?.id) ? flare.id : index + 1,
      x: Number.isFinite(flare?.x) ? flare.x : null,
      y: Number.isFinite(flare?.y) ? flare.y : null,
      vx: Number.isFinite(flare?.vx) ? flare.vx : 0,
      vy: Number.isFinite(flare?.vy) ? flare.vy : 0,
      grounded: flare?.grounded === true,
      settled: flare?.settled === true,
      bounceCount: Number.isFinite(flare?.bounceCount) && flare.bounceCount >= 0 ? Math.floor(flare.bounceCount) : 0,
      ttlTicks: Number.isFinite(flare?.ttlTicks) && flare.ttlTicks > 0
        ? Math.floor(flare.ttlTicks)
        : (Number.isFinite(flare?.ttl) && flare.ttl > 0 ? Math.ceil(flare.ttl * 60) : 0),
      ageTicks: Number.isFinite(flare?.ageTicks) && flare.ageTicks >= 0 ? Math.floor(flare.ageTicks) : 0,
      radius: Number.isFinite(flare?.radius) && flare.radius > 0 ? flare.radius : DEFAULT_FLARE_RADIUS_PX,
      lightRadius: Number.isFinite(flare?.lightRadius) && flare.lightRadius > 0 ? flare.lightRadius : DEFAULT_FLARE_LIGHT_RADIUS_PX,
      lifetimeTicks: Number.isFinite(flare?.lifetimeTicks) && flare.lifetimeTicks > 0 ? Math.floor(flare.lifetimeTicks) : DEFAULT_FLARE_LIFETIME_TICKS,
      fadeLastTicks: Number.isFinite(flare?.fadeLastTicks) && flare.fadeLastTicks > 0 ? Math.floor(flare.fadeLastTicks) : DEFAULT_FLARE_FADE_LAST_TICKS,
    }))
    .filter((flare) => flare.x !== null && flare.y !== null && flare.ttlTicks > 0);
}

function resolveWorldDimensionPx(value, tileSize) {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (!Number.isFinite(tileSize) || tileSize <= 0) {
    return value;
  }
  return value * tileSize;
}

function stepFlares(worldPacket, playerState, intent, options = {}) {
  const tileSize = worldPacket?.world?.tileSize;
  const worldWidthPx = resolveWorldDimensionPx(worldPacket?.world?.width, tileSize);
  const worldHeightPx = resolveWorldDimensionPx(worldPacket?.world?.height, tileSize);
  const dt = resolveRuntimeDeltaSeconds(options);
  const facingX = resolvePlayerFacingX(playerState, intent.moveX);
  const previousHeld = playerState?.flareHeldLastTick === true;
  const pressedThisTick = intent?.flare === true && previousHeld !== true;
  const flareStash = Number.isFinite(options?.flareStash)
    ? Math.max(0, Math.floor(options.flareStash))
    : resolvePlayerFlareStash(playerState);
  const availableEnergy = Number.isFinite(options?.availableEnergy)
    ? options.availableEnergy
    : (Number.isFinite(playerState?.energy) ? playerState.energy : 1);

  const existingFlares = normalizeExistingFlares(playerState);
  const existingEntities = normalizeRuntimeEntities(options?.entities, worldPacket, playerState);
  const nextFlareIdBase = Number.isFinite(playerState?.nextFlareId) ? Math.max(1, Math.floor(playerState.nextFlareId)) : 1;
  const nextFlares = [];
  const cleanupStats = { expired: 0, collided: 0, culled: 0 };

  function isSolidAtPixel(pixelX, pixelY) {
    if (!Number.isFinite(tileSize) || tileSize <= 0) {
      return false;
    }
    const gridX = Math.floor(pixelX / tileSize);
    const gridY = Math.floor(pixelY / tileSize);
    return isRuntimeGridSolid(worldPacket, gridX, gridY);
  }

  for (const flare of existingFlares) {
    const isSettled = flare.settled === true;
    let nextVx = Number.isFinite(flare.vx) ? flare.vx : 0;
    let nextVy = Number.isFinite(flare.vy) ? flare.vy : 0;
    let nextX = Number.isFinite(flare.x) ? flare.x : 0;
    let nextY = Number.isFinite(flare.y) ? flare.y : 0;
    let nextGrounded = flare.grounded === true;
    let nextSettled = isSettled;
    let nextBounceCount = Number.isFinite(flare.bounceCount) ? Math.max(0, Math.floor(flare.bounceCount)) : 0;

    if (!isSettled) {
      nextVy += DEFAULT_FLARE_GRAVITY_PX_PER_SECOND * dt;

      const horizontalCandidateX = nextX + nextVx * dt;
      const hitLeft = isSolidAtPixel(horizontalCandidateX - flare.radius, nextY);
      const hitRight = isSolidAtPixel(horizontalCandidateX + flare.radius, nextY);
      if (hitLeft || hitRight) {
        nextVx *= -DEFAULT_FLARE_BOUNCE_ENERGY;
      } else {
        nextX = horizontalCandidateX;
      }

      const verticalCandidateY = nextY + nextVy * dt;
      const hitCeiling = isSolidAtPixel(nextX, verticalCandidateY - flare.radius);
      const hitGround = isSolidAtPixel(nextX, verticalCandidateY + flare.radius);
      if (hitCeiling && nextVy < 0) {
        nextVy *= -DEFAULT_FLARE_BOUNCE_ENERGY;
      } else if (hitGround && nextVy > 0) {
        const groundGridY = Math.floor((verticalCandidateY + flare.radius) / tileSize);
        nextY = groundGridY * tileSize - flare.radius - 0.001;
        nextBounceCount += 1;
        if (nextBounceCount > DEFAULT_FLARE_MAX_BOUNCES || Math.abs(nextVy) < DEFAULT_FLARE_SETTLE_SPEED_PX_PER_SECOND) {
          nextVx = 0;
          nextVy = 0;
          nextGrounded = true;
          nextSettled = true;
        } else {
          nextVy = -Math.abs(nextVy) * DEFAULT_FLARE_BOUNCE_ENERGY;
          nextVx *= DEFAULT_FLARE_BOUNCE_FRICTION;
          nextGrounded = false;
        }
      } else {
        nextY = verticalCandidateY;
        nextGrounded = false;
      }
    }

    const consumesByNearbyDarkCreature = existingEntities.some((entity) => {
      const targetType = resolvePulseTargetType(entity?.type);
      if (targetType !== "dark_creature" || entity?.alive !== true || entity?.active !== true) {
        return false;
      }
      const aggroRange = Math.max(0, (Number.isFinite(entity?.size) ? entity.size : 24) * 6);
      const entityCenter = getEntityCenter(entity);
      const dist = Math.hypot(entityCenter.x - nextX, entityCenter.y - nextY);
      return dist <= aggroRange;
    });
    const burnMul = consumesByNearbyDarkCreature ? ENTITY_DARK_CREATURE_FLARE_CONSUME_BURN_MUL : 1;
    const nextTtlTicks = flare.ttlTicks - burnMul;
    const nextAgeTicks = flare.ageTicks + 1;

    const outsideBounds = (
      Number.isFinite(worldWidthPx) && Number.isFinite(worldHeightPx)
      && (nextX < -tileSize || nextX > worldWidthPx + tileSize || nextY < -tileSize || nextY > worldHeightPx + tileSize)
    );
    const expired = nextTtlTicks <= 0;

    if (expired || outsideBounds) {
      if (expired) {
        cleanupStats.expired += 1;
      } else {
        cleanupStats.culled += 1;
      }
      continue;
    }

    nextFlares.push({
      ...flare,
      x: nextX,
      y: nextY,
      vx: nextVx,
      vy: nextVy,
      grounded: nextGrounded,
      settled: nextSettled,
      bounceCount: nextBounceCount,
      ttlTicks: nextTtlTicks,
      ttl: nextTtlTicks * dt,
      ageTicks: nextAgeTicks,
      lightRadius: flare.lightRadius,
      lifetimeTicks: flare.lifetimeTicks,
      fadeLastTicks: flare.fadeLastTicks,
      collided: false,
      expired: false,
    });
  }

  let nextFlareId = nextFlareIdBase;
  const canThrowByStash = flareStash > 0;
  const canThrowByEnergy = availableEnergy >= DEFAULT_FLARE_THROW_ENERGY_COST;
  let nextFlareStash = flareStash;
  let nextEnergy = availableEnergy;
  const throwAllowed = pressedThisTick && nextFlares.length < FLARE_MAX_ACTIVE && canThrowByStash && canThrowByEnergy;
  if (throwAllowed) {
    nextFlares.push(buildFlareProjectile(playerState, facingX, nextFlareId));
    nextFlareId += 1;
    nextFlareStash = Math.max(0, flareStash - 1);
    nextEnergy = Math.max(0, availableEnergy - DEFAULT_FLARE_THROW_ENERGY_COST);
  }

  return {
    flares: nextFlares,
    flareHeldLastTick: intent?.flare === true,
    flareSpawned: throwAllowed,
    flareStash: nextFlareStash,
    energy: nextEnergy,
    flareThrowSuppressedByEmptyStash: pressedThisTick && !canThrowByStash,
    flareThrowSuppressedByEnergy: pressedThisTick && canThrowByStash && !canThrowByEnergy,
    facingX,
    nextFlareId,
    cleanup: cleanupStats,
  };
}

function resolveBottomBoundRespawnY(worldPacket, options = {}) {
  const tileSize = worldPacket?.world?.tileSize;
  const worldHeight = worldPacket?.world?.height;
  const tileBoundsMaxY = worldPacket?.tileBounds?.maxY;
  const spawnY = worldPacket?.spawn?.y;
  const marginTiles = Number.isFinite(options?.bounds?.fallRespawnMarginTiles)
    ? Math.max(0, Math.floor(options.bounds.fallRespawnMarginTiles))
    : 4;

  if (!Number.isFinite(tileSize) || tileSize <= 0) {
    return null;
  }

  function resolveWorldYUnit(value) {
    if (!Number.isFinite(value)) {
      return null;
    }

    if (!Number.isFinite(spawnY)) {
      return value;
    }

    const directDistance = Math.abs(spawnY - value);
    const tiledValue = (value + 1) * tileSize - 1;
    const tiledDistance = Math.abs(spawnY - tiledValue);
    return tiledDistance < directDistance ? tiledValue : value;
  }

  if (Number.isFinite(tileBoundsMaxY)) {
    const playableBottomY = resolveWorldYUnit(tileBoundsMaxY);
    return playableBottomY + marginTiles * tileSize;
  }

  if (Number.isFinite(worldHeight) && worldHeight > 0) {
    const playableBottomY = resolveWorldYUnit(worldHeight);
    return playableBottomY + marginTiles * tileSize;
  }

  return null;
}

// Respawns to authored spawn after leaving the valid playable region downward.
function maybeResolveBottomRespawn(worldPacket, verticalStep, options = {}) {
  const respawnY = resolveBottomBoundRespawnY(worldPacket, options);
  const currentY = verticalStep?.position?.y;
  const shouldRespawn = Number.isFinite(respawnY) && Number.isFinite(currentY) && currentY > respawnY;

  if (!shouldRespawn) {
    return null;
  }

  const spawnState = buildRuntimePlayerStartState(worldPacket);
  const spawnX = Number.isFinite(spawnState?.position?.x) ? spawnState.position.x : worldPacket?.spawn?.x;
  const spawnY = Number.isFinite(spawnState?.position?.y) ? spawnState.position.y : worldPacket?.spawn?.y;
  const grounded = spawnState?.grounded === true;
  const falling = spawnState?.falling === true;

  return {
    player: {
      position: { x: spawnX, y: spawnY },
      velocity: { x: 0, y: 0 },
      grounded,
      falling,
      rising: false,
      landed: false,
      status: "respawned-out-of-bounds",
    },
    debug: {
      respawned: true,
      triggerY: currentY,
      respawnY,
      spawnX,
      spawnY,
    },
    warning: "Player fell below playable world bounds and was respawned at authored spawn.",
  };
}

// Executes one deterministic tick: intent -> locomotion -> velocityX -> horizontal -> jump -> vertical.
export function stepRuntimePlayerSimulation(worldPacket, playerState, options = {}) {
  const intent = buildRuntimePlayerIntent(options?.input ?? options?.intent ?? options);
  const pulseStep = stepPulse(playerState, intent, options);
  const boostActive = intent?.boost === true && pulseStep.energy > DEFAULT_BOOST_MIN_ENERGY;
  const locomotionStateBase = buildRuntimePlayerLocomotionState(playerState, intent, options);
  const locomotionState = boostActive
    ? {
        ...locomotionStateBase,
        desiredVelocityX: locomotionStateBase.desiredVelocityX * DEFAULT_BOOST_MULTIPLIER,
        maxSpeedX: locomotionStateBase.maxSpeedX * DEFAULT_BOOST_MULTIPLIER,
      }
    : locomotionStateBase;
  const velocityXStep = stepRuntimePlayerVelocityX(playerState, locomotionState);

  const horizontalStep = stepRuntimePlayerHorizontalState(worldPacket, playerState, {
    velocityX: velocityXStep.velocityX,
    options,
    errors: uniqueMessages([...(locomotionState.errors ?? []), ...(velocityXStep.errors ?? [])]),
    warnings: uniqueMessages([...(locomotionState.warnings ?? []), ...(velocityXStep.warnings ?? [])]),
  });

  if (horizontalStep.ok !== true) {
    return {
      ok: false,
      player: null,
      collisions: {
        moveX: intent.moveX,
        jump: intent.jump === true,
        locomotion: locomotionState.locomotion,
        velocityX: velocityXStep.velocityX,
        blockedLeft: horizontalStep.blockedLeft === true,
        blockedRight: horizontalStep.blockedRight === true,
        grounded: false,
        falling: false,
        rising: false,
        landed: false,
        collidedBelow: false,
      },
      status: horizontalStep.status ?? "horizontal-step-failed",
      errors: uniqueMessages(horizontalStep.errors),
      warnings: uniqueMessages([...horizontalStep.warnings, ...intent.warnings]),
      debug: {
        intent,
        locomotion: locomotionState,
        velocityX: velocityXStep,
        horizontal: horizontalStep,
        jump: null,
        vertical: null,
      },
    };
  }

  const preVerticalState = {
    ...playerState,
    position: horizontalStep.position,
    velocity: horizontalStep.velocity,
    errors: uniqueMessages([
      ...(playerState?.errors ?? []),
      ...(horizontalStep.errors ?? []),
      ...(locomotionState.errors ?? []),
      ...(velocityXStep.errors ?? []),
      ...(intent.errors ?? []),
    ]),
    warnings: uniqueMessages([
      ...(playerState?.warnings ?? []),
      ...(horizontalStep.warnings ?? []),
      ...(locomotionState.warnings ?? []),
      ...(velocityXStep.warnings ?? []),
      ...(intent.warnings ?? []),
    ]),
  };

  const jumpState = buildRuntimePlayerJumpState(worldPacket, preVerticalState, intent, options);
  const verticalInputState = {
    ...preVerticalState,
    grounded: jumpState.grounded === true,
    velocity: jumpState.velocity,
    coyoteTimer: Number.isFinite(jumpState?.coyoteTimer) ? jumpState.coyoteTimer : preVerticalState?.coyoteTimer,
    jumpBufferTimer: Number.isFinite(jumpState?.jumpBufferTimer) ? jumpState.jumpBufferTimer : preVerticalState?.jumpBufferTimer,
    jumpHeldLastTick: jumpState?.jumpHeldLastTick === true,
    errors: uniqueMessages([...(preVerticalState?.errors ?? []), ...(jumpState.errors ?? [])]),
    warnings: uniqueMessages([...(preVerticalState?.warnings ?? []), ...(jumpState.warnings ?? [])]),
  };

  const verticalStep = stepRuntimePlayerVerticalState(worldPacket, verticalInputState, options);

  if (verticalStep.ok !== true) {
    return {
      ok: false,
      player: null,
      collisions: {
        moveX: intent.moveX,
        jump: intent.jump === true,
        locomotion: locomotionState.locomotion,
        velocityX: horizontalStep.velocity?.x ?? velocityXStep.velocityX,
        blockedLeft: horizontalStep.blockedLeft === true,
        blockedRight: horizontalStep.blockedRight === true,
        grounded: false,
        falling: false,
        rising: false,
        landed: false,
        collidedBelow: verticalStep?.collidedBelow === true,
      },
      status: verticalStep.status ?? "vertical-step-failed",
      errors: uniqueMessages(verticalStep.errors),
      warnings: uniqueMessages(verticalStep.warnings),
      debug: {
        intent,
        locomotion: locomotionState,
        velocityX: velocityXStep,
        horizontal: horizontalStep,
        jump: jumpState,
        vertical: verticalStep,
      },
    };
  }

  const bottomRespawn = maybeResolveBottomRespawn(worldPacket, verticalStep, options);
  const resolvedPlayerStep = bottomRespawn?.player ?? verticalStep;
  const normalizedEntities = normalizeRuntimeEntities(options?.entities, worldPacket, playerState);
  const pickupStep = stepPickupCollection(worldPacket, {
    ...playerState,
    position: resolvedPlayerStep.position,
  }, normalizedEntities);
  const flareStep = stepFlares(worldPacket, playerState, intent, {
    ...options,
    flareStash: pickupStep.flareStash,
    availableEnergy: pulseStep.energy,
  });
  const flareEntityStep = stepFlareEntityInteractions(
    pickupStep.entities,
    flareStep.flares,
  );
  const entityStep = stepPulseEntityInteractions(worldPacket, playerState, pulseStep.pulse, flareEntityStep.entities, options);
  const dt = resolveRuntimeDeltaSeconds(options);
  const moving = intent?.moveX !== 0;
  let nextEnergy = flareStep.energy;
  if (moving) {
    nextEnergy -= DEFAULT_MOVE_ENERGY_DRAIN_PER_SECOND * dt;
  }
  if (boostActive) {
    nextEnergy -= DEFAULT_BOOST_ENERGY_DRAIN_PER_SECOND * dt;
  }
  nextEnergy = stepLanternAuraRecharge(
    { ...playerState, position: resolvedPlayerStep.position },
    entityStep.entities,
    nextEnergy,
    { ...options, tileSize: worldPacket?.world?.tileSize, world: worldPacket?.world },
  );
  const powerCellRecharge = stepPowerCellRecharge(
    { ...playerState, powerCellFill: pickupStep.powerCellFill },
    nextEnergy,
    options,
  );
  nextEnergy = powerCellRecharge.energy;
  const status = resolvedPlayerStep.status;
  const finalPlayerState = {
    grounded: resolvedPlayerStep.grounded === true,
    falling: resolvedPlayerStep.falling === true,
    rising: resolvedPlayerStep.rising === true,
    landed: resolvedPlayerStep.landed === true,
  };
  const finalLocomotion = status === "respawned-out-of-bounds"
    ? "respawning-out-of-bounds"
    : resolveFinalLocomotion(finalPlayerState, intent.moveX);

  return {
    ok: true,
    player: {
      position: resolvedPlayerStep.position,
      velocity: resolvedPlayerStep.velocity,
      coyoteTimer: Number.isFinite(verticalInputState?.coyoteTimer) ? verticalInputState.coyoteTimer : 0,
      jumpBufferTimer: Number.isFinite(verticalInputState?.jumpBufferTimer) ? verticalInputState.jumpBufferTimer : 0,
      jumpHeldLastTick: verticalInputState?.jumpHeldLastTick === true,
      locomotion: finalLocomotion,
      grounded: finalPlayerState.grounded,
      falling: finalPlayerState.falling,
      rising: finalPlayerState.rising,
      landed: finalPlayerState.landed,
      abilities: {
        pulse: {
          supported: true,
          wired: true,
          active: pulseStep.pulse.active,
          id: pulseStep.pulse.id,
          radius: pulseStep.pulse.r,
          alpha: pulseStep.pulse.alpha,
        },
        flare: { supported: true, wired: true, activeCount: flareStep.flares.length },
        boost: { supported: true, wired: true, active: boostActive },
        attack: { supported: false, wired: false },
      },
      flares: bottomRespawn ? [] : flareStep.flares,
      flareStash: bottomRespawn ? DEFAULT_PLAYER_FLARE_STASH : flareStep.flareStash,
      flareHeldLastTick: flareStep.flareHeldLastTick,
      pulse: pulseStep.pulse,
      pulseHeldLastTick: pulseStep.pulseHeldLastTick,
      boostActive,
      energy: nextEnergy,
      powerCellFill: powerCellRecharge.powerCellFill,
      facingX: flareStep.facingX,
      nextFlareId: flareStep.nextFlareId,
      entities: entityStep.entities,
      status,
    },
    collisions: {
      moveX: intent.moveX,
      jump: intent.jump === true,
      locomotion: finalLocomotion,
      velocityX: resolvedPlayerStep.velocity?.x ?? 0,
      blockedLeft: horizontalStep.blockedLeft === true,
      blockedRight: horizontalStep.blockedRight === true,
      grounded: finalPlayerState.grounded,
      falling: finalPlayerState.falling,
      rising: finalPlayerState.rising,
      landed: finalPlayerState.landed,
      collidedBelow: resolvedPlayerStep.collidedBelow === true,
    },
    status,
    errors: uniqueMessages(resolvedPlayerStep.errors),
    warnings: uniqueMessages([...(resolvedPlayerStep.warnings ?? []), bottomRespawn?.warning]),
    debug: {
      intent,
      locomotion: locomotionState,
      velocityX: velocityXStep,
      horizontal: {
        status: horizontalStep.status,
        moved: horizontalStep.moved === true,
        blockedLeft: horizontalStep.blockedLeft === true,
        blockedRight: horizontalStep.blockedRight === true,
      },
      jump: {
        status: jumpState.status,
        canJump: jumpState.canJump === true,
        startedJump: jumpState.startedJump === true,
      },
      vertical: {
        status: resolvedPlayerStep.status,
        grounded: finalPlayerState.grounded,
        falling: finalPlayerState.falling,
        rising: finalPlayerState.rising,
        landed: finalPlayerState.landed,
        collidedBelow: resolvedPlayerStep.collidedBelow === true,
        respawned: bottomRespawn?.debug?.respawned === true,
        triggerY: bottomRespawn?.debug?.triggerY ?? null,
        respawnY: bottomRespawn?.debug?.respawnY ?? null,
      },
      finalized: {
        locomotion: finalLocomotion,
        pulseStarted: pulseStep.pulseStarted,
        pulseSuppressedByEnergy: pulseStep.pulseSuppressedByEnergy,
        pulseActive: pulseStep.pulse.active,
        pulseRadius: pulseStep.pulse.r,
        pulseAlpha: pulseStep.pulse.alpha,
        boostActive,
        boostMultiplier: boostActive ? DEFAULT_BOOST_MULTIPLIER : 1,
        boostSuppressedByEnergy: intent?.boost === true && !boostActive,
        flareSpawned: flareStep.flareSpawned,
        flareCount: flareStep.flares.length,
        flareStash: flareStep.flareStash,
        flarePickupCollected: pickupStep.flareCollectedCount,
        flarePickupCollectedIds: pickupStep.flareCollectedIds,
        powerCellPickupCollected: pickupStep.powerCellCollectedCount,
        flareThrowSuppressedByEmptyStash: flareStep.flareThrowSuppressedByEmptyStash,
        flareThrowSuppressedByEnergy: flareStep.flareThrowSuppressedByEnergy,
        flareCleanup: flareStep.cleanup,
        pulseEntityHits: entityStep.hits.length,
        flareEntityAffects: flareEntityStep.flareAffects.length,
      },
    },
    entities: entityStep.entities,
  };
}
