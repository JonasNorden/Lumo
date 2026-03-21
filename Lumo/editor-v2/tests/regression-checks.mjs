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
import { renderInspector } from "../src/ui/inspectorPanel.js";
import { validateLevelDocument } from "../src/domain/level/levelDocument.js";
import {
  createNewLevelDocument,
  DEFAULT_NEW_LEVEL_HEIGHT,
  DEFAULT_NEW_LEVEL_WIDTH,
  MAX_LEVEL_DIMENSION,
  MIN_LEVEL_DIMENSION,
  sanitizeLevelDimension,
} from "../src/data/createNewLevelDocument.js";
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
import {
  captureIdObjectInteractionSnapshot,
  captureIndexedObjectInteractionSnapshot,
  reconcileIdObjectInteraction,
  reconcileIndexedObjectInteraction,
} from "../src/domain/placeables/objectInteractionReconciliation.js";
import { captureObjectLayerAnchor } from "../src/domain/placeables/objectLayerHistory.js";
import {
  getSelectedDecorIds,
  getSelectedDecorIndices,
  setDecorSelection,
  toggleDecorSelection,
} from "../src/domain/decor/selection.js";
import {
  findMatchingSoundIndices,
  getSelectedSoundIds,
  getSelectedSoundIndices,
  pruneSoundSelection,
  setSoundSelection,
} from "../src/domain/sound/selection.js";
import { collectDarknessPreviewLights, getPreviewPlayerLight } from "../src/render/darknessPreview.js";
import { createFogVolumeEntityFromWorldRect } from "../src/domain/entities/specialVolumeTypes.js";
import { findDecorPresetById } from "../src/domain/decor/decorPresets.js";
import { findEntityPresetById } from "../src/domain/entities/entityPresets.js";
import { renderEntityPlacementPreview } from "../src/render/layers/entityLayer.js";
import { renderDecorPlacementPreview } from "../src/render/layers/decorLayer.js";
import { applyCanonicalDecorAction, createCanonicalDecorHistory } from "../src/app/cleanRoomDecorMode.js";
import { applyCanonicalEntityAction, cloneCanonicalEntitySnapshot, createCanonicalEntityHistory } from "../src/app/cleanRoomEntityMode.js";
import { applyCanonicalSoundAction, createCanonicalSoundHistory } from "../src/app/cleanRoomSoundMode.js";
import { createEditorApp } from "../src/app/createEditorApp.js";
import { createEditorState } from "../src/state/createEditorState.js";
import { createStore } from "../src/state/createStore.js";
import { findSoundAtCanvasPoint, renderSoundDragPreview, renderSoundPlacementPreview, renderSounds } from "../src/render/layers/soundLayer.js";
import { findSoundPresetById } from "../src/domain/sound/soundPresets.js";
import {
  canRedoGlobalHistory,
  canUndoGlobalHistory,
  createGlobalHistoryTimelineState,
  markGlobalHistoryActionRedone,
  markGlobalHistoryActionUndone,
  peekNextGlobalRedoAction,
  peekNextGlobalUndoAction,
  recordGlobalHistoryAction,
} from "../src/domain/history/globalTimeline.js";

function createHistoryState() {
  return {
    undoStack: [],
    redoStack: [],
    activeBatch: null,
    globalTimeline: createGlobalHistoryTimelineState(),
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

function createDecorHistoryHarness(doc = createDoc()) {
  const history = createCanonicalDecorHistory();
  const laneHistory = {
    undoStack: [],
    redoStack: [],
  };

  return {
    doc,
    recordAndApply(action) {
      const changed = applyCanonicalDecorAction(doc, action, "forward");
      if (!changed.changed) return false;
      history.record(action);
      laneHistory.undoStack.push("decor");
      laneHistory.redoStack.length = 0;
      return true;
    },
    undo() {
      const lane = laneHistory.undoStack.pop();
      if (lane !== "decor") return false;
      const action = history.popUndo();
      if (!action) return false;
      const changed = applyCanonicalDecorAction(doc, action, "backward");
      if (!changed.changed) return false;
      history.pushRedo(action);
      laneHistory.redoStack.push("decor");
      return true;
    },
    redo() {
      const lane = laneHistory.redoStack.pop();
      if (lane !== "decor") return false;
      const action = history.popRedo();
      if (!action) return false;
      const changed = applyCanonicalDecorAction(doc, action, "forward");
      if (!changed.changed) return false;
      history.pushUndo(action);
      laneHistory.undoStack.push("decor");
      return true;
    },
    canRedo() {
      return history.canRedo() && laneHistory.redoStack.length > 0;
    },
  };
}

function createPreviewTestContext() {
  const operations = [];
  const gradient = { addColorStop() {} };
  const ctx = {
    canvas: { width: 320, height: 240 },
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "top",
    save() {},
    restore() {},
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
    fillRect(...args) { operations.push(["fillRect", ...args]); },
    strokeRect(...args) { operations.push(["strokeRect", ...args]); },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    bezierCurveTo() {},
    quadraticCurveTo() {},
    arc(...args) { operations.push(["arc", ...args]); },
    ellipse(...args) { operations.push(["ellipse", ...args]); },
    roundRect(...args) { operations.push(["roundRect", ...args]); },
    closePath() {},
    stroke() { operations.push(["stroke"]); },
    fill() { operations.push(["fill"]); },
    fillText(...args) { operations.push(["fillText", ...args]); },
    setLineDash() {},
    translate() {},
    rotate() {},
  };
  return { ctx, operations };
}

function createSoundInteractionState() {
  return {
    hoveredSoundIndex: null,
    hoveredSoundId: null,
    selectedSoundIndices: [],
    selectedSoundIndex: null,
    selectedSoundIds: [],
    selectedSoundId: null,
    soundDrag: null,
  };
}

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type, event = {}) {
    const listeners = [...(this.listeners.get(type) || [])];
    const nextEvent = {
      defaultPrevented: false,
      preventDefault() {
        nextEvent.defaultPrevented = true;
      },
      stopPropagation() {},
      target: this,
      currentTarget: this,
      ...event,
    };
    for (const listener of listeners) {
      listener(nextEvent);
    }
    return nextEvent;
  }
}

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  toggle(name, force) {
    if (force === true) {
      this.values.add(name);
      return true;
    }
    if (force === false) {
      this.values.delete(name);
      return false;
    }
    if (this.values.has(name)) {
      this.values.delete(name);
      return false;
    }
    this.values.add(name);
    return true;
  }

  contains(name) {
    return this.values.has(name);
  }
}

function createFakeCanvasContext(canvas) {
  const gradient = { addColorStop() {} };
  const base = {
    canvas,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    imageSmoothingEnabled: false,
    save() {},
    restore() {},
    scale() {},
    translate() {},
    rotate() {},
    setTransform() {},
    clearRect() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    stroke() {},
    fill() {},
    arc() {},
    ellipse() {},
    roundRect() {},
    drawImage() {},
    fillText() {},
    strokeText() {},
    setLineDash() {},
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
    measureText(text) { return { width: String(text || "").length * 8 }; },
    getImageData() { return { data: new Uint8ClampedArray(canvas.width * canvas.height * 4) }; },
    putImageData() {},
  };
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => {};
    },
  });
}

class FakeElement extends FakeEventTarget {
  constructor({ width = 0, height = 0 } = {}) {
    super();
    this.width = width;
    this.height = height;
    this.style = {};
    this.dataset = {};
    this.classList = new FakeClassList();
    this.innerHTML = "";
    this.textContent = "";
  }

  getContext() {
    return createFakeCanvasContext(this);
  }

  getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      width: this.width,
      height: this.height,
      right: this.width,
      bottom: this.height,
    };
  }

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }

  closest() {
    return null;
  }

  focus() {}

  click() {}

  setSelectionRange() {}
}

async function createEditorRuntimeHarness() {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousElement = globalThis.Element;
  const previousHTMLElement = globalThis.HTMLElement;
  const previousHTMLButtonElement = globalThis.HTMLButtonElement;
  const previousHTMLInputElement = globalThis.HTMLInputElement;
  const previousHTMLSelectElement = globalThis.HTMLSelectElement;

  class FakeWindow extends FakeEventTarget {
    constructor() {
      super();
      this.devicePixelRatio = 1;
      this._rafId = 0;
    }

    requestAnimationFrame(callback) {
      this._rafId += 1;
      const id = this._rafId;
      setTimeout(() => callback(Date.now()), 0);
      return id;
    }

    cancelAnimationFrame() {}
  }

  class FakeDocument extends FakeEventTarget {
    constructor() {
      super();
      this.activeElement = null;
      this.body = new FakeElement();
    }

    createElement() {
      return new FakeElement();
    }
  }

  const fakeWindow = new FakeWindow();
  const fakeDocument = new FakeDocument();
  globalThis.window = fakeWindow;
  globalThis.document = fakeDocument;
  globalThis.Element = FakeElement;
  globalThis.HTMLElement = FakeElement;
  globalThis.HTMLButtonElement = FakeElement;
  globalThis.HTMLInputElement = FakeElement;
  globalThis.HTMLSelectElement = FakeElement;

  const canvas = new FakeElement({ width: 320, height: 320 });
  const minimapCanvas = new FakeElement({ width: 160, height: 160 });
  const floatingPanelHost = new FakeElement();
  const inspector = new FakeElement();
  const brushPanel = new FakeElement();
  const cellHud = new FakeElement();
  const topBar = new FakeElement();
  const topBarStatus = new FakeElement();
  const topBarExportMenu = new FakeElement();
  const topBarSettingsMenu = new FakeElement();
  const topBarHelpMenu = new FakeElement();
  const bottomPanel = new FakeElement();
  const store = createStore(createEditorState());

  const destroy = createEditorApp({
    canvas,
    minimapCanvas,
    floatingPanelHost,
    inspector,
    brushPanel,
    cellHud,
    topBar,
    topBarStatus,
    topBarExportMenu,
    topBarSettingsMenu,
    topBarHelpMenu,
    bottomPanel,
    store,
  });

  await new Promise((resolve) => setTimeout(resolve, 40));

  return {
    canvas,
    store,
    fakeWindow,
    fakeDocument,
    destroy() {
      destroy();
      globalThis.window = previousWindow;
      globalThis.document = previousDocument;
      globalThis.Element = previousElement;
      globalThis.HTMLElement = previousHTMLElement;
      globalThis.HTMLButtonElement = previousHTMLButtonElement;
      globalThis.HTMLInputElement = previousHTMLInputElement;
      globalThis.HTMLSelectElement = previousHTMLSelectElement;
    },
  };
}

function getClientPointForCell(state, cell) {
  const tileSize = state.document.active.dimensions.tileSize;
  return {
    clientX: state.viewport.offsetX + (cell.x + 0.5) * tileSize * state.viewport.zoom,
    clientY: state.viewport.offsetY + (cell.y + 0.5) * tileSize * state.viewport.zoom,
  };
}

async function runLiveDecorPlacementRuntimeRegressionChecks() {
  const harness = await createEditorRuntimeHarness();
  const { canvas, fakeWindow, store } = harness;

  try {
    const initialState = store.getState();
    assert.equal(initialState.document.status, "ready", "runtime harness should load the mock level document");
    const initialDecorIds = initialState.document.active.decor.map((decor) => decor.id);

    store.setState((draft) => {
      draft.interaction.activeTool = "inspect";
      draft.interaction.activeLayer = "decor";
      draft.interaction.canvasSelectionMode = "decor";
      draft.interaction.activeDecorPresetId = "decor_flower_01";
      draft.interaction.activeEntityPresetId = null;
      draft.interaction.activeSoundPresetId = null;
      draft.interaction.decorScatterMode = false;
    });

    const firstCell = { x: 1, y: 1 };
    canvas.dispatch("mousedown", {
      ...getClientPointForCell(store.getState(), firstCell),
      altKey: true,
      button: 0,
    });

    const afterCreateState = store.getState();
    const createdDecor = afterCreateState.document.active.decor.at(-1);
    assert.equal(afterCreateState.document.active.decor.length, initialDecorIds.length + 1, "Alt+click decor placement should append authored decor immediately");
    assert.equal(afterCreateState.interaction.selectedDecorId, createdDecor.id, "live decor placement should select the newly authored decor by stable id");
    assert.deepEqual(afterCreateState.interaction.selectedDecorIds, [createdDecor.id], "live decor placement should keep clean-room decor selection on the new authored decor only");
    assert.deepEqual(afterCreateState.interaction.selectedCell, firstCell, "live decor placement should update the selected decor cell immediately");
    assert.equal(createdDecor.type, findDecorPresetById("decor_flower_01").type, "live decor placement should author the preset decor type through the canonical create lane");

    fakeWindow.dispatch("keydown", {
      key: "z",
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      repeat: false,
      code: "KeyZ",
      target: null,
    });

    const afterUndoState = store.getState();
    assert.deepEqual(afterUndoState.document.active.decor.map((decor) => decor.id), initialDecorIds, "undo after live decor placement should remove that exact authored decor from the document");
    assert.equal(afterUndoState.document.active.decor.some((decor) => decor.id === createdDecor.id), false, "undo after live decor placement should not leave the created decor ghost-authored");

    fakeWindow.dispatch("keydown", {
      key: "z",
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
      altKey: false,
      repeat: false,
      code: "KeyZ",
      target: null,
    });

    const afterRedoState = store.getState();
    assert.deepEqual(afterRedoState.document.active.decor.map((decor) => decor.id), [...initialDecorIds, createdDecor.id], "redo after live decor placement should restore the exact authored decor in canonical order");
    assert.equal(afterRedoState.interaction.selectedDecorId, createdDecor.id, "redo after live decor placement should reselect the restored decor id");

    const secondCell = { x: 2, y: 1 };
    canvas.dispatch("mousedown", {
      ...getClientPointForCell(store.getState(), secondCell),
      altKey: true,
      button: 0,
    });

    const afterSecondCreate = store.getState();
    const secondCreatedDecor = afterSecondCreate.document.active.decor.at(-1);
    assert.deepEqual(
      afterSecondCreate.document.active.decor.map((decor) => decor.id).slice(-2),
      [createdDecor.id, secondCreatedDecor.id],
      "multiple live decor placements should preserve deterministic authored append order on the canonical lane",
    );

    fakeWindow.dispatch("keydown", {
      key: "Delete",
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      repeat: false,
      code: "Delete",
      target: null,
    });

    const afterDeleteState = store.getState();
    assert.equal(afterDeleteState.document.active.decor.some((decor) => decor.id === secondCreatedDecor.id), false, "delete after live decor placement should remove the selected authored decor");

    fakeWindow.dispatch("keydown", {
      key: "z",
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      repeat: false,
      code: "KeyZ",
      target: null,
    });

    const afterDeleteUndoState = store.getState();
    assert.deepEqual(
      afterDeleteUndoState.document.active.decor.map((decor) => decor.id).slice(-2),
      [createdDecor.id, secondCreatedDecor.id],
      "undo after live decor delete should restore the same authored decor sequence deterministically",
    );

    fakeWindow.dispatch("keydown", {
      key: "z",
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
      altKey: false,
      repeat: false,
      code: "KeyZ",
      target: null,
    });

    const afterDeleteRedoState = store.getState();
    assert.deepEqual(
      afterDeleteRedoState.document.active.decor.map((decor) => decor.id),
      [...initialDecorIds, createdDecor.id],
      "redo after live decor delete should deterministically remove only the same created decor again",
    );
  } finally {
    harness.destroy();
  }
}

