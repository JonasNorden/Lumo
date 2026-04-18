import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { stepRuntimePlayerSimulation } from "../src/runtime/stepRuntimePlayerSimulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function buildRuntimeWorldPacket() {
  const tileSize = 24;
  return {
    world: { width: 40, height: 20, tileSize },
    layers: { tiles: [] },
    spawn: { x: 14 * tileSize, y: 10 * tileSize },
    tileBounds: { maxY: 19 },
  };
}

function runSnapshotFieldSurvivalChecks() {
  const worldPacket = buildRuntimeWorldPacket();
  const tileSize = worldPacket.world.tileSize;
  const sourceEntities = [
    { id: "hover-eye", type: "hover_void_01", x: 11 * tileSize, y: 9 * tileSize, active: true, alive: true, w: tileSize, h: tileSize, params: { aggroTiles: 6 } },
  ];
  const step = stepRuntimePlayerSimulation(
    worldPacket,
    {
      position: { x: 12 * tileSize, y: 10 * tileSize },
      velocity: { x: 0, y: 0 },
      grounded: false,
      falling: false,
      rising: false,
      landed: false,
      entities: sourceEntities,
    },
    { input: { moveX: 0, jump: false }, entities: sourceEntities },
  );
  assert.equal(step.ok, true);
  const hover = Array.isArray(step?.player?.entities) ? step.player.entities.find((entity) => entity?.id === "hover-eye") : null;
  assert.ok(hover, "expected hover entity in runtime player snapshot");
  assert.equal(typeof hover.awake, "boolean");
  assert.equal(typeof hover.eyeBlend, "number");
  assert.equal(typeof hover._blinkDur, "number");
  assert.equal(typeof hover._angryT, "number");
  assert.equal(typeof hover._lungeState, "string");
  assert.equal(typeof hover._facingX, "number");
}

function runBickerAngryRuntimeChecks() {
  const worldPacket = buildRuntimeWorldPacket();
  const tileSize = worldPacket.world.tileSize;
  const sourceEntities = [
    {
      id: "hover-a",
      type: "hover_void_01",
      x: 11.2 * tileSize,
      y: 9.4 * tileSize,
      w: tileSize,
      h: tileSize,
      active: true,
      alive: true,
      awake: true,
      eyeBlend: 1,
      sleepBlend: 0,
      _isFollowing: true,
      _bickerCd: 0,
      _angryT: 0,
      _blinkDur: 0.05,
      _lungeState: "idle",
    },
    {
      id: "hover-b",
      type: "hover_void_01",
      x: 11.25 * tileSize,
      y: 9.43 * tileSize,
      w: tileSize,
      h: tileSize,
      active: true,
      alive: true,
      awake: true,
      eyeBlend: 1,
      sleepBlend: 0,
      _isFollowing: true,
      _bickerCd: 0,
      _angryT: 0,
      _blinkDur: 0,
      _lungeState: "idle",
    },
  ];
  let playerState = {
    position: { x: 12 * tileSize, y: 10 * tileSize },
    velocity: { x: 0, y: 0 },
    grounded: false,
    falling: false,
    rising: false,
    landed: false,
    entities: sourceEntities,
  };

  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const step = stepRuntimePlayerSimulation(worldPacket, playerState, { input: { moveX: 0, jump: false }, entities: sourceEntities });
    assert.equal(step.ok, true);
    const hoverA = step.player.entities.find((entity) => entity.id === "hover-a");
    const hoverB = step.player.entities.find((entity) => entity.id === "hover-b");
    assert.ok(hoverA && hoverB, "expected hover entities after runtime step");
    assert.equal((hoverA._angryT > 0 || hoverB._angryT > 0), true, "expected close-range bicker state to trigger angry timer");
    assert.equal(typeof hoverA._blinkDur, "number");
    assert.equal(typeof hoverA._lungeState, "string");
    assert.equal(typeof hoverA.eyeBlend, "number");
    playerState = step.player;
  } finally {
    Math.random = originalRandom;
  }

  assert.ok(playerState);
}

function runRenderPathSelectionChecks() {
  const htmlPath = path.resolve(repoRoot, "Lumo.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  assert.equal(html.includes("function drawHoverVoidEyesV1(ctx, centerX, centerY, entity, alphaMul = 1)"), true);
  assert.equal(html.includes("const angry = (Number.isFinite(entity?._angryT) && entity._angryT > 0) || (typeof entity?._lungeState === \"string\" && entity._lungeState !== \"idle\");"), true);
  assert.equal(html.includes("const blink = Number.isFinite(entity?._blinkDur) && entity._blinkDur > 0 ? 0.15 : 1;"), true);
  assert.equal(html.includes("if (isHoverEyeRenderableFromRuntime(entity, mapper)) {"), true);
  assert.equal(html.includes("drawHoverVoidEyesV1(ctx, eyeDraw.x, eyeDraw.y, eyeDraw.entity, 1);"), true);
}

runSnapshotFieldSurvivalChecks();
runBickerAngryRuntimeChecks();
runRenderPathSelectionChecks();

console.log("lumo-recharged-hover-void-eye-render-contract-checks: ok");
