import { createRuntimeRunner } from "./createRuntimeRunner.js";

const DEFAULT_STATUS = "idle";

// Normalizes session status so external callers always receive known values.
function normalizeStatus(status, fallback = DEFAULT_STATUS) {
  if (status === "idle" || status === "running" || status === "stopped" || status === "invalid") {
    return status;
  }
  return fallback;
}

// Builds a stable player snapshot shape from any runtime state input.
function buildPlayerSnapshot(playerState) {
  const velocityX = Number.isFinite(playerState?.velocity?.x) ? playerState.velocity.x : null;
  const velocityY = Number.isFinite(playerState?.velocity?.y) ? playerState.velocity.y : null;
  return {
    ok: playerState && typeof playerState === "object",
    x: Number.isFinite(playerState?.position?.x) ? playerState.position.x : null,
    y: Number.isFinite(playerState?.position?.y) ? playerState.position.y : null,
    velocity: {
      x: velocityX,
      y: velocityY,
    },
    grounded: playerState?.grounded === true,
    falling: playerState?.falling === true,
    locomotion: typeof playerState?.locomotion === "string" ? playerState.locomotion : "unknown",
    energy: Number.isFinite(playerState?.energy) ? playerState.energy : null,
    boostActive: playerState?.boostActive === true,
    flareStash: Number.isFinite(playerState?.flareStash) ? playerState.flareStash : 1,
    pulse: playerState?.pulse && typeof playerState.pulse === "object"
      ? {
          active: playerState.pulse.active === true,
          r: Number.isFinite(playerState?.pulse?.r) ? playerState.pulse.r : 0,
          alpha: Number.isFinite(playerState?.pulse?.alpha) ? playerState.pulse.alpha : 0,
          thickness: Number.isFinite(playerState?.pulse?.thickness) ? playerState.pulse.thickness : 0,
          id: Number.isFinite(playerState?.pulse?.id) ? playerState.pulse.id : 0,
          x: Number.isFinite(playerState?.pulse?.x)
            ? playerState.pulse.x
            : (Number.isFinite(playerState?.position?.x) ? playerState.position.x : null),
          y: Number.isFinite(playerState?.pulse?.y)
            ? playerState.pulse.y
            : (Number.isFinite(playerState?.position?.y) ? playerState.position.y : null),
        }
      : null,
    flares: Array.isArray(playerState?.flares)
      ? playerState.flares
        .map((flare) => ({
          id: Number.isFinite(flare?.id) ? flare.id : null,
          x: Number.isFinite(flare?.x) ? flare.x : null,
          y: Number.isFinite(flare?.y) ? flare.y : null,
          vx: Number.isFinite(flare?.vx) ? flare.vx : null,
          vy: Number.isFinite(flare?.vy) ? flare.vy : null,
          grounded: flare?.grounded === true,
          settled: flare?.settled === true,
          bounceCount: Number.isFinite(flare?.bounceCount) ? flare.bounceCount : 0,
          ttlTicks: Number.isFinite(flare?.ttlTicks) ? flare.ttlTicks : null,
          radius: Number.isFinite(flare?.radius) ? flare.radius : null,
          lightRadius: Number.isFinite(flare?.lightRadius) ? flare.lightRadius : null,
          lifetimeTicks: Number.isFinite(flare?.lifetimeTicks) ? flare.lifetimeTicks : null,
          fadeLastTicks: Number.isFinite(flare?.fadeLastTicks) ? flare.fadeLastTicks : null,
        }))
        .filter((flare) => flare.id !== null && flare.x !== null && flare.y !== null && flare.radius !== null)
      : [],
    entities: Array.isArray(playerState?.entities)
      ? playerState.entities
        .map((entity) => ({
          id: typeof entity?.id === "string" ? entity.id : null,
          type: typeof entity?.type === "string" ? entity.type : "dummy",
          x: Number.isFinite(entity?.x) ? entity.x : null,
          y: Number.isFinite(entity?.y) ? entity.y : null,
          size: Number.isFinite(entity?.size) ? entity.size : 24,
          hp: Number.isFinite(entity?.hp) ? entity.hp : 0,
          maxHp: Number.isFinite(entity?.maxHp) ? entity.maxHp : 0,
          alive: entity?.alive === true,
          active: entity?.active === true,
          state: typeof entity?.state === "string" ? entity.state : "idle",
          hitFlashTicks: Number.isFinite(entity?.hitFlashTicks) ? entity.hitFlashTicks : 0,
          lastPulseIdHit: Number.isFinite(entity?.lastPulseIdHit) ? entity.lastPulseIdHit : -1,
          illuminated: entity?.illuminated === true,
          flareExposure: Number.isFinite(entity?.flareExposure) ? entity.flareExposure : 0,
          consumesFlare: entity?.consumesFlare === true,
          lastFlareIdHit: Number.isFinite(entity?.lastFlareIdHit) ? entity.lastFlareIdHit : -1,
        }))
        .filter((entity) => entity.id !== null && entity.x !== null && entity.y !== null)
      : [],
  };
}

