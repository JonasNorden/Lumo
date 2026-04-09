import { loadLevelDocument } from "./loadLevelDocument.js";
import { buildRuntimeWorldSkeleton } from "./buildRuntimeWorldSkeleton.js";
import { buildRuntimeTileEntries } from "./buildRuntimeTileEntries.js";
import { buildRuntimeTileBounds } from "./buildRuntimeTileBounds.js";
import { buildRuntimeTileMap } from "./buildRuntimeTileMap.js";
import { buildRuntimeWorldPacket } from "./buildRuntimeWorldPacket.js";
import { buildRuntimePlayerSpawnPacket } from "./buildRuntimePlayerSpawnPacket.js";

const DEFAULT_TILE_SIZE = 32;
const DEFAULT_LEVEL_PATH = "./src/data/testLevelDocument.v1.json";
const PREVIEW_FALL_START_DELAY_MS = 1000;
const PREVIEW_FALL_REPLAY_DELAY_MS = 1200;
const PREVIEW_FALL_GRAVITY = 0.25;
const PREVIEW_FALL_MANUAL_STEP_PX = 3.5;

function readLevelPathFromQuery() {
  if (typeof window === "undefined") {
    return DEFAULT_LEVEL_PATH;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const requestedLevelPath = searchParams.get("level");
  return requestedLevelPath || DEFAULT_LEVEL_PATH;
}

// Loads the test level JSON, then runs the Recharged loader + packet helpers.
async function buildPreviewState(levelPath) {
  const response = await fetch(levelPath);
  if (!response.ok) {
    throw new Error(`Failed to fetch level "${levelPath}" (${response.status} ${response.statusText}).`);
  }

  const levelDocument = await response.json();
  const loaderResult = loadLevelDocument(levelDocument);

  if (!loaderResult.ok || !loaderResult.level) {
    return {
      levelPath,
      loaderResult,
      worldPacket: null,
      playerSpawnPacket: null,
    };
  }

  const skeleton = buildRuntimeWorldSkeleton(loaderResult.level);
  const tileEntries = buildRuntimeTileEntries(skeleton);
  const worldPacket = buildRuntimeWorldPacket({
    skeleton,
    tileBounds: buildRuntimeTileBounds(tileEntries),
    tileMap: buildRuntimeTileMap(tileEntries),
  });
  const playerSpawnPacket = buildRuntimePlayerSpawnPacket(worldPacket);

  return {
    levelPath,
    loaderResult,
    worldPacket,
    playerSpawnPacket,
  };
}

// Converts possibly invalid coordinate values into render-safe numbers.
function safeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function hasValidPixelPosition(position) {
  return Number.isFinite(position?.x) && Number.isFinite(position?.y);
}

function readGridCell(cell) {
  const cellX = Number.isFinite(cell?.gridX) ? cell.gridX : cell?.x;
  const cellY = Number.isFinite(cell?.gridY) ? cell.gridY : cell?.y;
  if (!Number.isFinite(cellX) || !Number.isFinite(cellY)) {
    return null;
  }
  return { x: cellX, y: cellY };
}

function drawSpawnInvalidX(context, spawnPixel, tileSize) {
  const markerSize = Math.max(6, tileSize * 0.8);
  const halfMarkerSize = markerSize * 0.5;
  context.save();
  context.strokeStyle = "#ff5555";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(spawnPixel.x - halfMarkerSize, spawnPixel.y - halfMarkerSize);
  context.lineTo(spawnPixel.x + halfMarkerSize, spawnPixel.y + halfMarkerSize);
  context.moveTo(spawnPixel.x + halfMarkerSize, spawnPixel.y - halfMarkerSize);
  context.lineTo(spawnPixel.x - halfMarkerSize, spawnPixel.y + halfMarkerSize);
  context.stroke();
  context.restore();
}

function drawSpawnWarningTriangle(context, spawnPixel, tileSize) {
  const triangleSize = Math.max(6, tileSize * 0.35);
  const tipY = spawnPixel.y - tileSize * 0.65;
  const baseY = tipY + triangleSize;
  context.save();
  context.fillStyle = "#ffcc00";
  context.beginPath();
  context.moveTo(spawnPixel.x, tipY);
  context.lineTo(spawnPixel.x - triangleSize * 0.5, baseY);
  context.lineTo(spawnPixel.x + triangleSize * 0.5, baseY);
  context.closePath();
  context.fill();
  context.restore();
}

function drawWorldBounds(context, worldWidthPx, worldHeightPx) {
  context.save();
  context.strokeStyle = "#4a6a8a";
  context.lineWidth = 2;
  context.strokeRect(1, 1, Math.max(0, worldWidthPx - 2), Math.max(0, worldHeightPx - 2));
  context.restore();
}

function drawTileGrid(context, worldWidthPx, worldHeightPx, tileSize) {
  if (!Number.isFinite(tileSize) || tileSize <= 0) {
    return;
  }

  context.save();
  context.strokeStyle = "rgba(100,140,180,0.15)";
  context.lineWidth = 1;
  context.beginPath();
  for (let x = tileSize; x < worldWidthPx; x += tileSize) {
    context.moveTo(x, 0);
    context.lineTo(x, worldHeightPx);
  }
  for (let y = tileSize; y < worldHeightPx; y += tileSize) {
    context.moveTo(0, y);
    context.lineTo(worldWidthPx, y);
  }
  context.stroke();
  context.restore();
}

// Draws the top-down debug snapshot for world tiles and spawn markers.
function drawSpawnPreview(canvas, worldPacket, playerSpawnPacket, onAnimationDebugUpdate = () => {}) {
  const context = canvas.getContext("2d");
  if (!context) {
    return () => {};
  }

  const rawTileSize = worldPacket?.world?.tileSize;
  const hasValidTileSize = Number.isFinite(rawTileSize) && rawTileSize > 0;
  const tileSize = hasValidTileSize ? rawTileSize : DEFAULT_TILE_SIZE;
  const worldWidth = safeNumber(worldPacket?.world?.width, 20);
  const worldHeight = safeNumber(worldPacket?.world?.height, 12);
  const worldWidthPx = worldWidth * tileSize;
  const worldHeightPx = worldHeight * tileSize;

  const landingCell = readGridCell(playerSpawnPacket?.landingCell);
  const supportCell = readGridCell(playerSpawnPacket?.supportCell);
  const authoredSpawn = worldPacket?.spawn;
  const hasAuthoredSpawn = hasValidPixelPosition(authoredSpawn);
  const authoredX = safeNumber(authoredSpawn?.x, 0);
  const authoredY = safeNumber(authoredSpawn?.y, 0);
  const authoredSpawnPixelY = authoredY;
  const resolvedStartPixel = playerSpawnPacket?.startPixel;
  const resolvedLandingPixelY = hasValidPixelPosition(resolvedStartPixel)
    ? resolvedStartPixel.y
    : null;
  const shouldAnimateFall =
    hasAuthoredSpawn &&
    Number.isFinite(authoredSpawnPixelY) &&
    Number.isFinite(resolvedLandingPixelY) &&
    resolvedLandingPixelY > authoredSpawnPixelY;

  const animationState = {
    enabled: shouldAnimateFall,
    currentY: authoredSpawnPixelY,
    targetY: shouldAnimateFall ? resolvedLandingPixelY : authoredSpawnPixelY,
    velocityY: 0,
    phase: shouldAnimateFall ? "start-delay" : "static",
    phaseUntilMs: 0,
  };

  canvas.width = Math.max(1, worldWidthPx);
  canvas.height = Math.max(1, worldHeightPx);

  function drawAnimationMarker(context2d, phase) {
    context2d.save();
    context2d.fillStyle = "rgba(0,0,0,0.6)";
    context2d.fillRect(8, 8, 130, 24);
    context2d.fillStyle = "#7df7c5";
    context2d.font = "bold 13px monospace";
    context2d.textBaseline = "middle";
    context2d.fillText(`ANIM: ${phase}`, 14, 20);
    context2d.restore();
  }

  function emitAnimationDebug() {
    onAnimationDebugUpdate({
      animationEnabled: animationState.enabled,
      animationPhase: animationState.phase,
      animatedPlayerY: Math.round(animationState.currentY),
      authoredSpawnY: Number.isFinite(authoredSpawnPixelY) ? Math.round(authoredSpawnPixelY) : null,
      resolvedLandingY: Number.isFinite(resolvedLandingPixelY) ? Math.round(resolvedLandingPixelY) : null,
    });
  }

  function drawFrame(playerY) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#0b0f17";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw world bounds and grid first so later overlays remain legible on top.
    drawWorldBounds(context, worldWidthPx, worldHeightPx);
    if (hasValidTileSize) {
      drawTileGrid(context, worldWidthPx, worldHeightPx, tileSize);
    }

    // Draw authored tile coverage as solid debug blocks.
    const tiles = Array.isArray(worldPacket?.layers?.tiles) ? worldPacket.layers.tiles : [];
    context.fillStyle = "#2a3a4a";
    context.strokeStyle = "#3f556b";
    context.lineWidth = 1;
    for (const tile of tiles) {
      const tileX = safeNumber(tile?.x, 0) * tileSize;
      const tileY = safeNumber(tile?.y, 0) * tileSize;
      const tileW = Math.max(1, safeNumber(tile?.w, 1) * tileSize);
      const tileH = Math.max(1, safeNumber(tile?.h, 1) * tileSize);
      context.fillRect(tileX, tileY, tileW, tileH);
      context.strokeRect(tileX, tileY, tileW, tileH);
    }

    if (landingCell) {
      const landingX = landingCell.x * tileSize;
      const landingY = landingCell.y * tileSize;
      context.fillStyle = "rgba(80,255,160,0.25)";
      context.strokeStyle = "rgba(80,255,160,0.95)";
      context.lineWidth = 2;
      context.fillRect(landingX, landingY, tileSize, tileSize);
      context.strokeRect(landingX, landingY, tileSize, tileSize);
    }

    if (supportCell) {
      const supportX = supportCell.x * tileSize;
      const supportY = supportCell.y * tileSize;
      context.fillStyle = "rgba(255,255,100,0.15)";
      context.strokeStyle = "rgba(255,255,100,0.6)";
      context.lineWidth = 2;
      context.fillRect(supportX, supportY, tileSize, tileSize);
      context.strokeRect(supportX, supportY, tileSize, tileSize);
    }

    // Draw authored→resolved drop path to visualize runtime spawn settling.
    if (
      hasAuthoredSpawn &&
      hasValidPixelPosition(resolvedStartPixel) &&
      (authoredSpawn.x !== resolvedStartPixel.x || authoredSpawn.y !== resolvedStartPixel.y)
    ) {
      context.save();
      context.strokeStyle = "#ffcc66";
      context.lineWidth = 2;
      context.setLineDash([4, 4]);
      context.beginPath();
      context.moveTo(authoredSpawn.x, authoredSpawn.y);
      context.lineTo(authoredSpawn.x, resolvedStartPixel.y);
      context.stroke();
      context.restore();
    }

    // Draw authored spawn as a hollow ring so it differs from landing visuals.
    if (hasAuthoredSpawn) {
      context.strokeStyle = "#ffb13b";
      context.lineWidth = 3;
      context.beginPath();
      context.arc(authoredX, authoredY, Math.max(5, tileSize * 0.2), 0, Math.PI * 2);
      context.stroke();
    }

    const spawnValid = playerSpawnPacket?.spawnValid === true;
    const spawnWarnings = Array.isArray(playerSpawnPacket?.warnings) ? playerSpawnPacket.warnings : [];
    const spawnPixel = playerSpawnPacket?.startPixel;
    const hasSpawnPixel = hasValidPixelPosition(spawnPixel);
    const hasSpawnWarning = spawnValid && spawnWarnings.length > 0;
    const hasSpawnError = playerSpawnPacket?.spawnValid === false;

    // Draw player at authored spawn (runtime starts here, then falls to landing).
    if (hasAuthoredSpawn) {
      const playerWidth = tileSize * 0.6;
      const playerHeight = tileSize * 0.9;
      const playerLeft = authoredX - playerWidth * 0.5;
      const playerTop = playerY - playerHeight;
      context.fillStyle = "rgba(80,255,160,0.9)";
      context.fillRect(playerLeft, playerTop, playerWidth, playerHeight);

      // Draw a thin connector so the spawn ring remains visible under the player box.
      const markerRadius = Math.max(4, tileSize * 0.18);
      context.strokeStyle = "#ffffff";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(authoredX - markerRadius - 4, authoredY - markerRadius - 4);
      context.lineTo(authoredX + markerRadius + 4, authoredY + markerRadius + 4);
      context.stroke();
    }

    // Draw warnings/errors last so they remain on top of all other markers.
    if (hasSpawnPixel) {
      if (hasSpawnError) {
        drawSpawnInvalidX(context, spawnPixel, tileSize);
      } else if (hasSpawnWarning) {
        drawSpawnWarningTriangle(context, spawnPixel, tileSize);
      }
    }

    drawAnimationMarker(context, animationState.phase);
  }

  let animationFrameId = null;
  let cancelled = false;

  function step() {
    if (cancelled) {
      return;
    }

    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();

    if (animationState.phase === "start-delay") {
      if (animationState.phaseUntilMs === 0) {
        animationState.phaseUntilMs = nowMs + PREVIEW_FALL_START_DELAY_MS;
      }
      animationState.currentY = authoredSpawnPixelY;
      animationState.velocityY = 0;
      if (nowMs >= animationState.phaseUntilMs) {
        animationState.phase = "falling";
        animationState.phaseUntilMs = 0;
      }
    } else if (animationState.phase === "falling") {
      animationState.velocityY += PREVIEW_FALL_GRAVITY;
      const velocityStep = Math.max(0, animationState.velocityY);
      const manualInterpolationStep = PREVIEW_FALL_MANUAL_STEP_PX;
      animationState.currentY += Math.max(velocityStep, manualInterpolationStep);
      if (animationState.currentY >= animationState.targetY) {
        animationState.currentY = animationState.targetY;
        animationState.velocityY = 0;
        animationState.phase = "landing-delay";
        animationState.phaseUntilMs = nowMs + PREVIEW_FALL_REPLAY_DELAY_MS;
      }
    } else if (animationState.phase === "landing-delay") {
      animationState.currentY = animationState.targetY;
      if (nowMs >= animationState.phaseUntilMs) {
        animationState.currentY = authoredSpawnPixelY;
        animationState.velocityY = 0;
        animationState.phase = "start-delay";
        animationState.phaseUntilMs = nowMs + PREVIEW_FALL_START_DELAY_MS;
      }
    }

    emitAnimationDebug();
    drawFrame(animationState.currentY);
    animationFrameId = window.requestAnimationFrame(step);
  }

  if (!shouldAnimateFall || typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    emitAnimationDebug();
    drawFrame(animationState.currentY);
    return () => {};
  }

  emitAnimationDebug();
  drawFrame(animationState.currentY);
  animationFrameId = window.requestAnimationFrame(step);

  return () => {
    cancelled = true;
    if (animationFrameId !== null && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = null;
  };
}

// Builds a compact, debug-first summary text block for packet status.
function buildSummaryText(levelPath, loaderResult, playerSpawnPacket, animationDebug) {
  const spawnPacketOk = playerSpawnPacket?.ok === true;
  const status = playerSpawnPacket?.status ?? "missing-spawn";
  const placementSource = playerSpawnPacket?.placementSource ?? "missing-spawn";
  const startGrid = playerSpawnPacket?.startGrid ?? { x: null, y: null };
  const startPixel = playerSpawnPacket?.startPixel ?? { x: null, y: null };

  const lines = [
    `levelPath: ${levelPath}`,
    `loader ok: ${loaderResult?.ok === true}`,
    `player spawn packet ok: ${spawnPacketOk}`,
    `status: ${status}`,
    `placementSource: ${placementSource}`,
    `startGrid: (${startGrid.x}, ${startGrid.y})`,
    `startPixel: (${startPixel.x}, ${startPixel.y})`,
    `animationEnabled: ${animationDebug.animationEnabled}`,
    `animationPhase: ${animationDebug.animationPhase}`,
    `animatedPlayerY: ${animationDebug.animatedPlayerY}`,
    `authoredSpawnY: ${animationDebug.authoredSpawnY}`,
    `resolvedLandingY: ${animationDebug.resolvedLandingY}`,
  ];

  const loaderErrors = Array.isArray(loaderResult?.errors) ? loaderResult.errors : [];
  const spawnErrors = Array.isArray(playerSpawnPacket?.errors) ? playerSpawnPacket.errors : [];
  const spawnWarnings = Array.isArray(playerSpawnPacket?.warnings) ? playerSpawnPacket.warnings : [];

  if (loaderErrors.length > 0) {
    lines.push(`loader errors: ${loaderErrors.join(" | ")}`);
  }
  if (spawnErrors.length > 0) {
    lines.push(`spawn errors: ${spawnErrors.join(" | ")}`);
  }
  if (spawnWarnings.length > 0) {
    lines.push(`spawn warnings: ${spawnWarnings.join(" | ")}`);
  }

  return lines.join("\n");
}

// Mounts the debug page and keeps failures visible in-page for quick diagnosis.
export async function renderRuntimeSpawnPreview({
  canvas,
  summary,
  error,
  levelPathInput,
  loadLevelButton,
}) {
  let stopCurrentPreviewAnimation = () => {};
  const requestedLevelPath = readLevelPathFromQuery();

  if (levelPathInput) {
    levelPathInput.value = requestedLevelPath;
  }

  async function renderLevel(levelPath) {
    const activeLevelPath = levelPath || DEFAULT_LEVEL_PATH;

    try {
      stopCurrentPreviewAnimation();
      stopCurrentPreviewAnimation = () => {};
      const previewState = await buildPreviewState(activeLevelPath);
      const animationDebugState = {
        animationEnabled: false,
        animationPhase: "static",
        animatedPlayerY: null,
        authoredSpawnY: null,
        resolvedLandingY: null,
      };
      const updateSummary = () => {
        summary.textContent = buildSummaryText(
          previewState.levelPath,
          previewState.loaderResult,
          previewState.playerSpawnPacket,
          animationDebugState,
        );
      };

      stopCurrentPreviewAnimation = drawSpawnPreview(
        canvas,
        previewState.worldPacket,
        previewState.playerSpawnPacket,
        (nextAnimationDebugState) => {
          animationDebugState.animationEnabled = nextAnimationDebugState.animationEnabled;
          animationDebugState.animationPhase = nextAnimationDebugState.animationPhase;
          animationDebugState.animatedPlayerY = nextAnimationDebugState.animatedPlayerY;
          animationDebugState.authoredSpawnY = nextAnimationDebugState.authoredSpawnY;
          animationDebugState.resolvedLandingY = nextAnimationDebugState.resolvedLandingY;
          updateSummary();
        },
      );
      updateSummary();
      error.textContent = "";
      error.hidden = true;
    } catch (caughtError) {
      summary.textContent = `levelPath: ${activeLevelPath}\nloader ok: false\nplayer spawn packet ok: false\nstatus: load-failed`;
      error.hidden = false;
      error.textContent = `Error: ${caughtError?.message ?? "Unknown failure while building preview."}`;
    }
  }

  await renderLevel(requestedLevelPath);

  if (loadLevelButton && levelPathInput) {
    loadLevelButton.addEventListener("click", async () => {
      const nextLevelPath = levelPathInput.value.trim() || DEFAULT_LEVEL_PATH;
      levelPathInput.value = nextLevelPath;
      await renderLevel(nextLevelPath);
    });
  }
}
