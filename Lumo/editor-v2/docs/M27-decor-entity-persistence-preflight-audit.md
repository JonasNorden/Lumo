# M27 — Decor & Entity Persistence Preflight Audit

Date: 2026-03-30
Scope: `editor-v2/**` plus runtime/data read-only analysis (`src/game/**`, `src/app.js`, `data/catalog_*.js`, `data/levels/**`).

## Guardrails (this audit intentionally did **not** do)
- No persistence implementation.
- No save-path refactors.
- No behavior changes.
- No legacy editor modifications.

---

## 1) Decor Audit

### 1.1 Current architecture
- Authoring model:
  - Decor instances live in `LevelDocument.decor[]` as `{id,name,type,x,y,visible,variant,params}`.
  - Normalization is in `validateLevelDocument()` / `normalizeDecor()`.
- Placement & history:
  - Decor create/delete/update route through clean-room canonical history helpers (`applyCanonicalDecorAction`, `applyCleanRoomDecorHistoryAction`).
  - Selection is stable-id first (`selectedDecorIds`/`selectedDecorId`) with index compatibility.
- Runtime bridge:
  - Decor is bridged into runtime as `layers.ents[]` entries (same runtime queue as entities/sounds), with `id=<runtime entity id>` and optional `anchor/offsetX/offsetY/params`.

### 1.2 Source of truth
- Decor preset definitions in editor-v2:
  - Primary: `editor-v2/src/domain/decor/decorPresets.js`.
  - Inputs:
    - fallback hardcoded presets,
    - filtered `window.LUMO_CATALOG_ENTITIES` entries with `category:"decor"` and denylist/hints.
- Decor visual/size/anchor resolution:
  - `editor-v2/src/domain/decor/decorVisuals.js` (uses preset values for draw size, footprint, anchor, offsets).
- Runtime catalog source:
  - `data/catalog_entities.js` (`window.LUMO_CATALOG_ENTITIES`).
- Important split:
  - Editor Decor defaults come from `decorPresets`/normalization (not from a Decor `defaultParams` system).
  - Runtime decor sizing for generic catalog-driven decor comes from runtime catalog `w/h/anchor`.

### 1.3 Identity & uniqueness model
- Decor instance identity: `decor.id` (string, unique within `doc.decor`).
- Decor preset identity: `preset.id` (and `preset.type` used for placement/runtime mapping).
- Must be unique:
  - `decor.id` in a document (generated via `getNextStringId(...,"decor")`).
- Reusable:
  - `decor.type` is reusable across many instances.
- Implicit assumptions / risks:
  - Some flows still resolve by index for incoming updates before converting to id; id is the authoritative intent in clean-room paths.
  - Decor duplicate is disabled; persistence should not depend on duplicate semantics.

### 1.4 Runtime mapping
- Bridge location: `editor-v2/src/runtime/v2ToRuntimeLevelObject.js`.
- For each visible decor item:
  - `decor.type` -> `runtimeId` via `normalizeRuntimeEntityType`.
  - `getDecorVisual(decor.type)` supplies draw anchor and offsets.
  - output pushed to `runtimeLevel.layers.ents[]`:
    - `id` (runtime entity id),
    - tile `x/y`,
    - `anchor`, `offsetX`, `offsetY`,
    - `params` (+ flower variant normalization).
- Runtime consumption:
  - `src/game/entities.js::spawnFromDef()` consumes `layers.ents` entries by `id`.
  - For catalog decor fallback path (`def.category==="decor"`), runtime uses catalog `w/h/anchor` and applies anchor math.

### 1.5 Anchor / footprint / size behavior
- Editor-side decor draw/footprint comes from `decorVisuals` resolved preset fields (`drawW/H`, `footprint`, `drawAnchor`, offsets).
- Runtime side generic decor sizing comes from runtime catalog entry (`def.w/def.h/def.anchor`).
- Mismatch risk:
  - Editor preview dimensions and runtime actual dimensions can diverge if editor preset normalization and runtime catalog metadata drift.
  - There is an explicit anchor override map in decor presets for some IDs (e.g., apple/boar/banner/paintings), which may differ from raw catalog anchors.

