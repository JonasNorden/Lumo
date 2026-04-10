import { normalizeRuntimeSummaryShape } from "./normalizeRuntimeSummaryShape.js";

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
      ...normalizeRuntimeSummaryShape({}, { bridgeStatus: "invalid", controllerStatus: "invalid" }),
      ok: false,
      levelPath: null,
      sessionStatus: null,
      stepsRun: 0,
      errors: ["Runtime start summary requires a result object."],
      warnings: [],
    };
  }

  const session = result.session;
  const initializationWorld = result.initialization?.world;
  const player = session?.player;

  const normalized = normalizeRuntimeSummaryShape(
    {
      sourceType: result?.sourceType,
      status: session?.status,
      worldId: toStringOrNull(initializationWorld?.id) ?? toStringOrNull(result?.levelDocument?.identity?.id),
      themeId: toStringOrNull(initializationWorld?.themeId) ?? toStringOrNull(result?.levelDocument?.identity?.themeId),
      runtimeTick: toFiniteOrNull(session?.runtime?.tick),
      playerStatus: toStringOrNull(player?.status),
      locomotion: toStringOrNull(player?.locomotion),
      grounded: player?.grounded === true,
      falling: player?.falling === true,
      rising: player?.rising === true,
      paused: session?.runtime?.paused === true,
    },
    {
      bridgeStatus: result.ok === true ? "ready" : "invalid",
      controllerStatus: toStringOrNull(session?.status) ?? "invalid",
      hasActiveController: result.ok === true,
    },
  );

  return {
    ...normalized,
    ok: result.ok === true,
    levelPath: toStringOrNull(result.levelPath),
    sessionStatus: toStringOrNull(session?.status),
    stepsRun: Number.isFinite(result?.simulation?.stepsRun) ? result.simulation.stepsRun : 0,
    errors: toArray(result.errors).filter((item) => typeof item === "string" && item.length > 0),
    warnings: toArray(result.warnings).filter((item) => typeof item === "string" && item.length > 0),
  };
}
