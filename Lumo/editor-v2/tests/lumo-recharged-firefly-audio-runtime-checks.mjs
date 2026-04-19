import assert from "node:assert/strict";

import {
  computeFireflyAudioFrame,
  syncFireflyAudioFrame,
  buildFireflyPlayerCenter,
  createFireflyAudioBridge,
  createLegacyEntitiesFireflyAudioBridge,
  createStandaloneFireflyAudioBridge,
  FIREFLY_AUDIO_PATH,
  FIREFLY_AUDIO_RETRY_COOLDOWN_MS,
  FIREFLY_PAN_LIMIT,
  FIREFLY_RANGE_TILES,
} from "../src/runtime/fireflyAudioRuntime.js";

function makeFirefly(overrides = {}) {
  return {
    id: "firefly-a",
    type: "firefly_01",
    x: 120,
    y: 120,
    w: 12,
    h: 12,
    active: true,
    mode: "rest",
    ...overrides,
  };
}

function makePlayer(overrides = {}) {
  return {
    x: 120,
    y: 120,
    w: 22,
    h: 28,
    ...overrides,
  };
}

function runRestModeSilenceCheck() {
  const frame = computeFireflyAudioFrame({
    firefly: makeFirefly({ mode: "rest" }),
    playerCenter: buildFireflyPlayerCenter(makePlayer()),
    tileSize: 24,
  });
  assert.equal(frame.targetVolume, 0, "rest mode must be silent.");
}

function runAudibleModeChecks() {
  const modes = ["takeoff", "fly", "landing", "landed"];
  for (const mode of modes) {
    const frame = computeFireflyAudioFrame({
      firefly: makeFirefly({ mode, x: 124, y: 122 }),
      playerCenter: buildFireflyPlayerCenter(makePlayer({ x: 124, y: 122 })),
      tileSize: 24,
    });
    assert.equal(frame.targetVolume > 0, true, `${mode} mode must be audible when in range.`);
  }
}

function runDistanceGainCheck() {
  const tileSize = 24;
  const playerCenter = { x: 0, y: 0 };
  const near = computeFireflyAudioFrame({
    firefly: makeFirefly({ mode: "fly", x: -6, y: -6, w: 12, h: 12 }),
    playerCenter,
    tileSize,
  });
  const far = computeFireflyAudioFrame({
    firefly: makeFirefly({ mode: "fly", x: (tileSize * FIREFLY_RANGE_TILES) - 6, y: -6, w: 12, h: 12 }),
    playerCenter,
    tileSize,
  });
  assert.equal(near.targetVolume > far.targetVolume, true, "volume must decrease with distance.");
  assert.equal(far.targetVolume, 0, "firefly at range boundary should be silent.");
}

function runPanCheck() {
  const tileSize = 24;
  const playerCenter = { x: 200, y: 200 };
  const left = computeFireflyAudioFrame({
    firefly: makeFirefly({ mode: "fly", x: -200, y: 194, w: 12, h: 12 }),
    playerCenter,
    tileSize,
  });
  const right = computeFireflyAudioFrame({
    firefly: makeFirefly({ mode: "fly", x: 1000, y: 194, w: 12, h: 12 }),
    playerCenter,
    tileSize,
  });
  assert.equal(left.pan < 0, true, "left-side firefly must pan left.");
  assert.equal(right.pan > 0, true, "right-side firefly must pan right.");
  assert.equal(Math.abs(left.pan) <= FIREFLY_PAN_LIMIT, true, "pan must clamp to V1 bound.");
  assert.equal(Math.abs(right.pan) <= FIREFLY_PAN_LIMIT, true, "pan must clamp to V1 bound.");
}

