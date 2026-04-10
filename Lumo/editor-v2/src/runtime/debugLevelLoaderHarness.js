import { loadLevelDocument } from "./loadLevelDocument.js";
import { createRuntimeBridge } from "./createRuntimeBridge.js";
import { createRuntimeBridgeSummary } from "./createRuntimeBridgeSummary.js";
import { createRuntimeGlobalDebugApi } from "./createRuntimeGlobalDebugApi.js";
import { attachRuntimeDebugApi } from "./attachRuntimeDebugApi.js";
import { bootRuntimeBridge } from "./bootRuntimeBridge.js";
import { startRuntimeFromLevelPathNode } from "./startRuntimeFromLevelPathNode.js";
import { buildRuntimePlayerIntent } from "./buildRuntimePlayerIntent.js";
import { stepRuntimePlayerHorizontalState } from "./stepRuntimePlayerHorizontalState.js";
import { buildRuntimePlayerJumpState } from "./buildRuntimePlayerJumpState.js";
import { stepRuntimePlayerVerticalState } from "./stepRuntimePlayerVerticalState.js";
import { stepRuntimePlayerSimulation } from "./stepRuntimePlayerSimulation.js";
import { buildNextRuntimeSessionState } from "./buildNextRuntimeSessionState.js";
import { updateRuntimeSession } from "./updateRuntimeSession.js";
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

// Tiny deterministic world fixture for intent + horizontal/simulation runtime stepping checks.
const steppingWorldPacket = {
  world: {
    width: 10,
    height: 6,
    tileSize: 16,
  },
  layers: {
    tiles: [
      // Left wall at x=2 and right wall at x=5 around y=2.
      { x: 32, y: 32, w: 16, h: 16 },
      { x: 80, y: 32, w: 16, h: 16 },
      // Ground row for grounded checks.
      { x: 0, y: 64, w: 160, h: 16 },
    ],
  },
};

const steppingPlayerState = {
  ok: true,
  position: { x: 64, y: 47 },
  velocity: { x: 0, y: 0 },
  grounded: true,
  falling: false,
  rising: false,
  landed: false,
};

