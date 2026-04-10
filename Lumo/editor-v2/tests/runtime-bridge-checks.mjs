import assert from "node:assert/strict";

import { v2ToRuntimeLevelObject } from "../src/runtime/v2ToRuntimeLevelObject.js";
import { renderRuntimeBridgeStatus } from "../src/runtime/renderRuntimeBridgeStatus.js";
import { renderRuntimeBridgeViewModel } from "../src/runtime/renderRuntimeBridgeViewModel.js";
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
      placements: [
        { x: 1, y: 2, size: 2, value: 15 },
        { x: 3, y: 2, size: 3, value: 101, catalogTileId: "custom_runtime_tile", img: "../data/assets/tiles/custom_runtime_tile.png" },
      ],
    },
    backgrounds: {
      layers: [{ id: "bg-1", name: "Sky", type: "color", depth: 0, visible: true, color: "#000000" }],
    },
    background: {
      base: new Array(12).fill("bg_stone_wall"),
      materials: [
        { id: "bg_stone_wall", img: "../data/assets/sprites/bg/wall_05.png" },
        { id: "bg_arch", img: "../data/assets/tiles/stone_02.png" },
      ],
    },
    entities: [
      { id: "spawn", name: "Spawn", type: "player-spawn", x: 1, y: 2, visible: true, params: {} },
      { id: "exit", name: "Exit", type: "player-exit", x: 3, y: 2, visible: true, params: {} },
      { id: "fog", name: "Fog", type: "fog_volume", x: 2, y: 1, visible: true, params: { area: { x0: 0, x1: 48, y0: 24 } } },
      { id: "water", name: "Water", type: "water_volume", x: 0, y: 0, visible: true, params: {} },
      { id: "water-legacy", name: "Water Legacy", type: "waterVolume", x: 1, y: 0, visible: true, params: {} },
      { id: "lava-legacy", name: "Lava Legacy", type: "lavaVolume", x: 2, y: 0, visible: true, params: {} },
      { id: "custom-lantern", name: "Blue Lantern", type: "lantern_01", x: 1, y: 1, visible: true, params: { radius: 200, strength: 0.92 } },
      { id: "bad-entity", name: "Bad Entity", type: "unknown_runtime_thing", x: 0, y: 1, visible: true, params: {} },
    ],
    sounds: [
      { id: "spot", name: "Spot", type: "spot", x: 1, y: 1, visible: true, source: "data/assets/audio/spot/test.ogg", params: { radius: 5, volume: 0.8, fadeDistance: 2 } },
      { id: "trg", name: "Trigger", type: "trigger", x: 2, y: 1, visible: true, source: "data/assets/audio/events/test.ogg", params: { loop: false, volume: 1 } },
      { id: "music", name: "Music", type: "musicZone", x: 0, y: 0, visible: true, source: "data/assets/audio/music/test.mp3", params: { width: 6, volume: 0.6, fadeDistance: 3 } },
    ],
    decor: [
      { id: "decor-1", name: "Flower", type: "decor_flower_01", x: 1, y: 0, visible: true, variant: "d", params: {} },
      { id: "decor-unsupported", name: "Unsupported Decor", type: "not_real_decor_type", x: 0, y: 0, visible: true, params: {} },
    ],
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
  assert.equal(runtimeLevel.layers.bg.length, 12);
  assert.equal(runtimeLevel.layers.bg[0], "bg_stone_wall_cc", "background base should map to runtime-supported bg ids");
  assert.deepEqual(runtimeLevel.layers.bg, runtimeLevel.editor.bg, "runtime bg should be mirrored on editor.bg fallback path");
  assert.equal(
    runtimeLevel.layers.tileVisualOverrides["1,2"]?.catalogTileId,
    "stone_ct",
    "tile override should carry canonical catalog identity for guarded tile ids",
  );
  assert.equal(
    runtimeLevel.layers.tileVisualOverrides["3,2"]?.catalogTileId,
    "custom_runtime_tile",
    "tile override should preserve authored catalogTileId when provided",
  );
  assert.equal(
    runtimeLevel.layers.tileVisualOverrides["3,2"]?.img,
    "../data/assets/tiles/custom_runtime_tile.png",
    "tile override should preserve authored image fallback when provided",
  );

  const spawn = runtimeLevel.layers.ents.find((entity) => entity.id === "start_01");
  const exit = runtimeLevel.layers.ents.find((entity) => entity.id === "exit_01");
  assert.ok(spawn, "player-spawn should bridge to start_01");
  assert.ok(exit, "player-exit should bridge to exit_01");
  const customLantern = runtimeLevel.layers.ents.find((entity) => entity.id === "lantern_01" && entity?.params?.radius === 200);
  assert.ok(customLantern, "custom entity preset mapped to lantern_01 should bridge using existing runtime family");
  assert.equal(customLantern?.params?.radius, 200);

  assert.ok(runtimeLevel.layers.ents.find((entity) => entity.id === "spot_sound"), "spot sound should map to spot_sound entity");
  assert.ok(runtimeLevel.layers.ents.find((entity) => entity.id === "trigger_sound"), "trigger sound should map to trigger_sound entity");
  assert.ok(runtimeLevel.layers.ents.find((entity) => entity.id === "music_zone"), "music sound should map to music_zone entity");
  assert.ok(runtimeLevel.layers.ents.find((entity) => entity.id === "fog_volume"), "fog_volume should bridge via runtime entity path");
  const flowerDecor = runtimeLevel.layers.ents.find((entity) => entity.id === "decor_flower_01");
  assert.ok(flowerDecor, "supported decor should bridge via runtime entity path");
  assert.equal(flowerDecor?.params?.variant, 4, "flower decor variant should bridge as runtime variant index 1..4");

  assert.equal(
    unsupported.some((entry) => entry.includes("bad-entity") && entry.includes("unknown_runtime_thing")),
    true,
    "unsupported authored entities should be diagnosed with authored id and type",
  );
  assert.equal(
    unsupported.some((entry) => entry.includes("decor-unsupported") && entry.includes("not_real_decor_type")),
    true,
    "unsupported authored decor should be diagnosed with authored id and type",
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


function runBridgeStatusRenderChecks() {
  const idleStatus = renderRuntimeBridgeStatus({ query: { steps: 2 }, levelPath: "./src/data/testLevelDocument.v1.json" });

  assert.equal(idleStatus.title, "Recharged Runtime Bridge");
  assert.equal(typeof idleStatus.statusLine, "string");
  assert.equal(idleStatus.summary.bridgeStatus, "idle");
  assert.equal(idleStatus.summary.sourceType, "unknown");
  assert.equal(Array.isArray(idleStatus.errors), true);
}


function runBridgeViewModelChecks() {
  const viewModel = renderRuntimeBridgeViewModel({
    bridge: {
      getStatus() {
        return "running";
      },
      getActiveController() {
        return {
          getStatus() {
            return "running";
          },
          isPaused() {
            return false;
          },
          getSummary() {
            return {
              worldId: "vm-world",
              themeId: "vm-theme",
              runtimeTick: 7,
              playerStatus: "spawn-grounded",
              grounded: true,
              falling: false,
            };
          },
          getDebugSnapshot() {
            return {
              sourceType: "level-path",
              status: "running",
            };
          },
        };
      },
      getActiveSession() {
        return {
          world: {
            width: 4,
            height: 3,
            tileSize: 16,
            spawn: { x: 32, y: 16 },
            identity: { id: "vm-world", themeId: "vm-theme" },
            layers: {
              tiles: [{ tileId: "stone", x: 1, y: 1, w: 2, h: 1 }],
              background: [{ backgroundId: "bg-sky", order: 0, parallax: 0.3 }],
              decor: [{ decorId: "flower", x: 12, y: 14, order: 2, variant: "blue" }],
              entities: [{ entityType: "enemy-slime", x: 44, y: 16 }],
              audio: [{ audioId: "wind-loop", audioType: "spot", x: 20, y: 20, radius: 48 }],
            },
          },
          player: {
            position: { x: 32, y: 32 },
            grounded: true,
            falling: false,
            mode: "grounded",
          },
          runtime: { tick: 7 },
        };
      },
    },
  });

  assert.equal(viewModel.ok, true);
  assert.equal(viewModel.world.width, 4);
  assert.equal(viewModel.tiles.length, 1);
  assert.equal(viewModel.tiles[0].worldW, 32);
  assert.equal(viewModel.spawn.x, 32);
  assert.equal(viewModel.player.y, 32);
  assert.equal(viewModel.overlay.runtimeTick, 7);
  assert.equal(viewModel.background.length, 1);
  assert.equal(viewModel.decor.length, 1);
  assert.equal(viewModel.entities.length, 1);
  assert.equal(viewModel.audio.length, 1);
  assert.equal(viewModel.overlay.counts.tiles, 1);
  assert.equal(viewModel.overlay.counts.background, 1);
  assert.equal(viewModel.overlay.counts.decor, 1);
  assert.equal(viewModel.overlay.counts.entities, 1);
  assert.equal(viewModel.overlay.counts.audio, 1);
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
runBridgeStatusRenderChecks();
runBridgeViewModelChecks();

console.log("runtime bridge checks passed");
