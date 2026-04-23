import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../Lumo/src/game/entities.js", import.meta.url), "utf8");

const diffusionIdx = source.indexOf("vel[i] += lap * D * 120 * dt;");
const relaxIdx = source.indexOf("vel[i] += (0 - field[i]) * R * 120 * dt;");
const viscIdx = source.indexOf("vel[i] *= V;");
const integrateIdx = source.indexOf("field[i] += vel[i] * dt;");
const clampIdx = source.indexOf("if (field[i] > 2.2) field[i] = 2.2;");
const driftIdx = source.indexOf("const shift = f.drift * 0.85 * dt;");

assert.equal(
  diffusionIdx >= 0 && relaxIdx > diffusionIdx && viscIdx > relaxIdx && integrateIdx > viscIdx && clampIdx > integrateIdx && driftIdx > clampIdx,
  true,
  "fog sim should keep V1 order: diffusion -> relax -> visc -> integrate -> clamp -> drift",
);
assert.equal(
  source.includes('const behind = (typeof interaction.behind === "number") ? interaction.behind : 1;'),
  true,
  "fog spawn should read authored interaction.behind wake strength",
);
assert.equal(
  source.includes("const noise     = (typeof look.noise     === \"number\") ? look.noise     : 0.14;"),
  true,
  "fog spawn should read authored look.noise",
);
assert.equal(
  source.includes("const drift     = (typeof look.drift     === \"number\") ? look.drift     : 0;"),
  true,
  "fog spawn should read authored look.drift",
);
assert.equal(
  source.includes("const N = Math.max(260, Math.floor(widthPx / 1.4));"),
  true,
  "fog field resolution should match Smooke sample density",
);
assert.equal(
  source.includes("const field = new Float32Array(N);"),
  true,
  "fog sim should allocate the V1 field lane",
);
assert.equal(
  source.includes("const vel   = new Float32Array(N);"),
  true,
  "fog sim should allocate the V1 velocity lane",
);
assert.equal(
  source.includes("if ((this._fogFrame % 3) === 0 && this._fogVolumes.length)"),
  false,
  "runtime fog update should no longer use the old every-third-frame approximation gate",
);
assert.equal(
  source.includes("const wake = f.push * f.behind * amp * q*q * (0.25 + (0.75 * backMask));"),
  true,
  "fog wake should combine authored push and behind terms",
);
assert.equal(
  source.includes("if (speed > f.gate){"),
  true,
  "fog interaction should be speed-gated by authored interaction.gate",
);
assert.equal(
  source.includes("const ridge = f.bulge * amp * q*q * (0.18 + (0.82 * frontMask));"),
  true,
  "fog forward bulge should be sourced by authored interaction.bulge",
);
assert.equal(
  source.includes("vel[i] += dir * wake * 0.0022;"),
  true,
  "fog wake should inject directional velocity feed-through like Smooke",
);
assert.equal(
  source.includes("if (id === \"water_volume\" || id === \"lava_volume\" || id === \"bubbling_liquid_volume\"){"),
  true,
  "non-fog liquid runtime lane should remain present",
);
assert.equal(
  source.includes("if (id === \"hover_void_01\"){"),
  true,
  "non-fog entity runtime lane should remain present",
);

console.log("recharged fog v1 parity contracts ok");
