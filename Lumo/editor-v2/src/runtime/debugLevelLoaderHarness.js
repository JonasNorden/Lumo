import { loadLevelDocument } from "./loadLevelDocument.js";
import { createRuntimeBridge } from "./createRuntimeBridge.js";
import { createRuntimeBridgeSummary } from "./createRuntimeBridgeSummary.js";
import { createRuntimeGlobalDebugApi } from "./createRuntimeGlobalDebugApi.js";
import { attachRuntimeDebugApi } from "./attachRuntimeDebugApi.js";
import { bootRuntimeBridge } from "./bootRuntimeBridge.js";
import { startRuntimeFromLevelPathNode } from "./startRuntimeFromLevelPathNode.js";
import testLevelDocument from "../data/testLevelDocument.v1.json" with { type: "json" };

const validLevelPath = new URL("../data/testLevelDocument.v1.json", import.meta.url).href;
const invalidLevelPath = "./missing-level-document.v1.json";

// Invalid Recharged sample level used to verify clean start failures.
const invalidSampleLevel = {
  identity: {
    id: "debug-invalid-001",
    name: "Debug Harness - Invalid",
    formatVersion: 1,
    themeId: "forest",
  },
  world: {
    width: 20,
    height: 12,
    tileSize: 16,
  },
  layers: {
    tiles: [{ tileId: "stone", x: 1, y: 1 }],
  },
};

// Partially valid sample should still boot and report a falling player state.
const partialValidSampleLevel = {
  identity: {
    id: "debug-partial-001",
    name: "Debug Harness - Partial Valid",
    formatVersion: 1,
    themeId: "forest",
  },
  world: {
    width: 20,
    height: 12,
    tileSize: 16,
    spawn: { x: 2, y: 2 },
  },
  layers: {},
};

function printSection(title, payload) {
  console.log(`\n=== ${title} ===`);
  console.dir(payload, { depth: null });
}

function compactResult(result) {
  return {
    ok: result?.ok === true,
    status: result?.status ?? null,
    errors: result?.errors ?? [],
    warnings: result?.warnings ?? [],
    summary: result?.summary
      ? {
        worldId: result.summary.worldId,
        themeId: result.summary.themeId,
        runtimeTick: result.summary.runtimeTick,
        playerStatus: result.summary.playerStatus,
        grounded: result.summary.grounded,
        falling: result.summary.falling,
        bridgeStatus: result.summary.bridgeStatus,
      }
      : null,
  };
}

