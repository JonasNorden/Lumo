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

export function getFogPreviewPatrolPhase(elapsedMs, durationMs) {
  const safeDuration = Math.max(1200, Number(durationMs) || 0);
  const normalized = (((Number(elapsedMs) || 0) % safeDuration) + safeDuration) % safeDuration;
  const progress = normalized / safeDuration;
  const forward = progress < 0.5;
  const localProgress = forward ? progress / 0.5 : (progress - 0.5) / 0.5;
  const clampedLocal = Math.max(0, Math.min(1, localProgress));
  const xPct = forward ? clampedLocal * 100 : (1 - clampedLocal) * 100;
  return {
    xPct,
    facing: forward ? 1 : -1,
    progress,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function buildFogPreviewFieldProfile(config = {}) {
  const sampleCount = Math.max(24, Math.min(72, Math.round(Number(config.sampleCount) || 48)));
  const spanWidthPx = Math.max(1, Number(config.spanWidthPx) || 1);
  const falloffPx = Math.max(0, Number(config.falloffPx) || 0);
  const thicknessPx = Math.max(1, Number(config.thicknessPx) || 44);
  const density = clamp(Number(config.density) || 0, 0, 1);
  const noise = clamp(Number(config.noise) || 0, 0, 1);
  const diffuse = clamp(Number(config.diffuse) || 0, 0, 1);
  const relax = clamp(Number(config.relax) || 0, 0, 1);
  const visc = clamp(Number(config.visc) || 0, 0, 1);
  const push = clamp(Number(config.push) || 0, 0, 12);
  const bulge = clamp(Number(config.bulge) || 0, 0, 12);
  const radius = clamp(Number(config.radius) || 0, 0, 1024);
  const gate = clamp(Number(config.gate) || 0, 0, 256);
  const organicStrength = clamp(Number(config.organicStrength) || 0, 0, 4);
  const organicScale = clamp(Number(config.organicScale) || 1, 0.1, 8);
  const organicSpeed = clamp(Number(config.organicSpeed) || 0, 0, 8);
  const drift = clamp(Number(config.drift) || 0, -8, 8);
  const lift = clamp(Number(config.lift) || 0, -256, 256);
  const layers = clamp(Math.round(Number(config.layers) || 1), 1, 96);
  const nowSeconds = Number.isFinite(Number(config.nowSeconds)) ? Number(config.nowSeconds) : (Date.now() % 60000) / 1000;
  const interactionCenter = Number.isFinite(Number(config.interactionCenter)) ? Number(config.interactionCenter) : 0.5;
  const softening = (diffuse * 0.46) + (relax * 0.26) + ((1 - visc) * 0.28);
  const effectiveFalloff = falloffPx <= 0 ? 1 : falloffPx;
  const radiusRatio = clamp(radius / Math.max(spanWidthPx, 1), 0, 1.5);
  const gateResponse = 1 - clamp(gate / 256, 0, 1);
  const layeredDensityGain = clamp(0.6 + (layers / 54), 0.8, 2.3);

  const samples = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const u = sampleCount === 1 ? 0 : index / (sampleCount - 1);
    // Mirrors editor-v2/dev/sandbox/smooke.html drawFog() where the authored span
    // keeps a full body and applies a readable taper as x approaches x1.
    const dOpenPx = (1 - u) * spanWidthPx;
    const falloffMask = falloffPx <= 0 ? 1 : clamp(dOpenPx / effectiveFalloff, 0, 1);
    const edgeFactor = Math.pow(falloffMask, 0.86);
    const edgeHeightFactor = Math.pow(falloffMask, 0.78);
    const edgeDensityFactor = Math.pow(falloffMask, 0.68);
    const verticalWeight = 0.18 + (edgeHeightFactor * 0.82);
    const waveA = Math.sin((u * Math.PI * 2 * (1.2 / organicScale)) + (nowSeconds * (0.48 + organicSpeed * 0.07)));
    const waveB = Math.sin((u * Math.PI * 2 * (2.1 / organicScale)) - (nowSeconds * (0.38 + organicSpeed * 0.11)));
    const organicWave = organicStrength * ((waveA * 0.62) + (waveB * 0.38));
    const interactionDistance = Math.abs(u - interactionCenter);
    const interactionInfluence = radiusRatio <= 0
      ? 0
      : clamp(1 - (interactionDistance / Math.max(0.0001, radiusRatio)), 0, 1);
    const interactionWave = interactionInfluence * gateResponse * ((bulge * 0.16) - (push * 0.1));
    const smoothAmplitude = (1 - softening) * 0.72 + (visc * 0.28);
    const normalizedDensity = density * (0.2 + edgeDensityFactor * 0.8) * layeredDensityGain;
    const layerInfluence = clamp(layers / 32, 0.2, 3.4);
    const bodyRiseFactor = 0.78 + (edgeHeightFactor * 0.36);
    const coreHeightPx = clamp(
      ((thicknessPx * verticalWeight * bodyRiseFactor) + (thicknessPx * 0.22 * organicWave) + (thicknessPx * interactionWave * 0.2)) * smoothAmplitude,
      2,
      thicknessPx * 2.4,
    );
    const hazeHeightPx = clamp(coreHeightPx + thicknessPx * (0.25 + diffuse * 0.46 + relax * 0.22), 4, thicknessPx * 2.8);
    const opacity = clamp((normalizedDensity * (0.42 + layerInfluence * 0.18)) + (softening * 0.22), 0.06, 0.96);
    const upwardLift = clamp((Math.max(organicWave, 0) * 0.68) + (interactionWave * 0.45) + (Math.max(drift, 0) * 0.04), 0, 1.2);
    const offsetY = -(((upwardLift * 8) + (lift * 0.05)) * (0.55 + edgeHeightFactor * 0.45));
    const taper = clamp(0.12 + ((1 - edgeHeightFactor) * 0.88), 0, 1);
    const layerPhase = (u * Math.PI * 2 * (1.3 + (layers * 0.012))) + (nowSeconds * (0.4 + organicSpeed * 0.09));
    const layerWave = Math.sin(layerPhase) * 0.5 + 0.5;
    const layerJitter = clamp((0.72 + (layerWave * 0.56)) * (0.7 + noise * 0.3), 0.4, 1.45);
    samples.push({
      u,
      coreHeightPx: Number(coreHeightPx.toFixed(3)),
      hazeHeightPx: Number(hazeHeightPx.toFixed(3)),
      opacity: Number(opacity.toFixed(3)),
      offsetY: Number(offsetY.toFixed(3)),
      edgeFactor: Number(edgeFactor.toFixed(3)),
      taper: Number(taper.toFixed(3)),
      layerJitter: Number(layerJitter.toFixed(3)),
    });
  }
  return { sampleCount, samples };
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
  const radius = Math.min(1024, Math.max(0, Number(interaction.radius) || 0));
  const gate = Math.min(256, Math.max(0, Number(interaction.gate) || 0));
  const organicStrength = Math.min(4, Math.max(0, Number(organic.strength) || 0));
  const organicScale = Math.min(8, Math.max(0.1, Number(organic.scale) || 1));
  const organicSpeed = Math.min(8, Math.max(0, Number(organic.speed) || 0));
  const lift = Math.min(256, Math.max(-256, Number(look.lift) || 0));
  const layers = Math.min(96, Math.max(1, Math.round(Number(look.layers) || 1)));
  const traverseDurationMs = Math.max(2200, (9.6 - Math.min(4.6, organicSpeed * 0.65)) * 1000);
  const motionPhaseMs = -Math.round(Date.now() % traverseDurationMs);
  const falloffPx = Math.max(0, Number(area.falloff) || Number(rect?.falloff) || 0);
  const spanWidthPx = Math.max(1, Number(rect?.width) || Math.abs((Number(area.x1) || 0) - (Number(area.x0) || 0)) || 1);
  const spanCoverage = Math.max(0.32, Math.min(0.92, spanWidthPx / Math.max(spanWidthPx + (falloffPx * 2) + 240, 1)));
  const spanStartPct = (1 - spanCoverage) * 0.5;
  const spanEndPct = spanStartPct + spanCoverage;
  const edgeFadePct = Math.max(1.5, Math.min(38, (falloffPx / Math.max(spanWidthPx, 1)) * 120));
  const edgeFadeStartPct = Math.max(0.45, Math.min(4, edgeFadePct * 0.25));
  const color = String(look.color || "#E1EEFF");
  const blend = String(render.blend || "screen");
  const lumoBehindFog = Boolean(render.lumoBehindFog);
  const fogOpacity = Math.min(0.95, 0.15 + (density * 0.65 * exposure));
  const previewFieldProfile = buildFogPreviewFieldProfile({
    spanWidthPx,
    falloffPx,
    thicknessPx: thickness,
    density,
    noise,
    diffuse,
    relax,
    visc,
    push,
    bulge,
    radius,
    gate,
    organicStrength,
    organicScale,
    organicSpeed,
    drift,
    lift,
    layers,
  });
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
        data-fog-preview-traverse-ms="${Math.round(traverseDurationMs)}"
        style="
          --volume-span-start:${(spanStartPct * 100).toFixed(2)}%;
          --volume-span-end:${(spanEndPct * 100).toFixed(2)}%;
          --fog-color:${escapeHtml(color)};
          --fog-opacity:${fogOpacity.toFixed(3)};
          --fog-thickness:${Math.round(thickness)}px;
          --fog-ground-baseline:14px;
          --fog-falloff-pct:${edgeFadePct.toFixed(2)}%;
          --fog-falloff-start-pct:${edgeFadeStartPct.toFixed(2)}%;
          --fog-noise:${noise.toFixed(3)};
          --fog-drift:${drift.toFixed(3)};
          --fog-diffuse:${diffuse.toFixed(3)};
          --fog-relax:${relax.toFixed(3)};
          --fog-visc:${visc.toFixed(3)};
          --fog-push:${push.toFixed(3)};
          --fog-bulge:${bulge.toFixed(3)};
          --fog-radius:${radius.toFixed(3)};
          --fog-gate:${gate.toFixed(3)};
          --fog-organic:${organicStrength.toFixed(3)};
          --fog-organic-scale:${organicScale.toFixed(3)};
          --fog-organic-speed:${organicSpeed.toFixed(3)};
          --fog-lift:${lift.toFixed(3)}px;
          --fog-layers:${layers};
          --fog-preview-traverse-duration:${(traverseDurationMs / 1000).toFixed(3)}s;
          --fog-preview-motion-phase-ms:${motionPhaseMs}ms;
          --fog-blend:${escapeHtml(blend)};
        "
      >
        <div class="fogWorkbenchPreviewBackdrop"></div>
        <div class="volumeWorkbenchPreviewSpan" data-volume-preview-span>
          <div class="fogWorkbenchPreviewSpanStop isStart" data-fog-preview-stop="start"></div>
          <div class="fogWorkbenchPreviewSpanStop isEnd" data-fog-preview-stop="end"></div>
          <div class="fogWorkbenchPreviewField" data-fog-preview-field>
            ${previewFieldProfile.samples.map((sample) => `
              <span
                class="fogWorkbenchPreviewSample"
                style="
                  --fog-sample-x:${(sample.u * 100).toFixed(3)}%;
                  --fog-sample-core:${sample.coreHeightPx.toFixed(3)}px;
                  --fog-sample-haze:${sample.hazeHeightPx.toFixed(3)}px;
                  --fog-sample-opacity:${sample.opacity.toFixed(3)};
                  --fog-sample-offset:${sample.offsetY.toFixed(3)}px;
                  --fog-sample-edge:${sample.edgeFactor.toFixed(3)};
                  --fog-sample-taper:${sample.taper.toFixed(3)};
                  --fog-sample-layer-jitter:${sample.layerJitter.toFixed(3)};
                "
              ></span>
            `).join("")}
          </div>
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
