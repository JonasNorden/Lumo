import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDustAreaFromDrag,
  generateDustAreaLayout,
  normalizeDustAreaForEditor,
  updateDustAreaField,
} from "../src/domain/worldAreas.js";
import { validateLevelDocument } from "../src/domain/level/levelDocument.js";
import { serializeLevelDocument } from "../src/data/exportLevelDocument.js";
import { v2ToRuntimeLevelObject } from "../src/runtime/v2ToRuntimeLevelObject.js";
import { loadLevelDocument } from "../src/runtime/loadLevelDocument.js";
import { buildRuntimeWorldSkeleton } from "../src/runtime/buildRuntimeWorldSkeleton.js";
import { buildRuntimeWorldPacket } from "../src/runtime/buildRuntimeWorldPacket.js";
import { getSelectionEditorPanelContent } from "../src/ui/selectionEditorPanel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const editorDustLayerPath = path.resolve(__dirname, "../src/render/layers/dustAreaLayer.js");
const runtimeDustPath = path.resolve(__dirname, "../src/runtime/renderRuntimeDustAreas.js");
const rendererPath = path.resolve(__dirname, "../src/render/renderer.js");
const brushPanelPath = path.resolve(__dirname, "../src/ui/brushPanel.js");
const createEditorAppPath = path.resolve(__dirname, "../src/app/createEditorApp.js");

const baseDoc = {
  meta: { id: "dust-area-test", name: "Dust Area Test", version: "2.0.0" },
  dimensions: { width: 12, height: 8, tileSize: 24 },
  tiles: { base: Array.from({ length: 96 }, () => 0) },
  backgrounds: { layers: [] },
  background: { base: Array.from({ length: 96 }, () => null) },
  decor: [],
  entities: [],
  sounds: [],
  reactiveGrassPatches: [],
  mirrorSurfaceAreas: [],
  stoneAreas: [],
  dustAreas: [],
};

{
  const created = createDustAreaFromDrag(baseDoc, { x: 1, y: 2 }, { x: 4, y: 5 });
  assert.equal(created.id, "dust_area-1");
  assert.equal(created.x, 24);
  assert.equal(created.y, 48);
  assert.equal(created.width, 96);
  assert.equal(created.height, 96);
  assert.equal(created.density, 0.35);
  assert.equal(created.sizeVariation, 0.45);
  assert.equal(created.driftStrength, 0.35);
}

{
  const area = normalizeDustAreaForEditor({ id: "field", width: 120, height: 80, density: 2, sizeVariation: -1, driftStrength: 0.75 });
  assert.equal(area.density, 1);
  assert.equal(area.sizeVariation, 0);
  assert.equal(area.driftStrength, 0.75);
  assert.equal(updateDustAreaField(area, "density", 0.25).density, 0.25);
  assert.equal(updateDustAreaField(area, "sizeVariation", 2).sizeVariation, 1);
  assert.equal(updateDustAreaField(area, "driftStrength", -1).driftStrength, 0);
  assert.equal(updateDustAreaField(area, "width", 240).width, 240);
}

{
  const area = normalizeDustAreaForEditor({ id: "stable", x: 24, y: 48, width: 144, height: 96, density: 0.5, sizeVariation: 0.6, driftStrength: 0.8 });
  const first = generateDustAreaLayout(area);
  const second = generateDustAreaLayout({ ...area });
  assert.deepEqual(second, first, "same authored Dust Area must generate an identical particle anchor layout");
  assert.equal(second, first, "same authored Dust Area reuses the cached particle anchor layout instead of reallocating every frame");
  assert.ok(first.length > 0, "non-empty density should generate dust anchors");
  assert.ok(generateDustAreaLayout({ ...area, density: 0.9 }).length > generateDustAreaLayout({ ...area, density: 0.1 }).length, "density affects particle count");
  assert.deepEqual(generateDustAreaLayout({ ...area, density: 0 }), [], "empty Dust Areas render nothing");
  assert.deepEqual(generateDustAreaLayout({ ...area, enabled: false }), [], "disabled Dust Areas render nothing");
  assert.deepEqual(generateDustAreaLayout({ ...area, visible: false }), [], "hidden Dust Areas render nothing");
  const still = generateDustAreaLayout({ ...area, driftStrength: 0 });
  const drifting = generateDustAreaLayout({ ...area, driftStrength: 1 });
  assert.ok(still.every((particle) => particle.driftX === 0 && particle.driftY === 0), "zero driftStrength removes movement range");
  assert.ok(drifting.some((particle) => particle.driftX > 0 || particle.driftY > 0), "higher driftStrength creates movement range");
  assert.ok(new Set(first.map((particle) => particle.phase)).size > 1, "particles receive independent phases");
}

