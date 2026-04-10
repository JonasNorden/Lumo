import { buildRuntimeWorldSkeleton } from "./buildRuntimeWorldSkeleton.js";
import { buildRuntimeTileEntries } from "./buildRuntimeTileEntries.js";
import { buildRuntimeTileBounds } from "./buildRuntimeTileBounds.js";
import { buildRuntimeTileMap } from "./buildRuntimeTileMap.js";
import { buildRuntimeWorldPacket } from "./buildRuntimeWorldPacket.js";
import { buildRuntimeInitializationPacket } from "./buildRuntimeInitializationPacket.js";
import { buildRuntimeSessionState } from "./buildRuntimeSessionState.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

function buildRunnerSessionDebug(initialization, session) {
  return {
    worldId: initialization?.world?.id ?? null,
    themeId: initialization?.world?.themeId ?? null,
    spawn: {
      x: Number.isFinite(initialization?.world?.spawn?.x) ? initialization.world.spawn.x : null,
      y: Number.isFinite(initialization?.world?.spawn?.y) ? initialization.world.spawn.y : null,
    },
    playerMode: typeof initialization?.player?.mode === "string" ? initialization.player.mode : null,
    runtimeTick: Number.isFinite(session?.runtime?.tick) ? session.runtime.tick : null,
  };
}

// Builds one start-ready runtime runner session from a loaded Recharged level document.
export function createRuntimeRunnerSession(levelDocument) {
  if (!levelDocument || typeof levelDocument !== "object") {
    const errors = ["Runtime runner session requires a loaded level document object."];
    return {
      ok: false,
      session: null,
      initialization: null,
      errors,
      warnings: [],
      debug: {
        stage: "create-runtime-runner-session",
        worldId: null,
        themeId: null,
        spawn: { x: null, y: null },
        playerMode: null,
        runtimeTick: null,
      },
    };
  }

  // Compose the existing Recharged world-build helpers into one packet for initialization.
  const skeleton = buildRuntimeWorldSkeleton(levelDocument);
  const tileEntries = buildRuntimeTileEntries(skeleton);
  const tileBounds = buildRuntimeTileBounds(tileEntries);
  const tileMap = buildRuntimeTileMap(tileEntries);
  const worldPacket = buildRuntimeWorldPacket({ skeleton, tileBounds, tileMap });

  // Build runtime initialization and fail early if the packet is not usable.
  const initialization = buildRuntimeInitializationPacket(worldPacket);
  if (initialization?.ok !== true) {
    return {
      ok: false,
      session: null,
      initialization,
      errors: uniqueMessages(initialization?.errors),
      warnings: uniqueMessages(initialization?.warnings),
      debug: buildRunnerSessionDebug(initialization, null),
    };
  }

  // Build first runtime session state from initialization output.
  const sessionResult = buildRuntimeSessionState(initialization);
  if (sessionResult?.ok !== true || !sessionResult?.session) {
    return {
      ok: false,
      session: null,
      initialization,
      errors: uniqueMessages(sessionResult?.errors),
      warnings: uniqueMessages([...(initialization?.warnings ?? []), ...(sessionResult?.warnings ?? [])]),
      debug: buildRunnerSessionDebug(initialization, null),
    };
  }

  return {
    ok: true,
    session: sessionResult.session,
    initialization,
    errors: [],
    warnings: uniqueMessages([...(initialization?.warnings ?? []), ...(sessionResult?.warnings ?? [])]),
    debug: buildRunnerSessionDebug(initialization, sessionResult.session),
  };
}
