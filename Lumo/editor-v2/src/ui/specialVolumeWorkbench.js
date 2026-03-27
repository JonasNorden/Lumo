import { getEntityParamInputType, getNestedEntityParam } from "../domain/entities/entityParams.js";
import {
  getFogVolumeRect,
  getFogWorkbenchFieldMeta,
  getSpecialVolumeDescriptor,
  isSpecialVolumeEntityType,
} from "../domain/entities/specialVolumeTypes.js";
import { getPrimarySelectedEntityIndex } from "../domain/entities/selection.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatLabel(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

function resolveSelectedSpecialVolume(state) {
  const doc = state?.document?.active;
  if (!doc) return null;

  const entities = Array.isArray(doc.entities) ? doc.entities : [];
  const selectedId = typeof state?.interaction?.selectedEntityId === "string" && state.interaction.selectedEntityId.trim()
    ? state.interaction.selectedEntityId.trim()
    : null;
  const selectedById = selectedId ? entities.findIndex((entity) => entity?.id === selectedId) : -1;
  const selectedIndex = selectedById >= 0
    ? selectedById
    : getPrimarySelectedEntityIndex(state?.interaction, entities);

  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= entities.length) return null;

  const entity = entities[selectedIndex];
  if (!isSpecialVolumeEntityType(entity?.type)) return null;

  return { index: selectedIndex, entity };
}

function renderWorkbenchField(selection, path) {
  const value = getNestedEntityParam(selection.entity?.params, path);
  const inputType = getEntityParamInputType(value);
  const fieldMeta = getFogWorkbenchFieldMeta(path);
  const label = fieldMeta?.label || formatLabel(path.split(".").at(-1));
  const entityId = typeof selection.entity?.id === "string" ? selection.entity.id : "";
  const min = Number.isFinite(Number(fieldMeta?.min)) ? `min="${Number(fieldMeta.min)}"` : "";
  const max = Number.isFinite(Number(fieldMeta?.max)) ? `max="${Number(fieldMeta.max)}"` : "";
  const step = Number.isFinite(Number(fieldMeta?.step))
    ? `step="${Number(fieldMeta.step)}"`
    : inputType === "number"
      ? 'step="any"'
      : "";

  if (inputType === "boolean") {
    return `
      <label class="fieldRow compactInline compactBooleanField selectionInlineField selectionInlineCheckbox selectionParamField selectionParamCheckbox">
        <span class="label">${escapeHtml(label)}</span>
        <input
          type="checkbox"
          ${value ? "checked" : ""}
          data-entity-param-path="${escapeHtml(path)}"
          data-entity-param-type="boolean"
          data-entity-index="${selection.index}"
          data-entity-id="${escapeHtml(entityId)}"
          data-live-param="true"
        />
      </label>
    `;
  }

  const renderedValue = inputType === "number"
    ? String(Number.isFinite(Number(value)) ? Number(value) : "")
    : String(value ?? "");

  return `
    <label class="fieldRow fieldRowCompact selectionInlineField selectionParamField">
      <span class="label">${escapeHtml(label)}</span>
      <input
        type="${inputType === "number" ? "number" : "text"}"
        ${inputType === "number" ? `${step} ${min} ${max}` : ""}
        value="${escapeHtml(renderedValue)}"
        data-entity-param-path="${escapeHtml(path)}"
        data-entity-param-type="${escapeHtml(inputType === "number" ? "number" : "string")}"
        data-entity-index="${selection.index}"
        data-entity-id="${escapeHtml(entityId)}"
        data-live-param="true"
      />
    </label>
  `;
}

function renderWorkbenchSection(selection, section) {
  const fields = Array.isArray(section?.fields) ? section.fields : [];
  const sectionFields = fields
    .map((fieldName) => renderWorkbenchField(selection, `${section.key}.${fieldName}`))
    .join("");

  return `
    <section class="specialVolumeWorkbenchSection">
      <header class="specialVolumeWorkbenchSectionHeader">${escapeHtml(section.title || formatLabel(section.key || "section"))}</header>
      <div class="selectionEditorFlow specialVolumeWorkbenchSectionFields">
        ${sectionFields}
      </div>
    </section>
  `;
}

export function getSpecialVolumeWorkbenchContent(state) {
  const selection = resolveSelectedSpecialVolume(state);
  if (!selection) return null;

  const descriptor = getSpecialVolumeDescriptor(selection.entity.type);
  if (!descriptor) return null;

  const tileSize = state?.document?.active?.dimensions?.tileSize || 24;
  const rect = descriptor.type === "fog_volume"
    ? getFogVolumeRect(selection.entity, tileSize)
    : null;
  const metricsMarkup = rect
    ? `
      <div class="specialVolumeWorkbenchMetrics">
        <span>Width ${Math.round(rect.width)}px</span>
        <span>Baseline ${Math.round(rect.y0)}px</span>
        <span>Thickness ${Math.round(rect.height)}px</span>
      </div>
    `
    : "";
  const sections = Array.isArray(descriptor.paramSections) ? descriptor.paramSections : [];

  return {
    isEmpty: false,
    markup: `
      <div class="selectionInspectorCard specialVolumeWorkbench" data-special-volume-workbench="${escapeHtml(descriptor.type)}">
        <header class="specialVolumeWorkbenchHeader">
          <h3>Special Volume Workbench</h3>
          <p>${escapeHtml(descriptor.label)}</p>
          ${metricsMarkup}
        </header>
        <div class="specialVolumeWorkbenchBody">
          ${sections.map((section) => renderWorkbenchSection(selection, section)).join("")}
        </div>
      </div>
    `,
  };
}
