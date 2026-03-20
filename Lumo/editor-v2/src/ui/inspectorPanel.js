function renderEmptyInspector(panel) {
  panel.innerHTML = "";
  panel.classList?.toggle?.("isEmpty", true);
}

export function renderInspector(panel) {
  renderEmptyInspector(panel);
}

export function bindInspectorPanel() {
  return () => {};
}
