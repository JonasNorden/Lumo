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

// Returns a compact world snapshot with a stable shape.
function buildWorldSnapshot(world) {
  const source = world && typeof world === "object" ? world : {};
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
  // Preserve bg in array or object-with-data form for downstream adapter snapshots.
  const bg = Array.isArray(source.bg)
    ? source.bg.map((entry) => (entry && typeof entry === "object" ? { ...entry } : entry))
    : (source.bg && typeof source.bg === "object" && Array.isArray(source.bg.data)
      ? {
          ...source.bg,
          data: source.bg.data.map((entry) => (entry && typeof entry === "object" ? { ...entry } : entry)),
        }
      : []);

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
    function tick(inputIntent = {}) {
      runtimeState.lastAction = "tick";

      if (runtimeState.booted !== true || runtimeState.status === "invalid") {
        const result = buildActionResult(runtimeState, { stepped: false });
        runtimeState.lastTickResult = result;
        return result;
      }

      try {
        const tickResult = session.tick(inputIntent);
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
