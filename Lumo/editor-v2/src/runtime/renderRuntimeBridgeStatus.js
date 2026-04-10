import { createRuntimeBridgeSummary } from "./createRuntimeBridgeSummary.js";
import { normalizeRuntimeSummaryShape } from "./normalizeRuntimeSummaryShape.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

function safeInvoke(fn, fallbackValue) {
  try {
    return typeof fn === "function" ? fn() : fallbackValue;
  } catch (error) {
    return {
      value: fallbackValue,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function normalizeResult(value, fallbackValue) {
  if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "value")) {
    return value;
  }

  return {
    value: value ?? fallbackValue,
    error: null,
  };
}

// Builds a compact browser-facing view model from runtime bridge + debug state.
export function renderRuntimeBridgeStatus(runtimeState = {}) {
  const errors = [];
  const warnings = [];

  const bootResult = runtimeState?.bootResult ?? null;
  const bridge = runtimeState?.bridge ?? bootResult?.bridge ?? null;
  const debugApi = runtimeState?.debugApi ?? bootResult?.debugApi ?? null;

  errors.push(...(bootResult?.errors ?? []));
  warnings.push(...(bootResult?.warnings ?? []));

  const bridgeSummaryResult = normalizeResult(
    safeInvoke(() => {
      if (bridge) {
        return createRuntimeBridgeSummary(bridge);
      }
      return createRuntimeBridgeSummary({ bridgeStatus: "idle", activeController: null });
    }, createRuntimeBridgeSummary({ bridgeStatus: "invalid", activeController: null })),
    createRuntimeBridgeSummary({ bridgeStatus: "invalid", activeController: null }),
  );

  if (bridgeSummaryResult.error) {
    errors.push(`renderRuntimeBridgeStatus could not build bridge summary: ${bridgeSummaryResult.error}`);
  }

  const debugSummaryResult = normalizeResult(
    safeInvoke(() => (debugApi && typeof debugApi.getSummary === "function" ? debugApi.getSummary() : null), null),
    null,
  );
  if (debugSummaryResult.error) {
    errors.push(`renderRuntimeBridgeStatus could not read debug summary: ${debugSummaryResult.error}`);
  }

  const debugSnapshotResult = normalizeResult(
    safeInvoke(() => (debugApi && typeof debugApi.getSnapshot === "function" ? debugApi.getSnapshot() : null), null),
    null,
  );
  if (debugSnapshotResult.error) {
    errors.push(`renderRuntimeBridgeStatus could not read debug snapshot: ${debugSnapshotResult.error}`);
  }

  const bridgeSummary = bridgeSummaryResult.value ?? {};
  const debugSummary = debugSummaryResult.value ?? {};
  const rawSummary = {
    ...debugSummary,
    ...bridgeSummary,
  };
  const snapshot = debugSnapshotResult.value ?? {};

  errors.push(...(bridgeSummary?.errors ?? []));
  errors.push(...(debugSummary?.errors ?? []));
  errors.push(...(snapshot?.errors ?? []));
  warnings.push(...(bridgeSummary?.warnings ?? []));
  warnings.push(...(debugSummary?.warnings ?? []));
  warnings.push(...(snapshot?.warnings ?? []));

  const summary = normalizeRuntimeSummaryShape(rawSummary, {
    bridgeStatus: rawSummary?.bridgeStatus ?? bridgeSummary?.bridgeStatus ?? bootResult?.debug?.bridgeStatus ?? "invalid",
    controllerStatus: rawSummary?.controllerStatus ?? rawSummary?.status ?? "invalid",
    hasActiveController: bridgeSummary?.hasActiveController === true,
  });

  const bridgeStatus = summary.bridgeStatus;
  const controllerStatus = summary.controllerStatus;
  const runtimeTick = summary.runtimeTick;
  const playbackStatus = summary.playbackStatus;
  const tickRate = summary.tickRate;
  const autoPlay = summary.autoPlay;
  const playerStatus = summary.playerStatus;
  const locomotion = summary.locomotion;
  const grounded = summary.grounded;
  const falling = summary.falling;
  const rising = summary.rising;

  return {
    title: "Recharged Runtime Bridge",
    statusLine: `bridge=${bridgeStatus} | controller=${controllerStatus} | playback=${playbackStatus} | tick=${runtimeTick ?? "-"} | rate=${tickRate ?? "-"} | auto=${autoPlay ? "on" : "off"} | player=${playerStatus ?? "-"}`,
    summary: {
      ...summary,
      levelPath: runtimeState?.levelPath ?? null,
      query: runtimeState?.query ?? null,
      bootStage: bootResult?.debug?.stage ?? null,
      autoStart: bootResult?.debug?.autoStart === true,
      attached: bootResult?.debug?.attached === true,
    },
    debug: {
      bootDebug: bootResult?.debug ?? null,
      snapshot,
    },
    lastAction: runtimeState?.lastAction ?? null,
    errors: uniqueMessages(errors),
    warnings: uniqueMessages(warnings),
  };
}
