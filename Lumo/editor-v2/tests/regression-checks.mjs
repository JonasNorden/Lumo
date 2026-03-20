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
import { renderBottomPanel } from "../src/ui/bottomPanel.js";
import { validateLevelDocument } from "../src/domain/level/levelDocument.js";
import { serializeLevelDocument } from "../src/data/exportLevelDocument.js";
import {
  getScanActivity,
  getScanPlaybackState,
  getScanRange,
  isScanPaused,
  isScanPlaying,
  pauseScanPlaybackState,
  setPausedScanPosition,
  startScanPlaybackState,
  stopScanPlaybackState,
  syncScanPlaybackState,
} from "../src/domain/scan/scanSystem.js";
import { evaluateScanAudio } from "../src/domain/scan/scanAudioEvaluation.js";
import { createScanAudioPlaybackController } from "../src/domain/scan/scanAudioPlayback.js";
import { resolveSoundPlaybackSource } from "../src/domain/sound/sourceReference.js";
import { findMatchingSoundIndices } from "../src/domain/sound/selection.js";

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
    source: "./audio/ambient.ogg",
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

  const normalizedSourceDoc = validateLevelDocument({
    ...createDoc(),
    sounds: [
      {
        id: "sound-source",
        name: "Source Doc",
        type: "spot",
        x: 2,
        y: 1,
        visible: true,
        source: "  ./audio/wind.ogg  ",
        params: {},
      },
      {
        id: "sound-legacy-source",
        name: "Legacy Source Doc",
        type: "spot",
        x: 1,
        y: 0,
        visible: true,
        params: { source: "./audio/legacy.ogg" },
      },
    ],
  });
  assert.equal(normalizedSourceDoc.sounds[0].source, "./audio/wind.ogg", "validation should preserve and trim authored top-level sound sources");
  assert.equal(normalizedSourceDoc.sounds[1].source, "./audio/legacy.ogg", "validation should lift legacy param-based sound sources into the authored source field");
  assert.equal(
    resolveSoundPlaybackSource({ source: "data/assets/audio/spot/drip/waterdrip.ogg" }),
    "../data/assets/audio/spot/drip/waterdrip.ogg",
    "playback source resolution should map repo audio selections to the editor-v2 runtime path",
  );
  assert.equal(
    resolveSoundPlaybackSource({ source: "./audio/wind.ogg" }),
    "./audio/wind.ogg",
    "playback source resolution should preserve custom editor-relative audio paths",
  );

  const exported = JSON.parse(serializeLevelDocument(normalizedSourceDoc));
  assert.equal(exported.sounds[0].source, "./audio/wind.ogg", "sound export should retain authored sound sources");
  assert.equal(exported.sounds[1].source, "./audio/legacy.ogg", "sound export should retain normalized legacy sound sources");
  assert.equal(exported.sounds[1].type, "spot", "sound export should retain normal authoring types alongside sound sources");
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

  const firstPass = getScanActivity(doc, 0, 5);
  assert.equal(firstPass.activeSoundIds.includes("spot-1"), true, "scan activity should keep spot sounds active while the scan line is inside their radius");
  assert.equal(firstPass.triggeredEvents.some((event) => event.soundId === "spot-1" && event.transitionKind === "started"), true, "scan activity should emit spot sound start events");

  const secondPass = getScanActivity(doc, 7.5, 10.5);
  assert.equal(secondPass.triggeredEvents.some((event) => event.soundId === "trigger-1" && event.transitionKind === "triggered"), true, "scan activity should emit trigger crossings when passing their X position");
  assert.equal(secondPass.activeSoundIds.includes("zone-1"), true, "scan activity should activate ambient zones while the scan line overlaps them");

  const audioDoc = createDoc();
  audioDoc.sounds = [
    {
      id: "spot-audio",
      name: "Spot Audio",
      type: "spot",
      x: 4,
      y: 0,
      visible: true,
      params: { volume: 0.75, pitch: 0.9, radius: 2, spatial: true, loop: false },
    },
    {
      id: "trigger-audio",
      name: "Trigger Audio",
      type: "trigger",
      x: 8,
      y: 0,
      visible: true,
      params: { volume: 1, pitch: 1.1, loop: false, spatial: true },
    },
    {
      id: "ambient-audio",
      name: "Ambient Audio",
      type: "ambientZone",
      x: 10,
      y: 0,
      visible: true,
      params: { volume: 0.5, pitch: 1, loop: true, spatial: false, width: 4, height: 2 },
    },
    {
      id: "music-audio",
      name: "Music Audio",
      type: "musicZone",
      x: 16,
      y: 0,
      visible: true,
      params: { volume: 0.8, pitch: 1, loop: true, spatial: false, fadeDistance: 2, sustainWidth: 3 },
    },
  ];

  const spotEval = evaluateScanAudio(audioDoc, 1, 4.5).soundStates.find((entry) => entry.soundId === "spot-audio");
  assert.equal(spotEval?.active, true, "spot evaluation should become active when the scan enters its radius span");
  assert.equal(spotEval?.startedThisStep, true, "spot evaluation should record a start transition when entering the radius span");
  assert.equal(spotEval?.normalizedIntensity, 1, "spot evaluation should peak at full intensity at the sound center");
  assert.equal(spotEval?.metadata.spatial, true, "spot evaluation should preserve spatial metadata");
  assert.equal(spotEval?.pan, 0, "spot evaluation should center the pan at the sound midpoint");

  const triggerEval = evaluateScanAudio(audioDoc, 8.2, 8.8).soundStates.find((entry) => entry.soundId === "trigger-audio");
  assert.equal(triggerEval?.active, true, "trigger evaluation should become active only on crossing frames");
  assert.equal(triggerEval?.eventLike, true, "trigger evaluation should be modeled as an event-like activation");
  assert.equal(triggerEval?.startedThisStep, true, "trigger evaluation should flag crossing frames as starts");

  const ambientEval = evaluateScanAudio(audioDoc, 9.5, 11).soundStates.find((entry) => entry.soundId === "ambient-audio");
  assert.equal(ambientEval?.active, true, "ambient zones should stay active inside the authored width");
  assert.equal(ambientEval?.phase, "sustain", "ambient zones should evaluate as a sustained environmental phase");
  assert.equal(ambientEval?.normalizedIntensity, 1, "ambient zones can report a constant normalized level for now");

  const musicFadeIn = evaluateScanAudio(audioDoc, 15, 16.5).soundStates.find((entry) => entry.soundId === "music-audio");
  const musicSustain = evaluateScanAudio(audioDoc, 17.8, 19).soundStates.find((entry) => entry.soundId === "music-audio");
  const musicFadeOut = evaluateScanAudio(audioDoc, 21.5, 22.25).soundStates.find((entry) => entry.soundId === "music-audio");
  assert.equal(musicFadeIn?.phase, "fadeIn", "music zones should expose a fade-in phase near the zone entrance");
  assert.equal(musicSustain?.phase, "sustain", "music zones should expose a sustain phase after fade-in");
  assert.equal(musicFadeOut?.phase, "fadeOut", "music zones should expose a fade-out phase near the zone exit");
  assert.equal(musicFadeIn?.normalizedIntensity > 0.1 && musicFadeIn?.normalizedIntensity < 0.2, true, "music fade-in should use a softened ease curve instead of a raw linear ramp");
  assert.equal(musicFadeOut?.normalizedIntensity > 0.3 && musicFadeOut?.normalizedIntensity < 0.33, true, "music fade-out should use a softened ease curve instead of a raw linear ramp");
  assert.equal(musicFadeOut?.metadata.fadeDistance, 2, "music zone evaluation should preserve fade-distance metadata");

  const viewport = { offsetX: 120, offsetY: 32 };
  const scan = {
    playbackState: "idle",
    isPlaying: false,
    speed: 6,
    startX: 2,
    endX: 9,
    positionX: 0,
    activeSoundIds: ["spot-1"],
    audioEvaluation: {
      previousPositionX: 0,
      positionX: 0,
      activeSoundIds: ["spot-1"],
      startedSoundIds: [],
      endedSoundIds: [],
      activeSounds: [],
      startedSounds: [],
      endedSounds: [],
      transitionEvents: [],
      soundStates: [],
    },
    eventLog: [{ soundId: "spot-1" }],
    lastEventSummary: "spot-1",
    lastFrameTime: 1000,
    viewportSnapshot: null,
  };

  startScanPlaybackState(scan, viewport, doc);
  assert.equal(scan.isPlaying, true, "starting scan playback should mark the scan as running");
  assert.equal(getScanPlaybackState(scan), "playing", "starting scan playback should mark the scan as playing");
  assert.equal(scan.positionX, 2, "starting scan playback should reset the scan head to the range start");
  assert.deepEqual(scan.viewportSnapshot, { offsetX: 120, offsetY: 32 }, "starting scan playback should snapshot the pre-follow viewport");

  viewport.offsetX = 164;
  viewport.offsetY = 48;
  scan.positionX = 6.5;
  scan.lastFrameTime = 1300;
  scan.activeSoundIds = ["zone-1"];

  pauseScanPlaybackState(scan);
  assert.equal(scan.isPlaying, false, "pausing scan playback should clear the running flag");
  assert.equal(isScanPaused(scan), true, "pausing scan playback should mark the scan as paused");
  assert.equal(scan.positionX, 6.5, "pausing scan playback should preserve the scan head position");
  assert.deepEqual(scan.viewportSnapshot, { offsetX: 120, offsetY: 32 }, "pausing scan playback should keep the original viewport snapshot for stop/reset");
  assert.deepEqual(viewport, { offsetX: 164, offsetY: 48 }, "pausing scan playback should preserve the live viewport position");

  assert.equal(setPausedScanPosition(scan, doc, 1), true, "paused scan playback should allow repositioning the scan head");
  assert.equal(scan.positionX, 2, "paused scan repositioning should clamp to the configured scan start");
  assert.equal(setPausedScanPosition(scan, doc, 8.25), true, "paused scan playback should accept in-range drag positions");
  assert.equal(scan.positionX, 8.25, "paused scan repositioning should preserve the dragged position");
  assert.equal(setPausedScanPosition(scan, doc, 20), true, "paused scan playback should clamp drag positions above the scan end");
  assert.equal(scan.positionX, 9, "paused scan repositioning should clamp to the configured scan end");

  startScanPlaybackState(scan, viewport, doc);
  assert.equal(isScanPlaying(scan), true, "restarting a paused scan should resume playback");
  assert.equal(scan.positionX, 9, "restarting a paused scan should resume from the latest dragged paused position");
  assert.deepEqual(scan.viewportSnapshot, { offsetX: 120, offsetY: 32 }, "resuming scan playback should preserve the original viewport snapshot");

  stopScanPlaybackState(scan, viewport, doc, { preserveLog: true });
  assert.equal(scan.isPlaying, false, "stopping scan playback should clear the running flag");
  assert.equal(getScanPlaybackState(scan), "idle", "stopping scan playback should return the scan to idle");
  assert.equal(scan.positionX, 2, "stopping scan playback should reset the scan head to the range start");
  assert.equal(scan.lastFrameTime, null, "stopping scan playback should clear frame timing state");
  assert.deepEqual(scan.activeSoundIds, [], "stopping scan playback should clear active sound state");
  assert.deepEqual(scan.audioEvaluation.activeSoundIds, [], "stopping scan playback should clear the structured audio evaluation state");
  assert.deepEqual(viewport, { offsetX: 120, offsetY: 32 }, "stopping scan playback should restore the pre-follow viewport");
  assert.equal(scan.viewportSnapshot, null, "stopping scan playback should clear the stored viewport snapshot");
  assert.deepEqual(scan.eventLog, [{ soundId: "spot-1" }], "stopping scan playback should preserve scan logs when requested");

  viewport.offsetX = 210;
  viewport.offsetY = 64;
  startScanPlaybackState(scan, viewport, doc);
  assert.deepEqual(scan.viewportSnapshot, { offsetX: 210, offsetY: 64 }, "restarting scan playback should capture a fresh viewport snapshot for the next cycle");
  viewport.offsetX = 430;
  viewport.offsetY = 80;
  stopScanPlaybackState(scan, viewport, doc, { preserveLog: true });
  assert.deepEqual(viewport, { offsetX: 210, offsetY: 64 }, "repeated play-stop cycles should restore the matching viewport snapshot each time");

  scan.eventLog = [{ soundId: "zone-1" }];
  scan.lastEventSummary = "zone-1";
  scan.viewportSnapshot = { offsetX: 300, offsetY: 48 };
  syncScanPlaybackState(scan, doc, { preserveLog: false });
  assert.equal(scan.positionX, 2, "syncing scan playback should reset the scan head to the range start");
  assert.deepEqual(scan.eventLog, [], "syncing scan playback should clear scan logs when preserveLog is false");
  assert.equal(scan.lastEventSummary, null, "syncing scan playback should clear the last event summary when preserveLog is false");
  assert.equal(scan.viewportSnapshot, null, "syncing scan playback should discard any stale viewport snapshot");
  assert.equal(setPausedScanPosition(scan, doc, 5), false, "idle scan playback should reject manual repositioning");
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
  assert.equal(panel.innerHTML.includes('data-scan-action="pause"'), true, "scan controls should expose a pause button");
  assert.equal(panel.innerHTML.includes('data-scan-action="stop"'), true, "scan controls should expose a stop button");
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

