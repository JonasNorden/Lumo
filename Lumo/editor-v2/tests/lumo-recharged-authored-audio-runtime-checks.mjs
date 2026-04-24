import assert from "node:assert/strict";

import {
  computeZoneFrame,
  computeSpotFrame,
  computeTriggerFrame,
  createRechargedAuthoredAudioState,
  syncRechargedAuthoredAudioFrame,
} from "../src/runtime/rechargedAuthoredAudioRuntime.js";
import { getAuthoredSoundSource } from "../src/domain/sound/sourceReference.js";

function runSpotSpatialAttenuationCheck() {
  const near = computeSpotFrame(
    {
      audioId: "spot-near",
      audioType: "spot",
      x: 120,
      y: 120,
      params: { source: "data/assets/audio/spot/hum/spot_hum_01.ogg", radius: 6, volume: 0.8, spatial: true },
    },
    { x: 120, y: 120 },
    24,
  );
  const far = computeSpotFrame(
    {
      audioId: "spot-far",
      audioType: "spot",
      x: 120,
      y: 120,
      params: { source: "data/assets/audio/spot/hum/spot_hum_01.ogg", radius: 6, volume: 0.8, spatial: true },
    },
    { x: 320, y: 320 },
    24,
  );

  assert.equal(near.targetVolume > far.targetVolume, true, "spot volume should attenuate by distance.");
}

function runTriggerEnterActivationCheck() {
  const frame = computeTriggerFrame(
    {
      audioId: "trigger-a",
      audioType: "trigger",
      x: 240,
      y: 120,
      params: { source: "data/assets/audio/events/enemies/common/swoosh_01.ogg", triggerWidth: 80, loop: false },
    },
    { x: 240, y: 120 },
    { x: 120, y: 120 },
    24,
  );

  assert.equal(frame.enteredRange, true, "trigger should activate when player enters authored width range.");
  assert.equal(frame.targetVolume, 1, "trigger should use authored base volume when entering range.");
}

function runTriggerNoDistanceAttenuationCheck() {
  const nearFrame = computeTriggerFrame(
    {
      audioId: "trigger-near",
      audioType: "trigger",
      x: 240,
      y: 120,
      params: { source: "data/assets/audio/events/enemies/common/swoosh_01.ogg", radius: 6, volume: 0.9, loop: false, spatial: true },
    },
    { x: 239, y: 120 },
    { x: 50, y: 120 },
    24,
  );
  const edgeFrame = computeTriggerFrame(
    {
      audioId: "trigger-edge",
      audioType: "trigger",
      x: 240,
      y: 120,
      params: { source: "data/assets/audio/events/enemies/common/swoosh_01.ogg", radius: 6, volume: 0.9, loop: false, spatial: true },
    },
    { x: 384, y: 120 },
    { x: 390, y: 120 },
    24,
  );

  assert.equal(nearFrame.inRange, true, "near trigger frame should be in range.");
  assert.equal(edgeFrame.inRange, true, "edge trigger frame should still be in range.");
  assert.equal(nearFrame.targetVolume, 0.9, "trigger should keep authored volume when in range.");
  assert.equal(edgeFrame.targetVolume, 0.9, "trigger volume should not be distance attenuated.");
}

