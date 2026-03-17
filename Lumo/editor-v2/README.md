# LumoEditor v2 (foundation)

Standalone delprojekt för nästa generation editor.

## Start

Öppna `editor-v2/index.html` i en lokal server, exempelvis:

```bash
cd Lumo
python3 -m http.server 4173
```

Besök sedan `http://localhost:4173/editor-v2/`.

## Struktur

- `app/` app shell och bootstrap
- `core/` grundkonstanter
- `state/` intern state-stomme
- `render/` canvas render-pipeline
- `ui/` layout binding + styles
- `features/tiles/` plats för framtida tile workflow
