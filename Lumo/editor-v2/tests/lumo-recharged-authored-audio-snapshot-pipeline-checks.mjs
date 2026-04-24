import assert from "node:assert/strict";

import { createLumoRechargedBootAdapter } from "../src/runtime/createLumoRechargedBootAdapter.js";

const levelWithAuthoredAudio = {
  identity: { id: "audio-carry-world", formatVersion: "1.0.0", themeId: "test-theme", name: "Audio Carry" },
  world: {
    width: 16,
    height: 12,
    tileSize: 32,
    spawn: { x: 32, y: 32 },
  },
  layers: {
    tiles: [],
    background: [],
    decor: [],
    entities: [],
    audio: [
      {
        audioId: "spot-wind",
        audioType: "spot",
        x: 96,
        y: 128,
        source: "data/assets/audio/spot/wind/wind.ogg",
        params: { radius: 64, volume: 0.5, tags: { weather: "wind" } },
        variant: "wind",
        tags: ["outside"],
      },
      {
        audioId: "trigger-chime",
        audioType: "trigger",
        x: 224,
        y: 128,
        source: "data/assets/audio/events/enemies/common/swoosh_01.ogg",
        params: { triggerWidth: 48, loop: false, volume: 1 },
        tags: ["checkpoint", "sfx"],
      },
      {
        audioId: "sound-2",
        audioType: "trigger",
        x: 240,
        y: 144,
        params: { triggerWidth: 32, loop: false, volume: 0.9 },
      },
      {
        audioId: "ambient-preserved-soundfile",
        audioType: "ambientZone",
        x: 144,
        y: 72,
        params: {
          soundFile: "data/assets/audio/ambient/void/void_pressure_01.ogg",
          width: 5,
          height: 3,
          loop: true,
          volume: 0.5,
        },
      },
    ],
  },
};

const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: levelWithAuthoredAudio });
await adapter.prepare();
await adapter.boot();
adapter.tick();

const worldSnapshot = adapter.getWorldSnapshot();
const bootPayload = adapter.getBootPayload();

assert.equal(Array.isArray(worldSnapshot.audioItems), true, "world snapshots should expose authored audio as audioItems.");
assert.equal(worldSnapshot.audioItems.length, 4, "world snapshot should carry all authored audio entries.");
assert.deepEqual(worldSnapshot.audioItems[0], {
  audioId: "spot-wind",
  audioType: "spot",
  x: 96,
  y: 128,
  source: "data/assets/audio/spot/wind/wind.ogg",
  asset: "data/assets/audio/spot/wind/wind.ogg",
  variant: "wind",
  tags: ["outside"],
  params: { radius: 64, volume: 0.5, tags: { weather: "wind" } },
});
assert.deepEqual(worldSnapshot.audioItems[1], {
  audioId: "trigger-chime",
  audioType: "trigger",
  x: 224,
  y: 128,
  source: "data/assets/audio/events/enemies/common/swoosh_01.ogg",
  asset: "data/assets/audio/events/enemies/common/swoosh_01.ogg",
  variant: null,
  tags: ["checkpoint", "sfx"],
  params: { triggerWidth: 48, loop: false, volume: 1 },
});
assert.equal(
  worldSnapshot.audioItems[2].source,
  "data/assets/audio/events/creatures/firefly_01.ogg",
  "audioId-only authored entries should resolve a playable source through the sound catalog.",
);
assert.equal(
  worldSnapshot.audioItems[2].asset,
  "data/assets/audio/events/creatures/firefly_01.ogg",
  "audioId-only authored entries should expose a playable asset in snapshot payloads.",
);
assert.equal(
  worldSnapshot.audioItems[3].source,
  "data/assets/audio/ambient/void/void_pressure_01.ogg",
  "params.soundFile should be preserved and exposed as the playable source.",
);
assert.equal(
  worldSnapshot.audioItems[3].asset,
  "data/assets/audio/ambient/void/void_pressure_01.ogg",
  "params.soundFile should also project into asset for boot/runtime authored audio payloads.",
);
assert.deepEqual(
  bootPayload.audioItems,
  worldSnapshot.audioItems,
  "boot payload should surface the same authored audio collection published by getWorldSnapshot.",
);

console.log("lumo-recharged-authored-audio-snapshot-pipeline-checks: ok");
