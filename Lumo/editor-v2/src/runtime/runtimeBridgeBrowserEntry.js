import { bootRuntimeBridge } from "./bootRuntimeBridge.js";
import { renderRuntimeBridgeStatus } from "./renderRuntimeBridgeStatus.js";
import { updateRuntimeBridgeView } from "./updateRuntimeBridgeView.js";
import { normalizeRuntimeSummaryShape } from "./normalizeRuntimeSummaryShape.js";
import { createRuntimeBrowserInputState } from "./createRuntimeBrowserInputState.js";
import { runRuntimeBrowserLoopStep } from "./runRuntimeBrowserLoopStep.js";

const DEFAULT_LEVEL_PATH = "./src/data/testLevelDocument.v1.json";
const DEFAULT_UPDATE_STEPS = 3;
const DEFAULT_TICK_RATE = 4;

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Parses query params into explicit runtime bridge page options.
function parseQuery(search = "") {
  const params = new URLSearchParams(search);
  return {
    levelPath: params.get("level") || DEFAULT_LEVEL_PATH,
    autoStart: params.get("autostart") === "1",
    steps: parsePositiveInteger(params.get("steps"), DEFAULT_UPDATE_STEPS),
    stopOnGrounded: params.get("stopOnGrounded") === "1",
  };
}

function getDomRefs(root = document) {
  return {
    title: root.querySelector("#runtimeBridgeTitle"),
    statusLine: root.querySelector("#runtimeBridgeStatusLine"),
    summary: root.querySelector("#runtimeBridgeSummary"),
    levelPathInput: root.querySelector("#runtimeBridgeLevelPath"),
    actionResult: root.querySelector("#runtimeBridgeActionResult"),
    playbackLine: root.querySelector("#runtimeBridgePlaybackLine"),
    inputLine: root.querySelector("#runtimeBridgeInputLine"),
    viewStatus: root.querySelector("#runtimeBridgeViewStatus"),
    viewCanvas: root.querySelector("#runtimeBridgeViewCanvas"),
    viewLegend: root.querySelector("#runtimeBridgeViewLegend"),
    startButton: root.querySelector("#runtimeBridgeStartButton"),
    tickButton: root.querySelector("#runtimeBridgeTickButton"),
    updateButton: root.querySelector("#runtimeBridgeUpdateButton"),
    playButton: root.querySelector("#runtimeBridgePlayButton"),
    stopButton: root.querySelector("#runtimeBridgeStopButton"),
    stepButton: root.querySelector("#runtimeBridgeStepButton"),
    tickRateInput: root.querySelector("#runtimeBridgeTickRate"),
    updateStepsInput: root.querySelector("#runtimeBridgeUpdateSteps"),
    stopOnGroundedInput: root.querySelector("#runtimeBridgeStopOnGrounded"),
    pauseButton: root.querySelector("#runtimeBridgePauseButton"),
    resumeButton: root.querySelector("#runtimeBridgeResumeButton"),
    resetButton: root.querySelector("#runtimeBridgeResetButton"),
    restartButton: root.querySelector("#runtimeBridgeRestartButton"),
    clearButton: root.querySelector("#runtimeBridgeClearButton"),
    refreshSummaryButton: root.querySelector("#runtimeBridgeRefreshSummaryButton"),
  };
}

function setElementText(element, text) {
  if (element) {
    element.textContent = typeof text === "string" ? text : "";
  }
}

