import { createRuntimeGameSession } from "./createRuntimeGameSession.js";

const DEFAULT_STATUS = "idle";

// Normalizes runtime status values so callers get deterministic known states.
function normalizeStatus(status, fallback = DEFAULT_STATUS) {
  if (
    status === "idle" ||
    status === "booted" ||
    status === "running" ||
    status === "stopped" ||
    status === "invalid"
  ) {
    return status;
  }

  return fallback;
}

// Returns a compact player snapshot with a stable shape.
function buildPlayerSnapshot(player) {
  const source = player && typeof player === "object" ? player : {};

  return {
    x: Number.isFinite(source.x) ? source.x : null,
    y: Number.isFinite(source.y) ? source.y : null,
    grounded: source.grounded === true,
    falling: source.falling === true,
    locomotion: typeof source.locomotion === "string" ? source.locomotion : "unknown",
  };
}

// Returns a compact world snapshot with a stable shape.
function buildWorldSnapshot(world) {
  const source = world && typeof world === "object" ? world : {};

  return {
    worldId: typeof source.worldId === "string" ? source.worldId : "",
    themeId: typeof source.themeId === "string" ? source.themeId : "",
    width: Number.isFinite(source.width) ? source.width : 0,
    height: Number.isFinite(source.height) ? source.height : 0,
    tileSize: Number.isFinite(source.tileSize) ? source.tileSize : 0,
  };
}

// Clones runtime boot state into a deterministic shape for external callers.
function cloneRuntimeState(state) {
  return {
    ok: state.ok === true,
    booted: state.booted === true,
    bootable: state.bootable === true,
    status: normalizeStatus(state.status),
    tick: Number.isFinite(state.tick) ? state.tick : 0,
    sessionOk: state.sessionOk === true,
    lastAction: typeof state.lastAction === "string" ? state.lastAction : "none",
    lastTickResult: state.lastTickResult && typeof state.lastTickResult === "object" ? { ...state.lastTickResult } : null,
  };
}

// Synchronizes the runtime boot state from the underlying session state.
function syncRuntimeFromSession(runtimeState, sessionState) {
  const source = sessionState && typeof sessionState === "object" ? sessionState : {};
  const sourceStatus = normalizeStatus(source.status, runtimeState.booted ? "running" : "idle");

  runtimeState.sessionOk = source.ok === true;
  runtimeState.ok = runtimeState.sessionOk;
  runtimeState.bootable = runtimeState.sessionOk;
  runtimeState.tick = Number.isFinite(source.tick) ? source.tick : 0;

  if (runtimeState.ok !== true) {
    runtimeState.status = "invalid";
    return;
  }

  if (runtimeState.booted !== true) {
    runtimeState.status = sourceStatus === "stopped" ? "idle" : "idle";
    return;
  }

  if (sourceStatus === "running") {
    runtimeState.status = "running";
    return;
  }

  if (sourceStatus === "stopped") {
    runtimeState.status = "stopped";
    return;
  }

  runtimeState.status = "booted";
}

// Builds the compact action result for all runtime lifecycle calls.
function buildActionResult(runtimeState, extras = {}) {
  return {
    ok: runtimeState.ok === true,
    booted: runtimeState.booted === true,
    bootable: runtimeState.bootable === true,
    status: normalizeStatus(runtimeState.status),
    tick: Number.isFinite(runtimeState.tick) ? runtimeState.tick : 0,
    ...extras,
  };
}

