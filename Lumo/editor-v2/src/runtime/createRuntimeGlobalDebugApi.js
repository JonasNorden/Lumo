import { createRuntimeBridgeSummary } from "./createRuntimeBridgeSummary.js";

// Creates a tiny debug-first API facade over the runtime bridge for browser/Node usage.
export function createRuntimeGlobalDebugApi(bridge, options = {}) {
  if (!bridge || typeof bridge !== "object") {
    return {
      ok: false,
      debugApi: null,
      errors: ["Runtime global debug API requires a runtime bridge instance."],
      warnings: [],
    };
  }

  const debugApi = {
    startFromLevelPath(levelPath, startOptions = {}) {
      return bridge.startFromLevelPath(levelPath, startOptions);
    },
    startFromLevelDocument(levelDocument, startOptions = {}) {
      return bridge.startFromLevelDocument(levelDocument, startOptions);
    },
    tick(tickOptions = {}) {
      return bridge.tick(tickOptions);
    },
    update(updateOptions = {}) {
      return bridge.update(updateOptions);
    },
    pause() {
      return bridge.pause();
    },
    resume() {
      return bridge.resume();
    },
    reset() {
      return bridge.reset();
    },
    restart() {
      return bridge.restart();
    },
    clear() {
      return bridge.clear();
    },
    getStatus() {
      return bridge.getStatus();
    },
    getSummary() {
      return createRuntimeBridgeSummary(bridge);
    },
    getSnapshot() {
      return bridge.getActiveDebugSnapshot();
    },
  };

  return {
    ok: true,
    debugApi,
    errors: [],
    warnings: Array.isArray(options?.warnings) ? options.warnings : [],
  };
}
