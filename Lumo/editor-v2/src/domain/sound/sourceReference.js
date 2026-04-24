import { getSoundAssetOptionsForType } from "./audioAssetCatalog.js";

export function normalizeSoundSourceValue(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function hasAbsoluteUrlScheme(value) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}

export function getAuthoredSoundSource(sound) {
  const candidates = [
    sound?.source,
    sound?.asset,
    sound?.soundFile,
    sound?.params?.source,
    sound?.params?.soundFile,
    sound?.params?.src,
    sound?.params?.url,
    sound?.params?.path,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeSoundSourceValue(candidate);
    if (normalized) return normalized;
  }

  return null;
}

function readSoundOrdinalFromId(sound) {
  const rawId = typeof sound?.audioId === "string"
    ? sound.audioId
    : (typeof sound?.id === "string" ? sound.id : "");
  const match = rawId.trim().match(/(?:^|[-_])(sound|audio)[-_]?(\d+)$/i);
  if (!match) return null;
  const ordinal = Number.parseInt(match[2], 10);
  return Number.isInteger(ordinal) && ordinal > 0 ? ordinal : null;
}

export function resolveSoundCatalogSource(sound) {
  const soundType = typeof sound?.audioType === "string" ? sound.audioType : sound?.type;
  const catalogOptions = getSoundAssetOptionsForType(soundType);
  if (!Array.isArray(catalogOptions) || catalogOptions.length === 0) return null;

  const ordinal = readSoundOrdinalFromId(sound);
  const index = Number.isInteger(ordinal)
    ? Math.max(0, Math.min(catalogOptions.length - 1, ordinal - 1))
    : 0;
  const path = catalogOptions[index]?.value;
  return normalizeSoundSourceValue(path);
}

export function resolveAuthoredSoundSource(sound) {
  return getAuthoredSoundSource(sound) || resolveSoundCatalogSource(sound);
}

export function resolveSoundPlaybackSource(sound) {
  const authoredSource = resolveAuthoredSoundSource(sound);
  if (!authoredSource) return null;
  if (hasAbsoluteUrlScheme(authoredSource) || authoredSource.startsWith("//")) return authoredSource;
  if (authoredSource.startsWith("/")) return authoredSource;
  if (authoredSource.startsWith("../")) return authoredSource;
  if (authoredSource.startsWith("./data/")) return `../${authoredSource.slice(2)}`;
  if (authoredSource.startsWith("data/")) return `../${authoredSource}`;
  return authoredSource;
}
