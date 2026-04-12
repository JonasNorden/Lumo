import assert from "node:assert/strict";

import { createRuntimeGameSession } from "../src/runtime/createRuntimeGameSession.js";

function createLevelDocumentWithVisualTileFields() {
  return {
    identity: { id: "tile-visual-payload", formatVersion: "1.0.0", themeId: "nature", name: "Tile Visual Payload" },
    meta: {},
    world: {
      width: 6,
      height: 4,
      tileSize: 24,
      spawn: { x: 24, y: 24 },
    },
    layers: {
      tiles: [
        {
          tileId: 6,
          x: 1,
          y: 2,
          w: 1,
          h: 1,
          catalogTileId: "grass_bt",
          drawW: 24,
          drawH: 32,
          drawOffX: 0,
          drawOffY: 0,
          drawAnchor: "BL",
          img: "data/assets/tiles/grass_bt.png",
        },
      ],
      background: [],
      decor: [],
      entities: [],
      audio: [],
    },
  };
}

function runSupportTileVisualPayloadChecks() {
  const session = createRuntimeGameSession({ levelDocument: createLevelDocumentWithVisualTileFields() });
  const startResult = session.start();
  assert.equal(startResult.ok, true);

  const worldSnapshot = session.getWorldSnapshot();
  assert.equal(Array.isArray(worldSnapshot.supportTiles), true);
  assert.equal(worldSnapshot.supportTiles.length, 1);

  const [tile] = worldSnapshot.supportTiles;
  assert.equal(tile.tileId, 6);
  assert.equal(tile.catalogTileId, "grass_bt");
  assert.equal(tile.drawW, 24);
  assert.equal(tile.drawH, 32);
  assert.equal(tile.drawAnchor, "BL");
  assert.equal(tile.img, "data/assets/tiles/grass_bt.png");
}

runSupportTileVisualPayloadChecks();
console.log("recharged-runtime-tile-visual-payload-checks: ok");
