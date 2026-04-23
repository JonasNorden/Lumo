import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");
const lumoHtmlPath = resolve(repoRoot, "Lumo.html");
const html = readFileSync(lumoHtmlPath, "utf8");

function runFogRenderGapChecks() {
  assert.equal(
    html.includes("function readRechargedFogSnapshots(payload, state)"),
    true,
    "Expected live Recharged path to normalize fog_volume snapshots.",
  );
  assert.equal(
    html.includes("if (normalizedEntityType === \"fog_volume\") {\n            continue;\n          }"),
    true,
    "Expected fog_volume to be treated as known and skipped by generic entity fallback lane.",
  );
  assert.equal(
    html.includes("lumoBehindFog: render?.lumoBehindFog !== false"),
    true,
    "Expected live fog snapshots to consume authored render.lumoBehindFog truth.",
  );
  assert.equal(
    html.includes("behindWake: Number.isFinite(interaction?.behind) ? Math.max(0, interaction.behind) : 1"),
    true,
    "Expected live fog snapshots to consume authored interaction.behind wake scalar.",
  );
  assert.equal(
    html.includes("pass: \"rear-before-player\""),
    true,
    "Expected live Recharged flow to draw rear fog before Lumo for front-layer authored fog volumes.",
  );
  assert.equal(
    html.includes("pass: \"rear-after-player\""),
    true,
    "Expected live Recharged flow to draw rear fog after Lumo for authored lumoBehindFog volumes.",
  );
  assert.equal(
    html.includes("pass: \"front-after-player\""),
    true,
    "Expected live Recharged flow to keep a front fog veil after Lumo.",
  );
  assert.equal(
    html.includes("const trailing = Math.max(0, Math.min(1, (-signedDx) / Math.max(1, fog.radius * 0.9)));"),
    true,
    "Expected live fog draw path to apply interaction.behind as a trailing wake clear factor.",
  );
}

function runCheckpointAndExitParityChecks() {
  assert.equal(
    html.includes("entity.type === \"checkpoint_01\" || entity.type === \"checkpoint\""),
    true,
    "Expected checkpoint render handling to remain present.",
  );
  assert.equal(
    html.includes("entity.type === \"exit_01\" || entity.type === \"exit\" || entity.type === \"player-exit\""),
    true,
    "Expected exit render handling to remain present.",
  );
}

function runFallbackSafetyChecks() {
  assert.equal(
    html.includes("ctx.fillStyle = entity.hitFlashTicks > 0 ? `rgba(250, 204, 21, ${hitAlpha})` : \"rgba(239, 68, 68, 0.72)\";"),
    true,
    "Expected non-fog generic fallback path to remain available for unknown entities.",
  );
}

runFogRenderGapChecks();
runCheckpointAndExitParityChecks();
runFallbackSafetyChecks();

console.log("lumo-recharged-fog-render-gap-contract-checks: ok");
