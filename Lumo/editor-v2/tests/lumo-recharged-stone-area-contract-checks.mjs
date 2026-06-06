import assert from "node:assert/strict";

import {
  createStoneAreaFromDrag,
  generateStoneAreaLayout,
  normalizeStoneAreaForEditor,
  updateStoneAreaField,
} from "../src/domain/worldAreas.js";
import { validateLevelDocument } from "../src/domain/level/levelDocument.js";
import { v2ToRuntimeLevelObject } from "../src/runtime/v2ToRuntimeLevelObject.js";
import { loadLevelDocument } from "../src/runtime/loadLevelDocument.js";
import { buildRuntimeWorldSkeleton } from "../src/runtime/buildRuntimeWorldSkeleton.js";
import { buildRuntimeWorldPacket } from "../src/runtime/buildRuntimeWorldPacket.js";

const baseDoc = {
  meta: { id: "stone-area-test", name: "Stone Area Test", version: "2.0.0" },
  dimensions: { width: 12, height: 8, tileSize: 24 },
  tiles: { base: Array.from({ length: 96 }, () => 0) },
  backgrounds: { layers: [] },
  background: { base: Array.from({ length: 96 }, () => null) },
  decor: [],
  entities: [],
  sounds: [],
  reactiveGrassPatches: [],
  mirrorSurfaceAreas: [],
  stoneAreas: [],
};

{
  const created = createStoneAreaFromDrag(baseDoc, { x: 1, y: 2 }, { x: 4, y: 5 });
  assert.equal(created.id, "stone_area-1");
  assert.equal(created.x, 24);
  assert.equal(created.y, 48);
  assert.equal(created.width, 96);
  assert.equal(created.height, 96);
  assert.equal(created.density, 0.35);
}

{
  const area = normalizeStoneAreaForEditor({ id: "field", width: 120, height: 80, density: 0.5, sizeVariation: 2, rotationVariation: -1, clusterStrength: 0.75 });
  assert.equal(area.sizeVariation, 1);
  assert.equal(area.rotationVariation, 0);
  assert.equal(area.clusterStrength, 0.75);
  assert.equal(updateStoneAreaField(area, "density", 0).density, 0);
  assert.equal(updateStoneAreaField(area, "density", 2).density, 1);
}

{
  const area = normalizeStoneAreaForEditor({ id: "stable", x: 24, y: 48, width: 144, height: 96, density: 0.5, sizeVariation: 0.6, rotationVariation: 0.8, clusterStrength: 0.7 });
  const first = generateStoneAreaLayout(area);
  const second = generateStoneAreaLayout({ ...area });
  assert.deepEqual(second, first, "same authored area must generate an identical layout");
  assert.ok(first.length > 0, "non-empty density should generate stones");

  const sparse = generateStoneAreaLayout({ ...area, density: 0.1 });
  const dense = generateStoneAreaLayout({ ...area, density: 0.9 });
  assert.ok(dense.length > sparse.length, "density should visibly affect generated count");
  assert.deepEqual(generateStoneAreaLayout({ ...area, density: 0 }), [], "empty density renders nothing");
}

{
  const normalized = validateLevelDocument({
    ...baseDoc,
    stoneAreas: [{ id: "save-me", x: 24, y: 48, width: 120, height: 72, density: 0.4, sizeVariation: 0.5, rotationVariation: 0.25, clusterStrength: 0.8 }],
  });
  assert.equal(normalized.stoneAreas.length, 1, "Stone Area saves in the Editor V2 document");
  assert.equal(normalized.stoneAreas[0].id, "save-me");

  const { runtimeLevel } = v2ToRuntimeLevelObject(normalized);
  assert.equal(runtimeLevel.stoneAreas.length, 1, "Stone Area exports to the runtime level object");
  assert.equal(Array.isArray(runtimeLevel.layers.ents), true, "Stone Area must not export as gameplay entity");

  const loaded = loadLevelDocument({
    identity: { id: "stone-runtime", name: "Stone Runtime", formatVersion: "recharged-1", themeId: "lumo" },
    world: { width: 12, height: 8, tileSize: 24, spawn: { x: 0, y: 0 } },
    layers: { tiles: [], background: [], bg: [], decor: [], entities: [], audio: [] },
    stoneAreas: runtimeLevel.stoneAreas,
    mirrorSurfaceAreas: [],
  });
  assert.equal(loaded.ok, true, loaded.errors.join("; "));
  assert.equal(loaded.level.stoneAreas.length, 1, "runtime loader receives authored Stone Areas");

  const skeleton = buildRuntimeWorldSkeleton(loaded.level);
  const packet = buildRuntimeWorldPacket({ skeleton });
  assert.equal(packet.stoneAreas.length, 1, "runtime world packet carries Stone Areas");
}

console.log("stone area contracts passed");
