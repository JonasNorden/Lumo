export function isSupportedEntityParamValue(value) {
  if (typeof value === "string" || typeof value === "boolean") {
    return true;
  }

  return typeof value === "number" && Number.isFinite(value);
}

export function cloneEntityParams(params) {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return {};
  }

  const next = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof key !== "string" || !key.trim()) continue;
    if (!isSupportedEntityParamValue(value)) continue;
    next[key] = value;
  }

  return next;
}

export function getEntityParamInputType(value) {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  return "text";
}
