import { buildRuntimeWorldSkeleton } from "./buildRuntimeWorldSkeleton.js";
import { buildRuntimeTileEntries } from "./buildRuntimeTileEntries.js";
import { buildRuntimeTileBounds } from "./buildRuntimeTileBounds.js";
import { buildRuntimeTileMap } from "./buildRuntimeTileMap.js";
import { buildRuntimeWorldPacket } from "./buildRuntimeWorldPacket.js";
import { buildRuntimeInitializationPacket } from "./buildRuntimeInitializationPacket.js";
import { stepRuntimePlayerSimulation } from "./stepRuntimePlayerSimulation.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

function buildSafeState() {
  return {
    ok: false,
    tick: 0,
    playerState: null,
    world: null,
    entities: [],
    status: "idle",
    lastStep: null,
    errors: [],
    warnings: [],
  };
}

// Builds one runtime initialization packet from an authored level document.
function buildInitializationFromLevel(levelDocument) {
  if (!levelDocument || typeof levelDocument !== "object") {
    return {
      ok: false,
      initialization: null,
      worldPacket: null,
      errors: ["Runtime runner requires options.levelDocument as an object."],
      warnings: [],
    };
  }

  try {
    const skeleton = buildRuntimeWorldSkeleton(levelDocument);
    const tileEntries = buildRuntimeTileEntries(skeleton);
    const tileBounds = buildRuntimeTileBounds(tileEntries);
    const tileMap = buildRuntimeTileMap(tileEntries);
    const worldPacket = buildRuntimeWorldPacket({ skeleton, tileBounds, tileMap });
    const initialization = buildRuntimeInitializationPacket(worldPacket);

    return {
      ok: initialization?.ok === true,
      initialization,
      worldPacket,
      errors: uniqueMessages(initialization?.errors),
      warnings: uniqueMessages(initialization?.warnings),
    };
  } catch (error) {
    return {
      ok: false,
      initialization: null,
      worldPacket: null,
      errors: [error instanceof Error ? error.message : "Runtime runner initialization failed."],
      warnings: [],
    };
  }
}

function cloneState(state) {
  return {
    ok: state.ok === true,
    tick: Number.isFinite(state.tick) ? state.tick : 0,
    playerState: state.playerState
      ? {
          ...state.playerState,
          position: {
            x: Number.isFinite(state?.playerState?.position?.x) ? state.playerState.position.x : null,
            y: Number.isFinite(state?.playerState?.position?.y) ? state.playerState.position.y : null,
          },
          velocity: {
            x: Number.isFinite(state?.playerState?.velocity?.x) ? state.playerState.velocity.x : 0,
            y: Number.isFinite(state?.playerState?.velocity?.y) ? state.playerState.velocity.y : 0,
          },
          flares: Array.isArray(state?.playerState?.flares)
            ? state.playerState.flares.map((flare) => ({ ...flare }))
            : [],
          entities: Array.isArray(state?.playerState?.entities)
            ? state.playerState.entities.map((entity) => ({ ...entity }))
            : [],
        }
      : null,
    world: state.world ? { ...state.world } : null,
    entities: Array.isArray(state.entities) ? state.entities.map((entity) => ({ ...entity })) : [],
    status: typeof state.status === "string" ? state.status : "idle",
    lastStep: state.lastStep ? { ...state.lastStep } : null,
    errors: Array.isArray(state.errors) ? [...state.errors] : [],
    warnings: Array.isArray(state.warnings) ? [...state.warnings] : [],
  };
}

function createSummary(state) {
  return {
    ok: state.ok === true,
    tick: Number.isFinite(state.tick) ? state.tick : 0,
    status: typeof state.status === "string" ? state.status : "idle",
    player: {
      x: Number.isFinite(state?.playerState?.position?.x) ? state.playerState.position.x : null,
      y: Number.isFinite(state?.playerState?.position?.y) ? state.playerState.position.y : null,
      grounded: state?.playerState?.grounded === true,
      falling: state?.playerState?.falling === true,
      locomotion: typeof state?.playerState?.locomotion === "string" ? state.playerState.locomotion : null,
    },
  };
}