{
  const authored = validateLevelDocument({
    ...baseDoc,
    dustAreas: [{ id: "authored-dust", x: 24, y: 48, width: 144, height: 96, density: 0.5, sizeVariation: 0.6, driftStrength: 0.8, enabled: true, visible: true }],
  });
  assert.equal(authored.dustAreas.length, 1, "Dust Area saves in the Editor V2 document shape");
  const exported = JSON.parse(serializeLevelDocument(authored));
  assert.equal(exported.dustAreas.length, 1, "Dust Area exports with the level document");
  const runtime = v2ToRuntimeLevelObject(authored);
  assert.equal(runtime.runtimeLevel.dustAreas.length, 1, "Runtime receives authored Dust Areas from the V2 bridge");
  const loaded = loadLevelDocument(authored);
  assert.equal(loaded.level.dustAreas.length, 1, "Recharged runtime loader preserves authored Dust Areas");
  const packet = buildRuntimeWorldPacket({ skeleton: buildRuntimeWorldSkeleton(loaded.level) });
  assert.equal(packet.dustAreas.length, 1, "runtime world packets carry Dust Areas");
}

{
  const oldDustAreaState = {
    document: {
      status: "ready",
      error: null,
      active: {
        ...baseDoc,
        dustAreas: [{ id: "selected-dust", x: 0, y: 0, width: 240, height: 120, density: 0.8, sizeVariation: 1, driftStrength: 0.5, enabled: true, visible: true }],
      },
    },
    interaction: { selectedDustAreaId: "selected-dust", selectedDustAreaIndex: 0 },
  };
  const { markup } = getSelectionEditorPanelContent(oldDustAreaState, { emptyMessage: "No selection" });
  assert.match(markup, />Dust Area · World Phenomena \/ Areas</, "selected Dust Areas render the Dust Area inspector path");
  assert.match(markup, /data-dust-area-field="density"/, "Dust density is editable");
  assert.match(markup, /data-dust-area-field="sizeVariation"/, "Dust sizeVariation is editable");
  assert.match(markup, /data-dust-area-field="driftStrength"/, "Dust driftStrength is editable");
}

{
  const dustLayerSource = fs.readFileSync(editorDustLayerPath, "utf8");
  const runtimeDustSource = fs.readFileSync(runtimeDustPath, "utf8");
  const rendererSource = fs.readFileSync(rendererPath, "utf8");
  const brushSource = fs.readFileSync(brushPanelPath, "utf8");
  const appSource = fs.readFileSync(createEditorAppPath, "utf8");
  assert.match(brushSource, /arm-dust-area/, "World Areas panel exposes Dust Area creation");
  assert.match(appSource, /createDustAreaFromDrag/, "Editor app can create Dust Areas from drag placement");
  assert.match(appSource, /moveDustArea/, "Editor app can move authored Dust Areas");
  assert.match(appSource, /deleteSelectedDustArea/, "Editor app can delete authored Dust Areas");
  assert.match(rendererSource, /renderBackground\(worldCtx, doc, state\.viewport\);\n  renderDustAreas/, "editor preview renders Dust Areas in front of background");
  assert.match(dustLayerSource, /generateDustAreaLayout/, "editor preview uses deterministic generated dust anchors");
  assert.match(runtimeDustSource, /Math\.sin/, "runtime dust uses cheap sinusoidal drift");
  assert.doesNotMatch(runtimeDustSource, /Math\.random/, "runtime dust rendering must not use Math.random");
}

console.log("Dust Area contract checks passed");
