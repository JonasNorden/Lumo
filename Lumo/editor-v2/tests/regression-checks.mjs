import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEntityEditEntry,
  createDecorEditEntry,
  createSoundEditEntry,
  createTileEditEntry,
  pushHistoryEntry,
  pushTileEdit,
  startHistoryBatch,
  endHistoryBatch,
  undoTileEdit,
  redoTileEdit,
} from "../src/domain/tiles/history.js";
import { paintSingleTile } from "../src/domain/tiles/paintTile.js";
import { eraseSingleTile } from "../src/domain/tiles/eraseTile.js";
import { renderBrushPanel } from "../src/ui/brushPanel.js";
import { validateLevelDocument } from "../src/domain/level/levelDocument.js";
import { serializeLevelDocument } from "../src/data/exportLevelDocument.js";
import { getScanActivity, getScanRange } from "../src/domain/scan/scanSystem.js";

function createHistoryState() {
  return {
    undoStack: [],
    redoStack: [],
    activeBatch: null,
  };
}

function createDoc() {
  return {
    meta: {
      id: "test-doc",
      name: "Test Doc",
      version: "2.0.0",
    },
    dimensions: {
      width: 4,
      height: 4,
      tileSize: 16,
    },
    tiles: {
      base: new Array(16).fill(0),
    },
    backgrounds: {
      layers: [],
    },
    entities: [],
    decor: [],
    sounds: [],
  };
}

function runTileRegressionChecks() {
  const doc = createDoc();
  const history = createHistoryState();

  const paintCell = { x: 1, y: 1 };
  startHistoryBatch(history, "tile-paint");
  assert.equal(paintSingleTile(doc, paintCell, 7), true, "tile paint should change the document");
  pushTileEdit(history, createTileEditEntry(doc, paintCell, 0, 7));
  assert.equal(endHistoryBatch(history), true, "tile paint should produce a history entry");

  undoTileEdit(doc, history);
  assert.equal(doc.tiles.base[5], 0, "undo should restore painted tiles");

  redoTileEdit(doc, history);
  assert.equal(doc.tiles.base[5], 7, "redo should reapply painted tiles");

  const eraseCell = { x: 1, y: 1 };
  startHistoryBatch(history, "tile-erase");
  assert.equal(eraseSingleTile(doc, eraseCell), true, "tile erase should change the document");
  pushTileEdit(history, createTileEditEntry(doc, eraseCell, 7, 0));
  assert.equal(endHistoryBatch(history), true, "tile erase should produce a history entry");
  assert.equal(doc.tiles.base[5], 0, "tile erase should clear the painted tile");

  undoTileEdit(doc, history);
  assert.equal(doc.tiles.base[5], 7, "undo should restore erased tiles");

  redoTileEdit(doc, history);
  assert.equal(doc.tiles.base[5], 0, "redo should reapply the tile erase");
}

function runEntityRegressionChecks() {
  const doc = createDoc();
  const history = createHistoryState();

  const createdEntity = {
    id: "entity-1",
    name: "Spawn",
    type: "player-spawn",
    x: 0,
    y: 0,
    visible: true,
    params: { facing: "right" },
  };
  doc.entities.push(createdEntity);
  pushHistoryEntry(history, createEntityEditEntry("create", { index: 0, entity: createdEntity }));

  const movedEntity = { ...createdEntity, x: 2, y: 1, params: { ...createdEntity.params } };
  doc.entities.splice(0, 1, movedEntity);
  pushHistoryEntry(
    history,
    createEntityEditEntry("update", {
      index: 0,
      previousEntity: createdEntity,
      nextEntity: movedEntity,
    }),
  );

  const renamedEntity = { ...movedEntity, name: "Spawn Updated", params: { ...movedEntity.params, speed: 3 } };
  doc.entities.splice(0, 1, renamedEntity);
  pushHistoryEntry(
    history,
    createEntityEditEntry("update", {
      index: 0,
      previousEntity: movedEntity,
      nextEntity: renamedEntity,
    }),
  );

  doc.entities.splice(0, 1);
  pushHistoryEntry(history, createEntityEditEntry("delete", { index: 0, entity: renamedEntity }));

  undoTileEdit(doc, history);
  assert.equal(doc.entities.length, 1, "undo should restore deleted entities");
  assert.equal(doc.entities[0].name, "Spawn Updated", "undo should restore edited entity fields");

  undoTileEdit(doc, history);
  assert.equal(doc.entities[0].name, "Spawn", "undo should restore prior entity edits");
  assert.deepEqual(doc.entities[0].params, { facing: "right" }, "undo should restore prior entity params");

  undoTileEdit(doc, history);
  assert.equal(doc.entities[0].x, 0, "undo should restore prior entity drag positions");
  assert.equal(doc.entities[0].y, 0, "undo should restore prior entity drag positions");

  redoTileEdit(doc, history);
  redoTileEdit(doc, history);
  redoTileEdit(doc, history);
  assert.equal(doc.entities.length, 0, "redo should reapply entity create/update/delete history");
}

