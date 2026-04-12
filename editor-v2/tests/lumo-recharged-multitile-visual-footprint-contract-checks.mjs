import assert from "node:assert/strict";
import { loadLevelDocument } from "../../Lumo/editor-v2/src/runtime/loadLevelDocument.js";

const tileBase = new Array(16).fill(0);
// Simulate persisted base cells from a previously flattened 2x2 placement.
tileBase[1 + (1 * 4)] = 15;
tileBase[2 + (1 * 4)] = 15;
tileBase[1 + (2 * 4)] = 15;
tileBase[2 + (2 * 4)] = 15;

const editorLevelDocument = {
  meta: { id: "multi-footprint", name: "Multi footprint" },
  dimensions: { width: 4, height: 4, tileSize: 24 },
  world: { spawn: { x: 0, y: 0 } },
  tiles: {
    base: tileBase,
    placements: [
      { x: 1, y: 2, size: 2, value: 15 },
    ],
  },
  backgrounds: { layers: [] },
  background: { base: new Array(16).fill(null), placements: [], materials: [] },
  decor: [],
  entities: [],
  audio: [],
};

const result = loadLevelDocument(editorLevelDocument);
assert.equal(result.ok, true, "expected editor-v2 -> runtime conversion to succeed");

const tiles = result.level.layers.tiles;
const placementEntries = tiles.filter((tile) => tile.tileId === 15 && tile.w === 2 && tile.h === 2 && tile.x === 1 && tile.y === 1);
assert.equal(placementEntries.length, 1, "expected one 2x2 runtime tile entry for the authored placement");

const flattenedCoveredCells = new Set([
  "1,1",
  "2,1",
  "1,2",
  "2,2",
]);
const coveredSingles = tiles.filter((tile) => tile.tileId === 15 && tile.w === 1 && tile.h === 1 && flattenedCoveredCells.has(`${tile.x},${tile.y}`));
assert.equal(coveredSingles.length, 0, "expected no duplicated 1x1 entries inside authored multi-tile footprint");

console.log("multi-tile footprint contract conversion ok");
