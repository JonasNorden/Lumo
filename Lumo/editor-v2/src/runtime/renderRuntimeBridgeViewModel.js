import { createRuntimeBridgeSummary } from "./createRuntimeBridgeSummary.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

function toFiniteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function toStringOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

// Reads controller snapshots when available so view-model can fallback to init/start data.
function readControllerSnapshots(bridge) {
  if (!bridge || typeof bridge.getActiveController !== "function") {
    return { controller: null, initialization: null, startResult: null };
  }

  const controller = bridge.getActiveController();
  if (!controller || typeof controller !== "object") {
    return { controller: null, initialization: null, startResult: null };
  }

  const initialization = typeof controller.getInitialization === "function" ? controller.getInitialization() : null;
  const startResult = typeof controller.getStartResult === "function" ? controller.getStartResult() : null;

  return { controller, initialization, startResult };
}

// Builds one defensive list of world-space tile bounds from runtime session world data.
function buildTileRects(world = {}) {
  const tiles = toArray(world?.layers?.tiles);
  const tileSize = toFiniteOrNull(world?.tileSize);

  if (!tileSize || tileSize <= 0) {
    return [];
  }

  return tiles
    .map((tile) => {
      const x = toFiniteOrNull(tile?.x);
      const y = toFiniteOrNull(tile?.y);
      const w = toFiniteOrNull(tile?.w) ?? 1;
      const h = toFiniteOrNull(tile?.h) ?? 1;
      if (x === null || y === null || w <= 0 || h <= 0) {
        return null;
      }

      return {
        tileId: toStringOrNull(tile?.tileId),
        x,
        y,
        w,
        h,
        worldX: x * tileSize,
        worldY: y * tileSize,
        worldW: w * tileSize,
        worldH: h * tileSize,
      };
    })
    .filter(Boolean);
}

// Normalizes background entries for simple view rendering.
function buildBackgroundLayers(world) {
  return toArray(world?.layers?.background)
    .map((entry, index) => {
      const backgroundId = toStringOrNull(entry?.backgroundId);
      const order = toFiniteOrNull(entry?.order) ?? index;
      if (backgroundId === null) {
        return null;
      }

      return {
        backgroundId,
        order,
        parallax: toFiniteOrNull(entry?.parallax),
      };
    })
    .filter(Boolean);
}

// Normalizes decor entries for simple marker rendering.
function buildDecorEntries(world) {
  return toArray(world?.layers?.decor)
    .map((entry) => {
      const decorId = toStringOrNull(entry?.decorId);
      const x = toFiniteOrNull(entry?.x);
      const y = toFiniteOrNull(entry?.y);
      if (decorId === null || x === null || y === null) {
        return null;
      }

      return {
        decorId,
        x,
        y,
        order: toFiniteOrNull(entry?.order) ?? 0,
        flip: toStringOrNull(entry?.flip),
        variant: toStringOrNull(entry?.variant),
      };
    })
    .filter(Boolean);
}

// Normalizes entity entries for simple marker rendering.
function buildEntityEntries(world) {
  return toArray(world?.layers?.entities)
    .map((entry) => {
      const entityType = toStringOrNull(entry?.entityType);
      const x = toFiniteOrNull(entry?.x);
      const y = toFiniteOrNull(entry?.y);
      if (entityType === null || x === null || y === null) {
        return null;
      }

      return {
        entityType,
        x,
        y,
      };
    })
    .filter(Boolean);
}

// Normalizes audio marker entries for simple marker/radius rendering.
function buildAudioEntries(world) {
  return toArray(world?.layers?.audio)
    .map((entry) => {
      const audioId = toStringOrNull(entry?.audioId);
      const audioType = toStringOrNull(entry?.audioType);
      const x = toFiniteOrNull(entry?.x);
      const y = toFiniteOrNull(entry?.y);
      if (audioId === null || audioType === null || x === null || y === null) {
        return null;
      }

      return {
        audioId,
        audioType,
        x,
        y,
        radius: toFiniteOrNull(entry?.radius) ?? toFiniteOrNull(entry?.params?.radius),
      };
    })
    .filter(Boolean);
}

// Picks one world source from active session, initialization, or start-result snapshots.
function resolveWorldSource({ session, initialization, startResult, bridgeStartResult }) {
  const candidates = [
    session?.world,
    initialization?.world,
    startResult?.initialization?.world,
    bridgeStartResult?.initialization?.world,
    startResult?.levelDocument,
    bridgeStartResult?.levelDocument,
  ];

  return candidates.find((candidate) => candidate && typeof candidate === "object") ?? null;
}

