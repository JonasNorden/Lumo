import { resolveSoundPlaybackSource } from "./sourceReference.js";

function createPreviewKey(sound, source, soundIndex = null) {
  const baseId = sound?.id || (Number.isInteger(soundIndex) ? `index:${soundIndex}` : "sound");
  return `${baseId}:${source}`;
}

export function getSoundPreviewKey(sound, soundIndex = null) {
  const source = resolveSoundPlaybackSource(sound);
  if (!source) return null;
  return createPreviewKey(sound, source, soundIndex);
}

export function createSoundPreviewController() {
  let activePreview = null;

  const clearPreview = () => {
    activePreview = null;
  };

  const stop = () => {
    if (!activePreview) return false;
    const preview = activePreview;
    clearPreview();
    preview.audio.pause();
    preview.audio.currentTime = 0;
    preview.audio.removeEventListener("ended", preview.handleEnded);
    preview.audio.removeEventListener("error", preview.handleError);
    return true;
  };

  const play = ({ sound, soundIndex = null, onEnded, onError } = {}) => {
    const source = resolveSoundPlaybackSource(sound);
    if (!source || typeof Audio !== "function") {
      stop();
      return {
        ok: false,
        reason: source ? "unsupported" : "missing-source",
        source: source || null,
        key: null,
      };
    }

    stop();

    const audio = new Audio(source);
    const key = createPreviewKey(sound, source, soundIndex);
    let finished = false;

    const finish = (callback) => {
      if (finished) return;
      finished = true;
      if (activePreview?.key === key) {
        clearPreview();
      }
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      callback?.();
    };

    const handleEnded = () => {
      finish(onEnded);
    };

    const handleError = () => {
      finish(onError);
    };

    audio.preload = "auto";
    audio.loop = false;
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    activePreview = {
      key,
      audio,
      handleEnded,
      handleError,
    };

    const maybePromise = audio.play();
    if (maybePromise?.catch) {
      maybePromise.catch(() => {
        handleError();
      });
    }

    return {
      ok: true,
      key,
      source,
    };
  };

  return {
    play,
    stop,
    destroy() {
      stop();
    },
    getActiveKey() {
      return activePreview?.key || null;
    },
  };
}
