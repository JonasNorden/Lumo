function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Accepts either a controller instance or a raw state-like object and extracts a compact summary.
function extractControllerSnapshot(controllerOrState) {
  if (controllerOrState && typeof controllerOrState.getDebugSnapshot === "function") {
    const debug = controllerOrState.getDebugSnapshot();
    const summary = typeof controllerOrState.getSummary === "function" ? controllerOrState.getSummary() : null;

    return {
      sourceType: debug?.sourceType ?? "unknown",
      status: typeof controllerOrState.getStatus === "function" ? controllerOrState.getStatus() : debug?.status,
      paused: typeof controllerOrState.isPaused === "function" ? controllerOrState.isPaused() : debug?.paused === true,
      worldId: summary?.worldId ?? debug?.worldId ?? null,
      themeId: summary?.themeId ?? debug?.themeId ?? null,
      runtimeTick: summary?.runtimeTick ?? debug?.runtimeTick ?? null,
      elapsedMs: controllerOrState.getSession?.()?.runtime?.elapsedMs ?? null,
      playerStatus: summary?.playerStatus ?? debug?.playerStatus ?? null,
      grounded: summary?.grounded === true,
      falling: summary?.falling === true,
    };
  }

  return {
    sourceType: controllerOrState?.sourceType ?? "unknown",
    status: controllerOrState?.status ?? "invalid",
    paused: controllerOrState?.paused === true,
    worldId: controllerOrState?.worldId ?? null,
    themeId: controllerOrState?.themeId ?? null,
    runtimeTick: controllerOrState?.runtimeTick ?? null,
    elapsedMs: controllerOrState?.elapsedMs ?? null,
    playerStatus: controllerOrState?.playerStatus ?? null,
    grounded: controllerOrState?.grounded === true,
    falling: controllerOrState?.falling === true,
  };
}

// Builds a debug-first compact summary for runtime controller state.
export function createRuntimeControllerSummary(controllerOrState) {
  if (!controllerOrState || typeof controllerOrState !== "object") {
    return {
      ok: false,
      sourceType: "unknown",
      status: "invalid",
      paused: false,
      worldId: null,
      themeId: null,
      runtimeTick: null,
      elapsedMs: null,
      playerStatus: null,
      grounded: false,
      falling: false,
      errors: ["Runtime controller summary requires a controller or state object."],
      warnings: [],
    };
  }

  const snapshot = extractControllerSnapshot(controllerOrState);
  return {
    ok: snapshot.status !== "invalid",
    sourceType: typeof snapshot.sourceType === "string" ? snapshot.sourceType : "unknown",
    status: typeof snapshot.status === "string" ? snapshot.status : "invalid",
    paused: snapshot.paused === true,
    worldId: typeof snapshot.worldId === "string" ? snapshot.worldId : null,
    themeId: typeof snapshot.themeId === "string" ? snapshot.themeId : null,
    runtimeTick: Number.isFinite(snapshot.runtimeTick) ? snapshot.runtimeTick : null,
    elapsedMs: Number.isFinite(snapshot.elapsedMs) ? snapshot.elapsedMs : null,
    playerStatus: typeof snapshot.playerStatus === "string" ? snapshot.playerStatus : null,
    grounded: snapshot.grounded === true,
    falling: snapshot.falling === true,
    errors: [],
    warnings: uniqueMessages(snapshot?.warnings),
  };
}
