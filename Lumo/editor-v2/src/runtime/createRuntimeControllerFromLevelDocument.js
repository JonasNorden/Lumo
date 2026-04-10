import { createRuntimeController } from "./createRuntimeController.js";
import { startRuntimeFromLevelDocument } from "./startRuntimeFromLevelDocument.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Starts runtime from an in-memory level document and wraps it in a controller instance.
export function createRuntimeControllerFromLevelDocument(levelDocument, options = {}) {
  const startOptions = options?.startOptions ?? options?.runtimeStartOptions ?? {};
  const startResult = startRuntimeFromLevelDocument(levelDocument, startOptions);

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
      type: "document",
      levelDocument,
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
