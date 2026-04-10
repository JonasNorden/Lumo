import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createRechargedRuntimeOrchestrator } from "../src/runtime/createRechargedRuntimeOrchestrator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixtureLevelDocument() {
  const fixturePath = path.resolve(__dirname, "../src/data/testLevelDocument.v1.json");
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function assertSummaryShape(summary) {
  assert.equal(typeof summary, "object");
  assert.equal(typeof summary.ok, "boolean");
  assert.equal(typeof summary.sourceResolved, "boolean");
  assert.equal(typeof summary.prepared, "boolean");
  assert.equal(typeof summary.started, "boolean");
  assert.equal(typeof summary.startable, "boolean");
  assert.equal(typeof summary.status, "string");
  assert.equal(typeof summary.tick, "number");
  assert.equal(typeof summary.loadMode, "string");
  assert.equal(typeof summary.player, "object");
  assert.equal(typeof summary.world, "object");
}

function assertLoadSummaryShape(summary) {
  assert.equal(typeof summary, "object");
  assert.equal(typeof summary.ok, "boolean");
  assert.equal(typeof summary.sourceResolved, "boolean");
  assert.equal(typeof summary.prepared, "boolean");
  assert.equal(typeof summary.status, "string");
  assert.equal(typeof summary.loadMode, "string");
  assert.equal(typeof summary.worldId, "string");
  assert.equal(typeof summary.themeId, "string");
  assert.equal(typeof summary.width, "number");
  assert.equal(typeof summary.height, "number");
  assert.equal(typeof summary.tileSize, "number");
}

function assertBootPayloadShape(payload) {
  assert.equal(typeof payload, "object");
  assert.equal(typeof payload.ok, "boolean");
  assert.equal(typeof payload.prepared, "boolean");
  assert.equal(typeof payload.started, "boolean");
  assert.equal(typeof payload.startable, "boolean");
  assert.equal(typeof payload.status, "string");
  assert.equal(typeof payload.tick, "number");
  assert.equal(typeof payload.loadMode, "string");
  assert.equal(typeof payload.worldId, "string");
  assert.equal(typeof payload.themeId, "string");
  assert.equal(typeof payload.playerStatus, "string");
}

async function runValidDirectSourceChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const orchestrator = createRechargedRuntimeOrchestrator({ sourceDescriptor: levelDocument });

  assert.equal(orchestrator.ok, true);
  const prepareResult = await orchestrator.prepare();
  const startResult = await orchestrator.start();
  const stepsResult = orchestrator.tickSteps(16);

  assert.equal(prepareResult.ok, true);
  assert.equal(startResult.ok, true);
  assert.equal(stepsResult.ok, true);
  assert.equal(orchestrator.getSummary().tick, 16);

  console.log("orchestrator direct ok");
  console.log("orchestrator ticked 16");
}

async function runValidLevelDocumentShapeChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const orchestrator = createRechargedRuntimeOrchestrator({
    sourceDescriptor: { levelDocument },
  });

  const prepareResult = await orchestrator.prepare();
  assert.equal(prepareResult.ok, true);
  assert.equal(orchestrator.isPrepared(), true);
}

async function runLoaderDescriptorChecks() {
  const levelDocument = loadFixtureLevelDocument();
  let loaderCalls = 0;

  async function loadLevelDocument(sourceDescriptor) {
    loaderCalls += 1;
    assert.equal(sourceDescriptor.url, "memory://fixture");
    return { levelDocument };
  }

  const orchestrator = createRechargedRuntimeOrchestrator({
    sourceDescriptor: { url: "memory://fixture" },
    loadLevelDocument,
  });

  const prepareResult = await orchestrator.prepare();
  const startResult = await orchestrator.start();
  const loadSummary = orchestrator.getLoadSummary();

  assert.equal(loaderCalls, 1);
  assert.equal(prepareResult.ok, true);
  assert.equal(startResult.ok, true);
  assertLoadSummaryShape(loadSummary);

  console.log("orchestrator loaded ok");
}

async function runPartialSourceChecks() {
  const orchestrator = createRechargedRuntimeOrchestrator({
    sourceDescriptor: {
      levelDocument: {
        identity: { id: "partial", themeId: "test-theme" },
        world: { width: 64 },
      },
    },
  });

  await orchestrator.prepare();
  await orchestrator.start();
  orchestrator.tick();
  orchestrator.stop();
  orchestrator.reset();

  assertSummaryShape(orchestrator.getSummary());
  assertLoadSummaryShape(orchestrator.getLoadSummary());
  assertBootPayloadShape(orchestrator.getBootPayload());
}

async function runInvalidSourceChecks() {
  const orchestrator = createRechargedRuntimeOrchestrator({ sourceDescriptor: null });

  const tickBefore = orchestrator.getSummary().tick;
  const prepareResult = await orchestrator.prepare();
  const startResult = await orchestrator.start();
  const tickResult = orchestrator.tick();
  const tickAfter = orchestrator.getSummary().tick;

  assert.equal(prepareResult.ok, false);
  assert.equal(startResult.ok, false);
  assert.equal(tickResult.ok, false);
  assert.equal(orchestrator.getSummary().ok, false);
  assert.equal(orchestrator.getSummary().prepared, false);
  assert.equal(orchestrator.getSummary().started, false);
  assert.equal(orchestrator.getSummary().status, "invalid");
  assert.equal(tickAfter, tickBefore);

  console.log("orchestrator invalid handled");
}

async function runMissingLoaderChecks() {
  const orchestrator = createRechargedRuntimeOrchestrator({
    sourceDescriptor: { path: "/levels/fixture.json" },
  });

  const prepareResult = await orchestrator.prepare();

  assert.equal(prepareResult.ok, false);
  assert.equal(orchestrator.getSummary().status, "invalid");
}

await runValidDirectSourceChecks();
await runValidLevelDocumentShapeChecks();
await runLoaderDescriptorChecks();
await runPartialSourceChecks();
await runInvalidSourceChecks();
await runMissingLoaderChecks();

console.log("recharged-runtime-orchestrator-checks: ok");
