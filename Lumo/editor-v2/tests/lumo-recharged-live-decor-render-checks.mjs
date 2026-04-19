import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createLumoRechargedBootAdapter } from "../src/runtime/createLumoRechargedBootAdapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function makeDecorLevelDocument() {
  return {
    identity: { id: "decor-live-lane", formatVersion: "1.0.0", themeId: "test", name: "Decor Live Lane" },
    world: {
      width: 12,
      height: 8,
      tileSize: 24,
      spawn: { x: 2, y: 6 },
    },
    layers: {
      tiles: [],
      background: [],
      decor: [
        {
          decorId: "zeta-flower",
          decorType: "decor_flower_01",
          x: 5,
          y: 6,
          order: 4,
          flipX: false,
          img: "../data/assets/sprites/decor/flower_01.png",
          drawW: 24,
          drawH: 40,
          drawOffX: 0,
          drawOffY: 0,
          drawAnchor: "BL",
        },
        {
          decorId: "alpha-flower",
          decorType: "decor_flower_01",
          x: 6,
          y: 6,
          order: 4,
          flipX: true,
          img: "../data/assets/sprites/decor/flower_01.png",
          drawW: 24,
          drawH: 40,
          drawOffX: 0,
          drawOffY: 0,
          drawAnchor: "BL",
        },
      ],
      entities: [],
      audio: [],
    },
  };
}

async function runDecorRuntimeChainChecks() {
  const adapter = createLumoRechargedBootAdapter({ sourceDescriptor: makeDecorLevelDocument() });
  const prepare = await adapter.prepare();
  const boot = await adapter.boot();
  assert.equal(prepare.ok, true, "adapter should prepare");
  assert.equal(boot.ok, true, "adapter should boot");

  const payload = adapter.getBootPayload();
  const decor = Array.isArray(payload.decorItems) ? payload.decorItems : [];
  assert.equal(decor.length, 2, "decor should survive through live adapter payload chain");
  assert.deepEqual(
    decor.map((item) => item.decorId),
    ["zeta-flower", "alpha-flower"],
    "saved decor order should remain deterministic and preserve insertion order when order ties",
  );
  assert.equal(decor[1].flipX, true, "flipX should survive runtime payload chain");
}

function runLiveRenderLaneContractChecks() {
  const html = fs.readFileSync(path.resolve(repoRoot, "Lumo.html"), "utf8");
  const decorLaneIndex = html.indexOf("for (const decor of decorWorldLane)");
  const entityLaneIndex = html.indexOf("for (const entity of entitySnapshots)");
  assert.equal(decorLaneIndex > 0, true, "live render path must have a dedicated decor lane loop");
  assert.equal(entityLaneIndex > 0, true, "live render path must have an entity lane loop");
  assert.equal(
    decorLaneIndex < entityLaneIndex,
    true,
    "live render order should keep decor lane before entities in Lumo.html",
  );
  assert.equal(
    html.includes("drawRechargedDecorVisual(ctx, mapper, state, decor, worldUnitsToPx, tileSize, worldWidthRaw, worldHeightRaw);"),
    true,
    "live decor lane should consume decor snapshots via drawRechargedDecorVisual",
  );
  assert.equal(
    html.includes("const imageCandidates = buildRechargedDecorImageCandidates(decor?.img);"),
    true,
    "decor lane should resolve authored decor art sources before drawing",
  );
  assert.equal(
    html.includes("if (!resolvedImage) {\n        return;\n      }"),
    true,
    "decor renderer should skip safely when art cannot be resolved",
  );
}

await runDecorRuntimeChainChecks();
runLiveRenderLaneContractChecks();

console.log("lumo-recharged-live-decor-render-checks: ok");
