import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateLevelDocument } from "../src/domain/level/levelDocument.js";
import { loadLevelDocument } from "../src/runtime/loadLevelDocument.js";
import { createRuntimeGameSession } from "../src/runtime/createRuntimeGameSession.js";
import { createLumoRechargedBootAdapter } from "../src/runtime/createLumoRechargedBootAdapter.js";
import { v2ToRuntimeLevelObject } from "../src/runtime/v2ToRuntimeLevelObject.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, "../src/data/editorV2SavedLevel.sample.json");
const lumoHtmlPath = path.resolve(__dirname, "../../Lumo.html");

function loadFixture() {
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function withMirrorArea(source) {
  return {
    ...source,
    mirrorSurfaceAreas: [
      {
        id: "mirror-row-1",
        x: 48,
        y: 96,
        width: 96,
        height: 12,
        yOffset: -2,
        enabled: true,
        visible: true,
      },
    ],
  };
}

function runEditorValidationCheck() {
  const validated = validateLevelDocument(withMirrorArea(loadFixture()));
  assert.equal(Array.isArray(validated.mirrorSurfaceAreas), true);
  assert.equal(validated.mirrorSurfaceAreas.length, 1);
  assert.deepEqual(validated.mirrorSurfaceAreas[0], {
    id: "mirror-row-1",
    x: 48,
    y: 96,
    width: 96,
    height: 12,
    yOffset: -2,
    enabled: true,
    visible: true,
  });
  console.log("mirror surface editor validation ok");
}

function runExportCheck() {
  const { runtimeLevel } = v2ToRuntimeLevelObject(withMirrorArea(loadFixture()));
  assert.equal(Array.isArray(runtimeLevel.layers.mirrorSurfaceAreas), true);
  assert.equal(runtimeLevel.layers.mirrorSurfaceAreas[0].id, "mirror-row-1");
  assert.equal(runtimeLevel.layers.mirrorSurfaceAreas[0].width, 96);
  assert.equal(Array.isArray(runtimeLevel.layers.ents), true, "mirror surface must not export as an entity");
  assert.equal(runtimeLevel.layers.ents.some((entity) => entity?.id === "mirror_surface_area"), false);
  console.log("mirror surface v2 export ok");
}

async function runRechargedBootCheck() {
  const loaded = loadLevelDocument(withMirrorArea(loadFixture()));
  assert.equal(loaded.ok, true);
  assert.equal(Array.isArray(loaded.level.layers.mirrorSurfaceAreas), true);
  assert.equal(loaded.level.layers.mirrorSurfaceAreas.length, 1);

  const session = createRuntimeGameSession({ levelDocument: loaded.level });
  assert.equal(session.start().ok, true);
  const worldSnapshot = session.getWorldSnapshot();
  assert.equal(Array.isArray(worldSnapshot.mirrorSurfaceAreas), true);
  assert.equal(worldSnapshot.mirrorSurfaceAreas[0].id, "mirror-row-1");

  const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: loaded.level });
  assert.equal((await adapter.prepare()).ok, true);
  assert.equal((await adapter.boot()).ok, true);
  const bootPayload = adapter.getBootPayload();
  assert.equal(Array.isArray(bootPayload.mirrorSurfaceAreas), true);
  assert.equal(bootPayload.mirrorSurfaceAreas[0].id, "mirror-row-1");
  console.log("mirror surface recharged boot ok");
}

async function runNoFallbackCheck() {
  const source = loadFixture();
  delete source.mirrorSurfaceAreas;
  const loaded = loadLevelDocument(source);
  assert.equal(loaded.ok, true);
  const session = createRuntimeGameSession({ levelDocument: loaded.level });
  assert.equal(session.start().ok, true);
  assert.deepEqual(session.getWorldSnapshot().mirrorSurfaceAreas, []);
  const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: loaded.level });
  await adapter.prepare();
  await adapter.boot();
  assert.deepEqual(adapter.getBootPayload().mirrorSurfaceAreas, []);
  console.log("mirror surface empty no fallback ok");
}

function runLumoRenderContractCheck() {
  const html = fs.readFileSync(lumoHtmlPath, "utf8");
  assert.equal(html.includes("function readRechargedMirrorSurfaceAreas"), true);
  assert.equal(html.includes("function drawRechargedMirrorSurfaceAreas"), true);
  assert.equal(html.includes("mirrorSurfaceAreas"), true);
  console.log("mirror surface Lumo.html render contract ok");
}

runEditorValidationCheck();
runExportCheck();
await runRechargedBootCheck();
await runNoFallbackCheck();
runLumoRenderContractCheck();
