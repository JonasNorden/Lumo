function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isSupportedEntityParamValue(value) {
  if (typeof value === "string" || typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isSupportedEntityParamValue(entry));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).every(([key, entry]) => typeof key === "string" && key.trim() && isSupportedEntityParamValue(entry));
  }

  return false;
}

export function cloneEntityParamValue(value) {
  if (!isSupportedEntityParamValue(value)) return undefined;
  if (Array.isArray(value)) return value.map((entry) => cloneEntityParamValue(entry));
  if (isPlainObject(value)) {
    const next = {};
    for (const [key, entry] of Object.entries(value)) {
      const clonedEntry = cloneEntityParamValue(entry);
      if (clonedEntry === undefined) continue;
      next[key] = clonedEntry;
    }
    return next;
  }
  return value;
}

export function cloneEntityParams(params) {
  if (!isPlainObject(params)) {
    return {};
  }

  const next = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof key !== "string" || !key.trim()) continue;
    const clonedValue = cloneEntityParamValue(value);
    if (clonedValue === undefined) continue;
    next[key] = clonedValue;
  }

  return next;
}

export function mergeEntityParams(baseParams, overrideParams) {
  const nextBase = cloneEntityParams(baseParams);
  const nextOverride = cloneEntityParams(overrideParams);

  for (const [key, value] of Object.entries(nextOverride)) {
    if (isPlainObject(value) && isPlainObject(nextBase[key])) {
      nextBase[key] = mergeEntityParams(nextBase[key], value);
      continue;
    }

    nextBase[key] = cloneEntityParamValue(value);
  }

  return nextBase;
}

export function getEntityParamInputType(value) {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value) || isPlainObject(value)) return "json";
  return "text";
}

export function getNestedEntityParam(params, path) {
  if (!isPlainObject(params) || typeof path !== "string" || !path.trim()) return undefined;
  return path.split(".").reduce((current, segment) => {
    if (!isPlainObject(current) && !Array.isArray(current)) return undefined;
    return current[segment];
  }, params);
}

export function setNestedEntityParam(params, path, value) {
  if (typeof path !== "string" || !path.trim()) {
    return cloneEntityParams(params);
  }

  const nextParams = cloneEntityParams(params);
  const segments = path.split(".").filter(Boolean);
  if (!segments.length) return nextParams;

  let current = nextParams;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!isPlainObject(current[segment])) {
      current[segment] = {};
    }
    current = current[segment];
  }

  const normalizedValue = cloneEntityParamValue(value);
  if (normalizedValue === undefined) return nextParams;
  current[segments[segments.length - 1]] = normalizedValue;
  return nextParams;
}
