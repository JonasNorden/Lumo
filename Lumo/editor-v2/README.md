# LumoEditor v2 (foundation)

Standalone delprojekt för nästa generation editor.

## Start

På Windows, kör från Lumo-mappen (eller dubbelklicka på filen):

```powershell
.\Start-Lumo-Editor-V2.bat
```

Skriptet hittar Python via `py -3` eller `python`, binder endast till `127.0.0.1`,
och öppnar editorn först när servern svarar. Om port 4173 är upptagen provas nästa
port (upp till 20 portar). Den valda adressen visas i serverfönstret. Behåll
fönstret öppet; Ctrl+C stoppar servern. En annan startport kan anges med
`Start-Lumo-Editor-V2.bat --port 8080`.

Manuell start utan npm eller externa bibliotek:

```bash
cd Lumo
py -3 -m http.server 4173 --bind 127.0.0.1
```

Besök sedan `http://127.0.0.1:4173/editor-v2/`. På andra system kan `python3`
användas i stället för `py -3`.

## Play From Here

Importera eller skapa en bana, redigera och klicka **Play From Here**. Ingen
export krävs. En giltig vald cell används som startposition; annars används
authored spawn eller runtime-standard. Originaldokumentet ändras inte.

Runtime öppnas på samma hostname, protokoll och port som editorn, även när Lumo
ligger i en undermapp. Tillåt popup-fönster för den lokala editoradressen.
Blockerade popup-fönster ger ett fel i statusraden och behåller osparat arbete.

Statusraden skiljer på start påbörjad, runtime öppnad, aktuell snapshot laddad,
runtime redo och fel. Varje launch har ett unikt ID. En enda fullständig JSON-kopia
överförs med Blob-URL; gammal sessionStorage används inte av Recharged. Håll
editortabben öppen medan du provspelar: den äger Blob-URL:en, som städas när
spelfönstret stängs. Reload av editorn avslutar den snapshotens livslängd.
Om ett uttryckligt editorplaytest saknar giltig data visas fel i runtime i stället
för att ladda standardbana eller legacy. Om runtime inte är redo inom 30 sekunder
visar editorn ett timeoutfel. Launch-ID, bana, dimensioner, spawn och datakälla
finns i konsolloggen.

### Regressionstester

Från repository-roten (mappen ovanför `Lumo`):

```powershell
Get-ChildItem Lumo/editor-v2/tests/*checks.mjs | ForEach-Object { node $_.FullName }
node --test Lumo/editor-v2/tests/play-from-here-reliability-checks.mjs
py -m unittest discover -s Lumo/editor-v2/tests -p test_start_editor.py -v
```

Verkliga browserfall finns i `tests/play-from-here-browser.cjs`. Kör med befintlig
Playwright-installation tillgänglig på `NODE_PATH` och en Chromium-installation
(eller `LUMO_CHROME` med sökvägen till Chrome). `LUMO_PYTHON` kan ange Python.
Ingen av dessa testverktyg behövs för att använda editorn.

```powershell
node Lumo/editor-v2/tests/play-from-here-browser.cjs
```

## Tile/Background persistence bridge (local dev)

För beständig Tile/Background-save i Asset Manager wizard (överlever reload/F5), starta också den lokala bridge-servern:

```bash
cd Lumo
node editor-v2/dev/localTileSaveBridge.js
```

Bridge-endpoints:
- `POST http://localhost:4180/api/editor-v2/tiles/save`
- `POST http://localhost:4180/api/editor-v2/background/save`

## Struktur

- `app/` app shell och bootstrap
- `core/` grundkonstanter
- `state/` intern state-stomme
- `render/` canvas render-pipeline
- `ui/` layout binding + styles
- `features/tiles/` plats för framtida tile workflow
