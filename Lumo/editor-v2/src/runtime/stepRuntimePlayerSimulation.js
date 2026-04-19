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

function stepRuntimePlayerBrakeState(playerState, intent, locomotionState, options = {}) {
  const dt = resolveRuntimeDeltaSeconds(options);
  const source = playerState?.brakeState && typeof playerState.brakeState === "object" ? playerState.brakeState : {};
  const moving = Number.isFinite(intent?.moveX) && intent.moveX !== 0;
  const wasMoving = source.prevMoving === true;
  const velocityX = Number.isFinite(playerState?.velocity?.x) ? playerState.velocity.x : 0;
  const grounded = locomotionState?.grounded === true;
  const slipperyNow = grounded === true && locomotionState?.slipperyGround === true;

  let active = source.active === true;
  let slipTimer = Number.isFinite(source.slipTimer) ? Math.max(0, source.slipTimer) : 0;
  let lockTimer = Number.isFinite(source.lockTimer) ? Math.max(0, source.lockTimer) : 0;

  // Preserve slippery state briefly to match V1 one-frame tile/ground flicker tolerance.
  slipTimer = slipperyNow ? 0.22 : Math.max(0, slipTimer - dt);
  if (wasMoving && !moving && slipTimer > 0 && Math.abs(velocityX) > 0.8) {
    active = true;
    lockTimer = 0.18;
  }

  if (moving) {
    active = false;
    lockTimer = 0;
  }

  lockTimer = Math.max(0, lockTimer - dt);
  if (active && lockTimer <= 0 && Math.abs(velocityX) <= 0.5) {
    active = false;
  }

  return {
    active,
    prevMoving: moving,
    slipTimer,
    lockTimer,
  };
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
const DEFAULT_PLAYER_LIGHT_RADIUS_PX = 170;
const DEFAULT_LANTERN_FOOTPRINT_PX = 14;
const DEFAULT_FLARE_PICKUP_FOOTPRINT_PX = 12;
const DEFAULT_POWERCELL_FOOTPRINT_PX = 24;
const DEFAULT_POWERCELL_FILL_DURATION_SECONDS = 1.6;
const DEFAULT_PLAYER_LIVES = 4;
const RESPAWN_COUNTDOWN_SECONDS = 3;
const ENTITY_HIT_FLASH_TICKS = 6;
const ENTITY_DARK_CREATURE_PULSE_SCALE = 0.55;
const ENTITY_HOVER_VOID_PULSE_SCALE = 0.6;
const ENTITY_DARK_CREATURE_FLARE_CONSUME_BURN_MUL = 7.5;
const PULSE_TARGET_TYPES = new Set(["dark_creature", "hover_void"]);
const DEFAULT_DARK_PROJECTILE_MAX_AGE_SECONDS = 4;
const DEFAULT_DARK_CREATURE_AGGRO_TILES = 6;
const DEFAULT_DARK_CREATURE_CAST_CHARGE_TIME_SECONDS = 0.5;
const DEFAULT_DARK_CREATURE_SPELL_SPEED_X_PX_PER_SECOND = 190;
const DEFAULT_DARK_CREATURE_SPELL_GRAVITY_PX_PER_SECOND = 760;
const DEFAULT_DARK_CREATURE_TARGET_JITTER_PX = 3;
const FIREFLY_TAIL_MAX_POINTS = 14;
const FIREFLY_TAIL_MAX_AGE_SECONDS = 0.35;
const V1_PLAYER_HITBOX_WIDTH_PX = 22;
const V1_PLAYER_HITBOX_HEIGHT_PX = 28;

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

function isDarkCreatureEntityType(entityType) {
  return resolvePulseTargetType(entityType) === "dark_creature";
}

function resolveDarkCreatureAggroDefaults(sourceAggroTiles, sourceAggroRadiusPx, tileSize = 24) {
  const hasAggroRadiusPx = Number.isFinite(sourceAggroRadiusPx) && sourceAggroRadiusPx > 0;
  const hasUsableAggroTiles = Number.isFinite(sourceAggroTiles) && sourceAggroTiles > 0;
  const normalizedAggroTiles = hasUsableAggroTiles
    ? sourceAggroTiles
    : (hasAggroRadiusPx ? sourceAggroRadiusPx / tileSize : DEFAULT_DARK_CREATURE_AGGRO_TILES);
  return {
    aggroTiles: normalizedAggroTiles,
    aggroRadiusPx: hasAggroRadiusPx ? sourceAggroRadiusPx : null,
  };
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
  // Keep V1 gameplay footprint truth separate from visual draw size.
  const footprint = resolveEntityFootprint(type, params, tileSize, size);
  const drawAnchor = String(source?.drawAnchor || params?.drawAnchor || "BL").trim().toUpperCase() === "TL" ? "TL" : "BL";
  const maxHp = Number.isFinite(source?.maxHp) && source.maxHp > 0
    ? Math.floor(source.maxHp)
    : type === "dark_creature_01"
      ? (Number.isFinite(params?.hp) && params.hp > 0 ? Math.floor(params.hp) : 3)
      : type === "hover_void_01"
        ? (Number.isFinite(params?.maxHp) && params.maxHp > 0 ? Math.floor(params.maxHp) : 3)
        : (Number.isFinite(params?.hp) && params.hp > 0 ? Math.floor(params.hp) : 1);
  const hp = Number.isFinite(source?.hp) && source.hp >= 0 ? Math.floor(source.hp) : maxHp;
  const normalizedType = String(type || "").trim().toLowerCase();
  const isDarkCreature = normalizedType === "dark_creature_01";
  const parseNumber = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
  const parseFireflyNumber = (value, fallback) => ((value == null || value === "") ? fallback : parseNumber(value, fallback));
  const parseBool = (value, fallback = false) => {
    if (value == null) {
      return fallback;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "false" || normalized === "0" || normalized === "no") {
        return false;
      }
      if (normalized === "true" || normalized === "1" || normalized === "yes") {
        return true;
      }
    }
    return value === true;
  };
  const darkCreatureRuntimeState = isDarkCreature
    ? {
        isDarkActive: parseBool(source?.isDarkActive, false),
        _dangerT: parseNumber(source?._dangerT, 0),
        _hitCd: parseNumber(source?._hitCd, 0),
        _castCd: parseNumber(source?._castCd, 0),
        _castChargeT: parseNumber(source?._castChargeT, 0),
        _castTargetX: parseNumber(source?._castTargetX, 0),
        _castTargetY: parseNumber(source?._castTargetY, 0),
        _pulseHitId: Number.isFinite(source?._pulseHitId) ? Math.floor(source._pulseHitId) : -1,
        reactsToFlares: parseBool(source?.reactsToFlares ?? params?.reactsToFlares, true),
        hitCooldown: parseNumber(source?.hitCooldown ?? params?.hitCooldown, 0.6),
        safeDelay: parseNumber(source?.safeDelay ?? params?.safeDelay, 0.6),
        ...resolveDarkCreatureAggroDefaults(
          parseNumber(source?.aggroTiles ?? params?.aggroTiles, null),
          parseNumber(source?.aggroRadiusPx ?? params?.aggroRadius, null),
          tileSize,
        ),
        energyLoss: parseNumber(source?.energyLoss ?? params?.energyLoss, 40),
        knockbackX: parseNumber(source?.knockbackX ?? params?.knockbackX, 260),
        knockbackY: parseNumber(source?.knockbackY ?? params?.knockbackY, -220),
        bodyEnergyLoss: parseNumber(source?.bodyEnergyLoss ?? params?.bodyEnergyLoss ?? params?.energyLoss, 40),
        bodyKnockbackX: parseNumber(source?.bodyKnockbackX ?? params?.bodyKnockbackX, 160),
        bodyKnockbackY: parseNumber(source?.bodyKnockbackY ?? params?.bodyKnockbackY, -140),
        castCooldown: parseNumber(source?.castCooldown ?? params?.castCooldown, 5.5),
        castChargeTime: parseNumber(source?.castChargeTime ?? params?.castChargeTime, DEFAULT_DARK_CREATURE_CAST_CHARGE_TIME_SECONDS),
        spellSpeedX: parseNumber(source?.spellSpeedX ?? params?.spellSpeedX, DEFAULT_DARK_CREATURE_SPELL_SPEED_X_PX_PER_SECOND),
        spellGravity: parseNumber(source?.spellGravity ?? params?.spellGravity, DEFAULT_DARK_CREATURE_SPELL_GRAVITY_PX_PER_SECOND),
        targetJitterPx: parseNumber(source?.targetJitterPx ?? params?.targetJitterPx, DEFAULT_DARK_CREATURE_TARGET_JITTER_PX),
        dying: parseBool(source?.dying, false),
        dissolveT: parseNumber(source?.dissolveT, 0),
        dissolveDur: parseNumber(source?.dissolveDur ?? params?.dissolveDur, 1.35),
        _dissolveSpawnT: parseNumber(source?._dissolveSpawnT, 0),
      }
    : {};

  // Seed hover runtime state from live source values or V1 runtime defaults.
  const isHoverVoid = normalizedType === "hover_void_01";
  const hoverRuntimeState = isHoverVoid
    ? {
        awake: typeof source?.awake === "boolean" ? source.awake : false,
        sleepBlend: Number.isFinite(Number(source?.sleepBlend)) ? Number(source.sleepBlend) : 1,
        eyeBlend: Number.isFinite(Number(source?.eyeBlend)) ? Number(source.eyeBlend) : 0,
        braveGroupSize: Math.max(1, Math.floor(parseNumber(source?.braveGroupSize ?? params?.braveGroupSize, 3))),
        swarmGroupSize: Math.max(
          Math.max(1, Math.floor(parseNumber(source?.braveGroupSize ?? params?.braveGroupSize, 3))),
          Math.floor(parseNumber(source?.swarmGroupSize ?? params?.swarmGroupSize, 6)),
        ),
        attackCooldownMin: Math.max(0.2, parseNumber(source?.attackCooldownMin ?? params?.attackCooldownMin, 1)),
        attackCooldownMax: Math.max(
          Math.max(0.2, parseNumber(source?.attackCooldownMin ?? params?.attackCooldownMin, 1)),
          parseNumber(source?.attackCooldownMax ?? params?.attackCooldownMax, 3),
        ),
        attackDamage: Math.max(0, parseNumber(source?.attackDamage ?? params?.attackDamage, 12)),
        attackPushback: Math.max(0, parseNumber(source?.attackPushback ?? params?.attackPushback, 180)),
        _wakeHold: Number.isFinite(Number(source?._wakeHold)) ? Number(source._wakeHold) : 0,
        _isFollowing: typeof source?._isFollowing === "boolean" ? source._isFollowing : false,
        _t: Number.isFinite(Number(source?._t)) ? Number(source._t) : 0,
        _blinkT: Number.isFinite(Number(source?._blinkT)) ? Number(source._blinkT) : 2,
        _blinkDur: Number.isFinite(Number(source?._blinkDur)) ? Number(source._blinkDur) : 0,
        _angryT: Number.isFinite(Number(source?._angryT)) ? Number(source._angryT) : 0,
        _angryCd: Number.isFinite(Number(source?._angryCd)) ? Number(source._angryCd) : 5,
        _bickerCd: Number.isFinite(Number(source?._bickerCd)) ? Number(source._bickerCd) : 0.4,
        _targetVX: Number.isFinite(Number(source?._targetVX)) ? Number(source._targetVX) : 0,
        _targetVY: Number.isFinite(Number(source?._targetVY)) ? Number(source._targetVY) : 0,
        _recoilT: Number.isFinite(Number(source?._recoilT)) ? Number(source._recoilT) : 0,
        _lungeState: typeof source?._lungeState === "string" ? source._lungeState : "idle",
        _lungeActor: source?._lungeActor === true,
        _lungeT: Number.isFinite(Number(source?._lungeT)) ? Number(source._lungeT) : 0,
        _lungeDirX: Number.isFinite(Number(source?._lungeDirX)) ? Number(source._lungeDirX) : 0,
        _lungeDirY: Number.isFinite(Number(source?._lungeDirY)) ? Number(source._lungeDirY) : 0,
        _facingX: Number.isFinite(Number(source?._facingX)) ? Number(source._facingX) : 1,
        _lungeHitDone: source?._lungeHitDone === true,
        _attackCd: Number.isFinite(Number(source?._attackCd))
          ? Number(source._attackCd)
          : Math.max(0.2, parseNumber(source?.attackCooldownMin ?? params?.attackCooldownMin, 1)),
        vx: Number.isFinite(Number(source?.vx)) ? Number(source.vx) : 0,
        vy: Number.isFinite(Number(source?.vy)) ? Number(source.vy) : 0,
      }
    : {};
  const isFirefly = normalizedType === "firefly_01" || normalizedType === "firefly";
  const fireflyRuntimeState = isFirefly
    ? {
        mode: typeof source?.mode === "string" ? source.mode : "rest",
        lightRadius: parseFireflyNumber(source?.lightRadius ?? params?.lightRadius ?? (Number.isFinite(params?.lightDiameter) ? (params.lightDiameter * 0.5) : undefined), 120),
        lightStrength: parseFireflyNumber(source?.lightStrength ?? params?.lightStrength, 0.8),
        lightK: Math.max(0, Math.min(1, parseNumber(source?.lightK, 0))),
        aggroR: parseFireflyNumber(source?.aggroR ?? (Number.isFinite(params?.aggroTiles) ? (params.aggroTiles * tileSize) : undefined), 6 * tileSize),
        flyRX: parseFireflyNumber(source?.flyRX ?? (Number.isFinite(params?.flyRangeX) ? (params.flyRangeX * tileSize) : undefined), 5 * tileSize),
        flyRY: parseFireflyNumber(source?.flyRY ?? (Number.isFinite(params?.flyRangeYUp) ? (params.flyRangeYUp * tileSize) : undefined), 5 * tileSize),
        flySpeed: parseFireflyNumber(source?.flySpeed ?? params?.flySpeed, 45),
        smooth: parseFireflyNumber(source?.smooth ?? params?.smooth, 7),
        flyTime: parseFireflyNumber(source?.flyTime ?? params?.flyTime, 2.5),
        perchR: parseFireflyNumber(source?.perchR ?? (Number.isFinite(params?.perchSearchRadius) ? (params.perchSearchRadius * tileSize) : undefined), 6 * tileSize),
        cooldown: parseFireflyNumber(source?.cooldown ?? params?.cooldown, 2),
        fadeIn: Math.max(0.01, parseFireflyNumber(source?.fadeIn ?? params?.fadeIn, 0.35)),
        fadeOut: Math.max(0.01, parseFireflyNumber(source?.fadeOut ?? params?.fadeOut, 0.45)),
        tFly: Math.max(0, parseNumber(source?.tFly, 0)),
        tWander: Math.max(0, parseNumber(source?.tWander, 0)),
        cdT: Math.max(0, parseNumber(source?.cdT, 0)),
        destX: parseNumber(source?.destX, x),
        destY: parseNumber(source?.destY, y),
        landX: parseNumber(source?.landX, x),
        landY: parseNumber(source?.landY, y),
        homeX: parseNumber(source?.homeX, x),
        homeY: parseNumber(source?.homeY, y),
        vx: parseNumber(source?.vx, 0),
        vy: parseNumber(source?.vy, 0),
        dir: parseNumber(source?.dir, 1) < 0 ? -1 : 1,
        _tail: Array.isArray(source?._tail)
          ? source._tail
            .map((point) => ({
              x: parseNumber(point?.x, x),
              y: parseNumber(point?.y, y),
              t: Math.max(0, parseNumber(point?.t, 0)),
            }))
            .slice(-FIREFLY_TAIL_MAX_POINTS)
          : [],
        _tailSpawnT: parseNumber(source?._tailSpawnT, 0),
        _landingT: Math.max(0, parseNumber(source?._landingT, 0)),
        _landedT: Math.max(0, parseNumber(source?._landedT, 0)),
      }
    : {};

  return {
    id: typeof source.id === "string" && source.id.length > 0 ? source.id : `runtime-entity-${index + 1}`,
    type,
    x,
    y: looksTileBased && drawAnchor === "BL" ? y + (tileSize - footprint.h) : y,
    size,
    footprintW: footprint.w,
    footprintH: footprint.h,
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
    ...darkCreatureRuntimeState,
    ...hoverRuntimeState,
    ...fireflyRuntimeState,
  };
}

