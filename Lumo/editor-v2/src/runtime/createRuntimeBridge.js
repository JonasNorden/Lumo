import { createRuntimeControllerFromLevelDocument } from "./createRuntimeControllerFromLevelDocument.js";
import { createRuntimeControllerFromLevelPath } from "./createRuntimeControllerFromLevelPath.js";
import { createRuntimeControllerSummary } from "./createRuntimeControllerSummary.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Builds a defensive invalid summary when no active runtime controller exists.
function createIdleSummary() {
  return {
    ok: false,
    sourceType: "unknown",
    status: "invalid",
    paused: false,
    worldId: null,
    themeId: null,
    runtimeTick: null,
    elapsedMs: null,
    playbackStatus: "stopped",
    tickRate: 4,
    autoPlay: false,
    playerStatus: null,
    locomotion: null,
    grounded: false,
    falling: false,
    rising: false,
    errors: ["Runtime bridge has no active controller."],
    warnings: [],
  };
}

// Creates a thin orchestration bridge over one active runtime controller/session.
export function createRuntimeBridge(options = {}) {
  const errors = [];
  const warnings = [];

  const state = {
    activeController: null,
    activeStartResult: null,
  };

  // Returns true when bridge currently has an active runtime controller.
  function hasActiveController() {
    return Boolean(state.activeController);
  }

  // Returns active runtime controller instance or null.
  function getActiveController() {
    return state.activeController;
  }

  // Returns active runtime session snapshot from controller or null.
  function getActiveSession() {
    if (!state.activeController || typeof state.activeController.getSession !== "function") {
      return null;
    }

    return state.activeController.getSession();
  }

  // Returns compact active controller summary or a defensive invalid summary.
  function getActiveSummary() {
    if (!state.activeController) {
      return createIdleSummary();
    }

    return createRuntimeControllerSummary(state.activeController);
  }

  // Returns active controller debug snapshot or defensive invalid snapshot.
  function getActiveDebugSnapshot() {
    if (!state.activeController || typeof state.activeController.getDebugSnapshot !== "function") {
      return {
        sourceType: "unknown",
        status: "invalid",
        paused: false,
        worldId: null,
        themeId: null,
      runtimeTick: null,
      playerStatus: null,
      locomotion: null,
      playbackStatus: "stopped",
      tickRate: 4,
      autoPlay: false,
      stepsRun: 0,
        levelPath: null,
        errors: ["Runtime bridge has no active controller."],
        warnings: [],
      };
    }

    return {
      ...state.activeController.getDebugSnapshot(),
      errors: [],
      warnings: [],
    };
  }

  // Returns start result captured when current active controller was started.
  function getActiveStartResult() {
    return state.activeStartResult;
  }

  // Resolves bridge lifecycle status independent of rendering/DOM concerns.
  function getStatus() {
    if (!state.activeController) {
      return "idle";
    }

    if (typeof state.activeController.getStatus !== "function") {
      return "invalid";
    }

    const controllerStatus = state.activeController.getStatus();
    if (controllerStatus === "paused") {
      return "paused";
    }

    if (controllerStatus === "running") {
      return "running";
    }

    if (controllerStatus === "ready") {
      return "ready";
    }

    if (controllerStatus === "stopped") {
      return "stopped";
    }

    return "invalid";
  }

  // Creates + activates a runtime controller from an in-memory level document.
  function startFromLevelDocument(levelDocument, startOptions = {}) {
    const startResult = createRuntimeControllerFromLevelDocument(levelDocument, startOptions);

    if (startResult?.ok !== true || !startResult?.controller) {
      return {
        ok: false,
        status: getStatus(),
        summary: getActiveSummary(),
        errors: uniqueMessages(startResult?.errors),
        warnings: uniqueMessages(startResult?.warnings),
      };
    }

    state.activeController = startResult.controller;
    state.activeStartResult = startResult.startResult ?? null;

    return {
      ok: true,
      status: getStatus(),
      summary: getActiveSummary(),
      errors: uniqueMessages(startResult?.errors),
      warnings: uniqueMessages(startResult?.warnings),
    };
  }

  // Creates + activates a runtime controller from a path/URL source.
  async function startFromLevelPath(levelPath, startOptions = {}) {
    const startResult = await createRuntimeControllerFromLevelPath(levelPath, startOptions);

    if (startResult?.ok !== true || !startResult?.controller) {
      return {
        ok: false,
        status: getStatus(),
        summary: getActiveSummary(),
        errors: uniqueMessages(startResult?.errors),
        warnings: uniqueMessages(startResult?.warnings),
      };
    }

    state.activeController = startResult.controller;
    state.activeStartResult = startResult.startResult ?? null;

    return {
      ok: true,
      status: getStatus(),
      summary: getActiveSummary(),
      errors: uniqueMessages(startResult?.errors),
      warnings: uniqueMessages(startResult?.warnings),
    };
  }

  // Runs a named controller operation and fails clearly if no active controller exists.
  function runWithController(methodName, args = [], missingError) {
    if (!state.activeController || typeof state.activeController?.[methodName] !== "function") {
      return {
        ok: false,
        status: getStatus(),
        summary: getActiveSummary(),
        errors: [missingError],
        warnings: [],
      };
    }

    const result = state.activeController[methodName](...args);

    if (result && typeof result.then === "function") {
      return result.then((resolvedResult) => ({
        ok: resolvedResult?.ok === true,
        status: getStatus(),
        summary: getActiveSummary(),
        ...resolvedResult,
        errors: uniqueMessages(resolvedResult?.errors),
        warnings: uniqueMessages(resolvedResult?.warnings),
      }));
    }
    return {
      ok: result?.ok === true,
      status: getStatus(),
      summary: getActiveSummary(),
      ...result,
      errors: uniqueMessages(result?.errors),
      warnings: uniqueMessages(result?.warnings),
    };
  }

  // Advances exactly one runtime step on the active controller.
  function tick(tickOptions = {}) {
    return runWithController("tick", [tickOptions], "Runtime bridge tick requires an active controller.");
  }

  // Runs deterministic multi-step update on the active controller.
  function update(updateOptions = {}) {
    return runWithController("update", [updateOptions], "Runtime bridge update requires an active controller.");
  }

  function step(stepOptions = {}) {
    return runWithController("step", [stepOptions], "Runtime bridge step requires an active controller.");
  }

  function play() {
    return runWithController("play", [], "Runtime bridge play requires an active controller.");
  }

  function stop() {
    return runWithController("stop", [], "Runtime bridge stop requires an active controller.");
  }

  // Pauses active controller runtime updates.
  function pause() {
    return runWithController("pause", [], "Runtime bridge pause requires an active controller.");
  }

  // Resumes active controller runtime updates.
  function resume() {
    return runWithController("resume", [], "Runtime bridge resume requires an active controller.");
  }

  function setTickRate(tickRate, options = {}) {
    return runWithController("setTickRate", [tickRate, options], "Runtime bridge setTickRate requires an active controller.");
  }

  function getPlaybackState() {
    return runWithController("getPlaybackState", [], "Runtime bridge getPlaybackState requires an active controller.");
  }

  function advanceFrame(frameOptions = {}) {
    return runWithController("advanceFrame", [frameOptions], "Runtime bridge advanceFrame requires an active controller.");
  }

  // Resets active controller runtime session to initial snapshot.
  function reset() {
    return runWithController("reset", [], "Runtime bridge reset requires an active controller.");
  }

  // Restarts active controller using its own configured source restart logic.
  function restart() {
    return runWithController("restart", [], "Runtime bridge restart requires an active controller.");
  }

  // Clears active controller and returns bridge to idle state.
  function clear() {
    state.activeController = null;
    state.activeStartResult = null;

    return {
      ok: true,
      status: getStatus(),
      summary: getActiveSummary(),
      errors: [],
      warnings: [],
    };
  }

  const bridge = {
    hasActiveController,
    getActiveController,
    getActiveSession,
    getActiveSummary,
    getActiveDebugSnapshot,
    getActiveStartResult,
    startFromLevelDocument,
    startFromLevelPath,
    tick,
    update,
    step,
    play,
    stop,
    pause,
    resume,
    setTickRate,
    getPlaybackState,
    advanceFrame,
    reset,
    restart,
    clear,
    getStatus,
  };

  if (options?.initialController && typeof options.initialController === "object") {
    state.activeController = options.initialController;
    if (typeof options?.initialStartResult === "object") {
      state.activeStartResult = options.initialStartResult;
    }
  }

  return {
    ok: true,
    bridge,
    errors,
    warnings,
  };
}
