import { getRuntimeTileAtGrid } from "./getRuntimeTileAtGrid.js";
import { resolveLegacyJumpPhysics, resolveRuntimeDeltaSeconds } from "./runtimeLegacyPlayerPhysics.js";
import { isRuntimeTileBlocking, resolveRuntimeTileBehavior } from "./runtimeTileBehavior.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
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
        gravityY: null,
        maxFallSpeedY: null,
      },
    };
  }

  const deltaSeconds = resolveRuntimeDeltaSeconds(options);
  const jumpPhysics = resolveLegacyJumpPhysics(options);
  const currentX = playerState.position.x;
  const currentY = playerState.position.y;
  const currentVelocityX = Number.isFinite(playerState?.velocity?.x) ? playerState.velocity.x : 0;
  const currentVelocityY = Number.isFinite(playerState?.velocity?.y) ? playerState.velocity.y : 0;
  const jumpHeld = playerState?.jumpHeldLastTick === true;
  const jumpCutVelocityY = !jumpHeld && currentVelocityY < 0
    ? currentVelocityY * jumpPhysics.jumpCutMultiplier
    : currentVelocityY;
  const gravityY = jumpCutVelocityY > 0 ? jumpPhysics.gravityDownY : jumpPhysics.gravityUpY;
  const unclampedVelocityY = jumpCutVelocityY + gravityY * deltaSeconds;
  const maxFallSpeedY = jumpPhysics.maxFallSpeedY;
  const nextVelocityY = unclampedVelocityY > 0 ? Math.min(unclampedVelocityY, maxFallSpeedY) : unclampedVelocityY;
  const nextYCandidate = currentY + nextVelocityY * deltaSeconds;
  const gridX = Math.floor(currentX / tileSize);
  const gridYBelow = Math.floor((nextYCandidate + 1) / tileSize);
  const gridYAbove = Math.floor((nextYCandidate - 1) / tileSize);
  const tileBelow = getRuntimeTileAtGrid(worldPacket, gridX, gridYBelow);
  const tileAbove = getRuntimeTileAtGrid(worldPacket, gridX, gridYAbove);
  const behaviorBelow = tileBelow ? resolveRuntimeTileBehavior(tileBelow) : null;
  const behaviorAbove = tileAbove ? resolveRuntimeTileBehavior(tileAbove) : null;
  const shouldResolveGroundCollision = nextVelocityY >= 0;
  const shouldResolveCeilingCollision = nextVelocityY < 0;

  let collidedBelow = false;
  if (shouldResolveGroundCollision && behaviorBelow) {
    if (behaviorBelow.oneWay === true) {
      const tileTopY = gridYBelow * tileSize;
      const crossedDown = currentY <= tileTopY + 3 && nextYCandidate >= tileTopY;
      collidedBelow = crossedDown && isRuntimeTileBlocking(behaviorBelow, { includeOneWay: true });
    } else {
      collidedBelow = isRuntimeTileBlocking(behaviorBelow, { includeOneWay: false });
    }
  }

  // V1 truth: only true full solids block upward movement; one-way tiles do not.
  let collidedAbove = false;
  if (shouldResolveCeilingCollision && behaviorAbove) {
    collidedAbove = isRuntimeTileBlocking(behaviorAbove, { includeOneWay: false });
  }

  // Resolve floor collisions only while descending or stationary.
  // This prevents bottom-contact probes from pinning Y on the same tick a jump starts upward.
  if (shouldResolveGroundCollision && collidedBelow) {
    const clampedY = Math.min(nextYCandidate, gridYBelow * tileSize - 1);
    const previousGrounded = playerState?.grounded === true;
    const landed = previousGrounded !== true;
    const status = landed ? "landed" : "grounded";

    return {
      ok: true,
      position: { x: currentX, y: clampedY },
      velocity: { x: currentVelocityX, y: 0 },
      grounded: true,
      falling: false,
      rising: false,
      collidedBelow,
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
        gridYAbove,
        gravityY,
        deltaSeconds,
        jumpCutVelocityY,
        maxFallSpeedY,
      },
    };
  }

  // V1 truth: upward movement is blocked by full solids (not one-way/hazard tiles).
  if (shouldResolveCeilingCollision && collidedAbove) {
    const clampedY = Math.max(nextYCandidate, (gridYAbove + 1) * tileSize);

    return {
      ok: true,
      position: { x: currentX, y: clampedY },
      velocity: { x: currentVelocityX, y: 0 },
      grounded: false,
      falling: false,
      rising: false,
      collidedBelow: false,
      landed: false,
      status: "hit-ceiling",
      errors: uniqueMessages(inheritedErrors),
      warnings: uniqueMessages(inheritedWarnings),
      debug: {
        currentVelocityY,
        nextVelocityY,
        nextYCandidate,
        gridX,
        gridYBelow,
        gridYAbove,
        gravityY,
        deltaSeconds,
        jumpCutVelocityY,
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
      gridYAbove,
      gravityY,
      deltaSeconds,
      jumpCutVelocityY,
      maxFallSpeedY,
    },
  };
}
