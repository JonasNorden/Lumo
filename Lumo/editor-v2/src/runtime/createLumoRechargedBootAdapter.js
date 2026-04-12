import { createRechargedRuntimeOrchestrator } from "./createRechargedRuntimeOrchestrator.js";

// Keeps adapter status values deterministic for Lumo.html-facing integration.
function normalizeStatus(status, fallback = "invalid") {
  if (status === "idle" || status === "prepared" || status === "booted" || status === "running" || status === "stopped" || status === "invalid") {
    return status;
  }

  return fallback;
}

// Returns a compact player snapshot with stable primitive defaults.
function buildPlayerSnapshot(snapshot) {
  const source = snapshot && typeof snapshot === "object" ? snapshot : {};
  const pulse = source?.pulse && typeof source.pulse === "object" ? source.pulse : null;
  const velocityX = Number.isFinite(source?.velocity?.x) ? source.velocity.x : null;
  const velocityY = Number.isFinite(source?.velocity?.y) ? source.velocity.y : null;

  return {
    x: Number.isFinite(source.x) ? source.x : null,
    y: Number.isFinite(source.y) ? source.y : null,
    velocity: {
      x: velocityX,
      y: velocityY,
    },
    grounded: source.grounded === true,
    falling: source.falling === true,
    locomotion: typeof source.locomotion === "string" ? source.locomotion : "unknown",
    energy: Number.isFinite(source.energy) ? source.energy : null,
    lives: Number.isFinite(source.lives) ? source.lives : null,
    score: Number.isFinite(source.score) ? source.score : null,
    boostActive: source.boostActive === true,
    flareStash: Number.isFinite(source.flareStash) ? source.flareStash : 1,
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

// Returns a compact world snapshot with stable primitive defaults.
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

// Clones state for deterministic debugging and test assertions.
function cloneState(state) {
  return {
    ok: state.ok === true,
    prepared: state.prepared === true,
    booted: state.booted === true,
    bootable: state.bootable === true,
    status: normalizeStatus(state.status),
    tick: Number.isFinite(state.tick) ? state.tick : 0,
    orchestratorOk: state.orchestratorOk === true,
    lastAction: typeof state.lastAction === "string" ? state.lastAction : "none",
    lastResult: state.lastResult && typeof state.lastResult === "object" ? { ...state.lastResult } : null,
    loadMode: typeof state.loadMode === "string" ? state.loadMode : "unknown",
  };
}

// Performs a minimal descriptor validation so invalid sources fail immediately.
function isViableSourceDescriptor(sourceDescriptor) {
  try {
    if (!sourceDescriptor || typeof sourceDescriptor !== "object") {
      return false;
    }

    if (typeof sourceDescriptor.url === "string" && sourceDescriptor.url.length > 0) {
      return true;
    }

    if (typeof sourceDescriptor.path === "string" && sourceDescriptor.path.length > 0) {
      return true;
    }

    if (sourceDescriptor.levelDocument && typeof sourceDescriptor.levelDocument === "object") {
      return true;
    }

    if (sourceDescriptor.document && typeof sourceDescriptor.document === "object") {
      return true;
    }

    return true;
  } catch (_error) {
    return false;
  }
}

// Creates the first controlled Lumo.html-facing handoff adapter on top of the orchestrator.
export function createLumoRechargedBootAdapter(options = {}) {
  try {
    const sourceViable = isViableSourceDescriptor(options?.sourceDescriptor);
    const orchestrator = createRechargedRuntimeOrchestrator({
      sourceDescriptor: options?.sourceDescriptor,
      loadLevelDocument: options?.loadLevelDocument,
    });

    const state = {
      ok: orchestrator?.ok === true && sourceViable,
      prepared: false,
      booted: false,
      bootable: false,
      status: orchestrator?.ok === true && sourceViable ? "idle" : "invalid",
      tick: 0,
      orchestratorOk: orchestrator?.ok === true,
      lastAction: "create",
      lastResult: null,
      loadMode: "unknown",
    };

    // Pulls orchestrator state up into adapter state without throwing.
    function syncFromOrchestrator() {
      try {
        const orchestratorState = orchestrator?.getState?.() || {};

        state.orchestratorOk = orchestratorState.ok === true;
        state.ok = sourceViable && orchestrator?.ok === true;
        state.prepared = orchestratorState.prepared === true;
        state.booted = orchestratorState.started === true;
        state.bootable = state.prepared === true && state.ok === true;
        state.tick = Number.isFinite(orchestratorState.tick) ? orchestratorState.tick : state.tick;
        state.loadMode = typeof orchestratorState.loadMode === "string" ? orchestratorState.loadMode : state.loadMode;

        if (sourceViable !== true || (orchestratorState.status === "invalid" && orchestratorState.sourceResolved === true)) {
          state.ok = false;
          state.prepared = false;
          state.booted = false;
          state.bootable = false;
          state.status = "invalid";
          return;
        }

        if (state.booted === true) {
          state.status = "running";
          return;
        }

        if (state.prepared === true) {
          state.status = "prepared";
          return;
        }

        state.status = state.status === "stopped" ? "stopped" : "idle";
      } catch (_error) {
        state.ok = false;
        state.prepared = false;
        state.booted = false;
        state.bootable = false;
        state.status = "invalid";
        state.orchestratorOk = false;
      }
    }

    // Produces one compact structured result used by all actions.
    function buildActionResult(extras = {}) {
      const result = {
        ok: state.ok === true,
        prepared: state.prepared === true,
        booted: state.booted === true,
        bootable: state.bootable === true,
        status: normalizeStatus(state.status),
        tick: Number.isFinite(state.tick) ? state.tick : 0,
        loadMode: state.loadMode,
        ...extras,
      };

      state.lastResult = result;
      return result;
    }

    // Runs safe adapter preparation and marks this adapter as bootable.
    async function prepare() {
      state.lastAction = "prepare";
      syncFromOrchestrator();

      if (state.status === "invalid") {
        return buildActionResult({ preparedNow: false, reason: "invalid-state" });
      }

      let prepareResult = null;
      try {
        prepareResult = await orchestrator.prepare();
      } catch (_error) {
        prepareResult = null;
      }

      syncFromOrchestrator();

      if (prepareResult?.ok === true && state.ok === true) {
        state.prepared = true;
        state.bootable = true;
        if (state.booted !== true) {
          state.status = "prepared";
        }

        return buildActionResult({ preparedNow: true });
      }

      state.prepared = false;
      state.bootable = false;
      state.booted = false;
      state.status = "invalid";
      return buildActionResult({ preparedNow: false, reason: "prepare-failed" });
    }

    // Boots the runtime through orchestrator.start with prepare-first safety.
    async function boot() {
      state.lastAction = "boot";
      syncFromOrchestrator();

      if (state.status === "invalid") {
        return buildActionResult({ bootedNow: false, reason: "invalid-state" });
      }

      if (state.prepared !== true) {
        const prepareResult = await prepare();
        if (prepareResult.ok !== true) {
          return buildActionResult({ bootedNow: false, reason: "prepare-failed" });
        }
      }

      let startResult = null;
      try {
        startResult = await orchestrator.start();
      } catch (_error) {
        startResult = null;
      }

      syncFromOrchestrator();

      if (startResult?.ok === true && state.ok === true) {
        state.booted = true;
        state.status = "booted";
        return buildActionResult({ bootedNow: true });
      }

      state.booted = false;
      state.status = state.ok === true ? "prepared" : "invalid";
      return buildActionResult({ bootedNow: false, reason: "start-failed" });
    }

    // Runs one safe tick through the orchestrator once booted.
    function tick(inputIntent = {}) {
      state.lastAction = "tick";
      syncFromOrchestrator();

      if (state.booted !== true) {
        return buildActionResult({ stepped: false, reason: "not-booted" });
      }

      let tickResult = null;
      try {
        tickResult = orchestrator.tick(inputIntent);
      } catch (_error) {
        tickResult = null;
      }

      syncFromOrchestrator();

      if (tickResult?.ok === true && state.ok === true) {
        state.status = "running";
        return buildActionResult({ stepped: true });
      }

      return buildActionResult({ stepped: false, reason: "tick-failed" });
    }

    // Runs multiple safe ticks while keeping adapter state synchronized.
    function tickSteps(n = 1) {
      state.lastAction = "tickSteps";
      syncFromOrchestrator();

      const stepsRequested = Number.isInteger(n) && n > 0 ? n : 0;
      if (state.booted !== true || stepsRequested === 0) {
        return buildActionResult({ stepsRequested, stepsRun: 0 });
      }

      let result = null;
      try {
        result = orchestrator.tickSteps(stepsRequested);
      } catch (_error) {
        result = null;
      }

      syncFromOrchestrator();

      if (result?.ok === true && state.ok === true) {
        state.status = "running";
        return buildActionResult({ stepsRequested, stepsRun: Number.isFinite(result.stepsRun) ? result.stepsRun : stepsRequested });
      }

      return buildActionResult({ stepsRequested, stepsRun: 0, reason: "tick-steps-failed" });
    }

    // Stops booted runtime safely and keeps adapter in a stopped state.
    function stop() {
      state.lastAction = "stop";
      syncFromOrchestrator();

      let stopResult = null;
      try {
        stopResult = orchestrator.stop();
      } catch (_error) {
        stopResult = null;
      }

      syncFromOrchestrator();
      state.booted = false;

      if (state.status !== "invalid") {
        state.status = "stopped";
      }

      if (stopResult?.ok === true || state.status === "stopped") {
        return buildActionResult({ stopped: true });
      }

      return buildActionResult({ stopped: false });
    }

    // Resets runtime and adapter state back to initial boot lifecycle values.
    function reset() {
      state.lastAction = "reset";

      try {
        orchestrator.reset();
      } catch (_error) {
        // Swallow errors to maintain never-throw contract.
      }

      syncFromOrchestrator();
      state.prepared = false;
      state.booted = false;
      state.bootable = false;
      state.tick = 0;
      state.loadMode = typeof state.loadMode === "string" ? state.loadMode : "unknown";

      if (state.status !== "invalid") {
        state.status = "idle";
      }

      return buildActionResult({ reset: true });
    }

    // Returns stable compact player state for handoff payloads.
    function getPlayerSnapshot() {
      try {
        return buildPlayerSnapshot(orchestrator?.getPlayerSnapshot?.());
      } catch (_error) {
        return buildPlayerSnapshot(null);
      }
    }

    // Returns stable compact world state for handoff payloads.
    function getWorldSnapshot() {
      try {
        return buildWorldSnapshot(orchestrator?.getWorldSnapshot?.());
      } catch (_error) {
        return buildWorldSnapshot(null);
      }
    }

    // Returns full adapter state for deterministic debugging.
    function getState() {
      syncFromOrchestrator();
      return cloneState(state);
    }

    // Returns compact adapter summary for first Lumo.html integration.
    function getSummary() {
      syncFromOrchestrator();
      const player = getPlayerSnapshot();
      const world = getWorldSnapshot();

      return {
        ok: state.ok === true,
        prepared: state.prepared === true,
        booted: state.booted === true,
        bootable: state.bootable === true,
        status: normalizeStatus(state.status),
        tick: Number.isFinite(state.tick) ? state.tick : 0,
        loadMode: state.loadMode,
        player,
        world,
      };
    }

    // Returns extra compact Lumo.html-facing boot status.
    function getBootStatus() {
      syncFromOrchestrator();
      const player = getPlayerSnapshot();
      const world = getWorldSnapshot();

      return {
        ok: state.ok === true,
        prepared: state.prepared === true,
        booted: state.booted === true,
        bootable: state.bootable === true,
        status: normalizeStatus(state.status),
        tick: Number.isFinite(state.tick) ? state.tick : 0,
        loadMode: state.loadMode,
        worldId: world.worldId,
        themeId: world.themeId,
        playerStatus: player.locomotion,
      };
    }

    // Returns compact boot payload for runtime handoff insertion into Lumo.html.
    function getBootPayload() {
      syncFromOrchestrator();
      const player = getPlayerSnapshot();
      const world = getWorldSnapshot();

      return {
        ok: state.ok === true,
        prepared: state.prepared === true,
        booted: state.booted === true,
        bootable: state.bootable === true,
        status: normalizeStatus(state.status),
        tick: Number.isFinite(state.tick) ? state.tick : 0,
        loadMode: state.loadMode,
        worldId: world.worldId,
        themeId: world.themeId,
        worldWidth: world.width,
        worldHeight: world.height,
        tileSize: world.tileSize,
        supportTiles: world.supportTiles,
        playerStatus: player.locomotion,
        playerX: player.x,
        playerY: player.y,
      };
    }

    return {
      ok: state.ok === true,
      prepare,
      boot,
      tick,
      tickSteps,
      stop,
      reset,
      getState,
      getSummary,
      getBootStatus,
      getBootPayload,
      getPlayerSnapshot,
      getWorldSnapshot,
      isPrepared() {
        syncFromOrchestrator();
        return state.prepared === true;
      },
      isBooted() {
        syncFromOrchestrator();
        return state.booted === true;
      },
    };
  } catch (_error) {
    const invalidState = {
      ok: false,
      prepared: false,
      booted: false,
      bootable: false,
      status: "invalid",
      tick: 0,
      loadMode: "unknown",
    };

    function buildResult(extras = {}) {
      return { ...invalidState, ...extras };
    }

    function getPlayerSnapshot() {
      return buildPlayerSnapshot(null);
    }

    function getWorldSnapshot() {
      return buildWorldSnapshot(null);
    }

    return {
      ok: false,
      async prepare() {
        return buildResult({ preparedNow: false });
      },
      async boot() {
        return buildResult({ bootedNow: false });
      },
      tick() {
        return buildResult({ stepped: false });
      },
      tickSteps(n = 1) {
        const stepsRequested = Number.isInteger(n) && n > 0 ? n : 0;
        return buildResult({ stepsRequested, stepsRun: 0 });
      },
      stop() {
        return buildResult({ stopped: false });
      },
      reset() {
        return buildResult({ reset: false });
      },
      getState() {
        return {
          ...invalidState,
          orchestratorOk: false,
          lastAction: "none",
          lastResult: null,
        };
      },
      getSummary() {
        return {
          ...invalidState,
          player: getPlayerSnapshot(),
          world: getWorldSnapshot(),
        };
      },
      getBootStatus() {
        const world = getWorldSnapshot();
        const player = getPlayerSnapshot();

        return {
          ...invalidState,
          worldId: world.worldId,
          themeId: world.themeId,
          playerStatus: player.locomotion,
        };
      },
      getBootPayload() {
        const world = getWorldSnapshot();
        const player = getPlayerSnapshot();

        return {
          ...invalidState,
          worldId: world.worldId,
          themeId: world.themeId,
          worldWidth: world.width,
          worldHeight: world.height,
          tileSize: world.tileSize,
          supportTiles: world.supportTiles,
          playerStatus: player.locomotion,
          playerX: player.x,
          playerY: player.y,
        };
      },
      getPlayerSnapshot,
      getWorldSnapshot,
      isPrepared() {
        return false;
      },
      isBooted() {
        return false;
      },
    };
  }
}
