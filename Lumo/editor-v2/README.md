# LumoEditor v2 (foundation)

Standalone delprojekt för nästa generation editor.

## Start

Öppna `editor-v2/index.html` i en lokal server, exempelvis:

```bash
cd Lumo
python3 -m http.server 4173
```

Besök sedan `http://localhost:4173/editor-v2/`.

## Tile persistence bridge (local dev)

För beständig Tile-save i Asset Manager wizard (överlever reload/F5), starta också den lokala bridge-servern:

```bash
cd Lumo
node editor-v2/dev/localTileSaveBridge.js
```

Bridge-endpoint: `POST http://localhost:4180/api/editor-v2/tiles/save`.

## Struktur

- `app/` app shell och bootstrap
- `core/` grundkonstanter
- `state/` intern state-stomme
- `render/` canvas render-pipeline
- `ui/` layout binding + styles
- `features/tiles/` plats för framtida tile workflow
