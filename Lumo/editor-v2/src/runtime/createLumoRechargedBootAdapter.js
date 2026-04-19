import { createRechargedRuntimeOrchestrator } from "./createRechargedRuntimeOrchestrator.js";
import { buildRechargedHudSnapshot } from "./buildRechargedHudSnapshot.js";

// Keeps adapter status values deterministic for Lumo.html-facing integration.
function normalizeStatus(status, fallback = "invalid") {
  if (status === "idle" || status === "prepared" || status === "booted" || status === "running" || status === "stopped" || status === "invalid") {
    return status;
  }

  return fallback;
}

// Clones plain JSON-like values so adapter snapshots never share mutable params references.
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

// Keeps runtime entity snapshot shape explicit for Lumo.html-facing reads.
function cloneSnapshotEntity(entity) {
  const resolvedWidth = Number.isFinite(entity?.w) && entity.w > 0
    ? entity.w
    : Number.isFinite(entity?.footprintW) && entity.footprintW > 0
      ? entity.footprintW
      : Number.isFinite(entity?.size) && entity.size > 0
        ? entity.size
        : null;
  const resolvedHeight = Number.isFinite(entity?.h) && entity.h > 0
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
    w: resolvedWidth,
    h: resolvedHeight,
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
    // Preserve raw dark creature cast runtime fields through the live adapter chain.
    _castCd: Number.isFinite(entity?._castCd) ? entity._castCd : null,
    _castChargeT: Number.isFinite(entity?._castChargeT) ? entity._castChargeT : null,
    _castTargetX: Number.isFinite(entity?._castTargetX) ? entity._castTargetX : null,
    _castTargetY: Number.isFinite(entity?._castTargetY) ? entity._castTargetY : null,
    // Preserve raw hover-void runtime state fields without synthetic defaults.
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
    amount: Number.isFinite(entity?.amount) ? entity.amount : 1,
    // Keep full params object instead of flattening/dropping entity metadata.
    params: entity?.params && typeof entity.params === "object" ? clonePlainData(entity.params) : {},
  };
}

// Returns a compact player snapshot with stable primitive defaults.
function buildPlayerSnapshot(snapshot) {
  const source = snapshot && typeof snapshot === "object" ? snapshot : {};
  const pulse = source?.pulse && typeof source.pulse === "object" ? source.pulse : null;
  const velocityX = Number.isFinite(source?.velocity?.x) ? source.velocity.x : null;
  const velocityY = Number.isFinite(source?.velocity?.y) ? source.velocity.y : null;
  const darkProjectiles = Array.isArray(source.darkProjectiles) ? source.darkProjectiles.map((projectile) => ({ ...projectile })) : [];
  const entities = Array.isArray(source.entities) ? source.entities.map((entity) => cloneSnapshotEntity(entity)) : [];
  const hasRenderableDarkProjectileEntity = entities.some((entity) => (
    entity.type === "darkSpellProjectile" || entity.type === "dark_spell_projectile"
  ));
  const transientDarkProjectileEntities = hasRenderableDarkProjectileEntity
    ? []
    : darkProjectiles
      .filter((projectile) => Number.isFinite(projectile?.x) && Number.isFinite(projectile?.y))
      .map((projectile, index) => ({
        id: `runtime-dark-projectile-${index}`,
        type: "darkSpellProjectile",
        x: projectile.x,
        y: projectile.y,
        size: 12,
        rot: Math.atan2(
          Number.isFinite(projectile?.vy) ? projectile.vy : 0,
          Number.isFinite(projectile?.vx) ? projectile.vx : 0,
        ),
        alpha: Number.isFinite(projectile?.maxAge) && projectile.maxAge > 0
          ? Math.max(0, Math.min(1, 1 - ((Number.isFinite(projectile?.age) ? projectile.age : 0) / projectile.maxAge)))
          : 1,
        active: true,
        alive: true,
        state: "active",
      }));

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
    _hoverVoidAttackGlobalCd: Number.isFinite(source._hoverVoidAttackGlobalCd) ? source._hoverVoidAttackGlobalCd : 0,
    lives: Number.isFinite(source.lives) ? source.lives : null,
    score: Number.isFinite(source.score) ? source.score : null,
    boostActive: source.boostActive === true,
    flareStash: Number.isFinite(source.flareStash) ? source.flareStash : 1,
    levelComplete: source.levelComplete === true,
    intermissionReadyForInput: source.intermissionReadyForInput === true,
    gameState: typeof source.gameState === "string" ? source.gameState : "playing",
    lastExitId: typeof source.lastExitId === "string" ? source.lastExitId : null,
    checkpoint: source?.checkpoint && typeof source.checkpoint === "object"
      ? {
          tx: Number.isFinite(source?.checkpoint?.tx) ? source.checkpoint.tx : null,
          ty: Number.isFinite(source?.checkpoint?.ty) ? source.checkpoint.ty : null,
          px: Number.isFinite(source?.checkpoint?.px) ? source.checkpoint.px : null,
          py: Number.isFinite(source?.checkpoint?.py) ? source.checkpoint.py : null,
        }
      : null,
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
    darkProjectiles,
    runtimeLights: Array.isArray(source.runtimeLights)
      ? source.runtimeLights
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
    entities: entities.concat(transientDarkProjectileEntities),
  };
}