### 1.6 Params (decor)
- No global decor param schema like entity preset defaultParams.
- `normalizeDecor()` clones `decor.params`; special handling only for flower `variant` normalization.
- Decor panel editing currently only allows flower variant param update through canonical update path; other decor field edits are intentionally disabled in clean-room mutation lane.

### 1.7 Serialization/import/export status
- JSON export path (`serializeLevelDocument`) is full-document stringify of current in-memory `doc`.
- Decor fields currently serialized in v2 JSON: `id,name,type,x,y,visible,variant,params`.
- Runtime export path currently emits decor as runtime entities, but does **not** preserve authored decor instance id in runtime payload (`id` becomes runtime type id).

### 1.8 Decor persistence missing pieces
- Missing explicit durable source for *editor Decor presets* (currently resolved from runtime catalog + fallbacks + heuristics).
- No dedicated Decor persistence bridge endpoint (only tile/background bridges exist today).
- Need explicit contract for preserving authored Decor instance identity during save/load round-trip (especially if persistence target differs from v2 JSON export).
- Need explicit contract deciding whether Decor `variant` lives redundantly in both `decor.variant` and `decor.params.variant` (today flower mapping touches both paths).

### 1.9 Decor pitfalls to avoid
- Do not treat runtime `layers.ents[].id` as unique decor instance id (it is type id in bridge output).
- Do not infer decor identity from `x/y` or index.
- Do not let editor preset anchor/size silently diverge from runtime catalog anchor/size.
- Do not fold entity-like types back into decor list; migration already pushes those to entities.

---

## 2) Entity Audit

### 2.1 Current architecture
- Authoring model:
  - Entity instances live in `LevelDocument.entities[]` as `{id,name,type,x,y,visible,params}`.
  - Normalized by `normalizeEntity()` with preset-default merge and special-volume anchor sync.
- Placement/history:
  - Canonical clean-room entity runtime uses stable ids (`applyCanonicalEntityAction`).
  - Create/delete/updates are id-driven and history-recorded.
- Rule layer:
  - Spawn/Exit invariants enforced by `normalizeSpawnAndExitEntities()` and `canCreateEntityType`/`canDeleteEntity`.

### 2.2 Source of truth
- Editor entity presets and defaults:
  - `editor-v2/src/domain/entities/entityPresets.js` (`ENTITY_PRESETS`, `defaultParams`).
- Param cloning/merge/type support:
  - `editor-v2/src/domain/entities/entityParams.js`.
- Special volume params/defaults and normalization:
  - `editor-v2/src/domain/entities/specialVolumeTypes.js`.
- Runtime catalog / profile metadata (adjacent but not authoritative for editor entity defaults):
  - `data/catalog_entities.js`, `data/catalog_profiles.js`.

### 2.3 Identity & uniqueness model
- Entity instance identity: `entity.id` (unique within `doc.entities`, generated via `getNextStringId(...,"entity")`).
- Entity preset identity: `ENTITY_PRESETS[].id` with canonical type in `.type`.
- Must be unique:
  - one `player-spawn` type max (enforced in create + normalize).
  - at least one spawn and at least one exit in normalized document.
- Reusable:
  - most types are reusable; exits can be multiple (but delete constrained to keep >=1).
- Implicit assumptions / risks:
  - runtime bridge strips authored entity id and emits runtime type id only.
  - if persistence ever stores runtime-format only, stable authored ids are lost.

### 2.4 Runtime mapping
- Bridge location: `v2ToRuntimeLevelObject()`.
- Entity type remap examples:
  - `player-spawn -> start_01`, `player-exit -> exit_01`, `checkpoint -> checkpoint_01`, legacy volume aliases normalized.
