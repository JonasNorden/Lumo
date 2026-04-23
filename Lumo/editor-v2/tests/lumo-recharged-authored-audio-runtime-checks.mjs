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
}

function runSyncBehaviorCheck() {
  const calls = [];
  const handleByKey = new Map();
  const bridge = {
    getHandle(path, loop, key) {
      const handle = { path, loop, key, audio: { paused: true, currentTime: 0, playbackRate: 1, pause() {} } };
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

runSpotSpatialAttenuationCheck();
runTriggerEnterActivationCheck();
runSyncBehaviorCheck();
runZoneFrameCheck();
runSourceResolutionCheck();

console.log("lumo-recharged-authored-audio-runtime-checks: ok");
