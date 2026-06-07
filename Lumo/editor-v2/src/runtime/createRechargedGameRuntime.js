import { createRuntimeGameSession } from "./createRuntimeGameSession.js";
import { resolveAuthoredSoundSource } from "../domain/sound/sourceReference.js";

const DC_HAZARD_TRACE_LABEL = "[LUMO dcHazardTrace]";

function isDarkCreatureHazardTraceEnabled() {
  const search = typeof globalThis !== "undefined" && typeof globalThis?.location?.search === "string"
    ? globalThis.location.search
    : "";
  return typeof URLSearchParams === "function" && new URLSearchParams(search).get("dcHazardTrace") === "1";
}

function summarizeDarkSpellHazards(hazards) {
  return Array.isArray(hazards)
    ? hazards.map((hazard) => ({
        id: hazard?.id ?? null,
        x: Number.isFinite(hazard?.x) ? hazard.x : null,
        y: Number.isFinite(hazard?.y) ? hazard.y : null,
      }))
    : [];
}

function traceDarkSpellHazards(stage, hazards, extra = {}) {
  if (!isDarkCreatureHazardTraceEnabled() || typeof console === "undefined" || typeof console.info !== "function") {
    return;
  }
  const summarized = summarizeDarkSpellHazards(hazards);
  console.info(DC_HAZARD_TRACE_LABEL, {
    stage,
    count: summarized.length,
    hazards: summarized,
    ...extra,
  });
}

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
  const respawnCountdown = source?.respawnCountdown && typeof source.respawnCountdown === "object"
    ? {
        active: source.respawnCountdown.active === true,
        total: Number.isFinite(source?.respawnCountdown?.total) ? source.respawnCountdown.total : null,
        remaining: Number.isFinite(source?.respawnCountdown?.remaining) ? source.respawnCountdown.remaining : null,
        countdown: Number.isFinite(source?.respawnCountdown?.countdown) ? source.respawnCountdown.countdown : null,
      }
    : null;
  const respawnPending = respawnCountdown?.active === true || source?.respawnPending === true || source?.status === "respawn-pending";
  const respawnCount = Number.isFinite(source?.respawnCount)
    ? Math.max(0, Math.ceil(source.respawnCount))
    : (Number.isFinite(respawnCountdown?.countdown) ? Math.max(0, Math.ceil(respawnCountdown.countdown)) : 0);
  const liquidDeath = source?.liquidDeath && typeof source.liquidDeath === "object"
    ? {
        active: source.liquidDeath.active === true,
        type: typeof source?.liquidDeath?.type === "string" ? source.liquidDeath.type : null,
        elapsed: Number.isFinite(source?.liquidDeath?.elapsed) ? source.liquidDeath.elapsed : null,
        duration: Number.isFinite(source?.liquidDeath?.duration) ? source.liquidDeath.duration : null,
        sinkSpeed: Number.isFinite(source?.liquidDeath?.sinkSpeed) ? source.liquidDeath.sinkSpeed : null,
        fade: Number.isFinite(source?.liquidDeath?.fade) ? source.liquidDeath.fade : null,
      }
    : null;

  const sourceDarkSpellHazards = Array.isArray(source.darkSpellHazards) ? source.darkSpellHazards : [];
  traceDarkSpellHazards("visible to recharged runtime player snapshot source", sourceDarkSpellHazards);

  const snapshot = {
    x: Number.isFinite(source.x) ? source.x : null,
    y: Number.isFinite(source.y) ? source.y : null,
    velocity: {
      x: velocityX,
      y: velocityY,
    },
    grounded: source.grounded === true,
    falling: source.falling === true,
    rising: source.rising === true,
    status: typeof source?.status === "string" ? source.status : null,
    facingX: Number.isFinite(source.facingX) ? source.facingX : null,
    locomotion: typeof source.locomotion === "string" ? source.locomotion : "unknown",
    energy: Number.isFinite(source.energy) ? source.energy : null,
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
    checkpointTouched: source?.checkpointTouched === true,
    checkpointActivationKey: typeof source?.checkpointActivationKey === "string" ? source.checkpointActivationKey : "",
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
    // Keep active dark projectile runtime payload intact through runtime wrappers.
    darkProjectiles: Array.isArray(source.darkProjectiles) ? source.darkProjectiles.map((projectile) => ({ ...projectile })) : [],
    entities: Array.isArray(source.entities) ? source.entities.map((entity) => ({ ...entity })) : [],
    respawnCountdown,
    respawnPending,
    respawnCount: respawnPending ? respawnCount : 0,
    liquidDeath,
    renderAlpha: Number.isFinite(source?.renderAlpha) ? Math.max(0, Math.min(1, source.renderAlpha)) : 1,
  };

  traceDarkSpellHazards("included in recharged runtime exported player snapshot", snapshot.darkSpellHazards, {
    sourceCount: sourceDarkSpellHazards.length,
  });
  return snapshot;
}

