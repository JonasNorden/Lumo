function toFiniteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function toStringOrDash(value) {
  return typeof value === "string" && value.length > 0 ? value : "-";
}

// Normalizes compact runtime HUD content for both browser labels and canvas overlays.
export function renderRuntimeHudModel(summary = {}) {
  const runtimeTick = toFiniteOrNull(summary?.runtimeTick);
  const grounded = summary?.grounded === true;
  const locomotion = toStringOrDash(summary?.locomotion);
  const status = toStringOrDash(summary?.playerStatus ?? summary?.controllerStatus ?? summary?.bridgeStatus);
  const playback = toStringOrDash(summary?.playbackStatus);

  return {
    status,
    tickText: runtimeTick === null ? "tick -" : `tick ${runtimeTick}`,
    airText: grounded ? "grounded" : "airborne",
    locomotionText: `locomotion ${locomotion}`,
    playbackText: `playback ${playback}`,
    line: `status ${status} · ${runtimeTick === null ? "tick -" : `tick ${runtimeTick}`} · ${grounded ? "grounded" : "airborne"} · locomotion ${locomotion} · playback ${playback}`,
  };
}
