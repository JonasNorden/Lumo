const FIREFLY_AUDIO_PATH = "data/assets/audio/events/creatures/firefly_01.ogg";
const FIREFLY_VOLUME_BOOST = 1.35;
const FIREFLY_PAN_LIMIT = 0.65;
const FIREFLY_RANGE_TILES = 20;
const FIREFLY_AUDIBLE_MODES = new Set(["takeoff", "fly", "landing", "landed"]);

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function computeFireflyAudioFrame({ firefly, playerCenter, tileSize = 24 } = {}) {
  const safeTileSize = Number.isFinite(tileSize) && tileSize > 0 ? tileSize : 24;
  const fireflyRange = safeTileSize * FIREFLY_RANGE_TILES;
  const fireflyW = Number.isFinite(firefly?.w) ? firefly.w : (Number.isFinite(firefly?.size) ? firefly.size : safeTileSize);
  const fireflyH = Number.isFinite(firefly?.h) ? firefly.h : (Number.isFinite(firefly?.size) ? firefly.size : safeTileSize);
  const fireflyCx = (Number.isFinite(firefly?.x) ? firefly.x : 0) + fireflyW * 0.5;
  const fireflyCy = (Number.isFinite(firefly?.y) ? firefly.y : 0) + fireflyH * 0.5;

  let gain = 0;
  let pan = 0;
  if (playerCenter && Number.isFinite(playerCenter.x) && Number.isFinite(playerCenter.y) && fireflyRange > 0) {
    const dxToPlayer = fireflyCx - playerCenter.x;
    const dyToPlayer = fireflyCy - playerCenter.y;
    const dToPlayer = Math.hypot(dxToPlayer, dyToPlayer);
    if (dToPlayer < fireflyRange) {
      const t = 1 - (dToPlayer / fireflyRange);
      gain = t * t;
    }
    pan = Math.max(-FIREFLY_PAN_LIMIT, Math.min(FIREFLY_PAN_LIMIT, dxToPlayer / fireflyRange));
  }

  const mode = typeof firefly?.mode === "string" ? firefly.mode : "rest";
  const audibleMode = FIREFLY_AUDIBLE_MODES.has(mode);
  const targetVolume = Math.min(1, gain * FIREFLY_VOLUME_BOOST);

  return {
    gain,
    pan,
    mode,
    audibleMode,
    targetVolume: audibleMode ? targetVolume : 0,
  };
}

function buildFireflyPlayerCenter(playerSnapshot = {}) {
  const x = Number.isFinite(playerSnapshot?.x) ? playerSnapshot.x : null;
  const y = Number.isFinite(playerSnapshot?.y) ? playerSnapshot.y : null;
  if (x === null || y === null) return null;
  const w = Number.isFinite(playerSnapshot?.w) ? playerSnapshot.w : 22;
  const h = Number.isFinite(playerSnapshot?.h) ? playerSnapshot.h : 28;
  return { x: x + w * 0.5, y: y + h * 0.5 };
}

function syncFireflyAudioFrame({
  entities = [],
  playerSnapshot = null,
  tileSize = 24,
  ensureAudioKey,
  ensureHandle,
  setPan,
  setVolume,
  visitKnownHandles,
} = {}) {
  const activeFireflyKeys = new Set();
  const playerCenter = buildFireflyPlayerCenter(playerSnapshot);

  for (const entity of entities) {
    const type = String(entity?.type || "").toLowerCase();
    if (type !== "firefly_01" && type !== "firefly") continue;
    const key = typeof ensureAudioKey === "function" ? ensureAudioKey(entity) : "";
    if (!key) continue;
    activeFireflyKeys.add(key);
    const handle = typeof ensureHandle === "function" ? ensureHandle(key) : null;
    if (!handle) continue;
    const frame = computeFireflyAudioFrame({ firefly: entity, playerCenter, tileSize });
    if (typeof setPan === "function") setPan(handle, frame.pan);
    if (typeof setVolume === "function") setVolume(handle, frame.targetVolume);
  }

  if (typeof visitKnownHandles === "function") {
    visitKnownHandles((key, handle) => {
      if (activeFireflyKeys.has(key)) return;
      if (typeof setPan === "function") setPan(handle, 0);
      if (typeof setVolume === "function") setVolume(handle, 0);
    });
  }

  return activeFireflyKeys;
}

export {
  FIREFLY_AUDIO_PATH,
  FIREFLY_VOLUME_BOOST,
  FIREFLY_PAN_LIMIT,
  FIREFLY_RANGE_TILES,
  FIREFLY_AUDIBLE_MODES,
  clamp01,
  computeFireflyAudioFrame,
  buildFireflyPlayerCenter,
  syncFireflyAudioFrame,
};
