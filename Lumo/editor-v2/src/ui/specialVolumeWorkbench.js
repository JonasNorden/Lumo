import { getEntityParamInputType, getNestedEntityParam } from "../domain/entities/entityParams.js";
import { getEntityVisual } from "../domain/entities/entityVisuals.js";
import {
  getFogVolumeParams,
  getFogVolumeRect,
  getFogWorkbenchFieldMeta,
  getSpecialVolumeDescriptor,
  isFogVolumeEntityType,
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

export function resolveSelectedSpecialVolume(state) {
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
  const numericInputMarkup = inputType === "number"
    ? `
      <div class="specialVolumeWorkbenchNumberInput" data-fog-number-field>
        <input
          type="number"
          ${step} ${min} ${max}
          value="${escapeHtml(renderedValue)}"
          data-entity-param-path="${escapeHtml(path)}"
          data-entity-param-type="number"
          data-entity-index="${selection.index}"
          data-entity-id="${escapeHtml(entityId)}"
          data-fog-number-step="${escapeHtml(String(fieldMeta?.step ?? ""))}"
          data-fog-number-min="${escapeHtml(String(fieldMeta?.min ?? ""))}"
          data-fog-number-max="${escapeHtml(String(fieldMeta?.max ?? ""))}"
          data-live-param="true"
        />
        <div class="selectionStepperButtons" data-fog-stepper-buttons>
          <button type="button" class="selectionStepperButton" data-fog-step-direction="1" aria-label="Increase ${escapeHtml(label)}">▲</button>
          <button type="button" class="selectionStepperButton" data-fog-step-direction="-1" aria-label="Decrease ${escapeHtml(label)}">▼</button>
        </div>
      </div>
    `
    : `
      <input
        type="text"
        value="${escapeHtml(renderedValue)}"
        data-entity-param-path="${escapeHtml(path)}"
        data-entity-param-type="string"
        data-entity-index="${selection.index}"
        data-entity-id="${escapeHtml(entityId)}"
        data-live-param="true"
      />
    `;

  return `
    <label class="fieldRow fieldRowCompact selectionInlineField selectionParamField">
      <span class="label">${escapeHtml(label)}</span>
      ${numericInputMarkup}
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

function renderFogPreview(selection, rect) {
  const params = getFogVolumeParams(selection.entity);
  const area = params.area || {};
  const look = params.look || {};
  const smoothing = params.smoothing || {};
  const interaction = params.interaction || {};
  const organic = params.organic || {};
  const render = params.render || {};
  const density = Math.min(1, Math.max(0, Number(look.density) || 0));
  const exposure = Math.min(4, Math.max(0.1, Number(look.exposure) || 1));
  const thickness = Math.max(1, Math.min(240, Number(look.thickness) || 44));
  const noise = Math.min(1, Math.max(0, Number(look.noise) || 0));
  const drift = Math.min(8, Math.max(-8, Number(look.drift) || 0));
  const diffuse = Math.min(1, Math.max(0, Number(smoothing.diffuse) || 0));
  const relax = Math.min(1, Math.max(0, Number(smoothing.relax) || 0));
  const visc = Math.min(1, Math.max(0, Number(smoothing.visc) || 0));
  const push = Math.min(12, Math.max(0, Number(interaction.push) || 0));
  const bulge = Math.min(12, Math.max(0, Number(interaction.bulge) || 0));
  const organicStrength = Math.min(4, Math.max(0, Number(organic.strength) || 0));
  const organicSpeed = Math.min(8, Math.max(0, Number(organic.speed) || 0));
  const falloffPx = Math.max(0, Number(area.falloff) || Number(rect?.falloff) || 0);
  const spanWidthPx = Math.max(1, Number(rect?.width) || Math.abs((Number(area.x1) || 0) - (Number(area.x0) || 0)) || 1);
  const spanCoverage = Math.max(0.32, Math.min(0.92, spanWidthPx / Math.max(spanWidthPx + (falloffPx * 2) + 240, 1)));
  const spanStartPct = (1 - spanCoverage) * 0.5;
  const spanEndPct = spanStartPct + spanCoverage;
  const edgeFadePct = Math.max(1.5, Math.min(38, (falloffPx / Math.max(spanWidthPx, 1)) * 120));
  const color = String(look.color || "#E1EEFF");
  const blend = String(render.blend || "screen");
  const lumoBehindFog = Boolean(render.lumoBehindFog);
  const fogOpacity = Math.min(0.95, 0.15 + (density * 0.65 * exposure));
  const lumoVisual = getEntityVisual("player-spawn");
  const lumoSprite = typeof lumoVisual?.img === "string" && lumoVisual.img.trim()
    ? lumoVisual.img.trim()
    : "";

  return `
    <section class="specialVolumeWorkbenchPreviewPane" data-fog-preview-root>
      <header class="specialVolumeWorkbenchPreviewHeader">
        <h4>Live Preview</h4>
        <p>Responds instantly to Look, Smoothing, Interaction, Organic, and Render values.</p>
      </header>
      <div
        class="volumeWorkbenchPreviewSurface volumeWorkbenchPreviewSurface--span fogWorkbenchPreviewSurface isAnimated"
        data-fog-preview-surface
        style="
          --volume-span-start:${(spanStartPct * 100).toFixed(2)}%;
          --volume-span-end:${(spanEndPct * 100).toFixed(2)}%;
          --fog-color:${escapeHtml(color)};
          --fog-opacity:${fogOpacity.toFixed(3)};
          --fog-thickness:${Math.round(thickness)}px;
          --fog-falloff-pct:${edgeFadePct.toFixed(2)}%;
          --fog-noise:${noise.toFixed(3)};
          --fog-drift:${drift.toFixed(3)};
          --fog-diffuse:${diffuse.toFixed(3)};
          --fog-relax:${relax.toFixed(3)};
          --fog-visc:${visc.toFixed(3)};
          --fog-push:${push.toFixed(3)};
          --fog-bulge:${bulge.toFixed(3)};
          --fog-organic:${organicStrength.toFixed(3)};
          --fog-organic-speed:${organicSpeed.toFixed(3)};
          --fog-blend:${escapeHtml(blend)};
        "
      >
        <div class="fogWorkbenchPreviewBackdrop"></div>
        <div class="volumeWorkbenchPreviewSpan" data-volume-preview-span>
          <div class="fogWorkbenchPreviewSpanStop isStart" data-fog-preview-stop="start"></div>
          <div class="fogWorkbenchPreviewSpanStop isEnd" data-fog-preview-stop="end"></div>
          <div class="fogWorkbenchPreviewBands"></div>
          <div class="fogWorkbenchPreviewBands isSecondary"></div>
          <div class="fogWorkbenchPreviewMist"></div>
          <div class="fogWorkbenchPreviewWake"></div>
          <div class="fogWorkbenchPreviewDisturbance"></div>
          <div class="fogWorkbenchPreviewLumo ${lumoBehindFog ? "isBehindFog" : "isAheadOfFog"}" data-fog-preview-lumo>
            ${lumoSprite
    ? `<img class="fogWorkbenchPreviewLumoSprite" src="${escapeHtml(lumoSprite)}" alt="Lumo preview patrol" draggable="false" />`
    : '<span class="fogWorkbenchPreviewLumoBody"></span>'}
            <span class="fogWorkbenchPreviewLumoGlow"></span>
          </div>
        </div>
      </div>
      <div class="fogWorkbenchPreviewMeta">
        <span>Density {${density.toFixed(2)}}</span>
        <span>Falloff {${Math.round(falloffPx)}px}</span>
        <span>Thickness {${Math.round(thickness)}px}</span>
        <span>Blend {${escapeHtml(blend)}}</span>
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

export function getSpecialVolumeWorkbenchModalContent(state) {
  const selection = resolveSelectedSpecialVolume(state);
  if (!selection || !isFogVolumeEntityType(selection.entity?.type)) return null;
  const openEntityId = typeof state?.ui?.specialVolumeWorkbench?.openEntityId === "string"
    ? state.ui.specialVolumeWorkbench.openEntityId
    : null;
  if (openEntityId !== selection.entity.id) return null;

  const descriptor = getSpecialVolumeDescriptor(selection.entity.type);
  if (!descriptor) return null;

  const tileSize = state?.document?.active?.dimensions?.tileSize || 24;
  const rect = getFogVolumeRect(selection.entity, tileSize);
  const sections = Array.isArray(descriptor.paramSections) ? descriptor.paramSections : [];
  const fallbackHint = state?.ui?.specialVolumeWorkbench?.mode === "bottom-panel";

  return {
    isEmpty: false,
    markup: `
      <section class="specialVolumeWorkbenchModal" data-special-volume-modal="${escapeHtml(descriptor.type)}">
        <header class="specialVolumeWorkbenchModalHeader">
          <div>
            <h3>Special Volumes Workbench · Fog</h3>
            <p>Tune authored fog behavior from one focused modal.</p>
          </div>
          <div class="specialVolumeWorkbenchMetrics">
            <span>Width ${Math.round(rect.width)}px</span>
            <span>Baseline ${Math.round(rect.y0)}px</span>
            <span>Thickness ${Math.round(rect.height)}px</span>
          </div>
        </header>
        <div class="specialVolumeWorkbenchModalBody">
          <section class="specialVolumeWorkbenchControlsPane" data-fog-workbench-controls>
            <div class="specialVolumeWorkbenchControlSections">
              ${sections.map((section) => renderWorkbenchSection(selection, section)).join("")}
            </div>
            <footer class="specialVolumeWorkbenchControlsFooter">
              <div class="specialVolumeWorkbenchFooterActions">
                <button type="button" class="toolButton" data-fog-workbench-action="save-defaults">Save as default for new Fog</button>
                <button type="button" class="toolButton isPrimary" data-fog-workbench-action="done">Done</button>
              </div>
              ${fallbackHint ? '<span class="fieldMeta">Bottom-panel path is active as fallback.</span>' : ""}
            </footer>
          </section>
          ${renderFogPreview(selection, rect)}
        </div>
      </section>
    `,
  };
}

export function getSpecialVolumeWorkbenchLauncherContent(state) {
  const selection = resolveSelectedSpecialVolume(state);
  if (!selection || !isFogVolumeEntityType(selection.entity?.type)) return "";
  const openEntityId = typeof state?.ui?.specialVolumeWorkbench?.openEntityId === "string"
    ? state.ui.specialVolumeWorkbench.openEntityId
    : null;
  if (openEntityId === selection.entity.id) return "";
  return `
    <section class="specialVolumeWorkbenchLauncher" data-special-volume-launcher>
      <span>Fog selected. Open Workbench when ready to edit.</span>
      <button type="button" class="toolButton isPrimary" data-fog-workbench-action="open">Edit Fog</button>
    </section>
  `;
}
