import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadLevelDocument } from "../src/runtime/loadLevelDocument.js";
import { createRuntimeGameSession } from "../src/runtime/createRuntimeGameSession.js";
import { createLumoRechargedBootAdapter } from "../src/runtime/createLumoRechargedBootAdapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function buildCheckpointFixture() {
  const fixturePath = path.resolve(repoRoot, "editor-v2/src/data/editorV2SavedLevel.sample.json");
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  fixture.entities = [
    { id: "spawn-a", name: "Spawn", type: "player-spawn", x: 2, y: 3, visible: true, params: {} },
    {
      id: "checkpoint-a",
      name: "Checkpoint",
      type: "checkpoint",
      x: 2,
      y: 3,
      visible: true,
      params: { customSpritePath: "data/assets/sprites/lights/lantern_2.png" },
    },
  ];
  return fixture;
}

const loaded = loadLevelDocument(buildCheckpointFixture());
assert.equal(loaded.ok, true, "Expected fixture level to convert.");

const session = createRuntimeGameSession({ levelDocument: loaded.level });
const started = session.start();
assert.equal(started.ok, true, "Expected runtime session to start.");

const before = session.getPlayerSnapshot();
assert.equal(before?.checkpoint, null, "Expected no checkpoint state before overlap.");
const checkpointEntityBefore = before.entities.find((entity) => entity?.type === "checkpoint");
assert.ok(checkpointEntityBefore, "Expected checkpoint entity in Recharged runtime entity snapshots.");
assert.equal(checkpointEntityBefore?.active, true, "Expected checkpoint entity to start active.");
assert.equal(checkpointEntityBefore?.w, 24, "Expected runtime checkpoint width to be tile-sized.");
assert.equal(checkpointEntityBefore?.h, 24, "Expected runtime checkpoint height to be tile-sized.");
assert.equal(
  checkpointEntityBefore?.params?.customSpritePath,
  "data/assets/sprites/lights/lantern_2.png",
  "Expected checkpoint custom sprite path to survive runtime conversion.",
);

session.tick({ moveX: 0, jump: false });
const after = session.getPlayerSnapshot();
assert.ok(after?.checkpoint && typeof after.checkpoint === "object", "Expected overlap to set player checkpoint state.");
assert.equal(after.checkpoint.tx, 2, "Expected checkpoint tx set from entity x.");
assert.equal(after.checkpoint.ty, 3, "Expected checkpoint ty set from entity y.");
assert.equal(after.checkpoint.px, 48, "Expected checkpoint px set from tile coordinate.");
assert.equal(after.checkpoint.py, 72, "Expected checkpoint py set from tile coordinate.");

const checkpointEntityAfter = after.entities.find((entity) => entity?.id === checkpointEntityBefore.id);
assert.ok(checkpointEntityAfter, "Expected checkpoint entity to remain present after overlap.");
assert.equal(checkpointEntityAfter.active, true, "Expected checkpoint to remain active after overlap.");
assert.notEqual(checkpointEntityAfter.state, "collected", "Expected checkpoint to never enter pickup collected state.");
assert.equal(checkpointEntityAfter?.consumesFlare, false, "Expected checkpoint to never be treated as a flare-collectible.");

const adapter = createLumoRechargedBootAdapter({
  sourceDescriptor: { levelDocument: loaded.level },
});
const prepared = await adapter.prepare();
assert.equal(prepared.ok, true, "Expected adapter prepare to succeed.");
const booted = await adapter.boot();
assert.equal(booted.ok, true, "Expected adapter boot to succeed.");

const adapterSnapshotBefore = adapter.getPlayerSnapshot();
const adapterCheckpointBefore = adapterSnapshotBefore?.entities?.find((entity) => entity?.id === "checkpoint-a");
assert.ok(adapterCheckpointBefore, "Expected checkpoint entity in active adapter snapshot path.");
assert.equal(adapterCheckpointBefore?.x, 48, "Expected adapter snapshot checkpoint x in world pixels.");
assert.equal(adapterCheckpointBefore?.y, 72, "Expected adapter snapshot checkpoint y in world pixels.");
assert.equal(adapterCheckpointBefore?.w, 24, "Expected adapter snapshot checkpoint width in active path.");
assert.equal(adapterCheckpointBefore?.h, 24, "Expected adapter snapshot checkpoint height in active path.");

const adapterCheckpointAfter = adapterSnapshotBefore?.entities?.find((entity) => entity?.id === "checkpoint-a");
assert.ok(adapterCheckpointAfter, "Expected adapter checkpoint entity to remain present in active snapshot path.");
assert.equal(adapterCheckpointAfter?.active, true, "Expected adapter checkpoint to remain active in active snapshot path.");
assert.notEqual(adapterCheckpointAfter?.state, "collected", "Expected adapter checkpoint to never be marked as collectible.");

const lumoHtmlPath = path.resolve(repoRoot, "Lumo.html");
const lumoHtml = fs.readFileSync(lumoHtmlPath, "utf8");
assert.equal(
  lumoHtml.includes('entity.type === "checkpoint_01" || entity.type === "checkpoint"'),
  true,
  "Expected live Lumo.html render path to handle checkpoint entities.",
);
assert.equal(
  lumoHtml.includes("entity?.params?.customSpritePath"),
  true,
  "Expected live Lumo.html render path to use checkpoint custom sprite path truth.",
);

console.log("lumo-recharged-checkpoint-parity-checks: ok");