function runDecorRegressionChecks() {
  const doc = createDoc();
  const history = createHistoryState();

  const decor = {
    id: "decor-1",
    name: "Torch",
    type: "torch",
    variant: "default",
    x: 1,
    y: 1,
    visible: true,
    params: { flicker: true },
  };
  doc.decor.push(decor);
  pushHistoryEntry(history, createDecorEditEntry("create", { index: 0, decor }));

  const movedDecor = { ...decor, x: 2, y: 2, params: { ...decor.params } };
  doc.decor.splice(0, 1, movedDecor);
  pushHistoryEntry(
    history,
    createDecorEditEntry("update", {
      index: 0,
      previousDecor: decor,
      nextDecor: movedDecor,
    }),
  );

  undoTileEdit(doc, history);
  assert.equal(doc.decor[0].x, 1, "undo should restore decor drag positions");
  redoTileEdit(doc, history);
  assert.equal(doc.decor[0].x, 2, "redo should restore decor drag positions");
}

function runSoundRegressionChecks() {
  const doc = createDoc();
  const history = createHistoryState();

  const sound = {
    id: "sound-1",
    name: "Ambient",
    type: "ambientZone",
    x: 0,
    y: 0,
    visible: true,
    params: { width: 2, height: 3 },
  };
  doc.sounds.push(sound);
  pushHistoryEntry(history, createSoundEditEntry("create", { index: 0, sound }));

  const movedSound = { ...sound, x: 1, y: 2, params: { ...sound.params } };
  doc.sounds.splice(0, 1, movedSound);
  pushHistoryEntry(
    history,
    createSoundEditEntry("update", {
      index: 0,
      previousSound: sound,
      nextSound: movedSound,
    }),
  );

  doc.sounds.splice(0, 1);
  pushHistoryEntry(history, createSoundEditEntry("delete", { index: 0, sound: movedSound }));

  undoTileEdit(doc, history);
  assert.equal(doc.sounds.length, 1, "undo should restore deleted sounds");
  assert.equal(doc.sounds[0].x, 1, "undo should restore moved sounds");
  redoTileEdit(doc, history);
  assert.equal(doc.sounds.length, 0, "redo should reapply sound deletion");

  const normalized = validateLevelDocument({
    ...createDoc(),
    sounds: [
      {
        id: "sound-trigger",
        name: "Trigger Alias",
        type: "trigger",
        x: 1,
        y: 1,
        visible: true,
        params: { volume: 0.8 },
      },
      {
        id: "sound-ambient",
        name: "Ambient Alias",
        type: "ambient zone",
        x: 0,
        y: 0,
        visible: true,
        params: { width: 5, height: 2 },
      },
    ],
  });

  assert.equal(normalized.sounds[0].type, "trigger", "validation should preserve trigger sounds as a primary sound type");
  assert.equal(normalized.sounds[0].params.loop, false, "trigger sounds should receive loop defaults during validation");
  assert.equal(normalized.sounds[0].params.spatial, true, "trigger sounds should preserve spatial defaults during validation");
  assert.equal(normalized.sounds[1].type, "ambientZone", "validation should normalize ambient zone aliases");
  assert.equal(normalized.sounds[1].params.loop, true, "ambient zones should default to looping");
  assert.equal(normalized.sounds[1].params.spatial, false, "ambient zones should default to non-spatial playback");

  const exported = JSON.parse(serializeLevelDocument(normalized));
  assert.equal(exported.sounds[1].type, "ambientZone", "sound export should retain ambient zones as a normal authoring type");
}


function runScanRegressionChecks() {
  const doc = createDoc();
  doc.dimensions.width = 20;
  doc.sounds = [
    {
      id: "spot-1",
      name: "Spot",
      type: "spot",
      x: 4,
      y: 0,
      visible: true,
      params: { spatial: true, radius: 2 },
    },
    {
      id: "trigger-1",
      name: "Trigger",
      type: "trigger",
      x: 8,
      y: 0,
      visible: true,
      params: {},
    },
    {
      id: "zone-1",
      name: "Ambient",
      type: "ambientZone",
      x: 10,
      y: 0,
      visible: true,
      params: { width: 3, height: 2 },
    },
  ];

  assert.deepEqual(getScanRange({ startX: 12, endX: 3 }, doc), { startX: 3, endX: 12 }, "scan range should normalize reversed start/end values");

  const firstPass = getScanActivity(doc, 0, 5, []);
  assert.equal(firstPass.activeSoundIds.includes("spot-1"), true, "scan activity should keep spot sounds active while the scan line is inside their radius");
  assert.equal(firstPass.triggeredEvents.some((event) => event.soundId === "spot-1"), true, "scan activity should emit spot sound intersections");

  const secondPass = getScanActivity(doc, 7.5, 10.5, []);
  assert.equal(secondPass.triggeredEvents.some((event) => event.soundId === "trigger-1"), true, "scan activity should emit trigger intersections when crossing their X position");
  assert.equal(secondPass.activeSoundIds.includes("zone-1"), true, "scan activity should activate ambient zones while the scan line overlaps them");
}

