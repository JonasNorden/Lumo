import { buildNextRuntimeSessionState } from "./buildNextRuntimeSessionState.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

function getTraceEntry(session, status) {
  return {
    tick: Number.isFinite(session?.runtime?.tick) ? session.runtime.tick : null,
    x: Number.isFinite(session?.player?.position?.x) ? session.player.position.x : null,
    y: Number.isFinite(session?.player?.position?.y) ? session.player.position.y : null,
    velocityY: Number.isFinite(session?.player?.velocity?.y) ? session.player.velocity.y : null,
    grounded: session?.player?.grounded === true,
    falling: session?.player?.falling === true,
    status,
  };
}

function normalizeStepCount(steps) {
  if (steps === undefined) {
    return 1;
  }

  if (!Number.isInteger(steps) || steps < 1) {
    return null;
  }

  return steps;
}

// Updates runtime session state by running one or many deterministic runtime ticks.
export function updateRuntimeSession(sessionState, options = {}) {
  const steps = normalizeStepCount(options?.steps);
  const stopOnGrounded = options?.stopOnGrounded === true;

  if (steps === null) {
    return {
      ok: false,
      session: null,
      trace: [],
      errors: ["Runtime session update requires options.steps to be an integer >= 1."],
      warnings: [],
    };
  }

  const trace = [];
  const errors = [];
  const warnings = [];
  let currentSessionState = sessionState;

  for (let index = 0; index < steps; index += 1) {
    const stepResult = buildNextRuntimeSessionState(currentSessionState);

    errors.push(...(stepResult.errors ?? []));
    warnings.push(...(stepResult.warnings ?? []));

    if (stepResult.ok !== true || !stepResult.session) {
      return {
        ok: false,
        session: null,
        trace,
        errors: uniqueMessages(errors.length > 0 ? errors : ["Runtime session update failed."]),
        warnings: uniqueMessages(warnings),
      };
    }

    currentSessionState = stepResult.session;
    const traceStatus = stepResult.step?.status ?? (stepResult.step?.stepped ? "updated" : "skipped");
    trace.push(getTraceEntry(stepResult.session, traceStatus));

    if (stepResult.step?.stepped !== true) {
      break;
    }

    if (stopOnGrounded && stepResult.session?.player?.grounded === true) {
      break;
    }
  }

  return {
    ok: true,
    session: currentSessionState,
    trace,
    errors: uniqueMessages(errors),
    warnings: uniqueMessages(warnings),
  };
}