function runPerEntityIdentityAndCleanupCheck() {
  const keysByEntity = new Map();
  const handlesByKey = new Map();
  const panCalls = [];
  const volumeCalls = [];

  const ensureAudioKey = (entity) => {
    const key = keysByEntity.get(entity.id);
    if (key) return key;
    const next = `firefly-${keysByEntity.size + 1}`;
    keysByEntity.set(entity.id, next);
    return next;
  };

  const ensureHandle = (key) => {
    if (!handlesByKey.has(key)) {
      handlesByKey.set(key, { key });
    }
    return handlesByKey.get(key);
  };

  const setPan = (handle, pan) => {
    panCalls.push({ key: handle.key, pan });
  };
  const setVolume = (handle, volume) => {
    volumeCalls.push({ key: handle.key, volume });
  };

  const firstEntities = [
    makeFirefly({ id: "ff-1", mode: "fly", x: 110, y: 120 }),
    makeFirefly({ id: "ff-2", mode: "rest", x: 600, y: 120 }),
  ];

  syncFireflyAudioFrame({
    entities: firstEntities,
    playerSnapshot: makePlayer({ x: 120, y: 120 }),
    tileSize: 24,
    ensureAudioKey,
    ensureHandle,
    setPan,
    setVolume,
    visitKnownHandles(visitor) {
      for (const [key, handle] of handlesByKey.entries()) {
        visitor(key, handle);
      }
    },
  });

  assert.equal(keysByEntity.get("ff-1") !== keysByEntity.get("ff-2"), true, "fireflies must keep separate audio keys.");
  const ff2Volumes = volumeCalls.filter((call) => call.key === keysByEntity.get("ff-2")).map((call) => call.volume);
  assert.equal(ff2Volumes.at(-1), 0, "resting firefly handle must be silent.");

  syncFireflyAudioFrame({
    entities: [makeFirefly({ id: "ff-1", mode: "fly", x: 110, y: 120 })],
    playerSnapshot: makePlayer({ x: 120, y: 120 }),
    tileSize: 24,
    ensureAudioKey,
    ensureHandle,
    setPan,
    setVolume,
    visitKnownHandles(visitor) {
      for (const [key, handle] of handlesByKey.entries()) {
        visitor(key, handle);
      }
    },
  });

  const ff2LastPan = panCalls.filter((call) => call.key === keysByEntity.get("ff-2")).at(-1)?.pan;
  const ff2LastVol = volumeCalls.filter((call) => call.key === keysByEntity.get("ff-2")).at(-1)?.volume;
  assert.equal(ff2LastPan, 0, "inactive firefly handle must reset pan to 0.");
  assert.equal(ff2LastVol, 0, "inactive firefly handle must reset volume to 0.");
}

function runTriggerSourceIsolationCheck() {
  const resting = makeFirefly({ id: "resting", mode: "rest", x: 120, y: 120 });
  const litNeighbor = makeFirefly({ id: "lit", mode: "fly", x: 124, y: 124 });
  const calls = [];

  syncFireflyAudioFrame({
    entities: [resting, litNeighbor],
    playerSnapshot: makePlayer({ x: 900, y: 900 }),
    tileSize: 24,
    ensureAudioKey(entity) {
      return entity.id;
    },
    ensureHandle(key) {
      return { key };
    },
    setPan(_handle, _pan) {},
    setVolume(handle, volume) {
      calls.push({ key: handle.key, volume });
    },
    visitKnownHandles() {},
  });

  const restingLastVolume = calls.filter((call) => call.key === "resting").at(-1)?.volume;
  assert.equal(restingLastVolume, 0, "resting firefly remains silent even with lit neighbor present.");
}

function runStandaloneBridgePlaybackSafetyCheck() {
  let now = 100;
  class FakeAudio {
    constructor(path) {
      this.path = path;
      this.preload = "";
      this.loop = false;
      this.volume = 0;
      this.paused = true;
      this._error = null;
      this.playCalls = 0;
      this.pauseCalls = 0;
    }
    addEventListener(type, cb) {
      if (type === "error") this._error = cb;
    }
    play() {
      this.playCalls += 1;
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.pauseCalls += 1;
      this.paused = true;
    }
  }
  const bridge = createStandaloneFireflyAudioBridge({
    audioCtor: FakeAudio,
    audioContextCtor: null,
    nowMs: () => now,
    getSfxVolume: () => 0.5,
  });
  const handle = bridge.getHandle(FIREFLY_AUDIO_PATH, true, "ff-1");
  assert.ok(handle, "standalone bridge should create audio handles when Audio ctor exists.");
  bridge.setPan(handle, 0.8);
  bridge.setVolume(handle, 0.6);
  assert.equal(handle.lastPan, 0.8, "standalone bridge should store pan updates.");
  assert.equal(handle.audio.playCalls, 1, "standalone bridge should start playback for audible volume.");
  assert.equal(handle.audio.volume, 0.3, "standalone bridge should respect sfx volume scaling.");
  bridge.setVolume(handle, 0);
  assert.equal(handle.audio.pauseCalls, 1, "standalone bridge should pause active playback when target volume reaches silence.");

  handle.audio.paused = true;
  handle.playFailed = true;
  handle.nextRetryAtMs = now + FIREFLY_AUDIO_RETRY_COOLDOWN_MS;
  bridge.setVolume(handle, 0.7);
  assert.equal(handle.audio.playCalls, 1, "failed handle should not spam replay while retry cooldown is active.");
}

