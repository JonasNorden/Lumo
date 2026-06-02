import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { stepRuntimePlayerSimulation } from "../../Lumo/editor-v2/src/runtime/stepRuntimePlayerSimulation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const lumoHtmlCandidates = [
  resolve(__dirname, "..", "..", "Lumo.html"),
  resolve(__dirname, "..", "..", "Lumo", "Lumo.html"),
  resolve(__dirname, "..", "..", "..", "Lumo.html"),
  resolve(__dirname, "..", "..", "..", "Lumo", "Lumo.html"),
];
const htmlPath = lumoHtmlCandidates.find((candidatePath) => existsSync(candidatePath));
assert.ok(
  htmlPath,
  `expected Lumo.html to exist; attempted paths:\n${lumoHtmlCandidates.join("\n")}`,
);

function buildHazardTruthWorldPacket() {
  return {
    ok: true,
    world: {
      width: 20,
      height: 20,
      tileSize: 24,
    },
    tiles: [],
    supportTiles: [],
    hazardTiles: [],
    entities: [],
  };
}

function buildPlayerStateWithAuthoritativeDarkProjectile() {
  return {
    position: { x: 100, y: 100 },
    velocity: { x: 0, y: 0 },
    energy: 1,
    grounded: false,
    darkProjectiles: [
      {
        id: 1,
        x: 94,
        y: 80,
        vx: 0,
        vy: 0,
        gravity: 0,
        age: 0.1,
        maxAge: 5,
        energyLoss: 40,
        knockbackX: 0,
        knockbackY: 0,
      },
    ],
    nextDarkProjectileId: 2,
    darkSpellHazards: [],
    nextDarkSpellHazardId: 1,
  };
}

const beforePlayerState = buildPlayerStateWithAuthoritativeDarkProjectile();
const result = stepRuntimePlayerSimulation(
  buildHazardTruthWorldPacket(),
  beforePlayerState,
  { dt: 1 / 60 },
);

const firstHazard = Array.isArray(result?.darkSpellHazards) ? result.darkSpellHazards[0] : null;
const hazardDamageCalled = Number.isFinite(result?.player?.energy) && result.player.energy !== beforePlayerState.energy;
const hazardDamageReducedEnergy = Number.isFinite(result?.player?.energy) && result.player.energy < beforePlayerState.energy;
const hazardPersisted = firstHazard
  && Number.isFinite(firstHazard.x)
  && Number.isFinite(firstHazard.y)
  && firstHazard.age === 0
  && firstHazard.life > 0;

const html = readFileSync(htmlPath, "utf8");
const rendererSawHazard =
  html.includes("const darkSpellHazards = Array.isArray(playerSnapshot?.darkSpellHazards)")
  && html.includes("type: \"darkSpellHazard\"")
  && html.includes("entity.type === \"darkSpellHazard\" || entity.type === \"dark_spell_hazard\"")
  && html.includes("let hazardSprite = darkSpellSprites.impact01;")
  && html.includes("if (hazardT < 0.15) hazardSprite = darkSpellSprites.impact03;")
  && html.includes("else if (hazardT < 0.3) hazardSprite = darkSpellSprites.impact02;");

const hazardTruthLinks = [
  ["runtimeStepOk", result?.ok === true],
  ["projectileConsumed", Array.isArray(result?.darkProjectiles) && result.darkProjectiles.length === 0],
  ["hazardDamageCalled", hazardDamageCalled === true],
  ["hazardDamageReducedEnergy", hazardDamageReducedEnergy === true],
  ["hazardPersisted", hazardPersisted === true],
  ["rendererSawHazard", rendererSawHazard === true],
];
const firstFailedLink = hazardTruthLinks.find(([, passed]) => passed !== true)?.[0] ?? null;

console.log(`[LUMO dcHazardTruth] firstFailedLink: ${firstFailedLink}`);
console.log(`hazardDamageCalled: ${hazardDamageCalled}`);
console.log(`hazardDamageReducedEnergy: ${hazardDamageReducedEnergy}`);
console.log(`rendererSawHazard: ${rendererSawHazard}`);

assert.equal(firstFailedLink, null, `expected full dark-creature hazard truth chain, failed at ${firstFailedLink}`);
