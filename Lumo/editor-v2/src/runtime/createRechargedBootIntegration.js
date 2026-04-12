import { createRechargedGameRuntime } from "./createRechargedGameRuntime.js";

// Returns only supported integration statuses for deterministic host behavior.
function normalizeStatus(status, fallback = "idle") {
  if (
    status === "idle" ||
    status === "initialized" ||
    status === "running" ||
    status === "stopped" ||
    status === "invalid"
  ) {
    return status;
  }

  return fallback;
}

// Normalizes action labels so debugging output remains stable.
function normalizeAction(action) {
  return typeof action === "string" && action.length > 0 ? action : "none";
}

// Builds a compact player snapshot with non-undefined fields.
function buildPlayerSnapshot(snapshot) {
  const source = snapshot && typeof snapshot === "object" ? snapshot : {};

  return {
    x: Number.isFinite(source.x) ? source.x : null,
    y: Number.isFinite(source.y) ? source.y : null,
    grounded: source.grounded === true,
    falling: source.falling === true,
    locomotion: typeof source.locomotion === "string" ? source.locomotion : "unknown",
    flares: Array.isArray(source.flares) ? source.flares.map((flare) => ({ ...flare })) : [],
  };
}

// Builds a compact world snapshot with non-undefined fields.
function buildWorldSnapshot(snapshot) {
  const source = snapshot && typeof snapshot === "object" ? snapshot : {};
  const supportTiles = Array.isArray(source.supportTiles)
    ? source.supportTiles
      .map((tile) => ({
        x: Number.isFinite(tile?.x) ? tile.x : null,
        y: Number.isFinite(tile?.y) ? tile.y : null,
        w: Number.isFinite(tile?.w) ? tile.w : null,
        h: Number.isFinite(tile?.h) ? tile.h : null,
      }))
      .filter((tile) => tile.x !== null && tile.y !== null && tile.w !== null && tile.h !== null && tile.w > 0 && tile.h > 0)
    : [];

  return {
    worldId: typeof source.worldId === "string" ? source.worldId : "",
    themeId: typeof source.themeId === "string" ? source.themeId : "",
    width: Number.isFinite(source.width) ? source.width : 0,
    height: Number.isFinite(source.height) ? source.height : 0,
    tileSize: Number.isFinite(source.tileSize) ? source.tileSize : 0,
    supportTiles,
  };
}

// Creates a safe structured action result shared by lifecycle operations.
function buildActionResult(integrationState, extras = {}) {
  return {
    ok: integrationState.ok === true,
    initialized: integrationState.initialized === true,
    started: integrationState.started === true,
    startable: integrationState.startable === true,
    status: normalizeStatus(integrationState.status, integrationState.ok ? "idle" : "invalid"),
    tick: Number.isFinite(integrationState.tick) ? integrationState.tick : 0,
    ...extras,
  };
}

// Clones internal state so callers get a stable debugging snapshot.
function cloneState(integrationState) {
  const source = integrationState && typeof integrationState === "object" ? integrationState : {};

  return {
    ok: source.ok === true,
    initialized: source.initialized === true,
    started: source.started === true,
    startable: source.startable === true,
    status: normalizeStatus(source.status, source.ok ? "idle" : "invalid"),
    tick: Number.isFinite(source.tick) ? source.tick : 0,
    runtimeOk: source.runtimeOk === true,
    lastAction: normalizeAction(source.lastAction),
    lastResult: source.lastResult && typeof source.lastResult === "object" ? { ...source.lastResult } : null,
  };
}

