export function clampScanCoordinate(value, maxWidth) {
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) return 0;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(maxWidth, parsed));
}

export function sanitizeOptionalScanCoordinate(value, maxWidth) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return clampScanCoordinate(parsed, maxWidth);
}

export function getScanRange(scan, doc) {
  const maxWidth = Number(doc?.dimensions?.width) || 0;
  const rawStart = sanitizeOptionalScanCoordinate(scan?.startX, maxWidth);
  const rawEnd = sanitizeOptionalScanCoordinate(scan?.endX, maxWidth);
  const startX = rawStart ?? 0;
  const endX = rawEnd ?? maxWidth;
  return startX <= endX ? { startX, endX } : { startX: endX, endX: startX };
}

export function getScanResetPosition(scan, doc) {
  return getScanRange(scan, doc).startX;
}

export function getScanPlaybackState(scan) {
  return scan?.playbackState || (scan?.isPlaying ? "playing" : "idle");
}

export function isScanPlaying(scan) {
  return getScanPlaybackState(scan) === "playing";
}

export function isScanPaused(scan) {
  return getScanPlaybackState(scan) === "paused";
}

export function isScanSessionActive(scan) {
  const playbackState = getScanPlaybackState(scan);
  return playbackState === "playing" || playbackState === "paused";
}

export function captureScanViewport(viewport) {
  return {
    offsetX: Number.isFinite(viewport?.offsetX) ? viewport.offsetX : 0,
    offsetY: Number.isFinite(viewport?.offsetY) ? viewport.offsetY : 0,
  };
}

export function restoreScanViewport(scan, viewport) {
  if (!scan?.viewportSnapshot || !viewport) return false;
  viewport.offsetX = scan.viewportSnapshot.offsetX;
  viewport.offsetY = scan.viewportSnapshot.offsetY;
  return true;
}

export function syncScanPlaybackState(scan, doc, options = {}) {
  const { preserveLog = false } = options;

  scan.positionX = getScanResetPosition(scan, doc);
  scan.playbackState = "idle";
  scan.isPlaying = false;
  scan.activeSoundIds = [];
  scan.lastFrameTime = null;
  scan.viewportSnapshot = null;

  if (!preserveLog) {
    scan.eventLog = [];
    scan.lastEventSummary = null;
  }
}

export function startScanPlaybackState(scan, viewport, doc) {
  const playbackState = getScanPlaybackState(scan);
  const isResuming = playbackState === "paused";
  const { startX, endX } = getScanRange(scan, doc);

  if (!isResuming) {
    scan.positionX = startX;
    scan.activeSoundIds = [];
    scan.viewportSnapshot = captureScanViewport(viewport);
  } else if (!scan.viewportSnapshot) {
    scan.viewportSnapshot = captureScanViewport(viewport);
  }

  if (!Number.isFinite(scan.positionX) || scan.positionX < startX || scan.positionX > endX) {
    scan.positionX = startX;
  }

  scan.lastFrameTime = null;
  scan.playbackState = "playing";
  scan.isPlaying = true;
}

export function pauseScanPlaybackState(scan) {
  if (!isScanSessionActive(scan)) return false;

  scan.playbackState = "paused";
  scan.isPlaying = false;
  scan.activeSoundIds = [];
  scan.lastFrameTime = null;
  return true;
}

export function setPausedScanPosition(scan, doc, positionX) {
  if (!isScanPaused(scan)) return false;

  const { startX, endX } = getScanRange(scan, doc);
  scan.positionX = Math.max(startX, Math.min(endX, clampScanCoordinate(positionX, endX)));
  scan.activeSoundIds = [];
  scan.lastFrameTime = null;
  return true;
}

export function finishScanPlaybackState(scan) {
  scan.playbackState = "idle";
  scan.isPlaying = false;
  scan.activeSoundIds = [];
  scan.lastFrameTime = null;
  scan.viewportSnapshot = null;
}

export function stopScanPlaybackState(scan, viewport, doc, options = {}) {
  const { preserveLog = true } = options;

  restoreScanViewport(scan, viewport);
  scan.positionX = getScanResetPosition(scan, doc);
  scan.playbackState = "idle";
  scan.isPlaying = false;
  scan.activeSoundIds = [];
  scan.lastFrameTime = null;
  scan.viewportSnapshot = null;

  if (!preserveLog) {
    scan.eventLog = [];
    scan.lastEventSummary = null;
  }
}

function clampPositiveValue(value, fallback) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
}

function getSoundSpan(sound) {
  const x = Number(sound?.x) || 0;
  if (sound?.type === "ambientZone" || sound?.type === "musicZone") {
    const width = Math.max(1, clampPositiveValue(sound?.params?.width, 1));
    return { minX: x, maxX: x + width };
  }

  if (sound?.type === "trigger") {
    return { minX: x + 0.5, maxX: x + 0.5 };
  }

  const spatial = Boolean(sound?.params?.spatial);
  const radius = spatial ? clampPositiveValue(sound?.params?.radius, 0) : 0;
  const centerX = x + 0.5;
  return radius > 0
    ? { minX: centerX - radius, maxX: centerX + radius }
    : { minX: centerX, maxX: centerX };
}

function intersectsSweep(span, fromX, toX) {
  const sweepMin = Math.min(fromX, toX);
  const sweepMax = Math.max(fromX, toX);
  return span.maxX >= sweepMin && span.minX <= sweepMax;
}

function isActiveAtX(span, x) {
  return x >= span.minX && x <= span.maxX;
}

function formatScanCoordinate(value) {
  return Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, "") : "0";
}

function getIntersectionTypeLabel(sound) {
  if (sound?.type === "ambientZone") return "ambient-zone";
  if (sound?.type === "musicZone") return "music-zone";
  if (sound?.type === "trigger") return "trigger";
  return "spot-radius";
}

export function getScanActivity(doc, previousX, nextX, previousActiveIds = []) {
  const activeSoundIds = [];
  const triggeredEvents = [];
  const previousActiveIdSet = new Set(previousActiveIds);

  for (const sound of doc?.sounds || []) {
    if (!sound?.visible || !sound?.id) continue;

    const span = getSoundSpan(sound);
    if (isActiveAtX(span, nextX)) {
      activeSoundIds.push(sound.id);
    }

    if (!intersectsSweep(span, previousX, nextX) || previousActiveIdSet.has(sound.id)) continue;

    triggeredEvents.push({
      soundId: sound.id,
      soundName: sound.name || sound.id,
      soundType: sound.type || "spot",
      intersectionType: getIntersectionTypeLabel(sound),
      atX: formatScanCoordinate(nextX),
    });
  }

  return {
    activeSoundIds,
    triggeredEvents,
  };
}
