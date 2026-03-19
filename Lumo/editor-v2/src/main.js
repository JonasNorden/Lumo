import { createEditorApp } from "./app/createEditorApp.js";
import { createEditorState } from "./state/createEditorState.js";
import { createStore } from "./state/createStore.js";

const canvas = document.getElementById("editorCanvas");
const minimapCanvas = document.getElementById("minimapCanvas");
const inspector = document.getElementById("inspectorPanel");
const brushPanel = document.getElementById("brushPanel");
const cellHud = document.getElementById("cellHud");
const canvasTargetControls = document.getElementById("canvasTargetControls");
const canvasTargetStatus = document.getElementById("canvasTargetStatus");

if (!canvas || !minimapCanvas || !inspector || !brushPanel || !cellHud || !canvasTargetControls || !canvasTargetStatus) {
  throw new Error("LumoEditor V2 shell is missing required DOM nodes");
}

const store = createStore(createEditorState());
createEditorApp({ canvas, minimapCanvas, inspector, brushPanel, cellHud, canvasTargetControls, canvasTargetStatus, store });
