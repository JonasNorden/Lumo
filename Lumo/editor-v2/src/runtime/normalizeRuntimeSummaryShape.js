function toStringOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toFiniteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

// Ensures runtime summaries stay shape-stable across controller/bridge/browser/action flows.
export function normalizeRuntimeSummaryShape(summary = {}, options = {}) {
  const source = summary && typeof summary === "object" ? summary : {};

  const bridgeStatus = toStringOrNull(source.bridgeStatus) ?? toStringOrNull(options.bridgeStatus) ?? "invalid";
  const controllerStatus =
    toStringOrNull(source.controllerStatus) ??
    toStringOrNull(source.status) ??
    toStringOrNull(options.controllerStatus) ??
    toStringOrNull(options.status) ??
    "invalid";

  const playbackStatus =
    toStringOrNull(source.playbackStatus) ??
    toStringOrNull(source.playback?.status) ??
    toStringOrNull(options.playbackStatus) ??
    "stopped";

  const runtimeTick =
    toFiniteOrNull(source.runtimeTick) ??
    toFiniteOrNull(source.sessionTick) ??
    toFiniteOrNull(options.runtimeTick);

  const tickRate =
    toFiniteOrNull(source.tickRate) ??
    toFiniteOrNull(source.playback?.tickRate) ??
    toFiniteOrNull(options.tickRate) ??
    4;

  const autoPlay =
    source.autoPlay === true ||
    source.autoAdvance === true ||
    source.playback?.autoAdvance === true ||
    options.autoPlay === true;

  const paused = source.paused === true || source.playback?.paused === true || options.paused === true;

  return {
    ok: source.ok === true,
    sourceType: toStringOrNull(source.sourceType) ?? toStringOrNull(options.sourceType) ?? "unknown",
    bridgeStatus,
    controllerStatus,
    status: controllerStatus,
    worldId: toStringOrNull(source.worldId) ?? toStringOrNull(options.worldId),
    themeId: toStringOrNull(source.themeId) ?? toStringOrNull(options.themeId),
    runtimeTick,
    elapsedMs: toFiniteOrNull(source.elapsedMs) ?? toFiniteOrNull(options.elapsedMs),
    playbackStatus,
    tickRate,
    autoPlay,
    paused,
    playerStatus: toStringOrNull(source.playerStatus) ?? toStringOrNull(options.playerStatus),
    locomotion: toStringOrNull(source.locomotion) ?? toStringOrNull(options.locomotion),
    grounded: source.grounded === true || options.grounded === true,
    falling: source.falling === true || options.falling === true,
    rising: source.rising === true || options.rising === true,
    hasActiveController: source.hasActiveController === true || options.hasActiveController === true,
  };
}