// Starts the first official browser debug/start surface for the Recharged runtime bridge.
export async function startRuntimeBridgeBrowserEntry(options = {}) {
  const query = parseQuery(options?.search ?? globalThis?.location?.search ?? "");
  const refs = getDomRefs(options?.root ?? document);

  const state = {
    query,
    levelPath: query.levelPath,
    bootResult: null,
    bridge: null,
    debugApi: null,
    lastAction: null,
    browserLoop: {
      frameHandle: null,
      running: false,
      active: false,
    },
    browserInput: createRuntimeBrowserInputState(),
    actionOptions: {
      steps: query.steps,
      stopOnGrounded: query.stopOnGrounded,
    },
  };

  if (refs.levelPathInput) {
    refs.levelPathInput.value = query.levelPath;
  }
  if (refs.updateStepsInput) {
    refs.updateStepsInput.value = String(state.actionOptions.steps);
  }
  if (refs.stopOnGroundedInput) {
    refs.stopOnGroundedInput.checked = state.actionOptions.stopOnGrounded === true;
  }

  function readTickRateInput() {
    return parsePositiveInteger(refs.tickRateInput?.value, DEFAULT_TICK_RATE);
  }

  function readUpdateStepsInput() {
    return parsePositiveInteger(refs.updateStepsInput?.value, state.actionOptions.steps);
  }

  function readStopOnGroundedInput() {
    return refs.stopOnGroundedInput?.checked === true;
  }

  function syncActionOptionsFromInputs() {
    state.actionOptions.steps = readUpdateStepsInput();
    state.actionOptions.stopOnGrounded = readStopOnGroundedInput();
    if (refs.updateStepsInput) {
      refs.updateStepsInput.value = String(state.actionOptions.steps);
    }
  }

  function buildActionRecord(actionName, result = {}) {
    const statusModel = renderRuntimeBridgeStatus(state);
    const fallbackSummary = statusModel?.summary ?? {};
    const normalizedSummary = normalizeRuntimeSummaryShape(result?.summary ?? fallbackSummary, {
      bridgeStatus: fallbackSummary?.bridgeStatus ?? state.bridge?.getStatus?.() ?? "invalid",
      controllerStatus: result?.status ?? fallbackSummary?.controllerStatus ?? "invalid",
      hasActiveController: fallbackSummary?.hasActiveController === true,
    });

    return {
      action: actionName,
      ok: result?.ok === true,
      status: result?.status ?? null,
      summary: normalizedSummary,
      playback: result?.playback ?? null,
      errors: result?.errors ?? [],
      warnings: result?.warnings ?? [],
    };
  }

  // Renders compact debug state to plain text fields so failures are always visible.
  function refreshView() {
    const model = renderRuntimeBridgeStatus(state);
    setElementText(refs.title, model.title);
    setElementText(refs.statusLine, model.statusLine);
    setElementText(refs.summary, JSON.stringify(model, null, 2));

    if (refs.actionResult) {
      const actionText = model.lastAction
        ? JSON.stringify(model.lastAction, null, 2)
        : "No actions yet.";
      setElementText(refs.actionResult, actionText);
    }
    if (refs.playbackLine) {
      setElementText(
        refs.playbackLine,
        `Playback: ${model?.summary?.playbackStatus ?? "stopped"} | tickRate=${model?.summary?.tickRate ?? "-"} | autoPlay=${model?.summary?.autoPlay === true ? "on" : "off"} | loop=${model?.summary?.loopActive === true ? "on" : "off"} | tick=${model?.summary?.runtimeTick ?? "-"}`,
      );
    }
    if (refs.inputLine) {
      setElementText(
        refs.inputLine,
        `Input: moveX=${model?.summary?.inputState?.moveX ?? 0} jump=${model?.summary?.inputState?.jump === true ? "on" : "off"} run=${model?.summary?.inputState?.run === true ? "on" : "off"} | playerControl=${model?.summary?.playerControlActive === true ? "active" : "idle"}`,
      );
    }

    // Keeps runtime canvas view in sync with active bridge/controller/session state.
    const viewResult = updateRuntimeBridgeView({
      bridge: state.bridge,
      debugApi: state.debugApi,
      browserLoop: state.browserLoop,
      browserInputSnapshot: state.browserInput.getSnapshot(),
      canvas: refs.viewCanvas,
    });

    if (refs.viewStatus) {
      const message = viewResult.ok
        ? `Runtime view ${viewResult.state} | tick=${viewResult?.viewModel?.overlay?.runtimeTick ?? "-"} | control=${model?.summary?.playerControlActive === true ? "player control active" : "no active runtime"}`
        : `Runtime view issues | ${viewResult.errors.join(" | ")}`;
      setElementText(refs.viewStatus, message);
    }

    if (refs.viewLegend) {
      const counts = viewResult?.viewModel?.overlay?.counts ?? {};
      const legend = `bg=${counts.background ?? 0} tiles=${counts.tiles ?? 0} decor=${counts.decor ?? 0} entities=${counts.entities ?? 0} audio=${counts.audio ?? 0} spawn=yellow player=green`;
      setElementText(refs.viewLegend, legend);
    }

    return model;
  }

  // Runs a bridge action safely and stores result/errors for easy browser verification.
  async function runAction(actionName, actionFn) {
    const result = await actionFn();
    state.lastAction = buildActionRecord(actionName, result);

    refreshView();
    return state.lastAction;
  }

  // Boots bridge + global debug API before wiring any user actions.
  state.bootResult = await bootRuntimeBridge({
    autoStart: false,
    attachDebugApi: true,
    overwriteGlobalDebugApi: true,
    globalKey: "LumoRuntimeDebug",
  });
  state.bridge = state.bootResult?.bridge ?? null;
  state.debugApi = state.bootResult?.debugApi ?? null;

  refreshView();

  function stopBrowserLoop() {
    if (state.browserLoop.frameHandle !== null) {
      globalThis.cancelAnimationFrame?.(state.browserLoop.frameHandle);
      state.browserLoop.frameHandle = null;
    }
    state.browserLoop.running = false;
    state.browserLoop.active = false;
  }

  async function runBrowserPlaybackFrame(now) {
    const loopStep = await runRuntimeBrowserLoopStep({
      debugApi: state.debugApi,
      now,
      inputState: state.browserInput,
    });

    if (loopStep?.ok !== true || !loopStep?.result) {
      state.lastAction = buildActionRecord("advanceFrame", {
        ok: false,
        status: "invalid",
        errors: loopStep?.errors ?? ["Runtime browser loop frame failed."],
        warnings: loopStep?.warnings ?? [],
      });
      refreshView();
      stopBrowserLoop();
      return;
    }

    if (loopStep?.result?.stepped === true) {
      state.lastAction = buildActionRecord("playback-step", loopStep.result);
      refreshView();
    } else {
      refreshView();
    }

    if (loopStep.loopShouldContinue) {
      state.browserLoop.frameHandle = globalThis.requestAnimationFrame(runBrowserPlaybackFrame);
      state.browserLoop.running = true;
      state.browserLoop.active = true;
      return;
    }

    stopBrowserLoop();
  }

  function startBrowserLoop() {
    if (state.browserLoop.running) {
      return;
    }
    state.browserLoop.running = true;
    state.browserLoop.active = true;
    state.browserLoop.frameHandle = globalThis.requestAnimationFrame(runBrowserPlaybackFrame);
  }

  async function activatePlayerControl() {
    const playResult = await runAction("play", () => state.debugApi.play());
    if (playResult?.ok === true) {
      startBrowserLoop();
    }
    return playResult;
  }

  if (state.debugApi && typeof state.debugApi === "object") {
    globalThis.LumoRuntimeBridgePage = {
      query,
      getState() {
        return state;
      },
      refresh: refreshView,
      actions: {
        setOptions: (nextOptions = {}) => {
          if (Number.isFinite(nextOptions?.steps) && nextOptions.steps > 0) {
            state.actionOptions.steps = Math.floor(nextOptions.steps);
          }
          if (typeof nextOptions?.stopOnGrounded === "boolean") {
            state.actionOptions.stopOnGrounded = nextOptions.stopOnGrounded;
          }
          if (refs.updateStepsInput) {
            refs.updateStepsInput.value = String(state.actionOptions.steps);
          }
          if (refs.stopOnGroundedInput) {
            refs.stopOnGroundedInput.checked = state.actionOptions.stopOnGrounded === true;
          }
          return refreshView();
        },
        start: () => runAction("start", () => state.debugApi.startFromLevelPath(state.levelPath, { stopOnGrounded: state.actionOptions.stopOnGrounded })),
        tick: () => runAction("tick", () => state.debugApi.tick()),
        update: () => runAction("update", () => state.debugApi.update({ steps: state.actionOptions.steps, stopOnGrounded: state.actionOptions.stopOnGrounded })),
        play: async () => {
          return activatePlayerControl();
        },
        stop: async () => {
          const stopResult = await runAction("stop", () => state.debugApi.stop());
          stopBrowserLoop();
          return stopResult;
        },
        step: () => runAction("step", () => state.debugApi.step({ steps: 1 })),
        setTickRate: (tickRate) => runAction("setTickRate", () => state.debugApi.setTickRate(tickRate)),
        pause: () => runAction("pause", () => state.debugApi.pause()),
        resume: () => runAction("resume", () => state.debugApi.resume()),
        reset: () => runAction("reset", () => state.debugApi.reset()),
        restart: () => runAction("restart", () => state.debugApi.restart()),
        clear: () => runAction("clear", () => state.debugApi.clear()),
      },
    };
  }

  const updateLevelPathFromInput = () => {
    const candidatePath = refs.levelPathInput?.value?.trim();
    state.levelPath = candidatePath || DEFAULT_LEVEL_PATH;
  };

  refs.updateStepsInput?.addEventListener("change", () => syncActionOptionsFromInputs());
  refs.stopOnGroundedInput?.addEventListener("change", () => syncActionOptionsFromInputs());

  refs.startButton?.addEventListener("click", async () => {
    updateLevelPathFromInput();
    syncActionOptionsFromInputs();
    const startResult = await runAction("start", () => state.debugApi.startFromLevelPath(state.levelPath, { stopOnGrounded: state.actionOptions.stopOnGrounded }));
    if (startResult?.ok === true) {
      await activatePlayerControl();
    }
  });
  refs.tickButton?.addEventListener("click", async () => runAction("tick", () => state.debugApi.tick()));
  refs.updateButton?.addEventListener("click", async () => {
    syncActionOptionsFromInputs();
    await runAction("update", () => state.debugApi.update({ steps: state.actionOptions.steps, stopOnGrounded: state.actionOptions.stopOnGrounded }));
  });
  refs.playButton?.addEventListener("click", async () => {
    const tickRate = readTickRateInput();
    await runAction("setTickRate", () => state.debugApi.setTickRate(tickRate));
    await activatePlayerControl();
  });
  refs.stopButton?.addEventListener("click", async () => {
    await runAction("stop", () => state.debugApi.stop());
    stopBrowserLoop();
    state.browserInput.clear();
  });
  refs.stepButton?.addEventListener("click", async () => runAction("step", () => state.debugApi.step({ steps: 1 })));
  refs.tickRateInput?.addEventListener("change", async () => {
    const tickRate = readTickRateInput();
    refs.tickRateInput.value = String(tickRate);
    await runAction("setTickRate", () => state.debugApi.setTickRate(tickRate));
  });
  refs.pauseButton?.addEventListener("click", async () => runAction("pause", () => state.debugApi.pause()));
  refs.resumeButton?.addEventListener("click", async () => {
    const resumeResult = await runAction("resume", () => state.debugApi.resume());
    if (resumeResult.ok) {
      startBrowserLoop();
    }
  });
  refs.resetButton?.addEventListener("click", async () => {
    state.browserInput.clear();
    await runAction("reset", () => state.debugApi.reset());
  });
  refs.restartButton?.addEventListener("click", async () => {
    state.browserInput.clear();
    const restartResult = await runAction("restart", () => state.debugApi.restart());
    if (restartResult?.ok === true) {
      await activatePlayerControl();
    }
  });
  refs.clearButton?.addEventListener("click", async () => {
    stopBrowserLoop();
    state.browserInput.clear();
    await runAction("clear", () => state.debugApi.clear());
  });
  refs.refreshSummaryButton?.addEventListener("click", () => refreshView());

  state.browserInput.attach(globalThis);

  if (query.autoStart && state.debugApi) {
    syncActionOptionsFromInputs();
    const autoStartResult = await runAction("autostart", () => state.debugApi.startFromLevelPath(state.levelPath, { stopOnGrounded: state.actionOptions.stopOnGrounded }));
    if (autoStartResult?.ok === true) {
      await activatePlayerControl();
    }
  }

  return {
    ok: state.bootResult?.ok === true,
    query,
    state,
    refreshView,
  };
}
