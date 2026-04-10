import { createRuntimeControllerSummary } from "./createRuntimeControllerSummary.js";
import { normalizeRuntimeSummaryShape } from "./normalizeRuntimeSummaryShape.js";

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
      ...normalizeRuntimeSummaryShape({}, { bridgeStatus: "invalid", controllerStatus: "invalid" }),
      ok: false,
      hasActiveController: false,
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

  const normalized = normalizeRuntimeSummaryShape({
    ...controllerSummary,
    bridgeStatus,
  }, {
    bridgeStatus,
    controllerStatus: controllerSummary.status,
    hasActiveController,
  });

  return {
    ...normalized,
    ok: bridgeStatus !== "invalid" && (bridgeStatus === "idle" || bridgeStatus === "stopped" || controllerSummary.ok === true),
    hasActiveController,
    errors: uniqueMessages(controllerSummary.errors),
    warnings: uniqueMessages(controllerSummary.warnings),
  };
}
