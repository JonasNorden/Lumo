import { buildRuntimePlayerStartState } from "./buildRuntimePlayerStartState.js";
import { simulateRuntimePlayerFall } from "./simulateRuntimePlayerFall.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

function resolveStartupMode(startState, landed) {
  if (startState?.grounded === true) {
    return "spawn-grounded";
  }

  if (startState?.falling === true && landed === true) {
    return "spawn-falling-to-ground";
  }

  if (startState?.falling === true && landed === false) {
    return "spawn-falling-without-landing";
  }

  return "spawn-static";
}

function resolveBooleanWithFallback(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback === true;
}

// Builds one compact runtime bootstrap result for start-state + immediate startup outcome.
export function buildRuntimePlayerBootstrap(worldPacket) {
  const startState = buildRuntimePlayerStartState(worldPacket);
  const startWarnings = uniqueMessages(startState?.warnings);
  const startErrors = uniqueMessages(startState?.errors);

  if (startState?.ok !== true) {
    const reason = startErrors[0] ?? "Runtime player start state is invalid.";

    return {
      ok: false,
      startState,
      startupOutcome: null,
      errors: uniqueMessages([reason, ...startErrors]),
      warnings: startWarnings,
    };
  }

  const simulation = simulateRuntimePlayerFall(worldPacket, startState);
  const simulationWarnings = uniqueMessages(simulation?.warnings);
  const simulationErrors = uniqueMessages(simulation?.errors);
  const finalState = simulation?.finalState;
  const landed = simulation?.landed === true;

  const startupOutcome = {
    mode: resolveStartupMode(startState, landed),
    landed,
    steps: Number.isFinite(simulation?.steps) ? simulation.steps : 0,
    finalPosition: {
      x: Number.isFinite(finalState?.position?.x) ? finalState.position.x : startState.position.x,
      y: Number.isFinite(finalState?.position?.y) ? finalState.position.y : startState.position.y,
    },
    finalVelocity: {
      x: Number.isFinite(finalState?.velocity?.x) ? finalState.velocity.x : startState.velocity.x,
      y: Number.isFinite(finalState?.velocity?.y) ? finalState.velocity.y : startState.velocity.y,
    },
    grounded: resolveBooleanWithFallback(finalState?.grounded, startState.grounded),
    falling: resolveBooleanWithFallback(finalState?.falling, startState.falling),
    status: typeof finalState?.status === "string" ? finalState.status : startState.status,
  };

  return {
    ok: simulation?.ok === true,
    startState,
    startupOutcome,
    errors: uniqueMessages([...startErrors, ...simulationErrors]),
    warnings: uniqueMessages([...startWarnings, ...simulationWarnings]),
  };
}
