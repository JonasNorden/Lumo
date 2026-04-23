const DEFAULT_OPTIONS = {
  padding: 16,
  hudHeight: 38,
};
import { buildRuntimeCameraState } from "./buildRuntimeCameraState.js";
import { renderRuntimeHudModel } from "./renderRuntimeHudModel.js";

const PLAYER_RENDER_COLORS = Object.freeze({
  body: "#60a5fa",
  eyes: "#e2e8f0",
});

export { PLAYER_RENDER_COLORS as RUNTIME_PLAYER_RENDER_COLORS };

function toFiniteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function drawOverlayText(ctx, text, x, y, color = "#e5e7eb") {
  ctx.fillStyle = color;
  ctx.font = "12px monospace";
  ctx.fillText(text, x, y);
}

function worldToScreen(cameraState, valuePx) {
  return valuePx - (cameraState?.cameraX ?? 0);
}

// Draws one neutral empty-state frame when runtime data is missing/idle/invalid.
function drawNeutralState(ctx, canvas, title, subtitle, tone = "idle") {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = tone === "invalid" ? "#1f1118" : "#0b1220";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const titleColor = tone === "invalid" ? "#fda4af" : "#cbd5e1";
  drawOverlayText(ctx, title, 16, 28, titleColor);
  drawOverlayText(ctx, subtitle, 16, 46, "#94a3b8");
}

function resolveDrawState(viewModel) {
  const bridgeStatus = viewModel?.overlay?.bridgeStatus;

  if (!viewModel || (bridgeStatus === "idle" && !Number.isFinite(viewModel?.world?.width))) {
    return {
      kind: "idle",
      title: "Idle",
      subtitle: "No active runtime. Start a level to render runtime world data.",
    };
  }

  const worldWidthTiles = toFiniteOrNull(viewModel?.world?.width);
  const worldHeightTiles = toFiniteOrNull(viewModel?.world?.height);
  const tileSize = toFiniteOrNull(viewModel?.world?.tileSize);
  if (worldWidthTiles === null || worldHeightTiles === null || tileSize === null || tileSize <= 0) {
    return {
      kind: "invalid",
      title: "Invalid runtime",
      subtitle: "World width/height/tileSize missing from runtime bridge chain.",
    };
  }

  return {
    kind: "active",
    title: "Active",
    subtitle: "",
  };
}

