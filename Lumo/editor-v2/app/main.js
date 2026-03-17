import { createEditorApp } from "./createEditorApp.js";

const root = document.querySelector("#app");

if (!root) {
  throw new Error("LumoEditor v2 root element missing.");
}

createEditorApp(root);
