function clampPositiveValue(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return Math.max(0, fallback);
  return Math.max(0, parsed);
}

function clampUnitInterval(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function formatScanCoordinate(value) {
  return Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, "") : "0";
}

function getSoundPointX(sound) {
  return (Number(sound?.x) || 0) + 0.5;
}

function getZoneStartX(sound) {
  return Number(sound?.x) || 0;
}

function getZoneWidth(sound) {
  return Math.max(1, clampPositiveValue(sound?.params?.width, 1));
}

function getZoneSpan(sound) {
  const startX = getZoneStartX(sound);
  const width = getZoneWidth(sound);
  return {
    minX: startX,
    maxX: startX + width,
    width,
  };
}

function getSpotSpan(sound) {
  const centerX = getSoundPointX(sound);
  const spatial = Boolean(sound?.params?.spatial);
  const radius = spatial ? clampPositiveValue(sound?.params?.radius, 0) : 0;
  return radius > 0
    ? { minX: centerX - radius, maxX: centerX + radius, centerX, radius }
    : { minX: centerX, maxX: centerX, centerX, radius: 0 };
}

function getTriggerX(sound) {
  return getSoundPointX(sound);
}

function isWithinSpan(span, x) {
  return Number.isFinite(x) && x >= span.minX && x <= span.maxX;
}

function crossesPoint(previousX, nextX, pointX) {
  if (!Number.isFinite(previousX) || !Number.isFinite(nextX) || previousX === nextX) return false;
  const sweepMin = Math.min(previousX, nextX);
  const sweepMax = Math.max(previousX, nextX);
  if (pointX < sweepMin || pointX > sweepMax) return false;
  return (previousX < pointX && nextX >= pointX) || (previousX > pointX && nextX <= pointX);
}

function buildBaseSoundState(sound, previousX, nextX) {
  const params = sound?.params || {};
  return {
    soundId: sound?.id || null,
    soundName: sound?.name || sound?.id || "Sound",
    soundType: sound?.type || "spot",
    previousPositionX: Number.isFinite(previousX) ? previousX : null,
    positionX: Number.isFinite(nextX) ? nextX : null,
    active: false,
    startedThisStep: false,
    endedThisStep: false,
    crossedThisStep: false,
    phase: "inactive",
    normalizedIntensity: 0,
    spatial: Boolean(params.spatial),
    eventLike: false,
    metadata: {
      volume: Number.isFinite(Number(params.volume)) ? Number(params.volume) : 1,
      pitch: Number.isFinite(Number(params.pitch)) ? Number(params.pitch) : 1,
      loop: Boolean(params.loop),
      spatial: Boolean(params.spatial),
      radius: clampPositiveValue(params.radius, 0),
      width: clampPositiveValue(params.width, 0),
      height: clampPositiveValue(params.height, 0),
    },
  };
}

function evaluateSpotSound(sound, previousX, nextX) {
  const state = buildBaseSoundState(sound, previousX, nextX);
  const span = getSpotSpan(sound);
  const previousActive = isWithinSpan(span, previousX);
  const active = isWithinSpan(span, nextX);
  const distanceFromCenter = Math.abs((Number.isFinite(nextX) ? nextX : span.centerX) - span.centerX);
  const normalizedIntensity = span.radius > 0
    ? clampUnitInterval(1 - distanceFromCenter / span.radius)
    : active
      ? 1
      : 0;

  state.active = active;
  state.startedThisStep = active && !previousActive;
  state.endedThisStep = previousActive && !active;
  state.phase = active ? "insideRadius" : "inactive";
  state.normalizedIntensity = normalizedIntensity;
  state.metadata.radius = span.radius;
  state.metadata.centerX = span.centerX;
  state.metadata.span = { minX: span.minX, maxX: span.maxX };

  return state;
}

function evaluateTriggerSound(sound, previousX, nextX) {
  const state = buildBaseSoundState(sound, previousX, nextX);
  const triggerX = getTriggerX(sound);
  const crossedThisStep = crossesPoint(previousX, nextX, triggerX);

  state.active = crossedThisStep;
  state.startedThisStep = crossedThisStep;
  state.crossedThisStep = crossedThisStep;
  state.phase = crossedThisStep ? "triggered" : "inactive";
  state.normalizedIntensity = crossedThisStep ? 1 : 0;
  state.eventLike = true;
  state.metadata.triggerX = triggerX;
  state.metadata.span = { minX: triggerX, maxX: triggerX };

  return state;
}