function runSyncBehaviorCheck() {
  const calls = [];
  const handleByKey = new Map();
  let handleCreates = 0;
  const bridge = {
    getHandle(path, loop, key) {
      if (!handleByKey.has(key)) {
        handleCreates += 1;
      }
      const handle = {
        path,
        loop,
        key,
        audio: {
          paused: true,
          currentTime: 0,
          playbackRate: 1,
          pause() {},
        },
      };
      handleByKey.set(key, handle);
      return handle;
    },
    ensureSpatial(_handle) {},
    setPan(handle, pan) {
      calls.push({ kind: "pan", key: handle.key, pan });
    },
    setVolume(handle, volume) {
      calls.push({ kind: "volume", key: handle.key, volume });
    },
  };

  const runtimeState = createRechargedAuthoredAudioState();

  syncRechargedAuthoredAudioFrame({
    audioItems: [
      {
        audioId: "spot-live",
        audioType: "spot",
        x: 120,
        y: 120,
        source: "data/assets/audio/spot/hum/spot_hum_01.ogg",
        params: { radius: 6, volume: 0.75, loop: true, spatial: true },
      },
      {
        audioId: "trigger-live",
        audioType: "trigger",
        x: 260,
        y: 120,
        params: { source: "data/assets/audio/events/enemies/common/swoosh_01.ogg", triggerWidth: 80, loop: false, spatial: true },
      },
      {
        audioId: "ambient-zone-live",
        audioType: "ambientZone",
        x: 220,
        y: 80,
        params: { soundFile: "data/assets/audio/ambient/ruin/dark-ambient-horror.ogg", width: 6, height: 5, loop: true },
      },
      {
        audioId: "music-zone-live",
        audioType: "musicZone",
        x: 220,
        y: 80,
        params: { source: "data/assets/audio/music/game_play_1.ogg", width: 6, height: 5, loop: true },
      },
    ],
    playerSnapshot: { x: 250, y: 106, w: 22, h: 28 },
    previousPlayerSnapshot: { x: 120, y: 106, w: 22, h: 28 },
    tileSize: 24,
    bridge,
    runtimeState,
  });

  const spotVolumeCall = calls.find((call) => call.kind === "volume" && call.key === "spot::spot-live");
  const triggerVolumeCall = calls.find((call) => call.kind === "volume" && call.key === "trigger::trigger-live");
  const ambientZoneCall = calls.find((call) => call.kind === "volume" && call.key === "ambientZone::ambient-zone-live");
  const musicZoneCall = calls.find((call) => call.kind === "volume" && call.key === "musicZone::music-zone-live");
  assert.ok(spotVolumeCall, "spot audio should route into bridge volume updates.");
  assert.ok(triggerVolumeCall, "trigger enter should route into bridge playback volume updates.");
  assert.ok(ambientZoneCall && ambientZoneCall.volume > 0, "ambient zones should produce active runtime volume while player is in-zone.");
  assert.ok(musicZoneCall && musicZoneCall.volume > 0, "music zones should produce active runtime volume while player is in-zone.");
  assert.equal(handleByKey.get("spot::spot-live")?.path, "data/assets/audio/spot/hum/spot_hum_01.ogg");
  assert.equal(handleByKey.get("ambientZone::ambient-zone-live")?.path, "data/assets/audio/ambient/ruin/dark-ambient-horror.ogg");
  assert.equal(handleCreates >= 4, true, "sync should create one authored handle per active authored source.");
  assert.equal(runtimeState.debug.activeThisFrame > 0, true, "sync debug state should report active authored audio frames.");
}

function runTileCoordinateInterpretationCheck() {
  const calls = [];
  const bridge = {
    getHandle(path, loop, key) {
      return {
        path,
        loop,
        key,
        audio: {
          paused: true,
          currentTime: 0,
          playbackRate: 1,
          pause() {},
        },
      };
    },
    ensureSpatial(_handle) {},
    setPan(_handle, _pan) {},
    setVolume(handle, volume) {
      calls.push({ key: handle.key, volume });
    },
  };
  const runtimeState = createRechargedAuthoredAudioState();
  syncRechargedAuthoredAudioFrame({
    audioItems: [
      {
        audioId: "tile-spot",
        audioType: "spot",
        x: 10,
        y: 5,
        source: "data/assets/audio/spot/hum/spot_hum_01.ogg",
        params: { radius: 6, volume: 0.9, loop: true, spatial: true },
      },
      {
        audioId: "tile-trigger",
        audioType: "trigger",
        x: 11,
        y: 5,
        source: "data/assets/audio/events/enemies/common/swoosh_01.ogg",
        params: { triggerWidth: 2, loop: false, volume: 1, spatial: true },
      },
      {
        audioId: "tile-ambient",
        audioType: "ambientZone",
        x: 8,
        y: 4,
        source: "data/assets/audio/ambient/ruin/dark-ambient-horror.ogg",
        params: { width: 6, height: 4, loop: true, volume: 0.5 },
      },
      {
        audioId: "tile-music",
        audioType: "musicZone",
        x: 8,
        y: 4,
        source: "data/assets/audio/music/game_play_1.ogg",
        params: { width: 6, height: 4, loop: true, volume: 0.65 },
      },
    ],
    playerSnapshot: { x: 240, y: 116, w: 22, h: 28 },
    previousPlayerSnapshot: { x: 120, y: 116, w: 22, h: 28 },
    tileSize: 24,
    coordinateScale: 24,
    bridge,
    runtimeState,
  });
  const audibleCalls = calls.filter((call) => call.volume > 0.001);
  assert.equal(audibleCalls.length >= 3, true, "tile-space authored audio should become audible after tile-to-pixel scaling.");
  assert.equal(runtimeState.debug.coordinateScale, 24, "debug state should record the authored coordinate scale used.");
  assert.equal(runtimeState.debug.startedThisFrame >= 4, true, "debug state should report authored handle starts.");
}

