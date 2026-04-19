const FIREFLY_AUDIO_PATH = "data/assets/audio/events/creatures/firefly_01.ogg";
const FIREFLY_VOLUME_BOOST = 1.35;
const FIREFLY_PAN_LIMIT = 0.65;
const FIREFLY_RANGE_TILES = 20;
const FIREFLY_AUDIBLE_MODES = new Set(["takeoff", "fly", "landing", "landed"]);
const FIREFLY_AUDIO_RETRY_COOLDOWN_MS = 2500;

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

function createLegacyEntitiesFireflyAudioBridge(runtimeWindow = globalThis) {
  const entitiesProto = runtimeWindow?.Lumo?.Entities?.prototype;
  if (!entitiesProto) return null;
  if (
    typeof entitiesProto._getSoundHandle !== "function"
    || typeof entitiesProto._setHandleVolume !== "function"
    || typeof entitiesProto._setHandlePan !== "function"
    || typeof entitiesProto._ensureSpatialHandle !== "function"
    || typeof entitiesProto._getSfxVolume !== "function"
  ) {
    return null;
  }
  return {
    _soundHandles: new Map(),
    _sfxSpatialCtx: null,
    _getSfxVolume(...args) {
      return entitiesProto._getSfxVolume.apply(this, args);
    },
    getHandle(path, loop, key) {
      return entitiesProto._getSoundHandle.call(this, path, loop, key);
    },
    setVolume(handle, volume) {
      entitiesProto._setHandleVolume.call(this, handle, volume);
    },
    setPan(handle, pan) {
      entitiesProto._setHandlePan.call(this, handle, pan);
    },
    ensureSpatial(handle) {
      entitiesProto._ensureSpatialHandle.call(this, handle);
    },
  };
}

function createStandaloneFireflyAudioBridge(options = {}) {
  const runtimeGlobal = options.runtimeGlobal || globalThis;
  const AudioCtor = options.audioCtor || runtimeGlobal?.Audio || null;
  const AudioContextCtor = options.audioContextCtor
    || runtimeGlobal?.AudioContext
    || runtimeGlobal?.webkitAudioContext
    || null;
  const nowMs = typeof options.nowMs === "function"
    ? options.nowMs
    : () => (typeof performance?.now === "function" ? performance.now() : Date.now());
  const sfxVolume = typeof options.getSfxVolume === "function"
    ? options.getSfxVolume
    : () => 1;
  const soundHandles = new Map();
  let spatialCtx = null;

  function getSafeSfxVolume() {
    return clamp01(Number(sfxVolume()));
  }

  function buildHandle(path, loop, keySuffix) {
    if (typeof AudioCtor !== "function") return null;
    const audio = new AudioCtor(path);
    audio.preload = "auto";
    audio.loop = !!loop;
    audio.volume = 0;
    const handle = {
      audio,
      path,
      loop: !!loop,
      keySuffix: String(keySuffix || ""),
      lastTarget: 0,
      lastPan: 0,
      playFailed: false,
      nextRetryAtMs: 0,
    };
    if (typeof audio.addEventListener === "function") {
      audio.addEventListener("error", () => {
        handle.playFailed = true;
        handle.nextRetryAtMs = nowMs() + FIREFLY_AUDIO_RETRY_COOLDOWN_MS;
        handle.lastTarget = 0;
      });
    }
    return handle;
  }

  return {
    source: "standalone-html-audio",
    getHandle(path, loop, keySuffix = "") {
      const suffix = keySuffix == null || keySuffix === "" ? "" : `::${keySuffix}`;
      const key = `${path}::${loop ? "L" : "O"}${suffix}`;
      if (soundHandles.has(key)) return soundHandles.get(key);
      const handle = buildHandle(path, loop, keySuffix);
      if (!handle) return null;
      soundHandles.set(key, handle);
      return handle;
    },
    ensureSpatial(handle) {
      if (!handle || !handle.audio || handle.spatialReady) return;
      handle.spatialReady = true;
      if (typeof AudioContextCtor !== "function") return;
      try {
        if (!spatialCtx) spatialCtx = new AudioContextCtor();
        if (!spatialCtx) return;
        const source = spatialCtx.createMediaElementSource(handle.audio);
        const gain = spatialCtx.createGain();
        gain.gain.value = clamp01(handle.lastTarget || 0) * getSafeSfxVolume();
        if (typeof spatialCtx.createStereoPanner === "function") {
          const panner = spatialCtx.createStereoPanner();
          panner.pan.value = 0;
          source.connect(gain);
          gain.connect(panner);
          panner.connect(spatialCtx.destination);
          handle.panNode = panner;
        } else {
          source.connect(gain);
          gain.connect(spatialCtx.destination);
        }
        handle.gainNode = gain;
        handle.audio.volume = 1;
      } catch (_error) {
        // Safe fallback keeps standard audio-element path when graph setup fails.
      }
    },
    setVolume(handle, volume) {
      if (!handle?.audio) return;
      const target = clamp01(volume) * getSafeSfxVolume();
      handle.lastTarget = target;
      if (handle.gainNode) {
        handle.gainNode.gain.value = target;
      } else if (Math.abs((handle.audio.volume || 0) - target) > 0.0001) {
        handle.audio.volume = target;
      }
      if (target <= 0.001) {
        if (!handle.audio.paused && typeof handle.audio.pause === "function") {
          handle.audio.pause();
        }
        return;
      }
      if (handle.playFailed && nowMs() < handle.nextRetryAtMs) return;
      if (!handle.audio.paused) return;
      const maybePromise = handle.audio.play();
      if (maybePromise && typeof maybePromise.catch === "function") {
        maybePromise.catch(() => {
          handle.playFailed = true;
          handle.nextRetryAtMs = nowMs() + FIREFLY_AUDIO_RETRY_COOLDOWN_MS;
          handle.lastTarget = 0;
        });
      } else {
        handle.playFailed = false;
      }
    },
    setPan(handle, pan) {
      if (!handle?.audio) return;
      const nextPan = Math.max(-1, Math.min(1, Number.isFinite(pan) ? pan : 0));
      handle.lastPan = nextPan;
      if (handle.panNode) {
        handle.panNode.pan.value = nextPan;
      }
    },
  };
}

function createFireflyAudioBridge(options = {}) {
  if (options?.preferStandalone === true) {
    return createStandaloneFireflyAudioBridge(options);
  }
  const legacyBridge = createLegacyEntitiesFireflyAudioBridge(options.runtimeGlobal);
  if (legacyBridge) {
    legacyBridge.source = "legacy-entities-audio";
    return legacyBridge;
  }
  return createStandaloneFireflyAudioBridge(options);
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
  FIREFLY_AUDIO_RETRY_COOLDOWN_MS,
  clamp01,
  computeFireflyAudioFrame,
  buildFireflyPlayerCenter,
  createLegacyEntitiesFireflyAudioBridge,
  createStandaloneFireflyAudioBridge,
  createFireflyAudioBridge,
  syncFireflyAudioFrame,
};
