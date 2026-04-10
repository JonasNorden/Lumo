import { isRuntimeGridSolid } from "./isRuntimeGridSolid.js";
import { RUNTIME_PLAYER_PHYSICS_BASELINE } from "./runtimePlayerPhysicsBaseline.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Resolves deterministic gravity with a tiny fallback to keep Node harness output stable.
function resolveGravityY(options = {}) {
  const configuredGravityY = options?.physics?.gravityY;

  if (Number.isFinite(configuredGravityY) && configuredGravityY > 0) {
    return configuredGravityY;
  }

  return RUNTIME_PLAYER_PHYSICS_BASELINE.gravityY;
}

// Caps downward velocity to keep first-playable fall speed readable.
function resolveMaxFallSpeedY(options = {}) {
  const configuredMaxFallSpeedY = options?.physics?.maxFallSpeedY;

  if (Number.isFinite(configuredMaxFallSpeedY) && configuredMaxFallSpeedY > 0) {
    return configuredMaxFallSpeedY;
  }

  return RUNTIME_PLAYER_PHYSICS_BASELINE.maxFallSpeedY;
}

// Resolves the inclusive world-bottom player Y from world height/tile size metadata.
function resolveWorldBottomY(worldPacket) {
  const tileSize = worldPacket?.world?.tileSize;
  const worldHeight = worldPacket?.world?.height;

  if (!Number.isFinite(tileSize) || tileSize <= 0) {
    return null;
  }

  if (!Number.isFinite(worldHeight) || worldHeight <= 0) {
    return null;
  }

  return worldHeight * tileSize - 1;
}

// Handles jump/gravity vertical integration and collision against floor solids.
export function stepRuntimePlayerVerticalState(worldPacket, playerState, options = {}) {
  const inheritedWarnings = Array.isArray(playerState?.warnings) ? [...playerState.warnings] : [];
  const inheritedErrors = Array.isArray(playerState?.errors) ? [...playerState.errors] : [];
  const tileSize = worldPacket?.world?.tileSize;
  const hasUsableTileSize = Number.isFinite(tileSize) && tileSize > 0;
  const hasPositionX = Number.isFinite(playerState?.position?.x);
  const hasPositionY = Number.isFinite(playerState?.position?.y);

  if (!hasUsableTileSize || !hasPositionX || !hasPositionY) {
    return {
      ok: false,
      position: { x: null, y: null },
      velocity: {
        x: Number.isFinite(playerState?.velocity?.x) ? playerState.velocity.x : 0,
        y: Number.isFinite(playerState?.velocity?.y) ? playerState.velocity.y : 0,
      },
      grounded: false,
      falling: false,
      rising: false,
      collidedBelow: false,
      landed: false,
      status: "invalid-vertical-state",
      errors: uniqueMessages([...inheritedErrors, "Player position or world tileSize is invalid for vertical step."]),
      warnings: uniqueMessages(inheritedWarnings),
      debug: {
        currentVelocityY: Number.isFinite(playerState?.velocity?.y) ? playerState.velocity.y : 0,
        gravityY: resolveGravityY(options),
        maxFallSpeedY: resolveMaxFallSpeedY(options),
      },
    };
  }

  const gravityY = resolveGravityY(options);
  const currentX = playerState.position.x;
  const currentY = playerState.position.y;
  const currentVelocityX = Number.isFinite(playerState?.velocity?.x) ? playerState.velocity.x : 0;
  const currentVelocityY = Number.isFinite(playerState?.velocity?.y) ? playerState.velocity.y : 0;
  const unclampedVelocityY = currentVelocityY + gravityY;
  const maxFallSpeedY = resolveMaxFallSpeedY(options);
  const nextVelocityY = unclampedVelocityY > 0 ? Math.min(unclampedVelocityY, maxFallSpeedY) : unclampedVelocityY;
  const nextYCandidate = currentY + nextVelocityY;
  const gridX = Math.floor(currentX / tileSize);
  const gridYBelow = Math.floor((nextYCandidate + 1) / tileSize);
  const collidedBelow = isRuntimeGridSolid(worldPacket, gridX, gridYBelow);
  const worldBottomY = resolveWorldBottomY(worldPacket);
  const collidedWithWorldBottom = Number.isFinite(worldBottomY) && nextYCandidate >= worldBottomY;
  const shouldResolveGroundCollision = nextVelocityY >= 0;

  // Resolve floor/world-bottom collisions only while descending or stationary.
  // This prevents bottom-contact probes from pinning Y on the same tick a jump starts upward.
  if (shouldResolveGroundCollision && (collidedBelow || collidedWithWorldBottom)) {
    const collisionFloorY = collidedBelow ? gridYBelow * tileSize - 1 : worldBottomY;
    const clampedY = Math.min(nextYCandidate, collisionFloorY);
    const previousGrounded = playerState?.grounded === true;
    const landed = previousGrounded !== true;
    const status = landed
      ? collidedBelow
        ? "landed"
        : "landed-world-bottom"
      : collidedBelow
        ? "grounded"
        : "grounded-world-bottom";

    return {
      ok: true,
      position: { x: currentX, y: clampedY },
      velocity: { x: currentVelocityX, y: 0 },
      grounded: true,
      falling: false,
      rising: false,
      collidedBelow: collidedBelow || collidedWithWorldBottom,
      landed,
      status,
      errors: uniqueMessages(inheritedErrors),
      warnings: uniqueMessages(inheritedWarnings),
      debug: {
        currentVelocityY,
        nextVelocityY,
        nextYCandidate,
        gridX,
        gridYBelow,
        gravityY,
        worldBottomY,
        collidedWithWorldBottom,
        maxFallSpeedY,
      },
    };
  }

  const rising = nextVelocityY < 0;
  const falling = nextVelocityY > 0;

  return {
    ok: true,
    position: { x: currentX, y: nextYCandidate },
    velocity: { x: currentVelocityX, y: nextVelocityY },
    grounded: false,
    falling,
    rising,
    collidedBelow: false,
    landed: false,
    status: rising ? "rising" : falling ? "falling" : "airborne-idle",
    errors: uniqueMessages(inheritedErrors),
    warnings: uniqueMessages(inheritedWarnings),
    debug: {
      currentVelocityY,
      nextVelocityY,
      nextYCandidate,
      gridX,
      gridYBelow,
      gravityY,
      worldBottomY,
      collidedWithWorldBottom,
      maxFallSpeedY,
    },
  };
}
