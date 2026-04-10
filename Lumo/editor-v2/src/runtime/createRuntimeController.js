import { buildNextRuntimeSessionState } from "./buildNextRuntimeSessionState.js";
import { createRuntimeStartSummary } from "./createRuntimeStartSummary.js";
import { startRuntimeFromLevelDocument } from "./startRuntimeFromLevelDocument.js";
import { startRuntimeFromLevelPath } from "./startRuntimeFromLevelPath.js";
import { updateRuntimeSession } from "./updateRuntimeSession.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Deep-clones plain runtime data so controller internals stay isolated and reset-safe.
function cloneRuntimeValue(value) {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

// Builds a compact runtime summary from the current controller state.
function buildCurrentSummary(state) {
  return createRuntimeStartSummary({
    ok: state.valid,
    session: state.currentSession,
    initialization: state.initialization,
    levelPath: state.source?.levelPath ?? null,
    levelDocument: state.source?.levelDocument ?? null,
    simulation: {
      stepsRun: state.stepsRun,
    },
    errors: state.errors,
    warnings: state.warnings,
  });
}

// Resolves controller status into a readable, deterministic runtime label.
function resolveStatus(state) {
  if (!state.valid || !state.currentSession) {
    return "invalid";
  }

  if (state.paused) {
    return "paused";
  }

  if (state.stepsRun > 0) {
    return "running";
  }

  return "ready";
}

// Creates a thin runtime instance controller around an existing runtime start result.
export function createRuntimeController(startResult, options = {}) {
  const errors = [];
  const warnings = [];

  if (!startResult || typeof startResult !== "object") {
    return {
      ok: false,
      controller: null,
      errors: ["Runtime controller requires a runtime start result object."],
      warnings: [],
    };
  }

  if (startResult.ok !== true || !startResult.session) {
    return {
      ok: false,
      controller: null,
      errors: uniqueMessages(["Runtime controller requires a successful runtime start result.", ...(startResult?.errors ?? [])]),
      warnings: uniqueMessages(startResult?.warnings),
    };
  }

  const sourceMeta = {
    type: typeof options?.source?.type === "string" ? options.source.type : "unknown",
    levelPath: typeof options?.source?.levelPath === "string" ? options.source.levelPath : null,
    levelDocument: cloneRuntimeValue(options?.source?.levelDocument),
    startOptions: cloneRuntimeValue(options?.source?.startOptions ?? {}),
  };

  const initialSession = cloneRuntimeValue(startResult.session);
  const currentSession = cloneRuntimeValue(startResult.session);
  const initialization = cloneRuntimeValue(startResult.initialization);
  const startResultSnapshot = cloneRuntimeValue(startResult);

  if (!initialSession || !currentSession || !startResultSnapshot) {
    return {
      ok: false,
      controller: null,
      errors: ["Runtime controller could not clone runtime start state."],
      warnings: [],
    };
  }

  const state = {
    valid: true,
    paused: currentSession?.runtime?.paused === true,
    currentSession,
    initialSession,
    initialization,
    startResultSnapshot,
    source: sourceMeta,
    stepsRun: Number.isFinite(startResult?.simulation?.stepsRun) ? startResult.simulation.stepsRun : 0,
    errors: uniqueMessages(startResult.errors),
    warnings: uniqueMessages(startResult.warnings),
  };

  // Returns a safe copy of the current mutable runtime session.
  function getSession() {
    return cloneRuntimeValue(state.currentSession);
  }

  // Returns the runtime initialization packet captured during startup.
  function getInitialization() {
    return cloneRuntimeValue(state.initialization);
  }

  // Returns the original start result snapshot used to build this controller.
  function getStartResult() {
    return cloneRuntimeValue(state.startResultSnapshot);
  }

  // Returns compact runtime identity + tick/player state summary.
  function getSummary() {
    return buildCurrentSummary(state);
  }

  // Returns the current lifecycle status of this runtime controller.
  function getStatus() {
    return resolveStatus(state);
  }

  // True when controller can keep ticking and is not currently paused.
  function isRunning() {
    return state.valid && !state.paused;
  }

  // True when the controller has an active paused runtime state.
  function isPaused() {
    return state.paused === true;
  }

  // Pauses runtime stepping without destroying current session state.
  function pause() {
    if (!state.valid || !state.currentSession) {
      return {
        ok: false,
        status: getStatus(),
        paused: state.paused,
        errors: ["Runtime controller cannot pause because session is invalid."],
        warnings: [],
      };
    }

    state.paused = true;
    state.currentSession.runtime = {
      ...(state.currentSession.runtime ?? {}),
      paused: true,
    };

    return {
      ok: true,
      status: getStatus(),
      paused: true,
      errors: [],
      warnings: [],
    };
  }

  // Resumes runtime stepping from the current paused session snapshot.
  function resume() {
    if (!state.valid || !state.currentSession) {
      return {
        ok: false,
        status: getStatus(),
        paused: state.paused,
        errors: ["Runtime controller cannot resume because session is invalid."],
        warnings: [],
      };
    }

    state.paused = false;
    state.currentSession.runtime = {
      ...(state.currentSession.runtime ?? {}),
      paused: false,
    };

    return {
      ok: true,
      status: getStatus(),
      paused: false,
      errors: [],
      warnings: [],
    };
  }

  // Runs one deterministic runtime step and updates the internal session state.
  function tick(stepOptions = {}) {
    if (!state.valid || !state.currentSession) {
      return {
        ok: false,
        status: getStatus(),
        summary: getSummary(),
        errors: ["Runtime controller tick requires a valid runtime session."],
        warnings: [],
      };
    }

    if (state.paused) {
      const pausedWarning = "Runtime controller tick skipped because controller is paused.";
      return {
        ok: true,
        status: getStatus(),
        summary: getSummary(),
        step: {
          stepped: false,
          status: "paused",
        },
        errors: [],
        warnings: [pausedWarning],
      };
    }

    const nextResult = buildNextRuntimeSessionState(state.currentSession, stepOptions);
    if (nextResult?.ok !== true || !nextResult?.session) {
      return {
        ok: false,
        status: getStatus(),
        summary: getSummary(),
        step: nextResult?.step ?? null,
        errors: uniqueMessages(nextResult?.errors),
        warnings: uniqueMessages(nextResult?.warnings),
      };
    }

    state.currentSession = cloneRuntimeValue(nextResult.session);
    if (!state.currentSession) {
      state.valid = false;
      state.errors = uniqueMessages([...(state.errors ?? []), "Runtime controller failed to store next session state."]);
      return {
        ok: false,
        status: getStatus(),
        summary: getSummary(),
        errors: state.errors,
        warnings: state.warnings,
      };
    }

    if (nextResult?.step?.stepped === true) {
      state.stepsRun += 1;
    }

    state.warnings = uniqueMessages([...(state.warnings ?? []), ...(nextResult?.warnings ?? [])]);

    return {
      ok: true,
      status: getStatus(),
      summary: getSummary(),
      step: nextResult.step,
      errors: uniqueMessages(nextResult?.errors),
      warnings: uniqueMessages(nextResult?.warnings),
    };
  }

  // Runs N deterministic runtime steps with optional stop-on-ground behavior.
  function update(updateOptions = {}) {
    if (!state.valid || !state.currentSession) {
      return {
        ok: false,
        status: getStatus(),
        summary: getSummary(),
        trace: [],
        errors: ["Runtime controller update requires a valid runtime session."],
        warnings: [],
      };
    }

    if (state.paused) {
      const pausedWarning = "Runtime controller update skipped because controller is paused.";
      return {
        ok: true,
        status: getStatus(),
        summary: getSummary(),
        trace: [],
        errors: [],
        warnings: [pausedWarning],
      };
    }

    const updateResult = updateRuntimeSession(state.currentSession, updateOptions);
    if (updateResult?.ok !== true || !updateResult?.session) {
      return {
        ok: false,
        status: getStatus(),
        summary: getSummary(),
        trace: Array.isArray(updateResult?.trace) ? updateResult.trace : [],
        errors: uniqueMessages(updateResult?.errors),
        warnings: uniqueMessages(updateResult?.warnings),
      };
    }

    state.currentSession = cloneRuntimeValue(updateResult.session);
    if (!state.currentSession) {
      state.valid = false;
      state.errors = uniqueMessages([...(state.errors ?? []), "Runtime controller failed to store updated session state."]);
      return {
        ok: false,
        status: getStatus(),
        summary: getSummary(),
        trace: [],
        errors: state.errors,
        warnings: state.warnings,
      };
    }

    const stepsFromTrace = Array.isArray(updateResult?.trace) ? updateResult.trace.length : 0;
    state.stepsRun += stepsFromTrace;
    state.warnings = uniqueMessages([...(state.warnings ?? []), ...(updateResult?.warnings ?? [])]);

    return {
      ok: true,
      status: getStatus(),
      summary: getSummary(),
      trace: updateResult.trace,
      errors: uniqueMessages(updateResult?.errors),
      warnings: uniqueMessages(updateResult?.warnings),
    };
  }

  // Restores runtime state back to the initial session cloned at controller creation.
  function reset() {
    const resetSession = cloneRuntimeValue(state.initialSession);
    if (!resetSession) {
      return {
        ok: false,
        status: getStatus(),
        summary: getSummary(),
        errors: ["Runtime controller reset failed because initial session snapshot is missing."],
        warnings: [],
      };
    }

    state.currentSession = resetSession;
    state.paused = resetSession?.runtime?.paused === true;
    state.stepsRun = Number.isFinite(state.startResultSnapshot?.simulation?.stepsRun)
      ? state.startResultSnapshot.simulation.stepsRun
      : 0;

    return {
      ok: true,
      status: getStatus(),
      summary: getSummary(),
      errors: [],
      warnings: [],
    };
  }

  // Restarts runtime from the original source metadata (document or path).
  async function restart() {
    if (state.source.type === "path" && state.source.levelPath) {
      const restartResult = await startRuntimeFromLevelPath(state.source.levelPath, state.source.startOptions ?? {});

      if (restartResult?.ok !== true || !restartResult?.session) {
        return {
          ok: false,
          status: getStatus(),
          summary: getSummary(),
          errors: uniqueMessages(restartResult?.errors),
          warnings: uniqueMessages(restartResult?.warnings),
        };
      }

      state.currentSession = cloneRuntimeValue(restartResult.session);
      state.initialSession = cloneRuntimeValue(restartResult.session);
      state.initialization = cloneRuntimeValue(restartResult.initialization);
      state.startResultSnapshot = cloneRuntimeValue(restartResult);
      state.source.levelDocument = cloneRuntimeValue(restartResult.levelDocument);
      state.stepsRun = Number.isFinite(restartResult?.simulation?.stepsRun) ? restartResult.simulation.stepsRun : 0;
      state.paused = state.currentSession?.runtime?.paused === true;
      state.valid = true;

      return {
        ok: true,
        status: getStatus(),
        summary: getSummary(),
        errors: [],
        warnings: uniqueMessages(restartResult?.warnings),
      };
    }

    if (state.source.type === "document" && state.source.levelDocument) {
      const restartResult = startRuntimeFromLevelDocument(state.source.levelDocument, state.source.startOptions ?? {});

      if (restartResult?.ok !== true || !restartResult?.session) {
        return {
          ok: false,
          status: getStatus(),
          summary: getSummary(),
          errors: uniqueMessages(restartResult?.errors),
          warnings: uniqueMessages(restartResult?.warnings),
        };
      }

      state.currentSession = cloneRuntimeValue(restartResult.session);
      state.initialSession = cloneRuntimeValue(restartResult.session);
      state.initialization = cloneRuntimeValue(restartResult.initialization);
      state.startResultSnapshot = cloneRuntimeValue(restartResult);
      state.stepsRun = Number.isFinite(restartResult?.simulation?.stepsRun) ? restartResult.simulation.stepsRun : 0;
      state.paused = state.currentSession?.runtime?.paused === true;
      state.valid = true;

      return {
        ok: true,
        status: getStatus(),
        summary: getSummary(),
        errors: [],
        warnings: uniqueMessages(restartResult?.warnings),
      };
    }

    return {
      ok: false,
      status: getStatus(),
      summary: getSummary(),
      errors: ["Runtime controller restart requires a document or path source metadata."],
      warnings: [],
    };
  }

  // Returns compact internals for harness/debug visibility.
  function getDebugSnapshot() {
    return {
      sourceType: state.source?.type ?? "unknown",
      status: getStatus(),
      paused: state.paused,
      worldId: state.initialization?.world?.id ?? null,
      themeId: state.initialization?.world?.themeId ?? null,
      runtimeTick: Number.isFinite(state.currentSession?.runtime?.tick) ? state.currentSession.runtime.tick : null,
      playerStatus: typeof state.currentSession?.player?.status === "string" ? state.currentSession.player.status : null,
      stepsRun: state.stepsRun,
      levelPath: state.source?.levelPath ?? null,
    };
  }

  const controller = {
    getSession,
    getInitialization,
    getStartResult,
    getSummary,
    getStatus,
    isRunning,
    isPaused,
    pause,
    resume,
    tick,
    update,
    reset,
    restart,
    getDebugSnapshot,
  };

  return {
    ok: true,
    controller,
    errors,
    warnings,
  };
}
