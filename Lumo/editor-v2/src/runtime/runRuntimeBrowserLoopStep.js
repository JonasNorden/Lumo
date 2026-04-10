function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Runs one browser runtime loop frame with normalized input piped into bridge/controller playback.
export async function runRuntimeBrowserLoopStep(options = {}) {
  const debugApi = options?.debugApi ?? null;
  const now = Number.isFinite(options?.now) ? options.now : Date.now();
  const input = options?.inputState && typeof options.inputState.getNormalizedInput === "function"
    ? options.inputState.getNormalizedInput()
    : (options?.input ?? { moveX: 0, jump: false, run: false });

  if (!debugApi || typeof debugApi.advanceFrame !== "function") {
    return {
      ok: false,
      result: null,
      input,
      loopShouldContinue: false,
      errors: ["Runtime browser loop step requires debugApi.advanceFrame."],
      warnings: [],
    };
  }

  try {
    const frameResult = await debugApi.advanceFrame({
      now,
      input,
    });

    const playbackStatus = frameResult?.playback?.status ?? "stopped";
    return {
      ok: frameResult?.ok === true,
      result: frameResult,
      input,
      stepped: frameResult?.stepped === true,
      playbackStatus,
      loopShouldContinue: playbackStatus === "running",
      errors: uniqueMessages(frameResult?.errors),
      warnings: uniqueMessages(frameResult?.warnings),
    };
  } catch (error) {
    return {
      ok: false,
      result: null,
      input,
      loopShouldContinue: false,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
    };
  }
}
