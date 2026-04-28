export const EDITOR_PLAY_LEVEL_KEY = "lumo.editorPlay.level.v1";
export const EDITOR_PLAY_SPAWN_KEY = "lumo.editorPlay.spawn.v1";
const RECHARGED_RUNTIME_URL = "http://127.0.0.1:3000/Lumo.html";

function clonePlayLevelDocument(levelDocument) {
  if (!levelDocument || typeof levelDocument !== "object") return null;
  try {
    return structuredClone(levelDocument);
  } catch (_error) {
    return JSON.parse(JSON.stringify(levelDocument));
  }
}

function applySpawnOverrideToLevelDocument(levelDocument, spawnOverride = null) {
  const cloned = clonePlayLevelDocument(levelDocument);
  if (!cloned || typeof cloned !== "object") return null;

  const x = Number(spawnOverride?.x);
  const y = Number(spawnOverride?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return cloned;
  }

  if (!Array.isArray(cloned.entities)) {
    cloned.entities = [];
  }

  const normalizedX = x | 0;
  const normalizedY = y | 0;
  const spawnEntity = cloned.entities.find((entity) => String(entity?.type || "").trim().toLowerCase() === "player-spawn");
  if (spawnEntity && typeof spawnEntity === "object") {
    spawnEntity.x = normalizedX;
    spawnEntity.y = normalizedY;
    return cloned;
  }

  cloned.entities.push({
    id: `editor-play-spawn-${Date.now()}`,
    type: "player-spawn",
    x: normalizedX,
    y: normalizedY,
  });
  return cloned;
}

function buildRechargedRuntimeUrl({ levelDocument, spawnOverride }) {
  const runtimeUrl = new URL(RECHARGED_RUNTIME_URL);
  runtimeUrl.searchParams.set("recharged", "1");

  const playLevelDocument = applySpawnOverrideToLevelDocument(levelDocument, spawnOverride);
  if (playLevelDocument) {
    const levelBlob = new Blob([JSON.stringify(playLevelDocument)], { type: "application/json" });
    const levelUrl = URL.createObjectURL(levelBlob);
    runtimeUrl.searchParams.set("level", levelUrl);
  }

  return runtimeUrl;
}

export function writeEditorPlaySessionPayload({ runtimeLevel, spawnOverride = null, sessionStorageRef = globalThis.sessionStorage }) {
  if (!runtimeLevel || typeof runtimeLevel !== "object") {
    throw new Error("writeEditorPlaySessionPayload requires runtimeLevel");
  }
  if (!sessionStorageRef) {
    throw new Error("sessionStorage is unavailable for runtime handoff");
  }

  sessionStorageRef.setItem(EDITOR_PLAY_LEVEL_KEY, JSON.stringify(runtimeLevel));

  const x = Number(spawnOverride?.x);
  const y = Number(spawnOverride?.y);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    sessionStorageRef.setItem(EDITOR_PLAY_SPAWN_KEY, JSON.stringify({ x: x | 0, y: y | 0 }));
  } else {
    sessionStorageRef.removeItem(EDITOR_PLAY_SPAWN_KEY);
  }
}

export function launchEditorPlayRuntime({
  runtimeLevel,
  levelDocument = null,
  spawnOverride = null,
  sessionStorageRef = globalThis.sessionStorage,
  openFn = globalThis.open,
} = {}) {
  writeEditorPlaySessionPayload({ runtimeLevel, spawnOverride, sessionStorageRef });

  const runtimeUrl = buildRechargedRuntimeUrl({ levelDocument, spawnOverride });
  const win = typeof openFn === "function" ? openFn(runtimeUrl.href, "_blank") : null;

  if (!win && typeof globalThis?.location?.assign === "function") {
    globalThis.location.assign(runtimeUrl.href);
  }

  return runtimeUrl.href;
}
