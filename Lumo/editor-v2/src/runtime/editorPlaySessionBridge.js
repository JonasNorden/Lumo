export const EDITOR_PLAY_LEVEL_KEY = "lumo.editorPlay.level.v1";
export const EDITOR_PLAY_SPAWN_KEY = "lumo.editorPlay.spawn.v1";

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
  spawnOverride = null,
  locationHref = globalThis?.location?.href,
  sessionStorageRef = globalThis.sessionStorage,
  openFn = globalThis.open,
} = {}) {
  writeEditorPlaySessionPayload({ runtimeLevel, spawnOverride, sessionStorageRef });

  const runtimeUrl = new URL("../Lumo.html", locationHref || "http://localhost/");
  const win = typeof openFn === "function" ? openFn(runtimeUrl.href, "_blank") : null;

  if (!win && typeof globalThis?.location?.assign === "function") {
    globalThis.location.assign(runtimeUrl.href);
  }

  return runtimeUrl.href;
}
