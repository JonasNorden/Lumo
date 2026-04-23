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
        params: { radius: 64, volume: 0.5, tags: { weather: "wind" } },
        variant: "wind",
        tags: ["outside"],
      },
      {
        audioId: "trigger-chime",
        audioType: "trigger",
        x: 224,
        y: 128,
        params: { triggerWidth: 48, loop: false, volume: 1 },
        tags: ["checkpoint", "sfx"],
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
assert.equal(worldSnapshot.audioItems.length, 2, "world snapshot should carry authored spot + trigger entries.");
assert.deepEqual(worldSnapshot.audioItems[0], {
  audioId: "spot-wind",
  audioType: "spot",
  x: 96,
  y: 128,
  variant: "wind",
  tags: ["outside"],
  params: { radius: 64, volume: 0.5, tags: { weather: "wind" } },
});
assert.deepEqual(worldSnapshot.audioItems[1], {
  audioId: "trigger-chime",
  audioType: "trigger",
  x: 224,
  y: 128,
  variant: null,
  tags: ["checkpoint", "sfx"],
  params: { triggerWidth: 48, loop: false, volume: 1 },
});
assert.deepEqual(
  bootPayload.audioItems,
  worldSnapshot.audioItems,
  "boot payload should surface the same authored audio collection published by getWorldSnapshot.",
);

console.log("lumo-recharged-authored-audio-snapshot-pipeline-checks: ok");
