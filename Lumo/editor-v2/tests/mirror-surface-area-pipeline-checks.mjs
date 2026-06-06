import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateLevelDocument } from "../src/domain/level/levelDocument.js";
import { serializeLevelDocument } from "../src/data/exportLevelDocument.js";
import { loadLevelDocument } from "../src/runtime/loadLevelDocument.js";
import { createRuntimeGameSession } from "../src/runtime/createRuntimeGameSession.js";
import { createLumoRechargedBootAdapter } from "../src/runtime/createLumoRechargedBootAdapter.js";
import { bootLumoRechargedFromQuery } from "../src/runtime/bootLumoRechargedFromQuery.js";
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

function assertCanonicalMirrorPath(holder, label, expectedLength = 1) {
  assert.equal(Array.isArray(holder?.mirrorSurfaceAreas), true, `${label} must expose top-level mirrorSurfaceAreas`);
  assert.equal(holder.mirrorSurfaceAreas.length, expectedLength, `${label} top-level mirrorSurfaceAreas length`);
  assert.equal(holder?.layers?.mirrorSurfaceAreas, undefined, `${label} must not expose layers.mirrorSurfaceAreas`);
}

function runEditorSaveCheck() {
  const validated = validateLevelDocument(withMirrorArea(loadFixture()));
  assertCanonicalMirrorPath(validated, "Editor save document");
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
  console.log("mirror surface editor save path ok");
}

function runEditorExportCheck() {
  const exported = JSON.parse(serializeLevelDocument(withMirrorArea(loadFixture())));
  assertCanonicalMirrorPath(exported, "Editor exported level");
  assert.equal(exported.mirrorSurfaceAreas[0].id, "mirror-row-1");
  assert.equal(exported.mirrorSurfaceAreas[0].width, 96);
  console.log("mirror surface editor export path ok");
}

function runRuntimeLevelObjectCheck() {
  const { runtimeLevel } = v2ToRuntimeLevelObject(withMirrorArea(loadFixture()));
  assertCanonicalMirrorPath(runtimeLevel, "Runtime level object");
  assert.equal(runtimeLevel.mirrorSurfaceAreas[0].id, "mirror-row-1");
  assert.equal(runtimeLevel.mirrorSurfaceAreas[0].width, 96);
  assert.equal(Array.isArray(runtimeLevel.layers.ents), true, "mirror surface must not export as an entity");
  assert.equal(runtimeLevel.layers.ents.some((entity) => entity?.id === "mirror_surface_area"), false);
  console.log("mirror surface runtime level object path ok");
}

async function runRechargedPipelineCheck() {
  const loaded = loadLevelDocument(withMirrorArea(loadFixture()));
  assert.equal(loaded.ok, true);
  assertCanonicalMirrorPath(loaded.level, "Runtime level");

  const session = createRuntimeGameSession({ levelDocument: loaded.level });
  assert.equal(session.start().ok, true);
  const worldSnapshot = session.getWorldSnapshot();
  assertCanonicalMirrorPath(worldSnapshot, "Runtime world packet");
  assert.equal(worldSnapshot.mirrorSurfaceAreas[0].id, "mirror-row-1");

  const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: loaded.level });
  assert.equal((await adapter.prepare()).ok, true);
  assert.equal((await adapter.boot()).ok, true);
  const bootPayload = adapter.getBootPayload();
  assertCanonicalMirrorPath(bootPayload, "Boot payload");
  assert.equal(bootPayload.mirrorSurfaceAreas[0].id, "mirror-row-1");
  console.log("mirror surface recharged pipeline path ok");
}

async function runEmptyNoOpCheck() {
  const source = loadFixture();
  delete source.mirrorSurfaceAreas;
  const loaded = loadLevelDocument(source);
  assert.equal(loaded.ok, true);
  assertCanonicalMirrorPath(loaded.level, "Empty runtime level", 0);
  const session = createRuntimeGameSession({ levelDocument: loaded.level });
  assert.equal(session.start().ok, true);
  assertCanonicalMirrorPath(session.getWorldSnapshot(), "Empty runtime world packet", 0);
  const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: loaded.level });
  await adapter.prepare();
  await adapter.boot();
  assertCanonicalMirrorPath(adapter.getBootPayload(), "Empty boot payload", 0);
  console.log("mirror surface empty no-op path ok");
}

async function runQueryBootPathCheck() {
  const bootArea = withMirrorArea({}).mirrorSurfaceAreas[0];
  const result = await bootLumoRechargedFromQuery({
    search: "?recharged=1",
    createAdapter() {
      return {
        prepare: async () => ({ ok: true }),
        boot: async () => ({ ok: true, booted: true }),
        getBootPayload: () => ({
          ok: true,
          status: "running",
          worldWidth: 8,
          worldHeight: 6,
          tileSize: 24,
          mirrorSurfaceAreas: [bootArea],
        }),
      };
    },
  });
  assert.equal(result.ok, true);
  assertCanonicalMirrorPath(result, "Query boot payload");
  assert.equal(result.mirrorSurfaceAreas[0].id, "mirror-row-1");
  console.log("mirror surface query boot path ok");
}

function runLumoRenderContractCheck() {
  const html = fs.readFileSync(lumoHtmlPath, "utf8");
  assert.equal(html.includes("function readRechargedMirrorSurfaceAreas"), true);
  assert.equal(html.includes("function drawRechargedMirrorSurfaceAreas"), true);
  assert.match(html, /const sourceAreas = Array\.isArray\(payload\?\.mirrorSurfaceAreas\)/, "Lumo.html must read authored mirror areas from payload.mirrorSurfaceAreas");
  assert.doesNotMatch(html, /const sourceAreas = Array\.isArray\(payload\?\.layers\?\.mirrorSurfaceAreas\)/, "Lumo.html must not render from layers.mirrorSurfaceAreas");
  assert.match(html, /const mirrorSurfaceAreas = readRechargedMirrorSurfaceAreas\(payload\);/, "non-empty authored mirrorSurfaceAreas must enter the final render path");
  assert.match(html, /drawRechargedMirrorSurfaceAreas\(ctx, mapper, state, mirrorSurfaceAreas, \{/, "final render must consume the normalized mirrorSurfaceAreas array");
  assert.match(html, /if \(!ctx \|\| !mapper \|\| !state \|\| !Array\.isArray\(mirrorSurfaceAreas\) \|\| mirrorSurfaceAreas\.length === 0\) \{\n\s*return false;/, "empty arrays must remain a draw no-op");
  console.log("mirror surface Lumo.html render path ok");
}

runEditorSaveCheck();
runEditorExportCheck();
runRuntimeLevelObjectCheck();
await runRechargedPipelineCheck();
await runEmptyNoOpCheck();
await runQueryBootPathCheck();
runLumoRenderContractCheck();