// Creates the first future Lumo.html-facing boot integration surface for Recharged runtime.
export function createRechargedBootIntegration(options = {}) {
  try {
    const levelDocument = options?.levelDocument;
    const runtime = createRechargedGameRuntime({ levelDocument });

    const integrationState = {
      ok: runtime?.ok === true,
      initialized: false,
      started: false,
      startable: runtime?.ok === true,
      status: runtime?.ok === true ? "idle" : "invalid",
      tick: 0,
      runtimeOk: runtime?.ok === true,
      lastAction: "create",
      lastResult: null,
    };

    // Synchronizes integration state from runtime while preserving integration lifecycle identity.
    function syncFromRuntime() {
      try {
        const runtimeState = runtime?.getState?.();
        const runtimeOk = runtimeState?.ok === true;

        integrationState.runtimeOk = runtimeOk;
        integrationState.ok = runtimeOk;
        integrationState.startable = runtimeOk;
        integrationState.tick = Number.isFinite(runtimeState?.tick) ? runtimeState.tick : 0;

        if (runtimeOk !== true) {
          integrationState.status = "invalid";
          integrationState.started = false;
          return;
        }

        const runtimeStatus = runtimeState?.status;
        if (integrationState.started === true) {
          if (runtimeStatus === "stopped") {
            integrationState.status = "stopped";
            integrationState.started = false;
          } else {
            integrationState.status = "running";
          }
          return;
        }

        if (integrationState.initialized === true) {
          integrationState.status = "initialized";
          return;
        }

        integrationState.status = "idle";
      } catch (_error) {
        integrationState.ok = false;
        integrationState.runtimeOk = false;
        integrationState.startable = false;
        integrationState.status = "invalid";
        integrationState.started = false;
      }
    }

    // Returns compact player state delegated from the underlying Recharged runtime.
    function getPlayerSnapshot() {
      try {
        return buildPlayerSnapshot(runtime?.getPlayerSnapshot?.());
      } catch (_error) {
        return buildPlayerSnapshot(null);
      }
    }

    // Returns compact world state delegated from the underlying Recharged runtime.
    function getWorldSnapshot() {
      try {
        return buildWorldSnapshot(runtime?.getWorldSnapshot?.());
      } catch (_error) {
        return buildWorldSnapshot(null);
      }
    }

    // Returns a full integration state snapshot for debugging and deterministic checks.
    function getState() {
      return cloneState(integrationState);
    }

    // Returns the compact integration summary expected by future Lumo.html boot wiring.
    function getSummary() {
      const player = getPlayerSnapshot();
      const world = getWorldSnapshot();

      return {
        ok: integrationState.ok === true,
        initialized: integrationState.initialized === true,
        started: integrationState.started === true,
        startable: integrationState.startable === true,
        status: normalizeStatus(integrationState.status, integrationState.ok ? "idle" : "invalid"),
        tick: Number.isFinite(integrationState.tick) ? integrationState.tick : 0,
        player,
        world,
      };
    }

    // Returns compact boot payload for future Lumo.html runtime handoff.
    function getBootPayload() {
      const world = getWorldSnapshot();
      const player = getPlayerSnapshot();

      return {
        ok: integrationState.ok === true,
        initialized: integrationState.initialized === true,
        started: integrationState.started === true,
        startable: integrationState.startable === true,
        status: normalizeStatus(integrationState.status, integrationState.ok ? "idle" : "invalid"),
        tick: Number.isFinite(integrationState.tick) ? integrationState.tick : 0,
        worldId: world.worldId,
        themeId: world.themeId,
        playerStatus: player.locomotion,
        playerX: player.x,
        playerY: player.y,
      };
    }

    // Initializes the integration without starting runtime ticks.
    function initialize() {
      integrationState.lastAction = "initialize";

      if (integrationState.ok !== true || integrationState.startable !== true) {
        integrationState.status = "invalid";
        const result = buildActionResult(integrationState, { initializedNow: false, alreadyInitialized: false });
        integrationState.lastResult = result;
        return result;
      }

      if (integrationState.initialized === true) {
        syncFromRuntime();
        const result = buildActionResult(integrationState, { initializedNow: false, alreadyInitialized: true });
        integrationState.lastResult = result;
        return result;
      }

      integrationState.initialized = true;
      integrationState.status = "initialized";

      const result = buildActionResult(integrationState, { initializedNow: true, alreadyInitialized: false });
      integrationState.lastResult = result;
      return result;
    }

    // Starts integration and boots the underlying runtime safely.
    function start() {
      integrationState.lastAction = "start";

      if (integrationState.ok !== true || integrationState.startable !== true) {
        integrationState.status = "invalid";
        const result = buildActionResult(integrationState, { startedNow: false });
        integrationState.lastResult = result;
        return result;
      }

      if (integrationState.initialized !== true) {
        initialize();
        if (integrationState.status === "invalid") {
          const result = buildActionResult(integrationState, { startedNow: false });
          integrationState.lastResult = result;
          return result;
        }
      }

      try {
        const bootResult = runtime.boot();
        syncFromRuntime();

        if (bootResult?.ok === true) {
          integrationState.started = true;
          integrationState.status = "running";
        }

        const result = buildActionResult(integrationState, {
          startedNow: integrationState.started === true,
          bootedNow: bootResult?.bootedNow === true,
        });
        integrationState.lastResult = result;
        return result;
      } catch (_error) {
        integrationState.ok = false;
        integrationState.runtimeOk = false;
        integrationState.startable = false;
        integrationState.status = "invalid";
        integrationState.started = false;

        const result = buildActionResult(integrationState, { startedNow: false, bootedNow: false });
        integrationState.lastResult = result;
        return result;
      }
    }

    // Runs exactly one runtime step when integration is started.
    function tick(inputIntent = {}) {
      integrationState.lastAction = "tick";

      if (integrationState.started !== true || integrationState.status === "invalid") {
        const result = buildActionResult(integrationState, { stepped: false });
        integrationState.lastResult = result;
        return result;
      }

      try {
        const tickResult = runtime.tick(inputIntent);
        syncFromRuntime();

        const result = buildActionResult(integrationState, { stepped: tickResult?.stepped === true });
        integrationState.lastResult = result;
        return result;
      } catch (_error) {
        integrationState.ok = false;
        integrationState.runtimeOk = false;
        integrationState.startable = false;
        integrationState.started = false;
        integrationState.status = "invalid";

        const result = buildActionResult(integrationState, { stepped: false });
        integrationState.lastResult = result;
        return result;
      }
    }

    // Runs multiple runtime steps deterministically with safe bounds.
    function tickSteps(n = 1) {
      integrationState.lastAction = "tickSteps";

      const stepsRequested = Number.isInteger(n) && n > 0 ? n : 0;
      let stepsRun = 0;

      for (let index = 0; index < stepsRequested; index += 1) {
        const tickResult = tick();
        if (tickResult.stepped !== true) {
          break;
        }

        stepsRun += 1;

        if (integrationState.status === "invalid" || integrationState.status === "stopped") {
          break;
        }
      }

      syncFromRuntime();
      const result = buildActionResult(integrationState, { stepsRequested, stepsRun });
      integrationState.lastResult = result;
      return result;
    }

    // Stops runtime and moves integration to a non-running state.
    function stop() {
      integrationState.lastAction = "stop";

      try {
        runtime.shutdown();
      } catch (_error) {
        // Intentional no-op for strict non-throwing behavior.
      }

      syncFromRuntime();
      integrationState.started = false;

      if (integrationState.ok === true) {
        integrationState.status = "stopped";
      }

      const result = buildActionResult(integrationState, { stopped: true });
      integrationState.lastResult = result;
      return result;
    }

    // Resets runtime and integration state to clean idle values.
    function reset() {
      integrationState.lastAction = "reset";

      try {
        runtime.reset();
      } catch (_error) {
        integrationState.ok = false;
        integrationState.runtimeOk = false;
        integrationState.startable = false;
      }

      syncFromRuntime();
      integrationState.initialized = false;
      integrationState.started = false;
      integrationState.tick = 0;

      if (integrationState.ok === true) {
        integrationState.status = "idle";
        integrationState.startable = true;
      } else {
        integrationState.status = "invalid";
        integrationState.startable = false;
      }

      const result = buildActionResult(integrationState, { reset: integrationState.ok === true });
      integrationState.lastResult = result;
      return result;
    }

    return {
      ok: integrationState.ok === true,
      initialize,
      start,
      tick,
      tickSteps,
      stop,
      reset,
      getState,
      getSummary,
      getBootPayload,
      getPlayerSnapshot,
      getWorldSnapshot,
      isInitialized() {
        return integrationState.initialized === true;
      },
      isStarted() {
        return integrationState.started === true;
      },
    };
  } catch (_error) {
    const invalidState = {
      ok: false,
      initialized: false,
      started: false,
      startable: false,
      status: "invalid",
      tick: 0,
      runtimeOk: false,
      lastAction: "create",
      lastResult: null,
    };

    function getPlayerSnapshot() {
      return buildPlayerSnapshot(null);
    }

    function getWorldSnapshot() {
      return buildWorldSnapshot(null);
    }

    function getState() {
      return cloneState(invalidState);
    }

    function getSummary() {
      return {
        ok: false,
        initialized: false,
        started: false,
        startable: false,
        status: "invalid",
        tick: 0,
        player: getPlayerSnapshot(),
        world: getWorldSnapshot(),
      };
    }

    function getBootPayload() {
      const world = getWorldSnapshot();
      const player = getPlayerSnapshot();

      return {
        ok: false,
        initialized: false,
        started: false,
        startable: false,
        status: "invalid",
        tick: 0,
        worldId: world.worldId,
        themeId: world.themeId,
        playerStatus: player.locomotion,
        playerX: player.x,
        playerY: player.y,
      };
    }

    function buildInvalidResult(extras = {}) {
      return {
        ok: false,
        initialized: false,
        started: false,
        startable: false,
        status: "invalid",
        tick: 0,
        ...extras,
      };
    }

    return {
      ok: false,
      initialize() {
        return buildInvalidResult({ initializedNow: false, alreadyInitialized: false });
      },
      start() {
        return buildInvalidResult({ startedNow: false, bootedNow: false });
      },
      tick() {
        return buildInvalidResult({ stepped: false });
      },
      tickSteps(n = 1) {
        const stepsRequested = Number.isInteger(n) && n > 0 ? n : 0;
        return buildInvalidResult({ stepsRequested, stepsRun: 0 });
      },
      stop() {
        return buildInvalidResult({ stopped: true });
      },
      reset() {
        return buildInvalidResult({ reset: false });
      },
      getState,
      getSummary,
      getBootPayload,
      getPlayerSnapshot,
      getWorldSnapshot,
      isInitialized() {
        return false;
      },
      isStarted() {
        return false;
      },
    };
  }
}
