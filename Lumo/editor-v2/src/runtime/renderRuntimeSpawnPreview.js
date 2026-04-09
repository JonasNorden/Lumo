import { loadLevelDocument } from "./loadLevelDocument.js";
import { buildRuntimeWorldSkeleton } from "./buildRuntimeWorldSkeleton.js";
import { buildRuntimeTileEntries } from "./buildRuntimeTileEntries.js";
import { buildRuntimeTileBounds } from "./buildRuntimeTileBounds.js";
import { buildRuntimeTileMap } from "./buildRuntimeTileMap.js";
import { buildRuntimeWorldPacket } from "./buildRuntimeWorldPacket.js";
import { buildRuntimePlayerSpawnPacket } from "./buildRuntimePlayerSpawnPacket.js";

const DEFAULT_TILE_SIZE = 32;
const DEFAULT_LEVEL_PATH = "./src/data/testLevelDocument.v1.json";

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

// Draws the top-down debug snapshot for world tiles and spawn markers.
function drawSpawnPreview(canvas, worldPacket, playerSpawnPacket) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const tileSize = safeNumber(worldPacket?.world?.tileSize, DEFAULT_TILE_SIZE);
  const worldWidth = safeNumber(worldPacket?.world?.width, 20);
  const worldHeight = safeNumber(worldPacket?.world?.height, 12);
  const worldWidthPx = worldWidth * tileSize;
  const worldHeightPx = worldHeight * tileSize;

  canvas.width = Math.max(1, worldWidthPx);
  canvas.height = Math.max(1, worldHeightPx);

  context.fillStyle = "#0b0f17";
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Draw world bounds first so tile extents are easy to read.
  context.strokeStyle = "#8da2c0";
  context.lineWidth = 2;
  context.strokeRect(1, 1, Math.max(0, worldWidthPx - 2), Math.max(0, worldHeightPx - 2));

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

  const landingCell = readGridCell(playerSpawnPacket?.landingCell);
  if (landingCell) {
    const landingX = landingCell.x * tileSize;
    const landingY = landingCell.y * tileSize;
    context.fillStyle = "rgba(80,255,160,0.25)";
    context.strokeStyle = "rgba(80,255,160,0.95)";
    context.lineWidth = 2;
    context.fillRect(landingX, landingY, tileSize, tileSize);
    context.strokeRect(landingX, landingY, tileSize, tileSize);
  }

  const supportCell = readGridCell(playerSpawnPacket?.supportCell);
  if (supportCell) {
    const supportX = supportCell.x * tileSize;
    const supportY = supportCell.y * tileSize;
    context.fillStyle = "rgba(255,255,100,0.15)";
    context.strokeStyle = "rgba(255,255,100,0.6)";
    context.lineWidth = 2;
    context.fillRect(supportX, supportY, tileSize, tileSize);
    context.strokeRect(supportX, supportY, tileSize, tileSize);
  }

  // Draw authored spawn as a hollow ring so it differs from landing visuals.
  const authoredSpawn = worldPacket?.spawn;
  const hasAuthoredSpawn = hasValidPixelPosition(authoredSpawn);
  const authoredX = safeNumber(authoredSpawn?.x, 0);
  const authoredY = safeNumber(authoredSpawn?.y, 0);
  if (hasAuthoredSpawn) {
    context.strokeStyle = "#ffb13b";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(authoredX, authoredY, Math.max(5, tileSize * 0.2), 0, Math.PI * 2);
    context.stroke();
  }

  // Draw authored→resolved drop path to visualize runtime spawn settling.
  const resolvedStartPixel = playerSpawnPacket?.startPixel;
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

  const spawnValid = playerSpawnPacket?.spawnValid === true;
  const spawnWarnings = Array.isArray(playerSpawnPacket?.warnings) ? playerSpawnPacket.warnings : [];
  const spawnPixel = playerSpawnPacket?.startPixel;
  const hasSpawnPixel = hasValidPixelPosition(spawnPixel);
  const hasSpawnWarning = spawnValid && spawnWarnings.length > 0;
  const hasSpawnError = playerSpawnPacket?.spawnValid === false;

  if (hasSpawnPixel) {
    if (hasSpawnError) {
      drawSpawnInvalidX(context, spawnPixel, tileSize);
    } else if (hasSpawnWarning) {
      drawSpawnWarningTriangle(context, spawnPixel, tileSize);
    }
  }

  // Draw player at authored spawn (runtime starts here, then falls to landing).
  if (hasAuthoredSpawn) {
    const playerWidth = tileSize * 0.6;
    const playerHeight = tileSize * 0.9;
    const playerLeft = authoredX - playerWidth * 0.5;
    const playerTop = authoredY - playerHeight;
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
}

// Builds a compact, debug-first summary text block for packet status.
function buildSummaryText(levelPath, loaderResult, playerSpawnPacket) {
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
  const requestedLevelPath = readLevelPathFromQuery();

  if (levelPathInput) {
    levelPathInput.value = requestedLevelPath;
  }

  async function renderLevel(levelPath) {
    const activeLevelPath = levelPath || DEFAULT_LEVEL_PATH;

    try {
      const previewState = await buildPreviewState(activeLevelPath);

      drawSpawnPreview(canvas, previewState.worldPacket, previewState.playerSpawnPacket);
      summary.textContent = buildSummaryText(
        previewState.levelPath,
        previewState.loaderResult,
        previewState.playerSpawnPacket,
      );
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
