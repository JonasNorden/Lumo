// First playable Recharged baseline values for readable browser control.
export const RUNTIME_PLAYER_PHYSICS_BASELINE = {
  // Horizontal movement is intentionally slow for first-pass playable steering.
  groundMaxSpeedX: 1.2,
  groundAccelerationX: 0.2,
  groundFrictionX: 0.25,
  airMaxSpeedX: 1.0,
  airAccelerationX: 0.16,
  airFrictionX: 0.05,
  // Jump/fall values are tuned for visible arc readability in Lumo.html.
  jumpVelocityY: -3.6,
  gravityY: 0.24,
  maxFallSpeedY: 2.4,
};
