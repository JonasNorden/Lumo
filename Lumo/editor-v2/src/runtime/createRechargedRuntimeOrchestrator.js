import { createRechargedLevelSourceRuntime } from "./createRechargedLevelSourceRuntime.js";

// Restricts orchestrator status values to deterministic known strings.
function normalizeStatus(status, fallback = "invalid") {
  if (status === "idle" || status === "prepared" || status === "running" || status === "stopped" || status === "invalid") {
    return status;
  }

  return fallback;
}

// Builds a compact world snapshot with non-undefined values.
function buildWorldSnapshot(snapshot) {
  const source = snapshot && typeof snapshot === "object" ? snapshot : {};
  const supportTiles = Array.isArray(source.supportTiles)
    ? source.supportTiles
      .map((tile) => ({
        tileId: tile?.tileId ?? null,
        x: Number.isFinite(tile?.x) ? tile.x : null,
        y: Number.isFinite(tile?.y) ? tile.y : null,
        w: Number.isFinite(tile?.w) ? tile.w : null,
        h: Number.isFinite(tile?.h) ? tile.h : null,
        catalogTileId: typeof tile?.catalogTileId === "string" ? tile.catalogTileId : null,
        img: typeof tile?.img === "string" ? tile.img : null,
        drawW: Number.isFinite(tile?.drawW) ? tile.drawW : null,
        drawH: Number.isFinite(tile?.drawH) ? tile.drawH : null,
        drawOffX: Number.isFinite(tile?.drawOffX) ? tile.drawOffX : null,
        drawOffY: Number.isFinite(tile?.drawOffY) ? tile.drawOffY : null,
        drawAnchor: typeof tile?.drawAnchor === "string" ? tile.drawAnchor : null,
      }))
      .filter((tile) => tile.x !== null && tile.y !== null && tile.w !== null && tile.h !== null && tile.w > 0 && tile.h > 0)
    : [];
  const decorItems = Array.isArray(source.decorItems)
    ? source.decorItems
      .map((decor, index) => ({
        decorId: typeof decor?.decorId === "string" ? decor.decorId : `decor-${index + 1}`,
        decorType: typeof decor?.decorType === "string" ? decor.decorType : "decor",
        x: Number.isFinite(decor?.x) ? decor.x : null,
        y: Number.isFinite(decor?.y) ? decor.y : null,
        order: Number.isFinite(decor?.order) ? decor.order : index,
        flipX: decor?.flipX === true,
        variant: Number.isFinite(decor?.variant) || typeof decor?.variant === "string" ? decor.variant : null,
        img: typeof decor?.img === "string" ? decor.img : null,
        drawW: Number.isFinite(decor?.drawW) ? decor.drawW : null,
        drawH: Number.isFinite(decor?.drawH) ? decor.drawH : null,
        drawOffX: Number.isFinite(decor?.drawOffX) ? decor.drawOffX : 0,
        drawOffY: Number.isFinite(decor?.drawOffY) ? decor.drawOffY : 0,
        drawAnchor: typeof decor?.drawAnchor === "string" ? decor.drawAnchor : "BL",
      }))
      .filter((decor) => decor.x !== null && decor.y !== null)
      .sort((left, right) => (left.order - right.order) || left.decorId.localeCompare(right.decorId))
    : [];

  // Carry runtime background payloads through unchanged.
  const background = Array.isArray(source.background)
    ? source.background.map((entry) => (entry && typeof entry === "object" ? { ...entry } : entry))
    : [];
  const bg = Array.isArray(source.bg)
    ? source.bg.map((entry) => (entry && typeof entry === "object" ? { ...entry } : entry))
    : [];

  return {
    worldId: typeof source.worldId === "string" ? source.worldId : "",
    themeId: typeof source.themeId === "string" ? source.themeId : "",
    width: Number.isFinite(source.width) ? source.width : 0,
    height: Number.isFinite(source.height) ? source.height : 0,
    tileSize: Number.isFinite(source.tileSize) ? source.tileSize : 0,
    background,
    bg,
    supportTiles,
    decorItems,
  };
}

