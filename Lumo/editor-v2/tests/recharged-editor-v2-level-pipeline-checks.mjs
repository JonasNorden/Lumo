import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadLevelDocument } from "../src/runtime/loadLevelDocument.js";
import { startRuntimeFromLevelUrl } from "../src/runtime/startRuntimeFromLevelUrl.js";
import { bootLumoRechargedFromQuery } from "../src/runtime/bootLumoRechargedFromQuery.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRelativePath = "../src/data/editorV2SavedLevel.sample.json";
const fixturePath = path.resolve(__dirname, fixtureRelativePath);
const fixtureUrlPath = "editor-v2/src/data/editorV2SavedLevel.sample.json";

function loadEditorFixture() {
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function createFileFetchStub() {
  return async function fetchStub(url) {
    const normalized = String(url || "").replace(/^https?:\/\/[^/]+\//, "");
    const fromRoot = path.resolve(__dirname, "../../", normalized);
    if (!fs.existsSync(fromRoot)) {
      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        async text() {
          return "";
        },
        async json() {
          return {};
        },
      };
    }

    const text = fs.readFileSync(fromRoot, "utf8");
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      async text() {
        return text;
      },
      async json() {
        return JSON.parse(text);
      },
    };
  };
}

async function withPatchedFetch(run) {
  const originalFetch = globalThis.fetch;
  const originalLocation = globalThis.location;
  globalThis.fetch = createFileFetchStub();
  globalThis.location = { href: "http://localhost/Lumo.html?recharged=1" };

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.location = originalLocation;
  }
}

function runEditorFixtureConversionChecks() {
  const source = loadEditorFixture();
  const loaded = loadLevelDocument(source);

  assert.equal(loaded.ok, true);
  assert.equal(loaded.level?.identity?.id, "editor-v2-authored-sample");
  assert.equal(loaded.level?.world?.width, 8);
  assert.equal(loaded.level?.world?.height, 6);
  assert.equal(loaded.level?.world?.spawn?.x, 2);
  assert.equal(loaded.level?.world?.spawn?.y, 1);
  assert.equal(Array.isArray(loaded.level?.layers?.tiles), true);
  assert.equal(loaded.level.layers.tiles.length > 0, true);

  console.log("editor v2 conversion ok");
}

async function runRuntimeStartChecks() {
  await withPatchedFetch(async () => {
    const result = await startRuntimeFromLevelUrl(fixtureUrlPath, { steps: 0 });

    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.levelDocument?.identity?.id, "editor-v2-authored-sample");
    assert.equal(result.initialization?.world?.id, "editor-v2-authored-sample");
    assert.equal(result.initialization?.player?.startPosition?.x, 2);
    assert.equal(result.initialization?.player?.startPosition?.y, 1);
  });

  console.log("editor v2 runtime start ok");
}

async function runQueryContractChecks() {
  await withPatchedFetch(async () => {
    const encodedPath = encodeURIComponent(fixtureUrlPath);
    const result = await bootLumoRechargedFromQuery({
      search: `?recharged=1&level=${encodedPath}`,
    });

    assert.equal(result.enabled, true);
    assert.equal(result.booted, true);
    assert.equal(result.ok, true);
    assert.equal(result.levelSourceType, "url");
    assert.equal(result.worldId, "editor-v2-authored-sample");
    assert.equal(Number.isFinite(result.playerX), true);
    assert.equal(Number.isFinite(result.playerY), true);
  });

  await withPatchedFetch(async () => {
    const result = await bootLumoRechargedFromQuery({
      search: "?recharged=1&level=chrome-extension://bad/path.json",
    });

    assert.equal(result.enabled, true);
    assert.equal(result.levelSourceType, "default-url");
    assert.equal(result.warnings.some((warning) => warning.includes("Invalid level query path")), true);
  });

  console.log("editor v2 query contract ok");
}

runEditorFixtureConversionChecks();
await runRuntimeStartChecks();
await runQueryContractChecks();

console.log("recharged-editor-v2-level-pipeline-checks: ok");
