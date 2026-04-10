import { loadLevelDocument } from "./loadLevelDocument.js";
import { startRuntimeFromLevelDocument } from "./startRuntimeFromLevelDocument.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

function buildStartFromUrlDebug({ stage, levelPath, loaded, started, levelDocument, runtimeResult }) {
  return {
    stage,
    levelPath,
    loaded,
    started,
    worldId: runtimeResult?.initialization?.world?.id ?? levelDocument?.identity?.id ?? null,
    themeId: runtimeResult?.initialization?.world?.themeId ?? levelDocument?.identity?.themeId ?? null,
  };
}

// Normalizes relative level URLs against current browser location.
function resolveBrowserLevelUrl(levelPath) {
  return new URL(levelPath, globalThis.location?.href ?? undefined).toString();
}

// Loads level JSON through browser fetch only.
async function readLevelJsonFromUrl(levelPath) {
  const url = resolveBrowserLevelUrl(levelPath);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch level JSON (${response.status} ${response.statusText}) from ${url}.`);
  }

  return {
    url,
    text: await response.text(),
  };
}

// Starts runtime from a browser-safe URL/path source without Node-only imports.
export async function startRuntimeFromLevelUrl(levelPath, options = {}) {
  if (typeof levelPath !== "string" || levelPath.trim().length === 0) {
    return {
      ok: false,
      levelPath,
      levelDocument: null,
      session: null,
      initialization: null,
      simulation: null,
      errors: ["Runtime start from URL requires a non-empty levelPath string."],
      warnings: [],
      debug: buildStartFromUrlDebug({
        stage: "validate-level-path",
        levelPath,
        loaded: false,
        started: false,
        levelDocument: null,
        runtimeResult: null,
      }),
    };
  }

  let loadedLevel;
  try {
    loadedLevel = await readLevelJsonFromUrl(levelPath);
  } catch (error) {
    return {
      ok: false,
      levelPath,
      levelDocument: null,
      session: null,
      initialization: null,
      simulation: null,
      errors: [
        `Failed to load level document from URL/path: ${levelPath}`,
        error instanceof Error ? error.message : "Unknown fetch error.",
      ],
      warnings: [],
      debug: buildStartFromUrlDebug({
        stage: "load-level-json",
        levelPath,
        loaded: false,
        started: false,
        levelDocument: null,
        runtimeResult: null,
      }),
    };
  }

  let parsedDocument;
  try {
    parsedDocument = JSON.parse(loadedLevel.text);
  } catch (error) {
    return {
      ok: false,
      levelPath,
      levelDocument: null,
      session: null,
      initialization: null,
      simulation: null,
      errors: [
        `Failed to parse level JSON from URL/path: ${loadedLevel.url}`,
        error instanceof Error ? error.message : "Unknown JSON parse error.",
      ],
      warnings: [],
      debug: buildStartFromUrlDebug({
        stage: "parse-level-json",
        levelPath,
        loaded: false,
        started: false,
        levelDocument: null,
        runtimeResult: null,
      }),
    };
  }

  // Reuse existing normalization to keep startup behavior deterministic.
  const levelLoadResult = loadLevelDocument(parsedDocument);
  if (levelLoadResult?.ok !== true || !levelLoadResult?.level) {
    return {
      ok: false,
      levelPath,
      levelDocument: null,
      session: null,
      initialization: null,
      simulation: null,
      errors: uniqueMessages(levelLoadResult?.errors),
      warnings: uniqueMessages(levelLoadResult?.warnings),
      debug: buildStartFromUrlDebug({
        stage: "load-level-document",
        levelPath,
        loaded: false,
        started: false,
        levelDocument: null,
        runtimeResult: null,
      }),
    };
  }

  // Reuse top-level runtime document start API for matching output shape.
  const runtimeStartResult = startRuntimeFromLevelDocument(levelLoadResult.level, options);

  return {
    ok: runtimeStartResult?.ok === true,
    levelPath,
    levelDocument: levelLoadResult.level,
    session: runtimeStartResult?.session ?? null,
    initialization: runtimeStartResult?.initialization ?? null,
    simulation: runtimeStartResult?.simulation ?? null,
    errors: uniqueMessages([...(levelLoadResult?.errors ?? []), ...(runtimeStartResult?.errors ?? [])]),
    warnings: uniqueMessages([...(levelLoadResult?.warnings ?? []), ...(runtimeStartResult?.warnings ?? [])]),
    debug: buildStartFromUrlDebug({
      stage: runtimeStartResult?.ok === true ? "start-runtime-from-level-url" : "start-runtime-from-level-document",
      levelPath,
      loaded: true,
      started: runtimeStartResult?.ok === true,
      levelDocument: levelLoadResult.level,
      runtimeResult: runtimeStartResult,
    }),
  };
}
