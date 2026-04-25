# HUD V2 Dashboard Structural Port Inventory (Phase 1)

## Scope / Constraints
- `dashboard.html` is treated strictly as **source/reference**, not runtime dependency.
- Recharged runtime target file: `Lumo/Lumo.html`.
- Forbidden runtime dependency mechanisms remain forbidden: iframe/fetch/import/sampling/contentWindow/drawImage-from-dashboard source paths.
- No `src/app.js` or `src/core/renderer.js` edits.

## Current Runtime Status
- Runtime dependency on `dashboard.html`: **none detected** (Phase 1 self-check required on every commit).
- Existing HUD in `Lumo/Lumo.html` is a **partial structural port** (master layout + basic chrome/orb/lives/flares/score/motes).
- Full visual parity with `dashboard.html` is **not yet complete**.

## Structural Port Inventory (from `dashboard.html`)

### 1) Constants / dimensions / global model
- [x] Master dimensions (`MASTER_W`, `MASTER_H`) mapped to Recharged HUD constants.
- [~] Layout rectangles (`gameplay`, `orb`, zone rectangles) partially ported.
- [ ] Full dashboard zone model (`zones.left/right/bottom/topLeft/topRight`) pending.

### 2) Utility helpers
- [x] Basic helpers in runtime (`clamp` equivalents and overlay state handling) partially present.
- [ ] Structural equivalents of dashboard helpers pending full extraction/adaptation:
  - `rand`, `clamp`, `lerp`, `mixColor`, `rgb`, `roundRect`
  - `pointInRect`, `randomPointInZone`, `withFrameClip`, formatting helpers

### 3) Renderer sections (dashboard draw pipeline)
- [~] Frame/chrome + gameplay opening + orb + score/lives/flares exist in runtime.
- [ ] `drawFrame` structural port completion
- [ ] `drawCore`
- [ ] `drawBrokenRing`
- [ ] `drawSignalLayer`
- [ ] `drawFramePatina`
- [ ] `drawInsetLightStrip`
- [ ] `drawTechGraffiti`
- [ ] `drawOrbCutout`
- [ ] `drawTopPanelDetail`
- [ ] `drawInnerEdgeWear`
- [ ] `drawScoreCutout`
- [ ] `drawLivesPanel`
- [ ] `drawFlarePanel`
- [ ] `drawPanelSoul`
- [ ] `drawBottomVentCutout`
- [ ] `drawBottomPanelCreatures`
- [ ] `drawTopLogoPlate`
- [ ] `drawHUD`
- [ ] Echo and ambient animation layers (`spawnEcho`, `drawEcho`, firefly cycle) parity

### 4) Animation data + procedural sets
- [~] Runtime motes are present but simplified.
- [ ] Structural port of dashboard-generated arrays / animation control sets pending:
  - `lines`, `sparks`, `ring`, `leds`, `pixels`, `motes`, `firefly`, plus rebuild/init logic.

### 5) Live data glue (Recharged authoritative values)
- [x] Energy → HUD percent.
- [x] Lives → HUD bulbs (runtime cap target 4).
- [x] Flares → HUD icons (runtime cap target 3).
- [x] Score → runtime snapshot with fallback.
- [x] Logo path target: `data/assets/ui/lumo-logo-sepia.png`.
- [ ] Ensure full panel-specific placement/format behavior matches dashboard code path.

### 6) Game viewport clipping
- [x] World render is clipped to the HUD gameplay rectangle via canvas clip path.
- [ ] Verify exact rectangle parity against final full dashboard structural port constants.

## Staged Implementation Plan (No shortcuts)

### Stage 2 — Core structural import (functions + data model)
1. Port dashboard helper function set into `Lumo/Lumo.html` HUD module scope.
2. Port `rebuild()`-style data initialization for lines/ring/leds/pixels/motes/firefly.
3. Port orb/core/ring/signal renderer pipeline in original call order.

### Stage 3 — Panel & detail parity
1. Port top/bottom panel detail functions exactly (scratches/noise/patina/scanline-like artifacts).
2. Port life/flare/score panel renderers with matching geometry/gradients/typography.
3. Port vent/creature/logo plate layers and ordering.

### Stage 4 — Animation parity + tuning
1. Port all coded animation timing/flicker logic without simplification.
2. Validate frame-by-frame feel under fixed and variable frame cadence.
3. Ensure no gameplay coupling changes (visual-only).

### Stage 5 — Integration and verification
1. Finalize Recharged live data glue points only (energy/lives/flares/score/logo).
2. Verify playfield clip rect exactness and no world bleed beyond opening.
3. Run self-check string scan and contract tests.

## Mandatory Phase Gate
If any stage cannot be completed without approximation, stop and update this inventory/plan before implementation continues.
