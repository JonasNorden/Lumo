import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadLevelDocument } from "../src/runtime/loadLevelDocument.js";
import { createRuntimeGameSession } from "../src/runtime/createRuntimeGameSession.js";
import { createLumoRechargedBootAdapter } from "../src/runtime/createLumoRechargedBootAdapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function buildExitFixture() {
  const fixturePath = path.resolve(repoRoot, "editor-v2/src/data/editorV2SavedLevel.sample.json");
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  fixture.entities = [
    { id: "spawn-a", name: "Spawn", type: "player-spawn", x: 2, y: 3, visible: true, params: {} },
    { id: "exit-a", name: "Exit", type: "player-exit", x: 2, y: 3, visible: true, params: {} },
  ];
  return fixture;
}

const loaded = loadLevelDocument(buildExitFixture());
assert.equal(loaded.ok, true, "Expected exit fixture to convert.");

const session = createRuntimeGameSession({ levelDocument: loaded.level });
const started = session.start();
assert.equal(started.ok, true, "Expected runtime session to start.");

const before = session.getPlayerSnapshot();
const exitBefore = before.entities.find((entity) => (
  entity?.type === "exit_01" || entity?.type === "exit" || entity?.type === "player-exit"
));
assert.ok(exitBefore, "Expected exit entity to exist in active Recharged runtime snapshot.");
assert.equal(exitBefore.active, true, "Expected exit to start active.");
assert.equal(exitBefore.w, 24, "Expected exit width to be one tile in active runtime shape.");
assert.equal(exitBefore.h, 24, "Expected exit height to be one tile in active runtime shape.");

session.tick({ moveX: 0, jump: false });
const after = session.getPlayerSnapshot();
assert.equal(after.levelComplete, true, "Expected exit overlap to trigger level-complete state.");
assert.equal(after.intermissionReadyForInput, true, "Expected exit overlap to expose intermission-ready input signal.");
assert.equal(after.gameState, "intermission", "Expected exit overlap to transition out of playing into intermission.");

const exitAfter = after.entities.find((entity) => entity?.id === exitBefore.id);
assert.ok(exitAfter, "Expected exit entity to remain present after completion.");
assert.equal(exitAfter.active, false, "Expected exit to deactivate after completion.");

session.tick({ moveX: 1, jump: true });
const afterHold = session.getPlayerSnapshot();
assert.equal(afterHold.levelComplete, true, "Expected completed-state tick to retain level-complete status.");
assert.equal(afterHold.intermissionReadyForInput, true, "Expected completed-state tick to retain intermission-ready signal.");
assert.equal(afterHold.gameState, "intermission", "Expected completed-state tick to keep intermission gameState.");

const adapter = createLumoRechargedBootAdapter({
  sourceDescriptor: { levelDocument: loaded.level },
});
const prepared = await adapter.prepare();
assert.equal(prepared.ok, true, "Expected adapter prepare to succeed.");
const booted = await adapter.boot();
assert.equal(booted.ok, true, "Expected adapter boot to succeed.");
adapter.tick({ moveX: 0, jump: false });
const payload = adapter.getBootPayload();
assert.equal(payload.levelComplete, true, "Expected active adapter boot payload to expose completion signal.");
assert.equal(payload.intermissionReadyForInput, true, "Expected active adapter boot payload to expose intermission-ready signal.");
assert.equal(payload.gameState, "intermission", "Expected active adapter boot payload to expose intermission state.");
assert.equal(Number.isFinite(payload.score), true, "Expected active adapter boot payload to expose finite score for intermission view.");
assert.equal(Number.isFinite(payload.lives), true, "Expected active adapter boot payload to expose finite lives for intermission view.");
assert.equal(Number.isFinite(payload.flareStash), true, "Expected active adapter boot payload to expose finite flare stash for intermission view.");
assert.equal(Number.isFinite(payload.energy), true, "Expected active adapter boot payload to expose finite energy for intermission view.");

assert.equal(payload.statusText, "Level complete", "Expected active adapter boot payload to expose level-complete HUD status text.");

adapter.tick({ moveX: 1, jump: true });
const payloadAfterHold = adapter.getBootPayload();
assert.equal(payloadAfterHold.statusText, "Level complete", "Expected status text to persist across post-exit ticks.");
assert.equal(payloadAfterHold.gameState, "intermission", "Expected intermission state to persist across post-exit ticks.");
for (let index = 0; index < 3; index += 1) {
  adapter.tick({ moveX: 0, jump: false, continuePressed: true });
}
const payloadAfterEnterAcks = adapter.getBootPayload();
assert.equal(payloadAfterEnterAcks.levelComplete, true, "Expected temporary Enter acknowledgements to keep completion state stable.");
assert.equal(payloadAfterEnterAcks.gameState, "intermission", "Expected temporary Enter acknowledgements to avoid unintended progression.");
assert.equal(payloadAfterEnterAcks.statusText, "Level complete", "Expected temporary Enter acknowledgements to keep intermission status text stable.");

const lumoHtmlPath = path.resolve(repoRoot, "Lumo.html");
const lumoHtml = fs.readFileSync(lumoHtmlPath, "utf8");
assert.equal(
  lumoHtml.includes('entity.type === "exit_01" || entity.type === "exit"'),
  true,
  "Expected live Lumo.html render path to handle exit marker rendering.",
);
assert.equal(
  lumoHtml.includes('"Level complete"'),
  true,
  "Expected live Lumo.html path to expose V1-equivalent level-complete text signal.",
);
assert.equal(
  lumoHtml.includes("Press Enter to continue"),
  true,
  "Expected live Lumo.html path to expose intermission continue prompt.",
);
assert.equal(
  lumoHtml.includes("Next flow not connected yet"),
  true,
  "Expected live Lumo.html path to include safe temporary intermission acknowledgement text.",
);
assert.equal(
  lumoHtml.includes("continuePressed"),
  true,
  "Expected live Lumo.html input path to carry Enter acknowledgement wiring without boot flow changes.",
);

console.log("lumo-recharged-exit-parity-checks: ok");
