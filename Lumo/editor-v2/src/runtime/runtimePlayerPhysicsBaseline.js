// Original Lumo movement profile migrated for Recharged deterministic runtime ticks.
export const RUNTIME_PLAYER_PHYSICS_BASELINE = {
  // Runtime fixed-step size (buildNextRuntimeSessionState uses 16ms/tick).
  fixedStepMs: 16,
  // Horizontal movement (from legacy src/game/player.js).
  groundMaxSpeedX: 230,
  groundAccelerationX: 2200,
  groundFrictionX: 2200,
  airMaxSpeedX: 230,
  airAccelerationX: 1400,
  airFrictionX: 250,
  // Jump/fall.
  jumpVelocityY: -720,
  gravityUpY: 1450,
  gravityDownY: 2100,
  maxFallSpeedY: 980,
  // Jump buffering and coyote from legacy movement behavior.
  coyoteTimeSeconds: 0.11,
  jumpBufferSeconds: 0.1,
  jumpCutMultiplier: 0.55,
};
