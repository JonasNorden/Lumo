import { isRuntimeGridSolid } from "./isRuntimeGridSolid.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Resolves deterministic jump force with a defensive default.
function resolveJumpVelocityY(options = {}) {
  const configuredVelocityY = options?.physics?.jumpVelocityY;

  if (Number.isFinite(configuredVelocityY) && configuredVelocityY < 0) {
    return configuredVelocityY;
  }

  return -8;
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

  const jumpRequested = intent?.jump === true;
  const groundedByState = playerState?.grounded === true;
  const contactProbe = detectGroundContact(worldPacket, playerState);
  const groundedByProbe = contactProbe.touchingGround === true;
  const canJump = groundedByState || groundedByProbe;

  if (contactProbe.ok !== true) {
    errors.push(...(contactProbe.errors ?? []));
  }

  if (!jumpRequested) {
    return {
      ok: errors.length === 0,
      canJump,
      startedJump: false,
      velocity: {
        x: Number.isFinite(playerState?.velocity?.x) ? playerState.velocity.x : 0,
        y: Number.isFinite(playerState?.velocity?.y) ? playerState.velocity.y : 0,
      },
      grounded: canJump,
      falling: Number.isFinite(playerState?.velocity?.y) ? playerState.velocity.y > 0 : false,
      status: "no-jump",
      errors: uniqueMessages(errors),
      warnings: uniqueMessages(warnings),
      debug: {
        jumpRequested,
        groundedByState,
        groundedByProbe,
        probe: contactProbe.probe,
      },
    };
  }

  if (!canJump) {
    return {
      ok: errors.length === 0,
      canJump: false,
      startedJump: false,
      velocity: {
        x: Number.isFinite(playerState?.velocity?.x) ? playerState.velocity.x : 0,
        y: Number.isFinite(playerState?.velocity?.y) ? playerState.velocity.y : 0,
      },
      grounded: false,
      falling: Number.isFinite(playerState?.velocity?.y) ? playerState.velocity.y > 0 : true,
      status: "jump-blocked-not-grounded",
      errors: uniqueMessages(errors),
      warnings: uniqueMessages(warnings),
      debug: {
        jumpRequested,
        groundedByState,
        groundedByProbe,
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
      y: resolveJumpVelocityY(options),
    },
    grounded: false,
    falling: false,
    status: "jump-started",
    errors: uniqueMessages(errors),
    warnings: uniqueMessages(warnings),
    debug: {
      jumpRequested,
      groundedByState,
      groundedByProbe,
      probe: contactProbe.probe,
    },
  };
}
