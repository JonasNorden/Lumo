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
        w: Number.isFinite(projectile?.w) ? projectile.w : null,
        h: Number.isFinite(projectile?.h) ? projectile.h : null,
        vx: Number.isFinite(projectile?.vx) ? projectile.vx : 0,
        vy: Number.isFinite(projectile?.vy) ? projectile.vy : 0,
        rot: Number.isFinite(projectile?.rot) ? projectile.rot : 0,
        age: Number.isFinite(projectile?.age) ? projectile.age : 0,
        maxAge: Number.isFinite(projectile?.maxAge) ? projectile.maxAge : null,
        _projectileSpritePath: typeof projectile?._projectileSpritePath === "string" ? projectile._projectileSpritePath : "",
      }))
      .filter((projectile) => projectile.x !== null && projectile.y !== null)
    : [];
  const normalizedEntities = Array.isArray(playerState?.entities)
    ? playerState.entities
      .map((entity) => {
        const resolvedW = Number.isFinite(entity?.w) && entity.w > 0
          ? entity.w
          : Number.isFinite(entity?.footprintW) && entity.footprintW > 0
            ? entity.footprintW
            : Number.isFinite(entity?.size) && entity.size > 0
              ? entity.size
              : null;
        const resolvedH = Number.isFinite(entity?.h) && entity.h > 0
          ? entity.h
          : Number.isFinite(entity?.footprintH) && entity.footprintH > 0
            ? entity.footprintH
            : Number.isFinite(entity?.size) && entity.size > 0
              ? entity.size
              : null;
        return {
          id: typeof entity?.id === "string" ? entity.id : null,
          type: typeof entity?.type === "string" ? entity.type : "dummy",
          x: Number.isFinite(entity?.x) ? entity.x : null,
          y: Number.isFinite(entity?.y) ? entity.y : null,
          size: Number.isFinite(entity?.size) ? entity.size : 24,
          w: Number.isFinite(resolvedW) ? resolvedW : null,
          h: Number.isFinite(resolvedH) ? resolvedH : null,
          rot: Number.isFinite(entity?.rot) ? entity.rot : 0,
          alpha: Number.isFinite(entity?.alpha) ? entity.alpha : 1,
          t: Number.isFinite(entity?.t) ? entity.t : 0,
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
          _blinkT: Number.isFinite(entity?._blinkT) ? entity._blinkT : null,
          _blinkDur: Number.isFinite(entity?._blinkDur) ? entity._blinkDur : null,
          _angryT: Number.isFinite(entity?._angryT) ? entity._angryT : null,
          _angryCd: Number.isFinite(entity?._angryCd) ? entity._angryCd : null,
          _bickerCd: Number.isFinite(entity?._bickerCd) ? entity._bickerCd : null,
          _recoilT: Number.isFinite(entity?._recoilT) ? entity._recoilT : null,
          _lungeState: typeof entity?._lungeState === "string" ? entity._lungeState : null,
          _lungeActor: typeof entity?._lungeActor === "boolean" ? entity._lungeActor : null,
          _lungeT: Number.isFinite(entity?._lungeT) ? entity._lungeT : null,
          _lungeDirX: Number.isFinite(entity?._lungeDirX) ? entity._lungeDirX : null,
          _lungeDirY: Number.isFinite(entity?._lungeDirY) ? entity._lungeDirY : null,
          _lungeHitDone: typeof entity?._lungeHitDone === "boolean" ? entity._lungeHitDone : null,
          _attackCd: Number.isFinite(entity?._attackCd) ? entity._attackCd : null,
          braveGroupSize: Number.isFinite(entity?.braveGroupSize) ? entity.braveGroupSize : null,
          swarmGroupSize: Number.isFinite(entity?.swarmGroupSize) ? entity.swarmGroupSize : null,
          castChargeT: Number.isFinite(entity?._castChargeT) ? entity._castChargeT : 0,
          castCooldownT: Number.isFinite(entity?._castCd) ? entity._castCd : 0,
          mode: typeof entity?.mode === "string" ? entity.mode : null,
          lightK: Number.isFinite(entity?.lightK) ? entity.lightK : null,
          lightRadius: Number.isFinite(entity?.lightRadius) ? entity.lightRadius : null,
          lightStrength: Number.isFinite(entity?.lightStrength) ? entity.lightStrength : null,
          dir: Number.isFinite(entity?.dir) ? entity.dir : null,
          _tail: Array.isArray(entity?._tail)
            ? entity._tail.map((point) => ({
              x: Number.isFinite(point?.x) ? point.x : null,
              y: Number.isFinite(point?.y) ? point.y : null,
              t: Number.isFinite(point?.t) ? point.t : null,
            }))
            : [],
          // Keep authored params intact through runtime session snapshots.
          params: entity?.params && typeof entity.params === "object" ? clonePlainData(entity.params) : {},
          _projectileSpritePath: typeof entity?._projectileSpritePath === "string" ? entity._projectileSpritePath : "",
        };
      })
      .filter((entity) => entity.id !== null && entity.x !== null && entity.y !== null)
    : [];
  const hasRenderableDarkProjectileEntity = normalizedEntities.some((entity) => (
    entity.type === "darkSpellProjectile" || entity.type === "dark_spell_projectile"
  ));
  const transientDarkProjectileEntities = hasRenderableDarkProjectileEntity
    ? []
    : normalizedDarkProjectiles.map((projectile, index) => ({
        id: `runtime-dark-projectile-${index}`,
        type: "darkSpellProjectile",
        x: projectile.x,
        y: projectile.y,
        size: 12,
        rot: Math.atan2(projectile.vy, projectile.vx),
        alpha: projectile.maxAge && projectile.maxAge > 0
          ? Math.max(0, Math.min(1, 1 - (projectile.age / projectile.maxAge)))
          : 1,
        active: true,
        alive: true,
      }));

  const respawnCountdown = playerState?.respawnCountdown && typeof playerState.respawnCountdown === "object"
    ? {
        active: playerState.respawnCountdown.active === true,
        total: Number.isFinite(playerState?.respawnCountdown?.total) ? playerState.respawnCountdown.total : null,
        remaining: Number.isFinite(playerState?.respawnCountdown?.remaining) ? playerState.respawnCountdown.remaining : null,
        countdown: Number.isFinite(playerState?.respawnCountdown?.countdown) ? playerState.respawnCountdown.countdown : null,
      }
    : null;
  const respawnPending = respawnCountdown?.active === true || playerState?.status === "respawn-pending";
  const respawnCount = Number.isFinite(respawnCountdown?.countdown) ? Math.max(0, Math.ceil(respawnCountdown.countdown)) : 0;
  const liquidDeath = playerState?.liquidDeath && typeof playerState.liquidDeath === "object"
    ? {
        active: playerState.liquidDeath.active === true,
        type: typeof playerState?.liquidDeath?.type === "string" ? playerState.liquidDeath.type : null,
        elapsed: Number.isFinite(playerState?.liquidDeath?.elapsed) ? playerState.liquidDeath.elapsed : null,
        duration: Number.isFinite(playerState?.liquidDeath?.duration) ? playerState.liquidDeath.duration : null,
        sinkSpeed: Number.isFinite(playerState?.liquidDeath?.sinkSpeed) ? playerState.liquidDeath.sinkSpeed : null,
        fade: Number.isFinite(playerState?.liquidDeath?.fade) ? playerState.liquidDeath.fade : null,
      }
    : null;

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
    status: typeof playerState?.status === "string" ? playerState.status : null,
    facingX: Number.isFinite(playerState?.facingX) ? playerState.facingX : null,
    locomotion: typeof playerState?.locomotion === "string" ? playerState.locomotion : "unknown",
    energy: Number.isFinite(playerState?.energy) ? playerState.energy : null,
    lives: Number.isFinite(playerState?.lives) ? playerState.lives : null,
    _hoverVoidAttackGlobalCd: Number.isFinite(playerState?._hoverVoidAttackGlobalCd) ? playerState._hoverVoidAttackGlobalCd : 0,
    boostActive: playerState?.boostActive === true,
    flareStash: Number.isFinite(playerState?.flareStash) ? playerState.flareStash : 1,
    levelComplete: playerState?.levelComplete === true,
    intermissionReadyForInput: playerState?.intermissionReadyForInput === true,
    gameState: typeof playerState?.gameState === "string" ? playerState.gameState : "playing",
    lastExitId: typeof playerState?.lastExitId === "string" ? playerState.lastExitId : null,
    checkpoint: playerState?.checkpoint && typeof playerState.checkpoint === "object"
      ? {
          tx: Number.isFinite(playerState?.checkpoint?.tx) ? playerState.checkpoint.tx : null,
          ty: Number.isFinite(playerState?.checkpoint?.ty) ? playerState.checkpoint.ty : null,
          px: Number.isFinite(playerState?.checkpoint?.px) ? playerState.checkpoint.px : null,
          py: Number.isFinite(playerState?.checkpoint?.py) ? playerState.checkpoint.py : null,
        }
      : null,
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
    entities: normalizedEntities.concat(transientDarkProjectileEntities),
    darkProjectiles: normalizedDarkProjectiles,
    runtimeLights: Array.isArray(playerState?.runtimeLights)
      ? playerState.runtimeLights
        .map((light) => ({
          entityId: typeof light?.entityId === "string" ? light.entityId : null,
          type: typeof light?.type === "string" ? light.type : null,
          x: Number.isFinite(light?.x) ? light.x : null,
          y: Number.isFinite(light?.y) ? light.y : null,
          radius: Number.isFinite(light?.radius) ? light.radius : null,
          strength: Number.isFinite(light?.strength) ? light.strength : null,
        }))
        .filter((light) => light.x !== null && light.y !== null && light.radius !== null && light.strength !== null)
      : [],
    respawnCountdown,
    respawnPending,
    respawnCount: respawnPending ? respawnCount : 0,
    liquidDeath,
    renderAlpha: Number.isFinite(playerState?.renderAlpha) ? Math.max(0, Math.min(1, playerState.renderAlpha)) : 1,
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
        sourceIndex: index,
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
      .sort((left, right) => (left.order - right.order) || (left.sourceIndex - right.sourceIndex) || left.decorId.localeCompare(right.decorId))
      .map(({ sourceIndex, ...decor }) => decor)
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
