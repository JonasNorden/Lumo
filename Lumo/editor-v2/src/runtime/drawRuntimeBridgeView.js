const DEFAULT_OPTIONS = {
  padding: 16,
};

function toFiniteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function drawOverlayText(ctx, text, x, y) {
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "12px monospace";
  ctx.fillText(text, x, y);
}

// Draws one neutral empty-state frame when runtime data is missing/idle/invalid.
function drawNeutralState(ctx, canvas, reason = "Runtime view idle") {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawOverlayText(ctx, reason, 12, 20);
}

// Draws the first runtime bridge canvas view directly from one view model.
export function drawRuntimeBridgeView(canvas, viewModel, options = {}) {
  if (!canvas || typeof canvas.getContext !== "function") {
    return {
      ok: false,
      errors: ["drawRuntimeBridgeView requires a canvas element."],
      warnings: [],
    };
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      ok: false,
      errors: ["drawRuntimeBridgeView could not create 2D context."],
      warnings: [],
    };
  }

  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...(options ?? {}),
  };

  const worldWidthTiles = toFiniteOrNull(viewModel?.world?.width);
  const worldHeightTiles = toFiniteOrNull(viewModel?.world?.height);
  const tileSize = toFiniteOrNull(viewModel?.world?.tileSize);

  if (!viewModel || worldWidthTiles === null || worldHeightTiles === null || tileSize === null || tileSize <= 0) {
    drawNeutralState(ctx, canvas, "Runtime view idle/invalid");
    return {
      ok: true,
      errors: [],
      warnings: ["Runtime view drew neutral state because world data is unavailable."],
    };
  }

  const worldWidthPx = worldWidthTiles * tileSize;
  const worldHeightPx = worldHeightTiles * tileSize;
  const drawScale = Math.min(
    (canvas.width - mergedOptions.padding * 2) / worldWidthPx,
    (canvas.height - mergedOptions.padding * 2) / worldHeightPx,
  );
  const scale = Number.isFinite(drawScale) && drawScale > 0 ? drawScale : 1;
  const originX = mergedOptions.padding;
  const originY = mergedOptions.padding;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#60a5fa";
  ctx.lineWidth = 1;
  ctx.strokeRect(originX, originY, worldWidthPx * scale, worldHeightPx * scale);

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

    ctx.fillRect(originX + x * scale, originY + y * scale, w * scale, h * scale);
  }

  const spawnX = toFiniteOrNull(viewModel?.spawn?.x);
  const spawnY = toFiniteOrNull(viewModel?.spawn?.y);
  if (spawnX !== null && spawnY !== null) {
    ctx.fillStyle = "#facc15";
    ctx.fillRect(
      originX + (spawnX - tileSize * 0.2) * scale,
      originY + (spawnY - tileSize * 0.2) * scale,
      tileSize * 0.4 * scale,
      tileSize * 0.4 * scale,
    );
  }

  const playerX = toFiniteOrNull(viewModel?.player?.x);
  const playerY = toFiniteOrNull(viewModel?.player?.y);
  if (playerX !== null && playerY !== null) {
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(
      originX + (playerX - tileSize * 0.35) * scale,
      originY + (playerY - tileSize * 0.8) * scale,
      tileSize * 0.7 * scale,
      tileSize * 0.8 * scale,
    );
  }

  const overlay = viewModel?.overlay ?? {};
  drawOverlayText(ctx, `world=${overlay.worldId ?? "-"} theme=${overlay.themeId ?? "-"}`, 12, canvas.height - 52);
  drawOverlayText(
    ctx,
    `tick=${overlay.runtimeTick ?? "-"} bridge=${overlay.bridgeStatus ?? "-"} controller=${overlay.controllerStatus ?? "-"}`,
    12,
    canvas.height - 36,
  );
  drawOverlayText(
    ctx,
    `player=${overlay.playerStatus ?? "-"} grounded=${viewModel?.player?.grounded === true} falling=${viewModel?.player?.falling === true}`,
    12,
    canvas.height - 20,
  );

  return {
    ok: true,
    errors: [],
    warnings: [],
  };
}
