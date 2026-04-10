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

function resolveConfig(options = {}, grounded = false) {
  const physics = options?.physics ?? {};

  if (grounded) {
    return {
      maxSpeedX: Number.isFinite(physics?.groundMaxSpeedX) ? Math.abs(physics.groundMaxSpeedX) : 4,
      accelerationX: Number.isFinite(physics?.groundAccelerationX) ? Math.abs(physics.groundAccelerationX) : 1,
      frictionX: Number.isFinite(physics?.groundFrictionX) ? Math.abs(physics.groundFrictionX) : 1,
    };
  }

  return {
    maxSpeedX: Number.isFinite(physics?.airMaxSpeedX) ? Math.abs(physics.airMaxSpeedX) : 3,
    accelerationX: Number.isFinite(physics?.airAccelerationX) ? Math.abs(physics.airAccelerationX) : 0.5,
    frictionX: Number.isFinite(physics?.airFrictionX) ? Math.abs(physics.airFrictionX) : 0,
  };
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

  const { maxSpeedX, accelerationX, frictionX } = resolveConfig(options, grounded);
  const desiredVelocityX = moveX * maxSpeedX;

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
    accelerationX,
    maxSpeedX,
    frictionX,
    errors: uniqueMessages(errors),
    warnings: uniqueMessages(warnings),
    debug: {
      rising,
      falling,
      landed,
      moveX,
      desiredVelocityX,
      mode: grounded ? "grounded" : "airborne",
    },
  };
}
