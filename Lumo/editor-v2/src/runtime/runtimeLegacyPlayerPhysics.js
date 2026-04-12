import { RUNTIME_PLAYER_PHYSICS_BASELINE } from "./runtimePlayerPhysicsBaseline.js";

export function resolveRuntimeDeltaSeconds(options = {}) {
  const configuredDeltaSeconds = options?.physics?.deltaSeconds;
  if (Number.isFinite(configuredDeltaSeconds) && configuredDeltaSeconds > 0) {
    return configuredDeltaSeconds;
  }

  const configuredStepMs = options?.physics?.fixedStepMs;
  if (Number.isFinite(configuredStepMs) && configuredStepMs > 0) {
    return configuredStepMs / 1000;
  }

  return RUNTIME_PLAYER_PHYSICS_BASELINE.fixedStepMs / 1000;
}

export function resolveLegacyHorizontalPhysics(options = {}, grounded = false) {
  const physics = options?.physics ?? {};
  const maxSpeedX = Number.isFinite(physics.groundMaxSpeedX)
    ? Math.abs(physics.groundMaxSpeedX)
    : RUNTIME_PLAYER_PHYSICS_BASELINE.groundMaxSpeedX;
  const accelerationX = grounded
    ? (Number.isFinite(physics.groundAccelerationX) ? Math.abs(physics.groundAccelerationX) : RUNTIME_PLAYER_PHYSICS_BASELINE.groundAccelerationX)
    : (Number.isFinite(physics.airAccelerationX) ? Math.abs(physics.airAccelerationX) : RUNTIME_PLAYER_PHYSICS_BASELINE.airAccelerationX);
  const frictionX = grounded
    ? (Number.isFinite(physics.groundFrictionX) ? Math.abs(physics.groundFrictionX) : RUNTIME_PLAYER_PHYSICS_BASELINE.groundFrictionX)
    : (Number.isFinite(physics.airFrictionX) ? Math.abs(physics.airFrictionX) : RUNTIME_PLAYER_PHYSICS_BASELINE.airFrictionX);

  return { maxSpeedX, accelerationX, frictionX };
}

export function resolveLegacyJumpPhysics(options = {}) {
  const physics = options?.physics ?? {};
  return {
    jumpVelocityY: Number.isFinite(physics.jumpVelocityY) && physics.jumpVelocityY < 0
      ? physics.jumpVelocityY
      : RUNTIME_PLAYER_PHYSICS_BASELINE.jumpVelocityY,
    gravityUpY: Number.isFinite(physics.gravityUpY) && physics.gravityUpY > 0
      ? physics.gravityUpY
      : RUNTIME_PLAYER_PHYSICS_BASELINE.gravityUpY,
    gravityDownY: Number.isFinite(physics.gravityDownY) && physics.gravityDownY > 0
      ? physics.gravityDownY
      : RUNTIME_PLAYER_PHYSICS_BASELINE.gravityDownY,
    maxFallSpeedY: Number.isFinite(physics.maxFallSpeedY) && physics.maxFallSpeedY > 0
      ? physics.maxFallSpeedY
      : RUNTIME_PLAYER_PHYSICS_BASELINE.maxFallSpeedY,
    coyoteTimeSeconds: Number.isFinite(physics.coyoteTimeSeconds) && physics.coyoteTimeSeconds >= 0
      ? physics.coyoteTimeSeconds
      : RUNTIME_PLAYER_PHYSICS_BASELINE.coyoteTimeSeconds,
    jumpBufferSeconds: Number.isFinite(physics.jumpBufferSeconds) && physics.jumpBufferSeconds >= 0
      ? physics.jumpBufferSeconds
      : RUNTIME_PLAYER_PHYSICS_BASELINE.jumpBufferSeconds,
    jumpCutMultiplier: Number.isFinite(physics.jumpCutMultiplier) && physics.jumpCutMultiplier > 0 && physics.jumpCutMultiplier < 1
      ? physics.jumpCutMultiplier
      : RUNTIME_PLAYER_PHYSICS_BASELINE.jumpCutMultiplier,
  };
}