function runFootAnchoredActivationCheck() {
  const calls = [];
  const bridge = {
    getHandle(path, loop, key) {
      return {
        path,
        loop,
        key,
        audio: {
          paused: true,
          currentTime: 0,
          playbackRate: 1,
          pause() {},
        },
      };
    },
    ensureSpatial(_handle) {},
    setPan(_handle, _pan) {},
    setVolume(handle, volume) {
      calls.push({ key: handle.key, volume });
    },
  };
  const runtimeState = createRechargedAuthoredAudioState();
  syncRechargedAuthoredAudioFrame({
    audioItems: [
      {
        audioId: "foot-spot",
        audioType: "spot",
        x: 10,
        y: 15,
        source: "data/assets/audio/spot/hum/spot_hum_01.ogg",
        params: { radius: 4, volume: 0.9, loop: true, spatial: true },
      },
      {
        audioId: "foot-trigger",
        audioType: "trigger",
        x: 11,
        y: 15,
        source: "data/assets/audio/events/enemies/common/swoosh_01.ogg",
        params: { triggerWidth: 2, loop: false, volume: 1, spatial: true },
      },
      {
        audioId: "foot-zone",
        audioType: "ambientZone",
        x: 9,
        y: 14,
        source: "data/assets/audio/ambient/ruin/dark-ambient-horror.ogg",
        params: { width: 5, height: 3, loop: true, volume: 0.5 },
      },
    ],
    // Runtime snapshots expose x/y as feet anchors (center-x, foot-y).
    playerSnapshot: { x: 240, y: 360 },
    previousPlayerSnapshot: { x: 120, y: 360 },
    tileSize: 24,
    coordinateScale: 24,
    bridge,
    runtimeState,
  });

  assert.equal(runtimeState.debug.activeThisFrame > 0, true, "foot-anchored snapshots should still activate authored audio.");
  assert.equal(
    runtimeState.debug.playerCenterUsed?.anchor === "feetFromXY",
    true,
    "debug state should report feet-from-xy player anchoring for runtime snapshots without explicit size.",
  );
  assert.equal(Array.isArray(runtimeState.debug.itemDebug), true, "debug state should include per-item activation telemetry.");
  assert.equal(
    runtimeState.debug.itemDebug.some((item) => item.id === "foot-spot" && item.active === true && item.targetVolume > 0),
    true,
    "spot telemetry should report active when player overlaps scaled authored position.",
  );
  assert.equal(
    runtimeState.debug.itemDebug.some((item) => item.id === "foot-trigger" && item.enteredRange === true),
    true,
    "trigger telemetry should report entered-range activation.",
  );
  assert.equal(
    runtimeState.debug.itemDebug.some((item) => item.id === "foot-trigger" && item.playedThisFrame === true && item.reason === "entered-range-one-shot"),
    true,
    "trigger telemetry should report one-shot playback state and reason.",
  );
  assert.equal(
    runtimeState.debug.itemDebug.some((item) => item.id === "foot-zone" && item.inside === true),
    true,
    "zone telemetry should report inside=true when player overlaps authored area.",
  );

  const audibleCalls = calls.filter((call) => call.volume > 0.001);
  assert.equal(audibleCalls.length >= 2, true, "foot-anchored overlap should drive non-zero bridge volume calls.");
}

