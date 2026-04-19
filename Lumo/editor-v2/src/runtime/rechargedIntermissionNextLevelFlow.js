const RECHARGED_BROWSER_LEVEL_SEQUENCE = Object.freeze([
  "editor-v2/src/data/testLevelDocument.v1.json",
  "editor-v2/src/data/editorV2SavedLevel.sample.json",
]);

function normalizeLevelPath(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withoutOrigin = trimmed.replace(/^https?:\/\/[^/]+/i, "");
  const withoutQuery = withoutOrigin.split("?")[0].split("#")[0];
  const normalized = withoutQuery.replace(/^\/+/, "").replace(/^\.\//, "");
  return normalized;
}

export function resolveNextRechargedLevelPath(currentLevelPath, options = {}) {
  const sequence = Array.isArray(options?.levelSequence) && options.levelSequence.length > 0
    ? options.levelSequence
    : RECHARGED_BROWSER_LEVEL_SEQUENCE;
  const normalizedSequence = sequence.map((entry) => normalizeLevelPath(entry)).filter(Boolean);

  if (normalizedSequence.length === 0) {
    return null;
  }

  const currentNormalized = normalizeLevelPath(currentLevelPath);
  const currentIndex = normalizedSequence.indexOf(currentNormalized);
  if (currentIndex < 0) {
    return null;
  }

  const nextPath = normalizedSequence[currentIndex + 1];
  return typeof nextPath === "string" && nextPath.length > 0 ? nextPath : null;
}

function buildRechargedQuerySearch(nextLevelPath) {
  const params = new URLSearchParams();
  params.set("recharged", "1");
  params.set("level", nextLevelPath);
  return `?${params.toString()}`;
}

// Attempts one safe intermission transition into the next Recharged level.
export async function loadNextRechargedLevelFromIntermission(options = {}) {
  const nextLevelPath = resolveNextRechargedLevelPath(options?.currentLevelPath, options);
  if (typeof nextLevelPath !== "string" || nextLevelPath.length === 0) {
    return {
      ok: false,
      reason: "next-level-unresolved",
      nextLevelPath: null,
      bootResult: null,
    };
  }

  const bootFromQuery = typeof options?.bootFromQuery === "function" ? options.bootFromQuery : null;
  if (!bootFromQuery) {
    return {
      ok: false,
      reason: "boot-from-query-unavailable",
      nextLevelPath,
      bootResult: null,
    };
  }

  const bootResult = await bootFromQuery({
    search: buildRechargedQuerySearch(nextLevelPath),
  });
  const booted = bootResult?.enabled === true && bootResult?.booted === true;

  return {
    ok: booted,
    reason: booted ? "" : "next-level-boot-failed",
    nextLevelPath,
    bootResult: bootResult && typeof bootResult === "object" ? bootResult : null,
  };
}

export { RECHARGED_BROWSER_LEVEL_SEQUENCE };
