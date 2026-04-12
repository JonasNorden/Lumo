import { isRuntimeGridSolid } from "./isRuntimeGridSolid.js";
import { resolveLegacyJumpPhysics, resolveRuntimeDeltaSeconds } from "./runtimeLegacyPlayerPhysics.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Detects if player stands directly above solid ground when grounded flag is stale/missing.
function detectGroundContact(worldPacket, playerState) {
  const tileSize = worldPacket?.world?.tileSize;
  const hasUsableTileSize = Number.isFinite(tileSize) && tileSize > 0;
  const hasPositionX = Number.isFinite(playerState?.position?.x);
  const hasPositionY = Number.isFinite(playerState?.position?.y);

  if (!hasUsableTileSize || !hasPositionX || !hasPositionY) {
    return {
      ok: false,
      canProbe: false,
      touchingGround: false,
      probe: null,
      errors: ["Cannot evaluate jump ground contact because player position or tileSize is invalid."],
      warnings: [],
    };
  }

  const probeGridX = Math.floor(playerState.position.x / tileSize);
  const probeGridY = Math.floor((playerState.position.y + 1) / tileSize);
  const touchingGround = isRuntimeGridSolid(worldPacket, probeGridX, probeGridY);

  return {
    ok: true,
    canProbe: true,
    touchingGround,
    probe: {
      gridX: probeGridX,
      gridY: probeGridY,
    },
    errors: [],
    warnings: [],
  };
}

// Evaluates jump intent and returns a small explicit state packet for the vertical step.
export function buildRuntimePlayerJumpState(worldPacket, playerState, intent = {}, options = {}) {
  const inheritedWarnings = Array.isArray(playerState?.warnings) ? [...playerState.warnings] : [];
  const inheritedErrors = Array.isArray(playerState?.errors) ? [...playerState.errors] : [];
  const warnings = [...inheritedWarnings, ...(Array.isArray(intent?.warnings) ? intent.warnings : [])];
  const errors = [...inheritedErrors, ...(Array.isArray(intent?.errors) ? intent.errors : [])];

  const jumpHeld = intent?.jump === true;
  const jumpHeldLastTick = playerState?.jumpHeldLastTick === true;
  const jumpPressed = jumpHeld && !jumpHeldLastTick;
  const deltaSeconds = resolveRuntimeDeltaSeconds(options);
  const jumpPhysics = resolveLegacyJumpPhysics(options);
  const groundedByState = playerState?.grounded === true;
  const contactProbe = detectGroundContact(worldPacket, playerState);
  const groundedByProbe = contactProbe.touchingGround === true;
  const groundedNow = groundedByState || groundedByProbe;
  const coyoteTimer = groundedNow
    ? jumpPhysics.coyoteTimeSeconds
    : Math.max(0, (Number.isFinite(playerState?.coyoteTimer) ? playerState.coyoteTimer : 0) - deltaSeconds);
  const jumpBufferTimer = jumpPressed
    ? jumpPhysics.jumpBufferSeconds
    : Math.max(0, (Number.isFinite(playerState?.jumpBufferTimer) ? playerState.jumpBufferTimer : 0) - deltaSeconds);
  const canJump = coyoteTimer > 0;

  if (contactProbe.ok !== true) {
    errors.push(...(contactProbe.errors ?? []));
  }

  if (!(jumpBufferTimer > 0 && canJump)) {
    return {
      ok: errors.length === 0,
      canJump,
      startedJump: false,
      velocity: {
        x: Number.isFinite(playerState?.velocity?.x) ? playerState.velocity.x : 0,
        y: Number.isFinite(playerState?.velocity?.y) ? playerState.velocity.y : 0,
      },
      grounded: groundedNow,
      falling: Number.isFinite(playerState?.velocity?.y) ? playerState.velocity.y > 0 : false,
      coyoteTimer,
      jumpBufferTimer,
      jumpHeldLastTick: jumpHeld,
      status: jumpBufferTimer > 0 ? "jump-buffered" : "no-jump",
      errors: uniqueMessages(errors),
      warnings: uniqueMessages(warnings),
      debug: {
        jumpPressed,
        jumpHeld,
        groundedByState,
        groundedByProbe,
        coyoteTimer,
        jumpBufferTimer,
        probe: contactProbe.probe,
      },
    };
  }

  return {
    ok: errors.length === 0,
    canJump: true,
    startedJump: true,
    velocity: {
      x: Number.isFinite(playerState?.velocity?.x) ? playerState.velocity.x : 0,
      y: jumpPhysics.jumpVelocityY,
    },
    grounded: false,
    falling: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    jumpHeldLastTick: jumpHeld,
    status: "jump-started",
    errors: uniqueMessages(errors),
    warnings: uniqueMessages(warnings),
    debug: {
      jumpPressed,
      jumpHeld,
      groundedByState,
      groundedByProbe,
      coyoteTimer,
      jumpBufferTimer,
      probe: contactProbe.probe,
    },
  };
}