// Returns a compact world snapshot with a stable shape.

function normalizeStoneAreas(sourceAreas) {
  return Array.isArray(sourceAreas)
    ? sourceAreas
      .map((area, index) => ({
        id: typeof area?.id === "string" && area.id.trim() ? area.id.trim() : `stone_area_${index + 1}`,
        x: Number.isFinite(area?.x) ? area.x : null,
        y: Number.isFinite(area?.y) ? area.y : null,
        width: Number.isFinite(area?.width) && area.width > 0 ? area.width : null,
        height: Number.isFinite(area?.height) && area.height > 0 ? area.height : null,
        density: Number.isFinite(area?.density) ? Math.max(0, Math.min(1, Number(area.density))) : 0.35,
        sizeVariation: Number.isFinite(area?.sizeVariation) ? Math.max(0, Math.min(1, Number(area.sizeVariation))) : 0.45,
        rotationVariation: Number.isFinite(area?.rotationVariation) ? Math.max(0, Math.min(1, Number(area.rotationVariation))) : 0.65,
        clusterStrength: Number.isFinite(area?.clusterStrength) ? Math.max(0, Math.min(1, Number(area.clusterStrength))) : 0.5,
        enabled: area?.enabled !== false,
        visible: area?.visible !== false,
      }))
      .filter((area) => area.x !== null && area.y !== null && area.width !== null && area.height !== null)
    : [];
}

function normalizeDustAreas(sourceAreas) {
  return Array.isArray(sourceAreas)
    ? sourceAreas
      .map((area, index) => ({
        id: typeof area?.id === "string" && area.id.trim() ? area.id.trim() : `dust_area_${index + 1}`,
        x: Number.isFinite(area?.x) ? area.x : null,
        y: Number.isFinite(area?.y) ? area.y : null,
        width: Number.isFinite(area?.width) && area.width > 0 ? area.width : null,
        height: Number.isFinite(area?.height) && area.height > 0 ? area.height : null,
        density: Number.isFinite(area?.density) ? Math.max(0, Math.min(1, Number(area.density))) : 0.35,
        sizeVariation: Number.isFinite(area?.sizeVariation) ? Math.max(0, Math.min(1, Number(area.sizeVariation))) : 0.45,
        driftStrength: Number.isFinite(area?.driftStrength) ? Math.max(0, Math.min(1, Number(area.driftStrength))) : 0.35,
        enabled: area?.enabled !== false,
        visible: area?.visible !== false,
      }))
      .filter((area) => area.x !== null && area.y !== null && area.width !== null && area.height !== null)
    : [];
}

function normalizeSmokeAreas(sourceAreas) {
  return Array.isArray(sourceAreas)
    ? sourceAreas
      .map((area, index) => ({
        id: typeof area?.id === "string" && area.id.trim() ? area.id.trim() : `smoke_area_${index + 1}`,
        x: Number.isFinite(area?.x) ? area.x : null,
        y: Number.isFinite(area?.y) ? area.y : null,
        width: Number.isFinite(area?.width) && area.width > 0 ? area.width : null,
        height: Number.isFinite(area?.height) && area.height > 0 ? area.height : null,
        density: Number.isFinite(area?.density) ? Math.max(0, Math.min(1, Number(area.density))) : 0.42,
        size: Number.isFinite(area?.size) ? Math.max(0, Math.min(1, Number(area.size))) : 0.58,
        strength: Number.isFinite(area?.strength) ? Math.max(0, Math.min(1, Number(area.strength))) : 0.46,
        direction: area?.direction === "up" || area?.direction === "down" || area?.direction === "left" || area?.direction === "right" || area?.direction === "random" ? area.direction : "up",
        speed: Number.isFinite(area?.speed) ? Math.max(0, Math.min(1, Number(area.speed))) : 0.28,
        enabled: area?.enabled !== false,
        visible: area?.visible !== false,
      }))
      .filter((area) => area.x !== null && area.y !== null && area.width !== null && area.height !== null)
    : [];
}