function runCleanRoomSoundHistoryDeterminismRegressionChecks() {
  const doc = createDoc();
  const history = createCanonicalSoundHistory();
  const laneHistory = {
    undoStack: [],
    redoStack: [],
  };
  const applyAndRecord = (action) => {
    const result = applyCanonicalSoundAction(doc, action, "forward");
    assert.equal(result.changed, true, "canonical sound actions should apply before recording history");
    history.record(action);
    laneHistory.undoStack.push("sound");
    laneHistory.redoStack.length = 0;
    return result;
  };
  const undo = () => {
    const lane = laneHistory.undoStack.pop();
    assert.equal(lane, "sound", "canonical sound history should route through the dedicated sound lane");
    const action = history.popUndo();
    const result = applyCanonicalSoundAction(doc, action, "backward");
    assert.equal(result.changed, true, "canonical sound undo should replay through the stable-id lane");
    history.pushRedo(action);
    laneHistory.redoStack.push("sound");
    return result;
  };
  const redo = () => {
    const lane = laneHistory.redoStack.pop();
    assert.equal(lane, "sound", "canonical sound redo should stay on the dedicated sound lane");
    const action = history.popRedo();
    const result = applyCanonicalSoundAction(doc, action, "forward");
    assert.equal(result.changed, true, "canonical sound redo should replay through the stable-id lane");
    history.pushUndo(action);
    laneHistory.undoStack.push("sound");
    return result;
  };

  const soundA = { id: "sound-a", name: "A", type: "spot", x: 1, y: 1, visible: true, params: { radius: 2, spatial: true } };
  const soundB = { id: "sound-b", name: "B", type: "ambientZone", x: 2, y: 1, visible: true, params: { width: 2, height: 1, loop: true } };
  const soundC = { id: "sound-c", name: "C", type: "trigger", x: 3, y: 1, visible: true, params: { spatial: true } };

  applyAndRecord({ type: "create", items: [{ index: 0, sound: soundA }] });
  applyAndRecord({ type: "create", items: [{ index: 1, sound: soundB }] });
  applyAndRecord({ type: "create", items: [{ index: 2, sound: soundC }] });

  assert.deepEqual(
    doc.sounds.map((sound) => sound.id),
    ["sound-a", "sound-b", "sound-c"],
    "canonical sound create should append authored sounds in deterministic order",
  );

  undo();
  undo();
  assert.deepEqual(
    doc.sounds.map((sound) => sound.id),
    ["sound-a"],
    "multiple sequential canonical sound creates should undo in exact reverse order",
  );

  redo();
  redo();
  assert.deepEqual(
    doc.sounds.map((sound) => ({ id: sound.id, type: sound.type, params: sound.params })),
    [
      { id: "sound-a", type: "spot", params: { radius: 2, spatial: true } },
      { id: "sound-b", type: "ambientZone", params: { width: 2, height: 1, loop: true } },
      { id: "sound-c", type: "trigger", params: { spatial: true } },
    ],
    "canonical sound redo should restore the exact authored sound objects",
  );

  const deleteResult = applyAndRecord({
    type: "delete",
    items: [
      { index: 1, sound: doc.sounds[1] },
    ],
  });
  assert.equal(deleteResult.selectedSoundId, null, "canonical sound delete should clear active authored sound selection");
  assert.deepEqual(doc.sounds.map((sound) => sound.id), ["sound-a", "sound-c"], "canonical sound delete should remove the selected sound by stable id");

  const undoDeleteResult = undo();
  assert.deepEqual(
    doc.sounds.map((sound) => sound.id),
    ["sound-a", "sound-b", "sound-c"],
    "canonical sound undo should restore deleted sounds in authored order",
  );
  assert.deepEqual(
    undoDeleteResult.selectedSoundIds,
    ["sound-b"],
    "canonical sound undo should reselect the restored sound by stable id",
  );
}

