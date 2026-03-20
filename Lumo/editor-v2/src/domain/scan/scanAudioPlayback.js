function clampUnitInterval(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampPositiveNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return Math.max(0, fallback);
  return Math.max(0, parsed);
}

function resolveSoundSource(sound) {
  const params = sound?.params || {};
  const candidates = [params.source, params.src, params.url, params.path, sound?.source];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function resolveLoopSetting(sound, soundState) {
  if (soundState?.soundType === "ambientZone" || soundState?.soundType === "musicZone") return true;
  return Boolean(soundState?.metadata?.loop ?? sound?.params?.loop);
}

function resolvePlaybackVolume(sound, soundState) {
  const authoredVolume = Number.isFinite(Number(soundState?.metadata?.volume))
    ? Number(soundState.metadata.volume)
    : Number.isFinite(Number(sound?.params?.volume))
      ? Number(sound.params.volume)
      : 1;
  return clampUnitInterval(authoredVolume * clampUnitInterval(soundState?.normalizedIntensity ?? 0));
}

function getPlaceholderFrequency(sound, soundState) {
  const authoredPitch = clampPositiveNumber(soundState?.metadata?.pitch ?? sound?.params?.pitch, 1) || 1;
  const baseFrequency = soundState?.soundType === "musicZone"
    ? 220
    : soundState?.soundType === "ambientZone"
      ? 180
      : soundState?.soundType === "trigger"
        ? 660
        : 440;
  return baseFrequency * authoredPitch;
}

function getPlaceholderWaveform(soundState) {
  if (soundState?.soundType === "musicZone") return "triangle";
  if (soundState?.soundType === "ambientZone") return "sine";
  if (soundState?.soundType === "trigger") return "square";
  return "sawtooth";
}

function getOneShotDuration(sound, soundState) {
  const authoredPitch = clampPositiveNumber(soundState?.metadata?.pitch ?? sound?.params?.pitch, 1) || 1;
  const baseDuration = soundState?.soundType === "trigger" ? 0.35 : 0.6;
  return Math.max(0.12, baseDuration / authoredPitch);
}

function createAudioElementInstance(sound, soundState, options = {}) {
  const source = resolveSoundSource(sound);
  if (!source || typeof Audio !== "function") return null;

  const { onEnded } = options;
  const audio = new Audio(source);
  audio.preload = "auto";
  audio.loop = resolveLoopSetting(sound, soundState);
  audio.volume = 0;
  audio.playbackRate = clampPositiveNumber(soundState?.metadata?.pitch ?? sound?.params?.pitch, 1) || 1;

  const handleEnded = () => {
    onEnded?.();
  };

  audio.addEventListener("ended", handleEnded);

  return {
    kind: "audio-element",
    play() {
      const maybePromise = audio.play();
      if (maybePromise?.catch) {
        maybePromise.catch(() => {});
      }
    },
    pause() {
      audio.pause();
    },
    resume() {
      const maybePromise = audio.play();
      if (maybePromise?.catch) {
        maybePromise.catch(() => {});
      }
    },
    setVolume(volume) {
      audio.volume = clampUnitInterval(volume);
    },
    stop() {
      audio.pause();
      audio.currentTime = 0;
      audio.removeEventListener("ended", handleEnded);
      onEnded?.();
    },
  };
}

function createOscillatorInstance(audioContext, sound, soundState, options = {}) {
  if (!audioContext?.createOscillator || !audioContext?.createGain) return null;

  const { onEnded } = options;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const loop = resolveLoopSetting(sound, soundState);
  const oneShotDuration = loop ? null : getOneShotDuration(sound, soundState);
  let ended = false;

  oscillator.type = getPlaceholderWaveform(soundState);
  oscillator.frequency.value = getPlaceholderFrequency(sound, soundState);
  gainNode.gain.value = 0;
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.onended = () => {
    if (ended) return;
    ended = true;
    onEnded?.();
  };
  oscillator.start();
  if (oneShotDuration) {
    oscillator.stop(audioContext.currentTime + oneShotDuration);
  }

  return {
    kind: "oscillator",
    play() {},
    pause() {},
    resume() {},
    setVolume(volume) {
      const nextVolume = clampUnitInterval(volume);
      gainNode.gain.cancelScheduledValues(audioContext.currentTime);
      gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(nextVolume, audioContext.currentTime + 0.05);
    },
    stop() {
      if (ended) return;
      gainNode.gain.cancelScheduledValues(audioContext.currentTime);
      gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.08);
      oscillator.stop(audioContext.currentTime + 0.08);
    },
  };
}

