import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createRuntimeRunner } from "../../Lumo/editor-v2/src/runtime/createRuntimeRunner.js";
import { createRuntimeGameSession } from "../../Lumo/editor-v2/src/runtime/createRuntimeGameSession.js";
import { createLumoRechargedBootAdapter } from "../../Lumo/editor-v2/src/runtime/createLumoRechargedBootAdapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixtureLevelPath = resolve(__dirname, "..", "..", "Lumo", "editor-v2", "src", "data", "testLevelDocument.v1.json");

function loadFixtureLevelDocument() {
  return JSON.parse(readFileSync(fixtureLevelPath, "utf8"));
}

function assertPulseShape(pulse, messagePrefix) {
  assert.equal(typeof pulse, "object", `${messagePrefix}: expected pulse object`);
  assert.equal(typeof pulse.active, "boolean", `${messagePrefix}: expected pulse.active boolean`);
  assert.equal(Number.isFinite(pulse.r), true, `${messagePrefix}: expected pulse.r number`);
  assert.equal(Number.isFinite(pulse.alpha), true, `${messagePrefix}: expected pulse.alpha number`);
  assert.equal(Number.isFinite(pulse.thickness), true, `${messagePrefix}: expected pulse.thickness number`);
  assert.equal(Number.isFinite(pulse.id), true, `${messagePrefix}: expected pulse.id number`);
  assert.equal(Number.isFinite(pulse.x), true, `${messagePrefix}: expected pulse.x number`);
  assert.equal(Number.isFinite(pulse.y), true, `${messagePrefix}: expected pulse.y number`);
}

function runRuntimeAndSessionPulseChecks() {
  const levelDocument = loadFixtureLevelDocument();

  const runner = createRuntimeRunner({ levelDocument });
  assert.equal(runner.start().ok, true, "expected runner start");

  const runnerBefore = runner.getState().playerState;
  assert.equal(runnerBefore?.pulse?.active === true, false, "expected runner pulse inactive before D");

  const runnerTick = runner.step({ input: { pulse: true } });
  assert.equal(runnerTick.ok, true, "expected runner pulse tick ok");
  assert.equal(runnerTick.stepped, true, "expected runner pulse tick stepped");

  const runnerAfter = runner.getState().playerState;
  assert.equal(runnerAfter?.pulse?.active, true, "expected runner pulse active after D");
  assertPulseShape(runnerAfter.pulse, "runner pulse");

  const session = createRuntimeGameSession({ levelDocument });
  assert.equal(session.start().ok, true, "expected session start");

  const sessionBefore = session.getPlayerSnapshot();
  assert.equal(sessionBefore.pulse?.active === true, false, "expected session pulse inactive before D");

  const sessionTick = session.tick({ pulse: true });
  assert.equal(sessionTick.ok, true, "expected session pulse tick ok");
  assert.equal(sessionTick.stepped, true, "expected session pulse tick stepped");

  const sessionAfter = session.getPlayerSnapshot();
  assert.equal(sessionAfter.pulse?.active, true, "expected session pulse active after D");
  assertPulseShape(sessionAfter.pulse, "session pulse");

  let sawGrowingRadius = false;
  let sawFadingAlpha = false;
  let previousRadius = sessionAfter.pulse.r;
  let previousAlpha = sessionAfter.pulse.alpha;
  for (let i = 0; i < 15; i += 1) {
    session.tick({ pulse: false });
    const snapshot = session.getPlayerSnapshot();
    if (snapshot.pulse?.active === true) {
      if (snapshot.pulse.r > previousRadius) {
        sawGrowingRadius = true;
      }
      if (snapshot.pulse.alpha < previousAlpha) {
        sawFadingAlpha = true;
      }
      previousRadius = snapshot.pulse.r;
      previousAlpha = snapshot.pulse.alpha;
    }
  }

  assert.equal(sawGrowingRadius, true, "expected session pulse radius growth over ticks");
  assert.equal(sawFadingAlpha, true, "expected session pulse alpha fade over ticks");

  let pulseEnded = false;
  for (let i = 0; i < 100; i += 1) {
    session.tick({ pulse: false });
    const snapshot = session.getPlayerSnapshot();
    if (snapshot.pulse?.active !== true) {
      pulseEnded = true;
      break;
    }
  }
  assert.equal(pulseEnded, true, "expected session pulse to clear after lifetime");

  session.tick({ right: true });
  const moveSnapshot = session.getPlayerSnapshot();
  assert.equal(Number.isFinite(moveSnapshot.x), true, "expected movement snapshot x to remain finite");
  session.tick({ flare: true });
  const flareSnapshot = session.getPlayerSnapshot();
  assert.equal(Array.isArray(flareSnapshot.flares), true, "expected flare contract to remain array");

  console.log("live pulse state chain runtime-session checks ok");
}

async function runAdapterPulseChecks() {
  const levelDocument = loadFixtureLevelDocument();
  const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: { levelDocument } });

  const prepareResult = await adapter.prepare();
  assert.equal(prepareResult.ok, true, "expected adapter prepare");

  const bootResult = await adapter.boot();
  assert.equal(bootResult.ok, true, "expected adapter boot");

  const beforePulse = adapter.getPlayerSnapshot();
  assert.equal(beforePulse.pulse?.active === true, false, "expected adapter pulse inactive before D");

  const pulseTick = adapter.tick({ pulse: true });
  assert.equal(pulseTick.ok, true, "expected adapter pulse tick ok");
  assert.equal(pulseTick.stepped, true, "expected adapter pulse tick stepped");

  const afterPulse = adapter.getPlayerSnapshot();
  assert.equal(afterPulse.pulse?.active, true, "expected adapter pulse active after D");
  assertPulseShape(afterPulse.pulse, "adapter pulse");

  const payloadPulse = adapter.getBootPayload();
  assert.equal(payloadPulse.ok, true, "expected adapter payload ok");

  adapter.tick({ pulse: false, right: true });
  adapter.tick({ flare: true, pulse: false });
  const afterSystemsTick = adapter.getPlayerSnapshot();
  assert.equal(Number.isFinite(afterSystemsTick.x), true, "expected movement snapshot through adapter");
  assert.equal(Array.isArray(afterSystemsTick.flares), true, "expected flare list through adapter");

  console.log("live pulse state chain adapter snapshot checks ok");
}

runRuntimeAndSessionPulseChecks();
await runAdapterPulseChecks();