function runUiRegressionChecks() {
  const panel = { innerHTML: "" };
  const baseState = {
    brush: {
      activeDraft: {
        behavior: "replace",
        size: "single",
        sprite: "solid",
      },
    },
    document: {
      active: createDoc(),
    },
    interaction: {
      activeTool: "inspect",
      activeLayer: "entities",
      activeEntityPresetId: "lantern",
      activeDecorPresetId: null,
      activeSoundPresetId: null,
      decorScatterMode: false,
      decorScatterSettings: {
        density: 0.3,
        randomness: 0.6,
        variantMode: "fixed",
      },
    },
    ui: {
      panelSections: {},
    },
  };

  renderBrushPanel(panel, baseState);
  assert.equal(panel.innerHTML.includes("Alt/Option + Click places"), true, "entity placement hint should mention Alt/Option + Click");
  assert.equal(panel.innerHTML.includes('data-scan-action="play"'), true, "scan controls should expose a play button");
  assert.equal(panel.innerHTML.includes('data-scan-field="speed"'), true, "scan controls should expose a speed field");
  assert.equal(panel.innerHTML.includes("Spot Sound"), true, "sound selector should expose spot sounds");
  assert.equal(panel.innerHTML.includes("Trigger Sound"), true, "sound selector should expose trigger sounds");
  assert.equal(panel.innerHTML.includes("Ambient Zone"), true, "sound selector should expose ambient zones");
  assert.equal(panel.innerHTML.includes("Music Zone"), true, "sound selector should expose music zones");

  const decorState = {
    ...baseState,
    interaction: {
      ...baseState.interaction,
      activeLayer: "decor",
      activeEntityPresetId: null,
      activeDecorPresetId: "grass",
      decorScatterMode: true,
    },
  };
  renderBrushPanel(panel, decorState);
  assert.equal(panel.innerHTML.includes("Alt/Option + Drag scatters"), true, "decor scatter hint should mention Alt/Option + Drag");
}

function runSourceRegressionChecks() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const source = fs.readFileSync(path.join(repoRoot, "src/app/createEditorApp.js"), "utf8");

  const handleCanvasMouseDownSection = source.match(/const handleCanvasMouseDown = \(event\) => \{[\s\S]*?\n  \};/);
  assert.ok(handleCanvasMouseDownSection, "handleCanvasMouseDown should exist");
  assert.equal(
    handleCanvasMouseDownSection[0].includes("const hitSoundIndex ="),
    false,
    "canvas mouse-down should not include the broken pre-cell sound shortcut",
  );

  const setActiveLayerFromPanelSection = source.match(/const setActiveLayerFromPanel = \(layer\) => \{[\s\S]*?\n  \};/);
  assert.ok(setActiveLayerFromPanelSection, "setActiveLayerFromPanel should exist");
  assert.equal(
    setActiveLayerFromPanelSection[0].includes("activeTool = EDITOR_TOOLS.INSPECT"),
    false,
    "layer switching should not force inspect mode",
  );

  assert.equal(
    source.includes("const isMomentaryPlacementTrigger = (event) => event.altKey;"),
    true,
    "momentary placement should use Alt/Option",
  );
  assert.equal(
    source.includes('activeEntityPresetId && isMomentaryPlacementTrigger(event)'),
    true,
    "armed entities should only place with the Alt/Option modifier",
  );
  assert.equal(
    source.includes('activeDecorPresetId && isMomentaryPlacementTrigger(event)'),
    true,
    "armed decor should only place with the Alt/Option modifier",
  );
  assert.equal(
    source.includes('activeSoundPresetId && isMomentaryPlacementTrigger(event)'),
    true,
    "armed sounds should only place with the Alt/Option modifier",
  );
  assert.equal(
    source.includes("if (isDecorScatterReady(state.interaction, event)) {"),
    true,
    "decor scatter should use the Alt/Option-gated placement flow",
  );
  assert.equal(
    source.includes(`if (event.shiftKey) {
          toggleEntitySelection(draft.interaction, hitEntityIndex);`),
    true,
    "shift-click entity selection should stay enabled",
  );
  assert.equal(
    source.includes("additive: event.shiftKey,"),
    true,
    "shift-drag box selection should stay additive",
  );
}

runTileRegressionChecks();
runEntityRegressionChecks();
runDecorRegressionChecks();
runSoundRegressionChecks();
runScanRegressionChecks();
runUiRegressionChecks();
runSourceRegressionChecks();

console.log("editor-v2 regression checks passed");
