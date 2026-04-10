function isNodeRuntime() {
  return Boolean(globalThis.process?.versions?.node);
}

// Prefers browser-safe URL loading when not in a real Node runtime.
export async function startRuntimeFromLevelPath(levelPath, options = {}) {
  if (isNodeRuntime()) {
    const { startRuntimeFromLevelPathNode } = await import("./startRuntimeFromLevelPathNode.js");
    return startRuntimeFromLevelPathNode(levelPath, options);
  }

  const { startRuntimeFromLevelUrl } = await import("./startRuntimeFromLevelUrl.js");
  return startRuntimeFromLevelUrl(levelPath, options);
}
