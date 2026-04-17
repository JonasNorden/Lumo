import assert from "node:assert/strict";

import { serializeLevelDocument } from "../src/data/exportLevelDocument.js";
import { createLumoRechargedBootAdapter } from "../src/runtime/createLumoRechargedBootAdapter.js";
import { bootLumoRechargedFromQuery } from "../src/runtime/bootLumoRechargedFromQuery.js";

function createEditorLevelWithBgPlacements() {
  return {
    meta: {
      id: "bg-placement-export",
      name: "BG Placement Export",
      version: "2.0.0",
      themeId: "nature",
    },
    dimensions: {
      width: 6,
      height: 5,
      tileSize: 24,
    },
    tiles: { base: [] },
    background: {
      base: new Array(30).fill(null),
      placements: [
        { x: 1, y: 3, size: 2, materialId: "bg_stone_wall" },
        { x: 3, y: 4, size: 3, materialId: "bg_rock" },
      ],
    },
    backgrounds: { layers: [] },
    decor: [],
    entities: [],
    systems: {},
    layers: {},
  };
}

function createRuntimeLevelWithBgPlacements() {
  return {
    identity: {
      id: "runtime-bg-placement",
      name: "Runtime BG Placement",
      formatVersion: "1.0.0",
      themeId: "nature",
    },
    meta: {},
    world: {
      width: 6,
      height: 5,
      tileSize: 24,
      spawn: { x: 24, y: 24 },
    },
    layers: {
      tiles: [],
      background: [],
      bg: {
        type: "tilemap",
        data: new Array(30).fill(null),
        width: 6,
        height: 5,
        tileSize: 24,
        placements: [
          { x: 1, y: 3, size: 2, materialId: "bg_stone_wall" },
          { x: 3, y: 4, size: 3, materialId: "bg_rock" },
        ],
      },
      decor: [],
      entities: [],
      audio: [],
    },
  };
}

function runExportIncludesBgPlacementsCheck() {
  const editorLevel = createEditorLevelWithBgPlacements();
  const exported = JSON.parse(serializeLevelDocument(editorLevel));

  assert.equal(Array.isArray(exported?.layers?.bg?.data), true);
  assert.equal(Array.isArray(exported?.layers?.bg?.placements), true);
  assert.equal(exported.layers.bg.placements.length, 2);
  assert.deepEqual(exported.layers.bg.placements[0], { x: 1, y: 3, size: 2, materialId: "bg_stone_wall" });
  assert.deepEqual(exported.layers.bg.placements[1], { x: 3, y: 4, size: 3, materialId: "bg_rock" });

  console.log("bg placements export ok");
}

async function runAdapterPayloadKeepsBgPlacementsCheck() {
  const levelDocument = createRuntimeLevelWithBgPlacements();
  const adapter = createLumoRechargedBootAdapter({
    sourceDescriptor: { levelDocument },
  });

  const prepared = await adapter.prepare();
  const booted = await adapter.boot();
  assert.equal(prepared.ok, true);
  assert.equal(booted.ok, true);

  const payload = adapter.getBootPayload();
  assert.equal(payload?.bg?.type, "tilemap");
  assert.equal(Array.isArray(payload?.bg?.placements), true);
  assert.equal(payload.bg.placements.length, 2);
  assert.deepEqual(payload.bg.placements[0], { x: 1, y: 3, size: 2, materialId: "bg_stone_wall" });

  console.log("bg placements adapter payload ok");
}

async function runQueryBootPayloadIncludesBgPlacementsCheck() {
  const levelDocument = createRuntimeLevelWithBgPlacements();
  const result = await bootLumoRechargedFromQuery({
    search: "?recharged=1",
    loadLevelDocument: async () => ({ levelDocument }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.booted, true);
  assert.equal(result?.bg?.type, "tilemap");
  assert.equal(Array.isArray(result?.bg?.placements), true);
  assert.equal(result.bg.placements.length, 2);
  assert.deepEqual(result.bg.placements[1], { x: 3, y: 4, size: 3, materialId: "bg_rock" });

  console.log("bg placements query boot payload ok");
}

runExportIncludesBgPlacementsCheck();
await runAdapterPayloadKeepsBgPlacementsCheck();
await runQueryBootPayloadIncludesBgPlacementsCheck();

console.log("recharged-bg-placements-pipeline-checks: ok");
