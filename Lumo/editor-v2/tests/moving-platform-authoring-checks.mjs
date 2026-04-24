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
import { bindSelectionEditorPanel, getSelectionEditorPanelContent } from "../src/ui/selectionEditorPanel.js";
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

function runMovingPlatformInspectorPersistenceChecks() {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalHTMLInputElement = globalThis.HTMLInputElement;
  const originalHTMLTextAreaElement = globalThis.HTMLTextAreaElement;
  const originalHTMLSelectElement = globalThis.HTMLSelectElement;
  const originalHTMLButtonElement = globalThis.HTMLButtonElement;
  const originalEvent = globalThis.Event;

  class MockHTMLElement {}
  class MockHTMLInputElement extends MockHTMLElement {}
  class MockHTMLTextAreaElement extends MockHTMLElement {}
  class MockHTMLSelectElement extends MockHTMLElement {
    constructor() {
      super();
      this.dataset = {};
      this.value = "";
    }
  }
  class MockHTMLButtonElement extends MockHTMLElement {}
  class MockEvent {
    constructor(type) {
      this.type = type;
      this.target = null;
    }
  }

  class MockPanel extends MockHTMLElement {
    constructor() {
      super();
      this.listeners = new Map();
    }

    addEventListener(type, handler) {
      this.listeners.set(type, handler);
    }

    removeEventListener(type, handler) {
      const current = this.listeners.get(type);
      if (current === handler) this.listeners.delete(type);
    }

    querySelector() {
      return null;
    }

    contains() {
      return false;
    }

    emit(type, target) {
      const handler = this.listeners.get(type);
      assert.ok(handler, `expected ${type} handler to be registered`);
      const event = new MockEvent(type);
      event.target = target;
      handler(event);
    }
  }

  const mockDocument = {
    activeElement: null,
    addEventListener() {},
    removeEventListener() {},
  };

  globalThis.document = mockDocument;
  globalThis.HTMLElement = MockHTMLElement;
  globalThis.HTMLInputElement = MockHTMLInputElement;
  globalThis.HTMLTextAreaElement = MockHTMLTextAreaElement;
  globalThis.HTMLSelectElement = MockHTMLSelectElement;
  globalThis.HTMLButtonElement = MockHTMLButtonElement;
  globalThis.Event = MockEvent;

  try {
    const panel = new MockPanel();
    const mutations = [];
    const dispose = bindSelectionEditorPanel(panel, null, {
      onEntityUpdate: (...args) => mutations.push(args),
    });

    const input = new MockHTMLSelectElement();
    input.value = "platform_steel_01";
    input.dataset.entityIndex = "0";
    input.dataset.entityParamKey = "spriteTileId";
    input.dataset.entityParamType = "text";
    input.dataset.entityId = "entity-moving-platform-01";

    panel.emit("change", input);
    dispose();

    assert.equal(mutations.length, 1, "changing moving platform sprite tile select should emit one entity mutation");
    assert.deepEqual(mutations[0], [
      0,
      "param",
      {
        __canonicalMutation: true,
        itemId: "entity-moving-platform-01",
        key: "spriteTileId",
        path: undefined,
        value: "platform_steel_01",
      },
    ], "moving platform sprite tile select should persist back to params.spriteTileId");
  } finally {
    globalThis.document = originalDocument;
    globalThis.HTMLElement = originalHTMLElement;
    globalThis.HTMLInputElement = originalHTMLInputElement;
    globalThis.HTMLTextAreaElement = originalHTMLTextAreaElement;
    globalThis.HTMLSelectElement = originalHTMLSelectElement;
    globalThis.HTMLButtonElement = originalHTMLButtonElement;
    globalThis.Event = originalEvent;
  }
}

function runNonMovingPlatformParamFallbackChecks() {
  const state = {
    document: {
      status: "ready",
      error: null,
      active: {
        id: "non-moving-entity-inspector-level",
        dimensions: { width: 12, height: 8, tileSize: 24 },
        entities: [
          {
            id: "entity-switch-01",
            name: "Floor Switch",
            type: "switch",
            x: 2,
            y: 2,
            visible: true,
            params: {
              spriteTileId: "switch_plate_01",
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
      selectedEntityIds: ["entity-switch-01"],
      selectedEntityId: "entity-switch-01",
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
  assert.equal(markup.includes('data-entity-param-key="spriteTileId"'), true, "non-moving platform entity should still expose spriteTileId param");
  assert.equal(markup.includes('data-entity-param-type="text"'), true, "non-moving platform entity spriteTileId should render with generic text param type");
  assert.equal(markup.includes('value="switch_plate_01"'), true, "non-moving platform entity spriteTileId should preserve generic text value");
}

runMovingPlatformPresetChecks();
runMovingPlatformPersistenceChecks();
runMovingPlatformPreviewDerivationChecks();
runMovingPlatformInspectorVisualSelectionChecks();
runMovingPlatformInspectorPersistenceChecks();
runNonMovingPlatformParamFallbackChecks();
console.log("moving platform authoring checks passed");
