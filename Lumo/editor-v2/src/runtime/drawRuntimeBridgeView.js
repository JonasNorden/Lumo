const DEFAULT_OPTIONS = {
  padding: 16,
};

function toFiniteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function drawOverlayText(ctx, text, x, y, color = "#e5e7eb") {
  ctx.fillStyle = color;
  ctx.font = "12px monospace";
  ctx.fillText(text, x, y);
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

function drawBackgroundLayers(ctx, originX, originY, worldWidthPx, worldHeightPx, scale, layers) {
  const sorted = [...layers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const total = sorted.length;
  sorted.forEach((layer, index) => {
    const bandHeight = (worldHeightPx / Math.max(total, 1)) * scale;
    const y = originY + index * bandHeight;
    const hue = 205 + (index * 16) % 60;
    ctx.fillStyle = `hsla(${hue}, 55%, 30%, 0.24)`;
    ctx.fillRect(originX, y, worldWidthPx * scale, bandHeight);

    drawOverlayText(ctx, `bg:${layer.backgroundId} o=${layer.order}`, originX + 4, y + 14, "#93c5fd");
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

  const background = Array.isArray(viewModel?.background) ? viewModel.background : [];
  drawBackgroundLayers(ctx, originX, originY, worldWidthPx, worldHeightPx, scale, background);

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

  const decor = Array.isArray(viewModel?.decor) ? viewModel.decor : [];
  ctx.fillStyle = "#c084fc";
  for (const item of decor) {
    const x = toFiniteOrNull(item?.x);
    const y = toFiniteOrNull(item?.y);
    if (x === null || y === null) {
      continue;
    }

    ctx.fillRect(originX + (x - 4) * scale, originY + (y - 4) * scale, 8 * scale, 8 * scale);
  }

  const entities = Array.isArray(viewModel?.entities) ? viewModel.entities : [];
  ctx.fillStyle = "#22d3ee";
  for (const item of entities) {
    const x = toFiniteOrNull(item?.x);
    const y = toFiniteOrNull(item?.y);
    if (x === null || y === null) {
      continue;
    }

    ctx.fillRect(originX + (x - 3) * scale, originY + (y - 10) * scale, 6 * scale, 10 * scale);
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
      ctx.arc(originX + x * scale, originY + y * scale, radius * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "#fb923c";
    ctx.beginPath();
    ctx.arc(originX + x * scale, originY + y * scale, 4 * scale, 0, Math.PI * 2);
    ctx.fill();
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
    const falling = viewModel?.player?.falling === true;
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(
      originX + (playerX - tileSize * 0.35) * scale,
      originY + (playerY - tileSize * 0.8) * scale,
      tileSize * 0.7 * scale,
      tileSize * 0.8 * scale,
    );

    if (falling) {
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        originX + (playerX - tileSize * 0.38) * scale,
        originY + (playerY - tileSize * 0.85) * scale,
        tileSize * 0.76 * scale,
        tileSize * 0.86 * scale,
      );
    }
  }

  const overlay = viewModel?.overlay ?? {};
  drawOverlayText(ctx, `world=${overlay.worldId ?? "-"} theme=${overlay.themeId ?? "-"}`, 12, canvas.height - 68);
  drawOverlayText(
    ctx,
    `tick=${overlay.runtimeTick ?? "-"} bridge=${overlay.bridgeStatus ?? "-"} controller=${overlay.controllerStatus ?? "-"}`,
    12,
    canvas.height - 52,
  );
  drawOverlayText(
    ctx,
    `player=${overlay.playerStatus ?? "-"} grounded=${overlay.grounded === true} falling=${overlay.falling === true}`,
    12,
    canvas.height - 36,
  );
  drawOverlayText(
    ctx,
    `input moveX=${overlay?.input?.moveX ?? 0} jump=${overlay?.input?.jump === true} run=${overlay?.input?.run === true} loop=${overlay?.loopActive === true} attached=${overlay?.inputAttached === true}`,
    12,
    canvas.height - 20,
    "#93c5fd",
  );
  drawOverlayText(
    ctx,
    `counts tiles=${overlay?.counts?.tiles ?? 0} bg=${overlay?.counts?.background ?? 0} decor=${overlay?.counts?.decor ?? 0} ents=${overlay?.counts?.entities ?? 0} audio=${overlay?.counts?.audio ?? 0}`,
    12,
    canvas.height - 8,
    "#93c5fd",
  );

  return {
    ok: true,
    errors: [],
    warnings: [],
    state: "active",
  };
}
