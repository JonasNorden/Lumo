function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

function toFiniteNumber(value, fallback) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function toPositiveInteger(value, fallback) {
  const normalized = Math.floor(toFiniteNumber(value, fallback));
  return normalized > 0 ? normalized : fallback;
}

// Builds the compact playback driver state used by controller/bridge/browser loop layers.
export function buildRuntimePlaybackState(rawState = {}) {
  if (!rawState || typeof rawState !== "object") {
    return {
      ok: false,
      state: {
        running: false,
        paused: false,
        autoAdvance: false,
        tickRate: 4,
        stepsPerFrame: 1,
        lastUpdateAt: null,
        accumulatedMs: 0,
        frameCounter: 0,
        status: "stopped",
      },
      errors: ["Runtime playback state requires an object input."],
      warnings: [],
    };
  }

  const warnings = [];
  const tickRate = toPositiveInteger(rawState.tickRate, 4);
  if (tickRate !== rawState.tickRate && rawState.tickRate !== undefined) {
    warnings.push("Runtime playback tickRate was normalized to a positive integer.");
  }

  const stepsPerFrame = toPositiveInteger(rawState.stepsPerFrame ?? rawState.stepSize, 1);
  if (stepsPerFrame !== (rawState.stepsPerFrame ?? rawState.stepSize) && (rawState.stepsPerFrame ?? rawState.stepSize) !== undefined) {
    warnings.push("Runtime playback stepsPerFrame was normalized to a positive integer.");
  }

  const running = rawState.running === true;
  const paused = running ? rawState.paused === true : false;
  const autoAdvance = running && paused !== true && rawState.autoAdvance !== false;
  const lastUpdateAt = Number.isFinite(rawState.lastUpdateAt) ? rawState.lastUpdateAt : null;
  const accumulatedMs = Math.max(0, toFiniteNumber(rawState.accumulatedMs, 0));
  const frameCounter = Math.max(0, toPositiveInteger(rawState.frameCounter ?? 0, 0));

  let status = "stopped";
  if (running && paused) {
    status = "paused";
  } else if (running) {
    status = "running";
  } else if (rawState.ready === true) {
    status = "ready";
  }

  return {
    ok: true,
    state: {
      running,
      paused,
      autoAdvance,
      tickRate,
      stepsPerFrame,
      lastUpdateAt,
      accumulatedMs,
      frameCounter,
      status,
    },
    errors: [],
    warnings: uniqueMessages(warnings),
  };
}
