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
    const session = typeof controllerOrState.getSession === "function" ? controllerOrState.getSession() : null;
    const sessionPlayer = session?.player ?? null;

    return {
      sourceType: debug?.sourceType ?? "unknown",
      status: typeof controllerOrState.getStatus === "function" ? controllerOrState.getStatus() : debug?.status,
      paused: typeof controllerOrState.isPaused === "function" ? controllerOrState.isPaused() : debug?.paused === true,
      playback: typeof controllerOrState.getPlaybackState === "function" ? controllerOrState.getPlaybackState() : null,
      worldId: summary?.worldId ?? debug?.worldId ?? null,
      themeId: summary?.themeId ?? debug?.themeId ?? null,
      runtimeTick: session?.runtime?.tick ?? summary?.runtimeTick ?? debug?.runtimeTick ?? null,
      elapsedMs: session?.runtime?.elapsedMs ?? null,
      playerStatus: sessionPlayer?.status ?? summary?.playerStatus ?? debug?.playerStatus ?? null,
      locomotion: sessionPlayer?.locomotion ?? null,
      grounded: sessionPlayer?.grounded === true || summary?.grounded === true,
      falling: sessionPlayer?.falling === true || summary?.falling === true,
      rising: sessionPlayer?.rising === true,
    };
  }

  return {
    sourceType: controllerOrState?.sourceType ?? "unknown",
    status: controllerOrState?.status ?? "invalid",
    paused: controllerOrState?.paused === true,
    playback: controllerOrState?.playback ?? null,
    worldId: controllerOrState?.worldId ?? null,
    themeId: controllerOrState?.themeId ?? null,
    runtimeTick: controllerOrState?.runtimeTick ?? null,
    elapsedMs: controllerOrState?.elapsedMs ?? null,
    playerStatus: controllerOrState?.playerStatus ?? null,
    locomotion: controllerOrState?.locomotion ?? null,
    grounded: controllerOrState?.grounded === true,
    falling: controllerOrState?.falling === true,
    rising: controllerOrState?.rising === true,
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
      playbackStatus: "stopped",
      tickRate: 4,
      autoPlay: false,
      playerStatus: null,
      locomotion: null,
      grounded: false,
      falling: false,
      rising: false,
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
    playbackStatus: typeof snapshot?.playback?.status === "string" ? snapshot.playback.status : "stopped",
    tickRate: Number.isFinite(snapshot?.playback?.tickRate) ? snapshot.playback.tickRate : 4,
    autoPlay: snapshot?.playback?.autoAdvance === true,
    playerStatus: typeof snapshot.playerStatus === "string" ? snapshot.playerStatus : null,
    locomotion: typeof snapshot.locomotion === "string" ? snapshot.locomotion : null,
    grounded: snapshot.grounded === true,
    falling: snapshot.falling === true,
    rising: snapshot.rising === true,
    errors: [],
    warnings: uniqueMessages(snapshot?.warnings),
  };
}
