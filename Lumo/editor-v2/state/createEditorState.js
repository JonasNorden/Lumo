import { DEFAULT_VIEWPORT, EDITOR_VERSION, GRID_SIZE } from "../core/constants.js";

export function createEditorState() {
  return {
    session: {
      version: EDITOR_VERSION,
      startedAt: new Date().toISOString(),
      mode: "read-only",
    },
    document: {
      id: "draft-v2",
      name: "Untitled Level",
      tileSize: GRID_SIZE,
      width: 160,
      height: 90,
    },
    ui: {
      leftPanelOpen: true,
      rightPanelOpen: true,
      status: "ready",
    },
    viewport: {
      ...DEFAULT_VIEWPORT,
    },
    tool: {
      active: "inspect",
      available: ["inspect"],
    },
    selection: {
      type: "none",
      ids: [],
    },
  };
}
