function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Attaches the runtime debug API to globalThis using a stable configurable key.
export function attachRuntimeDebugApi(debugApi, options = {}) {
  const errors = [];
  const warnings = [];

  if (!debugApi || typeof debugApi !== "object") {
    return {
      ok: false,
      attached: false,
      globalKey: null,
      errors: ["attachRuntimeDebugApi requires a debug API object."],
      warnings,
    };
  }

  if (typeof globalThis === "undefined" || !globalThis) {
    return {
      ok: false,
      attached: false,
      globalKey: null,
      errors: ["attachRuntimeDebugApi could not find globalThis."],
      warnings,
    };
  }

  const globalKey = typeof options?.globalKey === "string" && options.globalKey.length > 0
    ? options.globalKey
    : "LumoRuntimeDebug";

  const overwrite = options?.overwrite === true;
  const existing = globalThis[globalKey];

  if (existing && existing !== debugApi && !overwrite) {
    return {
      ok: false,
      attached: false,
      globalKey,
      errors: [
        `attachRuntimeDebugApi refused to overwrite existing globalThis.${globalKey}. Pass { overwrite: true } to replace it.`,
      ],
      warnings,
    };
  }

  if (existing && existing !== debugApi && overwrite) {
    warnings.push(`attachRuntimeDebugApi overwrote existing globalThis.${globalKey}.`);
  }

  if (existing === debugApi) {
    warnings.push(`attachRuntimeDebugApi found debug API already attached on globalThis.${globalKey}.`);
  }

  globalThis[globalKey] = debugApi;

  return {
    ok: true,
    attached: true,
    globalKey,
    errors: uniqueMessages(errors),
    warnings: uniqueMessages(warnings),
  };
}