function drawBackgroundLayers(ctx, viewportWidthPx, viewportHeightPx, scale, cameraState, layers, worldWidthPx) {
  const sorted = [...layers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const total = sorted.length;
  sorted.forEach((layer, index) => {
    const bandHeight = viewportHeightPx / Math.max(total, 1);
    const y = index * bandHeight;
    const hue = 205 + (index * 16) % 60;
    ctx.fillStyle = `hsla(${hue}, 55%, 30%, 0.24)`;
    ctx.fillRect(0, y, viewportWidthPx, bandHeight);

    const parallax = Number.isFinite(layer?.parallax) ? layer.parallax : 0.25;
    const markerX = ((cameraState?.cameraX ?? 0) * parallax) % Math.max(worldWidthPx * scale, 1);
    ctx.fillStyle = "rgba(148,163,184,0.18)";
    ctx.fillRect(-markerX, y, 80, bandHeight);
    ctx.fillRect(viewportWidthPx - markerX, y, 80, bandHeight);

    drawOverlayText(ctx, `bg:${layer.backgroundId} o=${layer.order}`, 8, y + 14, "#93c5fd");
  });
}

// Draws the first runtime bridge canvas view directly from one view model.
export function drawRuntimeBridgeView(canvas, viewModel, options = {}) {
  if (!canvas || typeof canvas.getContext !== "function") {
    return {
      ok: false,
      errors: ["drawRuntimeBridgeView requires a canvas element."],
      warnings: [],
      state: "invalid",
    };
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      ok: false,
      errors: ["drawRuntimeBridgeView could not create 2D context."],
      warnings: [],
      state: "invalid",
    };
  }

  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...(options ?? {}),
  };

  const drawState = resolveDrawState(viewModel);
  if (drawState.kind !== "active") {
    drawNeutralState(ctx, canvas, drawState.title, drawState.subtitle, drawState.kind);
    return {
      ok: true,
      errors: [],
      warnings: [drawState.subtitle],
      state: drawState.kind,
    };
  }

  const worldWidthTiles = toFiniteOrNull(viewModel?.world?.width);
  const worldHeightTiles = toFiniteOrNull(viewModel?.world?.height);
  const tileSize = toFiniteOrNull(viewModel?.world?.tileSize);
  const worldWidthPx = worldWidthTiles * tileSize;
  const worldHeightPx = worldHeightTiles * tileSize;
  const availableWidth = canvas.width - mergedOptions.padding * 2;
  const availableHeight = canvas.height - mergedOptions.padding * 2 - mergedOptions.hudHeight;
  const drawScale = Math.min(availableWidth / worldWidthPx, availableHeight / worldHeightPx);
  const scale = Number.isFinite(drawScale) && drawScale > 0 ? drawScale : 1;
  const viewportWidthPx = availableWidth / scale;
  const viewportHeightPx = availableHeight / scale;
  const originX = mergedOptions.padding;
  const originY = mergedOptions.padding + mergedOptions.hudHeight;
  const targetX = toFiniteOrNull(viewModel?.player?.x) ?? toFiniteOrNull(viewModel?.spawn?.x) ?? worldWidthPx * 0.5;
  const targetY = toFiniteOrNull(viewModel?.player?.y) ?? toFiniteOrNull(viewModel?.spawn?.y) ?? worldHeightPx * 0.5;
  const cameraState = buildRuntimeCameraState({
    worldWidthPx,
    worldHeightPx,
    viewportWidthPx,
    viewportHeightPx,
    targetX,
    targetY,
    fallbackX: worldWidthPx * 0.5,
    fallbackY: worldHeightPx * 0.5,
  });
  const hudModel = renderRuntimeHudModel({
    bridgeStatus: viewModel?.overlay?.bridgeStatus,
    controllerStatus: viewModel?.overlay?.controllerStatus,
    playerStatus: viewModel?.overlay?.playerStatus,
    runtimeTick: viewModel?.overlay?.runtimeTick,
    grounded: viewModel?.overlay?.grounded,
    locomotion: viewModel?.overlay?.locomotion,
    playbackStatus: viewModel?.overlay?.playbackStatus,
  });

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const background = Array.isArray(viewModel?.background) ? viewModel.background : [];
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(originX - 2, 8, canvas.width - mergedOptions.padding * 2 + 4, mergedOptions.hudHeight - 4);
  drawOverlayText(ctx, hudModel.line, originX + 8, 30, "#e2e8f0");

  ctx.save();
  ctx.translate(originX, originY);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.rect(0, 0, viewportWidthPx, viewportHeightPx);
  ctx.clip();

  drawBackgroundLayers(ctx, viewportWidthPx, viewportHeightPx, scale, cameraState, background, worldWidthPx);

  ctx.strokeStyle = "#60a5fa";
  ctx.lineWidth = 1;
  ctx.strokeRect(-cameraState.cameraX, -cameraState.cameraY, worldWidthPx, worldHeightPx);

  const tiles = Array.isArray(viewModel?.tiles) ? viewModel.tiles : [];
  ctx.fillStyle = "#334155";
  for (const tile of tiles) {
    const x = toFiniteOrNull(tile?.worldX);
    const y = toFiniteOrNull(tile?.worldY);
    const w = toFiniteOrNull(tile?.worldW);
    const h = toFiniteOrNull(tile?.worldH);
    if (x === null || y === null || w === null || h === null) {
      continue;
    }

    ctx.fillRect(worldToScreen(cameraState, x), y - cameraState.cameraY, w, h);
  }

  const decor = Array.isArray(viewModel?.decor) ? viewModel.decor : [];
  ctx.fillStyle = "#c084fc";
  for (const item of decor) {
    const x = toFiniteOrNull(item?.x);
    const y = toFiniteOrNull(item?.y);
    if (x === null || y === null) {
      continue;
    }

    ctx.fillRect(worldToScreen(cameraState, x - 4), y - 4 - cameraState.cameraY, 8, 8);
  }

  const entities = Array.isArray(viewModel?.entities) ? viewModel.entities : [];
  ctx.fillStyle = "#22d3ee";
  for (const item of entities) {
    const x = toFiniteOrNull(item?.x);
    const y = toFiniteOrNull(item?.y);
    if (x === null || y === null) {
      continue;
    }

    ctx.fillRect(worldToScreen(cameraState, x - 3), y - 10 - cameraState.cameraY, 6, 10);
  }

  const audio = Array.isArray(viewModel?.audio) ? viewModel.audio : [];
  for (const marker of audio) {
    const x = toFiniteOrNull(marker?.x);
    const y = toFiniteOrNull(marker?.y);
    const radius = toFiniteOrNull(marker?.radius);
    if (x === null || y === null) {
      continue;
    }

    if (radius !== null && radius > 0) {
      ctx.strokeStyle = "rgba(251, 146, 60, 0.42)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(worldToScreen(cameraState, x), y - cameraState.cameraY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "#fb923c";
    ctx.beginPath();
    ctx.arc(worldToScreen(cameraState, x), y - cameraState.cameraY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const playerX = toFiniteOrNull(viewModel?.player?.x);
  const playerY = toFiniteOrNull(viewModel?.player?.y);
  if (playerX !== null && playerY !== null) {
    const falling = viewModel?.player?.falling === true;
    // Keep play-mode player visuals neutral so state colors are not mistaken for product signals.
    ctx.fillStyle = PLAYER_RENDER_COLORS.body;
    ctx.fillRect(worldToScreen(cameraState, playerX - tileSize * 0.35), playerY - tileSize * 0.8 - cameraState.cameraY, tileSize * 0.7, tileSize * 0.8);
    ctx.fillStyle = PLAYER_RENDER_COLORS.eyes;
    ctx.fillRect(worldToScreen(cameraState, playerX - tileSize * 0.18), playerY - tileSize * 0.62 - cameraState.cameraY, tileSize * 0.12, tileSize * 0.12);
    ctx.fillRect(worldToScreen(cameraState, playerX + tileSize * 0.06), playerY - tileSize * 0.62 - cameraState.cameraY, tileSize * 0.12, tileSize * 0.12);

    if (falling) {
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        worldToScreen(cameraState, playerX - tileSize * 0.38),
        playerY - tileSize * 0.85 - cameraState.cameraY,
        tileSize * 0.76,
        tileSize * 0.86,
      );
    }
  }
  ctx.restore();

  const overlay = viewModel?.overlay ?? {};
  drawOverlayText(ctx, `world=${overlay.worldId ?? "-"} theme=${overlay.themeId ?? "-"}`, 12, canvas.height - 52);
  drawOverlayText(
    ctx,
    `tick=${overlay.runtimeTick ?? "-"} bridge=${overlay.bridgeStatus ?? "-"} controller=${overlay.controllerStatus ?? "-"}`,
    12,
    canvas.height - 38,
  );
  drawOverlayText(
    ctx,
    `player=${overlay.playerStatus ?? "-"} grounded=${overlay.grounded === true} falling=${overlay.falling === true} view=(${Math.round(cameraState.cameraX)},${Math.round(cameraState.cameraY)})`,
    12,
    canvas.height - 24,
  );
  drawOverlayText(
    ctx,
    `bounds 0..${worldWidthPx} x 0..${worldHeightPx} | player=${viewModel?.player?.grounded === true ? "green" : "blue"} | input ${overlay?.input?.moveX ?? 0}/${overlay?.input?.jump === true ? "J" : "-"}${overlay?.input?.run === true ? "/R" : ""}`,
    12,
    canvas.height - 10,
    "#93c5fd",
  );

  return {
    ok: true,
    errors: [],
    warnings: [],
    state: "active",
  };
}
