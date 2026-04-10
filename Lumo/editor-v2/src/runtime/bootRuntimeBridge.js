import { attachRuntimeDebugApi } from "./attachRuntimeDebugApi.js";
import { createRuntimeBridge } from "./createRuntimeBridge.js";
import { createRuntimeBridgeSummary } from "./createRuntimeBridgeSummary.js";
import { createRuntimeGlobalDebugApi } from "./createRuntimeGlobalDebugApi.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Boots a debug-first runtime bridge surface with optional auto-start and global API attach.
export async function bootRuntimeBridge(options = {}) {
  const errors = [];
  const warnings = [];
  let stage = "create-bridge";

  const bridgeResult = createRuntimeBridge(options?.bridgeOptions ?? {});
  if (bridgeResult?.ok !== true || !bridgeResult?.bridge) {
    return {
      ok: false,
      bridge: null,
      debugApi: null,
      startResult: null,
      attachResult: null,
      errors: uniqueMessages(["bootRuntimeBridge could not create runtime bridge.", ...(bridgeResult?.errors ?? [])]),
      warnings: uniqueMessages([...(bridgeResult?.warnings ?? [])]),
      debug: {
        stage,
        autoStart: options?.autoStart === true,
        attached: false,
        bridgeStatus: "invalid",
        worldId: null,
        themeId: null,
      },
    };
  }

  const bridge = bridgeResult.bridge;
  errors.push(...(bridgeResult.errors ?? []));
  warnings.push(...(bridgeResult.warnings ?? []));

  stage = "create-debug-api";
  const debugApiResult = createRuntimeGlobalDebugApi(bridge);
  if (debugApiResult?.ok !== true || !debugApiResult?.debugApi) {
    return {
      ok: false,
      bridge,
      debugApi: null,
      startResult: null,
      attachResult: null,
      errors: uniqueMessages(["bootRuntimeBridge could not create runtime debug API.", ...(debugApiResult?.errors ?? [])]),
      warnings: uniqueMessages([...(debugApiResult?.warnings ?? []), ...warnings]),
      debug: {
        stage,
        autoStart: options?.autoStart === true,
        attached: false,
        bridgeStatus: bridge.getStatus(),
        worldId: null,
        themeId: null,
      },
    };
  }

  const debugApi = debugApiResult.debugApi;
  warnings.push(...(debugApiResult.warnings ?? []));

  let startResult = null;
  if (options?.autoStart === true) {
    stage = "auto-start";

    if (options?.levelDocument) {
      startResult = await debugApi.startFromLevelDocument(options.levelDocument, options?.startOptions ?? {});
    } else if (typeof options?.levelPath === "string" && options.levelPath.length > 0) {
      startResult = await debugApi.startFromLevelPath(options.levelPath, options?.startOptions ?? {});
    } else {
      errors.push("bootRuntimeBridge autoStart requires levelDocument or levelPath.");
    }

    if (startResult?.ok !== true) {
      errors.push(...(startResult?.errors ?? []));
      warnings.push(...(startResult?.warnings ?? []));
    }
  }

  let attachResult = null;
  if (options?.attachDebugApi === true) {
    stage = "attach-debug-api";
    attachResult = attachRuntimeDebugApi(debugApi, {
      globalKey: options?.globalKey,
      overwrite: options?.overwriteGlobalDebugApi === true,
    });

    if (attachResult?.ok !== true) {
      errors.push(...(attachResult?.errors ?? []));
      warnings.push(...(attachResult?.warnings ?? []));
    } else {
      warnings.push(...(attachResult?.warnings ?? []));
    }
  }

  const summary = createRuntimeBridgeSummary(bridge);

  return {
    ok: errors.length === 0,
    bridge,
    debugApi,
    startResult,
    attachResult,
    errors: uniqueMessages(errors),
    warnings: uniqueMessages(warnings),
    debug: {
      stage: errors.length === 0 ? "ready" : stage,
      autoStart: options?.autoStart === true,
      attached: attachResult?.attached === true,
      bridgeStatus: bridge.getStatus(),
      worldId: summary.worldId,
      themeId: summary.themeId,
    },
  };
}
