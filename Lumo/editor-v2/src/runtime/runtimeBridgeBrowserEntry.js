import { bootRuntimeBridge } from "./bootRuntimeBridge.js";
import { renderRuntimeBridgeStatus } from "./renderRuntimeBridgeStatus.js";
import { updateRuntimeBridgeView } from "./updateRuntimeBridgeView.js";

const DEFAULT_LEVEL_PATH = "./src/data/testLevelDocument.v1.json";
const DEFAULT_UPDATE_STEPS = 3;

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
    viewStatus: root.querySelector("#runtimeBridgeViewStatus"),
    viewCanvas: root.querySelector("#runtimeBridgeViewCanvas"),
    viewLegend: root.querySelector("#runtimeBridgeViewLegend"),
    startButton: root.querySelector("#runtimeBridgeStartButton"),
    tickButton: root.querySelector("#runtimeBridgeTickButton"),
    updateButton: root.querySelector("#runtimeBridgeUpdateButton"),
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

  if (refs.levelPathInput) {
    refs.levelPathInput.value = query.levelPath;
  }

  const state = {
    query,
    levelPath: query.levelPath,
    bootResult: null,
    bridge: null,
    debugApi: null,
    lastAction: null,
  };

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

    // Keeps runtime canvas view in sync with active bridge/controller/session state.
    const viewResult = updateRuntimeBridgeView({
      bridge: state.bridge,
      debugApi: state.debugApi,
      canvas: refs.viewCanvas,
    });

    if (refs.viewStatus) {
      const message = viewResult.ok
        ? `Runtime view ${viewResult.state} | tick=${viewResult?.viewModel?.overlay?.runtimeTick ?? "-"}`
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
    try {
      const result = await actionFn();
      state.lastAction = {
        action: actionName,
        ok: result?.ok === true,
        status: result?.status ?? null,
        summary: result?.summary ?? null,
        errors: result?.errors ?? [],
        warnings: result?.warnings ?? [],
      };
    } catch (error) {
      state.lastAction = {
        action: actionName,
        ok: false,
        status: null,
        summary: null,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      };
    }

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

  if (state.debugApi && typeof state.debugApi === "object") {
    globalThis.LumoRuntimeBridgePage = {
      query,
      getState() {
        return state;
      },
      refresh: refreshView,
      actions: {
        start: () => runAction("start", () => state.debugApi.startFromLevelPath(state.levelPath, { stopOnGrounded: query.stopOnGrounded })),
        tick: () => runAction("tick", () => state.debugApi.tick()),
        update: () => runAction("update", () => state.debugApi.update({ steps: query.steps, stopOnGrounded: query.stopOnGrounded })),
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

  refs.startButton?.addEventListener("click", async () => {
    updateLevelPathFromInput();
    await runAction("start", () => state.debugApi.startFromLevelPath(state.levelPath, { stopOnGrounded: query.stopOnGrounded }));
  });
  refs.tickButton?.addEventListener("click", async () => runAction("tick", () => state.debugApi.tick()));
  refs.updateButton?.addEventListener("click", async () => runAction("update", () => state.debugApi.update({ steps: query.steps, stopOnGrounded: query.stopOnGrounded })));
  refs.pauseButton?.addEventListener("click", async () => runAction("pause", () => state.debugApi.pause()));
  refs.resumeButton?.addEventListener("click", async () => runAction("resume", () => state.debugApi.resume()));
  refs.resetButton?.addEventListener("click", async () => runAction("reset", () => state.debugApi.reset()));
  refs.restartButton?.addEventListener("click", async () => runAction("restart", () => state.debugApi.restart()));
  refs.clearButton?.addEventListener("click", async () => runAction("clear", () => state.debugApi.clear()));
  refs.refreshSummaryButton?.addEventListener("click", () => refreshView());

  if (query.autoStart && state.debugApi) {
    await runAction("autostart", () => state.debugApi.startFromLevelPath(state.levelPath, { stopOnGrounded: query.stopOnGrounded }));
  }

  return {
    ok: state.bootResult?.ok === true,
    query,
    state,
    refreshView,
  };
}