- Output for entities:
  - `layers.ents.push({ id: runtimeId, x, y, params })`.
- Runtime loader:
  - `src/game/entities.js::loadFromLevel()` reads `levelObj.layers.ents` and dispatches via `spawnFromDef()` on `id`.
  - spawn fallback logic in runtime app uses `start_01` from `layers.ents` if `spawn/meta.spawn` missing.

### 2.5 Params system (entities)
- Definitions/defaults:
  - Primary defaults per type in `ENTITY_PRESETS[].defaultParams`.
  - `getEntityPresetParamsForType()` merges default params + authored params (after legacy remap).
- Value validity:
  - Supported param value types: finite number/string/boolean/arrays/objects (recursive checks).
- Per-instance storage:
  - Stored in `entity.params` on each entity in document.
- Editing propagation:
  - Selection panel emits canonical mutation payload `{itemId,key/path,value}`.
  - `applyEntityFieldUpdate()` applies:
    - generic param key set for non-volume entities,
    - path-based `applySpecialVolumeParamChange()` for volume entities.
  - Canonical update action records previous/next snapshots by stable id.

### 2.6 Anchors / footprints / size (entities)
- Editor visuals:
  - `entityVisuals` provide drawW/H, footprintW/H, drawAnchor for markers/hit/selection.
- Volumes:
  - width/depth/lift etc. are in `params.area` (pixel-space), with entity `x/y` as tile anchor.
  - `syncSpecialVolumeEntityToAnchor()` keeps `params.area.x0/y0` aligned to entity tile anchor.
- Runtime interpretation:
  - Many entities ignore editor footprint metadata; runtime constructors use their own widths/heights.
  - For decor-like runtime entries, anchor and offsets are applied in `spawnFromDef`.

### 2.7 Special rules
- Spawn:
  - must exist; cannot create more than one; cannot be deleted.
- Exit:
  - at least one required; can delete only when more than one exists.
- Special volumes:
  - dedicated type handling, param clamping/normalization, world-rect conversion, and anchor sync.

### 2.8 Serialization/import/export status
- v2 document serialization is full JSON of `doc` (includes entities array with ids, params).
- Runtime bridge serialization drops authored instance ids and uses runtime `id=type` convention in `layers.ents`.
- Therefore, runtime payload is not an invertible persistence format for entity instance identity.

### 2.9 Entity persistence missing pieces
- No dedicated entity persistence backend/local bridge target (tile/background only currently).
- No explicit versioned persistence contract that preserves authored `entity.id` across save target(s) beyond generic JSON export.
- Need formalized mapping table ownership for type aliases/remaps to avoid drift between editor and runtime bridge.

### 2.10 Entity pitfalls to avoid
- Do not persist by runtime `layers.ents[].id` as if it were unique instance id.
- Do not bypass `getEntityPresetParamsForType()` on ingest; that is where legacy param remaps + default merge happen.
- Do not bypass spawn/exit normalization rules on load/save.
- Do not mutate special-volume params without re-normalization/sync to anchor.

---

## 3) Import/Export & Save Targets (cross-cutting)

### Current status
- Export: download JSON of active `LevelDocument`.
- Import: JSON parse + `validateLevelDocument` normalization.
- Runtime play handoff: v2 -> runtime bridge -> session storage -> runtime loader.
- Persistent write bridges currently implemented only for:
  - tiles (`/api/editor-v2/tiles/save`)
  - backgrounds (`/api/editor-v2/background/save`)

### What is missing for Decor/Entity persistence
- A decor/entity write bridge (or equivalent save target) with validation and duplicate-id protection.
- A durable update path for data catalogs / editor catalogs where decor/entity definitions are authored.
- Explicit identity contract at persistence boundary: authored instance id must remain stable and distinct from runtime type id.

---

## 4) File impact map for future persistence work (high-level, no code)

