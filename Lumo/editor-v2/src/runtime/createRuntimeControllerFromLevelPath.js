import { createRuntimeController } from "./createRuntimeController.js";
import { startRuntimeFromLevelPath } from "./startRuntimeFromLevelPath.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Starts runtime from a path/URL and immediately wraps it in a controller instance.
export async function createRuntimeControllerFromLevelPath(levelPath, options = {}) {
  const startOptions = options?.startOptions ?? options?.runtimeStartOptions ?? {};
  const startResult = await startRuntimeFromLevelPath(levelPath, startOptions);

  if (startResult?.ok !== true || !startResult?.session) {
    return {
      ok: false,
      controller: null,
      startResult,
      errors: uniqueMessages(startResult?.errors),
      warnings: uniqueMessages(startResult?.warnings),
    };
  }

  const controllerResult = createRuntimeController(startResult, {
    source: {
      type: "path",
      levelPath,
      levelDocument: startResult?.levelDocument ?? null,
      startOptions,
    },
  });

  return {
    ok: controllerResult?.ok === true && Boolean(controllerResult?.controller),
    controller: controllerResult?.controller ?? null,
    startResult,
    errors: uniqueMessages([...(startResult?.errors ?? []), ...(controllerResult?.errors ?? [])]),
    warnings: uniqueMessages([...(startResult?.warnings ?? []), ...(controllerResult?.warnings ?? [])]),
  };
}
