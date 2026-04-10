import { createRuntimeRunnerSession } from "./createRuntimeRunnerSession.js";
import { runRuntimeRunnerTicks } from "./runRuntimeRunnerTicks.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

function buildSimulationSummary(tickResult) {
  return {
    stepsRun: Number.isFinite(tickResult?.stepsRun) ? tickResult.stepsRun : 0,
    trace: Array.isArray(tickResult?.trace) ? tickResult.trace : [],
    stoppedEarly: tickResult?.debug?.stoppedEarly === true,
    finalPlayer: tickResult?.session?.player ?? null,
  };
}

// Runs the first end-to-end Recharged runtime runner chain: level -> session -> ticks.
export function runRuntimeLevelSimulation(levelDocument, options = {}) {
  // Build the start-ready runtime runner session first.
  const sessionResult = createRuntimeRunnerSession(levelDocument);
  if (sessionResult?.ok !== true || !sessionResult?.session) {
    return {
      ok: false,
      session: null,
      initialization: sessionResult?.initialization ?? null,
      simulation: null,
      errors: uniqueMessages(sessionResult?.errors),
      warnings: uniqueMessages(sessionResult?.warnings),
      debug: {
        stage: "create-runtime-runner-session",
        sessionOk: false,
        ticksOk: false,
        summary: "Session creation failed; simulation skipped.",
      },
    };
  }

  // Run a small deterministic tick batch using the new runner-tick wrapper.
  const tickResult = runRuntimeRunnerTicks(sessionResult.session, options);
  if (tickResult?.ok !== true || !tickResult?.session) {
    return {
      ok: false,
      session: sessionResult.session,
      initialization: sessionResult.initialization,
      simulation: null,
      errors: uniqueMessages([...(sessionResult?.errors ?? []), ...(tickResult?.errors ?? [])]),
      warnings: uniqueMessages([...(sessionResult?.warnings ?? []), ...(tickResult?.warnings ?? [])]),
      debug: {
        stage: "run-runtime-runner-ticks",
        sessionOk: true,
        ticksOk: false,
        summary: "Session created but runtime tick simulation failed.",
        stepsRequested: options?.steps ?? 1,
        stepsRun: tickResult?.stepsRun ?? 0,
      },
    };
  }

  const simulation = buildSimulationSummary(tickResult);

  return {
    ok: true,
    session: tickResult.session,
    initialization: sessionResult.initialization,
    simulation,
    errors: uniqueMessages([...(sessionResult?.errors ?? []), ...(tickResult?.errors ?? [])]),
    warnings: uniqueMessages([...(sessionResult?.warnings ?? []), ...(tickResult?.warnings ?? [])]),
    debug: {
      stage: "runtime-level-simulation",
      sessionOk: true,
      ticksOk: true,
      summary: "Session creation and runtime tick simulation completed.",
      worldId: sessionResult?.debug?.worldId ?? null,
      themeId: sessionResult?.debug?.themeId ?? null,
      stepsRequested: options?.steps ?? 1,
      stepsRun: simulation.stepsRun,
      stoppedEarly: simulation.stoppedEarly,
      finalPlayerStatus:
        typeof simulation?.finalPlayer?.status === "string" ? simulation.finalPlayer.status : null,
    },
  };
}
