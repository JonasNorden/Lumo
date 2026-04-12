import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");
const lumoHtmlPath = resolve(repoRoot, "Lumo.html");
const html = readFileSync(lumoHtmlPath, "utf8");

function runRealRechargedRenderPathChecks() {
  assert.equal(html.includes("function renderRechargedCanvasFrame(canvas, state)"), true, "expected real Recharged render function in Lumo.html");
  assert.equal(html.includes("const backdropGradient = ctx.createLinearGradient"), true, "expected Recharged runtime background gradient for readability in live Lumo.html path");
  assert.equal(html.includes('ctx.fillStyle = "#60a5fa";'), true, "expected neutral Recharged player body color in live Lumo.html path");
  assert.equal(html.includes('ctx.fillStyle = "#93c5fd";'), true, "expected player head highlight contract in live Recharged Lumo.html path");
  assert.equal(html.includes('ctx.fillStyle = "#dbeafe";'), true, "expected player eye/readability contract in live Recharged Lumo.html path");
  assert.equal(html.includes("isGrounded ? \"#16a34a\" : \"#2563eb\""), false, "should not use grounded/airborne color swapping in live Recharged Lumo.html path");
}

function runSupportGeometryPresentationChecks() {
  assert.equal(html.includes("for (const supportTile of supportTiles)"), true, "expected support drawing to come directly from runtime supportTiles data");
  assert.equal(html.includes("const supportCanvasRect = mapper.worldToCanvasRect"), true, "expected support geometry to stay in true world-to-canvas mapper");
  assert.equal(html.includes('ctx.fillStyle = "#1f2937";'), true, "expected support block base color readability contract");
  assert.equal(html.includes('ctx.fillStyle = "#334155";'), true, "expected support block inner fill readability contract");
  assert.equal(html.includes('ctx.fillStyle = "#94a3b8";'), true, "expected support top-lip readability contract");
}

runRealRechargedRenderPathChecks();
runSupportGeometryPresentationChecks();

console.log("lumo-recharged-runtime-visual-contract-checks: ok");