// Runs focused boot/bridge/debug-api checks for valid, partial-valid, and invalid samples.
export async function runDebugLevelLoaderHarness() {
  const validLoaded = loadLevelDocument(testLevelDocument);
  const partialLoaded = loadLevelDocument(partialValidSampleLevel);
  const invalidLoaded = loadLevelDocument(invalidSampleLevel);

  const bridgeCreate = createRuntimeBridge();
  const bridge = bridgeCreate.bridge;
  printSection("RUNTIME BRIDGE CREATE", {
    ok: bridgeCreate.ok,
    status: bridge.getStatus(),
    hasActiveController: bridge.hasActiveController(),
  });

  const idleSummary = createRuntimeBridgeSummary(bridge);
  printSection("RUNTIME BRIDGE SUMMARY", idleSummary);

  const validStartFromDocument = bridge.startFromLevelDocument(validLoaded.level, { startOptions: { steps: 0 } });
  printSection("RUNTIME BRIDGE START FROM DOCUMENT", compactResult(validStartFromDocument));

  const validSummaryAfterDocumentStart = createRuntimeBridgeSummary(bridge);
  printSection("RUNTIME BRIDGE SUMMARY", validSummaryAfterDocumentStart);

  const validTick = await bridge.tick();
  printSection("RUNTIME BRIDGE TICK", compactResult(validTick));

  const validUpdate = await bridge.update({ steps: 4, stopOnGrounded: true });
  printSection("RUNTIME BRIDGE UPDATE", compactResult(validUpdate));

  const validPause = await bridge.pause();
  const validResume = await bridge.resume();
  printSection("RUNTIME BRIDGE PAUSE RESUME", {
    pause: compactResult(validPause),
    resume: compactResult(validResume),
  });

  const validReset = await bridge.reset();
  const validRestart = await bridge.restart();
  printSection("RUNTIME BRIDGE RESET RESTART", {
    reset: compactResult(validReset),
    restart: compactResult(validRestart),
  });

  const validClear = bridge.clear();
  printSection("RUNTIME BRIDGE CLEAR", compactResult(validClear));

  const validStartFromPathNode = await startRuntimeFromLevelPathNode(validLevelPath, {
    steps: 2,
    stopOnGrounded: true,
  });
  printSection("RUNTIME START FROM PATH (NODE ENTRY)", compactResult(validStartFromPathNode));

  const validStartFromPath = await bridge.startFromLevelPath(validLevelPath, {
    startOptions: { steps: 2, stopOnGrounded: true },
  });
  printSection("RUNTIME BRIDGE START FROM PATH", compactResult(validStartFromPath));

  const globalDebugApiResult = createRuntimeGlobalDebugApi(bridge);
  const debugApi = globalDebugApiResult.debugApi;
  printSection("RUNTIME GLOBAL DEBUG API", {
    ok: globalDebugApiResult.ok,
    status: debugApi?.getStatus?.(),
    summary: debugApi?.getSummary?.(),
  });

  const attachResult = attachRuntimeDebugApi(debugApi, {
    globalKey: "LumoRuntimeDebugHarness",
    overwrite: true,
  });
  printSection("RUNTIME DEBUG API ATTACH", attachResult);

  const bootValid = await bootRuntimeBridge({
    levelPath: validLevelPath,
    autoStart: true,
    attachDebugApi: true,
    globalKey: "LumoRuntimeDebugBoot",
    startOptions: { steps: 2, stopOnGrounded: true },
  });

  printSection("RUNTIME BRIDGE BOOT", {
    ok: bootValid.ok,
    startResult: compactResult(bootValid.startResult),
    attachResult: bootValid.attachResult,
    debug: bootValid.debug,
    summary: bootValid.debugApi?.getSummary?.(),
  });

  const partialBridge = createRuntimeBridge().bridge;
  const partialStart = partialBridge.startFromLevelDocument(partialLoaded.level, { startOptions: { steps: 0 } });
  const partialSummaryStart = createRuntimeBridgeSummary(partialBridge);
  const partialUpdate = await partialBridge.update({ steps: 5 });
  const partialPause = await partialBridge.pause();
  const partialResume = await partialBridge.resume();
  const partialReset = await partialBridge.reset();

  printSection("PARTIAL VALID SAMPLE", {
    start: compactResult(partialStart),
    summaryAfterStart: partialSummaryStart,
    update: compactResult(partialUpdate),
    summaryAfterUpdate: createRuntimeBridgeSummary(partialBridge),
    pause: compactResult(partialPause),
    resume: compactResult(partialResume),
    reset: compactResult(partialReset),
  });

  const invalidBridge = createRuntimeBridge().bridge;
  const invalidStart = invalidBridge.startFromLevelDocument(invalidLoaded.level, { startOptions: { steps: 0 } });
  const invalidPathStartNode = await startRuntimeFromLevelPathNode(invalidLevelPath, { steps: 0 });
  const invalidPathStart = await invalidBridge.startFromLevelPath(invalidLevelPath, { startOptions: { steps: 0 } });
  const invalidBoot = await bootRuntimeBridge({
    levelPath: invalidLevelPath,
    autoStart: true,
    attachDebugApi: false,
  });

  printSection("INVALID SAMPLE", {
    invalidDocumentStart: compactResult(invalidStart),
    invalidPathStartNode: compactResult(invalidPathStartNode),
    invalidPathStart: compactResult(invalidPathStart),
    summary: createRuntimeBridgeSummary(invalidBridge),
    status: invalidBridge.getStatus(),
    hasActiveController: invalidBridge.hasActiveController(),
    bootAutoStartInvalid: {
      ok: invalidBoot.ok,
      errors: invalidBoot.errors,
      warnings: invalidBoot.warnings,
      debug: invalidBoot.debug,
    },
  });

  return {
    valid: {
      bridgeCreate,
      validStartFromDocument,
      validStartFromPathNode,
      validStartFromPath,
      validTick,
      validUpdate,
      validPause,
      validResume,
      validReset,
      validRestart,
      validClear,
      bootValid,
      attachResult,
    },
    partial: {
      partialStart,
      partialSummaryStart,
      partialUpdate,
      partialPause,
      partialResume,
      partialReset,
    },
    invalid: {
      invalidStart,
      invalidPathStartNode,
      invalidPathStart,
      invalidBoot,
    },
  };
}

await runDebugLevelLoaderHarness();