// Builds a stable world snapshot shape from any runtime state input.
function buildWorldSnapshot(worldState) {
  const supportTiles = Array.isArray(worldState?.layers?.tiles)
    ? worldState.layers.tiles
      .map((tile) => ({
        x: Number.isFinite(tile?.x) ? tile.x : null,
        y: Number.isFinite(tile?.y) ? tile.y : null,
        w: Number.isFinite(tile?.w) ? tile.w : null,
        h: Number.isFinite(tile?.h) ? tile.h : null,
      }))
      .filter((tile) => (
        tile.x !== null &&
        tile.y !== null &&
        tile.w !== null &&
        tile.h !== null &&
        tile.w > 0 &&
        tile.h > 0
      ))
    : [];

  return {
    ok: worldState && typeof worldState === "object",
    worldId: typeof worldState?.identity?.id === "string" ? worldState.identity.id : "",
    themeId: typeof worldState?.identity?.themeId === "string" ? worldState.identity.themeId : "",
    width: Number.isFinite(worldState?.world?.width) ? worldState.world.width : 0,
    height: Number.isFinite(worldState?.world?.height) ? worldState.world.height : 0,
    tileSize: Number.isFinite(worldState?.world?.tileSize) ? worldState.world.tileSize : 0,
    supportTiles,
  };
}

// Clones session state into a minimal deterministic shape for callers.
function cloneSessionState(state) {
  return {
    ok: state.ok === true,
    status: normalizeStatus(state.status),
    tick: Number.isFinite(state.tick) ? state.tick : 0,
    runnerOk: state.runnerOk === true,
    startable: state.startable === true,
    lastTickResult: state.lastTickResult ? { ...state.lastTickResult } : null,
    started: state.started === true,
  };
}

// Keeps session state aligned with runner state after operations.
function syncSessionFromRunner(state, runnerState) {
  const normalizedRunnerState = runnerState && typeof runnerState === "object" ? runnerState : {};

  state.tick = Number.isFinite(normalizedRunnerState.tick) ? normalizedRunnerState.tick : 0;

  if (state.status !== "invalid") {
    state.status = normalizeStatus(normalizedRunnerState.status, state.started ? "running" : "idle");
  }

  if (state.runnerOk !== true) {
    state.ok = false;
    state.status = "invalid";
  }
}

