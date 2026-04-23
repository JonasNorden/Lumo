# Fog Truth Mapping Report (Old .js Runtime vs Recharged Lumo.html)

## A. Real old-runtime fog truth file(s)

1. `Lumo/src/game/entities.js`
   - Fog parameter ingest/runtime allocation in `spawnFromDef` for `id === "fog_volume"`.
   - Fog simulation in `update(...)` under `// --- FogVolume update (strict Smooke/V1 parity) ---`.
   - Fog render reconstruction in `drawOverDarkness(ctx, cam)`.
2. `Lumo/src/app.js`
   - Legacy gameplay render ordering that places fog pass relative to darkness and player/world rendering.

## B. Proof that these are the actual behavioral source of truth

1. `Lumo/Lumo.html` loads legacy runtime files (`src/game/entities.js`, `src/app.js`) as the non-Recharged gameplay path and only uses Recharged query boot when enabled/booted.
2. `Lumo/Lumo.html` explicitly falls back to loading `src/app.js` when Recharged query boot is not active/successful.
3. The parity contract test in `editor-v2/tests/lumo-recharged-fog-v1-parity-contract-checks.mjs` uses `Lumo/src/game/entities.js` as the checked V1 source and asserts exact fog equations/constants from that file.
4. `smooke.html` is a fog lab/sandbox implementation. Its equations are mirrored in legacy runtime, but the shipped old .js gameplay path is `src/app.js` + `src/game/entities.js`.

## C. Old-runtime fog parameter map

### Spawn/authoring map (`spawnFromDef` fog_volume)

| Parameter | Source path | Runtime field | Actual effect in old runtime |
|---|---|---|---|
| `area.x0/x1/y0` | `params.params.area` or `params.area` | `x0/x1/y0` | Horizontal fog span and base line (bottom) in world px. |
| `area.falloff` | same | `falloff` | Right-edge taper width in render masking (`dOpen = fogWidth - x`). |
| `look.density` | `look` | `density` | Per-layer alpha scale. |
| `look.lift` | `look` | `lift` | Raises top contour baseline. |
| `look.thickness` | `look` | `thickness` | Vertical layer spread. |
| `look.layers` | `look` | `layers` (clamped 8..36) | Number of stacked fog slices. |
| `look.noise` | `look` | `noise` | Wave/noise contribution to contour displacement. |
| `look.drift` | `look` | `drift` | Advection shift of field over time (`shift = drift * 0.85 * dt`). |
| `look.color` | `look` | `color` | Fog tint RGB. |
| `look.exposure` | `look` | `exposure` | Multiplier on fill alpha. |
| `smoothing.diffuse` | `smoothing` | `diffuse` | Laplacian force into velocity. |
| `smoothing.relax` | `smoothing` | `relax` | Pulls field back toward 0. |
| `smoothing.visc` | `smoothing` | `visc` | Velocity damping. |
| `interaction.radius` | `interaction` | `radius` | Interaction footprint radius in px (converted to cells). |
| `interaction.push` | `interaction` | `push` | Wake suction magnitude multiplier. |
| `interaction.behind` | `interaction` | `behind` | Extra multiplier on wake (`push * behind`). |
| `interaction.bulge` | `interaction` | `bulge` | Forward bulge magnitude multiplier. |
| `interaction.gate` | `interaction` | `gate` | Speed threshold for any interaction response. |
| `organic.strength/scale/speed` | `organic` | `orgStrength/orgScale/orgSpeed` | Organic mask shaping in render only (not simulation forces). |
| `render.blend` | `render` | `blend` | Canvas composite mode (`screen`/`normal`/`add`). |

### Fixed constants/derived runtime lanes (old runtime)

- Field resolution: `N = max(260, floor(widthPx / 1.4))`.
- State lanes: `field[N]`, `vel[N]`, persistent `t`.
- Clamp: `field[i] ∈ [-2.2, 2.2]`.

## D. Old-runtime front bulge behavior

Front bulge is generated only when `abs(player.vx) > gate`.

- Direction: `dir = (vx >= 0) ? 1 : -1`.
- Amplitude: `amp = min(2.2, speed / 210)`.
- Center offset ahead of player center: `ahead = max(2, floor(radCells * 0.35))`.
- Radius: `radCells = max(3, floor(radius / pxPerCell))`.
- Kernel:
  - `u = (k / radCells) * dir`
  - `frontMask = smooth01(u + 0.05)`
  - `q = 1 - abs(k)/radCells`
  - `ridge = bulge * amp * q*q * (0.18 + 0.82*frontMask)`
  - Injected as `field[i] += ridge * 0.32`

No direct bulge velocity feed-through is applied in old runtime.

## E. Old-runtime trailing suction / wake behavior

Trailing wake is generated in the same speed-gated block.

- Behind center offset: `back = max(1, floor(radCells * 0.15))`.
- Kernel:
  - `u = (k / radCells) * dir`
  - `backMask = smooth01((-u) + 0.10)`
  - `q = 1 - abs(k)/radCells`
  - `wake = push * behind * amp * q*q * (0.25 + 0.75*backMask)`
  - Injected as `field[i] -= wake * 0.46`
  - Directional velocity feed-through: `vel[i] += dir * wake * 0.0022`

This wake term is the old-runtime suction truth behind Lumo.

## F. Old-runtime render reconstruction behavior

