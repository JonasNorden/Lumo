export function bindLayout(root, state) {
  root.querySelector("[data-ui-version]").textContent = state.session.version;
  root.querySelector("[data-ui-tool]").textContent = `Tool: ${state.tool.active}`;
  root.querySelector("[data-ui-doc-name]").textContent = state.document.name;
  root.querySelector("[data-ui-grid-size]").textContent = `${state.document.tileSize} px`;
  root.querySelector("[data-ui-zoom]").textContent = `${Math.round(state.viewport.zoom * 100)}%`;
  root.querySelector("[data-ui-camera]").textContent = `${state.viewport.camera.x}, ${state.viewport.camera.y}`;
}
