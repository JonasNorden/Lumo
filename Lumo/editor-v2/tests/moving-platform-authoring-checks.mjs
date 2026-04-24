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
import { getSelectionEditorPanelContent } from "../src/ui/selectionEditorPanel.js";
import { BRUSH_SPRITE_OPTIONS } from "../src/domain/tiles/tileSpriteCatalog.js";

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

function runMovingPlatformInspectorVisualSelectionChecks() {
  const selectedTileOption = BRUSH_SPRITE_OPTIONS.find((option) => typeof option?.value === "string" && option.value.trim())
    || { value: "soil_c", label: "Soil C" };

  const state = {
    document: {
      status: "ready",
      error: null,
      active: {
        id: "moving-platform-inspector-level",
        dimensions: { width: 12, height: 8, tileSize: 24 },
        entities: [
          {
            id: "entity-moving-platform-01",
            name: "Moving Platform",
            type: "movingPlatform",
            x: 3,
            y: 4,
            visible: true,
            params: {
              ...MOVING_PLATFORM_DEFAULT_PARAMS,
              spriteTileId: selectedTileOption.value,
            },
          },
        ],
        decor: [],
        sounds: [],
      },
    },
    interaction: {
      selectedEntityIndices: [0],
      selectedEntityIndex: 0,
      selectedEntityIds: ["entity-moving-platform-01"],
      selectedEntityId: "entity-moving-platform-01",
      selectedDecorIndices: [],
      selectedDecorIndex: null,
      selectedDecorIds: [],
      selectedDecorId: null,
      selectedSoundIndices: [],
      selectedSoundIndex: null,
      selectedSoundIds: [],
      selectedSoundId: null,
    },
  };

  const { markup } = getSelectionEditorPanelContent(state);
  assert.equal(markup.includes('data-entity-param-key="spriteTileId"'), true, "moving platform inspector should expose spriteTileId field");
  assert.equal(markup.includes("<select"), true, "moving platform sprite selector should render a dropdown");
  assert.equal(markup.includes(selectedTileOption.label), true, "moving platform sprite selector should render human-readable tile labels");
  assert.equal(markup.includes('class="selectionTileSwatch"'), true, "moving platform sprite selector should render a selected tile swatch preview");
  assert.equal(markup.includes(`value="${selectedTileOption.value}" selected`), true, "moving platform sprite selector should preserve selected spriteTileId value");
}

runMovingPlatformPresetChecks();
runMovingPlatformPersistenceChecks();
runMovingPlatformPreviewDerivationChecks();
runMovingPlatformInspectorVisualSelectionChecks();
console.log("moving platform authoring checks passed");
