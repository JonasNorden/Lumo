import { createEditorState } from "../state/createEditorState.js";
import { createRenderer } from "../render/renderer.js";
import { bindLayout } from "../ui/bindLayout.js";
import { tilesFeatureStub } from "../features/tiles/index.js";

export function createEditorApp(root) {
  const canvas = root.querySelector("[data-workspace-canvas]");
  const state = createEditorState();
  const renderer = createRenderer(canvas);

  state.session.tilesFeature = tilesFeatureStub.status;
  bindLayout(root, state);

  function frame() {
    renderer.render(state);
    requestAnimationFrame(frame);
  }

  frame();

  return { state };
}
