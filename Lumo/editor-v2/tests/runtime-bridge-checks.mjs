import assert from "node:assert/strict";

import { v2ToRuntimeLevelObject } from "../src/runtime/v2ToRuntimeLevelObject.js";
import {
  EDITOR_PLAY_LEVEL_KEY,
  EDITOR_PLAY_SPAWN_KEY,
  writeEditorPlaySessionPayload,
} from "../src/runtime/editorPlaySessionBridge.js";

function createMockLevelDocument() {
  return {
    meta: {
      id: "bridge-test",
      name: "Bridge Test",
      version: "2.0.0",
    },
    dimensions: {
      width: 4,
      height: 3,
      tileSize: 24,
    },
    tiles: {
      base: Array.from({ length: 12 }, (_, index) => index),
    },
    backgrounds: {
      layers: [{ id: "bg-1", name: "Sky", type: "color", depth: 0, visible: true, color: "#000000" }],
    },
    background: {
      base: new Array(12).fill(null),
    },
    entities: [
      { id: "spawn", name: "Spawn", type: "player-spawn", x: 1, y: 2, visible: true, params: {} },
      { id: "exit", name: "Exit", type: "player-exit", x: 3, y: 2, visible: true, params: {} },
      { id: "fog", name: "Fog", type: "fog_volume", x: 2, y: 1, visible: true, params: { area: { x0: 0, x1: 48, y0: 24 } } },
      { id: "water", name: "Water", type: "water_volume", x: 0, y: 0, visible: true, params: {} },
    ],
    sounds: [
      { id: "spot", name: "Spot", type: "spot", x: 1, y: 1, visible: true, source: "data/assets/audio/spot/test.ogg", params: { radius: 5, volume: 0.8, fadeDistance: 2 } },
      { id: "trg", name: "Trigger", type: "trigger", x: 2, y: 1, visible: true, source: "data/assets/audio/events/test.ogg", params: { loop: false, volume: 1 } },
      { id: "music", name: "Music", type: "musicZone", x: 0, y: 0, visible: true, source: "data/assets/audio/music/test.mp3", params: { width: 6, volume: 0.6, fadeDistance: 3 } },
    ],
    decor: [],
    extra: {},
  };
}

function runAdapterChecks() {
  const doc = createMockLevelDocument();
  const { runtimeLevel, unsupported } = v2ToRuntimeLevelObject(doc);

  assert.equal(runtimeLevel.meta.w, 4);
  assert.equal(runtimeLevel.meta.h, 3);
  assert.equal(runtimeLevel.layers.main.length, 12);
  assert.deepEqual(runtimeLevel.layers.main, doc.tiles.base);

  const spawn = runtimeLevel.layers.ents.find((entity) => entity.id === "start_01");
  const exit = runtimeLevel.layers.ents.find((entity) => entity.id === "exit_01");
  assert.ok(spawn, "player-spawn should bridge to start_01");
  assert.ok(exit, "player-exit should bridge to exit_01");

  assert.ok(runtimeLevel.layers.ents.find((entity) => entity.id === "spot_sound"), "spot sound should map to spot_sound entity");
  assert.ok(runtimeLevel.layers.ents.find((entity) => entity.id === "trigger_sound"), "trigger sound should map to trigger_sound entity");
  assert.ok(runtimeLevel.layers.ents.find((entity) => entity.id === "music_zone"), "music sound should map to music_zone entity");
  assert.ok(runtimeLevel.layers.ents.find((entity) => entity.id === "fog_volume"), "fog_volume should bridge via runtime entity path");

  assert.equal(
    unsupported.some((entry) => entry.includes("water_volume")),
    true,
    "water_volume should be reported as unsupported in bridge diagnostics",
  );
}

function createMemorySessionStorage() {
  const map = new Map();
  return {
    setItem(key, value) {
      map.set(String(key), String(value));
    },
    getItem(key) {
      return map.has(String(key)) ? map.get(String(key)) : null;
    },
    removeItem(key) {
      map.delete(String(key));
    },
  };
}

function runSessionBridgeChecks() {
  const { runtimeLevel } = v2ToRuntimeLevelObject(createMockLevelDocument());
  const sessionStorageRef = createMemorySessionStorage();

  writeEditorPlaySessionPayload({
    runtimeLevel,
    spawnOverride: { x: 7, y: 8 },
    sessionStorageRef,
  });

  assert.ok(sessionStorageRef.getItem(EDITOR_PLAY_LEVEL_KEY), "runtime level payload should be written to editor play level key");
  assert.deepEqual(JSON.parse(sessionStorageRef.getItem(EDITOR_PLAY_SPAWN_KEY)), { x: 7, y: 8 });
}

runAdapterChecks();
runSessionBridgeChecks();

console.log("runtime bridge checks passed");
