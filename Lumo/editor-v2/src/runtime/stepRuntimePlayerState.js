import { isRuntimeGridSolid } from "./isRuntimeGridSolid.js";
import { resolveLegacyJumpPhysics, resolveRuntimeDeltaSeconds } from "./runtimeLegacyPlayerPhysics.js";

// Advances runtime player state by one tiny gravity-only tick.
export function stepRuntimePlayerState(worldPacket, playerState) {
  const inheritedWarnings = Array.isArray(playerState?.warnings) ? [...playerState.warnings] : [];
  const inheritedErrors = Array.isArray(playerState?.errors) ? [...playerState.errors] : [];
  const tileSize = worldPacket?.world?.tileSize;
  const hasUsableTileSize = Number.isFinite(tileSize) && tileSize > 0;
  const hasPositionX = Number.isFinite(playerState?.position?.x);
  const hasPositionY = Number.isFinite(playerState?.position?.y);
  const hasUsablePosition = hasPositionX && hasPositionY;

  if (!hasUsablePosition || !hasUsableTileSize) {
    return {
      ok: false,
      position: { x: null, y: null },
      velocity: { x: 0, y: 0 },
      grounded: false,
      falling: false,
      collidedBelow: false,
      status: "invalid-player-state",
      errors: [...inheritedErrors, "Player position is missing or invalid for runtime step."],
      warnings: inheritedWarnings,
    };
  }

  const currentPositionX = playerState.position.x;
  const currentPositionY = playerState.position.y;
  const currentVelocityX = Number.isFinite(playerState?.velocity?.x) ? playerState.velocity.x : 0;
  const currentVelocityY = Number.isFinite(playerState?.velocity?.y) ? playerState.velocity.y : 0;
  const deltaSeconds = resolveRuntimeDeltaSeconds();
  const jumpPhysics = resolveLegacyJumpPhysics();
  const nextVelocityY = Math.min(currentVelocityY + jumpPhysics.gravityDownY * deltaSeconds, jumpPhysics.maxFallSpeedY);
  const nextPositionY = currentPositionY + nextVelocityY * deltaSeconds;
  const gridX = Math.floor(currentPositionX / tileSize);
  const gridYBelow = Math.floor((nextPositionY + 1) / tileSize);
  const solidBelow = isRuntimeGridSolid(worldPacket, gridX, gridYBelow);

  if (solidBelow) {
    const clampedPositionY = Math.min(nextPositionY, gridYBelow * tileSize - 1);

    return {
      ok: true,
      position: { x: currentPositionX, y: clampedPositionY },
      velocity: { x: currentVelocityX, y: 0 },
      grounded: true,
      falling: false,
      collidedBelow: true,
      status: "grounded",
      errors: inheritedErrors,
      warnings: inheritedWarnings,
    };
  }

  return {
    ok: true,
    position: { x: currentPositionX, y: nextPositionY },
    velocity: { x: currentVelocityX, y: nextVelocityY },
    grounded: false,
    falling: true,
    collidedBelow: false,
    status: "falling",
    errors: inheritedErrors,
    warnings: inheritedWarnings,
  };
}
