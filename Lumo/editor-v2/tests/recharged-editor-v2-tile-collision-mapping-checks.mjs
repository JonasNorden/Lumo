import assert from "node:assert/strict";

import { loadLevelDocument } from "../src/runtime/loadLevelDocument.js";
import { createRuntimeRunnerSession } from "../src/runtime/createRuntimeRunnerSession.js";
import { buildRuntimeWorldSkeleton } from "../src/runtime/buildRuntimeWorldSkeleton.js";
import { buildRuntimeTileEntries } from "../src/runtime/buildRuntimeTileEntries.js";
import { buildRuntimeTileBounds } from "../src/runtime/buildRuntimeTileBounds.js";
import { buildRuntimeTileMap } from "../src/runtime/buildRuntimeTileMap.js";
import { buildRuntimeWorldPacket } from "../src/runtime/buildRuntimeWorldPacket.js";
import { stepRuntimePlayerSimulation } from "../src/runtime/stepRuntimePlayerSimulation.js";

function buildEditorLevelWithGap() {
  const width = 8;
  const height = 8;
  const base = new Array(width * height).fill(0);
  const supportRow = 5;

  for (let x = 0; x < width; x += 1) {
    if (x === 4) {
      continue;
    }

    base[supportRow * width + x] = 1;
  }

  return {
    meta: { id: "editor-v2-collision-map", name: "Collision Map", version: "2.0.0", themeId: "cavern" },
    dimensions: { width, height, tileSize: 24 },
    tiles: { base, placements: [] },
    backgrounds: { layers: [] },
    background: { base: new Array(width * height).fill(null), placements: [], materials: [], defaultMaterialId: "bg_void" },
    decor: [],
    entities: [{ id: "spawn-a", type: "player-spawn", x: 2, y: 1, visible: true, params: {} }],
    sounds: [],
    extra: {},
  };
}

function runEditorTileNormalizationChecks() {
  const loaded = loadLevelDocument(buildEditorLevelWithGap());
  assert.equal(loaded.ok, true);
  assert.equal(loaded.level.world.spawn.x, 48);
  assert.equal(loaded.level.world.spawn.y, 24);

  const firstTile = loaded.level.layers.tiles[0];
  assert.equal(firstTile.coordinateSpace, "grid", "Editor V2 tiles should remain explicitly grid-authored for runtime collision mapping");
  assert.equal(firstTile.solid, true, "Editor V2 tile conversions should mark support tiles as solid by default");
}

function buildSessionWorld() {
  const loaded = loadLevelDocument(buildEditorLevelWithGap());
  assert.equal(loaded.ok, true);

  const sessionResult = createRuntimeRunnerSession(loaded.level);
  assert.equal(sessionResult.ok, true, "runtime session should start from converted Editor V2 levels");

  const skeleton = buildRuntimeWorldSkeleton(loaded.level);
  const tileEntries = buildRuntimeTileEntries(skeleton);
  const tileBounds = buildRuntimeTileBounds(tileEntries);
  const tileMap = buildRuntimeTileMap(tileEntries);
  return buildRuntimeWorldPacket({ skeleton, tileBounds, tileMap });
}

function runLandingAndStandChecks() {
  const worldPacket = buildSessionWorld();
  let player = {
    position: { x: worldPacket.spawn.x, y: worldPacket.spawn.y },
    velocity: { x: 0, y: 0 },
    grounded: false,
    falling: true,
    rising: false,
    landed: false,
  };

  for (let tick = 0; tick < 200; tick += 1) {
    const step = stepRuntimePlayerSimulation(worldPacket, player, { input: { moveX: 0, jump: false }, bounds: { fallRespawnMarginTiles: 20 } });
    assert.equal(step.ok, true);
    player = step.player;

    if (player.grounded === true) {
      break;
    }
  }

  assert.equal(player.grounded, true, "spawned player should land on converted Editor V2 support tiles");
  assert.equal(player.position.y, (5 * 24) - 1, "player feet should clamp to top of solid support row");

  const standStep = stepRuntimePlayerSimulation(worldPacket, player, { input: { moveX: 0, jump: false }, bounds: { fallRespawnMarginTiles: 20 } });
  assert.equal(standStep.ok, true);
  assert.equal(standStep.player.grounded, true, "grounded player should remain standing on support tiles");

  const jumpStep = stepRuntimePlayerSimulation(worldPacket, standStep.player, { input: { moveX: 0, jump: true }, bounds: { fallRespawnMarginTiles: 20 } });
  assert.equal(jumpStep.ok, true);
  assert.equal(jumpStep.player.rising, true, "grounded player should be able to jump from converted support tiles");
}

function runGapRespawnChecks() {
  const worldPacket = buildSessionWorld();
  let player = {
    position: { x: 4 * 24, y: worldPacket.spawn.y },
    velocity: { x: 0, y: 0 },
    grounded: false,
    falling: true,
    rising: false,
    landed: false,
  };

  let respawned = null;
  for (let tick = 0; tick < 240; tick += 1) {
    const step = stepRuntimePlayerSimulation(worldPacket, player, { input: { moveX: 0, jump: false } });
    assert.equal(step.ok, true);
    player = step.player;

    if (step.status === "respawned-out-of-bounds") {
      respawned = step;
      break;
    }
  }

  assert.ok(respawned, "player above a true support gap should eventually hit out-of-bounds respawn flow");
  assert.equal(respawned.player.position.x, worldPacket.spawn.x);
  assert.equal(respawned.player.position.y, worldPacket.spawn.y);
}

runEditorTileNormalizationChecks();
runLandingAndStandChecks();
runGapRespawnChecks();

console.log("recharged-editor-v2-tile-collision-mapping-checks: ok");
