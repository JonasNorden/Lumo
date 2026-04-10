import { createRuntimeRunnerSession } from "./createRuntimeRunnerSession.js";
import { runRuntimeLevelSimulation } from "./runRuntimeLevelSimulation.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Normalizes runtime start options into a compact, deterministic shape.
function normalizeRuntimeStartOptions(options = {}) {
  const normalizedSteps = Number.isInteger(options?.steps) && options.steps >= 0 ? options.steps : 0;

  return {
    steps: normalizedSteps,
    stopOnGrounded: options?.stopOnGrounded === true,
  };
}

function buildRuntimeStartDebug({ stage, session, initialization, options, stepsRun, started }) {
  return {
    stage,
    worldId: initialization?.world?.id ?? null,
    themeId: initialization?.world?.themeId ?? null,
    started,
    stepsRequested: options.steps,
    stepsRun,
    finalPlayerStatus: typeof session?.player?.status === "string" ? session.player.status : null,
  };
}

// Starts Recharged runtime from an already loaded level document.
export function startRuntimeFromLevelDocument(levelDocument, options = {}) {
  const normalizedOptions = normalizeRuntimeStartOptions(options);

  // Validate top-level document shape before touching session/runtime helpers.
  if (!levelDocument || typeof levelDocument !== "object") {
    return {
      ok: false,
      session: null,
      initialization: null,
      simulation: null,
      errors: ["Runtime start requires a loaded level document object."],
      warnings: [],
      debug: buildRuntimeStartDebug({
        stage: "validate-level-document",
        session: null,
        initialization: null,
        options: normalizedOptions,
        stepsRun: 0,
        started: false,
      }),
    };
  }

  // For steps=0, only build a start-ready session and skip tick simulation.
  if (normalizedOptions.steps === 0) {
    const sessionResult = createRuntimeRunnerSession(levelDocument);

    return {
      ok: sessionResult?.ok === true && Boolean(sessionResult?.session),
      session: sessionResult?.session ?? null,
      initialization: sessionResult?.initialization ?? null,
      simulation: {
        stepsRun: 0,
        trace: [],
        stoppedEarly: false,
        finalPlayer: sessionResult?.session?.player ?? null,
      },
      errors: uniqueMessages(sessionResult?.errors),
      warnings: uniqueMessages(sessionResult?.warnings),
      debug: buildRuntimeStartDebug({
        stage: sessionResult?.ok === true ? "start-runtime-session-only" : "create-runtime-runner-session",
        session: sessionResult?.session,
        initialization: sessionResult?.initialization,
        options: normalizedOptions,
        stepsRun: 0,
        started: sessionResult?.ok === true,
      }),
    };
  }

  // Reuse the top-level runtime simulation chain when initial ticks are requested.
  const simulationResult = runRuntimeLevelSimulation(levelDocument, normalizedOptions);

  return {
    ok: simulationResult?.ok === true && Boolean(simulationResult?.session),
    session: simulationResult?.session ?? null,
    initialization: simulationResult?.initialization ?? null,
    simulation: simulationResult?.simulation ?? null,
    errors: uniqueMessages(simulationResult?.errors),
    warnings: uniqueMessages(simulationResult?.warnings),
    debug: buildRuntimeStartDebug({
      stage: simulationResult?.ok === true ? "start-runtime-simulated" : "runtime-level-simulation",
      session: simulationResult?.session,
      initialization: simulationResult?.initialization,
      options: normalizedOptions,
      stepsRun: Number.isFinite(simulationResult?.simulation?.stepsRun)
        ? simulationResult.simulation.stepsRun
        : 0,
      started: simulationResult?.ok === true,
    }),
  };
}
