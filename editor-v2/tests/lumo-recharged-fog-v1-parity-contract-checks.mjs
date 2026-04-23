import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../Lumo/src/game/entities.js", import.meta.url), "utf8");

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
  source.includes("vel[i] += dir * wake * 0.0022;"),
  true,
  "fog wake should inject directional velocity feed-through like Smooke",
);
assert.equal(
  source.includes('octx.globalCompositeOperation = "screen";'),
  true,
  "fog draw should use Smooke screen compositing in the offscreen pass",
);
assert.equal(
  source.includes("const org = this._fogOrganicMaskAtX"),
  true,
  "fog draw should apply organic per-sample mask during layer reconstruction",
);
assert.equal(
  source.includes("octx.strokeStyle = `rgba(210,228,255,${Math.min(0.30, f.density * 0.35)})`;"),
  true,
  "fog draw should keep the Smooke top contour stroke",
);

console.log("recharged fog v1 parity contracts ok");
