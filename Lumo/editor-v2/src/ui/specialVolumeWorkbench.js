import { getFogVolumeParams, isFogVolumeEntityType } from "../domain/entities/specialVolumeTypes.js";
import { findEntityPresetById } from "../domain/entities/entityPresets.js";
import {
  VOLUME_PREVIEW_ENVIRONMENT,
  VOLUME_PREVIEW_GROUND_BASELINE_PX,
} from "./volumePreviewEnvironment.js";

const PREVIEW_SPAN_WIDTH_PX = 620;
const PREVIEW_CANVAS_WIDTH_PX = 620;
const PREVIEW_CANVAS_HEIGHT_PX = 188;
const PREVIEW_SAMPLE_COUNT = 32;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value, digits = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "0";
  return parsed.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function resolveSelectedEntity(state) {
  const doc = state?.document?.active;
  const entities = Array.isArray(doc?.entities) ? doc.entities : [];
  const interaction = state?.interaction || {};
  const selectedIndex = Number.isInteger(interaction.selectedEntityIndex)
    ? interaction.selectedEntityIndex
    : Array.isArray(interaction.selectedEntityIndices)
      ? interaction.selectedEntityIndices[0]
      : null;
  const selectedByIndex = Number.isInteger(selectedIndex) ? entities[selectedIndex] : null;
  const selectedId = typeof interaction.selectedEntityId === "string" ? interaction.selectedEntityId : null;
  const selectedById = selectedId ? entities.find((entity) => entity?.id === selectedId) : null;
  return selectedByIndex || selectedById || null;
}

export function resolveSelectedSpecialVolume(state) {
  const entity = resolveSelectedEntity(state);
  if (!entity || !isFogVolumeEntityType(entity.type)) return null;
  const entities = Array.isArray(state?.document?.active?.entities) ? state.document.active.entities : [];
  const index = entities.findIndex((entry) => entry?.id === entity.id);
  if (index < 0) return null;
  return { entity, index, type: "fog_volume" };
}

export function getSpecialVolumeWorkbenchContent() {
  return null;
}

function renderNumberField(selection, config) {
  const entity = selection.entity;
  const paramValue = config.read(entity);
  return `
    <label class="specialVolumeWorkbenchControlField" data-fog-number-field>
      <span class="label">${escapeHtml(config.label)}</span>
      <div class="specialVolumeWorkbenchNumberInput">
        <input
          type="number"
          value="${escapeHtml(formatNumber(paramValue, config.digits ?? 2))}"
          step="${escapeHtml(String(config.step))}"
          min="${escapeHtml(String(config.min))}"
          max="${escapeHtml(String(config.max))}"
          data-entity-index="${selection.index}"
          data-entity-id="${escapeHtml(entity.id || "")}"
          data-entity-param-path="${escapeHtml(config.path)}"
          data-entity-param-type="number"
          data-fog-number-step="${escapeHtml(String(config.step))}"
          data-fog-number-min="${escapeHtml(String(config.min))}"
          data-fog-number-max="${escapeHtml(String(config.max))}"
        />
        <span class="selectionStepperButtons">
          <button type="button" class="selectionStepperButton" data-fog-step-direction="-1" aria-label="Decrease ${escapeHtml(config.label)}">−</button>
          <button type="button" class="selectionStepperButton" data-fog-step-direction="1" aria-label="Increase ${escapeHtml(config.label)}">+</button>
        </span>
      </div>
    </label>
  `;
}

function getFogPreviewModel(entity, nowMs = Date.now()) {
  const params = getFogVolumeParams(entity);
  const density = clamp(Number(params.look.density), 0.02, 1);
  const thicknessPx = clamp(Number(params.look.thickness), 12, 160);
  const liftPx = clamp(Number(params.look.lift), 0, 120);
  const falloffPx = clamp(Number(params.area.falloff), 10, PREVIEW_SPAN_WIDTH_PX);
  const traverseDurationMs = 9600;

  return {
    params,
    density,
    thicknessPx,
    liftPx,
    falloffPx,
    traverseDurationMs,
    phaseMs: Math.round(nowMs % traverseDurationMs),
  };
}

