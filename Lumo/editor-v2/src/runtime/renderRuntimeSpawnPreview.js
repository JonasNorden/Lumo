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
  context.fillStyle = "#4d79ff";
  for (const tile of tiles) {
    const tileX = safeNumber(tile?.x, 0) * tileSize;
    const tileY = safeNumber(tile?.y, 0) * tileSize;
    const tileW = Math.max(1, safeNumber(tile?.w, 1) * tileSize);
    const tileH = Math.max(1, safeNumber(tile?.h, 1) * tileSize);
    context.fillRect(tileX, tileY, tileW, tileH);
  }

  // Draw authored spawn as a hollow ring so it differs from resolved start.
  const authoredX = safeNumber(worldPacket?.spawn?.x, 0);
  const authoredY = safeNumber(worldPacket?.spawn?.y, 0);
  context.strokeStyle = "#ffb13b";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(authoredX, authoredY, Math.max(5, tileSize * 0.2), 0, Math.PI * 2);
  context.stroke();

  // Draw resolved runtime start as a filled diamond marker.
  const resolvedX = safeNumber(playerSpawnPacket?.startPixel?.x, authoredX);
  const resolvedY = safeNumber(playerSpawnPacket?.startPixel?.y, authoredY);
  const markerRadius = Math.max(4, tileSize * 0.18);
  context.fillStyle = "#5cff8a";
  context.beginPath();
  context.moveTo(resolvedX, resolvedY - markerRadius);
  context.lineTo(resolvedX + markerRadius, resolvedY);
  context.lineTo(resolvedX, resolvedY + markerRadius);
  context.lineTo(resolvedX - markerRadius, resolvedY);
  context.closePath();
  context.fill();

  // Draw a thin connector when both markers overlap to keep both visible.
  if (resolvedX === authoredX && resolvedY === authoredY) {
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(resolvedX - markerRadius - 4, resolvedY - markerRadius - 4);
    context.lineTo(resolvedX + markerRadius + 4, resolvedY + markerRadius + 4);
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
}) {
  const levelPath = readLevelPathFromQuery();

  try {
    const previewState = await buildPreviewState(levelPath);

    drawSpawnPreview(canvas, previewState.worldPacket, previewState.playerSpawnPacket);
    summary.textContent = buildSummaryText(
      previewState.levelPath,
      previewState.loaderResult,
      previewState.playerSpawnPacket,
    );
    error.textContent = "";
    error.hidden = true;
  } catch (caughtError) {
    summary.textContent = `levelPath: ${levelPath}\nloader ok: false\nplayer spawn packet ok: false\nstatus: load-failed`;
    error.hidden = false;
    error.textContent = `Error: ${caughtError?.message ?? "Unknown failure while building preview."}`;
  }
}