1. Simulation/render coupling:
   - Render reads only positive displacement for bulge: `bulge = max(0, field[i])`.
   - Negative values (wake) do not carve downward geometry directly; they suppress future positive bulge and alter temporal recovery via field/vel dynamics.
2. Contour reconstruction:
   - Multi-layer fill with `alphaBase = (density*0.18) * (0.22 + sliceAlpha*0.98)`.
   - Layer vertical base: `yBase = baseY - a*thickness`.
   - Wave term from `noise`.
   - Bulge lift: subtract `bulge * (10 + (1-a)*30)`.
   - Top contour stroke uses `bulge * 22`.
3. Edge masking:
   - Right-side openness taper uses `dOpen = fogWidth - x`, `mask = smooth01(dOpen/falloffPx)`.
4. Layering with player:
   - In `smooke.html`: conditional order around `drawLumo()`, with front pass always after Lumo.
   - In old app runtime (`src/app.js`): fog pass is invoked before darkness (`ents.drawOverDarkness(...)` then `drawDarkness(...)`).

## G. Current Recharged fog behavior in Lumo.html

Recharged fog logic in `Lumo/Lumo.html` diverges from old runtime in multiple concrete places:

1. Parameter defaults are changed:
   - `diffuse 0.12` vs old `0.24`.
   - `relax 0.07` vs old `0.24`.
   - `visc 0.96` vs old `0.94`.
   - `push 0.9` vs old `2.4`.
   - `bulge 0.85` vs old `2.2`.
   - `gate 16` vs old `70`.
2. Organic mask source changed:
   - Uses `look.noise` as organic strength proxy; old runtime uses explicit `organic.strength/scale/speed`.
3. Front bulge equations/constants changed:
   - `amp = speed/195` (+ reversal multiplier 1.12) vs old `speed/210` without reversal boost.
   - ahead offset `0.26` vs old `0.35`.
   - front mask uses `smooth01(normalized - 0.06)` vs old `smooth01(u + 0.05)`.
   - kernel weight changed to `q*q*(0.84 + 0.16*q)` vs old `q*q`.
   - field injection `*0.24` vs old `*0.32`.
   - added bulge velocity injection `vel += ridge*0.0024` (old runtime has none).
4. Wake equations/constants changed:
   - behind offset `0.24` vs old `0.15`.
   - back mask `smooth01((-normalized) - 0.04)` vs old `smooth01((-u) + 0.10)`.
   - kernel `q^3` vs old `q^2`.
   - wake scale `(0.18 + 0.82*backMask)` vs old `(0.25 + 0.75*backMask)`.
   - field subtraction `*0.33` vs old `*0.46`.
   - velocity feed-through `*0.0031` vs old `*0.0022`.
5. Render falloff mask changed from right-open-only to bilateral center-distance falloff:
   - Recharged uses `d = min(x, width-x)` and symmetric edge mask.
   - Old runtime uses right-side distance-to-open-end (`fogWidth - x`) only.
6. Recharged layering/order is changed to a 3-pass around player (`rear-before`, `rear-after`, `front-after`) instead of legacy `app.js` ordering.

## H. Exact mismatch list

1. **Wrong truth defaults in Recharged normalization**: authored-missing params resolve to different defaults than old runtime for smoothing/interaction core terms.
2. **Front bulge overexpression**: lower gate (16), higher speed gain (`/195`) and reversal boost (1.12) produce earlier and stronger activation across normal movement envelopes than old runtime.
3. **Wake underrepresentation in field shape**: wake subtraction coefficient reduced (`0.33` vs `0.46`) and shifted mask/offset geometry (`0.24` behind + `q^3`) reduce trailing suction footprint in the field.
4. **Wake-to-visible coupling weakened by render positivity clamp**: since render uses `max(0, field)`, weaker negative wake and altered kernel reduce the apparent trailing suction signature.
5. **Organic control channel mismatch**: Recharged ties organic mask to `look.noise`, so authored `organic.*` is ignored; this alters contour motion independent of old authored truth.
6. **Falloff geometry mismatch**: bilateral edge falloff in Recharged changes band silhouette from old right-open taper.
7. **Layering pipeline mismatch**: Recharged’s explicit per-pass around-player fog placement is not the same draw pipeline as legacy `src/app.js` fog-before-darkness call.

## I. Whether current Recharged is using the wrong truth source

Yes.

- Recharged fog in `Lumo/Lumo.html` is not executing the old gameplay truth implementation from `Lumo/src/game/entities.js` + `Lumo/src/app.js`; it is a separate implementation with modified constants, modified kernels, modified masks, modified defaults, and modified pass ordering.
- `smooke.html` matches many core formulas conceptually, but the shipped old .js gameplay truth is the legacy runtime files above.

## J. Minimal correct next implementation step

1. Treat `Lumo/src/game/entities.js` fog spawn/update/render math and `Lumo/src/app.js` render ordering as canonical reference.
2. In `Lumo/Lumo.html`, remove all Recharged-only fog math deltas and restore exact old-runtime equations/constants/order:
   - same defaults,
   - same interaction kernels and coefficients,
   - same mask geometry,
   - same organic parameter source (`organic.*` not `noise`),
   - same layering semantics relative to legacy pipeline truth.
3. Validate by literal equation/constant parity checks against the old-runtime sections before any visual retuning.