// Builds the first runtime bridge view-model directly from active bridge/controller/session state.
export function renderRuntimeBridgeViewModel(input = {}) {
  const errors = [];
  const warnings = [];

  const bridge = input?.bridge ?? null;
  const debugApi = input?.debugApi ?? null;
  const fallbackSummary = createRuntimeBridgeSummary({ bridgeStatus: "idle", activeController: null });

  let bridgeSummary = fallbackSummary;
  try {
    bridgeSummary = bridge ? createRuntimeBridgeSummary(bridge) : fallbackSummary;
  } catch (error) {
    errors.push(`Runtime bridge view could not build bridge summary: ${error instanceof Error ? error.message : String(error)}`);
  }

  const { controller, initialization, startResult } = readControllerSnapshots(bridge);
  const bridgeStartResult = typeof bridge?.getActiveStartResult === "function" ? bridge.getActiveStartResult() : null;

  let session = null;
  try {
    if (debugApi && typeof debugApi.getSession === "function") {
      session = debugApi.getSession();
    } else if (bridge && typeof bridge.getActiveSession === "function") {
      session = bridge.getActiveSession();
    } else if (controller && typeof controller.getSession === "function") {
      session = controller.getSession();
    }
  } catch (error) {
    errors.push(`Runtime bridge view could not read active session: ${error instanceof Error ? error.message : String(error)}`);
  }

  const worldSource = resolveWorldSource({ session, initialization, startResult, bridgeStartResult });
  const world = {
    width: toFiniteOrNull(session?.world?.width) ?? toFiniteOrNull(worldSource?.width),
    height: toFiniteOrNull(session?.world?.height) ?? toFiniteOrNull(worldSource?.height),
    tileSize: toFiniteOrNull(session?.world?.tileSize) ?? toFiniteOrNull(worldSource?.tileSize),
  };

  const viewWorld = {
    ...(worldSource ?? {}),
    ...(session?.world ?? {}),
    layers: {
      tiles: toArray(session?.world?.layers?.tiles).length > 0
        ? toArray(session?.world?.layers?.tiles)
        : toArray(worldSource?.layers?.tiles),
      background: toArray(session?.world?.layers?.background).length > 0
        ? toArray(session?.world?.layers?.background)
        : toArray(worldSource?.layers?.background),
      decor: toArray(session?.world?.layers?.decor).length > 0
        ? toArray(session?.world?.layers?.decor)
        : toArray(worldSource?.layers?.decor),
      entities: toArray(session?.world?.layers?.entities).length > 0
        ? toArray(session?.world?.layers?.entities)
        : toArray(worldSource?.layers?.entities),
      audio: toArray(session?.world?.layers?.audio).length > 0
        ? toArray(session?.world?.layers?.audio)
        : toArray(worldSource?.layers?.audio),
    },
  };

  const spawn = {
    x: toFiniteOrNull(session?.world?.spawn?.x) ?? toFiniteOrNull(worldSource?.spawn?.x),
    y: toFiniteOrNull(session?.world?.spawn?.y) ?? toFiniteOrNull(worldSource?.spawn?.y),
  };

  const player = {
    x: toFiniteOrNull(session?.player?.position?.x),
    y: toFiniteOrNull(session?.player?.position?.y),
    grounded: session?.player?.grounded === true || bridgeSummary?.grounded === true,
    falling: session?.player?.falling === true || bridgeSummary?.falling === true,
    status:
      toStringOrNull(session?.player?.mode) ??
      toStringOrNull(session?.player?.status) ??
      toStringOrNull(bridgeSummary?.playerStatus),
  };

  const tiles = buildTileRects({ ...viewWorld, ...world });
  const background = buildBackgroundLayers(viewWorld);
  const decor = buildDecorEntries(viewWorld);
  const entities = buildEntityEntries(viewWorld);
  const audio = buildAudioEntries(viewWorld);

  const runtimeTick = toFiniteOrNull(session?.runtime?.tick) ?? toFiniteOrNull(bridgeSummary?.runtimeTick);
  const bridgeStatus = toStringOrNull(bridgeSummary?.bridgeStatus) ?? "invalid";
  const controllerStatus =
    toStringOrNull(bridgeSummary?.controllerStatus) ??
    (typeof controller?.getStatus === "function" ? toStringOrNull(controller.getStatus()) : null) ??
    "invalid";

  const overlay = {
    worldId: toStringOrNull(session?.world?.identity?.id) ?? toStringOrNull(worldSource?.identity?.id) ?? toStringOrNull(bridgeSummary?.worldId),
    themeId: toStringOrNull(session?.world?.identity?.themeId) ?? toStringOrNull(worldSource?.identity?.themeId) ?? toStringOrNull(bridgeSummary?.themeId),
    runtimeTick,
    bridgeStatus,
    controllerStatus,
    playerStatus: player.status,
    grounded: player.grounded,
    falling: player.falling,
    counts: {
      tiles: tiles.length,
      background: background.length,
      decor: decor.length,
      entities: entities.length,
      audio: audio.length,
    },
    input: input?.browserInputSnapshot?.input ?? { moveX: 0, jump: false, run: false },
    loopActive: input?.browserLoop?.active === true || input?.browserLoop?.running === true,
    inputAttached: input?.browserInputSnapshot?.attached === true,
  };

  if ((session || worldSource) && (world.width === null || world.height === null || world.tileSize === null)) {
    errors.push("Runtime bridge view requires world width/height/tileSize from session or initialization data.");
  }

  warnings.push(...(bridgeSummary?.warnings ?? []));
  errors.push(...(bridgeSummary?.errors ?? []));

  const hasRuntimeWorld = world.width !== null && world.height !== null && world.tileSize !== null;

  return {
    ok: errors.length === 0 && hasRuntimeWorld,
    world,
    tiles,
    background,
    decor,
    entities,
    audio,
    spawn,
    player,
    overlay,
    errors: uniqueMessages(errors),
    warnings: uniqueMessages(warnings),
  };
}