function renderFogModal(selection) {
  const model = getFogPreviewModel(selection.entity);
  const lumoSpriteSrc = resolveLumoPreviewSpriteSrc();
  const readSpanLength = (entity) => {
    const params = getFogVolumeParams(entity);
    return Math.max(24, Number(params.area.x1) - Number(params.area.x0));
  };
  const numberFields = [
    { label: "Length", path: "area.length", min: 24, max: 4000, step: 24, digits: 0, read: readSpanLength },
    { label: "Density", path: "look.density", min: 0.02, max: 1, step: 0.01, digits: 2, read: (entity) => getFogVolumeParams(entity).look.density },
    { label: "Height above ground", path: "look.lift", min: 0, max: 120, step: 1, digits: 0, read: (entity) => getFogVolumeParams(entity).look.lift },
    { label: "Falloff Distance", path: "area.falloff", min: 10, max: 520, step: 1, digits: 0, read: (entity) => getFogVolumeParams(entity).area.falloff },
    { label: "Idle Amount", path: "organic.strength", min: 0, max: 1, step: 0.01, digits: 2, read: (entity) => getFogVolumeParams(entity).organic.strength },
    { label: "Idle Speed", path: "organic.speed", min: 0.1, max: 3, step: 0.05, digits: 2, read: (entity) => getFogVolumeParams(entity).organic.speed },
    { label: "Interaction Gate", path: "interaction.gate", min: 0, max: 260, step: 1, digits: 0, read: (entity) => getFogVolumeParams(entity).interaction.gate },
    { label: "Disturbance Radius", path: "interaction.radius", min: 10, max: 240, step: 1, digits: 0, read: (entity) => getFogVolumeParams(entity).interaction.radius },
    { label: "Lumo Influence Amount", path: "interaction.push", min: 0, max: 5, step: 0.05, digits: 2, read: (entity) => getFogVolumeParams(entity).interaction.push },
    { label: "Wake", path: "interaction.behind", min: 0, max: 3, step: 0.05, digits: 2, read: (entity) => getFogVolumeParams(entity).interaction.behind },
    { label: "Front Bulge Strength", path: "interaction.bulge", min: 0, max: 4, step: 0.05, digits: 2, read: (entity) => getFogVolumeParams(entity).interaction.bulge },
    { label: "Organic/Noise Strength", path: "look.noise", min: 0, max: 1, step: 0.01, digits: 2, read: (entity) => getFogVolumeParams(entity).look.noise },
    { label: "Drift Amount", path: "look.drift", min: -3, max: 3, step: 0.05, digits: 2, read: (entity) => getFogVolumeParams(entity).look.drift },
    { label: "Return Time", path: "smoothing.relax", min: 0.02, max: 1, step: 0.01, digits: 2, read: (entity) => getFogVolumeParams(entity).smoothing.relax },
    { label: "Viscosity", path: "smoothing.visc", min: 0.35, max: 0.995, step: 0.005, digits: 3, read: (entity) => getFogVolumeParams(entity).smoothing.visc },
  ];

  return {
    type: "fog_volume",
    markup: `
      <section class="specialVolumeWorkbenchModal panelSection" data-special-volume-modal="fog_volume">
        <header class="specialVolumeWorkbenchModalHeader">
          <div>
            <h3>Fog Volume</h3>
            <p>Tune fog behavior and verify the playable silhouette pass.</p>
          </div>
        </header>
        <div class="specialVolumeWorkbenchModalBody specialVolumeWorkbenchModalBodyStacked">
          <section class="specialVolumeWorkbenchControlsTop" data-fog-workbench-controls>
            ${numberFields.map((field) => renderNumberField(selection, field)).join("")}
          </section>
          <section class="specialVolumeWorkbenchPreviewPane specialVolumeWorkbenchPreviewPaneWide" data-fog-preview-root>
            <div
              class="volumeWorkbenchPreviewSurface fogWorkbenchPreviewSurface"
              data-fog-preview-surface
              data-fog-preview-width="${PREVIEW_CANVAS_WIDTH_PX}"
              data-fog-preview-height="${PREVIEW_CANVAS_HEIGHT_PX}"
              data-fog-preview-traverse-ms="${Math.round(model.traverseDurationMs)}"
              data-fog-preview-lumo-sprite="${escapeHtml(lumoSpriteSrc || "")}"
              data-fog-smooke-density="${model.params.look.density.toFixed(4)}"
              data-fog-smooke-noise="${model.params.look.noise.toFixed(4)}"
              data-fog-smooke-drift="${model.params.look.drift.toFixed(4)}"
              data-fog-smooke-organic-strength="${model.params.organic.strength.toFixed(4)}"
              data-fog-smooke-organic-scale="${model.params.organic.scale.toFixed(4)}"
              data-fog-smooke-organic-speed="${model.params.organic.speed.toFixed(4)}"
              data-fog-smooke-diffuse="${model.params.smoothing.diffuse.toFixed(4)}"
              data-fog-smooke-relax="${model.params.smoothing.relax.toFixed(4)}"
              data-fog-smooke-visc="${model.params.smoothing.visc.toFixed(4)}"
              data-fog-smooke-gate="${model.params.interaction.gate.toFixed(4)}"
              data-fog-smooke-radius="${model.params.interaction.radius.toFixed(4)}"
              data-fog-smooke-push="${model.params.interaction.push.toFixed(4)}"
              data-fog-smooke-wake="${model.params.interaction.behind.toFixed(4)}"
              data-fog-smooke-bulge="${model.params.interaction.bulge.toFixed(4)}"
              data-fog-preview-falloff="${model.falloffPx.toFixed(4)}"
              data-fog-thickness="${model.thicknessPx.toFixed(4)}"
              data-fog-lift="${model.liftPx.toFixed(4)}"
              data-volume-preview-environment="${VOLUME_PREVIEW_ENVIRONMENT}"
              style="--fog-ground-baseline:${VOLUME_PREVIEW_GROUND_BASELINE_PX}px;--fog-lift:${model.liftPx.toFixed(2)}px;--fog-thickness:${model.thicknessPx.toFixed(2)}px;--fog-falloff-pct:${((model.falloffPx / PREVIEW_SPAN_WIDTH_PX) * 100).toFixed(3)}%;--fog-opacity:${model.density.toFixed(4)};--fog-preview-motion-phase-ms:${model.phaseMs}ms;"
            >
              <canvas
                class="fogWorkbenchPreviewCanvas"
                data-fog-preview-canvas
                width="${PREVIEW_CANVAS_WIDTH_PX}"
                height="${PREVIEW_CANVAS_HEIGHT_PX}"
                aria-label="Fog behavior preview"
              ></canvas>
            </div>
          </section>
          <footer class="specialVolumeWorkbenchFooterPinned">
            <button type="button" class="specialVolumeWorkbenchActionButton isSecondary" data-fog-workbench-action="save-defaults">Save as default</button>
            <button type="button" class="specialVolumeWorkbenchActionButton isPrimary" data-fog-workbench-action="done">Done</button>
          </footer>
        </div>
      </section>
    `,
  };
}

