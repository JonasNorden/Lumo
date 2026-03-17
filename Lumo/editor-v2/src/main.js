import { createEditorApp } from "./app/createEditorApp.js";
import { createEditorState } from "./state/createEditorState.js";
import { createStore } from "./state/createStore.js";

const canvas = document.getElementById("editorCanvas");
const inspector = document.getElementById("inspectorPanel");

if (!canvas || !inspector) {
  throw new Error("LumoEditor V2 shell is missing required DOM nodes");
}

const store = createStore(createEditorState());
createEditorApp({ canvas, inspector, store });
