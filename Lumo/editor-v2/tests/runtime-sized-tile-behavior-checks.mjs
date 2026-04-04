import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = path.resolve(process.cwd());
const worldSource = fs.readFileSync(path.join(repoRoot, "Lumo/src/game/world.js"), "utf8");
const playerSource = fs.readFileSync(path.join(repoRoot, "Lumo/src/game/player.js"), "utf8");

globalThis.window = globalThis;
globalThis.performance = { now: () => 0 };
globalThis.Image = class ImageStub {
  constructor() {
    this._ok = false;
  }
};
globalThis.Lumo = {
  TILE: 24,
  Input: {
    down: () => false,
    tap: () => false,
  },
  U: {
    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    },
    aabb(ax, ay, aw, ah, bx, by, bw, bh) {
      return (
        ax < bx + bw &&
        ax + aw > bx &&
        ay < by + bh &&
        ay + ah > by
      );
    },
  },
  Tileset: {
    0: { solid: false, oneWay: false, hazard: false },
    1: { solid: true, oneWay: false, hazard: false, name: "solid" },
    2: { solid: true, oneWay: true, hazard: false, name: "oneway" },
    3: { solid: false, oneWay: false, hazard: true, name: "hazard" },
    4: { solid: true, oneWay: false, hazard: false, name: "ice", frictionMul: 0.02 },
    5: { solid: true, oneWay: false, hazard: false, name: "brake", frictionMul: 6.4 },
  },
};
globalThis.window.LUMO_TILE_BEHAVIOR_PROFILES = [
  { id: "tile.solid.default", collisionType: "solid", special: null },
  { id: "tile.solid.ice", collisionType: "solid", special: "ice" },
  { id: "tile.solid.brake", collisionType: "solid", special: "brake" },
  { id: "tile.solid.sticky", collisionType: "solid", special: "sticky", defaults: { movementMul: 0.5 } },
  { id: "tile.solid.rapid", collisionType: "solid", special: "rapid", defaults: { movementMul: 1.35 } },
  { id: "tile.one-way.default", collisionType: "oneWay", special: null },
  { id: "tile.hazard.default", collisionType: "hazard", special: null },
];
globalThis.window.LUMO_CATALOG_TILES = [
  { id: "stone_ct", tileId: 15, behaviorProfileId: "tile.solid.default", collisionType: "solid", footprint: { w: 2, h: 2 } },
  { id: "custom-solid", tileId: 101, behaviorProfileId: "tile.solid.default", collisionType: "solid", footprint: { w: 1, h: 1 } },
  { id: "custom-one-way", tileId: 102, behaviorProfileId: "tile.one-way.default", collisionType: "oneWay", footprint: { w: 1, h: 1 } },
  { id: "custom-brake", tileId: 17, behaviorProfileId: "tile.solid.brake", collisionType: "solid", special: "brake", footprint: { w: 1, h: 1 } },
  { id: "custom-sticky", tileId: 18, behaviorProfileId: "tile.solid.sticky", behaviorParams: { movementMul: 0.55 }, collisionType: "solid", footprint: { w: 1, h: 1 } },
  { id: "custom-rapid", tileId: 19, behaviorProfileId: "tile.solid.rapid", behaviorParams: { movementMul: 1.42 }, collisionType: "solid", footprint: { w: 1, h: 1 } },
];

vm.runInThisContext(worldSource, { filename: "world.js" });
vm.runInThisContext(playerSource, { filename: "player.js" });

function keyForCell(w, tx, ty) {
  return ty * w + tx;
}

