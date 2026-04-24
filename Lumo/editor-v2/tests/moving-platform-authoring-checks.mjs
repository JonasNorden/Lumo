import assert from "node:assert/strict";

import { findEntityPresetById, getEntityPresetDefaultParams } from "../src/domain/entities/entityPresets.js";
import {
  MOVING_PLATFORM_DEFAULT_PARAMS,
  getMovingPlatformPathFromAnchor,
  normalizeMovingPlatformParams,
} from "../src/domain/entities/movingPlatform.js";
import { serializeLevelDocument } from "../src/data/exportLevelDocument.js";
import { validateLevelDocument } from "../src/domain/level/levelDocument.js";
import { createNewLevelDocument } from "../src/data/createNewLevelDocument.js";

function runMovingPlatformPresetChecks() {
  const preset = findEntityPresetById("movingPlatform");
  assert.ok(preset, "expected moving platform preset to be registered");
  assert.equal(preset.type, "movingPlatform");
  assert.equal(preset.defaultName, "Moving Platform");
  assert.equal(preset.group, "World Objects");

  const defaults = getEntityPresetDefaultParams("movingPlatform");
  assert.deepEqual(defaults, MOVING_PLATFORM_DEFAULT_PARAMS, "expected moving platform defaults to match authoring truth");
}

function runMovingPlatformPersistenceChecks() {
  const doc = createNewLevelDocument({ id: "moving-platform-level", name: "Moving Platform Level", width: 12, height: 8, tileSize: 24 });
  doc.entities.push({
    id: "entity-moving-platform-01",
    name: "Moving Platform",
    type: "movingPlatform",
    x: 3,
    y: 4,
    visible: true,
    params: {
      widthTiles: 5,
      heightTiles: 2,
      direction: "left",
      distanceTiles: 6,
      speed: 80,
      loop: "loop",
      oneWay: false,
      carryPlayer: true,
      spriteTileId: "platform_steel_01",
    },
  });

  const saved = JSON.parse(serializeLevelDocument(doc));
  const savedMovingPlatform = saved.entities.find((entity) => entity.id === "entity-moving-platform-01");
  assert.ok(savedMovingPlatform, "expected moving platform to survive serialize");
  assert.equal(savedMovingPlatform.type, "movingPlatform");
  assert.equal(savedMovingPlatform.params.direction, "left");
  assert.equal(savedMovingPlatform.params.distanceTiles, 6);

  const loaded = validateLevelDocument(saved);
  const loadedMovingPlatform = loaded.entities.find((entity) => entity.id === "entity-moving-platform-01");
  assert.ok(loadedMovingPlatform, "expected moving platform to survive load");
  assert.equal(loadedMovingPlatform.type, "movingPlatform");
  assert.equal(loadedMovingPlatform.params.widthTiles, 5);
  assert.equal(loadedMovingPlatform.params.heightTiles, 2);
  assert.equal(loadedMovingPlatform.params.direction, "left");
  assert.equal(loadedMovingPlatform.params.distanceTiles, 6);
  assert.equal(loadedMovingPlatform.params.loop, "loop");
  assert.equal(loadedMovingPlatform.params.oneWay, false);
  assert.equal(loadedMovingPlatform.params.carryPlayer, true);
  assert.equal(loadedMovingPlatform.params.spriteTileId, "platform_steel_01");
}

function runMovingPlatformPreviewDerivationChecks() {
  const normalized = normalizeMovingPlatformParams({
    widthTiles: "4",
    heightTiles: 1,
    direction: "up",
    distanceTiles: "3",
    speed: "70",
    loop: "pingpong",
    oneWay: true,
    carryPlayer: true,
  });
  assert.equal(normalized.widthTiles, 4);
  assert.equal(normalized.direction, "up");
  assert.equal(normalized.distanceTiles, 3);

  const path = getMovingPlatformPathFromAnchor(8, 6, normalized);
  assert.deepEqual(path.anchor, { x: 8, y: 6 });
  assert.deepEqual(path.end, { x: 8, y: 3 }, "expected endpoint to be derived from direction + distance");
}

runMovingPlatformPresetChecks();
runMovingPlatformPersistenceChecks();
runMovingPlatformPreviewDerivationChecks();
console.log("moving platform authoring checks passed");