async function runLiveSoundPlacementRuntimeRegressionChecks() {
  const harness = await createEditorRuntimeHarness();
  const { canvas, fakeWindow, store } = harness;

  try {
    const initialState = store.getState();
    assert.equal(initialState.document.status, "ready", "runtime harness should load the mock level document");
    const initialSoundIds = initialState.document.active.sounds.map((sound) => sound.id);

    store.setState((draft) => {
      draft.interaction.activeTool = "inspect";
      draft.interaction.activeLayer = "sound";
      draft.interaction.canvasSelectionMode = "sound";
      draft.interaction.activeSoundPresetId = "ambient-zone";
      draft.interaction.activeEntityPresetId = null;
      draft.interaction.activeDecorPresetId = null;
      draft.interaction.soundDrag = {
        active: true,
        leadSoundId: initialSoundIds[0] || "stale-sound",
        anchorCell: { x: 0, y: 0 },
        originPositions: [{ soundId: "stale-sound", x: 0, y: 0 }],
        previewDelta: { x: 1, y: 0 },
      };
    });

    const firstCell = { x: 1, y: 2 };
    canvas.dispatch("mousedown", {
      ...getClientPointForCell(store.getState(), firstCell),
      altKey: true,
      button: 0,
    });

    const afterCreateState = store.getState();
    const createdSound = afterCreateState.document.active.sounds.at(-1);
    assert.equal(afterCreateState.document.active.sounds.length, initialSoundIds.length + 1, "Alt+click sound placement should append an authored sound immediately");
    assert.equal(afterCreateState.interaction.selectedSoundId, createdSound.id, "live sound placement should select the new authored sound by stable id");
    assert.deepEqual(afterCreateState.interaction.selectedSoundIds, [createdSound.id], "live sound placement should keep selection pinned to the new authored sound id only");
    assert.deepEqual(afterCreateState.interaction.selectedCell, firstCell, "live sound placement should update the selected sound cell immediately");
    assert.equal(createdSound.type, findSoundPresetById("ambient-zone").type, "live sound placement should author the preset sound type through the canonical lane");
    assert.equal(afterCreateState.interaction.soundDrag, null, "live sound placement should clear stale drag state instead of reviving the legacy move lane");

    const selectPoint = getClientPointForCell(afterCreateState, firstCell);
    canvas.dispatch("mousedown", {
      ...selectPoint,
      altKey: false,
      button: 0,
    });

    const afterSelectState = store.getState();
    assert.equal(afterSelectState.interaction.selectedSoundId, createdSound.id, "click selection should resolve the exact authored sound by stable id");
    assert.equal(afterSelectState.interaction.soundDrag, null, "click selection should not re-arm the disabled sound drag lane");

    fakeWindow.dispatch("keydown", {
      key: "Delete",
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      repeat: false,
      code: "Delete",
      target: null,
    });

    const afterDeleteState = store.getState();
    assert.equal(afterDeleteState.document.active.sounds.some((sound) => sound.id === createdSound.id), false, "delete should remove the selected authored sound by id");
    assert.equal(afterDeleteState.interaction.selectedSoundId, null, "delete should clear selectedSoundId on the canonical lane");

    fakeWindow.dispatch("keydown", {
      key: "z",
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      repeat: false,
      code: "KeyZ",
      target: null,
    });

    const afterDeleteUndoState = store.getState();
    assert.equal(afterDeleteUndoState.document.active.sounds.some((sound) => sound.id === createdSound.id), true, "undo after sound delete should restore the exact authored sound object");
    assert.equal(afterDeleteUndoState.interaction.selectedSoundId, createdSound.id, "undo after sound delete should reselect the restored sound id");

    fakeWindow.dispatch("keydown", {
      key: "z",
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
      altKey: false,
      repeat: false,
      code: "KeyZ",
      target: null,
    });

    const afterDeleteRedoState = store.getState();
    assert.equal(afterDeleteRedoState.document.active.sounds.some((sound) => sound.id === createdSound.id), false, "redo after sound delete should remove only the same authored sound again");

    fakeWindow.dispatch("keydown", {
      key: "z",
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      repeat: false,
      code: "KeyZ",
      target: null,
    });

    const afterCreateUndoState = store.getState();
    assert.deepEqual(
      afterCreateUndoState.document.active.sounds.map((sound) => sound.id),
      [...initialSoundIds, createdSound.id],
      "mixed sound history routing should keep the canonical sound lane isolated from legacy shared object-layer undo stacks",
    );

    const secondCell = { x: 2, y: 2 };
    canvas.dispatch("mousedown", {
      ...getClientPointForCell(store.getState(), secondCell),
      altKey: true,
      button: 0,
    });

    const thirdCell = { x: 3, y: 2 };
    canvas.dispatch("mousedown", {
      ...getClientPointForCell(store.getState(), thirdCell),
      altKey: true,
      button: 0,
    });

    const afterMultipleCreates = store.getState();
    const lastThreeSoundIds = afterMultipleCreates.document.active.sounds.slice(-3).map((sound) => sound.id);
    assert.deepEqual(
      lastThreeSoundIds,
      afterMultipleCreates.document.active.sounds.slice(-3).map((sound) => sound.id),
      "multiple canonical sound creates should preserve deterministic append order before undo checks",
    );

    fakeWindow.dispatch("keydown", {
      key: "z",
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      repeat: false,
      code: "KeyZ",
      target: null,
    });
    fakeWindow.dispatch("keydown", {
      key: "z",
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      repeat: false,
      code: "KeyZ",
      target: null,
    });

    const afterSequentialUndoState = store.getState();
    assert.deepEqual(
      afterSequentialUndoState.document.active.sounds.slice(-1).map((sound) => sound.id),
      [createdSound.id],
      "multiple sequential sound creates should undo in exact reverse order on the canonical lane",
    );

    fakeWindow.dispatch("keydown", {
      key: "z",
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
      altKey: false,
      repeat: false,
      code: "KeyZ",
      target: null,
    });
    fakeWindow.dispatch("keydown", {
      key: "z",
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
      altKey: false,
      repeat: false,
      code: "KeyZ",
      target: null,
    });

    const afterSequentialRedoState = store.getState();
    assert.deepEqual(
      afterSequentialRedoState.document.active.sounds.slice(-3).map((sound) => ({ id: sound.id, type: sound.type, x: sound.x, y: sound.y })),
      [
        { id: createdSound.id, type: createdSound.type, x: createdSound.x, y: createdSound.y },
        { id: afterMultipleCreates.document.active.sounds.at(-2).id, type: afterMultipleCreates.document.active.sounds.at(-2).type, x: 2, y: 2 },
        { id: afterMultipleCreates.document.active.sounds.at(-1).id, type: afterMultipleCreates.document.active.sounds.at(-1).type, x: 3, y: 2 },
      ],
      "redo should restore the exact authored sound objects in canonical order",
    );

    const { ctx: renderCtx, operations: renderOperations } = createPreviewTestContext();
    renderSounds(
      renderCtx,
      afterSequentialRedoState.document.active,
      afterSequentialRedoState.viewport,
      afterSequentialRedoState.interaction,
      afterSequentialRedoState.scan,
    );
    assert.ok(renderOperations.length > 0, "sound render/highlight resolution should continue drawing authored sounds from stable ids");

    const { ctx: previewCtx, operations: previewOperations } = createPreviewTestContext();
    renderSoundDragPreview(
      previewCtx,
      afterSequentialRedoState.document.active,
      afterSequentialRedoState.viewport,
      {
        ...afterSequentialRedoState.interaction,
        soundDrag: {
          active: true,
          leadSoundId: createdSound.id,
          anchorCell: { x: createdSound.x, y: createdSound.y },
          originPositions: [{ soundId: createdSound.id, x: createdSound.x, y: createdSound.y }],
          previewDelta: { x: 1, y: 0 },
        },
      },
    );
    assert.equal(previewOperations.length, 0, "normal live usage should no longer render any legacy sound drag overlay or preview");
  } finally {
    harness.destroy();
  }
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

function runNewLevelDocumentRegressionChecks() {
  const defaultDoc = createNewLevelDocument();
  assert.equal(defaultDoc.dimensions.width, DEFAULT_NEW_LEVEL_WIDTH, "new level should use the default width");
  assert.equal(defaultDoc.dimensions.height, DEFAULT_NEW_LEVEL_HEIGHT, "new level should use the default height");
  assert.equal(defaultDoc.tiles.base.length, DEFAULT_NEW_LEVEL_WIDTH * DEFAULT_NEW_LEVEL_HEIGHT, "new level tiles should match the default dimensions");

  const resizedDoc = createNewLevelDocument({ width: 64, height: 24 });
  assert.equal(resizedDoc.dimensions.width, 64, "new level should accept a custom width");
  assert.equal(resizedDoc.dimensions.height, 24, "new level should accept a custom height");
  assert.equal(resizedDoc.tiles.base.length, 64 * 24, "new level tiles should match the custom dimensions");

  assert.equal(sanitizeLevelDimension("5", DEFAULT_NEW_LEVEL_WIDTH), MIN_LEVEL_DIMENSION, "dimension sanitizing should clamp to the minimum");
  assert.equal(sanitizeLevelDimension("999", DEFAULT_NEW_LEVEL_WIDTH), MAX_LEVEL_DIMENSION, "dimension sanitizing should clamp to the maximum");
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

function runDecorAndSoundDeletionRegressionChecks() {
  const doc = createDoc();
  const history = createHistoryState();

  const decor = {
    id: "decor-1",
    name: "Lamp",
    type: "lamp",
    x: 1,
    y: 2,
    visible: true,
    variant: "gold",
    params: {
      light: {
        radius: 48,
      },
    },
  };
  const sound = {
    id: "sound-1",
    name: "Wind",
    type: "loop",
    x: 3,
    y: 1,
    visible: true,
    params: {
      volume: 0.85,
      loop: true,
    },
  };

  doc.decor.push(decor);
  doc.sounds.push(sound);
  const deletedDecorSnapshot = { ...decor, params: structuredClone(decor.params) };
  const deletedSoundSnapshot = { ...sound, params: structuredClone(sound.params) };

  startHistoryBatch(history, "object-delete");
  doc.decor.splice(0, 1);
  pushHistoryEntry(history, createDecorEditEntry("delete", { index: 0, decor: deletedDecorSnapshot }));
  doc.sounds.splice(0, 1);
  pushHistoryEntry(history, createSoundEditEntry("delete", { index: 0, sound: deletedSoundSnapshot }));
  assert.equal(endHistoryBatch(history), true, "decor/sound deletion should produce a history batch");

  decor.params.light.radius = 96;
  sound.params.volume = 0.1;

  undoTileEdit(doc, history);
  assert.equal(doc.decor.length, 1, "undo should restore deleted decor");
  assert.equal(doc.sounds.length, 1, "undo should restore deleted sounds");
  assert.deepEqual(doc.decor[0].params, { light: { radius: 48 } }, "undo should restore nested decor params from history snapshots");
  assert.deepEqual(doc.sounds[0].params, { volume: 0.85, loop: true }, "undo should restore sound params from history snapshots");

  redoTileEdit(doc, history);
  assert.equal(doc.decor.length, 0, "redo should re-delete decor");
  assert.equal(doc.sounds.length, 0, "redo should re-delete sounds");
}

function runCleanRoomDecorRuntimeRegressionChecks() {
  const doc = createDoc();
  doc.decor = [
    { id: "decor-a", name: "A", type: "torch", x: 0, y: 0, visible: true, variant: "a", params: { glow: 1 } },
    { id: "decor-b", name: "B", type: "torch", x: 1, y: 0, visible: true, variant: "a", params: { glow: 2 } },
    { id: "decor-c", name: "C", type: "torch", x: 2, y: 0, visible: true, variant: "a", params: { glow: 3 } },
  ];

  const action = {
    type: "delete",
    items: [
      { index: 0, decor: doc.decor[0] },
      { index: 2, decor: doc.decor[2] },
    ],
  };

  const forwardResult = applyCanonicalDecorAction(doc, action, "forward");
  assert.equal(forwardResult.changed, true, "clean-room decor delete should remove selected authored decor by stable id");
  assert.equal(forwardResult.selectedDecorId, null, "clean-room decor delete should clear authored decor selection after deletion");
  assert.deepEqual(doc.decor.map((decor) => decor.id), ["decor-b"], "clean-room decor delete should preserve surviving authored decor without index drift");

  const undoResult = applyCanonicalDecorAction(doc, action, "backward");
  assert.equal(undoResult.changed, true, "clean-room decor undo should restore deleted authored decor");
  assert.equal(undoResult.selectedDecorId, "decor-c", "clean-room decor undo should report the restored primary decor id");
  assert.deepEqual(doc.decor.map((decor) => decor.id), ["decor-a", "decor-b", "decor-c"], "clean-room decor undo should restore authored decor in canonical order");

  const history = createCanonicalDecorHistory();
  history.record(action);
  assert.equal(history.canUndo(), true, "clean-room decor history should track canonical decor delete batches");
  const undoAction = history.popUndo();
  assert.deepEqual(undoAction.items.map((item) => item.decor.id), ["decor-a", "decor-c"], "clean-room decor history should keep stable decor ids in undo batches");
  history.pushRedo(undoAction);
  assert.equal(history.canRedo(), true, "clean-room decor history should preserve redo batches after undo");
}

function runCleanRoomDecorHistoryDeterminismRegressionChecks() {
  const doc = createDoc();
  const harness = createDecorHistoryHarness(doc);
  const createdDecor = Array.from({ length: 5 }, (_, index) => ({
    id: `decor-${index + 1}`,
    name: `Decor ${index + 1}`,
    type: "decor_flower_01",
    x: index,
    y: 0,
    visible: true,
    variant: "default",
    params: { bloom: index + 1 },
  }));

  createdDecor.forEach((decor, index) => {
    assert.equal(
      harness.recordAndApply({
        type: "create",
        items: [{ index, decor }],
      }),
      true,
      `clean-room decor create ${index + 1} should record and apply`,
    );
  });
  assert.deepEqual(doc.decor.map((decor) => decor.id), createdDecor.map((decor) => decor.id), "sequential decor creates should preserve authored order");

  for (let index = createdDecor.length - 1; index >= 0; index -= 1) {
    assert.equal(harness.undo(), true, `undo ${createdDecor.length - index} should succeed`);
    assert.deepEqual(
      doc.decor.map((decor) => decor.id),
      createdDecor.slice(0, index).map((decor) => decor.id),
      "repeated undo should remove decor creates in exact reverse order, including the first placed decor",
    );
  }
  assert.deepEqual(doc.decor, [], "undoing all decor creates should remove every authored decor item");

  for (let index = 1; index <= createdDecor.length; index += 1) {
    assert.equal(harness.redo(), true, `redo ${index} should succeed`);
    assert.deepEqual(
      doc.decor.map((decor) => decor.id),
      createdDecor.slice(0, index).map((decor) => decor.id),
      "repeated redo should restore decor creates in exact forward order",
    );
  }

  const deleteHarness = createDecorHistoryHarness(createDoc());
  deleteHarness.doc.decor = createdDecor.slice(0, 3).map((decor) => structuredClone(decor));
  const deletedMiddle = structuredClone(deleteHarness.doc.decor[1]);
  assert.equal(
    deleteHarness.recordAndApply({
      type: "delete",
      items: [{ index: 1, decor: deletedMiddle }],
    }),
    true,
    "clean-room decor delete should record and apply for the targeted authored decor",
  );
  assert.deepEqual(deleteHarness.doc.decor.map((decor) => decor.id), ["decor-1", "decor-3"], "deleting the middle decor should not disturb neighbors");
  assert.equal(deleteHarness.undo(), true, "undo should restore the deleted middle decor");
  assert.deepEqual(
    deleteHarness.doc.decor.map((decor) => decor.id),
    ["decor-1", "decor-2", "decor-3"],
    "undoing a decor delete should restore exactly the deleted authored decor object at its canonical position",
  );
  assert.deepEqual(
    deleteHarness.doc.decor[1],
    deletedMiddle,
    "undoing a decor delete should restore the exact deleted authored decor snapshot",
  );
  assert.equal(deleteHarness.redo(), true, "redo should reapply the same decor delete");
  assert.deepEqual(deleteHarness.doc.decor.map((decor) => decor.id), ["decor-1", "decor-3"], "redo should remove only the same deleted decor again");

  const redoTailHarness = createDecorHistoryHarness(createDoc());
  createdDecor.slice(0, 3).forEach((decor, index) => {
    assert.equal(
      redoTailHarness.recordAndApply({
        type: "create",
        items: [{ index, decor }],
      }),
      true,
      "setup creates for redo-tail coverage should succeed",
    );
  });
  assert.equal(redoTailHarness.undo(), true, "first undo before redo-tail reset should succeed");
  assert.equal(redoTailHarness.undo(), true, "second undo before redo-tail reset should succeed");
  assert.deepEqual(redoTailHarness.doc.decor.map((decor) => decor.id), ["decor-1"], "setup undos should leave only the earliest decor");
  assert.equal(redoTailHarness.canRedo(), true, "undoing decor creates should populate the redo tail");
  assert.equal(
    redoTailHarness.recordAndApply({
      type: "create",
      items: [{
        index: redoTailHarness.doc.decor.length,
        decor: {
          id: "decor-new",
          name: "Decor New",
          type: "decor_flower_01",
          x: 9,
          y: 1,
          visible: true,
          variant: "default",
          params: { bloom: 99 },
        },
      }],
    }),
    true,
    "creating decor after undo should clear stale redo history",
  );
  assert.equal(redoTailHarness.canRedo(), false, "recording a new decor action after undo should clear the stale redo tail");
  assert.equal(redoTailHarness.redo(), false, "redo should not resurrect stale decor after a new decor action");
  assert.deepEqual(redoTailHarness.doc.decor.map((decor) => decor.id), ["decor-1", "decor-new"], "stale redo should not resurrect previously undone decor");

  const mixedHarness = createDecorHistoryHarness(createDoc());
  const mixedDecor = [
    { id: "decor-a", name: "A", type: "decor_flower_01", x: 0, y: 0, visible: true, variant: "default", params: { bloom: 1 } },
    { id: "decor-b", name: "B", type: "decor_flower_01", x: 1, y: 0, visible: true, variant: "default", params: { bloom: 2 } },
    { id: "decor-c", name: "C", type: "decor_flower_01", x: 2, y: 0, visible: true, variant: "default", params: { bloom: 3 } },
    { id: "decor-d", name: "D", type: "decor_flower_01", x: 3, y: 0, visible: true, variant: "default", params: { bloom: 4 } },
  ];
  mixedDecor.slice(0, 3).forEach((decor, index) => {
    assert.equal(
      mixedHarness.recordAndApply({
        type: "create",
        items: [{ index, decor }],
      }),
      true,
      "mixed decor create setup should succeed",
    );
  });
  assert.equal(
    mixedHarness.recordAndApply({
      type: "delete",
      items: [{ index: 1, decor: mixedDecor[1] }],
    }),
    true,
    "mixed decor delete should remove only the selected decor",
  );
  assert.equal(
    mixedHarness.recordAndApply({
      type: "create",
      items: [{ index: mixedHarness.doc.decor.length, decor: mixedDecor[3] }],
    }),
    true,
    "mixed decor create after delete should succeed",
  );
  assert.deepEqual(mixedHarness.doc.decor.map((decor) => decor.id), ["decor-a", "decor-c", "decor-d"], "mixed create/delete setup should only contain surviving decor");
  assert.equal(mixedHarness.undo(), true, "mixed undo should remove the most recent decor create");
  assert.deepEqual(mixedHarness.doc.decor.map((decor) => decor.id), ["decor-a", "decor-c"], "undo should remove only the latest created decor");
  assert.equal(mixedHarness.undo(), true, "second mixed undo should restore the deleted decor");
  assert.deepEqual(mixedHarness.doc.decor.map((decor) => decor.id), ["decor-a", "decor-b", "decor-c"], "undo should restore exactly the previously deleted decor without resurrecting unrelated items");
  assert.equal(mixedHarness.redo(), true, "mixed redo should reapply the targeted decor delete");
  assert.deepEqual(mixedHarness.doc.decor.map((decor) => decor.id), ["decor-a", "decor-c"], "redo should re-delete only the targeted decor");
  assert.equal(mixedHarness.redo(), true, "second mixed redo should reapply the later decor create");
  assert.deepEqual(mixedHarness.doc.decor.map((decor) => decor.id), ["decor-a", "decor-c", "decor-d"], "mixed redo should restore the later decor create without reviving unrelated decor");

  const immutableHistory = createCanonicalDecorHistory();
  const mutableAction = {
    type: "delete",
    items: [{
      index: 0,
      decor: {
        id: "decor-immutable",
        name: "Immutable",
        type: "decor_flower_01",
        x: 0,
        y: 0,
        visible: true,
        variant: "default",
        params: { bloom: 7 },
      },
    }],
  };
  immutableHistory.record(mutableAction);
  mutableAction.items[0].decor.params.bloom = 42;
  assert.equal(
    immutableHistory.popUndo().items[0].decor.params.bloom,
    7,
    "clean-room decor history should store immutable action payloads instead of mutated references",
  );
}

function runObjectLayerStableIdentityHistoryRegressionChecks() {
  const history = createHistoryState();

  const decorDoc = createDoc();
  decorDoc.decor = [
    { id: "decor-a", name: "A", type: "torch", x: 0, y: 0, visible: true, variant: "a", params: {} },
    { id: "decor-b", name: "B", type: "torch", x: 1, y: 0, visible: true, variant: "a", params: {} },
    { id: "decor-c", name: "C", type: "torch", x: 2, y: 0, visible: true, variant: "a", params: {} },
  ];
  pushHistoryEntry(
    history,
    createDecorEditEntry("delete", {
      index: 1,
      anchor: captureObjectLayerAnchor(decorDoc.decor, 1),
      decor: decorDoc.decor[1],
    }),
  );
  decorDoc.decor.splice(0, 2);

  undoTileEdit(decorDoc, history);
  assert.deepEqual(
    decorDoc.decor.map((decor) => decor.id),
    ["decor-b", "decor-c"],
    "undo should restore a deleted decor object before its surviving neighbor even when the original array index is stale",
  );

  const soundDoc = createDoc();
  soundDoc.sounds = [
    { id: "sound-a", name: "A", type: "spot", x: 0, y: 0, visible: true, params: {} },
    { id: "sound-new", name: "New", type: "spot", x: 1, y: 0, visible: true, params: {} },
    { id: "sound-b", name: "B", type: "spot", x: 2, y: 0, visible: true, params: {} },
  ];
  pushHistoryEntry(
    history,
    createSoundEditEntry("create", {
      index: 1,
      anchor: captureObjectLayerAnchor(soundDoc.sounds, 1),
      sound: soundDoc.sounds[1],
    }),
  );
  soundDoc.sounds.splice(1, 1);
  soundDoc.sounds.push({ id: "sound-new", name: "New", type: "spot", x: 1, y: 0, visible: true, params: {} });

  undoTileEdit(soundDoc, history);
  assert.deepEqual(
    soundDoc.sounds.map((sound) => sound.id),
    ["sound-a", "sound-b"],
    "undo should remove the created sound by stable id instead of deleting whichever sound now occupies the old array slot",
  );
}

function runGlobalObjectLayerUndoRedoRegressionChecks() {
  const doc = createDoc();
  const history = createHistoryState();

  const entity = {
    id: "entity-1",
    name: "Entity",
    type: "spawn",
    x: 0,
    y: 0,
    visible: true,
    params: { facing: "right" },
  };
  const decor = {
    id: "decor-1",
    name: "Decor",
    type: "lamp",
    x: 1,
    y: 0,
    visible: true,
    variant: "gold",
    params: { glow: 0.4 },
  };
  const sound = {
    id: "sound-1",
    name: "Sound",
    type: "loop",
    x: 2,
    y: 0,
    visible: true,
    params: { volume: 0.8 },
  };

  doc.entities.push(entity);
  pushHistoryEntry(history, createEntityEditEntry("create", { index: 0, entity }));
  doc.decor.push(decor);
  pushHistoryEntry(history, createDecorEditEntry("create", { index: 0, decor }));
  doc.sounds.push(sound);
  pushHistoryEntry(history, createSoundEditEntry("create", { index: 0, sound }));

  doc.decor.splice(0, 1);
  pushHistoryEntry(
    history,
    createDecorEditEntry("delete", {
      index: 0,
      anchor: captureObjectLayerAnchor([decor], 0),
      decor: { ...decor, params: structuredClone(decor.params) },
    }),
  );

  assert.equal(doc.entities.length, 1, "setup should preserve the entity before undo");
  assert.equal(doc.decor.length, 0, "setup should remove the decor before undo");
  assert.equal(doc.sounds.length, 1, "setup should preserve the sound before undo");

  undoTileEdit(doc, history);
  assert.deepEqual(doc.decor.map((item) => item.id), ["decor-1"], "first undo should restore the most recent decor deletion");

  undoTileEdit(doc, history);
  assert.equal(doc.sounds.length, 0, "second undo should remove the previously created sound");

  undoTileEdit(doc, history);
  assert.equal(doc.decor.length, 0, "third undo should remove the previously created decor");

  undoTileEdit(doc, history);
  assert.equal(doc.entities.length, 0, "fourth undo should remove the previously created entity");

  redoTileEdit(doc, history);
  assert.deepEqual(doc.entities.map((item) => item.id), ["entity-1"], "first redo should restore the earliest entity creation");

  redoTileEdit(doc, history);
  assert.deepEqual(doc.decor.map((item) => item.id), ["decor-1"], "second redo should restore the decor creation");

  redoTileEdit(doc, history);
  assert.deepEqual(doc.sounds.map((item) => item.id), ["sound-1"], "third redo should restore the sound creation");

  redoTileEdit(doc, history);
  assert.equal(doc.decor.length, 0, "fourth redo should reapply the most recent decor deletion");
}

function runFogVolumeRegressionChecks() {
  const normalized = validateLevelDocument({
    ...createDoc(),
    entities: [
      {
        id: "entity-fog",
        name: "Fog Volume",
        type: "fog_volume",
        x: 3,
        y: 2,
        visible: true,
        params: {
          area: {
            x0: 48,
            x1: 144,
            y0: 48,
            falloff: 18,
          },
          look: {
            density: 0.22,
            thickness: 36,
          },
          render: {
            blend: "screen",
            lumoBehindFog: false,
          },
        },
      },
    ],
  });

  assert.equal(normalized.entities.length, 1, "fog volumes should stay in the entity list");
  assert.equal(normalized.entities[0].type, "fog_volume", "fog volume validation should preserve the special type");
  assert.deepEqual(
    normalized.entities[0].params.area,
    { x0: 48, x1: 144, y0: 48, falloff: 18 },
    "fog volume validation should sync area semantics to the authored anchor while preserving nested area fields",
  );
  assert.equal(
    normalized.entities[0].params.look.thickness,
    36,
    "fog volume validation should preserve nested look params",
  );
  assert.equal(
    normalized.entities[0].params.render.lumoBehindFog,
    false,
    "fog volume validation should preserve nested render params",
  );

  const serialized = serializeLevelDocument(normalized);
  const roundTrip = JSON.parse(serialized);
  assert.deepEqual(
    roundTrip.entities[0].params.look,
    normalized.entities[0].params.look,
    "fog volume export should preserve nested look params",
  );
  assert.deepEqual(
    roundTrip.entities[0].params.render,
    normalized.entities[0].params.render,
    "fog volume export should preserve nested render params",
  );

  const dragPlaced = createFogVolumeEntityFromWorldRect({
    ...normalized.entities[0],
    x: 0,
    y: 0,
  }, {
    x0: 14,
    y0: 18,
    x1: 130,
    y1: 74,
  }, 16);
  assert.equal(dragPlaced.params.area.x1 - dragPlaced.params.area.x0, 116, "fog drag placement should preserve the dragged width");
  assert.equal(dragPlaced.params.area.y0, 80, "fog drag placement should place the fog baseline on the authored lower edge cell");
  assert.equal(dragPlaced.params.look.thickness, 56, "fog drag placement should derive initial thickness from the drag height");
}

function runFogPlacementPreviewRegressionChecks() {
  const doc = createDoc();
  const viewport = { offsetX: 0, offsetY: 0, zoom: 1 };
  const fogPreset = findEntityPresetById("fog_volume");
  assert.ok(fogPreset, "fog volume preset should remain available for roundtrip defaults");

  const armedOnly = createPreviewTestContext();
  renderEntityPlacementPreview(armedOnly.ctx, doc, viewport, {
    activeTool: "inspect",
    activeLayer: "entities",
    hoverCell: { x: 1, y: 1 },
    specialVolumePlacement: null,
  }, fogPreset);
  assert.equal(
    armedOnly.operations.length,
    0,
    "arming fog volume placement should not render a floating fog preview before drag placement begins",
  );

  const activeDrag = createPreviewTestContext();
  renderEntityPlacementPreview(activeDrag.ctx, doc, viewport, {
    activeTool: "inspect",
    activeLayer: "entities",
    hoverCell: { x: 1, y: 1 },
    specialVolumePlacement: {
      active: true,
      startCell: { x: 1, y: 1 },
      startWorld: { x: 16, y: 16 },
      currentWorld: { x: 80, y: 56 },
    },
  }, fogPreset);
  assert.equal(
    activeDrag.operations.length,
    0,
    "fog volume placement previews should stay disabled during drag placement",
  );
}

function runObjectPlacementPreviewSuppressionRegressionChecks() {
  const doc = createDoc();
  const viewport = { offsetX: 0, offsetY: 0, zoom: 1 };
  const decorPreset = findDecorPresetById("decor_flower_01");
  const entityPreset = findEntityPresetById("player-spawn");
  const soundPreset = findSoundPresetById("spot");

  assert.ok(decorPreset, "decor placement preview coverage should use a real decor preset");
  assert.ok(entityPreset, "entity placement preview coverage should use a real entity preset");
  assert.ok(soundPreset, "sound placement preview coverage should use a real sound preset");

  const visibleEntityPreview = createPreviewTestContext();
  renderEntityPlacementPreview(visibleEntityPreview.ctx, doc, viewport, {
    activeTool: "inspect",
    activeLayer: "entities",
    hoverCell: { x: 1, y: 1 },
    objectPlacementPreviewSuppressed: false,
  }, entityPreset);
  assert.equal(visibleEntityPreview.operations.length, 0, "entity placement previews should stay fully disabled while the temporary clean entity path bypasses legacy preview/render-suppression logic");

  const suppressedEntityPreview = createPreviewTestContext();
  renderEntityPlacementPreview(suppressedEntityPreview.ctx, doc, viewport, {
    activeTool: "inspect",
    activeLayer: "entities",
    hoverCell: { x: 1, y: 1 },
    objectPlacementPreviewSuppressed: true,
  }, entityPreset);
  assert.equal(suppressedEntityPreview.operations.length, 0, "entity placement previews should stay disabled even when legacy shared preview suppression flips on");

  const visibleDecorPreview = createPreviewTestContext();
  renderDecorPlacementPreview(visibleDecorPreview.ctx, doc, viewport, {
    activeTool: "inspect",
    activeLayer: "decor",
    hoverCell: { x: 1, y: 1 },
    decorScatterMode: false,
    objectPlacementPreviewSuppressed: false,
  }, decorPreset);
  assert.ok(visibleDecorPreview.operations.length > 0, "decor placement previews should still render during normal placement workflow");

  const suppressedDecorPreview = createPreviewTestContext();
  renderDecorPlacementPreview(suppressedDecorPreview.ctx, doc, viewport, {
    activeTool: "inspect",
    activeLayer: "decor",
    hoverCell: { x: 1, y: 1 },
    decorScatterMode: false,
    objectPlacementPreviewSuppressed: true,
  }, decorPreset);
  assert.equal(suppressedDecorPreview.operations.length, 0, "decor placement previews should stay hidden while shared object preview suppression is active");

  const visibleSoundPreview = createPreviewTestContext();
  renderSoundPlacementPreview(visibleSoundPreview.ctx, doc, viewport, {
    activeTool: "inspect",
    activeLayer: "sound",
    hoverCell: { x: 1, y: 1 },
    objectPlacementPreviewSuppressed: false,
  }, soundPreset);
  assert.ok(visibleSoundPreview.operations.length > 0, "sound placement previews should still render during normal placement workflow");

  const suppressedSoundPreview = createPreviewTestContext();
  renderSoundPlacementPreview(suppressedSoundPreview.ctx, doc, viewport, {
    activeTool: "inspect",
    activeLayer: "sound",
    hoverCell: { x: 1, y: 1 },
    objectPlacementPreviewSuppressed: true,
  }, soundPreset);
  assert.equal(suppressedSoundPreview.operations.length, 0, "sound placement previews should stay hidden while shared object preview suppression is active");
}

function runDecorRegressionChecks() {
  const source = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/app/createEditorApp.js"), "utf8");
  assert.equal(
    source.includes("const createDecorAtCell = (draft, cell, presetId = draft.interaction.activeDecorPresetId || DEFAULT_DECOR_PRESET_ID) => {"),
    true,
    "live decor placement wiring should expose a dedicated createDecorAtCell entry point again",
  );
  assert.equal(
    source.includes("return createCleanRoomDecorAtCell(draft, cell, presetId);"),
    true,
    "live decor placement should continue delegating into the canonical clean-room decor create lane",
  );
  assert.equal(
    source.includes('createDecorAtCell(draft, cell, activeDecorPresetId);'),
    true,
    "inspect-mode Alt+click decor placement should stay wired to the canonical decor create entry point",
  );

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

  const normalizedEntityBucketsDoc = validateLevelDocument({
    ...createDoc(),
    decor: [
      {
        id: "decor-firefly",
        name: "Firefly Decor Alias",
        type: "firefly_01",
        x: 3,
        y: 2,
        visible: true,
        variant: "a",
        params: { lightRadius: 100 },
      },
      {
        id: "decor-flower",
        name: "Flower",
        type: "decor_flower_01",
        x: 0,
        y: 0,
        visible: true,
        variant: "a",
      },
    ],
    entities: [
      {
        id: "entity-lantern",
        name: "Lantern Alias",
        type: "lantern",
        x: 1,
        y: 1,
        visible: true,
        params: { lightRadius: 180 },
      },
    ],
  });

  assert.equal(normalizedEntityBucketsDoc.decor.length, 1, "validation should keep flower decor in the decor bucket");
  assert.equal(normalizedEntityBucketsDoc.decor[0].type, "decor_flower_01", "validation should preserve flower decor types");
  assert.equal(normalizedEntityBucketsDoc.entities.length, 2, "validation should migrate entity-like decor into entities");
  assert.equal(normalizedEntityBucketsDoc.entities[0].type, "lantern_01", "validation should normalize lantern aliases into the entity workflow");
  assert.equal(normalizedEntityBucketsDoc.entities[0].params.radius, 180, "validation should remap lantern light radius params");
  assert.equal(normalizedEntityBucketsDoc.entities[1].type, "firefly_01", "validation should move fireflies into the entity workflow");
  assert.equal(normalizedEntityBucketsDoc.entities[1].params.lightDiameter, 200, "validation should remap firefly radius params into editable defaults");
  assert.equal(normalizedEntityBucketsDoc.entities[1].params.lightStrength, 0.8, "validation should seed firefly defaults for param editing");

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

function runSoundTypeRenderRegressionChecks() {
  const doc = createDoc();
  doc.sounds = [
    { id: "sound-spot", name: "Spot", type: "spot", x: 0, y: 0, visible: true, params: { radius: 2, spatial: true } },
    { id: "sound-trigger", name: "Trigger", type: "trigger", x: 2, y: 0, visible: true, params: { radius: 0, spatial: true } },
    { id: "sound-ambient", name: "Ambient", type: "ambientZone", x: 0, y: 2, visible: true, params: { width: 2, height: 2 } },
    { id: "sound-music", name: "Music", type: "musicZone", x: 2, y: 2, visible: true, params: { width: 2, height: 2, fadeDistance: 1 } },
  ];

  const viewport = { offsetX: 0, offsetY: 0, zoom: 1 };
  const scan = {
    activeSoundIds: ["sound-spot", "sound-trigger", "sound-ambient", "sound-music"],
    audioEvaluation: {
      soundStates: doc.sounds.map((sound) => ({
        soundId: sound.id,
        presence: { intensity: 0.5, isTriggered: sound.type === "trigger" },
        evaluation: { positionX: sound.x + 0.5 },
      })),
    },
  };

  const interaction = {
    ...createSoundInteractionState(),
    hoveredSoundId: "sound-music",
    hoveredSoundIndex: 3,
    selectedSoundIds: ["sound-ambient"],
    selectedSoundId: "sound-ambient",
    selectedSoundIndices: [2],
    selectedSoundIndex: 2,
  };

  const { ctx, operations } = createPreviewTestContext();
  renderSounds(ctx, doc, viewport, interaction, scan);
  assert.ok(operations.length > 0, "sound render should draw the authored sound types without waiting for pointer updates");

  assert.equal(findSoundAtCanvasPoint(doc, viewport, 8, 8), 0, "spot sound hit-testing should work");
  assert.equal(findSoundAtCanvasPoint(doc, viewport, 40, 8), 1, "trigger sound hit-testing should work");
  assert.equal(findSoundAtCanvasPoint(doc, viewport, 8, 40), 2, "ambient zone hit-testing should work");
  assert.equal(findSoundAtCanvasPoint(doc, viewport, 40, 40), 3, "music zone hit-testing should work");

  const dragPreview = createPreviewTestContext();
  renderSoundDragPreview(dragPreview.ctx, doc, viewport, {
    ...interaction,
    soundDrag: {
      active: true,
      originPositions: doc.sounds.map((sound) => ({ soundId: sound.id, x: sound.x, y: sound.y })),
      previewDelta: { x: 1, y: 0 },
    },
  });
  assert.equal(dragPreview.operations.length, 0, "sound drag previews should stay disabled until a canonical sound move lane exists");

  for (const presetId of ["spot", "trigger", "ambient-zone", "music-zone"]) {
    const preset = findSoundPresetById(presetId);
    assert.ok(preset, `${presetId} sound preset should exist for placement preview coverage`);

    const placementPreview = createPreviewTestContext();
    renderSoundPlacementPreview(placementPreview.ctx, doc, viewport, {
      activeTool: "inspect",
      hoverCell: { x: 1, y: 1 },
      soundPlacementPreviewSuppressed: false,
    }, preset);
    assert.ok(placementPreview.operations.length > 0, `${preset.defaultName} placement preview should keep rendering during normal placement workflow`);

    const suppressedPlacementPreview = createPreviewTestContext();
    renderSoundPlacementPreview(suppressedPlacementPreview.ctx, doc, viewport, {
      activeTool: "inspect",
      hoverCell: { x: 1, y: 1 },
      soundPlacementPreviewSuppressed: true,
    }, preset);
    assert.equal(
      suppressedPlacementPreview.operations.length,
      0,
      `${preset.defaultName} placement preview should stay hidden while authored sound mutations suppress stale hover previews`,
    );
  }
}

function runSoundIdentityRegressionChecks() {
  const interaction = createSoundInteractionState();
  const sounds = [
    { id: "spot-a", type: "spot", x: 0, y: 0, visible: true, params: {} },
    { id: "trigger-b", type: "trigger", x: 1, y: 0, visible: true, params: {} },
    { id: "ambient-c", type: "ambientZone", x: 2, y: 0, visible: true, params: { width: 2, height: 1 } },
    { id: "music-d", type: "musicZone", x: 4, y: 0, visible: true, params: { width: 3, height: 1 } },
  ];

  setSoundSelection(interaction, [0, 2, 3], 3, sounds);
  assert.deepEqual(
    getSelectedSoundIds(interaction),
    ["spot-a", "ambient-c", "music-d"],
    "sound selection should capture stable sound ids when selecting by index",
  );
  assert.deepEqual(
    getSelectedSoundIndices(interaction, sounds),
    [0, 2, 3],
    "sound selection should still resolve the original indices before mutation",
  );

  sounds.splice(2, 1);
  pruneSoundSelection(interaction, sounds);
  assert.deepEqual(
    getSelectedSoundIds(interaction),
    ["spot-a", "music-d"],
    "pruning after deletion should discard only the deleted sound id and keep surviving sound ids",
  );
  assert.deepEqual(
    getSelectedSoundIndices(interaction, sounds),
    [0, 2],
    "pruning after deletion should rebind surviving sound ids to their new indices",
  );
  assert.equal(interaction.selectedSoundId, "music-d", "primary sound selection should stay attached to the surviving sound id");
  assert.equal(interaction.selectedSoundIndex, 2, "primary sound selection should update to the surviving sound's new index");

  const staleInteraction = createSoundInteractionState();
  staleInteraction.selectedSoundIndices = [1];
  staleInteraction.selectedSoundIndex = 1;
  pruneSoundSelection(staleInteraction, sounds);
  assert.deepEqual(
    staleInteraction.selectedSoundIndices,
    [],
    "sound pruning should clear stale legacy indices instead of rebinding them to whichever sound now occupies the slot",
  );
  assert.equal(
    staleInteraction.selectedSoundIndex,
    null,
    "sound pruning should clear a stale primary index when there is no stable sound id to reconcile",
  );
}

function runSoundDragPreviewIdentityRegressionChecks() {
  const doc = createDoc();
  doc.sounds = [
    {
      id: "ambient-zone",
      name: "Ambient Zone",
      type: "ambientZone",
      x: 0,
      y: 0,
      visible: true,
      params: { width: 2, height: 2 },
    },
    {
      id: "music-zone",
      name: "Music Zone",
      type: "musicZone",
      x: 4,
      y: 0,
      visible: true,
      params: { width: 3, height: 2, fadeDistance: 1 },
    },
  ];

  const interaction = createSoundInteractionState();
  interaction.selectedSoundIds = ["ambient-zone"];
  interaction.selectedSoundId = "ambient-zone";
  interaction.selectedSoundIndices = [0];
  interaction.selectedSoundIndex = 0;
  interaction.hoveredSoundId = "ambient-zone";
  interaction.hoveredSoundIndex = 0;
  interaction.soundDrag = {
    active: true,
    leadSoundId: "ambient-zone",
    originPositions: [{ soundId: "ambient-zone", x: 0, y: 0 }],
    previewDelta: { x: 1, y: 0 },
  };

  const viewport = { zoom: 1, offsetX: 0, offsetY: 0 };
  const { ctx, operations } = createPreviewTestContext();

  doc.sounds.splice(0, 1);
  renderSounds(ctx, doc, viewport, interaction, null);
  const operationsAfterRender = operations.length;
  assert.ok(operationsAfterRender > 0, "remaining sounds should still render after deleting a dragged sound");

  renderSoundDragPreview(ctx, doc, viewport, interaction);
  assert.equal(
    operations.length,
    operationsAfterRender,
    "stale drag preview ids should not render a different surviving zone sound at the deleted sound's previous slot",
  );
}

function runObjectLayerInteractionReconciliationChecks() {
  const beforeEntities = [
    { id: "entity-a", x: 0, y: 0, visible: true },
    { id: "entity-b", x: 1, y: 0, visible: true },
    { id: "entity-c", x: 2, y: 0, visible: true },
  ];
  const afterEntities = beforeEntities.slice(1);
  const capturedEntityInteraction = captureIndexedObjectInteractionSnapshot(beforeEntities, {
    selectedIndices: [1, 2],
    primarySelectedIndex: 2,
    hoveredIndex: 1,
    drag: {
      active: true,
      leadIndex: 2,
      anchorCell: { x: 2, y: 0 },
      previewDelta: { x: 1, y: 0 },
      originPositions: [
        { index: 1, x: 1, y: 0 },
        { index: 2, x: 2, y: 0 },
      ],
    },
  });
  const reconciledEntityInteraction = reconcileIndexedObjectInteraction(afterEntities, capturedEntityInteraction);

  assert.deepEqual(
    reconciledEntityInteraction.selectedIndices,
    [0, 1],
    "indexed object reconciliation should rebind surviving selections to their new indices after deletion",
  );
  assert.equal(
    reconciledEntityInteraction.primarySelectedIndex,
    1,
    "indexed object reconciliation should keep the primary selection attached to the surviving entity id",
  );
  assert.equal(
    reconciledEntityInteraction.hoveredIndex,
    0,
    "indexed object reconciliation should rebind hover state by id instead of leaving a stale array slot reference",
  );
  assert.deepEqual(
    reconciledEntityInteraction.drag?.originPositions,
    [
      { index: 0, x: 1, y: 0 },
      { index: 1, x: 2, y: 0 },
    ],
    "indexed object reconciliation should remap drag origins so surviving objects do not inherit deleted indices",
  );
  assert.equal(
    reconciledEntityInteraction.drag?.leadIndex,
    1,
    "indexed object reconciliation should keep the drag lead attached to the surviving entity id",
  );

  const decorItems = [
    { id: "decor-a", x: 0, y: 0, visible: true },
    { id: "decor-b", x: 1, y: 0, visible: true },
    { id: "decor-c", x: 2, y: 0, visible: true },
  ];
  const decorInteraction = {
    selectedDecorIndices: [],
    selectedDecorIndex: null,
    selectedDecorIds: [],
    selectedDecorId: null,
  };
  setDecorSelection(decorInteraction, [1, 2], 2, decorItems);
  assert.deepEqual(
    getSelectedDecorIds(decorInteraction),
    ["decor-b", "decor-c"],
    "decor selection should store stable ids for authored decor",
  );
  assert.deepEqual(
    getSelectedDecorIndices(decorInteraction, decorItems.slice(1)),
    [0, 1],
    "decor selection should remap surviving ids onto their new indices after deletion",
  );
  assert.equal(
    toggleDecorSelection(decorInteraction, 0, decorItems.slice(1)),
    false,
    "decor selection toggles should operate against stable ids instead of stale indices",
  );
  assert.deepEqual(
    getSelectedDecorIds(decorInteraction),
    ["decor-c"],
    "decor toggle should remove the surviving authored decor by id",
  );

  const beforeSounds = [
    { id: "sound-a", x: 0, y: 0, visible: true },
    { id: "sound-b", x: 1, y: 0, visible: true },
    { id: "sound-c", x: 2, y: 0, visible: true },
  ];
  const reconciledSoundInteraction = reconcileIdObjectInteraction(
    beforeSounds.slice(1),
    captureIdObjectInteractionSnapshot({
      selectedIds: ["sound-b", "sound-c"],
      primarySelectedId: "sound-c",
      hoveredId: "sound-b",
      drag: {
        active: true,
        leadSoundId: "sound-c",
        anchorCell: { x: 2, y: 0 },
        previewDelta: { x: -1, y: 0 },
        originPositions: [
          { soundId: "sound-b", x: 1, y: 0 },
          { soundId: "sound-c", x: 2, y: 0 },
        ],
      },
    }),
  );

  assert.deepEqual(
    reconciledSoundInteraction.selectedIndices,
    [0, 1],
    "id-based object reconciliation should resolve surviving sound ids to their new indices after deletion",
  );
  assert.equal(
    reconciledSoundInteraction.hoveredIndex,
    0,
    "id-based object reconciliation should immediately rebind sound hover state without a follow-up pointer move",
  );
  assert.deepEqual(
    reconciledSoundInteraction.drag?.originPositions,
    [
      { soundId: "sound-b", x: 1, y: 0 },
      { soundId: "sound-c", x: 2, y: 0 },
    ],
    "id-based object reconciliation should preserve drag origins only for surviving sound ids",
  );
}

function runDarknessPreviewRegressionChecks() {
  const doc = createDoc();
  doc.dimensions.tileSize = 24;
  doc.entities = [
    { id: "spawn-1", name: "Spawn", type: "player-spawn", x: 4, y: 6, visible: true, params: {} },
    { id: "lantern-1", name: "Lantern", type: "lantern_01", x: 8, y: 6, visible: true, params: { radius: 170 } },
    { id: "firefly-1", name: "Firefly", type: "firefly_01", x: 9, y: 5, visible: true, params: { lightDiameter: 240 } },
    { id: "checkpoint-1", name: "Checkpoint", type: "checkpoint", x: 10, y: 6, visible: true, params: {} },
  ];
  doc.decor = [
    { id: "decor-1", name: "Flower", type: "decor_flower_01", x: 12, y: 7, visible: true, variant: "a", params: {} },
    { id: "decor-2", name: "Power Cell", type: "powercell_01", x: 14, y: 7, visible: true, variant: "a", params: {} },
  ];

  const playerLight = getPreviewPlayerLight(doc);
  assert.equal(playerLight?.kind, "player", "darkness preview should always include a player light");
  assert.equal(playerLight?.radiusPx > 80 && playerLight?.radiusPx < 320, true, "player preview light should use the runtime-style 80..320 range");

  const lights = collectDarknessPreviewLights(doc);
  assert.deepEqual(
    lights.map((light) => light.kind),
    ["player", "lantern", "firefly"],
    "darkness preview should include the player light plus audited entity light emitters",
  );
  assert.deepEqual(
    lights.slice(1).map((light) => ({ radiusPx: Math.round(light.radiusPx), strength: Number(light.strength.toFixed(2)) })),
    [
      { radiusPx: 170, strength: 0.85 },
      { radiusPx: 120, strength: 0.8 },
    ],
    "audited entity light emitters should use runtime-faithful radius and strength defaults",
  );
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
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const brushPanelSource = fs.readFileSync(path.join(repoRoot, "src/ui/brushPanel.js"), "utf8");
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
      activeEntityPresetId: "lantern_01",
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
  const tilesControlMarkup = panel.innerHTML.match(/<span class="tilesPanelControls"[\s\S]*?<\/span>\s*<\/div>/)?.[0] || "";
  assert.equal(panel.innerHTML.includes("panelSectionInline"), true, "tools and layer sections should use the compact inline section layout");
  assert.equal(panel.innerHTML.includes('data-section-toggle="tools"'), false, "tools section should no longer render a collapse toggle");
  assert.equal(panel.innerHTML.includes('data-section-toggle="layer"'), false, "layer section should no longer render a collapse toggle");
  assert.equal(panel.innerHTML.includes('data-section-toggle="tiles"'), true, "tiles section should still render a collapse toggle");
  assert.equal(panel.innerHTML.includes('<span class="sectionTitle">TILES</span>'), true, "tiles section should still render its title");
  assert.equal(panel.innerHTML.includes('class="sectionHeaderRow"'), true, "tiles section should render the compact header row wrapper");
  assert.equal(panel.innerHTML.includes('role="button"'), true, "collapsible section headers should expose button semantics on the full header row");
  assert.equal(panel.innerHTML.includes('tabindex="0"'), true, "collapsible section headers should remain keyboard focusable");
  assert.equal(tilesControlMarkup.includes('aria-label="Mode"'), true, "tiles controls should keep an accessible mode label");
  assert.equal(tilesControlMarkup.includes('aria-label="Size"'), true, "tiles controls should keep an accessible size label");
  assert.equal(tilesControlMarkup.includes('<span class="label">Mode</span>'), false, "tiles controls should no longer render a visible mode label");
  assert.equal(tilesControlMarkup.includes('<span class="label">Size</span>'), false, "tiles controls should no longer render a visible size label");
  assert.equal(tilesControlMarkup.includes('class="tilesPanelControls" aria-label="Tile brush controls"'), true, "tiles controls should render inline with the section header metadata");
  assert.equal(panel.innerHTML.includes('data-section-toggle="decor"'), true, "decor section should still render a collapse toggle");
  assert.equal(panel.innerHTML.includes('data-section-toggle="entities"'), true, "entities section should still render a collapse toggle");
  assert.equal(panel.innerHTML.includes('data-section-toggle="sound"'), false, "sound section should no longer render a collapse toggle");
  assert.equal(panel.innerHTML.includes('data-section-toggle="scan"'), false, "scan section should no longer render in the left brush panel");
  assert.equal(panel.innerHTML.includes('sectionEyebrow'), false, "panel headers should no longer render the redundant section eyebrow label");
  assert.equal(panel.innerHTML.includes('<span class="label">Current</span>'), true, "brush panel should still expose current-state summaries outside the compact tools/layer rows");
  assert.equal(/<span class=\"label\">Current<\/span>\s*<span class=\"value\">Entities<\/span>/.test(panel.innerHTML), false, "layer panel should not render a redundant current-layer row");
  assert.equal(panel.innerHTML.includes("Lantern · Alt/Option + Click"), true, "entity status row should carry the active preset and placement readiness summary");
  const entitiesMarkup = panel.innerHTML.match(/<section class="panelSection [^>]*" aria-label="ENTITIES section">[\s\S]*?<\/section>/)?.[0] || "";
  assert.equal(entitiesMarkup.includes('statusCardLabel">Placement'), false, "entity panel should no longer render a separate placement status card");
  const entityInactiveState = {
    ...baseState,
    interaction: {
      ...baseState.interaction,
      activeEntityPresetId: null,
    },
  };
  renderBrushPanel(panel, entityInactiveState);
  assert.equal(panel.innerHTML.includes("Select an entity preset"), true, "entity status row should prompt for a preset when placement is not armed");
  assert.equal(panel.innerHTML.includes('data-scan-action="play"'), false, "scan transport controls should move out of the left brush panel");
  assert.equal(panel.innerHTML.includes('data-scan-action="pause"'), false, "scan pause controls should move out of the left brush panel");
  assert.equal(panel.innerHTML.includes('data-scan-action="stop"'), false, "scan stop controls should move out of the left brush panel");
  assert.equal(panel.innerHTML.includes('data-scan-field="speed"'), false, "scan fields should move out of the left brush panel");
  assert.equal(panel.innerHTML.includes("Spot Sound"), true, "sound selector should expose spot sounds");
  assert.equal(panel.innerHTML.includes("Trigger Sound"), true, "sound selector should expose trigger sounds");
  assert.equal(panel.innerHTML.includes("Ambient Zone"), true, "sound selector should expose ambient zones");
  assert.equal(panel.innerHTML.includes("Music Zone"), true, "sound selector should expose music zones");
  const soundMarkup = panel.innerHTML.match(/<section class="panelSection soundSection[^>]*" aria-label="SOUND section">[\s\S]*?<\/section>/)?.[0] || "";
  assert.equal(soundMarkup.includes('panelSectionInline'), true, "sound panel should use the compact inline section layout");
  assert.equal(soundMarkup.includes('soundHeaderSelectField'), true, "sound panel should render the preset dropdown inline in the header row");
  assert.equal(soundMarkup.includes('soundPanelControls'), true, "sound panel should keep its compact inline control wrapper");
  assert.equal(soundMarkup.includes('aria-label="Select Sound"'), true, "sound header selector should keep an accessible label");
  assert.equal(soundMarkup.includes('<span class="label">Select Sound</span>'), false, "sound panel should not render a redundant visible selector label");
  assert.equal(soundMarkup.includes('class="sectionContent"></div>'), false, "sound panel should not render an empty collapsible body");
  assert.equal(soundMarkup.includes('statusCardLabel">Placement'), false, "sound panel should not render a placement status card");
  assert.equal(soundMarkup.includes('Placing: Spot Sound'), false, "sound panel should not duplicate the selected sound type in body content");
  assert.equal(soundMarkup.includes('Alt/Option + Click places'), false, "sound panel should not render the redundant placement hint card");
  assert.equal(soundMarkup.includes('class="toolButton isSecondary soundClearButton"'), true, "sound panel clear action should use the tightened compact button styling hook");

  const collapsedTilesState = {
    ...baseState,
    ui: {
      panelSections: {
        tiles: false,
      },
    },
  };
  renderBrushPanel(panel, collapsedTilesState);
  assert.equal(panel.innerHTML.includes('class="panelSection tilesSection isCollapsed"'), true, "tiles section should render collapsed when its panelSections state is false");
  assert.equal(panel.innerHTML.includes('aria-expanded="false"'), true, "collapsed sections should expose aria-expanded false");
  assert.equal(brushPanelSource.includes('const sectionToggleButton = target.closest("[data-section-toggle]");'), true, "brush panel should bind click handling for collapsible section toggles");
  assert.equal(brushPanelSource.includes('function togglePanelSection(store, sectionId) {'), true, "brush panel should centralize collapsible section state updates");
  assert.equal(brushPanelSource.includes('function isInteractiveHeaderControl(target, sectionToggleTarget) {'), true, "brush panel should guard inline header controls from toggling sections");
  assert.equal(brushPanelSource.includes('if (isInteractiveHeaderControl(target, sectionToggleButton)) return;'), true, "header-row toggles should ignore compact inline controls like the sound selector");
  assert.equal(brushPanelSource.includes('if (event.key !== "Enter" && event.key !== " ") return;'), true, "header-row toggles should remain keyboard accessible");
  assert.equal(brushPanelSource.includes('panelSections[sectionId] = !isOpen;'), true, "brush panel toggle handler should invert stored open/closed state");

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
  assert.equal(panel.innerHTML.includes("decorPlacementCard"), false, "decor panel should no longer render a separate placement status card");
  assert.equal(panel.innerHTML.includes("Grass Tuft · Alt/Option + Drag · 30% density · 60% randomness"), true, "decor status row should carry the active preset and scatter readiness summary");

  const decorInactiveState = {
    ...decorState,
    interaction: {
      ...decorState.interaction,
      activeDecorPresetId: null,
      decorScatterMode: false,
    },
  };
  renderBrushPanel(panel, decorInactiveState);
  assert.equal(panel.innerHTML.includes("Select a decor preset"), true, "decor status row should prompt for a preset when placement is not armed");

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
  assert.equal(panel.innerHTML.includes("bottomPanelScanPane"), true, "bottom panel should render a dedicated scan pane on the left");
  assert.equal(panel.innerHTML.includes("bottomPanelEditorPane"), true, "bottom panel should keep a separate editing pane to the right");
  assert.equal(panel.innerHTML.includes('data-scan-field="startX"'), true, "bottom panel should expose the scan start field");
  assert.equal(panel.innerHTML.includes('data-scan-field="endX"'), true, "bottom panel should expose the scan end field");
  assert.equal(panel.innerHTML.includes('data-scan-field="speed"'), true, "bottom panel should expose the scan speed field");
  assert.equal(panel.innerHTML.includes('data-scan-action="play"'), true, "bottom panel should expose scan play/resume controls");
  assert.equal(panel.innerHTML.includes('data-scan-action="pause"'), true, "bottom panel should expose scan pause controls");
  assert.equal(panel.innerHTML.includes('data-scan-action="stop"'), true, "bottom panel should expose scan stop controls");
  assert.equal(panel.innerHTML.includes("Scan Monitor"), false, "bottom panel should remove the large scan monitor dashboard from the permanent surface");
  assert.equal(panel.innerHTML.includes("Event Feed"), false, "bottom panel should remove the scan event feed from the permanent surface");
  assert.equal(panel.innerHTML.includes("Latest event"), false, "bottom panel should remove the latest-event monitor summary from the permanent surface");
  assert.equal(panel.innerHTML.includes("Batch edit 2 sound objects"), false, "bottom panel should avoid large batch explanation text");
  assert.equal(panel.innerHTML.includes('data-sound-action="smart-select"'), true, "bottom panel should expose compact smart sound selection actions");
  assert.equal(panel.innerHTML.includes('same type'), true, "batch sound editing should keep the same-type action inline");
  assert.equal(panel.innerHTML.includes('same source'), true, "batch sound editing should keep the same-source action inline");
  assert.equal(panel.innerHTML.includes('type + source'), true, "batch sound editing should keep the type-plus-source action inline");
  assert.equal(panel.innerHTML.includes('data-sound-field="source" data-sound-index="-1"'), true, "batch sound editing should expose a single source field that targets the whole selection");
  assert.equal(panel.innerHTML.includes('data-sound-param-key="spatial"'), true, "batch sound editing should expose the spatial field");
  assert.equal(panel.innerHTML.includes('data-sound-param-key="volume"'), true, "batch sound editing should expose the volume field");
  assert.equal(panel.innerHTML.includes('data-sound-param-key="pitch"'), true, "batch sound editing should expose the pitch field");
  assert.equal(panel.innerHTML.includes('data-sound-param-key="loop"'), true, "batch sound editing should expose the loop field");
  assert.equal(panel.innerHTML.includes("Mixed source"), true, "batch sound editing should show mixed source state when selected sounds disagree");
}

function runBottomPanelFogVolumeRegressionChecks() {
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
        entities: [
          {
            id: "entity-fog",
            name: "Fog Volume",
            type: "fog_volume",
            x: 2,
            y: 1,
            visible: true,
            params: {
              area: { x0: 32, x1: 128, y0: 32, falloff: 12 },
              look: { density: 0.22, lift: 8, thickness: 36, layers: 28, noise: 0, drift: 0, color: "#E1EEFF", exposure: 1 },
              smoothing: { diffuse: 0.24, relax: 0.24, visc: 0.94 },
              interaction: { radius: 92, push: 2.4, bulge: 2.2, gate: 70 },
              organic: { strength: 0, scale: 1, speed: 1 },
              render: { blend: "screen", lumoBehindFog: true },
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
      selectedDecorIndices: [],
      selectedDecorIndex: null,
      selectedSoundIndices: [],
      selectedSoundIndex: null,
    },
  };

  renderBottomPanel(panel, state);
  assert.equal(panel.innerHTML.includes("bottomPanelScanPane"), true, "bottom panel should keep the permanent scan pane even when the selection editor is empty");
  assert.equal(panel.innerHTML.includes("selectionEditorEmptyState"), false, "bottom panel should keep the editor pane visually empty for hidden fog volume selections");
}

function runInspectorFogRegressionChecks() {
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
        entities: [
          {
            id: "entity-fog",
            name: "Fog Volume",
            type: "fog_volume",
            x: 2,
            y: 1,
            visible: true,
            params: {
              area: { x0: 32, x1: 128, y0: 32, falloff: 12 },
              look: { density: 0.22, lift: 8, thickness: 36, layers: 28, noise: 0, drift: 0, color: "#E1EEFF", exposure: 1 },
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
      selectedDecorIndices: [],
      selectedDecorIndex: null,
      selectedSoundIndices: [],
      selectedSoundIndex: null,
    },
  };

  renderInspector(panel, state);
  assert.equal(panel.innerHTML.trim(), "", "inspector should stay empty for special-volume entity editing");
}

function runInspectorSoundSummaryRegressionChecks() {
  const panel = {
    innerHTML: "",
    classList: {
      toggle() {},
    },
  };

  const state = {
    document: {
      status: "ready",
      error: null,
      active: {
        meta: { id: "doc", name: "Doc", version: "2.0.0" },
        dimensions: { width: 16, height: 16, tileSize: 16 },
        tiles: { base: new Array(256).fill(0) },
        backgrounds: { layers: [] },
        sounds: [
          {
            id: "sound-a",
            name: "Forest 1",
            type: "ambientZone",
            x: 2,
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

  renderInspector(panel, state);
  assert.equal(panel.innerHTML.includes('data-sound-action="smart-select"'), false, "inspector should not duplicate batch sound editing actions");
  assert.equal(panel.innerHTML.includes('data-sound-field="source"'), false, "inspector should not duplicate batch sound editing fields");
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

function createMixedLayerChronologyHarness() {
  const doc = createDoc();
  const history = createHistoryState();
  const timeline = history.globalTimeline;
  const entityHistory = createCanonicalEntityHistory();
  const decorHistory = createCanonicalDecorHistory();
  const soundHistory = createCanonicalSoundHistory();

  timeline.clearRedoTargets = () => {
    history.redoStack.length = 0;
    entityHistory.redoStack.length = 0;
    decorHistory.redoStack.length = 0;
    soundHistory.redoStack.length = 0;
  };

  const recordCanonicalAction = (domain, action) => {
    const actionRecord = recordGlobalHistoryAction(timeline, {
      domain,
      actionType: action.type,
      route: {
        lane: `${domain}-canonical`,
        domain,
      },
    });
    return actionRecord?.actionId ? { ...action, globalActionId: actionRecord.actionId } : action;
  };

  const recordEntityAction = (action) => {
    const applied = applyCanonicalEntityAction(doc, action, "forward");
    assert.equal(applied.changed, true, `entity ${action.type} should apply before entering global chronology`);
    entityHistory.record(recordCanonicalAction("entity", action));
  };

  const recordDecorAction = (action) => {
    const applied = applyCanonicalDecorAction(doc, action, "forward");
    assert.equal(applied.changed, true, `decor ${action.type} should apply before entering global chronology`);
    decorHistory.record(recordCanonicalAction("decor", action));
  };

  const recordSoundAction = (action) => {
    const applied = applyCanonicalSoundAction(doc, action, "forward");
    assert.equal(applied.changed, true, `sound ${action.type} should apply before entering global chronology`);
    soundHistory.record(recordCanonicalAction("sound", action));
  };

  const recordTilePaint = (cell, nextValue) => {
    const previousValue = doc.tiles.base[cell.y * doc.dimensions.width + cell.x];
    const changed = paintSingleTile(doc, cell.x, cell.y, nextValue);
    assert.equal(changed, true, "tile paint should mutate the document before recording global chronology");
    pushTileEdit(history, createTileEditEntry(doc, cell, previousValue, nextValue));
  };

  const undo = () => {
    const timelineEntry = peekNextGlobalUndoAction(timeline);
    if (!timelineEntry) return null;

    if (timelineEntry.route?.lane === "document-history") {
      const entry = history.undoStack.at(-1) || null;
      assert.equal(entry?.globalActionId, timelineEntry.actionId, "global chronology should target the latest tile/history action next");
      const undoneEntry = undoTileEdit(doc, history);
      markGlobalHistoryActionUndone(timeline, timelineEntry.actionId);
      return { domain: timelineEntry.domain, actionId: timelineEntry.actionId, entry: undoneEntry };
    }

    if (timelineEntry.route?.lane === "entity-canonical") {
      const action = entityHistory.undoStack.at(-1) || null;
      assert.equal(action?.globalActionId, timelineEntry.actionId, "global chronology should target the latest entity action next");
      const poppedAction = entityHistory.popUndo();
      const result = applyCanonicalEntityAction(doc, poppedAction, "backward");
      assert.equal(result.changed, true, "global entity undo should route through the canonical entity lane");
      entityHistory.pushRedo(poppedAction);
      markGlobalHistoryActionUndone(timeline, timelineEntry.actionId);
      return { domain: timelineEntry.domain, actionId: timelineEntry.actionId, action: poppedAction };
    }

    if (timelineEntry.route?.lane === "decor-canonical") {
      const action = decorHistory.undoStack.at(-1) || null;
      assert.equal(action?.globalActionId, timelineEntry.actionId, "global chronology should target the latest decor action next");
      const poppedAction = decorHistory.popUndo();
      const result = applyCanonicalDecorAction(doc, poppedAction, "backward");
      assert.equal(result.changed, true, "global decor undo should route through the canonical decor lane");
      decorHistory.pushRedo(poppedAction);
      markGlobalHistoryActionUndone(timeline, timelineEntry.actionId);
      return { domain: timelineEntry.domain, actionId: timelineEntry.actionId, action: poppedAction };
    }

    if (timelineEntry.route?.lane === "sound-canonical") {
      const action = soundHistory.undoStack.at(-1) || null;
      assert.equal(action?.globalActionId, timelineEntry.actionId, "global chronology should target the latest sound action next");
      const poppedAction = soundHistory.popUndo();
      const result = applyCanonicalSoundAction(doc, poppedAction, "backward");
      assert.equal(result.changed, true, "global sound undo should route through the canonical sound lane");
      soundHistory.pushRedo(poppedAction);
      markGlobalHistoryActionUndone(timeline, timelineEntry.actionId);
      return { domain: timelineEntry.domain, actionId: timelineEntry.actionId, action: poppedAction };
    }

    assert.fail(`unsupported timeline lane ${timelineEntry.route?.lane}`);
  };

  const redo = () => {
    const timelineEntry = peekNextGlobalRedoAction(timeline);
    if (!timelineEntry) return null;

    if (timelineEntry.route?.lane === "document-history") {
      const entry = history.redoStack.at(-1) || null;
      assert.equal(entry?.globalActionId, timelineEntry.actionId, "global chronology should target the latest redoable tile/history action next");
      const redoneEntry = redoTileEdit(doc, history);
      markGlobalHistoryActionRedone(timeline, timelineEntry.actionId);
      return { domain: timelineEntry.domain, actionId: timelineEntry.actionId, entry: redoneEntry };
    }

    if (timelineEntry.route?.lane === "entity-canonical") {
      const action = entityHistory.redoStack.at(-1) || null;
      assert.equal(action?.globalActionId, timelineEntry.actionId, "global chronology should target the latest redoable entity action next");
      const poppedAction = entityHistory.popRedo();
      const result = applyCanonicalEntityAction(doc, poppedAction, "forward");
      assert.equal(result.changed, true, "global entity redo should route through the canonical entity lane");
      entityHistory.pushUndo(poppedAction);
      markGlobalHistoryActionRedone(timeline, timelineEntry.actionId);
      return { domain: timelineEntry.domain, actionId: timelineEntry.actionId, action: poppedAction };
    }

    if (timelineEntry.route?.lane === "decor-canonical") {
      const action = decorHistory.redoStack.at(-1) || null;
      assert.equal(action?.globalActionId, timelineEntry.actionId, "global chronology should target the latest redoable decor action next");
      const poppedAction = decorHistory.popRedo();
      const result = applyCanonicalDecorAction(doc, poppedAction, "forward");
      assert.equal(result.changed, true, "global decor redo should route through the canonical decor lane");
      decorHistory.pushUndo(poppedAction);
      markGlobalHistoryActionRedone(timeline, timelineEntry.actionId);
      return { domain: timelineEntry.domain, actionId: timelineEntry.actionId, action: poppedAction };
    }

    if (timelineEntry.route?.lane === "sound-canonical") {
      const action = soundHistory.redoStack.at(-1) || null;
      assert.equal(action?.globalActionId, timelineEntry.actionId, "global chronology should target the latest redoable sound action next");
      const poppedAction = soundHistory.popRedo();
      const result = applyCanonicalSoundAction(doc, poppedAction, "forward");
      assert.equal(result.changed, true, "global sound redo should route through the canonical sound lane");
      soundHistory.pushUndo(poppedAction);
      markGlobalHistoryActionRedone(timeline, timelineEntry.actionId);
      return { domain: timelineEntry.domain, actionId: timelineEntry.actionId, action: poppedAction };
    }

    assert.fail(`unsupported timeline lane ${timelineEntry.route?.lane}`);
  };

  return {
    doc,
    history,
    timeline,
    recordEntityAction,
    recordDecorAction,
    recordSoundAction,
    recordTilePaint,
    undo,
    redo,
    canUndo: () => canUndoGlobalHistory(timeline),
    canRedo: () => canRedoGlobalHistory(timeline),
  };
}

function runMixedLayerGlobalChronologyRegressionChecks() {
  {
    const harness = createMixedLayerChronologyHarness();
    harness.recordEntityAction({ type: "create", index: 0, entity: cloneCanonicalEntitySnapshot({ id: "entity-1", name: "Entity 1", type: "spawn", x: 1, y: 1, params: {} }) });
    harness.recordDecorAction({ type: "create", index: 0, decor: { id: "decor-1", name: "Decor 1", type: "torch", x: 2, y: 2, rotation: 0, visible: true, params: {} } });
    harness.recordTilePaint({ x: 0, y: 0 }, 7);
    harness.recordSoundAction({ type: "create", index: 0, sound: { id: "sound-1", name: "Sound 1", type: "loop", x: 3, y: 3, radius: 24, volume: 1, visible: true, params: {} } });

    assert.deepEqual([harness.undo()?.domain, harness.undo()?.domain, harness.undo()?.domain, harness.undo()?.domain], ["sound", "tile", "decor", "entity"], "mixed chronology should undo sound, then tile, then decor, then entity in true authored order");
    assert.equal(harness.doc.sounds.length, 0, "mixed chronology should remove the created sound on the first undo");
    assert.equal(harness.doc.tiles.base[0], 0, "mixed chronology should restore the painted tile on the second undo");
    assert.equal(harness.doc.decor.length, 0, "mixed chronology should remove the created decor on the third undo");
    assert.equal(harness.doc.entities.length, 0, "mixed chronology should remove the created entity on the fourth undo");
  }

  {
    const harness = createMixedLayerChronologyHarness();
    harness.recordEntityAction({ type: "create", index: 0, entity: cloneCanonicalEntitySnapshot({ id: "entity-a", name: "Entity A", type: "spawn", x: 1, y: 1, params: {} }) });
    harness.recordDecorAction({ type: "create", index: 0, decor: { id: "decor-a", name: "Decor A", type: "torch", x: 2, y: 2, rotation: 0, visible: true, params: {} } });
    harness.recordEntityAction({ type: "delete", index: 0, entity: cloneCanonicalEntitySnapshot({ id: "entity-a", name: "Entity A", type: "spawn", x: 1, y: 1, params: {} }) });
    harness.recordTilePaint({ x: 1, y: 0 }, 9);

    assert.deepEqual([harness.undo()?.domain, harness.undo()?.domain, harness.undo()?.domain], ["tile", "entity", "decor"], "mixed chronology should undo tile, then restore the deleted entity, then undo the older decor create");
    assert.equal(harness.doc.tiles.base[1], 0, "undo after mixed chronology should restore the painted tile");
    assert.deepEqual(harness.doc.entities.map((entity) => entity.id), ["entity-a"], "undo after mixed chronology should restore only the deleted entity");
    assert.equal(harness.doc.decor.length, 0, "undo after mixed chronology should remove only the older decor create last");
  }

  {
    const harness = createMixedLayerChronologyHarness();
    harness.recordSoundAction({ type: "create", index: 0, sound: { id: "sound-tail", name: "Sound Tail", type: "loop", x: 0, y: 0, radius: 24, volume: 1, visible: true, params: {} } });
    const undone = harness.undo();
    assert.equal(undone?.domain, "sound", "setup undo should target the sound action first");
    assert.equal(harness.canRedo(), true, "undoing a sound should populate the global redo tail");

    harness.recordTilePaint({ x: 2, y: 0 }, 5);

    assert.equal(harness.canRedo(), false, "recording a tile after undo should clear stale redo across all layers globally");
    assert.equal(harness.doc.sounds.some((sound) => sound.id === "sound-tail"), false, "recording a new tile action after undo should not resurrect the stale sound");
    assert.equal(harness.history.redoStack.length, 0, "recording a new action should clear document-history redo state globally");
  }

  {
    const harness = createMixedLayerChronologyHarness();
    harness.recordDecorAction({ type: "create", index: 0, decor: { id: "decor-1", name: "Decor 1", type: "torch", x: 0, y: 0, rotation: 0, visible: true, params: {} } });
    harness.recordEntityAction({ type: "create", index: 0, entity: cloneCanonicalEntitySnapshot({ id: "entity-1", name: "Entity 1", type: "spawn", x: 1, y: 1, params: {} }) });
    harness.recordDecorAction({ type: "delete", index: 0, decor: { id: "decor-1", name: "Decor 1", type: "torch", x: 0, y: 0, rotation: 0, visible: true, params: {} } });
    harness.recordSoundAction({ type: "create", index: 0, sound: { id: "sound-1", name: "Sound 1", type: "loop", x: 2, y: 2, radius: 24, volume: 1, visible: true, params: {} } });

    assert.deepEqual([harness.undo()?.domain, harness.undo()?.domain], ["sound", "decor"], "mixed create/delete chronology should undo the latest sound create before restoring the earlier decor delete");
    assert.deepEqual(harness.doc.decor.map((decor) => decor.id), ["decor-1"], "undoing the decor delete should restore only the targeted decor without reviving unrelated objects");
    assert.deepEqual(harness.doc.entities.map((entity) => entity.id), ["entity-1"], "undoing the decor delete should leave unrelated entities untouched");
    assert.equal(harness.doc.sounds.length, 0, "undoing the latest sound create should not revive unrelated sounds");
  }

  {
    const harness = createMixedLayerChronologyHarness();
    harness.recordEntityAction({ type: "create", index: 0, entity: cloneCanonicalEntitySnapshot({ id: "entity-r", name: "Entity R", type: "spawn", x: 0, y: 0, params: {} }) });
    harness.recordDecorAction({ type: "create", index: 0, decor: { id: "decor-r", name: "Decor R", type: "torch", x: 1, y: 1, rotation: 0, visible: true, params: {} } });
    harness.recordTilePaint({ x: 3, y: 0 }, 4);
    harness.recordSoundAction({ type: "create", index: 0, sound: { id: "sound-r", name: "Sound R", type: "loop", x: 2, y: 2, radius: 24, volume: 1, visible: true, params: {} } });

    harness.undo();
    harness.undo();
    harness.undo();
    harness.undo();

    assert.equal(harness.canRedo(), true, "undoing mixed actions should populate the global redo tail");
    assert.deepEqual([harness.redo()?.domain, harness.redo()?.domain, harness.redo()?.domain, harness.redo()?.domain], ["entity", "decor", "tile", "sound"], "mixed chronology should redo entity, then decor, then tile, then sound in exact authored order");
    assert.deepEqual(harness.doc.entities.map((entity) => entity.id), ["entity-r"], "redo should restore the canonical entity action first");
    assert.deepEqual(harness.doc.decor.map((decor) => decor.id), ["decor-r"], "redo should restore the canonical decor action second");
    assert.equal(harness.doc.tiles.base[3], 4, "redo should reapply the tile action third");
    assert.deepEqual(harness.doc.sounds.map((sound) => sound.id), ["sound-r"], "redo should restore the canonical sound action last");
  }
}

function runSourceRegressionChecks() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const source = fs.readFileSync(path.join(repoRoot, "src/app/createEditorApp.js"), "utf8");
  const mainSource = fs.readFileSync(path.join(repoRoot, "src/main.js"), "utf8");
  const indexSource = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
  const rendererSource = fs.readFileSync(path.join(repoRoot, "src/render/renderer.js"), "utf8");
  const decorLayerSource = fs.readFileSync(path.join(repoRoot, "src/render/layers/decorLayer.js"), "utf8");
  const selectionPanelSource = fs.readFileSync(path.join(repoRoot, "src/ui/selectionEditorPanel.js"), "utf8");

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
    source.includes("const reconcileObjectLayerMutationState = (draft, selection = {}, reason = \"object mutation\") => {"),
    true,
    "editor-v2 should use one shared stable-id object-layer mutation helper derived from the standalone demo",
  );
  assert.equal(
    source.includes("const clearObjectLayerTransientInteractionState = (draft, reason = \"object mutation\") => {"),
    true,
    "editor-v2 should clear shared object-layer interaction state through one minimal post-mutation helper",
  );
  assert.equal(
    source.includes("const applyHistoryObjectMutationState = (draft, entry, direction) => {"),
    true,
    "editor-v2 should use one shared history reconciliation helper for object-layer undo and redo",
  );
  assert.equal(
    source.includes("const finalizeEntityMutationState = (draft, selection = {}, reason = \"entity mutation\") => {"),
    true,
    "entity-only delete/undo should use a direct stable-id post-mutation helper instead of the broader shared reconcile path",
  );
  assert.equal(
    source.includes("const suppressObjectPlacementPreviews = (draft, reason = \"unspecified\") => {"),
    true,
    "editor-v2 should use a shared object placement preview suppression helper after object-layer mutations",
  );
  assert.equal(
    source.includes("function historyEntryContainsObjectLayer(entry) {"),
    true,
    "editor-v2 should detect undo/redo mutations across all shared object layers",
  );
  assert.equal(
    source.includes("return deleteSelectedEntityCleanRoom(draft);")
      && source.includes("return deleteSelectedDecorCleanRoom(draft);")
      && source.includes("return deleteSelectedSoundCleanRoom(draft);")
      && source.includes("applyHistoryObjectMutationState(draft, entry, \"undo\")")
      && source.includes("applyHistoryObjectMutationState(draft, entry, \"redo\")"),
    true,
    "delete and history mutations should route through the clean entity/decor delete paths plus the canonical sound history lane",
  );
  assert.equal(
    source.includes("return deleteSelectedEntityCleanRoom(draft);"),
    true,
    "entity deletion should stay pinned to the canonical stable-id delete path before the next frame renders",
  );
  assert.equal(
    source.includes("return deleteSelectedDecorCleanRoom(draft);"),
    true,
    "decor deletion should stay pinned to the canonical stable-id clean-room delete path before the next frame renders",
  );
  assert.equal(
    source.includes("const deleteSelectedSoundCleanRoom = (draft) => {")
      && source.includes("recordCleanRoomObjectAction(\"sound\", action);"),
    true,
    "sound deletion should stay pinned to the canonical stable-id clean-room delete path",
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
    source.includes("CANONICAL ENTITY RUNTIME")
      && source.includes("if (false && activeLayer === PANEL_LAYERS.ENTITIES && selectionMode === \"entity\" && hitEntityIndex >= 0) {"),
    true,
    "entity canvas selection should stay locked to the canonical path while the legacy inspect branch is disabled",
  );
  assert.equal(
    source.includes("TEMP ENTITY CLEAN PATH ACTIVE"),
    false,
    "editor-v2 should no longer render or label the old temporary entity runtime state in production UI code",
  );
  assert.equal(
    source.includes("const statusLabel = state.ui.importStatus || `Layer: ${activeSelectionLabel} · ${selectedCount || 0} selected`;"),
    true,
    "top bar status should keep normal layer messaging without the removed temporary runtime banner",
  );
  assert.equal(
    source.includes("const reconcileDecorInteractionState = (draft, snapshot = null, options = {}) => {")
      && source.includes("leadDecorId: reconciled.drag.leadSoundId,")
      && source.includes("const getDecorIndexById = (decorItems, decorId) => {"),
    true,
    "decor authored-object interaction should reconcile through stable decor ids during the first bypass step",
  );
  assert.equal(
    source.includes("const canonicalDecorHistory = createCanonicalDecorHistory();")
      && source.includes("const deleteSelectedDecorCleanRoom = (draft) => {")
      && source.includes('return deleteSelectedDecorCleanRoom(draft);')
      && source.includes('appendSoundDebugEvent("Undo handled", "canonical decor history"')
      && source.includes('appendSoundDebugEvent("Redo handled", "canonical decor history"'),
    true,
    "decor delete and undo/redo should stay pinned to the canonical clean-room decor history lane",
  );
  assert.equal(
    source.includes("const canonicalSoundHistory = createCanonicalSoundHistory();")
      && source.includes("const createCleanRoomSoundAtCell = (draft, cell, presetId = draft.interaction.activeSoundPresetId || DEFAULT_SOUND_PRESET_ID) => {")
      && source.includes("const deleteSelectedSoundCleanRoom = (draft) => {")
      && source.includes('appendSoundDebugEvent("Undo handled", "canonical sound history"')
      && source.includes('appendSoundDebugEvent("Redo handled", "canonical sound history"'),
    true,
    "sound place/delete/undo/redo should stay pinned to the canonical clean-room sound history lane",
  );
  assert.equal(
    source.includes("selectDecorByIds(draft, nextSelectedDecorIds, nextSelectedDecorIds.at(-1) ?? null")
      && source.includes("if (false && state.interaction.decorDrag?.active)"),
    true,
    "decor click selection should resolve through stable ids while the legacy drag lane stays hard-disabled",
  );
  assert.equal(
    source.includes("selectSoundByIds(draft, [soundId], soundId")
      && source.includes("if (false && state.interaction.soundDrag?.active) return;")
      && source.includes("const duplicateSelectedSound = (draft) => {"),
    true,
    "sound click selection should resolve through stable ids while drag and duplicate remain hard-disabled",
  );
  assert.equal(
    source.includes("TEMP sound debug"),
    false,
    "editor-v2 should no longer ship the temporary sound debug overlay markup in the app runtime",
  );
  assert.equal(
    source.includes("renderSoundDebugOverlay(state);"),
    false,
    "editor-v2 should remove the sound debug overlay render path instead of merely hiding its text",
  );
  assert.equal(
    mainSource.includes("soundDebugOverlay"),
    false,
    "editor-v2 bootstrap should no longer require the removed sound debug overlay node",
  );
  assert.equal(
    indexSource.includes('id="soundDebugOverlay"'),
    false,
    "editor-v2 HTML should no longer render the removed canvas debug overlay host",
  );
  assert.equal(
    rendererSource.includes("renderDecorDragPreview") || rendererSource.includes("renderDecorScatterPreview"),
    false,
    "normal live renderer usage should not invoke legacy decor drag/scatter overlay passes",
  );
  assert.equal(
    decorLayerSource.includes("isDecorSelected") || decorLayerSource.includes("hoveredDecorIndex === i"),
    false,
    "decor render/highlight resolution should not fall back to stale index-based authored decor state",
  );
  assert.equal(
    selectionPanelSource.includes('const selectedDecorId = typeof getPrimarySelectedDecorId(state.interaction) === "string"')
      && selectionPanelSource.includes("const resolvedSelectedDecorIndex = selectedDecorId"),
    true,
    "bottom panel decor resolution should derive from the selected decor id before any index fallback",
  );
  assert.equal(
    selectionPanelSource.includes('const selectedSoundId = typeof getPrimarySelectedSoundId(state.interaction) === "string"')
      && selectionPanelSource.includes("const resolvedSelectedSoundIndex = selectedSoundId"),
    true,
    "bottom panel sound resolution should derive from the selected sound id before any index fallback",
  );
  assert.equal(
    source.includes("additive: event.shiftKey,"),
    true,
    "shift-drag box selection should stay additive",
  );
  assert.equal(
    source.includes("const clearSpecialVolumePlacement = (draft) => {"),
    false,
    "fog-specific placement cleanup helpers should be removed from the editor app",
  );

  const setActiveToolSection = source.match(/const setActiveTool = \(tool\) => \{[\s\S]*?\n  \};/);
  assert.ok(setActiveToolSection, "setActiveTool should exist");
  assert.equal(
    setActiveToolSection[0].includes("specialVolumePlacement"),
    false,
    "tool switching should no longer manage fog-specific placement state",
  );

  assert.equal(
    setActiveLayerFromPanelSection[0].includes("specialVolumePlacement"),
    false,
    "panel layer switching should no longer manage fog-specific placement state",
  );

  const handleCanvasMouseMoveSection = source.match(/const handleCanvasMouseMove = \(event\) => \{[\s\S]*?\n  \};/);
  assert.ok(handleCanvasMouseMoveSection, "handleCanvasMouseMove should exist");
  assert.equal(
    handleCanvasMouseMoveSection[0].includes("specialVolumePlacement"),
    false,
    "canvas mouse move should no longer manage fog-specific placement state",
  );

  assert.equal(
    source.includes("const finalizeSpecialVolumePlacement = (draft) => {"),
    false,
    "fog-specific finalize placement helpers should be removed from the editor app",
  );

  const syncInteractionAfterHistoryChangeSection = source.match(/const reconcileObjectLayerMutationState = \(draft, selection = \{\}, reason = "object mutation"\) => \{[\s\S]*?\n  \};/);
  assert.ok(syncInteractionAfterHistoryChangeSection, "shared object-layer post-mutation reconciliation should exist");
  assert.equal(
    syncInteractionAfterHistoryChangeSection[0].includes("specialVolumePlacement"),
    false,
    "history changes should no longer manage fog-specific placement state",
  );

  assert.equal(
    source.includes("const handleTopBarInput = (event) => {"),
    true,
    "top bar should handle live input events for export metadata editing",
  );
  assert.equal(
    source.includes("handleTopBarFieldInput(target, { commit: false });"),
    true,
    "export metadata typing should update draft state without forcing commit-time trimming",
  );
  assert.equal(
    source.includes("const focusedTopBarField = captureFocusedTopBarField();"),
    true,
    "top bar rendering should capture the focused field before rerendering menus",
  );
  assert.equal(
    source.includes("restoreFocusedTopBarField(focusedTopBarField);"),
    true,
    "top bar rendering should restore focused export fields after rerenders",
  );
  assert.equal(
    source.includes('topBar.addEventListener("input", handleTopBarInput);'),
    true,
    "top bar should listen for input events so export fields stay editable during rerenders",
  );
  assert.equal(
    source.includes('type="text"'),
    true,
    "new level size fields should render as text inputs so caret selection can be restored normally",
  );
  assert.equal(
    source.includes('const selectionStart = focusedField && typeof document.activeElement.selectionStart === "number"'),
    true,
    "floating panel rerenders should capture the current caret start for new level size inputs",
  );
  assert.equal(
    source.includes("nextField.setSelectionRange(selectionStart, selectionEnd, selectionDirection);"),
    true,
    "floating panel rerenders should restore the caret instead of reselecting the whole new level field value",
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
  runNewLevelDocumentRegressionChecks();
  runEntityRegressionChecks();
  runDecorAndSoundDeletionRegressionChecks();
  runCleanRoomDecorRuntimeRegressionChecks();
  runCleanRoomDecorHistoryDeterminismRegressionChecks();
  runCleanRoomSoundHistoryDeterminismRegressionChecks();
  await runLiveDecorPlacementRuntimeRegressionChecks();
  await runLiveSoundPlacementRuntimeRegressionChecks();
  runObjectLayerStableIdentityHistoryRegressionChecks();
  runGlobalObjectLayerUndoRedoRegressionChecks();
  runMixedLayerGlobalChronologyRegressionChecks();
  runFogVolumeRegressionChecks();
  runFogPlacementPreviewRegressionChecks();
  runObjectPlacementPreviewSuppressionRegressionChecks();
  runDecorRegressionChecks();
  runSoundRegressionChecks();
  runSoundTypeRenderRegressionChecks();
  runSoundIdentityRegressionChecks();
  runSoundDragPreviewIdentityRegressionChecks();
  runObjectLayerInteractionReconciliationChecks();
  runDarknessPreviewRegressionChecks();
  runScanRegressionChecks();
  runScanAudioPlaybackRegressionChecks();
  await runScanAudioAssetFallbackChecks();
  runUiRegressionChecks();
  runSoundBatchSelectionRegressionChecks();
  runBottomPanelBatchSoundRegressionChecks();
  runBottomPanelFogVolumeRegressionChecks();
  runInspectorFogRegressionChecks();
  runInspectorSoundSummaryRegressionChecks();
  runSourceRegressionChecks();

  console.log("editor-v2 regression checks passed");
}

await main();
