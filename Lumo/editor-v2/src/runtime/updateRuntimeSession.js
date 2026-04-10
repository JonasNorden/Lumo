import { buildNextRuntimeSessionState } from "./buildNextRuntimeSessionState.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Builds one trace row with compact, machine-readable runtime player state.
function getTraceEntry(session, status, step) {
  return {
    tick: Number.isFinite(session?.runtime?.tick) ? session.runtime.tick : null,
    x: Number.isFinite(session?.player?.position?.x) ? session.player.position.x : null,
    y: Number.isFinite(session?.player?.position?.y) ? session.player.position.y : null,
    velocityX: Number.isFinite(session?.player?.velocity?.x) ? session.player.velocity.x : null,
    velocityY: Number.isFinite(session?.player?.velocity?.y) ? session.player.velocity.y : null,
    locomotion: typeof session?.player?.locomotion === "string" ? session.player.locomotion : null,
    grounded: session?.player?.grounded === true,
    falling: session?.player?.falling === true,
    rising: session?.player?.rising === true,
    landed: session?.player?.landed === true,
    moveX: Number.isFinite(step?.moveX) ? step.moveX : 0,
    accelerating: step?.accelerating === true,
    decelerating: step?.decelerating === true,
    frictionApplied: step?.frictionApplied === true,
    jump: step?.jump === true,
    blockedLeft: step?.blockedLeft === true,
    blockedRight: step?.blockedRight === true,
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

// Resolves step input: sequence > callback > static input/options.
function resolveStepInput(options, stepIndex, session) {
  const sequence = options?.inputSequence;
  if (Array.isArray(sequence)) {
    return sequence[stepIndex] ?? null;
  }

  if (typeof options?.inputForStep === "function") {
    try {
      return options.inputForStep({ index: stepIndex, session });
    } catch {
      return null;
    }
  }

  if (options?.input !== undefined) {
    return options.input;
  }

  if (options?.intent !== undefined) {
    return options.intent;
  }

  if (options?.moveX !== undefined || options?.jump !== undefined || options?.run !== undefined) {
    return {
      moveX: options?.moveX,
      jump: options?.jump,
      run: options?.run,
    };
  }

  return null;
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
    const stepInput = resolveStepInput(options, index, currentSessionState);
    const stepResult = buildNextRuntimeSessionState(currentSessionState, { input: stepInput });

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
    trace.push(getTraceEntry(stepResult.session, traceStatus, stepResult.step));

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
