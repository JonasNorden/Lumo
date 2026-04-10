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

// Builds one defensive list of world-space tile bounds from runtime session world data.
function buildTileRects(world = {}) {
  const tiles = Array.isArray(world?.layers?.tiles) ? world.layers.tiles : [];
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

  let session = null;
  try {
    if (debugApi && typeof debugApi.getSession === "function") {
      session = debugApi.getSession();
    } else if (bridge && typeof bridge.getActiveSession === "function") {
      session = bridge.getActiveSession();
    }
  } catch (error) {
    errors.push(`Runtime bridge view could not read active session: ${error instanceof Error ? error.message : String(error)}`);
  }

  const world = {
    width: toFiniteOrNull(session?.world?.width),
    height: toFiniteOrNull(session?.world?.height),
    tileSize: toFiniteOrNull(session?.world?.tileSize),
  };

  const spawn = {
    x: toFiniteOrNull(session?.world?.spawn?.x),
    y: toFiniteOrNull(session?.world?.spawn?.y),
  };

  const player = {
    x: toFiniteOrNull(session?.player?.position?.x),
    y: toFiniteOrNull(session?.player?.position?.y),
    grounded: session?.player?.grounded === true,
    falling: session?.player?.falling === true,
    status: toStringOrNull(session?.player?.mode) ?? toStringOrNull(bridgeSummary?.playerStatus),
  };

  const tiles = buildTileRects(session?.world ?? {});

  if (session && (world.width === null || world.height === null || world.tileSize === null)) {
    errors.push("Runtime bridge view requires world width/height/tileSize in active session.");
  }

  const runtimeTick = toFiniteOrNull(session?.runtime?.tick) ?? toFiniteOrNull(bridgeSummary?.runtimeTick);
  const bridgeStatus = toStringOrNull(bridgeSummary?.bridgeStatus) ?? "invalid";
  const controllerStatus = toStringOrNull(bridgeSummary?.controllerStatus) ?? "invalid";

  const overlay = {
    worldId: toStringOrNull(session?.world?.identity?.id) ?? toStringOrNull(bridgeSummary?.worldId),
    themeId: toStringOrNull(session?.world?.identity?.themeId) ?? toStringOrNull(bridgeSummary?.themeId),
    runtimeTick,
    bridgeStatus,
    controllerStatus,
    playerStatus: player.status,
  };

  warnings.push(...(bridgeSummary?.warnings ?? []));
  errors.push(...(bridgeSummary?.errors ?? []));

  const hasRuntimeWorld = world.width !== null && world.height !== null && world.tileSize !== null;

  return {
    ok: errors.length === 0 && hasRuntimeWorld,
    world,
    tiles,
    spawn,
    player,
    overlay,
    errors: uniqueMessages(errors),
    warnings: uniqueMessages(warnings),
  };
}