function runWorldBehaviorCoverageChecks() {
  const world = new Lumo.World();
  const w = 8;
  const h = 8;
  const data = new Array(w * h).fill(0);

  // 2x2 ice authored at BL anchor (2,4)
  data[keyForCell(w, 2, 4)] = 4;
  // 3x3 one-way authored at BL anchor (4,6)
  data[keyForCell(w, 4, 6)] = 2;

  world.loadLevel({
    meta: { w, h, tileSize: 24, id: "behavior-sized", name: "Behavior Sized" },
    layers: {
      main: data,
      tileVisualOverrides: {
        "2,4": { footprintW: 2, footprintH: 2, drawW: 48, drawH: 48, drawAnchor: "BL" },
        "4,6": { footprintW: 3, footprintH: 3, drawW: 72, drawH: 72, drawAnchor: "BL" },
      },
    },
  });

  // 1x1 control behavior should still work.
  assert.equal(world.getTileBehavior(2, 4)?.name, "ice");

  // 2x2 coverage: all covered cells should resolve to ice.
  assert.equal(world.getTileBehavior(2, 4)?.name, "ice");
  assert.equal(world.getTileBehavior(3, 4)?.name, "ice");
  assert.equal(world.getTileBehavior(2, 3)?.name, "ice");
  assert.equal(world.getTileBehavior(3, 3)?.name, "ice");

  // 3x3 one-way: covered area should keep one-way semantics.
  assert.equal(world.getTileBehavior(4, 6)?.oneWay, true);
  assert.equal(world.getTileBehavior(6, 6)?.oneWay, true);
  assert.equal(world.getTileBehavior(4, 4)?.oneWay, true);
  assert.equal(world.getTileBehavior(6, 4)?.oneWay, true);
}

function runCustomTileIdentityChecks() {
  const world = new Lumo.World();
  const w = 4;
  const h = 3;
  const data = new Array(w * h).fill(0);
  data[keyForCell(w, 0, 2)] = 15;
  data[keyForCell(w, 1, 2)] = 101;
  data[keyForCell(w, 2, 2)] = 102;
  data[keyForCell(w, 3, 2)] = 17;
  data[keyForCell(w, 0, 1)] = 18;
  data[keyForCell(w, 1, 1)] = 19;

  world.loadLevel({
    meta: { w, h, tileSize: 24, id: "custom-identity", name: "Custom Identity" },
    layers: { main: data },
  });

  assert.equal(world._tileDefById.get(15)?.id, "stone_ct", "built-in id should retain its own catalog definition");
  assert.equal(world._tileDefById.get(101)?.id, "custom-solid", "custom tile should have its own identity");
  assert.equal(world._tileDefById.get(17)?.behaviorProfileId, "tile.solid.brake", "custom brake tile should keep behavior profile identity");
  assert.equal(world.tileDefs[17]?.solid, true, "custom tileDefs entry should be synthesized from behavior profile");
  assert.equal(world.tileDefs[17]?.frictionMul, 6.4, "custom brake tileDefs entry should inherit brake friction semantics");
  assert.equal(world.getTileBehavior(0, 2)?.solid, true, "built-in solid behavior should remain intact");
  assert.equal(world.getTileBehavior(1, 2)?.solid, true, "custom solid behavior should resolve from behavior profile");
  assert.equal(world.getTileBehavior(2, 2)?.oneWay, true, "custom one-way behavior should survive reload/runtime lookup");
  assert.equal(world.getTileBehavior(3, 2)?.frictionMul, 6.4, "custom brake behavior profile should resolve runtime brake semantics");
  assert.equal(world.getTileBehavior(0, 1)?.maxSpeedMul, 0.55, "custom sticky movement multiplier should resolve from authored behavior params");
  assert.equal(world.getTileBehavior(1, 1)?.maxSpeedMul, 1.42, "custom rapid movement multiplier should resolve from authored behavior params");
}

function runPlayerSurfaceSamplingChecks() {
  const player = new Lumo.Player(0, 0);
  player.onGround = true;
  player.onPlatform = null;

  // Feet sample lands in right-half/top-half cell of a 2x2 BL-anchored footprint.
  player.x = 3 * 24;
  player.y = (3 * 24) - player.h - 1;

  const world = {
    tileSize: 24,
    getTileBehavior(tx, ty) {
      if (tx === 3 && ty === 3) return { name: "ice", frictionMul: 0.02 };
      return null;
    },
    getTile() {
      return 0;
    },
    resolveTileBehaviorById() {
      return null;
    },
    tileDefs: {},
  };

  const def = player._getSurfaceDef(world);
  assert.equal(def?.name, "ice");
  assert.equal(def?.frictionMul, 0.02);
}

