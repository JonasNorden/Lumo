import { stepRuntimePlayerState } from "./stepRuntimePlayerState.js";

const MAX_FALL_STEPS = 32;

function isUsableInitialPlayerState(playerState) {
  const hasPositionX = Number.isFinite(playerState?.position?.x);
  const hasPositionY = Number.isFinite(playerState?.position?.y);

  return playerState?.ok === true && hasPositionX && hasPositionY;
}

// Simulates repeated runtime player fall steps until landing or a safe step cap.
export function simulateRuntimePlayerFall(worldPacket, initialPlayerState) {
  if (!isUsableInitialPlayerState(initialPlayerState)) {
    return {
      ok: false,
      steps: 0,
      landed: false,
      finalState: null,
      trace: [],
      errors: ["Initial player state is invalid for fall simulation."],
      warnings: [],
    };
  }

  const trace = [];
  let currentState = initialPlayerState;
  let finalState = null;

  for (let stepIndex = 1; stepIndex <= MAX_FALL_STEPS; stepIndex += 1) {
    const steppedState = stepRuntimePlayerState(worldPacket, currentState);
    finalState = steppedState;

    trace.push({
      step: stepIndex,
      y: steppedState?.position?.y ?? null,
      velocityY: Number.isFinite(steppedState?.velocity?.y) ? steppedState.velocity.y : 0,
      grounded: steppedState?.grounded === true,
      falling: steppedState?.falling === true,
      status: typeof steppedState?.status === "string" ? steppedState.status : "unknown",
    });

    const stoppedByGround = steppedState?.grounded === true;
    const stoppedByNonFalling =
      steppedState?.falling === false && steppedState?.status !== "falling";

    if (stoppedByGround || stoppedByNonFalling || steppedState?.ok !== true) {
      break;
    }

    currentState = steppedState;
  }

  const landed = finalState?.grounded === true;
  const finalWarnings = Array.isArray(finalState?.warnings) ? [...finalState.warnings] : [];
  const finalErrors = Array.isArray(finalState?.errors) ? [...finalState.errors] : [];

  return {
    ok: finalState?.ok === true,
    steps: trace.length,
    landed,
    finalState,
    trace,
    errors: finalErrors,
    warnings: finalWarnings,
  };
}
