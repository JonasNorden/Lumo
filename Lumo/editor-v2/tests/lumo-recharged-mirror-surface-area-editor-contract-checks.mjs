import assert from "node:assert/strict";

import { createNewLevelDocument } from "../src/data/createNewLevelDocument.js";
import { serializeLevelDocument } from "../src/data/exportLevelDocument.js";
import {
  createMirrorSurfaceAreaFromDrag,
  deleteMirrorSurfaceAreaById,
  moveMirrorSurfaceArea,
  resizeMirrorSurfaceArea,
  updateMirrorSurfaceAreaField,
} from "../src/domain/worldAreas.js";
import {
  createMirrorSurfaceAreaEditEntry,
  pushHistoryEntry,
  redoTileEdit,
  undoTileEdit,
} from "../src/domain/tiles/history.js";
import { createEditorState } from "../src/state/createEditorState.js";

const doc = createNewLevelDocument({ width: 12, height: 8, themeId: "forest" });
assert.deepEqual(doc.mirrorSurfaceAreas, [], "new levels start with an empty mirrorSurfaceAreas array");

const createdArea = createMirrorSurfaceAreaFromDrag(doc, { x: 2, y: 4 }, { x: 5, y: 4 });
assert.equal(createdArea.x, 48, "drag creation stores world-pixel x on tile boundary");
assert.equal(createdArea.y, 96, "drag creation stores world-pixel y on tile boundary");
assert.equal(createdArea.width, 96, "drag creation stores rectangle width from tile span");
assert.equal(createdArea.height, 24, "single-row drag keeps one tile row of height");
assert.equal(createdArea.enabled, true, "created mirror areas default enabled");
assert.equal(createdArea.visible, true, "created mirror areas default visible");

doc.mirrorSurfaceAreas.push(createdArea);
const movedArea = moveMirrorSurfaceArea(createdArea, 24, -24);
assert.equal(movedArea.x, 72, "moving adjusts x");
assert.equal(movedArea.y, 72, "moving adjusts y");
const resizedArea = resizeMirrorSurfaceArea(movedArea, 144, 48);
assert.equal(resizedArea.width, 144, "resizing adjusts width");
assert.equal(resizedArea.height, 48, "resizing adjusts height");
const editedArea = updateMirrorSurfaceAreaField(resizedArea, "yOffset", 6);
assert.equal(editedArea.yOffset, 6, "editing yOffset stores a finite value");
const hiddenArea = updateMirrorSurfaceAreaField(editedArea, "visible", false);
assert.equal(hiddenArea.visible, false, "editing visible supports disabling overlay/runtime visibility");

const state = createEditorState();
state.document.active = doc;
state.history.undoStack = [];
state.history.redoStack = [];
const previousArea = doc.mirrorSurfaceAreas[0];
doc.mirrorSurfaceAreas[0] = hiddenArea;
pushHistoryEntry(state.history, createMirrorSurfaceAreaEditEntry("update", {
  objectId: hiddenArea.id,
  index: 0,
  previousSnapshot: previousArea,
  nextSnapshot: hiddenArea,
}));
undoTileEdit(doc, state.history);
assert.deepEqual(doc.mirrorSurfaceAreas[0], previousArea, "history undo restores previous mirror area values");
redoTileEdit(doc, state.history);
assert.deepEqual(doc.mirrorSurfaceAreas[0], hiddenArea, "history redo restores edited mirror area values");

const deletedAreas = deleteMirrorSurfaceAreaById(doc.mirrorSurfaceAreas, hiddenArea.id);
assert.deepEqual(deletedAreas, [], "deleting by id removes the selected mirror area");

const exported = JSON.parse(serializeLevelDocument(doc));
assert.deepEqual(exported.mirrorSurfaceAreas, [hiddenArea], "export preserves authored mirrorSurfaceAreas exactly");

const emptyDoc = createNewLevelDocument({ width: 4, height: 4, themeId: "forest" });
const emptyExport = JSON.parse(serializeLevelDocument(emptyDoc));
assert.deepEqual(emptyExport.mirrorSurfaceAreas, [], "export keeps empty mirrorSurfaceAreas empty with no fallback data");

console.log("mirror surface area editor contracts passed");
