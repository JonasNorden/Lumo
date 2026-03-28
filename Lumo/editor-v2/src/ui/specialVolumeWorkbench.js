import { getFogVolumeParams, isFogVolumeEntityType } from "../domain/entities/specialVolumeTypes.js";
import { findEntityPresetById } from "../domain/entities/entityPresets.js";
import { getTileAssetByTileValue } from "../domain/tiles/tileSpriteCatalog.js";

const PREVIEW_SPAN_WIDTH_PX = 620;
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
  const thicknessPx = clamp(Number(params.look.thickness), 12, 220);
  const liftPx = clamp(Number(params.look.lift), 0, 120);
  const falloffPx = clamp(Number(params.area.falloff), 10, PREVIEW_SPAN_WIDTH_PX);
  const idleAmount = clamp(Number(params.organic.strength), 0, 1);
  const idleSpeed = clamp(Number(params.organic.speed), 0.1, 3);
  const influenceAmount = clamp(Number(params.interaction.push), 0, 5);
  const returnStrength = clamp(Number(params.smoothing.relax), 0.02, 1);
  const viscosity = clamp(Number(params.smoothing.visc), 0.35, 0.995);

  const returnTime = clamp((1.1 - returnStrength) * 5.2, 0.2, 5.6);
  const traverseDurationMs = clamp(16400 - idleSpeed * 1400 - influenceAmount * 480, 8400, 22000);
  const densityOpacity = clamp(0.18 + density * 0.72, 0.14, 0.92);
  const disturbanceStrength = clamp((influenceAmount / 5) * (0.55 + idleAmount * 0.45), 0, 1.35);
  const disturbanceRadiusPct = clamp(6 + (influenceAmount * 4.8) + ((1 - viscosity) * 12), 7, 42);
  const idleMotionAmount = clamp(idleAmount * (0.4 + (1 - viscosity) * 0.8), 0, 1.1);
  const settleStrength = clamp(0.45 + (viscosity * 0.95) + (returnStrength * 0.65), 0.4, 2);

  const profile = buildFogPreviewFieldProfile({
    spanWidthPx: PREVIEW_SPAN_WIDTH_PX,
    thicknessPx,
    density,
    falloffPx,
    idleAmount,
    idleSpeed,
    influenceAmount,
    returnTime,
    viscosity,
    nowSeconds: nowMs / 1000,
  });

  return {
    params,
    profile,
    density,
    thicknessPx,
    liftPx,
    falloffPx,
    idleAmount,
    idleSpeed,
    influenceAmount,
    returnTime,
    viscosity,
    traverseDurationMs,
    densityOpacity,
    disturbanceStrength,
    disturbanceRadiusPct,
    idleMotionAmount,
    settleStrength,
    returnRecoverMs: Math.round(returnTime * 1000),
    phaseMs: Math.round(nowMs % traverseDurationMs),
  };
}

function renderFogPreviewSamples(samples) {
  return samples.map((sample) => `
    <span
      class="fogWorkbenchPreviewSample"
      style="--fog-sample-x:${sample.xPct.toFixed(3)}%;--fog-sample-core:${sample.coreHeightPx.toFixed(2)}px;--fog-sample-haze:${sample.hazeHeightPx.toFixed(2)}px;--fog-sample-opacity:${sample.opacity.toFixed(4)};--fog-sample-offset:${sample.offsetY.toFixed(3)}px;--fog-sample-baseline-core:${sample.coreHeightPx.toFixed(2)}px;--fog-sample-baseline-haze:${sample.hazeHeightPx.toFixed(2)}px;--fog-sample-baseline-offset:${sample.offsetY.toFixed(3)}px;--fog-sample-baseline-opacity:${sample.opacity.toFixed(4)};"
      data-fog-sample-u="${sample.u.toFixed(6)}"
      data-fog-sample-seed="${sample.seed.toFixed(6)}"
      data-fog-sample-d-open="${sample.dOpenPx.toFixed(6)}"
      data-fog-preview-sample
    ></span>
  `).join("");
}

