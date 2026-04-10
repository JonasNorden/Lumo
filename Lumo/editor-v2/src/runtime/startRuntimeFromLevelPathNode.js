import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadLevelDocument } from "./loadLevelDocument.js";
import { startRuntimeFromLevelDocument } from "./startRuntimeFromLevelDocument.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

function buildStartFromPathDebug({ stage, levelPath, loaded, started, levelDocument, runtimeResult }) {
  return {
    stage,
    levelPath,
    loaded,
    started,
    worldId: runtimeResult?.initialization?.world?.id ?? levelDocument?.identity?.id ?? null,
    themeId: runtimeResult?.initialization?.world?.themeId ?? levelDocument?.identity?.themeId ?? null,
  };
}

function isHttpPath(levelPath) {
  return /^https?:\/\//i.test(levelPath);
}

function isFileUrlPath(levelPath) {
  return /^file:\/\//i.test(levelPath);
}

// Reads raw JSON text from either filesystem paths or HTTP/HTTPS URLs in Node runtimes.
async function readLevelJsonSource(levelPath) {
  if (isHttpPath(levelPath)) {
    const response = await fetch(levelPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch level JSON (${response.status} ${response.statusText}).`);
    }

    return response.text();
  }

  const resolvedPath = isFileUrlPath(levelPath) ? fileURLToPath(levelPath) : levelPath;
  return readFile(resolvedPath, "utf8");
}

// Starts Recharged runtime from a Node path/URL by reusing loader + document start API.
export async function startRuntimeFromLevelPathNode(levelPath, options = {}) {
  if (typeof levelPath !== "string" || levelPath.trim().length === 0) {
    return {
      ok: false,
      levelPath,
      levelDocument: null,
      session: null,
      initialization: null,
      simulation: null,
      errors: ["Runtime start from path requires a non-empty levelPath string."],
      warnings: [],
      debug: buildStartFromPathDebug({
        stage: "validate-level-path",
        levelPath,
        loaded: false,
        started: false,
        levelDocument: null,
        runtimeResult: null,
      }),
    };
  }

  let rawLevelJson;
  try {
    rawLevelJson = await readLevelJsonSource(levelPath);
  } catch (error) {
    return {
      ok: false,
      levelPath,
      levelDocument: null,
      session: null,
      initialization: null,
      simulation: null,
      errors: [
        `Failed to load level document from path: ${levelPath}`,
        error instanceof Error ? error.message : "Unknown read error.",
      ],
      warnings: [],
      debug: buildStartFromPathDebug({
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
    parsedDocument = JSON.parse(rawLevelJson);
  } catch (error) {
    return {
      ok: false,
      levelPath,
      levelDocument: null,
      session: null,
      initialization: null,
      simulation: null,
      errors: [
        `Failed to parse level JSON from path: ${levelPath}`,
        error instanceof Error ? error.message : "Unknown JSON parse error.",
      ],
      warnings: [],
      debug: buildStartFromPathDebug({
        stage: "parse-level-json",
        levelPath,
        loaded: false,
        started: false,
        levelDocument: null,
        runtimeResult: null,
      }),
    };
  }

  // Reuse existing level loader so path startup stays in the same normalized chain.
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
      debug: buildStartFromPathDebug({
        stage: "load-level-document",
        levelPath,
        loaded: false,
        started: false,
        levelDocument: null,
        runtimeResult: null,
      }),
    };
  }

  // Reuse the top-level document entry point to keep one runtime-start behavior.
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
    debug: buildStartFromPathDebug({
      stage: runtimeStartResult?.ok === true ? "start-runtime-from-level-path" : "start-runtime-from-level-document",
      levelPath,
      loaded: true,
      started: runtimeStartResult?.ok === true,
      levelDocument: levelLoadResult.level,
      runtimeResult: runtimeStartResult,
    }),
  };
}
