import { resolveLegacyHorizontalPhysics } from "./runtimeLegacyPlayerPhysics.js";
import { resolveRuntimeGroundSurface } from "./runtimeTileBehavior.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

function clampMoveX(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(-1, Math.min(1, Math.trunc(value)));
}

// Builds a compact locomotion packet so movement rules can differ for grounded vs air ticks.
export function buildRuntimePlayerLocomotionState(playerState, intent = {}, options = {}) {
  const warnings = [...(Array.isArray(playerState?.warnings) ? playerState.warnings : []), ...(Array.isArray(intent?.warnings) ? intent.warnings : [])];
  const errors = [...(Array.isArray(playerState?.errors) ? playerState.errors : []), ...(Array.isArray(intent?.errors) ? intent.errors : [])];

  const grounded = playerState?.grounded === true;
  const rising = playerState?.rising === true;
  const falling = playerState?.falling === true;
  const landed = playerState?.landed === true;
  const moveX = clampMoveX(intent?.moveX);

  const { maxSpeedX, accelerationX, frictionX } = resolveLegacyHorizontalPhysics(options, grounded);
  const surface = grounded ? resolveRuntimeGroundSurface(options?.worldPacket, playerState) : null;
  const surfaceSpeedMul = Number.isFinite(surface?.maxSpeedMul) ? surface.maxSpeedMul : 1;
  const surfaceAccelMul = Number.isFinite(surface?.groundAccelMul) ? surface.groundAccelMul : 1;
  const surfaceFrictionMul = Number.isFinite(surface?.groundFrictionMul) ? surface.groundFrictionMul : 1;

  const resolvedMaxSpeedX = grounded ? maxSpeedX * surfaceSpeedMul : maxSpeedX;
  const resolvedAccelerationX = grounded ? accelerationX * surfaceAccelMul : accelerationX;
  const resolvedFrictionX = grounded ? frictionX * surfaceFrictionMul : frictionX;
  const desiredVelocityX = moveX * resolvedMaxSpeedX;

  let locomotion = "airborne-neutral";

  if (landed) {
    locomotion = "landing";
  } else if (rising) {
    locomotion = "rising";
  } else if (falling && moveX === 0) {
    locomotion = "falling";
  } else if (grounded) {
    locomotion = moveX === 0 ? "idle-grounded" : "moving-grounded";
  } else {
    locomotion = moveX === 0 ? "airborne-neutral" : "airborne-moving";
  }

  return {
    ok: errors.length === 0,
    locomotion,
    grounded,
    moveX,
    desiredVelocityX,
    accelerationX: resolvedAccelerationX,
    maxSpeedX: resolvedMaxSpeedX,
    frictionX: resolvedFrictionX,
    options,
    errors: uniqueMessages(errors),
    warnings: uniqueMessages(warnings),
    debug: {
      rising,
      falling,
      landed,
      moveX,
      desiredVelocityX,
      mode: grounded ? "grounded" : "airborne",
      surface,
    },
  };
}
