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

export function resolveSoundPlaybackSource(sound) {
  const authoredSource = getAuthoredSoundSource(sound);
  if (!authoredSource) return null;
  if (hasAbsoluteUrlScheme(authoredSource) || authoredSource.startsWith("//")) return authoredSource;
  if (authoredSource.startsWith("/")) return authoredSource;
  if (authoredSource.startsWith("../")) return authoredSource;
  if (authoredSource.startsWith("./data/")) return `../${authoredSource.slice(2)}`;
  if (authoredSource.startsWith("data/")) return `../${authoredSource}`;
  return authoredSource;
}