function runMissingAssetFailureSafetyCheck() {
  let now = 40;
  class RejectingAudio {
    constructor(_path) {
      this.volume = 0;
      this.loop = true;
      this.paused = true;
      this._error = null;
      this.playCalls = 0;
    }
    addEventListener(type, cb) {
      if (type === "error") this._error = cb;
    }
    play() {
      this.playCalls += 1;
      return Promise.reject(new Error("asset missing"));
    }
  }
  const bridge = createStandaloneFireflyAudioBridge({
    audioCtor: RejectingAudio,
    audioContextCtor: null,
    nowMs: () => now,
  });
  const handle = bridge.getHandle("missing.ogg", true, "missing");
  bridge.setVolume(handle, 0.5);
  return Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => {
      assert.equal(handle.playFailed, true, "missing asset playback failures should be tracked as non-fatal.");
      const firstCooldown = handle.nextRetryAtMs;
      bridge.setVolume(handle, 0.5);
      assert.equal(handle.audio.playCalls, 1, "missing asset should not retry every tick during cooldown.");
      now = firstCooldown + 1;
      bridge.setVolume(handle, 0.5);
      assert.equal(handle.audio.playCalls, 2, "missing asset may retry after cooldown without crashing.");
    });
}

function runLegacyBridgeDetectionCheck() {
  const runtimeWindow = {
    Lumo: {
      Entities: function Entities() {},
    },
  };
  runtimeWindow.Lumo.Entities.prototype = {
    _getSoundHandle() {},
    _setHandleVolume() {},
    _setHandlePan() {},
    _ensureSpatialHandle() {},
    _getSfxVolume() {},
  };
  const bridge = createLegacyEntitiesFireflyAudioBridge(runtimeWindow);
  assert.ok(bridge, "legacy bridge should resolve when Entities audio helpers exist.");
  const unifiedBridge = createFireflyAudioBridge({ runtimeGlobal: runtimeWindow });
  assert.ok(unifiedBridge, "unified bridge should prefer legacy entities helper path when present.");
  const stillLegacyWhenStandalonePreferred = createFireflyAudioBridge({
    runtimeGlobal: runtimeWindow,
    preferStandalone: true,
    audioCtor: class AudioStub {},
  });
  assert.equal(stillLegacyWhenStandalonePreferred?.source, "legacy-entities-audio", "legacy entities bridge must remain preferred when available.");
}

function runBridgeFallbackSafetyCheck() {
  const noBridge = createFireflyAudioBridge({
    runtimeGlobal: {},
    audioCtor: null,
  });
  assert.equal(noBridge, null, "bridge creation should fail safely when neither legacy nor standalone audio is usable.");
  const standaloneFallback = createFireflyAudioBridge({
    runtimeGlobal: {},
    audioCtor: class AudioStub {},
  });
  assert.equal(standaloneFallback?.source, "standalone-html-audio", "standalone bridge should be used only as fallback when legacy helpers are unavailable.");
}

runRestModeSilenceCheck();
runAudibleModeChecks();
runDistanceGainCheck();
runPanCheck();
runPerEntityIdentityAndCleanupCheck();
runTriggerSourceIsolationCheck();
runStandaloneBridgePlaybackSafetyCheck();
runLegacyBridgeDetectionCheck();
runBridgeFallbackSafetyCheck();
await runMissingAssetFailureSafetyCheck();

console.log("lumo-recharged-firefly-audio-runtime-checks: ok");
