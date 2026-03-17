import { createEditorApp } from "./app/createEditorApp.js";
import { createEditorState } from "./state/createEditorState.js";
import { createStore } from "./state/createStore.js";

const canvas = document.getElementById("editorCanvas");
const inspector = document.getElementById("inspectorPanel");
const brushPanel = document.getElementById("brushPanel");

if (!canvas || !inspector || !brushPanel) {
  throw new Error("LumoEditor V2 shell is missing required DOM nodes");
}

const store = createStore(createEditorState());
createEditorApp({ canvas, inspector, brushPanel, store });
