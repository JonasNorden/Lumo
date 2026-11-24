import { loadLevelDocument } from "./loadLevelDocument.js";

export const EDITOR_PLAY_LEVEL_KEY = "lumo.editorPlay.level.v1";
export const EDITOR_PLAY_SPAWN_KEY = "lumo.editorPlay.spawn.v1";
export const EDITOR_PLAY_MESSAGE = "lumo.editorPlay.status.v1";

// Compatibility for legacy callers only. Recharged never reads these keys.
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
  levelDocument,
  spawnOverride = null,
  editorUrl = globalThis.location?.href,
  openFn = globalThis.open?.bind(globalThis),
  eventTarget = globalThis,
  onStatus = () => {},
  timeoutMs = 30000,
} = {}) {
  if (!levelDocument || typeof levelDocument !== "object") throw new Error("Play snapshot is missing.");
  const runtimeUrl = new URL("../Lumo.html", editorUrl);
  if (!["http:", "https:"].includes(runtimeUrl.protocol)) throw new Error("Open the editor using a local HTTP server.");
  const launchId = globalThis.crypto.randomUUID();
  // JSON serialization is the transport contract: preserve every authored field.
  const snapshot = JSON.parse(JSON.stringify(levelDocument));
  const x = spawnOverride?.x, y = spawnOverride?.y;
  if (Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 &&
      x < snapshot.dimensions?.width && y < snapshot.dimensions?.height) {
    snapshot.world = { ...snapshot.world, spawn: { x, y } };
  }
  snapshot.editorPlay = { launchId };
  const validated = loadLevelDocument(snapshot);
  if (!validated.ok) throw new Error(`Invalid play snapshot: ${validated.errors.join(" ")}`);
  const levelUrl = URL.createObjectURL(new Blob([JSON.stringify(snapshot)], { type: "application/json" }));
  runtimeUrl.searchParams.set("recharged", "1");
  runtimeUrl.searchParams.set("editorPlay", launchId);
  runtimeUrl.searchParams.set("level", levelUrl);
  const diagnostics = { launchId, editorOrigin: new URL(editorUrl).origin, runtimeUrl: runtimeUrl.href,
    levelIdentity: validated.level.identity, source: "editor-snapshot", world: validated.level.world };
  let win, deadline, closedPoll, disposed = false, stage = 0;
  const emit = (status, details = {}) => {
    console.info("[Editor V2] Play From Here", { ...diagnostics, status, ...details });
    onStatus({ ...diagnostics, status, ...details });
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(deadline);
    clearInterval(closedPoll);
    eventTarget.removeEventListener?.("message", receive);
    eventTarget.removeEventListener?.("pagehide", dispose);
    URL.revokeObjectURL(levelUrl);
  };
  const receive = (event) => {
    const data = event.data;
    if (disposed || event.origin !== runtimeUrl.origin || event.source !== win ||
        data?.type !== EDITOR_PLAY_MESSAGE || data.launchId !== launchId) return;
    const next = { opened: 1, loaded: 2, ready: 3, failed: 4 }[data.status];
    if (!next || next <= stage) return;
    stage = next;
    emit(data.status, { runtime: data.details, error: data.details?.error });
    if (data.status === "ready") clearTimeout(deadline);
    if (data.status === "failed") dispose();
  };
  eventTarget.addEventListener?.("message", receive);
  eventTarget.addEventListener?.("pagehide", dispose);
  emit("launching");
  try {
    win = typeof openFn === "function" ? openFn(runtimeUrl.href, "_blank") : null;
    if (!win) throw new Error("Popup blocked. Allow popups for this editor and click Play From Here again. Your unsaved work is still here.");
  } catch (error) {
    emit("failed", { error: error.message });
    dispose();
    throw error;
  }
  deadline = setTimeout(() => {
    emit("failed", { error: "Runtime did not become ready within 30 seconds. Check the runtime tab for errors." });
    dispose();
  }, timeoutMs);
  closedPoll = setInterval(() => {
    if (win.closed) {
      if (stage < 3) emit("failed", { error: "Runtime window closed before it was ready." });
      dispose();
    }
  }, 1000);
  deadline.unref?.();
  closedPoll.unref?.();
  return { url: runtimeUrl.href, launchId, dispose };
}

// Called by the runtime only after the indicated stage has actually completed.
export function reportEditorPlayStatus(status, details = {}, windowRef = globalThis.window) {
  const launchId = new URLSearchParams(windowRef?.location?.search || "").get("editorPlay");
  if (!launchId) return;
  console.info("[Lumo][Play From Here]", { launchId, status, ...details });
  windowRef?.opener?.postMessage({ type: EDITOR_PLAY_MESSAGE, launchId, status, details }, windowRef.location.origin);
}