// Builds a compact player snapshot with non-undefined values.
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
    rising: source.rising === true,
    facingX: Number.isFinite(source.facingX) ? source.facingX : null,
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

// Clones state into a stable debug-friendly snapshot.
function cloneState(state) {
  return {
    ok: state.ok === true,
    sourceResolved: state.sourceResolved === true,
    prepared: state.prepared === true,
    started: state.started === true,
    startable: state.startable === true,
    status: normalizeStatus(state.status),
    tick: Number.isFinite(state.tick) ? state.tick : 0,
    runtimeOk: state.runtimeOk === true,
    lastAction: typeof state.lastAction === "string" && state.lastAction.length > 0 ? state.lastAction : "none",
    lastResult: state.lastResult && typeof state.lastResult === "object" ? { ...state.lastResult } : null,
    loadMode: typeof state.loadMode === "string" ? state.loadMode : "unknown",
  };
}

// Returns direct level document source, or loader-required descriptor metadata.
function resolveSourceDescriptor(sourceDescriptor) {
  try {
    if (!sourceDescriptor || typeof sourceDescriptor !== "object") {
      return { sourceResolved: false, requiresLoader: false, loadMode: "unknown", levelDocument: null, descriptor: null };
    }

    if (Object.prototype.hasOwnProperty.call(sourceDescriptor, "levelDocument")) {
      const levelDocument = sourceDescriptor.levelDocument && typeof sourceDescriptor.levelDocument === "object" ? sourceDescriptor.levelDocument : null;
      return {
        sourceResolved: levelDocument !== null,
        requiresLoader: false,
        loadMode: "levelDocument",
        levelDocument,
        descriptor: sourceDescriptor,
      };
    }

    if (Object.prototype.hasOwnProperty.call(sourceDescriptor, "document")) {
      const levelDocument = sourceDescriptor.document && typeof sourceDescriptor.document === "object" ? sourceDescriptor.document : null;
      return {
        sourceResolved: levelDocument !== null,
        requiresLoader: false,
        loadMode: "document",
        levelDocument,
        descriptor: sourceDescriptor,
      };
    }

    if (typeof sourceDescriptor.url === "string" && sourceDescriptor.url.length > 0) {
      return {
        sourceResolved: true,
        requiresLoader: true,
        loadMode: "url",
        levelDocument: null,
        descriptor: sourceDescriptor,
      };
    }

    if (typeof sourceDescriptor.path === "string" && sourceDescriptor.path.length > 0) {
      return {
        sourceResolved: true,
        requiresLoader: true,
        loadMode: "path",
        levelDocument: null,
        descriptor: sourceDescriptor,
      };
    }

    return {
      sourceResolved: true,
      requiresLoader: false,
      loadMode: "direct",
      levelDocument: sourceDescriptor,
      descriptor: sourceDescriptor,
    };
  } catch (_error) {
    return { sourceResolved: false, requiresLoader: false, loadMode: "unknown", levelDocument: null, descriptor: null };
  }
}

// Extracts one level document object from loader output without throwing.
function resolveLoadedDocument(result) {
  try {
    if (!result || typeof result !== "object") {
      return null;
    }

    if (Object.prototype.hasOwnProperty.call(result, "levelDocument")) {
      return result.levelDocument && typeof result.levelDocument === "object" ? result.levelDocument : null;
    }

    return result;
  } catch (_error) {
    return null;
  }
}

