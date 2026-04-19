import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, "../../Lumo.html");
const html = fs.readFileSync(htmlPath, "utf8");

assert.equal(
  html.includes("function tickLiveRechargedAdapter(state) {"),
  true,
  "Recharged runtime must expose the live tick loop in Lumo.html.",
);

const tickCall = /function tickLiveRechargedAdapter\(state\) \{[\s\S]*?syncRechargedFireflyAudio\(livePayload, state\);[\s\S]*?\n    \}/m;
assert.equal(
  tickCall.test(html),
  true,
  "Firefly audio must run from inside tickLiveRechargedAdapter so it executes in the active runtime loop.",
);

const frameLoop = /const runFrame = \(\) => \{[\s\S]*?tickLiveRechargedAdapter\(state\);[\s\S]*?renderRechargedCanvasFrame\(canvas, state\);[\s\S]*?\};/m;
assert.equal(
  frameLoop.test(html),
  true,
  "requestAnimationFrame loop must tick then render every frame in active Recharged mode.",
);

assert.equal(
  html.includes("payload.rechargedFireflyAudio = {"),
  true,
  "Runtime payload must publish live firefly audio state for execution visibility.",
);

assert.equal(
  html.includes("realAudioCount"),
  true,
  "Runtime payload must report realAudioCount so browser inspection can prove real playback objects exist.",
);

assert.equal(
  html.includes("playingCount"),
  true,
  "Runtime payload must report playingCount so browser inspection can confirm active playback state.",
);

assert.equal(
  html.includes("samplePaused"),
  true,
  "Runtime payload must report samplePaused for quick paused-state inspection.",
);

assert.equal(
  html.includes("sampleVolume"),
  true,
  "Runtime payload must report sampleVolume for quick gain inspection.",
);

console.log("lumo-recharged-firefly-audio-loop-wiring-checks: ok");
