import { evaluateScanAudio } from "./scanAudioEvaluation.js";

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

function createEmptyScanAudioState(positionX) {
  return {
    previousPositionX: Number.isFinite(positionX) ? positionX : null,
    positionX: Number.isFinite(positionX) ? positionX : null,
    activeSoundIds: [],
    startedSoundIds: [],
    endedSoundIds: [],
    activeSounds: [],
    startedSounds: [],
    endedSounds: [],
    transitionEvents: [],
    soundStates: [],
  };
}

export function resetScanAudioState(scan, positionX = scan?.positionX ?? 0) {
  scan.activeSoundIds = [];
  scan.audioEvaluation = createEmptyScanAudioState(positionX);
}

export function syncScanPlaybackState(scan, doc, options = {}) {
  const { preserveLog = false } = options;

  scan.positionX = getScanResetPosition(scan, doc);
  scan.playbackState = "idle";
  scan.isPlaying = false;
  resetScanAudioState(scan, scan.positionX);
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
    resetScanAudioState(scan, scan.positionX);
    scan.viewportSnapshot = captureScanViewport(viewport);
  } else if (!scan.viewportSnapshot) {
    scan.viewportSnapshot = captureScanViewport(viewport);
  }

  if (!Number.isFinite(scan.positionX) || scan.positionX < startX || scan.positionX > endX) {
    scan.positionX = startX;
    resetScanAudioState(scan, scan.positionX);
  }

  scan.lastFrameTime = null;
  scan.playbackState = "playing";
  scan.isPlaying = true;
}

export function pauseScanPlaybackState(scan) {
  if (!isScanSessionActive(scan)) return false;

  scan.playbackState = "paused";
  scan.isPlaying = false;
  scan.lastFrameTime = null;
  return true;
}

export function setPausedScanPosition(scan, doc, positionX) {
  if (!isScanPaused(scan)) return false;

  const { startX, endX } = getScanRange(scan, doc);
  scan.positionX = Math.max(startX, Math.min(endX, clampScanCoordinate(positionX, endX)));
  scan.lastFrameTime = null;
  return true;
}

export function finishScanPlaybackState(scan) {
  scan.playbackState = "idle";
  scan.isPlaying = false;
  resetScanAudioState(scan, scan.positionX);
  scan.lastFrameTime = null;
  scan.viewportSnapshot = null;
}

export function stopScanPlaybackState(scan, viewport, doc, options = {}) {
  const { preserveLog = true } = options;

  restoreScanViewport(scan, viewport);
  scan.positionX = getScanResetPosition(scan, doc);
  scan.playbackState = "idle";
  scan.isPlaying = false;
  resetScanAudioState(scan, scan.positionX);
  scan.lastFrameTime = null;
  scan.viewportSnapshot = null;

  if (!preserveLog) {
    scan.eventLog = [];
    scan.lastEventSummary = null;
  }
}

function getIntersectionTypeLabel(soundState) {
  if (soundState.soundType === "ambientZone") return "ambient-zone";
  if (soundState.soundType === "musicZone") return "music-zone";
  if (soundState.soundType === "trigger") return "trigger";
  return "spot-radius";
}

export function getScanActivity(doc, previousX, nextX) {
  const audioEvaluation = evaluateScanAudio(doc, previousX, nextX);
  const triggeredEvents = audioEvaluation.transitionEvents.map((event) => ({
    soundId: event.soundId,
    soundName: event.soundName,
    soundType: event.soundType,
    intersectionType: getIntersectionTypeLabel(event),
    transitionKind: event.transitionKind,
    phase: event.phase,
    normalizedIntensity: event.normalizedIntensity,
    spatial: event.spatial,
    atX: event.atX,
  }));

  return {
    activeSoundIds: audioEvaluation.activeSoundIds,
    triggeredEvents,
    audioEvaluation,
  };
}
