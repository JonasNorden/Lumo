import {
  BRUSH_BEHAVIOR_OPTIONS,
  BRUSH_SIZE_OPTIONS,
  BRUSH_SPRITE_OPTIONS,
} from "../domain/tiles/brushOptions.js";
import {
  getBrushDraftSummary,
  isBrushDraftValid,
} from "../domain/tiles/brushDraft.js";

function renderOptions(options, selectedValue) {
  return options
    .map(
      (option) =>
        `<option value="${option.value}" ${option.value === selectedValue ? "selected" : ""}>${option.label}</option>`,
    )
    .join("");
}

export function renderBrushPanel(panel, state) {
  const brushDraft = state.brush.activeDraft;
  const summary = getBrushDraftSummary(brushDraft);
  const valid = isBrushDraftValid(brushDraft);

  panel.innerHTML = `
    <div class="panelHeader">
      <span class="panelTitle">Brush</span>
      <span class="badge ${valid ? "" : "badgeWarn"}">${valid ? "ready" : "invalid"}</span>
    </div>

    <label class="fieldRow">
      <span class="label">Behavior</span>
      <select data-brush-field="behavior">
        ${renderOptions(BRUSH_BEHAVIOR_OPTIONS, brushDraft.behavior)}
      </select>
    </label>

    <label class="fieldRow">
      <span class="label">Size</span>
      <select data-brush-field="size">
        ${renderOptions(BRUSH_SIZE_OPTIONS, brushDraft.size)}
      </select>
    </label>

    <label class="fieldRow">
      <span class="label">Sprite</span>
      <select data-brush-field="sprite">
        ${renderOptions(BRUSH_SPRITE_OPTIONS, brushDraft.sprite)}
      </select>
    </label>

    <div class="infoGroup compact">
      <div class="label">Current</div>
      <div class="value">${summary}</div>
    </div>
  `;
}

export function bindBrushPanel(panel, store) {
  const onChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;

    const field = target.dataset.brushField;
    if (!field) return;

    store.setState((draft) => {
      draft.brush.activeDraft[field] = target.value;
    });
  };

  panel.addEventListener("change", onChange);

  return () => {
    panel.removeEventListener("change", onChange);
  };
}