function runSoundBatchSelectionRegressionChecks() {
  const sounds = [
    { id: "sound-0", type: "ambientZone", source: "./audio/forest.ogg", params: {} },
    { id: "sound-1", type: "ambientZone", source: "./audio/forest.ogg", params: {} },
    { id: "sound-2", type: "ambientZone", source: "./audio/rain.ogg", params: {} },
    { id: "sound-3", type: "trigger", source: "./audio/forest.ogg", params: {} },
    { id: "sound-4", type: "trigger", params: {} },
  ];

  assert.deepEqual(
    findMatchingSoundIndices(sounds, 0, { matchType: true, matchSource: false }),
    [0, 1, 2],
    "smart sound selection should find every sound with the same type across the whole level",
  );
  assert.deepEqual(
    findMatchingSoundIndices(sounds, 0, { matchType: false, matchSource: true }),
    [0, 1, 3],
    "smart sound selection should find every sound with the same source across the whole level",
  );
  assert.deepEqual(
    findMatchingSoundIndices(sounds, 0, { matchType: true, matchSource: true }),
    [0, 1],
    "smart sound selection should support combined same-type and same-source matching",
  );
  assert.deepEqual(
    findMatchingSoundIndices(sounds, 4, { matchType: false, matchSource: true }),
    [4],
    "smart sound selection should treat unassigned sources as a matchable source state",
  );
}

