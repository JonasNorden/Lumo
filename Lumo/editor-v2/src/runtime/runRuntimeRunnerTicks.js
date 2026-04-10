import { updateRuntimeSession } from "./updateRuntimeSession.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

function getSessionValue(sessionState) {
  if (sessionState && typeof sessionState === "object" && sessionState.session) {
    return sessionState.session;
  }

  return sessionState;
}

function buildRunnerTickDebug(startSession, endSession, stepsRequested, stepsRun, stoppedEarly) {
  return {
    startTick: Number.isFinite(startSession?.runtime?.tick) ? startSession.runtime.tick : null,
    endTick: Number.isFinite(endSession?.runtime?.tick) ? endSession.runtime.tick : null,
    stepsRequested,
    stepsRun,
    stoppedEarly,
    finalPlayerStatus: typeof endSession?.player?.status === "string" ? endSession.player.status : null,
  };
}

function toCompactTrace(traceEntries) {
  if (!Array.isArray(traceEntries)) {
    return [];
  }

  return traceEntries.map((entry) => ({
    tick: Number.isFinite(entry?.tick) ? entry.tick : null,
    y: Number.isFinite(entry?.y) ? entry.y : null,
    velocityY: Number.isFinite(entry?.velocityY) ? entry.velocityY : null,
    grounded: entry?.grounded === true,
    falling: entry?.falling === true,
    status: typeof entry?.status === "string" ? entry.status : null,
  }));
}

// Runs a compact number of deterministic runtime ticks from an existing runtime session.
export function runRuntimeRunnerTicks(sessionState, options = {}) {
  const session = getSessionValue(sessionState);
  const stepsRequested = options?.steps ?? 1;
  const stopOnGrounded = options?.stopOnGrounded === true;

  // Validate minimum session shape before ticking so failures stay explicit.
  if (!session || typeof session !== "object") {
    const errors = ["Runtime runner ticks require a valid session state object."];
    return {
      ok: false,
      session: null,
      stepsRun: 0,
      trace: [],
      errors,
      warnings: [],
      debug: buildRunnerTickDebug(null, null, stepsRequested, 0, false),
    };
  }

  // Reuse the existing runtime updater for all tick stepping behavior.
  const update = updateRuntimeSession(session, { steps: stepsRequested, stopOnGrounded });
  const trace = toCompactTrace(update?.trace);
  const stepsRun = trace.length;
  const stoppedEarly = Number.isInteger(stepsRequested) && stepsRun < stepsRequested;

  if (update?.ok !== true || !update?.session) {
    return {
      ok: false,
      session: null,
      stepsRun,
      trace,
      errors: uniqueMessages(update?.errors),
      warnings: uniqueMessages(update?.warnings),
      debug: buildRunnerTickDebug(session, null, stepsRequested, stepsRun, stoppedEarly),
    };
  }

  return {
    ok: true,
    session: update.session,
    stepsRun,
    trace,
    errors: uniqueMessages(update?.errors),
    warnings: uniqueMessages(update?.warnings),
    debug: buildRunnerTickDebug(session, update.session, stepsRequested, stepsRun, stoppedEarly),
  };
}