// Creates the first Recharged gameplay boot runtime layer above game sessions.
export function createRechargedGameRuntime(options = {}) {
  try {
    const levelDocument = options?.levelDocument;
    const session = createRuntimeGameSession({ levelDocument });
    const sessionState = session?.getState?.();
    const sessionOk = session?.ok === true && sessionState?.ok === true;

    const runtimeState = {
      ok: sessionOk,
      booted: false,
      bootable: sessionOk,
      status: sessionOk ? "idle" : "invalid",
      tick: 0,
      sessionOk,
      lastAction: "create",
      lastTickResult: null,
    };

    // Returns a full runtime state snapshot suitable for debugging.
    function getState() {
      return cloneRuntimeState(runtimeState);
    }

    // Returns compact player state delegated from the runtime session.
    function getPlayerSnapshot() {
      try {
        return buildPlayerSnapshot(session?.getPlayerSnapshot?.());
      } catch (_error) {
        return buildPlayerSnapshot(null);
      }
    }

    // Returns compact world state delegated from the runtime session.
    function getWorldSnapshot() {
      try {
        return buildWorldSnapshot(session?.getWorldSnapshot?.());
      } catch (_error) {
        return buildWorldSnapshot(null);
      }
    }

    // Returns a compact runtime summary for gameplay runtime integration points.
    function getSummary() {
      const player = getPlayerSnapshot();
      const world = getWorldSnapshot();

      return {
        ok: runtimeState.ok === true,
        booted: runtimeState.booted === true,
        bootable: runtimeState.bootable === true,
        status: normalizeStatus(runtimeState.status),
        tick: Number.isFinite(runtimeState.tick) ? runtimeState.tick : 0,
        player,
        world,
      };
    }

    // Returns a minimal boot-facing runtime summary for boot host wiring.
    function getBootSummary() {
      const world = getWorldSnapshot();
      const player = getPlayerSnapshot();

      return {
        ok: runtimeState.ok === true,
        booted: runtimeState.booted === true,
        bootable: runtimeState.bootable === true,
        status: normalizeStatus(runtimeState.status),
        tick: Number.isFinite(runtimeState.tick) ? runtimeState.tick : 0,
        worldId: world.worldId,
        themeId: world.themeId,
        playerStatus: player.locomotion,
      };
    }

    // Starts runtime boot lifecycle by starting the underlying session exactly once.
    function boot() {
      runtimeState.lastAction = "boot";

      if (runtimeState.ok !== true || runtimeState.bootable !== true) {
        runtimeState.status = "invalid";
        const result = buildActionResult(runtimeState, { bootedNow: false });
        runtimeState.lastTickResult = result;
        return result;
      }

      if (runtimeState.booted === true) {
        syncRuntimeFromSession(runtimeState, session?.getState?.());
        const result = buildActionResult(runtimeState, { bootedNow: false, alreadyBooted: true });
        runtimeState.lastTickResult = result;
        return result;
      }

      try {
        const bootResult = session.start();
        runtimeState.booted = bootResult?.ok === true;
        syncRuntimeFromSession(runtimeState, bootResult?.state ?? session?.getState?.());

        if (runtimeState.ok === true && runtimeState.status !== "running") {
          runtimeState.status = "booted";
        }

        const result = buildActionResult(runtimeState, { bootedNow: runtimeState.booted === true, alreadyBooted: false });
        runtimeState.lastTickResult = result;
        return result;
      } catch (_error) {
        runtimeState.ok = false;
        runtimeState.sessionOk = false;
        runtimeState.bootable = false;
        runtimeState.booted = false;
        runtimeState.status = "invalid";
        const result = buildActionResult(runtimeState, { bootedNow: false });
        runtimeState.lastTickResult = result;
        return result;
      }
    }

    // Advances runtime by one deterministic step after boot.
    function tick() {
      runtimeState.lastAction = "tick";

      if (runtimeState.booted !== true || runtimeState.status === "invalid") {
        const result = buildActionResult(runtimeState, { stepped: false });
        runtimeState.lastTickResult = result;
        return result;
      }

      try {
        const tickResult = session.tick();
        syncRuntimeFromSession(runtimeState, tickResult?.state ?? session?.getState?.());

        const result = buildActionResult(runtimeState, { stepped: tickResult?.stepped === true });
        runtimeState.lastTickResult = result;
        return result;
      } catch (_error) {
        runtimeState.ok = false;
        runtimeState.sessionOk = false;
        runtimeState.bootable = false;
        runtimeState.status = "invalid";

        const result = buildActionResult(runtimeState, { stepped: false });
        runtimeState.lastTickResult = result;
        return result;
      }
    }

    // Runs multiple deterministic ticks in sequence with defensive bounds.
    function tickSteps(steps = 1) {
      runtimeState.lastAction = "tickSteps";
      const normalizedSteps = Number.isInteger(steps) && steps > 0 ? steps : 0;
      let stepsRun = 0;

      for (let index = 0; index < normalizedSteps; index += 1) {
        const tickResult = tick();
        if (tickResult.stepped !== true) {
          break;
        }

        stepsRun += 1;

        if (runtimeState.status === "invalid" || runtimeState.status === "stopped") {
          break;
        }
      }

      syncRuntimeFromSession(runtimeState, session?.getState?.());
      const result = buildActionResult(runtimeState, { stepsRequested: normalizedSteps, stepsRun });
      runtimeState.lastTickResult = result;
      return result;
    }

    // Stops the underlying session without discarding runtime boot identity.
    function shutdown() {
      runtimeState.lastAction = "shutdown";

      try {
        session.stop();
      } catch (_error) {
        // Intentional no-op to preserve non-throwing runtime behavior.
      }

      syncRuntimeFromSession(runtimeState, session?.getState?.());
      if (runtimeState.ok === true) {
        runtimeState.status = "stopped";
      }

      const result = buildActionResult(runtimeState, { stopped: true });
      runtimeState.lastTickResult = result;
      return result;
    }

    // Resets runtime and session to a clean boot-ready idle baseline.
    function reset() {
      runtimeState.lastAction = "reset";

      try {
        const resetResult = session.reset();
        runtimeState.booted = false;
        syncRuntimeFromSession(runtimeState, resetResult?.state ?? session?.getState?.());

        if (runtimeState.ok === true) {
          runtimeState.status = "idle";
          runtimeState.bootable = true;
        } else {
          runtimeState.status = "invalid";
          runtimeState.bootable = false;
        }

        const result = buildActionResult(runtimeState, { reset: true });
        runtimeState.lastTickResult = result;
        return result;
      } catch (_error) {
        runtimeState.ok = false;
        runtimeState.sessionOk = false;
        runtimeState.bootable = false;
        runtimeState.booted = false;
        runtimeState.status = "invalid";
        runtimeState.tick = 0;

        const result = buildActionResult(runtimeState, { reset: false });
        runtimeState.lastTickResult = result;
        return result;
      }
    }

    // Indicates whether the runtime has completed initial boot.
    function isBooted() {
      return runtimeState.booted === true;
    }

    return {
      ok: runtimeState.ok === true,
      boot,
      shutdown,
      reset,
      tick,
      tickSteps,
      getState,
      getSummary,
      getBootSummary,
      getPlayerSnapshot,
      getWorldSnapshot,
      isBooted,
    };
  } catch (_error) {
    const invalidState = {
      ok: false,
      booted: false,
      bootable: false,
      status: "invalid",
      tick: 0,
      sessionOk: false,
      lastAction: "create",
      lastTickResult: null,
    };

    function getState() {
      return cloneRuntimeState(invalidState);
    }

    function getPlayerSnapshot() {
      return buildPlayerSnapshot(null);
    }

    function getWorldSnapshot() {
      return buildWorldSnapshot(null);
    }

    function getSummary() {
      return {
        ok: false,
        booted: false,
        bootable: false,
        status: "invalid",
        tick: 0,
        player: getPlayerSnapshot(),
        world: getWorldSnapshot(),
      };
    }

    function getBootSummary() {
      return {
        ok: false,
        booted: false,
        bootable: false,
        status: "invalid",
        tick: 0,
        worldId: "",
        themeId: "",
        playerStatus: "unknown",
      };
    }

    function buildInvalidResult(extras = {}) {
      return { ok: false, booted: false, bootable: false, status: "invalid", tick: 0, ...extras };
    }

    return {
      ok: false,
      boot() {
        return buildInvalidResult({ bootedNow: false });
      },
      shutdown() {
        return buildInvalidResult({ stopped: true });
      },
      reset() {
        return buildInvalidResult({ reset: false });
      },
      tick() {
        return buildInvalidResult({ stepped: false });
      },
      tickSteps(steps = 1) {
        const normalizedSteps = Number.isInteger(steps) && steps > 0 ? steps : 0;
        return buildInvalidResult({ stepsRequested: normalizedSteps, stepsRun: 0 });
      },
      getState,
      getSummary,
      getBootSummary,
      getPlayerSnapshot,
      getWorldSnapshot,
      isBooted() {
        return false;
      },
    };
  }
}