// Creates the first boot-facing runtime game session layer above the standalone runner.
export function createRuntimeGameSession(options = {}) {
  try {
    const levelDocument = options?.levelDocument;
    const runtimeConfig = options?.runtimeConfig && typeof options.runtimeConfig === "object" ? { ...options.runtimeConfig } : {};
    const runner = createRuntimeRunner({ levelDocument, runtimeConfig });

    const sessionState = {
      ok: runner?.ok === true,
      status: runner?.ok === true ? "idle" : "invalid",
      tick: 0,
      runnerOk: runner?.ok === true,
      startable: runner?.ok === true,
      lastTickResult: null,
      started: false,
    };

    // Returns the current session state snapshot.
    function getState() {
      return cloneSessionState(sessionState);
    }

    // Returns compact boot-facing player state.
    function getPlayerSnapshot() {
      try {
        const runnerState = runner?.getState?.();
        return buildPlayerSnapshot(runnerState?.playerState);
      } catch (_error) {
        return buildPlayerSnapshot(null);
      }
    }

    // Returns compact boot-facing world state.
    function getWorldSnapshot() {
      try {
        const runnerState = runner?.getState?.();
        return buildWorldSnapshot(runnerState?.world);
      } catch (_error) {
        return buildWorldSnapshot(null);
      }
    }

    // Returns compact session summary for runtime boot handoff.
    function getSummary() {
      const player = getPlayerSnapshot();
      const world = getWorldSnapshot();

      return {
        ok: sessionState.ok === true,
        status: normalizeStatus(sessionState.status),
        started: sessionState.started === true,
        tick: Number.isFinite(sessionState.tick) ? sessionState.tick : 0,
        startable: sessionState.startable === true,
        player: {
          x: player.x,
          y: player.y,
          grounded: player.grounded,
          falling: player.falling,
          locomotion: player.locomotion,
        },
        world: {
          worldId: world.worldId,
          themeId: world.themeId,
          width: world.width,
          height: world.height,
          tileSize: world.tileSize,
        },
      };
    }

    // Starts the session once and transitions to the running lifecycle.
    function start() {
      if (sessionState.status === "invalid" || sessionState.startable !== true) {
        const result = { ok: false, started: sessionState.started === true, state: getState() };
        sessionState.lastTickResult = result;
        return result;
      }

      if (sessionState.started === true) {
        const result = { ok: true, started: true, state: getState() };
        sessionState.lastTickResult = result;
        return result;
      }

      try {
        const startResult = runner.start();
        const runnerState = startResult?.state ?? runner.getState?.();

        sessionState.started = startResult?.ok === true;
        sessionState.status = sessionState.started ? "running" : "invalid";
        sessionState.runnerOk = startResult?.ok === true;
        sessionState.ok = sessionState.runnerOk;
        syncSessionFromRunner(sessionState, runnerState);

        const result = { ok: sessionState.ok === true, started: sessionState.started === true, state: getState() };
        sessionState.lastTickResult = result;
        return result;
      } catch (_error) {
        sessionState.ok = false;
        sessionState.runnerOk = false;
        sessionState.startable = false;
        sessionState.status = "invalid";
        const result = { ok: false, started: false, state: getState() };
        sessionState.lastTickResult = result;
        return result;
      }
    }

    // Executes one deterministic runtime tick through the runner.
    function tick(inputIntent = {}) {
      if (sessionState.status === "invalid" || sessionState.started !== true) {
        const result = {
          ok: false,
          stepped: false,
          tick: sessionState.tick,
          status: normalizeStatus(sessionState.status),
          state: getState(),
        };
        sessionState.lastTickResult = result;
        return result;
      }

      try {
        const tickResult = runner.step({ input: inputIntent });
        syncSessionFromRunner(sessionState, tickResult?.state ?? runner.getState?.());

        if (tickResult?.ok !== true || tickResult?.stepped !== true) {
          sessionState.ok = false;
          sessionState.runnerOk = false;
          sessionState.status = "stopped";
        }

        const result = {
          ok: sessionState.ok === true,
          stepped: tickResult?.stepped === true,
          tick: sessionState.tick,
          status: normalizeStatus(sessionState.status),
          state: getState(),
        };
        sessionState.lastTickResult = result;
        return result;
      } catch (_error) {
        sessionState.ok = false;
        sessionState.runnerOk = false;
        sessionState.status = "stopped";

        const result = {
          ok: false,
          stepped: false,
          tick: sessionState.tick,
          status: "stopped",
          state: getState(),
        };
        sessionState.lastTickResult = result;
        return result;
      }
    }

    // Runs N ticks defensively and returns a compact multi-step summary.
    function tickSteps(steps = 1) {
      const normalizedSteps = Number.isInteger(steps) && steps > 0 ? steps : 0;
      let ticksRun = 0;

      for (let index = 0; index < normalizedSteps; index += 1) {
        const tickResult = tick();
        if (tickResult.stepped !== true) {
          break;
        }

        ticksRun += 1;

        if (sessionState.status === "invalid" || sessionState.status === "stopped") {
          break;
        }
      }

      const result = {
        ok: sessionState.ok === true,
        stepsRequested: normalizedSteps,
        stepsRun: ticksRun,
        tick: sessionState.tick,
        status: normalizeStatus(sessionState.status),
        state: getState(),
      };
      sessionState.lastTickResult = result;
      return result;
    }

    // Stops the active session without destroying world/player snapshots.
    function stop() {
      try {
        runner.stop();
      } catch (_error) {
        // Intentional no-op: session stop is still reflected below.
      }

      if (sessionState.status !== "invalid") {
        sessionState.status = "stopped";
      }

      const result = { ok: sessionState.ok === true, stopped: true, state: getState() };
      sessionState.lastTickResult = result;
      return result;
    }

    // Resets session and runner back to the original level-backed baseline.
    function reset() {
      try {
        const resetResult = runner.reset();
        const runnerState = resetResult?.state ?? runner.getState?.();

        sessionState.runnerOk = resetResult?.ok === true;
        sessionState.ok = sessionState.runnerOk;
        sessionState.status = sessionState.runnerOk ? "idle" : "invalid";
        sessionState.tick = 0;
        sessionState.started = false;
        sessionState.startable = sessionState.runnerOk;
        syncSessionFromRunner(sessionState, runnerState);

        const result = { ok: sessionState.ok === true, reset: true, state: getState() };
        sessionState.lastTickResult = result;
        return result;
      } catch (_error) {
        sessionState.ok = false;
        sessionState.runnerOk = false;
        sessionState.startable = false;
        sessionState.status = "invalid";
        sessionState.started = false;
        sessionState.tick = 0;

        const result = { ok: false, reset: false, state: getState() };
        sessionState.lastTickResult = result;
        return result;
      }
    }

    return {
      ok: sessionState.ok === true,
      getState,
      getSummary,
      start,
      tick,
      tickSteps,
      stop,
      reset,
      getPlayerSnapshot,
      getWorldSnapshot,
    };
  } catch (_error) {
    const invalidState = {
      ok: false,
      status: "invalid",
      tick: 0,
      runnerOk: false,
      startable: false,
      lastTickResult: null,
      started: false,
    };

    return {
      ok: false,
      getState() {
        return cloneSessionState(invalidState);
      },
      getSummary() {
        return {
          ok: false,
          status: "invalid",
          started: false,
          tick: 0,
          startable: false,
          player: { x: null, y: null, grounded: false, falling: false, locomotion: "unknown" },
          world: { worldId: "", themeId: "", width: 0, height: 0, tileSize: 0 },
        };
      },
      start() {
        return { ok: false, started: false, state: cloneSessionState(invalidState) };
      },
      tick() {
        return { ok: false, stepped: false, tick: 0, status: "invalid", state: cloneSessionState(invalidState) };
      },
      tickSteps(steps = 1) {
        const normalizedSteps = Number.isInteger(steps) && steps > 0 ? steps : 0;
        return {
          ok: false,
          stepsRequested: normalizedSteps,
          stepsRun: 0,
          tick: 0,
          status: "invalid",
          state: cloneSessionState(invalidState),
        };
      },
      stop() {
        return { ok: false, stopped: true, state: cloneSessionState(invalidState) };
      },
      reset() {
        return { ok: false, reset: false, state: cloneSessionState(invalidState) };
      },
      getPlayerSnapshot() {
        return buildPlayerSnapshot(null);
      },
      getWorldSnapshot() {
        return buildWorldSnapshot(null);
      },
    };
  }
}
