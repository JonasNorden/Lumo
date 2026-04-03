const TILE_CATALOG_SCRIPT_URL = "../data/catalog_tiles.js";

async function loadTileCatalogScriptFresh() {
  if (typeof window === "undefined" || typeof fetch !== "function") return;
  window.__LUMO_TILE_CATALOG_SCRIPT_STATUS = {
    url: TILE_CATALOG_SCRIPT_URL,
    exists: false,
    loading: true,
    loadedAt: null,
  };

  const cacheBustedUrl = `${TILE_CATALOG_SCRIPT_URL}?v=${Date.now()}`;
  const response = await fetch(cacheBustedUrl, { cache: "no-store" });
  if (!response.ok) {
    window.__LUMO_TILE_CATALOG_SCRIPT_STATUS.loading = false;
    throw new Error(`Failed to load tile catalog script (${response.status})`);
  }

  const source = await response.text();
  window.__LUMO_TILE_CATALOG_SCRIPT_STATUS.exists = true;
  window.LUMO_CATALOG_TILES = undefined;
  Function(`${source}\n//# sourceURL=${cacheBustedUrl}`)();
  window.__LUMO_TILE_CATALOG_SCRIPT_STATUS.loading = false;
  window.__LUMO_TILE_CATALOG_SCRIPT_STATUS.loadedAt = new Date().toISOString();
}

async function bootstrapEditor() {
  await loadTileCatalogScriptFresh();

  const [{ createEditorApp }, { createEditorState }, { createStore }] = await Promise.all([
    import("./app/createEditorApp.js"),
    import("./state/createEditorState.js"),
    import("./state/createStore.js"),
  ]);

  const canvas = document.getElementById("editorCanvas");
  const minimapCanvas = document.getElementById("minimapCanvas");
  const floatingPanelHost = document.getElementById("floatingPanelHost");
  const inspector = document.getElementById("inspectorPanel");
  const brushPanel = document.getElementById("brushPanel");
  const cellHud = document.getElementById("cellHud");
  const topBar = document.getElementById("topBar");
  const topBarStatus = document.getElementById("topBarStatus");
  const topBarExportMenu = document.getElementById("topBarExportMenu");
  const topBarSettingsMenu = document.getElementById("topBarSettingsMenu");
  const topBarHelpMenu = document.getElementById("topBarHelpMenu");
  const bottomPanel = document.getElementById("bottomPanel");

  if (!canvas || !minimapCanvas || !floatingPanelHost || !inspector || !brushPanel || !cellHud || !topBar || !topBarStatus || !topBarExportMenu || !topBarSettingsMenu || !topBarHelpMenu || !bottomPanel) {
    throw new Error("Lumo Editor shell is missing required DOM nodes");
  }

  const store = createStore(createEditorState());

  createEditorApp({
    canvas,
    minimapCanvas,
    floatingPanelHost,
    inspector,
    brushPanel,
    cellHud,
    topBar,
    topBarStatus,
    topBarExportMenu,
    topBarSettingsMenu,
    topBarHelpMenu,
    bottomPanel,
    store,
  });
}

bootstrapEditor();
