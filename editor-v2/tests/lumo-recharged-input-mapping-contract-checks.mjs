import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  `expected playable Lumo.html to exist; attempted paths:\n${lumoHtmlCandidates.join("\n")}`,
);

const html = readFileSync(htmlPath, "utf8");
const inputStart = html.indexOf("function installRechargedInputIntentSync() {");
const inputEnd = html.indexOf("function tickLiveRechargedAdapter(state) {");

assert.equal(inputStart >= 0 && inputEnd > inputStart, true, "expected Recharged input sync section in Lumo.html");
const inputSection = html.slice(inputStart, inputEnd);

assert.equal(inputSection.includes('code === "ArrowLeft"'), true, "expected ArrowLeft movement mapping in Recharged input");
assert.equal(inputSection.includes('code === "ArrowRight"'), true, "expected ArrowRight movement mapping in Recharged input");
console.log("recharged input mapping arrows ok");

assert.equal(inputSection.includes('code === "KeyA"') && inputSection.includes("state.jump = pressed"), true, "expected jump to map to KeyA in Recharged input");
console.log("recharged input mapping jump-a ok");

assert.equal(inputSection.includes('code === "KeyS"') && inputSection.includes("state.flare = pressed"), true, "expected flare intent to map to KeyS in Recharged input");
assert.equal(inputSection.includes('code === "KeyD"') && inputSection.includes("state.pulse = pressed"), true, "expected pulse intent to map to KeyD in Recharged input");
console.log("recharged input mapping flare-pulse ok");

assert.equal(
  inputSection.includes('code === "ArrowUp"') || inputSection.includes('code === "KeyW"') || inputSection.includes('code === "Space"'),
  false,
  "expected Recharged input section to omit old fallback jump bindings",
);
assert.equal(
  inputSection.includes('code === "KeyA") {\n          state.left = pressed;') ||
    inputSection.includes('code === "KeyD") {\n          state.right = pressed;'),
  false,
  "expected Recharged input section to omit old A/D movement bindings",
);
console.log("recharged input mapping legacy debug keys removed ok");

const intentStart = html.indexOf("const intent = {");
const intentEnd = html.indexOf("};", intentStart);
const intentSection = intentStart >= 0 && intentEnd > intentStart ? html.slice(intentStart, intentEnd) : "";

assert.equal(intentSection.includes("left:"), true, "expected left in adapter intent");
assert.equal(intentSection.includes("right:"), true, "expected right in adapter intent");
assert.equal(intentSection.includes("jump:"), true, "expected jump in adapter intent");
assert.equal(intentSection.includes("flare:"), true, "expected flare in adapter intent");
assert.equal(intentSection.includes("pulse:"), true, "expected pulse in adapter intent");
console.log("recharged input mapping adapter intent shape ok");