function renderFogModal(selection) {
  const model = getFogPreviewModel(selection.entity);
  const lumoSpriteSrc = resolveLumoPreviewSpriteSrc();
  const groundTiles = resolveFogPreviewGroundTiles();
  const groundTileSamples = Array.from({ length: 30 }, (_, index) => groundTiles[index % groundTiles.length]);
  const numberFields = [
    { label: "Density", path: "look.density", min: 0.02, max: 1, step: 0.01, digits: 2, read: (entity) => getFogVolumeParams(entity).look.density },
    { label: "Height above ground", path: "look.lift", min: 0, max: 120, step: 1, digits: 0, read: (entity) => getFogVolumeParams(entity).look.lift },
    { label: "Falloff Distance", path: "area.falloff", min: 10, max: 520, step: 1, digits: 0, read: (entity) => getFogVolumeParams(entity).area.falloff },
    { label: "Idle Amount", path: "organic.strength", min: 0, max: 1, step: 0.01, digits: 2, read: (entity) => getFogVolumeParams(entity).organic.strength },
    { label: "Idle Speed", path: "organic.speed", min: 0.1, max: 3, step: 0.05, digits: 2, read: (entity) => getFogVolumeParams(entity).organic.speed },
    { label: "Lumo Influence Amount", path: "interaction.push", min: 0, max: 5, step: 0.05, digits: 2, read: (entity) => getFogVolumeParams(entity).interaction.push },
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
              data-fog-preview-traverse-ms="${Math.round(model.traverseDurationMs)}"
              data-fog-preview-influence="${model.influenceAmount.toFixed(4)}"
              data-fog-preview-return-time="${model.returnTime.toFixed(4)}"
              data-fog-preview-viscosity="${model.viscosity.toFixed(4)}"
              data-fog-preview-idle-amount="${model.idleAmount.toFixed(4)}"
              data-fog-preview-idle-speed="${model.idleSpeed.toFixed(4)}"
              data-fog-preview-density="${model.density.toFixed(4)}"
              data-fog-preview-falloff="${model.falloffPx.toFixed(4)}"
              style="--fog-ground-baseline:14px;--fog-lift:${model.liftPx.toFixed(2)}px;--fog-thickness:${model.thicknessPx.toFixed(2)}px;--fog-falloff-pct:${((model.falloffPx / PREVIEW_SPAN_WIDTH_PX) * 100).toFixed(3)}%;--fog-opacity:${model.densityOpacity.toFixed(4)};--fog-organic:${model.idleAmount.toFixed(4)};--fog-organic-speed:${model.idleSpeed.toFixed(4)};--fog-push:${model.influenceAmount.toFixed(4)};--fog-relax:${model.returnTime.toFixed(4)};--fog-visc:${model.viscosity.toFixed(4)};--fog-disturbance-strength:${model.disturbanceStrength.toFixed(4)};--fog-disturbance-radius:${model.disturbanceRadiusPct.toFixed(3)}%;--fog-idle-motion:${model.idleMotionAmount.toFixed(4)};--fog-settle-strength:${model.settleStrength.toFixed(4)};--fog-return-recover-ms:${model.returnRecoverMs}ms;--fog-preview-motion-phase-ms:${model.phaseMs}ms;"
            >
              <div class="fogWorkbenchPreviewBackdrop"></div>
              <div class="fogWorkbenchPreviewGround" aria-hidden="true">
                <div class="fogWorkbenchPreviewGroundSoil"></div>
                <div class="fogWorkbenchPreviewGroundTileStrip">
                  ${groundTileSamples.map((tile, index) => `
                    <span
                      class="fogWorkbenchPreviewGroundTile"
                      style="--fog-ground-tile-index:${index};--fog-ground-tile-src:url('${escapeHtml(tile.src)}')"
                      title="${escapeHtml(tile.label)}"
                    ></span>
                  `).join("")}
                </div>
              </div>
              <div class="volumeWorkbenchPreviewSpan fogWorkbenchPreviewSpan" data-volume-preview-span>
                <div class="fogWorkbenchPreviewContainer" aria-hidden="true">
                  <div class="fogWorkbenchPreviewContainerCap"></div>
                  <div class="fogWorkbenchPreviewContainerBody"></div>
                  <div class="fogWorkbenchPreviewContainerBase"></div>
                </div>
                <div class="fogWorkbenchPreviewField" data-fog-preview-field>
                  <div class="fogWorkbenchPreviewFieldMass">
                    ${renderFogPreviewSamples(model.profile.samples)}
                  </div>
                </div>
                <div class="fogWorkbenchPreviewLumo isBehindFog" data-fog-preview-lumo>
                  <span class="fogWorkbenchPreviewLumoGlow"></span>
                  ${lumoSpriteSrc
    ? `<img class="fogWorkbenchPreviewLumoSprite" src="${escapeHtml(lumoSpriteSrc)}" alt="Lumo preview sprite" />`
    : '<span class="fogWorkbenchPreviewLumoBody"></span>'}
                </div>
              </div>
            </div>
            <div class="fogWorkbenchPreviewMeta">
              <span>Ground anchored</span>
              <span>Upward rise only</span>
              <span>End taper only</span>
              <span>Live Lumo disturbance</span>
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

function resolveFogPreviewGroundTiles() {
  const tileIds = [6, 1, 15];
  const fallback = [
    { src: "../data/assets/tiles/grass_bt.png", label: "Grass" },
    { src: "../data/assets/tiles/soil_c.png", label: "Dirt" },
    { src: "../data/assets/tiles/stone_ct.png", label: "Stone" },
  ];
  return tileIds.map((tileId, index) => {
    const tile = getTileAssetByTileValue(tileId);
    const src = typeof tile?.img === "string" && tile.img.trim() ? tile.img.trim() : fallback[index].src;
    return {
      src,
      label: tile?.label || fallback[index].label,
    };
  });
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
  const idleAmount = clamp(Number(config.idleAmount), 0, 1);
  const idleSpeed = clamp(Number(config.idleSpeed), 0.1, 3);
  const influenceAmount = clamp(Number(config.influenceAmount), 0, 5);
  const returnTime = clamp(Number(config.returnTime), 0.2, 8);
  const viscosity = clamp(Number(config.viscosity), 0.35, 0.995);
  const nowSeconds = Number.isFinite(Number(config.nowSeconds)) ? Number(config.nowSeconds) : 0;
  const sampleCount = Math.max(12, Math.round(config.sampleCount || PREVIEW_SAMPLE_COUNT));

  const samples = [];
  const phase = nowSeconds * idleSpeed;

  for (let index = 0; index < sampleCount; index += 1) {
    const u = sampleCount <= 1 ? 0 : index / (sampleCount - 1);
    const xPx = u * spanWidthPx;
    const dOpenPx = (1 - u) * spanWidthPx;
    const edgeMask = clamp(dOpenPx / falloffPx, 0, 1);
    const edgeEase = edgeMask * edgeMask * (3 - (2 * edgeMask));

    const shapeSeed = Math.sin((u * 6.2) + 0.45) * 0.52 + Math.sin((u * 13.7) + 1.4) * 0.24;
    const idlePulse = (Math.sin((phase * 0.95) + (u * 1.6)) * 0.5) + 0.5;
    const idleLiftScale = idleAmount * (2.4 + (1 - viscosity) * 2.9);
    const liftOnly = -Math.max(0, shapeSeed * idlePulse) * idleLiftScale;
    const returnDrag = clamp(returnTime / 5.8, 0.05, 1.15);
    const settleFactor = clamp(1.1 - returnDrag * 0.4, 0.45, 1.08);

    const coreHeightPx = Math.max(
      4,
      (thicknessPx * edgeEase * settleFactor)
      + (Math.max(0, shapeSeed * idlePulse) * idleAmount * (8 + (1 - viscosity) * 6)),
    );
    const hazeHeightPx = Math.max(coreHeightPx + 6, coreHeightPx * (1.24 + ((1 - viscosity) * 0.35)));
    const influenceDensityLift = (influenceAmount / 5) * 0.045 * edgeEase;
    const opacity = clamp((density * (0.2 + edgeEase * 0.9)) + influenceDensityLift, 0.03, 0.98);

    samples.push({
      u,
      xPct: u * 100,
      xPx,
      dOpenPx,
      edgeMask: edgeEase,
      coreHeightPx,
      hazeHeightPx,
      opacity,
      offsetY: Math.min(0, liftOnly),
      seed: shapeSeed,
    });
  }

  return {
    spanWidthPx,
    samples,
  };
}
