import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function resolveExistingPath(candidates, label) {
  const match = candidates.find((candidatePath) => existsSync(candidatePath));
  assert.ok(match, `expected ${label} to exist; attempted paths:\n${candidates.join("\n")}`);
  return match;
}

const adapterPath = resolveExistingPath(
  [
    resolve(__dirname, "..", "..", "Lumo", "editor-v2", "src", "runtime", "createLumoRechargedBootAdapter.js"),
    resolve(__dirname, "..", "src", "runtime", "createLumoRechargedBootAdapter.js"),
  ],
  "createLumoRechargedBootAdapter.js",
);
const adapterSource = readFileSync(adapterPath, "utf8");
assert.equal(adapterSource.includes("supportTiles: world.supportTiles"), true, "expected adapter boot payload to expose supportTiles");
console.log("support tiles payload contract adapter boot payload ok");

const queryBootPath = resolveExistingPath(
  [
    resolve(__dirname, "..", "..", "Lumo", "editor-v2", "src", "runtime", "bootLumoRechargedFromQuery.js"),
    resolve(__dirname, "..", "src", "runtime", "bootLumoRechargedFromQuery.js"),
  ],
  "bootLumoRechargedFromQuery.js",
);
const queryBootSource = readFileSync(queryBootPath, "utf8");
assert.equal(queryBootSource.includes("supportTiles: Array.isArray(payload.supportTiles) ? payload.supportTiles : []"), true, "expected query boot result to expose supportTiles");
console.log("support tiles payload contract query boot payload ok");

const runtimeSessionPath = resolveExistingPath(
  [
    resolve(__dirname, "..", "..", "Lumo", "editor-v2", "src", "runtime", "createRuntimeGameSession.js"),
    resolve(__dirname, "..", "src", "runtime", "createRuntimeGameSession.js"),
  ],
  "createRuntimeGameSession.js",
);
const runtimeSessionSource = readFileSync(runtimeSessionPath, "utf8");
assert.equal(runtimeSessionSource.includes("worldState?.layers?.tiles"), true, "expected runtime world snapshot to source support geometry from world layer tiles");
console.log("support tiles payload contract runtime world source ok");