function runBottomPanelBatchSoundRegressionChecks() {
  globalThis.document = { activeElement: null };

  const panel = {
    innerHTML: "",
    classList: {
      toggle() {},
    },
    querySelector() {
      return null;
    },
  };

  const state = {
    document: {
      status: "ready",
      error: null,
      active: {
        ...createDoc(),
        sounds: [
          {
            id: "sound-a",
            name: "Forest 1",
            type: "ambientZone",
            x: 1,
            y: 2,
            visible: true,
            source: "./audio/ambient/forest/jungle.ogg",
            params: { volume: 0.5, pitch: 1, loop: true, spatial: false, width: 4, height: 2 },
          },
          {
            id: "sound-b",
            name: "Forest 2",
            type: "ambientZone",
            x: 8,
            y: 2,
            visible: true,
            source: "./audio/ambient/rain/rain.wav",
            params: { volume: 0.75, pitch: 0.9, loop: true, spatial: false, width: 5, height: 2 },
          },
        ],
        entities: [],
        decor: [],
      },
    },
    interaction: {
      selectedEntityIndices: [],
      selectedEntityIndex: null,
      selectedDecorIndices: [],
      selectedDecorIndex: null,
      selectedSoundIndices: [0, 1],
      selectedSoundIndex: 1,
    },
  };

  renderBottomPanel(panel, state);
  assert.equal(panel.innerHTML.includes("Batch edit 2 sound objects"), true, "bottom panel should switch into batch sound editing when multiple sounds are selected");
  assert.equal(panel.innerHTML.includes('data-sound-action="smart-select"'), true, "bottom panel should expose smart sound selection actions");
  assert.equal(panel.innerHTML.includes('data-sound-field="source" data-sound-index="-1"'), true, "batch sound editing should expose a single source field that targets the whole selection");
  assert.equal(panel.innerHTML.includes('data-sound-param-key="spatial"'), true, "batch sound editing should expose the spatial field");
  assert.equal(panel.innerHTML.includes('data-sound-param-key="volume"'), true, "batch sound editing should expose the volume field");
  assert.equal(panel.innerHTML.includes('data-sound-param-key="pitch"'), true, "batch sound editing should expose the pitch field");
  assert.equal(panel.innerHTML.includes('data-sound-param-key="loop"'), true, "batch sound editing should expose the loop field");
  assert.equal(panel.innerHTML.includes("Mixed source"), true, "batch sound editing should show mixed source state when selected sounds disagree");
}

