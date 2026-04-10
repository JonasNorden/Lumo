function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function resolveSessionWorld(world) {
  return {
    identity: world?.identity ?? null,
    meta: world?.meta ?? null,
    spawn: world?.spawn ?? null,
    tileBounds: world?.tileBounds ?? null,
    tileMapSummary: world?.tileMapSummary ?? null,
    layers: {
      tiles: Array.isArray(world?.layers?.tiles) ? [...world.layers.tiles] : [],
    },
    width: isFiniteNumber(world?.width) ? world.width : null,
    height: isFiniteNumber(world?.height) ? world.height : null,
    tileSize: isFiniteNumber(world?.tileSize) ? world.tileSize : null,
  };
}

function resolveSessionPlayer(player) {
  return {
    ok: player?.ok === true,
    mode: typeof player?.mode === "string" ? player.mode : null,
    position: {
      x: isFiniteNumber(player?.finalPosition?.x) ? player.finalPosition.x : null,
      y: isFiniteNumber(player?.finalPosition?.y) ? player.finalPosition.y : null,
    },
    velocity: {
      x: isFiniteNumber(player?.finalVelocity?.x) ? player.finalVelocity.x : null,
      y: isFiniteNumber(player?.finalVelocity?.y) ? player.finalVelocity.y : null,
    },
    grounded: player?.grounded === true,
    falling: player?.falling === true,
    spawnSource: "authored-spawn",
    landed: player?.landed === true,
    steps: isFiniteNumber(player?.steps) ? player.steps : 0,
  };
}

// Builds the first compact gameplay-facing runtime session/state object from initialization output.
export function buildRuntimeSessionState(initializationPacket) {
  const errors = uniqueMessages(initializationPacket?.errors);
  const warnings = uniqueMessages(initializationPacket?.warnings);

  if (!initializationPacket || typeof initializationPacket !== "object") {
    return {
      ok: false,
      session: null,
      errors: uniqueMessages([...errors, "Runtime initialization packet is missing."]),
      warnings,
    };
  }

  if (initializationPacket.ok !== true) {
    return {
      ok: false,
      session: null,
      errors: uniqueMessages([
        ...errors,
        "Runtime initialization packet is invalid and cannot build a session.",
      ]),
      warnings,
    };
  }

  const session = {
    status: "ready",
    startedAt: null,
    world: resolveSessionWorld(initializationPacket.world),
    player: resolveSessionPlayer(initializationPacket.player),
    runtime: {
      tick: 0,
      elapsedMs: 0,
      paused: false,
    },
    debug: {
      readiness: "ready",
      missing: [],
      warnings,
      errors: [],
    },
  };

  return {
    ok: true,
    session,
    errors: [],
    warnings,
  };
}
