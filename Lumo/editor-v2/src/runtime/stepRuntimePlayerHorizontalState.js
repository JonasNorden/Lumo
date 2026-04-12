import { isRuntimeGridSolid } from "./isRuntimeGridSolid.js";
import { resolveRuntimeDeltaSeconds } from "./runtimeLegacyPlayerPhysics.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Steps horizontal position using velocity.x and stops cleanly when a solid tile blocks movement.
export function stepRuntimePlayerHorizontalState(worldPacket, playerState, horizontalInput = {}) {
  const inheritedWarnings = Array.isArray(playerState?.warnings) ? [...playerState.warnings] : [];
  const inheritedErrors = Array.isArray(playerState?.errors) ? [...playerState.errors] : [];
  const stepWarnings = [...inheritedWarnings, ...(Array.isArray(horizontalInput?.warnings) ? horizontalInput.warnings : [])];
  const stepErrors = [...inheritedErrors, ...(Array.isArray(horizontalInput?.errors) ? horizontalInput.errors : [])];

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
      moved: false,
      blockedLeft: false,
      blockedRight: false,
      status: "invalid-horizontal-state",
      errors: uniqueMessages([...stepErrors, "Player position or world tileSize is invalid for horizontal step."]),
      warnings: uniqueMessages(stepWarnings),
    };
  }

  const currentX = playerState.position.x;
  const currentY = playerState.position.y;
  const currentVelocityY = Number.isFinite(playerState?.velocity?.y) ? playerState.velocity.y : 0;
  const deltaSeconds = resolveRuntimeDeltaSeconds(horizontalInput?.options ?? {});
  const nextVelocityX = Number.isFinite(horizontalInput?.velocityX)
    ? horizontalInput.velocityX
    : Number.isFinite(playerState?.velocity?.x)
      ? playerState.velocity.x
      : 0;

  const nextXCandidate = currentX + nextVelocityX * deltaSeconds;
  const probeY = Math.floor(currentY / tileSize);

  let blockedLeft = false;
  let blockedRight = false;
  let finalX = nextXCandidate;
  let finalVelocityX = nextVelocityX;

  if (nextVelocityX < 0) {
    const leftProbeGridX = Math.floor((nextXCandidate - 1) / tileSize);
    blockedLeft = isRuntimeGridSolid(worldPacket, leftProbeGridX, probeY);

    if (blockedLeft) {
      finalX = currentX;
      finalVelocityX = 0;
    }
  } else if (nextVelocityX > 0) {
    const rightProbeGridX = Math.floor((nextXCandidate + 1) / tileSize);
    blockedRight = isRuntimeGridSolid(worldPacket, rightProbeGridX, probeY);

    if (blockedRight) {
      finalX = currentX;
      finalVelocityX = 0;
    }
  }

  const moved = finalX !== currentX;
  const status = blockedLeft
    ? "blocked-left"
    : blockedRight
      ? "blocked-right"
      : moved
        ? "moved-horizontal"
        : "idle-horizontal";

  return {
    ok: true,
    position: { x: finalX, y: currentY },
    velocity: { x: finalVelocityX, y: currentVelocityY },
    moved,
    blockedLeft,
    blockedRight,
    status,
    errors: uniqueMessages(stepErrors),
    warnings: uniqueMessages(stepWarnings),
    debug: {
      currentX,
      nextXCandidate,
      probeY,
      requestedVelocityX: nextVelocityX,
      deltaSeconds,
      finalVelocityX,
    },
  };
}
