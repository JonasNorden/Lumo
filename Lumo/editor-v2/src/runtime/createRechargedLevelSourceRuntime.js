import { createRechargedBootIntegration } from "./createRechargedBootIntegration.js";

// Restricts status output to known deterministic runtime states.
function normalizeStatus(status, fallback = "invalid") {
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

// Returns a compact world snapshot with zero/default fallback values.
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

// Returns a compact player snapshot with stable non-undefined fields.
function buildPlayerSnapshot(snapshot) {
  const source = snapshot && typeof snapshot === "object" ? snapshot : {};
  const pulse = source?.pulse && typeof source.pulse === "object" ? source.pulse : null;

  return {
    x: Number.isFinite(source.x) ? source.x : null,
    y: Number.isFinite(source.y) ? source.y : null,
    grounded: source.grounded === true,
    falling: source.falling === true,
    locomotion: typeof source.locomotion === "string" ? source.locomotion : "unknown",
    boostActive: source.boostActive === true,
    pulse: pulse
      ? {
          active: pulse.active === true,
          r: Number.isFinite(pulse?.r) ? pulse.r : 0,
          alpha: Number.isFinite(pulse?.alpha) ? pulse.alpha : 0,
          thickness: Number.isFinite(pulse?.thickness) ? pulse.thickness : 0,
          id: Number.isFinite(pulse?.id) ? pulse.id : 0,
          x: Number.isFinite(pulse?.x) ? pulse.x : (Number.isFinite(source.x) ? source.x : null),
          y: Number.isFinite(pulse?.y) ? pulse.y : (Number.isFinite(source.y) ? source.y : null),
        }
      : null,
    flares: Array.isArray(source.flares) ? source.flares.map((flare) => ({ ...flare })) : [],
    entities: Array.isArray(source.entities) ? source.entities.map((entity) => ({ ...entity })) : [],
  };
}

// Normalizes input source into one level document value without throwing.
function resolveLevelDocument(levelSource) {
  try {
    if (!levelSource || typeof levelSource !== "object") {
      return { sourceResolved: false, levelDocument: null };
    }

    if (
      Object.prototype.hasOwnProperty.call(levelSource, "levelDocument") ||
      Object.prototype.hasOwnProperty.call(levelSource, "document")
    ) {
      const nestedDocument =
        levelSource.levelDocument && typeof levelSource.levelDocument === "object"
          ? levelSource.levelDocument
          : levelSource.document && typeof levelSource.document === "object"
            ? levelSource.document
            : null;

      return {
        sourceResolved: nestedDocument !== null,
        levelDocument: nestedDocument,
      };
    }

    return {
      sourceResolved: true,
      levelDocument: levelSource,
    };
  } catch (_error) {
    return { sourceResolved: false, levelDocument: null };
  }
}

// Builds deterministic action payloads shared across lifecycle methods.
function buildActionResult(state, extras = {}) {
  return {
    ok: state.ok === true,
    sourceResolved: state.sourceResolved === true,
    initialized: state.initialized === true,
    started: state.started === true,
    startable: state.startable === true,
    status: normalizeStatus(state.status),
    tick: Number.isFinite(state.tick) ? state.tick : 0,
    ...extras,
  };
}

// Clones internal source runtime state to keep state reads stable and debuggable.
function cloneState(state) {
  const source = state && typeof state === "object" ? state : {};

  return {
    ok: source.ok === true,
    sourceResolved: source.sourceResolved === true,
    initialized: source.initialized === true,
    started: source.started === true,
    startable: source.startable === true,
    status: normalizeStatus(source.status),
    tick: Number.isFinite(source.tick) ? source.tick : 0,
    integrationOk: source.integrationOk === true,
    lastAction: typeof source.lastAction === "string" && source.lastAction.length > 0 ? source.lastAction : "none",
    lastResult: source.lastResult && typeof source.lastResult === "object" ? { ...source.lastResult } : null,
  };
}

// Creates a Recharged runtime that boots from a normalized level-source shape.
export function createRechargedLevelSourceRuntime(options = {}) {
  try {
    const resolution = resolveLevelDocument(options?.levelSource);
    const integration = createRechargedBootIntegration({ levelDocument: resolution.levelDocument });

    const state = {
      ok: resolution.sourceResolved === true && integration?.ok === true,
      sourceResolved: resolution.sourceResolved === true,
      initialized: false,
      started: false,
      startable: resolution.sourceResolved === true && integration?.ok === true,
      status: resolution.sourceResolved === true && integration?.ok === true ? "idle" : "invalid",
      tick: 0,
      integrationOk: integration?.ok === true,
      lastAction: "create",
      lastResult: null,
    };

    // Synchronizes source runtime state from the delegated boot integration.
    function syncFromIntegration() {
      try {
        const integrationState = integration?.getState?.();
        const integrationOk = integrationState?.ok === true;

        state.integrationOk = integrationOk;
        state.ok = state.sourceResolved === true && integrationOk;
        state.startable = state.sourceResolved === true && integrationOk && integrationState?.startable === true;
        state.initialized = integrationState?.initialized === true;
        state.started = integrationState?.started === true;
        state.tick = Number.isFinite(integrationState?.tick) ? integrationState.tick : 0;

        if (state.ok !== true) {
          state.status = "invalid";
          state.started = false;
          return;
        }

        state.status = normalizeStatus(integrationState?.status, state.started ? "running" : state.initialized ? "initialized" : "idle");
      } catch (_error) {
        state.ok = false;
        state.startable = false;
        state.integrationOk = false;
        state.initialized = false;
        state.started = false;
        state.status = "invalid";
      }
    }

    // Delegates to integration and keeps source-runtime state synchronized safely.
    function runAction(action, invoke, failureExtras = {}) {
      state.lastAction = action;

      try {
        const result = invoke();
        syncFromIntegration();

        const safeResult = buildActionResult(state, {
          delegated: result && typeof result === "object" ? { ...result } : null,
        });

        state.lastResult = safeResult;
        return safeResult;
      } catch (_error) {
        state.ok = false;
        state.startable = false;
        state.integrationOk = false;
        state.initialized = false;
        state.started = false;
        state.status = "invalid";

        const failedResult = buildActionResult(state, { delegated: null, ...failureExtras });
        state.lastResult = failedResult;
        return failedResult;
      }
    }

    // Returns compact player state from integration.
    function getPlayerSnapshot() {
      try {
        return buildPlayerSnapshot(integration?.getPlayerSnapshot?.());
      } catch (_error) {
        return buildPlayerSnapshot(null);
      }
    }

    // Returns compact world state from integration.
    function getWorldSnapshot() {
      try {
        return buildWorldSnapshot(integration?.getWorldSnapshot?.());
      } catch (_error) {
        return buildWorldSnapshot(null);
      }
    }

    // Returns full source-runtime state for deterministic debugging.
    function getState() {
      syncFromIntegration();
      return cloneState(state);
    }

    // Returns compact runtime-facing summary.
    function getSummary() {
      syncFromIntegration();
      const player = getPlayerSnapshot();
      const world = getWorldSnapshot();

      return {
        ok: state.ok === true,
        sourceResolved: state.sourceResolved === true,
        initialized: state.initialized === true,
        started: state.started === true,
        startable: state.startable === true,
        status: normalizeStatus(state.status),
        tick: Number.isFinite(state.tick) ? state.tick : 0,
        player,
        world,
      };
    }

    // Returns compact source-facing level metadata summary.
    function getSourceSummary() {
      syncFromIntegration();
      const world = getWorldSnapshot();

      return {
        ok: state.ok === true,
        sourceResolved: state.sourceResolved === true,
        status: normalizeStatus(state.status),
        worldId: world.worldId,
        themeId: world.themeId,
        width: world.width,
        height: world.height,
        tileSize: world.tileSize,
      };
    }

    // Returns compact boot payload adapted from integration and current snapshots.
    function getBootPayload() {
      syncFromIntegration();
      const world = getWorldSnapshot();
      const player = getPlayerSnapshot();

      return {
        ok: state.ok === true,
        initialized: state.initialized === true,
        started: state.started === true,
        startable: state.startable === true,
        status: normalizeStatus(state.status),
        tick: Number.isFinite(state.tick) ? state.tick : 0,
        worldId: world.worldId,
        themeId: world.themeId,
        playerStatus: player.locomotion,
        playerX: player.x,
        playerY: player.y,
      };
    }

    return {
      ok: state.ok === true,
      initialize() {
        return runAction("initialize", () => integration?.initialize?.(), { initializedNow: false, alreadyInitialized: false });
      },
      start() {
        return runAction("start", () => integration?.start?.(), { startedNow: false, bootedNow: false });
      },
      tick(inputIntent = {}) {
        return runAction("tick", () => integration?.tick?.(inputIntent), { stepped: false });
      },
      tickSteps(n = 1) {
        const stepsRequested = Number.isInteger(n) && n > 0 ? n : 0;
        return runAction("tickSteps", () => integration?.tickSteps?.(stepsRequested), { stepsRequested, stepsRun: 0 });
      },
      stop() {
        return runAction("stop", () => integration?.stop?.(), { stopped: true });
      },
      reset() {
        return runAction("reset", () => integration?.reset?.(), { reset: false });
      },
      getState,
      getSummary,
      getSourceSummary,
      getBootPayload,
      getPlayerSnapshot,
      getWorldSnapshot,
      isInitialized() {
        syncFromIntegration();
        return state.initialized === true;
      },
      isStarted() {
        syncFromIntegration();
        return state.started === true;
      },
    };
  } catch (_error) {
    const invalidState = {
      ok: false,
      sourceResolved: false,
      initialized: false,
      started: false,
      startable: false,
      status: "invalid",
      tick: 0,
      integrationOk: false,
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
        sourceResolved: false,
        initialized: false,
        started: false,
        startable: false,
        status: "invalid",
        tick: 0,
        player: getPlayerSnapshot(),
        world: getWorldSnapshot(),
      };
    }

    function getSourceSummary() {
      const world = getWorldSnapshot();

      return {
        ok: false,
        sourceResolved: false,
        status: "invalid",
        worldId: world.worldId,
        themeId: world.themeId,
        width: world.width,
        height: world.height,
        tileSize: world.tileSize,
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
        sourceResolved: false,
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
      getSourceSummary,
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
