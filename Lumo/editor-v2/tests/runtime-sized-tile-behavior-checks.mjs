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
  Util: {
    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    },
    aabb() {
      return false;
    },
  },
  Tileset: {
    0: { solid: false, oneWay: false, hazard: false },
    2: { solid: true, oneWay: true, hazard: false, name: "oneway" },
    4: { solid: true, oneWay: false, hazard: false, name: "ice", frictionMul: 0.02 },
  },
};

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

runWorldBehaviorCoverageChecks();
runPlayerSurfaceSamplingChecks();

console.log("runtime sized tile behavior checks passed");