function runScanAudioPlaybackRegressionChecks() {
  const doc = createDoc();
  doc.sounds = [
    {
      id: "spot-audio",
      name: "Spot Audio",
      type: "spot",
      x: 4,
      y: 0,
      visible: true,
      source: "./audio/spot.ogg",
      params: { volume: 0.75, pitch: 1, radius: 2, spatial: true, loop: false },
    },
    {
      id: "trigger-audio",
      name: "Trigger Audio",
      type: "trigger",
      x: 8,
      y: 0,
      visible: true,
      params: { volume: 0.6, pitch: 1, loop: false, spatial: true },
    },
    {
      id: "ambient-audio",
      name: "Ambient Audio",
      type: "ambientZone",
      x: 10,
      y: 0,
      visible: true,
      params: { volume: 0.5, pitch: 1, loop: true, spatial: false, width: 4, height: 2 },
    },
    {
      id: "music-audio",
      name: "Music Audio",
      type: "musicZone",
      x: 16,
      y: 0,
      visible: true,
      params: { volume: 0.8, pitch: 1, loop: true, spatial: false, fadeDistance: 2, sustainWidth: 3 },
    },
  ];

  const instanceLog = [];
  const liveInstances = new Map();
  const controller = createScanAudioPlaybackController({
    audioContext: null,
    createPlaybackInstance: ({ sound, soundState, onEnded }) => {
      const metrics = {
        soundId: sound.id,
        soundType: soundState.soundType,
        source: sound.source || null,
        usedFallback: !sound.source,
        playCalls: 0,
        pauseCalls: 0,
        resumeCalls: 0,
        stopCalls: 0,
        volumes: [],
        pans: [],
      };
      instanceLog.push(metrics);
      liveInstances.set(sound.id, metrics);

      return {
        play() {
          metrics.playCalls += 1;
        },
        pause() {
          metrics.pauseCalls += 1;
        },
        resume() {
          metrics.resumeCalls += 1;
        },
        setVolume(volume) {
          metrics.volumes.push(volume);
        },
        setPan(pan) {
          metrics.pans.push(pan);
        },
        stop() {
          metrics.stopCalls += 1;
          liveInstances.delete(sound.id);
          onEnded?.();
        },
      };
    },
  });

  const createScanState = (playbackState, evaluation) => ({
    playbackState,
    isPlaying: playbackState === "playing",
    audioEvaluation: evaluation,
  });

  const spotStart = evaluateScanAudio(doc, 1, 4.5);
  controller.sync({ doc, scan: createScanState("playing", spotStart) });
  assert.deepEqual(controller.getActiveInstanceIds(), ["spot-audio"], "spot sounds should start a persistent playback instance when the scan enters their radius");
  assert.equal(instanceLog[0].playCalls, 1, "persistent spot sounds should create exactly one instance on entry");
  assert.equal(instanceLog[0].source, "./audio/spot.ogg", "playback should receive the authored sound source when one is available");
  assert.equal(instanceLog[0].volumes.at(-1) < 0.7, true, "spot sounds should be slightly moderated by the simple mix balancing rules");
  assert.equal(instanceLog[0].pans.at(-1), 0, "spot sounds should start centered when the scan is at the sound midpoint");

  const spotSustain = evaluateScanAudio(doc, 4.5, 5.25);
  controller.sync({ doc, scan: createScanState("playing", spotSustain) });
  assert.equal(instanceLog[0].playCalls, 1, "persistent spot sounds should not restart every frame while active");
  assert.equal(instanceLog[0].volumes.at(-1) < 0.75, true, "spot sustain updates should continue to refresh volume from normalized intensity");

  const triggerCrossing = evaluateScanAudio(doc, 8.2, 8.8);
  controller.sync({ doc, scan: createScanState("playing", triggerCrossing) });
  assert.equal(instanceLog.filter((entry) => entry.soundId === "trigger-audio").length, 1, "trigger sounds should create a single one-shot instance when crossed");

  const triggerNoCrossing = evaluateScanAudio(doc, 8.8, 9.2);
  controller.sync({ doc, scan: createScanState("playing", triggerNoCrossing) });
  assert.equal(instanceLog.filter((entry) => entry.soundId === "trigger-audio").length, 1, "trigger sounds should not retrigger on non-crossing frames");

  const ambientInside = evaluateScanAudio(doc, 9.5, 11);
  controller.sync({ doc, scan: createScanState("playing", ambientInside) });
  assert.equal(controller.getActiveInstanceIds().includes("ambient-audio"), true, "ambient zones should remain active while the scan stays inside the zone");
  assert.equal(instanceLog.find((entry) => entry.soundId === "ambient-audio").volumes.at(-1) < 0.25, true, "ambient zones should sit below foreground layers in the balanced mix");


  const musicFadeIn = evaluateScanAudio(doc, 15, 16.5);
  controller.sync({ doc, scan: createScanState("playing", musicFadeIn) });
  const musicMetrics = instanceLog.find((entry) => entry.soundId === "music-audio");
  assert.equal(controller.getActiveInstanceIds().includes("music-audio"), true, "music zones should start playback when the scan reaches the fade-in boundary");
  assert.equal(musicMetrics.volumes.at(-1) > 0.08 && musicMetrics.volumes.at(-1) < 0.1, true, "music zones should use eased fades plus simple mix balancing during fade-in");

  const musicSustain = evaluateScanAudio(doc, 17.8, 19);
  controller.sync({ doc, scan: createScanState("playing", musicSustain) });
  assert.equal(musicMetrics.volumes.at(-1) > 0.6 && musicMetrics.volumes.at(-1) < 0.65, true, "music zones should remain strong during sustain while staying below raw authored loudness");
  const spatialMusicDoc = {
    ...doc,
    sounds: doc.sounds.map((sound) => (sound.id === "music-audio"
      ? { ...sound, params: { ...sound.params, spatial: true } }
      : sound)),
  };
  const spatialMusicEval = evaluateScanAudio(spatialMusicDoc, 16, 16.5);
  controller.sync({ doc: spatialMusicDoc, scan: createScanState("playing", spatialMusicEval) });
  assert.equal(musicMetrics.pans.at(-1) > 0.7, true, "spatial music should pan right before the zone center on this first-pass scan model");


  const activeBeforePause = controller.getActiveInstanceIds();
  controller.sync({ doc, scan: createScanState("paused", musicSustain) });
  assert.equal(
    activeBeforePause.every((soundId) => (liveInstances.get(soundId)?.pauseCalls || 0) >= 1),
    true,
    "pausing scan playback should pause every active audio instance",
  );

  controller.sync({ doc, scan: createScanState("playing", musicSustain) });
  assert.equal(
    activeBeforePause.every((soundId) => (liveInstances.get(soundId)?.resumeCalls || 0) >= 1),
    true,
    "resuming scan playback should resume active audio instances",
  );

  controller.sync({ doc, scan: createScanState("idle", musicSustain) });
  assert.deepEqual(controller.getActiveInstanceIds(), [], "stopping scan playback should stop and clear all active audio instances");

  controller.destroy();
}


