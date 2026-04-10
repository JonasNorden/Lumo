import { isRuntimeGridSolid } from "./isRuntimeGridSolid.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Steps one tiny horizontal movement using tile solidity and immediate blocking.
export function stepRuntimePlayerHorizontalState(worldPacket, playerState, intent = {}) {
  const inheritedWarnings = Array.isArray(playerState?.warnings) ? [...playerState.warnings] : [];
  const inheritedErrors = Array.isArray(playerState?.errors) ? [...playerState.errors] : [];
  const stepWarnings = [...inheritedWarnings, ...(Array.isArray(intent?.warnings) ? intent.warnings : [])];
  const stepErrors = [...inheritedErrors, ...(Array.isArray(intent?.errors) ? intent.errors : [])];

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

  const moveX = Number.isFinite(intent?.moveX) ? Math.max(-1, Math.min(1, Math.trunc(intent.moveX))) : 0;
  const currentX = playerState.position.x;
  const currentY = playerState.position.y;
  const currentVelocityY = Number.isFinite(playerState?.velocity?.y) ? playerState.velocity.y : 0;
  const nextXCandidate = currentX + moveX;
  const probeY = Math.floor(currentY / tileSize);

  let blockedLeft = false;
  let blockedRight = false;
  let finalX = currentX;

  if (moveX < 0) {
    const leftProbeGridX = Math.floor((nextXCandidate - 1) / tileSize);
    blockedLeft = isRuntimeGridSolid(worldPacket, leftProbeGridX, probeY);

    if (!blockedLeft) {
      finalX = nextXCandidate;
    }
  } else if (moveX > 0) {
    const rightProbeGridX = Math.floor((nextXCandidate + 1) / tileSize);
    blockedRight = isRuntimeGridSolid(worldPacket, rightProbeGridX, probeY);

    if (!blockedRight) {
      finalX = nextXCandidate;
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
    velocity: { x: moved ? moveX : 0, y: currentVelocityY },
    moved,
    blockedLeft,
    blockedRight,
    status,
    errors: uniqueMessages(stepErrors),
    warnings: uniqueMessages(stepWarnings),
  };
}