function resolveEntityFootprint(entityType, params, tileSize, fallbackSize = 24) {
  const paramsObj = params && typeof params === "object" ? params : {};
  const authoredW = Number(paramsObj.footprintW);
  const authoredH = Number(paramsObj.footprintH);
  if (Number.isFinite(authoredW) && authoredW > 0 && Number.isFinite(authoredH) && authoredH > 0) {
    return { w: authoredW, h: authoredH };
  }

  const normalizedType = String(entityType || "").trim().toLowerCase();
  if (isLanternEntityType(normalizedType)) {
    return { w: DEFAULT_LANTERN_FOOTPRINT_PX, h: DEFAULT_LANTERN_FOOTPRINT_PX };
  }
  if (isFlarePickupEntityType(normalizedType)) {
    return { w: DEFAULT_FLARE_PICKUP_FOOTPRINT_PX, h: DEFAULT_FLARE_PICKUP_FOOTPRINT_PX };
  }
  if (isPowerCellEntityType(normalizedType)) {
    const tileBasedFootprint = Number.isFinite(tileSize) && tileSize > 0 ? tileSize : DEFAULT_POWERCELL_FOOTPRINT_PX;
    return { w: tileBasedFootprint, h: tileBasedFootprint };
  }
  const fallback = Number.isFinite(fallbackSize) && fallbackSize > 0 ? fallbackSize : 24;
  return { w: fallback, h: fallback };
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

function isCheckpointEntityType(entityType) {
  if (typeof entityType !== "string") {
    return false;
  }
  const normalizedType = entityType.trim().toLowerCase();
  return normalizedType === "checkpoint_01" || normalizedType === "checkpoint";
}

function isExitEntityType(entityType) {
  if (typeof entityType !== "string") {
    return false;
  }
  const normalizedType = entityType.trim().toLowerCase();
  return normalizedType === "exit_01" || normalizedType === "exit" || normalizedType === "player-exit";
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

function buildPlayerCheckpointBounds(playerState) {
  const footX = Number.isFinite(playerState?.position?.x) ? playerState.position.x : 0;
  const footY = Number.isFinite(playerState?.position?.y) ? playerState.position.y : 0;
  return {
    x: footX - V1_PLAYER_HITBOX_WIDTH_PX * 0.5,
    y: footY + 1 - V1_PLAYER_HITBOX_HEIGHT_PX,
    w: V1_PLAYER_HITBOX_WIDTH_PX,
    h: V1_PLAYER_HITBOX_HEIGHT_PX,
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

function resolvePlayerCheckpointState(playerState, checkpointEntity, tileSize) {
  if (!checkpointEntity || typeof checkpointEntity !== "object") {
    return playerState?.checkpoint && typeof playerState.checkpoint === "object"
      ? { ...playerState.checkpoint }
      : null;
  }

  const ts = Number.isFinite(tileSize) && tileSize > 0 ? tileSize : 24;
  const px = Number.isFinite(checkpointEntity?.x) ? checkpointEntity.x : 0;
  const py = Number.isFinite(checkpointEntity?.y) ? checkpointEntity.y : 0;
  const tx = Math.floor(px / ts);
  const ty = Math.floor(py / ts);
  return { tx, ty, px: tx * ts, py: ty * ts };
}

function stepCheckpointOverlap(worldPacket, playerState, sourceEntities) {
  const checkpointState = playerState?.checkpoint && typeof playerState.checkpoint === "object"
    ? { ...playerState.checkpoint }
    : null;
  if (!Array.isArray(sourceEntities) || sourceEntities.length === 0) {
    return { checkpoint: checkpointState, touched: false };
  }

  const tileSize = Number.isFinite(worldPacket?.world?.tileSize) && worldPacket.world.tileSize > 0 ? worldPacket.world.tileSize : 24;
  // Checkpoints are persistent world triggers (not pickups), so overlap must
  // use the live gameplay hitbox convention (foot-anchored 22x28) instead of
  // the pickup helper footprint.
  const playerBounds = buildPlayerCheckpointBounds(playerState);
  let nextCheckpoint = checkpointState;
  let touched = false;

  for (const entity of sourceEntities) {
    if (entity?.active !== true || !isCheckpointEntityType(entity?.type)) {
      continue;
    }
    const width = Number.isFinite(entity?.footprintW) && entity.footprintW > 0
      ? entity.footprintW
      : Number.isFinite(entity?.w) && entity.w > 0
        ? entity.w
        : Number.isFinite(entity?.size) && entity.size > 0
          ? entity.size
          : tileSize;
    const height = Number.isFinite(entity?.footprintH) && entity.footprintH > 0
      ? entity.footprintH
      : Number.isFinite(entity?.h) && entity.h > 0
        ? entity.h
        : Number.isFinite(entity?.size) && entity.size > 0
          ? entity.size
          : tileSize;
    const entityBounds = {
      x: Number.isFinite(entity?.x) ? entity.x : 0,
      y: Number.isFinite(entity?.y) ? entity.y : 0,
      w: width,
      h: height,
    };
    if (!isAabbOverlap(playerBounds, entityBounds)) {
      continue;
    }
    nextCheckpoint = resolvePlayerCheckpointState(playerState, entity, tileSize);
    touched = true;
  }

  return {
    checkpoint: nextCheckpoint,
    touched,
  };
}

function stepExitOverlap(worldPacket, playerState, sourceEntities) {
  if (!Array.isArray(sourceEntities) || sourceEntities.length === 0) {
    return {
      entities: [],
      completed: false,
      touchedExitId: null,
    };
  }

  const tileSize = Number.isFinite(worldPacket?.world?.tileSize) && worldPacket.world.tileSize > 0 ? worldPacket.world.tileSize : 24;
  const playerBounds = buildPlayerCheckpointBounds(playerState);
  let completed = false;
  let touchedExitId = null;

  const entities = sourceEntities.map((entity) => {
    const next = { ...entity };
    if (next?.active !== true || !isExitEntityType(next?.type)) {
      return next;
    }
    const width = Number.isFinite(next?.footprintW) && next.footprintW > 0
      ? next.footprintW
      : Number.isFinite(next?.w) && next.w > 0
        ? next.w
        : Number.isFinite(next?.size) && next.size > 0
          ? next.size
          : tileSize;
    const height = Number.isFinite(next?.footprintH) && next.footprintH > 0
      ? next.footprintH
      : Number.isFinite(next?.h) && next.h > 0
        ? next.h
        : Number.isFinite(next?.size) && next.size > 0
          ? next.size
          : tileSize;
    const entityBounds = {
      x: Number.isFinite(next?.x) ? next.x : 0,
      y: Number.isFinite(next?.y) ? next.y : 0,
      w: width,
      h: height,
    };
    if (!isAabbOverlap(playerBounds, entityBounds)) {
      return next;
    }

    next.active = false;
    completed = true;
    touchedExitId = typeof next?.id === "string" ? next.id : touchedExitId;
    return next;
  });

  return {
    entities,
    completed,
    touchedExitId,
  };
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

    const width = Number.isFinite(next?.footprintW) && next.footprintW > 0
      ? next.footprintW
      : Number.isFinite(next?.size) && next.size > 0 ? next.size : Math.max(12, tileSize * 0.5);
    const height = Number.isFinite(next?.footprintH) && next.footprintH > 0
      ? next.footprintH
      : Number.isFinite(next?.size) && next.size > 0 ? next.size : Math.max(12, tileSize * 0.5);
    const entityBounds = {
      x: Number.isFinite(next?.x) ? next.x : 0,
      y: Number.isFinite(next?.y) ? next.y : 0,
      w: width,
      h: height,
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
  const width = Number.isFinite(entity?.footprintW) && entity.footprintW > 0
    ? entity.footprintW
    : Number.isFinite(entity?.size) && entity.size > 0 ? entity.size : 24;
  const height = Number.isFinite(entity?.footprintH) && entity.footprintH > 0
    ? entity.footprintH
    : Number.isFinite(entity?.size) && entity.size > 0 ? entity.size : 24;
  const x = Number.isFinite(entity?.x) ? entity.x : 0;
  const y = Number.isFinite(entity?.y) ? entity.y : 0;
  return {
    x: x + width * 0.5,
    y: y + height * 0.5,
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
      if (isDarkCreatureEntityType(next.type)) {
        next.dying = true;
        next.alive = true;
        next.active = true;
        next.dissolveT = 0;
        next._dissolveSpawnT = 0;
        next._hitCd = 999;
        next._castCd = 999;
        next._castChargeT = 0;
        next.state = "dissolving";
      } else {
        next.alive = false;
        next.active = false;
      }
    }
    hits.push({ id: next.id, type: next.type, pulseId });
    return next;
  });

  return { entities: nextEntities, hits };
}

function normalizeDarkProjectiles(playerState = {}) {
  if (!Array.isArray(playerState?.darkProjectiles)) {
    return [];
  }
  return playerState.darkProjectiles
    .map((projectile, index) => ({
      id: Number.isFinite(projectile?.id) ? Math.floor(projectile.id) : index + 1,
      x: Number.isFinite(projectile?.x) ? projectile.x : null,
      y: Number.isFinite(projectile?.y) ? projectile.y : null,
      vx: Number.isFinite(projectile?.vx) ? projectile.vx : 0,
      vy: Number.isFinite(projectile?.vy) ? projectile.vy : 0,
      gravity: Number.isFinite(projectile?.gravity) ? projectile.gravity : 760,
      age: Number.isFinite(projectile?.age) ? projectile.age : 0,
      maxAge: Number.isFinite(projectile?.maxAge) ? projectile.maxAge : DEFAULT_DARK_PROJECTILE_MAX_AGE_SECONDS,
      energyLoss: Number.isFinite(projectile?.energyLoss) ? projectile.energyLoss : 40,
      knockbackX: Number.isFinite(projectile?.knockbackX) ? projectile.knockbackX : 260,
      knockbackY: Number.isFinite(projectile?.knockbackY) ? projectile.knockbackY : -220,
      _projectileSpritePath: typeof projectile?._projectileSpritePath === "string"
        ? projectile._projectileSpritePath
        : (typeof projectile?.projectileSpritePath === "string" ? projectile.projectileSpritePath : ""),
      impacted: projectile?.impacted === true,
    }))
    .filter((projectile) => projectile.x != null && projectile.y != null && projectile.maxAge > 0);
}

function applyDarkCreatureDamageToPlayer(playerState, sourceCenterX, knockbackX, knockbackY, energyLoss) {
  const sourceX = Number.isFinite(sourceCenterX) ? sourceCenterX : (Number.isFinite(playerState?.position?.x) ? playerState.position.x : 0);
  const playerCenterX = Number.isFinite(playerState?.position?.x) ? playerState.position.x : 0;
  const dir = Math.sign(playerCenterX - sourceX) || 1;
  const resolvedKnockbackX = dir * (Number.isFinite(knockbackX) ? Math.abs(knockbackX) : 0);
  const resolvedKnockbackY = Number.isFinite(knockbackY) ? knockbackY : 0;
  const energyLossNormalized = Math.max(0, Number.isFinite(energyLoss) ? energyLoss : 0) / 100;

  return {
    ...playerState,
    velocity: {
      x: resolvedKnockbackX,
      y: resolvedKnockbackY,
    },
    energy: Math.max(0, Math.min(1, (Number.isFinite(playerState?.energy) ? playerState.energy : 1) - energyLossNormalized)),
  };
}

function stepHoverVoidRuntime(worldPacket, playerState, sourceEntities, options = {}) {
  const dt = resolveRuntimeDeltaSeconds(options);
  const entities = Array.isArray(sourceEntities) ? sourceEntities.map((entity) => ({ ...entity })) : [];
  const tileSize = Number.isFinite(worldPacket?.world?.tileSize) && worldPacket.world.tileSize > 0 ? worldPacket.world.tileSize : 24;
  const playerBounds = buildPlayerPickupBounds(playerState, tileSize);
  const playerCenterX = playerBounds.x + playerBounds.w * 0.5;
  const playerCenterY = playerBounds.y + playerBounds.h * 0.5;
  const hasPlayer = Number.isFinite(playerCenterX) && Number.isFinite(playerCenterY);
  let nextPlayer = { ...playerState };
  let hoverVoidAttackGlobalCd = Math.max(0, Number.isFinite(playerState?._hoverVoidAttackGlobalCd) ? playerState._hoverVoidAttackGlobalCd : 0);
  if (hoverVoidAttackGlobalCd > 0) {
    hoverVoidAttackGlobalCd = Math.max(0, hoverVoidAttackGlobalCd - dt);
  }

  // V1 hover-void behavior block: wake/follow, social spacing, lunge FSM and eye/blink runtime fields.
  for (const entity of entities) {
    if (String(entity?.type || "").trim().toLowerCase() !== "hover_void_01" || entity?.active !== true || entity?.alive !== true) {
      continue;
    }

    const center = getEntityCenter(entity);
    entity._t = (Number.isFinite(entity?._t) ? entity._t : 0) + dt;
    entity._targetVX = 0;
    entity._targetVY = Math.sin(entity._t * 1.3 + center.x * 0.01) * 12;
    entity.awake = entity.awake === true;
    entity._wakeHold = Number.isFinite(entity?._wakeHold) ? Math.max(0, entity._wakeHold) : 0;
    entity._isFollowing = entity._isFollowing === true;
    entity.eyeBlend = Number.isFinite(entity?.eyeBlend) ? entity.eyeBlend : 0;
    entity.sleepBlend = Number.isFinite(entity?.sleepBlend) ? entity.sleepBlend : 1;
    entity.braveGroupSize = Math.max(1, Number.isFinite(entity?.braveGroupSize) ? Math.floor(entity.braveGroupSize) : 3);
    entity.swarmGroupSize = Math.max(entity.braveGroupSize, Number.isFinite(entity?.swarmGroupSize) ? Math.floor(entity.swarmGroupSize) : 6);
    entity.attackCooldownMin = Math.max(0.2, Number.isFinite(entity?.attackCooldownMin) ? entity.attackCooldownMin : 1);
    entity.attackCooldownMax = Math.max(entity.attackCooldownMin, Number.isFinite(entity?.attackCooldownMax) ? entity.attackCooldownMax : 3);
    entity.attackDamage = Math.max(0, Number.isFinite(entity?.attackDamage) ? entity.attackDamage : 12);
    entity.attackPushback = Math.max(0, Number.isFinite(entity?.attackPushback) ? entity.attackPushback : 180);
    entity._blinkT = Number.isFinite(entity?._blinkT) ? entity._blinkT : 2;
    entity._blinkDur = Number.isFinite(entity?._blinkDur) ? entity._blinkDur : 0;
    entity._angryT = Number.isFinite(entity?._angryT) ? entity._angryT : 0;
    entity._angryCd = Number.isFinite(entity?._angryCd) ? entity._angryCd : 5;
    entity._bickerCd = Number.isFinite(entity?._bickerCd) ? entity._bickerCd : 0.4;
    entity._recoilT = Number.isFinite(entity?._recoilT) ? entity._recoilT : 0;
    entity._lungeState = typeof entity?._lungeState === "string" ? entity._lungeState : "idle";
    entity._lungeActor = entity?._lungeActor === true;
    entity._lungeT = Number.isFinite(entity?._lungeT) ? entity._lungeT : 0;
    entity._lungeDirX = Number.isFinite(entity?._lungeDirX) ? entity._lungeDirX : 0;
    entity._lungeDirY = Number.isFinite(entity?._lungeDirY) ? entity._lungeDirY : 0;
    entity._facingX = Number.isFinite(entity?._facingX) ? entity._facingX : 1;
    entity._lungeHitDone = entity?._lungeHitDone === true;
    entity._attackCd = Math.max(0, Number.isFinite(entity?._attackCd) ? entity._attackCd : entity.attackCooldownMin);
    entity.vx = Number.isFinite(entity?.vx) ? entity.vx : 0;
    entity.vy = Number.isFinite(entity?.vy) ? entity.vy : 0;
    if (entity._attackCd > 0) {
      entity._attackCd = Math.max(0, entity._attackCd - dt);
    }
    if (entity._recoilT > 0) {
      entity._recoilT = Math.max(0, entity._recoilT - dt);
    }

    const aggroTiles = Number.isFinite(entity?.aggroTiles) ? entity.aggroTiles : Number(entity?.params?.aggroTiles);
    const followTiles = Number.isFinite(entity?.followTiles) ? entity.followTiles : Number(entity?.params?.followTiles);
    const loseSightTiles = Number.isFinite(entity?.loseSightTiles) ? entity.loseSightTiles : Number(entity?.params?.loseSightTiles);
    const wakeR = Math.max(0, (Number.isFinite(aggroTiles) ? aggroTiles : 6) * tileSize);
    const followR = Math.max(0, (Number.isFinite(followTiles) ? followTiles : 7) * tileSize);
    const loseR = Math.max(0, (Number.isFinite(loseSightTiles) ? loseSightTiles : 11) * tileSize);
    const dxToPlayer = hasPlayer ? playerCenterX - center.x : 0;
    const dyToPlayer = hasPlayer ? playerCenterY - center.y : 0;
    const dPlayer = hasPlayer ? Math.hypot(dxToPlayer, dyToPlayer) : Number.POSITIVE_INFINITY;

    if (!entity.awake && hasPlayer && dPlayer <= wakeR) {
      entity.awake = true;
    }
    if (entity.awake) {
      if (hasPlayer && dPlayer <= loseR) {
        entity._wakeHold = 1.4;
      } else {
        entity._wakeHold = Math.max(0, entity._wakeHold - dt);
      }
      if (entity._wakeHold <= 0) {
        entity.awake = false;
      }
    }

    entity.eyeBlend = Math.max(0, Math.min(1, entity.eyeBlend + (entity.awake ? 1 : -1) * dt * 2.5));
    entity.sleepBlend = Math.max(0, Math.min(1, entity.sleepBlend + (entity.awake ? -1 : 1) * dt * 0.8));

    if (entity.awake) {
      if (!hasPlayer) {
        entity._isFollowing = false;
      } else if (!entity._isFollowing) {
        if (dPlayer <= followR) {
          entity._isFollowing = true;
        }
      } else if (dPlayer > loseR) {
        entity._isFollowing = false;
      }

      if (entity._isFollowing && hasPlayer) {
        const dNorm = Math.max(0.001, dPlayer);
        const targetDist = 3 * tileSize;
        if (dPlayer > targetDist) {
          entity._targetVX += (dxToPlayer / dNorm) * 52;
          entity._targetVY += (dyToPlayer / dNorm) * 52;
        } else {
          entity._targetVX -= (dxToPlayer / dNorm) * 22;
          entity._targetVY -= (dyToPlayer / dNorm) * 22;
        }
      }
      entity._blinkT -= dt;
      if (entity._blinkT <= 0) {
        entity._blinkDur = 0.12 + Math.random() * 0.07;
        entity._blinkT = 6 + Math.random() * 9;
      }
      if (entity._blinkDur > 0) {
        entity._blinkDur = Math.max(0, entity._blinkDur - dt);
      }

      if (entity._lungeState === "idle") {
        const awakeList = entities.filter((other) => (
          String(other?.type || "").trim().toLowerCase() === "hover_void_01"
          && other?.active === true
          && other?.alive === true
          && other?.awake === true
        ));
        const groupSize = awakeList.length;
        const brave = groupSize >= entity.braveGroupSize;
        const targetDist = 3 * tileSize;
        const shouldFollow = entity._isFollowing === true;
        // Hover-only flock spacing and cohesion.
        let neighborCount = 0;
        for (const other of awakeList) {
          if (other === entity) continue;
          const otherCenter = getEntityCenter(other);
          const dx = otherCenter.x - center.x;
          const dy = otherCenter.y - center.y;
          const d = Math.hypot(dx, dy);
          const sameFollowState = (other?._isFollowing === true) === shouldFollow;
          if (d < tileSize * 6) {
            neighborCount += 1;
            if (sameFollowState) {
              const socialPull = Math.max(0, 1 - d / (tileSize * 6));
              entity._targetVX += (dx / Math.max(0.001, d)) * 24 * socialPull;
              entity._targetVY += (dy / Math.max(0.001, d)) * 24 * socialPull;
            }
          }
          const sepR = tileSize * 1.55;
          if (d > 0.001 && d < sepR) {
            const push = (1 - d / sepR) * 150;
            entity._targetVX -= (dx / d) * push;
            entity._targetVY -= (dy / d) * push;
          }
          // Deterministic overlap-break: exact same center gets no normal separation vector.
          if (d <= 0.001) {
            const keyA = String(entity?.id ?? "");
            const keyB = String(other?.id ?? "");
            let seed = 0;
            const key = keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
            for (let i = 0; i < key.length; i += 1) seed = ((seed * 33) + key.charCodeAt(i)) >>> 0;
            const angle = (seed % 360) * (Math.PI / 180);
            const ox = Math.cos(angle);
            const oy = Math.sin(angle);
            const push = 130;
            const dir = keyA < keyB ? -1 : 1;
            entity._targetVX += ox * push * dir;
            entity._targetVY += oy * push * dir;
          }
          if (d > 0.001 && d < tileSize * 0.95 && entity._bickerCd <= 0) {
            const recoil = 80;
            entity.vx -= (dx / d) * recoil;
            entity.vy -= (dy / d) * recoil;
            entity._bickerCd = 0.55 + Math.random() * 0.65;
            entity._angryT = Math.max(entity._angryT, 0.22 + Math.random() * 0.3);
          }
        }
        if (entity._bickerCd > 0) {
          entity._bickerCd = Math.max(0, entity._bickerCd - dt);
        }
        entity._angryCd -= dt;
        if (neighborCount >= 1 && entity._angryCd <= 0 && Math.random() < dt * 0.1) {
          entity._angryT = 3 + Math.random() * 2;
          entity._angryCd = 15;
        }
        const swarmBonus = groupSize >= entity.swarmGroupSize ? 0.6 : 0;
        // Hover-only lunge gate: allow starts slightly outside hold radius so chase+hold can still convert to visible attacks.
        const canAttack = brave && shouldFollow && dPlayer <= Math.max(tileSize * 1.0, targetDist + tileSize * 1.0);
        if (canAttack && entity._attackCd <= 0 && hoverVoidAttackGlobalCd <= 0) {
          const dNorm = Math.max(0.001, dPlayer);
          entity._lungeState = "out";
          entity._lungeActor = true;
          entity._lungeT = 0;
          entity._lungeDirX = dxToPlayer / dNorm;
          entity._lungeDirY = dyToPlayer / dNorm;
          entity._lungeHitDone = false;
          entity._angryT = Math.max(entity._angryT, 0.55);
          const gap = entity.attackCooldownMin + Math.random() * Math.max(0.01, entity.attackCooldownMax - entity.attackCooldownMin);
          entity._attackCd = gap;
          hoverVoidAttackGlobalCd = gap + swarmBonus;
        }
      }
    } else {
      entity._isFollowing = false;
      entity._targetVX += Math.sin(entity._t * 0.7 + center.y * 0.02) * 16;
      entity._targetVY += Math.cos(entity._t * 0.6 + center.x * 0.02) * 12;
    }

    if (!entity._isFollowing && entity._lungeState !== "idle") {
      entity._lungeState = "idle";
      entity._lungeActor = false;
      entity._lungeT = 0;
      entity._lungeHitDone = false;
    }
    if (entity._lungeState !== "idle") {
      entity._angryT = Math.max(entity._angryT, 0.08);
      entity._lungeT += dt;
      const speedOut = 210 + (entities.filter((other) => other?.awake === true).length >= entity.swarmGroupSize ? 80 : 0);
      if (entity._lungeState === "out") {
        entity._targetVX = entity._lungeDirX * speedOut;
        entity._targetVY = entity._lungeDirY * speedOut;
        if (!entity._lungeHitDone && hasPlayer) {
          const paddedPlayerBounds = {
            x: playerBounds.x - 4,
            y: playerBounds.y - 4,
            w: playerBounds.w + 8,
            h: playerBounds.h + 8,
          };
          const entityBounds = {
            x: Number.isFinite(entity?.x) ? entity.x : 0,
            y: Number.isFinite(entity?.y) ? entity.y : 0,
            w: Number.isFinite(entity?.footprintW) ? entity.footprintW : (Number.isFinite(entity?.size) ? entity.size : 24),
            h: Number.isFinite(entity?.footprintH) ? entity.footprintH : (Number.isFinite(entity?.size) ? entity.size : 24),
          };
          if (isAabbOverlap(paddedPlayerBounds, entityBounds)) {
            entity._lungeHitDone = true;
            nextPlayer = applyDarkCreatureDamageToPlayer(nextPlayer, center.x, entity.attackPushback, -95, entity.attackDamage);
            entity.vx -= entity._lungeDirX * 80;
            entity.vy -= entity._lungeDirY * 80;
            entity._recoilT = 0.2;
            entity._lungeState = "back";
            entity._lungeT = 0;
          }
        }
        if (entity._lungeT >= 0.32) {
          entity._lungeState = "back";
          entity._lungeT = 0;
        }
      } else if (entity._lungeState === "back") {
        entity._targetVX = -entity._lungeDirX * 165;
        entity._targetVY = -entity._lungeDirY * 165;
        if (entity._lungeT >= 0.28) {
          entity._lungeState = "idle";
          entity._lungeActor = false;
          entity._lungeT = 0;
        }
      }
    }
    if (entity._angryT > 0) {
      entity._angryT = Math.max(0, entity._angryT - dt);
    }

    const steer = Math.max(0, Math.min(1, dt * 4));
    entity.vx += (entity._targetVX - entity.vx) * steer;
    entity.vy += (entity._targetVY - entity.vy) * steer;
    if (entity._recoilT > 0) {
      entity.vx *= 0.92;
      entity.vy *= 0.92;
    }
    entity.x += entity.vx * dt;
    entity.y += entity.vy * dt;
  }

  return {
    entities,
    player: {
      ...nextPlayer,
      _hoverVoidAttackGlobalCd: hoverVoidAttackGlobalCd,
    },
  };
}

function stepDarkCreatureRuntime(worldPacket, playerState, sourceEntities, options = {}) {
  const dt = resolveRuntimeDeltaSeconds(options);
  const entities = Array.isArray(sourceEntities) ? sourceEntities.map((entity) => ({ ...entity })) : [];
  const tileSize = Number.isFinite(worldPacket?.world?.tileSize) && worldPacket.world.tileSize > 0 ? worldPacket.world.tileSize : 24;
  const playerPosX = Number.isFinite(playerState?.position?.x) ? playerState.position.x : 0;
  const playerPosY = Number.isFinite(playerState?.position?.y) ? playerState.position.y : 0;
  const playerFootprint = Number.isFinite(tileSize) && tileSize > 0 ? tileSize : 24;
  const playerBounds = { x: playerPosX - playerFootprint * 0.5, y: playerPosY - playerFootprint, w: playerFootprint, h: playerFootprint };
  const playerCenter = { x: playerBounds.x + playerBounds.w * 0.5, y: playerBounds.y + playerBounds.h * 0.5 };
  let nextPlayer = { ...playerState };
  const darkProjectiles = normalizeDarkProjectiles(playerState);
  const spawnedProjectiles = [];
  const steppedProjectiles = [];
  let nextProjectileId = Number.isFinite(playerState?.nextDarkProjectileId) ? Math.max(1, Math.floor(playerState.nextDarkProjectileId)) : 1;

  for (const entity of entities) {
    if (!isDarkCreatureEntityType(entity?.type) || entity?.active !== true) {
      continue;
    }
    const center = getEntityCenter(entity);
    // Keep cast gating usable when authored params carry placeholder zero aggro data.
    const aggroDefaults = resolveDarkCreatureAggroDefaults(entity?.aggroTiles, entity?.aggroRadiusPx, tileSize);
    entity.aggroTiles = aggroDefaults.aggroTiles;
    entity.aggroRadiusPx = aggroDefaults.aggroRadiusPx;
    // Backfill missing cast fields to V1-safe defaults before charge/fire logic.
    entity.castChargeTime = Number.isFinite(entity?.castChargeTime) ? entity.castChargeTime : DEFAULT_DARK_CREATURE_CAST_CHARGE_TIME_SECONDS;
    entity.targetJitterPx = Number.isFinite(entity?.targetJitterPx) ? entity.targetJitterPx : DEFAULT_DARK_CREATURE_TARGET_JITTER_PX;
    entity.spellSpeedX = Number.isFinite(entity?.spellSpeedX) ? entity.spellSpeedX : DEFAULT_DARK_CREATURE_SPELL_SPEED_X_PX_PER_SECOND;
    entity.spellGravity = Number.isFinite(entity?.spellGravity) ? entity.spellGravity : DEFAULT_DARK_CREATURE_SPELL_GRAVITY_PX_PER_SECOND;
    const aggroRadiusPx = Number.isFinite(entity?.aggroRadiusPx) && entity.aggroRadiusPx > 0
      ? entity.aggroRadiusPx
      : Math.max(0, (Number.isFinite(entity?.aggroTiles) ? entity.aggroTiles : DEFAULT_DARK_CREATURE_AGGRO_TILES) * tileSize);

    if (entity.dying === true) {
      entity.dissolveT = (Number.isFinite(entity?.dissolveT) ? entity.dissolveT : 0) + dt;
      if (entity.dissolveT >= Math.max(0.001, Number.isFinite(entity?.dissolveDur) ? entity.dissolveDur : 1.35)) {
        entity.alive = false;
        entity.active = false;
        entity.state = "defeated";
      } else {
        entity.state = "dissolving";
      }
      continue;
    }

    entity._hitCd = Math.max(0, Number.isFinite(entity?._hitCd) ? entity._hitCd - dt : 0);
    entity._castCd = Math.max(0, Number.isFinite(entity?._castCd) ? entity._castCd - dt : 0);

    // V1 lit/safe behavior: lit disables dark-active, then safeDelay grace when light ends.
    const lit = entity?.reactsToFlares === false ? false : entity?.illuminated === true;
    if (lit) {
      entity.isDarkActive = false;
      entity._dangerT = Number.isFinite(entity?.safeDelay) ? entity.safeDelay : 0.6;
    } else if ((Number.isFinite(entity?._dangerT) ? entity._dangerT : 0) > 0) {
      entity._dangerT = Math.max(0, entity._dangerT - dt);
      entity.isDarkActive = false;
    } else {
      entity.isDarkActive = true;
    }

    // Keep stand-ground behavior: no chase/patrol movement.
    const distanceToPlayer = Math.hypot(playerCenter.x - center.x, playerCenter.y - center.y);
    const canCast = aggroRadiusPx > 0 && distanceToPlayer <= aggroRadiusPx;
    if ((Number.isFinite(entity?._castChargeT) ? entity._castChargeT : 0) > 0) {
      if (!canCast) {
        entity._castChargeT = 0;
      } else {
        entity._castChargeT = Math.max(0, entity._castChargeT - dt);
        entity.state = "casting-charge";
        if (entity._castChargeT <= 0) {
          const targetX = Number.isFinite(entity?._castTargetX) ? entity._castTargetX : playerCenter.x;
          const targetY = Number.isFinite(entity?._castTargetY) ? entity._castTargetY : playerCenter.y;
          const dx = targetX - center.x;
          const dy = targetY - center.y;
          const projectileSpeedX = Math.max(120, Math.abs(Number.isFinite(entity?.spellSpeedX) ? entity.spellSpeedX : DEFAULT_DARK_CREATURE_SPELL_SPEED_X_PX_PER_SECOND));
          const tFlight = Math.max(0.35, Math.min(1.2, distanceToPlayer / projectileSpeedX));
          const vx = dx / Math.max(0.001, tFlight);
          const gravity = Number.isFinite(entity?.spellGravity) ? entity.spellGravity : DEFAULT_DARK_CREATURE_SPELL_GRAVITY_PX_PER_SECOND;
          const vyRaw = (dy - (0.5 * gravity * tFlight * tFlight)) / Math.max(0.001, tFlight);
          spawnedProjectiles.push({
            id: nextProjectileId,
            x: center.x - 6,
            y: center.y - 10,
            vx,
            vy: Number.isFinite(vyRaw) ? vyRaw : -220,
            gravity,
            age: 0,
            maxAge: DEFAULT_DARK_PROJECTILE_MAX_AGE_SECONDS,
            energyLoss: Number.isFinite(entity?.energyLoss) ? entity.energyLoss : 40,
            knockbackX: Number.isFinite(entity?.knockbackX) ? entity.knockbackX : 260,
            knockbackY: Number.isFinite(entity?.knockbackY) ? entity.knockbackY : -220,
            _projectileSpritePath: typeof entity?._darkCreatureProjectileSpritePath === "string"
              ? entity._darkCreatureProjectileSpritePath
              : (typeof entity?.projectileSpritePath === "string"
                ? entity.projectileSpritePath
                : (typeof entity?.params?.projectileSpritePath === "string" ? entity.params.projectileSpritePath : "")),
            ownerId: entity.id,
          });
          nextProjectileId += 1;
          entity._castCd = Math.max(0.1, Number.isFinite(entity?.castCooldown) ? entity.castCooldown : 5.5);
          entity._castChargeT = 0;
          entity.state = "casting";
        }
      }
    } else if (canCast && entity._castCd <= 0) {
      const jitter = Math.max(0, Number.isFinite(entity?.targetJitterPx) ? entity.targetJitterPx : DEFAULT_DARK_CREATURE_TARGET_JITTER_PX);
      entity._castTargetX = playerCenter.x + (Math.random() * 2 - 1) * jitter;
      entity._castTargetY = playerCenter.y + (Math.random() * 2 - 1) * jitter;
      entity._castChargeT = Math.max(0.05, Number.isFinite(entity?.castChargeTime) ? entity.castChargeTime : DEFAULT_DARK_CREATURE_CAST_CHARGE_TIME_SECONDS);
      entity.state = "casting-charge";
    }

    // Body-contact damage always works independently of dark-active/casting state.
    if (entity.active === true && entity.dying !== true && entity._hitCd <= 0) {
      const creatureBounds = {
        x: Number.isFinite(entity?.x) ? entity.x : 0,
        y: Number.isFinite(entity?.y) ? entity.y : 0,
        w: Number.isFinite(entity?.footprintW) ? entity.footprintW : (Number.isFinite(entity?.size) ? entity.size : 24),
        h: Number.isFinite(entity?.footprintH) ? entity.footprintH : (Number.isFinite(entity?.size) ? entity.size : 24),
      };
      if (isAabbOverlap(playerBounds, creatureBounds)) {
        entity._hitCd = Math.max(0.05, Number.isFinite(entity?.hitCooldown) ? entity.hitCooldown : 0.6);
        nextPlayer = applyDarkCreatureDamageToPlayer(
          nextPlayer,
          center.x,
          Number.isFinite(entity?.bodyKnockbackX) ? entity.bodyKnockbackX : 160,
          Number.isFinite(entity?.bodyKnockbackY) ? entity.bodyKnockbackY : -140,
          Number.isFinite(entity?.bodyEnergyLoss) ? entity.bodyEnergyLoss : 40,
        );
      }
    }
  }

  // Step dark spell projectiles and apply direct-hit damage.
  const worldWidthPx = resolveWorldDimensionPx(worldPacket?.world?.width, tileSize);
  const worldHeightPx = resolveWorldDimensionPx(worldPacket?.world?.height, tileSize);
  for (const projectile of darkProjectiles) {
    const nextProjectile = { ...projectile };
    const impacted = nextProjectile.impacted === true;
    if (!impacted) {
      nextProjectile.vy += nextProjectile.gravity * dt;
      nextProjectile.x += nextProjectile.vx * dt;
      nextProjectile.y += nextProjectile.vy * dt;
    } else {
      nextProjectile.vx = 0;
      nextProjectile.vy = 0;
      nextProjectile.gravity = 0;
    }
    nextProjectile.age += dt;
    const spawnedThisTick = (Number.isFinite(projectile?.age) ? projectile.age : 0) <= 0;
    if (spawnedThisTick) {
      // Keep newly spawned projectiles alive for at least one returned tick.
      steppedProjectiles.push(nextProjectile);
      continue;
    }
    const projectileSize = 12;
    const projectileBounds = {
      x: nextProjectile.x,
      y: nextProjectile.y,
      w: projectileSize,
      h: projectileSize,
    };
    const outsideWorld = Number.isFinite(worldWidthPx) && Number.isFinite(worldHeightPx)
      ? (nextProjectile.x < -tileSize || nextProjectile.x > worldWidthPx + tileSize || nextProjectile.y < -tileSize || nextProjectile.y > worldHeightPx + tileSize)
      : false;
    const expired = nextProjectile.age >= Math.max(0.001, nextProjectile.maxAge);
    if (outsideWorld || expired) {
      continue;
    }
    if (!impacted && doesAabbOverlapSolidTile(worldPacket, tileSize, projectileBounds)) {
      nextProjectile.impacted = true;
      nextProjectile.vx = 0;
      nextProjectile.vy = 0;
      nextProjectile.gravity = 0;
    }
    if (isAabbOverlap(projectileBounds, playerBounds)) {
      nextPlayer = applyDarkCreatureDamageToPlayer(
        nextPlayer,
        nextProjectile.x + projectileSize * 0.5,
        nextProjectile.knockbackX,
        nextProjectile.knockbackY,
        nextProjectile.energyLoss,
      );
      continue;
    }
    steppedProjectiles.push(nextProjectile);
  }

  const persistedProjectiles = [
    ...steppedProjectiles,
    ...spawnedProjectiles.map((spawnedProjectile) => ({ ...spawnedProjectile })),
  ];

  return {
    entities,
    player: nextPlayer,
    darkProjectiles: persistedProjectiles,
    nextDarkProjectileId: nextProjectileId,
  };
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

function buildRuntimeFlareLights(flares) {
  return Array.isArray(flares)
    ? flares.map((flare) => buildFlareLightSnapshot(flare)).filter((flare) => flare && flare.lightRadius > 0)
    : [];
}

function isFireflyTriggeredByAnyLightRuntime(entity, entities, playerLight, flareLights) {
  const aggroR = Number.isFinite(entity?.aggroR) && entity.aggroR > 0 ? entity.aggroR : 0;
  if (aggroR <= 0) {
    return false;
  }
  const fireflyCx = entity.x + (Number.isFinite(entity?.footprintW) ? entity.footprintW : entity.size || 24) * 0.5;
  const fireflyCy = entity.y + (Number.isFinite(entity?.footprintH) ? entity.footprintH : entity.size || 24) * 0.5;

  if (playerLight && playerLight.radius > 0) {
    const d = Math.hypot(fireflyCx - playerLight.x, fireflyCy - playerLight.y);
    if (d <= aggroR && d <= playerLight.radius) {
      return true;
    }
  }

  for (const other of entities) {
    if (!other || other.active !== true || other.id === entity.id) {
      continue;
    }
    if (!isLanternEntityType(other.type)) {
      continue;
    }
    const radius = Number.isFinite(other?.params?.radius) && other.params.radius > 0
      ? other.params.radius
      : DEFAULT_LANTERN_RADIUS_PX;
    const strength = Number.isFinite(other?.params?.strength) && other.params.strength > 0
      ? other.params.strength
      : DEFAULT_LANTERN_STRENGTH;
    if (strength <= 0.01) {
      continue;
    }
    const center = getEntityCenter(other);
    const d = Math.hypot(fireflyCx - center.x, fireflyCy - center.y);
    if (d <= aggroR && d <= radius) {
      return true;
    }
  }

  for (const flare of flareLights) {
    const d = Math.hypot(fireflyCx - flare.x, fireflyCy - flare.y);
    if (d <= aggroR && d <= flare.lightRadius) {
      return true;
    }
  }

  return false;
}

function findFireflyPerch(worldPacket, firefly, fromX, fromY, tileSize, worldWidth, worldHeight) {
  const decor = Array.isArray(worldPacket?.layers?.decor) ? worldPacket.layers.decor : [];
  if (decor.length === 0) {
    return null;
  }
  const rx = Number.isFinite(firefly?.flyRX) ? firefly.flyRX : 5 * tileSize;
  const ry = Number.isFinite(firefly?.flyRY) ? firefly.flyRY : 5 * tileSize;
  const perchR = Number.isFinite(firefly?.perchR) ? firefly.perchR : 6 * tileSize;
  const worldWidthPx = Number.isFinite(worldWidth) ? worldWidth * tileSize : null;
  const worldHeightPx = Number.isFinite(worldHeight) ? worldHeight * tileSize : null;
  let best = null;
  let bestD = Infinity;
  for (const item of decor) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const rawX = Number.isFinite(item?.x) ? item.x : null;
    const rawY = Number.isFinite(item?.y) ? item.y : null;
    if (rawX == null || rawY == null) {
      continue;
    }
    const looksTileBased = Number.isFinite(worldWidthPx)
      && Number.isFinite(worldHeightPx)
      && rawX >= 0 && rawY >= 0
      && rawX <= worldWidth + 1
      && rawY <= worldHeight + 1;
    const px = looksTileBased ? rawX * tileSize : rawX;
    const py = looksTileBased ? rawY * tileSize : rawY;
    const inRect = (
      px >= firefly.homeX - rx
      && px <= firefly.homeX + rx
      && py >= firefly.homeY - ry
      && py <= firefly.homeY
    );
    if (!inRect) {
      continue;
    }
    const d = Math.hypot(px - fromX, py - fromY);
    if (d <= perchR && d < bestD) {
      best = { x: px, y: py };
      bestD = d;
    }
  }
  return best;
}

function stepFireflyRuntime(worldPacket, playerState, sourceEntities, flares, options = {}) {
  const entities = Array.isArray(sourceEntities) ? sourceEntities.map((entity) => ({ ...entity })) : [];
  if (entities.length === 0) {
    return { entities, lights: [] };
  }
  const dt = resolveRuntimeDeltaSeconds(options);
  const tileSize = Number.isFinite(worldPacket?.world?.tileSize) && worldPacket.world.tileSize > 0 ? worldPacket.world.tileSize : 24;
  const worldWidth = Number.isFinite(worldPacket?.world?.width) ? worldPacket.world.width : null;
  const worldHeight = Number.isFinite(worldPacket?.world?.height) ? worldPacket.world.height : null;
  const playerLight = {
    x: Number.isFinite(playerState?.position?.x) ? playerState.position.x : 0,
    y: Number.isFinite(playerState?.position?.y) ? playerState.position.y - (tileSize * 0.5) : 0,
    radius: Number.isFinite(playerState?.lightRadius) && playerState.lightRadius > 0
      ? playerState.lightRadius
      : DEFAULT_PLAYER_LIGHT_RADIUS_PX,
  };
  const flareLights = buildRuntimeFlareLights(flares);
  const lights = [];

  const pickWanderTarget = (firefly) => {
    const rx = Number.isFinite(firefly?.flyRX) ? firefly.flyRX : 5 * tileSize;
    const ry = Number.isFinite(firefly?.flyRY) ? firefly.flyRY : 5 * tileSize;
    firefly.destX = firefly.homeX + ((Math.random() * 2 - 1) * rx);
    firefly.destY = firefly.homeY - (Math.random() * ry);
    firefly.tWander = 0.9 + (Math.random() * 0.9);
  };
  const moveToward = (firefly, targetX, targetY, speedMul) => {
    const speed = Number.isFinite(firefly?.flySpeed) ? firefly.flySpeed : 45;
    const smooth = Number.isFinite(firefly?.smooth) ? firefly.smooth : 7;
    const dx = targetX - firefly.x;
    const dy = targetY - firefly.y;
    const dist = Math.hypot(dx, dy) || 1;
    const desiredVx = (dx / dist) * speed * speedMul;
    const desiredVy = (dy / dist) * speed * speedMul;
    firefly.vx += (desiredVx - firefly.vx) * smooth * dt;
    firefly.vy += (desiredVy - firefly.vy) * smooth * dt;
    firefly.x += firefly.vx * dt;
    firefly.y += firefly.vy * dt;
    if (firefly.y > firefly.homeY) {
      firefly.y = firefly.homeY;
    }
    if (Math.abs(firefly.vx) > 1) {
      firefly.dir = firefly.vx >= 0 ? 1 : -1;
    }
    return dist;
  };

  for (const entity of entities) {
    const normalizedType = String(entity?.type || "").trim().toLowerCase();
    if (normalizedType !== "firefly_01" && normalizedType !== "firefly") {
      continue;
    }
    entity.mode = typeof entity.mode === "string" ? entity.mode : "rest";
    entity.homeX = Number.isFinite(entity?.homeX) ? entity.homeX : entity.x;
    entity.homeY = Number.isFinite(entity?.homeY) ? entity.homeY : entity.y;
    entity._tail = Array.isArray(entity?._tail) ? entity._tail.slice(-FIREFLY_TAIL_MAX_POINTS) : [];
    entity._tailSpawnT = Number.isFinite(entity?._tailSpawnT) ? entity._tailSpawnT : 0;
    entity.cdT = Number.isFinite(entity?.cdT) ? entity.cdT : 0;
    entity.lightK = Number.isFinite(entity?.lightK) ? Math.max(0, Math.min(1, entity.lightK)) : 0;
    const fadeIn = Number.isFinite(entity?.fadeIn) && entity.fadeIn > 0 ? entity.fadeIn : 0.35;
    const fadeOut = Number.isFinite(entity?.fadeOut) && entity.fadeOut > 0 ? entity.fadeOut : 0.45;
    const fireflyW = Number.isFinite(entity?.footprintW) ? entity.footprintW : entity.size || 24;
    const fireflyH = Number.isFinite(entity?.footprintH) ? entity.footprintH : entity.size || 24;
    const cx = entity.x + fireflyW * 0.5;
    const cy = entity.y + fireflyH * 0.5;

    if (entity.cdT > 0) {
      entity.cdT = Math.max(0, entity.cdT - dt);
    }
    for (let i = entity._tail.length - 1; i >= 0; i -= 1) {
      const point = entity._tail[i];
      point.t += dt;
      if (point.t > FIREFLY_TAIL_MAX_AGE_SECONDS) {
        entity._tail.splice(i, 1);
      }
    }

    if (entity.mode === "rest") {
      entity.vx = 0;
      entity.vy = 0;
      entity.lightK = 0;
      entity.illuminated = false;
      if (entity.cdT <= 0 && isFireflyTriggeredByAnyLightRuntime(entity, entities, playerLight, flareLights)) {
        entity.mode = "takeoff";
        entity.tFly = Number.isFinite(entity?.flyTime) ? entity.flyTime : 2.5;
        pickWanderTarget(entity);
      }
    } else if (entity.mode === "takeoff") {
      entity.lightK = Math.min(1, entity.lightK + (dt / fadeIn));
      moveToward(entity, entity.destX, entity.destY, 0.65);
      entity.illuminated = entity.lightK > 0.01;
      if (entity.lightK >= 0.999) {
        entity.mode = "fly";
      }
    } else if (entity.mode === "fly") {
      entity.lightK = 1;
      entity.illuminated = true;
      entity.tFly = Math.max(0, (Number.isFinite(entity?.tFly) ? entity.tFly : 0) - dt);
      entity.tWander = Math.max(-1, (Number.isFinite(entity?.tWander) ? entity.tWander : 0) - dt);
      const dist = moveToward(entity, entity.destX, entity.destY, 1);
      entity._tailSpawnT -= dt;
      if (entity._tailSpawnT <= 0) {
        entity._tailSpawnT = 0.04;
        const tailX = entity.dir === 1 ? (entity.x + 2) : (entity.x + fireflyW - 2);
        const tailY = entity.y + fireflyH * 0.65;
        entity._tail.push({ x: tailX + ((Math.random() * 2) - 1), y: tailY + ((Math.random() * 2) - 1), t: 0 });
        if (entity._tail.length > FIREFLY_TAIL_MAX_POINTS) {
          entity._tail.shift();
        }
      }
      if (entity.tWander <= 0 || dist < 8) {
        pickWanderTarget(entity);
      }
      if (entity.tFly <= 0) {
        const perch = findFireflyPerch(worldPacket, entity, cx, cy, tileSize, worldWidth, worldHeight);
        if (perch) {
          entity.landX = perch.x - fireflyW * 0.5;
          entity.landY = perch.y - fireflyH;
        } else {
          entity.landX = entity.homeX;
          entity.landY = entity.homeY;
        }
        entity.mode = "landing";
      }
    } else if (entity.mode === "landing") {
      entity._landingT = (Number.isFinite(entity?._landingT) ? entity._landingT : 0) + dt;
      const dx = entity.landX - entity.x;
      const dy = entity.landY - entity.y;
      const dist = Math.hypot(dx, dy);
      const d0 = 80;
      const speedMul = dist < d0 ? (0.25 + 0.30 * (dist / d0)) : 0.55;
      moveToward(entity, entity.landX, entity.landY, speedMul);
      entity.lightK = 1;
      entity.illuminated = true;
      const nextDx = entity.landX - entity.x;
      const nextDy = entity.landY - entity.y;
      const nextDist = Math.hypot(nextDx, nextDy);
      if (nextDist < 6 || (Math.abs(nextDx) < 2 && Math.abs(nextDy) < 2) || (entity._landingT > 3 && nextDist < 2)) {
        entity.x = entity.landX;
        entity.y = Math.min(entity.landY, entity.homeY);
        entity.vx = 0;
        entity.vy = 0;
        entity.mode = "landed";
        entity._landedT = 0;
        entity._landingT = 0;
      }
    } else if (entity.mode === "landed") {
      entity.vx = 0;
      entity.vy = 0;
      entity._landedT = (Number.isFinite(entity?._landedT) ? entity._landedT : 0) + dt;
      const hold = Math.max(0.05, 0.6 - fadeOut);
      if (entity._landedT <= hold) {
        entity.lightK = 1;
      } else {
        const p = Math.max(0, Math.min(1, (entity._landedT - hold) / fadeOut));
        entity.lightK = 1 - p;
      }
      entity.illuminated = entity.lightK > 0.01;
      if (entity._landedT >= hold + fadeOut) {
        entity.lightK = 0;
        entity.illuminated = false;
        entity.mode = "rest";
        entity.cdT = Number.isFinite(entity?.cooldown) ? entity.cooldown : 2;
      }
    } else {
      entity.mode = "rest";
      entity.lightK = 0;
      entity.illuminated = false;
    }

    if (entity.lightK > 0.01) {
      lights.push({
        entityId: entity.id,
        type: "firefly",
        x: entity.x + fireflyW * 0.5,
        y: entity.y + fireflyH * 0.5,
        radius: (Number.isFinite(entity?.lightRadius) ? entity.lightRadius : 120) * entity.lightK,
        strength: (Number.isFinite(entity?.lightStrength) ? entity.lightStrength : 0.8) * entity.lightK,
      });
    }
  }
  return { entities, lights };
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

function doesAabbOverlapSolidTile(worldPacket, tileSize, bounds) {
  if (!Number.isFinite(tileSize) || tileSize <= 0 || !bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y) || !Number.isFinite(bounds.w) || !Number.isFinite(bounds.h)) {
    return false;
  }
  const minGridX = Math.floor(bounds.x / tileSize);
  const maxGridX = Math.floor((bounds.x + bounds.w - 0.001) / tileSize);
  const minGridY = Math.floor(bounds.y / tileSize);
  const maxGridY = Math.floor((bounds.y + bounds.h - 0.001) / tileSize);
  for (let gridY = minGridY; gridY <= maxGridY; gridY += 1) {
    for (let gridX = minGridX; gridX <= maxGridX; gridX += 1) {
      if (isRuntimeGridSolid(worldPacket, gridX, gridY)) {
        return true;
      }
    }
  }
  return false;
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

function resolveCheckpointRespawnPlacement(worldPacket, playerState) {
  const tileSize = Number.isFinite(worldPacket?.world?.tileSize) && worldPacket.world.tileSize > 0
    ? worldPacket.world.tileSize
    : 24;
  const checkpoint = playerState?.checkpoint && typeof playerState.checkpoint === "object"
    ? playerState.checkpoint
    : null;
  if (!checkpoint) {
    return null;
  }

  const cptx = Number.isFinite(checkpoint?.tx) ? Math.floor(checkpoint.tx) : null;
  const cpty = Number.isFinite(checkpoint?.ty) ? Math.floor(checkpoint.ty) : null;
  if (!Number.isFinite(cptx) || !Number.isFinite(cpty)) {
    return null;
  }

  // V1 canonical: respawn 15 tiles before checkpoint in X, same tile Y.
  const rtx = Math.max(0, cptx - 15);
  const rty = cpty;
  return {
    x: rtx * tileSize,
    y: rty * tileSize,
  };
}

function resolveRemainingLives(playerState) {
  return Number.isFinite(playerState?.lives)
    ? Math.max(0, Math.floor(playerState.lives))
    : DEFAULT_PLAYER_LIVES;
}

function resolveRespawnCountdownState(playerState) {
  const source = playerState?.respawnCountdown && typeof playerState.respawnCountdown === "object"
    ? playerState.respawnCountdown
    : {};
  const active = source.active === true;
  const total = Number.isFinite(source.total) && source.total > 0 ? source.total : RESPAWN_COUNTDOWN_SECONDS;
  const remaining = Number.isFinite(source.remaining) && source.remaining >= 0 ? source.remaining : 0;
  const countdown = Number.isFinite(source.countdown) && source.countdown >= 0 ? source.countdown : Math.ceil(remaining);
  return {
    active,
    total,
    remaining,
    countdown: Math.max(0, Math.floor(countdown)),
    spawnX: Number.isFinite(source.spawnX) ? source.spawnX : null,
    spawnY: Number.isFinite(source.spawnY) ? source.spawnY : null,
    source: typeof source.source === "string" ? source.source : null,
    triggerY: Number.isFinite(source.triggerY) ? source.triggerY : null,
    respawnY: Number.isFinite(source.respawnY) ? source.respawnY : null,
  };
}

function buildRespawnPendingPlayerState(playerState, countdownState, options = {}) {
  const dt = resolveRuntimeDeltaSeconds(options);
  const nextRemaining = Math.max(0, countdownState.remaining - dt);
  const nextCountdown = Math.max(0, Math.ceil(nextRemaining));
  const finalRespawnState = {
    ...countdownState,
    active: nextRemaining > 0,
    remaining: nextRemaining,
    countdown: nextCountdown,
  };
  const waiting = nextRemaining > 0;
  return {
    waiting,
    countdown: finalRespawnState,
    player: {
      position: {
        x: Number.isFinite(playerState?.position?.x) ? playerState.position.x : 0,
        y: Number.isFinite(playerState?.position?.y) ? playerState.position.y : 0,
      },
      velocity: { x: 0, y: 0 },
      grounded: false,
      falling: false,
      rising: false,
      landed: false,
      status: waiting ? "respawn-pending" : "respawn-ready",
    },
  };
}

function buildGameOverPlayerState(playerState) {
  const lives = resolveRemainingLives(playerState);
  const gameOverLives = lives <= 0 ? 0 : lives;
  return {
    ...playerState,
    velocity: { x: 0, y: 0 },
    grounded: false,
    falling: false,
    rising: false,
    landed: false,
    status: "game-over",
    locomotion: "game-over",
    lives: gameOverLives,
    respawnCountdown: {
      active: false,
      total: RESPAWN_COUNTDOWN_SECONDS,
      remaining: 0,
      countdown: 0,
    },
    respawnPending: false,
    gameState: "gameover",
    levelComplete: false,
    intermissionReadyForInput: false,
  };
}

// Respawns to authored spawn after leaving the valid playable region downward.
function maybeResolveBottomRespawn(worldPacket, playerState, verticalStep, options = {}) {
  const respawnY = resolveBottomBoundRespawnY(worldPacket, options);
  const currentY = verticalStep?.position?.y;
  const shouldRespawn = Number.isFinite(respawnY) && Number.isFinite(currentY) && currentY > respawnY;

  if (!shouldRespawn) {
    return null;
  }

  const checkpointRespawn = resolveCheckpointRespawnPlacement(worldPacket, playerState);
  const spawnState = buildRuntimePlayerStartState(worldPacket);
  const fallbackSpawnX = Number.isFinite(spawnState?.position?.x) ? spawnState.position.x : worldPacket?.spawn?.x;
  const fallbackSpawnY = Number.isFinite(spawnState?.position?.y) ? spawnState.position.y : worldPacket?.spawn?.y;
  const spawnX = Number.isFinite(checkpointRespawn?.x) ? checkpointRespawn.x : fallbackSpawnX;
  const spawnY = Number.isFinite(checkpointRespawn?.y) ? checkpointRespawn.y : fallbackSpawnY;
  const grounded = Number.isFinite(checkpointRespawn?.x)
    ? true
    : spawnState?.grounded === true;
  const falling = Number.isFinite(checkpointRespawn?.x)
    ? false
    : spawnState?.falling === true;
  const lives = resolveRemainingLives(playerState);
  const invulnDuration = Number.isFinite(playerState?.invulnDuration) && playerState.invulnDuration > 0
    ? playerState.invulnDuration
    : 1.6;
  const activeRespawnCountdown = resolveRespawnCountdownState(playerState);

  if (activeRespawnCountdown.active) {
    return null;
  }

  const livesAfterDeath = Math.max(0, lives - 1);
  if (livesAfterDeath <= 0) {
    return {
      player: buildGameOverPlayerState({
        ...playerState,
        position: verticalStep.position,
        lives: 0,
      }),
      debug: {
        respawned: false,
        triggerY: currentY,
        respawnY,
        spawnX,
        spawnY,
        source: checkpointRespawn ? "checkpoint-minus-15" : "authored-spawn",
      },
      warning: "Player fell below playable world bounds with no remaining lives.",
    };
  }

  return {
    player: {
      position: verticalStep.position,
      velocity: { x: 0, y: 0 },
      grounded: false,
      falling: false,
      rising: false,
      landed: false,
      status: "respawn-pending",
      lives: livesAfterDeath,
      invuln: Number.isFinite(playerState?.invuln) ? playerState.invuln : 0,
      respawnCountdown: {
        active: true,
        total: RESPAWN_COUNTDOWN_SECONDS,
        remaining: RESPAWN_COUNTDOWN_SECONDS,
        countdown: RESPAWN_COUNTDOWN_SECONDS,
        spawnX,
        spawnY,
        source: checkpointRespawn ? "checkpoint-minus-15" : "authored-spawn",
        triggerY: currentY,
        respawnY,
      },
      _justRespawned: false,
      lockMinX: Number.isFinite(playerState?.lockMinX) ? playerState.lockMinX : 0,
      invulnDuration,
    },
    debug: {
      respawned: false,
      triggerY: currentY,
      respawnY,
      spawnX,
      spawnY,
      source: checkpointRespawn ? "checkpoint-minus-15" : "authored-spawn",
    },
    warning: checkpointRespawn
      ? "Player fell below playable world bounds; respawn countdown started from checkpoint (15 tiles back)."
      : "Player fell below playable world bounds; respawn countdown started at authored spawn.",
  };
}

// Executes one deterministic tick: intent -> locomotion -> velocityX -> horizontal -> jump -> vertical.
export function stepRuntimePlayerSimulation(worldPacket, playerState, options = {}) {
  if (playerState?.gameState === "gameover" || resolveRemainingLives(playerState) <= 0) {
    return {
      ok: true,
      darkProjectiles: Array.isArray(playerState?.darkProjectiles) ? playerState.darkProjectiles : [],
      nextDarkProjectileId: Number.isFinite(playerState?.nextDarkProjectileId) ? playerState.nextDarkProjectileId : 1,
      player: buildGameOverPlayerState(playerState),
      collisions: {
        moveX: 0,
        jump: false,
        locomotion: "game-over",
        velocityX: 0,
        blockedLeft: false,
        blockedRight: false,
        grounded: false,
        falling: false,
        rising: false,
        landed: false,
        collidedBelow: false,
      },
      status: "game-over",
      errors: [],
      warnings: [],
      debug: {
        finalized: {
          gameState: "gameover",
          lives: 0,
        },
      },
      entities: Array.isArray(playerState?.entities) ? playerState.entities.map((entity) => ({ ...entity })) : [],
    };
  }

  const lives = resolveRemainingLives(playerState);
  const respawnCountdown = resolveRespawnCountdownState(playerState);
  const priorCompletion = playerState?.levelComplete === true || playerState?.gameState === "intermission";
  if (priorCompletion) {
    return {
      ok: true,
      darkProjectiles: Array.isArray(playerState?.darkProjectiles) ? playerState.darkProjectiles : [],
      nextDarkProjectileId: Number.isFinite(playerState?.nextDarkProjectileId) ? playerState.nextDarkProjectileId : 1,
      player: {
        ...playerState,
        levelComplete: true,
        intermissionReadyForInput: true,
        gameState: "intermission",
        status: "level-complete",
      },
      collisions: {
        moveX: 0,
        jump: false,
        locomotion: "level-complete",
        velocityX: 0,
        blockedLeft: false,
        blockedRight: false,
        grounded: playerState?.grounded === true,
        falling: false,
        rising: false,
        landed: false,
        collidedBelow: false,
      },
      status: "level-complete",
      errors: [],
      warnings: [],
      debug: {
        finalized: {
          levelComplete: true,
          intermissionReadyForInput: true,
          touchedExitId: typeof playerState?.lastExitId === "string" ? playerState.lastExitId : null,
        },
      },
      entities: Array.isArray(playerState?.entities) ? playerState.entities.map((entity) => ({ ...entity })) : [],
    };
  }

  if (respawnCountdown.active) {
    const pending = buildRespawnPendingPlayerState(playerState, respawnCountdown, options);
    if (pending.waiting) {
      return {
        ok: true,
        darkProjectiles: Array.isArray(playerState?.darkProjectiles) ? playerState.darkProjectiles : [],
        nextDarkProjectileId: Number.isFinite(playerState?.nextDarkProjectileId) ? playerState.nextDarkProjectileId : 1,
        player: {
          ...playerState,
          ...pending.player,
          lives,
          respawnCountdown: pending.countdown,
          locomotion: "respawning-out-of-bounds",
          gameState: "playing",
        },
        collisions: {
          moveX: 0,
          jump: false,
          locomotion: "respawning-out-of-bounds",
          velocityX: 0,
          blockedLeft: false,
          blockedRight: false,
          grounded: false,
          falling: false,
          rising: false,
          landed: false,
          collidedBelow: false,
        },
        status: "respawn-pending",
        errors: [],
        warnings: [],
        debug: {
          finalized: {
            respawnCountdown: pending.countdown.countdown,
          },
        },
        entities: Array.isArray(playerState?.entities) ? playerState.entities.map((entity) => ({ ...entity })) : [],
      };
    }

    const spawnX = Number.isFinite(respawnCountdown.spawnX) ? respawnCountdown.spawnX : 0;
    const spawnY = Number.isFinite(respawnCountdown.spawnY) ? respawnCountdown.spawnY : 0;
    const invulnDuration = Number.isFinite(playerState?.invulnDuration) && playerState.invulnDuration > 0
      ? playerState.invulnDuration
      : 1.6;
    return {
      ok: true,
      darkProjectiles: Array.isArray(playerState?.darkProjectiles) ? playerState.darkProjectiles : [],
      nextDarkProjectileId: Number.isFinite(playerState?.nextDarkProjectileId) ? playerState.nextDarkProjectileId : 1,
      player: {
        ...playerState,
        position: { x: spawnX, y: spawnY },
        velocity: { x: 0, y: 0 },
        grounded: Number.isFinite(respawnCountdown.spawnX),
        falling: false,
        rising: false,
        landed: false,
        status: "respawned-out-of-bounds",
        locomotion: "respawning-out-of-bounds",
        lockMinX: spawnX,
        invuln: invulnDuration,
        _justRespawned: true,
        lives,
        respawnCountdown: {
          ...pending.countdown,
          active: false,
          remaining: 0,
          countdown: 0,
        },
      },
      collisions: {
        moveX: 0,
        jump: false,
        locomotion: "respawning-out-of-bounds",
        velocityX: 0,
        blockedLeft: false,
        blockedRight: false,
        grounded: true,
        falling: false,
        rising: false,
        landed: false,
        collidedBelow: false,
      },
      status: "respawned-out-of-bounds",
      errors: [],
      warnings: [],
      debug: {
        vertical: {
          status: "respawned-out-of-bounds",
          respawned: true,
          triggerY: respawnCountdown.triggerY,
          respawnY: respawnCountdown.respawnY,
          respawnSpawnX: spawnX,
          respawnSpawnY: spawnY,
          respawnSource: respawnCountdown.source,
        },
      },
      entities: Array.isArray(playerState?.entities) ? playerState.entities.map((entity) => ({ ...entity })) : [],
    };
  }

  const intent = buildRuntimePlayerIntent(options?.input ?? options?.intent ?? options);
  const pulseStep = stepPulse(playerState, intent, options);
  const boostActive = intent?.boost === true && pulseStep.energy > DEFAULT_BOOST_MIN_ENERGY;
  const locomotionStateBase = buildRuntimePlayerLocomotionState(playerState, intent, { ...options, worldPacket });
  const brakeState = stepRuntimePlayerBrakeState(playerState, intent, locomotionStateBase, options);
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

  const bottomRespawn = maybeResolveBottomRespawn(worldPacket, playerState, verticalStep, options);
  const resolvedPlayerStep = bottomRespawn?.player ?? verticalStep;
  const normalizedEntities = normalizeRuntimeEntities(options?.entities, worldPacket, playerState);
  const checkpointStep = stepCheckpointOverlap(worldPacket, {
    ...playerState,
    position: resolvedPlayerStep.position,
  }, normalizedEntities);
  const pickupStep = stepPickupCollection(worldPacket, {
    ...playerState,
    position: resolvedPlayerStep.position,
  }, normalizedEntities);
  const exitStep = stepExitOverlap(worldPacket, {
    ...playerState,
    position: resolvedPlayerStep.position,
  }, pickupStep.entities);
  const flareStep = stepFlares(worldPacket, playerState, intent, {
    ...options,
    flareStash: pickupStep.flareStash,
    availableEnergy: pulseStep.energy,
  });
  const flareEntityStep = stepFlareEntityInteractions(
    exitStep.entities,
    flareStep.flares,
  );
  const fireflyStep = stepFireflyRuntime(
    worldPacket,
    { ...playerState, position: resolvedPlayerStep.position },
    flareEntityStep.entities,
    flareStep.flares,
    options,
  );
  const entityStep = stepPulseEntityInteractions(worldPacket, playerState, pulseStep.pulse, fireflyStep.entities, options);
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
  const darkCreatureStep = stepDarkCreatureRuntime(
    worldPacket,
    {
      ...playerState,
      position: resolvedPlayerStep.position,
      velocity: resolvedPlayerStep.velocity,
      pulse: pulseStep.pulse,
      energy: nextEnergy,
      darkProjectiles: playerState?.darkProjectiles,
      nextDarkProjectileId: playerState?.nextDarkProjectileId,
    },
    entityStep.entities,
    options,
  );
  const darkProjectiles = Array.isArray(darkCreatureStep?.darkProjectiles)
    ? normalizeDarkProjectiles({ darkProjectiles: darkCreatureStep.darkProjectiles })
    : normalizeDarkProjectiles({ darkProjectiles: playerState?.darkProjectiles });
  const hoverVoidStep = stepHoverVoidRuntime(
    worldPacket,
    darkCreatureStep?.player ?? {
      ...playerState,
      position: resolvedPlayerStep.position,
      velocity: resolvedPlayerStep.velocity,
    },
    darkCreatureStep.entities,
    options,
  );
  const nextDarkProjectileId = Number.isFinite(darkCreatureStep?.nextDarkProjectileId)
    ? Math.max(1, Math.floor(darkCreatureStep.nextDarkProjectileId))
    : (Number.isFinite(playerState?.nextDarkProjectileId) ? Math.max(1, Math.floor(playerState.nextDarkProjectileId)) : 1);
  const finalVelocity = hoverVoidStep?.player?.velocity && typeof hoverVoidStep.player.velocity === "object"
    ? hoverVoidStep.player.velocity
    : darkCreatureStep?.player?.velocity && typeof darkCreatureStep.player.velocity === "object"
      ? darkCreatureStep.player.velocity
    : resolvedPlayerStep.velocity;
  nextEnergy = Number.isFinite(hoverVoidStep?.player?.energy)
    ? hoverVoidStep.player.energy
    : (Number.isFinite(darkCreatureStep?.player?.energy) ? darkCreatureStep.player.energy : nextEnergy);
  const status = resolvedPlayerStep.status;
  const finalPlayerState = {
    grounded: resolvedPlayerStep.grounded === true,
    falling: resolvedPlayerStep.falling === true,
    rising: resolvedPlayerStep.rising === true,
    landed: resolvedPlayerStep.landed === true,
  };
  const finalGameOver = resolvedPlayerStep?.gameState === "gameover" || resolvedPlayerStep?.status === "game-over";
  const finalLocomotion = finalGameOver
    ? "game-over"
    : status === "respawned-out-of-bounds"
    ? "respawning-out-of-bounds"
    : exitStep.completed
      ? "level-complete"
    : finalPlayerState.grounded && brakeState.active
      ? "braking-grounded"
      : resolveFinalLocomotion(finalPlayerState, intent.moveX);

  return {
    ok: true,
    // FIX: propagate dark projectiles from darkCreatureRuntime to runner
    darkProjectiles: darkCreatureStep.darkProjectiles,
    nextDarkProjectileId: darkCreatureStep.nextDarkProjectileId,
    player: {
      position: resolvedPlayerStep.position,
      velocity: finalVelocity,
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
      entities: hoverVoidStep.entities,
      checkpoint: checkpointStep.checkpoint,
      levelComplete: exitStep.completed === true,
      intermissionReadyForInput: exitStep.completed === true,
      gameState: finalGameOver ? "gameover" : (exitStep.completed === true ? "intermission" : "playing"),
      lastExitId: exitStep.touchedExitId,
      runtimeLights: fireflyStep.lights,
      darkProjectiles,
      nextDarkProjectileId,
      _hoverVoidAttackGlobalCd: Number.isFinite(hoverVoidStep?.player?._hoverVoidAttackGlobalCd)
        ? hoverVoidStep.player._hoverVoidAttackGlobalCd
        : Math.max(0, Number.isFinite(playerState?._hoverVoidAttackGlobalCd) ? playerState._hoverVoidAttackGlobalCd : 0),
      lockMinX: Number.isFinite(resolvedPlayerStep?.lockMinX)
        ? resolvedPlayerStep.lockMinX
        : (Number.isFinite(playerState?.lockMinX) ? playerState.lockMinX : 0),
      invuln: Number.isFinite(resolvedPlayerStep?.invuln)
        ? resolvedPlayerStep.invuln
        : (Number.isFinite(playerState?.invuln) ? playerState.invuln : 0),
      invulnDuration: Number.isFinite(playerState?.invulnDuration) ? playerState.invulnDuration : 1.6,
      _justRespawned: resolvedPlayerStep?._justRespawned === true,
      status,
      lives: Number.isFinite(bottomRespawn?.player?.lives) ? bottomRespawn.player.lives : lives,
      respawnCountdown: bottomRespawn?.player?.respawnCountdown ?? respawnCountdown,
      brakeState,
    },
    collisions: {
      moveX: intent.moveX,
      jump: intent.jump === true,
      locomotion: finalLocomotion,
      velocityX: finalVelocity?.x ?? 0,
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
        respawnSpawnX: bottomRespawn?.debug?.spawnX ?? null,
        respawnSpawnY: bottomRespawn?.debug?.spawnY ?? null,
        respawnSource: bottomRespawn?.debug?.source ?? null,
      },
      finalized: {
        locomotion: finalLocomotion,
        levelComplete: exitStep.completed === true,
        intermissionReadyForInput: exitStep.completed === true,
        gameState: finalGameOver ? "gameover" : (exitStep.completed === true ? "intermission" : "playing"),
        touchedExitId: exitStep.touchedExitId,
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
        checkpointTouched: checkpointStep.touched,
        flareThrowSuppressedByEmptyStash: flareStep.flareThrowSuppressedByEmptyStash,
        flareThrowSuppressedByEnergy: flareStep.flareThrowSuppressedByEnergy,
        flareCleanup: flareStep.cleanup,
        pulseEntityHits: entityStep.hits.length,
        flareEntityAffects: flareEntityStep.flareAffects.length,
        fireflyRuntimeLights: fireflyStep.lights.length,
      },
    },
    entities: hoverVoidStep.entities,
  };
}
