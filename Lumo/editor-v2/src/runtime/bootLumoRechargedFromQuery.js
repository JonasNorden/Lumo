import { createLumoRechargedBootAdapter } from "./createLumoRechargedBootAdapter.js";
import { loadLevelDocument as loadRuntimeLevelDocument } from "./loadLevelDocument.js";

const DEFAULT_LEVEL_URL = "editor-v2/src/data/testLevelDocument.v1.json";
const VALID_LEVEL_QUERY_PROTOCOLS = new Set(["http:", "https:", ""]);
const DEFAULT_AUTOPLAY_STEPS = 4;

function createBaseResult(overrides = {}) {
  return {
    ok: true,
    enabled: false,
    booted: false,
    autoplay: false,
    mode: "legacy",
    status: "legacy-default",
    tick: 0,
    levelSourceType: "none",
    worldId: "",
    themeId: "",
    decorItems: [],
    playerStatus: "unknown",
    playerX: null,
    playerY: null,
    errors: [],
    warnings: [],
    ...overrides,
  };
}

function normalizeSearchParams(search) {
  try {
    if (search instanceof URLSearchParams) {
      return search;
    }

    if (typeof search === "string") {
      const normalized = search.startsWith("?") ? search.slice(1) : search;
      return new URLSearchParams(normalized);
    }

    if (search && typeof search.get === "function") {
      const cloned = new URLSearchParams();
      for (const key of ["recharged", "level", "autoplay"]) {
        const value = search.get(key);
        if (typeof value === "string") {
          cloned.set(key, value);
        }
      }
      return cloned;
    }
  } catch (_error) {
    // Falls back to empty params for safe deterministic behavior.
  }

  return new URLSearchParams();
}

function normalizeLevelQueryPath(level) {
  if (typeof level !== "string") return "";
  const trimmed = level.trim();
  if (!trimmed) return "";

  const decoded = (() => {
    try {
      return decodeURIComponent(trimmed);
    } catch (_error) {
      return trimmed;
    }
  })();

  const resolved = (() => {
    try {
      const nextUrl = new URL(decoded, globalThis.location?.href ?? "http://localhost/");
      if (!VALID_LEVEL_QUERY_PROTOCOLS.has(nextUrl.protocol)) {
        return "";
      }
      return nextUrl.toString();
    } catch (_error) {
      return decoded;
    }
  })();

  return resolved;
}

function buildSourceDescriptor(params) {
  const rawLevel = params.get("level");
  const level = normalizeLevelQueryPath(rawLevel);

  if (level.length > 0) {
    return {
      descriptor: { url: level },
      levelSourceType: "url",
      warning: "",
    };
  }

  return {
    descriptor: { url: DEFAULT_LEVEL_URL },
    levelSourceType: "default-url",
    warning: "No level query provided; using fallback debug level document.",
  };
}

function toLevelDocumentPayload(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  if (raw.levelDocument && typeof raw.levelDocument === "object") {
    return { levelDocument: raw.levelDocument };
  }

  if (raw.document && typeof raw.document === "object") {
    return { levelDocument: raw.document };
  }

  return { levelDocument: raw };
}

