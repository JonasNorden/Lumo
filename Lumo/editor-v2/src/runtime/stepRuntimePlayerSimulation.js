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
const DEFAULT_FLARE_SPAWN_OFFSET_PX = 10;
const DEFAULT_FLARE_SPAWN_HEIGHT_OFFSET_PX = 8;
const DEFAULT_FLARE_GRAVITY_PX_PER_SECOND = 980;
const DEFAULT_FLARE_BOUNCE_ENERGY = 0.4;
const DEFAULT_FLARE_BOUNCE_FRICTION = 0.85;
const DEFAULT_FLARE_MAX_BOUNCES = 2;
const DEFAULT_FLARE_SETTLE_SPEED_PX_PER_SECOND = 24;
const FLARE_MAX_ACTIVE = 8;

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

  const existingFlares = normalizeExistingFlares(playerState);
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

    const nextTtlTicks = flare.ttlTicks - 1;
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
      collided: false,
      expired: false,
    });
  }

  let nextFlareId = nextFlareIdBase;
  if (pressedThisTick && nextFlares.length < FLARE_MAX_ACTIVE) {
    nextFlares.push(buildFlareProjectile(playerState, facingX, nextFlareId));
    nextFlareId += 1;
  }

  return {
    flares: nextFlares,
    flareHeldLastTick: intent?.flare === true,
    flareSpawned: pressedThisTick && nextFlares.length > existingFlares.length,
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
  const locomotionState = buildRuntimePlayerLocomotionState(playerState, intent, options);
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
  const flareStep = stepFlares(worldPacket, playerState, intent, options);
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
        pulse: { supported: true, wired: false },
        flare: { supported: true, wired: true, activeCount: flareStep.flares.length },
        boost: { supported: true, wired: false },
        attack: { supported: false, wired: false },
      },
      flares: bottomRespawn ? [] : flareStep.flares,
      flareHeldLastTick: flareStep.flareHeldLastTick,
      facingX: flareStep.facingX,
      nextFlareId: flareStep.nextFlareId,
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
        flareSpawned: flareStep.flareSpawned,
        flareCount: flareStep.flares.length,
        flareCleanup: flareStep.cleanup,
      },
    },
  };
}
