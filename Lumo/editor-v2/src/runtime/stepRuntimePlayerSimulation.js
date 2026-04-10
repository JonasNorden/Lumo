import { buildRuntimePlayerIntent } from "./buildRuntimePlayerIntent.js";
import { stepRuntimePlayerHorizontalState } from "./stepRuntimePlayerHorizontalState.js";
import { stepRuntimePlayerState } from "./stepRuntimePlayerState.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Executes one runtime player simulation step: intent -> horizontal move -> existing vertical/gravity step.
export function stepRuntimePlayerSimulation(worldPacket, playerState, options = {}) {
  const intent = buildRuntimePlayerIntent(options?.input ?? options?.intent ?? options);
  const horizontalStep = stepRuntimePlayerHorizontalState(worldPacket, playerState, intent);

  if (horizontalStep.ok !== true) {
    return {
      ok: false,
      player: null,
      collisions: {
        blockedLeft: horizontalStep.blockedLeft === true,
        blockedRight: horizontalStep.blockedRight === true,
        collidedBelow: false,
      },
      status: horizontalStep.status ?? "horizontal-step-failed",
      errors: uniqueMessages(horizontalStep.errors),
      warnings: uniqueMessages([...horizontalStep.warnings, ...intent.warnings]),
      debug: {
        intent,
        horizontal: horizontalStep,
        vertical: null,
      },
    };
  }

  const verticalInputState = {
    ...playerState,
    position: horizontalStep.position,
    velocity: horizontalStep.velocity,
    errors: uniqueMessages([...(playerState?.errors ?? []), ...(horizontalStep.errors ?? []), ...(intent.errors ?? [])]),
    warnings: uniqueMessages([...(playerState?.warnings ?? []), ...(horizontalStep.warnings ?? []), ...(intent.warnings ?? [])]),
  };

  const verticalStep = stepRuntimePlayerState(worldPacket, verticalInputState);

  if (verticalStep.ok !== true) {
    return {
      ok: false,
      player: null,
      collisions: {
        blockedLeft: horizontalStep.blockedLeft === true,
        blockedRight: horizontalStep.blockedRight === true,
        collidedBelow: verticalStep?.collidedBelow === true,
      },
      status: verticalStep.status ?? "vertical-step-failed",
      errors: uniqueMessages(verticalStep.errors),
      warnings: uniqueMessages(verticalStep.warnings),
      debug: {
        intent,
        horizontal: horizontalStep,
        vertical: verticalStep,
      },
    };
  }

  return {
    ok: true,
    player: {
      position: verticalStep.position,
      velocity: verticalStep.velocity,
      grounded: verticalStep.grounded === true,
      falling: verticalStep.falling === true,
      status: verticalStep.status,
    },
    collisions: {
      blockedLeft: horizontalStep.blockedLeft === true,
      blockedRight: horizontalStep.blockedRight === true,
      collidedBelow: verticalStep.collidedBelow === true,
    },
    status: verticalStep.status,
    errors: uniqueMessages(verticalStep.errors),
    warnings: uniqueMessages(verticalStep.warnings),
    debug: {
      intent,
      horizontal: {
        status: horizontalStep.status,
        moved: horizontalStep.moved === true,
      },
      vertical: {
        status: verticalStep.status,
        grounded: verticalStep.grounded === true,
        falling: verticalStep.falling === true,
      },
    },
  };
}
