import { buildRuntimePlayerIntent } from "./buildRuntimePlayerIntent.js";
import { buildRuntimePlayerLocomotionState } from "./buildRuntimePlayerLocomotionState.js";
import { stepRuntimePlayerVelocityX } from "./stepRuntimePlayerVelocityX.js";
import { stepRuntimePlayerHorizontalState } from "./stepRuntimePlayerHorizontalState.js";
import { buildRuntimePlayerJumpState } from "./buildRuntimePlayerJumpState.js";
import { stepRuntimePlayerVerticalState } from "./stepRuntimePlayerVerticalState.js";
import { buildRuntimePlayerStartState } from "./buildRuntimePlayerStartState.js";

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
      locomotion: finalLocomotion,
      grounded: finalPlayerState.grounded,
      falling: finalPlayerState.falling,
      rising: finalPlayerState.rising,
      landed: finalPlayerState.landed,
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
      },
    },
  };
}
