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
  assert.equal(html.includes('ctx.fillStyle = "#60a5fa";'), true, "expected neutral Recharged player color in live Lumo.html path");
  assert.equal(html.includes("isGrounded ? \"#16a34a\" : \"#2563eb\""), false, "should not use grounded/airborne color swapping in live Recharged Lumo.html path");
}

function runBottomGroundPresentationChecks() {
  assert.equal(html.includes("const groundBandTopY ="), true, "expected explicit bottom ground band calculation in live Recharged render path");
  assert.equal(html.includes("ctx.fillRect(0, groundBandTopY, canvas.width, canvas.height - groundBandTopY);"), true, "expected rendered world floor band when player reaches bottom area");
  assert.equal(html.includes("ctx.fillRect(0, Math.max(0, groundBandTopY - 2), canvas.width, 2);"), true, "expected floor lip line for readable grounded contact");
}

runRealRechargedRenderPathChecks();
runBottomGroundPresentationChecks();

console.log("lumo-recharged-runtime-visual-contract-checks: ok");
