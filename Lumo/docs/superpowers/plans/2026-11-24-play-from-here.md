# Play From Here reliability implementation plan

**Goal:** Play exactly the current unsaved Editor V2 document on the editor origin.
**Architecture:** One JSON document snapshot in a Blob URL, identified by a unique launch ID. The existing Recharged loader converts this same document; no sessionStorage competes with it. A source/origin/ID checked message channel confirms opened, loaded and ready states. Keep the Blob alive until the child closes because renderers also fetch the document.
**Tech stack:** Existing browser ES modules, Node regression scripts, Python standard library Windows launcher.
**Spec:** User-supplied “Lumo V2 – Play From Here Reliability & Runtime Synchronization V1”.

## Constraints
Preserve gameplay, graphics, assets, user levels, editor layout and Godot. No npm install or new runtime dependency. Push requested branch and open a ready PR against main; do not merge.

## Review focus
Stale storage overriding explicit levels; superseded launch messages; popup blocking losing unsaved work; invalid editor launches falling through to legacy; Blob revocation breaking secondary renderer reads.

## Tasks
- [x] Add regression tests proving same-origin URLs on ports 3000/4173/8080 and subpaths, storage independence, immutable full snapshots and spawn validation. Run red.
- [x] Replace dual handoff with one snapshot and lifecycle/message tracking in editorPlaySessionBridge.js; connect editor status updates to session state.
- [x] Make bootLumoRechargedFromQuery.js ignore obsolete storage, require editor snapshot identity and fail closed. Keep ordinary boot/explicit URLs/next-level behavior. Add loaded diagnostics and Lumo.html ready/error reporting.
- [x] Add Start-Lumo-Editor-V2.bat plus standard-library Python server helper; exercise readiness, occupied ports, arbitrary cwd and failure behavior.
- [x] Run all existing Node scripts and focused tests. Run real Chromium tests comparing editor imports and unsaved edits with runtime data, player spawn, layers, invalid data, popup blocking, repeated launches and large documents.
- [x] Review complete diff and record results and limitations.

Delivery steps: commit, push, create ready PR and verify HEAD/mergeability; report publication metadata in the final response.

## Execution decisions
The user explicitly requested complete implementation and a ready PR, so execution continues without intermediate design approval. Work in the clean existing checkout on the requested new branch. Preserve legacy session-writing exports for old callers, but neither write nor read them in the new Recharged launch path.

## Verification
21 focused cases, 24 real Chromium scenarios and 5 real Windows launcher cases passed. Full Node scripts: 39 passed, the same 17 failures as the isolated baseline (38 passed). Independent review reported no actionable findings. See `docs/play-from-here-reliability-v1-results.md` for evidence, limitations and the unchanged failure list.
