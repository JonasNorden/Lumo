import { stopNativeInputKeyboardPropagation } from "./nativeInputGuards.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderScanControls(state, options = {}) {
  const { compact = false } = options;
  const scan = state.scan || {};
  const docWidth = Number(state.document.active?.dimensions?.width) || 0;
  const speed = Number.isFinite(scan.speed) ? scan.speed : 6;
  const playbackState = scan.playbackState || (scan.isPlaying ? "playing" : "idle");
  const isPlaying = playbackState === "playing";
  const isPaused = playbackState === "paused";
  const statusLabel = isPlaying ? "Running" : isPaused ? "Paused" : "Stopped";
  const statusToneClass = isPlaying ? "isRunning" : isPaused ? "isPaused" : "isIdle";
  const fieldGridClass = compact ? "compactFieldGrid scanFieldGrid scanFieldGridCompact" : "compactFieldGrid scanFieldGrid";
  const transportClass = compact ? "compactActionRow compactActionRowTriple scanTransportRow scanTransportRowCompact" : "compactActionRow compactActionRowTriple scanTransportRow";
  const shellClass = compact ? "scanControlsShell scanControlsShellCompact" : "scanControlsShell";

  return `
    <section class="${shellClass}" aria-label="Scan controls">
      <div class="scanControlsHeader">
        <span class="sectionTitle sectionTitleInline">SCAN</span>
        <span class="scanStatePill ${statusToneClass}">${statusLabel}</span>
      </div>

      <div class="${fieldGridClass}">
        <label class="fieldRow fieldRowCompact scanControlField">
          <span class="label">Start X</span>
          <input type="number" min="0" max="${docWidth}" step="0.25" value="${Number.isFinite(scan.startX) ? scan.startX : ""}" placeholder="0" data-scan-field="startX" />
        </label>

        <label class="fieldRow fieldRowCompact scanControlField">
          <span class="label">End X</span>
          <input type="number" min="0" max="${docWidth}" step="0.25" value="${Number.isFinite(scan.endX) ? scan.endX : ""}" placeholder="${docWidth}" data-scan-field="endX" />
        </label>

        <label class="fieldRow fieldRowCompact scanControlField ${compact ? "" : "scanFieldGridFull"}">
          <span class="label">Speed</span>
          <input type="number" min="0.25" step="0.25" value="${speed}" data-scan-field="speed" />
        </label>
      </div>

      <div class="${transportClass}">
        <button type="button" class="toolButton ${isPlaying ? "isActive" : ""}" data-scan-action="play" ${isPaused ? "disabled" : ""}>Play</button>
        <button type="button" class="toolButton isSecondary ${isPaused ? "isActive" : ""}" data-scan-action="${isPaused ? "play" : "pause"}" ${(isPlaying || isPaused) ? "" : "disabled"}>${isPaused ? "Resume" : "Pause"}</button>
        <button type="button" class="toolButton isSecondary" data-scan-action="stop" ${(isPlaying || isPaused) ? "" : "disabled"}>Stop</button>
      </div>
    </section>
  `;
}

export function bindScanControls(panel, options = {}) {
  const { onScanUpdate } = options;

  const triggerScanAction = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    const scanActionButton = target.closest("[data-scan-action]");
    if (!(scanActionButton instanceof HTMLButtonElement)) return false;

    const action = scanActionButton.dataset.scanAction;
    if (!action || scanActionButton.disabled) return true;

    onScanUpdate?.(action, null);
    return true;
  };

  const onChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const scanField = target.dataset.scanField;
    if (scanField === "startX" || scanField === "endX" || scanField === "speed") {
      onScanUpdate?.(scanField, target.value);
    }
  };

  const onClick = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (event.detail === 0 && triggerScanAction(target)) return;
    triggerScanAction(target);
  };

  const onPointerDown = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!triggerScanAction(target)) return;

    event.preventDefault();
  };

  const onKeyDown = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.dataset.scanField) return;
    stopNativeInputKeyboardPropagation(event);
    if (event.key === "Enter") {
      event.preventDefault();
      target.blur();
    }
  };

  panel.addEventListener("change", onChange);
  panel.addEventListener("pointerdown", onPointerDown);
  panel.addEventListener("click", onClick);
  panel.addEventListener("keydown", onKeyDown, true);

  return () => {
    panel.removeEventListener("change", onChange);
    panel.removeEventListener("pointerdown", onPointerDown);
    panel.removeEventListener("click", onClick);
    panel.removeEventListener("keydown", onKeyDown, true);
  };
}
