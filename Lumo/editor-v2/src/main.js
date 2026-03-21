import { createEditorApp } from "./app/createEditorApp.js";
import { resolveCleanRoomEntityMode } from "./app/cleanRoomEntityMode.js";
import { createEditorState } from "./state/createEditorState.js";
import { createStore } from "./state/createStore.js";

const canvas = document.getElementById("editorCanvas");
const minimapCanvas = document.getElementById("minimapCanvas");
const floatingPanelHost = document.getElementById("floatingPanelHost");
const inspector = document.getElementById("inspectorPanel");
const brushPanel = document.getElementById("brushPanel");
const cellHud = document.getElementById("cellHud");
const soundDebugOverlay = document.getElementById("soundDebugOverlay");
const topBar = document.getElementById("topBar");
const topBarStatus = document.getElementById("topBarStatus");
const topBarExportMenu = document.getElementById("topBarExportMenu");
const topBarSettingsMenu = document.getElementById("topBarSettingsMenu");
const topBarHelpMenu = document.getElementById("topBarHelpMenu");
const bottomPanel = document.getElementById("bottomPanel");

if (!canvas || !minimapCanvas || !floatingPanelHost || !inspector || !brushPanel || !cellHud || !soundDebugOverlay || !topBar || !topBarStatus || !topBarExportMenu || !topBarSettingsMenu || !topBarHelpMenu || !bottomPanel) {
  throw new Error("LumoEditor V2 shell is missing required DOM nodes");
}

const store = createStore(createEditorState());
const cleanRoomEntityMode = resolveCleanRoomEntityMode();

createEditorApp({
  canvas,
  minimapCanvas,
  floatingPanelHost,
  inspector,
  brushPanel,
  cellHud,
  soundDebugOverlay,
  topBar,
  topBarStatus,
  topBarExportMenu,
  topBarSettingsMenu,
  topBarHelpMenu,
  bottomPanel,
  store,
  cleanRoomEntityMode,
});