### Editor-v2 files likely to update
1. `editor-v2/src/domain/level/levelDocument.js`
   - Ensure load-side normalization + migration rules are persistence-contract aligned (especially ids and entity/decor migration boundaries).
2. `editor-v2/src/data/importLevelDocument.js`
3. `editor-v2/src/data/exportLevelDocument.js`
   - If persistence metadata/versioning is introduced.
4. `editor-v2/src/app/createEditorApp.js`
   - Hooking new save actions/status for decor/entity persistence endpoints.
5. `editor-v2/src/domain/decor/decorPresets.js`
   - If decor definition source becomes persistence-backed/editor-managed.
6. `editor-v2/src/domain/entities/entityPresets.js`
   - If entity defaults/schema move to persistence-backed definitions.
7. `editor-v2/src/domain/assets/localTileSaveBridge.js` (or split successor)
   - Add new decor/entity save bridge calls rather than overloading tile/bg paths.
8. `editor-v2/dev/localTileSaveBridge.js` (or new dev bridge module)
   - Add server endpoints for decor/entity persistence.

### Data/catalog files likely to update
1. `data/catalog_entities.js`
   - Runtime-facing entity/decor definitions currently live here.
2. `data/catalog_profiles.js`
   - If behavior/visual profile defaults become authoritative in persistence flow.
3. Potentially `data/levels/*.js` only if migration/export target includes runtime fixtures.

### Runtime files (only if contract changes require it)
1. `editor-v2/src/runtime/v2ToRuntimeLevelObject.js`
   - If additional runtime fields are required for parity (or diagnostics).
2. `src/game/entities.js`
   - If runtime loader must consume new mapped fields for decor/entity persistence parity.
3. `src/app.js`
   - Only if spawn/runtime handoff contract changes.

---

## 5) Recommended safe implementation plan (high-level)

1. **Freeze contracts first**
   - Decide exact persisted schema for Decor/Entities in v2 document (including id invariants and param shape).
   - Explicitly document `instance id` vs `type id` separation.

2. **Build persistence adapter, not direct writes from UI**
   - Follow tile/background pattern: editor-side bridge client + dev/server endpoint + validation.
   - Keep all id checks and schema validation in one place.

3. **Lock identity rules with tests before implementation**
   - Add tests for:
     - id uniqueness,
     - spawn/exit constraints,
     - entity/decor round-trip stability,
     - flower variant + special-volume param round-trip.

4. **Implement write path for definitions and/or level docs deliberately**
   - If persisting definitions (catalog), update catalog files atomically with duplicate id guard.
   - If persisting level documents, preserve `decor[].id` / `entities[].id` exactly.

5. **Verify runtime parity last**
   - Use bridge diagnostics and runtime checks to ensure no regressions in Play From Here.
   - Avoid expanding runtime contract unless absolutely necessary.

---

## 6) Explicit DO NOT DO list

- Do **not** use runtime `layers.ents` as persistence source of truth for authored decor/entity instances.
- Do **not** key persistence on x/y/index order.
- Do **not** reintroduce legacy object mutation/index-only paths for entity/decor.
- Do **not** bypass `validateLevelDocument()` normalization on import/load.
- Do **not** bypass spawn/exit normalization/deletion constraints.
- Do **not** treat editor draw footprint values as runtime collision guarantees without explicit mapping.
- Do **not** add implicit alias remaps in multiple places without a single canonical mapping table.

---

## 7) Risk summary (top pitfalls)

1. **Identity conflation risk**: instance id vs runtime type id (`layers.ents.id`) conflation.
2. **Dual source-of-truth risk**: editor decor presets vs runtime catalog metadata drift (size/anchor/defaults).
3. **Param drift risk**: defaults/legacy-remaps applied in editor but not mirrored in persistence ingest path.
4. **Constraint bypass risk**: spawn/exit invariants broken if persistence skips normalization.
5. **Anchor/size mismatch risk**: editor preview looks correct but runtime places differently due to catalog/preset mismatch.

