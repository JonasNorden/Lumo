import assert from "node:assert/strict";
import { loadLevelDocument } from "../../Lumo/editor-v2/src/runtime/loadLevelDocument.js";
import { createRuntimeGameSession } from "../../Lumo/editor-v2/src/runtime/createRuntimeGameSession.js";

function createEditorV2DocWithAnchoredEntities() {
  return {
    meta: { id: "anchor-check", name: "Anchor Check", version: "2.0.0", themeId: "void" },
    dimensions: { width: 20, height: 12, tileSize: 24 },
    tiles: { base: new Array(20 * 12).fill(0), placements: [] },
    backgrounds: { layers: [] },
    background: { base: new Array(20 * 12).fill(null), placements: [], materials: [], defaultMaterialId: "bg_void" },
    decor: [],
    sounds: [],
    world: { spawn: { x: 4, y: 8 } },
    entities: [
      { id: "bl-dark", type: "dark_creature_01", x: 7, y: 9, params: { drawW: 18 } },
      { id: "tl-hover", type: "hover_void_01", x: 9, y: 9, params: { drawW: 16, drawAnchor: "TL" } },
    ],
    extra: {},
  };
}

const converted = loadLevelDocument(createEditorV2DocWithAnchoredEntities());
assert.equal(converted.ok, true, "expected editor-v2 conversion to runtime level to succeed");

const convertedDark = converted.level.layers.entities.find((entity) => entity.id === "bl-dark");
const convertedHover = converted.level.layers.entities.find((entity) => entity.id === "tl-hover");
assert.equal(convertedDark.x, 7 * 24, "expected BL entity x to convert from tile to pixel top-left");
assert.equal(convertedDark.y, (9 * 24) + (24 - 18), "expected BL entity y to align feet to authored tile bottom");
assert.equal(convertedHover.x, 9 * 24, "expected TL entity x to convert from tile to pixel top-left");
assert.equal(convertedHover.y, 9 * 24, "expected TL entity y to map directly to authored tile top");

const session = createRuntimeGameSession({ levelDocument: converted.level });
assert.equal(session.start().ok, true, "expected runtime session start");
session.tick({});
const snapshot = session.getPlayerSnapshot();
const runtimeDark = snapshot.entities.find((entity) => entity.id === "bl-dark");
const runtimeHover = snapshot.entities.find((entity) => entity.id === "tl-hover");
assert.equal(runtimeDark.y, (9 * 24) + (24 - 18), "expected runtime snapshot to preserve BL top-left y conversion");
assert.equal(runtimeHover.y, 9 * 24, "expected runtime snapshot to preserve TL top-left y conversion");

session.tick({ right: true, jump: true, boost: true, flare: true, pulse: true });
const movementSnapshot = session.getPlayerSnapshot();
assert.equal(Number.isFinite(movementSnapshot.x), true, "expected movement/jump/boost/flare/pulse contract to remain finite");
assert.equal(Array.isArray(movementSnapshot.flares), true, "expected flare contract to remain intact");
assert.equal(typeof movementSnapshot.pulse?.active, "boolean", "expected pulse contract to remain intact");

console.log("recharged entity placement anchor contract checks ok");
