# Fog truth mapping pass (V1 → V2 authoring → Recharged runtime)

## 1) V1 fog truth

### Proven source-of-truth artifact
- The project explicitly identifies `smooke.html` as the behavioral source for fog preview direction. This is written in project docs, not inferred. (`Project_Lumo_V2.txt`: “`smooke.html` som behavioral source of truth för fog-preview-riktning”).

### Data representation in V1 fog model (`smooke.html`)
- Exported fog schema is a nested object:
  - `area`: `x0`, `x1`, `falloff`
  - `look`: `density`, `lift`, `thickness`, `layers`, `noise`, `drift`
  - `smoothing`: `diffuse`, `relax`, `visc`
  - `interaction`: `radius`, `push`, `bulge`, `gate`
  - `organic`: `strength`, `scale`, `speed`
  - `render`: `lumoBehindFog`
- This schema is emitted by `exportJSON()` in `smooke.html` and is therefore concrete, not speculative.

### Runtime behavior/feel origin in V1 fog model
- Fog uses a dedicated 1D field simulation (`field`, `vel`) with:
  - Laplacian diffusion into velocity
  - Relaxation toward baseline
  - Viscosity damping
  - Optional drift advection
- Player motion only disturbs fog when speed exceeds `gate`.
- Disturbance is asymmetric:
  - bulge ahead of movement direction
  - clear/wake behind movement direction
- Organic shape modulation is layered separately via noise-based `organicMaskAtX`.
- Rendering is multi-layered band rendering + top contour stroke, with end falloff applied as height attenuation per-sample.

### Confirmed effect scope in V1 fog model
- Fog logic in `smooke.html` is visual interaction logic only (shape + compositing + draw order); there is no gameplay collision/damage/movement penalty hook in that artifact.
- `render.lumoBehindFog` controls draw ordering of player vs fog in the preview.

### Special rules confirmed
- End-of-volume falloff (`area.falloff`) is implemented in geometry profile (height mask per sample), not only alpha.
- Camera interaction is not represented as a separate fog parameter in `smooke.html`; the model is local world-space band logic.
- Darkness interaction is not represented in `smooke.html` (that interaction is runtime-side in Recharged, see section 3).

## 2) V2 authoring/export truth

### Authoring definitions and defaults
- V2 defines fog as a dedicated special volume type (`fog_volume`) with dedicated defaults and normalization in `specialVolumeTypes.js`.
- V2 fog defaults include fields not present in the V1 `smooke.html` export payload:
  - `look.color`, `look.exposure`
  - `interaction.behind`
  - `render.blend`
- V2 clamps/normalizes fog params with explicit ranges (`normalizeFogParams`).

### Authoring creation path
- Fog volumes are authored as rectangle-based world regions, then materialized as `fog_volume` entities with params in `createFogVolumeEntityFromWorldRect`.
- App placement path calls `createFogVolumeAtWorldRect(...)` which uses that constructor.

### What gets saved/exported
- Entity params are preserved through document validation and export path:
  - `validateLevelDocument()` normalizes entities and special volumes.
  - `serializeLevelDocument()` exports full document JSON; no fog-specific stripping exists.
- Runtime bridge conversion (`v2ToRuntimeLevelObject`) includes `fog_volume` in supported runtime ids and forwards cloned params into runtime `layers.ents` entities.

### Editor preview fidelity status
- Canvas fog preview loop in `createEditorApp.js` intentionally mirrors smooke-style simulation and rendering ingredients (diffuse/relax/visc, drift, gate/radius/push/bulge, layered profile, organic mask).
- Workbench UI binds fog controls to Smooke dataset attrs and animated preview surface.
- The map canvas entity-layer representation (`entityLayer.js`) is only a simple volume rectangle/gradient indicator; it is not the smooke simulation.

## 3) Recharged runtime current truth

### In exported/runtime level data
- Fog entities with full nested params exist in V2-authored level JSON (example in `editor-v2/src/data/test.json`: `entity-49` `fog_volume` with nested area/look/smoothing/interaction/organic/render).
- Bridge/runtime mapper includes fog in `SUPPORTED_RUNTIME_ENTITY_IDS` and keeps params cloned.

### Loader/normalization into runtime containers
- Runtime `Entities.spawnById(...)` has explicit `id === "fog_volume"` branch.
- It accepts both `params` and `params.params` shapes, resolves area/look/smoothing/interaction/organic/render, allocates dedicated fog sim arrays (`field`, `vel`), and stores into `_fogVolumes`.