function resolveLumoPreviewSpriteSrc() {
  const spawnPreset = findEntityPresetById("player-spawn");
  if (!spawnPreset || typeof spawnPreset.img !== "string" || !spawnPreset.img.trim()) return null;
  return spawnPreset.img.trim();
}

export function getSpecialVolumeWorkbenchLauncherContent(state) {
  const selection = resolveSelectedSpecialVolume(state);
  if (!selection) return "";
  const isOpen = state?.ui?.specialVolumeWorkbench?.openEntityId === selection.entity.id;
  if (isOpen) return "";
  return `
    <div class="specialVolumeWorkbenchLauncher">
      <span class="specialVolumeWorkbenchLauncherLabel">Fog selected</span>
      <button type="button" class="specialVolumeWorkbenchLauncherButton" data-fog-workbench-action="open">Adjust</button>
    </div>
  `;
}

export function getSpecialVolumeWorkbenchModalContent(state) {
  const selection = resolveSelectedSpecialVolume(state);
  if (!selection) return null;
  const isOpen = state?.ui?.specialVolumeWorkbench?.openEntityId === selection.entity.id;
  if (!isOpen) return null;
  return renderFogModal(selection);
}

export function getFogPreviewPatrolPhase(elapsedMs, traverseDurationMs = 9600) {
  const duration = Number.isFinite(Number(traverseDurationMs)) && Number(traverseDurationMs) > 1200 ? Number(traverseDurationMs) : 9600;
  const halfDuration = duration * 0.5;
  const clampedElapsed = Math.max(0, Number(elapsedMs) || 0);
  const normalized = ((clampedElapsed % duration) + duration) % duration;
  const forward = normalized <= halfDuration;
  const pct = forward
    ? (normalized / halfDuration) * 100
    : 100 - (((normalized - halfDuration) / halfDuration) * 100);
  return {
    xPct: clamp(pct, 0, 100),
    facing: forward ? 1 : -1,
  };
}

export function buildFogPreviewFieldProfile(config = {}) {
  const spanWidthPx = clamp(Number(config.spanWidthPx), 260, 2200);
  const thicknessPx = clamp(Number(config.thicknessPx), 8, 240);
  const density = clamp(Number(config.density), 0.02, 1);
  const falloffPx = clamp(Number(config.falloffPx), 10, spanWidthPx);
  const sampleCount = Math.max(12, Math.round(config.sampleCount || PREVIEW_SAMPLE_COUNT));

  const samples = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const u = sampleCount <= 1 ? 0 : index / (sampleCount - 1);
    const xPx = u * spanWidthPx;
    const dOpenPx = (1 - u) * spanWidthPx;
    const edgeMask = clamp(dOpenPx / falloffPx, 0, 1);
    const edgeEase = edgeMask * edgeMask * (3 - (2 * edgeMask));
    const coreHeightPx = Math.max(6, thicknessPx * edgeEase);
    const hazeHeightPx = Math.max(coreHeightPx, coreHeightPx + 2);
    const opacity = clamp(density * (0.22 + edgeEase * 0.78), 0.03, 0.98);

    samples.push({
      u,
      xPct: u * 100,
      xPx,
      dOpenPx,
      edgeMask: edgeEase,
      coreHeightPx,
      hazeHeightPx,
      opacity,
      offsetY: 0,
      seed: 0,
    });
  }

  return {
    spanWidthPx,
    samples,
  };
}
