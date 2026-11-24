# Play From Here reliability V1 — verification

Verified on Windows with Node 24.14.0, Python 3.14.3 and real headless Google Chrome via the existing bundled Playwright. Base: `0fb7a92cc762f9d0bf03e9c447cd5b52a7cfb3e9` (main).

## Root causes and reproduction

1. The bridge hardcoded `http://127.0.0.1:3000/Lumo.html`. An editor on 4173 created a Blob belonging to 4173 but opened runtime on 3000. With no server on 3000 this causes connection refusal. With servers on both ports, the cross-origin Blob cannot be fetched by runtime.
2. The other transport wrote the legacy converter's object to sessionStorage. Passing that actual converter output through the Recharged loader returned `ok: false` with `Missing required section: identity.` and `Missing required section: world.` The two transports were different formats, and the separate storage spawn was not consumed by the Recharged loader.
3. The original `Lumo.html` silently loaded `src/app.js` when Recharged boot failed. A real Chromium replay of the original HEAD HTML and three modules, after importing a distinctly named B level at 4173 with both servers running, observed runtime origin 3000, a Blob origin of 4173, Recharged `booted: false`, and a legacy fallback script. The editor nevertheless displayed `Play From Here launched from authored/default spawn.` This verifies the wrong-runtime/fallback route rather than assuming that session priority alone caused the observed wrong level.
4. Independently, valid stale Recharged-shaped session data overrode an explicit B URL. The new regression failed against the original source and passes with storage reads removed.
5. Full-layer browser testing exposed a missing dust-area handoff in `createRechargedLevelSourceRuntime.js`. Existing layers downstream supported dust, but this boundary dropped it.
6. Invalid fractional/null selected cells could be coerced into valid coordinates. A real browser regression reproduced a fractional selection spawning at `(24,96)` instead of authored `(48,72)` before the integer check was added.

## Implementation

Each click serializes the current active document into one complete immutable JSON snapshot. Only a valid selected-cell override changes its `world.spawn`. No synthetic permanent player-spawn is inserted. A unique `editorPlay` launch ID exists in both the URL and snapshot. Runtime validates that identity before normalization through the existing loader. Legacy session helper exports remain for old callers, but the new launch never writes storage and Recharged never reads obsolete storage.

Runtime URL resolves relative to the editor URL, preserving protocol, hostname, port and installation prefix. Messages verify exact child window, origin and launch ID. The editor reports launching/opened/loaded/ready/failed, and older launches cannot replace the newest status. Ready is reported after a real render. Popup blocking never navigates away from unsaved work. Missing/corrupt/mismatched editor snapshots display an explicit runtime error and cannot fall through to default/debug/legacy boot.

The Blob remains alive while its runtime window is open because reactive render paths also read it. It is revoked on child closure, launch failure/timeout, or editor page exit. Keep the editor tab open during playtesting. Reloading/closing the editor ends its owned snapshot lifetime.

## Test results

| Verification | Passed | Failed |
| --- | ---: | ---: |
| Focused Node regression cases | 21 | 0 |
| Real Chromium browser scenarios | 24 | 0 |
| Real Windows launcher cases | 5 | 0 |
| All current Node check scripts (includes focused file) | 39 | 17 |
| Original HEAD Node check scripts, isolated baseline | 38 | 17 |

The same 17 scripts fail at baseline and HEAD, with matching failure reasons; there are **zero new failing scripts**. This PR does not claim the entire pre-existing suite is green.

Browser coverage includes all three exact ports 4173/3000/8080 on localhost and 127.0.0.1; A→B imports without closing editor; unsaved UI edits; exact initial player coordinates before physics ticks; authored spawn; invalid/boundary cells; collision-adjacent spawn; original document equality; overlapping launches and stale messages/storage; missing/corrupt/mismatched snapshots; no fallback; popup failure; a maximum supported 1024×64 tilemap plus over 7 MiB additional JSON with storage writes forced to throw; full active-snapshot equality; every area type; reactive grass/bloom/crystals; background, decor, entity and audio data; live enemy params; ordinary legacy script boot; explicit level-query and actual next-level loading.