// Creates a minimal deterministic runtime runner that is independent from bridge/browser layers.
export function createRuntimeRunner(options = {}) {
  const levelDocument = options?.levelDocument;
  const runtimeState = buildSafeState();
  let lastBuild = buildInitializationFromLevel(levelDocument);

  if (lastBuild.ok === true && lastBuild.initialization) {
    runtimeState.ok = true;
    runtimeState.world = lastBuild.worldPacket;
    runtimeState.entities = [];
    runtimeState.playerState = {
      position: {
        x: lastBuild.initialization.player?.finalPosition?.x ?? null,
        y: lastBuild.initialization.player?.finalPosition?.y ?? null,
      },
      velocity: {
        x: lastBuild.initialization.player?.finalVelocity?.x ?? 0,
        y: lastBuild.initialization.player?.finalVelocity?.y ?? 0,
      },
      grounded: lastBuild.initialization.player?.grounded === true,
      falling: lastBuild.initialization.player?.falling === true,
      rising: false,
      landed: lastBuild.initialization.player?.landed === true,
      locomotion:
        typeof lastBuild.initialization.player?.status === "string"
          ? lastBuild.initialization.player.status
          : lastBuild.initialization.player?.grounded === true
            ? "idle-grounded"
            : "falling",
      status: typeof lastBuild.initialization.player?.status === "string" ? lastBuild.initialization.player.status : "ready",
      flares: [],
      flareHeldLastTick: false,
      pulse: { active: false, r: 0, alpha: 0, thickness: 3, id: 0 },
      pulseHeldLastTick: false,
      boostActive: false,
      energy: 1,
      facingX: 1,
      nextFlareId: 1,
      entities: [],
    };
    runtimeState.errors = [];
    runtimeState.warnings = uniqueMessages(lastBuild.warnings);
  } else {
    runtimeState.ok = false;
    runtimeState.errors = uniqueMessages(lastBuild.errors);
    runtimeState.warnings = uniqueMessages(lastBuild.warnings);
  }

  const api = {
    ok: runtimeState.ok,

    // Returns a defensive snapshot of the internal runtime state.
    getState() {
      return cloneState(runtimeState);
    },

    // Returns a compact runner summary for simple status/hud integration.
    getSummary() {
      return createSummary(runtimeState);
    },

    // Marks the runner as running; stepping remains manual for deterministic control.
    start() {
      if (runtimeState.ok !== true) {
        return { ok: false, state: cloneState(runtimeState) };
      }

      runtimeState.status = "running";
      return { ok: true, state: cloneState(runtimeState) };
    },

    // Runs exactly one simulation tick when running and valid.
    step(stepOptions = {}) {
      if (runtimeState.ok !== true || runtimeState.status !== "running") {
        return { ok: runtimeState.ok === true, stepped: false, state: cloneState(runtimeState) };
      }

      try {
        const result = stepRuntimePlayerSimulation(runtimeState.world, runtimeState.playerState, {
          ...stepOptions,
          entities: runtimeState.entities,
        });
        runtimeState.lastStep = result ?? null;

        if (result?.ok !== true || !result?.player) {
          runtimeState.ok = false;
          runtimeState.status = "stopped";
          runtimeState.errors = uniqueMessages(result?.errors);
          runtimeState.warnings = uniqueMessages(result?.warnings);
          api.ok = false;
          return { ok: false, stepped: false, state: cloneState(runtimeState) };
        }

        runtimeState.playerState = {
          ...runtimeState.playerState,
          ...result.player,
        };
        runtimeState.entities = Array.isArray(result?.entities)
          ? result.entities.map((entity) => ({ ...entity }))
          : runtimeState.entities;
        runtimeState.tick += 1;
        runtimeState.errors = uniqueMessages(result.errors);
        runtimeState.warnings = uniqueMessages(result.warnings);
        api.ok = runtimeState.ok;
        return { ok: true, stepped: true, state: cloneState(runtimeState) };
      } catch (error) {
        runtimeState.ok = false;
        runtimeState.status = "stopped";
        runtimeState.errors = [error instanceof Error ? error.message : "Runtime step failed unexpectedly."];
        api.ok = false;
        return { ok: false, stepped: false, state: cloneState(runtimeState) };
      }
    },

    // Runs N manual ticks safely and stops early on invalid step outcomes.
    runSteps(steps = 1, stepOptions = {}) {
      const normalizedSteps = Number.isInteger(steps) && steps > 0 ? steps : 0;
      let stepsRun = 0;

      for (let index = 0; index < normalizedSteps; index += 1) {
        const stepResult = api.step(stepOptions);
        if (stepResult?.stepped !== true) {
          break;
        }
        stepsRun += 1;

        if (runtimeState.ok !== true) {
          break;
        }
      }

      return {
        ok: runtimeState.ok === true,
        stepsRequested: normalizedSteps,
        stepsRun,
        state: cloneState(runtimeState),
      };
    },

    // Stops manual stepping without destroying state.
    stop() {
      runtimeState.status = "stopped";
      return { ok: runtimeState.ok === true, state: cloneState(runtimeState) };
    },

    // Rebuilds initialization from the original level and resets runner tick/player state.
    reset() {
      lastBuild = buildInitializationFromLevel(levelDocument);
      const next = buildSafeState();

      if (lastBuild.ok === true && lastBuild.initialization) {
        next.ok = true;
        next.world = lastBuild.worldPacket;
        next.entities = [];
        next.playerState = {
          position: {
            x: lastBuild.initialization.player?.finalPosition?.x ?? null,
            y: lastBuild.initialization.player?.finalPosition?.y ?? null,
          },
          velocity: {
            x: lastBuild.initialization.player?.finalVelocity?.x ?? 0,
            y: lastBuild.initialization.player?.finalVelocity?.y ?? 0,
          },
          grounded: lastBuild.initialization.player?.grounded === true,
          falling: lastBuild.initialization.player?.falling === true,
          rising: false,
          landed: lastBuild.initialization.player?.landed === true,
          locomotion:
            typeof lastBuild.initialization.player?.status === "string"
              ? lastBuild.initialization.player.status
              : lastBuild.initialization.player?.grounded === true
                ? "idle-grounded"
                : "falling",
          status: typeof lastBuild.initialization.player?.status === "string" ? lastBuild.initialization.player.status : "ready",
          flares: [],
          flareHeldLastTick: false,
          pulse: { active: false, r: 0, alpha: 0, thickness: 3, id: 0 },
          pulseHeldLastTick: false,
          boostActive: false,
          energy: 1,
          facingX: 1,
          nextFlareId: 1,
          entities: [],
        };
        next.warnings = uniqueMessages(lastBuild.warnings);
      } else {
        next.ok = false;
        next.errors = uniqueMessages(lastBuild.errors);
        next.warnings = uniqueMessages(lastBuild.warnings);
      }

      runtimeState.ok = next.ok;
      runtimeState.tick = next.tick;
      runtimeState.playerState = next.playerState;
      runtimeState.world = next.world;
      runtimeState.entities = next.entities;
      runtimeState.status = next.status;
      runtimeState.lastStep = next.lastStep;
      runtimeState.errors = next.errors;
      runtimeState.warnings = next.warnings;
      api.ok = runtimeState.ok;

      return { ok: runtimeState.ok === true, state: cloneState(runtimeState) };
    },
  };

  return api;
}