// Creates a real async load-to-runtime orchestration layer for future Lumo.html boot handoff.
export function createRechargedRuntimeOrchestrator(options = {}) {
  try {
    const sourceDescriptor = options?.sourceDescriptor;
    const loadLevelDocument = typeof options?.loadLevelDocument === "function" ? options.loadLevelDocument : null;

    const state = {
      ok: false,
      sourceResolved: false,
      prepared: false,
      started: false,
      startable: false,
      status: "idle",
      tick: 0,
      runtimeOk: false,
      lastAction: "create",
      lastResult: null,
      loadMode: "unknown",
    };

    let runtime = null;

    // Pulls runtime state up into orchestrator state after delegated actions.
    function syncFromRuntime() {
      try {
        const runtimeState = runtime?.getState?.();

        state.runtimeOk = runtimeState?.ok === true;
        state.ok = state.sourceResolved === true && state.runtimeOk;
        state.startable = state.prepared === true && state.ok === true;
        state.started = runtimeState?.started === true && state.prepared === true;
        state.tick = Number.isFinite(runtimeState?.tick) ? runtimeState.tick : state.tick;

        if (state.ok !== true) {
          state.status = "invalid";
          state.started = false;
          return;
        }

        if (state.started === true) {
          state.status = "running";
          return;
        }

        if (state.prepared === true) {
          state.status = "prepared";
          return;
        }

        state.status = "idle";
      } catch (_error) {
        state.ok = false;
        state.runtimeOk = false;
        state.startable = false;
        state.prepared = false;
        state.started = false;
        state.status = "invalid";
      }
    }

    // Marks state as invalid with a stable structured action result.
    function fail(action, extras = {}) {
      state.ok = false;
      state.prepared = false;
      state.started = false;
      state.startable = false;
      state.runtimeOk = false;
      state.status = "invalid";
      state.lastAction = action;

      const result = {
        ok: false,
        sourceResolved: state.sourceResolved === true,
        prepared: false,
        started: false,
        startable: false,
        status: "invalid",
        tick: Number.isFinite(state.tick) ? state.tick : 0,
        loadMode: state.loadMode,
        ...extras,
      };

      state.lastResult = result;
      return result;
    }

    // Returns one stable action payload for all orchestration lifecycle methods.
    function buildActionResult(extras = {}) {
      const result = {
        ok: state.ok === true,
        sourceResolved: state.sourceResolved === true,
        prepared: state.prepared === true,
        started: state.started === true,
        startable: state.startable === true,
        status: normalizeStatus(state.status),
        tick: Number.isFinite(state.tick) ? state.tick : 0,
        loadMode: state.loadMode,
        ...extras,
      };

      state.lastResult = result;
      return result;
    }

    // Safely resolves and prepares a level source runtime, optionally via async loader.
    async function prepare() {
      state.lastAction = "prepare";

      if (state.prepared === true && runtime) {
        syncFromRuntime();
        return buildActionResult({ preparedNow: false, alreadyPrepared: true });
      }

      const sourceResolution = resolveSourceDescriptor(sourceDescriptor);
      state.sourceResolved = sourceResolution.sourceResolved === true;
      state.loadMode = sourceResolution.loadMode;

      if (sourceResolution.sourceResolved !== true) {
        return fail("prepare", { preparedNow: false, reason: "source-unresolved" });
      }

      let levelDocument = sourceResolution.levelDocument;

      if (sourceResolution.requiresLoader === true) {
        if (!loadLevelDocument) {
          return fail("prepare", { preparedNow: false, reason: "loader-required" });
        }

        try {
          const loaded = await loadLevelDocument(sourceResolution.descriptor);
          levelDocument = resolveLoadedDocument(loaded);
        } catch (_error) {
          return fail("prepare", { preparedNow: false, reason: "loader-failed" });
        }
      }

      if (!levelDocument || typeof levelDocument !== "object") {
        return fail("prepare", { preparedNow: false, reason: "document-invalid" });
      }

      try {
        runtime = createRechargedLevelSourceRuntime({ levelSource: { levelDocument } });
      } catch (_error) {
        runtime = null;
      }

      state.runtimeOk = runtime?.ok === true;
      state.ok = state.sourceResolved === true && state.runtimeOk;
      state.prepared = state.ok === true;
      state.started = false;
      state.startable = state.prepared === true;
      state.status = state.prepared === true ? "prepared" : "invalid";
      state.tick = 0;

      if (state.prepared !== true) {
        return fail("prepare", { preparedNow: false, reason: "runtime-invalid" });
      }

      return buildActionResult({ preparedNow: true, alreadyPrepared: false });
    }

    // Starts the prepared runtime, preparing first when needed.
    async function start() {
      state.lastAction = "start";

      if (state.status === "invalid") {
        return buildActionResult({ startedNow: false, reason: "invalid-state" });
      }

      if (state.prepared !== true) {
        const prepareResult = await prepare();
        if (prepareResult.ok !== true) {
          return buildActionResult({ startedNow: false, reason: "prepare-failed" });
        }
      }

      try {
        runtime?.start?.();
        syncFromRuntime();
      } catch (_error) {
        return fail("start", { startedNow: false, reason: "start-failed" });
      }

      if (state.ok !== true) {
        return buildActionResult({ startedNow: false, reason: "runtime-invalid" });
      }

      state.started = true;
      state.status = "running";
      return buildActionResult({ startedNow: true });
    }

    // Runs one safe runtime tick while synchronizing orchestrator state.
    function tick(inputIntent = {}) {
      state.lastAction = "tick";

      if (state.started !== true || !runtime) {
        return buildActionResult({ stepped: false });
      }

      try {
        runtime.tick(inputIntent);
        syncFromRuntime();
      } catch (_error) {
        return fail("tick", { stepped: false, reason: "tick-failed" });
      }

      return buildActionResult({ stepped: true });
    }

    // Runs multiple safe runtime ticks while synchronizing orchestrator state.
    function tickSteps(n = 1) {
      state.lastAction = "tickSteps";

      const stepsRequested = Number.isInteger(n) && n > 0 ? n : 0;
      if (state.started !== true || !runtime || stepsRequested === 0) {
        return buildActionResult({ stepsRequested, stepsRun: 0 });
      }

      try {
        runtime.tickSteps(stepsRequested);
        syncFromRuntime();
      } catch (_error) {
        return fail("tickSteps", { stepsRequested, stepsRun: 0, reason: "tick-steps-failed" });
      }

      return buildActionResult({ stepsRequested, stepsRun: stepsRequested });
    }

    // Stops runtime orchestration without discarding prepared source state.
    function stop() {
      state.lastAction = "stop";

      try {
        runtime?.stop?.();
        syncFromRuntime();
      } catch (_error) {
        return fail("stop", { stopped: false, reason: "stop-failed" });
      }

      state.started = false;
      if (state.status !== "invalid") {
        state.status = "stopped";
      }

      return buildActionResult({ stopped: true });
    }

    // Resets runtime and orchestration lifecycle while preserving source descriptor.
    function reset() {
      state.lastAction = "reset";

      try {
        runtime?.reset?.();
      } catch (_error) {
        return fail("reset", { reset: false, reason: "reset-failed" });
      }

      runtime = null;
      state.runtimeOk = false;
      state.ok = state.sourceResolved === true;
      state.prepared = false;
      state.started = false;
      state.startable = false;
      state.tick = 0;
      if (state.status !== "invalid") {
        state.status = "idle";
      }

      return buildActionResult({ reset: true });
    }

    // Returns compact player state from delegated runtime.
    function getPlayerSnapshot() {
      try {
        return buildPlayerSnapshot(runtime?.getPlayerSnapshot?.());
      } catch (_error) {
        return buildPlayerSnapshot(null);
      }
    }

    // Returns compact world state from delegated runtime.
    function getWorldSnapshot() {
      try {
        return buildWorldSnapshot(runtime?.getWorldSnapshot?.());
      } catch (_error) {
        return buildWorldSnapshot(null);
      }
    }

    // Returns full deterministic orchestration state for debug flows.
    function getState() {
      syncFromRuntime();
      return cloneState(state);
    }

    // Returns compact runtime summary for external orchestration consumers.
    function getSummary() {
      syncFromRuntime();
      const player = getPlayerSnapshot();
      const world = getWorldSnapshot();

      return {
        ok: state.ok === true,
        sourceResolved: state.sourceResolved === true,
        prepared: state.prepared === true,
        started: state.started === true,
        startable: state.startable === true,
        status: normalizeStatus(state.status),
        tick: Number.isFinite(state.tick) ? state.tick : 0,
        loadMode: state.loadMode,
        player,
        world,
      };
    }

    // Returns compact load-focused summary for future async boot handoff.
    function getLoadSummary() {
      syncFromRuntime();
      const world = getWorldSnapshot();

      return {
        ok: state.ok === true,
        sourceResolved: state.sourceResolved === true,
        prepared: state.prepared === true,
        status: normalizeStatus(state.status),
        loadMode: state.loadMode,
        worldId: world.worldId,
        themeId: world.themeId,
        width: world.width,
        height: world.height,
        tileSize: world.tileSize,
      };
    }

    // Returns compact boot payload for runtime handoff layers.
    function getBootPayload() {
      syncFromRuntime();
      const world = getWorldSnapshot();
      const player = getPlayerSnapshot();

      return {
        ok: state.ok === true,
        prepared: state.prepared === true,
        started: state.started === true,
        startable: state.startable === true,
        status: normalizeStatus(state.status),
        tick: Number.isFinite(state.tick) ? state.tick : 0,
        loadMode: state.loadMode,
        worldId: world.worldId,
        themeId: world.themeId,
        background: world.background,
        bg: world.bg,
        decorItems: world.decorItems,
        playerStatus: player.locomotion,
        playerX: player.x,
        playerY: player.y,
      };
    }

    return {
      ok: true,
      prepare,
      start,
      tick,
      tickSteps,
      stop,
      reset,
      getState,
      getSummary,
      getLoadSummary,
      getBootPayload,
      getPlayerSnapshot,
      getWorldSnapshot,
      isPrepared() {
        syncFromRuntime();
        return state.prepared === true;
      },
      isStarted() {
        syncFromRuntime();
        return state.started === true;
      },
    };
  } catch (_error) {
    const invalidSummary = {
      ok: false,
      sourceResolved: false,
      prepared: false,
      started: false,
      startable: false,
      status: "invalid",
      tick: 0,
      loadMode: "unknown",
    };

    function getPlayerSnapshot() {
      return buildPlayerSnapshot(null);
    }

    function getWorldSnapshot() {
      return buildWorldSnapshot(null);
    }

    function buildResult(extras = {}) {
      return { ...invalidSummary, ...extras };
    }

    return {
      ok: false,
      async prepare() {
        return buildResult({ preparedNow: false });
      },
      async start() {
        return buildResult({ startedNow: false });
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
          ...invalidSummary,
          runtimeOk: false,
          lastAction: "none",
          lastResult: null,
        };
      },
      getSummary() {
        return {
          ...invalidSummary,
          player: getPlayerSnapshot(),
          world: getWorldSnapshot(),
        };
      },
      getLoadSummary() {
        const world = getWorldSnapshot();
        return {
          ok: false,
          sourceResolved: false,
          prepared: false,
          status: "invalid",
          loadMode: "unknown",
          worldId: world.worldId,
          themeId: world.themeId,
          width: world.width,
          height: world.height,
          tileSize: world.tileSize,
        };
      },
      getBootPayload() {
        const world = getWorldSnapshot();
        const player = getPlayerSnapshot();

        return {
          ok: false,
          prepared: false,
          started: false,
          startable: false,
          status: "invalid",
          tick: 0,
          loadMode: "unknown",
          worldId: world.worldId,
          themeId: world.themeId,
          background: world.background,
          bg: world.bg,
        decorItems: world.decorItems,
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
      isStarted() {
        return false;
      },
    };
  }
}