async function defaultBrowserLoadLevelDocument(sourceDescriptor = {}) {
  const rawUrl = typeof sourceDescriptor?.url === "string"
    ? sourceDescriptor.url
    : typeof sourceDescriptor?.path === "string"
      ? sourceDescriptor.path
      : "";

  if (!rawUrl) {
    throw new Error("Recharged query loader requires a non-empty level URL/path.");
  }

  const response = await fetch(rawUrl, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain;q=0.8, */*;q=0.1",
    },
  });

  if (!response?.ok) {
    throw new Error(`Failed to fetch level document (${response?.status} ${response?.statusText || ""}) from ${rawUrl}.`);
  }

  const parsed = await response.json();
  const payload = toLevelDocumentPayload(parsed);
  if (!payload?.levelDocument) {
    throw new Error(`Loaded level payload from ${rawUrl} is not a JSON object.`);
  }

  const normalized = loadRuntimeLevelDocument(payload.levelDocument);
  if (normalized?.ok !== true || !normalized?.level) {
    const firstError = Array.isArray(normalized?.errors) && normalized.errors[0] ? normalized.errors[0] : "Unknown level format error.";
    throw new Error(`Invalid level document at ${rawUrl}: ${firstError}`);
  }

  try {
    console.info("[Lumo Recharged] Loaded level document", { source: rawUrl });
  } catch (_error) {
    // Keep loader side effects non-fatal.
  }

  return { levelDocument: normalized.level };
}

// Boots opt-in Recharged runtime from query flags while preserving legacy default mode.
export async function bootLumoRechargedFromQuery(options = {}) {
  const params = normalizeSearchParams(options?.search ?? "");
  const enabled = params.get("recharged") === "1";

  if (!enabled) {
    return createBaseResult();
  }

  const errors = [];
  const warnings = [];
  const autoplay = params.get("autoplay") === "1";
  const rawLevel = params.get("level");
  if (typeof rawLevel === "string" && rawLevel.trim().length > 0 && normalizeLevelQueryPath(rawLevel).length === 0) {
    warnings.push("Invalid level query path; using fallback debug level document.");
  }
  const sourceInfo = buildSourceDescriptor(params);
  if (sourceInfo.warning) {
    warnings.push(sourceInfo.warning);
  }

  try {
    const createAdapter = typeof options?.createAdapter === "function"
      ? options.createAdapter
      : createLumoRechargedBootAdapter;
    const loadLevelDocument = typeof options?.loadLevelDocument === "function"
      ? options.loadLevelDocument
      : defaultBrowserLoadLevelDocument;

    const adapter = createAdapter({
      sourceDescriptor: sourceInfo.descriptor,
      loadLevelDocument,
    });

    if (!adapter || typeof adapter !== "object") {
      errors.push("Adapter creation returned no adapter instance.");
      return createBaseResult({
        ok: false,
        enabled: true,
        mode: "recharged",
        status: "invalid",
        levelSourceType: sourceInfo.levelSourceType,
        errors,
        warnings,
      });
    }

    const prepareResult = await adapter.prepare?.();
    if (prepareResult?.ok !== true) {
      errors.push("Recharged prepare failed.");
    }

    const bootResult = await adapter.boot?.();
    const booted = bootResult?.ok === true && bootResult?.booted === true;

    if (!booted) {
      errors.push("Recharged boot failed.");
    }

    if (autoplay && booted) {
      const autoplayResult = adapter.tickSteps?.(DEFAULT_AUTOPLAY_STEPS);
      if (autoplayResult?.ok !== true) {
        warnings.push("Autoplay tick burst did not complete cleanly.");
      }
    }

    const payload = adapter.getBootPayload?.() || {};
    return createBaseResult({
      ok: booted,
      enabled: true,
      booted,
      autoplay,
      mode: "recharged",
      status: typeof payload.status === "string" ? payload.status : (booted ? "booted" : "invalid"),
      tick: Number.isFinite(payload.tick) ? payload.tick : 0,
      levelSourceType: sourceInfo.levelSourceType,
      worldId: typeof payload.worldId === "string" ? payload.worldId : "",
      themeId: typeof payload.themeId === "string" ? payload.themeId : "",
      supportTiles: Array.isArray(payload.supportTiles) ? payload.supportTiles : [],
      decorItems: Array.isArray(payload.decorItems) ? payload.decorItems : [],
      playerStatus: typeof payload.playerStatus === "string" ? payload.playerStatus : "unknown",
      playerX: Number.isFinite(payload.playerX) ? payload.playerX : null,
      playerY: Number.isFinite(payload.playerY) ? payload.playerY : null,
      errors,
      warnings,
    });
  } catch (error) {
    errors.push(error instanceof Error && error.message ? error.message : "Unknown Recharged boot error.");
    return createBaseResult({
      ok: false,
      enabled: true,
      mode: "recharged",
      autoplay,
      status: "invalid",
      levelSourceType: sourceInfo.levelSourceType,
      errors,
      warnings,
    });
  }
}

export { defaultBrowserLoadLevelDocument };
