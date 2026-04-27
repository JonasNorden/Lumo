# Lumo Project Structure

## Top-level layout
- `Lumo/` contains the playable runtime and editor.
- `Sprite 24x24/` and `Fan -Art/` contain standalone concept and art source PNGs.
- `Lumo the concept*.txt` and `Lumo/STARTTEXT_Lumo_CANON.txt` hold project canon/design notes.

## Runtime (`Lumo/`)
- `Lumo/Lumo.html` is the runtime entry point. It mounts a `<canvas id="game">`, keeps hidden legacy DOM HUD nodes, and loads all JS files in dependency order.
- `Lumo/styles.css` styles the runtime page and boot overlay.

### Runtime code organization (`Lumo/src`)
- `src/core/`
  - `input.js`: keyboard state + tap detection.
  - `time.js`: frame timing and clamped `dt`.
  - `camera.js`: camera follow/snap + world clamping.
  - `renderer.js`: draw pipeline, darkness/light compositing, and light occlusion helpers.
  - `util.js`: small math/collision utility helpers.
- `src/game/`
  - `world.js`: level/layer loading, tile queries, tile definitions, and collision sampling.
  - `player.js`: player movement/state/energy/light behavior.
  - `entities.js`: runtime spawning + update/draw for pickups, checkpoints, lights, creatures, decor volumes, etc.
- `src/app.js`
  - main composition root: creates renderer/camera/world/entities/player, loads level data, handles checkpoint/HUD sync, pause/restart, update loop, and draw loop.

## Data-driven content (`Lumo/data`)
- `tileset.js`: gameplay tile semantics (solid, one-way, hazard, friction/speed multipliers).
- `catalog_tiles.js`: tile catalog used by editor/runtime for visual tile assets and footprint metadata.
- `catalog_entities.js`: entity catalog used by editor/runtime for available entities and defaults.
- `catalog_bg.js`: background object catalog.
- `data/levels/*.js`: level payloads loaded by runtime/editor (e.g., `level01`).

## Editor (`Lumo/LumoEditor.html`)
- Single-file offline level editor UI.
- Uses the same catalogs (`catalog_tiles`, `catalog_entities`, `catalog_bg`) to keep editor/runtime definitions in sync.
- Exports level data consumed by `world.js` + `entities.js` in runtime.

## Architecture pattern at a glance
1. **Catalogs define assets + metadata** (`data/catalog_*.js`).
2. **Level files reference those definitions** (`data/levels/*.js`).
3. **Runtime bootstrap (`Lumo.html` + `src/app.js`) wires systems**.
4. **Core systems (`src/core`) provide engine primitives**.
5. **Game systems (`src/game`) implement world, player, and entities behavior**.
