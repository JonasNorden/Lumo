import { createLumoRechargedBootAdapter } from "./createLumoRechargedBootAdapter.js";
import { loadLevelDocument as loadRuntimeLevelDocument } from "./loadLevelDocument.js";

const DEFAULT_LEVEL_URL = "editor-v2/src/data/testLevelDocument.v1.json";
const VALID_LEVEL_QUERY_PROTOCOLS = new Set(["http:", "https:", "blob:", ""]);
const DEFAULT_AUTOPLAY_STEPS = 4;
const EDITOR_PLAY_LEVEL_KEY = "lumo.editorPlay.level.v1";
const PFH_DEBUG_QUERY_KEY = "pfhDebug";

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
    levelPath: "",
    worldId: "",
    themeId: "",
    decorItems: [],
    background: [],
    bg: [],
    reactiveGrassPatches: [],
    reactiveBloomPatches: [],
    reactiveCrystalPatches: [],
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

function readEditorPlayLevelFromSession(sessionStorageRef = globalThis.sessionStorage) {
  if (!sessionStorageRef || typeof sessionStorageRef.getItem !== "function") {
    return { found: false, levelDocument: null, warning: "sessionStorage unavailable" };
  }

  try {
    const raw = sessionStorageRef.getItem(EDITOR_PLAY_LEVEL_KEY);
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return { found: false, levelDocument: null, warning: "" };
    }
    const parsed = JSON.parse(raw);
    const normalized = loadRuntimeLevelDocument(parsed);
    if (normalized?.ok !== true || !normalized?.level) {
      const firstError = Array.isArray(normalized?.errors) && normalized.errors[0] ? normalized.errors[0] : "Unknown level format error.";
      return { found: true, levelDocument: null, warning: `invalid session payload: ${firstError}` };
    }
    return { found: true, levelDocument: normalized.level, warning: "" };
  } catch (error) {
    return { found: true, levelDocument: null, warning: `session payload parse failed: ${error?.message || "unknown error"}` };
  }
}

function createSessionLevelDocumentLoader(levelDocument) {
  return async function loadFromSessionPayload() {
    return { levelDocument };
  };
}

function buildSourceDescriptor(params, options = {}) {
  const sessionPayload = readEditorPlayLevelFromSession(options?.sessionStorageRef);
  if (sessionPayload.levelDocument) {
    return {
      descriptor: { source: "editor-play-session" },
      levelSourceType: "editor-play-session",
      warning: sessionPayload.warning || "",
      loadLevelDocument: createSessionLevelDocumentLoader(sessionPayload.levelDocument),
      sessionPayloadFound: true,
      sessionPayloadKey: EDITOR_PLAY_LEVEL_KEY,
    };
  }

  const rawLevel = params.get("level");
  const level = normalizeLevelQueryPath(rawLevel);

  if (level.length > 0) {
    return {
      descriptor: { url: level },
      levelSourceType: "url",
      warning: sessionPayload.warning || "",
      sessionPayloadFound: sessionPayload.found === true,
      sessionPayloadKey: EDITOR_PLAY_LEVEL_KEY,
    };
  }

  return {
    descriptor: { url: DEFAULT_LEVEL_URL },
    levelSourceType: "default-url",
    warning: sessionPayload.warning || "No level query provided; using fallback debug level document.",
    sessionPayloadFound: sessionPayload.found === true,
    sessionPayloadKey: EDITOR_PLAY_LEVEL_KEY,
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
  const pfhDebugEnabled = params.get(PFH_DEBUG_QUERY_KEY) === "1";

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
  const sourceInfo = buildSourceDescriptor(params, { sessionStorageRef: options?.sessionStorageRef });
  if (sourceInfo.warning) {
    warnings.push(sourceInfo.warning);
  }

  try {
    const createAdapter = typeof options?.createAdapter === "function"
      ? options.createAdapter
      : createLumoRechargedBootAdapter;
    const loadLevelDocument = typeof sourceInfo?.loadLevelDocument === "function"
      ? sourceInfo.loadLevelDocument
      : (typeof options?.loadLevelDocument === "function"
        ? options.loadLevelDocument
        : defaultBrowserLoadLevelDocument);

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
        levelPath: typeof sourceInfo?.descriptor?.url === "string" ? sourceInfo.descriptor.url : "",
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
    if (pfhDebugEnabled) {
      console.info("[Lumo Recharged][PFH] source selection", {
        sessionPayloadFound: sourceInfo?.sessionPayloadFound === true,
        sessionPayloadKey: sourceInfo?.sessionPayloadKey || EDITOR_PLAY_LEVEL_KEY,
        chosenLevelSource: sourceInfo?.levelSourceType || "none",
        levelPath: typeof sourceInfo?.descriptor?.url === "string" ? sourceInfo.descriptor.url : "",
      });
    }
    if (params.get("crystalDebug") === "1") {
      console.info("[CrystalDebug] boot result counts", {
        grass: Array.isArray(payload.reactiveGrassPatches) ? payload.reactiveGrassPatches.length : 0,
        bloom: Array.isArray(payload.reactiveBloomPatches) ? payload.reactiveBloomPatches.length : 0,
        crystal: Array.isArray(payload.reactiveCrystalPatches) ? payload.reactiveCrystalPatches.length : 0,
      });
    }
    return createBaseResult({
      ok: booted,
      enabled: true,
      booted,
      autoplay,
      mode: "recharged",
      status: typeof payload.status === "string" ? payload.status : (booted ? "booted" : "invalid"),
      tick: Number.isFinite(payload.tick) ? payload.tick : 0,
      levelSourceType: sourceInfo.levelSourceType,
      levelPath: typeof sourceInfo?.descriptor?.url === "string" ? sourceInfo.descriptor.url : "",
      worldId: typeof payload.worldId === "string" ? payload.worldId : "",
      themeId: typeof payload.themeId === "string" ? payload.themeId : "",
      supportTiles: Array.isArray(payload.supportTiles) ? payload.supportTiles : [],
      decorItems: Array.isArray(payload.decorItems) ? payload.decorItems : [],
      background: Array.isArray(payload.background) ? payload.background : [],
      bg: payload?.bg && typeof payload.bg === "object"
        ? {
            ...payload.bg,
            data: Array.isArray(payload.bg.data) ? payload.bg.data.slice() : [],
            placements: Array.isArray(payload.bg.placements)
              ? payload.bg.placements
                .map((placement) => (placement && typeof placement === "object" ? { ...placement } : placement))
                .filter((placement) => placement && typeof placement === "object")
              : [],
          }
        : [],
      reactiveGrassPatches: Array.isArray(payload.reactiveGrassPatches) ? payload.reactiveGrassPatches : [],
      reactiveBloomPatches: Array.isArray(payload.reactiveBloomPatches) ? payload.reactiveBloomPatches : [],
      reactiveCrystalPatches: Array.isArray(payload.reactiveCrystalPatches) ? payload.reactiveCrystalPatches : [],
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
      levelPath: typeof sourceInfo?.descriptor?.url === "string" ? sourceInfo.descriptor.url : "",
      errors,
      warnings,
    });
  }
}

export { defaultBrowserLoadLevelDocument };