const steppingAirPlayerState = {
  ...steppingPlayerState,
  position: { x: 64, y: 24 },
  grounded: false,
  falling: true,
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

function compactTrace(trace) {
  if (!Array.isArray(trace)) {
    return [];
  }

  return trace.map((entry) => ({
    tick: entry?.tick ?? null,
    x: entry?.x ?? null,
    y: entry?.y ?? null,
    grounded: entry?.grounded === true,
    falling: entry?.falling === true,
    rising: entry?.rising === true,
    landed: entry?.landed === true,
    moveX: entry?.moveX ?? 0,
    jump: entry?.jump === true,
    blockedLeft: entry?.blockedLeft === true,
    blockedRight: entry?.blockedRight === true,
    status: entry?.status ?? null,
  }));
}

// Runs focused boot/bridge/debug-api checks for valid, partial-valid, and invalid samples.
export async function runDebugLevelLoaderHarness() {
  const validLoaded = loadLevelDocument(testLevelDocument);
  const partialLoaded = loadLevelDocument(partialValidSampleLevel);
  const invalidLoaded = loadLevelDocument(invalidSampleLevel);

  const intentChecks = {
    defaults: buildRuntimePlayerIntent(),
    left: buildRuntimePlayerIntent({ moveX: -1, jump: true }),
    rightString: buildRuntimePlayerIntent({ moveX: "right", run: true }),
    invalid: buildRuntimePlayerIntent("bad-intent"),
  };
  printSection("RUNTIME PLAYER INTENT", intentChecks);

  const horizontalChecks = {
    moveLeftOpen: stepRuntimePlayerHorizontalState(steppingWorldPacket, steppingPlayerState, intentChecks.left),
    moveRightOpen: stepRuntimePlayerHorizontalState(steppingWorldPacket, steppingPlayerState, intentChecks.rightString),
    blockedLeft: stepRuntimePlayerHorizontalState(
      steppingWorldPacket,
      { ...steppingPlayerState, position: { x: 48, y: 47 } },
      intentChecks.left,
    ),
    blockedRight: stepRuntimePlayerHorizontalState(
      steppingWorldPacket,
      { ...steppingPlayerState, position: { x: 78, y: 47 } },
      intentChecks.rightString,
    ),
  };
  printSection("RUNTIME PLAYER HORIZONTAL STEP", horizontalChecks);

  const jumpStateChecks = {
    groundedJump: buildRuntimePlayerJumpState(steppingWorldPacket, steppingPlayerState, { jump: true }),
    airJumpBlocked: buildRuntimePlayerJumpState(steppingWorldPacket, steppingAirPlayerState, { jump: true }),
    noJump: buildRuntimePlayerJumpState(steppingWorldPacket, steppingPlayerState, { jump: false }),
    invalid: buildRuntimePlayerJumpState(null, { position: { x: null, y: null } }, { jump: true }),
  };
  printSection("RUNTIME PLAYER JUMP STATE", jumpStateChecks);

  const verticalStepChecks = {
    jumpRising: stepRuntimePlayerVerticalState(steppingWorldPacket, {
      ...steppingPlayerState,
      grounded: false,
      velocity: { x: 0, y: -8 },
    }),
    airFalling: stepRuntimePlayerVerticalState(steppingWorldPacket, steppingAirPlayerState),
    landing: stepRuntimePlayerVerticalState(steppingWorldPacket, {
      ...steppingAirPlayerState,
      position: { x: 64, y: 62 },
      velocity: { x: 0, y: 2 },
      grounded: false,
    }),
    invalid: stepRuntimePlayerVerticalState(null, { position: { x: null, y: null } }),
  };
  printSection("RUNTIME PLAYER VERTICAL STEP", verticalStepChecks);

  const simulationChecks = {
    jumpStart: stepRuntimePlayerSimulation(steppingWorldPacket, steppingPlayerState, { input: { jump: true } }),
    jumpBlockedInAir: stepRuntimePlayerSimulation(steppingWorldPacket, steppingAirPlayerState, { input: { jump: true } }),
    moveAndJump: stepRuntimePlayerSimulation(steppingWorldPacket, steppingPlayerState, { input: { moveX: 1, jump: true } }),
    moveRightBlocked: stepRuntimePlayerSimulation(
      steppingWorldPacket,
      { ...steppingPlayerState, position: { x: 78, y: 47 } },
      { input: { moveX: 1 } },
    ),
    invalid: stepRuntimePlayerSimulation(null, { position: { x: null, y: null } }, { input: { jump: true } }),
  };
  printSection("RUNTIME PLAYER SIMULATION JUMP", simulationChecks);

  const validStartFromDocument = createRuntimeBridge().bridge.startFromLevelDocument(validLoaded.level, { startOptions: { steps: 0 } });
  const validSessionSeed = validStartFromDocument?.summary?.ok ? validStartFromDocument : null;

  const bridgeCreate = createRuntimeBridge();
  const bridge = bridgeCreate.bridge;
  printSection("RUNTIME BRIDGE CREATE", {
    ok: bridgeCreate.ok,
    status: bridge.getStatus(),
    hasActiveController: bridge.hasActiveController(),
  });

  const idleSummary = createRuntimeBridgeSummary(bridge);
  printSection("RUNTIME BRIDGE SUMMARY", idleSummary);

  const validStart = bridge.startFromLevelDocument(validLoaded.level, { startOptions: { steps: 0 } });
  printSection("RUNTIME BRIDGE START FROM DOCUMENT", compactResult(validStart));

  const validSummaryAfterDocumentStart = createRuntimeBridgeSummary(bridge);
  printSection("RUNTIME BRIDGE SUMMARY", validSummaryAfterDocumentStart);

  const sessionStepWithJump = buildNextRuntimeSessionState(bridge.getActiveSession(), { input: { jump: true, moveX: 1 } });
  printSection("RUNTIME SESSION STEP WITH JUMP", {
    ok: sessionStepWithJump?.ok === true,
    step: sessionStepWithJump?.step,
    player: sessionStepWithJump?.session?.player ?? null,
    errors: sessionStepWithJump?.errors ?? [],
    warnings: sessionStepWithJump?.warnings ?? [],
  });

  const sessionUpdateWithJump = updateRuntimeSession(bridge.getActiveSession(), {
    steps: 16,
    inputSequence: [{ jump: true, moveX: 1 }, ...new Array(15).fill({ moveX: 1 })],
  });
  printSection("RUNTIME SESSION UPDATE WITH JUMP", {
    ok: sessionUpdateWithJump?.ok === true,
    trace: compactTrace(sessionUpdateWithJump?.trace),
    finalPlayer: sessionUpdateWithJump?.session?.player ?? null,
    errors: sessionUpdateWithJump?.errors ?? [],
    warnings: sessionUpdateWithJump?.warnings ?? [],
  });

  const validTick = await bridge.tick({ input: { moveX: -1 } });
  printSection("RUNTIME BRIDGE TICK", compactResult(validTick));

  const validUpdate = await bridge.update({
    steps: 8,
    inputSequence: [{ moveX: -1 }, { moveX: -1 }, { moveX: -1 }, { moveX: 1 }, { moveX: 1 }, { moveX: 1 }],
    stopOnGrounded: true,
  });
  printSection("RUNTIME BRIDGE UPDATE", {
    ...compactResult(validUpdate),
    trace: compactTrace(validUpdate?.trace),
  });

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
  const partialUpdate = await partialBridge.update({
    steps: 8,
    inputSequence: [{ jump: true }, { moveX: 1 }, { moveX: 1 }, { moveX: 1 }],
  });
  const partialPause = await partialBridge.pause();
  const partialResume = await partialBridge.resume();
  const partialReset = await partialBridge.reset();

  printSection("PARTIAL VALID SAMPLE", {
    start: compactResult(partialStart),
    summaryAfterStart: partialSummaryStart,
    update: {
      ...compactResult(partialUpdate),
      trace: compactTrace(partialUpdate?.trace),
    },
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
    runtimeChecks: {
      intentChecks,
      horizontalChecks,
      simulationChecks,
      jumpStateChecks,
      verticalStepChecks,
      sessionStepWithJump,
      sessionUpdateWithJump,
      validSessionSeed,
    },
    valid: {
      bridgeCreate,
      validStart,
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