function runPlayerStickyRapidSurfaceChecks() {
  const stickyPlayer = new Lumo.Player(0, 0);
  stickyPlayer.onGround = true;
  stickyPlayer.onPlatform = null;
  stickyPlayer._applySurface({
    tileSize: 24,
    getTileBehavior() {
      return { maxSpeedMul: 0.5, solid: true };
    },
  });
  assert.equal(stickyPlayer.speed, stickyPlayer._baseSpeed * 0.5, "sticky surface should slow max movement speed");

  const rapidPlayer = new Lumo.Player(0, 0);
  rapidPlayer.onGround = true;
  rapidPlayer.onPlatform = null;
  rapidPlayer._applySurface({
    tileSize: 24,
    getTileBehavior() {
      return { maxSpeedMul: 1.35, solid: true };
    },
  });
  assert.equal(rapidPlayer.speed, rapidPlayer._baseSpeed * 1.35, "rapid surface should boost max movement speed");
}

function runOneWayCollisionChecks() {
  const world = new Lumo.World();
  const w = 12;
  const h = 10;
  const data = new Array(w * h).fill(0);

  // 1x1 one-way (control)
  data[keyForCell(w, 2, 6)] = 2;
  // 2x2 one-way at BL anchor (5,6)
  data[keyForCell(w, 5, 6)] = 2;
  // 3x3 one-way at BL anchor (8,7)
  data[keyForCell(w, 8, 7)] = 2;

  world.loadLevel({
    meta: { w, h, tileSize: 24, id: "one-way-sized", name: "One-way Sized" },
    layers: {
      main: data,
      tileVisualOverrides: {
        "5,6": { footprintW: 2, footprintH: 2, drawW: 48, drawH: 48, drawAnchor: "BL" },
        "8,7": { footprintW: 3, footprintH: 3, drawW: 72, drawH: 72, drawAnchor: "BL" },
      },
    },
  });

  function assertLanding({ anchorTx, anchorTy, footprintW = 1, footprintH = 1 }) {
    const player = new Lumo.Player(0, 0);
    const top = (anchorTy - footprintH + 1) * 24;
    const centerX = (anchorTx + (footprintW * 0.5)) * 24;
    player.x = centerX - (player.w * 0.5);
    player.y = top - player.h - 5;
    player.vy = 120;

    player.moveAndCollide(0.1, world);

    assert.equal(player.onGround, true);
    assert.equal(player.y, top - player.h);
    assert.equal(player.vy, 0);
  }

  function assertJumpThrough({ anchorTx, anchorTy, footprintW = 1, footprintH = 1 }) {
    const player = new Lumo.Player(0, 0);
    const top = (anchorTy - footprintH + 1) * 24;
    const centerX = (anchorTx + (footprintW * 0.5)) * 24;
    player.x = centerX - (player.w * 0.5);
    player.y = top + 4;
    player.vy = -120;

    const expectedY = player.y + player.vy * 0.1;
    player.moveAndCollide(0.1, world);

    assert.equal(player.onGround, false);
    assert.equal(player.vy, -120);
    assert.equal(player.y, expectedY);
  }

  // Landing from above must work for all footprints.
  assertLanding({ anchorTx: 2, anchorTy: 6, footprintW: 1, footprintH: 1 });
  assertLanding({ anchorTx: 5, anchorTy: 6, footprintW: 2, footprintH: 2 });
  assertLanding({ anchorTx: 8, anchorTy: 7, footprintW: 3, footprintH: 3 });

  // Jumping up from below must pass through for all footprints.
  assertJumpThrough({ anchorTx: 2, anchorTy: 6, footprintW: 1, footprintH: 1 });
  assertJumpThrough({ anchorTx: 5, anchorTy: 6, footprintW: 2, footprintH: 2 });
  assertJumpThrough({ anchorTx: 8, anchorTy: 7, footprintW: 3, footprintH: 3 });
}

runWorldBehaviorCoverageChecks();
runCustomTileIdentityChecks();
runPlayerSurfaceSamplingChecks();
runPlayerStickyRapidSurfaceChecks();
runOneWayCollisionChecks();

console.log("runtime sized tile behavior checks passed");