function getMusicGeometry(sound) {
  const fallbackWidth = getZoneWidth(sound);
  const requestedFadeDistance = clampPositiveValue(sound?.params?.fadeDistance, Number.NaN);
  const requestedSustainWidth = clampPositiveValue(sound?.params?.sustainWidth, Number.NaN);

  if (Number.isFinite(requestedFadeDistance) || Number.isFinite(requestedSustainWidth)) {
    const fadeDistance = Number.isFinite(requestedFadeDistance) ? requestedFadeDistance : 0;
    const sustainWidth = Number.isFinite(requestedSustainWidth)
      ? requestedSustainWidth
      : Math.max(0, fallbackWidth - fadeDistance * 2);
    const totalWidth = Math.max(1, sustainWidth + fadeDistance * 2);
    return { fadeDistance, sustainWidth, totalWidth };
  }

  const derivedFadeDistance = Math.min(2, Math.max(0, fallbackWidth * 0.25));
  const sustainWidth = Math.max(0, fallbackWidth - derivedFadeDistance * 2);
  return {
    fadeDistance: derivedFadeDistance,
    sustainWidth,
    totalWidth: fallbackWidth,
  };
}

function evaluateAmbientZone(sound, previousX, nextX) {
  const state = buildBaseSoundState(sound, previousX, nextX);
  const span = getZoneSpan(sound);
  const previousActive = isWithinSpan(span, previousX);
  const active = isWithinSpan(span, nextX);

  state.active = active;
  state.startedThisStep = active && !previousActive;
  state.endedThisStep = previousActive && !active;
  state.phase = active ? "sustain" : "inactive";
  state.normalizedIntensity = active ? 1 : 0;
  state.metadata.span = { minX: span.minX, maxX: span.maxX, width: span.width };

  return state;
}

function evaluateMusicZone(sound, previousX, nextX) {
  const state = buildBaseSoundState(sound, previousX, nextX);
  const startX = getZoneStartX(sound);
  const geometry = getMusicGeometry(sound);
  const endX = startX + geometry.totalWidth;
  const span = { minX: startX, maxX: endX };
  const previousActive = isWithinSpan(span, previousX);
  const active = isWithinSpan(span, nextX);
  const fadeInEndX = startX + geometry.fadeDistance;
  const sustainEndX = fadeInEndX + geometry.sustainWidth;

  let phase = "inactive";
  let normalizedIntensity = 0;
  if (active) {
    if (geometry.fadeDistance > 0 && nextX < fadeInEndX) {
      phase = "fadeIn";
      normalizedIntensity = clampUnitInterval((nextX - startX) / geometry.fadeDistance);
    } else if (geometry.fadeDistance > 0 && nextX > sustainEndX) {
      phase = "fadeOut";
      normalizedIntensity = clampUnitInterval((endX - nextX) / geometry.fadeDistance);
    } else {
      phase = "sustain";
      normalizedIntensity = 1;
    }
  }

  state.active = active;
  state.startedThisStep = active && !previousActive;
  state.endedThisStep = previousActive && !active;
  state.phase = phase;
  state.normalizedIntensity = normalizedIntensity;
  state.metadata.fadeDistance = geometry.fadeDistance;
  state.metadata.sustainWidth = geometry.sustainWidth;
  state.metadata.totalWidth = geometry.totalWidth;
  state.metadata.span = { minX: span.minX, maxX: span.maxX, width: geometry.totalWidth };

  return state;
}

export function evaluateSoundAtScanStep(sound, previousX, nextX) {
  if (!sound?.visible || !sound?.id) return null;
  if (sound.type === "trigger") return evaluateTriggerSound(sound, previousX, nextX);
  if (sound.type === "ambientZone") return evaluateAmbientZone(sound, previousX, nextX);
  if (sound.type === "musicZone") return evaluateMusicZone(sound, previousX, nextX);
  return evaluateSpotSound(sound, previousX, nextX);
}

function createTransitionEvent(soundState, transitionKind) {
  return {
    soundId: soundState.soundId,
    soundName: soundState.soundName,
    soundType: soundState.soundType,
    transitionKind,
    phase: soundState.phase,
    normalizedIntensity: soundState.normalizedIntensity,
    atX: formatScanCoordinate(soundState.positionX),
    spatial: soundState.spatial,
  };
}

export function evaluateScanAudio(doc, previousX, nextX) {
  const soundStates = [];
  const activeSounds = [];
  const startedSounds = [];
  const endedSounds = [];
  const transitionEvents = [];

  for (const sound of doc?.sounds || []) {
    const soundState = evaluateSoundAtScanStep(sound, previousX, nextX);
    if (!soundState) continue;

    soundStates.push(soundState);
    if (soundState.active) activeSounds.push(soundState);
    if (soundState.startedThisStep) {
      startedSounds.push(soundState);
      transitionEvents.push(createTransitionEvent(soundState, soundState.eventLike ? "triggered" : "started"));
    }
    if (soundState.endedThisStep) {
      endedSounds.push(soundState);
      transitionEvents.push(createTransitionEvent(soundState, "ended"));
    }
  }

  return {
    previousPositionX: Number.isFinite(previousX) ? previousX : null,
    positionX: Number.isFinite(nextX) ? nextX : null,
    activeSoundIds: activeSounds.map((soundState) => soundState.soundId),
    startedSoundIds: startedSounds.map((soundState) => soundState.soundId),
    endedSoundIds: endedSounds.map((soundState) => soundState.soundId),
    activeSounds,
    startedSounds,
    endedSounds,
    transitionEvents,
    soundStates,
  };
}