function normalizeGlowAreas(sourceAreas) {
  return Array.isArray(sourceAreas)
    ? sourceAreas
      .map((area, index) => ({
        id: typeof area?.id === "string" && area.id.trim() ? area.id.trim() : `glow_area_${index + 1}`,
        x: Number.isFinite(area?.x) ? area.x : null,
        y: Number.isFinite(area?.y) ? area.y : null,
        width: Number.isFinite(area?.width) && area.width > 0 ? area.width : null,
        height: Number.isFinite(area?.height) && area.height > 0 ? area.height : null,
        density: Number.isFinite(area?.density) ? Math.max(0, Math.min(1, Number(area.density))) : 0.32,
        sizeVariation: Number.isFinite(area?.sizeVariation) ? Math.max(0, Math.min(1, Number(area.sizeVariation))) : 0.38,
        strength: Number.isFinite(area?.strength) ? Math.max(0, Math.min(1, Number(area.strength))) : 0.42,
        direction: area?.direction === "up" || area?.direction === "down" || area?.direction === "left" || area?.direction === "right" || area?.direction === "random" ? area.direction : area?.motionMode === "updraft" ? "up" : "random",
        speed: Number.isFinite(area?.speed) ? Math.max(0, Math.min(1, Number(area.speed))) : 0.35,
        enabled: area?.enabled !== false,
        visible: area?.visible !== false,
      }))
      .filter((area) => area.x !== null && area.y !== null && area.width !== null && area.height !== null)
    : [];
}

function normalizeMirrorSurfaceAreas(sourceAreas) {
  return Array.isArray(sourceAreas)
    ? sourceAreas
      .map((area, index) => ({
        id: typeof area?.id === "string" && area.id.trim() ? area.id.trim() : `mirror_surface_${index + 1}`,
        x: Number.isFinite(area?.x) ? area.x : null,
        y: Number.isFinite(area?.y) ? area.y : null,
        width: Number.isFinite(area?.width) && area.width > 0 ? area.width : null,
        height: Number.isFinite(area?.height) && area.height > 0 ? area.height : null,
        yOffset: Number.isFinite(area?.yOffset) ? area.yOffset : 0,
        reflectionHeight: Number.isFinite(area?.reflectionHeight) && area.reflectionHeight >= 0 ? Number(area.reflectionHeight) : 72,
        reflectionStrength: Number.isFinite(area?.reflectionStrength) ? Math.max(0, Math.min(1, Number(area.reflectionStrength))) : 0.35,
        distortion: Number.isFinite(area?.distortion) ? Math.max(0, Math.min(1, Number(area.distortion))) : 0.12,
        surfaceStrength: Number.isFinite(area?.surfaceStrength) ? Math.max(0, Math.min(1, Number(area.surfaceStrength))) : 0.25,
        fade: Number.isFinite(area?.fade) ? Math.max(0, Math.min(1, Number(area.fade))) : 0.65,
        enabled: area?.enabled !== false,
        visible: area?.visible !== false,
      }))
      .filter((area) => area.x !== null && area.y !== null && area.width !== null && area.height !== null)
    : [];
}

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
  // Preserve authored Editor V2 audio entries into live Recharged world snapshots for runtime use/debuggability.
  const audioItems = Array.isArray(source.audioItems)
    ? source.audioItems
      .map((audio, index) => ({
        audioId: typeof audio?.audioId === "string" ? audio.audioId : `audio-${index + 1}`,
        audioType: typeof audio?.audioType === "string" ? audio.audioType : "ambient",
        x: Number.isFinite(audio?.x) ? audio.x : null,
        y: Number.isFinite(audio?.y) ? audio.y : null,
        source: resolveAuthoredSoundSource(audio),
        asset: typeof audio?.asset === "string" && audio.asset.trim()
          ? audio.asset
          : resolveAuthoredSoundSource(audio),
        variant: Number.isFinite(audio?.variant) || typeof audio?.variant === "string" ? audio.variant : null,
        tags: Array.isArray(audio?.tags) ? [...audio.tags] : [],
        params: audio?.params && typeof audio.params === "object" ? clonePlainData(audio.params) : {},
      }))
      .filter((audio) => audio.x !== null && audio.y !== null)
    : [];

  const mirrorSurfaceAreas = normalizeMirrorSurfaceAreas(source.mirrorSurfaceAreas);
  const stoneAreas = normalizeStoneAreas(source.stoneAreas);
  const dustAreas = normalizeDustAreas(source.dustAreas);
  const glowAreas = normalizeGlowAreas(source.glowAreas);
  const smokeAreas = normalizeSmokeAreas(source.smokeAreas);
  const waterDropAreas = Array.isArray(source.waterDropAreas) ? source.waterDropAreas.map((area) => ({ ...area })) : [];

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
    audioItems,
    mirrorSurfaceAreas,
    stoneAreas,
    dustAreas,
    glowAreas,
    smokeAreas,
    waterDropAreas,
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
