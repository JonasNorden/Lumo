import { createRuntimeRunner } from "./createRuntimeRunner.js";

const DEFAULT_STATUS = "idle";

// Clones plain JSON-like values so snapshots never share mutable params references.
function clonePlainData(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => clonePlainData(entry));
  }

  if (value && typeof value === "object") {
    const cloned = {};
    for (const [key, entry] of Object.entries(value)) {
      cloned[key] = clonePlainData(entry);
    }
    return cloned;
  }

  return value;
}

// Normalizes session status so external callers always receive known values.
function normalizeStatus(status, fallback = DEFAULT_STATUS) {
  if (status === "idle" || status === "running" || status === "stopped" || status === "invalid") {
    return status;
  }
  return fallback;
}

function buildDarkProjectilesFromEntities(entities) {
  if (!Array.isArray(entities)) {
    return [];
  }

  return entities
    // Recover live dark projectile presence when runtime emits projectile entities.
    .map((entity, index) => {
      const type = typeof entity?.type === "string" ? entity.type : "";
      if (type !== "darkSpellProjectile" && type !== "dark_spell_projectile") {
        return null;
      }

      const fallbackId = index + 1;
      return {
        id: Number.isFinite(entity?.id) ? entity.id : fallbackId,
        x: Number.isFinite(entity?.x) ? entity.x : null,
        y: Number.isFinite(entity?.y) ? entity.y : null,
        vx: Number.isFinite(entity?.vx) ? entity.vx : 0,
        vy: Number.isFinite(entity?.vy) ? entity.vy : 0,
        age: Number.isFinite(entity?.age) ? entity.age : 0,
        maxAge: Number.isFinite(entity?.maxAge) ? entity.maxAge : null,
      };
    })
    .filter((projectile) => projectile && projectile.x !== null && projectile.y !== null);
}

// Builds a stable player snapshot shape from any runtime state input.
function buildPlayerSnapshot(playerState) {
  const velocityX = Number.isFinite(playerState?.velocity?.x) ? playerState.velocity.x : null;
  const velocityY = Number.isFinite(playerState?.velocity?.y) ? playerState.velocity.y : null;
  const normalizedDarkProjectiles = Array.isArray(playerState?.darkProjectiles)
    ? playerState.darkProjectiles
      .map((projectile) => ({
        id: Number.isFinite(projectile?.id) ? projectile.id : null,
        x: Number.isFinite(projectile?.x) ? projectile.x : null,
        y: Number.isFinite(projectile?.y) ? projectile.y : null,
        vx: Number.isFinite(projectile?.vx) ? projectile.vx : 0,
        vy: Number.isFinite(projectile?.vy) ? projectile.vy : 0,
        age: Number.isFinite(projectile?.age) ? projectile.age : 0,
        maxAge: Number.isFinite(projectile?.maxAge) ? projectile.maxAge : null,
      }))
      .filter((projectile) => projectile.id !== null && projectile.x !== null && projectile.y !== null)
    : [];
  const fallbackDarkProjectiles = buildDarkProjectilesFromEntities(playerState?.entities);

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
    rising: playerState?.rising === true,
    facingX: Number.isFinite(playerState?.facingX) ? playerState.facingX : null,
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
          isDarkActive: entity?.isDarkActive === true,
          dying: entity?.dying === true,
          dissolveT: Number.isFinite(entity?.dissolveT) ? entity.dissolveT : 0,
          // Preserve raw dark creature cast runtime fields for live snapshot consumers.
          _castCd: Number.isFinite(entity?._castCd) ? entity._castCd : null,
          _castChargeT: Number.isFinite(entity?._castChargeT) ? entity._castChargeT : null,
          _castTargetX: Number.isFinite(entity?._castTargetX) ? entity._castTargetX : null,
          _castTargetY: Number.isFinite(entity?._castTargetY) ? entity._castTargetY : null,
          // Preserve raw hover-void runtime state fields without fabricating defaults.
          awake: typeof entity?.awake === "boolean" ? entity.awake : null,
          sleepBlend: Number.isFinite(entity?.sleepBlend) ? entity.sleepBlend : null,
          eyeBlend: Number.isFinite(entity?.eyeBlend) ? entity.eyeBlend : null,
          _wakeHold: Number.isFinite(entity?._wakeHold) ? entity._wakeHold : null,
          _isFollowing: typeof entity?._isFollowing === "boolean" ? entity._isFollowing : null,
          castChargeT: Number.isFinite(entity?._castChargeT) ? entity._castChargeT : 0,
          castCooldownT: Number.isFinite(entity?._castCd) ? entity._castCd : 0,
          // Keep authored params intact through runtime session snapshots.
          params: entity?.params && typeof entity.params === "object" ? clonePlainData(entity.params) : {},
        }))
        .filter((entity) => entity.id !== null && entity.x !== null && entity.y !== null)
      : [],
    darkProjectiles: normalizedDarkProjectiles.length > 0 ? normalizedDarkProjectiles : fallbackDarkProjectiles,
  };
}

// Builds a stable world snapshot shape from any runtime state input.
function buildWorldSnapshot(worldState) {
  function cloneBgPayload(bgPayload) {
    if (Array.isArray(bgPayload)) {
      return bgPayload.map((entry) => (entry && typeof entry === "object" ? { ...entry } : entry));
    }
    if (bgPayload && typeof bgPayload === "object") {
      return {
        ...bgPayload,
        data: Array.isArray(bgPayload.data)
          ? bgPayload.data.map((entry) => (entry && typeof entry === "object" ? { ...entry } : entry))
          : [],
        placements: Array.isArray(bgPayload.placements)
          ? bgPayload.placements
            .map((placement) => (placement && typeof placement === "object" ? { ...placement } : placement))
            .filter((placement) => placement && typeof placement === "object")
          : [],
      };
    }
    return [];
  }

  const supportTiles = Array.isArray(worldState?.layers?.tiles)
    ? worldState.layers.tiles
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
      .filter((tile) => (
        tile.x !== null &&
        tile.y !== null &&
        tile.w !== null &&
        tile.h !== null &&
        tile.w > 0 &&
        tile.h > 0
      ))
    : [];
  const decorItems = Array.isArray(worldState?.layers?.decor)
    ? worldState.layers.decor
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
  const background = Array.isArray(worldState?.layers?.background)
    ? worldState.layers.background.map((entry) => (entry && typeof entry === "object" ? { ...entry } : entry))
    : [];
  // Preserve bg in array or object-with-data form for downstream adapter snapshots.
  const bg = cloneBgPayload(worldState?.layers?.bg);

  return {
    ok: worldState && typeof worldState === "object",
    worldId: typeof worldState?.identity?.id === "string" ? worldState.identity.id : "",
    themeId: typeof worldState?.identity?.themeId === "string" ? worldState.identity.themeId : "",
    width: Number.isFinite(worldState?.world?.width) ? worldState.world.width : 0,
    height: Number.isFinite(worldState?.world?.height) ? worldState.world.height : 0,
    tileSize: Number.isFinite(worldState?.world?.tileSize) ? worldState.world.tileSize : 0,
    background,
    bg,
    supportTiles,
    decorItems,
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