// Returns a compact world snapshot with stable primitive defaults.
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
  // Preserve bg in array or object-with-data form for downstream adapter snapshots.
  const bg = Array.isArray(source.bg)
    ? source.bg.map((entry) => (entry && typeof entry === "object" ? { ...entry } : entry))
    : (source.bg && typeof source.bg === "object"
      ? {
          ...source.bg,
          data: Array.isArray(source.bg.data)
            ? source.bg.data.map((entry) => (entry && typeof entry === "object" ? { ...entry } : entry))
            : [],
          placements: Array.isArray(source.bg.placements)
            ? source.bg.placements
              .map((placement) => (placement && typeof placement === "object" ? { ...placement } : placement))
              .filter((placement) => placement && typeof placement === "object")
            : [],
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
      facingX: 1,
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

      const moveXIntent = inputIntent?.right === true && inputIntent?.left !== true
        ? 1
        : (inputIntent?.left === true && inputIntent?.right !== true ? -1 : 0);
      if (moveXIntent !== 0) {
        state.facingX = moveXIntent;
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
        const snapshot = buildPlayerSnapshot(orchestrator?.getPlayerSnapshot?.());
        if (!Number.isFinite(snapshot.facingX) && Number.isFinite(state.facingX) && Math.abs(state.facingX) > 0) {
          snapshot.facingX = state.facingX < 0 ? -1 : 1;
        }
        return snapshot;
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
      const hud = buildRechargedHudSnapshot({ player });

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
        background: world.background,
        bg: world.bg,
        decorItems: world.decorItems,
        playerStatus: player.locomotion,
        playerX: player.x,
        playerY: player.y,
        score: Number.isFinite(hud?.score) ? hud.score : 0,
        lives: Number.isFinite(hud?.lives) ? hud.lives : 0,
        flareStash: Number.isFinite(hud?.flareStash) ? hud.flareStash : 0,
        energy: Number.isFinite(hud?.energy) ? hud.energy : 0,
        levelComplete: player.levelComplete === true,
        intermissionReadyForInput: player.intermissionReadyForInput === true,
        gameState: typeof player.gameState === "string" ? player.gameState : "playing",
        lastExitId: typeof player.lastExitId === "string" ? player.lastExitId : null,
        ...(typeof hud?.statusText === "string" ? { statusText: hud.statusText } : {}),
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
        const hud = buildRechargedHudSnapshot({ player });

        return {
          ...invalidState,
          worldId: world.worldId,
          themeId: world.themeId,
          worldWidth: world.width,
          worldHeight: world.height,
          tileSize: world.tileSize,
          supportTiles: world.supportTiles,
          background: world.background,
          bg: world.bg,
          decorItems: world.decorItems,
          playerStatus: player.locomotion,
          playerX: player.x,
          playerY: player.y,
          score: Number.isFinite(hud?.score) ? hud.score : 0,
          lives: Number.isFinite(hud?.lives) ? hud.lives : 0,
          flareStash: Number.isFinite(hud?.flareStash) ? hud.flareStash : 0,
          energy: Number.isFinite(hud?.energy) ? hud.energy : 0,
          ...(typeof hud?.statusText === "string" ? { statusText: hud.statusText } : {}),
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
