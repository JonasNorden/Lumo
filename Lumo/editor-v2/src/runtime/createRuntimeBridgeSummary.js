import { createRuntimeControllerSummary } from "./createRuntimeControllerSummary.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Builds a compact bridge-level summary from a bridge API or bridge-like state object.
export function createRuntimeBridgeSummary(bridgeOrState) {
  if (!bridgeOrState || typeof bridgeOrState !== "object") {
    return {
      ok: false,
      bridgeStatus: "invalid",
      hasActiveController: false,
      controllerStatus: "invalid",
      paused: false,
      sourceType: "unknown",
      worldId: null,
      themeId: null,
      runtimeTick: null,
      elapsedMs: null,
      playerStatus: null,
      grounded: false,
      falling: false,
      errors: ["Runtime bridge summary requires a bridge or bridge-like state object."],
      warnings: [],
    };
  }

  const bridgeStatus = typeof bridgeOrState.getStatus === "function"
    ? bridgeOrState.getStatus()
    : (typeof bridgeOrState.bridgeStatus === "string" ? bridgeOrState.bridgeStatus : "invalid");

  const activeController = typeof bridgeOrState.getActiveController === "function"
    ? bridgeOrState.getActiveController()
    : (bridgeOrState.activeController ?? null);

  const hasActiveController = Boolean(activeController);
  const controllerSummary = hasActiveController
    ? createRuntimeControllerSummary(activeController)
    : createRuntimeControllerSummary({ status: "invalid", sourceType: "unknown" });

  return {
    ok: bridgeStatus !== "invalid" && (bridgeStatus === "idle" || controllerSummary.ok === true),
    bridgeStatus,
    hasActiveController,
    controllerStatus: controllerSummary.status,
    paused: controllerSummary.paused === true,
    sourceType: controllerSummary.sourceType,
    worldId: controllerSummary.worldId,
    themeId: controllerSummary.themeId,
    runtimeTick: controllerSummary.runtimeTick,
    elapsedMs: controllerSummary.elapsedMs,
    playerStatus: controllerSummary.playerStatus,
    grounded: controllerSummary.grounded === true,
    falling: controllerSummary.falling === true,
    errors: uniqueMessages(controllerSummary.errors),
    warnings: uniqueMessages(controllerSummary.warnings),
  };
}
