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
    html.includes("behind: Number.isFinite(interaction?.behind) ? Math.max(0, interaction.behind) : 1"),
    true,
    "Expected live fog snapshots to consume authored interaction.behind wake scalar.",
  );
  assert.equal(
    html.includes("field: new Float32Array(sampleCount),"),
    true,
    "Expected live fog snapshots to allocate V1 field simulation state.",
  );
  assert.equal(
    html.includes("vel: new Float32Array(sampleCount),"),
    true,
    "Expected live fog snapshots to allocate V1 velocity simulation state.",
  );
  assert.equal(
    html.includes("vel[i] += lap * fog.diffuse * 120 * dt;"),
    true,
    "Expected live fog step to run the V1 diffusion phase.",
  );
  assert.equal(
    html.includes("vel[i] += (0 - field[i]) * fog.relax * 120 * dt;"),
    true,
    "Expected live fog step to run the V1 relax phase.",
  );
  assert.equal(
    html.includes("vel[i] *= fog.visc;"),
    true,
    "Expected live fog step to run the V1 visc damping phase.",
  );
  assert.equal(
    html.includes("field[i] += vel[i] * dt;"),
    true,
    "Expected live fog step to run the V1 integrate phase.",
  );
  assert.equal(
    html.includes("const shift = fog.drift * 0.85 * dt;"),
    true,
    "Expected live fog step to run the V1 drift advection phase.",
  );
  assert.equal(
    html.includes("const wake = (fog.push * fog.behind) * amp * q * q * (0.25 + (0.75 * backMask));"),
    true,
    "Expected live fog step to apply authored push+behind wake strength.",
  );
  assert.equal(
    html.includes("vel[i] += dir * wake * 0.0022;"),
    true,
    "Expected live fog wake to feed directional velocity like V1.",
  );
  assert.equal(
    html.includes("const wave = Math.sin((ix * 0.02) + (t * (0.6 + li * 0.02)))"),
    false,
    "Expected the old sine-wave approximation to no longer drive live fog.",
  );
  assert.equal(
    html.includes("noise: Number.isFinite(look?.noise) ? Math.max(0, look.noise) : 0.14"),
    true,
    "Expected authored look.noise to drive the visible live fog path.",
  );
  assert.equal(
    html.includes("drift: Number.isFinite(look?.drift) ? look.drift : 0"),
    true,
    "Expected authored look.drift to drive the visible live fog path.",
  );
  assert.equal(
    html.includes("diffuse: Number.isFinite(smoothing?.diffuse) ? Math.max(0, smoothing.diffuse) : 0.12"),
    true,
    "Expected authored smoothing.diffuse to drive the visible live fog path.",
  );
  assert.equal(
    html.includes("relax: Number.isFinite(smoothing?.relax) ? Math.max(0, smoothing.relax) : 0.07"),
    true,
    "Expected authored smoothing.relax to drive the visible live fog path.",
  );
  assert.equal(
    html.includes("visc: Number.isFinite(smoothing?.visc) ? Math.max(0, Math.min(1, smoothing.visc)) : 0.96"),
    true,
    "Expected authored smoothing.visc to drive the visible live fog path.",
  );
  assert.equal(
    html.includes("push: Number.isFinite(interaction?.push) ? Math.max(0, interaction.push) : 0.9"),
    true,
    "Expected authored interaction.push to drive the visible live fog path.",
  );
  assert.equal(
    html.includes("bulge: Number.isFinite(interaction?.bulge) ? Math.max(0, interaction.bulge) : 0.85"),
    true,
    "Expected authored interaction.bulge to drive the visible live fog path.",
  );
  assert.equal(
    html.includes("gate: Number.isFinite(interaction?.gate) ? Math.max(0, interaction.gate) : 16"),
    true,
    "Expected authored interaction.gate to drive the visible live fog path.",
  );
  assert.equal(
    html.includes("const playerTopY = playerFootY === null ? null : (playerFootY + 1 - RECHARGED_PLAYER_HITBOX_HEIGHT);"),
    true,
    "Expected live fog step to derive player vertical overlap from the runtime hitbox footprint.",
  );
  assert.equal(
    html.includes("const overlapsHorizontally = (playerRight >= (fogLeft - horizontalContactSlack))"),
    true,
    "Expected live fog step to gate movement influence by per-volume horizontal contact.",
  );
  assert.equal(
    html.includes("const overlapsVertically = (playerBottomY >= (fogTopY - verticalContactSlack))"),
    true,
    "Expected live fog step to gate movement influence by per-volume vertical overlap.",
  );
  assert.equal(
    html.includes("if (!overlapsVertically) continue;"),
    true,
    "Expected live fog step to suppress influence when Lumo is above the fog body.",
  );
  assert.equal(
    html.includes("pass: \"rear-before-player\""),
    true,
    "Expected live Recharged flow to draw rear fog before Lumo for front-layer authored fog volumes.",
  );
  assert.equal(
    html.includes("stepRechargedFogVolumes(fogVolumes, {"),
    true,
    "Expected live Recharged frame flow to step V1 fog simulation before fog render passes.",
  );
  assert.equal(
    html.includes("playerFootY,"),
    true,
    "Expected live Recharged frame flow to provide playerFootY so fog gating can enforce vertical overlap.",
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