function runZoneFrameCheck() {
  const activeFrame = computeZoneFrame(
    {
      audioId: "zone-active",
      audioType: "ambientZone",
      x: 96,
      y: 96,
      params: { source: "data/assets/audio/ambient/ruin/dark-ambient-horror.ogg", width: 4, height: 4, volume: 0.5, loop: true },
    },
    { x: 120, y: 120 },
    24,
    0.45,
  );
  const inactiveFrame = computeZoneFrame(
    {
      audioId: "zone-inactive",
      audioType: "musicZone",
      x: 400,
      y: 400,
      params: { source: "data/assets/audio/music/game_play_1.ogg", width: 3, height: 3, volume: 0.8, loop: true },
    },
    { x: 120, y: 120 },
    24,
    0.78,
  );
  assert.equal(activeFrame.active, true, "zone frame should activate when player center is inside zone bounds.");
  assert.equal(activeFrame.targetVolume > 0, true, "active zones should emit a non-zero target volume.");
  assert.equal(inactiveFrame.active, false, "zone frame should deactivate when player center is outside zone bounds.");
  assert.equal(inactiveFrame.targetVolume, 0, "inactive zones should not output volume.");
}

function runSourceResolutionCheck() {
  assert.equal(
    getAuthoredSoundSource({ params: { soundFile: "data/assets/audio/ambient/void/void_rumble.ogg" } }),
    "data/assets/audio/ambient/void/void_rumble.ogg",
    "authored source resolver should accept params.soundFile runtime payloads.",
  );
}

function runTriggerOneShotOnceCheck() {
  const calls = [];
  const bridge = {
    getHandle(path, loop, key) {
      return {
        path,
        loop,
        key,
        audio: {
          paused: true,
          currentTime: 0,
          playbackRate: 1,
          pause() {},
        },
      };
    },
    ensureSpatial(_handle) {},
    setPan(_handle, _pan) {},
    setVolume(handle, volume) {
      calls.push({ key: handle.key, volume });
    },
  };
  const runtimeState = createRechargedAuthoredAudioState();
  const audioItems = [
    {
      audioId: "trigger-once",
      audioType: "trigger",
      x: 240,
      y: 120,
      source: "data/assets/audio/events/enemies/common/swoosh_01.ogg",
      params: { radius: 6, loop: false, volume: 0.75, spatial: true },
    },
  ];

  syncRechargedAuthoredAudioFrame({
    audioItems,
    playerSnapshot: { x: 230, y: 106, w: 22, h: 28 },
    previousPlayerSnapshot: { x: 80, y: 106, w: 22, h: 28 },
    tileSize: 24,
    bridge,
    runtimeState,
  });
  syncRechargedAuthoredAudioFrame({
    audioItems,
    playerSnapshot: { x: 231, y: 106, w: 22, h: 28 },
    previousPlayerSnapshot: { x: 230, y: 106, w: 22, h: 28 },
    tileSize: 24,
    bridge,
    runtimeState,
  });

  const triggerCalls = calls.filter((call) => call.key === "trigger::trigger-once" && call.volume > 0.001);
  assert.equal(triggerCalls.length, 1, "one-shot trigger should play once on range entry.");
}

runSpotSpatialAttenuationCheck();
runTriggerEnterActivationCheck();
runTriggerNoDistanceAttenuationCheck();
runSyncBehaviorCheck();
runTileCoordinateInterpretationCheck();
runFootAnchoredActivationCheck();
runZoneFrameCheck();
runSourceResolutionCheck();
runTriggerOneShotOnceCheck();

console.log("lumo-recharged-authored-audio-runtime-checks: ok");
