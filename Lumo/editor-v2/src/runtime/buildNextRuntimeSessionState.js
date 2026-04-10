import { stepRuntimePlayerSimulation } from "./stepRuntimePlayerSimulation.js";

const FIXED_RUNTIME_TICK_MS = 16;

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Accept either a wrapper ({ ok, session, ... }) or the raw session object.
function getSourceSession(sessionState) {
  if (sessionState && typeof sessionState === "object" && sessionState.session) {
    return sessionState.session;
  }

  return sessionState;
}

// Build a defensive copy so one-tick stepping never mutates caller-owned state.
function cloneSessionForStep(sessionState) {
  const source = getSourceSession(sessionState);

  if (!source || typeof source !== "object") {
    return null;
  }

  return {
    ...source,
    world: {
      ...(source.world ?? {}),
      layers: {
        tiles: Array.isArray(source?.world?.layers?.tiles) ? [...source.world.layers.tiles] : [],
      },
    },
    player: {
      ...(source.player ?? {}),
      position: {
        x: Number.isFinite(source?.player?.position?.x) ? source.player.position.x : null,
        y: Number.isFinite(source?.player?.position?.y) ? source.player.position.y : null,
      },
      velocity: {
        x: Number.isFinite(source?.player?.velocity?.x) ? source.player.velocity.x : 0,
        y: Number.isFinite(source?.player?.velocity?.y) ? source.player.velocity.y : 0,
      },
    },
    runtime: {
      tick: Number.isFinite(source?.runtime?.tick) ? source.runtime.tick : 0,
      elapsedMs: Number.isFinite(source?.runtime?.elapsedMs) ? source.runtime.elapsedMs : 0,
      paused: source?.runtime?.paused === true,
    },
    debug: {
      ...(source.debug ?? {}),
      warnings: Array.isArray(source?.debug?.warnings) ? [...source.debug.warnings] : [],
      errors: Array.isArray(source?.debug?.errors) ? [...source.debug.errors] : [],
    },
  };
}

// Validate the minimal runtime fields required to run exactly one deterministic tick.
function validateSessionForStep(session) {
  const errors = [];

  if (!session || typeof session !== "object") {
    errors.push("Runtime session state is missing.");
    return errors;
  }

  if (!Number.isFinite(session?.world?.tileSize) || session.world.tileSize <= 0) {
    errors.push("Runtime session world.tileSize is missing or invalid.");
  }

  if (!Number.isFinite(session?.player?.position?.x) || !Number.isFinite(session?.player?.position?.y)) {
    errors.push("Runtime session player.position is missing or invalid.");
  }

  if (!session.runtime || typeof session.runtime !== "object") {
    errors.push("Runtime session runtime metadata is missing.");
  }

  return errors;
}

// Builds the next session state by running one runtime simulation tick with optional input intent.
export function buildNextRuntimeSessionState(sessionState, options = {}) {
  const session = cloneSessionForStep(sessionState);
  const validationErrors = validateSessionForStep(session);

  if (validationErrors.length > 0) {
    return {
      ok: false,
      session: null,
      errors: uniqueMessages(validationErrors),
      warnings: [],
      step: {
        stepped: false,
        status: "invalid-session-state",
      },
    };
  }

  if (session.runtime.paused === true) {
    const pausedWarning = "Runtime session is paused; skipped one-step update.";

    session.status = "paused";
    session.debug = {
      ...(session.debug ?? {}),
      lastStep: {
        tick: session.runtime.tick,
        status: "paused",
        stepped: false,
      },
      warnings: uniqueMessages([...(session?.debug?.warnings ?? []), pausedWarning]),
    };

    return {
      ok: true,
      session,
      errors: [],
      warnings: [pausedWarning],
      step: {
        stepped: false,
        status: "paused",
      },
    };
  }

  const worldPacket = {
    world: {
      width: session?.world?.width,
      height: session?.world?.height,
      tileSize: session?.world?.tileSize,
    },
    layers: {
      tiles: Array.isArray(session?.world?.layers?.tiles) ? session.world.layers.tiles : [],
    },
  };

  const playerStep = stepRuntimePlayerSimulation(worldPacket, session.player, options);
  if (playerStep.ok !== true) {
    return {
      ok: false,
      session: null,
      errors: uniqueMessages(playerStep.errors),
      warnings: uniqueMessages(playerStep.warnings),
      step: {
        stepped: false,
        status: playerStep.status ?? "step-failed",
      },
    };
  }

  session.player.position = {
    x: playerStep.player.position.x,
    y: playerStep.player.position.y,
  };
  session.player.velocity = {
    x: playerStep.player.velocity.x,
    y: playerStep.player.velocity.y,
  };
  session.player.grounded = playerStep.player.grounded === true;
  session.player.falling = playerStep.player.falling === true;
  session.player.status = typeof playerStep.status === "string" ? playerStep.status : session.player.status;
  session.runtime.tick += 1;
  session.runtime.elapsedMs += FIXED_RUNTIME_TICK_MS;
  session.status = "running";
  session.debug = {
    ...(session.debug ?? {}),
    lastStep: {
      tick: session.runtime.tick,
      status: playerStep.status,
      stepped: true,
      moveX: playerStep?.debug?.intent?.moveX ?? 0,
      blockedLeft: playerStep?.collisions?.blockedLeft === true,
      blockedRight: playerStep?.collisions?.blockedRight === true,
      grounded: playerStep.player.grounded === true,
      falling: playerStep.player.falling === true,
    },
  };

  return {
    ok: true,
    session,
    errors: uniqueMessages(playerStep.errors),
    warnings: uniqueMessages(playerStep.warnings),
    step: {
      stepped: true,
      status: playerStep.status ?? "updated",
      moveX: playerStep?.debug?.intent?.moveX ?? 0,
      blockedLeft: playerStep?.collisions?.blockedLeft === true,
      blockedRight: playerStep?.collisions?.blockedRight === true,
      grounded: playerStep.player.grounded === true,
      falling: playerStep.player.falling === true,
      debug: playerStep.debug,
    },
  };
}