The browser harness captures the real editor store and initial boot assignment using test-only instrumentation. Import, metadata editing and Play From Here use the real UI; cell edge cases set the real selection state. Popup blocking deterministically supplies the browser's `window.open() === null` outcome. No test hook was added to product code.

Windows tests execute the real `.bat` from an unrelated working directory, verify editor and runtime HTTP responses, recover from an occupied port, exercise invalid-port and missing-Python errors, and fall back from an unusable `py` launcher to `python`.

Limitations: automatic opening of the user's default visible browser was not exercised (launcher tests use `--no-browser`); subfolder and HTTPS URL derivation are covered by focused URL contracts, while the browser matrix uses HTTP at the root installation. Runtime physics, visuals and existing user assets are unchanged. Ordinary legacy startup verification confirms its boot script remains selected, not an end-to-end legacy gameplay test.

### Existing failing scripts

- `audio-asset-catalog-checks.mjs`
- `lumo-recharged-boot-adapter-checks.mjs`
- `lumo-recharged-firefly-runtime-contract-checks.mjs`
- `lumo-recharged-fog-render-gap-contract-checks.mjs`
- `lumo-recharged-gap-out-of-bounds-checks.mjs`
- `lumo-recharged-glow-area-contract-checks.mjs`
- `lumo-recharged-hover-void-eye-render-contract-checks.mjs`
- `lumo-recharged-live-decor-render-checks.mjs`
- `lumo-recharged-reactive-decor-mirror-reflection-checks.mjs`
- `lumo-recharged-runtime-visual-contract-checks.mjs`
- `lumo-recharged-smoke-area-contract-checks.mjs`
- `mirror-surface-area-pipeline-checks.mjs`
- `recharged-hud-snapshot-checks.mjs`
- `recharged-runtime-liquid-death-respawn-handoff-checks.mjs`
- `regression-checks.mjs`
- `runtime-bridge-checks.mjs`
- `runtime-game-session-checks.mjs`

## Changed files

- `Lumo.html`: runtime opened/ready/error feedback; fail-closed editor playtests.
- `editor-v2/src/app/createEditorApp.js`: current-document launch, strict selected cell, session-owned status.
- `editor-v2/src/runtime/editorPlaySessionBridge.js`: single snapshot, dynamic URL, message/lifecycle handling.
- `editor-v2/src/runtime/bootLumoRechargedFromQuery.js`: authoritative explicit snapshot; obsolete storage ignored.
- `editor-v2/src/runtime/createRechargedLevelSourceRuntime.js`: preserve dust areas across snapshots.
- `Start-Lumo-Editor-V2.bat`: Windows entry point with working-interpreter discovery.
- `editor-v2/dev/start_editor.py`: loopback server, occupied-port handling, readiness and browser opening.
- `editor-v2/README.md`: startup, handoff and test instructions.
- `editor-v2/tests/lumo-recharged-query-boot-checks.mjs`: update obsolete storage-priority expectation.
- `editor-v2/tests/play-from-here-reliability-checks.mjs`: focused contracts and lifecycle regressions.
- `editor-v2/tests/play-from-here-browser.cjs`: real browser matrix and runtime-data comparisons.
- `editor-v2/tests/test_start_editor.py`: real Windows launcher tests.
- `docs/superpowers/plans/2026-11-24-play-from-here.md`: implementation plan and decisions.
- `docs/play-from-here-reliability-v1-results.md`: this verification record.

## Start after merge and pull

From the repository root:

```powershell
git switch main
git pull --ff-only origin main
.\Lumo\Start-Lumo-Editor-V2.bat
```

If already in the `Lumo` folder, the launch command is `.\Start-Lumo-Editor-V2.bat`.
Manual server command from that folder: `py -3 -m http.server 4173 --bind 127.0.0.1`;
open `http://127.0.0.1:4173/editor-v2/`.

## Manual acceptance

1. Start using the batch file; allow local editor popups.
2. Import A and play; then import clearly different B in the same editor and play again.
3. Edit B without exporting; play and verify that edit appears.
4. Select a different cell and play; clear selection and verify authored spawn.
5. Check the status reaches Runtime ready and the editor retains all unsaved work.
6. Close play windows, repeat a launch, and verify it still uses the current document.
