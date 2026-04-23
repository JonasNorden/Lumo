import { getAuthoredSoundSource } from "../domain/sound/sourceReference.js";
import { clamp01 } from "./fireflyAudioRuntime.js";

function clampPan(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function readNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSoundPath(path) {
  const trimmed = String(path || "").trim();
  if (!trimmed) return "";
  if (trimmed.includes("data/assets/sound/")) {
    return trimmed.replace("data/assets/sound/", "data/assets/audio/");
  }
  return trimmed;
}

function readAudioItemSource(audioItem) {
  return normalizeSoundPath(
    getAuthoredSoundSource({
      ...audioItem,
      source: audioItem?.source,
      params: audioItem?.params,
    }),
  );
}

function normalizeRuntimeAudioType(audioType) {
  const normalized = String(audioType || "").trim().toLowerCase();
  if (normalized === "ambientzone") return "ambientZone";
  if (normalized === "musiczone") return "musicZone";
  return normalized;
}

function buildPlayerCenter(playerSnapshot = null) {
  const x = Number.isFinite(playerSnapshot?.x) ? playerSnapshot.x : null;
  const y = Number.isFinite(playerSnapshot?.y) ? playerSnapshot.y : null;
  if (x === null || y === null) return null;
  const w = Number.isFinite(playerSnapshot?.w) ? playerSnapshot.w : 22;
  const h = Number.isFinite(playerSnapshot?.h) ? playerSnapshot.h : 28;
  return {
    x: x + (w * 0.5),
    y: y + (h * 0.5),
  };
}

function readRadiusPx(audioItem, tileSize = 24, fallbackTiles = 4) {
  const params = audioItem?.params && typeof audioItem.params === "object" ? audioItem.params : {};
  const radiusTiles = Number.isFinite(Number(params.radius)) ? Number(params.radius) : fallbackTiles;
  const safeTileSize = Number.isFinite(tileSize) && tileSize > 0 ? tileSize : 24;
  return Math.max(0, radiusTiles * safeTileSize);
}

function readBaseVolume(audioItem, fallback = 1) {
  const params = audioItem?.params && typeof audioItem.params === "object" ? audioItem.params : {};
  return clamp01(readNumber(params.volume, fallback));
}

function readPitch(audioItem, fallback = 1) {
  const params = audioItem?.params && typeof audioItem.params === "object" ? audioItem.params : {};
  const pitch = readNumber(params.pitch, fallback);
  return pitch > 0 ? pitch : fallback;
}

function readSpatial(audioItem, fallback = true) {
  const params = audioItem?.params && typeof audioItem.params === "object" ? audioItem.params : {};
  return typeof params.spatial === "boolean" ? params.spatial : fallback;
}

function readLoop(audioItem, fallback = true) {
  const params = audioItem?.params && typeof audioItem.params === "object" ? audioItem.params : {};
  return typeof params.loop === "boolean" ? params.loop : fallback;
}

function computeSpotFrame(audioItem, playerCenter, tileSize) {
  const cx = readNumber(audioItem?.x, 0);
  const cy = readNumber(audioItem?.y, 0);
  const radiusPx = readRadiusPx(audioItem, tileSize, 4);
  const baseVolume = readBaseVolume(audioItem, 0.8);
  const spatial = readSpatial(audioItem, true);

  if (!playerCenter) {
    return { targetVolume: 0, pan: 0, pitch: readPitch(audioItem, 1), spatial, loop: readLoop(audioItem, true) };
  }

  if (!spatial) {
    return {
      targetVolume: baseVolume,
      pan: 0,
      pitch: readPitch(audioItem, 1),
      spatial,
      loop: readLoop(audioItem, true),
    };
  }

  let gain = 0;
  if (radiusPx > 0) {
    const dx = cx - playerCenter.x;
    const dy = cy - playerCenter.y;
    const distance = Math.hypot(dx, dy);
    if (distance < radiusPx) {
      const t = 1 - (distance / radiusPx);
      gain = t * t;
    }
  }

  const dx = cx - playerCenter.x;
  const pan = radiusPx > 0 ? clampPan(dx / radiusPx) : 0;

  return {
    targetVolume: baseVolume * clamp01(gain),
    pan,
    pitch: readPitch(audioItem, 1),
    spatial,
    loop: readLoop(audioItem, true),
  };
}

function computeTriggerFrame(audioItem, playerCenter, previousPlayerCenter, tileSize) {
  const params = audioItem?.params && typeof audioItem.params === "object" ? audioItem.params : {};
  const cx = readNumber(audioItem?.x, 0);
  const cy = readNumber(audioItem?.y, 0);
  const baseVolume = readBaseVolume(audioItem, 1);
  const pitch = readPitch(audioItem, 1);
  const spatial = readSpatial(audioItem, true);
  const loop = readLoop(audioItem, false);
  const radiusPx = readRadiusPx(audioItem, tileSize, 3);
  const triggerWidthPx = Math.max(0, readNumber(params.triggerWidth, 0));

  const hasRange = radiusPx > 0 || triggerWidthPx > 0;

  let inRange = false;
  let enteredRange = false;
  let pan = 0;
  let volume = baseVolume;

  if (playerCenter) {
    const dx = cx - playerCenter.x;
    const dy = cy - playerCenter.y;
    const distance = Math.hypot(dx, dy);

    if (spatial && radiusPx > 0) {
      inRange = distance <= radiusPx;
      pan = clampPan(dx / radiusPx);
      const t = inRange ? (1 - (distance / radiusPx)) : 0;
      volume = baseVolume * clamp01(t * t);
    } else if (triggerWidthPx > 0) {
      inRange = Math.abs(playerCenter.x - cx) <= (triggerWidthPx * 0.5);
      pan = 0;
      volume = baseVolume;
    }

    if (hasRange) {
      const previousInRange = previousPlayerCenter
        ? (spatial && radiusPx > 0
          ? Math.hypot(cx - previousPlayerCenter.x, cy - previousPlayerCenter.y) <= radiusPx
          : Math.abs(previousPlayerCenter.x - cx) <= (triggerWidthPx * 0.5))
        : false;
      enteredRange = !previousInRange && inRange;
    }
  }

  if (!hasRange && playerCenter) {
    const previousX = Number.isFinite(previousPlayerCenter?.x) ? previousPlayerCenter.x : null;
    const currentX = playerCenter.x;
    const crossed = previousX !== null
      && ((previousX < cx && currentX >= cx) || (previousX > cx && currentX <= cx));
    enteredRange = crossed;
    inRange = currentX >= cx;
    pan = 0;
    volume = baseVolume;
  }

  return {
    enteredRange,
    inRange,
    targetVolume: volume,
    pan,
    pitch,
    spatial,
    loop,
  };
}

function applyHandlePitch(handle, pitch) {
  const audio = handle?.audio;
  if (!audio || !Number.isFinite(pitch) || pitch <= 0) return;
  if (Math.abs((audio.playbackRate || 1) - pitch) <= 0.0001) return;
  audio.playbackRate = pitch;
}

function playTriggerOneShot(handle, bridge, volume) {
  if (!handle || !bridge) return;
  try {
    if (handle.audio && typeof handle.audio.pause === "function") {
      handle.audio.pause();
      handle.audio.currentTime = 0;
    }
  } catch (_error) {
    // Keep trigger playback non-fatal when an audio element cannot reset.
  }
  bridge.setVolume(handle, volume);
}

function readZoneDimensionsPx(audioItem, tileSize = 24) {
  const params = audioItem?.params && typeof audioItem.params === "object" ? audioItem.params : {};
  const safeTileSize = Number.isFinite(tileSize) && tileSize > 0 ? tileSize : 24;
  const widthTiles = Math.max(1, readNumber(params.width, 1));
  const heightTiles = Math.max(1, readNumber(params.height, 1));
  return {
    widthPx: widthTiles * safeTileSize,
    heightPx: heightTiles * safeTileSize,
  };
}

function computeZoneFrame(audioItem, playerCenter, tileSize, fallbackVolume) {
  const baseVolume = readBaseVolume(audioItem, fallbackVolume);
  const loop = readLoop(audioItem, true);
  const pitch = readPitch(audioItem, 1);
  const spatial = readSpatial(audioItem, false);
  if (!playerCenter) {
    return { active: false, targetVolume: 0, pan: 0, pitch, spatial, loop };
  }

  const left = readNumber(audioItem?.x, 0);
  const top = readNumber(audioItem?.y, 0);
  const { widthPx, heightPx } = readZoneDimensionsPx(audioItem, tileSize);
  const right = left + widthPx;
  const bottom = top + heightPx;
  const inX = playerCenter.x >= left && playerCenter.x <= right;
  const inY = playerCenter.y >= top && playerCenter.y <= bottom;
  const active = inX && inY;
  if (!active) {
    return { active: false, targetVolume: 0, pan: 0, pitch, spatial, loop };
  }

  const params = audioItem?.params && typeof audioItem.params === "object" ? audioItem.params : {};
  const fadeTiles = Math.max(0, readNumber(params.fadeDistance, 0));
  const fadePx = fadeTiles * (Number.isFinite(tileSize) && tileSize > 0 ? tileSize : 24);
  let edgeGain = 1;
  if (fadePx > 0) {
    const distanceToEdge = Math.min(
      playerCenter.x - left,
      right - playerCenter.x,
      playerCenter.y - top,
      bottom - playerCenter.y,
    );
    edgeGain = clamp01(distanceToEdge / fadePx);
  }
  const centerX = left + widthPx * 0.5;
  const pan = spatial && widthPx > 0 ? clampPan((playerCenter.x - centerX) / (widthPx * 0.5)) : 0;
  return { active: true, targetVolume: baseVolume * edgeGain, pan, pitch, spatial, loop };
}

function syncRechargedAuthoredAudioFrame({
  audioItems = [],
  playerSnapshot = null,
  previousPlayerSnapshot = null,
  tileSize = 24,
  bridge = null,
  runtimeState = null,
} = {}) {
  if (!bridge || !runtimeState) return;
  const playerCenter = buildPlayerCenter(playerSnapshot);
  const previousPlayerCenter = buildPlayerCenter(previousPlayerSnapshot);
  const activeSpotKeys = new Set();
  const seenTriggerKeys = new Set();
  const activeZoneKeys = new Set();

  for (const audioItem of audioItems) {
    const audioType = normalizeRuntimeAudioType(audioItem?.audioType);
    const audioId = typeof audioItem?.audioId === "string" ? audioItem.audioId : "audio";
    const source = readAudioItemSource(audioItem);
    if (!source) continue;

    if (audioType === "spot") {
      const key = `spot::${audioId}`;
      activeSpotKeys.add(key);
      const frame = computeSpotFrame(audioItem, playerCenter, tileSize);
      const handle = bridge.getHandle(source, frame.loop, key);
      if (!handle) continue;
      applyHandlePitch(handle, frame.pitch);
      if (frame.spatial) {
        bridge.ensureSpatial(handle);
        bridge.setPan(handle, frame.pan);
      }
      bridge.setVolume(handle, frame.targetVolume);
      runtimeState.spotHandlesByKey.set(key, handle);
      continue;
    }

    if (audioType === "trigger") {
      const key = `trigger::${audioId}`;
      seenTriggerKeys.add(key);
      const frame = computeTriggerFrame(audioItem, playerCenter, previousPlayerCenter, tileSize);
      const handle = bridge.getHandle(source, frame.loop, key);
      if (!handle) continue;
      applyHandlePitch(handle, frame.pitch);
      if (frame.spatial) {
        bridge.ensureSpatial(handle);
        bridge.setPan(handle, frame.pan);
      }

      if (frame.loop) {
        bridge.setVolume(handle, frame.inRange ? frame.targetVolume : 0);
      } else if (frame.enteredRange) {
        playTriggerOneShot(handle, bridge, frame.targetVolume);
      }
      runtimeState.triggerHandlesByKey.set(key, handle);
      continue;
    }

    if (audioType === "ambientZone" || audioType === "musicZone") {
      const key = `${audioType}::${audioId}`;
      activeZoneKeys.add(key);
      const frame = computeZoneFrame(audioItem, playerCenter, tileSize, audioType === "musicZone" ? 0.78 : 0.45);
      const handle = bridge.getHandle(source, frame.loop, key);
      if (!handle) continue;
      applyHandlePitch(handle, frame.pitch);
      if (frame.spatial) {
        bridge.ensureSpatial(handle);
        bridge.setPan(handle, frame.pan);
      }
      bridge.setVolume(handle, frame.targetVolume);
      runtimeState.zoneHandlesByKey.set(key, handle);
    }
  }

  for (const [key, handle] of runtimeState.spotHandlesByKey.entries()) {
    if (activeSpotKeys.has(key)) continue;
    bridge.setPan(handle, 0);
    bridge.setVolume(handle, 0);
  }

  for (const [key, handle] of runtimeState.triggerHandlesByKey.entries()) {
    if (seenTriggerKeys.has(key)) continue;
    bridge.setPan(handle, 0);
    bridge.setVolume(handle, 0);
  }

  for (const [key, handle] of runtimeState.zoneHandlesByKey.entries()) {
    if (activeZoneKeys.has(key)) continue;
    bridge.setPan(handle, 0);
    bridge.setVolume(handle, 0);
  }
}

function createRechargedAuthoredAudioState() {
  return {
    bridge: null,
    spotHandlesByKey: new Map(),
    triggerHandlesByKey: new Map(),
    zoneHandlesByKey: new Map(),
  };
}

export {
  buildPlayerCenter,
  computeZoneFrame,
  computeSpotFrame,
  computeTriggerFrame,
  createRechargedAuthoredAudioState,
  syncRechargedAuthoredAudioFrame,
};
