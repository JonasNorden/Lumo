import { buildRuntimePlayerBootstrap } from "./buildRuntimePlayerBootstrap.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

function resolveWorldSnapshot(worldPacket) {
  const identity = worldPacket?.identity;
  const world = worldPacket?.world;

  return {
    id: typeof identity?.id === "string" && identity.id.length > 0 ? identity.id : null,
    formatVersion: identity?.formatVersion ?? null,
    themeId: typeof identity?.themeId === "string" && identity.themeId.length > 0 ? identity.themeId : null,
    width: Number.isFinite(world?.width) ? world.width : null,
    height: Number.isFinite(world?.height) ? world.height : null,
    tileSize: Number.isFinite(world?.tileSize) ? world.tileSize : null,
  };
}

function isWorldBasicsUsable(world) {
  return (
    typeof world.id === "string" &&
    world.id.length > 0 &&
    Number.isFinite(world.width) &&
    Number.isFinite(world.height) &&
    Number.isFinite(world.tileSize)
  );
}

function resolvePlayerSnapshot(bootstrap) {
  if (!bootstrap || typeof bootstrap !== "object") {
    return null;
  }

  const startState = bootstrap.startState;
  const startupOutcome = bootstrap.startupOutcome;

  return {
    ok: bootstrap.ok === true,
    mode: typeof startupOutcome?.mode === "string" ? startupOutcome.mode : null,
    landed: startupOutcome?.landed === true,
    steps: Number.isFinite(startupOutcome?.steps) ? startupOutcome.steps : 0,
    startPosition: {
      x: Number.isFinite(startState?.position?.x) ? startState.position.x : null,
      y: Number.isFinite(startState?.position?.y) ? startState.position.y : null,
    },
    finalPosition: {
      x: Number.isFinite(startupOutcome?.finalPosition?.x) ? startupOutcome.finalPosition.x : null,
      y: Number.isFinite(startupOutcome?.finalPosition?.y) ? startupOutcome.finalPosition.y : null,
    },
    grounded:
      typeof startupOutcome?.grounded === "boolean"
        ? startupOutcome.grounded
        : startState?.grounded === true,
    falling:
      typeof startupOutcome?.falling === "boolean"
        ? startupOutcome.falling
        : startState?.falling === true,
    status:
      typeof startupOutcome?.status === "string"
        ? startupOutcome.status
        : typeof startState?.status === "string"
          ? startState.status
          : null,
  };
}

// Builds a compact runtime initialization packet that combines world + player startup state.
export function buildRuntimeInitializationPacket(worldPacket) {
  const world = resolveWorldSnapshot(worldPacket);
  const bootstrap = buildRuntimePlayerBootstrap(worldPacket);
  const player = resolvePlayerSnapshot(bootstrap);
  const errors = uniqueMessages(bootstrap?.errors);
  const warnings = uniqueMessages(bootstrap?.warnings);

  const worldUsable = isWorldBasicsUsable(world);
  if (!worldUsable) {
    errors.push("Runtime world basics are unusable (id/width/height/tileSize required).");
  }

  return {
    ok: worldUsable && bootstrap?.ok === true,
    world,
    player,
    errors: uniqueMessages(errors),
    warnings,
  };
}
