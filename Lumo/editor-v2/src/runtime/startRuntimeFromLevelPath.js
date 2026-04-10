import { startRuntimeFromLevelUrl } from "./startRuntimeFromLevelUrl.js";

// Browser-safe alias kept for compatibility with existing path-based callers.
// Node-only path startup lives in startRuntimeFromLevelPathNode.js and must be imported explicitly by Node harnesses.
export async function startRuntimeFromLevelPath(levelPath, options = {}) {
  return startRuntimeFromLevelUrl(levelPath, options);
}
