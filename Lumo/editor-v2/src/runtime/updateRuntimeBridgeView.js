import { drawRuntimeBridgeView } from "./drawRuntimeBridgeView.js";
import { renderRuntimeBridgeViewModel } from "./renderRuntimeBridgeViewModel.js";

function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Reads active bridge state, builds a view model, and draws one runtime bridge frame.
export function updateRuntimeBridgeView(runtimePageState = {}) {
  const errors = [];
  const warnings = [];

  const viewModel = renderRuntimeBridgeViewModel({
    bridge: runtimePageState?.bridge ?? null,
    debugApi: runtimePageState?.debugApi ?? null,
  });

  errors.push(...(viewModel?.errors ?? []));
  warnings.push(...(viewModel?.warnings ?? []));

  const drawResult = drawRuntimeBridgeView(runtimePageState?.canvas ?? null, viewModel, runtimePageState?.viewOptions ?? {});
  errors.push(...(drawResult?.errors ?? []));
  warnings.push(...(drawResult?.warnings ?? []));

  return {
    ok: errors.length === 0,
    viewModel,
    errors: uniqueMessages(errors),
    warnings: uniqueMessages(warnings),
  };
}