async function runScanAudioAssetFallbackChecks() {
  const playedSources = [];
  let oscillatorCreateCount = 0;
  let oscillatorStopCount = 0;
  const FakeAudio = class {
    constructor(source) {
      this.source = source;
      this.currentTime = 0;
      this.loop = false;
      this.volume = 1;
      this.playbackRate = 1;
      this.listeners = new Map();
    }

    addEventListener(type, handler) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(handler);
    }

    removeEventListener(type, handler) {
      this.listeners.get(type)?.delete(handler);
    }

    pause() {}

    play() {
      playedSources.push(this.source);
      if (this.source.startsWith("data/assets/")) {
        return Promise.reject(new Error("bad-runtime-path"));
      }
      if (this.source.includes("missing")) {
        return Promise.reject(new Error("missing"));
      }
      return Promise.resolve();
    }
  };

  const previousAudio = globalThis.Audio;
  globalThis.Audio = FakeAudio;

  try {
    const fakeAudioContext = {
      currentTime: 0,
      destination: {},
      createOscillator() {
        oscillatorCreateCount += 1;
        return {
          type: "sine",
          frequency: { value: 0 },
          connect() {},
          start() {},
          stop() {
            oscillatorStopCount += 1;
          },
          onended: null,
        };
      },
      createGain() {
        return {
          gain: {
            value: 0,
            cancelScheduledValues() {},
            setValueAtTime() {},
            linearRampToValueAtTime() {},
          },
          connect() {},
        };
      },
    };
    const controller = createScanAudioPlaybackController({
      audioContext: fakeAudioContext,
    });

    const selectedSourceDoc = createDoc();
    selectedSourceDoc.sounds = [
      {
        id: "selected-source",
        name: "Selected Source",
        type: "spot",
        x: 4,
        y: 0,
        visible: true,
        source: "data/assets/audio/spot/drip/waterdrip.ogg",
        params: { volume: 0.7, pitch: 1, radius: 2, spatial: true, loop: false },
      },
    ];
    const selectedSourceEval = evaluateScanAudio(selectedSourceDoc, 1, 4.5);
    controller.sync({
      doc: selectedSourceDoc,
      scan: { playbackState: "playing", isPlaying: true, audioEvaluation: selectedSourceEval },
    });
    await Promise.resolve();
    assert.equal(
      playedSources.includes("../data/assets/audio/spot/drip/waterdrip.ogg"),
      true,
      "selected repo audio sources should resolve to the real editor-v2 playback path",
    );
    assert.equal(
      playedSources.includes("data/assets/audio/spot/drip/waterdrip.ogg"),
      false,
      "selected repo audio sources should not be played through the broken editor-v2-relative path",
    );
    assert.equal(
      oscillatorCreateCount,
      0,
      "valid selected audio sources should not create placeholder fallback playback",
    );
    controller.stopAll();

    const failingDoc = createDoc();
    failingDoc.sounds = [
      {
        id: "bad-source",
        name: "Bad Source",
        type: "spot",
        x: 4,
        y: 0,
        visible: true,
        source: "./audio/missing.ogg",
        params: { volume: 0.7, pitch: 1, radius: 2, spatial: true, loop: false },
      },
    ];

    const failingEval = evaluateScanAudio(failingDoc, 1, 4.5);
    controller.sync({
      doc: failingDoc,
      scan: { playbackState: "playing", isPlaying: true, audioEvaluation: failingEval },
    });
    await Promise.resolve();
    assert.equal(controller.getActiveInstanceIds().includes("bad-source"), true, "failed asset playback should fall back to placeholder playback instead of dropping the sound");
    controller.stopAll();

    const missingSourceDoc = createDoc();
    missingSourceDoc.sounds = [
      {
        id: "no-source",
        name: "No Source",
        type: "spot",
        x: 4,
        y: 0,
        visible: true,
        params: { volume: 0.7, pitch: 1, radius: 2, spatial: true, loop: false },
      },
    ];
    const missingSourceEval = evaluateScanAudio(missingSourceDoc, 1, 4.5);
    controller.sync({
      doc: missingSourceDoc,
      scan: { playbackState: "playing", isPlaying: true, audioEvaluation: missingSourceEval },
    });
    assert.equal(controller.getActiveInstanceIds().includes("no-source"), true, "sounds without an authored source should continue using placeholder playback");
    controller.stopAll();

    const fallbackUpgradeDoc = createDoc();
    fallbackUpgradeDoc.sounds = [
      {
        id: "upgrade-source",
        name: "Upgrade Source",
        type: "spot",
        x: 4,
        y: 0,
        visible: true,
        params: { volume: 0.7, pitch: 1, radius: 2, spatial: true, loop: false },
      },
    ];
    const activeEval = evaluateScanAudio(fallbackUpgradeDoc, 1, 4.5);
    controller.sync({
      doc: fallbackUpgradeDoc,
      scan: { playbackState: "playing", isPlaying: true, audioEvaluation: activeEval },
    });
    assert.equal(controller.getActiveInstanceIds().includes("upgrade-source"), true, "missing sources should begin with fallback playback while the sound stays active");
    assert.equal(oscillatorCreateCount >= 2, true, "missing sources should create placeholder fallback playback");

    fallbackUpgradeDoc.sounds[0] = {
      ...fallbackUpgradeDoc.sounds[0],
      source: "data/assets/audio/spot/drip/waterdrip.ogg",
    };
    controller.sync({
      doc: fallbackUpgradeDoc,
      scan: { playbackState: "playing", isPlaying: true, audioEvaluation: activeEval },
    });
    await Promise.resolve();
    assert.equal(
      playedSources.filter((source) => source === "../data/assets/audio/spot/drip/waterdrip.ogg").length >= 2,
      true,
      "active fallback playback should be replaced when a valid selected source becomes available",
    );
    assert.equal(
      oscillatorStopCount >= 1,
      true,
      "promoting an active fallback to a real asset should stop the fallback instance",
    );

    controller.destroy();
  } finally {
    globalThis.Audio = previousAudio;
  }
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

  const stopScanPlaybackSection = source.match(/const stopScanPlayback = \(draft, preserveLog = true\) => \{[\s\S]*?\n  \};/);
  assert.ok(stopScanPlaybackSection, "stopScanPlayback should exist");
  assert.equal(
    stopScanPlaybackSection[0].includes("invalidateScanPlayback();"),
    true,
    "stopScanPlayback should invalidate queued scan frames before resetting state",
  );
  assert.equal(
    stopScanPlaybackSection[0].includes("stopScanPlaybackState(draft.scan, draft.viewport, draft.document.active"),
    true,
    "stopScanPlayback should restore the saved scan-follow viewport through the shared stop helper",
  );

  const pauseScanPlaybackSection = source.match(/const pauseScanPlayback = \(draft\) => \{[\s\S]*?\n  \};/);
  assert.ok(pauseScanPlaybackSection, "pauseScanPlayback should exist");
  assert.equal(
    pauseScanPlaybackSection[0].includes('applyCanvasTarget(draft, "sound");'),
    true,
    "pauseScanPlayback should keep the canvas target on Sound for immediate sound editing",
  );

  const startScanPlaybackSection = source.match(/const startScanPlayback = \(draft\) => \{[\s\S]*?\n  \};/);
  assert.ok(startScanPlaybackSection, "startScanPlayback should exist");
  assert.equal(
    startScanPlaybackSection[0].includes('applyCanvasTarget(draft, "sound");'),
    true,
    "startScanPlayback should auto-activate the Sound canvas target",
  );

  const scheduleScanFrameSection = source.match(/const scheduleScanFrame = \(playbackToken = scanPlaybackToken\) => \{[\s\S]*?\n  \};/);
  assert.ok(scheduleScanFrameSection, "scheduleScanFrame should exist");
  assert.equal(
    scheduleScanFrameSection[0].includes("if (playbackToken !== scanPlaybackToken) return;"),
    true,
    "scheduleScanFrame should ignore stale scan playback callbacks",
  );
  assert.equal(
    scheduleScanFrameSection[0].includes("finishScanPlaybackState(draft.scan);"),
    true,
    "scheduleScanFrame should use the shared finish helper when playback finishes naturally",
  );
}

async function main() {
  runTileRegressionChecks();
  runEntityRegressionChecks();
  runDecorRegressionChecks();
  runSoundRegressionChecks();
  runScanRegressionChecks();
  runScanAudioPlaybackRegressionChecks();
  await runScanAudioAssetFallbackChecks();
  runUiRegressionChecks();
  runSoundBatchSelectionRegressionChecks();
  runBottomPanelBatchSoundRegressionChecks();
  runSourceRegressionChecks();

  console.log("editor-v2 regression checks passed");
}

await main();
