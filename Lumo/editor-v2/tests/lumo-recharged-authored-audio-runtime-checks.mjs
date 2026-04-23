import assert from "node:assert/strict";

import {
  computeSpotFrame,
  computeTriggerFrame,
  createRechargedAuthoredAudioState,
  syncRechargedAuthoredAudioFrame,
} from "../src/runtime/rechargedAuthoredAudioRuntime.js";

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
  const bridge = {
    getHandle(path, loop, key) {
      return { path, loop, key, audio: { paused: true, currentTime: 0, playbackRate: 1, pause() {} } };
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
        params: { source: "data/assets/audio/spot/hum/spot_hum_01.ogg", radius: 6, volume: 0.75, loop: true, spatial: true },
      },
      {
        audioId: "trigger-live",
        audioType: "trigger",
        x: 260,
        y: 120,
        params: { source: "data/assets/audio/events/enemies/common/swoosh_01.ogg", triggerWidth: 80, loop: false, spatial: true },
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
  assert.ok(spotVolumeCall, "spot audio should route into bridge volume updates.");
  assert.ok(triggerVolumeCall, "trigger enter should route into bridge playback volume updates.");
}

runSpotSpatialAttenuationCheck();
runTriggerEnterActivationCheck();
runSyncBehaviorCheck();

console.log("lumo-recharged-authored-audio-runtime-checks: ok");
