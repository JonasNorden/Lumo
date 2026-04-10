import { buildRuntimePlayerIntent } from "./buildRuntimePlayerIntent.js";
import { buildRuntimePlayerLocomotionState } from "./buildRuntimePlayerLocomotionState.js";
import { stepRuntimePlayerVelocityX } from "./stepRuntimePlayerVelocityX.js";
import { stepRuntimePlayerHorizontalState } from "./stepRuntimePlayerHorizontalState.js";
import { buildRuntimePlayerJumpState } from "./buildRuntimePlayerJumpState.js";
import { stepRuntimePlayerVerticalState } from "./stepRuntimePlayerVerticalState.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Executes one deterministic tick: intent -> locomotion -> velocityX -> horizontal -> jump -> vertical.
export function stepRuntimePlayerSimulation(worldPacket, playerState, options = {}) {
  const intent = buildRuntimePlayerIntent(options?.input ?? options?.intent ?? options);
  const locomotionState = buildRuntimePlayerLocomotionState(playerState, intent, options);
  const velocityXStep = stepRuntimePlayerVelocityX(playerState, locomotionState);

  const horizontalStep = stepRuntimePlayerHorizontalState(worldPacket, playerState, {
    velocityX: velocityXStep.velocityX,
    errors: uniqueMessages([...(locomotionState.errors ?? []), ...(velocityXStep.errors ?? [])]),
    warnings: uniqueMessages([...(locomotionState.warnings ?? []), ...(velocityXStep.warnings ?? [])]),
  });

  if (horizontalStep.ok !== true) {
    return {
      ok: false,
      player: null,
      collisions: {
        moveX: intent.moveX,
        jump: intent.jump === true,
        locomotion: locomotionState.locomotion,
        velocityX: velocityXStep.velocityX,
        blockedLeft: horizontalStep.blockedLeft === true,
        blockedRight: horizontalStep.blockedRight === true,
        grounded: false,
        falling: false,
        rising: false,
        landed: false,
        collidedBelow: false,
      },
      status: horizontalStep.status ?? "horizontal-step-failed",
      errors: uniqueMessages(horizontalStep.errors),
      warnings: uniqueMessages([...horizontalStep.warnings, ...intent.warnings]),
      debug: {
        intent,
        locomotion: locomotionState,
        velocityX: velocityXStep,
        horizontal: horizontalStep,
        jump: null,
        vertical: null,
      },
    };
  }

  const preVerticalState = {
    ...playerState,
    position: horizontalStep.position,
    velocity: horizontalStep.velocity,
    errors: uniqueMessages([
      ...(playerState?.errors ?? []),
      ...(horizontalStep.errors ?? []),
      ...(locomotionState.errors ?? []),
      ...(velocityXStep.errors ?? []),
      ...(intent.errors ?? []),
    ]),
    warnings: uniqueMessages([
      ...(playerState?.warnings ?? []),
      ...(horizontalStep.warnings ?? []),
      ...(locomotionState.warnings ?? []),
      ...(velocityXStep.warnings ?? []),
      ...(intent.warnings ?? []),
    ]),
  };

  const jumpState = buildRuntimePlayerJumpState(worldPacket, preVerticalState, intent, options);
  const verticalInputState = {
    ...preVerticalState,
    grounded: jumpState.grounded === true,
    velocity: jumpState.velocity,
    errors: uniqueMessages([...(preVerticalState?.errors ?? []), ...(jumpState.errors ?? [])]),
    warnings: uniqueMessages([...(preVerticalState?.warnings ?? []), ...(jumpState.warnings ?? [])]),
  };

  const verticalStep = stepRuntimePlayerVerticalState(worldPacket, verticalInputState, options);

  if (verticalStep.ok !== true) {
    return {
      ok: false,
      player: null,
      collisions: {
        moveX: intent.moveX,
        jump: intent.jump === true,
        locomotion: locomotionState.locomotion,
        velocityX: horizontalStep.velocity?.x ?? velocityXStep.velocityX,
        blockedLeft: horizontalStep.blockedLeft === true,
        blockedRight: horizontalStep.blockedRight === true,
        grounded: false,
        falling: false,
        rising: false,
        landed: false,
        collidedBelow: verticalStep?.collidedBelow === true,
      },
      status: verticalStep.status ?? "vertical-step-failed",
      errors: uniqueMessages(verticalStep.errors),
      warnings: uniqueMessages(verticalStep.warnings),
      debug: {
        intent,
        locomotion: locomotionState,
        velocityX: velocityXStep,
        horizontal: horizontalStep,
        jump: jumpState,
        vertical: verticalStep,
      },
    };
  }

  const status = verticalStep.status;

  return {
    ok: true,
    player: {
      position: verticalStep.position,
      velocity: verticalStep.velocity,
      locomotion: locomotionState.locomotion,
      grounded: verticalStep.grounded === true,
      falling: verticalStep.falling === true,
      rising: verticalStep.rising === true,
      landed: verticalStep.landed === true,
      status,
    },
    collisions: {
      moveX: intent.moveX,
      jump: intent.jump === true,
      locomotion: locomotionState.locomotion,
      velocityX: verticalStep.velocity?.x ?? 0,
      blockedLeft: horizontalStep.blockedLeft === true,
      blockedRight: horizontalStep.blockedRight === true,
      grounded: verticalStep.grounded === true,
      falling: verticalStep.falling === true,
      rising: verticalStep.rising === true,
      landed: verticalStep.landed === true,
      collidedBelow: verticalStep.collidedBelow === true,
    },
    status,
    errors: uniqueMessages(verticalStep.errors),
    warnings: uniqueMessages(verticalStep.warnings),
    debug: {
      intent,
      locomotion: locomotionState,
      velocityX: velocityXStep,
      horizontal: {
        status: horizontalStep.status,
        moved: horizontalStep.moved === true,
        blockedLeft: horizontalStep.blockedLeft === true,
        blockedRight: horizontalStep.blockedRight === true,
      },
      jump: {
        status: jumpState.status,
        canJump: jumpState.canJump === true,
        startedJump: jumpState.startedJump === true,
      },
      vertical: {
        status: verticalStep.status,
        grounded: verticalStep.grounded === true,
        falling: verticalStep.falling === true,
        rising: verticalStep.rising === true,
        landed: verticalStep.landed === true,
        collidedBelow: verticalStep.collidedBelow === true,
      },
    },
  };
}
