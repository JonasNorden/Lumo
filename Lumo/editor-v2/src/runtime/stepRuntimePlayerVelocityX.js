import { resolveRuntimeDeltaSeconds } from "./runtimeLegacyPlayerPhysics.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

function clampVelocity(value, maxSpeedX) {
  return Math.max(-maxSpeedX, Math.min(maxSpeedX, value));
}

function moveTowardsZero(value, amount) {
  if (value > 0) {
    return Math.max(0, value - amount);
  }

  if (value < 0) {
    return Math.min(0, value + amount);
  }

  return 0;
}

// Steps velocity.x with explicit acceleration/deceleration/friction for easy Node verification.
export function stepRuntimePlayerVelocityX(playerState, locomotionState) {
  const warnings = [...(Array.isArray(playerState?.warnings) ? playerState.warnings : []), ...(Array.isArray(locomotionState?.warnings) ? locomotionState.warnings : [])];
  const errors = [...(Array.isArray(playerState?.errors) ? playerState.errors : []), ...(Array.isArray(locomotionState?.errors) ? locomotionState.errors : [])];

  const currentVelocityX = Number.isFinite(playerState?.velocity?.x) ? playerState.velocity.x : 0;
  const moveX = Number.isFinite(locomotionState?.moveX) ? locomotionState.moveX : 0;
  const desiredVelocityX = Number.isFinite(locomotionState?.desiredVelocityX) ? locomotionState.desiredVelocityX : 0;
  const deltaSeconds = resolveRuntimeDeltaSeconds(locomotionState?.options ?? {});
  const accelerationX = Number.isFinite(locomotionState?.accelerationX) ? Math.abs(locomotionState.accelerationX) : 1;
  const frictionX = Number.isFinite(locomotionState?.frictionX) ? Math.abs(locomotionState.frictionX) : 0;
  const accelerationStep = accelerationX * deltaSeconds;
  const frictionStep = frictionX * deltaSeconds;
  const maxSpeedX = Number.isFinite(locomotionState?.maxSpeedX) ? Math.max(0, Math.abs(locomotionState.maxSpeedX)) : 4;

  let nextVelocityX = currentVelocityX;
  let accelerating = false;
  let decelerating = false;
  let frictionApplied = false;

  if (moveX !== 0) {
    if (Math.abs(desiredVelocityX - currentVelocityX) <= accelerationStep) {
      nextVelocityX = desiredVelocityX;
    } else {
      nextVelocityX = currentVelocityX + Math.sign(desiredVelocityX - currentVelocityX) * accelerationStep;
    }

    if (Math.abs(nextVelocityX) > Math.abs(currentVelocityX)) {
      accelerating = true;
    } else if (Math.abs(nextVelocityX) < Math.abs(currentVelocityX) || Math.sign(nextVelocityX) !== Math.sign(currentVelocityX)) {
      decelerating = true;
    }
  } else if (frictionStep > 0) {
    nextVelocityX = moveTowardsZero(currentVelocityX, frictionStep);
    frictionApplied = nextVelocityX !== currentVelocityX;
    decelerating = frictionApplied;
  }

  nextVelocityX = clampVelocity(nextVelocityX, maxSpeedX);

  const status = frictionApplied
    ? "friction"
    : accelerating
      ? "accelerating"
      : decelerating
        ? "decelerating"
        : nextVelocityX === 0
          ? "idle"
          : "coasting";

  return {
    ok: errors.length === 0,
    velocityX: nextVelocityX,
    accelerating,
    decelerating,
    frictionApplied,
    status,
    errors: uniqueMessages(errors),
    warnings: uniqueMessages(warnings),
    debug: {
      moveX,
      desiredVelocityX,
      currentVelocityX,
      nextVelocityX,
      accelerationX,
      frictionX,
      deltaSeconds,
      maxSpeedX,
    },
  };
}
