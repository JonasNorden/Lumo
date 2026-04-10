function toStringOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toFiniteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

// Builds a compact debug-first summary for top-level runtime start results.
export function createRuntimeStartSummary(result) {
  if (!result || typeof result !== "object") {
    return {
      ok: false,
      worldId: null,
      themeId: null,
      levelPath: null,
      sessionStatus: null,
      runtimeTick: null,
      stepsRun: 0,
      playerStatus: null,
      grounded: false,
      falling: false,
      errors: ["Runtime start summary requires a result object."],
      warnings: [],
    };
  }

  const session = result.session;
  const initializationWorld = result.initialization?.world;
  const player = session?.player;

  return {
    ok: result.ok === true,
    worldId: toStringOrNull(initializationWorld?.id) ?? toStringOrNull(result?.levelDocument?.identity?.id),
    themeId:
      toStringOrNull(initializationWorld?.themeId) ??
      toStringOrNull(result?.levelDocument?.identity?.themeId),
    levelPath: toStringOrNull(result.levelPath),
    sessionStatus: toStringOrNull(session?.status),
    runtimeTick: toFiniteOrNull(session?.runtime?.tick),
    stepsRun: Number.isFinite(result?.simulation?.stepsRun) ? result.simulation.stepsRun : 0,
    playerStatus: toStringOrNull(player?.status),
    grounded: player?.grounded === true,
    falling: player?.falling === true,
    errors: toArray(result.errors).filter((item) => typeof item === "string" && item.length > 0),
    warnings: toArray(result.warnings).filter((item) => typeof item === "string" && item.length > 0),
  };
}