### Render path (Recharged)
- Runtime has dedicated fog render pass: `Entities.drawOverDarkness(ctx, cam)`.
- App draw order currently calls:
  1. world + liquids + entities + player
  2. `ents.drawOverDarkness(...)`
  3. `renderer.drawDarkness(...)`
  4. `ents.drawAfterDarkness(...)`
- So fog is currently drawn **before** darkness, despite comment text saying fog should be “behind darkness/revealed by punch-out”.

### Simulation/gameplay path
- Fog updates in `Entities.update(...)` every 3rd frame for budget.
- Fog reacts to player only when player center is inside volume and speed > gate.
- No gameplay hazard/collision/death/slow/visibility system hook from fog to player stats/physics is present in runtime.
- Liquid volumes have lethal gameplay checks; fog does not.

### Lumo.html path check
- `Lumo/Lumo.html` contains liquid volume rendering logic but no fog volume runtime path (`fog_volume` token absent there).
- Therefore fog runtime truth is in `src/app.js` + `src/game/entities.js`, not in `Lumo.html`.

## 4) Exact gap (V1 parity target vs current Recharged)

### Already correct / present
- Dedicated fog type (not treated as water/lava) exists end-to-end.
- V2 authoring schema and runtime ingestion for core smooke parameters are wired.
- Dedicated fog simulation arrays and update loop exist.
- Smooke-like disturbance gating (speed threshold + directional bulge/wake) exists.
- Offscreen fog rendering path exists with layered fill.

### Missing / wrong vs strict V1 parity
- **Draw-order parity gap:** V1 model has explicit `lumoBehindFog` control in export; runtime parsing ignores this field and uses fixed draw ordering.
- **Parameter parity gap:** `interaction.behind` is authored in V2 and in preview loop but not consumed in runtime spawn/update (runtime uses `push`/`bulge` only).
- **Darkness-chain mismatch risk:** app render order draws fog before darkness while comment claims opposite intent; this is a concrete inconsistency in current runtime path.
- **Algorithm drift from smooke reference:** runtime draw/sim equations are similar but not 1:1 with `smooke.html` (different layer caps, alpha factors, end-falloff application strategy, handling of negative field in preview/runtime differences).

### Stub/ignored fields today
- `render.lumoBehindFog`: present in authored/exported data, ignored by runtime.
- `interaction.behind`: present in authored/exported data, ignored by runtime.

## 5) Recommended FIRST correct implementation scope

Based on proven chain and parity-critical deltas, first scope should be:

1. **Render + authored ordering parity only**
   - Consume `render.lumoBehindFog` in runtime draw ordering.
   - Make fog/darkness order explicit and consistent with chosen V1-truth behavior from `smooke.html` + intended darkness pipeline.

2. **Disturbance parameter parity only**
   - Consume `interaction.behind` in runtime fog disturbance equation (where clear/wake is applied).

Why this is the first correct scope:
- These are direct authored fields already exported and already used in preview semantics.
- They are high-confidence parity deltas with minimal architecture risk.
- They avoid speculative redesign (no new visuals, no new gameplay systems).

## 6) Files that matter

### V1 truth and reference behavior
- `smooke.html` (simulation, rendering, export schema)
- `Lumo/docs/Project_Lumo_V2.txt` (declares smooke as behavioral source for fog preview direction)

### V2 authoring + normalization
- `Lumo/editor-v2/src/domain/entities/specialVolumeTypes.js`
- `Lumo/editor-v2/src/domain/entities/entityPresets.js`
- `Lumo/editor-v2/src/ui/specialVolumeWorkbench.js`
- `Lumo/editor-v2/src/app/createEditorApp.js` (fog preview sim/render)
- `Lumo/editor-v2/src/render/layers/entityLayer.js` (map-canvas fog region drawing)
- `Lumo/editor-v2/src/domain/level/levelDocument.js`
- `Lumo/editor-v2/src/data/exportLevelDocument.js`
- `Lumo/editor-v2/src/runtime/v2ToRuntimeLevelObject.js`

### Recharged runtime ingestion + update + render
- `Lumo/src/game/entities.js` (spawn, update, fog draw pass)
- `Lumo/src/app.js` (frame render order integration)

### Example authored fog payload
- `Lumo/editor-v2/src/data/test.json`

## 7) Safe to implement next?

- **Yes, for a narrow first pass**: implementing `render.lumoBehindFog` + `interaction.behind` consumption is safe and directly evidenced.
- **One remaining truth checkpoint before broader parity pass**: if strict 1:1 with historical V1 shipped runtime (not just smooke reference) is required, that original runtime code artifact must be identified. In this repository, the explicitly declared fog behavioral source is `smooke.html`; no additional “older canonical fog runtime file” was found in inspected paths.