function createDefaultPlaybackInstanceFactory(audioContext) {
  return ({ sound, soundState, onEnded }) => {
    const elementInstance = createAudioElementInstance(sound, soundState, { onEnded });
    if (elementInstance) return elementInstance;
    return createOscillatorInstance(audioContext, sound, soundState, { onEnded });
  };
}

function createAudioContext() {
  const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
  return typeof AudioContextCtor === "function" ? new AudioContextCtor() : null;
}

export function createScanAudioPlaybackController(options = {}) {
  const audioContext = options.audioContext ?? createAudioContext();
  const createPlaybackInstance = options.createPlaybackInstance || createDefaultPlaybackInstanceFactory(audioContext);
  const activeInstances = new Map();
  let paused = false;

  const removeInstance = (soundId) => {
    activeInstances.delete(soundId);
  };

  const stopInstance = (soundId) => {
    const entry = activeInstances.get(soundId);
    if (!entry) return false;
    activeInstances.delete(soundId);
    entry.instance.stop();
    return true;
  };

  const ensureInstance = (sound, soundState) => {
    const existingEntry = activeInstances.get(soundState.soundId);
    if (existingEntry) return existingEntry;

    const instance = createPlaybackInstance({
      sound,
      soundState,
      onEnded: () => {
        if (activeInstances.get(soundState.soundId)?.instance === instance) {
          removeInstance(soundState.soundId);
        }
      },
    });
    if (!instance) return null;

    const nextEntry = {
      soundId: soundState.soundId,
      soundType: soundState.soundType,
      instance,
      loop: resolveLoopSetting(sound, soundState),
      transient: soundState.eventLike,
    };
    activeInstances.set(soundState.soundId, nextEntry);
    instance.play();
    if (paused) {
      instance.pause();
    }
    return nextEntry;
  };

  const pauseAll = () => {
    if (paused) return;
    paused = true;
    if (audioContext?.state === "running" && typeof audioContext.suspend === "function") {
      void audioContext.suspend();
    }
    for (const entry of activeInstances.values()) {
      entry.instance.pause();
    }
  };

  const resumeAll = () => {
    paused = false;
    if (audioContext?.state === "suspended" && typeof audioContext.resume === "function") {
      void audioContext.resume();
    }
    for (const entry of activeInstances.values()) {
      entry.instance.resume();
    }
  };

  const stopAll = () => {
    const soundIds = [...activeInstances.keys()];
    for (const soundId of soundIds) {
      stopInstance(soundId);
    }
  };

  const sync = ({ doc, scan }) => {
    if (!doc || !scan) {
      stopAll();
      return;
    }

    const playbackState = scan.playbackState || (scan.isPlaying ? "playing" : "idle");
    if (playbackState === "idle") {
      stopAll();
      paused = false;
      return;
    }

    if (playbackState === "paused") {
      pauseAll();
      return;
    }

    resumeAll();

    const authoredSounds = new Map((doc.sounds || []).filter((sound) => sound?.id).map((sound) => [sound.id, sound]));
    const evaluation = scan.audioEvaluation || {};
    const soundStates = Array.isArray(evaluation.soundStates) ? evaluation.soundStates : [];
    const persistentActiveIds = new Set();

    for (const soundState of soundStates) {
      const sound = authoredSounds.get(soundState.soundId);
      if (!sound) {
        stopInstance(soundState.soundId);
        continue;
      }

      if (soundState.eventLike) {
        if (soundState.startedThisStep) {
          stopInstance(soundState.soundId);
          const entry = ensureInstance(sound, soundState);
          entry?.instance.setVolume(resolvePlaybackVolume(sound, soundState));
        }
        continue;
      }

      if (soundState.active) {
        persistentActiveIds.add(soundState.soundId);
        const entry = ensureInstance(sound, soundState);
        entry?.instance.setVolume(resolvePlaybackVolume(sound, soundState));
        continue;
      }

      if (soundState.endedThisStep || activeInstances.has(soundState.soundId)) {
        stopInstance(soundState.soundId);
      }
    }

    for (const [soundId, entry] of activeInstances.entries()) {
      if (!authoredSounds.has(soundId)) {
        stopInstance(soundId);
        continue;
      }
      if (!entry.transient && !persistentActiveIds.has(soundId)) {
        stopInstance(soundId);
      }
    }
  };

  const destroy = () => {
    stopAll();
    if (typeof audioContext?.close === "function") {
      void audioContext.close();
    }
  };

  return {
    sync,
    pauseAll,
    resumeAll,
    stopAll,
    destroy,
    getActiveInstanceIds() {
      return [...activeInstances.keys()];
    },
  };
}
